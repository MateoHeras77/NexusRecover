import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

// Simulation times for each step (minutes from midnight)
const STEP_TIMES = {
  0: 7 * 60 + 30,   // 07:30 — Normal Ops
  1: 8 * 60 + 15,   // 08:15 — Storm Hits
  2: 9 * 60 + 45,   // 09:45 — Chaos
  3: 10 * 60 + 2,   // 10:02 — Nexus Plan
}

const GDP_START = STEP_TIMES[1]

function fmtTime(totalMin) {
  const h = Math.floor(totalMin / 60) % 24
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function SimClock() {
  const { timelineStep } = useStore()
  const displayRef = useRef(STEP_TIMES[0])
  const [, bump] = useState(0)
  const [rolling, setRolling] = useState(false)
  const rafRef = useRef(null)
  const tickRef = useRef(null)

  useEffect(() => {
    const target = STEP_TIMES[timelineStep]
    cancelAnimationFrame(rafRef.current)
    clearInterval(tickRef.current)
    setRolling(true)

    const from = displayRef.current
    const t0 = Date.now()
    const DURATION = 800

    function frame() {
      const p = Math.min((Date.now() - t0) / DURATION, 1)
      const eased = 1 - (1 - p) ** 3
      displayRef.current = Math.round(from + (target - from) * eased)
      bump(n => n + 1)

      if (p < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        displayRef.current = target
        setRolling(false)
        // Idle tick: +1 sim-minute every 4 real seconds
        tickRef.current = setInterval(() => {
          displayRef.current += 1
          bump(n => n + 1)
        }, 4000)
      }
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(rafRef.current)
      clearInterval(tickRef.current)
    }
  }, [timelineStep])

  const min = displayRef.current
  const elapsed = min - GDP_START

  // Sub-label under the clock
  let sub
  if (timelineStep === 0) {
    sub = 'SIM · YYZ OCC'
  } else if (timelineStep === 3) {
    sub = '✓ recovery in <1 min'
  } else {
    const h = Math.floor(elapsed / 60)
    const m = elapsed % 60
    sub = h > 0 ? `T+${h}h ${m}m disruption` : `T+${m}m disruption`
  }

  const timeColor = [
    'text-slate-200',   // 0 — normal
    'text-amber-300',   // 1 — storm
    'text-red-400',     // 2 — critical
    'text-green-400',   // 3 — recovered
  ][timelineStep]

  const subColor = [
    'text-slate-500',
    'text-amber-500/80',
    'text-red-500/80',
    'text-green-500/80',
  ][timelineStep]

  return (
    <div className="flex flex-col items-end select-none">
      <span
        className={`font-mono font-bold text-xl leading-none tabular-nums transition-colors duration-300 ${timeColor}`}
        style={rolling ? { filter: 'blur(0.5px)' } : undefined}
      >
        {fmtTime(min)}
      </span>
      <span className={`text-[10px] font-mono mt-0.5 transition-colors duration-300 ${subColor}`}>
        {sub}
      </span>
    </div>
  )
}
