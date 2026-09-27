import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Drive } from './Scene'
import { BUST_SCALE } from './layout'

/**
 * Nerves: amber branching lines running from under the chin down the front of
 * the neck and out across the chest, with light pulsing along them away from
 * the core. The warm counterpart to the cold figure — the core's fire, carried
 * down into the body.
 *
 * Grown once from a fixed seed as random walks that fork, and laid on the
 * front surface of the same profile the figure uses, so they sit on the body
 * rather than floating in front of it.
 */

/** Front surface depth of the figure at height u, horizontal offset x (head units). */
function frontZ(u: number, x: number): number {
  // Must agree with profile() in Bust.tsx for the neck and chest.
  let a: number
  let b: number
  let cz: number
  if (u < -0.1) {
    const s = Math.min(1, Math.max(0, (-0.1 - u) / 0.7))
    const e = Math.min(1, s / 0.18)
    const g = e * e * (3 - 2 * e) * (1 - Math.pow(1 - s, 2.4))
    a = 0.2 + 0.88 * g
    b = 0.19 + 0.21 * Math.pow(s, 0.7)
    cz = -0.08 + 0.04 * s
  } else {
    a = 0.2
    b = 0.19
    cz = -0.08
  }
  const q = Math.min(0.98, Math.abs(x) / a)
  return cz + b * Math.sqrt(1 - q * q) + 0.004
}

type Built = { position: Float32Array; along: Float32Array; seed: Float32Array }

function build(): Built {
  let st = 909
  const rnd = () => (st = (st * 16807) % 2147483647) / 2147483647
  const S = BUST_SCALE
  const pos: number[] = []
  const along: number[] = []
  const seed: number[] = []

  type Tip = { x: number; u: number; dir: number; life: number; t: number; s: number }
  const tips: Tip[] = []
  for (let i = 0; i < 3; i++) {
    tips.push({ x: (rnd() - 0.5) * 0.08, u: 0.02, dir: (rnd() - 0.5) * 0.4, life: 1, t: 0, s: rnd() })
  }
  let guard = 0
  while (tips.length && guard++ < 4000) {
    const tip = tips.pop() as Tip
    let { x, u, dir, t } = tip
    const steps = 12 + Math.floor(rnd() * 22 * tip.life)
    for (let k = 0; k < steps; k++) {
      const du = 0.022
      // Wander, and spread outward as the lines reach the chest.
      dir += (rnd() - 0.5) * 0.5
      dir *= 0.85
      const spread = u < -0.14 ? Math.sign(x || rnd() - 0.5) * 0.45 * Math.min(1, (-0.14 - u) * 2) : 0
      const nx = x + (dir + spread) * du
      const nu = u - du
      const width = u < -0.12 ? 0.6 : 0.15
      if (Math.abs(nx) > width || nu < -0.62) break
      const t2 = t + 0.02
      pos.push(x * S, (u - 0.5) * S, frontZ(u, x) * S, nx * S, (nu - 0.5) * S, frontZ(nu, nx) * S)
      along.push(t, t2)
      seed.push(tip.s, tip.s)
      x = nx
      u = nu
      t = t2
      if (rnd() < 0.06 && tip.life > 0.3) {
        tips.push({ x, u, dir: dir + (rnd() < 0.5 ? -0.6 : 0.6), life: tip.life * 0.6, t, s: rnd() })
      }
    }
  }
  return {
    position: new Float32Array(pos),
    along: new Float32Array(along),
    seed: new Float32Array(seed),
  }
}

const vertex = /* glsl */ `
  attribute float aAlong;
  attribute float aSeed;
  varying float vAlong;
  varying float vSeed;
  void main() {
    vAlong = aAlong;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uForm;
  uniform float uLevel;
  uniform float uSpeak;
  varying float vAlong;
  varying float vSeed;
  void main() {
    // Pulses leave the core and travel down; faster and brighter while he
    // speaks, so the body visibly carries the voice.
    float rate = 0.28 + uSpeak * (0.3 + uLevel * 0.8);
    float head = fract(uTime * rate + vSeed * 3.0);
    float pulse = exp(-pow((vAlong * 0.9 - head) * 7.0, 2.0));
    float base = 0.16 * (1.0 - smoothstep(0.15, 0.7, vAlong));
    // Grow in with the figure, from the chin down.
    float grown = smoothstep(vAlong * 0.6 + 0.35, vAlong * 0.6 + 0.55, uForm);
    float a = (base + pulse * (0.6 + uSpeak * uLevel)) * grown;
    gl_FragColor = vec4(vec3(1.0, 0.62, 0.22), a);
  }
`

export function Veins({ drive }: { drive: Drive }) {
  const lines = useRef<THREE.LineSegments>(null)
  const mat = useRef<THREE.ShaderMaterial>(null)
  const built = useMemo(build, [])
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uForm: { value: 0 },
      uLevel: { value: 0 },
      uSpeak: { value: 0 },
    }),
    [],
  )

  useFrame((state, dt) => {
    if (!mat.current || !lines.current) return
    const u = mat.current.uniforms
    const t = state.clock.elapsedTime
    u.uTime.value = t
    u.uForm.value = drive.form
    u.uSpeak.value = drive.speak
    u.uLevel.value += (drive.level - u.uLevel.value) * Math.min(1, dt * 8)
    lines.current.visible = drive.reactor.visible
    // Turn with the figure.
    lines.current.rotation.y = Math.sin(t * 0.17) * 0.06
    lines.current.rotation.x = drive.listen * 0.035
  })

  return (
    <lineSegments ref={lines} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[built.position, 3]} />
        <bufferAttribute attach="attributes-aAlong" args={[built.along, 1]} />
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
    </lineSegments>
  )
}
