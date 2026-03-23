import { useStore, TIMELINE_STATES } from '../store/useStore'
import { Zap, Loader } from 'lucide-react'

export default function Timeline() {
  const { timelineStep, setTimelineStep, runOptimizer, isOptimizing, optimizeResult } = useStore()

  const handleStep = (step) => {
    if (step === 3) {
      if (!optimizeResult) {
        runOptimizer()
      } else {
        setTimelineStep(3)
      }
    } else {
      setTimelineStep(step)
    }
  }

  return (
    <div className="flex items-center justify-center gap-0 h-full px-4" data-tour="tour-timeline">
      {TIMELINE_STATES.map((state, i) => {
        const isActive = timelineStep === state.id
        const isPast = timelineStep > state.id
        const isOptimizeStep = state.id === 3

        return (
          <div key={state.id} className="flex items-center">
            {/* Connector line */}
            {i > 0 && (
              <div className={`w-8 h-px transition-colors ${isPast || isActive ? 'bg-blue-500' : 'bg-slate-700'}`} />
            )}

            <button
              onClick={() => handleStep(state.id)}
              disabled={isOptimizing && state.id === 3}
              className={`
                relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg
                transition-all text-left group
                ${isActive
                  ? isOptimizeStep
                    ? 'bg-green-900/40 border border-green-500/60 text-green-300'
                    : 'bg-blue-900/40 border border-blue-500/60 text-blue-300'
                  : 'hover:bg-slate-800/60 border border-transparent text-slate-500 hover:text-slate-300'
                }
                ${isOptimizing && state.id === 3 ? 'cursor-wait' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-center gap-1.5">
                {isOptimizing && state.id === 3 ? (
                  <Loader size={10} className="animate-spin text-green-400" />
                ) : isOptimizeStep ? (
                  <Zap size={10} className={isActive ? 'text-green-400' : 'text-slate-600'} />
                ) : (
                  <div className={`w-2 h-2 rounded-full border transition-colors ${
                    isActive ? 'bg-blue-400 border-blue-400' :
                    isPast  ? 'bg-blue-600 border-blue-600' :
                              'bg-transparent border-slate-600'
                  }`} />
                )}
                <span className="text-xs font-semibold whitespace-nowrap">
                  {isOptimizing && state.id === 3 ? 'Optimizing...' : state.label}
                </span>
              </div>
              <span className={`text-xs whitespace-nowrap transition-opacity ${
                isActive ? 'opacity-70' : 'opacity-0 group-hover:opacity-50'
              }`}>
                {state.description}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
