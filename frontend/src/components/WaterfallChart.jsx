import { useEffect, useRef, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { useStore } from '../store/useStore'
import { buildWaterfallSeries, WATERFALL_COLORS } from '../lib/waterfall'

const fmtK = (n) => {
  if (Math.abs(n) >= 1000) return `$${(Math.abs(n) / 1000).toFixed(0)}K`
  return `$${Math.abs(Math.round(n))}`
}

const fmtFull = (n) =>
  `$${Math.abs(Math.round(n)).toLocaleString('en-US')}`

export default function WaterfallChart() {
  const { optimizeResult, baselineResult, scenario } = useStore()
  const svgRef = useRef(null)
  const [tooltip, setTooltip] = useState(null) // { x, y, step }

  const series = useMemo(
    () => buildWaterfallSeries(optimizeResult, baselineResult, scenario),
    [optimizeResult, baselineResult, scenario]
  )

  useEffect(() => {
    if (!svgRef.current || series.length === 0) return

    const el = svgRef.current
    const totalW = el.clientWidth || 800
    const totalH = el.clientHeight || 160

    const margin = { top: 14, right: 18, bottom: 50, left: 62 }
    const innerW = totalW - margin.left - margin.right
    const innerH = totalH - margin.top - margin.bottom

    d3.select(el).selectAll('*').remove()

    const svg = d3.select(el)
      .attr('viewBox', `0 0 ${totalW} ${totalH}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // ── Scales ───────────────────────────────────────────────────────────────
    const maxVal = Math.max(
      ...series.map(s => Math.max(s.value ?? 0, s.runningStart ?? 0, s.runningEnd ?? 0))
    )
    const yMax = maxVal * 1.12

    const x = d3.scaleBand()
      .domain(series.map((_, i) => i))
      .range([0, innerW])
      .paddingInner(0.28)
      .paddingOuter(0.1)

    const y = d3.scaleLinear()
      .domain([0, yMax])
      .range([innerH, 0])

    const bw = x.bandwidth()

    // ── Grid lines ───────────────────────────────────────────────────────────
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3.axisLeft(y)
          .tickSize(-innerW)
          .tickFormat('')
          .ticks(4)
      )
      .call(gx => gx.select('.domain').remove())
      .call(gx => gx.selectAll('.tick line')
        .attr('stroke', '#334155')
        .attr('stroke-dasharray', '3,3')
        .attr('opacity', 0.5)
      )

    // ── Y axis ────────────────────────────────────────────────────────────────
    g.append('g')
      .call(
        d3.axisLeft(y)
          .ticks(4)
          .tickFormat(d => fmtK(d))
      )
      .call(gx => gx.select('.domain').attr('stroke', '#334155'))
      .call(gx => gx.selectAll('.tick line').attr('stroke', '#334155'))
      .call(gx => gx.selectAll('.tick text')
        .attr('fill', '#64748b')
        .attr('font-size', 9)
        .attr('font-family', 'Inter, monospace')
      )

    // ── Baseline reference line ───────────────────────────────────────────────
    const baselineVal = optimizeResult.baseline_cost_usd
    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', y(baselineVal)).attr('y2', y(baselineVal))
      .attr('stroke', '#ef444440')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '6,4')

    // ── Connector lines ───────────────────────────────────────────────────────
    for (let i = 0; i < series.length - 1; i++) {
      const curr = series[i]
      const next = series[i + 1]
      if (next.type === 'result') continue

      const connLevel = curr.type === 'baseline' ? curr.value : curr.runningEnd
      const x1 = x(i) + bw
      const x2 = x(i + 1)
      const yLine = y(connLevel)

      g.append('line')
        .attr('x1', x1).attr('x2', x2)
        .attr('y1', yLine).attr('y2', yLine)
        .attr('stroke', '#475569')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,2')
    }

    // ── Bars ─────────────────────────────────────────────────────────────────
    function getBarGeom(d) {
      const isAbsolute = d.type === 'baseline' || d.type === 'result'
      if (isAbsolute) {
        const top = y(d.value)
        return { barY: top, barH: innerH - top }
      }
      const hi = Math.max(d.runningStart, d.runningEnd)
      const lo = Math.min(d.runningStart, d.runningEnd)
      return { barY: y(hi), barH: Math.max(2, y(lo) - y(hi)) }
    }

    const bars = g.append('g')
      .selectAll('rect.bar')
      .data(series)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (_, i) => x(i))
      .attr('width', bw)
      .attr('rx', 3)
      .attr('fill', d => WATERFALL_COLORS[d.type]?.bar ?? '#64748b')
      .attr('opacity', 0.85)
      // Start at bottom for animation
      .attr('y', innerH)
      .attr('height', 0)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('opacity', 1)
        const svgRect = el.getBoundingClientRect()
        setTooltip({
          x: event.clientX - svgRect.left,
          y: event.clientY - svgRect.top,
          step: d,
        })
      })
      .on('mousemove', function (event) {
        const svgRect = el.getBoundingClientRect()
        setTooltip(prev => prev ? { ...prev, x: event.clientX - svgRect.left, y: event.clientY - svgRect.top } : null)
      })
      .on('mouseleave', function (event, d) {
        d3.select(this).attr('opacity', 0.85)
        setTooltip(null)
      })

    // ── Sequential animation ──────────────────────────────────────────────────
    bars.each(function (d, i) {
      const { barY, barH } = getBarGeom(d)
      d3.select(this)
        .transition()
        .delay(i * 90)
        .duration(380)
        .ease(d3.easeCubicOut)
        .attr('y', barY)
        .attr('height', barH)
    })

    // ── Value labels on bars ──────────────────────────────────────────────────
    series.forEach((d, i) => {
      const { barY, barH } = getBarGeom(d)
      const isAbsolute = d.type === 'baseline' || d.type === 'result'
      const labelY = barY - 4
      const valueText = isAbsolute
        ? fmtK(d.value)
        : (d.delta > 0 ? `+${fmtK(d.delta)}` : `${fmtK(d.delta)}`)

      const label = g.append('text')
        .attr('x', x(i) + bw / 2)
        .attr('y', labelY)
        .attr('text-anchor', 'middle')
        .attr('font-size', 8.5)
        .attr('font-family', 'Inter, monospace')
        .attr('font-weight', '600')
        .attr('fill', WATERFALL_COLORS[d.type]?.text ?? '#94a3b8')
        .attr('opacity', 0)
        .text(valueText)

      label.transition()
        .delay(i * 90 + 300)
        .duration(200)
        .attr('opacity', 1)
    })

    // ── X axis labels ─────────────────────────────────────────────────────────
    series.forEach((d, i) => {
      const xPos = x(i) + bw / 2
      const color = WATERFALL_COLORS[d.type]?.text ?? '#94a3b8'
      const hasArrow = d.label.includes('→')

      if (hasArrow) {
        // Split "AC418→AC301" into two lines
        const [inb, out] = d.label.split('→')
        g.append('text')
          .attr('x', xPos).attr('y', innerH + 13)
          .attr('text-anchor', 'middle')
          .attr('font-size', 8.5).attr('font-weight', '700')
          .attr('font-family', 'Inter, system-ui, sans-serif')
          .attr('fill', color)
          .text(inb + ' →')
        g.append('text')
          .attr('x', xPos).attr('y', innerH + 24)
          .attr('text-anchor', 'middle')
          .attr('font-size', 8.5).attr('font-weight', '700')
          .attr('font-family', 'Inter, system-ui, sans-serif')
          .attr('fill', color)
          .text(out)
        g.append('text')
          .attr('x', xPos).attr('y', innerH + 36)
          .attr('text-anchor', 'middle')
          .attr('font-size', 7.5)
          .attr('font-family', 'Inter, system-ui, sans-serif')
          .attr('fill', '#475569')
          .text(d.sublabel)
      } else {
        g.append('text')
          .attr('x', xPos).attr('y', innerH + 14)
          .attr('text-anchor', 'middle')
          .attr('font-size', 9).attr('font-weight', '700')
          .attr('font-family', 'Inter, system-ui, sans-serif')
          .attr('fill', color)
          .text(d.label)
        g.append('text')
          .attr('x', xPos).attr('y', innerH + 25)
          .attr('text-anchor', 'middle')
          .attr('font-size', 7.5)
          .attr('font-family', 'Inter, system-ui, sans-serif')
          .attr('fill', '#475569')
          .text(d.sublabel)
      }
    })

  }, [series, optimizeResult])

  if (!optimizeResult || series.length === 0) return null

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950/40 px-3 pt-2 pb-0">

      {/* Header */}
      <div className="flex items-baseline gap-1.5 mb-1 shrink-0">
        <span className="text-[11px] font-semibold text-slate-300">Cost Breakdown</span>
        <span className="text-[11px] text-slate-500">— optimizer saved</span>
        <span className="text-[11px] font-bold text-green-400 font-mono">
          {fmtFull(optimizeResult.savings_usd)}
        </span>
      </div>

      {/* SVG chart */}
      <div className="flex-1 min-h-0 relative">
        <svg ref={svgRef} className="w-full h-full" />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-30 pointer-events-none bg-slate-800 border border-slate-600/60 rounded-lg px-2.5 py-2 shadow-xl text-xs min-w-[140px]"
            style={{
              left: Math.max(0, tooltip.x - 70),
              top: tooltip.y + 10,
            }}
          >
            <div className="font-semibold text-white mb-1">
              {tooltip.step.label}
              {tooltip.step.sublabel && (
                <span className="text-slate-400 font-normal ml-1">· {tooltip.step.sublabel}</span>
              )}
            </div>

            {(tooltip.step.type === 'baseline' || tooltip.step.type === 'result') && (
              <div className="text-slate-300 font-mono">{fmtFull(tooltip.step.value)}</div>
            )}

            {tooltip.step.type === 'pax_saved' && (
              <>
                <div className="text-slate-400 text-[10px] mb-1">
                  {tooltip.step.inboundFlightId} → {tooltip.step.outboundFlightId}
                </div>
                <div className="text-green-400 font-mono font-semibold">
                  +{fmtFull(Math.abs(tooltip.step.delta))} saved
                </div>
                <div className="text-slate-400 mt-0.5">
                  {tooltip.step.count} {tooltip.step.tier} PAX protected
                </div>
                <div className="text-slate-500 text-[10px] mt-0.5">
                  {fmtFull(tooltip.step.costPerPax)}/pax stranding avoided
                </div>
              </>
            )}

            {tooltip.step.type === 'delay_cost' && (
              <>
                <div className="text-amber-400 font-mono font-semibold">
                  −{fmtFull(tooltip.step.delta)} cost
                </div>
                <div className="text-slate-400 mt-0.5">
                  Operational hold: +{tooltip.step.delayMin}min
                </div>
              </>
            )}

            {tooltip.step.type === 'diversion' && (
              <>
                <div className="text-orange-400 font-mono font-semibold">
                  −{fmtFull(tooltip.step.delta)} cost
                </div>
                <div className="text-slate-400 mt-0.5">
                  Ground transport → {tooltip.step.divertedTo}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
