import { useStore } from '../store/useStore'
import { TrendingUp, Users, UserX, Clock, PlaneTakeoff, DollarSign } from 'lucide-react'

function KPI({ label, value, sub, icon: Icon, colorClass, bgClass, dim, accent }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-1.5 border-r border-slate-700/40 last:border-0 transition-opacity ${dim ? 'opacity-30' : ''}`}>
      {/* Icon pill */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${bgClass}`}>
        <Icon size={15} className={colorClass} />
      </div>
      {/* Text */}
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider leading-none mb-0.5">
          {label}
        </span>
        <span className={`text-base font-bold font-mono tabular-nums leading-none ${colorClass}`}>
          {value}
        </span>
        {sub && (
          <span className="text-[10px] text-slate-600 mt-0.5 leading-none truncate">{sub}</span>
        )}
      </div>
      {/* Optional accent bar on the left */}
      {accent && !dim && (
        <div className={`absolute left-0 top-1/4 bottom-1/4 w-0.5 rounded-full ${accent}`} />
      )}
    </div>
  )
}

export default function KPIBar() {
  const { optimizeResult, timelineStep } = useStore()
  const hasResult = timelineStep === 3 && optimizeResult

  const fmt = (n) =>
    n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${Math.round(n)}`

  return (
    <div className="relative flex items-center justify-center bg-slate-900/90 border-b border-slate-700/50 h-14 shrink-0 overflow-hidden">
      {/* Subtle gradient glow when results are in */}
      {hasResult && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-950/20 to-transparent pointer-events-none" />
      )}

      <KPI
        label="Cost Savings"
        value={hasResult ? fmt(optimizeResult.savings_usd) : '—'}
        sub={hasResult ? `vs ${fmt(optimizeResult.baseline_cost_usd)} baseline` : 'vs baseline'}
        icon={TrendingUp}
        colorClass="text-emerald-400"
        bgClass="bg-emerald-950/60"
        dim={!hasResult}
      />
      <KPI
        label="PAX Protected"
        value={hasResult ? optimizeResult.passengers_protected.toLocaleString() : '—'}
        sub={hasResult ? 'connections made' : undefined}
        icon={Users}
        colorClass="text-sky-400"
        bgClass="bg-sky-950/60"
        dim={!hasResult}
      />
      <KPI
        label="PAX Stranded"
        value={hasResult ? optimizeResult.passengers_stranded.toLocaleString() : '—'}
        sub={hasResult && optimizeResult.passengers_stranded > 0 ? 'missed connections' : hasResult ? 'none' : undefined}
        icon={UserX}
        colorClass={hasResult && optimizeResult.passengers_stranded > 0 ? 'text-rose-400' : 'text-slate-400'}
        bgClass={hasResult && optimizeResult.passengers_stranded > 0 ? 'bg-rose-950/60' : 'bg-slate-800/60'}
        dim={!hasResult}
      />
      <KPI
        label="Total Delay"
        value={hasResult ? `${optimizeResult.total_delay_minutes} min` : '—'}
        sub={hasResult ? 'outbound held' : undefined}
        icon={Clock}
        colorClass="text-amber-400"
        bgClass="bg-amber-950/60"
        dim={!hasResult}
      />
      <KPI
        label="Diversions"
        value={hasResult ? optimizeResult.flights_diverted.toLocaleString() : '—'}
        sub={hasResult && optimizeResult.flights_diverted > 0 ? `${fmt(optimizeResult.diversion_cost_usd)} transport` : hasResult ? 'none' : undefined}
        icon={PlaneTakeoff}
        colorClass={hasResult && optimizeResult.flights_diverted > 0 ? 'text-violet-400' : 'text-slate-400'}
        bgClass={hasResult && optimizeResult.flights_diverted > 0 ? 'bg-violet-950/60' : 'bg-slate-800/60'}
        dim={!hasResult}
      />
      <KPI
        label="Optimized Cost"
        value={hasResult ? fmt(optimizeResult.optimized_cost_usd) : '—'}
        sub={hasResult ? 'total recovery cost' : undefined}
        icon={DollarSign}
        colorClass="text-slate-200"
        bgClass="bg-slate-800/60"
        dim={!hasResult}
      />
    </div>
  )
}
