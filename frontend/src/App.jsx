import { useEffect } from 'react'
import { useStore } from './store/useStore'
import SankeyDiagram from './components/SankeyDiagram'
import { InboundPanel, OutboundPanel } from './components/FlightPanel'
import KPIBar from './components/KPIBar'
import AirportStatusBar from './components/AirportStatusBar'
import Timeline from './components/Timeline'
import CopilotChat from './components/CopilotChat'
import ReportPage from './components/ReportPage'
import { CloudSnow, FileText, AlertTriangle, ShieldCheck, GitCompare } from 'lucide-react'
import SimClock from './components/SimClock'
import CompareView from './components/CompareView'
import WaterfallChart from './components/WaterfallChart'

export default function App() {
  const {
    fetchScenario, timelineStep, scenario, optimizeResult,
    showReport, setShowReport, compareMode, toggleCompareMode,
  } = useStore()

  useEffect(() => {
    fetchScenario()
  }, [])

  return (
    <div className="flex flex-col h-screen bg-[#0a0e1a] text-slate-100 overflow-hidden">

      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <header className={`flex items-center justify-between px-5 h-12 border-b border-slate-700/50 shrink-0 transition-colors duration-500 ${
        timelineStep === 2 ? 'bg-red-950/50' : 'bg-slate-900/90'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-xs font-bold text-white">N</span>
          </div>
          <span className="text-sm font-bold tracking-wide text-white">NexusRecover</span>
          <span className="text-xs text-slate-500 hidden md:block">IRROPS Decision Support System</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Dynamic status badge */}
          {timelineStep === 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-900/20 border border-green-700/30 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
              <span className="text-xs text-green-400 font-medium">NORMAL OPS</span>
            </div>
          )}
          {timelineStep === 1 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-900/30 border border-amber-500/30 rounded-full animate-pulse">
              <CloudSnow size={12} className="text-amber-400" />
              <span className="text-xs text-amber-300 font-medium">GDP ACTIVE</span>
            </div>
          )}
          {timelineStep === 2 && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 bg-red-900/40 border border-red-500/40 rounded-full"
              style={{ animation: 'pulse 0.9s cubic-bezier(0.4,0,0.6,1) infinite' }}
            >
              <AlertTriangle size={12} className="text-red-400" />
              <span className="text-xs text-red-300 font-medium">CRITICAL</span>
            </div>
          )}
          {timelineStep === 3 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-900/30 border border-emerald-600/40 rounded-full">
              <ShieldCheck size={12} className="text-emerald-400" />
              <span className="text-xs text-emerald-300 font-medium">PLAN ACTIVE</span>
            </div>
          )}

          {timelineStep === 3 && optimizeResult && !compareMode && (
            <button
              onClick={toggleCompareMode}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700/20 hover:bg-blue-700/40 border border-blue-600/40 rounded-lg text-xs font-semibold text-blue-300 transition-colors"
            >
              <GitCompare size={13} />
              Compare
            </button>
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

          <SimClock />
        </div>
      </header>

      {/* ── KPI bar ────────────────────────────────────────────────────── */}
      <KPIBar />

      {/* ── Airport status bar ─────────────────────────────────────────── */}
      <AirportStatusBar />

      {/* ── Main content ───────────────────────────────────────────────── */}
      <main className="flex flex-1 overflow-hidden gap-0 min-h-0">
        {compareMode ? (
          <CompareView />
        ) : (
          <>
            {/* Left panel — Arrivals */}
            <aside className="w-56 shrink-0 border-r border-slate-700/40 bg-slate-900/50 px-3 py-3 overflow-hidden flex flex-col">
              <InboundPanel />
            </aside>

            {/* Center — Sankey + Waterfall */}
            <section className="flex-1 overflow-hidden bg-slate-950/40 flex flex-col min-h-0">
              <div className="flex-1 relative overflow-hidden min-h-0">
                <SankeyDiagram />
              </div>
              {timelineStep === 3 && optimizeResult && (
                <div className="h-52 border-t border-slate-700/40 shrink-0 overflow-hidden">
                  <WaterfallChart />
                </div>
              )}
            </section>

            {/* Right panel — Departures */}
            <aside className="w-56 shrink-0 border-l border-slate-700/40 bg-slate-900/50 px-3 py-3 overflow-hidden flex flex-col">
              <OutboundPanel />
            </aside>
          </>
        )}
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
