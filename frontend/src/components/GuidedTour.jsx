import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { ChevronRight, X, Sparkles, Clock, CloudSnow, AlertTriangle, Zap, BarChart3, Radio, Bot } from 'lucide-react'

/* ── Tour step definitions ───────────────────────────────────────────── */
const TOUR_STEPS = [
  {
    target: 'tour-timeline',
    title: 'Timeline Control',
    description: 'This is your timeline. Each step simulates the progression of a real disruption at YYZ. You can click any step to jump to it — or let us walk you through.',
    icon: Clock,
    iconColor: 'text-blue-400',
    position: 'top',
  },
  {
    target: 'tour-status-badge',
    title: 'Operations Status',
    description: 'The status badge reflects the current state of operations. Right now everything is green — all flights on schedule.',
    icon: Sparkles,
    iconColor: 'text-green-400',
    position: 'bottom',
  },
  {
    target: 'tour-airport-status',
    title: 'Storm Impact',
    description: 'A snowstorm hits YYZ! Runway capacity drops 40%. Watch the slot indicators turn red as available landing slots shrink.',
    icon: CloudSnow,
    iconColor: 'text-amber-400',
    position: 'bottom',
    onEnter: (store) => store.setTimelineStep(1),
  },
  {
    target: 'tour-sankey',
    title: 'Passenger Flow Diagram',
    description: 'The Sankey diagram shows how passengers flow from inbound flights to outbound connections. As delays cascade, watch connections shift and break.',
    icon: Sparkles,
    iconColor: 'text-blue-400',
    position: 'right',
  },
  {
    target: 'tour-status-badge',
    title: 'Escalation — Critical',
    description: 'The situation escalates — 312 passengers at risk of missing connections. The header turns red. Use the Passengers button to inspect each group.',
    icon: AlertTriangle,
    iconColor: 'text-red-400',
    position: 'bottom',
    onEnter: (store) => store.setTimelineStep(2),
  },
  {
    target: 'tour-kpi-bar',
    title: 'Optimizer Results',
    description: 'NexusRecover\'s constraint optimizer calculates the best recovery plan in seconds. The KPI bar lights up showing cost savings, passengers protected, and total delay.',
    icon: Zap,
    iconColor: 'text-emerald-400',
    position: 'bottom',
    onEnter: (store) => {
      if (!store.optimizeResult) {
        store.runOptimizer()
      } else {
        store.setTimelineStep(3)
      }
    },
  },
  {
    target: 'tour-actions',
    title: 'Take Action',
    description: 'From here you can notify authorities, alert hospitality partners, compare the plan against the baseline, or generate a detailed PDF report.',
    icon: Radio,
    iconColor: 'text-rose-400',
    position: 'bottom',
  },
  {
    target: 'tour-copilot',
    title: 'AI Copilot',
    description: 'Need deeper analysis? The AI Copilot can answer questions about the disruption, explain trade-offs, and run what-if scenarios. You\'re ready to explore!',
    icon: Bot,
    iconColor: 'text-blue-400',
    position: 'top',
  },
]

/* ── Spotlight overlay with cutout ───────────────────────────────────── */
function SpotlightOverlay({ rect }) {
  if (!rect) {
    return <div className="fixed inset-0 z-40 bg-black/60 transition-all duration-500" />
  }

  const pad = 8
  const x = rect.left - pad
  const y = rect.top - pad
  const w = rect.width + pad * 2
  const h = rect.height + pad * 2
  const r = 12

  // SVG overlay with a rounded-rect cutout
  return (
    <svg className="fixed inset-0 z-40 w-full h-full transition-all duration-500" style={{ pointerEvents: 'none' }}>
      <defs>
        <mask id="tour-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill="black" />
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#tour-mask)" />
      {/* Glow ring around cutout */}
      <rect
        x={x} y={y} width={w} height={h} rx={r} ry={r}
        fill="none" stroke="rgba(59,130,246,0.4)" strokeWidth="2"
      />
    </svg>
  )
}

/* ── Tooltip card ────────────────────────────────────────────────────── */
function TooltipCard({ step, stepIndex, totalSteps, rect, onNext, onSkip }) {
  const Icon = step.icon
  const isLast = stepIndex === totalSteps - 1

  // Position the tooltip relative to the spotlight target
  let style = {}
  if (rect) {
    const pad = 16
    const tooltipW = 360

    if (step.position === 'bottom') {
      style = {
        top: rect.bottom + pad,
        left: Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipW / 2, window.innerWidth - tooltipW - 16)),
      }
    } else if (step.position === 'top') {
      style = {
        bottom: window.innerHeight - rect.top + pad,
        left: Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipW / 2, window.innerWidth - tooltipW - 16)),
      }
    } else if (step.position === 'right') {
      style = {
        top: Math.max(16, rect.top + rect.height / 2 - 80),
        left: Math.min(rect.right + pad, window.innerWidth - tooltipW - 16),
      }
    } else {
      style = {
        top: Math.max(16, rect.top + rect.height / 2 - 80),
        right: window.innerWidth - rect.left + pad,
      }
    }
  } else {
    // Center if no target found
    style = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }

  return (
    <div
      className="fixed z-50 w-[360px] bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-2xl backdrop-blur-sm intro-fade-up"
      style={{ ...style, pointerEvents: 'auto' }}
    >
      <div className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-slate-800/80 ${step.iconColor}`}>
            <Icon size={18} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white">{step.title}</h3>
            <span className="text-[10px] text-slate-500 font-medium">
              Step {stepIndex + 1} of {totalSteps}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-[13px] text-slate-400 leading-relaxed">{step.description}</p>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onSkip}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Skip Tour
          </button>

          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === stepIndex ? 'w-4 h-1.5 bg-blue-500' :
                  i < stepIndex ? 'w-1.5 h-1.5 bg-blue-500/50' :
                  'w-1.5 h-1.5 bg-slate-600'
                }`}
              />
            ))}
          </div>

          <button
            onClick={onNext}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white transition-colors"
          >
            {isLast ? 'Start Exploring' : 'Next'}
            {!isLast && <ChevronRight size={12} />}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main GuidedTour component ───────────────────────────────────────── */
export default function GuidedTour() {
  const { tourActive, tourStep, skipTour } = useStore()
  const [targetRect, setTargetRect] = useState(null)

  const currentStep = TOUR_STEPS[tourStep]

  // Get target element rect
  const updateRect = useCallback(() => {
    if (!currentStep) return
    const el = document.querySelector(`[data-tour="${currentStep.target}"]`)
    if (el) {
      setTargetRect(el.getBoundingClientRect())
    } else {
      setTargetRect(null)
    }
  }, [currentStep])

  // Run onEnter when step changes, then measure after a short delay
  useEffect(() => {
    if (!tourActive || !currentStep) return
    if (currentStep.onEnter) {
      currentStep.onEnter(useStore.getState())
    }
    // Delay measurement to let DOM update after onEnter
    const timer = setTimeout(updateRect, 400)
    return () => clearTimeout(timer)
  }, [tourStep, tourActive, currentStep, updateRect])

  // Re-measure on resize
  useEffect(() => {
    if (!tourActive) return
    window.addEventListener('resize', updateRect)
    return () => window.removeEventListener('resize', updateRect)
  }, [tourActive, updateRect])

  const handleNext = useCallback(() => {
    if (tourStep >= TOUR_STEPS.length - 1) {
      skipTour()
    } else {
      useStore.setState({ tourStep: tourStep + 1 })
    }
  }, [tourStep, skipTour])

  // Keyboard: Escape to skip, Enter/Space/Arrow to advance
  useEffect(() => {
    if (!tourActive) return
    const handler = (e) => {
      if (e.key === 'Escape') skipTour()
      if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        handleNext()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tourActive, skipTour, handleNext])

  if (!tourActive || !currentStep) return null

  return (
    <>
      {/* Click-blocker behind tooltip (prevents clicking through overlay) */}
      <div className="fixed inset-0 z-40" style={{ pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()} />

      <SpotlightOverlay rect={targetRect} />

      <TooltipCard
        step={currentStep}
        stepIndex={tourStep}
        totalSteps={TOUR_STEPS.length}
        rect={targetRect}
        onNext={handleNext}
        onSkip={skipTour}
      />
    </>
  )
}
