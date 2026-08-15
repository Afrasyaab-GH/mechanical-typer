import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Environment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useStore } from "../app/store";
import { applyReflectionSettings, buildMaterials } from "./Materials";

/** Museum & studio lighting: warm key spot, fill, and store-driven intensity/warmth. */
export function Lighting() {
  const keySpot = useRef<THREE.SpotLight>(null);
  const { scene } = useThree();

  const lightIntensity = useStore((s) => s.lightIntensity);
  const lightWarmth = useStore((s) => s.lightWarmth);
  const studioLightEnabled = useStore((s) => s.studioLightEnabled);

  const reflectionsEnabled = useStore((s) => s.reflectionsEnabled);
  const reflectionIntensity = useStore((s) => s.reflectionIntensity);

  const deskLampEnabled = useStore((s) => s.deskLampEnabled);
  const deskLampIntensity = useStore((s) => s.deskLampIntensity);
  const deskLampWarmth = useStore((s) => s.deskLampWarmth);

  const effectiveStudio = studioLightEnabled ? lightIntensity : 0;
  const effectiveDeskLamp = deskLampEnabled ? deskLampIntensity : 0;
  const effectiveReflection = reflectionsEnabled ? reflectionIntensity : 0;

  // When reflections are turned off, completely wipe the HDR environment map from the scene
  useEffect(() => {
    if (!reflectionsEnabled || effectiveReflection <= 0) {
      scene.environment = null;
    }
  }, [reflectionsEnabled, effectiveReflection, scene]);

  return (
    <group>
      {reflectionsEnabled && effectiveReflection > 0 && (
        <Environment preset="city" environmentIntensity={effectiveReflection} />
      )}
      <ambientLight intensity={0.25 * effectiveStudio} color={0x52483d} />

      {/* Desk Lamp Focused Key Spotlight */}
      <spotLight
        ref={keySpot}
        position={[-14.8, 24.9, 2.5]}
        angle={0.72}
        penumbra={0.5}
        intensity={160 * effectiveDeskLamp}
        color={deskLampWarmth}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0002}
        target-position={[0, 10, 0]}
      />
      <pointLight position={[-14.8, 24.9, 2.5]} intensity={12 * effectiveDeskLamp} color={deskLampWarmth} />

      {/* Studio Fill Lighting */}
      <spotLight
        position={[26, 17, 32]}
        angle={0.9}
        penumbra={0.8}
        intensity={45 * effectiveStudio}
        color={lightWarmth}
        target-position={[0, 9, 0]}
      />
      <directionalLight position={[18, 16, -26]} intensity={0.4 * effectiveStudio} color={0xa9bed8} />
    </group>
  );
}

/** Desk plane and the warm banker's lamp on the left. */
export function DeskSet() {
  const materials = useMemo(() => buildMaterials(), []);
  const deskLampEnabled = useStore((s) => s.deskLampEnabled);
  const deskLampIntensity = useStore((s) => s.deskLampIntensity);
  const deskLampWarmth = useStore((s) => s.deskLampWarmth);
  const reflectionsEnabled = useStore((s) => s.reflectionsEnabled);
  const reflectionIntensity = useStore((s) => s.reflectionIntensity);

  useEffect(() => {
    applyReflectionSettings(materials, reflectionsEnabled, reflectionIntensity);
  }, [materials, reflectionsEnabled, reflectionIntensity]);

  const bulbEmissive = deskLampEnabled ? deskLampIntensity * 2.8 : 0.0;
  const lampMetalRoughness = reflectionsEnabled && reflectionIntensity > 0.001 ? 0.35 : 0.65;
  const lampMetalness = reflectionsEnabled && reflectionIntensity > 0.001 ? 0.8 : 0.4;

  return (
    <group>
      <mesh position={[0, 1.2, 0]} receiveShadow>
        <boxGeometry args={[110, 2.4, 64]} />
        <primitive object={materials.wood} attach="material" />
      </mesh>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color={0x0a0908} roughness={0.95} envMapIntensity={0} />
      </mesh>
      <group position={[-24, 2.4, 8]}>
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[2.6, 3.2, 2.4, 20]} />
          <meshStandardMaterial
            color={0x151517}
            roughness={lampMetalRoughness}
            metalness={lampMetalness}
            envMapIntensity={reflectionsEnabled ? reflectionIntensity : 0}
          />
        </mesh>
        <mesh position={[3.5, 12, -2]} rotation={[0, 0, -0.5]}>
          <cylinderGeometry args={[0.35, 0.35, 22, 10]} />
          <meshStandardMaterial
            color={0x1a1a1d}
            roughness={lampMetalRoughness}
            metalness={lampMetalness}
            envMapIntensity={reflectionsEnabled ? reflectionIntensity : 0}
          />
        </mesh>
        <group position={[9.2, 22.5, -5.5]} rotation={[0.5, 0, -0.35]}>
          <mesh>
            <coneGeometry args={[4.6, 5.5, 24, 1, true]} />
            <meshStandardMaterial
              color={0x1d1d20}
              roughness={lampMetalRoughness}
              metalness={lampMetalness}
              side={THREE.DoubleSide}
              envMapIntensity={reflectionsEnabled ? reflectionIntensity : 0}
            />
          </mesh>
          <mesh position={[0, -2, 0]}>
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial
              color={deskLampWarmth}
              emissive={deskLampWarmth}
              emissiveIntensity={bulbEmissive}
              roughness={reflectionsEnabled ? 0.2 : 0.8}
              envMapIntensity={reflectionsEnabled ? reflectionIntensity : 0}
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
