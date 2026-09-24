import { create } from 'zustand'

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
}

export const useOffice = create<OfficeState>((set) => ({
  view: { kind: 'overview' },
  flight: 0,
  show: (view) => set((s) => ({ view, flight: s.flight + 1 })),
}))
