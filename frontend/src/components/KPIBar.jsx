import { useStore } from '../store/useStore'

function KPI({ label, value, sub, highlight, dim }) {
  return (
    <div className={`flex flex-col items-center px-5 py-2 border-r border-slate-700/50 last:border-0 ${dim ? 'opacity-40' : ''}`}>
      <span className={`text-xl font-bold font-mono tabular-nums ${highlight ?? 'text-white'}`}>
        {value}
      </span>
      <span className="text-xs text-slate-400 mt-0.5">{label}</span>
      {sub && <span className="text-xs text-slate-600 mt-0.5">{sub}</span>}
    </div>
  )
}

export default function KPIBar() {
  const { optimizeResult, timelineStep } = useStore()
  const hasResult = timelineStep === 3 && optimizeResult

  const fmt = (n) =>
    n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n.toFixed(0)}`

  return (
    <div className="flex items-center justify-center bg-slate-900/80 border-b border-slate-700/50 h-14">
      <KPI
        label="Savings"
        value={hasResult ? fmt(optimizeResult.savings_usd) : '—'}
        sub={hasResult ? `vs $${Math.round(optimizeResult.baseline_cost_usd / 1000)}K baseline` : undefined}
        highlight="text-green-400"
        dim={!hasResult}
      />
      <KPI
        label="PAX Protected"
        value={hasResult ? optimizeResult.passengers_protected : '—'}
        highlight="text-blue-400"
        dim={!hasResult}
      />
      <KPI
        label="PAX Stranded"
        value={hasResult ? optimizeResult.passengers_stranded : '—'}
        highlight={hasResult && optimizeResult.passengers_stranded > 0 ? 'text-red-400' : 'text-white'}
        dim={!hasResult}
      />
      <KPI
        label="Total Delay"
        value={hasResult ? `${optimizeResult.total_delay_minutes}m` : '—'}
        highlight="text-yellow-400"
        dim={!hasResult}
      />
      <KPI
        label="Optimized Cost"
        value={hasResult ? fmt(optimizeResult.optimized_cost_usd) : '—'}
        highlight="text-slate-200"
        dim={!hasResult}
      />
    </div>
  )
}
