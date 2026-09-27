import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Drive } from './Scene'

/**
 * Mountains behind the figure: a range of light points, low behind the head
 * and rising toward both edges, with amber veins running through it like lava
 * in the dark. Pure setting — it does not react to the voice, so the figure
 * stays the only thing on screen that is listening.
 *
 * A jittered grid over a ridged noise heightfield, built once. The veins are
 * an iso-line of a second noise field: points lying on it are drawn warm and
 * brighter, which traces thin rivers across the slopes.
 */

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

function noise(x: number, y: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash(ix, iy)
  const b = hash(ix + 1, iy)
  const c = hash(ix, iy + 1)
  const d = hash(ix + 1, iy + 1)
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

/** Ridged multifractal: sharp crests, soft valleys. 0..~1. */
function ridged(x: number, y: number): number {
  let v = 0
  let amp = 0.55
  let f = 1
  for (let i = 0; i < 5; i++) {
    const n = 1 - Math.abs(noise(x * f, y * f) * 2 - 1)
    v += n * n * amp
    f *= 2.03
    amp *= 0.5
  }
  return v
}

type Built = { position: Float32Array; tone: Float32Array; vein: Float32Array; seed: Float32Array }

function build(): Built {
  let st = 4242
  const rnd = () => (st = (st * 16807) % 2147483647) / 2147483647
  const pos: number[] = []
  const tone: number[] = []
  const vein: number[] = []
  const seed: number[] = []
  const X0 = -9.5
  const X1 = 9.5
  const Z0 = -6
  const Z1 = -1.6
  const DX = 0.036
  const DZ = 0.085
  for (let z = Z0; z <= Z1; z += DZ) {
    for (let x = X0; x <= X1; x += DX) {
      const jx = x + (rnd() - 0.5) * DX * 0.8
      const jz = z + (rnd() - 0.5) * DZ * 0.8
      const side = Math.min(1, Math.max(0, (Math.abs(jx) - 0.6) / 3.6))
      const envelope = 0.18 + 0.82 * side * side * (3 - 2 * side)
      const h = ridged(jx * 0.32 + 7, jz * 0.32 + 3) * envelope
      const y = -2.9 + h * 3.6
      // Skip most of the flat valley floor: a carpet of points there only
      // greys out the bottom of the frame.
      if (h < 0.08 && rnd() > 0.25) continue
      pos.push(jx, y, jz)
      tone.push(Math.min(1, h * 1.6))
      const n = noise(jx * 0.55 + 20, jz * 0.9 + 5)
      vein.push(Math.max(0, 1 - Math.abs(n - 0.5) / 0.03) * Math.min(1, h * 3))
      seed.push(rnd())
    }
  }
  return {
    position: new Float32Array(pos),
    tone: new Float32Array(tone),
    vein: new Float32Array(vein),
    seed: new Float32Array(seed),
  }
}

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uForm;
  uniform float uPixel;
  attribute float aTone;
  attribute float aVein;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = smoothstep(-14.0, -7.0, mv.z);
    float shimmer = 0.75 + 0.25 * sin(uTime * (0.6 + aSeed) + aSeed * 50.0);
    vec3 blue = mix(vec3(0.05, 0.25, 0.7), vec3(0.3, 0.7, 1.0), aTone);
    vec3 amber = vec3(1.0, 0.6, 0.2);
    vColor = mix(blue, amber, aVein);
    // Arrives after the figure: the setting fills in once he is there.
    float shown = smoothstep(0.45, 1.0, uForm);
    vAlpha = (0.3 + aTone * 0.9 + aVein * 1.1) * depth * shimmer * shown;
    gl_PointSize = (1.3 + aVein * 1.0) * uPixel * (7.0 / -mv.z);
  }
`

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    gl_FragColor = vec4(vColor, vAlpha * (1.0 - smoothstep(0.0, 0.5, r)));
  }
`

export function Terrain({ drive }: { drive: Drive }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  const built = useMemo(build, [])
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uForm: { value: 0 }, uPixel: { value: 1 } }),
    [],
  )
  useFrame((state) => {
    if (!mat.current) return
    const u = mat.current.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uForm.value = drive.form
    u.uPixel.value = dpr
  })
  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[built.position, 3]} />
        <bufferAttribute attach="attributes-aTone" args={[built.tone, 1]} />
        <bufferAttribute attach="attributes-aVein" args={[built.vein, 1]} />
        <bufferAttribute attach="attributes-aSeed" args={[built.seed, 1]} />
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
