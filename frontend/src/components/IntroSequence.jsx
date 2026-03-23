import { useState, useEffect, useCallback } from 'react'
import { Plane, CloudSnow, AlertTriangle, ShieldCheck, SkipForward, Brain, BarChart3, Users, Radio, Map } from 'lucide-react'

/* ── Seeded pseudo-random (deterministic, lint-safe) ─────────────────── */
function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

/* ── Typewriter hook ─────────────────────────────────────────────────── */
function useTypewriter(text, speed = 40, active = true) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    if (!active) { setDisplayed(''); return }
    setDisplayed('')
    let i = 0
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, speed, active])
  return displayed
}

/* ── Animated counter hook ───────────────────────────────────────────── */
function useCounter(target, duration = 1400, active = true) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (!active) return
    const start = performance.now()
    let last = -1
    let raf
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      const next = Math.floor(progress * target)
      if (next !== last) { last = next; setValue(next) }
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); setValue(0) }
  }, [target, duration, active])
  return active ? value : 0
}

/* ── Pre-generated snowflake data ────────────────────────────────────── */
const SNOW_DATA_35 = (() => {
  const rand = seededRandom(42)
  return Array.from({ length: 45 }, (_, i) => ({
    id: i,
    left: rand() * 100,
    size: 6 + rand() * 10,
    duration: 4 + rand() * 4,
    delay: rand() * 3,
  }))
})()

/* ── Pre-generated plane positions ───────────────────────────────────── */
const PLANE_DATA = (() => {
  const rand = seededRandom(99)
  return Array.from({ length: 6 }, (_, i) => ({
    id: i,
    top: 15 + rand() * 70,
    left: rand() * 100,
    rotation: -30 + rand() * 60,
    delay: i * 0.7,
    size: 18 + rand() * 14,
  }))
})()

/* ── Radar SVG ───────────────────────────────────────────────────────── */
function RadarGrid({ color = '#3b82f6' }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(80vw,500px)] h-[min(80vw,500px)] opacity-20"
    >
      {/* Concentric rings */}
      {[60, 110, 160].map((r, i) => (
        <circle
          key={r}
          cx="200" cy="200" r={r}
          fill="none" stroke={color} strokeWidth="0.8"
          style={{ animation: `radar-pulse 3s ease-in-out ${i * 0.5}s infinite` }}
        />
      ))}
      {/* Crosshairs */}
      <line x1="200" y1="40" x2="200" y2="360" stroke={color} strokeWidth="0.4" opacity="0.3" />
      <line x1="40" y1="200" x2="360" y2="200" stroke={color} strokeWidth="0.4" opacity="0.3" />
      {/* Sweep line */}
      <line
        x1="200" y1="200" x2="200" y2="40"
        stroke={color} strokeWidth="1.5"
        style={{
          transformOrigin: '200px 200px',
          animation: 'radar-sweep 4s linear infinite',
          opacity: 0.6,
        }}
      />
      {/* Center dot */}
      <circle cx="200" cy="200" r="3" fill={color} opacity="0.8" />
    </svg>
  )
}

/* ── Snowflakes layer ────────────────────────────────────────────────── */
function SnowLayer({ count = 35, intensity = 1 }) {
  const flakes = SNOW_DATA_35.slice(0, count)
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {flakes.map((f) => (
        <svg
          key={f.id}
          viewBox="0 0 20 20"
          className="absolute intro-snowflake"
          style={{
            left: `${f.left}%`,
            width: f.size * intensity,
            height: f.size * intensity,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
          }}
        >
          {/* 6-point snowflake */}
          {[0, 60, 120].map((angle) => (
            <line
              key={angle}
              x1="10" y1="2" x2="10" y2="18"
              stroke="white" strokeWidth="1.2" strokeLinecap="round"
              transform={`rotate(${angle} 10 10)`}
            />
          ))}
        </svg>
      ))}
    </div>
  )
}

/* ── Floating planes ─────────────────────────────────────────────────── */
function FloatingPlanes({ chaos = false }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {PLANE_DATA.map((p) => (
        <div
          key={p.id}
          className="absolute intro-fade-up"
          style={{
            top: `${p.top}%`,
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        >
          <Plane
            size={p.size}
            className={chaos ? 'text-red-400/60' : 'text-blue-400/40'}
          />
        </div>
      ))}
    </div>
  )
}

/* ── Scene components ────────────────────────────────────────────────── */

function ScenePrologue({ active }) {
  const text = useTypewriter(
    'Imagine you are an airport operations controller in Toronto, Canada...',
    45,
    active,
  )

  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-1000 ${active ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <RadarGrid />

      {/* Drifting plane */}
      <div className="absolute top-[15%] intro-drift-plane">
        <Plane size={28} className="text-blue-400/50 -rotate-12" />
      </div>

      <div className="relative z-10 max-w-2xl px-8 text-center">
        <p className="text-2xl md:text-3xl lg:text-4xl font-light text-white leading-relaxed tracking-wide">
          {text}
          <span className="intro-caret" />
        </p>
      </div>
    </div>
  )
}

function SceneStorm({ active }) {
  const text = useTypewriter(
    'A massive winter storm is approaching YYZ...',
    45,
    active,
  )

  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-1000 ${active ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <RadarGrid color="#f59e0b" />
      {active && <SnowLayer count={30} intensity={0.9} />}

      {/* YYZ watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="text-[20vw] font-black text-white/[0.03] tracking-widest">YYZ</span>
      </div>

      <div className="relative z-10 max-w-2xl px-8 text-center space-y-4">
        <CloudSnow size={48} className="mx-auto text-amber-400 mb-4" strokeWidth={1.5} />
        <p className="text-2xl md:text-3xl lg:text-4xl font-light text-white leading-relaxed">
          {text}
          <span className="intro-caret" />
        </p>
        <p className="text-lg text-amber-300/80 intro-fade-up" style={{ animationDelay: '1.5s' }}>
          Toronto Pearson International Airport
        </p>
      </div>
    </div>
  )
}

function SceneChaos({ active }) {
  const flights = useCounter(14, 1200, active)
  const pax = useCounter(312, 1400, active)

  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-1000 ${active ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      style={active ? { animation: 'screen-shake 0.6s ease-in-out 3' } : undefined}
    >
      <RadarGrid color="#ef4444" />
      {active && <SnowLayer count={45} intensity={1.3} />}
      {active && <FloatingPlanes chaos />}

      <div className="relative z-10 max-w-3xl px-8 text-center space-y-8">
        {/* Counters */}
        <div className="flex items-center justify-center gap-8 md:gap-16">
          <div className="intro-fade-up" style={{ animationDelay: '0.3s' }}>
            <span className="block text-5xl md:text-7xl font-black text-red-400 font-mono intro-number-pop">{flights}</span>
            <span className="text-sm text-red-300/80 font-medium tracking-wider uppercase mt-1 block">flights delayed</span>
          </div>
          <div className="w-px h-16 bg-red-500/30" />
          <div className="intro-fade-up" style={{ animationDelay: '0.6s' }}>
            <span className="block text-5xl md:text-7xl font-black text-amber-400 font-mono intro-number-pop">{pax}</span>
            <span className="text-sm text-amber-300/80 font-medium tracking-wider uppercase mt-1 block">passengers stranded</span>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center justify-center gap-4 intro-fade-up" style={{ animationDelay: '1s' }}>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-900/30 border border-amber-500/30 rounded-full animate-pulse">
            <CloudSnow size={14} className="text-amber-400" />
            <span className="text-xs text-amber-300 font-semibold">GDP ACTIVE</span>
          </div>
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/40 border border-red-500/40 rounded-full"
            style={{ animation: 'pulse 0.9s cubic-bezier(0.4,0,0.6,1) infinite' }}
          >
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-xs text-red-300 font-semibold">CRITICAL</span>
          </div>
        </div>

        <p className="text-xl text-red-200/90 font-light intro-fade-up" style={{ animationDelay: '1.4s' }}>
          Connections breaking. What do you do?
        </p>
      </div>
    </div>
  )
}

const FEATURES = [
  { icon: Brain,    color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',    label: 'AI Optimizer',           desc: 'Constraint programming engine that calculates the optimal recovery plan in seconds' },
  { icon: Map,      color: 'text-indigo-400',  bg: 'bg-indigo-500/10 border-indigo-500/20',  label: '3D Flight Visualization', desc: 'Interactive geographic map with real-time flight arcs and airport status' },
  { icon: Users,    color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',   label: 'Passenger Tracking',     desc: 'Track every connecting passenger group — who makes it, who gets stranded' },
  { icon: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Cost Analysis',          desc: 'Waterfall charts comparing baseline chaos vs. optimized recovery savings' },
  { icon: Radio,    color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/20',    label: 'Instant Notifications',  desc: 'One-click alerts to authorities and hospitality via automated webhooks' },
]

function SceneHero({ active }) {
  const name = useTypewriter('NexusRecover', 70, active)

  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-1000 ${active ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      {/* Scan line */}
      {active && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
            style={{ animation: 'scan-line 2s ease-in-out 0.5s forwards' }}
          />
        </div>
      )}

      {/* Calming snowflakes */}
      {active && <SnowLayer count={12} intensity={0.5} />}

      <div className="relative z-10 text-center space-y-5 max-w-4xl px-6">
        {/* Logo + Name */}
        <div className="flex items-center justify-center gap-4 intro-fade-up">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 intro-scale-in">
            <span className="text-xl font-black text-white">N</span>
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight">
            {name}
            {name.length < 12 && <span className="intro-caret" />}
          </h1>
        </div>

        {/* Subtitle */}
        <div className="flex items-center justify-center gap-2 intro-fade-up" style={{ animationDelay: '0.6s' }}>
          <ShieldCheck size={16} className="text-emerald-400" />
          <span className="text-sm text-emerald-300 font-medium tracking-wider uppercase">
            IRROPS Decision Support System
          </span>
        </div>

        {/* Description */}
        <p className="text-base md:text-lg text-slate-400 font-light max-w-2xl mx-auto intro-fade-up" style={{ animationDelay: '0.9s' }}>
          When disruptions hit, NexusRecover analyzes every flight, every connection, and every
          passenger to find the recovery plan that minimizes cost and protects the most travelers.
        </p>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
          {FEATURES.map((feat, i) => (
            <div
              key={feat.label}
              className={`intro-fade-up flex flex-col items-center gap-2 px-3 py-4 rounded-xl border ${feat.bg} backdrop-blur-sm`}
              style={{ animationDelay: `${1.2 + i * 0.2}s` }}
            >
              <feat.icon size={22} className={feat.color} strokeWidth={1.8} />
              <span className="text-xs font-bold text-white tracking-wide">{feat.label}</span>
              <span className="text-[10px] text-slate-400 leading-tight text-center">{feat.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Main IntroSequence component ────────────────────────────────────── */
const SCENE_COUNT = 4
const SCENE_DURATIONS = [5000, 5000, 5000, 7000] // last scene gets more time for features

export default function IntroSequence({ onComplete }) {
  const [currentScene, setCurrentScene] = useState(0)
  const [fadingOut, setFadingOut] = useState(false)

  // Auto-advance scenes with per-scene duration
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentScene((prev) => {
        if (prev >= SCENE_COUNT - 1) {
          setFadingOut(true)
          setTimeout(onComplete, 1200)
          return prev
        }
        return prev + 1
      })
    }, SCENE_DURATIONS[currentScene] ?? 5000)
    return () => clearTimeout(timeout)
  }, [currentScene, onComplete])

  // Click to advance
  const handleAdvance = useCallback(() => {
    setCurrentScene((prev) => {
      if (prev >= SCENE_COUNT - 1) {
        setFadingOut(true)
        setTimeout(onComplete, 1200)
        return prev
      }
      return prev + 1
    })
  }, [onComplete])

  // Keyboard advance
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        onComplete()
        return
      }
      handleAdvance()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleAdvance, onComplete])

  // Skip
  const handleSkip = useCallback((e) => {
    e.stopPropagation()
    onComplete()
  }, [onComplete])

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#0a0e1a] cursor-pointer transition-opacity duration-1000 ${fadingOut ? 'opacity-0' : 'opacity-100'}`}
      onClick={handleAdvance}
    >
      {/* Skip button */}
      <button
        onClick={handleSkip}
        className="absolute top-6 right-6 z-20 flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-700/80 border border-slate-600/40 rounded-lg text-sm text-slate-300 hover:text-white transition-all duration-200 backdrop-blur-sm"
        aria-label="Skip intro"
      >
        <span className="hidden sm:inline">Skip Intro</span>
        <SkipForward size={16} />
      </button>

      {/* Progress dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        {Array.from({ length: SCENE_COUNT }, (_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setCurrentScene(i) }}
            className={`rounded-full transition-all duration-300 ${
              i === currentScene
                ? 'w-8 h-2 bg-blue-500'
                : i < currentScene
                  ? 'w-2 h-2 bg-blue-500/50'
                  : 'w-2 h-2 bg-slate-600'
            }`}
            aria-label={`Go to scene ${i + 1}`}
          />
        ))}
      </div>

      {/* Scenes */}
      <ScenePrologue active={currentScene === 0} />
      <SceneStorm active={currentScene === 1} />
      <SceneChaos active={currentScene === 2} />
      <SceneHero active={currentScene === 3} />
    </div>
  )
}
