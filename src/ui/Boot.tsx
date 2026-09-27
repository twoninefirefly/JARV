import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../store'
import { BACKEND, LOCALE } from '../config'
import { caps, capabilitiesProbed } from '../lib/capabilities'

/**
 * The start-up sequence.
 *
 * Built to read as a real system starting, not as a title card. That is a
 * question of scale and restraint more than of content: small type, hairlines,
 * a lot of black, one colour, and nothing that shouts. The previous sequence
 * was a counter a third of the screen tall; this one is a line and a column of
 * small print, and it looks more expensive for it.
 *
 * The log is true. It reads the machine it is running on — cores, memory,
 * display, language, which voice engine the bridge reported — so the numbers on
 * screen are this Mac's numbers. A boot log that invents its figures is set
 * dressing; one that states real ones is an instrument.
 *
 * One move carries it: a hairline loads, then bends into a circle of exactly
 * the size and position of the live reactor behind the overlay, picks up a
 * bezel of fine ticks, and the name resolves inside it. The hand-off is then a
 * cross-fade between two drawings of the same ring.
 *
 * Canvas, drawn at the display's full pixel density, on a wall clock (see the
 * effect below for why not a frame count).
 */

/**
 * How long the sequence runs.
 *
 * App.tsx waits exactly this before handing over, by importing it rather than
 * repeating it — the two used to be separate numbers and separate comments,
 * which is the arrangement where a retimed animation quietly ends up with dead
 * air or a truncated last beat.
 */
export const BOOT_MS = 5500

/**
 * How long the overlay takes to leave.
 *
 * Exported for the same reason as BOOT_MS: App.tsx has to know when the boot
 * screen is actually gone, because the film above it waits for that before it
 * dissolves. Two numbers drifting apart would put the mark back on screen
 * underneath a fading picture, which is exactly the seam this removed.
 */
export const BOOT_EXIT_MS = 800

/** The name, as it resolves in the ring. */
const NAME = 'GEHIRN'

const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"
const SANS = "Inter, 'Helvetica Neue', system-ui, sans-serif"

// One accent — the reactor's own boot teal, a touch brighter so a 1px line
// holds its colour — and three greys. Anything more is decoration.
const ACCENT = '#22d0d0'
const ACCENT_SOFT = 'rgba(34, 208, 208, 0.35)'
const INK = 'rgba(220, 246, 248, 0.92)'
const DIM = 'rgba(150, 186, 192, 0.62)'
const FAINT = 'rgba(150, 186, 192, 0.22)'

/** Glyphs the name decodes through. Capitals, digits and rules only. */
const GLYPHS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789/\\<>=+#'

/**
 * The ring's radius as a fraction of the shorter viewport side. Matched to the
 * reactor (Core.tsx draws it at 0.60 of that side across, with a wandering
 * edge), because the whole hand-off depends on the two rings coinciding.
 */
const RING = 0.297

/** What the loading line reports it is doing, in order. */
const TASKS = ['KERN', 'SPEICHER', 'SPRACHE', 'STIMME', 'WERKZEUGE', 'VERBINDUNG', 'KALIBRIERUNG']

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const clampN = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

/** Progress of a beat that runs from `a` to `b` on the master clock. */
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))

const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3)

const easeIO = (t: number) => {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/**
 * Loading that looks like work rather than like a tween: a quick run, a
 * pause while something heavier is read, a jump, a creep, done. A perfectly
 * even bar is the tell of a fake one.
 */
function load(x: number): number {
  const k: [number, number][] = [
    [0, 0], [0.18, 0.34], [0.34, 0.37], [0.46, 0.71], [0.78, 0.8], [1, 1],
  ]
  for (let i = 1; i < k.length; i++) {
    const [x1, y1] = k[i]
    const [x0, y0] = k[i - 1]
    if (x <= x1) return y0 + (y1 - y0) * ease((x - x0) / (x1 - x0))
  }
  return 1
}

type Fact = { key: string; value: () => string | null }

/**
 * The log lines, read from the machine at the moment the sequence starts.
 *
 * `null` means "not known yet" and is drawn as a pending ellipsis — the voice
 * engine is only known once the bridge has answered the capability probe,
 * which happens during the sequence, so that line genuinely resolves late.
 */
function readFacts(): Fact[] {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const dpr = window.devicePixelRatio || 1
  const cores = nav.hardwareConcurrency
  // Chrome caps the reported figure at 8 for privacy, so 8 means "8 or more".
  const mem = nav.deviceMemory
  return [
    { key: 'PROZESSOR', value: () => (cores ? `${cores} KERNE` : 'BEREIT') },
    { key: 'SPEICHER', value: () => (mem ? (mem >= 8 ? '8+ GB' : `${mem} GB`) : 'BEREIT') },
    {
      key: 'ANZEIGE',
      value: () => `${Math.round(screen.width * dpr)} × ${Math.round(screen.height * dpr)}`,
    },
    { key: 'SPRACHE', value: () => LOCALE.toUpperCase() },
    { key: 'EINGABE', value: () => 'MIKROFON' },
    {
      key: 'STIMME',
      value: () => (capabilitiesProbed() ? (caps().tts ? 'ELEVENLABS' : 'SYSTEM') : null),
    },
    { key: 'VERBINDUNG', value: () => (BACKEND === 'bridge' ? 'BRIDGE :8787' : 'DIREKT') },
  ]
}

/** Text with tracking, centred on x without the trailing gap letterSpacing adds. */
function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, track: number) {
  ctx.letterSpacing = `${track}px`
  const w = ctx.measureText(text).width - track
  ctx.textAlign = 'left'
  ctx.fillText(text, x - w / 2, y)
  ctx.letterSpacing = '0px'
}

/**
 * One frame, at normalised time `t` from 0 to 1. `ms` is real elapsed time,
 * for the clock readout; `now` seeds the decode noise.
 *
 * `calm` is prefers-reduced-motion. It removes restlessness — the decode noise
 * and the travelling highlight — but never content: the log, the line and the
 * name still arrive in order and at the same pace.
 */
function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  ms: number,
  now: number,
  facts: Fact[],
  calm: boolean,
) {
  const cx = w / 2
  const cy = h / 2
  const unit = Math.min(w, h)
  const R = unit * RING

  // Small type at every size. Real system text does not grow with the window.
  const fs = clampN(unit * 0.0145, 10, 12)
  const lh = fs * 1.75
  const inset = 92 // the HUD header's own side margin, so the name does not jump at the hand-off

  const readouts = 1 - ease(span(t, 0.66, 0.78))

  // -- corner brackets, matching the HUD's so nothing moves at the hand-off --
  const frame = ease(span(t, 0, 0.1))
  if (frame > 0) {
    ctx.save()
    ctx.strokeStyle = ACCENT_SOFT
    ctx.lineWidth = 1
    ctx.globalAlpha = frame
    const c = 46 * frame
    const o = 26.5
    ctx.beginPath()
    ctx.moveTo(o, o + c); ctx.lineTo(o, o); ctx.lineTo(o + c, o)
    ctx.moveTo(w - o - c, o); ctx.lineTo(w - o, o); ctx.lineTo(w - o, o + c)
    ctx.moveTo(o, h - o - c); ctx.lineTo(o, h - o); ctx.lineTo(o + c, h - o)
    ctx.moveTo(w - o - c, h - o); ctx.lineTo(w - o, h - o); ctx.lineTo(w - o, h - o - c)
    ctx.stroke()
    ctx.restore()
  }

  // -- header: what is starting, and a clock that is actually running -------
  const head = ease(span(t, 0.02, 0.1)) * readouts
  if (head > 0) {
    ctx.save()
    ctx.globalAlpha = head
    ctx.textBaseline = 'alphabetic'
    ctx.font = `500 ${fs}px ${SANS}`
    ctx.fillStyle = INK
    ctx.letterSpacing = `${fs * 0.42}px`
    ctx.fillText(NAME, inset, 44 + fs)
    ctx.fillStyle = DIM
    ctx.font = `400 ${fs}px ${MONO}`
    ctx.letterSpacing = `${fs * 0.12}px`
    ctx.fillText('SYSTEMSTART', inset, 44 + fs + lh)
    ctx.textAlign = 'right'
    ctx.fillText(`T+${(ms / 1000).toFixed(3)}`, w - inset, 44 + fs)
    ctx.fillStyle = FAINT
    ctx.fillText('BUILD 1.0', w - inset, 44 + fs + lh)
    ctx.letterSpacing = '0px'
    ctx.restore()
  }

  // -- the log: real figures, resolving one line at a time -----------------
  if (readouts > 0) {
    ctx.save()
    ctx.globalAlpha = readouts
    ctx.font = `400 ${fs}px ${MONO}`
    ctx.textBaseline = 'alphabetic'
    const colW = Math.min(fs * 30, w * 0.34)
    const top = h - inset - (facts.length - 1) * lh - 10
    facts.forEach((f, i) => {
      const at = 0.08 + i * 0.062
      const seen = span(t, at, at + 0.012)
      if (seen <= 0) return
      const y = top + i * lh
      ctx.globalAlpha = readouts * seen
      ctx.fillStyle = FAINT
      ctx.textAlign = 'left'
      ctx.fillText(String(i + 1).padStart(2, '0'), inset, y)
      ctx.fillStyle = DIM
      ctx.fillText(f.key, inset + fs * 3, y)
      // Dotted leader between key and value, like a real report.
      const leaderFrom = inset + fs * 3 + ctx.measureText(f.key).width + fs * 0.8
      const value = f.value()
      const done = value !== null && t > at + 0.05
      const shown = done ? value : '…'
      ctx.textAlign = 'right'
      const status = done ? 'OK' : ''
      const statusW = fs * 2.6
      ctx.fillStyle = done ? INK : DIM
      ctx.fillText(shown, inset + colW - statusW, y)
      const valueW = ctx.measureText(shown).width
      ctx.fillStyle = FAINT
      const leaderTo = inset + colW - statusW - valueW - fs * 0.8
      for (let x = leaderFrom; x < leaderTo; x += fs * 0.6) ctx.fillRect(x, y - fs * 0.28, 1, 1)
      if (status) {
        ctx.fillStyle = ACCENT
        ctx.fillText(status, inset + colW, y)
      }
    })
    ctx.restore()
  }

  // -- the line: loads, then bends into the ring ---------------------------
  const grow = ease(span(t, 0.04, 0.16))
  const prog = load(span(t, 0.1, 0.62))
  const morph = easeIO(span(t, 0.62, 0.8))
  const L = unit * 0.2 * grow

  if (grow > 0) {
    const STEPS = 240
    /**
     * The line bends; it does not get tweened into a circle.
     *
     * Interpolating each point from its place on the line to its place on the
     * ring — the obvious way — passes through a pinched teardrop with the two
     * ends crossing over each other, because a short line and a long circle do
     * not share a parameterisation. So the curve is an arc throughout: its
     * curvature rises from nothing to 1/R while its length grows to the full
     * circumference, and its midpoint slides down so that at the end the
     * arc's own centre is the screen's. It closes, at the top, into the ring.
     */
    const k = morph / R
    const s = 2 * L + (2 * Math.PI * R - 2 * L) * morph
    const my = cy + R * morph
    const point = (u: number): [number, number] => {
      const d = (u - 0.5) * s
      if (k < 1e-5) return [cx + d, cy]
      const rho = 1 / k
      const th = d / rho
      return [cx + rho * Math.sin(th), my - rho + rho * Math.cos(th)]
    }
    const path = (u0: number, u1: number) => {
      ctx.beginPath()
      for (let i = 0; i <= STEPS; i++) {
        const u = u0 + ((u1 - u0) * i) / STEPS
        const [x, y] = point(u)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
    }
    ctx.save()
    ctx.lineWidth = 1
    // The unloaded track, then the loaded part over it. Once the line has
    // closed into the ring it is all loaded, and the track has gone.
    ctx.strokeStyle = FAINT
    path(0, 1)
    ctx.stroke()
    ctx.strokeStyle = ACCENT
    ctx.shadowColor = ACCENT
    ctx.shadowBlur = 6
    path(0, Math.max(prog, morph))
    ctx.stroke()
    ctx.restore()

    // Percent and task, riding the two ends of the line until it bends.
    const flat = 1 - span(morph, 0, 0.25)
    if (flat > 0.02 && readouts > 0) {
      ctx.save()
      ctx.globalAlpha = flat * readouts
      ctx.font = `400 ${fs}px ${MONO}`
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = INK
      ctx.textAlign = 'right'
      ctx.fillText(String(Math.round(prog * 100)).padStart(3, '0'), cx + L, cy - fs)
      ctx.fillStyle = DIM
      ctx.textAlign = 'left'
      const task = TASKS[Math.min(TASKS.length - 1, Math.floor(prog * TASKS.length))]
      ctx.fillText(prog >= 1 ? 'BEREIT' : task, cx - L, cy + fs * 2)
      ctx.restore()
    }
  }

  // -- bezel ticks, revealed clockwise once the ring has closed -------------
  // Only once the ring has closed: ticks round a circle that is not there yet
  // hang in the air.
  const bezel = ease(span(t, 0.79, 0.92))
  if (bezel > 0) {
    ctx.save()
    ctx.strokeStyle = ACCENT_SOFT
    ctx.lineWidth = 1
    ctx.beginPath()
    const N = 120
    for (let i = 0; i < N; i++) {
      if (i / N > bezel) break
      const a = -Math.PI / 2 + (i / N) * Math.PI * 2
      const long = i % 10 === 0
      const r0 = R + 9
      const r1 = r0 + (long ? 7 : 3)
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
    }
    ctx.stroke()
    ctx.restore()
  }

  // -- a single bright arc travelling the closed ring ----------------------
  if (!calm && morph > 0.98) {
    const a0 = -Math.PI / 2 + ((now / 1000) * 1.6) % (Math.PI * 2)
    ctx.save()
    ctx.strokeStyle = INK
    ctx.shadowColor = ACCENT
    ctx.shadowBlur = 10
    ctx.lineWidth = 1.2
    ctx.globalAlpha = span(t, 0.8, 0.86)
    ctx.beginPath()
    ctx.arc(cx, cy, R, a0, a0 + 0.35)
    ctx.stroke()
    ctx.restore()
  }

  // -- the name, resolving in the ring -------------------------------------
  const decode = span(t, 0.8, 0.94)
  if (decode > 0) {
    const size = clampN(unit * 0.026, 15, 24)
    const track = size * 0.62
    ctx.save()
    ctx.font = `500 ${size}px ${SANS}`
    ctx.textBaseline = 'middle'
    ctx.fillStyle = INK
    let text = NAME
    if (calm) {
      ctx.globalAlpha = ease(decode)
    } else {
      const fixed = Math.floor(decode * (NAME.length + 1))
      const seed = Math.floor(now / 55)
      text = NAME.split('')
        .map((c, i) =>
          i < fixed ? c : GLYPHS[(seed * 31 + i * 17 + c.charCodeAt(0)) % GLYPHS.length],
        )
        .join('')
      ctx.globalAlpha = 0.35 + 0.65 * ease(decode)
    }
    tracked(ctx, text, cx, cy - size * 0.2, track)

    // A short rule and the state beneath it.
    const sub = ease(span(t, 0.88, 0.98))
    if (sub > 0) {
      ctx.globalAlpha = sub
      ctx.fillStyle = ACCENT_SOFT
      ctx.fillRect(cx - 12, cy + size * 0.72, 24, 1)
      ctx.font = `400 ${fs * 0.95}px ${MONO}`
      ctx.fillStyle = DIM
      tracked(ctx, 'SYSTEM BEREIT', cx, cy + size * 1.5, fs * 0.3)
    }
    ctx.restore()
  }

  // -- the hand-off glow: the reactor's inner light, arriving early --------
  const glow = ease(span(t, 0.86, 1))
  if (glow > 0) {
    ctx.save()
    ctx.globalAlpha = glow * 0.9
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
    g.addColorStop(0, 'rgba(34, 208, 208, 0.10)')
    g.addColorStop(0.7, 'rgba(34, 208, 208, 0.03)')
    g.addColorStop(1, 'rgba(34, 208, 208, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// Ask for the faces now, while the ignition screen is up, so the first frame
// of the sequence is set in them rather than in a fallback that swaps a
// second later.
if (typeof document !== 'undefined' && document.fonts) {
  void document.fonts.load(`500 16px Inter`).catch(() => {})
  void document.fonts.load(`400 11px 'JetBrains Mono'`).catch(() => {})
}

export function Boot() {
  const phase = useStore((s) => s.phase)
  const reduced = useReducedMotion()
  const canvas = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (phase !== 'boot') return
    const cv = canvas.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return

    /**
     * The clock is wall-clock, not a frame count.
     *
     * requestAnimationFrame is throttled to a crawl in a background tab and
     * paused outright in a hidden one, so a sequence counted in frames freezes
     * on whichever beat it was showing and resumes there — mid-boot, seconds
     * after the interface behind it has already gone live. Reading Date.now
     * costs smoothness while the tab is away and never costs correctness: come
     * back at four seconds and you see four seconds.
     */
    const start = Date.now()
    const facts = readFacts()
    let raf = 0
    let stopped = false

    const frame = () => {
      if (stopped) return

      // Full density, up to 3x. Capped at 2 it was soft on exactly the
      // displays where hairlines and small type are the whole look.
      const dpr = Math.min(window.devicePixelRatio || 1, 3)
      const w = cv.clientWidth
      const h = cv.clientHeight
      const pw = Math.max(1, Math.round(w * dpr))
      const ph = Math.max(1, Math.round(h * dpr))
      // Assigning width/height clears the canvas, so only do it when the size
      // actually changed — otherwise every frame pays for a full reallocation.
      if (cv.width !== pw || cv.height !== ph) {
        cv.width = pw
        cv.height = ph
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const now = Date.now()
      const ms = now - start
      const t = clamp01(ms / BOOT_MS)
      draw(ctx, w, h, t, ms, now, facts, Boolean(reduced))

      // Keeps running past t = 1: the clock readout and the travelling arc are
      // still live while the overlay waits to hand over. Stopped by cleanup.
      raf = requestAnimationFrame(frame)
    }

    frame()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
    }
  }, [phase, reduced])

  /**
   * The overlay leaves by dissolving, and it only actually does that because
   * the condition is INSIDE the AnimatePresence.
   *
   * It used to be an early `if (phase !== 'boot') return null` above this,
   * which took the AnimatePresence away along with the child — and a presence
   * that has itself unmounted cannot animate anything out. So the exit here
   * was written, was correct, and had never once run: the mark cut to the
   * sphere in a single frame. Which is precisely what the hand-over was
   * supposed not to do.
   */
  return (
    <AnimatePresence>
      {phase === 'boot' && (
        <motion.div
          key="boot"
          className="boot"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: BOOT_EXIT_MS / 1000 }}
        >
          <canvas ref={canvas} className="boot-canvas" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
