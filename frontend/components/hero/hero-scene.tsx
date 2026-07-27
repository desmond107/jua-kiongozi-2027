'use client'

import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'

/**
 * The hero's depth layer: a slowly rotating wireframe emblem inside a soft
 * shell, with a field of drifting particles behind it.
 *
 * PERFORMANCE CONTRACT — this scene is deliberately cheap:
 *   - two low-poly meshes (icosahedron detail 1 and 2) and one Points cloud
 *   - no textures, no shadows, no post-processing, no loaded assets
 *   - DPR capped at 1.5, so a 3× phone screen never renders 9× the pixels
 *   - `frameloop="always"` but every material is basic/standard with no lights
 *     beyond two cheap sources
 *
 * It is also never mounted unless `useDeviceCapability` clears the device, and
 * it is imported via `next/dynamic` with `ssr: false`, so the three.js bundle
 * is not in the initial payload at all.
 */

const PARTICLE_COUNT = 420

function Particles() {
  const pointsRef = useRef<THREE.Points>(null)

  // Generated once and kept in a ref-stable buffer — regenerating per frame
  // would allocate 5KB every 16ms.
  const positions = useMemo(() => {
    const array = new Float32Array(PARTICLE_COUNT * 3)

    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      // Distributed in a spherical shell so the cloud has visible depth rather
      // than reading as a flat plane of dots.
      const radius = 4 + Math.random() * 6
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      array[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
      array[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6
      array[i * 3 + 2] = radius * Math.cos(phi)
    }

    return array
  }, [])

  useFrame((state) => {
    if (!pointsRef.current) return
    const t = state.clock.elapsedTime
    pointsRef.current.rotation.y = t * 0.03
    pointsRef.current.rotation.x = Math.sin(t * 0.1) * 0.06
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={PARTICLE_COUNT}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#F5B942"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

function Emblem() {
  const wireRef = useRef<THREE.Mesh>(null)
  const shellRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (wireRef.current) {
      wireRef.current.rotation.y = t * 0.12
      wireRef.current.rotation.x = t * 0.05
    }
    if (shellRef.current) {
      shellRef.current.rotation.y = -t * 0.08
    }
  })

  return (
    <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.5}>
      {/* Inner wireframe core. */}
      <mesh ref={wireRef}>
        <icosahedronGeometry args={[1.35, 1]} />
        <meshBasicMaterial color="#1EB854" wireframe transparent opacity={0.5} />
      </mesh>

      {/* Outer translucent shell catching the two accent lights. */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[1.9, 2]} />
        <meshStandardMaterial
          color="#0A0E1A"
          roughness={0.25}
          metalness={0.85}
          transparent
          opacity={0.42}
          side={THREE.DoubleSide}
        />
      </mesh>
    </Float>
  )
}

export default function HeroScene() {
  return (
    <Canvas
      // Capped DPR: the visual gain above 1.5 is imperceptible for a soft
      // background scene, but the fill-rate cost on a high-density phone is not.
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 7], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.4} />
      <pointLight position={[6, 4, 6]} intensity={70} color="#F5B942" />
      <pointLight position={[-6, -3, 4]} intensity={55} color="#1EB854" />

      <Emblem />
      <Particles />
    </Canvas>
  )
}
