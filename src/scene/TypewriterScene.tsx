import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { Lighting, DeskSet } from "./Lighting";
import { Machine } from "./Machine";
import { CameraController } from "./CameraController";
import { PartPicker } from "./PartPicker";
import { DeskPlanet } from "./DeskPlanet";
import { EarthPlanet } from "./EarthPlanet";

function isCoarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}

export function TypewriterScene() {
  const coarse = isCoarsePointer();
  return (
    <Canvas
      shadows="percentage"
      dpr={coarse ? [1, 1.5] : [1, 2]}
      camera={{ fov: 38, near: 0.5, far: 400, position: [17, 25, 38] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <color attach="background" args={[0x050505]} />
      <fog attach="fog" args={[0x050505, 90, 220]} />
      <Lighting />
      <DeskSet />
      <Machine />
      <CameraController />
      <PartPicker />
      {/* Decorative Celestial Desk Globes (Equidistant from side panels) */}
      <DeskPlanet position={[28, 2.4, 2]} scale={2.4} />
      <EarthPlanet position={[-28, 2.4, 2]} scale={2.4} />
    </Canvas>
  );
}
