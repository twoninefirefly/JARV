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
 * The loading bar is a neural network: a band of neurons and synapses that
 * wakes from left to right behind the loading front, with amber signals running
 * the lit synapses toward it. At a hundred the whole net fires once, then the
 * neurons stream out of the bar into a ring of exactly the size and position of
 * the live reactor, and the network fades out ON the reactor — the overlay's
 * ground thins away underneath it, so the sphere is already there when the
 * last neuron goes. No cut, and nothing between the bar and the bot.
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

/**
 * The loading bar is a small neural network: neurons scattered through a
 * band, each wired to its nearest neighbours ahead of it. Built once per
 * start-up from a fixed seed, so the layout is the same every time — a
 * network that reshuffled itself on each boot would read as noise, not as a
 * structure being brought up.
 */
type Neuron = {
  /** 0..1 along the bar, sorted. */
  x: number
  /** -0.5..0.5 across the bar. */
  y: number
  /** Radius in px. */
  r: number
  seed: number
  /** 0..1, how late this one joins the move into the ring. */
  lag: number
}
type Synapse = { a: number; b: number; seed: number }
type Net = { nodes: Neuron[]; edges: Synapse[] }

function buildNet(): Net {
  let st = 2909
  const rnd = () => (st = (st * 16807) % 2147483647) / 2147483647
  const N = 104
  const nodes: Neuron[] = []
  for (let i = 0; i < N; i++) {
    nodes.push({
      x: (i + 0.15 + rnd() * 0.7) / N,
      y: rnd() - 0.5,
      r: 0.8 + rnd() * rnd() * 1.8,
      seed: rnd(),
      lag: rnd(),
    })
  }
  // The band is roughly eight times wider than it is tall; distances are
  // judged in that shape so "nearest" means nearest on screen.
  const ASPECT = 8
  const edges: Synapse[] = []
  const seen = new Set<string>()
  for (let i = 0; i < N; i++) {
    const cands: [number, number][] = []
    for (let j = i + 1; j < Math.min(N, i + 9); j++) {
      const d = Math.hypot((nodes[j].x - nodes[i].x) * ASPECT, nodes[j].y - nodes[i].y)
      cands.push([d, j])
    }
    cands.sort((p, q) => p[0] - q[0])
    const take = rnd() < 0.3 ? 3 : 2
    for (const [, j] of cands.slice(0, take)) {
      const k = `${i}-${j}`
      if (seen.has(k)) continue
      seen.add(k)
      edges.push({ a: i, b: j, seed: rnd() })
    }
  }
  return { nodes, edges }
}

/**
 * Soft glow dots, drawn once and stamped.
 *
 * The first version lit every neuron and every signal with canvas shadowBlur,
 * which runs a blur pass per draw call: at retina density that was well over a
 * hundred full blurs a frame, and the start-up stuttered on exactly the
 * machines it is meant to look best on. A pre-rendered gradient stamped with
 * drawImage costs a texture copy instead, and additive compositing ('lighter')
 * gives the same bloom where glows overlap.
 */
type Glow = { cyan: HTMLCanvasElement; amber: HTMLCanvasElement }

function makeGlow(): Glow {
  const one = (rgb: string) => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    if (g) {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, `rgba(${rgb}, 1)`)
      grad.addColorStop(0.18, `rgba(${rgb}, 0.55)`)
      grad.addColorStop(0.45, `rgba(${rgb}, 0.12)`)
      grad.addColorStop(1, `rgba(${rgb}, 0)`)
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
    }
    return c
  }
  return { cyan: one('150, 240, 255'), amber: one('255, 170, 70') }
}

/**
 * Lines grouped by colour, stroked once per group. Two hundred-odd separate
 * stroke() calls a frame become a handful. Alphas are quantised so the groups
 * stay few; a step of 0.02 is below what the eye separates on a 1px line.
 */
function strokeGroups(ctx: CanvasRenderingContext2D) {
  const groups = new Map<string, Path2D>()
  return {
    line(rgb: string, alpha: number, x1: number, y1: number, x2: number, y2: number) {
      const a = Math.round(alpha * 50) / 50
      if (a <= 0) return
      const key = `rgba(${rgb}, ${a})`
      let p = groups.get(key)
      if (!p) groups.set(key, (p = new Path2D()))
      p.moveTo(x1, y1)
      p.lineTo(x2, y2)
    },
    flush() {
      for (const [style, p] of groups) {
        ctx.strokeStyle = style
        ctx.stroke(p)
      }
    },
  }
}

// Signals travelling the synapses: amber against the cold blue, the one warm
// colour in the piece — the same pairing as a nerve firing in the dark.
const SIGNAL = '#ffb24a'
const NEURON = '#bff8ff'
const BG = '#01060c'

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
  net: Net,
  glow: Glow,
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

  // The ground is painted here rather than by CSS so it can go: over the last
  // part of the sequence it thins to nothing and the live reactor — already
  // running behind the overlay — shows through underneath the network as it
  // settles onto the reactor's ring. That is the hand-over: the neurons fade
  // out ON the sphere instead of cutting to it.
  const ground = 1 - ease(span(t, 0.84, 0.98))
  if (ground > 0) {
    ctx.save()
    ctx.globalAlpha = ground
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

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

  // -- the neural bar -------------------------------------------------------
  const W = clampN(w * 0.46, 280, 760)
  const H = clampN(unit * 0.075, 36, 72)
  const bx = cx - W / 2
  const prog = load(span(t, 0.1, 0.62))
  // Everything lights for a beat at a hundred, before the move.
  const flash = Math.sin(Math.PI * span(t, 0.62, 0.72))
  // The move into the ring, and the fade that follows it.
  const gather = span(t, 0.64, 0.84)
  const vanish = 1 - ease(span(t, 0.9, 1))
  const secs = now / 1000

  // Where each neuron is right now. The whole band BENDS into the ring
  // rather than each neuron flying to its own seat: with individual flights
  // the left half of the bar crossed over to the right of the ring and the
  // network became a tangle of stretched synapses. Bent, every neuron keeps
  // its neighbours the whole way. The band is an arc throughout, its curvature
  // rising from nothing to 1/R while its length grows to the circumference and
  // its midpoint sinks so the arc's centre ends on the screen's; the ends rise
  // and meet at the top. Each neuron rides it at its own offset across the
  // band, which narrows as the ring closes.
  const pos = net.nodes.map((n) => {
    // A touch of individual lag so the move breathes, small enough that
    // neighbours never drift apart.
    const m = easeIO(gather + (n.lag - 0.5) * 0.08 * Math.sin(Math.PI * gather))
    const band = n.y * H * (1 - 0.65 * m)
    if (m <= 0) return [bx + n.x * W, cy + band, 0] as const
    const k = m / R
    const len = W + (2 * Math.PI * R - W) * m
    const my = cy + R * m
    const d = (n.x - 0.5) * len
    const rho = 1 / k
    const th = d / rho
    // Offset along the arc's own normal, which starts out vertical.
    const nx = Math.sin(th)
    const ny = Math.cos(th)
    return [
      cx + rho * nx + nx * band,
      my - rho + rho * ny + ny * band,
      m,
    ] as const
  })

  // How awake each neuron is: dark ahead of the loading front, lit behind it,
  // with a short soft edge so the front reads as a wave, not a cut.
  const lit = net.nodes.map((n, i) => {
    const appear = span(t, 0.04 + n.x * 0.08, 0.1 + n.x * 0.08)
    const awake = clamp01((prog - n.x) * (W / 22) + 0.5)
    return appear * Math.max(awake, pos[i][2])
  })
  const appearOf = (n: Neuron) => span(t, 0.04 + n.x * 0.08, 0.1 + n.x * 0.08)

  if (t > 0.04 && vanish > 0) {
    ctx.save()
    ctx.globalAlpha = vanish

    // End marks: the only thing that says "this is a bar" in so many words.
    const marks = readouts * (1 - span(gather, 0, 0.3))
    if (marks > 0) {
      ctx.globalAlpha = vanish * marks
      ctx.fillStyle = FAINT
      ctx.fillRect(bx - 10, cy - H * 0.6, 1, H * 1.2)
      ctx.fillRect(bx + W + 10, cy - H * 0.6, 1, H * 1.2)
      ctx.globalAlpha = vanish
    }

    // Synapses, batched by colour. Dark ones first, lit ones over them.
    ctx.lineWidth = 1
    const lines = strokeGroups(ctx)
    for (const e of net.edges) {
      const shown = Math.min(appearOf(net.nodes[e.a]), appearOf(net.nodes[e.b]))
      if (shown <= 0) continue
      const [x1, y1] = pos[e.a]
      const [x2, y2] = pos[e.b]
      const on = Math.min(lit[e.a], lit[e.b])
      if (on > 0.02) lines.line('34, 208, 208', 0.16 + on * 0.3 + flash * 0.25, x1, y1, x2, y2)
      else lines.line('150, 186, 192', 0.07 * shown, x1, y1, x2, y2)
    }

    // Signals: a pulse running each firing synapse toward the front. Stateless
    // — a function of the clock and the synapse's seed — so nothing needs to be
    // spawned, tracked or cleaned up, and a hidden tab resumes exactly in step.
    const sparks: [number, number, number][] = []
    if (!calm) {
      for (const e of net.edges) {
        const on = Math.min(lit[e.a], lit[e.b])
        if (on < 0.6 || e.seed > 0.55 + flash * 0.45) continue
        const period = 1.6 + e.seed * 1.8
        const f = (secs / period + e.seed * 7) % 1
        const RUN = 0.38
        if (f > RUN) continue
        const u = f / RUN
        const [x1, y1] = pos[e.a]
        const [x2, y2] = pos[e.b]
        const px = x1 + (x2 - x1) * u
        const py = y1 + (y2 - y1) * u
        const tail = Math.max(0, u - 0.25)
        lines.line('255, 178, 74', 0.55 * on, x1 + (x2 - x1) * tail, y1 + (y2 - y1) * tail, px, py)
        sparks.push([px, py, on])
      }
    }
    lines.flush()

    // Neurons: crisp cores batched into two paths, glows stamped additively.
    const dark = new Path2D()
    const bright = new Map<number, Path2D>()
    const glows: [number, number, number, number][] = []
    net.nodes.forEach((n, i) => {
      const shown = appearOf(n)
      if (shown <= 0) return
      const [x, y] = pos[i]
      const on = lit[i]
      if (on > 0.02) {
        const twinkle = calm ? 1 : 0.78 + 0.22 * Math.sin(secs * 3 + n.seed * 40)
        // Freshly woken neurons flare, then settle.
        const fresh = 1 - Math.min(1, Math.abs(prog - n.x) * 12)
        const a = Math.round(Math.min(1, on * twinkle + fresh * 0.4) * 10) / 10
        const r = n.r * (1.05 + fresh * 0.8 + flash * 0.3)
        let p = bright.get(a)
        if (!p) bright.set(a, (p = new Path2D()))
        p.moveTo(x + r, y)
        p.arc(x, y, r, 0, Math.PI * 2)
        glows.push([x, y, r * (7 + fresh * 6 + flash * 4), a * 0.55])
      } else {
        dark.moveTo(x + n.r * 0.8, y)
        dark.arc(x, y, n.r * 0.8, 0, Math.PI * 2)
      }
    })

    ctx.globalCompositeOperation = 'lighter'
    for (const [x, y, size, a] of glows) {
      ctx.globalAlpha = vanish * a
      ctx.drawImage(glow.cyan, x - size / 2, y - size / 2, size, size)
    }
    for (const [x, y, on] of sparks) {
      ctx.globalAlpha = vanish * on
      ctx.drawImage(glow.amber, x - 9, y - 9, 18, 18)
    }
    ctx.globalCompositeOperation = 'source-over'

    ctx.globalAlpha = vanish * Math.min(1, span(t, 0.04, 0.16) + 0.3)
    ctx.fillStyle = FAINT
    ctx.fill(dark)
    ctx.fillStyle = NEURON
    for (const [a, p] of bright) {
      ctx.globalAlpha = vanish * a
      ctx.fill(p)
    }
    ctx.fillStyle = SIGNAL
    for (const [x, y, on] of sparks) {
      ctx.globalAlpha = vanish * on
      ctx.fillRect(x - 1, y - 1, 2, 2)
    }
    ctx.globalAlpha = vanish

    // The loading front: a soft vertical light sweeping the band.
    if (prog > 0 && prog < 1 && gather === 0) {
      const fx = bx + prog * W
      const g = ctx.createLinearGradient(fx, cy - H * 0.8, fx, cy + H * 0.8)
      g.addColorStop(0, 'rgba(191, 248, 255, 0)')
      g.addColorStop(0.5, 'rgba(191, 248, 255, 0.85)')
      g.addColorStop(1, 'rgba(191, 248, 255, 0)')
      ctx.fillStyle = g
      ctx.fillRect(fx - 0.5, cy - H * 0.8, 1, H * 1.6)
      const halo = ctx.createRadialGradient(fx, cy, 0, fx, cy, H * 0.9)
      halo.addColorStop(0, 'rgba(34, 208, 208, 0.16)')
      halo.addColorStop(1, 'rgba(34, 208, 208, 0)')
      ctx.fillStyle = halo
      ctx.fillRect(fx - H, cy - H, H * 2, H * 2)
    }
    ctx.restore()
  }

  // Percent and task, riding the two ends of the bar until the move begins.
  const labels = readouts * (1 - span(gather, 0, 0.25))
  if (labels > 0.02) {
    ctx.save()
    ctx.globalAlpha = labels
    ctx.font = `400 ${fs}px ${MONO}`
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = INK
    ctx.textAlign = 'right'
    ctx.fillText(String(Math.round(prog * 100)).padStart(3, '0'), bx + W, cy - H * 0.6 - fs * 0.6)
    ctx.fillStyle = DIM
    ctx.textAlign = 'left'
    const task = TASKS[Math.min(TASKS.length - 1, Math.floor(prog * TASKS.length))]
    ctx.fillText(prog >= 1 ? 'BEREIT' : task, bx, cy + H * 0.6 + fs * 1.6)
    ctx.textAlign = 'right'
    ctx.fillStyle = FAINT
    ctx.fillText(`${net.nodes.length} NEURONEN · ${net.edges.length} SYNAPSEN`, bx + W, cy + H * 0.6 + fs * 1.6)
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
    const net = buildNet()
    const glow = makeGlow()
    let first = true
    // The scene behind stays paused until the ground starts to thin (see the
    // `ground` term in draw, which begins at t = 0.84); resumed a little ahead
    // of that so its first frames are already moving when it shows through.
    const setHidden = useStore.getState().setStageHidden
    setHidden(true)
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
      if (t >= 0.78 && useStore.getState().stageHidden) setHidden(false)
      draw(ctx, w, h, t, ms, now, facts, net, glow, Boolean(reduced))
      // The canvas paints its own ground from here on (see draw), so the
      // overlay's CSS background has to step aside for it to be able to thin
      // out. Not before the first frame, or the live scene would show for one.
      if (first && cv.parentElement) {
        cv.parentElement.style.background = 'transparent'
        first = false
      }

      // Keeps running past t = 1: the clock readout and the travelling arc are
      // still live while the overlay waits to hand over. Stopped by cleanup.
      raf = requestAnimationFrame(frame)
    }

    frame()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      // However the sequence ends — run out, skipped, or failed — the stage
      // must never be left paused.
      setHidden(false)
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
