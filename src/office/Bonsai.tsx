import { useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Department } from './data'

/**
 * Secret Garden: the brain becomes a Japanese bonsai — an informal upright
 * trunk with a strip of deadwood, in a shallow unglazed pot with moss.
 * Every main branch ends in a cloud pad: that pad is a department. Inside it,
 * small twigs carry leaf clumps: each clump is one agent's work area. Rose
 * blossoms sit on the pads. Tap the trunk for the brain, a pad for the
 * department, a clump for the agent.
 */

const seeded = (seed: number) => {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

type V3 = [number, number, number]

/** Colour every vertex, so meshes can merge and still differ. */
function paint(g: THREE.BufferGeometry, fn: (p: THREE.Vector3) => V3) {
  if (g.index) g = g.toNonIndexed()
  g.deleteAttribute('uv')
  const pos = g.attributes.position
  const c = new Float32Array(pos.count * 3)
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) c.set(fn(p.fromBufferAttribute(pos, i)), i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(c, 3))
  return g
}

/** A branch that thins along its length, with bark ridges and fissures. */
function bark(curve: THREE.Curve<THREE.Vector3>, r0: number, r1: number, seg: number, radial: number, seed: number) {
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false)
  const pos = g.attributes.position
  const c = new THREE.Vector3()
  const v = new THREE.Vector3()
  const col = new Float32Array(pos.count * 3)
  for (let i = 0; i <= seg; i++) {
    const t = i / seg
    curve.getPointAt(t, c)
    const r = r0 + (r1 - r0) * Math.pow(t, 0.7)
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j
      const a = (j / radial) * Math.PI * 2
      // Twisting ridges, like old juniper bark.
      const ridge = Math.sin(a * 5 + t * 9 + seed) * 0.5 + 0.5
      const knot = Math.sin(t * 23 + seed * 3) * Math.sin(a * 2 + seed) * 0.06
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r * (1 + ridge * 0.09 + knot)).add(c)
      pos.setXYZ(k, v.x, v.y, v.z)
      const shade = 0.55 + ridge * 0.45
      col.set([0.21 * shade + 0.04, 0.13 * shade + 0.03, 0.09 * shade + 0.02], k * 3)
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.deleteAttribute('uv')
  g.computeVertexNormals()
  return g.toNonIndexed()
}

/** One clump of needles: jittered blobs, dark underneath and light on top. */
function clump(r: () => number, n: number, spread: number, size: number) {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(size * (0.7 + r() * 0.6), 1)
    const pos = g.attributes.position
    const v = new THREE.Vector3()
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k)
      v.multiplyScalar(0.85 + r() * 0.3)
      pos.setXYZ(k, v.x, v.y * 0.62, v.z)
    }
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * spread
    g.translate(Math.cos(a) * d, (r() - 0.35) * size * 0.8, Math.sin(a) * d)
    parts.push(
      paint(g, (p) => {
        const up = THREE.MathUtils.clamp((p.y + size) / (size * 2), 0, 1)
        const k = 0.75 + r() * 0.25
        return [(0.07 + up * 0.13) * k, (0.2 + up * 0.28) * k, (0.06 + up * 0.08) * k]
      }),
    )
  }
  const g = mergeGeometries(parts)!
  g.computeVertexNormals()
  return g
}

/** A small open rose: two rings of petals round a darker heart, all in one mesh. */
function roseGeo() {
  const parts: THREE.BufferGeometry[] = []
  const petal = (ring: number, k: number, n: number) => {
    const g = new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5)
    g.scale(0.018, 0.012, 0.012 * (ring ? 0.8 : 1))
    g.rotateZ(ring ? 0.9 : 1.25)
    g.translate(ring ? 0.008 : 0.014, 0, 0)
    g.rotateY((k / n) * Math.PI * 2 + ring * 0.5)
    return paint(g, () => (ring ? [0.95, 0.42, 0.64] : [0.98, 0.58, 0.75]))
  }
  for (let k = 0; k < 5; k++) parts.push(petal(0, k, 5))
  for (let k = 0; k < 4; k++) parts.push(petal(1, k, 4))
  parts.push(paint(new THREE.SphereGeometry(0.007, 8, 6).translate(0, 0.004, 0), () => [0.72, 0.18, 0.38]))
  return mergeGeometries(parts)!
}

const WOOD = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })
const JIN = new THREE.MeshStandardMaterial({ color: '#cfc6b8', roughness: 0.8 })
const LEAF = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 })
const ROSE = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, emissive: '#ff6fa8', emissiveIntensity: 0.12 })
const POT = new THREE.MeshStandardMaterial({ color: '#5b2c21', roughness: 0.85, metalness: 0.05 })
const POT_DARK = new THREE.MeshStandardMaterial({ color: '#3a1b14', roughness: 0.9 })
const SOIL = new THREE.MeshStandardMaterial({ color: '#2a2016', roughness: 1 })
const MOSS = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })
const STONE = new THREE.MeshStandardMaterial({ color: '#8b8781', roughness: 0.7 })

type Hover = { kind: 'dept' | 'agent'; id: string; label: string; at: THREE.Vector3 } | null

export default function Bonsai({
  depts,
  amount,
  onTrunk,
  onDept,
  onAgent,
}: {
  depts: Array<{ d: Department; dir: THREE.Vector3 }>
  amount: React.MutableRefObject<number>
  onTrunk: () => void
  onDept: (id: string) => void
  onAgent: (deptId: string, agentId: string) => void
}) {
  const root = useRef<THREE.Group>(null)
  const pads = useRef<(THREE.Group | null)[]>([])
  const blooms = useRef<(THREE.Mesh | null)[]>([])
  const [hover, setHover] = useState<Hover>(null)

  const tree = useMemo(() => {
    const r = seeded(29)
    // Informal upright (moyogi): the trunk bends left and right as it climbs, leaning a little forward.
    const trunk = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.32, 0),
      new THREE.Vector3(0.22, 0.7, 0.04),
      new THREE.Vector3(-0.16, 1.15, 0.08),
      new THREE.Vector3(0.14, 1.62, 0.02),
      new THREE.Vector3(-0.05, 2.05, -0.02),
      new THREE.Vector3(0.03, 2.35, 0),
    ])
    const trunkGeo = bark(trunk, 0.26, 0.05, 60, 14, 1)
    // Nebari: the root flare, spreading into the moss.
    const roots = Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + r() * 0.4
      const len = 0.35 + r() * 0.2
      const c = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0.5, 0),
        new THREE.Vector3(Math.cos(a) * 0.22, 0.34, Math.sin(a) * 0.22),
        new THREE.Vector3(Math.cos(a) * len, 0.3, Math.sin(a) * len),
      )
      return bark(c, 0.1, 0.015, 12, 8, i)
    })
    // Jin: a bleached stub of deadwood, the mark of an old tree.
    const jinCurve = new THREE.CatmullRomCurve3([trunk.getPointAt(0.52), trunk.getPointAt(0.52).add(new THREE.Vector3(-0.28, 0.18, -0.12)), trunk.getPointAt(0.52).add(new THREE.Vector3(-0.42, 0.42, -0.2))])
    const jin = new THREE.TubeGeometry(jinCurve, 10, 0.028, 6, false)

    // One main branch per department, alternating up the trunk like a real bonsai.
    const order = depts.map((_, i) => i).sort((a, b) => depts[a].dir.y - depts[b].dir.y)
    const branches = depts.map(({ d, dir }, i) => {
      const slot = order.indexOf(i)
      const t = 0.3 + (slot / Math.max(1, depts.length - 1)) * 0.52
      const start = trunk.getPointAt(t)
      const out = dir.clone().setY(0).normalize()
      const reach = 1.35 - t * 0.55
      // Down and out first, then the tip lifts towards the light.
      const mid = start.clone().addScaledVector(out, reach * 0.55).add(new THREE.Vector3(0, -0.08, 0))
      const end = start.clone().addScaledVector(out, reach).add(new THREE.Vector3(0, 0.12, 0))
      const curve = new THREE.CatmullRomCurve3([start, mid, end])
      const geo = bark(curve, 0.085 - t * 0.04, 0.02, 20, 8, i + 3)
      // The pad: a flat cloud of clumps; each agent gets its own clump on a twig.
      const agents = d.agents
      const side = new THREE.Vector3(-out.z, 0, out.x)
      const clumps = agents.map((a, k) => {
        const f = agents.length > 1 ? k / (agents.length - 1) - 0.5 : 0
        const at = end
          .clone()
          .addScaledVector(side, f * 0.62)
          .addScaledVector(out, (k % 2 ? 0.14 : -0.02) + (a.lead ? 0.08 : 0))
          .add(new THREE.Vector3(0, 0.06 + (a.lead ? 0.08 : 0) + (k % 3) * 0.015, 0))
        const twig = bark(new THREE.QuadraticBezierCurve3(end.clone(), end.clone().lerp(at, 0.5).add(new THREE.Vector3(0, -0.03, 0)), at.clone()), 0.018, 0.006, 6, 5, k)
        const rr = seeded(100 + i * 17 + k)
        return { a, at, twig, leaves: clump(rr, a.lead ? 11 : 8, a.lead ? 0.16 : 0.12, a.lead ? 0.1 : 0.085) }
      })
      // Roses on top of the pad.
      const rr = seeded(300 + i)
      const roses = Array.from({ length: 7 }, () => {
        const c = clumps[Math.floor(rr() * clumps.length)].at
        return [c.x + (rr() - 0.5) * 0.18, c.y + 0.07 + rr() * 0.04, c.z + (rr() - 0.5) * 0.18, rr() * 6.28] as [number, number, number, number]
      })
      return { d, geo, end, clumps, roses }
    })
    // The crown: a pad at the apex that belongs to no one.
    const apex = { at: trunk.getPointAt(1).add(new THREE.Vector3(0, 0.08, 0)), leaves: clump(seeded(7), 16, 0.26, 0.1) }

    // Moss over the soil, and a few stones.
    const mossParts: THREE.BufferGeometry[] = []
    const mr = seeded(51)
    for (let i = 0; i < 38; i++) {
      const g = new THREE.SphereGeometry(0.06 + mr() * 0.07, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2)
      g.scale(1, 0.35, 1)
      const x = (mr() - 0.5) * 1.5
      const z = (mr() - 0.5) * 0.95
      g.translate(x, 0.33, z)
      const k = 0.7 + mr() * 0.3
      mossParts.push(paint(g, () => [0.16 * k, 0.32 * k, 0.1 * k]))
    }
    const moss = mergeGeometries(mossParts)!
    const stones: Array<[number, number, number, number]> = [
      [0.52, 0.34, 0.22, 0.07],
      [0.6, 0.33, 0.1, 0.045],
      [-0.55, 0.34, -0.25, 0.06],
    ]
    return { trunkGeo, roots, jin, branches, apex, moss, stones, rose: roseGeo() }
  }, [depts])

  useFrame(({ clock }) => {
    const k = amount.current
    const g = root.current
    if (!g) return
    g.visible = k > 0.01
    // The tree rises first, then the pads leaf out one after another, then the roses open.
    const rise = THREE.MathUtils.smoothstep(k, 0, 0.5)
    g.scale.set(0.7 + 0.3 * rise, Math.max(0.001, rise), 0.7 + 0.3 * rise)
    const t = clock.elapsedTime
    pads.current.forEach((p, i) => {
      if (!p) return
      const s = THREE.MathUtils.smoothstep(k, 0.4 + i * 0.05, 0.7 + i * 0.05)
      const h = hover?.kind === 'dept' && hover.id === tree.branches[i]?.d.id ? 1.06 : 1
      p.scale.setScalar(Math.max(0.001, s * h))
      // A breath of wind through the pads.
      p.rotation.z = Math.sin(t * 0.8 + i * 1.3) * 0.012
    })
    blooms.current.forEach((b, i) => {
      if (!b) return
      b.scale.setScalar(Math.max(0.001, THREE.MathUtils.smoothstep(k, 0.8 + (i % 7) * 0.02, 1)))
    })
  })

  const over = (h: Hover) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHover(h)
    document.body.style.cursor = 'pointer'
  }
  const out = () => {
    setHover(null)
    document.body.style.cursor = ''
  }
  const tap = (fn: () => void) => (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return
    e.stopPropagation()
    fn()
  }

  return (
    <group ref={root} visible={false}>
      {/* A shallow rectangular pot of unglazed clay, with a rim and cloud feet. */}
      <mesh material={POT} position={[0, 0.19, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.72, 0.22, 1.12]} />
      </mesh>
      <mesh material={POT} position={[0, 0.305, 0]}>
        <boxGeometry args={[1.8, 0.035, 1.2]} />
      </mesh>
      <mesh material={POT_DARK} position={[0, 0.2, 0]}>
        <boxGeometry args={[1.74, 0.03, 1.14]} />
      </mesh>
      {[
        [-0.72, -0.44],
        [0.72, -0.44],
        [-0.72, 0.44],
        [0.72, 0.44],
      ].map(([x, z], i) => (
        <mesh key={i} material={POT_DARK} position={[x, 0.055, z]}>
          <boxGeometry args={[0.18, 0.07, 0.14]} />
        </mesh>
      ))}
      <mesh material={SOIL} position={[0, 0.315, 0]}>
        <boxGeometry args={[1.66, 0.02, 1.06]} />
      </mesh>
      <mesh geometry={tree.moss} material={MOSS} receiveShadow />
      {tree.stones.map(([x, y, z, s], i) => (
        <mesh key={i} material={STONE} position={[x, y, z]} scale={[s, s * 0.6, s * 0.8]}>
          <icosahedronGeometry args={[1, 1]} />
        </mesh>
      ))}

      {/* The trunk is the brain: tap it. */}
      <mesh geometry={tree.trunkGeo} material={WOOD} castShadow onClick={tap(onTrunk)} onPointerOver={over({ kind: 'dept', id: '', label: 'Das Gehirn', at: new THREE.Vector3(0.3, 1.4, 0) })} onPointerOut={out} />
      {tree.roots.map((g, i) => (
        <mesh key={i} geometry={g} material={WOOD} />
      ))}
      <mesh geometry={tree.jin} material={JIN} castShadow />

      {tree.branches.map((b, i) => (
        <group key={b.d.id}>
          <mesh geometry={b.geo} material={WOOD} castShadow />
          <group ref={(g) => void (pads.current[i] = g)}>
            {/* The pad as a whole is the department… */}
            <group onClick={tap(() => onDept(b.d.id))} onPointerOver={over({ kind: 'dept', id: b.d.id, label: b.d.short, at: b.end.clone().add(new THREE.Vector3(0, 0.34, 0)) })} onPointerOut={out}>
              {b.clumps.map(({ a, at, twig, leaves }) => (
                <group key={a.id}>
                  <mesh geometry={twig} material={WOOD} />
                  {/* …each clump in it is one agent's work area. */}
                  <mesh
                    geometry={leaves}
                    material={LEAF}
                    position={at}
                    castShadow
                    onClick={tap(() => onAgent(b.d.id, a.id))}
                    onPointerOver={over({ kind: 'agent', id: a.id, label: `${a.name} · ${b.d.short}`, at: at.clone().add(new THREE.Vector3(0, 0.2, 0)) })}
                    onPointerOut={out}
                    scale={hover?.kind === 'agent' && hover.id === a.id ? 1.15 : 1}
                  />
                </group>
              ))}
            </group>
            {b.roses.map(([x, y, z, rot], k) => (
              <mesh key={k} ref={(m) => void (blooms.current[i * 7 + k] = m)} geometry={tree.rose} material={ROSE} position={[x, y, z]} rotation={[0, rot, 0]} scale={2.2} />
            ))}
          </group>
        </group>
      ))}
      <group ref={(g) => void (pads.current[tree.branches.length] = g)}>
        <mesh geometry={tree.apex.leaves} material={LEAF} position={tree.apex.at} castShadow onClick={tap(onTrunk)} />
      </group>

      {hover && (
        <Html position={hover.at} center zIndexRange={[40, 30]} style={{ pointerEvents: 'none' }}>
          <div className={`bonsai-tip${hover.kind === 'agent' ? ' is-agent' : ''}`}>{hover.label}</div>
        </Html>
      )}
    </group>
  )
}
