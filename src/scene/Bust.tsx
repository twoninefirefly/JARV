import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Drive } from './Scene'
import { HIST, VOICE_AT } from './voice'
import { BUST_SCALE } from './layout'

/**
 * The figure: head, neck and shoulders, drawn in horizontal contour lines of
 * light, with the reactor burning in its face.
 *
 * No model file. The body is a stack of cross-sections — one ellipse per
 * height, its half-width, half-depth and centre given by a profile — sampled
 * densely enough along each ring that the points read as lines. That is also
 * exactly the look: a topographic figure, lit at its edges, rather than a
 * shaded mannequin. A handful of local offsets on the front of the head give
 * it a nose, brow, eye sockets, lips and ears, so the contour lines bend round
 * a face instead of wrapping an egg.
 *
 * Units: the profile is written in head heights, chin at 0 and crown at 1,
 * negative below the chin. World position is (u - 0.5) * BUST_SCALE, which
 * puts the middle of the face — where the core sits — at the world origin.
 */

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const gauss = (x: number, s: number) => Math.exp(-(x * x) / (s * s))

type Section = { a: number; b: number; cz: number }

/** The skull: a rounded jaw widening to the cheekbones, then a dome. */
function head(u: number): Section {
  const q = clamp01(u / 0.62)
  if (u > 0.62) {
    const dome = Math.sqrt(Math.max(0, 1 - ((u - 0.62) / 0.38) ** 2))
    return { a: 0.36 * dome, b: 0.44 * dome, cz: -0.04 - 0.06 * u }
  }
  return {
    a: 0.17 + 0.19 * Math.pow(Math.sin((q * Math.PI) / 2), 0.7),
    b: 0.22 + 0.22 * Math.pow(Math.sin((q * Math.PI) / 2), 0.6),
    cz: -0.04 - 0.06 * u,
  }
}

/** Head, neck and shoulders as one profile. */
function profile(u: number): Section {
  if (u < -0.1) {
    // The shoulder line leaves the neck on a gentle slope — the trapezius —
    // then rounds down over the deltoid: width grows quickly at first, then
    // levels off, and eases in so the neck does not end on a shelf.
    const s = clamp01((-0.1 - u) / 0.7)
    const g = smooth(0, 0.18, s) * (1 - Math.pow(1 - s, 2.4))
    return {
      a: 0.2 + 0.88 * g,
      b: 0.19 + 0.21 * Math.pow(s, 0.7),
      cz: -0.08 + 0.04 * s,
    }
  }
  // The jaw closes onto the neck over a short span around the chin.
  const h = head(clamp01(u))
  const w = smooth(-0.1, 0.14, u)
  return { a: mix(0.2, h.a, w), b: mix(0.19, h.b, w), cz: mix(-0.08, h.cz, w) }
}

/** The face, as offsets toward the viewer on the front of the head. */
function face(u: number, x: number): number {
  if (u < 0.12 || u > 0.72) return 0
  const nose =
    (gauss(u - 0.4, 0.09) * 0.8 + gauss(u - 0.52, 0.08) * 0.35) * gauss(x, 0.055) * 0.075
  const eyes = -gauss(u - 0.56, 0.05) * gauss(Math.abs(x) - 0.13, 0.06) * 0.035
  const brow = gauss(u - 0.63, 0.035) * gauss(x, 0.22) * 0.018
  const lips = gauss(u - 0.23, 0.035) * gauss(x, 0.09) * 0.022
  return nose + eyes + brow + lips
}

type Built = {
  position: Float32Array
  normal: Float32Array
  seed: Float32Array
  kind: Float32Array
  count: number
}

/**
 * Sample the body into points. Front-facing and silhouette points are kept;
 * most of the back is dropped (it would only add clutter through the additive
 * front) except a thin scatter for depth.
 */
function build(): Built {
  let st = 29
  const rnd = () => (st = (st * 16807) % 2147483647) / 2147483647
  const S = BUST_SCALE
  const pos: number[] = []
  const nrm: number[] = []
  const seed: number[] = []
  const kind: number[] = []

  const TOP = 1.0
  const BOTTOM = -1.75
  const DU = 0.018 // between contour lines, in head heights
  for (let u = TOP - DU * 0.5; u > BOTTOM; u -= DU) {
    const { a, b, cz } = profile(u)
    if (a < 0.004) continue
    // Slope of the profile, for the vertical part of the normal: the crown and
    // the tops of the shoulders face up, and the rim light should know it.
    const up = (profile(u - 0.01).a - profile(u + 0.01).a) / 0.02
    const perim = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))
    // Spacing along the ring in head units; the shoulders are sampled a little
    // more loosely, they are the least looked-at part of the figure.
    const spacing = 0.0068 * (1 + 0.6 * clamp01((-0.2 - u) / 1.2))
    const n = Math.max(12, Math.floor(perim / spacing))
    for (let i = 0; i < n; i++) {
      const th = (i / n + rnd() * 0.3 / n) * Math.PI * 2
      const c = Math.cos(th)
      const s = Math.sin(th)
      let nx = c / a
      let nz = s / b
      const len = Math.hypot(nx, nz)
      nx /= len
      nz /= len
      // Drop most of the back; keep a sparse scatter for depth.
      if (nz < -0.35 && rnd() > 0.1) continue
      let x = a * c
      let z = cz + b * s
      if (nz > 0) z += face(u, x) * smooth(0, 0.6, nz)
      // Ears: small outward bumps at the sides of the head.
      if (u > 0.36 && u < 0.66) x += Math.sign(x) * 0.04 * gauss(u - 0.5, 0.07) * gauss(s, 0.3)
      const jitter = 0.0025
      pos.push(
        (x + (rnd() - 0.5) * jitter) * S,
        (u - 0.5 + (rnd() - 0.5) * jitter) * S,
        (z + (rnd() - 0.5) * jitter) * S,
      )
      const ny = up * 0.6
      const nl = Math.hypot(nx, ny, nz)
      nrm.push(nx / nl, ny / nl, nz / nl)
      seed.push(rnd())
      kind.push(0)
    }
  }

  // The aura: motes lifting off the crown and the back of the head, the spray
  // the reference figure trails. Seeded on the upper surface; their drift is
  // done in the shader.
  for (let i = 0; i < 3200; i++) {
    const u = 0.66 + rnd() * 0.34
    const { a, b, cz } = profile(u)
    const th = rnd() * Math.PI * 2
    const c = Math.cos(th)
    const s = Math.sin(th)
    pos.push(a * c * S, (u - 0.5) * S, (cz + b * s) * S)
    const nl = Math.hypot(c / a, 0.8, s / b)
    nrm.push(c / a / nl, 0.8 / nl, s / b / nl)
    seed.push(rnd())
    kind.push(1)
  }

  return {
    position: new Float32Array(pos),
    normal: new Float32Array(nrm),
    seed: new Float32Array(seed),
    kind: new Float32Array(kind),
    count: seed.length,
  }
}

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uForm;
  uniform float uListen;
  uniform float uSpeak;
  uniform float uLevel;
  uniform float uPixel;
  uniform float uSize;
  uniform float uHist[${HIST}];

  attribute vec3 aNormal;
  attribute float aSeed;
  attribute float aKind;

  varying vec3 vColor;
  varying float vAlpha;

  ${VOICE_AT}

  void main() {
    vec3 target = position;
    float dist = length(target);

    // Forming: every point streams out of the core (the origin) to its place,
    // nearest first, on a curving path so the figure pours out rather than
    // scaling up.
    float delay = clamp(dist / 3.4, 0.0, 1.0) * 0.55 + aSeed * 0.18;
    float e = smoothstep(delay, delay + 0.3, uForm);
    vec3 side = normalize(cross(target + vec3(0.0, 0.0, 0.001), vec3(0.0, 1.0, 0.0)));
    vec3 p = target * e + side * sin(3.14159 * e) * dist * 0.35;

    // Aura motes drift up and away from the head and fade as they go.
    float drift = 0.0;
    if (aKind > 0.5) {
      drift = fract(uTime * (0.05 + aSeed * 0.07) + aSeed * 13.0);
      p += (aNormal * 0.45 + vec3(0.0, 0.9, 0.0)) * drift * 0.8;
    }

    vec4 world = modelMatrix * vec4(p, 1.0);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;

    vec3 nView = normalize(normalMatrix * aNormal);
    float facing = nView.z;
    float rim = 1.0 - abs(facing);

    // Voice: speaking sends light outward over the body from the core,
    // listening draws it inward from the edges — the same two gestures as the
    // core itself, carried across the whole figure.
    float V = 1.15;
    float wave = voiceAt(dist / V) * uSpeak + voiceAt((3.4 - dist) / V) * uListen;
    wave = clamp(wave * 2.2, 0.0, 1.4);

    float shimmer = 0.78 + 0.22 * sin(uTime * 1.3 + aSeed * 40.0);

    // Warm around the core, on the face: the lines nearest it catch its light.
    // Sized to most of the face, strongest at its centre: the reference's
    // orange glow is the face's own contour lines burning, not a disc on it.
    vec2 fromCore = vec2(world.x, world.y * 0.85);
    float warm = exp(-dot(fromCore, fromCore) / 0.42) * smoothstep(-0.2, 0.4, world.z);

    vec3 blue = vec3(0.12, 0.5, 1.0);
    vec3 hot = vec3(0.72, 0.92, 1.0);
    vec3 amber = vec3(1.0, 0.55, 0.16);
    vec3 col = mix(blue, hot, clamp(pow(rim, 3.0) * 1.1 + wave * 0.5, 0.0, 1.0));
    col = mix(col, amber, clamp(warm * (1.15 + 0.3 * uLevel), 0.0, 1.0));

    float a = (0.34 + pow(rim, 2.2) * 0.95 + wave * 0.6 + warm * (1.5 + 0.6 * uLevel)) * shimmer;
    a *= facing < 0.0 ? 0.3 : 1.0;
    a *= e;
    if (aKind > 0.5) a = 0.55 * pow(1.0 - drift, 1.5) * e * shimmer;

    vColor = col;
    vAlpha = a;
    gl_PointSize = uSize * uPixel * (1.0 + rim * 0.5 + wave * 0.5) * (6.2 / -mv.z);
  }
`

const fragment = /* glsl */ `
  uniform float uIntensity;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float falloff = 1.0 - smoothstep(0.0, 0.5, r);
    gl_FragColor = vec4(vColor, vAlpha * falloff * uIntensity);
  }
`

export function Bust({ drive }: { drive: Drive }) {
  const pts = useRef<THREE.Points>(null)
  const mat = useRef<THREE.ShaderMaterial>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  const built = useMemo(build, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uForm: { value: 0 },
      uListen: { value: 0 },
      uSpeak: { value: 0 },
      uLevel: { value: 0 },
      uPixel: { value: 1 },
      uSize: { value: 1.7 },
      uIntensity: { value: 1 },
      uHist: { value: drive.hist },
    }),
    [drive],
  )

  useFrame((state, dt) => {
    if (!mat.current || !pts.current) return
    const u = mat.current.uniforms
    const t = state.clock.elapsedTime
    u.uTime.value = t
    u.uForm.value = drive.form
    u.uListen.value = drive.listen
    u.uSpeak.value = drive.speak
    u.uLevel.value += (drive.level - u.uLevel.value) * Math.min(1, dt * 8)
    u.uPixel.value = dpr
    u.uIntensity.value = drive.reactor.intensity
    pts.current.visible = drive.reactor.visible
    // A slow turn of the head keeps it alive at rest; listening leans it in
    // toward you by a couple of degrees.
    pts.current.rotation.y = Math.sin(t * 0.17) * 0.06
    pts.current.rotation.x = drive.listen * 0.035
  })

  return (
    <points ref={pts} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[built.position, 3]} />
        <bufferAttribute attach="attributes-aNormal" args={[built.normal, 3]} />
        <bufferAttribute attach="attributes-aSeed" args={[built.seed, 1]} />
        <bufferAttribute attach="attributes-aKind" args={[built.kind, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
