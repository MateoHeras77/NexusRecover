/**
 * SankeyPanel — props-driven Sankey renderer (no store, no tooltips).
 * Used by CompareView to render two side-by-side Sankeys with different data.
 */
import { useEffect, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey'
import { buildSankeyData, FLOW_COLORS, NODE_COLORS } from '../lib/sankey'

export default function SankeyPanel({ scenario, optimizeResult, timelineStep, selectedFlightId }) {
  const svgRef = useRef(null)

  const { nodes, links } = useMemo(
    () => buildSankeyData(scenario, optimizeResult, timelineStep),
    [scenario, optimizeResult, timelineStep]
  )

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return

    const el = svgRef.current
    const width = el.clientWidth || 600
    const height = el.clientHeight || 400

    // Tighter margins for compact half-screen layout
    const margin = { top: 12, right: 150, bottom: 12, left: 150 }
    const innerW = width - margin.left - margin.right
    const innerH = height - margin.top - margin.bottom

    d3.select(el).selectAll('*').remove()

    const svg = d3.select(el)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const sankeyNodes = nodes.map((n) => ({ ...n }))
    const sankeyLinks = links.map((l) => ({ ...l }))

    const sankeyGen = sankey()
      .nodeId((d) => d.index)
      .nodeAlign(sankeyLeft)
      .nodeWidth(14)
      .nodePadding(8)
      .extent([[0, 0], [innerW, innerH]])

    const { nodes: sNodes, links: sLinks } = sankeyGen({ nodes: sankeyNodes, links: sankeyLinks })

    // ── Links ──────────────────────────────────────────────────────────────────
    g.append('g')
      .selectAll('path')
      .data(sLinks)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', (d) => FLOW_COLORS[d.status]?.stroke ?? '#64748b')
      .attr('stroke-width', (d) => Math.max(2, d.width))
      .attr('fill', 'none')
      .attr('opacity', (d) => {
        const base = FLOW_COLORS[d.status]?.opacity ?? 0.5
        if (!selectedFlightId) return base
        const related = d.inbound_flight_id === selectedFlightId || d.outbound_flight_id === selectedFlightId
        return related ? base : 0.08
      })

    // ── Nodes ──────────────────────────────────────────────────────────────────
    g.append('g')
      .selectAll('rect')
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
        return d.flight_id === selectedFlightId ? 1 : 0.3
      })

    // ── Labels ─────────────────────────────────────────────────────────────────
    const isInbound = (d) => d.side === 'inbound'
    const cx     = (d) => isInbound(d) ? d.x0 - 10 : d.x1 + 10
    const cy     = (d) => (d.y0 + d.y1) / 2
    const anchor = (d) => isInbound(d) ? 'end' : 'start'

    const labelGroups = g.append('g')
      .selectAll('g')
      .data(sNodes)
      .join('g')

    // Line 1 — flight ID + plane
    labelGroups.append('text')
      .attr('x', cx)
      .attr('y', (d) => cy(d) - 4)
      .attr('text-anchor', anchor)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('font-size', 10)
      .attr('font-weight', '700')
      .attr('fill', (d) => {
        if (isInbound(d)) {
          if (timelineStep === 3 && d.diverted_to) return '#f59e0b'
          return '#f1f5f9'
        }
        if (d.cancelled) return '#f87171'
        return '#f1f5f9'
      })
      .text((d) => isInbound(d) ? `✈  ${d.flight_id}` : `${d.flight_id}  ✈`)

    // Line 2 — status tag
    labelGroups.append('text')
      .attr('x', cx)
      .attr('y', (d) => cy(d) + 8)
      .attr('text-anchor', anchor)
      .attr('font-family', 'Inter, system-ui, sans-serif')
      .attr('font-size', 8.5)
      .attr('font-weight', '500')
      .attr('fill', (d) => {
        if (isInbound(d)) {
          if (timelineStep === 3 && d.diverted_to) return '#fbbf24'
          if (d.delay_min > 0) return '#f87171'
          return '#4ade80'
        }
        if (d.cancelled) return '#f87171'
        if (timelineStep === 3 && d.delay_applied > 0) return '#fbbf24'
        return '#4ade80'
      })
      .text((d) => {
        if (isInbound(d)) {
          if (timelineStep === 3 && d.diverted_to) return `→ ${d.diverted_to}`
          if (d.delay_min > 0) return `+${d.delay_min}m`
          return 'on time'
        }
        if (d.cancelled) return 'cancelled'
        if (timelineStep === 3 && d.delay_applied > 0) return `+${d.delay_applied}m`
        return `→ ${d.destination}`
      })

  }, [nodes, links, selectedFlightId, timelineStep])

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  )
}
