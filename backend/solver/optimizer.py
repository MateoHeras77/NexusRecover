"""
NexusRecover — IRROPS Optimizer
Uses OR-Tools CP-SAT to minimize total disruption cost across a connecting bank.

Decision variables per outbound flight:
  - delay[i]   : integer minutes of delay applied (0–max_delay)
  - cancel[i]  : bool, 1 = flight cancelled

Derived variable per PAX group:
  - connection_made[j] : bool, 1 = passengers make their connection

Objective (minimize):
  Σ delay_cost(i) + Σ stranded_cost(j) + Σ cancel_penalty(i) + soft_violations
"""

import json
from pathlib import Path
from ortools.sat.python import cp_model

from schemas import (
    Scenario, OptimizeResult, FlightDecision, PaxGroupResult,
    AircraftCost, InboundFlight, OutboundFlight, PaxGroup, GlobalCosts,
)

SCALE = 100          # Scale USD to integer cents (CP-SAT requires integers)
MAX_DELAY = 180      # Hard upper bound on delay (minutes)
SOLVER_TIMEOUT_S = 5


def _minutes_to_clock(base_clock: str, offset_min: int) -> str:
    """Convert sim-start clock + offset minutes to HH:MM string."""
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


def _compute_connection_made(
    pax: PaxGroup,
    inbound: InboundFlight,
    outbound: OutboundFlight,
    outbound_delay_min: int,
    mct_min: int,
) -> bool:
    """Return True if connection is physically possible given actual timings."""
    actual_arrival = inbound.eta_min
    actual_departure = outbound.std_min + outbound_delay_min
    return (actual_departure - actual_arrival) >= mct_min


def compute_baseline(scenario: Scenario) -> OptimizeResult:
    """
    Baseline: no intervention. All outbound flights depart on schedule.
    Calculates cost of stranded PAX and missed connections.
    """
    ac_map = _aircraft_cost_map(scenario.aircraft_costs)
    inbound_map = _inbound_map(scenario.inbound_flights)
    outbound_map = _outbound_map(scenario.outbound_flights)

    # Hub airport for MCT lookups
    hub_airport = next(a for a in scenario.airports if a.code == scenario.hub)

    total_cost = 0.0
    flight_decisions = []
    pax_results = []
    passengers_protected = 0
    passengers_stranded = 0
    total_delay_minutes = 0

    for out in scenario.outbound_flights:
        ac = ac_map[out.aircraft_type]
        flight_decisions.append(FlightDecision(
            flight_id=out.flight_id,
            delay_applied_min=0,
            cancelled=False,
            etd_final_min=out.std_min,
            etd_final_clock=_minutes_to_clock(scenario.sim_start_clock, out.std_min),
            cost_delay_usd=0.0,
        ))

    for pg in scenario.pax_groups:
        inb = inbound_map[pg.inbound_flight_id]
        out = outbound_map[pg.outbound_flight_id]
        intl_origins = {"LAX", "MIA", "JFK", "EWR"}
        mct = hub_airport.mct_international_min if inb.origin in intl_origins \
              else hub_airport.mct_domestic_min

        made = _compute_connection_made(pg, inb, out, 0, mct)
        penalty = (
            scenario.global_costs.business_stranded_cost_usd
            if pg.tier == "business"
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

    return OptimizeResult(
        scenario_id=scenario.scenario_id,
        baseline_cost_usd=total_cost,
        optimized_cost_usd=total_cost,
        savings_usd=0.0,
        passengers_protected=passengers_protected,
        passengers_stranded=passengers_stranded,
        total_delay_minutes=0,
        flight_decisions=flight_decisions,
        pax_results=pax_results,
    )


def optimize(scenario: Scenario) -> OptimizeResult:
    """
    Run CP-SAT optimizer. Returns the cost-minimizing recovery plan.
    Soft constraints guarantee FEASIBLE is always returned.
    """
    gc = scenario.global_costs
    ac_map = _aircraft_cost_map(scenario.aircraft_costs)
    inbound_map = _inbound_map(scenario.inbound_flights)
    outbound_map_dict = _outbound_map(scenario.outbound_flights)
    hub_airport = next(a for a in scenario.airports if a.code == scenario.hub)

    model = cp_model.CpModel()

    # ── Decision variables ──────────────────────────────────────────────────
    delay_vars: dict[str, cp_model.IntVar] = {}
    cancel_vars: dict[str, cp_model.BoolVar] = {}

    for out in scenario.outbound_flights:
        delay_vars[out.flight_id] = model.new_int_var(0, MAX_DELAY, f"delay_{out.flight_id}")
        cancel_vars[out.flight_id] = model.new_bool_var(f"cancel_{out.flight_id}")

    # connection_made[group_id] = 1 if passengers make their connection
    conn_vars: dict[str, cp_model.BoolVar] = {}
    for pg in scenario.pax_groups:
        conn_vars[pg.group_id] = model.new_bool_var(f"conn_{pg.group_id}")

    # ── Soft constraint: max delay per flight (curfew / crew duty) ──────────
    # If delay exceeds max_delay, cancel_soft flag fires (penalized astronomically)
    soft_overrun_vars: dict[str, cp_model.BoolVar] = {}
    for out in scenario.outbound_flights:
        soft_overrun_vars[out.flight_id] = model.new_bool_var(f"soft_{out.flight_id}")
        # soft_overrun = 1 if delay > max_delay_min
        # Encode: delay > max → soft = 1 (using indicator constraint)
        # delay ≤ max_delay + MAX_DELAY * soft_overrun (always feasible)
        model.add(
            delay_vars[out.flight_id] <= out.max_delay_min + MAX_DELAY * soft_overrun_vars[out.flight_id]
        )

    # ── Connection feasibility constraints ───────────────────────────────────
    # connection_made[j] = 1 only if:
    #   (std_out + delay_out - eta_inbound) >= mct  AND  flight not cancelled
    #
    # We linearize: conn[j] ≤ 1 - cancel[out]
    #               conn[j] = 1 → (std_out + delay_out - eta_inb) >= mct
    #
    # Use a "connection window" variable: window[j] = std_out + delay_out - eta_inb
    for pg in scenario.pax_groups:
        inb = inbound_map[pg.inbound_flight_id]
        out = outbound_map_dict[pg.outbound_flight_id]
        mct = hub_airport.mct_international_min if inb.origin in ("LAX", "MIA", "JFK", "EWR") \
              else hub_airport.mct_domestic_min

        # window = std_out + delay_out - eta_inb  (can be negative)
        window_var = model.new_int_var(-MAX_DELAY, MAX_DELAY + 300, f"win_{pg.group_id}")
        model.add(window_var == out.std_min + delay_vars[out.flight_id] - inb.eta_min)

        # conn[j] can only be 1 if window >= mct
        # Encode: conn[j] = 1 → window >= mct
        #         conn[j] = 0 OR window >= mct
        # Using: window >= mct - MAX_DELAY * (1 - conn[j])
        model.add(window_var >= mct - (MAX_DELAY + 300) * (1 - conn_vars[pg.group_id]))

        # conn[j] = 1 → window >= mct (above)
        # conn[j] = 0 is always allowed — optimizer may choose to not protect
        # BUT we must prevent conn=1 when window < mct. Enforce:
        # window < mct → conn = 0
        # i.e. conn[j] ≤ 1 only when window >= mct (already handled above with big-M)

        # conn[j] = 0 if flight is cancelled
        model.add(conn_vars[pg.group_id] == 0).only_enforce_if(cancel_vars[out.flight_id])
        # conn can only be 1 if not cancelled
        model.add_implication(conn_vars[pg.group_id], cancel_vars[out.flight_id].negated())

    # ── Objective function ───────────────────────────────────────────────────
    objective_terms = []

    # 1. Delay operational cost (scaled to integer cents)
    for out in scenario.outbound_flights:
        ac = ac_map[out.aircraft_type]
        cost_per_min_scaled = int(ac.cost_per_min_usd * SCALE)
        objective_terms.append(cost_per_min_scaled * delay_vars[out.flight_id])

    # 2. Stranded passenger cost
    for pg in scenario.pax_groups:
        penalty = (
            gc.business_stranded_cost_usd if pg.tier == "business"
            else gc.economy_stranded_cost_usd
        )
        cost_if_stranded_scaled = int(pg.count * penalty * SCALE)
        # cost = cost_if_stranded * (1 - conn[j])
        # = cost_if_stranded - cost_if_stranded * conn[j]
        # Since we minimize, we add the constant and subtract conn contribution
        objective_terms.append(cost_if_stranded_scaled)
        objective_terms.append(-cost_if_stranded_scaled * conn_vars[pg.group_id])

    # 3. Cancellation penalty
    for out in scenario.outbound_flights:
        cancel_cost_scaled = int(gc.cancellation_penalty_usd * SCALE)
        objective_terms.append(cancel_cost_scaled * cancel_vars[out.flight_id])

    # 4. Soft constraint violation penalty (curfew / crew duty)
    for out in scenario.outbound_flights:
        soft_penalty_scaled = int(gc.soft_constraint_penalty_usd * SCALE)
        objective_terms.append(soft_penalty_scaled * soft_overrun_vars[out.flight_id])

    model.minimize(sum(objective_terms))

    # ── Solve ────────────────────────────────────────────────────────────────
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = SOLVER_TIMEOUT_S
    solver.parameters.num_search_workers = 4
    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # Fallback: return no-delay plan (should never happen with soft constraints)
        return compute_baseline(scenario)

    # ── Extract results ───────────────────────────────────────────────────────
    flight_decisions = []
    total_delay_minutes = 0
    total_cost = 0.0

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

    # Compute baseline for savings_delta
    baseline = compute_baseline(scenario)

    return OptimizeResult(
        scenario_id=scenario.scenario_id,
        baseline_cost_usd=baseline.baseline_cost_usd,
        optimized_cost_usd=total_cost,
        savings_usd=max(0.0, baseline.baseline_cost_usd - total_cost),
        passengers_protected=passengers_protected,
        passengers_stranded=passengers_stranded,
        total_delay_minutes=total_delay_minutes,
        flight_decisions=flight_decisions,
        pax_results=pax_results,
    )


if __name__ == "__main__":
    # Standalone test
    data_path = Path(__file__).parent.parent / "data" / "mock_scenario.json"
    raw = json.loads(data_path.read_text())

    from schemas import Scenario
    scenario = Scenario(**raw)

    print("Running optimizer...")
    result = optimize(scenario)

    print(f"\n{'='*50}")
    print(f"  Baseline cost:   ${result.baseline_cost_usd:,.0f}")
    print(f"  Optimized cost:  ${result.optimized_cost_usd:,.0f}")
    print(f"  Savings:         ${result.savings_usd:,.0f}")
    print(f"  PAX protected:   {result.passengers_protected}")
    print(f"  PAX stranded:    {result.passengers_stranded}")
    print(f"  Total delay min: {result.total_delay_minutes}")
    print(f"{'='*50}")
    print("\nFlight decisions:")
    for fd in result.flight_decisions:
        status = "CANCELLED" if fd.cancelled else f"+{fd.delay_applied_min}min → {fd.etd_final_clock}"
        print(f"  {fd.flight_id}: {status}  (delay cost: ${fd.cost_delay_usd:,.0f})")
    print("\nPAX group results:")
    for pr in result.pax_results:
        status = "✓ MADE" if pr.connection_made else f"✗ STRANDED (${pr.cost_stranded_usd:,.0f})"
        print(f"  {pr.group_id} [{pr.inbound_flight_id}→{pr.outbound_flight_id}] {pr.count}pax {pr.tier}: {status}")
