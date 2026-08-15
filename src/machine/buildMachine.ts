import * as THREE from "three";
import type { MachineMaterials } from "../scene/Materials";
import type { PaperTexture } from "../document/PaperTexture";
import { IME_TYPEBAR, KEYS, TYPEBAR_COUNT, type KeyDef } from "./keyboardLayout";

/* ------------------------------------------------------------------ */
/* Layout constants                                                    */
/* ------------------------------------------------------------------ */

const KEY_SPACING = 1.9;
const ROW_POS = [
  { z: 2.4, y: 8.7 },
  { z: 4.35, y: 8 },
  { z: 6.3, y: 7.4 },
  { z: 8.25, y: 6.85 },
  { z: 10.3, y: 6.3 },
];
const KEY_CENTER_COL = 7.4;
const PRINT_POINT = new THREE.Vector3(0, 14.6, -1.46);
const PLATEN = { y: 14.6, z: -3.4, r: 1.9, len: 22.4 };
const TILT_ANGLE = Math.PI / 4.5; // ~40 degrees tilt backward
const LIP_Y = PLATEN.y + 0.2;
const LIP_Z = PLATEN.z - PLATEN.r - 0.08; // Behind roller
const TABLE_LENGTH = 7.5;
const TABLE_WIDTH = 22.5; // paperWidth (21.0) + 1.5
const BASKET = { cx: 0, cy: 9.6, cz: -2, r: 6.3 };
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

function boxMesh(w: number, h: number, d: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
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
  const LINE_FEED_3D_LOOP = loopTotalLength / SCROLL_LOOP_LINES; // Exact 3D units per line in scroll mode
  const LINE_FEED_3D_SHEET = (67.0 / 3508.0) * sheetLength;     // Sheet mode line feed
  void LINE_FEED_3D_LOOP;

  let currentMode: "sheet" | "scroll" = "scroll";
  let currentLine = 0;

  const update = (line: number, mode?: "sheet" | "scroll") => {
    if (mode !== undefined) currentMode = mode;
    currentLine = line;

    const positionAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const uvAttr = geometry.getAttribute("uv") as THREE.BufferAttribute;
    let ptr = 0;

    if (currentMode === "sheet") {
      const initialProtrusion = 2.6;
      const sTop = sArcEnd + initialProtrusion + currentLine * LINE_FEED_3D_SHEET;
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
      // The strike horizon (sStation = 0) is locked to the active typing line
      const BASE_TEXT_PHASE = 0.72; // Optical baseline alignment with ribbon vibrator
      const scrollPhase = (currentLine + BASE_TEXT_PHASE) / SCROLL_LOOP_LINES;

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
        const armEnd = new THREE.Vector3(0, position.y - 0.7 - LEVER_PIVOT.y, position.z - LEVER_PIVOT.z);
        const arm = rodBetween(new THREE.Vector3(0, 0, 0), armEnd, 0.09, mats.steelDark);
        arm.castShadow = true;
        inner.add(arm);
        const rear = rodBetween(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.18, -1.9), 0.09, mats.steelDark);
        inner.add(rear);
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 12), mats.nickel);
        collar.rotation.z = Math.PI / 2;
        inner.add(collar);
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

  const typebarAngle = (index: number): number =>
    index === IME_TYPEBAR
      ? THREE.MathUtils.degToRad(14)
      : THREE.MathUtils.degToRad(20 + (index * 140) / (TYPEBAR_COUNT - 1));

  const typebarPivot = (index: number): THREE.Vector3 => {
    const angle = typebarAngle(index);
    return new THREE.Vector3(
      BASKET.cx + BASKET.r * Math.cos(angle),
      BASKET.cy,
      BASKET.cz + BASKET.r * Math.sin(angle),
    );
  };

  const buildTypebar = (
    index: number,
    labelTop: string,
    lower: string,
    upper: string,
    isIme: boolean,
  ): { pivot: THREE.Vector3; restAngle: number; yaw: number } => {
    const pivot = typebarPivot(index);
    const toPrint = PRINT_POINT.clone().sub(pivot);
    const barLength = toPrint.length();
    toPrint.normalize();
    const flatDistance = Math.hypot(toPrint.x, toPrint.z);
    const yaw = Math.atan2(toPrint.x, toPrint.z);
    const strikeAngle = Math.atan2(flatDistance, toPrint.y);
    const restAngle = strikeAngle + THREE.MathUtils.degToRad(72);
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
          px: Math.cos(typebarAngle(index)) * 3.2,
          py: 1.8,
          pz: Math.sin(typebarAngle(index)) * 3.2,
          ry: (typebarAngle(index) - Math.PI / 2) * 0.35,
        },
        parentId: null,
        upstream: isIme ? [] : [`link.${keyCode}`],
        downstream: ["vibrator", "escapement.starWheel"],
      },
      (group) => {
        group.position.copy(pivot);
        group.rotation.order = "YXZ";
        group.rotation.y = yaw;
        group.rotation.x = restAngle;
        const inner = new THREE.Group();
        group.add(inner);
        const bar = boxMesh(0.2, barLength, 0.4, isIme ? mats.brass : mats.nickel);
        bar.position.y = barLength / 2;
        bar.castShadow = true;
        inner.add(bar);
        const tail = boxMesh(0.18, 1.4, 0.36, mats.steelDark);
        tail.position.y = -0.7;
        inner.add(tail);
        const slugBlock = boxMesh(0.52, 0.72, 0.34, mats.steelDark);
        slugBlock.position.y = barLength + 0.2;
        slugBlock.rotation.x = -1.15;
        inner.add(slugBlock);
        const slugFace = new THREE.Mesh(
          new THREE.PlaneGeometry(0.44, 0.6),
          new THREE.MeshBasicMaterial({ map: slugTexture(lower, upper) }),
        );
        slugFace.position.set(0, barLength + 0.2, 0.18);
        slugFace.rotation.x = -1.15;
        inner.add(slugFace);
        return inner;
      },
    );

    refs.typebarActions[index] = action!;
    refs.typebarRestAngles[index] = restAngle;
    refs.typebarStrikeAngles[index] = strikeAngle;
    return { pivot, restAngle, yaw };
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
    const info = typebarInfo[def.typebar]!;
    const tailDirection = new THREE.Vector3(0, -Math.cos(info.restAngle), -Math.sin(info.restAngle)).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      info.yaw,
    );
    const tailPoint = info.pivot.clone().addScaledVector(tailDirection, 1.4);
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
        const rod = rodBetween(leverEnd, tailPoint, 0.055, mats.nickel, 6);
        group.add(rod);
        const joint = rodBetween(tailPoint.clone().add(new THREE.Vector3(0, -0.5, 0)), tailPoint, 0.09, mats.brass, 6);
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
      fn: "Slotted arc guiding every typebar pivot",
      system: "basket",
      stagger: 0.56,
      offset: { py: -2.2 },
      downstream: ["typebars"],
    },
    (group) => {
      group.position.set(BASKET.cx, BASKET.cy - 0.3, BASKET.cz);
      const arc = Math.PI * 0.95;
      const segment = new THREE.Mesh(new THREE.TorusGeometry(BASKET.r, 0.3, 10, 48, arc), mats.enamel);
      segment.rotation.x = Math.PI / 2;
      segment.rotation.z = Math.PI - arc / 2;
      group.add(segment);
      return null;
    },
  );

  addPart(
    basketGroup,
    {
      id: "basket.rest",
      label: "Typebar rest",
      fn: "Felt rail where idle typebars sleep",
      system: "basket",
      stagger: 0.57,
      offset: { py: -2.6 },
    },
    (group) => {
      group.position.set(BASKET.cx, BASKET.cy - 1.6, BASKET.cz + 1.2);
      const arc = Math.PI * 0.9;
      const rest = new THREE.Mesh(new THREE.TorusGeometry(BASKET.r - 0.8, 0.24, 8, 40, arc), mats.felt);
      rest.rotation.x = Math.PI / 2;
      group.add(rest);
      return null;
    },
  );

  {
    const { action } = addPart(
      root,
      {
        id: "universalBar",
        label: "Universal bar",
        fn: "Every key trips it to free the escapement",
        system: "basket",
        stagger: 0.58,
        offset: { pz: 3.2, py: -1.2 },
        upstream: ["levers"],
        downstream: ["escapement.starWheel"],
      },
      (group) => {
        group.position.set(0, 10.9, 0.3);
        const inner = new THREE.Group();
        group.add(inner);
        const bar = boxMesh(17, 0.32, 0.5, mats.nickel);
        bar.castShadow = true;
        inner.add(bar);
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
        group.position.set(0, 11.7, -3.3);
        const inner = new THREE.Group();
        group.add(inner);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 16), mats.brass);
        wheel.rotation.x = Math.PI / 2;
        inner.add(wheel);
        for (let i = 0; i < 12; i++) {
          const tooth = boxMesh(0.16, 0.34, 0.28, mats.brass);
          const angle = (i / 12) * Math.PI * 2;
          tooth.position.set(Math.cos(angle) * 1, Math.sin(angle) * 1, 0);
          tooth.rotation.z = angle;
          inner.add(tooth);
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
      group.position.set(0, 11.15, -2.6);
      const loose = boxMesh(0.16, 1.1, 0.2, mats.steelDark);
      loose.position.set(-0.35, 0.4, 0);
      loose.rotation.z = 0.35;
      group.add(loose);
      const rigid = boxMesh(0.16, 1.1, 0.2, mats.steelDark);
      rigid.position.set(0.35, 0.4, 0);
      rigid.rotation.z = -0.35;
      group.add(rigid);
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
      group.position.set(2.2, 11.2, -2.7);
      const pawl = boxMesh(0.2, 1.4, 0.22, mats.steelDark);
      pawl.rotation.z = 0.5;
      group.add(pawl);
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
      rackBase.position.set(0, 12.35, -3.05);
      group.add(rackBase);

      for (let i = 0; i < 44; i++) {
        const tooth = boxMesh(0.12, 0.24, 0.32, mats.steelDark);
        tooth.position.set(-10.75 + i * 0.5, 12.18, -3.05);
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

        // Knurled hand wheel with grip ridges
        const knob = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.25, 1.0, 24), mats.keyRim);
        knob.rotation.z = Math.PI / 2;
        knob.castShadow = true;
        group.add(knob);

        // Central brass retention hub
        const brassCap = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.1, 16), mats.brass);
        brassCap.rotation.z = Math.PI / 2;
        group.add(brassCap);
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

  addPart(
    carriageGroup,
    {
      id: "carriage.paperBail",
      label: "Paper bail",
      fn: "Holds the sheet flat against the platen",
      system: "carriage",
      stagger: 0.79,
      offset: { py: 1.6, pz: 1.6 },
      parentId: "carriage.body",
      upstream: [],
      downstream: ["paper.sheet"],
    },
    (group) => {
      // Paper bail crossbar positioned strictly on the OUTSIDE / FRONT (+Z) of the paper sheet
      const paperWidth = 21.0;
      const cy = PLATEN.y;
      const cz = PLATEN.z;
      const bailRadiusOffset = PLATEN.r + 0.36; // 1.9 + 0.36 = 2.26
      const bailY = PLATEN.y + bailRadiusOffset * 0.72; // ~16.22
      const bailZ = -1.48; // Clean +Z clearance on the FRONT of the paper

      group.position.set(0, bailY, bailZ);

      // Polished mirror nickel crossbar
      const barGeom = new THREE.CylinderGeometry(0.08, 0.08, paperWidth + 0.6, 16);
      const bar = new THREE.Mesh(barGeom, mats.nickel);
      bar.rotation.z = Math.PI / 2;
      bar.castShadow = true;
      group.add(bar);

      // Twin black rubber pinch rollers clamping onto the front of the paper
      const rollerRadius = 0.18;
      for (const side of [-1, 1]) {
        const xPos = side * paperWidth * 0.32; // ±6.72
        const rollerGeom = new THREE.CylinderGeometry(rollerRadius, rollerRadius, 0.65, 16);
        const roller = new THREE.Mesh(rollerGeom, mats.rubber);
        roller.position.set(xPos, 0, 0);
        roller.rotation.z = Math.PI / 2;
        roller.castShadow = true;
        group.add(roller);
      }

      // Left & right pivot arms extending from carriage end-plates (platen axle) up to bail bar
      for (const side of [-1, 1]) {
        const armOrigin = new THREE.Vector3(side * 11.2, cy - bailY, cz - bailZ);
        const armTarget = new THREE.Vector3(side * (paperWidth + 0.6) / 2, 0, 0);
        const arm = rodBetween(armOrigin, armTarget, 0.12, mats.nickel);
        arm.castShadow = true;
        group.add(arm);

        // Brass pivot screw cap at platen axle
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 14), mats.brass);
        screw.position.copy(armOrigin);
        screw.rotation.z = Math.PI / 2;
        group.add(screw);
      }

      return null;
    },
  );

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
      carriageGroup,
      {
        id: "carriage.bell",
        label: "Margin bell",
        fn: "Rings six characters before the right margin",
        system: "carriage",
        stagger: 0.82,
        offset: { px: -1.6, py: 1.2 },
        parentId: "carriage.body",
        upstream: ["carriage.body"],
        downstream: [],
      },
      (group) => {
        group.position.set(-9.6, 15.9, -5);
        const inner = new THREE.Group();
        group.add(inner);
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.85, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
          mats.bellMetal,
        );
        dome.castShadow = true;
        inner.add(dome);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.25, 20), mats.steelDark);
        base.position.y = -0.1;
        inner.add(base);
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

      // Single rigid rectangular sheet resting beneath the paper
      const tableGeo = new THREE.BoxGeometry(TABLE_WIDTH, TABLE_LENGTH, 0.1);
      const table = new THREE.Mesh(tableGeo, mats.steelDark);
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

  const SPOOL_Y = 13.2;
  const SPOOL_X = 7.6;
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
        group.position.set(side * SPOOL_X, SPOOL_Y, -1.35);
        const inner = new THREE.Group();
        group.add(inner);
        const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.42, 28), mats.ribbon);
        ribbon.castShadow = true;
        inner.add(ribbon);
        for (const y of [-0.3, 0.3]) {
          const flange = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.08, 28), mats.steelDark);
          flange.position.y = y;
          inner.add(flange);
        }
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1, 10), mats.nickel);
        inner.add(hub);
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
        group.position.set(0, 13.0, -1.52);
        const inner = new THREE.Group();
        group.add(inner);
        const frame = boxMesh(1.8, 1.4, 0.12, mats.nickel);
        frame.position.y = 0.55;
        inner.add(frame);
        const armL = boxMesh(0.18, 1.1, 0.16, mats.nickel);
        armL.position.set(-0.8, 0, 0);
        inner.add(armL);
        const armR = boxMesh(0.18, 1.1, 0.16, mats.nickel);
        armR.position.set(0.8, 0, 0);
        inner.add(armR);
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.55), mats.ribbon);
        strip.position.set(0, 0.55, 0.08);
        inner.add(strip);
        return inner;
      },
    );
    refs.vibratorAction = action!;
  }

  const makeRibbonSide = (): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.55), mats.ribbon);
    mesh.userData.partId = "ribbon.strip";
    root.add(mesh);
    return mesh;
  };
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
  refs.ribbonSideL = makeRibbonSide();
  refs.ribbonSideR = makeRibbonSide();
  refs.ribbonTipL = new THREE.Vector3(-0.8, 13.0, -1.52);
  refs.ribbonTipR = new THREE.Vector3(0.8, 13.0, -1.52);

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
      group.position.set(4.6, 12, -1.3);
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.3, 14), mats.brass);
      group.add(gear);
      for (let i = 0; i < 10; i++) {
        const tooth = boxMesh(0.14, 0.26, 0.26, mats.brass);
        const angle = (i / 10) * Math.PI * 2;
        tooth.position.set(Math.cos(angle) * 0.9, 0, Math.sin(angle) * 0.9);
        group.add(tooth);
      }
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
      group.position.set(-4.6, 12, -1.3);
      const pawl = boxMesh(0.22, 1.6, 0.24, mats.steelDark);
      pawl.rotation.z = -0.4;
      group.add(pawl);
      return null;
    },
  );

  /* -------------------------------- Frame ------------------------------- */

  addPart(
    root,
    {
      id: "frame.chassis",
      label: "Main chassis",
      fn: "Solid cast-iron unified chassis of the typewriter",
      system: "frame",
      stagger: 0.94,
      offset: {},
    },
    (group) => {
      group.position.set(0, 4.8, 0);

      // Heavy contoured base chassis pan
      const basePan = boxMesh(43.5, 2.6, 26.5, mats.enamel);
      basePan.castShadow = true;
      basePan.receiveShadow = true;
      group.add(basePan);

      // Recessed stepped keyboard floor tray
      const tray = boxMesh(38.5, 1.2, 12, mats.enamelPanel);
      tray.position.set(0, 1.2, 6.5);
      tray.castShadow = true;
      group.add(tray);

      // Segment frame cradle
      const cradle = boxMesh(28, 2.2, 8, mats.steelDark);
      cradle.position.set(0, 2.2, -3.5);
      group.add(cradle);
      return null;
    },
  );

  for (const side of [-1, 1]) {
    addPart(
      root,
      {
        id: `frame.sidePanel${side < 0 ? "L" : "R"}`,
        label: side < 0 ? "Left side panel" : "Right side panel",
        fn: "Contoured enamel side fender — opens in cutaway view",
        system: "frame",
        stagger: 0.86,
        offset: { px: side * 6.5, ry: side * 0.35 },
        cutawayFade: true,
      },
      (group) => {
        group.position.set(side * 21.4, 8.8, 0);

        // Die-cast contoured cheek panel
        const panel = boxMesh(1.2, 8.6, 25.8, mats.enamelPanel);
        panel.castShadow = true;
        group.add(panel);

        // Polished nickel accent trim strip
        const trim = boxMesh(0.2, 0.35, 24.5, mats.nickel);
        trim.position.set(side * 0.65, 3.8, 0);
        group.add(trim);
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
      group.position.set(0, 8.8, -12.6);
      const back = boxMesh(43.5, 8.6, 1.2, mats.enamelPanel);
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
      fn: "Sculpted enamel brow and badge plate above keyboard",
      system: "frame",
      stagger: 0.88,
      offset: { pz: 5, py: -1.2 },
      cutawayFade: true,
    },
    (group) => {
      group.position.set(0, 7.8, 12.8);

      // Bevelled front apron
      const brow = boxMesh(41.5, 3.6, 1.2, mats.enamelPanel);
      brow.rotation.x = 0.18;
      brow.castShadow = true;
      group.add(brow);

      // Polished vintage brass badge plate
      const plate = boxMesh(11.5, 1.6, 0.24, mats.brass);
      plate.position.set(0, 0.45, 0.7);
      plate.rotation.x = 0.18;
      group.add(plate);

      const name = new THREE.Mesh(
        new THREE.PlaneGeometry(10.5, 1.2),
        new THREE.MeshBasicMaterial({ map: keycapTexture("THE IMPACT No. 01", ""), transparent: true }),
      );
      name.position.set(0, 0.45, 0.84);
      name.rotation.x = 0.18;
      group.add(name);
      return null;
    },
  );

  for (const side of [-1, 1]) {
    addPart(
      root,
      {
        id: `frame.deckPlate${side < 0 ? "L" : "R"}`,
        label: side < 0 ? "Left deck plate" : "Right deck plate",
        fn: "Top deck plate carrying ribbon spool housing",
        system: "frame",
        stagger: 0.89,
        offset: { py: 3.2, px: side * 2.5 },
        cutawayFade: true,
      },
      (group) => {
        group.position.set(side * 14.6, 12.2, -1);
        const deck = boxMesh(13.8, 0.5, 15.2, mats.enamelPanel);
        deck.castShadow = true;
        deck.receiveShadow = true;
        group.add(deck);

        // Circular spool bezel ring
        const bezel = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.2, 28), mats.nickel);
        bezel.position.set(side * -7.0, 0.35, -0.35);
        group.add(bezel);
        return null;
      },
    );
  }

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
      group.position.set(0, 12.2, -9.4);
      const rear = boxMesh(29.5, 0.5, 6.8, mats.enamelPanel);
      rear.castShadow = true;
      group.add(rear);
      return null;
    },
  );

  // 4 vulcanized dark rubber support feet
  for (const [x, z] of [
    [-18.5, -10.5],
    [18.5, -10.5],
    [-18.5, 10.5],
    [18.5, 10.5],
  ] as const) {
    addPart(
      root,
      {
        id: `frame.foot.${x}.${z}`,
        label: "Rubber support foot",
        fn: "Vulcanized rubber foot isolating vibration from the desk",
        system: "frame",
        stagger: 0.95,
        offset: { py: -2.2 },
      },
      (group) => {
        group.position.set(x, 2.9, z);
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.45, 1.2, 18), mats.rubber);
        foot.castShadow = true;
        group.add(foot);

        const washer = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.15, 18), mats.brass);
        washer.position.y = 0.6;
        group.add(washer);
        return null;
      },
    );
  }

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

  const screwData: Array<{ p: THREE.Vector3; n: THREE.Vector3 }> = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      screwData.push({
        p: new THREE.Vector3(side * 21.85, 5.6 + (i % 4) * 2, -9 + Math.floor(i / 4) * 18),
        n: new THREE.Vector3(side, 0, 0),
      });
    }
  }
  for (let i = 0; i < 6; i++) {
    screwData.push({ p: new THREE.Vector3(-15 + i * 6, 8.6, -13), n: new THREE.Vector3(0, 0, -1) });
    screwData.push({ p: new THREE.Vector3(-15 + i * 6, 7.6, 13.2), n: new THREE.Vector3(0, 0, 1) });
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
      const screwGeometry = new THREE.CylinderGeometry(0.22, 0.22, 0.5, 10);
      const instanced = new THREE.InstancedMesh(screwGeometry, mats.nickel, screwData.length);
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const upAxis = new THREE.Vector3(0, 1, 0);
      screwData.forEach((screw, index) => {
        quaternion.setFromUnitVectors(upAxis, screw.n);
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
