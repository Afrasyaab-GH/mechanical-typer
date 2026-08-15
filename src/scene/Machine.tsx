import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getCore } from "../app/core";
import { useStore } from "../app/store";
import { buildMachine, CARRIAGE_HOME_X, CARRIAGE_STEP, type Pose } from "../machine/buildMachine";
import { KEYS } from "../machine/keyboardLayout";
import { applyMachineTheme, applyReflectionSettings, buildMaterials } from "./Materials";
import { clearHighlights, highlightPart } from "./partHighlight";
import { setBuild } from "./buildRegistry";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOutCubic = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);

/** Per-part stagger: each system slides in its own 50% window. */
function staggerProgress(value: number, stagger: number): number {
  const offset = stagger * 0.5;
  return clamp01((value - offset) / 0.5);
}

function lerpPose(from: Pose, to: Pose, t: number): Pose {
  if (t <= 0) return { ...from };
  if (t >= 1) return { ...to };
  return {
    px: from.px + (to.px - from.px) * t,
    py: from.py + (to.py - from.py) * t,
    pz: from.pz + (to.pz - from.pz) * t,
    rx: from.rx + (to.rx - from.rx) * t,
    ry: from.ry + (to.ry - from.ry) * t,
    rz: from.rz + (to.rz - from.rz) * t,
  };
}

/** Stretch a plane ribbon segment between two points standing vertically on the Y axis. */
function layRibbonSegment(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
  const direction = to.clone().sub(from);
  const length = direction.length();
  mesh.position.copy(from).addScaledVector(direction, 0.5);
  mesh.scale.set(length, 1, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
}

export function Machine() {
  const core = useMemo(() => getCore(), []);
  const machineTheme = useStore((s) => s.machineTheme);
  const reflectionsEnabled = useStore((s) => s.reflectionsEnabled);
  const reflectionIntensity = useStore((s) => s.reflectionIntensity);
  const materials = useMemo(() => buildMaterials(useStore.getState().machineTheme), []);
  const build = useMemo(() => buildMachine(materials, core.paper), [materials, core.paper]);
  const explodeRef = useRef(0);
  const paperLineRef = useRef(0);
  const screwProgressRef = useRef(-1);

  const selectedPart = useStore((s) => s.selectedPart);
  const trace = useStore((s) => s.trace);
  const feedMode = useStore((s) => s.feedMode);

  useEffect(() => {
    core.paper.setFeedMode(feedMode);
  }, [core.paper, feedMode]);

  useEffect(() => {
    applyMachineTheme(materials, machineTheme);
  }, [materials, machineTheme]);

  useEffect(() => {
    applyReflectionSettings(materials, reflectionsEnabled, reflectionIntensity);
  }, [materials, reflectionsEnabled, reflectionIntensity]);

  useEffect(() => {
    setBuild(build);
    return () => setBuild(null);
  }, [build]);

  // Part highlighting: selection relatives + trace chain
  useEffect(() => {
    clearHighlights(build);
    if (trace) {
      const id = trace.chain[trace.index];
      const part = build.byId.get(id);
      if (part) highlightPart(part, "selected");
      return;
    }
    if (selectedPart) {
      const part = build.byId.get(selectedPart);
      if (part) {
        const related = new Set([...part.upstream, ...part.downstream]);
        for (const candidate of build.parts) {
          if (candidate.id === selectedPart) highlightPart(candidate, "selected");
          else if (related.has(candidate.id)) highlightPart(candidate, "related");
          else highlightPart(candidate, "dim");
        }
      }
    }
    return () => clearHighlights(build);
  }, [selectedPart, trace, build]);

  // Trace advancement clock (2.6s total across the chain)
  useEffect(() => {
    if (!trace) return;
    const interval = window.setInterval(() => useStore.getState().advanceTrace(), 550);
    return () => window.clearInterval(interval);
  }, [trace]);

  useFrame((_, delta) => {
    const { machine, manuscript } = core;
    const state = useStore.getState();
    const deltaMs = Math.min(delta * 1e3, 100);
    machine.timeScale = state.slowMotion ? 0.15 : 1;
    machine.update(deltaMs);

    // --- Explosion easing toward target ---
    const speedFactor = state.motionReduced ? 3 : 1;
    const target = state.explodeTarget;
    let current = explodeRef.current;
    if (current !== target) {
      const step = (deltaMs / 3200) * speedFactor;
      const previous = current;
      current = current < target ? Math.min(target, current + step) : Math.max(target, current - step);
      explodeRef.current = current;
      state.setExplodeCurrent(current);
      if (current > previous) core.sound.play("explodeMove");
      else if (current < previous) core.sound.play("assembleMove");
    }
    machine.setExplode(current);

    if (current > 0 || screwProgressRef.current !== -1) {
      for (const part of build.parts) {
        const progress = easeInOutCubic(staggerProgress(current, part.stagger));
        if (part.id === "hardware.screws") {
          if (Math.abs(progress - screwProgressRef.current) > 0.002 || progress === 0) {
            screwProgressRef.current = progress;
            const instanced = part.partGroup.userData.instanced as THREE.InstancedMesh;
            const screwData = part.partGroup.userData.screwData as Array<{ p: THREE.Vector3; n: THREE.Vector3 }>;
            const matrix = new THREE.Matrix4();
            const quaternion = new THREE.Quaternion();
            const upAxis = new THREE.Vector3(0, 1, 0);
            screwData.forEach((screw, index) => {
              quaternion.setFromUnitVectors(upAxis, screw.n);
              matrix.compose(
                screw.p.clone().addScaledVector(screw.n, 3.2 * progress),
                quaternion,
                new THREE.Vector3(1, 1, 1),
              );
              instanced.setMatrixAt(index, matrix);
            });
            instanced.instanceMatrix.needsUpdate = true;
          }
          continue;
        }
        const pose = lerpPose(part.assembled, part.exploded, progress);
        part.partGroup.position.set(pose.px, pose.py, pose.pz);
        part.partGroup.rotation.set(pose.rx, pose.ry, pose.rz);
      }
      if (current === 0) screwProgressRef.current = -1;
    }

    // --- Keys and levers ---
    for (const def of KEYS) {
      const dip = machine.keyDip(def.code);
      const actions = build.refs.keyActions.get(def.code);
      if (!actions) continue;
      actions.cap.position.y = -dip * 0.32;
      if (actions.lever) actions.lever.rotation.x = -dip * 0.16;
    }

    // --- Typebars ---
    for (let i = 0; i < build.refs.typebarActions.length; i++) {
      const action = build.refs.typebarActions[i];
      if (!action) continue;
      const swing = machine.typebarSwing(i);
      const rest = build.refs.typebarRestAngles[i];
      const strike = build.refs.typebarStrikeAngles[i];
      action.rotation.x = -swing * (rest - strike);
    }

    // --- Basket, vibrator, universal bar ---
    build.refs.basketGroup.position.y = machine.basketShift * 0.85;
    const lift = machine.vibratorLift();
    build.refs.vibratorAction.position.y = lift * 0.65;
    build.refs.vibratorAction.position.z = -lift * 0.18;
    build.refs.universalBarAction.position.y = -machine.universalBarDip() * 0.14;

    // --- Carriage train ---
    build.refs.carriageGroup.position.x = CARRIAGE_HOME_X - machine.carriageCols * CARRIAGE_STEP;
    build.refs.platenAction.rotation.x = machine.platenRotation;
    build.refs.ratchetAction.rotation.x = machine.platenRotation;
    build.refs.escapeWheelAction.rotation.z = -machine.escapeWheelAngle;
    build.refs.spoolL.rotation.y = -machine.spoolAngle;
    build.refs.spoolR.rotation.y = machine.spoolAngle;
    build.refs.returnLeverAction.rotation.x = machine.returnLeverPull * 0.55;
    build.refs.bellAction.scale.setScalar(1 + machine.bellFlash * 0.08);

    // --- Ribbon path ---
    const tipL = build.refs.ribbonTipL;
    const tipR = build.refs.ribbonTipR;
    tipL.set(-0.85, 13.65 + lift * 0.65, -1.12 - lift * 0.08);
    tipR.set(0.85, 13.65 + lift * 0.65, -1.12 - lift * 0.08);
    layRibbonSegment(build.refs.ribbonSideL, new THREE.Vector3(-6.6, 13.35, 0.4), tipL);
    layRibbonSegment(build.refs.ribbonSideR, tipR, new THREE.Vector3(6.6, 13.35, 0.4));

    // --- Upper return guide visibility toggle according to feedMode ---
    if (build.refs.topGuide) {
      build.refs.topGuide.visible = state.feedMode === "scroll";
    }

    // --- Paper scroll easing ---
    const activeGlobalLine =
      state.feedMode === "scroll"
        ? manuscript.cursor.page * 44 + manuscript.cursor.line
        : manuscript.cursor.line;
    paperLineRef.current += (activeGlobalLine - paperLineRef.current) * Math.min(1, deltaMs / 90);
    if (Math.abs(paperLineRef.current - activeGlobalLine) < 0.002) paperLineRef.current = activeGlobalLine;
    build.refs.updatePaper(paperLineRef.current, state.feedMode);

    // --- Cutaway shell fade ---
    const targetOpacity = state.cutaway ? 0.13 : 1;
    if (Math.abs(materials.enamelPanel.opacity - targetOpacity) > 0.01) {
      materials.enamelPanel.transparent = true;
      materials.enamelPanel.opacity +=
        (targetOpacity - materials.enamelPanel.opacity) * Math.min(1, deltaMs / 120);
      materials.enamelPanel.needsUpdate = false;
    }
  });

  return <primitive object={build.root} />;
}
