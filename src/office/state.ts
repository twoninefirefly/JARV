import { create } from 'zustand'
import type { Handled, WsTarget } from './workspaces'
import type { Message } from './comms'
import { USERS, type Decision, type User } from './team'
import type { PrintJob } from './Print'
import { defaultTheme, type ThemeId } from './themes'

// Demo persistence: the remembered login and today's decisions live in this
// browser. The real system keeps both on the server.
const KEY_USER = 'office.user'
const KEY_DECISIONS = 'office.decisions'
const KEY_SIGNATURE = 'office.signatures'
const KEY_HANDLED = 'office.handled'
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
/** The colour someone chose last time on this computer, or their default. */
const themeFor = (userId: string | undefined): ThemeId => (userId ? load<ThemeId | null>(`office.theme.${userId}`, null) : null) ?? defaultTheme(userId)
const stored = load<{ day: string; list: Decision[] }>(KEY_DECISIONS, { day: today, list: [] })
const initialDecisions = stored.day === today ? stored.list : []
const storedHandled = load<{ day: string; map: Record<string, Handled> }>(KEY_HANDLED, { day: today, map: {} })

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
  /** Records dealt with today, by window and record — so a sent draft stays sent. */
  handled: Record<string, Handled>
  handle: (key: string, h: Handled) => void
  /** Who is signed in; remembered on this computer if they asked for it. */
  user: User | null
  remembered: User | null
  signIn: (user: User, remember: boolean) => void
  signOut: () => void
  /** The office's colour, per person, kept on this computer. */
  theme: ThemeId
  setTheme: (id: ThemeId) => void
  /** The colour picker, on top of everything. */
  palette: boolean
  showPalette: (open: boolean) => void
  /** Secret Garden: lawn and roses under the office. */
  garden: boolean
  setGarden: (on: boolean) => void
  /** The search, on top of everything. */
  search: boolean
  showSearch: (open: boolean) => void
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
  /** Management's saved signatures, one per person (PNG data URLs). */
  signatures: Record<string, string>
  setSignature: (userId: string, png: string | null) => void
  /** Bumped to send the children and the dog running through the office. */
  romp: number
  startRomp: () => void
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
  handled: storedHandled.day === today ? storedHandled.map : {},
  handle: (key, h) =>
    set((s) => {
      const handled = { ...s.handled, [key]: h }
      save(KEY_HANDLED, { day: today, map: handled })
      return { handled }
    }),
  user: null,
  remembered: USERS.find((x) => x.id === load<string | null>(KEY_USER, null)) ?? null,
  signIn: (user, remember) => {
    save(KEY_USER, remember ? user.id : null)
    set({ user, remembered: remember ? user : null, theme: themeFor(user.id) })
  },
  signOut: () => {
    save(KEY_USER, null)
    set({ user: null, remembered: null, locked: true, ws: null, setup: false, cockpit: false, garden: false, view: { kind: 'overview' } })
  },
  theme: themeFor(load<string | null>(KEY_USER, null) ?? undefined),
  setTheme: (theme) =>
    set((s) => {
      if (s.user) save(`office.theme.${s.user.id}`, theme)
      return { theme }
    }),
  palette: false,
  showPalette: (palette) => set({ palette }),
  garden: false,
  setGarden: (garden) => set({ garden }),
  search: false,
  showSearch: (search) => set(search ? { search, ws: null, setup: false, cockpit: false } : { search }),
  cockpit: false,
  showCockpit: (cockpit) => set({ cockpit, ws: null, setup: false }),
  setup: false,
  showSetup: (setup) => set({ setup, ws: null }),
  locked: true,
  unlock: () => set({ locked: false }),
  lock: () => set({ locked: true, ws: null, setup: false, cockpit: false, search: false, alert: null, view: { kind: 'overview' } }),
  prints: [],
  addPrint: (job) => set((s) => ({ prints: [...s.prints, job] })),
  alert: null,
  raise: (alert) => set({ alert }),
  signatures: load<Record<string, string>>(KEY_SIGNATURE, {}),
  setSignature: (userId, png) =>
    set((s) => {
      const signatures = { ...s.signatures }
      if (png) signatures[userId] = png
      else delete signatures[userId]
      save(KEY_SIGNATURE, signatures)
      return { signatures }
    }),
  romp: 0,
  startRomp: () => set((s) => ({ romp: s.romp + 1 })),
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
