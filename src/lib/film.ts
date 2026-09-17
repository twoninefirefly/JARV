/**
 * The intro film.
 *
 * An optional clip that plays after the start-up sequence, between the mark
 * landing and the live interface taking over. Optional is the whole design:
 * this is the one part of the boot that is a file, and a file can be missing,
 * slow, or still buffering when someone presses the button. None of those may
 * cost anyone their start-up.
 *
 * So the film never blocks. It is armed once, at power-on, by asking whether it
 * has actually buffered enough to play through; if the answer is no, the boot
 * proceeds exactly as it did before the film existed and nobody waits on a
 * black screen. The decision is taken once rather than continuously, because
 * the sequence's length has to be known before it starts.
 */

/** Where the clip lives. Absent is a supported state, not an error. */
export const FILM_SRC = '/film/intro.mp4'

/** Fallback length, used only until the element reports its real duration. */
const FALLBACK_MS = 10000

/**
 * Never hold the boot longer than this, whatever the element claims.
 *
 * It is a backstop against a broken element, not a creative limit — so it has
 * to sit clear of any clip anyone would actually ship. At 14000 it did not: a
 * fifteen-second film, which is the longest Kling and MiniMax will produce,
 * would have been cut off one second before its last beat by a guard meant
 * for a video that never ends.
 */
const MAX_MS = 20000

let el: HTMLVideoElement | null = null
let setVisible: ((on: boolean) => void) | null = null
let armed = false

/** Called by the component that owns the element. Returns its unbind. */
export function bindFilm(
  video: HTMLVideoElement | null,
  visible: (on: boolean) => void,
): () => void {
  el = video
  setVisible = visible
  return () => {
    if (el === video) el = null
    if (setVisible === visible) setVisible = null
  }
}

/**
 * Has it buffered enough to play through without stalling?
 *
 * readyState 4 is HAVE_ENOUGH_DATA, which is the browser's own answer to
 * exactly this question. Anything less and we leave the film out rather than
 * risk a stall in the middle of the thing that is supposed to impress.
 */
function ready(): boolean {
  return Boolean(el && el.readyState >= 4 && Number.isFinite(el.duration))
}

/**
 * Decide, once, whether this boot includes the film, and report how long the
 * sequence therefore runs for. Call at power-on, before the sequence starts.
 */
export function armFilm(): number {
  armed = ready()
  if (!armed) return 0
  const ms = (el as HTMLVideoElement).duration * 1000
  return Math.min(Number.isFinite(ms) && ms > 500 ? ms : FALLBACK_MS, MAX_MS)
}

export function filmArmed(): boolean {
  return armed
}

/**
 * Show it, play it, resolve when it is over.
 *
 * Resolves rather than rejects on every failure path — a film that will not
 * play is a missing flourish, never a failed boot. The skip listener is why
 * the clip can be ten seconds without being a tax on the fiftieth start-up.
 */
export function playFilm(): Promise<void> {
  if (!armed || !el) return Promise.resolve()
  const video = el

  return new Promise<void>((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.clearTimeout(guard)
      video.removeEventListener('ended', finish)
      video.removeEventListener('error', finish)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
      setVisible?.(false)
      // Let the fade out finish before the interface arrives under it.
      window.setTimeout(resolve, 420)
    }
    const skip = () => finish()

    // A hard ceiling. 'ended' is reliable in every browser that matters, but a
    // boot that hangs because one event did not fire is not a trade worth
    // making for a decoration.
    const guard = window.setTimeout(finish, MAX_MS)

    video.addEventListener('ended', finish, { once: true })
    video.addEventListener('error', finish, { once: true })
    window.addEventListener('keydown', skip, { once: true })
    window.addEventListener('pointerdown', skip, { once: true })

    setVisible?.(true)
    try {
      video.currentTime = 0
    } catch {
      // Seeking can throw on a stream that is not seekable yet. Play anyway.
    }
    void video.play().catch(finish)
  })
}
