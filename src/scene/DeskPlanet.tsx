import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Generate procedural gas-giant band texture for the planet */
function createPlanetTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0.0, "#2c1c11");
    grad.addColorStop(0.15, "#7a4e28");
    grad.addColorStop(0.28, "#c99558");
    grad.addColorStop(0.38, "#eed1a2");
    grad.addColorStop(0.48, "#e2b070");
    grad.addColorStop(0.52, "#c2894b");
    grad.addColorStop(0.62, "#dfb37c");
    grad.addColorStop(0.72, "#eedcb6");
    grad.addColorStop(0.85, "#8a582e");
    grad.addColorStop(1.0, "#2c1c11");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Subtle atmospheric noise bands
    for (let y = 0; y < 256; y += 3) {
      const alpha = Math.sin(y * 0.2) * 0.08 + 0.05;
      ctx.fillStyle = `rgba(255, 245, 230, ${alpha})`;
      ctx.fillRect(0, y, 512, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function DeskPlanet({
  position = [24, 2.4, 4],
  scale = 2.4,
}: {
  position?: [number, number, number];
  scale?: number;
}) {
  const planetBodyRef = useRef<THREE.Group>(null);
  const moonRef = useRef<THREE.Mesh>(null);
  const ringsRef = useRef<THREE.Group>(null);

  const texture = useMemo(() => createPlanetTexture(), []);

  // Materials
  const materials = useMemo(() => {
    const brassDark = new THREE.MeshStandardMaterial({
      color: "#221c18",
      roughness: 0.25,
      metalness: 0.9,
    });
    const brassGold = new THREE.MeshStandardMaterial({
      color: "#d4af37",
      roughness: 0.2,
      metalness: 0.85,
    });
    const standGlow = new THREE.MeshStandardMaterial({
      color: "#ffb300",
      roughness: 0.35,
      metalness: 0.3,
      side: THREE.DoubleSide,
    });
    const planetMat = new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: 0.45,
      metalness: 0.15,
      clearcoat: 0.2,
      clearcoatRoughness: 0.1,
    });
    const ringInner = new THREE.MeshStandardMaterial({
      color: "#cca473",
      roughness: 0.4,
      metalness: 0.1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const ringMain = new THREE.MeshStandardMaterial({
      color: "#fbe3b5",
      roughness: 0.5,
      metalness: 0.15,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const ringOuter = new THREE.MeshPhysicalMaterial({
      color: "#087cc4",
      roughness: 0.4,
      metalness: 0.4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      transmission: 0.3,
      ior: 1.5,
    });
    const moonMat = new THREE.MeshStandardMaterial({
      color: "#d0e0ff",
      roughness: 0.35,
      metalness: 0.3,
    });

    return { brassDark, brassGold, standGlow, planetMat, ringInner, ringMain, ringOuter, moonMat };
  }, [texture]);

  useFrame((_, delta) => {
    if (planetBodyRef.current) {
      planetBodyRef.current.rotation.y += delta * 0.3;
    }
    if (ringsRef.current) {
      ringsRef.current.rotation.z -= delta * 0.15;
    }
    if (moonRef.current) {
      const time = Date.now() * 0.001;
      moonRef.current.position.x = Math.cos(time * 0.8) * 1.7;
      moonRef.current.position.z = Math.sin(time * 0.8) * 1.7;
      moonRef.current.position.y = 2.3 + Math.sin(time * 1.6) * 0.2;
    }
  });

  return (
    <group position={position} scale={scale}>
      {/* --- STAND BASE --- */}
      <mesh material={materials.brassDark} position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.9, 1.1, 0.3, 32]} />
      </mesh>
      {/* Decorative Gold Accent Ring */}
      <mesh material={materials.brassGold} position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.85, 0.08, 32]} />
      </mesh>
      <mesh material={materials.standGlow} position={[0, 0.37, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.7, 32]} />
      </mesh>

      {/* --- STEM & CRADLE ARM --- */}
      <mesh material={materials.brassDark} position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 1.6, 24]} />
      </mesh>
      {/* Pivot sphere */}
      <mesh material={materials.brassGold} position={[0, 1.9, 0]} castShadow>
        <sphereGeometry args={[0.22, 24, 24]} />
      </mesh>
      {/* Curved Cradle Ring */}
      <mesh
        material={materials.brassDark}
        position={[0, 2.3, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <torusGeometry args={[1.3, 0.07, 16, 48, Math.PI]} />
      </mesh>

      {/* --- CELESTIAL BODY & RINGS (Tilted 27 degrees) --- */}
      <group position={[0, 2.3, 0]} rotation={[0.47, 0.2, -0.35]}>
        {/* Central Axis Pin */}
        <mesh material={materials.brassGold} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 2.7, 16]} />
        </mesh>

        {/* Planet Sphere */}
        <group ref={planetBodyRef}>
          <mesh material={materials.planetMat} castShadow receiveShadow>
            <sphereGeometry args={[0.8, 48, 36]} />
          </mesh>
        </group>

        {/* Rings System */}
        <group ref={ringsRef} rotation={[Math.PI / 2, 0, 0]}>
          {/* Inner Ring */}
          <mesh material={materials.ringInner} castShadow receiveShadow>
            <ringGeometry args={[0.95, 1.25, 64]} />
          </mesh>
          {/* Main Ring */}
          <mesh material={materials.ringMain} castShadow receiveShadow>
            <ringGeometry args={[1.3, 1.85, 64]} />
          </mesh>
          {/* Outer Translucent Ring */}
          <mesh material={materials.ringOuter} castShadow receiveShadow>
            <ringGeometry args={[1.9, 2.35, 64]} />
          </mesh>
        </group>
      </group>

      {/* --- ORBITING MOON --- */}
      <mesh ref={moonRef} material={materials.moonMat} position={[1.4, 2.3, -0.9]} castShadow>
        <sphereGeometry args={[0.15, 24, 20]} />
      </mesh>
    </group>
  );
}

export default DeskPlanet;
