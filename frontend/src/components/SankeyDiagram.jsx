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
  const { scenario, optimizeResult, timelineStep, selectedFlightId, setSelectedFlight, openJourneyPanel, selectedGroupId, setSelectedGroup } = useStore()

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
      .nodeWidth(16)
      .nodePadding(20)
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
        if (selectedGroupId) {
          return d.group_id === selectedGroupId ? 1 : 0.1
        }
        if (!selectedFlightId) return base
        const related =
          d.inbound_flight_id === selectedFlightId ||
          d.outbound_flight_id === selectedFlightId
        return related ? base : 0.1
      })
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (d.group_id) {
          openJourneyPanel(d.group_id)
        }
      })
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
          if (timelineStep === 3 && d.diverted_to) return NODE_COLORS.inbound.diverted
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

    // ── Node labels — two-line design with plane icon ────────────────────────
    const labelGroup = g.append('g').attr('class', 'labels')

    const labelGroups = labelGroup.selectAll('g.label-group')
      .data(sNodes)
      .join('g')
      .attr('class', 'label-group')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        setSelectedFlight(selectedFlightId === d.flight_id ? null : d.flight_id)
      })
      .on('mouseenter', (event, d) => showNodeTooltip(event, d))
      .on('mouseleave', hideTooltip)

    const isInbound = (d) => d.side === 'inbound'
    const cx = (d) => isInbound(d) ? d.x0 - 12 : d.x1 + 12
    const cy = (d) => (d.y0 + d.y1) / 2
    const anchor = (d) => isInbound(d) ? 'end' : 'start'

    // ── Line 1: ✈ + Flight ID ────────────────────────────────────────────────
    labelGroups.append('text')
      .attr('x', cx)
      .attr('y', (d) => cy(d) - 4)
      .attr('text-anchor', anchor)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('font-size', 10)
      .attr('font-weight', '700')
      .attr('letter-spacing', '0.2')
      .attr('fill', (d) => {
        if (isInbound(d)) {
          if (timelineStep === 3 && d.diverted_to) return '#f59e0b'
          if (timelineStep >= 1 && d.delay_min > 0) return '#f1f5f9'
          return '#f1f5f9'
        }
        if (d.cancelled) return '#f87171'
        if (timelineStep === 3 && d.delay_applied > 0) return '#f1f5f9'
        return '#f1f5f9'
      })
      .text((d) => isInbound(d) ? `✈  ${d.flight_id}` : `${d.flight_id}  ✈`)

    // ── Line 2: status / delay tag ────────────────────────────────────────────
    labelGroups.append('text')
      .attr('x', cx)
      .attr('y', (d) => cy(d) + 9)
      .attr('text-anchor', anchor)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('font-size', 8.5)
      .attr('font-weight', '500')
      .attr('fill', (d) => {
        if (isInbound(d)) {
          if (timelineStep === 3 && d.diverted_to) return '#fbbf24'
          if (timelineStep >= 1 && d.delay_min > 0) return '#f87171'
          return '#4ade80'
        }
        if (d.cancelled) return '#f87171'
        if (timelineStep === 3 && d.delay_applied > 0) return '#fbbf24'
        return '#4ade80'
      })
      .text((d) => {
        if (isInbound(d)) {
          if (timelineStep === 0) return `${d.origin} · on time`
          if (timelineStep === 3 && d.diverted_to) return `+${d.delay_min}m  →  ${d.diverted_to}`
          if (d.delay_min > 0) return `+${d.delay_min}m delay`
          return 'on time'
        } else {
          if (d.cancelled) return 'cancelled'
          if (timelineStep === 3 && d.delay_applied > 0) return `held +${d.delay_applied}m`
          return `→ ${d.destination}`
        }
      })

    // ── Tooltip helpers ───────────────────────────────────────────────────────
    const tooltip = d3.select('body').select('#sankey-tooltip')

    function showLinkTooltip(event, d) {
      const statusLabels = {
        nominal:   'On Time',
        at_risk:   '⚠ At Risk',
        protected: '✓ Protected',
        stranded:  '✗ Stranded',
        diverted:  '✈ Diverted to alternate',
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
      let html
      if (d.side === 'inbound') {
        const connectingPax = d.total_pax - d.local_pax
        const etaClock = MIN_TO_CLOCK(scenario.sim_start_clock, d.eta_min)
        const delayTag = d.delay_min > 0
          ? `<span style="color:#f87171">+${d.delay_min}m delay</span>`
          : `<span style="color:#4ade80">On time</span>`
        const divertLine = d.diverted_to
          ? `<div style="color:#fbbf24;margin-top:4px">✈ Diverted → ${d.diverted_to}</div>`
          : ''
        html = `
          <div class="font-semibold text-xs mb-1">${d.flight_id} &mdash; ${d.origin} → ${d.destination}</div>
          <div class="text-xs text-slate-400">ETA ${etaClock} &nbsp;·&nbsp; ${d.aircraft_type}</div>
          <div class="text-xs mt-1">${delayTag}</div>
          <div class="text-xs text-slate-300 mt-1">${d.local_pax} local &nbsp;+&nbsp; ${connectingPax} connecting</div>
          ${divertLine}
        `
      } else {
        const etdClock = MIN_TO_CLOCK(scenario.sim_start_clock, d.etd_min)
        const delayTag = d.cancelled
          ? `<span style="color:#f87171">CANCELLED</span>`
          : d.delay_applied > 0
            ? `<span style="color:#fbbf24">+${d.delay_applied}m delay</span>`
            : `<span style="color:#4ade80">On schedule</span>`
        html = `
          <div class="font-semibold text-xs mb-1">${d.flight_id} &mdash; ${d.origin} → ${d.destination}</div>
          <div class="text-xs text-slate-400">ETD ${etdClock} &nbsp;·&nbsp; ${d.aircraft_type}</div>
          <div class="text-xs mt-1">${delayTag}</div>
          <div class="text-xs text-slate-300 mt-1">${d.total_pax_onboard} pax onboard</div>
        `
      }
      tooltip
        .style('opacity', 1)
        .style('left', `${event.pageX + 12}px`)
        .style('top', `${event.pageY - 28}px`)
        .html(html)
    }

    function hideTooltip() {
      tooltip.style('opacity', 0)
    }
  }, [nodes, links, selectedFlightId, selectedGroupId, timelineStep, scenario])

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
          { status: 'diverted',  label: 'Diverted' },
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
