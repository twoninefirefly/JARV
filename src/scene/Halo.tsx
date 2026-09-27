import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Drive } from './Scene'
import { HIST, VOICE_AT } from './voice'
import { BUST_SCALE } from './layout'

/**
 * Rings around the head: fine concentric lines that leave the head as he
 * speaks and close in on it as he listens, one per syllable, carried on the
 * same voice history as the core and the figure. At rest, two barely-there
 * circles hold the space.
 *
 * One camera-facing quad behind the head, all of it in the fragment shader.
 */

/** Size of the quad, world units. */
const SPAN = 7.5
/** Head centre, world units: a little above the core. */
const CY = 0.08 * BUST_SCALE

const vertex = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = (uv - 0.5) * ${SPAN.toFixed(2)};
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uListen;
  uniform float uSpeak;
  uniform float uForm;
  uniform float uHist[${HIST}];
  varying vec2 vP;

  ${VOICE_AT}

  #define TAU 6.28318530718

  void main() {
    // Slightly taller than wide: the head is, and circles round an oval
    // read as belonging to it.
    vec2 q = vec2(vP.x, (vP.y - ${CY.toFixed(3)}) * 0.86);
    float r = length(q);
    float R0 = ${(0.72 * BUST_SCALE).toFixed(3)};
    float R1 = ${(1.75 * BUST_SCALE).toFixed(3)};
    float V = 1.05;
    float SP = 0.16;

    float lineOut = pow(0.5 + 0.5 * cos((r - V * uTime) * TAU / SP), 16.0);
    float waveOut = lineOut * clamp(voiceAt((r - R0) / V) * 2.4, 0.0, 1.0);
    float lineIn = pow(0.5 + 0.5 * cos((r + V * uTime) * TAU / SP), 16.0);
    float waveIn = lineIn * clamp(voiceAt((R1 - r) / V) * 2.4, 0.0, 1.0);

    float band = smoothstep(R0, R0 + 0.15, r) * (1.0 - smoothstep(R1 - 0.6, R1, r));
    float waves = (waveOut * uSpeak + waveIn * uListen * 0.8) * band;

    // The resting circles.
    float rest = (exp(-pow((r - R0 - 0.35) / 0.006, 2.0)) + exp(-pow((r - R0 - 0.75) / 0.005, 2.0)) * 0.6)
               * 0.07 * smoothstep(0.6, 1.0, uForm);

    float v = (waves * 0.55 + rest);
    vec3 col = mix(vec3(0.2, 0.62, 1.0), vec3(0.75, 0.93, 1.0), waves);
    gl_FragColor = vec4(col * v, v);
  }
`

export function Halo({ drive }: { drive: Drive }) {
  const mat = useRef<THREE.ShaderMaterial>(null)
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uListen: { value: 0 },
      uSpeak: { value: 0 },
      uForm: { value: 0 },
      uHist: { value: drive.hist },
    }),
    [drive],
  )

  useFrame((state) => {
    if (!mat.current) return
    const u = mat.current.uniforms
    u.uTime.value = state.clock.elapsedTime
    u.uListen.value = drive.listen
    u.uSpeak.value = drive.speak
    u.uForm.value = drive.form
  })

  return (
    <mesh position={[0, 0, -0.9]} frustumCulled={false}>
      <planeGeometry args={[SPAN, SPAN]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}
