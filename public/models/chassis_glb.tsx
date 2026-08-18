/**
 * chassis.glb - React Three Fiber (R3F) Component
 * Exported by SynthoMesh Studio on 2026-08-17T22:43:55.825Z
 *
 * Usage:
 *   import { Canvas } from '@react-three/fiber';
 *   import { chassisglb } from './chassisglb';
 *
 *   export default function Scene() {
 *     return (
 *       <Canvas shadows camera={{ position: [3, 2, 4], fov: 45 }}>
 *         <ambientLight intensity={0.6} />
 *         <directionalLight position={[5, 8, 5]} castShadow />
 *         <chassisglb />
 *       </Canvas>
 *     );
 *   }
 */

import React, { useRef } from 'react';
import * as THREE from 'three';

export interface chassisglbProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number] | number;
  [key: string]: any;
}

export function chassisglb(props: chassisglbProps) {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef} {...props} dispose={null}>
      <group name="Group">
        <group name="world">
          <mesh name="geometry_0" castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#ffffff" roughness={1} metalness={1} />
          </mesh>
        </group>
        <mesh name="cylinder_5684" position={[0.001, -0.25, 0.25]} scale={[0.01, 0.01, 0.1]} castShadow receiveShadow>
          <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
          <meshStandardMaterial color="#10b981" roughness={0.35} metalness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

export default chassisglb;
