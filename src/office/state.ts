import { create } from 'zustand'
import type { WsTarget } from './workspaces'
import type { Message } from './comms'

/** What the sheet shows and where the camera flies. */
export type View =
  | { kind: 'overview' }
  | { kind: 'brain' }
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
  /** Decisions made this session; they drop out of every waiting list. */
  approved: string[]
  approve: (item: string) => void
  /** Behind the lock screen until the password is entered. */
  locked: boolean
  unlock: () => void
  lock: () => void
  /** Agent-to-agent traffic, newest first. */
  feed: Message[]
  /** Messages whose packet is still travelling through the scene. */
  inFlight: Array<{ msg: Message; born: number }>
  post: (msg: Message, animate: boolean) => void
}

export const useOffice = create<OfficeState>((set) => ({
  view: { kind: 'overview' },
  flight: 0,
  show: (view) => set((s) => ({ view, flight: s.flight + 1 })),
  ws: null,
  open: (ws) => set({ ws }),
  close: () => set({ ws: null }),
  approved: [],
  approve: (item) => set((s) => (s.approved.includes(item) ? s : { approved: [...s.approved, item] })),
  locked: true,
  unlock: () => set({ locked: false }),
  lock: () => set({ locked: true, ws: null, view: { kind: 'overview' } }),
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
