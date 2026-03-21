import { useEffect, useRef, useMemo } from 'react'
import { CheckCircle, XCircle, AlertTriangle, X, Users } from 'lucide-react'
import { useStore } from '../store/useStore'

// ── Helpers ────────────────────────────────────────────────────────────────

const MIN_TO_CLOCK = (simStart, min) => {
  const [h, m] = simStart.split(':').map(Number)
  const total = h * 60 + m + min
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const fmtUSD = (n) => `$${Math.abs(Math.round(n)).toLocaleString('en-US')}`

function buildCards(scenario, optimizeResult, baselineResult, timelineStep) {
  if (!scenario) return []

  const hub = scenario.airports?.find(a => a.code === scenario.hub)

  return scenario.pax_groups.map(pg => {
    const inb = scenario.inbound_flights.find(f => f.flight_id === pg.inbound_flight_id)
    const out = scenario.outbound_flights.find(f => f.flight_id === pg.outbound_flight_id)
    const fd = optimizeResult?.flight_decisions?.find(f => f.flight_id === pg.outbound_flight_id)
    const pr = optimizeResult?.pax_results?.find(r => r.group_id === pg.group_id)
    const bpr = baselineResult?.pax_results?.find(r => r.group_id === pg.group_id)

    const mct = inb?.is_international ? (hub?.mct_international_min ?? 75) : (hub?.mct_domestic_min ?? 45)
    const windowBefore = inb && out ? out.std_min - inb.eta_min : 0
    const delayApplied = fd?.delay_applied_min ?? 0
    const windowAfter = windowBefore + delayApplied

    const etaClock = inb ? MIN_TO_CLOCK(scenario.sim_start_clock, inb.eta_min) : '—'
    const etdClock = out ? MIN_TO_CLOCK(scenario.sim_start_clock, out.std_min + delayApplied) : '—'

    const gc = scenario.global_costs ?? {}
    const penalty = pg.tier === 'business'
      ? (gc.business_stranded_cost_usd ?? 1750)
      : (gc.economy_stranded_cost_usd ?? 450)
    const totalPenalty = pg.count * penalty

    // Determine outcome
    let outcome
    if (timelineStep < 2) {
      outcome = 'nominal'
    } else if (timelineStep === 2) {
      outcome = windowBefore >= mct ? 'at_risk' : 'at_risk'
    } else {
      // step 3: use optimizer result
      if (pr?.connection_made) {
        outcome = 'connected'
      } else {
        outcome = 'stranded'
      }
    }

    // Why reason
    let whyReason = null
    if (timelineStep === 3) {
      if (outcome === 'connected' && delayApplied > 0) {
        whyReason = {
          type: 'held',
          text: `${pg.outbound_flight_id} held +${delayApplied}min`,
          detail: `window grew ${windowBefore}m → ${windowAfter}m ✓`,
        }
      } else if (outcome === 'connected' && windowBefore >= mct) {
        whyReason = {
          type: 'natural',
          text: 'Natural connection',
          detail: `${windowBefore}m window ≥ ${mct}m MCT`,
        }
      } else if (outcome === 'stranded') {
        const holdCost = fd?.cost_delay_usd ?? 0
        if (holdCost > 0 && holdCost > totalPenalty) {
          whyReason = {
            type: 'not_held',
            text: `${pg.outbound_flight_id} not held`,
            detail: `hold cost ${fmtUSD(holdCost)} > saving ${fmtUSD(totalPenalty)}`,
          }
        } else if (inb?.delay_min > 0) {
          whyReason = {
            type: 'inbound_late',
            text: `${pg.inbound_flight_id} arrived late`,
            detail: `+${inb.delay_min}min delay — window ${windowBefore}m < MCT ${mct}m`,
          }
        } else {
          whyReason = {
            type: 'tight',
            text: 'Connection too tight',
            detail: `window ${windowBefore}m < MCT ${mct}m`,
          }
        }
      }
    }

    return {
      ...pg,
      inbound: inb,
      outbound: out,
      flightDecision: fd,
      paxResult: pr,
      baselinePaxResult: bpr,
      mct,
      windowBefore,
      windowAfter,
      delayApplied,
      etaClock,
      etdClock,
      penalty,
      totalPenalty,
      outcome,
      whyReason,
    }
  })
}

// ── JourneyCard ─────────────────────────────────────────────────────────────

function JourneyCard({ card, isSelected, onHover, onLeave, scrollRef }) {
  const cardRef = useRef(null)

  useEffect(() => {
    if (isSelected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])

  const borderColor = {
    connected: 'border-green-800/50',
    stranded:  'border-red-800/50',
    at_risk:   'border-amber-800/50',
    nominal:   'border-slate-700/40',
  }[card.outcome]

  const bgColor = {
    connected: 'bg-green-950/20',
    stranded:  'bg-red-950/20',
    at_risk:   'bg-amber-950/20',
    nominal:   'bg-slate-800/30',
  }[card.outcome]

  const selectedRing = isSelected ? 'ring-1 ring-blue-500/60' : ''

  return (
    <div
      ref={cardRef}
      className={`rounded-lg border px-4 py-3 mb-2 transition-all cursor-default ${borderColor} ${bgColor} ${selectedRing}`}
      onMouseEnter={() => onHover(card)}
      onMouseLeave={onLeave}
    >
      {/* Row 1: Group ID + tier badge + outcome icon */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {card.outcome === 'connected' && <CheckCircle size={13} className="text-green-400 shrink-0" />}
          {card.outcome === 'stranded'  && <XCircle     size={13} className="text-red-400 shrink-0"   />}
          {card.outcome === 'at_risk'   && <AlertTriangle size={13} className="text-amber-400 shrink-0" />}
          {card.outcome === 'nominal'   && <Users size={13} className="text-slate-400 shrink-0" />}
          <span className="text-xs font-bold text-slate-200">{card.group_id}</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none"
            style={{
              background: card.tier === 'business' ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.15)',
              color:      card.tier === 'business' ? '#d8b4fe' : '#93c5fd',
            }}>
            {card.tier.toUpperCase()}
          </span>
        </div>

        {/* Outcome badge */}
        {card.outcome === 'connected' && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">✓ CONNECTED</span>
        )}
        {card.outcome === 'stranded' && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">✗ STRANDED</span>
        )}
        {card.outcome === 'at_risk' && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">⚠ AT RISK</span>
        )}
        {card.outcome === 'nominal' && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">NOMINAL</span>
        )}
      </div>

      {/* Row 2: Flight route */}
      <div className="text-xs text-slate-200 font-semibold mb-1">
        ✈ {card.inbound_flight_id} → ✈ {card.outbound_flight_id}
      </div>
      <div className="text-[11px] text-slate-400 mb-2">
        {card.count} pax · {card.inbound?.origin ?? '?'} → {card.outbound?.destination ?? '?'}
      </div>

      {/* Row 3: Times + MCT */}
      <div className="flex items-center gap-3 text-[11px] text-slate-400 mb-2">
        <span>ETA <span className="text-slate-300 font-mono">{card.etaClock}</span></span>
        <span className="text-slate-600">·</span>
        <span>ETD <span className="text-slate-300 font-mono">{card.etdClock}</span></span>
        <span className="text-slate-600">·</span>
        <span>MCT <span className="text-slate-300">{card.mct}min</span></span>
      </div>

      {/* Row 4: Window indicator */}
      <div className="text-[11px] mb-2">
        <span className="text-slate-400">Window: </span>
        <span className={card.windowBefore >= card.mct ? 'text-green-400' : 'text-red-400'}>
          {card.windowBefore}min
        </span>
        {card.delayApplied > 0 && (
          <>
            <span className="text-slate-500"> → </span>
            <span className={card.windowAfter >= card.mct ? 'text-green-400' : 'text-amber-400'}>
              {card.windowAfter}min
            </span>
            <span className="text-slate-500"> (after +{card.delayApplied}min hold)</span>
          </>
        )}
      </div>

      {/* Row 5: Cost line */}
      {card.outcome === 'connected' && (
        <div className="text-[11px] text-green-400 font-semibold">
          Cost avoided: <span className="font-mono">{fmtUSD(card.totalPenalty)}</span>
        </div>
      )}
      {card.outcome === 'stranded' && (
        <div className="text-[11px] text-red-400 font-semibold">
          Stranded cost: <span className="font-mono">{fmtUSD(card.totalPenalty)}</span>
        </div>
      )}

      {/* Row 6: Why reason */}
      {card.whyReason && (
        <div className="mt-2 pt-2 border-t border-slate-700/40">
          <div className="text-[10px] text-slate-500 mb-0.5 font-semibold uppercase tracking-wide">
            {card.outcome === 'connected' ? 'Why connected' : 'Why stranded'}
          </div>
          <div className="text-[11px] text-slate-300">{card.whyReason.text}</div>
          <div className="text-[11px] text-slate-500">{card.whyReason.detail}</div>
        </div>
      )}
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────

export default function PassengerJourneyCards() {
  const {
    scenario, optimizeResult, baselineResult, timelineStep,
    journeyPanelOpen, toggleJourneyPanel,
    selectedGroupId, setSelectedGroup,
    journeySort, setJourneySort,
    journeyFilter, setJourneyFilter,
    setSelectedFlight,
  } = useStore()

  const scrollRef = useRef(null)

  const allCards = useMemo(
    () => buildCards(scenario, optimizeResult, baselineResult, timelineStep),
    [scenario, optimizeResult, baselineResult, timelineStep]
  )

  const filteredCards = useMemo(() => {
    let cards = [...allCards]

    if (journeyFilter === 'connected') cards = cards.filter(c => c.outcome === 'connected')
    else if (journeyFilter === 'stranded') cards = cards.filter(c => c.outcome === 'stranded' || c.outcome === 'at_risk')

    if (journeySort === 'business') {
      cards.sort((a, b) => {
        if (a.tier !== b.tier) return a.tier === 'business' ? -1 : 1
        return b.count - a.count
      })
    } else if (journeySort === 'risk') {
      const rank = { stranded: 0, at_risk: 1, connected: 2, nominal: 3 }
      cards.sort((a, b) => rank[a.outcome] - rank[b.outcome])
    } else if (journeySort === 'cost') {
      cards.sort((a, b) => b.totalPenalty - a.totalPenalty)
    }

    return cards
  }, [allCards, journeyFilter, journeySort])

  // Summary stats
  const connected = allCards.filter(c => c.outcome === 'connected').length
  const stranded  = allCards.filter(c => c.outcome === 'stranded').length
  const atRisk    = allCards.filter(c => c.outcome === 'at_risk').length
  const costAvoided = allCards
    .filter(c => c.outcome === 'connected')
    .reduce((sum, c) => sum + c.totalPenalty, 0)

  const handleCardHover = (card) => {
    if (card.inbound_flight_id) setSelectedFlight(card.inbound_flight_id)
  }
  const handleCardLeave = () => {
    setSelectedFlight(null)
  }

  return (
    <div
      className="fixed top-0 right-0 bottom-0 w-[360px] z-40 flex flex-col"
      style={{
        background: '#0f172a',
        borderLeft: '1px solid rgba(51,65,85,0.5)',
        transform: journeyPanelOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease-out',
      }}
    >
      {/* ── Panel header ─────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-blue-400" />
            <span className="text-sm font-bold text-slate-100">Passenger Journey Results</span>
          </div>
          <button
            onClick={toggleJourneyPanel}
            className="text-slate-500 hover:text-white transition-colors p-0.5"
          >
            <X size={15} />
          </button>
        </div>

        {/* Summary line */}
        <div className="text-[11px] text-slate-400 mb-3">
          {timelineStep === 3 ? (
            <>
              <span className="text-green-400 font-semibold">✓ {connected} connected</span>
              {stranded > 0 && <span className="text-red-400 font-semibold"> · ✗ {stranded} stranded</span>}
              {costAvoided > 0 && (
                <div className="text-green-400 mt-0.5 font-mono text-[10px]">{fmtUSD(costAvoided)} stranded cost avoided</div>
              )}
            </>
          ) : (
            <span className="text-amber-400 font-semibold">⚠ {atRisk || allCards.length} groups at risk — run optimizer for results</span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Sort */}
          <div className="flex items-center gap-1 bg-slate-800/60 rounded p-0.5">
            {[['business', 'Biz first'], ['risk', 'At risk'], ['cost', 'Cost ↓']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setJourneySort(val)}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors font-medium ${
                  journeySort === val
                    ? 'bg-blue-600/40 text-blue-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-1 bg-slate-800/60 rounded p-0.5">
            {[['all', 'All'], ['connected', 'OK'], ['stranded', 'Risk']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setJourneyFilter(val)}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors font-medium ${
                  journeyFilter === val
                    ? 'bg-blue-600/40 text-blue-300'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scrollable card list ──────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {filteredCards.length === 0 ? (
          <div className="text-center text-slate-500 text-xs mt-8">No groups match filter</div>
        ) : (
          filteredCards.map(card => (
            <JourneyCard
              key={card.group_id}
              card={card}
              isSelected={card.group_id === selectedGroupId}
              onHover={handleCardHover}
              onLeave={handleCardLeave}
              scrollRef={scrollRef}
            />
          ))
        )}
      </div>
    </div>
  )
}
