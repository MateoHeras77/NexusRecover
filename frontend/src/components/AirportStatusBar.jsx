import { useStore } from '../store/useStore'

function SlotDots({ total, used, stormActive, hasResult }) {
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: total }).map((_, i) => {
        const isUsed = hasResult && i < used
        const isActive = !hasResult && stormActive && i < (total - used)
        return (
          <span
            key={i}
            className={`inline-block w-2 h-2 rounded-sm ${
              isUsed
                ? 'bg-amber-400'
                : stormActive && !hasResult
                  ? i < total ? 'bg-red-500/70' : 'border border-slate-600'
                  : 'bg-green-500/70'
            }`}
          />
        )
      })}
    </div>
  )
}

function HubSlotDots({ nominal, storm, isStorm }) {
  return (
    <div className="flex gap-0.5 items-center flex-wrap max-w-[120px]">
      {Array.from({ length: nominal }).map((_, i) => (
        <span
          key={i}
          className={`inline-block w-1.5 h-1.5 rounded-sm transition-all duration-500 ${
            isStorm
              ? i < storm ? 'bg-red-500' : 'bg-slate-700'
              : 'bg-green-500/80'
          }`}
        />
      ))}
    </div>
  )
}

export default function AirportStatusBar() {
  const { scenario, optimizeResult, timelineStep } = useStore()
  if (!scenario) return null

  const hub = scenario.airports.find(a => a.code === scenario.hub)
  if (!hub) return null

  const isStorm = timelineStep >= 1
  const hasPlan = timelineStep === 3 && optimizeResult

  const slotsPerHour = isStorm ? hub.slots_per_hour_storm : hub.slots_per_hour_nominal
  const slotsPerWindow = slotsPerHour / 2
  const nominalSlotsPerWindow = hub.slots_per_hour_nominal / 2
  const reductionPct = Math.round((1 - slotsPerHour / hub.slots_per_hour_nominal) * 100)

  // Count diversions used per alternate airport
  const diversionsUsed = {}
  if (optimizeResult?.inbound_decisions) {
    for (const d of optimizeResult.inbound_decisions) {
      if (d.diverted_to) {
        diversionsUsed[d.diverted_to] = (diversionsUsed[d.diverted_to] ?? 0) + 1
      }
    }
  }

  const totalDiverted = Object.values(diversionsUsed).reduce((a, b) => a + b, 0)

  let hubBadge, hubBadgeClass
  if (hasPlan) {
    hubBadge = `${totalDiverted} FLIGHT${totalDiverted !== 1 ? 'S' : ''} REROUTED`
    hubBadgeClass = 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
  } else if (isStorm) {
    hubBadge = 'GDP ACTIVE'
    hubBadgeClass = 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
  } else {
    hubBadge = 'NORMAL OPS'
    hubBadgeClass = 'bg-green-500/20 text-green-400 border border-green-500/30'
  }

  return (
    <div className="shrink-0 border-b border-slate-700/50 bg-slate-900/60 px-4 py-2 flex items-center justify-center gap-3">

      {/* ── YYZ Hub Card ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 bg-slate-800/50 rounded-lg px-4 py-2 border border-slate-700/40">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-wide">{hub.code}</span>
            <span className="text-xs text-slate-400">{hub.name ?? hub.city ?? ''}</span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider ${hubBadgeClass}`}>
              {hubBadge}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <HubSlotDots
              nominal={hub.slots_per_hour_nominal}
              storm={hub.slots_per_hour_storm}
              isStorm={isStorm}
            />
            <div className="flex flex-col">
              <span className={`text-xs font-mono font-bold tabular-nums ${isStorm ? 'text-red-400' : 'text-green-400'}`}>
                {slotsPerHour} arr/hr
              </span>
              <span className="text-[10px] text-slate-500">
                {slotsPerWindow} slots / 30 min
                {isStorm && <span className="text-red-500/80 ml-1">↓ {reductionPct}%</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Divider + context message */}
        <div className="border-l border-slate-700 pl-3">
          {hasPlan ? (
            <p className="text-[10px] text-amber-400/80 max-w-[160px] leading-relaxed">
              Strategic diversion plan applied — capacity constraint resolved
            </p>
          ) : isStorm ? (
            <p className="text-[10px] text-slate-400 max-w-[160px] leading-relaxed">
              {timelineStep >= 2
                ? <span className="text-red-400/90">Capacity crunch — 3 flights competing for 2 slots</span>
                : 'Runway throughput reduced — monitor inbound spacing'}
            </p>
          ) : (
            <p className="text-[10px] text-slate-500 max-w-[160px] leading-relaxed">
              All runways operational — nominal throughput
            </p>
          )}
        </div>
      </div>

      {/* ── Divider ──────────────────────────────────────────────────────── */}
      <div className="text-slate-700 text-xs font-light select-none">ALTERNATE AIRPORTS</div>

      {/* ── Alternate Airport Cards ───────────────────────────────────────── */}
      {scenario.alternate_airports.map(alt => {
        const used = diversionsUsed[alt.code] ?? 0
        const isFull = hasPlan && used >= alt.max_diversion_slots
        const hasAnyDiversion = hasPlan && used > 0

        return (
          <div
            key={alt.code}
            className={`flex flex-col gap-1 bg-slate-800/40 rounded-lg px-3 py-2 border transition-all ${
              hasAnyDiversion
                ? 'border-amber-500/40 bg-amber-900/10'
                : 'border-slate-700/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold tracking-wide ${hasAnyDiversion ? 'text-amber-400' : 'text-slate-300'}`}>
                {alt.code}
              </span>
              <span className="text-[10px] text-slate-500 truncate max-w-[110px]">{alt.name}</span>
              {isFull && (
                <span className="text-[9px] font-bold px-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                  FULL
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Slot dots */}
              <div className="flex gap-0.5">
                {Array.from({ length: alt.max_diversion_slots }).map((_, i) => (
                  <span
                    key={i}
                    className={`inline-block w-2.5 h-2.5 rounded-sm border transition-all ${
                      hasPlan && i < used
                        ? 'bg-amber-400 border-amber-400'
                        : 'border-slate-600 bg-transparent'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {hasPlan ? `${used}/${alt.max_diversion_slots}` : `0/${alt.max_diversion_slots}`}
              </span>
            </div>

            <div className="text-[10px] text-slate-500 leading-tight">
              <span className="text-slate-400">${alt.transport_cost_per_pax_usd}/pax</span>
              <span className="mx-1">·</span>
              {alt.transport_time_min} min transfer
            </div>
          </div>
        )
      })}
    </div>
  )
}
