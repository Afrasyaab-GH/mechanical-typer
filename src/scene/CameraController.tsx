import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useStore } from "../app/store";
import type { CameraMode } from "../app/store";
import { getBuild } from "./buildRegistry";

const CAMERA_MODES: Record<CameraMode, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  write: { pos: new THREE.Vector3(0, 24, 28), target: new THREE.Vector3(0, 14.8, -1.6) },
  paper: { pos: new THREE.Vector3(0, 19, 14), target: new THREE.Vector3(0, 15.2, -1.8) },
  mechanism: { pos: new THREE.Vector3(8.5, 13.5, 13), target: new THREE.Vector3(0, 11.8, -1.8) },
  inspect: { pos: new THREE.Vector3(30, 22, 34), target: new THREE.Vector3(0, 9.5, 0) },
};

export function CameraController() {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraMode = useStore((s) => s.cameraMode);
  const selectedPart = useStore((s) => s.selectedPart);
  const destination = useRef({
    pos: CAMERA_MODES.write.pos.clone(),
    target: CAMERA_MODES.write.target.clone(),
  });
  const transitioning = useRef(false);

  // Mode changes: reframe, pulling back on narrow (mobile) viewports
  useEffect(() => {
    const mode = CAMERA_MODES[cameraMode];
    destination.current.pos.copy(mode.pos);
    destination.current.target.copy(mode.target);
    const aspect = size.width / size.height;
    if (aspect < 1) {
      destination.current.pos
        .sub(mode.target)
        .multiplyScalar(1 / Math.max(0.55, aspect * 0.9))
        .add(mode.target);
    }
    transitioning.current = true;
  }, [cameraMode, size]);

  // Part selection: glide the camera to the part (outside WRITE mode)
  useEffect(() => {
    if (!selectedPart || cameraMode === "write") return;
    const build = getBuild();
    const part = build?.byId.get(selectedPart);
    if (!part) return;
    const box = new THREE.Box3().setFromObject(part.partGroup);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    destination.current.target.copy(center);
    const direction = camera.position.clone().sub(center).normalize();
    const distance = Math.max(14, box.getSize(new THREE.Vector3()).length() * 2.2);
    destination.current.pos.copy(center).addScaledVector(direction, distance);
    transitioning.current = true;
  }, [selectedPart, cameraMode, camera]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const motionReduced = useStore.getState().motionReduced;
    controls.enableRotate = cameraMode === "inspect";
    controls.enablePan = cameraMode === "inspect";
    controls.enableZoom = true;
    if (transitioning.current) {
      const factor = motionReduced ? 1 : Math.min(1, delta * 3.2);
      camera.position.lerp(destination.current.pos, factor);
      controls.target.lerp(destination.current.target, factor);
      if (
        camera.position.distanceTo(destination.current.pos) < 0.08 &&
        controls.target.distanceTo(destination.current.target) < 0.08
      ) {
        transitioning.current = false;
      }
    }
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={12}
      maxDistance={85}
      minPolarAngle={0.12}
      maxPolarAngle={1.42}
      target={CAMERA_MODES.write.target.toArray() as [number, number, number]}
    />
  );
}
