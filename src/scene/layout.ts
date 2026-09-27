import { STAGE } from '../config'

/**
 * Where things sit, in one place, because two very different pieces of code
 * have to agree on it: the 3D scene, which places the reactor, and the 2D
 * start-up sequence, which has to land its last frame exactly on top of it.
 * A mismatch here is a visible jump at the hand-over.
 */

export const CAMERA_Z = 6.2
export const FOV = 45

/**
 * Where the camera looks. With the figure, a little below the core, so the
 * head sits in the upper middle of the frame and the shoulders run off the
 * bottom edge the way a portrait is cropped. The sphere alone is centred.
 */
export const LOOK_Y = STAGE === 'bust' ? -0.75 : 0

/**
 * The reactor ring's diameter as a fraction of the shorter viewport side.
 * Full size on its own; face-sized as the figure's core.
 */
export const CORE_FIT = STAGE === 'bust' ? 0.1 : 0.6

/** World units per unit of the figure's head height. */
export const BUST_SCALE = 2.0

/**
 * Where the core appears on screen, in CSS pixels. The core sits at the world
 * origin; the camera looks LOOK_Y below it, so it projects that far above the
 * screen's centre by the camera's own perspective.
 */
export function coreOnScreen(w: number, h: number): { x: number; y: number; r: number } {
  const tanHalf = Math.tan(((FOV / 2) * Math.PI) / 180)
  const offset = (-LOOK_Y / CAMERA_Z / tanHalf) * (h / 2)
  return { x: w / 2, y: h / 2 - offset, r: (Math.min(w, h) * CORE_FIT) / 2 }
}
