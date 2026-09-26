import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, Line, OrbitControls, RoundedBox } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { COMPANY, DEPARTMENTS, fmt, BRAIN, type Agent, type Department } from './data'
import { useOffice, type View } from './state'
import { Icon, Spark } from './Icon'
import { agentTarget } from './workspaces'
import Garden from './Garden'
import Bonsai from './Bonsai'
import { MOBILE } from './mobile'
import { themeOf, type Theme } from './themes'

/**
 * The isometric office: six department floors around a particle brain.
 *
 * The camera sits at 45° azimuth so square floors read as diamonds, the way
 * an isometric illustration would draw them — but it is a real perspective
 * scene, so dragging turns the whole building.
 */

const RING = 6 // distance of each floor from the brain; below ~5.9 neighbouring floors' corners overlap
const FLOOR = 3.4 // floor edge length
const TOP = 0.3 // floor surface height
const BG = '#040406'

/** Clockwise from the top of the screen, for a camera at +x +z. */
function place(angle: number) {
  const s = Math.SQRT1_2
  return new THREE.Vector3(
    s * (Math.sin(angle) - Math.cos(angle)) * RING,
    0,
    -s * (Math.cos(angle) + Math.sin(angle)) * RING,
  )
}

/** Desk spots on a floor, local coordinates, with a facing for each. */
const SPOTS: Array<[number, number, number]> = [
  [0, 0.15, 0], // lead, centre
  [-0.95, -0.9, 0],
  [0.35, -1.05, Math.PI / 2],
  [1.05, -0.05, Math.PI],
  [-1.1, 0.35, 0],
  [0.95, 1.0, Math.PI],
  [-0.25, 1.1, -Math.PI / 2],
]
const PLANTS: Array<[number, number]> = [
  [1.35, -1.3],
  [-1.3, 1.3],
  [0.25, 0.7],
]

/**
 * A press on a label that may be moving (the camera is still flying): the
 * browser only counts a click when press and release land on the same element,
 * and a moving label slips away in between. So the press and the release are
 * judged by where the pointer went, not by what is under it. Keys still click.
 */
function press(fn: () => void) {
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const x = e.clientX
      const y = e.clientY
      const t = performance.now()
      const up = (u: PointerEvent) => {
        window.removeEventListener('pointerup', up, true)
        if (Math.hypot(u.clientX - x, u.clientY - y) < 12 && performance.now() - t < 900) fn()
      }
      window.addEventListener('pointerup', up, true)
    },
    onClick: (e: React.MouseEvent) => {
      // detail 0: Enter or Space on a focused label.
      if (e.detail === 0) fn()
    },
  }
}

function onTap(fn: () => void) {
  return (e: ThreeEvent<MouseEvent>) => {
    // A drag that ends over a floor is a rotation, not a choice.
    if (e.delta > 6) return
    e.stopPropagation()
    fn()
  }
}

// ---------------------------------------------------------------------------
// Furniture
// ---------------------------------------------------------------------------

const mat = {
  desk: new THREE.MeshStandardMaterial({ color: '#ece8e1', roughness: 0.6 }),
  screen: new THREE.MeshStandardMaterial({ color: '#1b1d22', roughness: 0.4 }),
  chair: new THREE.MeshStandardMaterial({ color: '#2a2724', roughness: 0.7 }),
  chairMetal: new THREE.MeshStandardMaterial({ color: '#8a8580', roughness: 0.35, metalness: 0.6 }),
  suit: new THREE.MeshStandardMaterial({ color: '#1c1a19', roughness: 0.85 }),
  pot: new THREE.MeshStandardMaterial({ color: '#6b5b4b', roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#4f7a3a', roughness: 0.8 }),
}

// People: seated figures built from rounded shapes, each one different —
// women and men, hair style and colour, skin, clothes, glasses, beards.
const std = (c: string, roughness = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness })
const SKINS = ['#f1d3bd', '#e3b99b', '#c99a78', '#a8754f', '#7d5337', '#5c3b27'].map((c) => std(c, 0.65))
const HAIRS = ['#1d1612', '#3b2619', '#5a3a22', '#8a5a32', '#c49a62', '#d9c29a', '#6b2f1f', '#8d8a86'].map((c) => std(c, 0.9))
const TOPS = ['#1f2330', '#2b2b2e', '#3d4a5c', '#6b2f36', '#2f4a44', '#d8d2c6', '#7a6a58', '#394a2f', '#8a5a4a', '#e9e4dc'].map((c) => std(c))
const PANTS = ['#1b1b1f', '#26262c', '#2f3440', '#3b3530', '#4a4f5a'].map((c) => std(c, 0.85))
const SHOE = std('#141214', 0.6)
const GLASSES = new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.3, metalness: 0.4 })
const PUPIL = new THREE.MeshStandardMaterial({ color: '#1a120e', roughness: 0.2 })
const GLINT = new THREE.MeshBasicMaterial({ color: '#ffffff' })
const LIPS = ['#9c5a52', '#b45a62', '#7a4038'].map((c) => std(c, 0.55))

type Hair = 'short' | 'buzz' | 'side' | 'bob' | 'long' | 'bun' | 'ponytail'
type Look = {
  female: boolean
  skin: THREE.Material
  hair: THREE.Material
  top: THREE.Material
  pants: THREE.Material
  style: Hair
  glasses: boolean
  beard: boolean
  scale: number
}

/** A fixed look per desk, so the same person always sits in the same place. */
function lookFor(desk: number): Look {
  // A hash rather than a seeded sequence: neighbouring desks must not look alike.
  let n = 0
  const r = () => {
    const x = Math.sin(desk * 127.1 + ++n * 311.7) * 43758.5453
    return x - Math.floor(x)
  }
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const female = desk % 2 === 0 ? r() < 0.65 : r() < 0.35
  const style = female ? pick<Hair>(['bob', 'long', 'bun', 'ponytail', 'long']) : pick<Hair>(['short', 'buzz', 'side', 'short'])
  return {
    female,
    skin: pick(SKINS),
    hair: pick(HAIRS),
    top: pick(TOPS),
    pants: pick(PANTS),
    style,
    glasses: r() < 0.3,
    beard: !female && r() < 0.35,
    scale: (female ? 0.94 : 1) * (0.96 + r() * 0.08),
  }
}

// Shared geometry: 40 people, one set of shapes.
const G = {
  torsoM: new THREE.CapsuleGeometry(0.066, 0.12, 6, 16),
  torsoF: new THREE.CapsuleGeometry(0.058, 0.12, 6, 16),
  hips: new THREE.CapsuleGeometry(0.06, 0.07, 4, 12).rotateZ(Math.PI / 2),
  neck: new THREE.CylinderGeometry(0.022, 0.025, 0.05, 10),
  head: new THREE.SphereGeometry(0.056, 20, 16),
  upperArm: new THREE.CapsuleGeometry(0.022, 0.08, 4, 10),
  forearm: new THREE.CapsuleGeometry(0.019, 0.085, 4, 10),
  hand: new THREE.SphereGeometry(0.019, 10, 8),
  thigh: new THREE.CapsuleGeometry(0.03, 0.12, 4, 10),
  calf: new THREE.CapsuleGeometry(0.025, 0.12, 4, 10),
  shoe: new THREE.CapsuleGeometry(0.02, 0.04, 4, 8),
  // Hair: caps over the top, and shells that leave the face open (the person faces -z).
  cap: new THREE.SphereGeometry(0.06, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
  buzz: new THREE.SphereGeometry(0.058, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
  back: new THREE.SphereGeometry(0.06, 20, 12, Math.PI * 1.5 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.64),
  bob: new THREE.SphereGeometry(0.064, 22, 14, Math.PI * 1.5 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.8),
  bun: new THREE.SphereGeometry(0.027, 12, 10),
  tail: new THREE.CapsuleGeometry(0.018, 0.08, 4, 8),
  long: new THREE.CapsuleGeometry(0.045, 0.1, 4, 12),
  beard: new THREE.SphereGeometry(0.058, 18, 10, Math.PI * 1.5 - 1.05, 2.1, Math.PI * 0.55, Math.PI * 0.32),
  lens: new THREE.TorusGeometry(0.016, 0.0035, 6, 16),
  // The face: eyes that blink, brows, nose, mouth and ears.
  pupil: new THREE.SphereGeometry(0.0058, 12, 8),
  glint: new THREE.SphereGeometry(0.0016, 6, 4),
  brow: new THREE.CapsuleGeometry(0.0022, 0.013, 2, 6).rotateZ(Math.PI / 2),
  nose: new THREE.SphereGeometry(0.0085, 10, 8),
  mouth: new THREE.CapsuleGeometry(0.0026, 0.013, 2, 6).rotateZ(Math.PI / 2),
  ear: new THREE.SphereGeometry(0.012, 10, 8),
  bridge: new THREE.CylinderGeometry(0.0025, 0.0025, 0.014, 6).rotateZ(Math.PI / 2),
}

/** A capsule from a to b: limbs are placed by their joints, not by hand-tuned angles. */
function Limb({ a, b, geometry, material }: { a: [number, number, number]; b: [number, number, number]; geometry: THREE.BufferGeometry; material: THREE.Material }) {
  const { position, quaternion } = useMemo(() => {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const dir = vb.clone().sub(va).normalize()
    return { position: va.add(vb).multiplyScalar(0.5), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a.join(), b.join()])
  return <mesh geometry={geometry} material={material} position={position} quaternion={quaternion} />
}

/** Head height, used by the hair and the idle look-around. */
const HEAD_Y = 0.478

function Person({ look }: { look: Look }) {
  const { skin, hair, top, pants, female } = look
  const w = female ? 0.078 : 0.086 // shoulder half-width
  return (
    <group scale={look.scale}>
      {/* legs: thighs forward on the seat, calves down under the desk */}
      <mesh geometry={G.hips} material={pants} position={[0, 0.2, 0.0]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Limb a={[s * 0.042, 0.2, 0.0]} b={[s * 0.045, 0.2, -0.15]} geometry={G.thigh} material={pants} />
          <Limb a={[s * 0.045, 0.2, -0.15]} b={[s * 0.048, 0.035, -0.17]} geometry={G.calf} material={pants} />
          <Limb a={[s * 0.048, 0.022, -0.16]} b={[s * 0.05, 0.022, -0.215]} geometry={G.shoe} material={SHOE} />
        </group>
      ))}
      {/* torso, slightly flattened front to back */}
      <mesh geometry={female ? G.torsoF : G.torsoM} material={top} position={[0, 0.31, 0.005]} scale={[1, 1, 0.72]} castShadow />
      <mesh geometry={G.neck} material={skin} position={[0, 0.415, 0]} />
      {/* arms: shoulder → elbow → hands on the keyboard */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Limb a={[s * w, 0.37, 0.005]} b={[s * (w + 0.012), 0.285, -0.05]} geometry={G.upperArm} material={top} />
          <Limb a={[s * (w + 0.012), 0.285, -0.05]} b={[s * 0.058, 0.29, -0.16]} geometry={G.forearm} material={top} />
          <mesh name={s < 0 ? 'handL' : 'handR'} geometry={G.hand} material={skin} position={[s * 0.056, 0.29, -0.175]} scale={[1, 0.7, 1.25]} />
        </group>
      ))}
      <group name="head" position={[0, HEAD_Y, 0]}>
        <mesh geometry={G.head} material={skin} scale={[0.95, 1.08, 1]} castShadow />
        <Face look={look} />
        <Hairdo look={look} material={hair} />
        {look.beard && <mesh geometry={G.beard} material={hair} scale={[0.98, 1.05, 1.02]} />}
        {look.glasses && (
          <group position={[0, 0.006, -0.053]}>
            <mesh geometry={G.lens} material={GLASSES} position={[-0.021, 0, 0]} />
            <mesh geometry={G.lens} material={GLASSES} position={[0.021, 0, 0]} />
            <mesh geometry={G.bridge} material={GLASSES} />
          </group>
        )}
      </group>
    </group>
  )
}

/** Eyes (they blink), brows in the hair colour, nose, mouth and ears; the person faces -z. */
function Face({ look }: { look: Look }) {
  const lips = LIPS[look.female ? 1 : look.skin === SKINS[4] || look.skin === SKINS[5] ? 2 : 0]
  return (
    <group>
      {/* Eyes set into the face, not on it: a dark almond with a glint, following the head's curve. */}
      <group name="eyes" position={[0, 0.008, 0]}>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.019, 0, -0.0505]} rotation={[0, s * 0.36, 0]}>
            <mesh geometry={G.pupil} material={PUPIL} scale={[0.95, look.female ? 1.3 : 1.15, 0.28]} />
            <mesh geometry={G.glint} material={GLINT} position={[0.0015, 0.0025, -0.0016]} />
          </group>
        ))}
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={G.brow} material={look.hair} position={[s * 0.021, 0.022, -0.052]} rotation={[0.2, 0, s * (look.female ? -0.12 : -0.05)]} scale={look.female ? [1, 0.8, 1] : [1.1, 1.25, 1]} />
      ))}
      <mesh geometry={G.nose} material={look.skin} position={[0, -0.006, -0.058]} scale={[0.75, 1.15, 0.9]} />
      <mesh geometry={G.mouth} material={lips} position={[0, -0.027, -0.052]} scale={look.female ? [1.05, 1.2, 1] : [1.1, 0.9, 1]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={G.ear} material={look.skin} position={[s * 0.054, 0.002, 0.004]} scale={[0.45, 1, 0.8]} />
      ))}
    </group>
  )
}

function Hairdo({ look, material }: { look: Look; material: THREE.Material }) {
  switch (look.style) {
    case 'buzz':
      return <mesh geometry={G.buzz} material={material} position={[0, 0.006, 0.002]} scale={[0.98, 1.08, 1]} />
    case 'short':
      return (
        <>
          <mesh geometry={G.cap} material={material} position={[0, 0.008, 0.003]} scale={[0.98, 1.1, 1.02]} />
          <mesh geometry={G.back} material={material} position={[0, 0.006, 0.004]} scale={[0.98, 1.08, 1]} />
        </>
      )
    case 'side':
      return (
        <>
          <mesh geometry={G.cap} material={material} position={[0.004, 0.012, 0]} scale={[1, 1.18, 1.04]} rotation={[0, 0, -0.12]} />
          <mesh geometry={G.back} material={material} position={[0, 0.006, 0.004]} scale={[0.98, 1.08, 1]} />
        </>
      )
    case 'bob':
      return (
        <>
          <mesh geometry={G.cap} material={material} position={[0, 0.01, 0.002]} scale={[1.02, 1.12, 1.04]} />
          <mesh geometry={G.bob} material={material} position={[0, 0.006, 0.006]} scale={[1, 1.08, 1]} />
        </>
      )
    case 'long':
      return (
        <>
          <mesh geometry={G.cap} material={material} position={[0, 0.01, 0.002]} scale={[1.02, 1.12, 1.04]} />
          <mesh geometry={G.bob} material={material} position={[0, 0.004, 0.008]} scale={[1.02, 1.1, 1]} />
          <mesh geometry={G.long} material={material} position={[0, -0.075, 0.042]} scale={[1.35, 1, 0.55]} />
        </>
      )
    case 'bun':
      return (
        <>
          <mesh geometry={G.cap} material={material} position={[0, 0.01, 0.002]} scale={[1.02, 1.12, 1.04]} />
          <mesh geometry={G.back} material={material} position={[0, 0.006, 0.004]} scale={[1.02, 1.1, 1.02]} />
          <mesh geometry={G.bun} material={material} position={[0, 0.058, 0.04]} />
        </>
      )
    case 'ponytail':
      return (
        <>
          <mesh geometry={G.cap} material={material} position={[0, 0.01, 0.002]} scale={[1.02, 1.12, 1.04]} />
          <mesh geometry={G.back} material={material} position={[0, 0.006, 0.004]} scale={[1.02, 1.1, 1.02]} />
          <Limb a={[0, 0.02, 0.06]} b={[0, -0.07, 0.085]} geometry={G.tail} material={material} />
        </>
      )
  }
}

/** A proper office chair: star base, gas lift, rounded seat and back. */
function Chair() {
  return (
    <group position={[0, 0, 0.3]}>
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh key={k} material={mat.chair} position={[Math.sin((k / 5) * Math.PI * 2) * 0.05, 0.018, Math.cos((k / 5) * Math.PI * 2) * 0.05]} rotation={[0, (k / 5) * Math.PI * 2, 0]}>
          <boxGeometry args={[0.014, 0.012, 0.1]} />
        </mesh>
      ))}
      <mesh material={mat.chairMetal} position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.009, 0.012, 0.12, 8]} />
      </mesh>
      <RoundedBox args={[0.2, 0.035, 0.19]} radius={0.014} smoothness={3} material={mat.chair} position={[0, 0.155, -0.01]} castShadow />
      <RoundedBox args={[0.19, 0.2, 0.028]} radius={0.012} smoothness={3} material={mat.chair} position={[0, 0.3, 0.09]} rotation={[-0.12, 0, 0]} castShadow />
    </group>
  )
}

function Workstation({ agent, seed, look }: { agent: Agent; seed: number; look: Look }) {
  const body = useRef<THREE.Group>(null)
  const glow = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0d0f12',
        emissive: agent.status === 'wartet' ? '#ffb347' : '#8fb4ff',
        emissiveIntensity: agent.status === 'bereit' ? 0.25 : 0.7,
      }),
    [agent.status],
  )

  // Parts that move on their own: found once, not searched every frame.
  const parts = useRef<{ head?: THREE.Object3D; eyes?: THREE.Object3D; hands: THREE.Object3D[] }>({ hands: [] })
  useEffect(() => {
    const b = body.current
    if (!b) return
    parts.current = {
      head: b.getObjectByName('head'),
      eyes: b.getObjectByName('eyes'),
      hands: ['handL', 'handR'].map((n) => b.getObjectByName(n)).filter(Boolean) as THREE.Object3D[],
    }
  }, [])

  useFrame(({ clock }) => {
    if (!body.current) return
    const t = clock.elapsedTime
    const { head, eyes, hands } = parts.current
    // Seated and still: the body only breathes and leans; the hands do the typing.
    body.current.position.y = 0
    body.current.rotation.x = agent.status === 'wartet' ? -0.08 + Math.sin(t * 0.8 + seed) * 0.03 : 0.03 + Math.sin(t * 1.1 + seed) * 0.006
    const typing = agent.status === 'arbeitet'
    hands.forEach((h, i) => (h.position.y = 0.29 + (typing ? Math.max(0, Math.sin(t * 11 + seed + i * 1.9)) * 0.007 : 0)))
    // Now and then a glance to the side, as people at desks do.
    if (head) head.rotation.y = Math.sin(t * 0.35 + seed * 2) > 0.85 ? Math.sin(t * 0.9 + seed) * 0.5 : Math.sin(t * 0.5 + seed) * 0.08
    // A blink every few seconds.
    if (eyes) eyes.scale.y = (t * 0.31 + seed * 0.7) % 1 < 0.035 ? 0.1 : 1
  })

  return (
    <group>
      {/* desk */}
      <RoundedBox args={[0.52, 0.035, 0.3]} radius={0.01} smoothness={2} material={mat.desk} position={[0, 0.25, 0]} castShadow receiveShadow />
      <mesh material={mat.desk} position={[-0.24, 0.125, 0]} castShadow>
        <boxGeometry args={[0.03, 0.25, 0.28]} />
      </mesh>
      <mesh material={mat.desk} position={[0.24, 0.125, 0]} castShadow>
        <boxGeometry args={[0.03, 0.25, 0.28]} />
      </mesh>
      {/* monitor */}
      <mesh material={mat.screen} position={[0, 0.37, -0.09]} castShadow>
        <boxGeometry args={[0.26, 0.16, 0.02]} />
      </mesh>
      <mesh material={glow} position={[0, 0.37, -0.078]}>
        <planeGeometry args={[0.23, 0.13]} />
      </mesh>
      <mesh material={mat.screen} position={[0, 0.29, -0.09]}>
        <boxGeometry args={[0.03, 0.05, 0.03]} />
      </mesh>
      <Chair />
      {/* person, seated: the group moves (typing, leaning back), the head looks around */}
      <group ref={body} position={[0, 0, 0.3]}>
        <Person look={look} />
      </group>
    </group>
  )
}

function Plant() {
  return (
    <group>
      <mesh material={mat.pot} position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.12, 12]} />
      </mesh>
      <mesh material={mat.leaf} position={[0, 0.2, 0]} castShadow>
        <sphereGeometry args={[0.1, 12, 10]} />
      </mesh>
    </group>
  )
}

// ---------------------------------------------------------------------------
// A department floor
// ---------------------------------------------------------------------------

/** How long resting on a department's badge takes to open it; the bar fills in the same time. */
const DWELL_MS = 1400
/** Resting to open needs a real mouse; on touch screens a tap does it, and nothing opens by itself. */
const HOVER = !MOBILE && typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
const canDwell = (v: View, id: string) => HOVER && (v.kind === 'overview' || v.kind === 'brain' || (v.kind === 'dept' && v.id !== id))

function Floor({ dept }: { dept: Department }) {
  const view = useOffice((s) => s.view)
  const show = useOffice((s) => s.show)
  const open = useOffice((s) => s.open)
  const [hover, setHover] = useState(false)
  // The badge has its own hover, apart from the floor's: the two used to fight
  // at the badge's edge and made it flicker open and shut.
  const [tagHover, setTagHover] = useState(false)
  const leave = useRef<ReturnType<typeof setTimeout>>(undefined)
  const enterTag = () => {
    clearTimeout(leave.current)
    setTagHover(true)
  }
  const leaveTag = () => {
    clearTimeout(leave.current)
    leave.current = setTimeout(() => setTagHover(false), 140)
  }
  useEffect(() => () => clearTimeout(leave.current), [])
  // Resting on the badge opens the department once its bar is full. A timer, not
  // the bar's transitionend: that one went missing now and then, and the bar filled for nothing.
  // Works from the overview and from inside another department alike.
  const dwell = tagHover && canDwell(view, dept.id)
  useEffect(() => {
    if (!dwell) return
    const t = setTimeout(() => {
      if (canDwell(useOffice.getState().view, dept.id)) show({ kind: 'dept', id: dept.id })
    }, DWELL_MS)
    return () => clearTimeout(t)
  }, [dwell, dept.id, show])
  // The tag under the mouse opens its card; a desk under the mouse only lights
  // its ring — opening cards from desks made stray cards pop up on the way out.
  const [hoverAgent, setHoverAgent] = useState<string | null>(null)
  const [deskAgent, setDeskAgent] = useState<string | null>(null)
  const shade = useRef(1)
  const at = useMemo(() => place(dept.angle), [dept.angle])
  const active = view.kind === 'dept' && view.id === dept.id
  const inside = view.kind === 'neural'
  const dim = (view.kind === 'dept' && !active) || inside

  const top = useMemo(
    () => new THREE.MeshStandardMaterial({ color: dept.color, roughness: 0.85 }),
    [dept.color],
  )
  const lip = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(dept.color).multiplyScalar(0.62),
        roughness: 0.9,
      }),
    [dept.color],
  )

  useFrame((_, dt) => {
    const want = active ? 0.18 : hover ? 0.1 : 0
    top.emissive.set(dept.color)
    top.emissiveIntensity += (want - top.emissiveIntensity) * Math.min(1, dt * 6)
    // Step back the floors you're not looking at.
    shade.current += ((inside ? 0.35 : dim ? 0.55 : 1) - shade.current) * Math.min(1, dt * 6)
    top.color.set(dept.color).multiplyScalar(shade.current)
  })

  // Inside the brain the floors have sunk away; a click into the dark must not bring one back.
  const pick = () => {
    if (useOffice.getState().view.kind !== 'neural') show({ kind: 'dept', id: dept.id })
  }
  const lead = SPOTS[0]
  const looks = useMemo(() => dept.agents.map((_, i) => lookFor(DEPARTMENTS.indexOf(dept) * 7 + i)), [dept])

  // Build-up after unlock: each floor rises into place, one after the other.
  const rise = useRef<THREE.Group>(null)
  const order = DEPARTMENTS.indexOf(dept)
  // Inside the brain the floors sink away, so the brain stands alone.
  const away = useRef(0)
  useFrame(({ clock }, dt) => {
    if (!rise.current) return
    away.current += ((inside ? 1 : 0) - away.current) * Math.min(1, dt * 3)
    const k = THREE.MathUtils.clamp((clock.elapsedTime - 0.3 - order * 0.18) / 0.9, 0, 1)
    const e = 1 - Math.pow(1 - k, 3)
    rise.current.position.y = (1 - e) * -3 - away.current * 4
    rise.current.scale.setScalar((0.6 + 0.4 * e) * (1 - 0.3 * away.current))
    rise.current.visible = k > 0 && away.current < 0.97
  })

  return (
    <group position={at}>
    <group ref={rise}>
      {/* Sunk away inside the brain, the floor takes no clicks at all — they count as empty space there. */}
      <group
        onClick={inside ? undefined : onTap(pick)}
        onPointerOver={
          inside
            ? undefined
            : (e) => {
                e.stopPropagation()
                setHover(true)
                document.body.style.cursor = 'pointer'
              }
        }
        onPointerOut={
          inside
            ? undefined
            : () => {
                setHover(false)
                document.body.style.cursor = ''
              }
        }
      >
        <mesh material={lip} position={[0, 0.06, 0]} receiveShadow castShadow>
          <boxGeometry args={[FLOOR + 0.14, 0.12, FLOOR + 0.14]} />
        </mesh>
        <mesh material={top} position={[0, 0.2, 0]} receiveShadow castShadow>
          <boxGeometry args={[FLOOR, 0.2, FLOOR]} />
        </mesh>

        <group position={[0, TOP, 0]}>
          {dept.agents.map((a, i) => {
            const [x, z, r] = SPOTS[i % SPOTS.length]
            return (
              <group
                key={a.id}
                position={[x, 0, z]}
                rotation={[0, r, 0]}
                onPointerOver={
                  active
                    ? (e) => {
                        e.stopPropagation()
                        setDeskAgent(a.id)
                        document.body.style.cursor = 'pointer'
                      }
                    : undefined
                }
                onPointerOut={active ? () => setDeskAgent((h) => (h === a.id ? null : h)) : undefined}
                onClick={
                  active
                    ? onTap(() => {
                        show({ kind: 'dept', id: dept.id, agent: a.id })
                        open(agentTarget(dept, a))
                      })
                    : undefined
                }
              >
                <Workstation agent={a} seed={i * 1.7 + dept.angle * 3} look={looks[i]} />
              </group>
            )
          })}
          {PLANTS.slice(0, dept.agents.length > 6 ? 2 : 3).map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <Plant />
            </group>
          ))}
        </group>
      </group>

      {/* The badge floats over the floor; hidden while you're inside it. */}
      {!active && !inside && (
        <Html portal={overlay} position={[0, 1.35, 0]} center zIndexRange={tagHover ? [45, 35] : [20, 0]}>
          {/* Grows, glows and shows what the department does — from the badge or from its floor.
              Resting on the badge fills it like an hourglass, and when full the department opens. */}
          <button
            className={`floor-badge${tagHover ? ' is-hover' : ''}${dwell ? ' is-dwell' : ''}`}
            style={{ ['--c' as string]: dept.color }}
            {...press(pick)}
            onMouseEnter={enterTag}
            onMouseLeave={leaveTag}
          >
            <span
              className="floor-badge__fill"
              aria-hidden
            />
            <span className="floor-badge__icon">
              <Icon name={dept.icon} size={16} />
            </span>
            <span className="floor-badge__text">
              {dept.short}
              <span className="floor-badge__more">
                <span>
                  {dept.agents.length} Agenten · {dept.tagline}
                </span>
              </span>
            </span>
          </button>
        </Html>
      )}

      {/* Inside a department: every agent gets a name, the lead gets lines to its team. */}
      {active && (
        <group position={[0, TOP, 0]}>
          {dept.agents.map((a, i) => {
            const [x, z] = SPOTS[i % SPOTS.length]
            const chosen = view.kind === 'dept' && view.agent === a.id
            const on = hoverAgent === a.id
            return (
              // Anchored at the tag's bottom edge, so the card opens upwards, away from the desk.
              <Html portal={overlay} key={a.id} position={[x, 0.85 + (i % 2) * 0.18, z]} zIndexRange={on ? [60, 50] : [20, 0]}>
                <button
                  className={`agent-tag${a.lead ? ' is-lead' : ''}${chosen ? ' is-chosen' : ''}${on ? ' is-open' : ''}`}
                  style={{ ['--c' as string]: dept.color }}
                  onMouseEnter={() => setHoverAgent(a.id)}
                  onMouseLeave={() => setHoverAgent((h) => (h === a.id ? null : h))}
                  onFocus={() => setHoverAgent(a.id)}
                  onBlur={() => setHoverAgent((h) => (h === a.id ? null : h))}
                  {...press(() => {
                    show({ kind: 'dept', id: dept.id, agent: a.id })
                    open(agentTarget(dept, a))
                  })}
                >
                  <span className="agent-tag__more" aria-hidden={!on}>
                    <span>
                      <span className="agent-tag__role">
                        <i className={`status status--${a.status}`} />
                        {a.role} · {a.status}
                      </span>
                      <span className="agent-tag__doing">{a.doing[0].toUpperCase() + a.doing.slice(1)}</span>
                      <span className="agent-tag__go">Arbeitsbereich öffnen →</span>
                    </span>
                  </span>
                  <span className="agent-tag__name">
                    {a.status === 'wartet' && <span className="agent-tag__warn">⚠</span>}
                    {a.lead && <Spark size={10} />}
                    {a.name}
                  </span>
                </button>
              </Html>
            )
          })}
          {/* A ring of light on the floor under the agent you're pointing at. */}
          {(hoverAgent ?? deskAgent ?? (view.kind === 'dept' ? view.agent : undefined)) &&
            (() => {
              const i = dept.agents.findIndex((a) => a.id === (hoverAgent ?? deskAgent ?? (view.kind === 'dept' ? view.agent : undefined)))
              if (i < 0) return null
              const [x, z] = SPOTS[i % SPOTS.length]
              return (
                <group position={[x, 0.006, z]} rotation={[-Math.PI / 2, 0, 0]}>
                  <mesh>
                    <circleGeometry args={[0.46, 48]} />
                    <meshBasicMaterial color={dept.color} transparent opacity={0.16} depthWrite={false} />
                  </mesh>
                  <mesh>
                    <ringGeometry args={[0.44, 0.48, 64]} />
                    <meshBasicMaterial color={new THREE.Color(dept.color).multiplyScalar(1.6)} toneMapped={false} transparent opacity={0.95} depthWrite={false} />
                  </mesh>
                </group>
              )
            })()}
          {dept.agents.slice(1).map((a, i) => {
            const [x, z] = SPOTS[(i + 1) % SPOTS.length]
            return (
              <Line
                key={a.id}
                points={[
                  [lead[0], 0.62, lead[1]],
                  [(lead[0] + x) / 2, 0.8, (lead[1] + z) / 2],
                  [x, 0.62, z],
                ]}
                color="#f3e6d6"
                lineWidth={1}
                dashed
                dashSize={0.06}
                gapSize={0.06}
                transparent
                opacity={0.55}
              />
            )
          })}
        </group>
      )}
    </group>
    </group>
  )
}

// ---------------------------------------------------------------------------
// The brain
// ---------------------------------------------------------------------------

const brainVertex = /* glsl */ `
  attribute float aSeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixel;
  uniform float uDim;
  varying vec3 vColor;
  varying float vFlicker;
  void main() {
    vec3 p = position;
    // Slow breathing plus a travelling wave, so thought seems to move through it.
    float wave = sin(p.z * 5.0 - uTime * 2.2) * 0.5 + 0.5;
    p *= 1.0 + 0.025 * sin(uTime * 1.3) + 0.03 * wave * step(0.7, aSeed);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vFlicker = 0.55 + 0.45 * sin(uTime * (1.5 + aSeed * 3.0) + aSeed * 40.0);
    vColor = aColor * (0.8 + wave * 0.6);
    gl_PointSize = uPixel * (0.7 + aSeed * 1.1) * (30.0 / -mv.z);
  }
`
const brainFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vFlicker;
  uniform float uDim;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * vFlicker * 1.6 * uDim, a * vFlicker * uDim);
  }
`

/** Size of the brain in the office, and how much it grows when you step inside. */
const BRAIN_SCALE = 1.6
const INSIDE_GROW = 1.45

/**
 * The platform under the brain: a round landing pad, like a helipad, with the
 * customer's mark where the "H" would be. Drawn once into a sharp texture.
 */
/** Rgba of a theme colour, for the canvas. */
const rgba = (hex: string, a: number) => {
  const c = new THREE.Color(hex)
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`
}

/** The office's colour in the 3D scene: brain, pad, trails follow the chosen theme. */
function useTheme(): Theme {
  const id = useOffice((s) => s.theme)
  return themeOf(id)
}

function padTexture(t: Theme) {
  const ringColor = rgba(t.hi, 0.9)
  const dashColor = rgba(t.accent, 0.6)
  const S = 1024
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const g = cv.getContext('2d')!
  const c = S / 2
  const ring = (r: number, w: number, color: string, dash?: number[]) => {
    g.beginPath()
    g.setLineDash(dash ?? [])
    g.lineWidth = w
    g.strokeStyle = color
    g.arc(c, c, r * c, 0, Math.PI * 2)
    g.stroke()
  }
  const bg = g.createRadialGradient(c, c, 0, c, c, c)
  bg.addColorStop(0, '#221a15')
  bg.addColorStop(0.7, '#15110f')
  bg.addColorStop(1, '#0d0b0a')
  g.fillStyle = bg
  g.fillRect(0, 0, S, S)
  ring(0.955, 6, ringColor)
  ring(0.87, 14, dashColor, [46, 30])
  ring(0.64, 3, rgba(t.hi, 0.45))
  // Ticks around the inner ring, like a compass rose.
  for (let k = 0; k < 48; k++) {
    const a = (k / 48) * Math.PI * 2
    const r0 = k % 4 === 0 ? 0.69 : 0.715
    g.beginPath()
    g.setLineDash([])
    g.lineWidth = k % 4 === 0 ? 4 : 2
    g.strokeStyle = rgba(t.hi, 0.4)
    g.moveTo(c + Math.cos(a) * r0 * c, c + Math.sin(a) * r0 * c)
    g.lineTo(c + Math.cos(a) * 0.75 * c, c + Math.sin(a) * 0.75 * c)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  const mark = COMPANY.logoMark
  if (COMPANY.logo) {
    const img = new Image()
    img.onload = () => {
      const [sx, sy, sw, sh] = mark ?? [0, 0, img.width, img.height]
      // The mark, tinted a light copper so it reads on the dark pad.
      const tint = document.createElement('canvas')
      tint.width = sw
      tint.height = sh
      const tc = tint.getContext('2d')!
      tc.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      tc.globalCompositeOperation = 'source-in'
      tc.fillStyle = t.hi
      tc.fillRect(0, 0, sw, sh)
      const h = S * 0.5
      const w = (sw / sh) * h
      g.drawImage(tint, c - w / 2, c - h / 2, w, h)
      tex.needsUpdate = true
    }
    img.src = COMPANY.logo
  }
  return tex
}

function Pad() {
  const chosen = useTheme()
  // Kim Bormann's pad keeps its pink ring in the standard Centurion look.
  const kim = useOffice((s) => s.user?.id === 'leitung2')
  const theme = kim && chosen.id === 'centurion' ? themeOf('pink') : chosen
  const tex = useMemo(() => padTexture(theme), [theme])
  const ring = useMemo(() => new THREE.Color(theme.accent).multiplyScalar(1.7), [theme])
  const halo = useMemo(() => new THREE.Color(theme.accent).multiplyScalar(0.9), [theme])
  return (
    <group>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[2.1, 2.16, 0.12, 96]} />
        <meshStandardMaterial color="#141110" roughness={0.55} metalness={0.3} />
      </mesh>
      {/* the marked top faces the camera's default angle, so the mark reads upright */}
      <mesh position={[0, 0.121, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} receiveShadow>
        <circleGeometry args={[2.1, 96]} />
        <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.35} roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1, 0.012, 8, 160]} />
        <meshBasicMaterial color={ring} toneMapped={false} />
      </mesh>
      {/* A soft halo just outside the rim, so the ring really glows. */}
      <mesh position={[0, 0.123, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.13, 0.045, 8, 160]} />
        <meshBasicMaterial color={halo} transparent opacity={0.4} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Brain() {
  const show = useOffice((s) => s.show)
  const spin = useRef<THREE.Group>(null)
  const outer = useRef<THREE.Group>(null)
  const grow = useRef(1)
  const hovered = useRef(false)
  const inside = useOffice((s) => s.view.kind === 'neural')
  const light = useRef<THREE.PointLight>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  // Secret Garden: the brain gives way to a bonsai, one branch per department.
  const garden = useOffice((s) => s.garden)
  const tree = useRef(0)
  const limbs = useMemo(() => DEPARTMENTS.map((d) => ({ d, dir: place(d.angle).normalize() })), [])
  const openWs = useOffice((s) => s.open)

  const { geometry, material, synapses, wire, cat } = useMemo(() => {
    const n = 5200
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const seed = new Float32Array(n)
    const cat = new Uint8Array(n)
    const hot = new THREE.Color('#fff0d8')
    const copper = new THREE.Color('#e3895a')
    const ember = new THREE.Color('#7a3a22')
    const c = new THREE.Color()
    let s = 7
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < n; i++) {
      // A point on the unit sphere, pushed into one hemisphere.
      const u = r() * 2 - 1
      const th = r() * Math.PI * 2
      const q = Math.sqrt(1 - u * u)
      let x = q * Math.cos(th)
      const y = u
      const z = q * Math.sin(th)
      const side = i % 2 ? 1 : -1
      x = Math.abs(x) * side
      // Folds: a ridged surface, most points on it, a few inside.
      const folds = 1 + 0.07 * Math.sin(y * 13 + z * 7) * Math.cos(z * 11 - x * 5)
      const depth = 0.82 + 0.18 * Math.pow(r(), 0.35)
      const k = folds * depth
      let py = y * 0.62 * k
      if (py < -0.18) py = -0.18 + (py + 0.18) * 0.45
      pos.set([(x * 0.6 * k + side * 0.05) * 1, py, z * 0.82 * k], i * 3)
      const t = r()
      cat[i] = t < 0.35 ? 0 : t < 0.85 ? 1 : 2
      c.copy(t < 0.35 ? hot : t < 0.85 ? copper : ember)
      col.set([c.r, c.g, c.b], i * 3)
      seed[i] = r()
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const material = new THREE.ShaderMaterial({
      vertexShader: brainVertex,
      fragmentShader: brainFragment,
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uDim: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    // Neurons: join close pairs of points, so the cloud reads as a network.
    const seg: number[] = []
    for (let i = 0; i < 1800 && seg.length < 900 * 6; i += 1) {
      const j = (i * 37 + 11) % n
      const ax = pos[i * 3], ay = pos[i * 3 + 1], az = pos[i * 3 + 2]
      const bx = pos[j * 3], by = pos[j * 3 + 1], bz = pos[j * 3 + 2]
      if ((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2 < 0.09) seg.push(ax, ay, az, bx, by, bz)
      for (let k = i + 1; k < i + 6 && k < n; k++) {
        const cx = pos[k * 3], cy = pos[k * 3 + 1], cz = pos[k * 3 + 2]
        const d = (ax - cx) ** 2 + (ay - cy) ** 2 + (az - cz) ** 2
        if (d < 0.05 && d > 0.004) seg.push(ax, ay, az, cx, cy, cz)
      }
    }
    const synapses = new THREE.BufferGeometry()
    synapses.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3))
    const wire = new THREE.LineBasicMaterial({
      color: new THREE.Color(1.2, 0.55, 0.3),
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    })
    return { geometry, material, synapses, wire, cat }
  }, [])

  // The chosen colour runs through the brain: its sparks, its wiring, its light.
  const theme = useTheme()
  useEffect(() => {
    const hot = new THREE.Color('#ffffff').lerp(new THREE.Color(theme.hi), 0.35)
    const main = new THREE.Color(theme.accent)
    const ember = new THREE.Color(theme.deep)
    const attr = geometry.getAttribute('aColor') as THREE.BufferAttribute
    for (let i = 0; i < cat.length; i++) {
      const c = cat[i] === 0 ? hot : cat[i] === 1 ? main : ember
      attr.setXYZ(i, c.r, c.g, c.b)
    }
    attr.needsUpdate = true
    wire.color.set(theme.accent).multiplyScalar(1.25)
    light.current?.color.set(theme.accent)
  }, [theme, geometry, wire, cat])

  useFrame(({ clock }, dt) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uPixel.value = dpr
    // Fade in after unlock, then turn slowly; flare whenever a message passes through.
    const born = THREE.MathUtils.clamp((clock.elapsedTime - 0.2) / 1.4, 0, 1)
    const now = performance.now()
    const flare = useOffice
      .getState()
      .inFlight.reduce((m, f) => Math.max(m, Math.exp(-(((now - f.born) / 1000 - 1.2) ** 2) / 0.02)), 0)
    tree.current = THREE.MathUtils.clamp(tree.current + (garden ? dt / 3.5 : -dt / 1.2), 0, 1)
    const gone = 1 - THREE.MathUtils.smoothstep(tree.current, 0, 0.35)
    if (spin.current) {
      spin.current.rotation.y += dt * 0.12
      spin.current.scale.setScalar(Math.max(0.001, born * (1 + flare * 0.08) * gone))
    }
    wire.opacity = 0.18 + flare * 0.5
    // Stepping inside: the brain swells so its neurons can be told apart.
    const want = useOffice.getState().view.kind === 'neural' ? INSIDE_GROW : hovered.current ? 1.14 : 1
    grow.current += (want - grow.current) * Math.min(1, dt * 3)
    if (outer.current) outer.current.scale.setScalar(BRAIN_SCALE * grow.current)
    // Inside, the cloud steps back so the neurons stand out.
    const g = (grow.current - 1) / (INSIDE_GROW - 1)
    material.uniforms.uDim.value = 1 - 0.6 * g
    wire.opacity *= 1 - 0.5 * g
    if (light.current) light.current.intensity = (6 * born + flare * 10) * (0.35 + 0.65 * gone)
  })

  return (
    <group>
      <Pad />
      <group ref={outer} position={[0, 1.75, 0]} scale={BRAIN_SCALE}>
        <group ref={spin}>
          <points geometry={geometry} material={material} />
          <lineSegments geometry={synapses} material={wire} />
        </group>
        <Neurons />
        {/* An invisible hit target — points are too sparse to click. Gone inside the brain, so it doesn't catch the taps meant for the neurons. */}
        {!inside && !garden && (
          <mesh
            onClick={onTap(() => show({ kind: 'brain' }))}
            onDoubleClick={(e) => {
              e.stopPropagation()
              show({ kind: 'neural' })
            }}
            onPointerOver={() => {
              hovered.current = true
              document.body.style.cursor = 'pointer'
            }}
            onPointerOut={() => {
              hovered.current = false
              document.body.style.cursor = ''
            }}
          >
            <sphereGeometry args={[0.95, 16, 12]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        )}
      </group>
      <pointLight ref={light} position={[0, 1.4, 0]} color="#ff9a5c" intensity={6} distance={7} decay={1.6} />
      <group scale={1.32} position={[0, 0.02, 0]}>
        <Bonsai
          depts={limbs}
          amount={tree}
          onTrunk={() => show({ kind: 'brain' })}
          onDept={(id) => show({ kind: 'dept', id })}
          onAgent={(deptId, agentId) => {
            const d = DEPARTMENTS.find((x) => x.id === deptId)
            const a = d?.agents.find((x) => x.id === agentId)
            if (!d || !a) return
            show({ kind: 'dept', id: d.id, agent: a.id })
            openWs(agentTarget(d, a))
          }}
        />
      </group>
      <BrainBadge />
    </group>
  )
}

/**
 * Inside the brain: every department is a neuron on the side facing its
 * floor, with its agents around it. Tap a department to fly to it, an agent
 * to open its work.
 */
function Neurons() {
  const inside = useOffice((s) => s.view.kind === 'neural')
  const show = useOffice((s) => s.show)
  const open = useOffice((s) => s.open)
  const [hover, setHover] = useState<string | null>(null)
  const root = useRef<THREE.Group>(null)
  const k = useRef(0)

  const nodes = useMemo(
    () =>
      DEPARTMENTS.map((d) => {
        const out = place(d.angle).setY(0).normalize()
        // On the surface of the (ellipsoid) brain, a little above the equator.
        const dir = new THREE.Vector3(out.x, 0.32, out.z).normalize()
        const at = new THREE.Vector3(dir.x * 0.68, dir.y * 0.66, dir.z * 0.9)
        // Two directions along the surface, for the ring of agents.
        const t1 = new THREE.Vector3(0, 1, 0).cross(dir).normalize()
        const t2 = dir.clone().cross(t1).normalize()
        const team = d.agents.filter((a) => !a.lead)
        const agents = team.map((a, i) => {
          const th = (i / team.length) * Math.PI * 2 + 0.4
          const p = at.clone().addScaledVector(t1, Math.cos(th) * 0.2).addScaledVector(t2, Math.sin(th) * 0.2).addScaledVector(dir, 0.04)
          return { a, p }
        })
        // Just over the bloom threshold: a glow, not a flare.
        const bright = new THREE.Color(d.color).multiplyScalar(1.35)
        const soft = new THREE.Color(d.color).multiplyScalar(0.9)
        return { d, at, agents, bright, soft }
      }),
    [],
  )
  const waiting = useMemo(() => new THREE.Color('#ffb347').multiplyScalar(1.1), [])

  useFrame(({ clock }, dt) => {
    k.current += ((inside ? 1 : 0) - k.current) * Math.min(1, dt * 4)
    if (!root.current) return
    root.current.visible = k.current > 0.02
    root.current.scale.setScalar(0.6 + 0.4 * k.current)
    // A slow pulse on the department neurons, so they read as alive.
    root.current.traverse((c) => {
      if (c.userData.pulse !== undefined) c.scale.setScalar(1 + 0.18 * Math.sin(clock.elapsedTime * 2.4 + c.userData.pulse))
    })
  })

  return (
    <group ref={root} visible={false}>
      {nodes.map(({ d, at, agents, bright, soft }, di) => (
        <group key={d.id}>
          <mesh position={at} userData={{ pulse: di }} onClick={onTap(() => inside && show({ kind: 'dept', id: d.id }))}>
            <sphereGeometry args={[0.03, 16, 12]} />
            <meshBasicMaterial color={bright} toneMapped={false} />
          </mesh>
          <Line points={[[0, 0, 0], at.toArray()]} color={d.color} lineWidth={1.2} transparent opacity={0.5} />
          {agents.map(({ a, p }) => (
            <group key={a.id}>
              <Line points={[at.toArray(), p.toArray()]} color={d.color} lineWidth={0.8} transparent opacity={0.45} />
              <mesh
                position={p}
                onClick={onTap(() => {
                  if (!inside) return
                  show({ kind: 'dept', id: d.id, agent: a.id })
                  open(agentTarget(d, a))
                })}
                onPointerOver={(e) => {
                  e.stopPropagation()
                  setHover(a.id)
                  document.body.style.cursor = 'pointer'
                }}
                onPointerOut={() => {
                  setHover(null)
                  document.body.style.cursor = ''
                }}
              >
                <sphereGeometry args={[a.status === 'wartet' ? 0.016 : 0.012, 10, 8]} />
                <meshBasicMaterial color={a.status === 'wartet' ? waiting : soft} toneMapped={false} />
              </mesh>
              {inside && hover === a.id && (
                <Html portal={overlay} position={p} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
                  <div className="neuron-tip">{a.name}</div>
                </Html>
              )}
            </group>
          ))}
          {inside && (
            <Html portal={overlay} position={at.clone().multiplyScalar(1.28)} center zIndexRange={[25, 0]}>
              <button className="neuron-tag" style={{ ['--c' as string]: d.color }} {...press(() => show({ kind: 'dept', id: d.id }))}>
                <Icon name={d.icon} size={14} />
                {d.short}
                <small>{d.agents.length}</small>
              </button>
            </Html>
          )}
        </group>
      ))}
    </group>
  )
}

function BrainBadge() {
  const view = useOffice((s) => s.view)
  const show = useOffice((s) => s.show)
  const garden = useOffice((s) => s.garden)
  if (view.kind !== 'overview') return null
  // Same size and style as the departments' badges; in the garden it names the bonsai.
  return (
    <Html portal={overlay} position={[0, garden ? 3.5 : 2.85, 0]} center zIndexRange={[20, 0]}>
      <button className="floor-badge floor-badge--brain" {...press(() => show({ kind: 'brain' }))}>
        <span className="floor-badge__icon">
          <Icon name="brain" size={16} />
        </span>
        <span className="floor-badge__text">
          Das Gehirn
          <span className="floor-badge__more">
            <span>
              {fmt(BRAIN.stats[0].value)} Dokumente · Doppelklick zoomt hinein
            </span>
          </span>
        </span>
      </button>
    </Html>
  )
}

// ---------------------------------------------------------------------------
// Data flowing between the floors and the brain
// ---------------------------------------------------------------------------

function Links() {
  const theme = useTheme()
  const tones = useMemo(
    () => ({
      trail: new THREE.Color(theme.deep).lerp(new THREE.Color(theme.accent), 0.35),
      packet: new THREE.Color(theme.hi).multiplyScalar(2.6),
      pulse: new THREE.Color(theme.accent).multiplyScalar(2.2),
    }),
    [theme],
  )
  const curves = useMemo(
    () =>
      DEPARTMENTS.map((d) => {
        const end = place(d.angle)
        const dir = end.clone().normalize()
        const a = dir.clone().multiplyScalar(2.15).setY(0.16)
        const b = end.clone().sub(dir.clone().multiplyScalar(FLOOR * 0.62)).setY(0.05)
        const mid = a.clone().lerp(b, 0.5).setY(0.5)
        return new THREE.QuadraticBezierCurve3(a, mid, b)
      }),
    [],
  )

  const trail = useMemo(() => {
    const pts: number[] = []
    for (const c of curves) for (const p of c.getPoints(70)) pts.push(p.x, p.y, p.z)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [curves])

  const PER = 10
  const pulses = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(curves.length * PER * 3), 3))
    return g
  }, [curves])

  // Agent messages: a bright packet runs floor → brain → floor.
  const MAX = 8
  const TRAIL = 6
  const packets = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * TRAIL * 3), 3))
    return g
  }, [])
  const byDept = useMemo(() => Object.fromEntries(DEPARTMENTS.map((d, i) => [d.id, curves[i]])), [curves])

  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const attr = packets.getAttribute('position') as THREE.BufferAttribute
    const now = performance.now()
    const live = useOffice.getState().inFlight.filter((f) => now - f.born < 2400).slice(-MAX)
    for (let p = 0; p < MAX; p++) {
      const f = live[p]
      for (let k = 0; k < TRAIL; k++) {
        if (!f) {
          attr.setXYZ(p * TRAIL + k, 0, -50, 0)
          continue
        }
        const u = (now - f.born) / 1000 / 2.4 - k * 0.012
        if (u < 0 || u > 1) {
          attr.setXYZ(p * TRAIL + k, 0, -50, 0)
          continue
        }
        // First half: out of the sender's floor into the brain; second: out to the receiver.
        const curve = u < 0.5 ? byDept[f.msg.from.dept] : byDept[f.msg.to.dept]
        if (!curve) {
          attr.setXYZ(p * TRAIL + k, 0, -50, 0)
          continue
        }
        curve.getPoint(u < 0.5 ? 1 - u * 2 : (u - 0.5) * 2, v)
        attr.setXYZ(p * TRAIL + k, v.x, v.y + 0.12, v.z)
      }
    }
    attr.needsUpdate = true
  })

  useFrame(({ clock }) => {
    const attr = pulses.getAttribute('position') as THREE.BufferAttribute
    const t = clock.elapsedTime
    curves.forEach((c, ci) => {
      for (let k = 0; k < PER; k++) {
        // Half the packets travel in, half out: reading and writing.
        let u = (t * (0.09 + (k % 3) * 0.02) + k / PER + ci * 0.13) % 1
        if (k % 2) u = 1 - u
        c.getPoint(u, v)
        attr.setXYZ(ci * PER + k, v.x, v.y + 0.02, v.z)
      }
    })
    attr.needsUpdate = true
  })

  return (
    <group>
      <points geometry={trail}>
        <pointsMaterial color={tones.trail} size={0.035} transparent opacity={0.55} depthWrite={false} />
      </points>
      <points geometry={packets}>
        <pointsMaterial
          color={tones.packet}
          size={0.2}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
      <points geometry={pulses}>
        <pointsMaterial
          color={tones.pulse}
          size={0.09}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  )
}

/** The dotted floor the building stands on. */
function Ground() {
  const geometry = useMemo(() => {
    const pts: number[] = []
    const N = 34
    for (let i = -N; i <= N; i++)
      for (let j = -N; j <= N; j++) {
        const x = i * 0.45
        const z = j * 0.45
        if (Math.hypot(x, z) < 15) pts.push(x, 0, z)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [])
  const garden = useOffice((s) => s.garden)
  return (
    <group visible={!garden}>
      {/* No solid ground any more: the office floats in space; the dotted grid stays as a floor plan. */}
      <points geometry={geometry}>
        <pointsMaterial color="#4a382b" size={0.03} depthWrite={false} />
      </points>
    </group>
  )
}

// ---------------------------------------------------------------------------
// The sky: near-black space, a faint Milky Way and crisp stars.
// Nothing here is a stretched image — the sky is computed per screen pixel
// and every star is a point, so it stays sharp at any resolution.
// ---------------------------------------------------------------------------

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const skyFragment = /* glsl */ `
  varying vec3 vDir;
  // Value noise and fbm on the sphere direction.
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
  void main() {
    vec3 d = normalize(vDir);
    // A tilted band across the sky, like the Milky Way seen from inside.
    vec3 n = normalize(vec3(0.35, 0.8, 0.45));
    float band = exp(-pow(dot(d, n) / 0.22, 2.0));
    float cloud = fbm(d * 3.2);
    float dust = smoothstep(0.45, 0.75, fbm(d * 7.0 + 3.1));
    float glow = band * (0.35 + 0.9 * cloud) * (1.0 - 0.75 * dust);
    vec3 cool = vec3(0.10, 0.12, 0.22);
    vec3 warm = vec3(0.30, 0.17, 0.10);
    // Linear light: these are tiny numbers on purpose; the sRGB output lifts them.
    vec3 col = mix(cool, warm, smoothstep(0.35, 0.8, cloud)) * glow * 0.03;
    // A whisper of colour away from the band, so the black is not flat.
    col += vec3(0.0016, 0.0014, 0.003) * fbm(d * 1.6 + 7.0);
    col += vec3(0.0004, 0.0004, 0.0007);
    // Dither, relative to the brightness: breaks up the steps in dark gradients.
    col *= 1.0 + (hash(gl_FragCoord.xyz * 1.37) - 0.5) * 0.3;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

const starVertex = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uPixel;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = sin(uTime * (0.5 + aSeed * 1.5) + aSeed * 80.0);
    vAlpha = 0.55 + 0.45 * aSeed * (0.8 + 0.2 * tw);
    vColor = aColor;
    gl_PointSize = uPixel * aSize;
  }
`
// A bright core with a short falloff: a crisp point of light, not a soft blob.
const starFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = smoothstep(1.0, 0.0, d);
    float a = core * core * core;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`

function pointsMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: starVertex,
    fragmentShader: starFragment,
    uniforms: { uTime: { value: 0 }, uPixel: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  })
}

/** Stars spread over a far sphere, in all directions. */
function makeStars(n: number) {
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const size = new Float32Array(n)
  const seed = new Float32Array(n)
  const tints = ['#ffffff', '#fff3e4', '#ffe6cc', '#dfe7ff', '#ffffff'].map((c) => new THREE.Color(c))
  let s = 11
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1
    const th = r() * Math.PI * 2
    const q = Math.sqrt(1 - u * u)
    const rad = 90 + r() * 40
    pos.set([q * Math.cos(th) * rad, u * rad, q * Math.sin(th) * rad], i * 3)
    const m = Math.pow(r(), 3) // most stars faint, a few bright
    const c = tints[Math.floor(r() * tints.length)].clone().multiplyScalar(0.35 + 0.65 * m)
    col.set([c.r, c.g, c.b], i * 3)
    size[i] = 1.4 + m * 2.4
    seed[i] = m
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  return g
}

function Cosmos() {
  const sky = useRef<THREE.Group>(null)
  const dpr = useThree((s) => s.viewport.dpr)

  const { dome, stars, starMat } = useMemo(() => {
    const dome = new THREE.ShaderMaterial({ vertexShader: skyVertex, fragmentShader: skyFragment, side: THREE.BackSide, depthWrite: false, fog: false })
    return {
      dome,
      stars: makeStars(phone() ? 1800 : 3600),
      starMat: pointsMaterial(),
    }
  }, [])

  // Now and then a shooting star crosses far below the office.
  const TRAIL = 48
  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3))
    return g
  }, [])
  const path = useRef({ from: new THREE.Vector3(), to: new THREE.Vector3(), start: 4, dur: 1.2 })
  const v = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    starMat.uniforms.uTime.value = t
    starMat.uniforms.uPixel.value = dpr
    if (sky.current) sky.current.rotation.y += dt * 0.004

    const p = path.current
    const attr = trail.getAttribute('position') as THREE.BufferAttribute
    let u = (t - p.start) / p.dur
    if (u > 1.4) {
      const a = Math.random() * Math.PI * 2
      const y = -24 - Math.random() * 20
      p.from.set(Math.cos(a) * 60, y, Math.sin(a) * 60)
      p.to.set(Math.cos(a + 0.9) * 50, y - 8, Math.sin(a + 0.9) * 50)
      p.start = t + 8 + Math.random() * 10
      u = -1
    }
    for (let k = 0; k < TRAIL; k++) {
      const w = u - k * 0.0035
      if (w < 0 || w > 1) attr.setXYZ(k, 0, -500, 0)
      else {
        v.copy(p.from).lerp(p.to, w)
        attr.setXYZ(k, v.x, v.y, v.z)
      }
    }
    attr.needsUpdate = true
  })

  return (
    <>
      <mesh material={dome} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[150, 64, 32]} />
      </mesh>
      <group ref={sky}>
        <points geometry={stars} material={starMat} frustumCulled={false} />
      </group>
      <points geometry={trail} frustumCulled={false}>
        <pointsMaterial color={[1.4, 1.2, 1.0]} size={1.6} sizeAttenuation={false} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} fog={false} />
      </points>
    </>
  )
}

// ---------------------------------------------------------------------------
// Soley, Adrian and Cookie: press the space bar, and the children and their
// dog race once around the brain, between the departments, and off again.
// ---------------------------------------------------------------------------

const KID = {
  // From the book: light olive skin, dark-brown eyes, white sneakers, blue jeans.
  skin: std('#dcae86', 0.62),
  soleyHair: std('#4b3325', 0.75),
  adrianHair: std('#7d5a3a', 0.8),
  adrianTips: std('#b08a58', 0.8),
  blouse: std('#f6f3ee', 0.75),
  tshirt: std('#2f6a3c', 0.8),
  jeans: std('#3d5f93', 0.85),
  jeansDark: std('#2f4b78', 0.85),
  sneaker: std('#f7f7f4', 0.55),
  sole: std('#d9d6cf', 0.6),
  eyeWhite: std('#ffffff', 0.25),
  iris: new THREE.MeshStandardMaterial({ color: '#4a2a18', roughness: 0.15 }),
  pupil: new THREE.MeshStandardMaterial({ color: '#0d0806', roughness: 0.1 }),
  shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  brow: std('#2e1f16', 0.8),
  mouth: std('#8e3a36', 0.5),
  teeth: std('#ffffff', 0.4),
  blush: new THREE.MeshBasicMaterial({ color: '#f29a93', transparent: true, opacity: 0.35, depthWrite: false }),
  dog: std('#eedfc6', 0.95),
  dogDark: std('#c9a57c', 0.95),
  nose: std('#1a1414', 0.3),
  tongue: std('#e57f8b', 0.5),
  collar: std('#c8323c', 0.5),
  tag: new THREE.MeshStandardMaterial({ color: '#e0b84a', roughness: 0.25, metalness: 0.8 }),
}

// Shapes for the children, built once: a shaped torso, long hair that falls
// like a curtain, a fringe, sneakers with soles.
const KG = {
  torso: new THREE.LatheGeometry(
    [
      [0.0, -0.07],
      [0.052, -0.068],
      [0.058, -0.04],
      [0.056, 0.0],
      [0.062, 0.045],
      [0.066, 0.07],
      [0.05, 0.085],
      [0.022, 0.092],
      [0.0, 0.093],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    24,
  ),
  head: new THREE.SphereGeometry(0.075, 28, 22),
  cap: new THREE.SphereGeometry(0.08, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
  // The fringe: a band over the forehead, sweeping to one side.
  fringe: new THREE.SphereGeometry(0.081, 24, 8, Math.PI * 0.95, Math.PI * 1.1, Math.PI * 0.2, Math.PI * 0.2),
  // Long hair: an open shell behind and beside the head, down past the shoulders.
  curtain: (() => {
    const g = new THREE.CylinderGeometry(0.079, 0.1, 0.19, 28, 6, true, Math.PI * 1.3, Math.PI * 1.4)
    const pos = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      // Wavy ends, and the sides tucked a little inwards.
      const low = THREE.MathUtils.clamp((0.095 - v.y) / 0.19, 0, 1)
      const a = Math.atan2(v.x, v.z)
      v.y -= Math.sin(a * 7) * 0.008 * low * low
      v.x *= 1 + low * 0.08
      pos.setXYZ(i, v.x, v.y, v.z)
    }
    g.computeVertexNormals()
    return g
  })(),
  // Short boys' hair: a cap with a tousled front.
  tuft: new THREE.SphereGeometry(0.03, 10, 8),
  eye: new THREE.SphereGeometry(0.0165, 16, 12),
  iris: new THREE.SphereGeometry(0.012, 14, 10),
  pupil: new THREE.SphereGeometry(0.0062, 10, 8),
  shine: new THREE.SphereGeometry(0.0034, 8, 6),
  brow: new THREE.CapsuleGeometry(0.0035, 0.016, 3, 6).rotateZ(Math.PI / 2),
  smile: new THREE.TorusGeometry(0.017, 0.0042, 6, 16, Math.PI),
  teeth: new THREE.CircleGeometry(0.014, 16, Math.PI, Math.PI),
  cheek: new THREE.CircleGeometry(0.013, 16),
  nose: new THREE.SphereGeometry(0.0065, 10, 8),
  ear: new THREE.SphereGeometry(0.016, 10, 8),
  ruffle: new THREE.TorusGeometry(0.03, 0.011, 8, 18),
  thigh: new THREE.CapsuleGeometry(0.032, 0.08, 6, 14),
  calf: new THREE.CapsuleGeometry(0.026, 0.08, 6, 14),
  cuff: new THREE.TorusGeometry(0.026, 0.006, 6, 16).rotateX(Math.PI / 2),
  shoe: new THREE.CapsuleGeometry(0.026, 0.045, 6, 12).rotateX(Math.PI / 2),
  soleGeo: new THREE.BoxGeometry(0.05, 0.012, 0.09),
  upperArm: new THREE.CapsuleGeometry(0.021, 0.05, 6, 12),
  foreArm: new THREE.CapsuleGeometry(0.018, 0.05, 6, 12),
  hand: new THREE.SphereGeometry(0.021, 12, 10),
}

type Kid = { hair: THREE.Material; tips?: THREE.Material; top: THREE.Material; blouse: boolean; long: boolean }

/** A cartoon face in the book's style: big dark-brown eyes with a glint, a wide smile, rosy cheeks. */
function KidFace({ girl }: { girl: boolean }) {
  return (
    <group>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * 0.027, 0.004, -0.0685]} rotation={[0, sd * 0.37, 0]}>
          {/* a big dark-brown almond set into the face, with two glints, as in the book */}
          <mesh geometry={KG.iris} material={KID.iris} scale={[0.95, girl ? 1.3 : 1.2, 0.22]} />
          <mesh geometry={KG.pupil} material={KID.pupil} position={[0, -0.001, -0.0022]} scale={[1, 1.25, 0.2]} />
          <mesh geometry={KG.shine} material={KID.shine} position={[0.004, 0.005, -0.0035]} />
          <mesh geometry={KG.shine} material={KID.shine} position={[-0.003, -0.004, -0.0032]} scale={0.55} />
          <mesh geometry={KG.brow} material={KID.brow} position={[0, 0.024, 0.001]} rotation={[0, 0, sd * -0.14]} />
        </group>
      ))}
      <mesh geometry={KG.nose} material={KID.skin} position={[0, -0.012, -0.074]} scale={[1, 0.8, 0.8]} />
      {/* the smile, open, with teeth */}
      <mesh geometry={KG.teeth} material={KID.teeth} position={[0, -0.028, -0.07]} rotation={[0.25, 0, 0]} scale={[1, 0.75, 1]} />
      <mesh geometry={KG.smile} material={KID.mouth} position={[0, -0.028, -0.069]} rotation={[0.25, 0, Math.PI]} scale={[1, 0.75, 1]} />
      {[-1, 1].map((sd) => (
        <mesh key={sd} geometry={KG.cheek} material={KID.blush} position={[sd * 0.045, -0.017, -0.06]} rotation={[0, sd * -0.6, 0]} />
      ))}
    </group>
  )
}

/**
 * A running child, standing height about `h`, modelled after the book: a
 * cartoon figure with a big head and expressive face. A real running gait:
 * the hip swings the thigh, the knee folds the calf up behind on the way
 * forward, the bent arms pump against the legs, the body leans in and bounces
 * twice a stride, the hair flies.
 */
function Runner({ h, kid, phase }: { h: number; kid: Kid; phase: React.RefObject<number> }) {
  const hips = useRef<(THREE.Group | null)[]>([])
  const knees = useRef<(THREE.Group | null)[]>([])
  const shoulders = useRef<(THREE.Group | null)[]>([])
  const elbows = useRef<(THREE.Group | null)[]>([])
  const body = useRef<THREE.Group>(null)
  const chest = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const hair = useRef<THREE.Group>(null)
  useFrame(() => {
    const p = phase.current ?? 0
    for (let i = 0; i < 2; i++) {
      const q = p + i * Math.PI
      if (hips.current[i]) hips.current[i]!.rotation.x = Math.sin(q) * 0.8
      // The knee folds most while the leg swings through, and nearly straightens on landing.
      if (knees.current[i]) knees.current[i]!.rotation.x = -(0.2 + 1.35 * Math.pow(Math.max(0, Math.cos(q + 0.5)), 1.5))
      if (shoulders.current[i]) {
        shoulders.current[i]!.rotation.x = -Math.sin(q) * 0.8
        shoulders.current[i]!.rotation.z = (i ? -1 : 1) * 0.14
      }
      if (elbows.current[i]) elbows.current[i]!.rotation.x = 1.4 + Math.sin(q) * 0.25
    }
    if (body.current) {
      body.current.position.y = Math.abs(Math.cos(p)) * 0.05 * h - 0.014
      body.current.rotation.x = -0.17
    }
    if (chest.current) chest.current.rotation.y = Math.sin(p) * 0.18
    if (head.current) {
      head.current.rotation.y = -Math.sin(p) * 0.14
      head.current.rotation.x = 0.14
      head.current.rotation.z = Math.sin(p) * 0.04
    }
    // Long hair streams back and bounces with each step.
    if (hair.current) hair.current.rotation.x = -0.28 - Math.abs(Math.cos(p)) * 0.18
  })
  const k = h / 0.66
  return (
    <group scale={k}>
      <group ref={body}>
        {/* legs: hip → thigh → knee → calf → sneaker */}
        {[-0.036, 0.036].map((x, i) => (
          <group key={x} ref={(g) => void (hips.current[i] = g)} position={[x, 0.27, 0]}>
            <mesh geometry={KG.thigh} material={KID.jeans} position={[0, -0.066, 0]} castShadow />
            <group ref={(g) => void (knees.current[i] = g)} position={[0, -0.135, 0]}>
              <mesh geometry={KG.calf} material={KID.jeans} position={[0, -0.056, 0]} />
              <mesh geometry={KG.cuff} material={KID.jeansDark} position={[0, -0.1, 0]} />
              <group position={[0, -0.118, -0.018]}>
                <mesh geometry={KG.shoe} material={KID.sneaker} />
                <mesh geometry={KG.soleGeo} material={KID.sole} position={[0, -0.02, 0]} />
              </group>
            </group>
          </group>
        ))}
        {/* hips in jeans */}
        <mesh material={KID.jeans} position={[0, 0.28, 0]} scale={[1.25, 0.7, 0.9]}>
          <sphereGeometry args={[0.05, 16, 12]} />
        </mesh>
        <group ref={chest} position={[0, 0.34, 0]}>
          <mesh geometry={KG.torso} material={kid.top} scale={[1, 1.15, 0.8]} castShadow />
          {/* arms: shoulder → upper arm → elbow → forearm → hand */}
          {[-0.068, 0.068].map((x, i) => (
            <group key={x} ref={(g) => void (shoulders.current[i] = g)} position={[x, 0.075, 0]}>
              {kid.blouse ? (
                <mesh geometry={KG.ruffle} material={KID.blouse} position={[0, -0.012, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.8]} />
              ) : (
                <mesh material={kid.top} position={[0, -0.02, 0]}>
                  <capsuleGeometry args={[0.025, 0.03, 6, 12]} />
                </mesh>
              )}
              <mesh geometry={KG.upperArm} material={KID.skin} position={[0, -0.04, 0]} />
              <group ref={(g) => void (elbows.current[i] = g)} position={[0, -0.08, 0]}>
                <mesh geometry={KG.foreArm} material={KID.skin} position={[0, -0.035, 0]} />
                <mesh geometry={KG.hand} material={KID.skin} position={[0, -0.078, 0]} scale={[1, 1.1, 0.9]} />
              </group>
            </group>
          ))}
          <mesh material={KID.skin} position={[0, 0.105, 0]}>
            <cylinderGeometry args={[0.018, 0.021, 0.03, 12]} />
          </mesh>
          <group ref={head} position={[0, 0.19, 0]}>
            <mesh geometry={KG.head} material={KID.skin} scale={[1, 1.02, 0.98]} castShadow />
            <KidFace girl={kid.long} />
            {kid.long ? (
              <>
                {/* Soley: parted on the left, fringe sweeping right, long brown hair covering her ears */}
                <mesh geometry={KG.cap} material={kid.hair} position={[0, 0.006, 0.004]} scale={[1.02, 1.04, 1.03]} />
                <mesh geometry={KG.fringe} material={kid.hair} position={[0.004, 0.012, 0]} rotation={[0, 0, -0.18]} scale={[1.02, 1.02, 1.02]} />
                <group ref={hair} position={[0, 0.01, 0.006]}>
                  <mesh geometry={KG.curtain} material={kid.hair} position={[0, -0.085, 0]} castShadow />
                </group>
              </>
            ) : (
              <>
                {/* Adrian: short and neat at the sides, a little longer on top, brushed forward */}
                <mesh geometry={KG.cap} material={kid.hair} position={[0, 0.004, 0.004]} scale={[1.0, 0.98, 1.01]} />
                {[
                  [-0.03, 0.062, -0.045],
                  [0.0, 0.07, -0.05],
                  [0.03, 0.064, -0.046],
                  [0.012, 0.075, -0.02],
                ].map(([x, y, z], i) => (
                  <mesh key={i} geometry={KG.tuft} material={i % 2 ? kid.tips ?? kid.hair : kid.hair} position={[x, y, z]} scale={[1, 0.55, 1]} rotation={[0.4, 0, i * 0.3]} />
                ))}
                {[-1, 1].map((sd) => (
                  <mesh key={sd} geometry={KG.ear} material={KID.skin} position={[sd * 0.074, -0.006, 0.004]} scale={[0.45, 1, 0.75]} />
                ))}
              </>
            )}
          </group>
        </group>
      </group>
    </group>
  )
}

/**
 * Cookie at a gallop: a small fluffy light-beige dog. The front legs reach
 * together, then the hind legs drive, the back flexes, ears flop, the tongue
 * hangs out and the tail streams.
 */
function Dog({ phase }: { phase: React.RefObject<number> }) {
  const legs = useRef<(THREE.Group | null)[]>([])
  const tail = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const spine = useRef<THREE.Group>(null)
  const ears = useRef<(THREE.Mesh | null)[]>([])
  const head = useRef<THREE.Group>(null)
  useFrame(() => {
    const p = phase.current ?? 0
    const offs = [0, 0.35, Math.PI * 0.95, Math.PI * 0.95 + 0.35]
    legs.current.forEach((l, i) => {
      if (l) l.rotation.x = Math.sin(p + offs[i]) * (i < 2 ? 0.95 : 1.1)
    })
    if (body.current) {
      body.current.position.y = Math.max(0, Math.sin(p + 0.4)) * 0.045
      body.current.rotation.x = Math.sin(p + 1.2) * 0.14
    }
    if (spine.current) spine.current.scale.z = 1 + Math.sin(p) * 0.08
    if (head.current) head.current.rotation.x = -Math.sin(p + 1.2) * 0.12
    ears.current.forEach((e, i) => {
      if (e) e.rotation.x = 0.5 + Math.sin(p * 2 + i) * 0.4
    })
    if (tail.current) {
      tail.current.rotation.x = -0.9 + Math.sin(p) * 0.2
      tail.current.rotation.z = Math.sin(p * 2) * 0.4
    }
  })
  // Fluff: a few overlapping soft balls instead of one smooth capsule.
  const fluff: Array<[number, number, number, number]> = [
    [0, 0.135, -0.05, 0.058],
    [0, 0.14, 0.0, 0.062],
    [0, 0.135, 0.055, 0.058],
    [0.02, 0.15, -0.02, 0.04],
    [-0.02, 0.15, 0.03, 0.04],
  ]
  return (
    <group ref={body} scale={0.9}>
      <group ref={spine}>
        {fluff.map(([x, y, z, r], i) => (
          <mesh key={i} material={KID.dog} position={[x, y, z]} castShadow={i < 3}>
            <icosahedronGeometry args={[r, 2]} />
          </mesh>
        ))}
        <mesh material={KID.collar} position={[0, 0.17, -0.085]} rotation={[1.2, 0, 0]}>
          <torusGeometry args={[0.036, 0.007, 6, 18]} />
        </mesh>
        <mesh material={KID.tag} position={[0, 0.135, -0.108]}>
          <cylinderGeometry args={[0.009, 0.009, 0.003, 12]} />
        </mesh>
      </group>
      {[
        [-0.032, -0.07],
        [0.032, -0.07],
        [-0.032, 0.07],
        [0.032, 0.07],
      ].map(([x, z], i) => (
        <group key={i} ref={(g) => void (legs.current[i] = g)} position={[x, 0.11, z]}>
          <mesh material={KID.dog} position={[0, -0.048, 0]}>
            <capsuleGeometry args={[0.017, 0.05, 4, 8]} />
          </mesh>
          <mesh material={KID.dog} position={[0, -0.088, -0.01]} scale={[1, 0.7, 1.35]}>
            <sphereGeometry args={[0.017, 10, 8]} />
          </mesh>
        </group>
      ))}
      <group ref={head} position={[0, 0.215, -0.11]}>
        <mesh material={KID.dog} castShadow>
          <icosahedronGeometry args={[0.058, 2]} />
        </mesh>
        {/* snout, nose, eyes with a glint, tongue out */}
        <mesh material={KID.dog} position={[0, -0.018, -0.05]} scale={[0.85, 0.7, 1]}>
          <sphereGeometry args={[0.032, 14, 10]} />
        </mesh>
        <mesh material={KID.nose} position={[0, -0.006, -0.083]} scale={[1.2, 0.9, 1]}>
          <sphereGeometry args={[0.011, 10, 8]} />
        </mesh>
        {[-1, 1].map((sd) => (
          <group key={sd} position={[sd * 0.024, 0.012, -0.05]}>
            <mesh material={KID.pupil}>
              <sphereGeometry args={[0.0095, 10, 8]} />
            </mesh>
            <mesh material={KID.shine} position={[0.003, 0.004, -0.008]}>
              <sphereGeometry args={[0.0028, 6, 5]} />
            </mesh>
          </group>
        ))}
        <mesh material={KID.tongue} position={[0.006, -0.042, -0.058]} rotation={[0.5, 0, 0]} scale={[1, 0.35, 1.4]}>
          <sphereGeometry args={[0.013, 10, 8]} />
        </mesh>
        {[-1, 1].map((sd, i) => (
          <mesh key={sd} ref={(m) => void (ears.current[i] = m)} material={KID.dogDark} position={[sd * 0.05, 0.012, 0.005]} rotation={[0.5, 0, sd * 0.55]} scale={[0.4, 1.1, 0.8]}>
            <sphereGeometry args={[0.034, 12, 10]} />
          </mesh>
        ))}
      </group>
      <group ref={tail} position={[0, 0.17, 0.1]}>
        <mesh material={KID.dog} position={[0, 0.035, 0.01]}>
          <icosahedronGeometry args={[0.022, 1]} />
        </mesh>
        <mesh material={KID.dog} position={[0, 0.06, 0.02]}>
          <icosahedronGeometry args={[0.018, 1]} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * The run: in from far out through the gap between two departments, a lap
 * round the landing pad inside the ring of floors, and out through the next
 * gap — never through a building. Measured by distance, so the speed is even.
 */
const ROMP_R = 2.95
const ROMP_FAR = 15
const rompGap = (() => {
  const sorted = [...DEPARTMENTS].sort((a, b) => a.angle - b.angle)
  const a = sorted[0].angle
  const b = sorted[1 % sorted.length].angle
  const mid = place((a + b) / 2)
  return { at: Math.atan2(mid.z, mid.x), step: (Math.PI * 2) / Math.max(1, sorted.length) }
})()
const ROMP_IN = ROMP_FAR - ROMP_R
const ROMP_ARC = ROMP_R * (Math.PI * 2 + rompGap.step)
const ROMP_LEN = ROMP_IN * 2 + ROMP_ARC

/** Where on the run a runner is, `d` units along it; `side` shifts them off the line. */
function rompPoint(d: number, side: number, v: THREE.Vector3) {
  const a0 = rompGap.at
  if (d < ROMP_IN) {
    const r = ROMP_FAR - d
    return v.set(Math.cos(a0) * r - Math.sin(a0) * side, 0.01, Math.sin(a0) * r + Math.cos(a0) * side)
  }
  if (d < ROMP_IN + ROMP_ARC) {
    const a = a0 + (d - ROMP_IN) / ROMP_R
    const r = ROMP_R + side
    return v.set(Math.cos(a) * r, 0.01, Math.sin(a) * r)
  }
  const a1 = a0 + ROMP_ARC / ROMP_R
  const r = ROMP_R + (d - ROMP_IN - ROMP_ARC)
  return v.set(Math.cos(a1) * r - Math.sin(a1) * side, 0.01, Math.sin(a1) * r + Math.cos(a1) * side)
}

const PACK = [
  // gap: how far behind the dog, in units; side: off the line; stride: length of one step cycle
  { id: 'cookie', gap: 0, side: 0, stride: 0.55 },
  { id: 'adrian', gap: 1.1, side: 0.22, stride: 1.05 },
  { id: 'soley', gap: 1.9, side: -0.2, stride: 0.95 },
] as const

/** For a close look at the children: ?kids has them run on the spot next to the landing pad. */
const KIDS_ON_SPOT = (() => {
  try {
    return new URLSearchParams(location.search).has('kids')
  } catch {
    return false
  }
})()

function KidsOnSpot() {
  const phases = useRef({ cookie: { current: 0 }, adrian: { current: 1 }, soley: { current: 2.2 } })
  useFrame((_, dt) => {
    phases.current.cookie.current += dt * 11
    phases.current.adrian.current += dt * 8
    phases.current.soley.current += dt * 9
  })
  return (
    <group position={[0.75, 0.13, 0.75]} rotation={[0, -Math.PI * 0.75 + 0.45, 0]}>
      <group position={[-0.5, 0, 0]} scale={1.6}>
        <Dog phase={phases.current.cookie} />
      </group>
      <group position={[0, 0, 0]}>
        <Runner h={1.0} kid={{ hair: KID.adrianHair, tips: KID.adrianTips, top: KID.tshirt, blouse: false, long: false }} phase={phases.current.adrian} />
      </group>
      <group position={[0.5, 0, 0]}>
        <Runner h={0.85} kid={{ hair: KID.soleyHair, top: KID.blouse, blouse: true, long: true }} phase={phases.current.soley} />
      </group>
    </group>
  )
}

function Romp() {
  const romp = useOffice((s) => s.romp)
  const [active, setActive] = useState(false)
  const start = useRef(0)
  const groups = useRef<Record<string, THREE.Group | null>>({})
  const phases = useRef<Record<string, { current: number }>>({ cookie: { current: 0 }, adrian: { current: 1 }, soley: { current: 2.2 } })
  const v = useMemo(() => new THREE.Vector3(), [])
  const ahead = useMemo(() => new THREE.Vector3(), [])
  const behind = useMemo(() => new THREE.Vector3(), [])
  const SPEED = 3.4 // units per second

  useEffect(() => {
    if (!romp) return
    start.current = -1
    setActive(true)
  }, [romp])

  useFrame(({ clock }, dt) => {
    if (!active) return
    if (start.current < 0) start.current = clock.elapsedTime
    const run = (clock.elapsedTime - start.current) * SPEED
    const step = Math.min(dt, 0.05) * SPEED
    for (const p of PACK) {
      const g = groups.current[p.id]
      if (!g) continue
      const d = run - p.gap
      g.visible = d > 0 && d < ROMP_LEN
      if (!g.visible) continue
      // The legs keep time with the ground covered.
      phases.current[p.id].current += (step / p.stride) * Math.PI * 2
      rompPoint(d, p.side, v)
      rompPoint(d + 0.15, p.side, ahead)
      rompPoint(Math.max(0, d - 0.15), p.side, behind)
      g.position.copy(v)
      g.lookAt(ahead.x, v.y, ahead.z)
      g.rotateY(Math.PI) // the figures face -z
      // Lean into the bend, like a child taking a curve at full speed.
      const turn = (ahead.x - v.x) * (v.z - behind.z) - (ahead.z - v.z) * (v.x - behind.x)
      g.rotateZ(THREE.MathUtils.clamp(-turn * 6, -0.22, 0.22))
    }
    if (run - PACK[PACK.length - 1].gap > ROMP_LEN) setActive(false)
  })

  if (!active) return null
  return (
    <group>
      {PACK.map((p) => (
        <group key={p.id} ref={(g) => void (groups.current[p.id] = g)} visible={false}>
          {p.id === 'cookie' ? (
            <group scale={1.6}>
              <Dog phase={phases.current.cookie} />
            </group>
          ) : p.id === 'adrian' ? (
            <Runner h={1.0} kid={{ hair: KID.adrianHair, tips: KID.adrianTips, top: KID.tshirt, blouse: false, long: false }} phase={phases.current.adrian} />
          ) : (
            <Runner h={0.85} kid={{ hair: KID.soleyHair, top: KID.blouse, blouse: true, long: true }} phase={phases.current.soley} />
          )}
        </group>
      ))}
    </group>
  )
}

// ---------------------------------------------------------------------------
// Secret Garden: typed into the search, a lawn spreads out under the office
// and pink roses grow out of the ground between the departments (Garden.tsx).
// ---------------------------------------------------------------------------


/** Is this ground point free — not under a floor, the landing pad or too close to either? */
function free(x: number, z: number, margin: number) {
  if (Math.hypot(x, z) < 2.4 + margin) return false
  for (const d of DEPARTMENTS) {
    const c = place(d.angle)
    if (Math.abs(x - c.x) < FLOOR / 2 + 0.12 + margin && Math.abs(z - c.z) < FLOOR / 2 + 0.12 + margin) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

/** Is the sheet on the side (wide screens) or along the bottom (phones)? */
const wide = () => window.innerWidth >= 900

function Rig() {
  const { camera, size, scene } = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const view = useOffice((s) => s.view)
  const flight = useOffice((s) => s.flight)
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const idleSince = useRef(0)

  // Work out where to fly whenever the selection (or the window) changes.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const ctl = controls.current
    // A hidden or collapsing stage reports a zero size; flying there would put the camera at infinity.
    if (!ctl || size.width < 2 || size.height < 2) return
    const aspect = size.width / size.height

    let focus = new THREE.Vector3(0, 0.3, 0)
    let dist: number
    let polar = 0.88
    if (view.kind === 'overview') {
      // Fit the whole ring, whichever axis is tighter.
      const vf = THREE.MathUtils.degToRad(cam.fov) / 2
      const hf = Math.atan(Math.tan(vf) * aspect)
      dist = Math.max(8.7 / Math.tan(hf), 9.8 / Math.tan(vf))
      polar = aspect < 0.8 ? 0.55 : 0.8
    } else if (view.kind === 'neural') {
      focus = new THREE.Vector3(0, 1.9, 0)
      dist = aspect < 0.8 ? 21 : 11
      polar = 0.78
    } else if (view.kind === 'brain') {
      focus = new THREE.Vector3(0, 1.1, 0)
      dist = aspect < 0.8 ? 16 : 10
    } else {
      const d = DEPARTMENTS.find((x) => x.id === view.id)
      focus = d ? place(d.angle).setY(0.5) : focus
      dist = aspect < 0.8 ? 17 : 9.5
      polar = 0.8
      // An agent chosen (from the search, a tag, the list): fly on to their desk.
      const i = d && view.agent ? d.agents.findIndex((a) => a.id === view.agent) : -1
      if (d && i > 0) {
        const [x, z] = SPOTS[i % SPOTS.length]
        focus = place(d.angle).add(new THREE.Vector3(x, TOP + 0.35, z))
        dist = aspect < 0.8 ? 12 : 6.2
        polar = 0.85
      }
    }

    // Keep whatever angle the user has turned to; only pitch and distance move.
    const from = cam.position.clone().sub(ctl.target)
    const az = Math.atan2(from.x, from.z)
    const dir = new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az))

    // Push the subject clear of the sheet: up on phones, left on wide screens.
    const probe = new THREE.PerspectiveCamera()
    probe.position.copy(focus).addScaledVector(dir, dist)
    probe.lookAt(focus)
    const shift = new THREE.Vector3()
    if (MOBILE) {
      // The phone page has no sheet over the 3D card: keep the subject centred.
    } else if (view.kind !== 'overview') {
      if (wide()) shift.set(1, 0, 0).applyQuaternion(probe.quaternion).multiplyScalar(dist * 0.17)
      else shift.set(0, -1, 0).applyQuaternion(probe.quaternion).multiplyScalar(dist * 0.15)
    } else if (!wide()) {
      shift.set(0, -1, 0).applyQuaternion(probe.quaternion).multiplyScalar(dist * 0.04)
    }
    const target = focus.clone().add(shift)
    const pos = target.clone().addScaledVector(dir, dist)
    if (![pos.x, pos.y, pos.z, target.x, target.y, target.z].every(Number.isFinite)) return
    goal.current = { target, pos }
  }, [view, flight, size, camera])

  useFrame((_, dt) => {
    const ctl = controls.current
    if (!ctl) return
    // Last line of defence: a camera at NaN renders nothing but background, forever.
    const p = camera.position
    if (!Number.isFinite(p.x + p.y + p.z) || !Number.isFinite(ctl.target.x + ctl.target.y + ctl.target.z)) {
      p.set(18, 22, 18)
      ctl.target.set(0, 0.3, 0)
      goal.current = null
    }
    const g = goal.current
    if (g) {
      const k = 1 - Math.exp(-dt * 3.2)
      camera.position.lerp(g.pos, k)
      ctl.target.lerp(g.target, k)
      if (camera.position.distanceTo(g.pos) < 0.01) goal.current = null
    }
    // Fog follows the camera: a phone in portrait sits three times further back,
    // and fixed fog distances swallowed the floors there.
    if (scene.fog instanceof THREE.Fog) {
      const d = camera.position.distanceTo(ctl.target)
      scene.fog.near = d + 4
      scene.fog.far = d + 45
    }
    // Drift slowly in the overview once nobody has touched it for a while.
    ctl.autoRotate = view.kind === 'overview' && !g && performance.now() - idleSince.current > 4000
    ctl.update()
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      autoRotateSpeed={0.35}
      minPolarAngle={0.35}
      maxPolarAngle={1.2}
      minDistance={3.5}
      maxDistance={60}
      onStart={() => {
        goal.current = null
        idleSince.current = performance.now()
      }}
      onEnd={() => (idleSince.current = performance.now())}
    />
  )
}

// ---------------------------------------------------------------------------

/** Phones get a lighter renderer: less GPU memory, fewer lost contexts. */
const phone = () => Math.min(window.innerWidth, window.innerHeight) < 600

/**
 * Pixel density, capped by total pixels: a 4K projector at 2× with bloom needs
 * buffers big enough for the GPU to drop the context, which paints black.
 */
function pixelRatio(): [number, number] {
  const budget = phone() ? 2.2e6 : 6.5e6
  const fit = Math.sqrt(budget / Math.max(1, window.innerWidth * window.innerHeight))
  const max = Math.max(1, Math.min(window.devicePixelRatio || 1, phone() ? 1.5 : 2, fit))
  return [1, max]
}

/**
 * Where all name tags and badges live: the stage around the canvas, outside
 * the 3D scene's own wrapper. Inside that wrapper every click on a tag was
 * also a click into the scene — it could land on a floor behind the tag and
 * fly off to another department, or count as a click into empty space.
 */
const overlay = { current: null as unknown as HTMLElement }

export default function Scene() {
  overlay.current = document.querySelector('.stage') as HTMLElement
  // A phone drops the GPU context when the app goes to the background or the
  // page is reopened, and a lost context paints black forever. Rebuilding the
  // canvas is cheap, so that is the recovery.
  const [generation, setGeneration] = useState(0)
  return (
    <Canvas
      key={generation}
      onCreated={({ gl }) => {
        // Right-click is ours: it zooms back out (see onPointerMissed).
        gl.domElement.addEventListener('contextmenu', (e) => e.preventDefault())
        gl.domElement.addEventListener(
          'webglcontextlost',
          (e) => {
            e.preventDefault()
            setTimeout(() => setGeneration((g) => g + 1), 250)
          },
          { once: true },
        )
      }}
      // Right-click or double-click on empty space: back to the whole office.
      onPointerMissed={(e) => {
        if (e.type === 'contextmenu' || e.type === 'dblclick') {
          const { view, show } = useOffice.getState()
          if (view.kind !== 'overview') show({ kind: 'overview' })
        }
      }}
      shadows
      dpr={pixelRatio()}
      camera={{ position: [18, 22, 18], fov: 34, near: 0.1, far: 200 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 26, 70]} />
      <ambientLight intensity={0.65} color="#ffe8d6" />
      <hemisphereLight args={['#ffe2c4', '#1a120c', 0.5]} />
      <directionalLight
        position={[6, 14, 4]}
        intensity={1.6}
        color="#fff1e0"
        castShadow
        shadow-mapSize={phone() ? [1024, 1024] : [2048, 2048]}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-bias={-0.0004}
      />
      <Cosmos />
      <Ground />
      <Garden free={free} phone={phone()} />
      <Links />
      <Brain />
      {DEPARTMENTS.map((d) => (
        <Floor key={d.id} dept={d} />
      ))}
      <Romp />
      {KIDS_ON_SPOT && <KidsOnSpot />}
      <Rig />
      {/* Bloom costs the most GPU memory; phones skip it, which is what keeps iOS from dropping the context. */}
      {!phone() && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={0.85} intensity={0.9} radius={0.7} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
