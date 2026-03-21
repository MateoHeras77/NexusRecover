/**
 * Build the series array for the Waterfall Cost Breakdown chart.
 *
 * Series order: Baseline → PAX Savings → Delay Costs → Diversion Costs → Optimized
 *
 * Each step has:
 *   type: 'baseline' | 'pax_saved' | 'delay_cost' | 'diversion' | 'result'
 *   For absolute bars (baseline, result):  { value }
 *   For floating bars (deltas):            { delta, runningStart, runningEnd }
 */
export function buildWaterfallSeries(optimizeResult, baselineResult, scenario) {
  if (!optimizeResult || !scenario) return []

  const gc = scenario.global_costs

  // Map baseline connection outcomes so we know which PAX were SAVED by the optimizer
  const baselineConnected = {}
  if (baselineResult?.pax_results) {
    for (const pr of baselineResult.pax_results) {
      baselineConnected[pr.group_id] = pr.connection_made
    }
  }

  const steps = []
  let running = optimizeResult.baseline_cost_usd

  // ── 1. Baseline ──────────────────────────────────────────────────────────
  steps.push({
    key: 'baseline',
    label: 'Baseline',
    sublabel: 'No action',
    type: 'baseline',
    value: running,
    runningStart: running,
    runningEnd: running,
  })

  // ── 2. PAX Savings ───────────────────────────────────────────────────────
  // Only groups that were stranded in baseline but connected after optimization
  for (const pr of optimizeResult.pax_results) {
    if (pr.connection_made && baselineConnected[pr.group_id] === false) {
      const penalty = pr.tier === 'business'
        ? gc.business_stranded_cost_usd
        : gc.economy_stranded_cost_usd
      const delta = -(pr.count * penalty) // negative = cost reduction (good)
      const runningStart = running
      running += delta
      steps.push({
        key: pr.group_id,
        label: `${pr.inbound_flight_id}→${pr.outbound_flight_id}`,
        sublabel: `${pr.count} ${pr.tier}`,
        type: 'pax_saved',
        delta,
        runningStart,
        runningEnd: running,
        count: pr.count,
        tier: pr.tier,
        costPerPax: penalty,
        inboundFlightId: pr.inbound_flight_id,
        outboundFlightId: pr.outbound_flight_id,
      })
    }
  }

  // ── 3. Delay Costs ───────────────────────────────────────────────────────
  for (const fd of optimizeResult.flight_decisions) {
    if (fd.delay_applied_min > 0 && fd.cost_delay_usd > 0) {
      const delta = fd.cost_delay_usd // positive = cost added
      const runningStart = running
      running += delta
      steps.push({
        key: `delay_${fd.flight_id}`,
        label: fd.flight_id,
        sublabel: `+${fd.delay_applied_min}min`,
        type: 'delay_cost',
        delta,
        runningStart,
        runningEnd: running,
        delayMin: fd.delay_applied_min,
        flightId: fd.flight_id,
      })
    }
  }

  // ── 4. Diversion Costs ───────────────────────────────────────────────────
  for (const id of optimizeResult.inbound_decisions) {
    if (id.diverted_to && id.diversion_cost_usd > 0) {
      const delta = id.diversion_cost_usd
      const runningStart = running
      running += delta
      steps.push({
        key: `div_${id.flight_id}`,
        label: id.flight_id,
        sublabel: `→ ${id.diverted_to}`,
        type: 'diversion',
        delta,
        runningStart,
        runningEnd: running,
        divertedTo: id.diverted_to,
        flightId: id.flight_id,
      })
    }
  }

  // ── 5. Optimized Total ───────────────────────────────────────────────────
  steps.push({
    key: 'result',
    label: 'Optimized',
    sublabel: 'Net cost',
    type: 'result',
    value: optimizeResult.optimized_cost_usd,
    runningStart: optimizeResult.optimized_cost_usd,
    runningEnd: optimizeResult.optimized_cost_usd,
  })

  return steps
}

export const WATERFALL_COLORS = {
  baseline:   { bar: '#ef4444', text: '#f87171' },
  pax_saved:  { bar: '#22c55e', text: '#4ade80' },
  delay_cost: { bar: '#f59e0b', text: '#fbbf24' },
  diversion:  { bar: '#f97316', text: '#fb923c' },
  result:     { bar: '#3b82f6', text: '#60a5fa' },
}
