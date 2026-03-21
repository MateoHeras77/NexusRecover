import { GitCompare, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import SankeyPanel from './SankeyPanel'
import { FLOW_COLORS } from '../lib/sankey'

export default function CompareView() {
  const {
    scenario, optimizeResult, baselineResult,
    selectedFlightId, toggleCompareMode,
  } = useStore()

  if (!scenario || !optimizeResult) return null

  const savings    = optimizeResult.savings_usd ?? 0
  const baseline   = optimizeResult.baseline_cost_usd ?? 0
  const savingsPct = baseline > 0 ? Math.round((savings / baseline) * 100) : 0

  // Left panel uses baseline_cost_usd from the real optimizeResult (same source of truth as KPIBar)
  const leftCost       = baseline
  const leftStranded   = baselineResult?.passengers_stranded ?? '—'
  const rightCost      = optimizeResult.optimized_cost_usd
  const rightProtected = optimizeResult.passengers_protected ?? '—'

  const fmt = (n) => typeof n === 'number'
    ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    : '—'

  return (
    <div className="flex flex-col w-full h-full">

      {/* ── Strip header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-700/40 bg-slate-900/70 shrink-0">
        <div className="flex items-center gap-2">
          <GitCompare size={12} className="text-blue-400" />
          <span className="text-xs font-semibold text-slate-300">Comparison Mode</span>
          <span className="text-xs text-slate-600">Without Intervention  vs  Nexus Plan</span>
        </div>
        <button
          onClick={toggleCompareMode}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 rounded transition-colors"
        >
          <X size={10} />
          Exit Compare
        </button>
      </div>

      {/* ── Split panels ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative min-h-0">

        {/* LEFT — no intervention (baseline) */}
        <div className="flex-1 flex flex-col border-r border-slate-700/30 min-w-0 bg-red-950/10">

          {/* Panel header */}
          <div className="flex items-center justify-center py-1.5 border-b border-red-900/30 bg-red-950/30 shrink-0">
            <span className="text-[10px] font-bold tracking-widest text-red-400 px-2 py-0.5 bg-red-900/30 rounded">
              ✗ &nbsp;WITHOUT INTERVENTION
            </span>
          </div>

          {/* Sankey */}
          <div className="flex-1 overflow-hidden min-h-0">
            <SankeyPanel
              scenario={scenario}
              optimizeResult={baselineResult}
              timelineStep={3}
              selectedFlightId={selectedFlightId}
            />
          </div>

          {/* Bottom metrics */}
          <div className="flex justify-center gap-8 px-4 py-2.5 border-t border-red-900/20 bg-red-950/20 shrink-0">
            <div className="text-center">
              <div className="text-base font-bold font-mono text-red-400">{fmt(leftCost)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">total cost</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold font-mono text-red-300">{leftStranded}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">PAX stranded</div>
            </div>
          </div>
        </div>

        {/* CENTER — savings badge (absolutely positioned over the divider) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center pointer-events-none">
          <div className="w-px h-16 bg-gradient-to-b from-transparent via-green-500/30 to-transparent" />
          <div className="bg-[#0a0e1a] border border-green-600/50 rounded-2xl px-4 py-2.5 text-center shadow-xl shadow-green-900/20 mx-1">
            <div className="text-[9px] text-slate-400 font-semibold tracking-widest uppercase mb-1">Savings</div>
            <div className="text-xl font-bold font-mono text-green-400 leading-none">
              {fmt(savings)}
            </div>
            <div className="text-[10px] text-green-500/80 mt-1 font-medium">↓ {savingsPct}% reduction</div>
          </div>
          <div className="w-px h-16 bg-gradient-to-b from-transparent via-green-500/30 to-transparent" />
        </div>

        {/* RIGHT — nexus plan */}
        <div className="flex-1 flex flex-col min-w-0 bg-green-950/10">

          {/* Panel header */}
          <div className="flex items-center justify-center py-1.5 border-b border-green-900/20 bg-green-950/25 shrink-0">
            <span className="text-[10px] font-bold tracking-widest text-green-400 px-2 py-0.5 bg-green-900/30 rounded">
              ✓ &nbsp;NEXUS PLAN ACTIVE
            </span>
          </div>

          {/* Sankey */}
          <div className="flex-1 overflow-hidden min-h-0">
            <SankeyPanel
              scenario={scenario}
              optimizeResult={optimizeResult}
              timelineStep={3}
              selectedFlightId={selectedFlightId}
            />
          </div>

          {/* Bottom metrics */}
          <div className="flex justify-center gap-8 px-4 py-2.5 border-t border-green-900/20 bg-green-950/20 shrink-0">
            <div className="text-center">
              <div className="text-base font-bold font-mono text-green-400">{fmt(rightCost)}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">total cost</div>
            </div>
            <div className="text-center">
              <div className="text-base font-bold font-mono text-green-300">{rightProtected}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">PAX protected</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Legend strip ─────────────────────────────────────────────────────── */}
      <div className="flex justify-center gap-5 py-1.5 border-t border-slate-700/30 bg-slate-900/40 shrink-0">
        {[
          { status: 'nominal',   label: 'On time' },
          { status: 'at_risk',   label: 'At risk' },
          { status: 'protected', label: 'Protected' },
          { status: 'stranded',  label: 'Stranded' },
          { status: 'diverted',  label: 'Diverted' },
        ].map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1.5">
            <div
              className="w-3 h-1.5 rounded-sm"
              style={{ backgroundColor: FLOW_COLORS[status].stroke, opacity: FLOW_COLORS[status].opacity + 0.1 }}
            />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
