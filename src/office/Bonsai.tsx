import { useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Secret Garden: the brain becomes a bonsai. A curved trunk in a flat glazed
 * pot, and one branch reaching out towards every department, ending in a pad
 * of leaves with blossoms in that department's colour. Tap a pad to go there.
 */

export type Limb = { id: string; color: string; dir: THREE.Vector3 }

const seeded = (seed: number) => {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** A tube along a curve that thins from `r0` to `r1`, like a living branch. */
function taperedTube(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, seg = 28, radial = 8) {
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false)
  const pos = g.attributes.position
  const c = new THREE.Vector3()
  const v = new THREE.Vector3()
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    curve.getPointAt(t, c)
    const r = r0 + (r1 - r0) * Math.pow(t, 0.8)
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c)
      pos.setXYZ(k, v.x, v.y, v.z)
    }
  }
  g.computeVertexNormals()
  return g
}

const BARK = new THREE.MeshStandardMaterial({ color: '#5a3b28', roughness: 0.95 })
const POT = new THREE.MeshStandardMaterial({ color: '#27384a', roughness: 0.3, metalness: 0.15 })
const SOIL = new THREE.MeshStandardMaterial({ color: '#2f4a22', roughness: 1 })
const LEAF_GEO = new THREE.IcosahedronGeometry(1, 1)
const BLOSSOM_GEO = new THREE.SphereGeometry(1, 8, 6)

function Pad({ limb, at, seed, onPick }: { limb: Limb; at: THREE.Vector3; seed: number; onPick: (id: string) => void }) {
  const [hover, setHover] = useState(false)
  const ref = useRef<THREE.Group>(null)
  const { leaves, blossoms, mats } = useMemo(() => {
    const r = seeded(seed)
    const tint = new THREE.Color(limb.color)
    const greens = ['#2f6b2a', '#3d7f33', '#4d913c', '#285a24'].map((c) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c).lerp(tint, 0.12), roughness: 0.85, flatShading: true }))
    const leaves = Array.from({ length: 16 }, () => {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * 0.42
      return { p: [Math.cos(a) * d, (r() - 0.3) * 0.12, Math.sin(a) * d * 0.8] as [number, number, number], s: 0.13 + r() * 0.11, m: Math.floor(r() * greens.length) }
    })
    const blossoms = Array.from({ length: 9 }, () => {
      const a = r() * Math.PI * 2
      const d = Math.sqrt(r()) * 0.38
      return [Math.cos(a) * d, 0.1 + r() * 0.06, Math.sin(a) * d * 0.8] as [number, number, number]
    })
    const bloom = new THREE.MeshStandardMaterial({ color: limb.color, emissive: limb.color, emissiveIntensity: 0.6, roughness: 0.5 })
    return { leaves, blossoms, mats: { greens, bloom } }
  }, [limb.color, seed])

  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    // A breath of wind through the pads, and a lift under the mouse.
    g.rotation.z = Math.sin(clock.elapsedTime * 0.9 + seed) * 0.035
    const s = hover ? 1.1 : 1
    g.scale.x += (s - g.scale.x) * 0.15
    g.scale.y = g.scale.z = g.scale.x
  })

  return (
    <group
      ref={ref}
      position={at}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 6) return
        e.stopPropagation()
        onPick(limb.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHover(false)
        document.body.style.cursor = ''
      }}
    >
      {leaves.map((l, i) => (
        <mesh key={i} geometry={LEAF_GEO} material={mats.greens[l.m]} position={l.p} scale={[l.s, l.s * 0.55, l.s]} castShadow />
      ))}
      {blossoms.map((p, i) => (
        <mesh key={i} geometry={BLOSSOM_GEO} material={mats.bloom} position={p} scale={0.028} />
      ))}
    </group>
  )
}

export default function Bonsai({ limbs, amount, onPick }: { limbs: Limb[]; amount: React.MutableRefObject<number>; onPick: (id: string) => void }) {
  const root = useRef<THREE.Group>(null)
  const pads = useRef<(THREE.Group | null)[]>([])

  const tree = useMemo(() => {
    // An informal upright trunk: an S-curve leaning a little, as bonsai do.
    const trunk = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.28, 0),
      new THREE.Vector3(0.18, 0.75, 0.05),
      new THREE.Vector3(-0.12, 1.25, -0.04),
      new THREE.Vector3(0.1, 1.75, 0.03),
      new THREE.Vector3(0.02, 2.15, 0),
    ])
    const trunkGeo = taperedTube(trunk, 0.2, 0.05, 40, 10)
    // Surface roots flaring into the soil.
    const roots = Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 + 0.4
      const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.42, 0), new THREE.Vector3(Math.cos(a) * 0.2, 0.3, Math.sin(a) * 0.2), new THREE.Vector3(Math.cos(a) * 0.42, 0.27, Math.sin(a) * 0.42))
      return taperedTube(c, 0.09, 0.02, 10, 6)
    })
    // One branch per department, from the trunk out towards its floor.
    const branches = limbs.map((l, i) => {
      const t = 0.38 + (i / Math.max(1, limbs.length - 1)) * 0.45
      const start = trunk.getPointAt(t)
      const out = l.dir.clone().setY(0).normalize()
      const reach = 1.25 + (i % 2) * 0.25
      const end = start.clone().addScaledVector(out, reach).add(new THREE.Vector3(0, 0.05 + (1 - t) * 0.25, 0))
      const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.22, 0))
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
      return { geo: taperedTube(curve, 0.075 - t * 0.03, 0.02, 16, 7), end: end.clone().add(new THREE.Vector3(0, 0.06, 0)), t }
    })
    return { trunkGeo, roots, branches, apex: trunk.getPointAt(1).add(new THREE.Vector3(0, 0.08, 0)) }
  }, [limbs])

  useFrame(() => {
    const k = amount.current
    const g = root.current
    if (!g) return
    g.visible = k > 0.01
    // The tree rises first, then the pads leaf out one after another.
    const trunk = THREE.MathUtils.smoothstep(k, 0, 0.6)
    g.scale.set(0.6 + 0.4 * trunk, Math.max(0.001, trunk), 0.6 + 0.4 * trunk)
    pads.current.forEach((p, i) => {
      if (!p) return
      const s = THREE.MathUtils.smoothstep(k, 0.45 + i * 0.07, 0.75 + i * 0.07)
      p.scale.setScalar(Math.max(0.001, s))
    })
  })

  return (
    <group ref={root} visible={false}>
      {/* A shallow glazed pot with moss on top, standing on the landing pad. */}
      <mesh material={POT} position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.95, 0.8, 0.22, 48]} />
      </mesh>
      <mesh material={SOIL} position={[0, 0.315, 0]} receiveShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.02, 48]} />
      </mesh>
      <mesh geometry={tree.trunkGeo} material={BARK} castShadow />
      {tree.roots.map((g, i) => (
        <mesh key={i} geometry={g} material={BARK} />
      ))}
      {tree.branches.map((b, i) => (
        <mesh key={i} geometry={b.geo} material={BARK} castShadow />
      ))}
      {limbs.map((l, i) => (
        <group key={l.id} ref={(g) => void (pads.current[i] = g)}>
          <Pad limb={l} at={tree.branches[i].end} seed={11 + i * 7} onPick={onPick} />
        </group>
      ))}
      <group ref={(g) => void (pads.current[limbs.length] = g)}>
        <Pad limb={{ id: '', color: '#f58fbf', dir: new THREE.Vector3() }} at={tree.apex} seed={97} onPick={() => undefined} />
      </group>
    </group>
  )
}
