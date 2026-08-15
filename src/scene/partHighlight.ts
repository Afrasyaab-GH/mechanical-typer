import * as THREE from "three";
import type { MachineBuild, Part } from "../machine/buildMachine";

type HighlightMode = "none" | "selected" | "related" | "dim";

const savedMaterials = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();

function applyHighlight(part: Part, mode: HighlightMode): void {
  part.partGroup.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const mesh = child as THREE.Mesh;
    if (mode !== "none") {
      if (!savedMaterials.has(mesh)) savedMaterials.set(mesh, mesh.material);
      const original = savedMaterials.get(mesh)!;
      const base = (Array.isArray(original) ? original[0] : original).clone() as THREE.MeshStandardMaterial;
      const hasEmissive = base.emissive !== undefined;
      if (mode === "selected") {
        if (hasEmissive) {
          base.emissive = new THREE.Color(0xb08d57);
          base.emissiveIntensity = 0.55;
        } else {
          base.color = new THREE.Color(0xffd9a0);
        }
      } else if (mode === "related") {
        if (hasEmissive) {
          base.emissive = new THREE.Color(0x8a7a5a);
          base.emissiveIntensity = 0.16;
        } else {
          base.color = new THREE.Color(0xd8cba8);
        }
      } else {
        base.transparent = true;
        base.opacity = 0.22;
      }
      mesh.material = base;
    } else {
      const original = savedMaterials.get(mesh);
      if (original) {
        mesh.material = original;
        savedMaterials.delete(mesh);
      }
    }
  });
}

export function clearHighlights(build: MachineBuild): void {
  for (const part of build.parts) applyHighlight(part, "none");
}

export function highlightPart(part: Part, mode: HighlightMode): void {
  applyHighlight(part, mode);
}
