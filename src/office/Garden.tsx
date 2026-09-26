import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useOffice } from './state'

/**
 * Secret Garden: typed into the search, a lawn spreads out under the office,
 * grass and daisies sway in the wind, and pink roses push out of the ground
 * one after another and slowly open.
 *
 * Everything is built from code at first use: the petals are curved surfaces
 * that morph from a closed bud to an open bloom, grass and daisies are
 * instanced and moved by the wind on the GPU.
 */

const LAWN_R = 15

type V3 = [number, number, number]
const seeded = (seed: number) => {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** A surface over u ∈ [-1, 1], v ∈ [0, 1] with a colour per vertex. */
function grid(nu: number, nv: number, at: (u: number, v: number) => V3, col: (u: number, v: number) => V3) {
  const pos: number[] = []
  const color: number[] = []
  const idx: number[] = []
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * 2 - 1
      const v = j / nv
      pos.push(...at(u, v))
      color.push(...col(u, v))
    }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i
      const c = a + nu + 1
      idx.push(a, c, a + 1, a + 1, c, c + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** A stock geometry in one colour, ready to merge with the grids. */
function paint(g: THREE.BufferGeometry, rgb: V3, m?: THREE.Matrix4) {
  g.deleteAttribute('uv')
  if (m) g.applyMatrix4(m)
  const n = g.attributes.position.count
  const c = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) c.set(rgb, i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  return g
}

// ---------------------------------------------------------------------------
// Rose
// ---------------------------------------------------------------------------

type Petal = { len: number; wid: number; r0: number; y0: number; phi: number; t: number }
type Pose = (t: number) => { theta: number; curl: number; cup: number; roll: number }

/** Bud: every petal upright and tucked in round the heart. */
const BUD: Pose = (t) => ({ theta: 0.03 + 0.14 * t, curl: -0.6 + 0.3 * t, cup: 0.32, roll: 0 })
/** A rose, not a daisy: the heart stays a closed spiral, only the outer petals
 *  loosen a little and turn their rims back — the classic high-centred rose. */
const BLOOM: Pose = (t) => ({
  theta: 0.05 + 0.5 * t * t,
  curl: t < 0.45 ? -0.5 + 0.2 * t : -0.4 + 1.05 * (t - 0.45),
  cup: 0.34 - 0.1 * t,
  roll: 0.45 * t * t,
})

/** One petal: a centre line bending out from the base, the blade wrapped round the axis. */
function petal(p: Petal, pose: Pose) {
  const s = pose(p.t)
  return grid(
    6,
    8,
    (u, v) => {
      let r = p.r0
      let y = p.y0
      const steps = 12
      for (let k = 0; k < steps; k++) {
        const vv = ((k + 0.5) / steps) * v
        const th = s.theta + s.curl * vv * vv
        r += (Math.sin(th) * p.len * v) / steps
        y += (Math.cos(th) * p.len * v) / steps
      }
      const th = s.theta + s.curl * v * v
      const w = p.wid * 0.5 * (0.15 + 0.85 * Math.sin(Math.PI * (0.08 + 0.8 * v)))
      // Edges cup inward low down and roll back near the rim.
      const off = w * u * u * (-s.cup + s.roll * v * v)
      const rr = Math.max(0.001, r + off * Math.cos(th))
      const a = p.phi + (u * w) / (rr + 0.02)
      return [Math.cos(a) * rr, y - off * Math.sin(th), Math.sin(a) * rr]
    },
    (u, v) => {
      // Deeper at the base and in the heart, lighter towards the rim.
      const g = (0.5 + 0.5 * v) * (0.72 + 0.28 * p.t) + 0.07 * Math.abs(u) * v
      return [g, g * 0.96, g]
    },
  )
}

/** A rose head whose one morph target opens it from bud to bloom. */
function roseHead(seed: number) {
  const r = seeded(seed)
  const N = 22
  const petals: Petal[] = []
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1)
    petals.push({
      t,
      len: (0.04 + 0.078 * Math.pow(t, 0.7)) * (0.93 + r() * 0.14),
      wid: 0.03 + 0.078 * t,
      r0: 0.003 + 0.02 * t,
      y0: -0.012 * t,
      phi: i * 2.39996 + (r() - 0.5) * 0.35,
    })
  }
  const bud = mergeGeometries(petals.map((p) => petal(p, BUD)))!
  const bloom = mergeGeometries(petals.map((p) => petal(p, BLOOM)))!
  bud.morphAttributes.position = [bloom.attributes.position]
  bud.morphAttributes.normal = [bloom.attributes.normal]
  return bud
}

/** A serrated leaflet along +x, folded along its midrib. */
function leaflet(L: number, W: number) {
  return grid(
    4,
    14,
    (u, v) => {
      const w = W * 0.5 * Math.pow(Math.sin(Math.PI * (0.02 + 0.96 * v)), 0.75) * (1 + 0.09 * Math.sin(v * 28))
      return [v * L, Math.abs(u) * w * 0.45 - v * v * L * 0.25, u * w]
    },
    (u, v) => [0.07 + 0.05 * v, 0.2 + 0.08 * v - 0.04 * Math.abs(u), 0.05],
  )
}

/** Stem, thorns, two leaves, hip and sepals; the head sits at `top` facing along `dir`. */
function roseStem(seed: number) {
  const r = seeded(seed)
  const h = 0.3 + r() * 0.22
  const bx = (r() - 0.5) * 0.07
  const bz = (r() - 0.5) * 0.07
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bx * 0.25, h * 0.35, bz * 0.2),
    new THREE.Vector3(bx * 0.75, h * 0.7, bz * 0.65),
    new THREE.Vector3(bx, h, bz),
  ])
  const green: V3 = [0.05, 0.14, 0.035]
  const parts: THREE.BufferGeometry[] = [paint(new THREE.TubeGeometry(curve, 20, 0.0085, 6), green)]
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)

  // Thorns, pointing out and a little up.
  for (let k = 0; k < 5; k++) {
    const a = r() * Math.PI * 2
    const dir = new THREE.Vector3(Math.cos(a), 0.5, Math.sin(a)).normalize()
    const p = curve.getPoint(0.12 + k * 0.16).addScaledVector(dir, 0.008)
    m.compose(p, q.setFromUnitVectors(up, dir), new THREE.Vector3(1, 1, 1))
    parts.push(paint(new THREE.ConeGeometry(0.0045, 0.018, 5).translate(0, 0.009, 0), [0.2, 0.06, 0.03], m))
  }

  // Two leaves of three leaflets each on a short stalk.
  for (const [at, a0] of [
    [0.38, r() * 6.28],
    [0.62, r() * 6.28 + 2.6],
  ] as const) {
    const base = curve.getPoint(at)
    const out = new THREE.Vector3(Math.cos(a0), 0.55, Math.sin(a0)).normalize()
    const end = base.clone().addScaledVector(out, 0.06)
    parts.push(paint(new THREE.TubeGeometry(new THREE.LineCurve3(base, end), 2, 0.003, 4), green))
    const leafAt = (p: THREE.Vector3, yaw: number, size: number, tilt: number) => {
      const e = new THREE.Euler(0, -yaw, tilt, 'YXZ')
      m.compose(p, q.setFromEuler(e), new THREE.Vector3(size, size, size))
      parts.push(leaflet(0.075, 0.042).applyMatrix4(m))
    }
    leafAt(end, a0, 1, 0.25)
    const mid = base.clone().lerp(end, 0.55)
    leafAt(mid, a0 + 1.1, 0.78, 0.15)
    leafAt(mid, a0 - 1.1, 0.78, 0.15)
  }

  // The head sits on the tip, facing the way the stem ends.
  const top = curve.getPoint(1)
  const dir = curve.getTangent(1).normalize()
  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir)
  m.compose(top, quat, new THREE.Vector3(1, 1, 1))
  parts.push(paint(new THREE.SphereGeometry(0.016, 10, 8).scale(1, 0.85, 1).translate(0, -0.004, 0), [0.07, 0.17, 0.05], m))
  for (let k = 0; k < 5; k++) {
    const sepal = petal({ t: 1, len: 0.05, wid: 0.014, r0: 0.012, y0: -0.004, phi: (k / 5) * Math.PI * 2 + 0.3 }, () => ({ theta: 1.9, curl: 0.8, cup: 0.2, roll: 0 }))
    const n = sepal.attributes.color.count
    for (let i = 0; i < n; i++) sepal.attributes.color.setXYZ(i, 0.06, 0.16, 0.045)
    parts.push(sepal.applyMatrix4(m))
  }
  return { geo: mergeGeometries(parts)!, top: top.clone().addScaledVector(dir, 0.004), quat }
}

const TINTS = ['#ff4f98', '#ff7eb6', '#e0357c', '#ffa6cc', '#f25c9e']

// ---------------------------------------------------------------------------
// Grass and daisies: instanced, grown and blown about in the vertex shader
// ---------------------------------------------------------------------------

type Wind = { uTime: { value: number }; uFront: { value: number } }

/** Grows each instance as the lawn's edge passes it, and bends its top in the wind. */
function windy(mat: THREE.Material, u: Wind, amp: number, invLen: number, lag: number) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = u.uTime
    sh.uniforms.uFront = u.uFront
    sh.vertexShader =
      'uniform float uTime;\nuniform float uFront;\n' +
      sh.vertexShader
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vec3 gIp = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
float gGrow = clamp((uFront - length(gIp.xz) - ${lag.toFixed(2)}) / 2.5, 0.0, 1.0);
gGrow = gGrow * gGrow * (3.0 - 2.0 * gGrow);
float gH = clamp(position.y * ${invLen.toFixed(3)}, 0.0, 1.0);
transformed *= max(gGrow, 0.0001);`,
        )
        .replace(
          '#include <project_vertex>',
          THREE.ShaderChunk.project_vertex.replace(
            'mvPosition = modelViewMatrix * mvPosition;',
            `{
  float gust = 0.5 + 0.5 * sin(gIp.x * 0.33 + gIp.z * 0.12 - uTime * 1.1);
  float w1 = sin(uTime * 2.1 + gIp.x * 1.3 + gIp.z * 0.9);
  float w2 = sin(uTime * 3.3 + gIp.z * 1.9 - gIp.x * 0.7);
  vec2 dir = vec2(0.94, 0.34);
  vec2 off = (dir * (0.25 + 0.75 * gust) * (0.75 + 0.35 * w1) + vec2(-dir.y, dir.x) * w2 * 0.3) * ${amp.toFixed(3)} * gH * gH * gGrow;
  mvPosition.xz += off;
  mvPosition.y -= dot(off, off) * 3.0 * gH;
}
mvPosition = modelViewMatrix * mvPosition;`,
          ),
        )
  }
  mat.customProgramCacheKey = () => `windy-${amp}-${invLen}-${lag}`
}

/** One blade, one unit tall, curving forward; lit as if facing up so the lawn reads soft. */
function bladeGeo() {
  const pos: number[] = []
  const col: number[] = []
  const idx: number[] = []
  const S = 4
  for (let j = 0; j <= S; j++) {
    const y = j / S
    const hw = 0.5 * Math.pow(1 - y, 0.75)
    const z = 0.3 * y * y
    pos.push(-hw, y, z, hw, y, z)
    const c: V3 = [0.025 + 0.16 * y, 0.075 + 0.33 * y, 0.018 + 0.07 * y]
    col.push(...c, ...c)
    if (j < S) idx.push(j * 2, j * 2 + 1, j * 2 + 2, j * 2 + 1, j * 2 + 3, j * 2 + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  const n = new THREE.Vector3(0, 1, -0.35).normalize()
  const nrm: number[] = []
  for (let i = 0; i < pos.length / 3; i++) nrm.push(n.x, n.y, n.z)
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setIndex(idx)
  return g
}

const DAISY_H = 0.26

/** A daisy: stem, a few leaves at the ground, white rays round a yellow heart. */
function daisyGeo() {
  const parts: THREE.BufferGeometry[] = [paint(new THREE.CylinderGeometry(0.0028, 0.0035, DAISY_H, 5).translate(0, DAISY_H / 2, 0), [0.05, 0.15, 0.035])]
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  for (let k = 0; k < 3; k++) {
    m.compose(new THREE.Vector3(0, 0.004, 0), q.setFromEuler(new THREE.Euler(0, (k / 3) * 6.28, 0.3)), new THREE.Vector3(0.6, 0.6, 0.6))
    parts.push(leaflet(0.075, 0.03).applyMatrix4(m))
  }
  const top = DAISY_H
  const rays = 16
  for (let k = 0; k < rays; k++) {
    const a = (k / rays) * Math.PI * 2 + (k % 2) * 0.1
    parts.push(
      grid(
        2,
        3,
        (u, v) => {
          const r = 0.009 + v * 0.028
          const side = u * 0.0042 * Math.sin(Math.PI * (0.15 + 0.8 * v))
          return [Math.cos(a) * r - Math.sin(a) * side, top + 0.004 * v - 0.008 * v * v + 0.0015 * Math.abs(u), Math.sin(a) * r + Math.cos(a) * side]
        },
        (_, v) => [0.92, 0.9 - 0.08 * v * v, 0.88 - 0.05 * v * v],
      ),
    )
  }
  parts.push(paint(new THREE.SphereGeometry(0.011, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1).translate(0, top, 0), [0.95, 0.55, 0.02]))
  return mergeGeometries(parts)!
}

function lawnTexture() {
  const S = 1024
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const g = cv.getContext('2d')!
  g.fillStyle = '#2f5f27'
  g.fillRect(0, 0, S, S)
  const r = seeded(3)
  const greens = ['#3b7430', '#2a5421', '#4a8a3b', '#24481c', '#56963f']
  for (let i = 0; i < 26000; i++) {
    const x = r() * S
    const y = r() * S
    g.strokeStyle = greens[Math.floor(r() * greens.length)]
    g.globalAlpha = 0.35 + r() * 0.4
    g.lineWidth = 1 + r() * 1.5
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 6)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(9, 9)
  t.anisotropy = 8
  return t
}

// ---------------------------------------------------------------------------
// The finale: a jet streaks across once, low and fast, contrails behind it.
// ---------------------------------------------------------------------------

function trailTexture() {
  const cv = document.createElement('canvas')
  cv.width = 256
  cv.height = 8
  const g = cv.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 256, 0)
  grad.addColorStop(0, 'rgba(255,255,255,0.9)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 8)
  return new THREE.CanvasTexture(cv)
}

const JET_TIME = 1.9 // seconds across the whole sky

function Jet({ onDone }: { onDone: () => void }) {
  const { camera } = useThree()
  const ref = useRef<THREE.Group>(null)
  const trails = useRef<(THREE.Mesh | null)[]>([])
  const t = useRef(0)
  const parts = useMemo(() => {
    const body = new THREE.MeshStandardMaterial({ color: '#c9ced6', roughness: 0.35, metalness: 0.6 })
    const dark = new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.4, metalness: 0.5 })
    const glass = new THREE.MeshStandardMaterial({ color: '#10151d', roughness: 0.05, metalness: 0.9 })
    const flame = new THREE.MeshBasicMaterial({ color: '#ffb35c', toneMapped: false })
    // Delta wing and fins as flat shapes, the jet flying along +x.
    const wing = new THREE.Shape([new THREE.Vector2(0.35, 0), new THREE.Vector2(-0.45, 0.62), new THREE.Vector2(-0.62, 0.62), new THREE.Vector2(-0.55, 0)])
    const fin = new THREE.Shape([new THREE.Vector2(-0.35, 0), new THREE.Vector2(-0.62, 0.34), new THREE.Vector2(-0.72, 0.34), new THREE.Vector2(-0.66, 0)])
    const extrude = (sh: THREE.Shape) => new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: false })
    const trail = new THREE.MeshBasicMaterial({ map: trailTexture(), transparent: true, depthWrite: false, side: THREE.DoubleSide })
    return { body, dark, glass, flame, wingGeo: extrude(wing), finGeo: extrude(fin), trail, trailGeo: new THREE.PlaneGeometry(1, 0.07).translate(-0.5, 0, 0) }
  }, [])

  // Across the view: through the middle of the garden, side to side as the camera sees it.
  const path = useMemo(() => {
    const look = new THREE.Vector3()
    camera.getWorldDirection(look)
    look.y = 0
    look.normalize()
    const side = new THREE.Vector3(-look.z, 0, look.x)
    const mid = new THREE.Vector3(0, 4.2, 0).addScaledVector(look, 2)
    return { from: mid.clone().addScaledVector(side, -38), to: mid.clone().addScaledVector(side, 38).add(new THREE.Vector3(0, 1.6, 0)), side }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, dt) => {
    const g = ref.current
    if (!g) return
    t.current += dt
    const k = t.current / JET_TIME
    if (k >= 1.35) {
      onDone()
      return
    }
    g.position.lerpVectors(path.from, path.to, Math.min(k, 1.35))
    g.lookAt(g.position.clone().add(path.side.clone().add(new THREE.Vector3(0, 0.04, 0))))
    g.rotateY(-Math.PI / 2)
    g.rotateX(Math.sin(Math.min(k, 1) * Math.PI) * 0.35)
    // Contrails stretch out behind, then fade.
    const len = Math.min(k, 1) * 26
    const fade = k > 1 ? 1 - (k - 1) / 0.35 : 1
    trails.current.forEach((m) => {
      if (!m) return
      m.scale.x = Math.max(0.01, len)
      ;(m.material as THREE.MeshBasicMaterial).opacity = 0.8 * fade
    })
  })

  const { body, dark, glass, flame, wingGeo, finGeo, trail, trailGeo } = parts
  return (
    <group ref={ref} position={path.from} scale={1.25}>
      <mesh material={body} rotation={[0, 0, -Math.PI / 2]}>
        <capsuleGeometry args={[0.1, 1.1, 6, 14]} />
      </mesh>
      <mesh material={body} position={[0.72, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.1, 0.34, 14]} />
      </mesh>
      <mesh material={glass} position={[0.42, 0.075, 0]} scale={[1.6, 0.55, 0.7]}>
        <sphereGeometry args={[0.1, 14, 10]} />
      </mesh>
      <mesh geometry={wingGeo} material={body} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.02, 0.009]} />
      <mesh geometry={wingGeo} material={body} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -0.009]} />
      <mesh geometry={finGeo} material={dark} position={[-0.02, 0.06, -0.009]} />
      <mesh material={dark} position={[-0.66, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.085, 0.07, 0.12, 12]} />
      </mesh>
      <mesh material={flame} position={[-0.76, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.06, 0.22, 10]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} ref={(m) => void (trails.current[s < 0 ? 0 : 1] = m)} geometry={trailGeo} material={trail} position={[-0.6, 0, s * 0.5]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------

const ROSE_SIZE = 2.1
const RISE = 2.6 // seconds a rose takes to push up out of the ground
const OPEN = 3.2 // seconds it then takes to open
const FIRST = 2.2 // the first rose starts once the lawn is mostly there
const SPREAD = 14 // the last one starts this long after the first

export default function Garden({ free, phone }: { free: (x: number, z: number, margin: number) => boolean; phone: boolean }) {
  const on = useOffice((s) => s.garden)
  const [shown, setShown] = useState(false)
  const k = useRef(0)
  const clock = useRef(0)
  const lawn = useRef<THREE.Mesh>(null)
  const grassRef = useRef<THREE.InstancedMesh>(null)
  const daisyRef = useRef<THREE.InstancedMesh>(null)
  const roseRefs = useRef<(THREE.Group | null)[]>([])
  const headRefs = useRef<(THREE.Mesh | null)[]>([])
  // The jet flies once per garden, when the last rose has opened.
  const [jet, setJet] = useState<'waiting' | 'flying' | 'done'>('waiting')

  const built = useMemo(() => {
    if (!shown) return null
    const r = seeded(17)
    const blades: Array<[number, number, number, number, number]> = []
    while (blades.length < (phone ? 16000 : 52000)) {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * (LAWN_R - 0.2)
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (free(x, z, -0.05)) blades.push([x, z, 0.1 + r() * 0.17, r() * Math.PI * 2, 0.022 + r() * 0.016])
    }
    const daisies: Array<[number, number, number, number]> = []
    while (daisies.length < (phone ? 140 : 380)) {
      const a = r() * Math.PI * 2
      const d = 2.6 + Math.sqrt(r()) * (LAWN_R - 3)
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (free(x, z, 0.05)) daisies.push([x, z, 0.85 + r() * 0.5, r() * Math.PI * 2])
    }
    const roses: Array<{ x: number; z: number; tint: number; stem: number; head: number; start: number; turn: number; size: number }> = []
    let tries = 0
    const n = phone ? 45 : 85
    while (roses.length < n && tries++ < 6000) {
      const a = r() * Math.PI * 2
      const d = 2.8 + Math.sqrt(r()) * 9.5
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (!free(x, z, 0.15) || roses.some((o) => Math.hypot(o.x - x, o.z - z) < 0.45)) continue
      roses.push({ x, z, tint: Math.floor(r() * TINTS.length), stem: roses.length % 6, head: roses.length % 3, start: 0, turn: r() * 6.28, size: ROSE_SIZE * (0.85 + r() * 0.3) })
    }
    // One after another, in no particular order across the garden.
    const order = roses.map((_, i) => i).sort(() => r() - 0.5)
    order.forEach((i, j) => (roses[i].start = FIRST + (j / Math.max(1, roses.length - 1)) * SPREAD))

    const wind: Wind = { uTime: { value: 0 }, uFront: { value: 0 } }
    const grassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide })
    windy(grassMat, wind, 0.09, 1, 0)
    const daisyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide })
    windy(daisyMat, wind, 0.05, 1 / DAISY_H, 0.8)

    const stems = Array.from({ length: 6 }, (_, i) => roseStem(101 + i * 37))
    const heads = Array.from({ length: 3 }, (_, i) => roseHead(7 + i * 13))
    const stemMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, side: THREE.DoubleSide })
    const petalMats = TINTS.map(
      (c) =>
        new THREE.MeshPhysicalMaterial({
          color: c,
          vertexColors: true,
          roughness: 0.5,
          sheen: 1,
          sheenColor: new THREE.Color(c).lerp(new THREE.Color('#ffffff'), 0.45),
          sheenRoughness: 0.35,
          side: THREE.DoubleSide,
        }),
    )
    return { blades, daisies, roses, wind, grassMat, daisyMat, blade: bladeGeo(), daisy: daisyGeo(), stems, heads, stemMat, petalMats, tex: lawnTexture() }
    // Built once, the first time the garden is asked for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])

  useEffect(() => {
    if (on) {
      clock.current = 0
      setJet('waiting')
      setShown(true)
    }
  }, [on])

  // Place every blade and daisy once; the shader grows and moves them.
  useEffect(() => {
    if (!built) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const p = new THREE.Vector3()
    const s = new THREE.Vector3()
    const c = new THREE.Color()
    const r = seeded(5)
    const g = grassRef.current
    if (g) {
      built.blades.forEach(([x, z, h, rot, w], i) => {
        g.setMatrixAt(i, m.compose(p.set(x, 0, z), q.setFromEuler(e.set(0, rot, 0)), s.set(w, h, h)))
        g.setColorAt(i, c.setRGB(0.8 + r() * 0.35, 0.85 + r() * 0.25, 0.75 + r() * 0.3))
      })
      g.instanceMatrix.needsUpdate = true
      if (g.instanceColor) g.instanceColor.needsUpdate = true
    }
    const d = daisyRef.current
    if (d) {
      built.daisies.forEach(([x, z, sc, rot], i) => d.setMatrixAt(i, m.compose(p.set(x, 0, z), q.setFromEuler(e.set((r() - 0.5) * 0.2, rot, (r() - 0.5) * 0.2)), s.setScalar(sc))))
      d.instanceMatrix.needsUpdate = true
    }
  }, [built])

  useFrame((_, dt) => {
    if (!shown || !built) return
    clock.current += dt
    built.wind.uTime.value += dt
    // The lawn grows out from the brain in ~3 s; everything shrinks back faster when the mode ends.
    k.current = THREE.MathUtils.clamp(k.current + (on ? dt / 3 : -dt / 1.4), 0, 1)
    if (!on && k.current === 0) {
      setShown(false)
      return
    }
    const ease = 1 - Math.pow(1 - k.current, 3)
    const front = ease * (LAWN_R + 3)
    built.wind.uFront.value = on ? front : front * 1.15
    if (lawn.current) lawn.current.scale.setScalar(Math.max(0.001, Math.min(1, front / LAWN_R)))

    const t = clock.current
    if (on && jet === 'waiting' && t > FIRST + SPREAD + RISE * 0.6 + OPEN + 0.6) setJet('flying')
    const fade = on ? 1 : ease
    built.roses.forEach((o, i) => {
      const gr = roseRefs.current[i]
      if (!gr) return
      const a = THREE.MathUtils.clamp((t - o.start) / RISE, 0, 1)
      const rise = 1 - Math.pow(1 - a, 3)
      const s = o.size * fade
      // Up out of the ground first, filling out as it goes.
      gr.scale.set(s * (0.35 + 0.65 * rise), s * Math.max(0.001, rise), s * (0.35 + 0.65 * rise))
      gr.visible = rise * fade > 0.005
      gr.rotation.z = Math.sin(t * 1.3 + i) * 0.035 * rise
      gr.rotation.x = Math.sin(t * 0.9 + i * 1.7) * 0.025 * rise
      const head = headRefs.current[i]
      if (head?.morphTargetInfluences) {
        const b = THREE.MathUtils.clamp((t - o.start - RISE * 0.6) / OPEN, 0, 1)
        head.morphTargetInfluences[0] = b * b * (3 - 2 * b)
      }
    })
  })

  if (!shown || !built) return null
  return (
    <group>
      <mesh ref={lawn} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} scale={0.001} receiveShadow>
        <circleGeometry args={[LAWN_R, 96]} />
        <meshStandardMaterial map={built.tex} roughness={1} color="#b6dc98" />
      </mesh>
      {jet === 'flying' && on && <Jet onDone={() => setJet('done')} />}
      <instancedMesh ref={grassRef} args={[built.blade, built.grassMat, built.blades.length]} frustumCulled={false} receiveShadow />
      <instancedMesh ref={daisyRef} args={[built.daisy, built.daisyMat, built.daisies.length]} frustumCulled={false} />
      {built.roses.map((o, i) => {
        const stem = built.stems[o.stem]
        return (
          <group key={i} position={[o.x, 0, o.z]} rotation={[0, o.turn, 0]}>
            <group ref={(g) => void (roseRefs.current[i] = g)} visible={false}>
              <mesh geometry={stem.geo} material={built.stemMat} castShadow />
              <mesh
                ref={(m) => {
                  headRefs.current[i] = m
                  if (m && !m.morphTargetInfluences) m.updateMorphTargets()
                }}
                geometry={built.heads[o.head]}
                material={built.petalMats[o.tint]}
                position={stem.top}
                quaternion={stem.quat}
                castShadow
              />
            </group>
          </group>
        )
      })}
    </group>
  )
}
