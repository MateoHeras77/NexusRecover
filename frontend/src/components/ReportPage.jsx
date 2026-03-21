import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import {
  ArrowLeft, Plane, Users, UserX, AlertTriangle, CheckCircle,
  TrendingDown, TrendingUp, Clock, PlaneTakeoff, Hotel,
  DollarSign, Shield, XCircle, HelpCircle,
} from 'lucide-react'

const fmtUSD = (n) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${Math.round(n).toLocaleString()}`
const fmtUSDFull = (n) =>
  `$${Math.round(n).toLocaleString()}`

function InfoTooltip({ children }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  return (
    <span
      className="inline-flex items-center ml-1 cursor-help align-middle"
      onMouseEnter={(e) => { setPos({ x: e.clientX, y: e.clientY }); setVisible(true) }}
      onMouseLeave={() => setVisible(false)}
      onMouseMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
    >
      <HelpCircle size={11} className={`transition-colors ${visible ? 'text-slate-300' : 'text-slate-500'}`} />
      {visible && (
        <span
          className="fixed w-64 bg-slate-900 border border-slate-500/60 text-slate-300 text-[10px] leading-relaxed rounded-lg px-3 py-2.5 z-[9999] shadow-2xl whitespace-normal font-normal normal-case tracking-normal pointer-events-none"
          style={{ left: pos.x + 14, top: pos.y - 8 }}
        >
          {children}
        </span>
      )}
    </span>
  )
}

function StatCard({ icon: Icon, label, value, sub, color = 'slate' }) {
  const colors = {
    green:  { bg: 'bg-emerald-950/50',  border: 'border-emerald-800/40',  text: 'text-emerald-400',  icon: 'bg-emerald-900/60' },
    red:    { bg: 'bg-rose-950/50',     border: 'border-rose-800/40',     text: 'text-rose-400',     icon: 'bg-rose-900/60' },
    blue:   { bg: 'bg-sky-950/50',      border: 'border-sky-800/40',      text: 'text-sky-400',      icon: 'bg-sky-900/60' },
    amber:  { bg: 'bg-amber-950/50',    border: 'border-amber-800/40',    text: 'text-amber-400',    icon: 'bg-amber-900/60' },
    violet: { bg: 'bg-violet-950/50',   border: 'border-violet-800/40',   text: 'text-violet-400',   icon: 'bg-violet-900/60' },
    slate:  { bg: 'bg-slate-800/40',    border: 'border-slate-700/40',    text: 'text-slate-200',    icon: 'bg-slate-700/60' },
  }
  const c = colors[color]
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${c.bg} ${c.border}`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.icon}`}>
        <Icon size={16} className={c.text} />
      </div>
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
        <p className={`text-lg font-bold font-mono tabular-nums ${c.text}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-600 leading-none mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function SectionHeader({ number, title, subtitle, color = 'slate' }) {
  const colors = {
    red:   'bg-rose-600',
    green: 'bg-emerald-600',
    blue:  'bg-sky-600',
    slate: 'bg-slate-600',
  }
  return (
    <div className="flex items-start gap-4 mb-5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0 mt-0.5 ${colors[color]}`}>
        {number}
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function Table({ headers, rows, footer }) {
  return (
    <div className="rounded-xl border border-slate-700/50 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-800/60 border-b border-slate-700/50">
            {headers.map((h, i) => (
              <th key={i} className={`px-4 py-2.5 text-slate-400 font-semibold uppercase tracking-wider text-left ${i > 0 ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={`border-b border-slate-800/50 ${row._highlight ? row._highlight : ri % 2 === 0 ? 'bg-slate-900/20' : 'bg-transparent'}`}>
              {row.cells.map((cell, ci) => (
                <td key={ci} className={`px-4 py-2.5 font-mono tabular-nums ${ci > 0 ? 'text-right' : 'text-left'} ${cell.cls ?? 'text-slate-300'}`}>
                  {cell.v ?? cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="bg-slate-800/50 border-t border-slate-600/50">
              {footer.map((cell, i) => (
                <td key={i} className={`px-4 py-2.5 font-bold font-mono ${i > 0 ? 'text-right' : 'text-left'} ${cell.cls ?? 'text-white'}`}>
                  {cell.v ?? cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

export default function ReportPage() {
  const { scenario, optimizeResult, setShowReport } = useStore()
  if (!scenario || !optimizeResult) return null

  const hubAirport = scenario.airports.find(a => a.code === scenario.hub)
  const inboundMap  = Object.fromEntries(scenario.inbound_flights.map(f => [f.flight_id, f]))
  const outboundMap = Object.fromEntries(scenario.outbound_flights.map(f => [f.flight_id, f]))
  const gc = scenario.global_costs

  // ── Baseline computation (no action) ──────────────────────────────────────
  const baselineGroups = useMemo(() => scenario.pax_groups.map(pg => {
    const inb = inboundMap[pg.inbound_flight_id]
    const out = outboundMap[pg.outbound_flight_id]
    const mct = inb.is_international ? hubAirport.mct_international_min : hubAirport.mct_domestic_min
    const made = out.std_min >= inb.eta_min + mct
    const penalty = pg.tier === 'business' ? gc.business_stranded_cost_usd : gc.economy_stranded_cost_usd
    const hotelCost = made ? 0 : pg.count * hubAirport.hotel_cost_usd
    const compCost  = made ? 0 : pg.count * (penalty - hubAirport.hotel_cost_usd)
    return { ...pg, made, strandedCost: made ? 0 : pg.count * penalty, hotelCost, compCost }
  }), [scenario])

  const baselineStranded = baselineGroups.filter(g => !g.made)
  const baselineTotalPax = baselineStranded.reduce((a, g) => a + g.count, 0)
  const baselineTotalCost = baselineStranded.reduce((a, g) => a + g.strandedCost, 0)
  const baselineHotelCost = baselineStranded.reduce((a, g) => a + g.hotelCost, 0)
  const baselineCompCost  = baselineStranded.reduce((a, g) => a + g.compCost, 0)
  const baselineEcoStranded = baselineStranded.filter(g => g.tier === 'economy')
  const baselineBizStranded = baselineStranded.filter(g => g.tier === 'business')

  // ── Optimized breakdown ────────────────────────────────────────────────────
  const totalDelayCost = optimizeResult.flight_decisions.reduce((a, d) => a + d.cost_delay_usd, 0)
  const strandedGroups = optimizeResult.pax_results.filter(r => !r.connection_made)
  const protectedGroups = optimizeResult.pax_results.filter(r => r.connection_made)
  const strandedCostOpt = strandedGroups.reduce((a, r) => a + r.cost_stranded_usd, 0)
  const diversionDecisions = optimizeResult.inbound_decisions.filter(d => d.diverted_to)

  // True divert cost = transport + hotel for all pax on diverted flight
  const diversionWithHotel = diversionDecisions.map(d => {
    const transportCost = d.diversion_cost_usd
    const hotelCost = inboundMap[d.flight_id].total_pax * hubAirport.hotel_cost_usd
    return { ...d, transportCost, hotelCost, totalDivertCost: transportCost + hotelCost }
  })
  const totalDiversionCostTrue = diversionWithHotel.reduce((a, d) => a + d.totalDivertCost, 0)

  const totalConnectingPax = scenario.pax_groups.reduce((a, g) => a + g.count, 0)
  const savingsPct = Math.round((optimizeResult.savings_usd / optimizeResult.baseline_cost_usd) * 100)

  return (
    <div className="fixed inset-0 bg-[#080c17] text-slate-100 overflow-y-auto z-50">

      {/* ── Top nav ───────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-slate-900/95 border-b border-slate-700/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => setShowReport(false)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">N</span>
            </div>
            <span className="text-sm font-bold text-white">NexusRecover</span>
            <span className="text-xs text-slate-500">Recovery Report</span>
          </div>
          <div className="text-xs text-slate-500 font-mono">{scenario.hub} · {scenario.sim_start_clock}</div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">

        {/* ── Report header ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">IRROPS Recovery Analysis</p>
              <h1 className="text-2xl font-bold text-white">{scenario.name}</h1>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">{scenario.description}</p>
            </div>
            <div className="text-right shrink-0 ml-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/40 border border-emerald-600/40 rounded-lg">
                <CheckCircle size={13} className="text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">Optimization Complete</span>
              </div>
            </div>
          </div>

          {/* Situation stat cards */}
          <div className="grid grid-cols-4 gap-3 mt-6">
            <StatCard icon={Plane} label="Inbound Flights" value={scenario.inbound_flights.length} sub="arriving at hub" color="blue" />
            <StatCard icon={Users} label="Connecting PAX" value={totalConnectingPax} sub={`across ${scenario.pax_groups.length} groups`} color="blue" />
            <StatCard icon={PlaneTakeoff} label="Outbound Flights" value={scenario.outbound_flights.length} sub="departing hub" color="slate" />
            <StatCard
              icon={AlertTriangle}
              label="Capacity Impact"
              value={`${hubAirport.slots_per_hour_nominal}→${hubAirport.slots_per_hour_storm} arr/hr`}
              sub={`${Math.round((1 - hubAirport.slots_per_hour_storm / hubAirport.slots_per_hour_nominal) * 100)}% reduction at ${scenario.hub}`}
              color="red"
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SCENARIO 1 — NO ACTION
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-900/40 border border-slate-700/40 rounded-2xl p-6">
          <SectionHeader
            number="1"
            title="Sin Acción — Do Nothing"
            subtitle="All delayed flights arrive late. No outbound flights held. All missed connections go unrecovered."
            color="red"
          />

          {/* Cost summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard icon={Users}         label="PAX Stranded"      value={baselineTotalPax.toLocaleString()}  sub="missed connections"             color="red" />
            <StatCard icon={Hotel}         label="Hotel Costs"        value={fmtUSD(baselineHotelCost)}          sub={`${hubAirport.hotel_cost_usd}/pax/night`} color="amber" />
            <StatCard icon={DollarSign}    label="Compensation & Rebooking" value={fmtUSD(baselineCompCost)}    sub="tickets + meals + vouchers"      color="red" />
          </div>

          {/* Stranded breakdown table */}
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Missed Connections Breakdown</h3>
          <Table
            headers={[
              'Inbound → Outbound', 'PAX', 'Tier',
              <span key="hotel" className="inline-flex items-center">
                Hotel
                <InfoTooltip>
                  One night accommodation near YYZ + meals + ground transfer to hotel.
                  <br/><strong className="text-white">Rate: ${hubAirport.hotel_cost_usd}/pax/night</strong> (YYZ area rate, applies per stranded passenger).
                </InfoTooltip>
              </span>,
              <span key="comp" className="inline-flex items-center">
                Compensation &amp; Rebooking
                <InfoTooltip>
                  Regulatory compensation + priority rebooking on next available flight + meal vouchers.
                  <br/><strong className="text-white">Economy: ${gc.economy_stranded_cost_usd - hubAirport.hotel_cost_usd}/pax</strong>
                  <br/><strong className="text-violet-300">Business: ${gc.business_stranded_cost_usd - hubAirport.hotel_cost_usd}/pax</strong> (includes lounge access + premium rebooking)
                </InfoTooltip>
              </span>,
              'Total Cost',
            ]}
            rows={baselineStranded.map(g => ({
              cells: [
                { v: `${g.inbound_flight_id} → ${g.outbound_flight_id}`, cls: 'text-slate-200 font-sans' },
                { v: g.count, cls: 'text-slate-300' },
                { v: g.tier, cls: g.tier === 'business' ? 'text-violet-400 uppercase text-[10px]' : 'text-slate-400 uppercase text-[10px]' },
                { v: fmtUSDFull(g.hotelCost), cls: 'text-amber-400/80' },
                { v: fmtUSDFull(g.compCost),  cls: 'text-rose-400/80' },
                { v: fmtUSDFull(g.strandedCost), cls: 'text-rose-400 font-bold' },
              ],
            }))}
            footer={[
              { v: `Total — ${baselineStranded.length} groups affected`, cls: 'text-slate-300 font-sans' },
              { v: baselineTotalPax, cls: 'text-white' },
              { v: '' },
              { v: fmtUSDFull(baselineHotelCost), cls: 'text-amber-400' },
              { v: fmtUSDFull(baselineCompCost),  cls: 'text-rose-400' },
              { v: fmtUSDFull(baselineTotalCost), cls: 'text-rose-400' },
            ]}
          />

          {/* Tier split */}
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
              Economy stranded: <span className="text-slate-300 font-mono ml-1">
                {baselineEcoStranded.reduce((a,g)=>a+g.count,0)} pax · {fmtUSD(baselineEcoStranded.reduce((a,g)=>a+g.strandedCost,0))}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
              Business stranded: <span className="text-slate-300 font-mono ml-1">
                {baselineBizStranded.reduce((a,g)=>a+g.count,0)} pax · {fmtUSD(baselineBizStranded.reduce((a,g)=>a+g.strandedCost,0))}
              </span>
            </div>
          </div>

          {/* Total cost callout */}
          <div className="mt-5 flex items-center justify-between bg-rose-950/40 border border-rose-800/40 rounded-xl px-5 py-3">
            <div className="flex items-center gap-2">
              <XCircle size={16} className="text-rose-400" />
              <span className="text-sm font-semibold text-rose-300">Total Baseline Cost — No Action</span>
            </div>
            <span className="text-xl font-bold font-mono text-rose-400">{fmtUSDFull(baselineTotalCost)}</span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            SCENARIO 2 — NEXUSRECOVER PLAN
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-900/40 border border-slate-700/40 rounded-2xl p-6">
          <SectionHeader
            number="2"
            title="NexusRecover — Optimized Plan"
            subtitle="CP-SAT optimizer applied: strategic outbound delays + targeted diversions to alternate airports."
            color="green"
          />

          {/* Summary KPI cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <StatCard icon={TrendingUp}    label="Savings vs Baseline" value={fmtUSD(optimizeResult.savings_usd)} sub={`${savingsPct}% cost reduction`} color="green" />
            <StatCard icon={Shield}        label="PAX Protected"        value={optimizeResult.passengers_protected.toLocaleString()} sub="connections made"  color="green" />
            <StatCard icon={UserX}         label="PAX Remaining Stranded" value={optimizeResult.passengers_stranded.toLocaleString()} sub="unavoidable misses" color={optimizeResult.passengers_stranded > 0 ? 'red' : 'green'} />
            <StatCard icon={PlaneTakeoff}  label="Flights Diverted"     value={optimizeResult.flights_diverted}   sub={`${fmtUSD(optimizeResult.diversion_cost_usd)} transport`} color="violet" />
          </div>

          {/* Diversion decisions */}
          {diversionDecisions.length > 0 && (
            <>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Diversion Decisions</h3>
              <Table
                headers={[
                  'Flight', 'Route', 'Aircraft', 'PAX', 'Diverted To',
                  <span key="divcost" className="inline-flex items-center">
                    Divert Cost
                    <InfoTooltip>
                      Total cost per diverted flight includes two components:
                      <br/>• <strong className="text-amber-300">Ground transport</strong> from alternate airport back to YYZ for all passengers
                      <br/>• <strong className="text-amber-300">Hotel accommodation</strong> (${hubAirport.hotel_cost_usd}/pax) — passengers overnight at the alternate city before return
                      <br/><br/>Transport rates: YTZ $45/pax (20 min) · YHM $95/pax (75 min)
                    </InfoTooltip>
                  </span>,
                  'Reason',
                ]}
                rows={diversionWithHotel.map(d => {
                  const inb = inboundMap[d.flight_id]
                  const alt = scenario.alternate_airports.find(a => a.code === d.diverted_to)
                  return {
                    cells: [
                      { v: d.flight_id, cls: 'text-amber-400 font-bold' },
                      { v: `${inb.origin} → ${inb.destination}`, cls: 'text-slate-300 font-sans' },
                      { v: inb.aircraft_type, cls: 'text-slate-500' },
                      { v: inb.total_pax, cls: 'text-slate-300' },
                      { v: `${d.diverted_to} — ${alt?.name ?? ''}`, cls: 'text-violet-400 font-sans' },
                      {
                        v: <div>
                          <div className="text-amber-400 font-bold">{fmtUSDFull(d.totalDivertCost)}</div>
                          <div className="text-slate-500 text-[9px] font-normal">{fmtUSD(d.transportCost)} transport + {fmtUSD(d.hotelCost)} hotel</div>
                        </div>,
                        cls: '',
                      },
                      { v: 'YYZ capacity crunch', cls: 'text-slate-500 font-sans' },
                    ],
                  }
                })}
                footer={[
                  { v: `${diversionWithHotel.length} diversion${diversionWithHotel.length !== 1 ? 's' : ''}`, cls: 'text-slate-300 font-sans' },
                  { v: '' }, { v: '' },
                  { v: diversionWithHotel.reduce((a,d)=>a+inboundMap[d.flight_id].total_pax,0), cls: 'text-white' },
                  { v: '' },
                  { v: fmtUSDFull(totalDiversionCostTrue), cls: 'text-amber-400' },
                  { v: '' },
                ]}
              />
              <div className="mt-3 mb-6" />
            </>
          )}

          {/* Outbound delay decisions */}
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Outbound Delay Decisions</h3>
          <Table
            headers={[
              'Flight', 'Route', 'Aircraft', 'Scheduled', 'Delay Applied', 'New ETD',
              <span key="delaycost" className="inline-flex items-center">
                Delay Cost
                <InfoTooltip>
                  Operational cost of holding the aircraft at the gate, charged per minute by aircraft type:
                  <br/>• <strong className="text-white">B777</strong> $145/min
                  <br/>• <strong className="text-white">B737</strong> $82/min
                  <br/>• <strong className="text-white">A320</strong> $78/min
                  <br/>• <strong className="text-white">Dash-8</strong> $38/min
                  <br/><br/>Includes crew overtime, gate fees, and fuel burn during hold.
                </InfoTooltip>
              </span>,
            ]}
            rows={optimizeResult.flight_decisions.map(fd => {
              const out = outboundMap[fd.flight_id]
              const stdClock = (() => {
                const [h,m] = scenario.sim_start_clock.split(':').map(Number)
                const total = h*60+m+out.std_min
                return `${String(Math.floor(total/60)%24).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`
              })()
              return {
                cells: [
                  { v: fd.flight_id, cls: 'text-slate-200 font-bold' },
                  { v: `${out.origin} → ${out.destination}`, cls: 'text-slate-300 font-sans' },
                  { v: out.aircraft_type, cls: 'text-slate-500' },
                  { v: stdClock, cls: 'text-slate-400' },
                  {
                    v: fd.cancelled ? 'CANCELLED' : fd.delay_applied_min === 0 ? 'ON TIME' : `+${fd.delay_applied_min} min`,
                    cls: fd.cancelled ? 'text-rose-400 font-bold' : fd.delay_applied_min > 0 ? 'text-amber-400' : 'text-emerald-400',
                  },
                  { v: fd.etd_final_clock, cls: fd.delay_applied_min > 0 ? 'text-amber-400/80' : 'text-slate-400' },
                  {
                    v: fd.delay_applied_min > 0 ? fmtUSDFull(fd.cost_delay_usd) : '—',
                    cls: fd.delay_applied_min > 0 ? 'text-amber-400' : 'text-slate-600',
                  },
                ],
              }
            })}
            footer={[
              { v: `${optimizeResult.flight_decisions.length} outbound flights`, cls: 'text-slate-300 font-sans' },
              { v: '' }, { v: '' }, { v: '' },
              { v: `${optimizeResult.total_delay_minutes} min total`, cls: 'text-amber-400' },
              { v: '' },
              { v: fmtUSDFull(totalDelayCost), cls: 'text-amber-400' },
            ]}
          />

          {/* PAX outcomes */}
          <div className="mt-6">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Passenger Connection Outcomes</h3>
            <Table
              headers={['Inbound → Outbound', 'PAX', 'Tier', 'Outcome', 'Cost']}
              rows={optimizeResult.pax_results.map(r => ({
                cells: [
                  { v: `${r.inbound_flight_id} → ${r.outbound_flight_id}`, cls: 'text-slate-200 font-sans' },
                  { v: r.count, cls: 'text-slate-300' },
                  { v: r.tier, cls: r.tier === 'business' ? 'text-violet-400 uppercase text-[10px]' : 'text-slate-400 uppercase text-[10px]' },
                  {
                    v: r.connection_made ? '✓ Protected' : '✗ Stranded',
                    cls: r.connection_made ? 'text-emerald-400' : 'text-rose-400',
                  },
                  {
                    v: r.connection_made ? '—' : fmtUSDFull(r.cost_stranded_usd),
                    cls: r.connection_made ? 'text-slate-600' : 'text-rose-400',
                  },
                ],
              }))}
              footer={[
                { v: `${optimizeResult.pax_results.length} groups`, cls: 'text-slate-300 font-sans' },
                { v: optimizeResult.passengers_protected + optimizeResult.passengers_stranded, cls: 'text-white' },
                { v: '' },
                {
                  v: `${optimizeResult.passengers_protected} protected · ${optimizeResult.passengers_stranded} stranded`,
                  cls: 'text-slate-300 font-sans',
                },
                { v: fmtUSDFull(strandedCostOpt), cls: 'text-rose-400' },
              ]}
            />
          </div>

          {/* Cost breakdown summary */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 px-4 py-3 text-xs space-y-1.5">
              <p className="text-slate-400 font-semibold uppercase tracking-wider mb-2">Cost Breakdown</p>
              <div className="flex justify-between"><span className="text-slate-500">Delay costs</span><span className="text-amber-400 font-mono">{fmtUSDFull(totalDelayCost)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Divert cost (transport + hotel)</span><span className="text-violet-400 font-mono">{fmtUSDFull(totalDiversionCostTrue)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Remaining stranded</span><span className="text-rose-400 font-mono">{fmtUSDFull(strandedCostOpt)}</span></div>
              <div className="border-t border-slate-700 pt-1.5 flex justify-between font-bold">
                <span className="text-slate-300">Total</span>
                <span className="text-white font-mono">{fmtUSDFull(optimizeResult.optimized_cost_usd)}</span>
              </div>
            </div>

            <div className="bg-slate-800/40 rounded-xl border border-slate-700/30 px-4 py-3 text-xs space-y-1.5">
              <p className="text-slate-400 font-semibold uppercase tracking-wider mb-2">Alternate Airports Used</p>
              {scenario.alternate_airports.map(alt => {
                const used = optimizeResult.inbound_decisions.filter(d => d.diverted_to === alt.code).length
                const cost = optimizeResult.inbound_decisions
                  .filter(d => d.diverted_to === alt.code)
                  .reduce((a, d) => a + d.diversion_cost_usd, 0)
                return (
                  <div key={alt.code} className="flex justify-between">
                    <span className={used > 0 ? 'text-violet-400' : 'text-slate-600'}>
                      {alt.code} — {alt.name.split(' ')[0]} {alt.name.split(' ')[1]}
                    </span>
                    <span className={`font-mono ${used > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                      {used > 0 ? `${used} flt · ${fmtUSD(cost)}` : 'not used'}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="bg-emerald-950/40 rounded-xl border border-emerald-700/30 px-4 py-3 text-xs space-y-1.5">
              <p className="text-emerald-400/70 font-semibold uppercase tracking-wider mb-2">Savings Summary</p>
              <div className="flex justify-between"><span className="text-slate-500">Baseline (no action)</span><span className="text-rose-400 font-mono">{fmtUSDFull(optimizeResult.baseline_cost_usd)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Optimized cost</span><span className="text-slate-200 font-mono">{fmtUSDFull(optimizeResult.optimized_cost_usd)}</span></div>
              <div className="border-t border-emerald-800/40 pt-1.5 flex justify-between font-bold">
                <span className="text-emerald-400">Net Savings</span>
                <span className="text-emerald-400 font-mono">{fmtUSDFull(optimizeResult.savings_usd)} ({savingsPct}%)</span>
              </div>
            </div>
          </div>

          {/* Final callout */}
          <div className="mt-5 flex items-center justify-between bg-emerald-950/40 border border-emerald-800/40 rounded-xl px-5 py-3">
            <div className="flex items-center gap-2">
              <TrendingDown size={16} className="text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">Total Optimized Cost — NexusRecover Plan</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-emerald-600 line-through font-mono">{fmtUSDFull(optimizeResult.baseline_cost_usd)}</span>
              <span className="text-xl font-bold font-mono text-emerald-400">{fmtUSDFull(optimizeResult.optimized_cost_usd)}</span>
            </div>
          </div>
        </div>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  )
}
