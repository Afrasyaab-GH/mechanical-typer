import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Procedural earth map with continents, oceans, and clouds */
function createEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // 1. Deep Ocean Base
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 512);
    oceanGrad.addColorStop(0.0, "#08294a");
    oceanGrad.addColorStop(0.2, "#0e4174");
    oceanGrad.addColorStop(0.5, "#14528c");
    oceanGrad.addColorStop(0.8, "#0e4174");
    oceanGrad.addColorStop(1.0, "#08294a");
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 1024, 512);

    // 2. Polar Ice Caps
    ctx.fillStyle = "#eef5fc";
    ctx.beginPath();
    ctx.ellipse(512, 18, 512, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(512, 494, 512, 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Procedural Continents
    const drawLandBlob = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      fillColor: string,
    ) => {
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      for (let angle = 0; angle < Math.PI * 2; angle += 0.25) {
        const noise = 1 + (Math.sin(angle * 4 + cx) * 0.22 + Math.cos(angle * 7) * 0.15);
        const x = cx + Math.cos(angle) * rx * noise;
        const y = cy + Math.sin(angle) * ry * noise;
        if (angle === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    };

    // North America & Greenland
    drawLandBlob(240, 140, 95, 65, "#2d6a4f");
    drawLandBlob(280, 90, 45, 30, "#d8f3dc"); // Greenland
    drawLandBlob(200, 180, 55, 45, "#40916c"); // Central / West

    // South America
    drawLandBlob(310, 310, 60, 90, "#1b4332");
    drawLandBlob(330, 340, 45, 65, "#2d6a4f");

    // Europe & UK
    drawLandBlob(520, 140, 65, 45, "#52b788");
    drawLandBlob(480, 130, 20, 25, "#74c69d");

    // Africa
    drawLandBlob(540, 270, 75, 95, "#b08968");
    drawLandBlob(545, 230, 65, 45, "#ddb892"); // Sahara
    drawLandBlob(550, 310, 55, 60, "#2d6a4f"); // Central/South rainforest

    // Asia
    drawLandBlob(700, 160, 130, 80, "#40916c");
    drawLandBlob(740, 190, 95, 60, "#52b788");
    drawLandBlob(650, 220, 45, 45, "#b08968"); // Middle East
    drawLandBlob(690, 240, 45, 45, "#74c69d"); // India

    // Australia & Islands
    drawLandBlob(820, 350, 65, 50, "#c97a3e");
    drawLandBlob(780, 280, 45, 20, "#52b788"); // Indonesia

    // 4. Atmospheric Cloud Swirls
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    for (let i = 0; i < 18; i++) {
      const x = (i * 68 + 35) % 1024;
      const y = 90 + Math.sin(i * 1.3) * 160;
      ctx.beginPath();
      ctx.ellipse(x, y, 70, 18, 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function EarthPlanet({
  position = [26, 2.4, -12],
  scale = 2.4,
}: {
  position?: [number, number, number];
  scale?: number;
}) {
  const earthBodyRef = useRef<THREE.Group>(null);
  const moonRef = useRef<THREE.Mesh>(null);

  const texture = useMemo(() => createEarthTexture(), []);

  // Materials
  const materials = useMemo(() => {
    const brassAntique = new THREE.MeshStandardMaterial({
      color: "#3a2a1a",
      roughness: 0.3,
      metalness: 0.85,
    });
    const brassPolished = new THREE.MeshStandardMaterial({
      color: "#c89d38",
      roughness: 0.2,
      metalness: 0.9,
    });
    const earthMat = new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: 0.5,
      metalness: 0.05,
      clearcoat: 0.3,
      clearcoatRoughness: 0.15,
    });
    const moonMat = new THREE.MeshStandardMaterial({
      color: "#cfd6df",
      roughness: 0.6,
      metalness: 0.1,
    });

    return { brassAntique, brassPolished, earthMat, moonMat };
  }, [texture]);

  useFrame((_, delta) => {
    if (earthBodyRef.current) {
      earthBodyRef.current.rotation.y += delta * 0.25;
    }
    if (moonRef.current) {
      const time = Date.now() * 0.001;
      moonRef.current.position.x = Math.cos(time * 0.6) * 1.5;
      moonRef.current.position.z = Math.sin(time * 0.6) * 1.5;
      moonRef.current.position.y = 2.3 + Math.sin(time * 1.2) * 0.25;
    }
  });

  return (
    <group position={position} scale={scale}>
      {/* --- GLOBE PEDESTAL BASE --- */}
      <mesh material={materials.brassAntique} position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.85, 1.05, 0.3, 32]} />
      </mesh>
      {/* Polished Collar */}
      <mesh material={materials.brassPolished} position={[0, 0.32, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.8, 0.08, 32]} />
      </mesh>

      {/* --- STEM & VERTICAL PILLAR --- */}
      <mesh material={materials.brassAntique} position={[0, 1.05, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.13, 1.5, 24]} />
      </mesh>
      {/* Decorative Finial Sphere */}
      <mesh material={materials.brassPolished} position={[0, 1.85, 0]} castShadow>
        <sphereGeometry args={[0.2, 24, 24]} />
      </mesh>

      {/* --- SEMI-MERIDIAN BRASS CALIBRATED RING --- */}
      <mesh
        material={materials.brassPolished}
        position={[0, 2.3, 0]}
        rotation={[0, 0, Math.PI / 2]}
        castShadow
      >
        <torusGeometry args={[1.15, 0.06, 16, 48, Math.PI]} />
      </mesh>

      {/* Top and Bottom Meridian Pin Caps */}
      <mesh material={materials.brassAntique} position={[0, 3.48, 0]} castShadow>
        <sphereGeometry args={[0.09, 16, 16]} />
      </mesh>
      <mesh material={materials.brassAntique} position={[0, 1.12, 0]} castShadow>
        <sphereGeometry args={[0.09, 16, 16]} />
      </mesh>

      {/* --- EARTH BODY (Tilted 23.4 degrees on polar axis) --- */}
      <group position={[0, 2.3, 0]} rotation={[0.41, 0, -0.2]}>
        {/* Polar Axis Rod */}
        <mesh material={materials.brassPolished}>
          <cylinderGeometry args={[0.03, 0.03, 2.4, 16]} />
        </mesh>

        {/* Earth Sphere */}
        <group ref={earthBodyRef}>
          <mesh material={materials.earthMat} castShadow receiveShadow>
            <sphereGeometry args={[0.75, 48, 36]} />
          </mesh>
        </group>
      </group>

      {/* --- ORBITING LUNA (MOON) --- */}
      <mesh ref={moonRef} material={materials.moonMat} position={[1.3, 2.3, -0.6]} castShadow>
        <sphereGeometry args={[0.14, 24, 20]} />
      </mesh>
    </group>
  );
}

export default EarthPlanet;
