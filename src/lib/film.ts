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
 * How long the last frame may be held waiting for the interface to be ready.
 *
 * Normally zero: the hand-over below starts with the clip, so ten seconds of
 * picture is ten seconds in which the rest of the start-up finishes behind it.
 * This is only the ceiling for the day something is slow, and it is short
 * because a frozen frame reads as a crash.
 */
const HANDOVER_MS = 1500

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
 * `handover` is whatever else the start-up still has to do. It is started with
 * the clip rather than after it, and the dissolve waits on it — so the picture
 * covers the last of the set-up, and what it dissolves into is the finished
 * interface. Done the other way round the film faded off onto the boot screen
 * it had been covering, which then faded to the interface: two transitions,
 * with a frame in between that said nothing new.
 *
 * Resolves rather than rejects on every failure path — a film that will not
 * play is a missing flourish, never a failed boot. The skip listener is why
 * the clip can be ten seconds without being a tax on the fiftieth start-up.
 */
export function playFilm(handover?: () => Promise<unknown>): Promise<void> {
  if (!armed || !el) return Promise.resolve()
  const video = el

  return new Promise<void>((resolve) => {
    // Started here rather than in finish(): the whole point is that it runs
    // behind the picture, so that ten seconds of film is ten seconds in which
    // the interface can come up unseen. Delayed by the fade-in, because "behind
    // the picture" is only true once the picture is opaque. Its failure is the
    // caller's business, not the film's.
    const handing = sleep(IN_MS)
      .then(handover)
      .catch(() => undefined)

    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.clearTimeout(guard)
      video.removeEventListener('ended', finish)
      video.removeEventListener('error', finish)
      video.removeEventListener('timeupdate', leadOut)
      window.removeEventListener('keydown', onSkip)
      window.removeEventListener('pointerdown', onSkip)
      skip = null

      void Promise.race([handing, sleep(HANDOVER_MS)]).then(() => {
        setVisible?.(false)
        // Let the dissolve finish before anything else claims the screen.
        window.setTimeout(resolve, OUT_MS + 60)
      })
    }
    const onSkip = () => finish()
    skip = finish

    /**
     * Begin the dissolve on the clip's last moments rather than after them.
     *
     * A picture that cross-fades while it is still moving hands over; one that
     * plays to its end first freezes on its final frame, and then fades a
     * still. The difference is the whole of what the ending feels like.
     */
    const leadOut = () => {
      const left = (video.duration - video.currentTime) * 1000
      if (Number.isFinite(left) && left <= OUT_MS) finish()
    }

    // A hard ceiling. 'ended' is reliable in every browser that matters, but a
    // boot that hangs because one event did not fire is not a trade worth
    // making for a decoration.
    const guard = window.setTimeout(finish, MAX_MS)

    video.addEventListener('timeupdate', leadOut)
    video.addEventListener('ended', finish, { once: true })
    video.addEventListener('error', finish, { once: true })
    window.addEventListener('keydown', onSkip, { once: true })
    window.addEventListener('pointerdown', onSkip, { once: true })

    setVisible?.(true)
    try {
      video.currentTime = 0
    } catch {
      // Seeking can throw on a stream that is not seekable yet. Play anyway.
    }
    void video.play().catch(finish)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}
