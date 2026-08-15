import * as THREE from "three";

/** Machine enamel finish themes. */
export type MachineTheme = "midnight" | "olive" | "burgundy" | "turquoise" | "silver";

export const THEME_COLORS: Record<MachineTheme, { main: number; panel: number; label: string }> = {
  midnight: { main: 0x181818, panel: 0x141414, label: "Midnight Black" },
  olive: { main: 0x3b4436, panel: 0x2e362a, label: "Vintage Olive" },
  burgundy: { main: 0x4a1521, panel: 0x3b0f19, label: "Burgundy Maroon" },
  turquoise: { main: 0x2a6066, panel: 0x214c51, label: "Seafoam Turquoise" },
  silver: { main: 0xd4d4d8, panel: 0xb4b4b8, label: "Brushed Silver" },
};

/* ------------------------------------------------------------------ */
/* Procedural PBR texture generators                                   */
/* ------------------------------------------------------------------ */

/** Deterministic PRNG seeded per-call. */
function makePRNG(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/**
 * Procedural enamel normal map — classic 1930s wrinkle/crinkle hammertone.
 * Generates micro-dimpled surface perturbations visible under angled light.
 */
function buildEnamelNormalMap(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(42);
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  // Pass 1: hammertone dimples
  const dimpleCount = 1800;
  for (let d = 0; d < dimpleCount; d++) {
    const cx = Math.floor(rand() * size);
    const cy = Math.floor(rand() * size);
    const radius = 1.5 + rand() * 4.5;
    const depth = 0.08 + rand() * 0.18;

    const r2 = radius * radius;
    const iMin = Math.max(0, Math.floor(cy - radius));
    const iMax = Math.min(size - 1, Math.ceil(cy + radius));
    const jMin = Math.max(0, Math.floor(cx - radius));
    const jMax = Math.min(size - 1, Math.ceil(cx + radius));

    for (let iy = iMin; iy <= iMax; iy++) {
      for (let ix = jMin; ix <= jMax; ix++) {
        const dx = ix - cx;
        const dy = iy - cy;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < r2) {
          const t = 1.0 - dist2 / r2;
          const idx = (iy * size + ix) * 4;
          data[idx] = Math.min(255, Math.max(0, data[idx] + Math.round(dx * depth * t * 40)));
          data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + Math.round(dy * depth * t * 40)));
        }
      }
    }
  }

  // Pass 2: fine grain noise
  for (let i = 0; i < data.length; i += 4) {
    const noiseX = (rand() - 0.5) * 8;
    const noiseY = (rand() - 0.5) * 8;
    data[i] = Math.min(255, Math.max(0, data[i] + noiseX));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noiseY));
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/**
 * Procedural enamel roughness map — spatially varying specularity.
 */
function buildEnamelRoughnessMap(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgb(140,140,140)";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(137);

  for (let p = 0; p < 60; p++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = 20 + rand() * 80;
    const brightness = 100 + Math.floor(rand() * 80);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(${brightness},${brightness},${brightness},0.25)`);
    grad.addColorStop(1, `rgba(${brightness},${brightness},${brightness},0.0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  ctx.strokeStyle = "rgba(200,200,200,0.08)";
  for (let s = 0; s < 120; s++) {
    const x0 = rand() * size;
    const y0 = rand() * size;
    ctx.lineWidth = 0.5 + rand() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + (rand() - 0.5) * 60, y0 + (rand() - 0.5) * 60);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/**
 * Procedural cast-iron normal map.
 */
function buildCastIronNormalMap(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(73);
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noiseX = (rand() - 0.5) * 22;
    const noiseY = (rand() - 0.5) * 22;
    data[i] = Math.min(255, Math.max(0, data[i] + noiseX));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noiseY));
  }

  for (let d = 0; d < 400; d++) {
    const cx = Math.floor(rand() * size);
    const cy = Math.floor(rand() * size);
    const radius = 1 + rand() * 2;
    const r2 = radius * radius;
    for (let iy = Math.max(0, cy - 3); iy <= Math.min(size - 1, cy + 3); iy++) {
      for (let ix = Math.max(0, cx - 3); ix <= Math.min(size - 1, cx + 3); ix++) {
        const dist2 = (ix - cx) ** 2 + (iy - cy) ** 2;
        if (dist2 < r2) {
          const idx = (iy * size + ix) * 4;
          data[idx] = Math.min(255, Math.max(0, data[idx] + 15));
          data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] + 15));
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 18);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** Procedural wood grain for the desk. */
function buildWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#201710";
  ctx.fillRect(0, 0, 512, 512);
  const rand = makePRNG(3);
  for (let i = 0; i < 110; i++) {
    const y = rand() * 512;
    const width = 0.6 + rand() * 2.2;
    const lightness = 18 + rand() * 26;
    ctx.strokeStyle = `rgba(${lightness + 20}, ${lightness + 8}, ${lightness * 0.5}, ${0.25 + rand() * 0.3})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) {
      ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 3 * rand());
    }
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------------ */
/* Shared PBR texture instances (built once, reused by all materials)  */
/* ------------------------------------------------------------------ */

let _enamelNormal: THREE.CanvasTexture | null = null;
let _enamelRoughness: THREE.CanvasTexture | null = null;
let _castIronNormal: THREE.CanvasTexture | null = null;

function getEnamelNormal(): THREE.CanvasTexture {
  if (!_enamelNormal) _enamelNormal = buildEnamelNormalMap();
  return _enamelNormal;
}
function getEnamelRoughness(): THREE.CanvasTexture {
  if (!_enamelRoughness) _enamelRoughness = buildEnamelRoughnessMap();
  return _enamelRoughness;
}
function getCastIronNormal(): THREE.CanvasTexture {
  if (!_castIronNormal) _castIronNormal = buildCastIronNormalMap();
  return _castIronNormal;
}

/* ------------------------------------------------------------------ */
/* Material interfaces & builder                                       */
/* ------------------------------------------------------------------ */

export interface MachineMaterials {
  enamel: THREE.MeshPhysicalMaterial;
  enamelPanel: THREE.MeshPhysicalMaterial;
  castIron: THREE.MeshStandardMaterial;
  nickel: THREE.MeshStandardMaterial;
  steelDark: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  keyRim: THREE.MeshStandardMaterial;
  keyTop: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  ribbon: THREE.MeshStandardMaterial;
  bellMetal: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  felt: THREE.MeshStandardMaterial;
  paperEdge: THREE.MeshStandardMaterial;
}

export function buildMaterials(theme: MachineTheme = "midnight"): MachineMaterials {
  const colors = THEME_COLORS[theme] ?? THEME_COLORS.midnight;

  return {
    enamel: new THREE.MeshPhysicalMaterial({
      color: colors.main,
      roughness: 0.42,
      metalness: 0.08,
      clearcoat: 0.15,
      clearcoatRoughness: 0.25,
      normalMap: getEnamelNormal(),
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: getEnamelRoughness(),
    }),
    enamelPanel: new THREE.MeshPhysicalMaterial({
      color: colors.panel,
      roughness: 0.45,
      metalness: 0.08,
      clearcoat: 0.12,
      clearcoatRoughness: 0.3,
      normalMap: getEnamelNormal(),
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughnessMap: getEnamelRoughness(),
    }),
    castIron: new THREE.MeshStandardMaterial({
      color: 0x1c1b1a,
      roughness: 0.72,
      metalness: 0.25,
      normalMap: getCastIronNormal(),
      normalScale: new THREE.Vector2(0.6, 0.6),
    }),
    nickel: new THREE.MeshStandardMaterial({
      color: 0xd8d8d8,
      roughness: 0.32,
      metalness: 0.88,
    }),
    steelDark: new THREE.MeshStandardMaterial({
      color: 0x5a5a5c,
      roughness: 0.45,
      metalness: 0.82,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xb89248,
      roughness: 0.38,
      metalness: 0.82,
    }),
    keyRim: new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.38,
      metalness: 0.75,
    }),
    keyTop: new THREE.MeshStandardMaterial({
      color: 0xe9e0c8,
      roughness: 0.28,
      metalness: 0.05,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.94,
      metalness: 0.0,
    }),
    ribbon: new THREE.MeshStandardMaterial({
      color: 0x121014,
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
    bellMetal: new THREE.MeshStandardMaterial({
      color: 0xb89248,
      roughness: 0.38,
      metalness: 0.82,
    }),
    wood: new THREE.MeshStandardMaterial({
      map: buildWoodTexture(),
      roughness: 0.75,
      metalness: 0.02,
    }),
    felt: new THREE.MeshStandardMaterial({
      color: 0x2b221d,
      roughness: 0.98,
      metalness: 0,
    }),
    paperEdge: new THREE.MeshStandardMaterial({
      color: 0xe7dfcc,
      roughness: 0.88,
      metalness: 0,
    }),
  };
}

export function applyMachineTheme(materials: MachineMaterials, theme: MachineTheme): void {
  const colors = THEME_COLORS[theme] ?? THEME_COLORS.midnight;
  materials.enamel.color.setHex(colors.main);
  materials.enamelPanel.color.setHex(colors.panel);
  materials.enamel.needsUpdate = true;
  materials.enamelPanel.needsUpdate = true;
}

export function applyReflectionSettings(
  materials: MachineMaterials,
  enabled: boolean,
  intensity: number
): void {
  const isReflective = enabled && intensity > 0.001;
  const coat = isReflective ? Math.min(1.0, 0.4 * intensity) : 0.0;
  const refl = isReflective ? Math.min(1.0, 0.5 * intensity) : 0.0;
  const env = isReflective ? intensity : 0.0;

  // Enamel body chassis and panels
  materials.enamel.clearcoat = isReflective ? 0.15 + coat * 0.35 : 0.0;
  materials.enamel.clearcoatRoughness = isReflective ? 0.15 : 0.5;
  materials.enamel.reflectivity = refl;
  materials.enamel.envMapIntensity = env;
  materials.enamel.roughness = isReflective ? 0.32 : 0.42;
  materials.enamel.metalness = isReflective ? 0.08 : 0.08;
  materials.enamel.normalScale.set(0.35, 0.35);
  materials.enamel.needsUpdate = true;

  materials.enamelPanel.clearcoat = isReflective ? 0.12 + coat * 0.3 : 0.0;
  materials.enamelPanel.clearcoatRoughness = isReflective ? 0.18 : 0.5;
  materials.enamelPanel.reflectivity = refl;
  materials.enamelPanel.envMapIntensity = env;
  materials.enamelPanel.roughness = isReflective ? 0.35 : 0.45;
  materials.enamelPanel.metalness = isReflective ? 0.08 : 0.08;
  materials.enamelPanel.normalScale.set(0.3, 0.3);
  materials.enamelPanel.needsUpdate = true;

  // Cast iron chassis base
  if (materials.castIron) {
    materials.castIron.envMapIntensity = isReflective ? env * 0.3 : 0.0;
    materials.castIron.roughness = isReflective ? 0.65 : 0.72;
    materials.castIron.metalness = isReflective ? 0.3 : 0.25;
    materials.castIron.needsUpdate = true;
  }

  // Nickel, steel, brass, and mechanical metals
  materials.nickel.envMapIntensity = env;
  materials.nickel.roughness = isReflective ? 0.24 : 0.32;
  materials.nickel.metalness = isReflective ? 0.92 : 0.88;
  materials.nickel.needsUpdate = true;

  materials.steelDark.envMapIntensity = env;
  materials.steelDark.roughness = isReflective ? 0.35 : 0.45;
  materials.steelDark.metalness = isReflective ? 0.88 : 0.82;
  materials.steelDark.needsUpdate = true;

  materials.brass.envMapIntensity = env;
  materials.brass.roughness = isReflective ? 0.30 : 0.38;
  materials.brass.metalness = isReflective ? 0.88 : 0.82;
  materials.brass.needsUpdate = true;

  materials.bellMetal.envMapIntensity = env;
  materials.bellMetal.roughness = isReflective ? 0.30 : 0.38;
  materials.bellMetal.metalness = isReflective ? 0.88 : 0.82;
  materials.bellMetal.needsUpdate = true;

  materials.keyRim.envMapIntensity = isReflective ? env * 0.5 : 0.0;
  materials.keyRim.roughness = isReflective ? 0.32 : 0.38;
  materials.keyRim.metalness = isReflective ? 0.75 : 0.75;
  materials.keyRim.needsUpdate = true;

  materials.keyTop.envMapIntensity = isReflective ? env * 0.2 : 0.0;
  materials.keyTop.roughness = isReflective ? 0.24 : 0.28;
  materials.keyTop.needsUpdate = true;

  materials.wood.envMapIntensity = isReflective ? env * 0.15 : 0.0;
  materials.wood.roughness = isReflective ? 0.72 : 0.75;
  materials.wood.needsUpdate = true;
}



