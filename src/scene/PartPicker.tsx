import { useEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../app/store";
import { getBuild } from "./buildRegistry";

/**
 * Raycast part selection. Active in INSPECT mode, in cutaway, or whenever
 * the machine is even slightly exploded; ignores drags beyond 6px.
 */
export function PartPicker() {
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);
  const downAt = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const element = gl.domElement;

    const onPointerDown = (event: PointerEvent) => {
      downAt.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = (event: PointerEvent) => {
      const start = downAt.current;
      downAt.current = null;
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
      const state = useStore.getState();
      if (!(state.explodeCurrent > 0.04 || state.cutaway || state.cameraMode === "inspect")) return;
      const rect = element.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const build = getBuild();
      if (!build) return;
      const hits = raycaster.intersectObject(build.root, true);
      for (const hit of hits) {
        let object: THREE.Object3D | null = hit.object;
        while (object && !object.userData.partId) object = object.parent;
        if (object?.userData.partId) {
          const id = object.userData.partId as string;
          state.selectPart(state.selectedPart === id ? null : id);
          return;
        }
      }
      state.selectPart(null);
    };

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointerup", onPointerUp);
    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointerup", onPointerUp);
    };
  }, [camera, gl, raycaster, pointer]);

  return null;
}
