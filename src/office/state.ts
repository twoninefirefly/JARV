import { create } from 'zustand'
import type { WsTarget } from './workspaces'
import type { Message } from './comms'
import { USERS, type Decision, type User } from './team'
import type { PrintJob } from './Print'

// Demo persistence: the remembered login and today's decisions live in this
// browser. The real system keeps both on the server.
const KEY_USER = 'office.user'
const KEY_DECISIONS = 'office.decisions'
const KEY_SIGNATURE = 'office.signature'
const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const save = (key: string, value: unknown) => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked: works for this visit only.
  }
}
const today = new Date().toDateString()
const stored = load<{ day: string; list: Decision[] }>(KEY_DECISIONS, { day: today, list: [] })
const initialDecisions = stored.day === today ? stored.list : []

/** What the sheet shows and where the camera flies. */
export type View =
  | { kind: 'overview' }
  | { kind: 'brain' }
  /** Inside the brain: departments and agents as neurons. */
  | { kind: 'neural' }
  | { kind: 'dept'; id: string; agent?: string }

type OfficeState = {
  view: View
  /** Bumped on every selection so the camera re-flies even to the same place. */
  flight: number
  show: (view: View) => void
  /** The work window on top of everything, if one is open. */
  ws: WsTarget | null
  open: (target: WsTarget) => void
  close: () => void
  /** Decisions made today; they drop out of every waiting list. */
  approved: string[]
  /** Who decided what, and when — for management's overview. */
  decisions: Decision[]
  approve: (item: string, dept: string, result?: Decision['result'], signed?: boolean) => void
  /** Who is signed in; remembered on this computer if they asked for it. */
  user: User | null
  remembered: User | null
  signIn: (user: User, remember: boolean) => void
  signOut: () => void
  /** Management's overview, on top of everything. */
  cockpit: boolean
  showCockpit: (open: boolean) => void
  /** The setup plan, on top of everything. */
  setup: boolean
  showSetup: (open: boolean) => void
  /** Behind the lock screen until the password is entered. */
  locked: boolean
  unlock: () => void
  lock: () => void
  /** Agent-to-agent traffic, newest first. */
  feed: Message[]
  /** Messages whose packet is still travelling through the scene. */
  inFlight: Array<{ msg: Message; born: number }>
  post: (msg: Message, animate: boolean) => void
  /** An urgent message on screen, until dismissed or it times out. */
  alert: Message | null
  raise: (msg: Message | null) => void
  /** Letters sent to the office printer today. */
  prints: PrintJob[]
  addPrint: (job: PrintJob) => void
  /** The customer's saved signature for management (a PNG data URL). */
  signature: string | null
  setSignature: (png: string | null) => void
}

export const useOffice = create<OfficeState>((set) => ({
  view: { kind: 'overview' },
  flight: 0,
  show: (view) => set((s) => ({ view, flight: s.flight + 1 })),
  ws: null,
  open: (ws) => set({ ws }),
  close: () => set({ ws: null }),
  approved: initialDecisions.map((d) => d.text),
  decisions: initialDecisions,
  approve: (item, dept, result = 'Freigegeben', signed = false) =>
    set((s) => {
      if (s.approved.includes(item) || !s.user) return s
      const now = new Date()
      const at = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const decisions = [...s.decisions, { text: item, dept, by: s.user.id, name: s.user.name, at, result, signed }]
      save(KEY_DECISIONS, { day: today, list: decisions })
      return { approved: [...s.approved, item], decisions }
    }),
  user: null,
  remembered: USERS.find((x) => x.id === load<string | null>(KEY_USER, null)) ?? null,
  signIn: (user, remember) => {
    save(KEY_USER, remember ? user.id : null)
    set({ user, remembered: remember ? user : null })
  },
  signOut: () => {
    save(KEY_USER, null)
    set({ user: null, remembered: null, locked: true, ws: null, setup: false, cockpit: false, view: { kind: 'overview' } })
  },
  cockpit: false,
  showCockpit: (cockpit) => set({ cockpit, ws: null, setup: false }),
  setup: false,
  showSetup: (setup) => set({ setup, ws: null }),
  locked: true,
  unlock: () => set({ locked: false }),
  lock: () => set({ locked: true, ws: null, setup: false, cockpit: false, alert: null, view: { kind: 'overview' } }),
  prints: [],
  addPrint: (job) => set((s) => ({ prints: [...s.prints, job] })),
  alert: null,
  raise: (alert) => set({ alert }),
  signature: load<string | null>(KEY_SIGNATURE, null),
  setSignature: (signature) => {
    save(KEY_SIGNATURE, signature)
    set({ signature })
  },
  feed: [],
  inFlight: [],
  post: (msg, animate) =>
    set((s) => {
      const now = performance.now()
      return {
        feed: [msg, ...s.feed].slice(0, 40),
        inFlight: animate ? [...s.inFlight.filter((f) => now - f.born < 3000), { msg, born: now }] : s.inFlight,
      }
    }),
}))
