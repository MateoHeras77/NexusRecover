"""
NexusRecover — IRROPS Optimizer
Uses OR-Tools CP-SAT to minimize total disruption cost across a connecting bank.

Decision variables per OUTBOUND flight:
  - delay[i]   : integer minutes of delay applied (0–max_delay)
  - cancel[i]  : bool, 1 = flight cancelled

Decision variables per INBOUND flight:
  - land_yyz[i]    : bool, 1 = lands at YYZ (subject to capacity)
  - divert_ytz[i]  : bool, 1 = diverted to Billy Bishop (YTZ)
  - divert_yhm[i]  : bool, 1 = diverted to Hamilton (YHM)
  - Constraint: land_yyz + divert_ytz + divert_yhm = 1 (exactly one)

Derived variable per PAX group:
  - connection_made[j] : bool, 1 = passengers make their connection
  - Forced to 0 if inbound is diverted OR outbound is cancelled

Objective (minimize):
  Σ delay_cost(i)         — operational cost per minute by aircraft type
  + Σ stranded_cost(j)    — PAX group cost when conn=0 (by tier)
  + Σ cancel_penalty(i)   — fixed penalty per cancelled outbound
  + Σ diversion_transport — all-pax transport cost at alternate
  + Σ soft_violations     — astronomical penalty for curfew/crew/capacity
"""

import json
from pathlib import Path
from ortools.sat.python import cp_model

from schemas import (
    Scenario, OptimizeResult, FlightDecision, InboundDecision, PaxGroupResult,
    AircraftCost, InboundFlight, OutboundFlight, PaxGroup, GlobalCosts,
)

SCALE = 100           # Scale USD to integer cents (CP-SAT requires integers)
MAX_DELAY = 180       # Hard upper bound on outbound delay (minutes)
SOLVER_TIMEOUT_S = 5
WINDOW_MIN = 30       # Capacity window size (30 min = half-hour buckets)


def _minutes_to_clock(base_clock: str, offset_min: int) -> str:
    h, m = map(int, base_clock.split(":"))
    total = h * 60 + m + offset_min
    total = max(0, total)
    return f"{(total // 60) % 24:02d}:{total % 60:02d}"


def _aircraft_cost_map(costs: list[AircraftCost]) -> dict[str, AircraftCost]:
    return {c.aircraft_type: c for c in costs}


def _inbound_map(flights: list[InboundFlight]) -> dict[str, InboundFlight]:
    return {f.flight_id: f for f in flights}


def _outbound_map(flights: list[OutboundFlight]) -> dict[str, OutboundFlight]:
    return {f.flight_id: f for f in flights}


def _build_capacity_windows(
    inbound_flights: list[InboundFlight],
    window_size_min: int = WINDOW_MIN,
) -> dict[int, list[int]]:
    """
    Group inbound flights by 30-minute ETA buckets.
    Returns: {bucket_id: [list of inbound flight indices]}
    """
    windows: dict[int, list[int]] = {}
    for i, f in enumerate(inbound_flights):
        bucket = f.eta_min // window_size_min
        windows.setdefault(bucket, []).append(i)
    return windows


def _get_mct(inb: InboundFlight, hub_airport) -> int:
    return hub_airport.mct_international_min if inb.is_international \
           else hub_airport.mct_domestic_min


def compute_baseline(scenario: Scenario) -> OptimizeResult:
    """
    Baseline: no intervention. All outbound flights depart on schedule.
    All inbound flights land at YYZ (capacity ignored).
    Calculates cost of stranded PAX based purely on timing vs MCT.
    """
    ac_map = _aircraft_cost_map(scenario.aircraft_costs)
    inbound_map_d = _inbound_map(scenario.inbound_flights)
    outbound_map_d = _outbound_map(scenario.outbound_flights)
    hub_airport = next(a for a in scenario.airports if a.code == scenario.hub)

    total_cost = 0.0
    flight_decisions = []
    pax_results = []
    passengers_protected = 0
    passengers_stranded = 0

    for out in scenario.outbound_flights:
        flight_decisions.append(FlightDecision(
            flight_id=out.flight_id,
            delay_applied_min=0,
            cancelled=False,
            etd_final_min=out.std_min,
            etd_final_clock=_minutes_to_clock(scenario.sim_start_clock, out.std_min),
            cost_delay_usd=0.0,
        ))

    for pg in scenario.pax_groups:
        inb = inbound_map_d[pg.inbound_flight_id]
        out = outbound_map_d[pg.outbound_flight_id]
        mct = _get_mct(inb, hub_airport)

        window = out.std_min - inb.eta_min
        made = window >= mct

        penalty = (
            scenario.global_costs.business_stranded_cost_usd if pg.tier == "business"
            else scenario.global_costs.economy_stranded_cost_usd
        )
        cost = 0.0 if made else pg.count * penalty

        if made:
            passengers_protected += pg.count
        else:
            passengers_stranded += pg.count
            total_cost += cost

        pax_results.append(PaxGroupResult(
            group_id=pg.group_id,
            inbound_flight_id=pg.inbound_flight_id,
            outbound_flight_id=pg.outbound_flight_id,
            count=pg.count,
            tier=pg.tier,
            connection_made=made,
            cost_stranded_usd=cost,
        ))

    # Baseline inbound decisions: all land at YYZ, no diversions
    inbound_decisions = [
        InboundDecision(flight_id=inb.flight_id, diverted_to=None, diversion_cost_usd=0.0)
        for inb in scenario.inbound_flights
    ]

    return OptimizeResult(
        scenario_id=scenario.scenario_id,
        baseline_cost_usd=total_cost,
        optimized_cost_usd=total_cost,
        savings_usd=0.0,
        passengers_protected=passengers_protected,
        passengers_stranded=passengers_stranded,
        total_delay_minutes=0,
        flights_diverted=0,
        diversion_cost_usd=0.0,
        flight_decisions=flight_decisions,
        pax_results=pax_results,
        inbound_decisions=inbound_decisions,
    )


def optimize(scenario: Scenario) -> OptimizeResult:
    """
    Run CP-SAT optimizer. Returns the cost-minimizing recovery plan.
    Soft constraints guarantee FEASIBLE is always returned.
    """
    gc = scenario.global_costs
    ac_map = _aircraft_cost_map(scenario.aircraft_costs)
    inbound_map_d = _inbound_map(scenario.inbound_flights)
    outbound_map_d = _outbound_map(scenario.outbound_flights)
    hub_airport = next(a for a in scenario.airports if a.code == scenario.hub)
    alt_map = {a.code: a for a in scenario.alternate_airports}

    model = cp_model.CpModel()

    # ── Outbound decision variables ─────────────────────────────────────────
    delay_vars: dict[str, cp_model.IntVar] = {}
    cancel_vars: dict[str, cp_model.BoolVar] = {}

    for out in scenario.outbound_flights:
        delay_vars[out.flight_id] = model.new_int_var(0, MAX_DELAY, f"delay_{out.flight_id}")
        cancel_vars[out.flight_id] = model.new_bool_var(f"cancel_{out.flight_id}")

    # ── Inbound diversion decision variables ────────────────────────────────
    land_yyz_vars: dict[str, cp_model.BoolVar] = {}
    divert_ytz_vars: dict[str, cp_model.BoolVar] = {}
    divert_yhm_vars: dict[str, cp_model.BoolVar] = {}

    for inb in scenario.inbound_flights:
        land_yyz_vars[inb.flight_id] = model.new_bool_var(f"land_yyz_{inb.flight_id}")
        divert_ytz_vars[inb.flight_id] = model.new_bool_var(f"divert_ytz_{inb.flight_id}")
        divert_yhm_vars[inb.flight_id] = model.new_bool_var(f"divert_yhm_{inb.flight_id}")
        # Exactly one destination per inbound flight
        model.add(
            land_yyz_vars[inb.flight_id]
            + divert_ytz_vars[inb.flight_id]
            + divert_yhm_vars[inb.flight_id] == 1
        )

    # ── Capacity constraints at YYZ (30-min windows) ────────────────────────
    max_slots_per_window = hub_airport.slots_per_hour_storm // 2
    cap_windows = _build_capacity_windows(scenario.inbound_flights)
    cap_soft_vars: dict[int, cp_model.BoolVar] = {}

    for bucket, indices in cap_windows.items():
        if len(indices) <= max_slots_per_window:
            continue  # No constraint needed
        cap_soft_vars[bucket] = model.new_bool_var(f"cap_soft_{bucket}")
        yyz_landings = [land_yyz_vars[scenario.inbound_flights[i].flight_id] for i in indices]
        # Soft: can exceed but at enormous cost
        model.add(
            sum(yyz_landings) <= max_slots_per_window + len(indices) * cap_soft_vars[bucket]
        )

    # ── Alternate airport capacity (hard limits) ────────────────────────────
    if "YTZ" in alt_map:
        model.add(sum(divert_ytz_vars.values()) <= alt_map["YTZ"].max_diversion_slots)
    if "YHM" in alt_map:
        model.add(sum(divert_yhm_vars.values()) <= alt_map["YHM"].max_diversion_slots)

    # ── Connection variables ────────────────────────────────────────────────
    conn_vars: dict[str, cp_model.BoolVar] = {}
    for pg in scenario.pax_groups:
        conn_vars[pg.group_id] = model.new_bool_var(f"conn_{pg.group_id}")

    # ── Soft curfew/crew constraint per outbound ─────────────────────────────
    soft_overrun_vars: dict[str, cp_model.BoolVar] = {}
    for out in scenario.outbound_flights:
        soft_overrun_vars[out.flight_id] = model.new_bool_var(f"soft_{out.flight_id}")
        model.add(
            delay_vars[out.flight_id] <= out.max_delay_min + MAX_DELAY * soft_overrun_vars[out.flight_id]
        )

    # ── Connection feasibility constraints ───────────────────────────────────
    for pg in scenario.pax_groups:
        inb = inbound_map_d[pg.inbound_flight_id]
        out = outbound_map_d[pg.outbound_flight_id]
        mct = _get_mct(inb, hub_airport)

        # window = std_out + delay_out - eta_inb (can be negative)
        window_var = model.new_int_var(-MAX_DELAY, MAX_DELAY + 300, f"win_{pg.group_id}")
        model.add(window_var == out.std_min + delay_vars[out.flight_id] - inb.eta_min)

        # conn=1 requires window >= mct (big-M encoding)
        model.add(window_var >= mct - (MAX_DELAY + 300) * (1 - conn_vars[pg.group_id]))

        # conn=0 if outbound is cancelled
        model.add(conn_vars[pg.group_id] == 0).only_enforce_if(cancel_vars[out.flight_id])
        model.add_implication(conn_vars[pg.group_id], cancel_vars[out.flight_id].negated())

        # conn=0 FORCED if inbound is diverted (not landing at YYZ)
        model.add(conn_vars[pg.group_id] <= land_yyz_vars[pg.inbound_flight_id])

    # ── Objective function ───────────────────────────────────────────────────
    objective_terms = []

    # 1. Outbound delay operational cost
    for out in scenario.outbound_flights:
        ac = ac_map[out.aircraft_type]
        cost_per_min_scaled = int(ac.cost_per_min_usd * SCALE)
        objective_terms.append(cost_per_min_scaled * delay_vars[out.flight_id])

    # 2. Stranded PAX cost (fires when conn[j] = 0)
    for pg in scenario.pax_groups:
        penalty = (
            gc.business_stranded_cost_usd if pg.tier == "business"
            else gc.economy_stranded_cost_usd
        )
        total_stranded_scaled = int(pg.count * penalty * SCALE)
        objective_terms.append(total_stranded_scaled)
        objective_terms.append(-total_stranded_scaled * conn_vars[pg.group_id])

    # 3. Outbound cancellation penalty
    for out in scenario.outbound_flights:
        cancel_cost_scaled = int(gc.cancellation_penalty_usd * SCALE)
        objective_terms.append(cancel_cost_scaled * cancel_vars[out.flight_id])

    # 4. Diversion transport cost (all pax on inbound × transport cost per pax)
    for inb in scenario.inbound_flights:
        if "YTZ" in alt_map:
            ytz_cost = int(inb.total_pax * alt_map["YTZ"].transport_cost_per_pax_usd * SCALE)
            objective_terms.append(ytz_cost * divert_ytz_vars[inb.flight_id])
        if "YHM" in alt_map:
            yhm_cost = int(inb.total_pax * alt_map["YHM"].transport_cost_per_pax_usd * SCALE)
            objective_terms.append(yhm_cost * divert_yhm_vars[inb.flight_id])

    # 5. Soft constraint violations (curfew, crew duty hours)
    for out in scenario.outbound_flights:
        soft_penalty_scaled = int(gc.soft_constraint_penalty_usd * SCALE)
        objective_terms.append(soft_penalty_scaled * soft_overrun_vars[out.flight_id])

    # 6. Soft capacity violation (should never fire if diversion works correctly)
    for bucket, cap_soft in cap_soft_vars.items():
        cap_penalty_scaled = int(gc.soft_constraint_penalty_usd * SCALE)
        objective_terms.append(cap_penalty_scaled * cap_soft)

    model.minimize(sum(objective_terms))

    # ── Solve ────────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = SOLVER_TIMEOUT_S
    solver.parameters.num_search_workers = 4
    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return compute_baseline(scenario)

    # ── Extract outbound decisions ────────────────────────────────────────────
    flight_decisions = []
    total_cost = 0.0
    total_delay_minutes = 0

    for out in scenario.outbound_flights:
        delay_applied = solver.value(delay_vars[out.flight_id])
        cancelled = bool(solver.value(cancel_vars[out.flight_id]))
        ac = ac_map[out.aircraft_type]
        delay_cost = delay_applied * ac.cost_per_min_usd
        cancel_cost = gc.cancellation_penalty_usd if cancelled else 0.0
        total_cost += delay_cost + cancel_cost
        total_delay_minutes += delay_applied

        etd_final = out.std_min + delay_applied
        flight_decisions.append(FlightDecision(
            flight_id=out.flight_id,
            delay_applied_min=delay_applied,
            cancelled=cancelled,
            etd_final_min=etd_final,
            etd_final_clock=_minutes_to_clock(scenario.sim_start_clock, etd_final),
            cost_delay_usd=delay_cost,
        ))

    # ── Extract inbound decisions ─────────────────────────────────────────────
    inbound_decisions = []
    flights_diverted = 0
    diversion_cost_total = 0.0

    for inb in scenario.inbound_flights:
        ytz_val = solver.value(divert_ytz_vars[inb.flight_id])
        yhm_val = solver.value(divert_yhm_vars[inb.flight_id])

        if ytz_val and "YTZ" in alt_map:
            diverted_to = "YTZ"
            transport_cost = inb.total_pax * alt_map["YTZ"].transport_cost_per_pax_usd
        elif yhm_val and "YHM" in alt_map:
            diverted_to = "YHM"
            transport_cost = inb.total_pax * alt_map["YHM"].transport_cost_per_pax_usd
        else:
            diverted_to = None
            transport_cost = 0.0

        if diverted_to:
            flights_diverted += 1
            diversion_cost_total += transport_cost
            total_cost += transport_cost

        inbound_decisions.append(InboundDecision(
            flight_id=inb.flight_id,
            diverted_to=diverted_to,
            diversion_cost_usd=transport_cost,
        ))

    # ── Extract PAX group results ─────────────────────────────────────────────
    pax_results = []
    passengers_protected = 0
    passengers_stranded = 0

    for pg in scenario.pax_groups:
        made = bool(solver.value(conn_vars[pg.group_id]))
        penalty = (
            gc.business_stranded_cost_usd if pg.tier == "business"
            else gc.economy_stranded_cost_usd
        )
        stranded_cost = 0.0 if made else pg.count * penalty
        total_cost += stranded_cost

        if made:
            passengers_protected += pg.count
        else:
            passengers_stranded += pg.count

        pax_results.append(PaxGroupResult(
            group_id=pg.group_id,
            inbound_flight_id=pg.inbound_flight_id,
            outbound_flight_id=pg.outbound_flight_id,
            count=pg.count,
            tier=pg.tier,
            connection_made=made,
            cost_stranded_usd=stranded_cost,
        ))

    baseline = compute_baseline(scenario)

    return OptimizeResult(
        scenario_id=scenario.scenario_id,
        baseline_cost_usd=baseline.baseline_cost_usd,
        optimized_cost_usd=total_cost,
        savings_usd=max(0.0, baseline.baseline_cost_usd - total_cost),
        passengers_protected=passengers_protected,
        passengers_stranded=passengers_stranded,
        total_delay_minutes=total_delay_minutes,
        flights_diverted=flights_diverted,
        diversion_cost_usd=diversion_cost_total,
        flight_decisions=flight_decisions,
        pax_results=pax_results,
        inbound_decisions=inbound_decisions,
    )


if __name__ == "__main__":
    data_path = Path(__file__).parent.parent / "data" / "mock_scenario.json"
    raw = json.loads(data_path.read_text())
    scenario = Scenario(**raw)

    print("Running optimizer...")
    result = optimize(scenario)

    print(f"\n{'='*56}")
    print(f"  Baseline cost:      ${result.baseline_cost_usd:>10,.0f}")
    print(f"  Optimized cost:     ${result.optimized_cost_usd:>10,.0f}")
    print(f"  Savings:            ${result.savings_usd:>10,.0f}")
    print(f"  PAX protected:      {result.passengers_protected}")
    print(f"  PAX stranded:       {result.passengers_stranded}")
    print(f"  Flights diverted:   {result.flights_diverted}")
    print(f"  Diversion cost:     ${result.diversion_cost_usd:>10,.0f}")
    print(f"  Total delay min:    {result.total_delay_minutes}")
    print(f"{'='*56}")

    print("\nInbound decisions:")
    for d in result.inbound_decisions:
        status = f"DIVERTED → {d.diverted_to} (cost ${d.diversion_cost_usd:,.0f})" \
                 if d.diverted_to else "lands at YYZ"
        print(f"  {d.flight_id}: {status}")

    print("\nOutbound flight decisions:")
    for fd in result.flight_decisions:
        status = "CANCELLED" if fd.cancelled else f"+{fd.delay_applied_min}min → {fd.etd_final_clock}"
        print(f"  {fd.flight_id}: {status}  (delay cost: ${fd.cost_delay_usd:,.0f})")

    print("\nPAX group results:")
    for pr in result.pax_results:
        status = "✓ MADE" if pr.connection_made else f"✗ STRANDED (${pr.cost_stranded_usd:,.0f})"
        print(f"  {pr.group_id} [{pr.inbound_flight_id}→{pr.outbound_flight_id}] "
              f"{pr.count}pax {pr.tier}: {status}")
