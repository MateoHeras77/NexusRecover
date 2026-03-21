/**
 * Build Sankey nodes + links from scenario + optimizer result.
 *
 * Node structure:
 *   Left column  → inbound flights  (id: "IN_AC101")
 *   Right column → outbound flights (id: "OUT_AC301")
 *
 * Link structure:
 *   source → target, value = pax count
 *   status: "nominal" | "at_risk" | "protected" | "stranded"
 */

export function buildSankeyData(scenario, optimizeResult, timelineStep) {
  if (!scenario) return { nodes: [], links: [] }

  const inboundNodes = scenario.inbound_flights.map((f) => ({
    id: `IN_${f.flight_id}`,
    flight_id: f.flight_id,
    side: 'inbound',
    origin: f.origin,
    destination: f.destination,
    delay_min: f.delay_min,
    eta_min: f.eta_min,
    sta_min: f.sta_min,
    total_pax: f.total_pax,
    aircraft_type: f.aircraft_type,
  }))

  const outboundNodes = scenario.outbound_flights.map((f) => {
    // In step 3, use the optimizer's ETD
    let etd_min = f.std_min
    let delay_applied = 0
    let cancelled = false
    if (optimizeResult && timelineStep === 3) {
      const dec = optimizeResult.flight_decisions.find((d) => d.flight_id === f.flight_id)
      if (dec) {
        etd_min = dec.etd_final_min
        delay_applied = dec.delay_applied_min
        cancelled = dec.cancelled
      }
    }
    return {
      id: `OUT_${f.flight_id}`,
      flight_id: f.flight_id,
      side: 'outbound',
      origin: f.origin,
      destination: f.destination,
      std_min: f.std_min,
      etd_min,
      delay_applied,
      cancelled,
      max_delay_min: f.max_delay_min,
      total_pax_onboard: f.total_pax_onboard,
      aircraft_type: f.aircraft_type,
    }
  })

  const nodes = [...inboundNodes, ...outboundNodes]
  const nodeIndex = Object.fromEntries(nodes.map((n, i) => [n.id, i]))

  const links = scenario.pax_groups.map((pg) => {
    const sourceId = `IN_${pg.inbound_flight_id}`
    const targetId = `OUT_${pg.outbound_flight_id}`

    let status = 'nominal'

    if (timelineStep >= 1) {
      // Check if inbound has a delay
      const inb = scenario.inbound_flights.find((f) => f.flight_id === pg.inbound_flight_id)
      if (inb && inb.delay_min > 0) {
        status = timelineStep >= 2 ? 'at_risk' : 'nominal'
      }
    }

    if (timelineStep === 3 && optimizeResult) {
      const pr = optimizeResult.pax_results.find((r) => r.group_id === pg.group_id)
      if (pr) {
        status = pr.connection_made ? 'protected' : 'stranded'
      }
    }

    return {
      source: nodeIndex[sourceId],
      target: nodeIndex[targetId],
      value: pg.count,
      group_id: pg.group_id,
      tier: pg.tier,
      status,
      inbound_flight_id: pg.inbound_flight_id,
      outbound_flight_id: pg.outbound_flight_id,
    }
  })

  return { nodes, links }
}

export const FLOW_COLORS = {
  nominal:   { fill: '#64748b', stroke: '#94a3b8', opacity: 0.55 },
  at_risk:   { fill: '#ef4444', stroke: '#f87171', opacity: 0.75 },
  protected: { fill: '#22c55e', stroke: '#4ade80', opacity: 0.70 },
  stranded:  { fill: '#f97316', stroke: '#fb923c', opacity: 0.75 },
}

export const NODE_COLORS = {
  inbound: {
    nominal:   '#3b82f6',
    disrupted: '#ef4444',
  },
  outbound: {
    nominal:   '#8b5cf6',
    delayed:   '#f59e0b',
    cancelled: '#ef4444',
  },
}
