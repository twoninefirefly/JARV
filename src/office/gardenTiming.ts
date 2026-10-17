/** Secret Garden timing, shared by the 3D garden and the page around it. */
export const GARDEN = {
  /** The first rose starts once the lawn is mostly there. */
  first: 0.8,
  /** The last rose starts this long after the first. */
  spread: 6,
  /** Seconds a rose takes to push up out of the ground. */
  rise: 1.8,
  /** Seconds it then takes to open. */
  open: 2.2,
  /** The jet crosses this early, while the roses are still coming up. */
  jetAt: 3,
}

/** When the last rose has opened: only then does the page itself turn pink. */
export const GARDEN_DONE_MS = (GARDEN.first + GARDEN.spread + GARDEN.rise * 0.6 + GARDEN.open) * 1000
