import { useEffect } from 'react'
import { useStore } from './store/useStore'
import SankeyDiagram from './components/SankeyDiagram'
import { InboundPanel, OutboundPanel } from './components/FlightPanel'
import KPIBar from './components/KPIBar'
import AirportStatusBar from './components/AirportStatusBar'
import Timeline from './components/Timeline'
import CopilotChat from './components/CopilotChat'
import ReportPage from './components/ReportPage'
import { CloudSnow, FileText } from 'lucide-react'

export default function App() {
  const { fetchScenario, timelineStep, scenario, optimizeResult, showReport, setShowReport } = useStore()

  useEffect(() => {
    fetchScenario()
  }, [])

  return (
    <div className="flex flex-col h-screen bg-[#0a0e1a] text-slate-100 overflow-hidden">

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 h-12 border-b border-slate-700/50 bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-xs font-bold text-white">N</span>
          </div>
          <span className="text-sm font-bold tracking-wide text-white">NexusRecover</span>
          <span className="text-xs text-slate-500 hidden md:block">IRROPS Decision Support System</span>
        </div>

        <div className="flex items-center gap-3">
          {timelineStep >= 1 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-900/30 border border-red-500/30 rounded-full">
              <CloudSnow size={12} className="text-red-400" />
              <span className="text-xs text-red-300 font-medium">
                YYZ Snowstorm Active
              </span>
            </div>
          )}
          {timelineStep === 3 && optimizeResult && (
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700/30 hover:bg-emerald-700/50 border border-emerald-600/50 rounded-lg text-xs font-semibold text-emerald-300 transition-colors"
            >
              <FileText size={13} />
              Revisar Reporte
            </button>
          )}
          <div className="text-xs text-slate-500 font-mono">
            {scenario?.hub ?? '—'} · SIM {scenario?.sim_start_clock ?? '--:--'}
          </div>
        </div>
      </header>

      {/* ── KPI bar ────────────────────────────────────────────────────── */}
      <KPIBar />

      {/* ── Airport status bar ─────────────────────────────────────────── */}
      <AirportStatusBar />

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex flex-1 overflow-hidden gap-0 min-h-0">

        {/* Left panel — Arrivals */}
        <aside className="w-56 shrink-0 border-r border-slate-700/40 bg-slate-900/50 px-3 py-3 overflow-hidden flex flex-col">
          <InboundPanel />
        </aside>

        {/* Center — Sankey */}
        <section className="flex-1 relative overflow-hidden bg-slate-950/40">
          <SankeyDiagram />
        </section>

        {/* Right panel — Departures */}
        <aside className="w-56 shrink-0 border-l border-slate-700/40 bg-slate-900/50 px-3 py-3 overflow-hidden flex flex-col">
          <OutboundPanel />
        </aside>
      </main>

      {/* ── Timeline scrubber ──────────────────────────────────────────── */}
      <footer className="h-16 border-t border-slate-700/50 bg-slate-900/80 shrink-0">
        <Timeline />
      </footer>

      {/* ── Copilot chat ───────────────────────────────────────────────── */}
      <CopilotChat />

      {/* ── Report page (full-screen overlay) ──────────────────────────── */}
      {showReport && <ReportPage />}
    </div>
  )
}
