/**
 * Payload builders for N8N webhook notifications.
 *
 * Two separate webhooks:
 *   AUTHORITIES  — Airport ops, ATC, ground handling at YYZ, YTZ, YHM
 *   HOSPITALITY  — Hotels, ground transport, gate agents per alternate airport
 */

const MIN_TO_CLOCK = (simStart, min) => {
  const [h, m] = simStart.split(':').map(Number)
  const total = h * 60 + m + min
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// ── Shared context helpers ──────────────────────────────────────────────────

function buildDisversionDetail(scenario, optimizeResult) {
  const decisions = optimizeResult.inbound_decisions ?? []
  return decisions
    .filter(d => d.diverted_to)
    .map(d => {
      const flight = scenario.inbound_flights.find(f => f.flight_id === d.flight_id)
      const alt = scenario.alternate_airports?.find(a => a.code === d.diverted_to)

      // Find all pax groups on this inbound flight
      const paxGroups = scenario.pax_groups.filter(pg => pg.inbound_flight_id === d.flight_id)
      const paxResults = paxGroups.map(pg => {
        const pr = optimizeResult.pax_results?.find(r => r.group_id === pg.group_id)
        return {
          group_id: pg.group_id,
          tier: pg.tier,
          count: pg.count,
          original_outbound: pg.outbound_flight_id,
          connection_outcome: pr?.connection_made ? 'protected_via_diversion' : 'rebooking_required',
        }
      })

      const totalPax = paxGroups.reduce((s, pg) => s + pg.count, 0)
      const businessPax = paxGroups.filter(pg => pg.tier === 'business').reduce((s, pg) => s + pg.count, 0)
      const economyPax = totalPax - businessPax

      return {
        flight_id: d.flight_id,
        origin: flight?.origin ?? 'UNKNOWN',
        aircraft_type: flight?.aircraft_type ?? 'UNKNOWN',
        originally_destined: scenario.hub,
        diverted_to_iata: d.diverted_to,
        diverted_to_name: alt?.name ?? d.diverted_to,
        eta_clock: flight ? MIN_TO_CLOCK(scenario.sim_start_clock, flight.eta_min) : '—',
        total_pax_onboard: flight?.total_pax ?? 0,
        local_pax: flight?.local_pax ?? 0,
        connecting_pax: (flight?.total_pax ?? 0) - (flight?.local_pax ?? 0),
        pax_breakdown: { business: businessPax, economy: economyPax },
        pax_groups: paxResults,
        diversion_cost_usd: d.diversion_cost_usd ?? 0,
        ground_transport_cost_per_pax_usd: alt?.ground_transport_cost_usd ?? 0,
        transfer_time_min: alt?.transfer_time_min ?? 0,
      }
    })
}

function buildFlightHoldDecisions(scenario, optimizeResult) {
  return (optimizeResult.flight_decisions ?? [])
    .filter(fd => fd.delay_applied_min > 0 && !fd.cancelled)
    .map(fd => {
      const flight = scenario.outbound_flights.find(f => f.flight_id === fd.flight_id)
      const affectedGroups = scenario.pax_groups.filter(pg => pg.outbound_flight_id === fd.flight_id)
      const protected_pax = affectedGroups.reduce((s, pg) => {
        const pr = optimizeResult.pax_results?.find(r => r.group_id === pg.group_id)
        return pr?.connection_made ? s + pg.count : s
      }, 0)

      return {
        flight_id: fd.flight_id,
        destination: flight?.destination ?? 'UNKNOWN',
        aircraft_type: flight?.aircraft_type ?? 'UNKNOWN',
        original_etd_clock: flight ? MIN_TO_CLOCK(scenario.sim_start_clock, flight.std_min) : '—',
        revised_etd_clock: MIN_TO_CLOCK(scenario.sim_start_clock, fd.etd_final_min),
        delay_applied_min: fd.delay_applied_min,
        connecting_pax_protected: protected_pax,
        hold_cost_usd: fd.cost_delay_usd ?? 0,
        reason: `Hold for ${protected_pax} connecting PAX — avoids stranding penalty`,
      }
    })
}

// ── AUTHORITIES payload ─────────────────────────────────────────────────────

export function buildAuthoritiesPayload(scenario, optimizeResult) {
  const hub = scenario.airports?.find(a => a.code === scenario.hub)
  const gc = scenario.global_costs ?? {}
  const diversions = buildDisversionDetail(scenario, optimizeResult)
  const holds = buildFlightHoldDecisions(scenario, optimizeResult)
  const altAirports = scenario.alternate_airports ?? []

  const totalPaxAffected = optimizeResult.pax_results?.length ?? 0
  const paxProtected = optimizeResult.pax_results?.filter(r => r.connection_made).length ?? 0
  const paxStranded = totalPaxAffected - paxProtected

  return {
    // ── Meta ──────────────────────────────────────────────────────────────
    event_type: 'nexus_plan_activated',
    notification_target: 'AUTHORITIES',
    issued_at_utc: new Date().toISOString(),
    issued_by: 'NexusRecover IRROPS Decision Support System',
    priority: 'HIGH',
    scenario_id: 'yyz_snowstorm',

    // ── Disruption context ────────────────────────────────────────────────
    disruption: {
      hub_airport: scenario.hub,
      hub_airport_name: hub?.name ?? 'Toronto Pearson International',
      event: 'YYZ Snowstorm — Ground Delay Program (GDP) Active',
      runway_capacity_nominal_arr_per_hr: hub?.slots_per_hour_nominal ?? 12,
      runway_capacity_storm_arr_per_hr: hub?.slots_per_hour_storm ?? 4,
      capacity_reduction_pct: Math.round((1 - (hub?.slots_per_hour_storm ?? 4) / (hub?.slots_per_hour_nominal ?? 12)) * 100),
      affected_inbound_flights: scenario.inbound_flights.filter(f => f.delay_min > 0).length,
      total_inbound_flights: scenario.inbound_flights.length,
      total_outbound_flights: scenario.outbound_flights.length,
    },

    // ── Optimizer decision summary ─────────────────────────────────────────
    optimizer_summary: {
      status: 'PLAN_ACTIVATED',
      baseline_cost_usd: optimizeResult.baseline_cost_usd,
      optimized_cost_usd: optimizeResult.optimized_cost_usd,
      savings_usd: optimizeResult.savings_usd,
      savings_pct: Math.round((optimizeResult.savings_usd / optimizeResult.baseline_cost_usd) * 100),
      total_pax_groups: totalPaxAffected,
      pax_groups_protected: paxProtected,
      pax_groups_stranded: paxStranded,
      flights_held: holds.length,
      flights_diverted: diversions.length,
      total_delay_minutes_applied: holds.reduce((s, h) => s + h.delay_applied_min, 0),
    },

    // ── Diversion orders (actionable) ──────────────────────────────────────
    diversion_orders: diversions.map(d => ({
      action: 'DIVERT_INBOUND',
      urgency: 'IMMEDIATE',
      flight_id: d.flight_id,
      from_airport: scenario.hub,
      to_airport: d.diverted_to_iata,
      to_airport_name: d.diverted_to_name,
      eta_at_alternate: d.eta_clock,
      total_pax_onboard: d.total_pax_onboard,
      pax_breakdown: d.pax_breakdown,
      required_slots: 1,
      ground_ops_required: [
        'Jetbridge / remote stand assignment',
        `Ground transport to YYZ — est. ${d.transfer_time_min} min`,
        'Customs coordination (if international)',
        'Baggage transfer coordination',
      ],
      contacts_to_notify: [
        `${d.diverted_to_iata} Airport Operations`,
        `${d.diverted_to_iata} ATC Tower`,
        `${d.diverted_to_iata} Ground Handling`,
        'Air Canada OCC (Operations Control Centre)',
        'YYZ Customer Service Supervisor',
      ],
    })),

    // ── Flight hold orders (actionable) ───────────────────────────────────
    hold_orders: holds.map(h => ({
      action: 'HOLD_DEPARTURE',
      urgency: 'SCHEDULED',
      flight_id: h.flight_id,
      destination: h.destination,
      original_etd: h.original_etd_clock,
      revised_etd: h.revised_etd_clock,
      hold_duration_min: h.delay_applied_min,
      connecting_pax_protected: h.connecting_pax_protected,
      hold_cost_usd: h.hold_cost_usd,
      gate_actions: [
        `Update gate display to new ETD ${h.revised_etd_clock}`,
        'Board connecting PAX from delayed inbounds first',
        'Notify cabin crew of revised block time',
      ],
    })),

    // ── Alternate airports status ──────────────────────────────────────────
    alternate_airports_activated: altAirports.map(alt => {
      const divToHere = diversions.filter(d => d.diverted_to_iata === alt.code)
      return {
        iata: alt.code,
        name: alt.name,
        status: divToHere.length > 0 ? 'ACTIVE — RECEIVING DIVERSIONS' : 'STANDBY',
        incoming_flights: divToHere.map(d => d.flight_id),
        total_pax_incoming: divToHere.reduce((s, d) => s + d.total_pax_onboard, 0),
        available_slots: alt.max_diversions ?? 3,
        slots_used: divToHere.length,
        transfer_time_to_yyz_min: alt.transfer_time_min,
      }
    }),

    // ── Raw optimizer data (for systems integration) ───────────────────────
    raw: {
      flight_decisions: optimizeResult.flight_decisions,
      inbound_decisions: optimizeResult.inbound_decisions,
    },
  }
}

// ── HOSPITALITY payload ────────────────────────────────────────────────────

export function buildHospitalityPayload(scenario, optimizeResult) {
  const gc = scenario.global_costs ?? {}
  const diversions = buildDisversionDetail(scenario, optimizeResult)
  const altAirports = scenario.alternate_airports ?? []

  // PAX stranded (missed connection) — need hotel + rebooking
  const strandedGroups = (optimizeResult.pax_results ?? [])
    .filter(pr => !pr.connection_made)
    .map(pr => {
      const pg = scenario.pax_groups.find(g => g.group_id === pr.group_id)
      const inb = scenario.inbound_flights.find(f => f.flight_id === pg?.inbound_flight_id)
      const out = scenario.outbound_flights.find(f => f.flight_id === pg?.outbound_flight_id)
      const penalty = pg?.tier === 'business'
        ? (gc.business_stranded_cost_usd ?? 1750)
        : (gc.economy_stranded_cost_usd ?? 450)
      return {
        group_id: pr.group_id,
        tier: pg?.tier ?? 'economy',
        count: pg?.count ?? 0,
        arriving_on: pg?.inbound_flight_id,
        origin: inb?.origin ?? '?',
        missed_connection: pg?.outbound_flight_id,
        missed_destination: out?.destination ?? '?',
        cost_per_pax_usd: penalty,
        total_stranding_cost_usd: (pg?.count ?? 0) * penalty,
        service_required: [
          'Hotel accommodation (1 night)',
          'Meal vouchers',
          'Rebooking on next available flight',
          ...(pg?.tier === 'business' ? ['Lounge access', 'Priority rebooking desk'] : []),
        ],
      }
    })

  const totalStrandedPax = strandedGroups.reduce((s, g) => s + g.count, 0)
  const businessStranded = strandedGroups.filter(g => g.tier === 'business').reduce((s, g) => s + g.count, 0)
  const economyStranded = totalStrandedPax - businessStranded

  return {
    // ── Meta ──────────────────────────────────────────────────────────────
    event_type: 'nexus_plan_activated',
    notification_target: 'HOSPITALITY',
    issued_at_utc: new Date().toISOString(),
    issued_by: 'NexusRecover IRROPS Decision Support System',
    priority: 'HIGH',
    scenario_id: 'yyz_snowstorm',

    // ── Disruption summary ────────────────────────────────────────────────
    disruption_summary: {
      hub_airport: scenario.hub,
      event: 'YYZ Snowstorm — Diversion Plan Active',
      total_diverted_flights: diversions.length,
      total_pax_diverted: diversions.reduce((s, d) => s + d.total_pax_onboard, 0),
      total_pax_stranded_at_hub: totalStrandedPax,
      pax_breakdown_stranded: { business: businessStranded, economy: economyStranded },
    },

    // ── Per-alternate ground transport & arrival ──────────────────────────
    alternate_airport_ops: altAirports.map(alt => {
      const divToHere = diversions.filter(d => d.diverted_to_iata === alt.code)
      const paxIncoming = divToHere.reduce((s, d) => s + d.total_pax_onboard, 0)
      const bizIncoming = divToHere.reduce((s, d) => s + (d.pax_breakdown?.business ?? 0), 0)
      const ecoIncoming = paxIncoming - bizIncoming

      return {
        iata: alt.code,
        name: alt.name,
        status: divToHere.length > 0 ? 'ACTIVE' : 'NOT_USED',
        incoming_flights: divToHere.map(d => ({
          flight_id: d.flight_id,
          origin: d.origin,
          aircraft: d.aircraft_type,
          eta: d.eta_clock,
          pax_onboard: d.total_pax_onboard,
          pax_business: d.pax_breakdown?.business ?? 0,
          pax_economy: d.pax_breakdown?.economy ?? 0,
        })),
        total_pax_incoming: paxIncoming,
        pax_breakdown: { business: bizIncoming, economy: ecoIncoming },

        // Ground transport requirements
        ground_transport: {
          provider_contact: alt.transport_provider ?? 'TBD — coordinate with ground ops',
          vehicles_required: Math.ceil(paxIncoming / 50),
          pax_count: paxIncoming,
          pickup_airport: alt.code,
          drop_off: scenario.hub,
          estimated_transfer_min: alt.transfer_time_min,
          cost_per_pax_usd: alt.ground_transport_cost_usd,
          total_transport_cost_usd: paxIncoming * (alt.ground_transport_cost_usd ?? 0),
          priority_boarding: bizIncoming > 0 ? 'Business PAX first' : 'Standard boarding',
          luggage_handling: 'Transfer tags required — baggage follows PAX to YYZ carousel',
        },

        // What hospitality team needs to arrange at alternate
        on_site_requirements: [
          `Meet & assist for ${paxIncoming} PAX at arrivals`,
          'Signage: "Air Canada connecting passengers → Bus to YYZ"',
          ...(bizIncoming > 0 ? [`VIP escort for ${bizIncoming} Business class PAX`] : []),
          'Refreshments for PAX during wait (est. 30–60 min)',
          'Luggage wrapping/tagging service',
        ],
      }
    }),

    // ── Stranded PAX at YYZ — hotel & meal requirements ──────────────────
    stranded_pax_at_hub: {
      total_pax: totalStrandedPax,
      pax_breakdown: { business: businessStranded, economy: economyStranded },
      hotel_rooms_required: Math.ceil(totalStrandedPax / 1.8), // avg 1.8 pax/room
      hotel_type_required: businessStranded > 0 ? 'Minimum 4-star for business PAX' : '3-star airport hotel',
      meal_vouchers: {
        count: totalStrandedPax,
        value_per_pax_usd: businessStranded > 0 ? 75 : 35,
      },
      groups: strandedGroups,
    },

    // ── Lounge & gate hospitality at YYZ ─────────────────────────────────
    yyz_hub_requirements: {
      lounge_activation: businessStranded > 0,
      lounge_pax_count: businessStranded,
      customer_service_desks_needed: Math.max(2, Math.ceil(totalStrandedPax / 40)),
      rebooking_priority: [
        'Business + long-haul connections first',
        'Time-sensitive medical/special needs',
        'Remaining economy by original departure order',
      ],
      announcement_script: `Attention passengers: Due to weather conditions at Toronto Pearson,
Air Canada has activated a diversion and recovery plan.
Passengers on affected flights will receive individual notifications.
Please proceed to the customer service desk or check the Air Canada app for your updated itinerary.`,
    },

    // ── Cost summary ──────────────────────────────────────────────────────
    cost_summary: {
      ground_transport_total_usd: diversions.reduce((s, d) => s + d.diversion_cost_usd, 0),
      stranded_pax_total_cost_usd: strandedGroups.reduce((s, g) => s + g.total_stranding_cost_usd, 0),
      note: 'Costs vs. baseline stranding cost avoided: see Authorities notification for full P&L',
    },
  }
}
