import { useStore } from '../store/useStore'

const MIN_TO_CLOCK = (simStart, min) => {
  const [h, m] = simStart.split(':').map(Number)
  const total = h * 60 + m + min
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function DelayBadge({ delay }) {
  if (!delay || delay === 0) return <span className="text-green-400 text-xs font-mono">ON TIME</span>
  return <span className="text-red-400 text-xs font-mono">+{delay}m</span>
}

function StatusDot({ color }) {
  const colors = { green: 'bg-green-400', red: 'bg-red-400', yellow: 'bg-yellow-400', gray: 'bg-slate-500' }
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${colors[color] ?? colors.gray} shrink-0`} />
}

export function InboundPanel() {
  const { scenario, optimizeResult, timelineStep, selectedFlightId, setSelectedFlight } = useStore()
  if (!scenario) return <PanelSkeleton title="ARRIVALS" />

  const simStart = scenario.sim_start_clock

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="ARRIVALS" subtitle={`${scenario.hub} inbound`} />
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {scenario.inbound_flights.map((f) => {
          const disrupted = timelineStep >= 1 && f.delay_min > 0
          const isSelected = selectedFlightId === f.flight_id
          const divDecision = timelineStep === 3 && optimizeResult?.inbound_decisions
            ? optimizeResult.inbound_decisions.find((d) => d.flight_id === f.flight_id)
            : null
          const isDiverted = !!divDecision?.diverted_to
          const connectingPax = f.total_pax - (f.local_pax ?? 0)

          const dotColor = isDiverted ? 'yellow' : disrupted ? 'red' : 'green'
          const borderClass = isSelected
            ? isDiverted
              ? 'bg-yellow-900/30 border-yellow-500/60'
              : 'bg-blue-900/40 border-blue-500/60'
            : 'bg-slate-800/50 border-slate-700/40 hover:border-slate-600'

          return (
            <button
              key={f.flight_id}
              onClick={() => setSelectedFlight(isSelected ? null : f.flight_id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${borderClass}`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <StatusDot color={dotColor} />
                  <span className="text-sm font-semibold text-white">{f.flight_id}</span>
                  <span className="text-xs text-slate-400">{f.origin} → {f.destination}</span>
                </div>
                {isDiverted
                  ? <span className="text-xs font-mono text-yellow-400">DIVERTED</span>
                  : <DelayBadge delay={timelineStep >= 1 ? f.delay_min : 0} />
                }
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  ETA {timelineStep >= 1
                    ? MIN_TO_CLOCK(simStart, f.eta_min)
                    : MIN_TO_CLOCK(simStart, f.sta_min)}
                </span>
                <span>
                  {f.local_pax != null
                    ? `${f.local_pax} lcl · ${connectingPax} cx`
                    : `${f.total_pax} pax`
                  } · {f.aircraft_type}
                </span>
              </div>
              {isDiverted && (
                <div className="mt-1 text-xs text-yellow-400/80 font-mono">
                  → {divDecision.diverted_to} · ${divDecision.diversion_cost_usd.toLocaleString()} transport
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function OutboundPanel() {
  const { scenario, optimizeResult, timelineStep, selectedFlightId, setSelectedFlight } = useStore()
  if (!scenario) return <PanelSkeleton title="DEPARTURES" />

  const simStart = scenario.sim_start_clock

  return (
    <div className="flex flex-col h-full">
      <PanelHeader title="DEPARTURES" subtitle={`${scenario.hub} outbound`} />
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {scenario.outbound_flights.map((f) => {
          let delayApplied = 0
          let cancelled = false
          let etd = f.std_min

          if (timelineStep === 3 && optimizeResult) {
            const dec = optimizeResult.flight_decisions.find((d) => d.flight_id === f.flight_id)
            if (dec) {
              delayApplied = dec.delay_applied_min
              cancelled = dec.cancelled
              etd = dec.etd_final_min
            }
          }

          const isSelected = selectedFlightId === f.flight_id
          const statusColor = cancelled ? 'red' : delayApplied > 0 ? 'yellow' : 'green'

          return (
            <button
              key={f.flight_id}
              onClick={() => setSelectedFlight(isSelected ? null : f.flight_id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                isSelected
                  ? 'bg-purple-900/40 border-purple-500/60'
                  : 'bg-slate-800/50 border-slate-700/40 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <StatusDot color={statusColor} />
                  <span className="text-sm font-semibold text-white">{f.flight_id}</span>
                  <span className="text-xs text-slate-400">{f.origin} → {f.destination}</span>
                </div>
                {cancelled ? (
                  <span className="text-xs font-mono text-red-400">CANCELLED</span>
                ) : (
                  <DelayBadge delay={timelineStep === 3 ? delayApplied : 0} />
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  ETD {timelineStep === 3
                    ? MIN_TO_CLOCK(simStart, etd)
                    : MIN_TO_CLOCK(simStart, f.std_min)}
                </span>
                <span>{f.total_pax_onboard} local · {f.aircraft_type}</span>
              </div>
              {timelineStep === 3 && delayApplied > 0 && (
                <div className="mt-1 text-xs text-yellow-500/80">
                  Held for connecting PAX
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PanelHeader({ title, subtitle }) {
  return (
    <div className="mb-3">
      <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">{title}</h2>
      <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>
    </div>
  )
}

function PanelSkeleton({ title }) {
  return (
    <div className="flex flex-col h-full">
      <PanelHeader title={title} subtitle="Loading..." />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-14 bg-slate-800/30 rounded-lg mb-1 animate-pulse" />
      ))}
    </div>
  )
}
