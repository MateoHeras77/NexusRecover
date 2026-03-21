import { useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey'
import { buildSankeyData, FLOW_COLORS, NODE_COLORS } from '../lib/sankey'
import { useStore } from '../store/useStore'

const MIN_TO_CLOCK = (simStart, min) => {
  const [h, m] = simStart.split(':').map(Number)
  const total = h * 60 + m + min
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export default function SankeyDiagram() {
  const svgRef = useRef(null)
  const { scenario, optimizeResult, timelineStep, selectedFlightId, setSelectedFlight } = useStore()

  const { nodes, links } = useMemo(
    () => buildSankeyData(scenario, optimizeResult, timelineStep),
    [scenario, optimizeResult, timelineStep]
  )

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const el = svgRef.current
    const width = el.clientWidth || 900
    const height = el.clientHeight || 560

    const margin = { top: 24, right: 200, bottom: 24, left: 200 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    d3.select(el).selectAll('*').remove()

    const svg = d3.select(el)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    // Clone nodes/links deeply for d3-sankey mutation
    const sankeyNodes = nodes.map((n) => ({ ...n }))
    const sankeyLinks = links.map((l) => ({ ...l }))

    const sankeyGen = sankey()
      .nodeId((d) => d.index)
      .nodeAlign(sankeyLeft)
      .nodeWidth(18)
      .nodePadding(22)
      .extent([[0, 0], [innerW, innerH]])

    const { nodes: sNodes, links: sLinks } = sankeyGen({
      nodes: sankeyNodes,
      links: sankeyLinks,
    })

    // ── Links ───────────────────────────────────────────────────────────────
    const linkGroup = g.append('g').attr('class', 'links')

    linkGroup.selectAll('path')
      .data(sLinks)
      .join('path')
      .attr('class', (d) => {
        const cls = 'sankey-link'
        return d.status === 'at_risk' ? `${cls} flow-pulse` : cls
      })
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (d) => FLOW_COLORS[d.status]?.stroke ?? '#64748b')
      .attr('stroke-width', (d) => Math.max(2, d.width))
      .attr('fill', 'none')
      .attr('opacity', (d) => {
        const base = FLOW_COLORS[d.status]?.opacity ?? 0.5
        if (!selectedFlightId) return base
        const related =
          d.inbound_flight_id === selectedFlightId ||
          d.outbound_flight_id === selectedFlightId
        return related ? base : 0.1
      })
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        d3.select(this).attr('opacity', 0.95)
        showLinkTooltip(event, d)
      })
      .on('mouseleave', function (event, d) {
        const base = FLOW_COLORS[d.status]?.opacity ?? 0.5
        d3.select(this).attr('opacity', base)
        hideTooltip()
      })

    // ── Nodes ────────────────────────────────────────────────────────────────
    const nodeGroup = g.append('g').attr('class', 'nodes')

    const nodeRects = nodeGroup.selectAll('rect')
      .data(sNodes)
      .join('rect')
      .attr('x', (d) => d.x0)
      .attr('y', (d) => d.y0)
      .attr('width', (d) => d.x1 - d.x0)
      .attr('height', (d) => Math.max(4, d.y1 - d.y0))
      .attr('rx', 3)
      .attr('fill', (d) => {
        if (d.side === 'inbound') {
          return timelineStep >= 1 && d.delay_min > 0
            ? NODE_COLORS.inbound.disrupted
            : NODE_COLORS.inbound.nominal
        }
        if (d.cancelled) return NODE_COLORS.outbound.cancelled
        if (d.delay_applied > 0) return NODE_COLORS.outbound.delayed
        return NODE_COLORS.outbound.nominal
      })
      .attr('opacity', (d) => {
        if (!selectedFlightId) return 0.9
        return d.flight_id === selectedFlightId ? 1 : 0.35
      })
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedFlight(selectedFlightId === d.flight_id ? null : d.flight_id)
      })
      .on('mouseenter', (event, d) => showNodeTooltip(event, d))
      .on('mouseleave', hideTooltip)

    // ── Node labels (outside the Sankey, in the margin) ──────────────────────
    const labelGroup = g.append('g').attr('class', 'labels')

    labelGroup.selectAll('text.flight-id')
      .data(sNodes)
      .join('text')
      .attr('class', 'flight-id')
      .attr('x', (d) => d.side === 'inbound' ? d.x0 - 10 : d.x1 + 10)
      .attr('y', (d) => (d.y0 + d.y1) / 2 - 7)
      .attr('text-anchor', (d) => d.side === 'inbound' ? 'end' : 'start')
      .attr('fill', '#f1f5f9')
      .attr('font-size', 12)
      .attr('font-weight', '600')
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text((d) => d.flight_id)

    labelGroup.selectAll('text.route')
      .data(sNodes)
      .join('text')
      .attr('class', 'route')
      .attr('x', (d) => d.side === 'inbound' ? d.x0 - 10 : d.x1 + 10)
      .attr('y', (d) => (d.y0 + d.y1) / 2 + 6)
      .attr('text-anchor', (d) => d.side === 'inbound' ? 'end' : 'start')
      .attr('fill', '#94a3b8')
      .attr('font-size', 10)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .text((d) => {
        if (d.side === 'inbound') {
          const clock = scenario ? MIN_TO_CLOCK(scenario.sim_start_clock, d.eta_min) : ''
          const tag = timelineStep >= 1 && d.delay_min > 0 ? ` +${d.delay_min}m` : ''
          return `${d.origin} · ETA ${clock}${tag}`
        } else {
          const min = timelineStep === 3 ? d.etd_min : d.std_min
          const clock = scenario ? MIN_TO_CLOCK(scenario.sim_start_clock, min) : ''
          const tag = timelineStep === 3 && d.delay_applied > 0 ? ` +${d.delay_applied}m` : ''
          return `${d.destination} · ETD ${clock}${tag}`
        }
      })

    // ── Delay badge on inbound nodes ─────────────────────────────────────────
    if (timelineStep >= 1) {
      labelGroup.selectAll('text.delay-badge')
        .data(sNodes.filter((n) => n.side === 'inbound' && n.delay_min > 0))
        .join('text')
        .attr('class', 'delay-badge')
        .attr('x', (d) => d.x0 - 10)
        .attr('y', (d) => (d.y0 + d.y1) / 2 + 19)
        .attr('text-anchor', 'end')
        .attr('fill', '#ef4444')
        .attr('font-size', 9)
        .attr('font-weight', '600')
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .text((d) => `DELAYED +${d.delay_min}min`)
    }

    // ── Tooltip helpers ───────────────────────────────────────────────────────
    const tooltip = d3.select('body').select('#sankey-tooltip')

    function showLinkTooltip(event, d) {
      const statusLabels = {
        nominal: 'On Time',
        at_risk: '⚠ At Risk',
        protected: '✓ Protected',
        stranded: '✗ Stranded',
      }
      tooltip
        .style('opacity', 1)
        .style('left', `${event.pageX + 12}px`)
        .style('top', `${event.pageY - 28}px`)
        .html(`
          <div class="font-semibold text-xs mb-1">${d.inbound_flight_id} → ${d.outbound_flight_id}</div>
          <div class="text-xs text-slate-400">${d.value} pax · ${d.tier}</div>
          <div class="text-xs mt-1 font-medium" style="color:${FLOW_COLORS[d.status]?.stroke}">${statusLabels[d.status]}</div>
        `)
    }

    function showNodeTooltip(event, d) {
      const lines = d.side === 'inbound'
        ? [`Flight: ${d.flight_id}`, `From: ${d.origin}`, `Pax: ${d.total_pax}`, d.delay_min > 0 ? `Delay: +${d.delay_min} min` : 'On time']
        : [`Flight: ${d.flight_id}`, `To: ${d.destination}`, `Local pax: ${d.total_pax_onboard}`, d.delay_applied > 0 ? `Delayed: +${d.delay_applied} min` : 'On schedule', d.cancelled ? 'CANCELLED' : '']

      tooltip
        .style('opacity', 1)
        .style('left', `${event.pageX + 12}px`)
        .style('top', `${event.pageY - 28}px`)
        .html(`<div class="text-xs space-y-0.5">${lines.filter(Boolean).map(l => `<div>${l}</div>`).join('')}</div>`)
    }

    function hideTooltip() {
      tooltip.style('opacity', 0)
    }
  }, [nodes, links, selectedFlightId, timelineStep, scenario])

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-4">
        {[
          { status: 'nominal',   label: 'On time' },
          { status: 'at_risk',   label: 'At risk' },
          { status: 'protected', label: 'Protected' },
          { status: 'stranded',  label: 'Stranded' },
        ].map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1.5">
            <div
              className="w-3 h-2 rounded-sm"
              style={{ backgroundColor: FLOW_COLORS[status].stroke, opacity: FLOW_COLORS[status].opacity + 0.1 }}
            />
            <span className="text-xs text-slate-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Selected flight hint */}
      {selectedFlightId && (
        <div className="absolute top-2 right-3 text-xs text-slate-400">
          Filtering: <span className="text-blue-400 font-semibold">{selectedFlightId}</span>
          <button
            onClick={() => useStore.getState().setSelectedFlight(null)}
            className="ml-2 text-slate-500 hover:text-white"
          >✕</button>
        </div>
      )}
    </div>
  )
}
