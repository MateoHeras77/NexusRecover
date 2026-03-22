import { useState, useMemo, useCallback } from 'react'
import DeckGL from '@deck.gl/react'
import { ArcLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import Map from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useStore } from '../store/useStore'
import { AIRPORT_COORDS } from '../lib/airports'
import { X, CloudSnow, AlertTriangle, ShieldCheck, Wifi } from 'lucide-react'

// ── Carto dark basemap — no API key required ──────────────────────────────────
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const INITIAL_VIEW = {
  longitude: -90,
  latitude: 40,
  zoom: 4.2,
  pitch: 45,
  bearing: 0,
}

// ── Color palettes ─────────────────────────────────────────────────────────────
const ARC_COLORS = {
  nominal:   [59, 130, 246, 200],   // blue-500
  delayed:   [248, 113, 113, 220],  // red-400
  at_risk:   [239, 68, 68, 240],    // red-500
  diverted:  [251, 191, 36, 230],   // amber-400
  protected: [34, 197, 94, 200],    // green-500
}

const HUB_COLORS = {
  0: [34, 197, 94, 255],   // green  — normal ops
  1: [239, 68, 68, 255],   // red    — storm
  2: [239, 68, 68, 255],   // red    — chaos
  3: [245, 158, 11, 255],  // amber  — plan active
}

// ── Data builders ─────────────────────────────────────────────────────────────
function buildArcs(scenario, optimizeResult, timelineStep, selectedFlightId) {
  if (!scenario) return []

  // Build diversion map from optimizer
  const diversionMap = {}
  if (optimizeResult?.inbound_decisions) {
    for (const d of optimizeResult.inbound_decisions) {
      if (d.diverted_to) diversionMap[d.flight_id] = d.diverted_to
    }
  }

  // Build pax result map for protection status
  const paxResultMap = {}
  if (optimizeResult?.pax_results) {
    for (const p of optimizeResult.pax_results) {
      paxResultMap[p.inbound_flight_id] = p
    }
  }

  return scenario.inbound_flights.map((flight) => {
    const origin = AIRPORT_COORDS[flight.origin]
    if (!origin) return null

    const divertedTo = timelineStep === 3 ? diversionMap[flight.flight_id] : null
    const targetCode = divertedTo ?? 'YYZ'
    const target = AIRPORT_COORDS[targetCode]
    if (!target) return null

    let status = 'nominal'
    if (timelineStep >= 1 && flight.delay_min > 0) status = 'delayed'
    if (timelineStep >= 2 && flight.delay_min > 30) status = 'at_risk'
    if (timelineStep === 3 && divertedTo) status = 'diverted'
    if (timelineStep === 3 && !divertedTo) {
      const pr = paxResultMap[flight.flight_id]
      if (pr?.connection_made) status = 'protected'
    }

    const isFiltered = selectedFlightId && selectedFlightId !== flight.flight_id
    const baseColor = ARC_COLORS[status] ?? ARC_COLORS.nominal
    const color = isFiltered ? [...baseColor.slice(0, 3), 25] : baseColor

    return {
      flight_id: flight.flight_id,
      origin_code: flight.origin,
      origin_name: origin.name,
      destination_code: targetCode,
      delay_min: flight.delay_min,
      total_pax: flight.total_pax,
      status,
      divertedTo,
      sourcePosition: [origin.lng, origin.lat],
      targetPosition: [target.lng, target.lat],
      color,
      width: Math.max(2, flight.total_pax / 45),
    }
  }).filter(Boolean)
}

function buildAirportDots(scenario, optimizeResult, timelineStep) {
  if (!scenario) return []

  const diversionsUsed = {}
  if (timelineStep === 3 && optimizeResult?.inbound_decisions) {
    for (const d of optimizeResult.inbound_decisions) {
      if (d.diverted_to) diversionsUsed[d.diverted_to] = (diversionsUsed[d.diverted_to] ?? 0) + 1
    }
  }

  const dots = [
    {
      code: 'YYZ',
      name: 'Toronto Pearson',
      isHub: true,
      position: [AIRPORT_COORDS.YYZ.lng, AIRPORT_COORDS.YYZ.lat],
      color: HUB_COLORS[timelineStep] ?? HUB_COLORS[0],
      radius: 22000,
    },
    ...scenario.alternate_airports.map((a) => ({
      code: a.code,
      name: AIRPORT_COORDS[a.code]?.name ?? a.name,
      isHub: false,
      position: [AIRPORT_COORDS[a.code]?.lng ?? 0, AIRPORT_COORDS[a.code]?.lat ?? 0],
      color: diversionsUsed[a.code]
        ? [245, 158, 11, 255]
        : [100, 116, 139, 160],
      radius: 12000,
    })),
  ]

  // Add origin dots (small, dim)
  for (const flight of scenario.inbound_flights) {
    const coord = AIRPORT_COORDS[flight.origin]
    if (!coord) continue
    if (dots.some((d) => d.code === flight.origin)) continue
    dots.push({
      code: flight.origin,
      name: coord.name,
      isHub: false,
      position: [coord.lng, coord.lat],
      color: [71, 85, 105, 180],  // slate-600
      radius: 6000,
    })
  }

  return dots
}

function buildLabels(scenario, optimizeResult, timelineStep) {
  if (!scenario) return []

  const diversionsUsed = {}
  if (timelineStep === 3 && optimizeResult?.inbound_decisions) {
    for (const d of optimizeResult.inbound_decisions) {
      if (d.diverted_to) diversionsUsed[d.diverted_to] = (diversionsUsed[d.diverted_to] ?? 0) + 1
    }
  }

  const labels = [
    {
      position: [AIRPORT_COORDS.YYZ.lng, AIRPORT_COORDS.YYZ.lat + 0.45],
      text: 'YYZ',
      color: HUB_COLORS[timelineStep] ?? HUB_COLORS[0],
      size: 14,
    },
    ...scenario.alternate_airports.map((a) => ({
      position: [AIRPORT_COORDS[a.code]?.lng ?? 0, (AIRPORT_COORDS[a.code]?.lat ?? 0) + 0.3],
      text: a.code,
      color: diversionsUsed[a.code] ? [245, 158, 11, 255] : [148, 163, 184, 200],
      size: 12,
    })),
  ]

  return labels
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ timelineStep }) {
  const badges = {
    0: { label: 'NORMAL OPS',       icon: <Wifi size={11} />,         cls: 'bg-green-900/30 border-green-700/40 text-green-400' },
    1: { label: 'GDP ACTIVE',        icon: <CloudSnow size={11} />,    cls: 'bg-amber-900/30 border-amber-600/40 text-amber-300 animate-pulse' },
    2: { label: 'CRITICAL',          icon: <AlertTriangle size={11} />, cls: 'bg-red-900/40 border-red-500/50 text-red-300 animate-pulse' },
    3: { label: 'DIVERSION PLAN',    icon: <ShieldCheck size={11} />,  cls: 'bg-emerald-900/30 border-emerald-600/40 text-emerald-300' },
  }
  const b = badges[timelineStep] ?? badges[0]
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 border rounded-full text-[11px] font-bold tracking-wider ${b.cls}`}>
      {b.icon}
      {b.label}
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────
function Legend({ timelineStep }) {
  const items = [
    { color: '#3b82f6', label: 'On time' },
    ...(timelineStep >= 1 ? [{ color: '#f87171', label: 'Delayed' }] : []),
    ...(timelineStep >= 2 ? [{ color: '#ef4444', label: 'At risk' }] : []),
    ...(timelineStep === 3 ? [
      { color: '#fbbf24', label: 'Diverted' },
      { color: '#22c55e', label: 'Protected' },
    ] : []),
  ]

  return (
    <div className="flex items-center gap-4">
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className="w-6 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[11px] text-slate-400">{label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
function Tooltip({ info }) {
  if (!info?.object) return null
  const { object, x, y } = info
  const o = object

  const statusLabel = {
    nominal:   'On time',
    delayed:   '⚠ Delayed',
    at_risk:   '⚠ At risk',
    diverted:  '✈ Diverted',
    protected: '✓ Protected',
  }
  const statusColor = {
    nominal:   '#4ade80',
    delayed:   '#f87171',
    at_risk:   '#ef4444',
    diverted:  '#fbbf24',
    protected: '#22c55e',
  }

  return (
    <div
      className="absolute z-50 pointer-events-none bg-slate-900/95 border border-slate-700/60 rounded-lg px-3 py-2 shadow-xl text-xs"
      style={{ left: x + 14, top: y - 30 }}
    >
      {o.flight_id ? (
        <>
          <div className="font-semibold text-white mb-1">{o.flight_id}</div>
          <div className="text-slate-400">{o.origin_code} → {o.destination_code}</div>
          {o.delay_min > 0 && (
            <div className="text-red-400 mt-0.5">+{o.delay_min}m delay</div>
          )}
          <div className="text-slate-300 mt-0.5">{o.total_pax} pax</div>
          {o.status && (
            <div className="mt-1 font-medium" style={{ color: statusColor[o.status] }}>
              {statusLabel[o.status]}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="font-semibold text-white">{o.code}</div>
          <div className="text-slate-400 text-[11px]">{o.name}</div>
        </>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function GeoMap({ onClose }) {
  const { scenario, optimizeResult, timelineStep, selectedFlightId, setSelectedFlight } = useStore()

  const [viewState, setViewState] = useState(INITIAL_VIEW)
  const [hoverInfo, setHoverInfo] = useState(null)

  const arcs    = useMemo(() => buildArcs(scenario, optimizeResult, timelineStep, selectedFlightId), [scenario, optimizeResult, timelineStep, selectedFlightId])
  const dots    = useMemo(() => buildAirportDots(scenario, optimizeResult, timelineStep), [scenario, optimizeResult, timelineStep])
  const labels  = useMemo(() => buildLabels(scenario, optimizeResult, timelineStep), [scenario, optimizeResult, timelineStep])

  const layers = [
    new ArcLayer({
      id: 'flight-arcs',
      data: arcs,
      getSourcePosition: d => d.sourcePosition,
      getTargetPosition: d => d.targetPosition,
      getSourceColor:    d => d.color,
      getTargetColor:    d => d.color,
      getWidth:          d => d.width,
      getHeight:         0.3,
      greatCircle:       true,
      numSegments:       128,
      pickable: true,
    }),

    new ScatterplotLayer({
      id: 'airports',
      data: dots,
      getPosition:   d => d.position,
      getFillColor:  d => d.color,
      getRadius:     d => d.radius,
      radiusMinPixels: 4,
      radiusMaxPixels: 18,
      pickable: true,
      stroked: true,
      lineWidthMinPixels: 1,
      getLineColor: d => [...d.color.slice(0, 3), 120],
    }),

    new TextLayer({
      id: 'airport-labels',
      data: labels,
      getPosition:          d => d.position,
      getText:               d => d.text,
      getSize:               d => d.size,
      getColor:              d => d.color,
      getTextAnchor:         'middle',
      getAlignmentBaseline:  'bottom',
      fontFamily:            'Inter, system-ui, sans-serif',
      fontWeight:            700,
    }),
  ]

  const handleHover = useCallback((info) => {
    setHoverInfo(info?.object ? info : null)
  }, [])

  const handleClick = useCallback((info) => {
    if (!info?.object) return
    const obj = info.object
    if (obj.flight_id) {
      setSelectedFlight(selectedFlightId === obj.flight_id ? null : obj.flight_id)
    }
  }, [selectedFlightId, setSelectedFlight])

  // Count diversions for info panel
  const diversionCount = useMemo(() => {
    if (timelineStep !== 3 || !optimizeResult?.inbound_decisions) return 0
    return optimizeResult.inbound_decisions.filter(d => d.diverted_to).length
  }, [optimizeResult, timelineStep])

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0e1a] flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 h-12 border-b border-slate-700/50 bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-xs font-bold text-white">N</span>
          </div>
          <span className="text-sm font-bold text-white">Geographic Overview</span>
          <span className="text-xs text-slate-500">Hub + Alternates · Inbound Traffic</span>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge timelineStep={timelineStep} />
          <Legend timelineStep={timelineStep} />

          {selectedFlightId && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>Filter:</span>
              <span className="text-blue-400 font-semibold">{selectedFlightId}</span>
              <button
                onClick={() => setSelectedFlight(null)}
                className="text-slate-500 hover:text-white ml-1"
              >✕</button>
            </div>
          )}

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/40 hover:bg-slate-700/70 border border-slate-600/40 rounded-lg text-xs font-medium text-slate-300 transition-colors"
          >
            <X size={13} />
            Close
          </button>
        </div>
      </div>

      {/* ── Map ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <DeckGL
          viewState={viewState}
          onViewStateChange={({ viewState: vs }) => setViewState(vs)}
          controller
          layers={layers}
          onHover={handleHover}
          onClick={handleClick}
          getCursor={({ isHovering }) => isHovering ? 'pointer' : 'grab'}
        >
          <Map mapStyle={MAP_STYLE} />
        </DeckGL>

        {/* Hover tooltip */}
        {hoverInfo && <Tooltip info={hoverInfo} />}

        {/* Info panel — bottom-left ────────────────────────────────────────── */}
        {scenario && (
          <div className="absolute bottom-4 left-4 bg-slate-900/90 border border-slate-700/60 rounded-xl px-4 py-3 text-xs backdrop-blur-sm">
            <div className="text-slate-400 font-semibold mb-2 text-[11px] tracking-wider uppercase">Hub Status</div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-6">
                <span className="text-slate-400">Hub</span>
                <span className="font-semibold text-white">YYZ Toronto Pearson</span>
              </div>
              {timelineStep >= 1 && (
                <div className="flex items-center justify-between gap-6">
                  <span className="text-slate-400">Capacity</span>
                  <span className="font-semibold text-red-400">
                    {scenario.airports?.find(a => a.code === 'YYZ')?.slots_per_hour_storm ?? 4} arr/hr
                    <span className="text-slate-500 font-normal ml-1">(↓ 67%)</span>
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-6">
                <span className="text-slate-400">Inbound</span>
                <span className="font-semibold text-white">{scenario.inbound_flights.length} flights</span>
              </div>
              {timelineStep === 3 && diversionCount > 0 && (
                <div className="flex items-center justify-between gap-6">
                  <span className="text-slate-400">Diversions</span>
                  <span className="font-semibold text-amber-400">{diversionCount} rerouted</span>
                </div>
              )}
            </div>

            {timelineStep === 3 && scenario.alternate_airports.length > 0 && (
              <>
                <div className="border-t border-slate-700/50 mt-2.5 pt-2.5">
                  <div className="text-slate-400 font-semibold mb-1.5 text-[11px] tracking-wider uppercase">Alternates</div>
                  {scenario.alternate_airports.map((a) => {
                    const used = optimizeResult?.inbound_decisions?.filter(d => d.diverted_to === a.code).length ?? 0
                    return (
                      <div key={a.code} className="flex items-center justify-between gap-6 mb-1">
                        <span className={used ? 'text-amber-300 font-semibold' : 'text-slate-500'}>{a.code}</span>
                        <span className={used ? 'text-amber-400 font-medium' : 'text-slate-500'}>
                          {used > 0 ? `${used} flight${used > 1 ? 's' : ''} inbound` : 'standby'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Hint */}
        <div className="absolute bottom-4 right-4 text-[11px] text-slate-600">
          Click arc to filter · Scroll to zoom · Drag to pan
        </div>
      </div>
    </div>
  )
}
