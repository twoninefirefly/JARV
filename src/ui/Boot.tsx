import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useStore } from '../store'

/**
 * The start-up sequence.
 *
 * One continuous move rather than four chapters. The percent counter is the
 * spine: it is on screen from the first frame to the last, and everything else
 * is something happening to it. The loading bar stops being a bar and becomes
 * a waveform; the waveform rolls into a ring; the counter travels into that
 * ring, shrinks, reaches a hundred, and then lets go. What is left standing in
 * the ring is the mark; END_MARK below decides which one.
 *
 * The last frame is a circle at rest, in the same place and at the same size as
 * the live reactor behind this overlay. That is the whole reason the sequence
 * ends where it does: the hand-off is a cross-fade between two drawings of the
 * same object, so there is nothing to see at the cut.
 *
 * Canvas rather than SVG and CSS. The previous sequence was hand-authored
 * shapes because it was made of discrete parts; this one is a curve that is
 * continuously re-evaluated, which is what canvas is for. Still no file to
 * load, still nothing that can arrive late and stall the first beat.
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

const LOG = [
  'EINBINDEN F:/BACKUP/GHOST (VERBORGEN)',
  'SYSTEMSPEICHER ERWEITERN ...... OK',
  'TELEMETRIE / KOMP-ABGLEICH',
  'SYSTEMKONFIGURATION ENTFERNEN',
  'PRUEFSUMME .................... OK',
  'SYSTEMWERKZEUG STARTEN',
]

/**
 * What stands in the ring once the counter reaches a hundred.
 *
 *   'wortmarke' — SYSTEM ONLINE, set in two lines across the ring. Reads
 *     instantly, in any language, and needs no artwork that does not exist yet.
 *
 *   'monogramm' — 2, the lily, 9, as one figure. The stronger ending, because
 *     the counter's own digits are what stay behind: a hundred becomes
 *     twenty-nine in the same face in the same place, so it reads as a
 *     transformation rather than a cut to a logo.
 *
 * One word decides it, and nothing else in the file cares which.
 */
const END_MARK: 'wortmarke' | 'monogramm' = 'monogramm'

const CYAN = '#00e5ff'
const HOT = '#dffbff'
const DIM = 'rgba(109,148,164,0.85)'

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Progress of a beat that runs from `a` to `b` on the master clock. */
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))

const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3)

const easeIO = (t: number) => {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/**
 * The mark: two, the lily, nine — as one figure rather than three objects.
 *
 * A fleur-de-lis is a lance rising from a band with leaves falling away from
 * it, and that structure has exactly the slots this needs. The lance goes up
 * the middle. The band across the waist is also the line the digits stand on.
 * The leaves curl out from under it. So the digits are not placed beside a
 * lily; they occupy the places where a lily's outer petals would be, and the
 * silhouette stays a crest.
 *
 * The digits are set in Chakra Petch rather than drawn. The project's own face
 * shapes a 2 and a 9 better than bezier curves guessed by hand, and it means
 * the mark is in the same voice as every other numeral in the interface.
 *
 * Geometry is in units of `s`, the mark's full height, so it holds together at
 * any size — which matters, because the same function draws it at a hundred
 * pixels in the boot ring and could draw it at sixteen in a tab.
 */
function mark(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  const band = cy + s * 0.3

  // The lance. A pointed leaf with a slight waist, closed at the band.
  ctx.beginPath()
  ctx.moveTo(cx, cy - s * 0.62)
  ctx.bezierCurveTo(cx + s * 0.13, cy - s * 0.3, cx + s * 0.1, cy + s * 0.05, cx + s * 0.04, band)
  ctx.lineTo(cx - s * 0.04, band)
  ctx.bezierCurveTo(cx - s * 0.1, cy + s * 0.05, cx - s * 0.13, cy - s * 0.3, cx, cy - s * 0.62)
  ctx.stroke()

  // A seed of light where the lance meets the band — the one filled element,
  // and the thing that keeps the centre from reading as empty at small sizes.
  ctx.beginPath()
  ctx.arc(cx, cy - s * 0.04, s * 0.045, 0, Math.PI * 2)
  ctx.fill()

  // The digits, standing on the band.
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `700 ${s * 0.52}px 'Chakra Petch', system-ui, sans-serif`
  ctx.fillText('2', cx - s * 0.42, band)
  ctx.fillText('9', cx + s * 0.42, band)
  ctx.restore()

  // The band, and the two leaves curling out from under its ends.
  ctx.beginPath()
  ctx.moveTo(cx - s * 0.6, band)
  ctx.lineTo(cx + s * 0.6, band)
  ctx.moveTo(cx - s * 0.6, band)
  ctx.bezierCurveTo(
    cx - s * 0.78, band + s * 0.04,
    cx - s * 0.72, band + s * 0.2,
    cx - s * 0.5, band + s * 0.24,
  )
  ctx.moveTo(cx + s * 0.6, band)
  ctx.bezierCurveTo(
    cx + s * 0.78, band + s * 0.04,
    cx + s * 0.72, band + s * 0.2,
    cx + s * 0.5, band + s * 0.24,
  )
  ctx.stroke()
}

/** One frame, at normalised time `t` from 0 to 1. */
function draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx = w / 2
  const cy = h / 2
  const unit = Math.min(w, h)
  const R = unit * 0.29

  const climb = easeIO(span(t, 0.02, 0.75))
  const pct = Math.min(100, Math.round(climb * 100))
  const toCentre = ease(span(t, 0.5, 0.8))
  const dissolve = ease(span(t, 0.74, 0.86))
  const markIn = ease(span(t, 0.84, 1))

  const wave = ease(span(t, 0.2, 0.55))
  const wrap = easeIO(span(t, 0.5, 0.78))
  const settle = ease(span(t, 0.74, 0.96))
  const halfLine = Math.min(w * 0.36, R * 3)
  const amp = unit * 0.085 * wave * (1 - settle * 0.88)

  // -- the line: loading bar, then waveform, then ring ----------------------
  ctx.save()
  ctx.strokeStyle = wrap > 0.55 ? HOT : CYAN
  ctx.shadowColor = CYAN
  ctx.shadowBlur = 13
  ctx.lineWidth = 1.6
  ctx.beginPath()
  const STEPS = 220
  for (let i = 0; i <= STEPS; i++) {
    const u = i / STEPS
    // The envelope pins both ends flat, which is what lets the curve close on
    // itself without a kink once it wraps.
    const env = Math.sin(u * Math.PI)
    const wv =
      Math.sin(u * Math.PI * 9 - t * 7) * 0.6 + Math.sin(u * Math.PI * 17 + t * 4) * 0.4
    const a = amp * env * wv

    const lx = cx + (u - 0.5) * 2 * halfLine
    const ly = cy + unit * 0.11 + a
    const ang = -Math.PI / 2 + u * Math.PI * 2
    const rr = R + a
    const kx = cx + Math.cos(ang) * rr
    const ky = cy + Math.sin(ang) * rr

    const x = lx + (kx - lx) * wrap
    const y = ly + (ky - ly) * wrap
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.restore()

  // -- the segment cells, the literal "loading" read ------------------------
  const cells = (1 - wrap) * (1 - span(t, 0.42, 0.58) * 0.4)
  if (cells > 0.02) {
    ctx.save()
    ctx.globalAlpha = cells
    const N = 28
    const gap = (halfLine * 2) / N
    for (let i = 0; i < N; i++) {
      const on = i / N < climb
      ctx.fillStyle = on ? CYAN : 'rgba(0,229,255,0.14)'
      ctx.shadowBlur = on ? 8 : 0
      ctx.shadowColor = CYAN
      ctx.fillRect(cx - halfLine + i * gap, cy + unit * 0.155, gap * 0.62, unit * 0.018)
    }
    ctx.restore()
  }

  // -- the system log, left rail --------------------------------------------
  const logAlpha = 1 - ease(span(t, 0.55, 0.72))
  if (logAlpha > 0.02) {
    ctx.save()
    ctx.globalAlpha = logAlpha * 0.7
    ctx.fillStyle = DIM
    const ls = Math.max(9, unit * 0.03)
    ctx.font = `400 ${ls}px 'IBM Plex Mono', ui-monospace, monospace`
    const shown = Math.floor(span(t, 0.03, 0.55) * LOG.length + 0.001)
    for (let i = 0; i < Math.min(shown, LOG.length); i++) {
      ctx.fillText(`\u203a  ${LOG[i]}`, unit * 0.06, unit * 0.12 + i * ls * 1.7)
    }
    ctx.restore()
  }

  // -- the counter ----------------------------------------------------------
  const bigSize = unit * (0.3 - toCentre * 0.16)
  const ny = cy + (1 - toCentre) * -unit * 0.05
  if (dissolve < 1) {
    ctx.save()
    ctx.globalAlpha = 1 - dissolve
    ctx.fillStyle = HOT
    ctx.shadowColor = CYAN
    ctx.shadowBlur = 20
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 ${bigSize}px 'Chakra Petch', system-ui, sans-serif`
    ctx.fillText(String(pct), cx, ny)
    ctx.globalAlpha = (1 - dissolve) * 0.55
    ctx.font = `600 ${bigSize * 0.28}px 'Chakra Petch', system-ui, sans-serif`
    ctx.fillText('%', cx + bigSize * (pct > 99 ? 0.92 : 0.62), ny + bigSize * 0.26)
    ctx.restore()
  }

  // -- the mark, arriving where the digits just were ------------------------
  if (markIn > 0) {
    const ms = unit * 0.155
    ctx.save()
    ctx.globalAlpha = markIn
    ctx.strokeStyle = HOT
    ctx.fillStyle = HOT
    ctx.shadowColor = CYAN
    ctx.shadowBlur = 16
    ctx.lineWidth = 1.5
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    if (END_MARK === 'monogramm') {
      // Raised by a tenth of its height: the mark hangs its leaves below the
      // band, so its optical centre sits above its geometric one.
      mark(ctx, cx, cy - ms * 0.1, ms * (0.9 + markIn * 0.1))
    } else {
      // Two lines rather than one: thirteen letter-spaced characters do not fit
      // across a circle, and stacked six-and-six sits in it as a lockup.
      const ls = unit * 0.055
      ctx.font = `600 ${ls}px 'Chakra Petch', system-ui, sans-serif`
      // Chrome and Edge honour this; anywhere else it is ignored rather than
      // failing, and the words simply set tighter.
      ctx.letterSpacing = `${ls * 0.26}px`
      ctx.fillText('SYSTEM', cx, cy - ls * 0.72)
      ctx.fillText('ONLINE', cx, cy + ls * 0.72)
      ctx.letterSpacing = '0px'

      // A hairline between the two words, short of them on both sides.
      ctx.globalAlpha = markIn * 0.5
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(cx - ls * 1.9, cy)
      ctx.lineTo(cx + ls * 1.9, cy)
      ctx.stroke()
    }
    ctx.restore()
  }

  // -- the hand-off glow ----------------------------------------------------
  if (settle > 0) {
    ctx.save()
    ctx.globalAlpha = settle
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
    g.addColorStop(0, 'rgba(0,229,255,0.22)')
    g.addColorStop(1, 'rgba(0,229,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
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
    let raf = 0
    let stopped = false

    const frame = () => {
      if (stopped) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
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

      const t = reduced ? 1 : clamp01((Date.now() - start) / BOOT_MS)
      draw(ctx, w, h, t)

      // Hold the last frame rather than spinning: it is the hand-off, and the
      // overlay is about to cross-fade out over it.
      if (t < 1) raf = requestAnimationFrame(frame)
    }

    frame()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
    }
  }, [phase, reduced])

  if (phase !== 'boot') return null

  return (
    <AnimatePresence>
      <motion.div
        className="boot"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, filter: 'blur(10px)' }}
        transition={{ duration: 0.8 }}
      >
        <canvas ref={canvas} className="boot-canvas" />
      </motion.div>
    </AnimatePresence>
  )
}
