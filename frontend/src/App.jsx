import { useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import SankeyDiagram from './components/SankeyDiagram'
import { InboundPanel, OutboundPanel } from './components/FlightPanel'
import KPIBar from './components/KPIBar'
import AirportStatusBar from './components/AirportStatusBar'
import Timeline from './components/Timeline'
import CopilotChat from './components/CopilotChat'
import ReportPage from './components/ReportPage'
import { CloudSnow, FileText, AlertTriangle, ShieldCheck, GitCompare, ChevronUp, ChevronDown, BarChart2, Users, Radio, Hotel, CheckCircle2, Loader2, Map } from 'lucide-react'
import SimClock from './components/SimClock'
import CompareView from './components/CompareView'
import WaterfallChart from './components/WaterfallChart'
import PassengerJourneyCards from './components/PassengerJourneyCards'
import GeoMap from './components/GeoMap'
import IntroSequence from './components/IntroSequence'
import GuidedTour from './components/GuidedTour'

function NotifyButton({ label, icon, status, onClick, colorClass, sentClass, gifSrc, gifTitle }) {
  const isSending = status === 'sending'
  const isSent    = status === 'sent'
  const isError   = status === 'error'
  const [showGif, setShowGif] = useState(false)
  const [gifVisible, setGifVisible] = useState(false)

  useEffect(() => {
    if (isSent) {
      const showTimer = setTimeout(() => {
        setShowGif(true)
        setGifVisible(true)
      }, 2000)
      return () => clearTimeout(showTimer)
    } else {
      setShowGif(false)
      setGifVisible(false)
    }
  }, [isSent])

  useEffect(() => {
    if (showGif) {
      const hideTimer = setTimeout(() => {
        setGifVisible(false)
        setTimeout(() => setShowGif(false), 500)
      }, 7000)
      return () => clearTimeout(hideTimer)
    }
  }, [showGif])

  const base = 'flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all duration-200'

  return (
    <div className="relative">
      {isSent ? (
        <div className={`${base} ${sentClass}`}>
          <CheckCircle2 size={13} />
          Sent ✓
        </div>
      ) : isError ? (
        <div className={`${base} bg-red-900/40 border-red-500/60 text-red-300`}>
          <AlertTriangle size={13} />
          Failed
        </div>
      ) : (
        <button
          onClick={onClick}
          disabled={isSending}
          className={`${base} ${colorClass} disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {isSending ? <Loader2 size={13} className="animate-spin" /> : icon}
          {isSending ? 'Sending…' : label}
        </button>
      )}

      {showGif && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ${
            gifVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => { setGifVisible(false); setTimeout(() => setShowGif(false), 500) }}
        >
          <div
            className={`bg-slate-900/95 border border-slate-600/60 rounded-2xl p-5 shadow-2xl shadow-black/50 backdrop-blur-md transition-all duration-500 ${
              gifVisible ? 'scale-100' : 'scale-90'
            }`}
            style={{ maxWidth: '50vw', maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-sm text-slate-300 text-center mb-3 font-semibold uppercase tracking-wider">
              {gifTitle}
            </p>
            <img
              src={gifSrc}
              alt={label}
              className="rounded-xl w-full h-auto"
              style={{ maxWidth: '48vw', maxHeight: '70vh', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const {
    introComplete, completeIntro,
    fetchScenario, timelineStep, scenario, optimizeResult,
    showReport, setShowReport, compareMode, toggleCompareMode,
    journeyPanelOpen, toggleJourneyPanel,
    notifyAuthorities, notifyHospitality,
    notifyAuthStatus, notifyHospStatus,
  } = useStore()

  const [showWaterfall, setShowWaterfall] = useState(false)
  const [showMap, setShowMap] = useState(false)

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
          <div className="relative group hidden md:block">
            <img src="/image.png" alt="" className="h-5 w-auto opacity-80" />
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <img src="/tebas.png" alt="" className="max-h-[60vh] max-w-[60vw] w-auto drop-shadow-2xl rounded-xl" />
            </div>
          </div>
          <span className="text-xs text-slate-500 hidden md:block">IRROPS Decision Support System</span>
        </div>

        <div className="flex items-center gap-3" data-tour="tour-status-badge">
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

          <div className="flex items-center gap-3" data-tour="tour-actions">
            {timelineStep === 3 && optimizeResult && (
              <NotifyButton
                label="Notify Authorities"
                icon={<Radio size={13} />}
                status={notifyAuthStatus}
                onClick={notifyAuthorities}
                colorClass="bg-red-900/20 hover:bg-red-900/40 border-red-700/40 text-red-300"
                sentClass="bg-red-900/40 border-red-600/60 text-red-200"
                gifSrc="/IRROPS ALERT.gif"
                gifTitle="Webhook N8N → IRROPS Notification Sent"
              />
            )}

            {timelineStep === 3 && optimizeResult && (
              <NotifyButton
                label="Notify Hospitality"
                icon={<Hotel size={13} />}
                status={notifyHospStatus}
                onClick={notifyHospitality}
                colorClass="bg-amber-900/20 hover:bg-amber-900/40 border-amber-700/40 text-amber-300"
                sentClass="bg-amber-900/40 border-amber-600/60 text-amber-200"
                gifSrc="/HOSPITALITY Alert.gif"
                gifTitle="Webhook N8N → Hospitality Notification Sent"
              />
            )}

            {timelineStep >= 2 && (
              <button
                onClick={toggleJourneyPanel}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-colors ${
                  journeyPanelOpen
                    ? 'bg-blue-700/40 border-blue-500/60 text-blue-200'
                    : 'bg-slate-700/30 hover:bg-slate-700/50 border-slate-600/40 text-slate-300'
                }`}
              >
                <Users size={13} />
                Passengers
              </button>
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
          </div>

          <button
            onClick={() => setShowMap(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700/20 hover:bg-indigo-700/40 border border-indigo-600/40 rounded-lg text-xs font-semibold text-indigo-300 transition-colors"
          >
            <Map size={13} />
            Geo Map
          </button>

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
            <section className="flex-1 overflow-hidden bg-slate-950/40 flex flex-col min-h-0" data-tour="tour-sankey">
              <div className="flex-1 relative overflow-hidden min-h-0">
                <SankeyDiagram />
              </div>

              {timelineStep === 3 && optimizeResult && (
                <>
                  {/* Collapsed tab — always visible in step 3 */}
                  <button
                    onClick={() => setShowWaterfall(v => !v)}
                    className="flex items-center justify-between w-full px-4 py-1.5 border-t border-slate-700/40 bg-slate-900/70 hover:bg-slate-800/70 transition-colors shrink-0 group"
                  >
                    <div className="flex items-center gap-2">
                      <BarChart2 size={11} className="text-green-400" />
                      <span className="text-[11px] font-semibold text-slate-300">Cost Breakdown</span>
                      <span className="text-[11px] text-slate-500">— optimizer saved</span>
                      <span className="text-[11px] font-bold text-green-400 font-mono">
                        ${optimizeResult.savings_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    {showWaterfall
                      ? <ChevronDown size={12} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
                      : <ChevronUp size={12} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
                    }
                  </button>

                  {/* Expanded chart panel */}
                  {showWaterfall && (
                    <div className="h-52 shrink-0 overflow-hidden border-t border-slate-700/30">
                      <WaterfallChart />
                    </div>
                  )}
                </>
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

      {/* ── Geo Map (full-screen overlay) ───────────────────────────────── */}
      {showMap && <GeoMap onClose={() => setShowMap(false)} />}

      {/* ── Report page (full-screen overlay) ──────────────────────────── */}
      {showReport && <ReportPage />}

      {/* ── Passenger Journey Cards (slide-in panel) ─────────────────────── */}
      <PassengerJourneyCards />

      {/* ── Guided tour ─────────────────────────────────────────────────────── */}
      <GuidedTour />

      {/* ── Intro sequence (overlay) ──────────────────────────────────────── */}
      {!introComplete && <IntroSequence onComplete={completeIntro} />}
    </div>
  )
}
