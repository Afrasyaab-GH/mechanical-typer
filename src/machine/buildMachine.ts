import * as THREE from "three";
import type { MachineMaterials } from "../scene/Materials";
import type { PaperTexture } from "../document/PaperTexture";
import { IME_TYPEBAR, KEYS, TYPEBAR_COUNT, type KeyDef } from "./keyboardLayout";
import { PAPER } from "./constants";

/* ------------------------------------------------------------------ */
/* Layout constants                                                    */
/* ------------------------------------------------------------------ */

const KEY_SPACING = 1.9;
const ROW_POS = [
  { z: 7.4, y: 8.6 },
  { z: 9.35, y: 7.95 },
  { z: 11.3, y: 7.35 },
  { z: 13.25, y: 6.75 },
  { z: 15.3, y: 6.15 },
];
const KEY_CENTER_COL = 7.4;
const PRINT_POINT = new THREE.Vector3(0, 14.6, -1.46);
const PLATEN = { y: 14.6, z: -3.4, r: 1.9, len: 22.4 };
const TILT_ANGLE = Math.PI / 4.5; // ~40 degrees tilt backward
const LIP_Y = PLATEN.y + 0.2;
const LIP_Z = PLATEN.z - PLATEN.r - 0.08; // Behind roller
const TABLE_LENGTH = 7.5;
const TABLE_WIDTH = 22.5; // paperWidth (21.0) + 1.5
export const BASKET_CONFIG = {
  cx: 0,
  cy: 12.8,        // Center of rear upright segment arc (lowered further)
  cz: -1.15,       // Standing upright flat against platen / ribbon vibrator
  radius: 5.2,     // Segment fulcrum wire radius
  arcSpan: THREE.MathUtils.degToRad(140), // 140° fan (-70° to +70°)
  total: TYPEBAR_COUNT,
};

// Computes exact pivot coordinates, rest target, and kinematic orientation for slot index:
export function getBasketSlot(index: number) {
  const total = BASKET_CONFIG.total;
  const u = (index - (total - 1) / 2) / ((total - 1) / 2); // -1.0 (far left) to +1.0 (far right)
  const angle = u * (BASKET_CONFIG.arcSpan / 2);

  // 1. Pivot point P_i on the upright segment arc against the platen / vibrator:
  const px = Math.sin(angle) * BASKET_CONFIG.radius;
  const py = BASKET_CONFIG.cy - Math.cos(angle) * BASKET_CONFIG.radius;
  const pz = BASKET_CONFIG.cz + (1.0 - Math.cos(angle)) * 0.35;
  const pivot = new THREE.Vector3(px, py, pz);

  // 2. Strike target (PRINT_POINT) and strike vector:
  const strikeVector = PRINT_POINT.clone().sub(pivot);
  const barLength = strikeVector.length();
  const strikeDir = strikeVector.clone().normalize();

  // 3. Resting target R_i forming the authentic U-shaped cradle fan (tips raised further):
  const fanAngle = u * THREE.MathUtils.degToRad(62);
  const rx = Math.sin(fanAngle) * 7.2;
  const ry = 8.9 + (u * u) * 3.4;
  const rz = 4.9 - (u * u) * 2.6;
  const restTarget = new THREE.Vector3(rx, ry, rz);

  // Rest direction from pivot:
  const restVector = restTarget.clone().sub(pivot);
  const restDir = restVector.clone().normalize();

  // 4. Hinge axis H = restDir x strikeDir
  const hingeAxis = new THREE.Vector3().crossVectors(restDir, strikeDir).normalize();

  // Swing angle between rest and strike
  const dot = THREE.MathUtils.clamp(restDir.dot(strikeDir), -1, 1);
  const swingAngle = Math.acos(dot);

  // 5. Orthonormal Basis: Local X = HingeAxis, Local Y = RestDir, Local Z = HingeAxis x RestDir
  const zLocal = new THREE.Vector3().crossVectors(hingeAxis, restDir).normalize();
  const xLocal = hingeAxis.clone();
  const yLocal = restDir.clone();

  const basisMatrix = new THREE.Matrix4().makeBasis(xLocal, yLocal, zLocal);
  const orientation = new THREE.Quaternion().setFromRotationMatrix(basisMatrix);

  return {
    position: pivot,
    pivot,
    strikeDir,
    restDir,
    hingeAxis,
    swingAngle,
    orientation,
    basisMatrix,
    barLength,
    u,
    angle,
  };
}
const LEVER_PIVOT = { y: 5, z: -2.8 };
export const CARRIAGE_STEP = 0.2211;
export const LINE_FEED = 24.62 / 44;
export const CARRIAGE_HOME_X = 7.96;

function keyPosition(def: KeyDef): THREE.Vector3 {
  const row = ROW_POS[def.row];
  return new THREE.Vector3((def.col - KEY_CENTER_COL) * KEY_SPACING, row.y, row.z);
}

/* ------------------------------------------------------------------ */
/* Shared geometry helpers                                             */
/* ------------------------------------------------------------------ */

const textureCache = new Map<string, THREE.CanvasTexture>();

/** Keycap legend texture (upper over lower symbol). */
function keycapTexture(top: string, bottom: string): THREE.CanvasTexture {
  const key = `${top}|${bottom}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = "#332e24";
  ctx.textAlign = "center";
  if (bottom && top !== bottom) {
    ctx.font = '600 44px "Courier Prime", monospace';
    ctx.fillText(top, 64, 54);
    ctx.font = '400 36px "Courier Prime", monospace';
    ctx.fillText(bottom, 64, 98);
  } else {
    const label = top || bottom;
    ctx.font = label.length > 4 ? '600 26px "Courier Prime", monospace' : '600 46px "Courier Prime", monospace';
    ctx.fillText(label, 64, label.length > 4 ? 58 : 76);
    if (top && bottom && top === bottom) {
      ctx.font = '400 32px "Courier Prime", monospace';
      ctx.fillText(bottom, 64, 100);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}

/** Type-slug face texture (both symbols on the slug). */
function slugTexture(lower: string, upper: string): THREE.CanvasTexture {
  const key = `slug|${lower}|${upper}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#20201f";
  ctx.fillRect(0, 0, 64, 96);
  ctx.fillStyle = "#b8b2a4";
  ctx.textAlign = "center";
  ctx.font = '600 30px "Courier Prime", monospace';
  ctx.fillText(upper, 32, 36);
  ctx.fillText(lower, 32, 76);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, texture);
  return texture;
}

/** Cylinder between two points. */
function rodBetween(
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  segments = 8,
): THREE.Mesh {
  const direction = to.clone().sub(from);
  const length = direction.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
  mesh.position.copy(from).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

/** Contoured box geometry with smoothed rounded corner pillars and filleted bevels. */
function createRoundedBoxGeometry(
  width: number,
  height: number,
  depth: number,
  radius = 0.4,
  bevelRadius = 0.15,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -depth / 2;
  const w = width;
  const d = depth;
  const r = Math.min(radius, w / 4, d / 4);

  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + d - r);
  shape.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  shape.lineTo(x + r, y + d);
  shape.quadraticCurveTo(x, y + d, x, y + d - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: Math.max(0.01, height - bevelRadius * 2),
    bevelEnabled: bevelRadius > 0.001,
    bevelSegments: 4,
    steps: 1,
    bevelSize: bevelRadius,
    bevelThickness: bevelRadius,
    curveSegments: 8,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function roundedBoxMesh(
  w: number,
  h: number,
  d: number,
  radius: number,
  bevel: number,
  material: THREE.Material,
): THREE.Mesh {
  return new THREE.Mesh(createRoundedBoxGeometry(w, h, d, radius, bevel), material);
}

function boxMesh(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
}

/** Continuous swept side fender with authentic 1930s Standard Portable silhouette matching deck & rear panel. */
function createSideFenderGeometry(thickness = 0.8): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Coordinates in (Z, Y) where 2D x = Z in typewriter space, 2D y = Y:
  // 1. Rear top corner (flush with rear panel & top deck at Y = 11.2, Z = -7.0):
  shape.moveTo(-7.0, 11.2);
  // 2. Rear vertical back edge down to base pan (Y = 2.4, Z = -7.0):
  shape.lineTo(-7.0, 2.4);
  // 3. Bottom base line to front apron (Y = 2.4, Z = 16.2):
  shape.lineTo(16.2, 2.4);
  // 4. Front vertical cheek brow (Y = 5.2, Z = 16.2):
  shape.lineTo(16.2, 5.2);
  // 5. Lower keyboard slope:
  shape.quadraticCurveTo(12.5, 5.8, 8.5, 7.2);
  // 6. Mid slope rise over mechanism bay:
  shape.quadraticCurveTo(4.5, 9.2, -0.5, 11.2);
  // 7. Top horizontal brow back to rear top corner (Y = 11.2):
  shape.lineTo(-7.0, 11.2);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 2,
    bevelSize: 0.15,
    bevelThickness: 0.15,
    curveSegments: 32,
  };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // Center along X-axis (thickness):
  geo.translate(0, 0, -thickness / 2);
  // Rotate so 2D x (Z) -> 3D +Z, 2D y (Y) -> 3D +Y:
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Top deck plate cover with true circular cutout hole for recessed ribbon spool basin. */
function createDeckPlateCoverGeometry(basinX: number, w = 12.0, d = 7.5): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const x0 = -w / 2;
  const z0 = -d / 2;
  const r = 0.4;

  shape.moveTo(x0 + r, z0);
  shape.lineTo(x0 + w - r, z0);
  shape.quadraticCurveTo(x0 + w, z0, x0 + w, z0 + r);
  shape.lineTo(x0 + w, z0 + d - r);
  shape.quadraticCurveTo(x0 + w, z0 + d, x0 + w - r, z0 + d);
  shape.lineTo(x0 + r, z0 + d);
  shape.quadraticCurveTo(x0, z0 + d, x0, z0 + d - r);
  shape.lineTo(x0, z0 + r);
  shape.quadraticCurveTo(x0, z0, x0 + r, z0);

  // Circular spool cutout hole:
  const hole = new THREE.Path();
  hole.absarc(basinX, 0.5 - (-3.25), 2.58, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.22,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.04,
    bevelThickness: 0.04,
    curveSegments: 36,
  };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(0, 0, -0.11);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Continuous swept deck cowl with organic S-curve shoulder matching side fenders. */
function createContouredDeckCowlGeometry(width = 12.0): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Coordinates in (Z, Y) where x = Z in typewriter space, y = Y:
  // 1. Rear top corner:
  shape.moveTo(-7.0, 10.9);
  // 2. Rear vertical wall to chassis base:
  shape.lineTo(-7.0, 2.4);
  // 3. Bottom base line to front sill:
  shape.lineTo(8.5, 2.4);
  // 4. Front vertical sill brow:
  shape.lineTo(8.5, 3.8);
  // 5. Lower keyboard slope:
  shape.quadraticCurveTo(6.8, 5.8, 4.2, 8.6);
  // 6. Smooth convex shoulder waterfall into upper ribbon spool deck:
  shape.quadraticCurveTo(2.2, 11.2, -0.5, 11.2);
  // 7. Sub-deck clearance step for spool basin well:
  shape.lineTo(-0.5, 10.8);
  shape.lineTo(-7.0, 10.8);
  shape.closePath();

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: width,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 2,
    bevelSize: 0.15,
    bevelThickness: 0.15,
    curveSegments: 32,
  };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // Center along X-axis (width):
  geo.translate(0, 0, -width / 2);
  // Rotate so 2D (x=Z, y=Y) maps into 3D (+Z, +Y, +X):
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Continuous swept deck cowl profile height at coordinate Z. */
function getDeckProfileY(z: number): number {
  if (z <= 0.0) return 10.8;
  if (z <= 2.2) return 10.8 - (z / 2.2) * 0.2;
  if (z <= 4.2) {
    const t = (z - 2.2) / 2.0;
    return 10.6 - t * 2.0; // 10.6 -> 8.6
  }
  const t = Math.min(1.0, (z - 4.2) / 1.8);
  return 8.6 - t * 2.8; // 8.6 -> 5.8
}

/** Sculpted U-shaped basket cradle cowl wrapping directly under the typebars and connecting flush to side swept deck cowls. */
function createUnderBasketCowlGeometry(width = 14.4, thickness = 0.20): THREE.BufferGeometry {
  const nu = 36;
  const nv = 28;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const halfW = width / 2; // 7.2

  function evalPoint(u: number, v: number, layer: number): THREE.Vector3 {
    const u2 = u * u;

    // Center longitudinal path (u = 0):
    let zCenter = 0;
    let yCenter = 0;
    if (v <= 0.65) {
      const w = v / 0.65;
      zCenter = (1 - w) * (-1.15) + w * 4.4;
      yCenter = (1 - w) * 7.5 + w * 8.4 - Math.sin(w * Math.PI) * 0.45;
    } else {
      const w = (v - 0.65) / 0.35;
      const s = w * w * (3 - 2 * w);
      zCenter = (1 - s) * 4.4 + s * 6.0;
      yCenter = (1 - s) * 8.4 + s * 5.8;
    }

    // Side edge path (u = ±1 at X = ±7.2):
    const zSide = -0.92 + v * (6.0 - (-0.92));
    const ySide = getDeckProfileY(zSide);

    // Blend across width:
    const x = u * halfW;
    const z = (1 - u2) * zCenter + u2 * zSide;
    const y = (1 - u2) * yCenter + u2 * ySide - layer * thickness;

    return new THREE.Vector3(x, y, z);
  }

  // Generate top (outer) surface vertices:
  for (let iv = 0; iv <= nv; iv++) {
    const v = iv / nv;
    for (let iu = 0; iu <= nu; iu++) {
      const u = (iu / nu) * 2 - 1; // -1 to 1
      const p = evalPoint(u, v, 0);
      positions.push(p.x, p.y, p.z);
      uvs.push(u * 0.5 + 0.5, v);
    }
  }

  // Generate bottom (inner) surface vertices:
  const offset = (nu + 1) * (nv + 1);
  for (let iv = 0; iv <= nv; iv++) {
    const v = iv / nv;
    for (let iu = 0; iu <= nu; iu++) {
      const u = (iu / nu) * 2 - 1;
      const p = evalPoint(u, v, 1);
      positions.push(p.x, p.y, p.z);
      uvs.push(u * 0.5 + 0.5, v);
    }
  }

  // Top surface grid faces:
  const rowStride = nu + 1;
  for (let iv = 0; iv < nv; iv++) {
    for (let iu = 0; iu < nu; iu++) {
      const a = iv * rowStride + iu;
      const b = (iv + 1) * rowStride + iu;
      const c = (iv + 1) * rowStride + (iu + 1);
      const d = iv * rowStride + (iu + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // Bottom surface grid faces (reversed winding):
  for (let iv = 0; iv < nv; iv++) {
    for (let iu = 0; iu < nu; iu++) {
      const a = offset + iv * rowStride + iu;
      const b = offset + (iv + 1) * rowStride + iu;
      const c = offset + (iv + 1) * rowStride + (iu + 1);
      const d = offset + iv * rowStride + (iu + 1);
      indices.push(a, d, b);
      indices.push(b, d, c);
    }
  }

  // Stitch front edge (v = 1):
  const frontTopStart = nv * rowStride;
  const frontBotStart = offset + nv * rowStride;
  for (let iu = 0; iu < nu; iu++) {
    const t0 = frontTopStart + iu;
    const t1 = frontTopStart + iu + 1;
    const b0 = frontBotStart + iu;
    const b1 = frontBotStart + iu + 1;
    indices.push(t0, t1, b0);
    indices.push(t1, b1, b0);
  }

  // Stitch rear edge (v = 0):
  for (let iu = 0; iu < nu; iu++) {
    const t0 = iu;
    const t1 = iu + 1;
    const b0 = offset + iu;
    const b1 = offset + iu + 1;
    indices.push(t0, b0, t1);
    indices.push(t1, b0, b1);
  }

  // Stitch left edge (u = -1 / iu = 0):
  for (let iv = 0; iv < nv; iv++) {
    const t0 = iv * rowStride;
    const t1 = (iv + 1) * rowStride;
    const b0 = offset + iv * rowStride;
    const b1 = offset + (iv + 1) * rowStride;
    indices.push(t0, b0, t1);
    indices.push(t1, b0, b1);
  }

  // Stitch right edge (u = +1 / iu = nu):
  for (let iv = 0; iv < nv; iv++) {
    const t0 = iv * rowStride + nu;
    const t1 = (iv + 1) * rowStride + nu;
    const b0 = offset + iv * rowStride + nu;
    const b1 = offset + (iv + 1) * rowStride + nu;
    indices.push(t0, t1, b0);
    indices.push(t1, b1, b0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}


/** Authentic stamped sheet-metal straight planar typebar. */
function createStraightTypebarGeometry(barLength = 7.4): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // 1. Pivot Fulcrum Eyelet Loop at Origin (0, 0)
  const rPivot = 0.22;
  shape.absarc(0, 0, rPivot, -Math.PI / 2, Math.PI / 2, false);

  // 2. Straight Tapering Shank (Planar stamped steel blade)
  shape.lineTo(0.048, barLength * 0.35);
  shape.lineTo(0.038, barLength);

  // 3. Slug Mounting Tip Top Edge
  shape.lineTo(-0.038, barLength);

  // 4. Return Path (Inner Edge)
  shape.lineTo(-0.048, barLength * 0.35);
  shape.lineTo(-rPivot, 0);
  shape.closePath();

  // Fulcrum pivot center hole
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.08, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.08, // Stamped sheet-metal gauge thickness
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(0, 0, -0.04);
  geo.computeVertexNormals();
  return geo;
}

/** Authentic stamped sheet-steel key lever with horizontal beam and 90-degree curved elbow riser. */
function createKeyLeverGeometry(dy: number, dz: number, thickness = 0.055): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const beamH = 0.38;
  const riserW = 0.28;

  // 1. Rear pull tail top
  shape.moveTo(-1.9, 0.22);
  // 2. Pivot fulcrum top
  shape.lineTo(0.0, 0.20);
  // 3. Horizontal top edge of main lever beam
  shape.lineTo(dz - riserW - 0.7, 0.18);
  // 4. Inner 90-degree curved elbow rising up into key stem
  shape.quadraticCurveTo(dz - riserW, 0.22, dz - riserW, Math.max(0.3, dy * 0.45));
  shape.lineTo(dz - riserW, dy - 0.05);
  // 5. Stem top mounting edge
  shape.lineTo(dz, dy - 0.05);
  // 6. Front vertical edge
  shape.lineTo(dz, Math.max(0.3, dy * 0.45));
  // 7. Outer 90-degree curved elbow turning down to bottom beam
  shape.quadraticCurveTo(dz, -beamH, dz - riserW - 0.7, -beamH);
  // 8. Horizontal bottom edge of main beam
  shape.lineTo(0.0, -beamH);
  // 9. Rear pull tail bottom
  shape.lineTo(-1.9, -0.06);
  shape.closePath();

  // Fulcrum axle hole
  const fulcrumHole = new THREE.Path();
  fulcrumHole.absarc(0, 0, 0.09, 0, Math.PI * 2, true);
  shape.holes.push(fulcrumHole);

  // Rear pull link wire hole
  const tailHole = new THREE.Path();
  tailHole.absarc(-1.6, 0.08, 0.05, 0, Math.PI * 2, true);
  shape.holes.push(tailHole);

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
  };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  // Center along X-axis:
  geo.translate(0, 0, -thickness / 2);
  // Rotate so 2D (x=Z, y=Y) -> 3D (+Z, +Y, +X):
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Authentic vintage stamped sheet-metal ribbon spool flange disc with 4 curved window cutouts and drive pin holes. */
function createRibbonSpoolFlangeGeometry(radius = 2.45, thickness = 0.065): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Outer perimeter disc
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);

  // 1. Center spindle arbor hole (r = 0.36)
  const centerHole = new THREE.Path();
  centerHole.absarc(0, 0, 0.36, 0, Math.PI * 2, true);
  shape.holes.push(centerHole);

  // 2. 4 Radially arrayed curved window cutouts (lightening ports)
  const numPorts = 4;
  const innerR = 0.92;
  const outerR = 1.98;
  const portAngle = (Math.PI * 2) / numPorts;
  const gap = 0.32;

  for (let i = 0; i < numPorts; i++) {
    const aStart = i * portAngle + gap / 2;
    const aEnd = (i + 1) * portAngle - gap / 2;
    const port = new THREE.Path();
    port.absarc(0, 0, innerR, aStart, aEnd, false);
    port.absarc(0, 0, outerR, aEnd, aStart, true);
    port.closePath();
    shape.holes.push(port);
  }

  // 3. 3 Driving spindle pin notch holes
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
    const pinHole = new THREE.Path();
    pinHole.absarc(Math.cos(a) * 0.64, Math.sin(a) * 0.64, 0.085, 0, Math.PI * 2, true);
    shape.holes.push(pinHole);
  }

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    curveSegments: 36,
  };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(0, 0, -thickness / 2);
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/** Lathed knurled brass/nickel thumb nut for spool retention. */
function createKnurledNutGeometry(radius = 0.52, height = 0.32): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(radius * 0.72, 0.0),
    new THREE.Vector2(radius * 0.96, 0.04),
    new THREE.Vector2(radius, 0.08),
    new THREE.Vector2(radius, height - 0.08),
    new THREE.Vector2(radius * 0.92, height - 0.02),
    new THREE.Vector2(radius * 0.62, height),
    new THREE.Vector2(0.0, height),
  ];
  const geo = new THREE.LatheGeometry(points, 32);
  geo.computeVertexNormals();
  return geo;
}

let _woundRibbonTexture: THREE.CanvasTexture | null = null;
/** Concentric wound woven cloth typewriter ribbon texture with fibrous grain and inking saturation. */
function getWoundRibbonTexture(size = 512): THREE.CanvasTexture {
  if (_woundRibbonTexture) return _woundRibbonTexture;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Dark oily inking base
  ctx.fillStyle = "#0e0c10";
  ctx.fillRect(0, 0, size, size);

  // Top-half black ink, bottom-half rich typewriter crimson red (classic bichrome ribbon!)
  const midY = size / 2;
  ctx.fillStyle = "#141216";
  ctx.fillRect(0, 0, size, midY);
  ctx.fillStyle = "#480e14";
  ctx.fillRect(0, midY, size, size - midY);

  // Concentric winding layer lines and fibrous thread weave
  let s = 171;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let y = 0; y < size; y++) {
    const isTop = y < midY;
    const baseColor = isTop ? 18 : 64;
    const val = baseColor + Math.floor((rand() - 0.5) * 16);
    ctx.fillStyle = isTop ? `rgb(${val},${val},${val + 3})` : `rgb(${val + 24},${Math.floor(val * 0.25)},${Math.floor(val * 0.3)})`;
    ctx.fillRect(0, y, size, 1);
  }

  // Vertical woven warp/weft cross-threads
  for (let x = 0; x < size; x += 3) {
    ctx.fillStyle = `rgba(255,255,255,0.045)`;
    ctx.fillRect(x, 0, 1, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  _woundRibbonTexture = texture;
  return texture;
}

/** Knurled vintage Bakelite / rubber platen hand wheel with axial grip flutes. */
function createKnurledPlatenKnobGeometry(r = 1.25, len = 1.1): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(r * 0.72, 0.0),
    new THREE.Vector2(r * 0.95, 0.08),
    new THREE.Vector2(r, 0.22),
    new THREE.Vector2(r, len - 0.22),
    new THREE.Vector2(r * 0.95, len - 0.08),
    new THREE.Vector2(r * 0.72, len),
    new THREE.Vector2(0.0, len),
  ];
  const geo = new THREE.LatheGeometry(points, 32);
  geo.computeVertexNormals();
  return geo;
}

let _paperTableScaleTexture: THREE.CanvasTexture | null = null;
/** Engraved silver column ruler scale texture for paper rest table (columns 0-80). */
function getPaperTableScaleTexture(): THREE.CanvasTexture {
  if (_paperTableScaleTexture) return _paperTableScaleTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  // Satin steel backing
  ctx.fillStyle = "#262628";
  ctx.fillRect(0, 0, 1024, 128);

  // Top silver ruler strip
  ctx.fillStyle = "#3a3a3e";
  ctx.fillRect(24, 14, 976, 56);
  ctx.strokeStyle = "#7e7e84";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24, 14, 976, 56);

  // Column graduation ticks & numbers 0 to 80
  ctx.fillStyle = "#dedee4";
  ctx.font = '600 17px "Courier Prime", monospace';
  ctx.textAlign = "center";

  const totalCols = 80;
  const startX = 48;
  const endX = 976;
  const colStep = (endX - startX) / totalCols;

  for (let c = 0; c <= totalCols; c++) {
    const x = startX + c * colStep;
    const isMajor = c % 10 === 0;
    const isMid = c % 5 === 0;
    const tickH = isMajor ? 26 : isMid ? 18 : 10;

    ctx.strokeStyle = isMajor ? "#f0f0f4" : "#9e9ea4";
    ctx.lineWidth = isMajor ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 14);
    ctx.lineTo(x, 14 + tickH);
    ctx.stroke();

    if (isMajor) {
      ctx.fillText(String(c), x, 62);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  _paperTableScaleTexture = texture;
  return texture;
}

/** Vintage Gold serif badge banner texture for front apron. */
function buildGoldBadgeTexture(title = "PLATEN", subtitle = "3D MECHANICAL TYPEWRITER"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#121214";
  ctx.fillRect(0, 0, 1024, 160);

  ctx.strokeStyle = "#c89d46";
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, 1000, 136);

  ctx.strokeStyle = "#e8c36b";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(20, 20, 984, 120);

  for (const [cx, cy] of [
    [20, 20],
    [1004, 20],
    [20, 140],
    [1004, 140],
  ]) {
    ctx.fillStyle = "#ffd572";
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e8c36b";
  ctx.font = "bold 60px 'Cinzel', 'Playfair Display', 'Georgia', serif";
  ctx.fillText(title, 512, 64);

  ctx.fillStyle = "#ba964c";
  ctx.font = "bold 22px 'Cinzel', 'Georgia', serif";
  ctx.fillText(subtitle, 512, 120);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Dynamic multi-segment ribbon strip mesh that supports real-time spline deformation and realistic cloth waviness. */
export function createDynamicRibbonMesh(material: THREE.Material, segments = 32): THREE.Mesh {
  const geom = new THREE.BufferGeometry();
  const vertexCount = (segments + 1) * 2;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = new Uint16Array(segments * 6);

  let idx = 0;
  for (let i = 0; i < segments; i++) {
    const v0 = i * 2;
    const v1 = i * 2 + 1;
    const v2 = (i + 1) * 2;
    const v3 = (i + 1) * 2 + 1;

    indices[idx++] = v0;
    indices[idx++] = v1;
    indices[idx++] = v2;

    indices[idx++] = v2;
    indices[idx++] = v1;
    indices[idx++] = v3;
  }

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    uvs[i * 4] = u;
    uvs[i * 4 + 1] = 1;
    uvs[i * 4 + 2] = u;
    uvs[i * 4 + 3] = 0;
  }

  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));

  const mesh = new THREE.Mesh(geom, material);
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Part registry types                                                 */
/* ------------------------------------------------------------------ */

export interface Pose {
  px: number;
  py: number;
  pz: number;
  rx: number;
  ry: number;
  rz: number;
}

interface PartMeta {
  id: string;
  label: string;
  fn: string;
  system: string;
  stagger: number;
  offset: Partial<Pose>;
  parentId?: string | null;
  cutawayFade?: boolean;
  upstream?: string[];
  downstream?: string[];
}

export interface Part {
  id: string;
  label: string;
  fn: string;
  system: string;
  partGroup: THREE.Group;
  action: THREE.Object3D | null;
  assembled: Pose;
  exploded: Pose;
  stagger: number;
  parentId: string | null;
  cutawayFade: boolean;
  upstream: string[];
  downstream: string[];
}

export interface MachineRefs {
  basketGroup: THREE.Group;
  carriageGroup: THREE.Group;
  keyActions: Map<string, { cap: THREE.Object3D; lever: THREE.Object3D | null }>;
  typebarActions: THREE.Object3D[];
  typebarRestAngles: number[];
  typebarStrikeAngles: number[];
  universalBarAction: THREE.Object3D;
  vibratorAction: THREE.Object3D;
  spoolL: THREE.Object3D;
  spoolR: THREE.Object3D;
  escapeWheelAction: THREE.Object3D;
  platenAction: THREE.Object3D;
  ratchetAction: THREE.Object3D;
  returnLeverAction: THREE.Object3D;
  bellAction: THREE.Object3D;
  ribbonSideL: THREE.Mesh;
  ribbonSideR: THREE.Mesh;
  ribbonTipL: THREE.Vector3;
  ribbonTipR: THREE.Vector3;
  paperMesh: THREE.Mesh;
  topGuide: THREE.Group;
  ribbonAdvanceGear?: THREE.Object3D;
  ribbonAdvanceSpindle?: THREE.Object3D;
  ribbonAdvanceRocker?: THREE.Object3D;
  ribbonReverseSpindle?: THREE.Object3D;
  ribbonReverseGear?: THREE.Object3D;
  updatePaper: (line: number, mode?: "sheet" | "scroll") => void;
}

export interface MachineBuild {
  root: THREE.Group;
  parts: Part[];
  byId: Map<string, Part>;
  refs: MachineRefs;
}

function poseOf(object: THREE.Object3D): Pose {
  return {
    px: object.position.x,
    py: object.position.y,
    pz: object.position.z,
    rx: object.rotation.x,
    ry: object.rotation.y,
    rz: object.rotation.z,
  };
}

/* ------------------------------------------------------------------ */
/* Paper sheet & Over-the-Top Conveyor Loop                            */
/* ------------------------------------------------------------------ */

export const SCROLL_LOOP_LINES = 48; // Total lines around complete 3D ribbon circuit

export interface PaperPathParams {
  platenCenter: THREE.Vector3;
  platenRadius: number;
  feedAngle: number;     // e.g. 0.75 rad (~43 deg)
  trayLength: number;    // e.g. 10.0 units
  uprightLength: number; // e.g. 25.0 units
}

export interface LoopPathParams {
  platenCenter: THREE.Vector3;
  platenRadius: number;
  topCenter: THREE.Vector3;
  topRadius: number;
}

/**
 * Returns [y, z] for a given cumulative arc-distance `s` along the open A4 paper guide path.
 *  - SEGMENT 1: Rear Feed Tray (s from 0 to sTrayEnd)
 *  - SEGMENT 2: Platen Under-Wrap (s from sTrayEnd to sArcEnd)
 *  - SEGMENT 3: Emerging Upright Sheet (s > sArcEnd)
 */
export function samplePaperGuidePath(s: number, p: PaperPathParams): [number, number] {
  const { platenCenter, platenRadius: r, feedAngle, trayLength } = p;
  const cy = platenCenter.y;
  const cz = platenCenter.z;

  const arcLength = Math.PI * r;
  const sTrayEnd = trayLength;
  const sArcEnd = sTrayEnd + arcLength;

  // SEGMENT 1: Rear Feed Tray (extrapolates cleanly for any s <= sTrayEnd)
  if (s <= sTrayEnd) {
    const distFromRoller = sTrayEnd - s; // positive distance up the rear tray
    const lipY = cy;
    const lipZ = cz - r;
    const y = lipY + distFromRoller * Math.cos(feedAngle) + 0.08 * Math.sin(feedAngle);
    const z = lipZ - distFromRoller * Math.sin(feedAngle) + 0.08 * Math.cos(feedAngle);
    return [y, z];
  }

  // SEGMENT 2: Platen Under-Wrap (s from sTrayEnd to sArcEnd)
  if (s <= sArcEnd) {
    const tArc = (s - sTrayEnd) / arcLength; // 0.0 to 1.0
    // Angle: -PI (rear lip) -> -PI/2 (bottom) -> 0 (front horizon)
    const theta = -Math.PI + tArc * Math.PI;
    const y = cy + (r + 0.08) * Math.sin(theta);
    const z = cz + (r + 0.08) * Math.cos(theta);
    return [y, z];
  }

  // SEGMENT 3: Emerging Upright Sheet (s > sArcEnd)
  const distFromHorizon = s - sArcEnd;
  const tilt = 0.14; // ~8 deg rear tilt
  const y = cy + distFromHorizon * Math.cos(tilt);
  const z = cz + (r + 0.08) - distFromHorizon * Math.sin(tilt);
  return [y, z];
}

/**
 * Returns [y, z] for a given cumulative distance `s` along the closed-loop conveyor circuit.
 *  - SEGMENT 1 (Front Rise): Straight tangent rising from Platen Front Horizon to Top Roller Front.
 *  - SEGMENT 2 (Top Over-Wrap): 180° cylindrical arc wrapping over the TOP of the upper roller.
 *  - SEGMENT 3 (Rear Descent): Straight return run descending from Top Roller Rear to Platen Rear.
 *  - SEGMENT 4 (Platen Under-Wrap): 180° cylindrical arc wrapping UNDER the platen roller.
 */
export function sampleLoopPath(s: number, p: LoopPathParams): [number, number] {
  const { platenCenter, platenRadius: r1, topCenter, topRadius: r2 } = p;
  const cy = platenCenter.y;
  const cz = platenCenter.z;
  const topY = topCenter.y;
  const topZ = topCenter.z;

  // Segment 1 (Front Rise): from P0 (front horizon of platen) to P1 (front horizon of top roller)
  const p0y = cy;
  const p0z = cz + r1;
  const p1y = topY;
  const p1z = topZ + r2;
  const dy1 = p1y - p0y;
  const dz1 = p1z - p0z;
  const L1 = Math.sqrt(dy1 * dy1 + dz1 * dz1);

  // Segment 2 (Top Over-Wrap): 180 deg arc over top roller
  const L2 = Math.PI * r2;

  // Segment 3 (Rear Descent): from P2 (rear horizon of top roller) to P3 (rear horizon of platen)
  const p2y = topY;
  const p2z = topZ - r2;
  const p3y = cy;
  const p3z = cz - r1;
  const dy3 = p3y - p2y;
  const dz3 = p3z - p2z;
  const L3 = Math.sqrt(dy3 * dy3 + dz3 * dz3);

  // Segment 4 (Platen Under-Wrap): 180 deg arc under platen
  const L4 = Math.PI * r1;

  const L_loop = L1 + L2 + L3 + L4;
  const sMod = ((s % L_loop) + L_loop) % L_loop;

  if (sMod <= L1) {
    const t = sMod / L1;
    return [p0y + t * dy1, p0z + t * dz1];
  } else if (sMod <= L1 + L2) {
    const t = (sMod - L1) / L2;
    const phi = t * Math.PI; // 0 to PI
    return [topY + r2 * Math.sin(phi), topZ + r2 * Math.cos(phi)];
  } else if (sMod <= L1 + L2 + L3) {
    const t = (sMod - (L1 + L2)) / L3;
    return [p2y + t * dy3, p2z + t * dz3];
  } else {
    const t = (sMod - (L1 + L2 + L3)) / L4;
    const psi = -Math.PI + t * Math.PI; // -PI to 0
    return [cy + r1 * Math.sin(psi), cz + r1 * Math.cos(psi)];
  }
}

/**
 * Dynamic paper conveyor mesh with dual modes:
 *  - 'scroll': Closed-loop over-the-top conveyor ribbon with continuous dynamic scrolling.
 *  - 'sheet': Standard single A4 sheet with fixed length and visible trailing edge drain into roller.
 */
function buildPaperMesh(paper: PaperTexture): {
  mesh: THREE.Mesh;
  update: (line: number, mode?: "sheet" | "scroll") => void;
} {
  const paperWidth = 21.0;
  const sheetLength = 29.7;
  const cols = 32;
  const rows = 128; // 128 rows for ultra-smooth loop curvature

  const positions = new Float32Array((rows + 1) * (cols + 1) * 3);
  const uvs = new Float32Array((rows + 1) * (cols + 1) * 2);
  const indices: number[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const a = row * (cols + 1) + col;
      const b = row * (cols + 1) + (col + 1);
      const c = (row + 1) * (cols + 1) + col;
      const d = (row + 1) * (cols + 1) + (col + 1);

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

  paper.onRepaint = () => {
    paper.texture.needsUpdate = true;
  };

  const material = new THREE.MeshStandardMaterial({
    map: paper.texture,
    side: THREE.DoubleSide,
    roughness: 0.95,
    metalness: 0.0,
    envMapIntensity: 0.0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const pathParams: PaperPathParams = {
    platenCenter: new THREE.Vector3(0, PLATEN.y, PLATEN.z),
    platenRadius: PLATEN.r,
    feedAngle: TILT_ANGLE,
    trayLength: 10.0,
    uprightLength: 35.0,
  };

  const loopParams: LoopPathParams = {
    platenCenter: new THREE.Vector3(0, PLATEN.y, PLATEN.z),
    platenRadius: PLATEN.r + 0.08, // Increased from 0.03 to 0.08 (0.8mm clearance)
    topCenter: new THREE.Vector3(0, PLATEN.y + 10.5, PLATEN.z - 1.4),
    topRadius: 0.45 + 0.04,
  };

  const sArcEnd = pathParams.trayLength + Math.PI * pathParams.platenRadius;
  // Compute total loop length
  const dy1 = loopParams.topCenter.y - loopParams.platenCenter.y;
  const dz1 = (loopParams.topCenter.z + loopParams.topRadius) - (loopParams.platenCenter.z + loopParams.platenRadius);
  const L1 = Math.sqrt(dy1 * dy1 + dz1 * dz1);
  const L2 = Math.PI * loopParams.topRadius;
  const dy3 = loopParams.platenCenter.y - loopParams.topCenter.y;
  const dz3 = (loopParams.platenCenter.z - loopParams.platenRadius) - (loopParams.topCenter.z - loopParams.topRadius);
  const L3 = Math.sqrt(dy3 * dy3 + dz3 * dz3);
  const L4 = Math.PI * loopParams.platenRadius;
  const loopTotalLength = L1 + L2 + L3 + L4;

  let currentMode: "sheet" | "scroll" = "scroll";
  let currentLine = 0;

  const update = (line: number, mode?: "sheet" | "scroll") => {
    if (mode !== undefined) currentMode = mode;
    currentLine = line;

    const positionAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const uvAttr = geometry.getAttribute("uv") as THREE.BufferAttribute;
    let ptr = 0;

    if (currentMode === "sheet") {
      const lineHeightPx = paper.lineHeight;
      const sTop =
        sArcEnd +
        ((PAPER.MARGIN_TOP + currentLine * lineHeightPx + lineHeightPx * 0.76) / PAPER.H) * sheetLength;

      for (let row = 0; row <= rows; row++) {
        const v = row / rows;
        const s = sTop - v * sheetLength;
        const [y, z] = samplePaperGuidePath(s, pathParams);
        const uvV = 1.0 - v;

        for (let col = 0; col <= cols; col++) {
          const u = col / cols;
          const x = (u - 0.5) * paperWidth;
          positionAttr.setXYZ(ptr, x, y, z);
          uvAttr.setXY(ptr, u, uvV);
          ptr++;
        }
      }
    } else {
      // SCROLL MODE: Continuous conveyor ribbon
      // Dynamic line capacity around the loop matching paper.lineHeight
      const scrollLoopLines = Math.max(20, Math.round(PAPER.H / paper.lineHeight));
      const BASE_TEXT_PHASE = 0.72; // Optical baseline alignment with ribbon vibrator
      const scrollPhase = (currentLine + BASE_TEXT_PHASE) / scrollLoopLines;

      for (let row = 0; row <= rows; row++) {
        const v = row / rows; // 0.0 to 1.0 around the loop
        const sStation = v * loopTotalLength;
        const [y, z] = sampleLoopPath(sStation, loopParams);

        // UV coordinate perfectly synchronised with 2D cyclic canvas
        const uvV = 1.0 - scrollPhase + (sStation / loopTotalLength);

        for (let col = 0; col <= cols; col++) {
          const u = col / cols;
          const x = (u - 0.5) * paperWidth;
          positionAttr.setXYZ(ptr, x, y, z);
          uvAttr.setXY(ptr, u, uvV);
          ptr++;
        }
      }
    }

    positionAttr.needsUpdate = true;
    uvAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  };

  update(0, "scroll");
  return { mesh, update };
}

/* ------------------------------------------------------------------ */
/* The procedural machine                                              */
/* ------------------------------------------------------------------ */

export function buildMachine(mats: MachineMaterials, paper: PaperTexture): MachineBuild {
  const root = new THREE.Group();
  const parts: Part[] = [];
  const byId = new Map<string, Part>();

  function addPart(
    parent: THREE.Group,
    meta: PartMeta,
    build: (group: THREE.Group) => THREE.Object3D | null,
  ): { partGroup: THREE.Group; action: THREE.Object3D | null } {
    const partGroup = new THREE.Group();
    parent.add(partGroup);
    const action = build(partGroup);
    const assembled = poseOf(partGroup);
    const offset = meta.offset;
    const exploded: Pose = {
      px: assembled.px + (offset.px ?? 0),
      py: assembled.py + (offset.py ?? 0),
      pz: assembled.pz + (offset.pz ?? 0),
      rx: assembled.rx + (offset.rx ?? 0),
      ry: assembled.ry + (offset.ry ?? 0),
      rz: assembled.rz + (offset.rz ?? 0),
    };
    const part: Part = {
      id: meta.id,
      label: meta.label,
      fn: meta.fn,
      system: meta.system,
      partGroup,
      action,
      assembled,
      exploded,
      stagger: meta.stagger,
      parentId: meta.parentId ?? null,
      cutawayFade: meta.cutawayFade === true,
      upstream: meta.upstream ?? [],
      downstream: meta.downstream ?? [],
    };
    partGroup.traverse((child) => {
      child.userData.partId = meta.id;
    });
    parts.push(part);
    byId.set(meta.id, part);
    return { partGroup, action };
  }

  const basketGroup = new THREE.Group();
  root.add(basketGroup);
  const carriageGroup = new THREE.Group();
  root.add(carriageGroup);

  const refs: MachineRefs = {
    basketGroup,
    carriageGroup,
    keyActions: new Map(),
    typebarActions: [],
    typebarRestAngles: [],
    typebarStrikeAngles: [],
    universalBarAction: new THREE.Group(),
    vibratorAction: new THREE.Group(),
    spoolL: new THREE.Group(),
    spoolR: new THREE.Group(),
    escapeWheelAction: new THREE.Group(),
    platenAction: new THREE.Group(),
    ratchetAction: new THREE.Group(),
    returnLeverAction: new THREE.Group(),
    bellAction: new THREE.Group(),
    ribbonSideL: new THREE.Mesh(),
    ribbonSideR: new THREE.Mesh(),
    ribbonTipL: new THREE.Vector3(),
    ribbonTipR: new THREE.Vector3(),
    paperMesh: new THREE.Mesh(),
    topGuide: new THREE.Group(),
    updatePaper: () => { },
  };

  /* ------------------------------ Keyboard ------------------------------ */

  const rimGeometry = new THREE.CylinderGeometry(0.85, 0.92, 0.55, 24);
  const topGeometry = new THREE.CylinderGeometry(0.68, 0.68, 0.1, 24);
  const labelGeometry = new THREE.PlaneGeometry(1.15, 1.15);

  for (const def of KEYS) {
    const position = keyPosition(def);
    const { action } = addPart(
      root,
      {
        id: `key.${def.code}`,
        label: `${def.labelTop || def.code} keycap`,
        fn:
          def.kind === "char"
            ? "Finger key: starts the strike chain"
            : def.kind === "space"
              ? "Spacebar: escapement only, no typebar"
              : def.kind === "backspace"
                ? "Backspace key: drives the pawl back"
                : def.kind === "shift"
                  ? "Shift key: lifts the whole type basket"
                  : "Tab key: releases carriage to next stop",
        system: "keyboard",
        stagger: 0 + def.row * 0.012,
        offset: { pz: 5.5 + def.row * 1.4, py: -2.2 - def.row * 0.9 },
        downstream: [`lever.${def.code}`],
      },
      (group) => {
        group.position.copy(position);
        const inner = new THREE.Group();
        group.add(inner);
        const rim = new THREE.Mesh(rimGeometry, mats.keyRim);
        if (def.w > 1.3) {
          rim.scale.x = def.w * KEY_SPACING - 0.6;
          rim.scale.z = 0.75;
        }
        rim.position.y = 0.28;
        rim.castShadow = true;
        inner.add(rim);
        const top = new THREE.Mesh(topGeometry, mats.keyTop);
        top.scale.x = rim.scale.x * 0.92;
        top.scale.z = rim.scale.z * 0.92;
        top.position.y = 0.56;
        inner.add(top);
        if (def.labelTop || def.labelBottom) {
          const label = new THREE.Mesh(
            labelGeometry,
            new THREE.MeshBasicMaterial({ map: keycapTexture(def.labelTop, def.labelBottom), transparent: true }),
          );
          label.scale.x = top.scale.x;
          label.scale.z = top.scale.z;
          label.rotation.x = -Math.PI / 2;
          label.position.y = 0.62;
          inner.add(label);
        }

        // Underside vertical nickel key stem collar connecting down to lever riser
        if (def.kind !== "space") {
          const stemCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 14), mats.nickel);
          stemCollar.position.y = 0.02;
          inner.add(stemCollar);

          // Nickel clamping flange bracket connecting keycap to the vertical lever riser blade
          const clampBracket = boxMesh(0.12, 0.38, 0.28, mats.nickel);
          clampBracket.position.y = -0.10;
          inner.add(clampBracket);

          // Brass cross-rivet pin fastening keycap to lever riser
          const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.24, 10), mats.brass);
          rivet.rotation.z = Math.PI / 2;
          rivet.position.y = -0.10;
          inner.add(rivet);
        } else {
          // Spacebar dual mounting posts and rocker brackets
          for (const sOffset of [-5.5, 5.5]) {
            const spaceStem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.65, 12), mats.nickel);
            spaceStem.position.set(sOffset, -0.15, 0);
            inner.add(spaceStem);

            const spaceBracket = boxMesh(0.12, 0.55, 0.38, mats.nickel);
            spaceBracket.position.set(sOffset, -0.25, 0);
            inner.add(spaceBracket);
          }
        }

        return inner;
      },
    );
    refs.keyActions.set(def.code, { cap: action!, lever: null });
  }

  /* ------------------------------- Levers ------------------------------- */

  for (const def of KEYS) {
    const position = keyPosition(def);
    const isChar = def.kind === "char";
    const { action } = addPart(
      root,
      {
        id: `lever.${def.code}`,
        label: `${def.labelTop || def.code} key lever`,
        fn: "Key lever: turns finger force around the pivot rod",
        system: "levers",
        stagger: 0.14 + def.row * 0.012,
        offset: { py: -4.2, pz: 1.6 },
        upstream: [`key.${def.code}`],
        downstream: isChar ? [`link.${def.code}`] : def.kind === "space" ? ["universalBar"] : [],
      },
      (group) => {
        group.position.set(position.x, LEVER_PIVOT.y, LEVER_PIVOT.z);
        const inner = new THREE.Group();
        group.add(inner);

        const dy = position.y - LEVER_PIVOT.y;
        const dz = position.z - LEVER_PIVOT.z;

        // Stamped sheet-steel keylever blade with 90-degree curved elbow riser
        const leverMesh = new THREE.Mesh(createKeyLeverGeometry(dy, dz), mats.steelDark);
        leverMesh.castShadow = true;
        leverMesh.receiveShadow = true;
        inner.add(leverMesh);

        // Fulcrum pivot collar & brass bearing sleeve
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 12), mats.nickel);
        collar.rotation.z = Math.PI / 2;
        inner.add(collar);

        const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.52, 10), mats.brass);
        bushing.rotation.z = Math.PI / 2;
        inner.add(bushing);

        return inner;
      },
    );
    refs.keyActions.get(def.code)!.lever = action;
  }

  addPart(
    root,
    {
      id: "frame.pivotRod",
      label: "Key lever pivot rod",
      fn: "Common axle every key lever swings on",
      system: "frame",
      stagger: 0.86,
      offset: { py: -2.5, pz: -1.5 },
    },
    (group) => {
      group.position.set(0, LEVER_PIVOT.y, LEVER_PIVOT.z);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 31, 12), mats.nickel);
      rod.rotation.z = Math.PI / 2;
      group.add(rod);
      return null;
    },
  );

  /* ------------------------------ Typebars ------------------------------ */

  const buildTypebar = (
    index: number,
    labelTop: string,
    lower: string,
    upper: string,
    isIme: boolean,
  ): { pivot: THREE.Vector3; restAngle: number; yaw: number } => {
    const slot = getBasketSlot(index);
    const pivot = slot.position;
    const barLength = slot.barLength;
    const restPitch = 0;
    const strikePitch = slot.swingAngle;
    const keyCode = isIme ? "IME" : KEYS.find((k) => k.typebar === index)!.code;

    const { action } = addPart(
      basketGroup,
      {
        id: `typebar.${index}`,
        label: isIme ? "Unicode adapter typebar" : `${labelTop} typebar`,
        fn: isIme ? "Contemporary adapter — not original machinery" : "Typebar: hurls its slug to the print point",
        system: "typebars",
        stagger: 0.44 + index * 0.0018,
        offset: {
          px: pivot.x * 0.35,
          py: 1.8,
          pz: pivot.z * 0.35,
          ry: slot.angle * 0.35,
        },
        parentId: null,
        upstream: isIme ? [] : [`link.${keyCode}`],
        downstream: ["vibrator", "escapement.starWheel"],
      },
      (group) => {
        group.position.copy(pivot);
        group.quaternion.copy(slot.orientation);
        const inner = new THREE.Group();
        group.add(inner);

        // 1. Authentic Stamped Sheet-Metal Straight Planar Typebar
        const barGeo = createStraightTypebarGeometry(barLength);
        const barMesh = new THREE.Mesh(barGeo, isIme ? mats.brass : mats.steelDark);
        barMesh.castShadow = true;
        inner.add(barMesh);

        // Actuation tail extending beneath pivot
        const tail = boxMesh(0.08, 0.85, 0.22, mats.steelDark);
        tail.position.set(0, -0.42, 0);
        inner.add(tail);

        // 2. Soldered Dual-Character Slug Die Head (Directly on straight tip)
        const slugGroup = new THREE.Group();
        slugGroup.position.set(0, barLength, 0.04);

        // Target orientation at impact so slug die face meets rubber platen flush:
        const strikeRot = new THREE.Matrix4().multiplyMatrices(
          slot.basisMatrix,
          new THREE.Matrix4().makeRotationX(slot.swingAngle),
        );
        const invStrikeRot = strikeRot.clone().invert();
        const targetWorldMat = new THREE.Matrix4().makeBasis(
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(0, 0.97, 0.24),
          new THREE.Vector3(0, -0.24, 0.97),
        );
        const localSlugMat = new THREE.Matrix4().multiplyMatrices(invStrikeRot, targetWorldMat);
        slugGroup.quaternion.setFromRotationMatrix(localSlugMat);

        // Die block body
        const slugBox = boxMesh(0.24, 0.42, 0.18, mats.nickel);
        slugGroup.add(slugBox);

        // Embossed character die face with dividing groove
        const slugFace = new THREE.Mesh(
          new THREE.PlaneGeometry(0.20, 0.36),
          new THREE.MeshBasicMaterial({ map: slugTexture(lower, upper) }),
        );
        slugFace.position.set(0, 0, 0.095);
        slugGroup.add(slugFace);

        const groove = boxMesh(0.22, 0.02, 0.02, mats.steelDark);
        groove.position.set(0, 0, 0.10);
        slugGroup.add(groove);

        inner.add(slugGroup);
        return inner;
      },
    );

    refs.typebarActions[index] = action!;
    refs.typebarRestAngles[index] = restPitch;
    refs.typebarStrikeAngles[index] = strikePitch;
    return { pivot, restAngle: restPitch, yaw: slot.angle };
  };

  const typebarInfo: Array<{ pivot: THREE.Vector3; restAngle: number; yaw: number } | undefined> = [];
  for (const def of KEYS) {
    if (def.kind !== "char") continue;
    typebarInfo[def.typebar] = buildTypebar(def.typebar, def.labelTop, def.lower!, def.upper!, false);
  }
  typebarInfo[IME_TYPEBAR] = buildTypebar(IME_TYPEBAR, "U", "u●", "U●", true);

  /* ------------------------------- Link rods ---------------------------- */

  for (const def of KEYS) {
    if (def.kind !== "char") continue;
    const slot = getBasketSlot(def.typebar);
    const tailPoint = slot.position.clone().addScaledVector(slot.restDir, -0.45);
    const keyPos = keyPosition(def);
    const leverEnd = new THREE.Vector3(keyPos.x, LEVER_PIVOT.y + 0.2, LEVER_PIVOT.z - 1.9);
    addPart(
      root,
      {
        id: `link.${def.code}`,
        label: `${def.labelTop} link rod`,
        fn: "Link rod: pulls the typebar tail upward",
        system: "links",
        stagger: 0.3 + def.row * 0.012,
        offset: { py: -3, pz: 3 },
        upstream: [`lever.${def.code}`],
        downstream: [`typebar.${def.typebar}`],
      },
      (group) => {
        const rod = rodBetween(leverEnd, tailPoint, 0.038, mats.nickel, 6);
        group.add(rod);
        const joint = rodBetween(tailPoint.clone().add(new THREE.Vector3(0, -0.35, 0)), tailPoint, 0.065, mats.brass, 6);
        group.add(joint);
        return null;
      },
    );
  }

  /* -------------------------------- Basket ------------------------------ */

  addPart(
    basketGroup,
    {
      id: "basket.segment",
      label: "Typebar segment",
      fn: "Rear upright slotted cast-iron segment deck anchoring and guiding all 44 typebar pivots",
      system: "basket",
      stagger: 0.56,
      offset: { py: -2.0 },
      downstream: ["typebars"],
    },
    (group) => {
      // 1. Upright Flat Cast-Iron Segment Mantle Plate standing flat against the platen / ribbon vibrator
      const segmentShape = new THREE.Shape();
      const total = BASKET_CONFIG.total;
      const cy = BASKET_CONFIG.cy;
      const rInner = BASKET_CONFIG.radius - 0.35;
      const rOuter = BASKET_CONFIG.radius + 1.25;
      const maxPhi = (70 * Math.PI) / 180;

      // Outer boundary arc from right ear to left ear
      const segSteps = 32;
      for (let s = 0; s <= segSteps; s++) {
        const u = s / segSteps;
        const phi = maxPhi * (1 - 2 * u); // from +maxPhi to -maxPhi
        const x = rOuter * Math.sin(phi);
        const y = cy - rOuter * Math.cos(phi);
        if (s === 0) segmentShape.moveTo(x, y);
        else segmentShape.lineTo(x, y);
      }

      // Left ear top notch
      const leftEarPhi = -maxPhi;
      const leftEarX = rOuter * Math.sin(leftEarPhi);
      const leftEarY = cy - rOuter * Math.cos(leftEarPhi);
      segmentShape.lineTo(leftEarX - 0.4, leftEarY + 0.3);
      segmentShape.lineTo(rInner * Math.sin(leftEarPhi) - 0.4, cy - rInner * Math.cos(leftEarPhi) + 0.3);

      // Inner boundary arc from left ear to right ear
      for (let s = 0; s <= segSteps; s++) {
        const u = s / segSteps;
        const phi = -maxPhi + 2 * maxPhi * u; // from -maxPhi to +maxPhi
        const x = rInner * Math.sin(phi);
        const y = cy - rInner * Math.cos(phi);
        segmentShape.lineTo(x, y);
      }

      // Right ear top notch
      const rightEarPhi = maxPhi;
      segmentShape.lineTo(rInner * Math.sin(rightEarPhi) + 0.4, cy - rInner * Math.cos(rightEarPhi) + 0.3);
      segmentShape.lineTo(leftEarX * -1 + 0.4, leftEarY + 0.3);
      segmentShape.closePath();

      const segmentPlateGeo = new THREE.ExtrudeGeometry(segmentShape, {
        depth: 0.32,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.04,
        bevelThickness: 0.04,
      });
      const segmentPlate = new THREE.Mesh(segmentPlateGeo, mats.castIron);
      segmentPlate.position.set(0, 0, BASKET_CONFIG.cz - 0.28);
      segmentPlate.castShadow = true;
      segmentPlate.receiveShadow = true;
      group.add(segmentPlate);

      // 2. Sub-segment Deck / Enclosing Throat Shield covering behind keyboard
      const deckShieldShape = new THREE.Shape();
      deckShieldShape.moveTo(-7.4, 0);
      deckShieldShape.lineTo(7.4, 0);
      deckShieldShape.lineTo(6.2, 4.6);
      deckShieldShape.lineTo(-6.2, 4.6);
      deckShieldShape.closePath();

      const deckShieldGeo = new THREE.ExtrudeGeometry(deckShieldShape, {
        depth: 0.22,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.03,
        bevelThickness: 0.03,
      });
      const deckShield = new THREE.Mesh(deckShieldGeo, mats.castIron);
      deckShield.rotation.x = Math.PI * 0.42;
      deckShield.position.set(0, 5.5, -0.9);
      deckShield.castShadow = true;
      deckShield.receiveShadow = true;
      group.add(deckShield);

      // 3. 44 Machined Radial Comb Guide Slots & Flanking Teeth
      for (let i = 0; i < total; i++) {
        const slot = getBasketSlot(i);
        
        // Left and Right milled comb tooth flanking each typebar pivot
        for (const sideOffset of [-0.038, 0.038]) {
          const tooth = boxMesh(0.024, 0.52, 0.30, mats.steelDark);
          tooth.position.copy(slot.position);
          tooth.quaternion.copy(slot.orientation);
          tooth.translateX(sideOffset);
          tooth.translateY(-0.06);
          tooth.castShadow = true;
          group.add(tooth);
        }

        // Slotted base trough backing block
        const toothBack = boxMesh(0.08, 0.18, 0.28, mats.castIron);
        toothBack.position.copy(slot.position);
        toothBack.quaternion.copy(slot.orientation);
        toothBack.translateY(-0.24);
        group.add(toothBack);
      }

      // 4. Continuous Nickel Fulcrum Hinge Wire threading all 44 typebar pivot eyelets
      const wirePoints: THREE.Vector3[] = [];
      for (let i = 0; i < total; i++) {
        wirePoints.push(getBasketSlot(i).position);
      }
      const wireCurve = new THREE.CatmullRomCurve3(wirePoints);
      const wireGeo = new THREE.TubeGeometry(wireCurve, 44, 0.045, 8, false);
      const wireMesh = new THREE.Mesh(wireGeo, mats.nickel);
      group.add(wireMesh);

      // 5. Polished Nickel Fulcrum Wire Clamp Plates and Fastener Screws on Left and Right Ears
      for (const side of [-1, 1]) {
        const earSlot = getBasketSlot(side < 0 ? 0 : total - 1);
        const clampPlate = boxMesh(0.55, 0.95, 0.16, mats.nickel);
        clampPlate.position.set(earSlot.position.x + side * 0.28, earSlot.position.y + 0.15, earSlot.position.z + 0.08);
        clampPlate.quaternion.copy(earSlot.orientation);
        group.add(clampPlate);

        const clampScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 14), mats.nickel);
        clampScrew.position.set(earSlot.position.x + side * 0.28, earSlot.position.y + 0.15, earSlot.position.z + 0.16);
        clampScrew.rotation.x = Math.PI / 2;
        group.add(clampScrew);
      }

      // 6. Central Mounting Boss & Lower Segment Bracket
      const lowerMountingPlate = boxMesh(3.8, 1.4, 0.45, mats.castIron);
      lowerMountingPlate.position.set(0, 6.4, -1.22);
      group.add(lowerMountingPlate);

      for (const side of [-1, 1]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 14), mats.nickel);
        screw.position.set(side * 1.1, 6.4, -0.96);
        screw.rotation.x = Math.PI / 2;
        group.add(screw);
      }

      return null;
    },
  );

  addPart(
    basketGroup,
    {
      id: "basket.centerGuide",
      label: "Center type guide",
      fn: "Fixed mirror-nickel V-guide centering each typebar at impact",
      system: "basket",
      stagger: 0.59,
      offset: { pz: -1.0 },
    },
    (group) => {
      group.position.set(0, 13.8, -1.48);

      // Central mounting bracket stem
      const stem = boxMesh(0.35, 1.2, 0.24, mats.nickel);
      stem.position.set(0, -0.5, 0);
      group.add(stem);

      // Twin polished nickel funneling wings forming the V-notch
      for (const side of [-1, 1]) {
        const wing = boxMesh(0.12, 0.95, 0.28, mats.nickel);
        wing.position.set(side * 0.28, 0.2, 0);
        wing.rotation.z = side * -0.26;
        group.add(wing);
      }
      return null;
    },
  );

  addPart(
    basketGroup,
    {
      id: "basket.rest",
      label: "Typebar rest",
      fn: "U-shaped wool felt rail where idle typebars sleep",
      system: "basket",
      stagger: 0.57,
      offset: { py: -2.4 },
    },
    (group) => {
      const restPoints: THREE.Vector3[] = [];
      const total = BASKET_CONFIG.total;
      for (let i = 0; i < total; i++) {
        const slot = getBasketSlot(i);
        const restPoint = slot.position.clone().addScaledVector(slot.restDir, slot.barLength * 0.94);
        restPoints.push(restPoint);
      }
      const restCurve = new THREE.CatmullRomCurve3(restPoints);
      const restMesh = new THREE.Mesh(new THREE.TubeGeometry(restCurve, 44, 0.12, 8, false), mats.felt);
      group.add(restMesh);

      // Nickel end mounting brackets
      for (const side of [-1, 1]) {
        const endP = restPoints[side < 0 ? 0 : total - 1];
        const bracket = boxMesh(0.35, 0.65, 0.4, mats.nickel);
        bracket.position.set(endP.x + side * 0.12, endP.y - 0.2, endP.z);
        group.add(bracket);
      }
      return null;
    },
  );

  {
    const { action } = addPart(
      root,
      {
        id: "universalBar",
        label: "Universal bar",
        fn: "Transverse bail tripped by every key lever to fire the escapement",
        system: "basket",
        stagger: 0.58,
        offset: { pz: 3.2, py: -1.2 },
        upstream: ["levers"],
        downstream: ["escapement.starWheel"],
      },
      (group) => {
        // Base mounting trunnions on the lower chassis floor
        for (const side of [-1, 1]) {
          const pivotPost = boxMesh(0.45, 1.6, 0.6, mats.steelDark);
          pivotPost.position.set(side * 8.8, 3.8, 1.0);
          group.add(pivotPost);

          const pivotScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.55, 12), mats.brass);
          pivotScrew.rotation.z = Math.PI / 2;
          pivotScrew.position.set(side * 8.8, 3.8, 1.0);
          group.add(pivotScrew);
        }

        const inner = new THREE.Group();
        group.add(inner);

        // Main transverse universal bar sitting beneath levers at Y = 4.0
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 17.6, 16), mats.nickel);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, 4.0, 1.0);
        bar.castShadow = true;
        inner.add(bar);

        // Comb contact plate
        const comb = boxMesh(16.8, 0.14, 0.65, mats.steelDark);
        comb.position.set(0, 4.1, 1.0);
        inner.add(comb);

        // Low-level rear pushrod running under the basket into escapement rocker
        const tripPushrod = rodBetween(
          new THREE.Vector3(0, 4.0, 1.0),
          new THREE.Vector3(0, 5.2, -2.4),
          0.1,
          mats.nickel,
        );
        inner.add(tripPushrod);

        return inner;
      },
    );
    refs.universalBarAction = action!;
  }

  /* ----------------------------- Escapement ----------------------------- */

  {
    const { action } = addPart(
      root,
      {
        id: "escapement.starWheel",
        label: "Escapement wheel",
        fn: "Releases exactly one tooth per character",
        system: "escapement",
        stagger: 0.8,
        offset: { py: -1.6, pz: 2.6 },
        upstream: ["universalBar"],
        downstream: ["carriage.body"],
      },
      (group) => {
        // Escapement mechanism housing / mounting bridge anchored to chassis and cradle
        const housingBridge = boxMesh(3.2, 4.2, 2.8, mats.steelDark);
        housingBridge.position.set(0, 9.9, -3.6);
        group.add(housingBridge);

        // Precision brass journal sleeve bearings supporting the escapement arbor
        for (const zBearing of [-3.8, -2.2]) {
          const bearing = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.5, 16), mats.brass);
          bearing.rotation.x = Math.PI / 2;
          bearing.position.set(0, 11.1, zBearing - 0.2);
          group.add(bearing);
        }

        const inner = new THREE.Group();
        inner.position.set(0, 11.1, 0);
        group.add(inner);

        // Hardened steel escapement shaft / arbor spanning from carriage pinion to front bearing
        const arbor = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.2, 16), mats.steelDark);
        arbor.rotation.x = Math.PI / 2;
        arbor.position.set(0, 0, -3.4);
        inner.add(arbor);

        // Hardened steel pinion gear meshing directly with the Carriage Gear Rack at z = -3.7, y = 12.18
        const pinionHub = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.38, 16), mats.steelDark);
        pinionHub.rotation.x = Math.PI / 2;
        pinionHub.position.set(0, 0, -3.05);
        inner.add(pinionHub);
        for (let i = 0; i < 10; i++) {
          const tooth = boxMesh(0.14, 0.28, 0.36, mats.steelDark);
          const angle = (i / 10) * Math.PI * 2;
          tooth.position.set(Math.cos(angle) * 0.52, Math.sin(angle) * 0.52, 0);
          tooth.rotation.z = angle;
          pinionHub.add(tooth);
        }

        // Star wheel hub collar with locking set screw
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.22, 14), mats.brass);
        collar.rotation.x = Math.PI / 2;
        collar.position.set(0, 0, -3.35);
        inner.add(collar);

        // Escapement brass ratchet star wheel with 15 undercut teeth
        const starWheelBody = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.24, 24), mats.brass);
        starWheelBody.rotation.x = Math.PI / 2;
        starWheelBody.position.set(0, 0, -3.5);
        inner.add(starWheelBody);

        for (let i = 0; i < 15; i++) {
          const tooth = boxMesh(0.15, 0.38, 0.24, mats.brass);
          const angle = (i / 15) * Math.PI * 2;
          tooth.position.set(Math.cos(angle) * 1.05, Math.sin(angle) * 1.05, 0);
          tooth.rotation.z = angle + 0.22; // Asymmetric ratchet rake angle
          starWheelBody.add(tooth);
        }

        return inner;
      },
    );
    refs.escapeWheelAction = action!;
  }

  addPart(
    root,
    {
      id: "escapement.pawls",
      label: "Escapement pawls",
      fn: "Loose and rigid dog rocking on each keystroke",
      system: "escapement",
      stagger: 0.81,
      offset: { pz: 2.2, py: -1.2 },
      upstream: ["universalBar"],
      downstream: ["escapement.starWheel"],
    },
    (group) => {
      // Escapement rocker pivot trunnion bracket mounted to housing
      const pivotTrunnion = boxMesh(2.2, 0.45, 0.5, mats.steelDark);
      pivotTrunnion.position.set(0, 10.4, -2.5);
      group.add(pivotTrunnion);

      // Conical pivot screws on both sides
      for (const side of [-1, 1]) {
        const trunnionScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 12), mats.brass);
        trunnionScrew.rotation.z = Math.PI / 2;
        trunnionScrew.position.set(side * 1.1, 10.4, -2.5);
        group.add(trunnionScrew);
      }

      // Thin vertical dog carrier frame (replacing the bulky square block)
      const rockerCarrier = boxMesh(0.5, 1.8, 0.25, mats.steelDark);
      rockerCarrier.position.set(0, 11.1, -2.5);
      group.add(rockerCarrier);

      // Rigid Dog (holding pawl) - fixed hardened steel tooth engaging star wheel
      const rigidDog = boxMesh(0.24, 0.9, 1.4, mats.steelDark);
      rigidDog.position.set(0.42, 12.15, -3.2);
      rigidDog.rotation.z = -0.28;
      group.add(rigidDog);

      // Loose Dog (stepping pawl) - pivoting spring-loaded dog
      const looseDog = boxMesh(0.22, 0.95, 1.4, mats.nickel);
      looseDog.position.set(-0.42, 12.2, -3.2);
      looseDog.rotation.z = 0.28;
      group.add(looseDog);

      // Tiny bronze leaf spring on loose dog
      const leafSpring = boxMesh(0.06, 0.55, 0.12, mats.brass);
      leafSpring.position.set(-0.62, 11.9, -3.0);
      group.add(leafSpring);

      // Rocker trip connection receiving pushrod from Universal Bar (moved upwards to 10.9)
      const lowerTripHorn = boxMesh(0.4, 0.4, 0.3, mats.steelDark);
      lowerTripHorn.position.set(0, 10.9, -2.45);
      group.add(lowerTripHorn);

      // Pivot pin coupling trip pushrod to lower horn
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 10), mats.brass);
      pin.rotation.z = Math.PI / 2;
      pin.position.set(0, 10.5, -2.45);
      group.add(pin);

      return null;
    },
  );

  addPart(
    root,
    {
      id: "escapement.backspacePawl",
      label: "Backspace pawl",
      fn: "Backspacer: pushes the rack one tooth back",
      system: "escapement",
      stagger: 0.82,
      offset: { pz: 2, py: -1.4 },
      upstream: ["lever.Backspace"],
      downstream: ["escapement.starWheel"],
    },
    (group) => {
      // Mounting bracket fixed to right carriage rail frame
      const mountBracket = boxMesh(0.45, 1.8, 1.2, mats.steelDark);
      mountBracket.position.set(2.4, 11.5, -3.1);
      group.add(mountBracket);

      // Pivot shoulder screw
      const pivotScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.5, 12), mats.brass);
      pivotScrew.rotation.z = Math.PI / 2;
      pivotScrew.position.set(2.4, 11.4, -3.1);
      group.add(pivotScrew);

      // Pivoting Backspace Bellcrank
      const bellcrank = boxMesh(0.24, 1.2, 0.6, mats.steelDark);
      bellcrank.position.set(2.2, 11.4, -3.0);
      bellcrank.rotation.x = -0.2;
      group.add(bellcrank);

      // Hardened backspace driving pawl reaching up to carriage rack
      const pawl = boxMesh(0.22, 1.3, 0.26, mats.steelDark);
      pawl.position.set(1.6, 12.15, -3.1);
      pawl.rotation.z = 0.48;
      group.add(pawl);

      // Return coil spring
      const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 10), mats.brass);
      spring.position.set(2.1, 10.9, -3.1);
      group.add(spring);

      // Long vertical pull-rod from Backspace key lever up to bellcrank
      const pullRod = rodBetween(
        new THREE.Vector3(12.5, 6.2, 4.0),
        new THREE.Vector3(2.3, 11.0, -3.0),
        0.1,
        mats.steelDark,
      );
      group.add(pullRod);

      return null;
    },
  );

  /* ------------------------------ Carriage ------------------------------ */

  addPart(
    carriageGroup,
    {
      id: "carriage.body",
      label: "Carriage",
      fn: "Carries platen and paper one tooth per character",
      system: "carriage",
      stagger: 0.7,
      offset: { py: 7.5, pz: -3.5 },
      upstream: ["escapement.starWheel"],
      downstream: ["platen"],
    },
    (group) => {
      // Primary longitudinal hardened carriage rail
      const rail = boxMesh(35.5, 0.6, 0.8, mats.nickel);
      rail.position.set(0, 12.15, -3.4);
      rail.castShadow = true;
      group.add(rail);

      // Heavy cast carriage bed
      const bed = boxMesh(25.5, 1.2, 3.6, mats.enamel);
      bed.position.set(0, 12.85, -3.7);
      bed.castShadow = true;
      group.add(bed);

      // Industrial cast end-plates
      for (const side of [-1, 1]) {
        const plate = boxMesh(0.7, 4.2, 4.8, mats.enamel);
        plate.position.set(side * 11.8, 14.1, -3.5);
        plate.castShadow = true;
        group.add(plate);

        // Brass pivot bushing
        const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.9, 16), mats.brass);
        bushing.rotation.z = Math.PI / 2;
        bushing.position.set(side * 12.1, PLATEN.y, PLATEN.z);
        group.add(bushing);
      }

      // Precision steel escapement gear rack
      const rackBase = boxMesh(22, 0.45, 0.55, mats.steelDark);
      rackBase.position.set(0, 11.35, -3.05);
      group.add(rackBase);

      for (let i = 0; i < 44; i++) {
        const tooth = boxMesh(0.12, 0.24, 0.32, mats.steelDark);
        tooth.position.set(-10.75 + i * 0.5, 11.18, -3.05);
        group.add(tooth);
      }
      return null;
    },
  );

  {
    const { action } = addPart(
      carriageGroup,
      {
        id: "platen",
        label: "Platen",
        fn: "Rubber cylinder taking every single impact",
        system: "carriage",
        stagger: 0.74,
        offset: { py: 3.6 },
        parentId: "carriage.body",
        upstream: ["carriage.body"],
        downstream: ["paper.sheet"],
      },
      (group) => {
        group.position.set(0, PLATEN.y, PLATEN.z);
        const inner = new THREE.Group();
        group.add(inner);

        // Vulcanized matte rubber platen cylinder
        const rubber = new THREE.Mesh(new THREE.CylinderGeometry(PLATEN.r, PLATEN.r, PLATEN.len, 40), mats.rubber);
        rubber.rotation.z = Math.PI / 2;
        rubber.castShadow = true;
        inner.add(rubber);

        // Precision ground center steel axle
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, PLATEN.len + 3.8, 16), mats.nickel);
        axle.rotation.z = Math.PI / 2;
        inner.add(axle);
        return inner;
      },
    );
    refs.platenAction = action!;
  }

  for (const side of [-1, 1]) {
    addPart(
      carriageGroup,
      {
        id: `platen.knob${side < 0 ? "L" : "R"}`,
        label: side < 0 ? "Left platen knob" : "Right platen knob",
        fn: "Hand wheel for feeding paper by hand",
        system: "carriage",
        stagger: 0.76,
        offset: { px: side * 2.6 },
        parentId: "carriage.body",
        upstream: [],
        downstream: ["platen"],
      },
      (group) => {
        group.position.set(side * (PLATEN.len / 2 + 1.3), PLATEN.y, PLATEN.z);

        // Knurled Bakelite/rubber hand wheel with authentic grip flutes
        const knob = new THREE.Mesh(createKnurledPlatenKnobGeometry(1.30, 0.95), mats.keyRim);
        knob.rotation.z = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        knob.castShadow = true;
        group.add(knob);

        // Fluted perimeter grip ridges
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const ridge = boxMesh(0.12, 0.16, 0.70, mats.steelDark);
          ridge.position.set(side * 0.15, Math.cos(a) * 1.26, Math.sin(a) * 1.26);
          ridge.rotation.x = a;
          group.add(ridge);
        }

        // Central polished brass retention collar and hub screw
        const brassCap = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 1.05, 18), mats.brass);
        brassCap.rotation.z = Math.PI / 2;
        group.add(brassCap);

        const hubScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.15, 12), mats.nickel);
        hubScrew.rotation.z = Math.PI / 2;
        group.add(hubScrew);
        return null;
      },
    );
  }

  {
    const { action } = addPart(
      carriageGroup,
      {
        id: "platen.ratchet",
        label: "Line-spacing ratchet",
        fn: "Turns the platen exactly one line per return",
        system: "carriage",
        stagger: 0.77,
        offset: { px: -2.2 },
        parentId: "carriage.body",
        upstream: ["carriage.returnLever"],
        downstream: ["platen"],
      },
      (group) => {
        group.position.set(-(PLATEN.len / 2 + 0.75), PLATEN.y, PLATEN.z);
        const inner = new THREE.Group();
        group.add(inner);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.38, 24), mats.brass);
        wheel.rotation.z = Math.PI / 2;
        inner.add(wheel);
        for (let i = 0; i < 18; i++) {
          const tooth = boxMesh(0.4, 0.18, 0.32, mats.brass);
          const angle = (i / 18) * Math.PI * 2;
          tooth.position.set(0, Math.cos(angle) * 1.4, Math.sin(angle) * 1.4);
          tooth.rotation.x = angle;
          inner.add(tooth);
        }
        return inner;
      },
    );
    refs.ratchetAction = action!;
  }

  {
    const { action } = addPart(
      carriageGroup,
      {
        id: "carriage.returnLever",
        label: "Carriage return lever",
        fn: "Throws the carriage home and feeds a line",
        system: "carriage",
        stagger: 0.78,
        offset: { px: -2.8, py: 1.4 },
        parentId: "carriage.body",
        upstream: [],
        downstream: ["platen.ratchet", "carriage.body"],
      },
      (group) => {
        group.position.set(-11.8, 15.0, -2.6);
        const inner = new THREE.Group();
        group.add(inner);

        // Ergonomic curved chrome return arm
        const arm = rodBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(-2.6, 3.4, 0.8), 0.16, mats.nickel);
        arm.castShadow = true;
        inner.add(arm);

        // Sculpted return paddle grip
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 1.8, 14), mats.keyRim);
        grip.position.set(-2.8, 3.6, 0.9);
        grip.rotation.x = Math.PI / 2;
        inner.add(grip);
        return inner;
      },
    );
    refs.returnLeverAction = action!;
  }



  for (const x of [-7, 7]) {
    addPart(
      carriageGroup,
      {
        id: `carriage.feedRoller${x < 0 ? "L" : "R"}`,
        label: "Feed roller",
        fn: "Pinch roller feeding the sheet through",
        system: "carriage",
        stagger: 0.8,
        offset: { py: -1.4 },
        parentId: "carriage.body",
        upstream: [],
        downstream: ["paper.sheet"],
      },
      (group) => {
        group.position.set(x, 12.35, -3.4);
        const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.4, 14), mats.rubber);
        roller.rotation.z = Math.PI / 2;
        group.add(roller);
        return null;
      },
    );
  }

  for (const x of [-8.6, 8.6]) {
    addPart(
      carriageGroup,
      {
        id: `carriage.marginStop${x < 0 ? "L" : "R"}`,
        label: x < 0 ? "Left margin stop" : "Right margin stop",
        fn: x < 0 ? "Sets where the carriage returns to" : "Blocks the carriage at line end",
        system: "carriage",
        stagger: 0.81,
        offset: { py: -1.8 },
        parentId: "carriage.body",
        upstream: [],
        downstream: ["carriage.body"],
      },
      (group) => {
        group.position.set(x, 12.75, -2.35);
        group.add(boxMesh(0.5, 1, 0.5, mats.brass));
        return null;
      },
    );
  }

  {
    const { action } = addPart(
      root,
      {
        id: "carriage.bell",
        label: "Margin warning bell",
        fn: "Rings six characters before the right margin",
        system: "frame",
        stagger: 0.82,
        offset: { px: -2.0, py: -1.2 },
        upstream: ["carriage.marginStopR"],
        downstream: [],
      },
      (group) => {
        group.position.set(-9.6, 5.8, -5.6);
        const inner = new THREE.Group();
        group.add(inner);

        // Polished resonant brass gong dome
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(1.25, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.48),
          mats.bellMetal,
        );
        dome.rotation.x = Math.PI; // Inverted saucer gong
        dome.castShadow = true;
        inner.add(dome);

        // Center mounting stud & nickel screw cap
        const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.65, 14), mats.steelDark);
        stud.position.y = 0.2;
        inner.add(stud);

        const screwCap = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 14), mats.nickel);
        screwCap.position.y = 0.52;
        inner.add(screwCap);

        // Chassis bridge mounting bracket arm
        const bracket = rodBetween(new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(1.4, 0.2, -0.9), 0.14, mats.steelDark);
        group.add(bracket);

        // Spring-loaded striker clapper hammer ball
        const clapperArm = rodBetween(new THREE.Vector3(0.6, 0.2, 0), new THREE.Vector3(1.2, 0.5, 0.4), 0.06, mats.nickel);
        group.add(clapperArm);

        const clapperBall = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mats.nickel);
        clapperBall.position.set(1.2, 0.5, 0.4);
        group.add(clapperBall);

        return inner;
      },
    );
    refs.bellAction = action!;
  }

  addPart(
    carriageGroup,
    {
      id: "carriage.paperTable",
      label: "Paper table",
      fn: "Guides the sheet behind the platen",
      system: "carriage",
      stagger: 0.75,
      offset: { pz: -2.4, py: 1.2 },
      parentId: "carriage.body",
      upstream: [],
      downstream: ["paper.sheet"],
    },
    (group) => {
      // Single clean, flat rectangular feed plate tilting backward (-Z)
      // Lowered by normal clearance beneath the paper sheet to ensure zero clipping
      const normalClearance = 0.06; // ~0.6 mm clearance below paper surface
      const centerY = LIP_Y + (TABLE_LENGTH / 2) * Math.cos(TILT_ANGLE) - normalClearance * Math.sin(TILT_ANGLE);
      const centerZ = LIP_Z - (TABLE_LENGTH / 2) * Math.sin(TILT_ANGLE) - normalClearance * Math.cos(TILT_ANGLE);

      group.position.set(0, centerY, centerZ);

      // Single rigid rectangular sheet resting beneath the paper with engraved column ruler
      const tableMat = new THREE.MeshStandardMaterial({
        map: getPaperTableScaleTexture(),
        roughness: 0.58,
        metalness: 0.65,
      });
      const tableGeo = new THREE.BoxGeometry(TABLE_WIDTH, TABLE_LENGTH, 0.1);
      const table = new THREE.Mesh(tableGeo, tableMat);
      table.rotation.x = -TILT_ANGLE; // Tilts backward (-Z)
      table.castShadow = true;
      table.receiveShadow = true;
      group.add(table);

      return null;
    },
  );

  /* ---------------------- Upper Return Guide --------------------------- */

  const topGuidePart = addPart(
    carriageGroup,
    {
      id: "carriage.topGuide",
      label: "Upper return guide",
      fn: "Upper loop return roller and twin support stanchions for continuous loop feed",
      system: "carriage",
      stagger: 0.76,
      offset: { py: 2.5, pz: -1.5 },
      parentId: "carriage.body",
      upstream: ["carriage.body"],
      downstream: ["paper.sheet"],
    },
    (group) => {
      const paperWidth = 21.0;
      const topCenter = new THREE.Vector3(0, PLATEN.y + 10.5, PLATEN.z - 1.4);

      // Upper Return Roller: Cylinder rotated along X-axis (rotation.z = Math.PI / 2)
      const rollerGeom = new THREE.CylinderGeometry(0.45, 0.45, paperWidth + 0.8, 24);
      const roller = new THREE.Mesh(rollerGeom, mats.nickel);
      roller.position.copy(topCenter);
      roller.rotation.z = Math.PI / 2;
      roller.castShadow = true;
      group.add(roller);

      // Knurled decorative end-caps on both ends of the upper roller
      for (const side of [-1, 1]) {
        const capX = side * (paperWidth + 0.8) / 2;

        // Brass collar ring
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.25, 24), mats.brass);
        collar.position.set(capX, topCenter.y, topCenter.z);
        collar.rotation.z = Math.PI / 2;
        group.add(collar);

        // Dark steel knurled thumb knob
        const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.35, 24), mats.steelDark);
        knob.position.set(capX + side * 0.28, topCenter.y, topCenter.z);
        knob.rotation.z = Math.PI / 2;
        group.add(knob);

        // Polished nickel axle pin
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 16), mats.nickel);
        axle.position.set(capX + side * 0.55, topCenter.y, topCenter.z);
        axle.rotation.z = Math.PI / 2;
        group.add(axle);
      }

      // Twin nickel support stanchion rods rising from carriage end-plates
      for (const side of [-1, 1]) {
        const stanchionX = side * (paperWidth / 2 + 0.6); // ±11.1
        const basePos = new THREE.Vector3(stanchionX, 14.1, -3.5);
        const topPos = new THREE.Vector3(stanchionX, topCenter.y, topCenter.z);

        // Main stanchion rod
        const rod = rodBetween(basePos, topPos, 0.16, mats.nickel, 12);
        rod.castShadow = true;
        group.add(rod);

        // Base mounting bracket boss
        const baseBracket = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 0.6, 16), mats.nickel);
        baseBracket.position.copy(basePos);
        group.add(baseBracket);

        // Upper axle sleeve bearing
        const topBearing = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 16), mats.brass);
        topBearing.position.copy(topPos);
        topBearing.rotation.z = Math.PI / 2;
        group.add(topBearing);
      }

      return null;
    },
  );
  refs.topGuide = topGuidePart.partGroup;

  const paperMesh = buildPaperMesh(paper);
  addPart(
    carriageGroup,
    {
      id: "paper.sheet",
      label: "Paper sheet",
      fn: "A4 sheet — where impacts become a document",
      system: "paper",
      stagger: 0.72,
      offset: { py: 4.5, pz: 2.5 },
      parentId: "carriage.body",
      upstream: ["platen"],
      downstream: [],
    },
    (group) => {
      group.add(paperMesh.mesh);
      return null;
    },
  );
  refs.paperMesh = paperMesh.mesh;
  refs.updatePaper = paperMesh.update;

  /* ------------------------------- Ribbon ------------------------------- */

  const SPOOL_Y = 13.25;
  const SPOOL_X = 9.8;
  const SPOOL_Z = 0.5;
  for (const side of [-1, 1]) {
    const { action } = addPart(
      root,
      {
        id: `ribbon.spool${side < 0 ? "L" : "R"}`,
        label: side < 0 ? "Left ribbon spool" : "Right ribbon spool",
        fn: side < 0 ? "Takes up the spent ribbon" : "Feeds fresh ribbon per character",
        system: "ribbon",
        stagger: 0.62,
        offset: { px: side * 5.5, py: 1.2 },
        upstream: ["escapement.starWheel"],
        downstream: ["ribbon.strip"],
      },
      (group) => {
        group.position.set(side * SPOOL_X, SPOOL_Y, SPOOL_Z);
        const inner = new THREE.Group();
        group.add(inner);

        // 1. Top stamped sheet-metal flange disc with 4 curved window cutouts and drive pin holes
        const topFlange = new THREE.Mesh(createRibbonSpoolFlangeGeometry(2.45, 0.065), mats.steelDark);
        topFlange.position.y = 0.58;
        topFlange.castShadow = true;
        inner.add(topFlange);

        // Top flange rolled outer rim ring
        const topRim = new THREE.Mesh(new THREE.TorusGeometry(2.44, 0.045, 8, 36), mats.nickel);
        topRim.rotation.x = Math.PI / 2;
        topRim.position.y = 0.58;
        inner.add(topRim);

        // 2. Bottom stamped sheet-metal flange disc with matching cutouts
        const bottomFlange = new THREE.Mesh(createRibbonSpoolFlangeGeometry(2.45, 0.065), mats.steelDark);
        bottomFlange.position.y = -0.58;
        bottomFlange.castShadow = true;
        inner.add(bottomFlange);

        const bottomRim = new THREE.Mesh(new THREE.TorusGeometry(2.44, 0.045, 8, 36), mats.nickel);
        bottomRim.rotation.x = Math.PI / 2;
        bottomRim.position.y = -0.58;
        inner.add(bottomRim);

        // 3. Central wound inked cloth ribbon core (textured bichrome ribbon roll)
        const woundRibbonMat = new THREE.MeshStandardMaterial({
          map: getWoundRibbonTexture(),
          normalMap: mats.ribbon.normalMap,
          normalScale: new THREE.Vector2(0.8, 0.8),
          roughness: 0.88,
          metalness: 0.05,
        });
        const ribbonCore = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 1.10, 36), woundRibbonMat);
        ribbonCore.castShadow = true;
        inner.add(ribbonCore);

        // Inner cylindrical slotted steel core drum
        const coreDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 1.16, 24), mats.steelDark);
        inner.add(coreDrum);

        // Ribbon anchor clip & fastener rivet on the core drum
        const anchorClip = boxMesh(0.12, 1.05, 0.42, mats.nickel);
        anchorClip.position.set(0.88, 0, 0);
        inner.add(anchorClip);

        const anchorRivet = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 10), mats.brass);
        anchorRivet.rotation.z = Math.PI / 2;
        anchorRivet.position.set(0.92, 0, 0);
        inner.add(anchorRivet);

        // 4. Center drive spindle arbor
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.55, 16), mats.steelDark);
        inner.add(hub);

        // 5. Polished knurled brass / nickel thumb retainer nut on top
        const knurledNut = new THREE.Mesh(createKnurledNutGeometry(0.52, 0.32), mats.nickel);
        knurledNut.position.y = 0.62;
        inner.add(knurledNut);

        const nutScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 14), mats.brass);
        nutScrew.position.y = 0.94;
        inner.add(nutScrew);

        // 6. Under-spool driving ratchet plate with 3 drive pins
        const ratchetDriver = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.14, 12), mats.steelDark);
        ratchetDriver.position.y = -0.68;
        inner.add(ratchetDriver);

        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
          const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.25, 10), mats.nickel);
          pin.position.set(Math.cos(a) * 0.64, -0.58, Math.sin(a) * 0.64);
          inner.add(pin);
        }

        // 7. Spool reverse sensing trip finger arm
        const tripArm = boxMesh(0.08, 0.45, 1.15, mats.nickel);
        tripArm.position.set(side * 1.45, 0, 0.25);
        tripArm.rotation.y = side * 0.35;
        group.add(tripArm);

        // 8. Deck guide post / tension roller guiding ribbon off the spool towards center
        const guidePost = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.25, 14), mats.nickel);
        guidePost.position.set(side * -2.35, 0, 0.05);
        group.add(guidePost);

        for (const y of [-0.60, 0.60]) {
          const guideFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 14), mats.steelDark);
          guideFlange.position.set(side * -2.35, y, 0.05);
          group.add(guideFlange);
        }

        return inner;
      },
    );
    if (side < 0) refs.spoolL = action!;
    else refs.spoolR = action!;
  }

  {
    const { action } = addPart(
      root,
      {
        id: "vibrator",
        label: "Ribbon vibrator",
        fn: "Lifts the ribbon into the strike path",
        system: "ribbon",
        stagger: 0.63,
        offset: { pz: 4.2, py: 0.8 },
        upstream: ["typebars"],
        downstream: ["paper.sheet"],
      },
      (group) => {
        group.position.set(0, 13.1, -1.36);
        const inner = new THREE.Group();
        group.add(inner);

        // Polished nickel ribbon vibrator carrier with gracefully curved top corners and beveled edges
        const shape = new THREE.Shape();
        const sw = 0.20; // stem half-width
        const stemB = -0.70; // stem bottom sliding in anvil guide
        const stemT = 0.15; // stem top transition

        // Start at bottom stem
        shape.moveTo(-sw, stemB);
        shape.lineTo(sw, stemB);
        shape.lineTo(sw, stemT);

        // Right ear flare outward and upward
        shape.quadraticCurveTo(0.42, 0.38, 0.90, 0.68);
        shape.lineTo(1.00, 1.10);

        // TOP RIGHT CORNER: Gracefully curved arc (curved top corner)
        shape.quadraticCurveTo(1.00, 1.40, 0.72, 1.40);

        // Top right inner curl dropping towards strike aperture
        shape.quadraticCurveTo(0.50, 1.40, 0.40, 1.05);

        // Strike Window: Smooth U-notch cutout so type slugs hit cleanly
        shape.quadraticCurveTo(0.30, 0.46, 0.0, 0.46);
        shape.quadraticCurveTo(-0.30, 0.46, -0.40, 1.05);

        // Top left inner curl rising to top left
        shape.quadraticCurveTo(-0.50, 1.40, -0.72, 1.40);

        // TOP LEFT CORNER: Gracefully curved arc (curved top corner)
        shape.quadraticCurveTo(-1.00, 1.40, -1.00, 1.10);

        // Left ear flare inward to stem
        shape.lineTo(-0.90, 0.68);
        shape.quadraticCurveTo(-0.42, 0.38, -sw, stemT);
        shape.lineTo(-sw, stemB);

        const extrudeSettings: THREE.ExtrudeGeometryOptions = {
          steps: 1,
          depth: 0.07,
          bevelEnabled: true,
          bevelThickness: 0.02,
          bevelSize: 0.02,
          bevelSegments: 3,
        };

        const vibratorCarrierGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        vibratorCarrierGeo.center();
        const vibratorCarrier = new THREE.Mesh(vibratorCarrierGeo, mats.nickel);
        vibratorCarrier.position.set(0, 0.40, 0);
        inner.add(vibratorCarrier);

        // Curved ribbon retention guide loops on left and right wings
        for (const side of [-1, 1]) {
          const guideLoop = new THREE.Mesh(
            new THREE.TorusGeometry(0.16, 0.032, 10, 16, Math.PI * 1.15),
            mats.nickel,
          );
          guideLoop.rotation.y = Math.PI / 2;
          guideLoop.rotation.z = side > 0 ? 0.3 : -0.3;
          guideLoop.position.set(side * 0.86, 0.55, 0.02);
          inner.add(guideLoop);
        }

        // Lower ribbon shelf support
        const shelf = boxMesh(1.85, 0.06, 0.12, mats.nickel);
        shelf.position.set(0, 0.28, 0.02);
        inner.add(shelf);

        // Center ribbon section resting inside the vibrator guide slot
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.52), mats.ribbon);
        strip.position.set(0, 0.55, 0.02);
        inner.add(strip);

        // Rear actuator link rod positioned cleanly behind the segment frame (Z <= -2.2)
        const rearActuatorRod = rodBetween(
          new THREE.Vector3(0, -0.3, 0),
          new THREE.Vector3(0, -1.2, -1.0),
          0.12,
          mats.nickel,
        );
        inner.add(rearActuatorRod);

        const verticalGuideRod = rodBetween(
          new THREE.Vector3(0, -1.2, -1.0),
          new THREE.Vector3(0, -7.9, -1.0),
          0.1,
          mats.nickel,
        );
        inner.add(verticalGuideRod);

        return inner;
      },
    );
    refs.vibratorAction = action!;
  }

  refs.ribbonSideL = createDynamicRibbonMesh(mats.ribbon, 36);
  refs.ribbonSideL.name = "ribbon.strip.left";
  refs.ribbonSideL.userData.partId = "ribbon.strip";
  root.add(refs.ribbonSideL);

  refs.ribbonSideR = createDynamicRibbonMesh(mats.ribbon, 36);
  refs.ribbonSideR.name = "ribbon.strip.right";
  refs.ribbonSideR.userData.partId = "ribbon.strip";
  root.add(refs.ribbonSideR);

  addPart(
    root,
    {
      id: "ribbon.strip",
      label: "Ink ribbon",
      fn: "Woven inked fabric between slug and sheet",
      system: "ribbon",
      stagger: 0.64,
      offset: { py: 2.2 },
      upstream: ["ribbon.spoolL", "ribbon.spoolR", "vibrator"],
      downstream: ["paper.sheet"],
    },
    () => null,
  );

  refs.ribbonTipL = new THREE.Vector3(-0.85, 13.65, -1.36);
  refs.ribbonTipR = new THREE.Vector3(0.85, 13.65, -1.36);

  addPart(
    root,
    {
      id: "ribbon.advance",
      label: "Ribbon advance gear",
      fn: "Steps the ribbon on every escapement release",
      system: "ribbon",
      stagger: 0.65,
      offset: { py: -1.8 },
      upstream: ["escapement.starWheel"],
      downstream: ["ribbon.spoolR"],
    },
    (group) => {
      // Group for rotating cross-shaft components lowered safely under the basket
      const gearGroup = new THREE.Group();
      gearGroup.position.set(0, 5.2, -3.6);

      const driveShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 20.0, 16), mats.steelDark);
      driveShaft.rotation.z = Math.PI / 2;
      gearGroup.add(driveShaft);

      const miterGearH = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.2, 0.28, 14), mats.brass);
      miterGearH.rotation.z = Math.PI / 2;
      miterGearH.position.set(9.5, 0, 0);
      gearGroup.add(miterGearH);

      const ratchetWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.3, 18), mats.brass);
      ratchetWheel.rotation.z = Math.PI / 2;
      ratchetWheel.position.set(4.8, 0, 0);
      gearGroup.add(ratchetWheel);

      for (let i = 0; i < 12; i++) {
        const tooth = boxMesh(0.28, 0.15, 0.24, mats.brass);
        const angle = (i / 12) * Math.PI * 2;
        tooth.position.set(4.8, Math.cos(angle) * 0.92, Math.sin(angle) * 0.92);
        tooth.rotation.x = angle + 0.25;
        gearGroup.add(tooth);
      }
      group.add(gearGroup);
      refs.ribbonAdvanceGear = gearGroup;

      // Group for right vertical spindle components extending from Y = 5.2 up to spool height Y = 13.25
      const spindleGroup = new THREE.Group();
      spindleGroup.position.set(SPOOL_X, 5.2, -1.2);

      const rightSpoolSpindle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 8.2, 14), mats.steelDark);
      rightSpoolSpindle.position.set(0, 4.1, 0);
      spindleGroup.add(rightSpoolSpindle);

      const miterGearV = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.38, 0.28, 14), mats.brass);
      spindleGroup.add(miterGearV);

      group.add(spindleGroup);
      refs.ribbonAdvanceSpindle = spindleGroup;

      // Group for the rocker actuated by universal bar
      const rockerGroup = new THREE.Group();
      rockerGroup.position.set(5.15, 5.7, -3.6);

      const pawlRocker = boxMesh(0.24, 1.3, 0.38, mats.steelDark);
      pawlRocker.rotation.x = 0.32;
      rockerGroup.add(pawlRocker);

      const drivePawl = boxMesh(0.16, 0.8, 0.18, mats.steelDark);
      drivePawl.position.set(0, 0.4, 0.22);
      drivePawl.rotation.x = -0.42;
      rockerGroup.add(drivePawl);

      const actRod = rodBetween(
        new THREE.Vector3(-0.65, -0.6, 1.7),
        new THREE.Vector3(0, -0.4, 0),
        0.1,
        mats.steelDark,
      );
      rockerGroup.add(actRod);

      group.add(rockerGroup);
      refs.ribbonAdvanceRocker = rockerGroup;

      // Bearing pillow block brackets anchoring the cross-shaft to the chassis frame
      for (const xBracket of [-9.4, 0, 9.4]) {
        const pillowBlock = boxMesh(0.55, 1.2, 0.7, mats.steelDark);
        pillowBlock.position.set(xBracket, 4.8, -3.6);
        group.add(pillowBlock);

        const brassBushing = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 12), mats.brass);
        brassBushing.rotation.z = Math.PI / 2;
        brassBushing.position.set(xBracket, 5.2, -3.6);
        group.add(brassBushing);
      }

      // Anti-reverse retention click pawl (static housing)
      const holdPawl = boxMesh(0.16, 0.65, 0.16, mats.steelDark);
      holdPawl.position.set(4.8, 4.45, -3.18);
      holdPawl.rotation.x = 0.48;
      group.add(holdPawl);

      return null;
    },
  );

  addPart(
    root,
    {
      id: "ribbon.reverse",
      label: "Ribbon reverse pawl",
      fn: "Flips the feed direction at spool end",
      system: "ribbon",
      stagger: 0.66,
      offset: { py: -1.8, px: -1.5 },
      upstream: ["ribbon.spoolL"],
      downstream: ["ribbon.advance"],
    },
    (group) => {
      // Left vertical spool spindle shaft connecting left spool to cross-shaft
      const spindleGroup = new THREE.Group();
      spindleGroup.position.set(-SPOOL_X, 5.2, -1.2);

      const leftSpoolSpindle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 8.2, 14), mats.steelDark);
      leftSpoolSpindle.position.set(0, 4.1, 0);
      spindleGroup.add(leftSpoolSpindle);

      const miterGearV = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.38, 0.28, 14), mats.brass);
      spindleGroup.add(miterGearV);

      group.add(spindleGroup);
      refs.ribbonReverseSpindle = spindleGroup;

      // Left miter bevel gear pair transferring rotation to vertical spindle
      const gearGroup = new THREE.Group();
      gearGroup.position.set(-9.5, 5.2, -3.6);

      const miterGearH = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.38, 0.28, 14), mats.brass);
      miterGearH.rotation.z = Math.PI / 2;
      gearGroup.add(miterGearH);

      group.add(gearGroup);
      refs.ribbonReverseGear = gearGroup;

      // Left and Right Ribbon Reverse Sensing Arms (Pawls) extending through deck slots
      for (const side of [-1, 1]) {
        // Spool edge guide bracket connecting to the inner perimeter of the moved spool
        const mount = boxMesh(0.35, 0.85, 0.45, mats.steelDark);
        mount.position.set(side * 8.6, 12.4, 0.5);
        group.add(mount);

        // Sensing contact fork that trips when ribbon eyelet catches
        const fork = boxMesh(0.16, 0.9, 0.35, mats.nickel);
        fork.position.set(side * 8.4, 13.0, 0.5);
        group.add(fork);

        // Side vertical dropper rod running down the outer perimeter to floor level:
        const dropperRod = rodBetween(
          new THREE.Vector3(side * 8.6, 12.2, 0.5),
          new THREE.Vector3(side * 8.6, 5.4, -3.6),
          0.08,
          mats.steelDark,
        );
        group.add(dropperRod);
      }

      // Low-level transverse shifter rod parallel to the ribbon advance drive shaft
      const shiftLink = boxMesh(17.6, 0.16, 0.16, mats.steelDark);
      shiftLink.position.set(0, 5.4, -3.6);
      group.add(shiftLink);

      // Clutch toggle block down on the chassis floor
      const toggle = boxMesh(0.42, 0.6, 0.32, mats.brass);
      toggle.position.set(0, 5.4, -3.6);
      group.add(toggle);

      return null;
    },
  );

  /* -------------------------------- Frame ------------------------------- */

  addPart(
    root,
    {
      id: "frame.chassis",
      label: "Main chassis",
      fn: "Die-cast hollow perimeter frame housing internal linkages",
      system: "frame",
      stagger: 0.94,
      offset: {},
    },
    (group) => {
      group.position.set(0, 2.4, 4.4); // Desk base level

      // 1. 4 Molded Rubber Feet with Brass Washers
      const feetCoords = [
        [-17.2, 10.5],
        [17.2, 10.5],
        [17.2, -10.5],
        [-17.2, -10.5],
      ];
      for (const [fx, fz] of feetCoords) {
        // Truncated conical rubber foot puck (rTop: 1.6, rBottom: 1.9, h: 0.6)
        const foot = new THREE.Mesh(
          new THREE.CylinderGeometry(1.6, 1.9, 0.6, 24),
          mats.rubber,
        );
        foot.position.set(fx, -0.3, fz);
        foot.receiveShadow = true;
        group.add(foot);

        // Brass center mounting washer
        const washer = new THREE.Mesh(
          new THREE.CylinderGeometry(1.0, 1.0, 0.65, 16),
          mats.brass,
        );
        washer.position.set(fx, -0.3, fz);
        group.add(washer);

        // Internal base boss ring
        const boss = new THREE.Mesh(
          new THREE.CylinderGeometry(1.6, 1.8, 0.35, 20),
          mats.enamel,
        );
        boss.position.set(fx, 0.55, fz);
        group.add(boss);
      }

      // 2. Base Pan: Single flat sheet (39.5 x 0.4 x 26.0) sitting at Y = 2.4
      const basePan = roundedBoxMesh(39.5, 0.4, 26.0, 0.8, 0.08, mats.enamel);
      basePan.position.set(0, 0.2, 0);
      basePan.castShadow = true;
      basePan.receiveShadow = true;
      group.add(basePan);

      // 3. Side Base Ledges & Inner Linkage Clearances
      for (const side of [-1, 1]) {
        const sx = side * 18.8;
        const innerLedge = boxMesh(1.0, 0.8, 22.0, mats.steelDark);
        innerLedge.position.set(sx, 0.8, 0);
        group.add(innerLedge);
      }

      // 4. Rear Transverse Bridge Cross-Member & Escapement Cradle
      const crossBridge = roundedBoxMesh(37.6, 1.3, 1.5, 0.2, 0.05, mats.enamel);
      crossBridge.position.set(0, 6.1, -6.8);
      crossBridge.castShadow = true;
      group.add(crossBridge);

      const centerBracket = boxMesh(3.4, 2.2, 1.8, mats.steelDark);
      centerBracket.position.set(0, 5.4, -6.8);
      group.add(centerBracket);

      const lowerMount = boxMesh(8.0, 1.2, 2.0, mats.steelDark);
      lowerMount.position.set(0, 0.8, -5.8);
      group.add(lowerMount);

      return null;
    },
  );

  for (const side of [-1, 1]) {
    addPart(
      root,
      {
        id: `frame.sidePanel${side < 0 ? "L" : "R"}`,
        label: side < 0 ? "Left side fender" : "Right side fender",
        fn: "Continuous swept side cheek panel — opens in cutaway view",
        system: "frame",
        stagger: 0.86,
        offset: { px: side * 6.5, ry: side * 0.35 },
        cutawayFade: true,
      },
      (group) => {
        group.position.set(side * 19.6, 0, 0);

        // Continuous swept fender cheek with S-curve silhouette
        const fender = new THREE.Mesh(createSideFenderGeometry(0.8), mats.enamelPanel);
        fender.castShadow = true;
        fender.receiveShadow = true;
        group.add(fender);

        // Polished nickel accent trim strip along lower rocker
        const trim = boxMesh(0.18, 0.22, 23.2, mats.nickel);
        trim.position.set(side * 0.42, 2.6, 4.6);
        group.add(trim);

        // Chrome side mounting boss / fastener at front cheek
        const fastener = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 14), mats.nickel);
        fastener.rotation.z = Math.PI / 2;
        fastener.position.set(side * 0.45, 5.0, 15.2);
        group.add(fastener);

        return null;
      },
    );
  }

  addPart(
    root,
    {
      id: "frame.rearPanel",
      label: "Rear panel",
      fn: "Enamel back cowl of the mechanism bay",
      system: "frame",
      stagger: 0.87,
      offset: { pz: -5.5 },
      cutawayFade: true,
    },
    (group) => {
      group.position.set(0, 6.8, -7.0);
      const back = roundedBoxMesh(39.6, 8.8, 0.65, 0.28, 0.08, mats.enamelPanel);
      back.castShadow = true;
      group.add(back);
      return null;
    },
  );

  addPart(
    root,
    {
      id: "frame.apron",
      label: "Front apron",
      fn: "Sculpted enamel brow and badge plate enclosing keyboard",
      system: "frame",
      stagger: 0.88,
      offset: { pz: 5, py: -1.2 },
      cutawayFade: true,
    },
    (group) => {
      group.position.set(0, 5.2, 16.2);

      // Left and right rounded front cheeks
      for (const side of [-1, 1]) {
        const cheek = roundedBoxMesh(5.6, 4.2, 1.6, 0.4, 0.12, mats.enamelPanel);
        cheek.position.set(side * 17.0, 0, 0);
        cheek.castShadow = true;
        group.add(cheek);
      }

      // Low front bottom sill with wide central spacebar cutout (W = 28.5)
      const sill = roundedBoxMesh(28.5, 1.4, 1.6, 0.25, 0.08, mats.enamelPanel);
      sill.position.set(0, -1.4, 0);
      sill.castShadow = true;
      group.add(sill);

      // Polished brass badge backing plate
      const badgePlate = boxMesh(12.2, 1.5, 0.15, mats.brass);
      badgePlate.position.set(0, -1.3, 0.82);
      badgePlate.rotation.x = 0.08;
      group.add(badgePlate);

      // Gold badge banner: "PLATEN: 3D TYPEWRITER"
      const badgeName = new THREE.Mesh(
        new THREE.PlaneGeometry(12.0, 1.4),
        new THREE.MeshBasicMaterial({
          map: buildGoldBadgeTexture("PLATEN", "3D MECHANICAL TYPEWRITER"),
          transparent: true,
        }),
      );
      badgeName.position.set(0, -1.3, 0.91);
      badgeName.rotation.x = 0.08;
      group.add(badgeName);

      return null;
    },
  );

  for (const side of [-1, 1]) {
    addPart(
      root,
      {
        id: `frame.deckPlate${side < 0 ? "L" : "R"}`,
        label: side < 0 ? "Left swept deck cowl" : "Right swept deck cowl",
        fn: "Continuous contoured enamel cowl with S-curve shoulder and integrated ribbon spool well",
        system: "frame",
        stagger: 0.89,
        offset: { py: 3.2, px: side * 2.5 },
        cutawayFade: true,
      },
      (group) => {
        const deckX = side * 13.2;
        group.position.set(deckX, 0, 0);

        // Basin X offset in local deck coordinates matching world SPOOL_X = 9.8:
        const basinX = side * (9.8 - 13.2);
        const basinZ = 0.5;

        // 1. Continuous swept enamel deck cowl matching side fender S-curve
        const cowlMesh = new THREE.Mesh(createContouredDeckCowlGeometry(12.0), mats.enamelPanel);
        cowlMesh.castShadow = true;
        cowlMesh.receiveShadow = true;
        group.add(cowlMesh);

        // Top deck plate cover with true circular spool well cutout
        const coverMesh = new THREE.Mesh(createDeckPlateCoverGeometry(basinX, 12.0, 7.5), mats.enamelPanel);
        coverMesh.position.set(0, 11.1, -3.25);
        coverMesh.castShadow = true;
        coverMesh.receiveShadow = true;
        group.add(coverMesh);

        // 2. Recessed Cylindrical Spool Basin sitting flush inside the circular cutout (radius: 2.55, depth: 1.1)
        const basinCup = new THREE.Mesh(
          new THREE.CylinderGeometry(2.55, 2.55, 1.1, 32, 1, true),
          mats.enamelPanel,
        );
        basinCup.position.set(basinX, 10.65, basinZ);
        basinCup.castShadow = true;
        basinCup.receiveShadow = true;
        group.add(basinCup);

        const basinBottom = new THREE.Mesh(
          new THREE.CylinderGeometry(2.55, 2.55, 0.12, 32),
          mats.steelDark,
        );
        basinBottom.position.set(basinX, 10.10, basinZ);
        group.add(basinBottom);

        // 3. Polished Nickel Spool Rim Bezel framing the circular cutout
        const bezel = new THREE.Mesh(
          new THREE.TorusGeometry(2.62, 0.08, 12, 48),
          mats.nickel,
        );
        bezel.rotation.x = Math.PI / 2;
        bezel.position.set(basinX, 11.22, basinZ);
        group.add(bezel);

        // 4. Polished nickel lower front accent trim strip along chassis sill
        const frontTrim = boxMesh(11.8, 0.22, 0.18, mats.nickel);
        frontTrim.position.set(0, 2.6, 8.4);
        group.add(frontTrim);

        return null;
      },
    );
  }

  addPart(
    root,
    {
      id: "frame.basketCowl",
      label: "Basket cradle cowl",
      fn: "Sculpted U-shaped enamel pan enclosing the typebar mechanism and connecting side swept deck cowls",
      system: "frame",
      stagger: 0.895,
      offset: { py: -2.0, pz: 1.5 },
      cutawayFade: true,
    },
    (group) => {
      // 1. Sculpted U-shaped basket belly pan enclosing underside of typebar mechanism
      const cowlGeo = createUnderBasketCowlGeometry(14.4, 0.20);
      const cowlMesh = new THREE.Mesh(cowlGeo, mats.enamelPanel);
      cowlMesh.castShadow = true;
      cowlMesh.receiveShadow = true;
      group.add(cowlMesh);

      // 2. Nickel front arc trim bead along the forward cowl lip behind the keyboard
      const beadPoints: THREE.Vector3[] = [];
      for (let i = 0; i <= 32; i++) {
        const u = (i / 32) * 2 - 1;
        const x = u * 7.2;
        const z = 6.0;
        const y = (1 - u * u) * 5.8 + (u * u) * 6.0 + 0.06;
        beadPoints.push(new THREE.Vector3(x, y, z));
      }
      const beadCurve = new THREE.CatmullRomCurve3(beadPoints);
      const beadGeo = new THREE.TubeGeometry(beadCurve, 32, 0.055, 8, false);
      const beadMesh = new THREE.Mesh(beadGeo, mats.nickel);
      group.add(beadMesh);

      return null;
    },
  );

  addPart(
    root,
    {
      id: "frame.rearDeck",
      label: "Rear deck",
      fn: "Cover over the escapement bay",
      system: "frame",
      stagger: 0.9,
      offset: { py: 3, pz: -2.5 },
      cutawayFade: true,
    },
    (group) => {
      group.position.set(0, 11.2, -5.4);
      const rear = roundedBoxMesh(26.4, 0.45, 2.5, 0.25, 0.08, mats.enamelPanel);
      rear.castShadow = true;
      group.add(rear);
      return null;
    },
  );

  for (const side of [-1, 1]) {
    addPart(
      basketGroup,
      {
        id: `shift.rod${side < 0 ? "L" : "R"}`,
        label: side < 0 ? "Left shift rod" : "Right shift rod",
        fn: "Shift linkage: raises the basket for capitals",
        system: "shift",
        stagger: 0.6,
        offset: { px: side * 2, py: -1.6 },
        upstream: [`lever.Shift${side < 0 ? "Left" : "Right"}`],
        downstream: ["basket.segment"],
      },
      (group) => {
        group.position.set(side * 11.8, 7.6, 2.2);
        const rod = rodBetween(new THREE.Vector3(0, -2.4, 2.4), new THREE.Vector3(0, 2, -0.2), 0.1, mats.steelDark);
        group.add(rod);
        return null;
      },
    );
  }

  /* ------------------------------ Hardware ------------------------------ */

  /** Lathed pan-head machine screw geometry with flange washer and planar UVs. */
  function buildScrewGeometry(): THREE.BufferGeometry {
    const points: THREE.Vector2[] = [
      new THREE.Vector2(0.0, 0.16),
      new THREE.Vector2(0.22, 0.14),
      new THREE.Vector2(0.36, 0.11),
      new THREE.Vector2(0.44, 0.06),
      new THREE.Vector2(0.46, 0.0),
      new THREE.Vector2(0.52, -0.01),
      new THREE.Vector2(0.54, -0.07),
      new THREE.Vector2(0.24, -0.08),
      new THREE.Vector2(0.22, -0.42),
      new THREE.Vector2(0.0, -0.45),
    ];
    const geo = new THREE.LatheGeometry(points, 24);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (y >= -0.04) {
        // Planar top-down UV projection for centered screwdriver slot
        uv.setXY(i, 0.5 + x / 1.1, 0.5 + z / 1.1);
      }
    }
    uv.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  const screwData: Array<{ p: THREE.Vector3; n: THREE.Vector3; rotZ: number }> = [];

  // Left and Right side panel assembly screws (8 per side)
  // Left and Right side panel assembly screws (8 per side across length Z in [-5.5, 14.5])
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const zCol = i < 4 ? -5.5 + i * 2.8 : 6.5 + (i - 4) * 2.2;
      const yRow = 3.6 + (i % 3) * 2.4;
      screwData.push({
        p: new THREE.Vector3(side * 20.05, yRow, zCol),
        n: new THREE.Vector3(side, 0, 0),
        rotZ: (i * 0.73) % Math.PI,
      });
    }
  }

  // Rear cowl back panel assembly screws (6 across rear wall)
  for (let i = 0; i < 6; i++) {
    screwData.push({
      p: new THREE.Vector3(-14 + i * 5.6, 6.8, -7.4),
      n: new THREE.Vector3(0, 0, -1),
      rotZ: (i * 1.1) % Math.PI,
    });
  }

  // Front apron wall assembly screws (6 across front wall casing)
  for (let i = 0; i < 6; i++) {
    screwData.push({
      p: new THREE.Vector3(-14 + i * 5.6, 6.8, 17.25),
      n: new THREE.Vector3(0, 0, 1),
      rotZ: (i * 0.95) % Math.PI,
    });
  }

  addPart(
    root,
    {
      id: "hardware.screws",
      label: "Assembly screws",
      fn: "Machine screws — exit along their own axes",
      system: "hardware",
      stagger: 0.92,
      offset: {},
    },
    (group) => {
      const screwGeometry = buildScrewGeometry();
      const instanced = new THREE.InstancedMesh(screwGeometry, mats.screw ?? mats.nickel, screwData.length);
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const upAxis = new THREE.Vector3(0, 1, 0);
      const rollQuat = new THREE.Quaternion();

      screwData.forEach((screw, index) => {
        quaternion.setFromUnitVectors(upAxis, screw.n);
        rollQuat.setFromAxisAngle(screw.n, screw.rotZ);
        quaternion.premultiply(rollQuat);
        matrix.compose(screw.p, quaternion, new THREE.Vector3(1, 1, 1));
        instanced.setMatrixAt(index, matrix);
      });
      instanced.instanceMatrix.needsUpdate = true;
      group.add(instanced);
      group.userData.screwData = screwData;
      group.userData.instanced = instanced;
      return null;
    },
  );

  addPart(
    root,
    {
      id: "carriage.spring",
      label: "Mainspring drum",
      fn: "Spring motor pulling the carriage leftward",
      system: "carriage",
      stagger: 0.83,
      offset: { py: -2, pz: 2 },
      upstream: [],
      downstream: ["carriage.body"],
    },
    (group) => {
      group.position.set(10.5, 10.6, -3.2);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.2, 20), mats.steelDark);
      group.add(drum);
      const strap = boxMesh(0.5, 0.08, 8, mats.brass);
      strap.position.set(-1.2, 0.8, 2.5);
      group.add(strap);
      return null;
    },
  );

  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = object.castShadow || false;
      object.receiveShadow = true;
    }
  });

  return { root, parts, byId, refs };
}
