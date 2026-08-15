import type { MachineBuild } from "../machine/buildMachine";

/** Shared reference to the assembled machine (set once at scene creation). */
let current: MachineBuild | null = null;

export function setBuild(build: MachineBuild | null): void {
  current = build;
}

export function getBuild(): MachineBuild | null {
  return current;
}
