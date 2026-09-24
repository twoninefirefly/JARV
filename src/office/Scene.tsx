import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { DEPARTMENTS, fmt, BRAIN, type Agent, type Department } from './data'
import { useOffice } from './state'
import { Icon, Spark } from './Icon'

/**
 * The isometric office: six department floors around a particle brain.
 *
 * The camera sits at 45° azimuth so square floors read as diamonds, the way
 * an isometric illustration would draw them — but it is a real perspective
 * scene, so dragging turns the whole building.
 */

const RING = 4.7 // distance of each floor from the brain
const FLOOR = 3.4 // floor edge length
const TOP = 0.3 // floor surface height
const BG = '#0e0b09'

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
  chair: new THREE.MeshStandardMaterial({ color: '#2a2724', roughness: 0.8 }),
  suit: new THREE.MeshStandardMaterial({ color: '#1c1a19', roughness: 0.85 }),
  skin: new THREE.MeshStandardMaterial({ color: '#c9a184', roughness: 0.7 }),
  hair: new THREE.MeshStandardMaterial({ color: '#2b1d14', roughness: 0.9 }),
  pot: new THREE.MeshStandardMaterial({ color: '#6b5b4b', roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#4f7a3a', roughness: 0.8 }),
}

function Workstation({ agent, seed }: { agent: Agent; seed: number }) {
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

  useFrame(({ clock }) => {
    if (!body.current) return
    const t = clock.elapsedTime
    // Working agents type; waiting ones lean back now and then.
    body.current.position.y =
      agent.status === 'arbeitet' ? Math.abs(Math.sin(t * 9 + seed)) * 0.008 : Math.sin(t * 1.2 + seed) * 0.006
    body.current.rotation.x = agent.status === 'wartet' ? -0.12 + Math.sin(t * 0.8 + seed) * 0.05 : 0.06
  })

  return (
    <group>
      {/* desk */}
      <mesh material={mat.desk} position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.52, 0.035, 0.3]} />
      </mesh>
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
      {/* chair */}
      <mesh material={mat.chair} position={[0, 0.15, 0.3]} castShadow>
        <boxGeometry args={[0.2, 0.04, 0.18]} />
      </mesh>
      <mesh material={mat.chair} position={[0, 0.28, 0.39]} castShadow>
        <boxGeometry args={[0.2, 0.24, 0.03]} />
      </mesh>
      {/* person */}
      <group ref={body} position={[0, 0, 0.27]}>
        <mesh material={mat.suit} position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.17, 0.24, 0.12]} />
        </mesh>
        <mesh material={mat.suit} position={[0, 0.2, -0.1]} castShadow>
          <boxGeometry args={[0.15, 0.06, 0.18]} />
        </mesh>
        <mesh material={mat.skin} position={[0, 0.48, 0]} castShadow>
          <sphereGeometry args={[0.065, 14, 12]} />
        </mesh>
        <mesh material={mat.hair} position={[0, 0.51, 0.015]}>
          <sphereGeometry args={[0.067, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        {/* arms reaching for the keyboard */}
        <mesh material={mat.suit} position={[-0.1, 0.3, -0.07]} rotation={[0.9, 0, 0]} castShadow>
          <boxGeometry args={[0.045, 0.16, 0.045]} />
        </mesh>
        <mesh material={mat.suit} position={[0.1, 0.3, -0.07]} rotation={[0.9, 0, 0]} castShadow>
          <boxGeometry args={[0.045, 0.16, 0.045]} />
        </mesh>
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

function Floor({ dept }: { dept: Department }) {
  const view = useOffice((s) => s.view)
  const show = useOffice((s) => s.show)
  const [hover, setHover] = useState(false)
  const shade = useRef(1)
  const at = useMemo(() => place(dept.angle), [dept.angle])
  const active = view.kind === 'dept' && view.id === dept.id
  const dim = view.kind === 'dept' && !active

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
    shade.current += ((dim ? 0.55 : 1) - shade.current) * Math.min(1, dt * 6)
    top.color.set(dept.color).multiplyScalar(shade.current)
  })

  const pick = () => show({ kind: 'dept', id: dept.id })
  const lead = SPOTS[0]

  return (
    <group position={at}>
      <group
        onClick={onTap(pick)}
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
              <group key={a.id} position={[x, 0, z]} rotation={[0, r, 0]}>
                <Workstation agent={a} seed={i * 1.7 + dept.angle * 3} />
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
      {!active && (
        <Html position={[0, 1.35, 0]} center zIndexRange={[20, 0]}>
          <button className="floor-badge" style={{ ['--c' as string]: dept.color }} onClick={pick}>
            <span className="floor-badge__icon">
              <Icon name={dept.icon} size={16} />
            </span>
            {dept.short}
          </button>
        </Html>
      )}

      {/* Inside a department: every agent gets a name, the lead gets lines to its team. */}
      {active && (
        <group position={[0, TOP, 0]}>
          {dept.agents.map((a, i) => {
            const [x, z] = SPOTS[i % SPOTS.length]
            const chosen = view.kind === 'dept' && view.agent === a.id
            return (
              <Html key={a.id} position={[x, 0.95 + (i % 2) * 0.18, z]} center zIndexRange={[20, 0]}>
                <button
                  className={`agent-tag${a.lead ? ' is-lead' : ''}${chosen ? ' is-chosen' : ''}`}
                  onClick={() => show({ kind: 'dept', id: dept.id, agent: a.id })}
                >
                  {a.status === 'wartet' && <span className="agent-tag__warn">⚠</span>}
                  {a.lead && <Spark size={9} />}
                  {a.name}
                </button>
              </Html>
            )
          })}
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
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vColor * vFlicker * 1.6, a * vFlicker);
  }
`

function Brain() {
  const show = useOffice((s) => s.show)
  const points = useRef<THREE.Points>(null)
  const dpr = useThree((s) => s.viewport.dpr)

  const { geometry, material } = useMemo(() => {
    const n = 5200
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const seed = new Float32Array(n)
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
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    return { geometry, material }
  }, [])

  useFrame(({ clock }, dt) => {
    material.uniforms.uTime.value = clock.elapsedTime
    material.uniforms.uPixel.value = dpr
    if (points.current) points.current.rotation.y += dt * 0.12
  })

  const glow = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 128
    const g = cv.getContext('2d')!
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grd.addColorStop(0, 'rgba(255,170,110,0.55)')
    grd.addColorStop(0.4, 'rgba(200,100,60,0.18)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(cv)
  }, [])

  return (
    <group>
      {/* dark plinth */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[3.2, 0.16, 3.2]} />
        <meshStandardMaterial color="#1a1512" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5, 5]} />
        <meshBasicMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.1, 0.014, 8, 96]} />
        <meshBasicMaterial color={[1.5, 0.75, 0.45]} toneMapped={false} />
      </mesh>
      <group position={[0, 1.75, 0]} scale={1.35}>
        <points ref={points} geometry={geometry} material={material} />
        {/* an invisible hit target — points are too sparse to click */}
        <mesh
          onClick={onTap(() => show({ kind: 'brain' }))}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <sphereGeometry args={[0.95, 16, 12]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
      <pointLight position={[0, 1.4, 0]} color="#ff9a5c" intensity={6} distance={7} decay={1.6} />
      <BrainBadge />
    </group>
  )
}

function BrainBadge() {
  const view = useOffice((s) => s.view)
  const show = useOffice((s) => s.show)
  if (view.kind !== 'overview') return null
  return (
    <Html position={[0, 2.5, 0]} center zIndexRange={[20, 0]}>
      <button className="brain-badge" onClick={() => show({ kind: 'brain' })}>
        <span className="brain-badge__dot" />
        Das Gehirn · <b>{fmt(BRAIN.stats[0].value)}</b> Dokumente
      </button>
    </Html>
  )
}

// ---------------------------------------------------------------------------
// Data flowing between the floors and the brain
// ---------------------------------------------------------------------------

function Links() {
  const curves = useMemo(
    () =>
      DEPARTMENTS.map((d) => {
        const end = place(d.angle)
        const dir = end.clone().normalize()
        const a = dir.clone().multiplyScalar(1.1).setY(0.2)
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

  const v = useMemo(() => new THREE.Vector3(), [])
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
        <pointsMaterial color="#8a5a40" size={0.035} transparent opacity={0.55} depthWrite={false} />
      </points>
      <points geometry={pulses}>
        <pointsMaterial
          color={[2.4, 1.3, 0.8]}
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
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#15110e" roughness={1} />
      </mesh>
      <points geometry={geometry}>
        <pointsMaterial color="#3a2c22" size={0.03} depthWrite={false} />
      </points>
    </group>
  )
}

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

/** Is the sheet on the side (wide screens) or along the bottom (phones)? */
const wide = () => window.innerWidth >= 900

function Rig() {
  const { camera, size } = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const view = useOffice((s) => s.view)
  const flight = useOffice((s) => s.flight)
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  const idleSince = useRef(0)

  // Work out where to fly whenever the selection (or the window) changes.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const ctl = controls.current
    if (!ctl) return
    const aspect = size.width / size.height

    let focus = new THREE.Vector3(0, 0.3, 0)
    let dist: number
    let polar = 0.88
    if (view.kind === 'overview') {
      // Fit the whole ring, whichever axis is tighter.
      const vf = THREE.MathUtils.degToRad(cam.fov) / 2
      const hf = Math.atan(Math.tan(vf) * aspect)
      dist = Math.max(6.9 / Math.tan(hf), 7.8 / Math.tan(vf))
      polar = aspect < 0.8 ? 0.55 : 0.8
    } else if (view.kind === 'brain') {
      focus = new THREE.Vector3(0, 1.1, 0)
      dist = aspect < 0.8 ? 16 : 10
    } else {
      const d = DEPARTMENTS.find((x) => x.id === view.id)!
      focus = place(d.angle).setY(0.5)
      dist = aspect < 0.8 ? 17 : 9.5
      polar = 0.8
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
    if (view.kind !== 'overview') {
      if (wide()) shift.set(1, 0, 0).applyQuaternion(probe.quaternion).multiplyScalar(dist * 0.17)
      else shift.set(0, -1, 0).applyQuaternion(probe.quaternion).multiplyScalar(dist * 0.15)
    } else if (!wide()) {
      shift.set(0, -1, 0).applyQuaternion(probe.quaternion).multiplyScalar(dist * 0.04)
    }
    const target = focus.clone().add(shift)
    goal.current = { target, pos: target.clone().addScaledVector(dir, dist) }
  }, [view, flight, size, camera])

  useFrame((_, dt) => {
    const ctl = controls.current
    if (!ctl) return
    const g = goal.current
    if (g) {
      const k = 1 - Math.exp(-dt * 3.2)
      camera.position.lerp(g.pos, k)
      ctl.target.lerp(g.target, k)
      if (camera.position.distanceTo(g.pos) < 0.01) goal.current = null
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
      minDistance={5}
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

export default function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
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
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
        shadow-bias={-0.0004}
      />
      <Ground />
      <Links />
      <Brain />
      {DEPARTMENTS.map((d) => (
        <Floor key={d.id} dept={d} />
      ))}
      <Rig />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={0.85} intensity={0.9} radius={0.7} />
      </EffectComposer>
    </Canvas>
  )
}
