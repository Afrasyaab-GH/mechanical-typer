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

/**
 * Procedural slotted machine screw cap diffuse texture.
 * Generates a polished radial brushed face with an authentic dark screwdriver slot.
 */
function buildScrewTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const center = size / 2;

  // Background radial metallic sheen
  const grad = ctx.createRadialGradient(center, center, size * 0.05, center, center, size * 0.48);
  grad.addColorStop(0.0, "#ffffff");
  grad.addColorStop(0.2, "#e8e8ea");
  grad.addColorStop(0.55, "#cccccc");
  grad.addColorStop(0.85, "#a0a0a4");
  grad.addColorStop(1.0, "#606064");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Concentric lathe circular machining marks
  ctx.save();
  const rand = makePRNG(137);
  for (let r = 8; r < center; r += 3) {
    const alpha = 0.04 + rand() * 0.08;
    ctx.strokeStyle = rand() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = 1 + rand() * 1.5;
    ctx.beginPath();
    ctx.arc(center, center, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Outer chamfer bevel ring
  ctx.strokeStyle = "rgba(40, 40, 45, 0.6)";
  ctx.lineWidth = size * 0.035;
  ctx.beginPath();
  ctx.arc(center, center, size * 0.45, 0, Math.PI * 2);
  ctx.stroke();

  // Outer highlight rim
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = size * 0.02;
  ctx.beginPath();
  ctx.arc(center, center, size * 0.43, 0, Math.PI * 2);
  ctx.stroke();

  // Screwdriver slot (deep centered rectangular groove)
  const slotW = size * 0.68;
  const slotH = size * 0.125;
  const slotX = center - slotW / 2;
  const slotY = center - slotH / 2;

  // Outer groove shadow & bevel
  ctx.fillStyle = "#111113";
  ctx.fillRect(slotX, slotY, slotW, slotH);

  // Deep groove floor
  ctx.fillStyle = "#050506";
  ctx.fillRect(slotX + 2, slotY + 2, slotW - 4, slotH - 4);

  // Crisp metallic edge highlights on top and bottom slot lips
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(slotX, slotY - 1.5, slotW, 2);
  ctx.fillStyle = "#555558";
  ctx.fillRect(slotX, slotY + slotH - 0.5, slotW, 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Procedural normal map for slotted screw heads.
 * Defines physical 3D groove sidewalls and crown curvature.
 */
function buildScrewNormalMap(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const center = size / 2;

  ctx.fillStyle = "rgb(128, 128, 255)";
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  const slotHalfW = size * 0.34;
  const slotHalfH = size * 0.0625;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let nx = 0;
      let ny = 0;
      let nz = 1;

      // Crown curvature towards edges
      const maxR = size * 0.46;
      if (dist < maxR && dist > 1) {
        const falloff = Math.pow(dist / maxR, 2.5) * 0.4;
        nx += (dx / dist) * falloff;
        ny += (dy / dist) * falloff;
      }

      // Slot groove slopes
      if (Math.abs(dx) <= slotHalfW && Math.abs(dy) <= slotHalfH + 3) {
        const distFromSlotEdge = Math.abs(dy) - slotHalfH;
        if (Math.abs(distFromSlotEdge) <= 3) {
          const slotSlope = dy > 0 ? 0.75 : -0.75;
          ny += slotSlope;
        }
      }

      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len;
      ny /= len;
      nz /= len;

      data[idx] = Math.floor((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.floor((-ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.floor((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/** Linear brushed metal diffuse map (nickel, chrome, polished steel). */
function buildBrushedMetalTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#e0e0e4";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(89);
  for (let i = 0; i < 400; i++) {
    const y = rand() * size;
    const h = 0.5 + rand() * 1.5;
    const brightness = 185 + Math.floor(rand() * 70);
    const alpha = 0.12 + rand() * 0.22;
    ctx.fillStyle = `rgba(${brightness},${brightness},${brightness + 4},${alpha})`;
    ctx.fillRect(0, y, size, h);
  }

  for (let i = 0; i < 180; i++) {
    const y = rand() * size;
    const h = 0.5 + rand() * 1.0;
    const alpha = 0.06 + rand() * 0.14;
    ctx.fillStyle = `rgba(35,35,40,${alpha})`;
    ctx.fillRect(0, y, size, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Linear brushed metal normal map for anisotropic glints. */
function buildBrushedMetalNormalMap(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(91);
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    const freq = Math.sin(y * 0.45) * 14 + Math.sin(y * 1.8) * 8;
    const noise = (rand() - 0.5) * 16;
    const slope = Math.min(127, Math.max(-128, Math.round(freq + noise)));
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      data[idx + 1] = Math.min(255, Math.max(0, 128 + slope));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** Brushed metal roughness map. */
function buildBrushedMetalRoughnessMap(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgb(85,85,85)";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(93);
  for (let i = 0; i < 300; i++) {
    const y = rand() * size;
    const h = 0.5 + rand() * 2.0;
    const val = 60 + Math.floor(rand() * 80);
    ctx.fillStyle = `rgba(${val},${val},${val},0.28)`;
    ctx.fillRect(0, y, size, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** Gunmetal / cold-rolled steel diffuse texture. */
function buildSteelDarkTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#4a4b4e";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(101);
  for (let i = 0; i < 80; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 15 + rand() * 40;
    const val = 40 + Math.floor(rand() * 50);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${val},${val},${val + 5},0.3)`);
    grad.addColorStop(1, `rgba(${val},${val},${val + 5},0.0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Cold-rolled steel normal map. */
function buildSteelDarkNormalMap(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(103);
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noiseX = (rand() - 0.5) * 20;
    const noiseY = (rand() - 0.5) * 20;
    data[i] = Math.min(255, Math.max(0, data[i] + noiseX));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noiseY));
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** Machined brass diffuse texture. */
function buildBrassTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#c99a4e";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(113);
  for (let i = 0; i < 200; i++) {
    const y = rand() * size;
    const h = 0.5 + rand() * 2.0;
    const val = 170 + Math.floor(rand() * 70);
    const alpha = 0.15 + rand() * 0.25;
    ctx.fillStyle = `rgba(${val},${Math.floor(val * 0.78)},${Math.floor(val * 0.35)},${alpha})`;
    ctx.fillRect(0, y, size, h);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Machined brass normal map. */
function buildBrassNormalMap(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(115);
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    const freq = Math.sin(y * 0.6) * 12 + (rand() - 0.5) * 10;
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      data[idx + 1] = Math.min(255, Math.max(0, 128 + freq));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** Vulcanized rubber normal map with micropores and extrusion texture. */
function buildRubberNormalMap(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(127);
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noiseX = (rand() - 0.5) * 28;
    const noiseY = (rand() - 0.5) * 28;
    data[i] = Math.min(255, Math.max(0, data[i] + noiseX));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noiseY));
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** Vulcanized rubber roughness map. */
function buildRubberRoughnessMap(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgb(235,235,235)";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(129);
  for (let i = 0; i < 150; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 4 + rand() * 16;
    const val = 200 + Math.floor(rand() * 45);
    ctx.fillStyle = `rgba(${val},${val},${val},0.35)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** Woven inked fabric ribbon texture. */
function buildRibbonTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#121014";
  ctx.fillRect(0, 0, size, size);

  const step = 4;
  for (let x = 0; x < size; x += step) {
    for (let y = 0; y < size; y += step) {
      const isEven = ((x + y) / step) % 2 === 0;
      ctx.fillStyle = isEven ? "#26222a" : "#0d0b0f";
      ctx.fillRect(x, y, step, step);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Woven fabric ribbon normal map. */
function buildRibbonNormalMap(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  const step = 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const modX = x % step;
      const modY = y % step;
      const nx = (modX - step / 2) * 18;
      const ny = (modY - step / 2) * 18;
      data[idx] = Math.min(255, Math.max(0, 128 + nx));
      data[idx + 1] = Math.min(255, Math.max(0, 128 + ny));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 4);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** Pressed wool felt normal map. */
function buildFeltNormalMap(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(149);
  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const noiseX = (rand() - 0.5) * 35;
    const noiseY = (rand() - 0.5) * 35;
    data[i] = Math.min(255, Math.max(0, data[i] + noiseX));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noiseY));
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 8);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** Polished bakelite / dark celluloid diffuse texture. */
function buildBakeliteTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#1e1d1f";
  ctx.fillRect(0, 0, size, size);

  const rand = makePRNG(163);
  for (let i = 0; i < 40; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 20 + rand() * 60;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(45,43,48,0.22)");
    grad.addColorStop(1, "rgba(20,19,22,0.0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------------ */
/* Shared PBR texture instances (built once, reused by all materials)  */
/* ------------------------------------------------------------------ */

let _enamelNormal: THREE.CanvasTexture | null = null;
let _enamelRoughness: THREE.CanvasTexture | null = null;
let _castIronNormal: THREE.CanvasTexture | null = null;
let _screwTexture: THREE.CanvasTexture | null = null;
let _screwNormal: THREE.CanvasTexture | null = null;
let _brushedMetalTexture: THREE.CanvasTexture | null = null;
let _brushedMetalNormal: THREE.CanvasTexture | null = null;
let _brushedMetalRoughness: THREE.CanvasTexture | null = null;
let _steelDarkTexture: THREE.CanvasTexture | null = null;
let _steelDarkNormal: THREE.CanvasTexture | null = null;
let _brassTexture: THREE.CanvasTexture | null = null;
let _brassNormal: THREE.CanvasTexture | null = null;
let _rubberNormal: THREE.CanvasTexture | null = null;
let _rubberRoughness: THREE.CanvasTexture | null = null;
let _ribbonTexture: THREE.CanvasTexture | null = null;
let _ribbonNormal: THREE.CanvasTexture | null = null;
let _feltNormal: THREE.CanvasTexture | null = null;
let _bakeliteTexture: THREE.CanvasTexture | null = null;

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
function getScrewTexture(): THREE.CanvasTexture {
  if (!_screwTexture) _screwTexture = buildScrewTexture();
  return _screwTexture;
}
function getScrewNormal(): THREE.CanvasTexture {
  if (!_screwNormal) _screwNormal = buildScrewNormalMap();
  return _screwNormal;
}
function getBrushedMetalTexture(): THREE.CanvasTexture {
  if (!_brushedMetalTexture) _brushedMetalTexture = buildBrushedMetalTexture();
  return _brushedMetalTexture;
}
function getBrushedMetalNormal(): THREE.CanvasTexture {
  if (!_brushedMetalNormal) _brushedMetalNormal = buildBrushedMetalNormalMap();
  return _brushedMetalNormal;
}
function getBrushedMetalRoughness(): THREE.CanvasTexture {
  if (!_brushedMetalRoughness) _brushedMetalRoughness = buildBrushedMetalRoughnessMap();
  return _brushedMetalRoughness;
}
function getSteelDarkTexture(): THREE.CanvasTexture {
  if (!_steelDarkTexture) _steelDarkTexture = buildSteelDarkTexture();
  return _steelDarkTexture;
}
function getSteelDarkNormal(): THREE.CanvasTexture {
  if (!_steelDarkNormal) _steelDarkNormal = buildSteelDarkNormalMap();
  return _steelDarkNormal;
}
function getBrassTexture(): THREE.CanvasTexture {
  if (!_brassTexture) _brassTexture = buildBrassTexture();
  return _brassTexture;
}
function getBrassNormal(): THREE.CanvasTexture {
  if (!_brassNormal) _brassNormal = buildBrassNormalMap();
  return _brassNormal;
}
function getRubberNormal(): THREE.CanvasTexture {
  if (!_rubberNormal) _rubberNormal = buildRubberNormalMap();
  return _rubberNormal;
}
function getRubberRoughness(): THREE.CanvasTexture {
  if (!_rubberRoughness) _rubberRoughness = buildRubberRoughnessMap();
  return _rubberRoughness;
}
function getRibbonTexture(): THREE.CanvasTexture {
  if (!_ribbonTexture) _ribbonTexture = buildRibbonTexture();
  return _ribbonTexture;
}
function getRibbonNormal(): THREE.CanvasTexture {
  if (!_ribbonNormal) _ribbonNormal = buildRibbonNormalMap();
  return _ribbonNormal;
}
function getFeltNormal(): THREE.CanvasTexture {
  if (!_feltNormal) _feltNormal = buildFeltNormalMap();
  return _feltNormal;
}
function getBakeliteTexture(): THREE.CanvasTexture {
  if (!_bakeliteTexture) _bakeliteTexture = buildBakeliteTexture();
  return _bakeliteTexture;
}

/* ------------------------------------------------------------------ */
/* Material interfaces & builder                                       */
/* ------------------------------------------------------------------ */

export interface MachineMaterials {
  enamel: THREE.MeshPhysicalMaterial;
  enamelPanel: THREE.MeshPhysicalMaterial;
  castIron: THREE.MeshStandardMaterial;
  nickel: THREE.MeshStandardMaterial;
  screw: THREE.MeshStandardMaterial;
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
      roughness: 0.40,
      metalness: 0.08,
      clearcoat: 0.22,
      clearcoatRoughness: 0.22,
      normalMap: getEnamelNormal(),
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: getEnamelRoughness(),
    }),
    enamelPanel: new THREE.MeshPhysicalMaterial({
      color: colors.panel,
      roughness: 0.42,
      metalness: 0.08,
      clearcoat: 0.18,
      clearcoatRoughness: 0.26,
      normalMap: getEnamelNormal(),
      normalScale: new THREE.Vector2(0.48, 0.48),
      roughnessMap: getEnamelRoughness(),
    }),
    castIron: new THREE.MeshStandardMaterial({
      color: 0x1c1b1a,
      roughness: 0.72,
      metalness: 0.25,
      normalMap: getCastIronNormal(),
      normalScale: new THREE.Vector2(0.65, 0.65),
    }),
    nickel: new THREE.MeshStandardMaterial({
      color: 0xd8d8dc,
      map: getBrushedMetalTexture(),
      roughnessMap: getBrushedMetalRoughness(),
      normalMap: getBrushedMetalNormal(),
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.32,
      metalness: 0.88,
    }),
    screw: new THREE.MeshStandardMaterial({
      color: 0xe0e0e0,
      roughness: 0.26,
      metalness: 0.92,
      map: getScrewTexture(),
      normalMap: getScrewNormal(),
      normalScale: new THREE.Vector2(0.8, 0.8),
    }),
    steelDark: new THREE.MeshStandardMaterial({
      color: 0x4a4a4d,
      map: getSteelDarkTexture(),
      normalMap: getSteelDarkNormal(),
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.52,
      metalness: 0.82,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xb89248,
      map: getBrassTexture(),
      normalMap: getBrassNormal(),
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.36,
      metalness: 0.84,
    }),
    keyRim: new THREE.MeshStandardMaterial({
      color: 0x222222,
      map: getBakeliteTexture(),
      normalMap: getScrewNormal(),
      normalScale: new THREE.Vector2(0.3, 0.3),
      roughness: 0.32,
      metalness: 0.75,
    }),
    keyTop: new THREE.MeshStandardMaterial({
      color: 0xeae2cb,
      roughness: 0.22,
      metalness: 0.04,
    }),
    rubber: new THREE.MeshStandardMaterial({
      color: 0x161616,
      normalMap: getRubberNormal(),
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: getRubberRoughness(),
      roughness: 0.92,
      metalness: 0.02,
    }),
    ribbon: new THREE.MeshStandardMaterial({
      color: 0x141216,
      map: getRibbonTexture(),
      normalMap: getRibbonNormal(),
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.92,
      metalness: 0.0,
      side: THREE.DoubleSide,
    }),
    bellMetal: new THREE.MeshStandardMaterial({
      color: 0xc49b4c,
      map: getBrassTexture(),
      normalMap: getBrassNormal(),
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughness: 0.28,
      metalness: 0.90,
    }),
    wood: new THREE.MeshStandardMaterial({
      map: buildWoodTexture(),
      roughness: 0.72,
      metalness: 0.02,
    }),
    felt: new THREE.MeshStandardMaterial({
      color: 0x2b221d,
      normalMap: getFeltNormal(),
      normalScale: new THREE.Vector2(0.85, 0.85),
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
  materials.enamel.clearcoat = isReflective ? 0.22 + coat * 0.35 : 0.05;
  materials.enamel.clearcoatRoughness = isReflective ? 0.15 : 0.45;
  materials.enamel.reflectivity = refl;
  materials.enamel.envMapIntensity = env;
  materials.enamel.roughness = isReflective ? 0.32 : 0.40;
  materials.enamel.metalness = isReflective ? 0.08 : 0.08;
  materials.enamel.normalScale.set(0.55, 0.55);
  materials.enamel.needsUpdate = true;

  materials.enamelPanel.clearcoat = isReflective ? 0.18 + coat * 0.3 : 0.04;
  materials.enamelPanel.clearcoatRoughness = isReflective ? 0.18 : 0.45;
  materials.enamelPanel.reflectivity = refl;
  materials.enamelPanel.envMapIntensity = env;
  materials.enamelPanel.roughness = isReflective ? 0.35 : 0.42;
  materials.enamelPanel.metalness = isReflective ? 0.08 : 0.08;
  materials.enamelPanel.normalScale.set(0.48, 0.48);
  materials.enamelPanel.needsUpdate = true;

  // Cast iron chassis base
  if (materials.castIron) {
    materials.castIron.envMapIntensity = isReflective ? env * 0.35 : 0.0;
    materials.castIron.roughness = isReflective ? 0.65 : 0.72;
    materials.castIron.metalness = isReflective ? 0.3 : 0.25;
    materials.castIron.normalScale.set(0.65, 0.65);
    materials.castIron.needsUpdate = true;
  }

  // Nickel, steel, brass, and mechanical metals
  materials.nickel.envMapIntensity = env;
  materials.nickel.roughness = isReflective ? 0.24 : 0.32;
  materials.nickel.metalness = isReflective ? 0.92 : 0.88;
  materials.nickel.normalScale.set(isReflective ? 0.45 : 0.65, isReflective ? 0.45 : 0.65);
  materials.nickel.needsUpdate = true;

  if (materials.screw) {
    materials.screw.envMapIntensity = env;
    materials.screw.roughness = isReflective ? 0.20 : 0.26;
    materials.screw.metalness = isReflective ? 0.94 : 0.92;
    materials.screw.normalScale.set(0.8, 0.8);
    materials.screw.needsUpdate = true;
  }

  materials.steelDark.envMapIntensity = isReflective ? env * 0.85 : 0.0;
  materials.steelDark.roughness = isReflective ? 0.42 : 0.52;
  materials.steelDark.metalness = isReflective ? 0.86 : 0.82;
  materials.steelDark.normalScale.set(isReflective ? 0.5 : 0.7, isReflective ? 0.5 : 0.7);
  materials.steelDark.needsUpdate = true;

  materials.brass.envMapIntensity = env;
  materials.brass.roughness = isReflective ? 0.28 : 0.36;
  materials.brass.metalness = isReflective ? 0.88 : 0.84;
  materials.brass.normalScale.set(isReflective ? 0.55 : 0.75, isReflective ? 0.55 : 0.75);
  materials.brass.needsUpdate = true;

  materials.bellMetal.envMapIntensity = env;
  materials.bellMetal.roughness = isReflective ? 0.22 : 0.28;
  materials.bellMetal.metalness = isReflective ? 0.92 : 0.90;
  materials.bellMetal.normalScale.set(isReflective ? 0.65 : 0.85, isReflective ? 0.65 : 0.85);
  materials.bellMetal.needsUpdate = true;

  materials.keyRim.envMapIntensity = isReflective ? env * 0.6 : 0.0;
  materials.keyRim.roughness = isReflective ? 0.26 : 0.32;
  materials.keyRim.metalness = isReflective ? 0.80 : 0.75;
  materials.keyRim.needsUpdate = true;

  materials.keyTop.envMapIntensity = isReflective ? env * 0.25 : 0.0;
  materials.keyTop.roughness = isReflective ? 0.18 : 0.22;
  materials.keyTop.needsUpdate = true;

  materials.rubber.envMapIntensity = isReflective ? env * 0.15 : 0.0;
  materials.rubber.roughness = 0.92;
  materials.rubber.normalScale.set(0.75, 0.75);
  materials.rubber.needsUpdate = true;

  materials.ribbon.envMapIntensity = isReflective ? env * 0.1 : 0.0;
  materials.ribbon.roughness = 0.92;
  materials.ribbon.normalScale.set(0.65, 0.65);
  materials.ribbon.needsUpdate = true;

  materials.felt.envMapIntensity = 0.0;
  materials.felt.roughness = 0.98;
  materials.felt.normalScale.set(0.85, 0.85);
  materials.felt.needsUpdate = true;

  materials.wood.envMapIntensity = isReflective ? env * 0.2 : 0.0;
  materials.wood.roughness = isReflective ? 0.68 : 0.72;
  materials.wood.needsUpdate = true;
}



