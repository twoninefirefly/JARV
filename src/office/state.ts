import { create } from 'zustand'
import type { WsTarget } from './workspaces'

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
}))
