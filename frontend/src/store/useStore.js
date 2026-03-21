import { create } from 'zustand'
import { buildAuthoritiesPayload, buildHospitalityPayload } from '../lib/notify'

// ── Webhook URLs — replace with your N8N webhook URLs ──────────────────────
const WEBHOOK_AUTHORITIES = import.meta.env.VITE_WEBHOOK_AUTHORITIES ?? ''
const WEBHOOK_HOSPITALITY = import.meta.env.VITE_WEBHOOK_HOSPITALITY ?? ''

/**
 * Timeline states:
 *  0 = Normal operations
 *  1 = Storm injected (delays visible, no optimization)
 *  2 = Chaos (connections at risk highlighted)
 *  3 = Nexus plan applied (optimized result)
 */

export const TIMELINE_STATES = [
  { id: 0, label: 'Normal Ops',    description: 'All flights on schedule' },
  { id: 1, label: 'Storm Hits',    description: 'YYZ snowstorm — runway capacity drops 40%' },
  { id: 2, label: 'Chaos',         description: 'Cascading delays — 312 PAX connections at risk' },
  { id: 3, label: 'Nexus Plan',    description: 'Optimizer applied — strategic delays calculated' },
]

export const useStore = create((set, get) => ({
  // ── Data ──────────────────────────────────────────────────────────────────
  scenario: null,
  optimizeResult: null,

  // ── UI state ──────────────────────────────────────────────────────────────
  timelineStep: 0,
  isOptimizing: false,
  selectedFlightId: null,   // highlight a flight across Sankey + panels
  chatOpen: false,
  showReport: false,
  compareMode: false,
  baselineResult: null,
  journeyPanelOpen: false,
  selectedGroupId: null,
  journeySort: 'business',  // 'business' | 'risk' | 'cost'
  journeyFilter: 'all',     // 'all' | 'connected' | 'stranded'

  // ── Notification state ────────────────────────────────────────────────────
  notifyAuthStatus: null,   // null | 'sending' | 'sent' | 'error'
  notifyHospStatus: null,   // null | 'sending' | 'sent' | 'error'

  // ── Chat messages ─────────────────────────────────────────────────────────
  chatMessages: [],
  chatLoading: false,

  // ── Actions ───────────────────────────────────────────────────────────────
  setScenario: (scenario) => set({ scenario }),
  setOptimizeResult: (result) => set({ optimizeResult: result }),
  setTimelineStep: (step) => set({ timelineStep: step }),
  setSelectedFlight: (id) => set({ selectedFlightId: id }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setShowReport: (v) => set({ showReport: v }),
  toggleCompareMode: () => set((s) => ({ compareMode: !s.compareMode })),
  toggleJourneyPanel: () => set((s) => ({ journeyPanelOpen: !s.journeyPanelOpen })),
  openJourneyPanel: (groupId) => set({ journeyPanelOpen: true, selectedGroupId: groupId ?? null }),
  setSelectedGroup: (id) => set({ selectedGroupId: id }),
  setJourneySort: (v) => set({ journeySort: v }),
  setJourneyFilter: (v) => set({ journeyFilter: v }),

  notifyAuthorities: async () => {
    const { scenario, optimizeResult } = get()
    if (!scenario || !optimizeResult) return
    set({ notifyAuthStatus: 'sending' })
    try {
      const payload = buildAuthoritiesPayload(scenario, optimizeResult)
      await fetch(WEBHOOK_AUTHORITIES, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      set({ notifyAuthStatus: 'sent' })
      setTimeout(() => set({ notifyAuthStatus: null }), 4000)
    } catch (e) {
      set({ notifyAuthStatus: 'error' })
      setTimeout(() => set({ notifyAuthStatus: null }), 4000)
    }
  },

  notifyHospitality: async () => {
    const { scenario, optimizeResult } = get()
    if (!scenario || !optimizeResult) return
    set({ notifyHospStatus: 'sending' })
    try {
      const payload = buildHospitalityPayload(scenario, optimizeResult)
      await fetch(WEBHOOK_HOSPITALITY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      set({ notifyHospStatus: 'sent' })
      setTimeout(() => set({ notifyHospStatus: null }), 4000)
    } catch (e) {
      set({ notifyHospStatus: 'error' })
      setTimeout(() => set({ notifyHospStatus: null }), 4000)
    }
  },

  fetchScenario: async () => {
    const [scenRes, baseRes] = await Promise.all([
      fetch('/api/scenario'),
      fetch('/api/baseline'),
    ])
    const [scenario, baselineResult] = await Promise.all([scenRes.json(), baseRes.json()])
    set({ scenario, baselineResult })
  },

  runOptimizer: async () => {
    set({ isOptimizing: true })
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id: 'yyz_snowstorm' }),
      })
      const data = await res.json()
      set({ optimizeResult: data, timelineStep: 3, isOptimizing: false })
    } catch (e) {
      set({ isOptimizing: false })
    }
  },

  sendChat: async (userMessage) => {
    const { chatMessages, scenario, optimizeResult } = get()
    const newMessages = [...chatMessages, { role: 'user', content: userMessage }]
    set({ chatMessages: newMessages, chatLoading: true })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          scenario,
          optimize_result: optimizeResult,
        }),
      })
      const data = await res.json()
      set({
        chatMessages: [...newMessages, { role: 'assistant', content: data.reply }],
        chatLoading: false,
      })
    } catch (e) {
      set({ chatLoading: false })
    }
  },

  sendBriefing: async () => {
    const { scenario } = get()
    if (!scenario) return
    const prompt = `Give me a flash briefing of the current disruption at ${scenario.hub}. What flights are affected, how many connecting passengers are at risk, and what are the highest-priority flights to address?`
    get().sendChat(prompt)
    set({ chatOpen: true })
  },

  sendWhatIf: async () => {
    const { optimizeResult } = get()
    if (!optimizeResult) return
    const prompt = `Compare the optimized plan vs. doing nothing (baseline). What would have happened without NexusRecover? Explain the key differences in terms of passenger impact and financial savings.`
    get().sendChat(prompt)
    set({ chatOpen: true })
  },
}))
