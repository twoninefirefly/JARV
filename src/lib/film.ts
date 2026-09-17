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

/**
 * How long the picture takes to dissolve into the interface underneath.
 *
 * Deliberately slower than the way in: arriving is a cut onto a still mark and
 * wants to be quick, leaving is a dissolve onto a live scene and wants to be
 * seen. The matching numbers live in .film / .film-on in src/index.css, which
 * is where the browser actually reads them.
 */
const OUT_MS = 900

/**
 * How long it takes to cover the screen on the way in.
 *
 * Nothing underneath may change before this has elapsed. Flip the boot overlay
 * away while the picture is still half transparent and you get the worst of
 * both: the mark cuts to the sphere in plain sight, and the film then fades up
 * over an interface it was supposed to arrive ahead of.
 */
const IN_MS = 450

/**
 * How much of the clip's end is deliberately thrown away.
 *
 * A generated clip almost always coasts to a halt: the last half second is the
 * camera arriving somewhere and stopping. Dissolving out of that reads as the
 * picture hanging, because it IS the picture hanging. So the dissolve is timed
 * to have finished before it, and the tail is never shown.
 */
const TAIL_MS = 500

/** When the dissolve starts, measured back from the end of the clip. */
const LEAD_MS = OUT_MS + TAIL_MS

let el: HTMLVideoElement | null = null
let setVisible: ((on: boolean) => void) | null = null
let armed = false
let skip: (() => void) | null = null

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
 * Cut it short from outside.
 *
 * There is one caller and one reason: he is awake and answering, which he can
 * now be while the film is still running, and an answer delivered from behind
 * a picture is an answer nobody can see.
 */
export function skipFilm(): void {
  skip?.()
}

/**
 * Show it, play it, resolve when it is over.
 *
 * `onCovered` fires once the picture is opaque, and that is the entire reason
 * it exists: it is when the rest of the start-up can happen without anyone
 * seeing it, so the interface is already live behind the film by the time the
 * film dissolves into it.
 *
 * Note what it is NOT: the dissolve does not wait for it. The ending is timed
 * off the clip and nothing else, because an ending that waits on the slowest
 * thing the start-up happens to be doing is an ending that sometimes hangs —
 * and it did, for two or three seconds, on the frozen last frame. A clip that
 * always ends the same way is worth more than a hand-over that is occasionally
 * a few hundred milliseconds tidier.
 *
 * Resolves rather than rejects on every failure path — a film that will not
 * play is a missing flourish, never a failed boot. The skip listener is why
 * the clip can be fifteen seconds without being a tax on the fiftieth
 * start-up.
 */
export function playFilm(onCovered?: () => void): Promise<void> {
  if (!armed || !el) return Promise.resolve()
  const video = el

  return new Promise<void>((resolve) => {
    let done = false

    const finish = () => {
      if (done) return
      done = true
      window.clearTimeout(guard)
      window.clearTimeout(cue)
      video.removeEventListener('ended', finish)
      video.removeEventListener('error', finish)
      video.removeEventListener('playing', arm)
      video.removeEventListener('timeupdate', leadOut)
      window.removeEventListener('keydown', onSkip)
      window.removeEventListener('pointerdown', onSkip)
      skip = null

      setVisible?.(false)
      // Let the dissolve finish before anything else claims the screen.
      window.setTimeout(resolve, OUT_MS + 60)
    }
    const onSkip = () => finish()
    skip = finish

    /** Milliseconds of clip left, or null when the element cannot say. */
    const remaining = (): number | null => {
      const left = (video.duration - video.currentTime) * 1000
      return Number.isFinite(left) ? left : null
    }

    /**
     * Start the dissolve before the clip stops rather than after it.
     *
     * Two mechanisms for one moment, because each covers the other's failure.
     * The timer is precise — it does not depend on how often the browser feels
     * like reporting progress — but it drifts if playback stalls. 'timeupdate'
     * cannot drift, since it reads the true position, but it only fires about
     * four times a second. Whichever arrives first wins; finish() runs once.
     */
    let cue = 0
    const arm = () => {
      const left = remaining()
      if (left === null) return
      window.clearTimeout(cue)
      cue = window.setTimeout(finish, Math.max(0, left - LEAD_MS))
    }
    const leadOut = () => {
      const left = remaining()
      if (left !== null && left <= LEAD_MS) finish()
    }

    // A hard ceiling. 'ended' is reliable in every browser that matters, but a
    // boot that hangs because one event did not fire is not a trade worth
    // making for a decoration.
    const guard = window.setTimeout(finish, MAX_MS)

    video.addEventListener('playing', arm)
    video.addEventListener('timeupdate', leadOut)
    video.addEventListener('ended', finish, { once: true })
    video.addEventListener('error', finish, { once: true })
    window.addEventListener('keydown', onSkip, { once: true })
    window.addEventListener('pointerdown', onSkip, { once: true })

    setVisible?.(true)
    // Once the picture is opaque, whatever is underneath may change unseen.
    window.setTimeout(() => onCovered?.(), IN_MS)

    try {
      video.currentTime = 0
    } catch {
      // Seeking can throw on a stream that is not seekable yet. Play anyway.
    }
    void video.play().catch(finish)
    arm()
  })
}
