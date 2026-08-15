import { Manuscript } from "../document/Manuscript";
import { PaperTexture } from "../document/PaperTexture";
import { MachineState } from "../machine/machineState";
import { MechanicalAudio, type SoundEvent } from "../audio/MechanicalAudio";

export interface Core {
  manuscript: Manuscript;
  machine: MachineState;
  sound: MechanicalAudio;
  paper: PaperTexture;
  wired: boolean;
}

let core: Core | null = null;

/** Shared application core (one machine per browser tab). */
export function getCore(): Core {
  if (!core) {
    const manuscript = new Manuscript();
    const machine = new MachineState(manuscript);
    const sound = new MechanicalAudio();
    const paper = new PaperTexture(manuscript);
    core = { manuscript, machine, sound, paper, wired: false };
  }
  return core;
}

/** Wires mechanical events to the procedural audio engine (once). */
export function wireAudio({ machine, sound }: Core): void {
  const c = getCore();
  if (c.wired) return;
  c.wired = true;
  const play = (event: SoundEvent, intensity?: number) => sound.play(event, intensity);

  machine.bus.on("keyTravel", ({ kind }) => {
    if (kind === "space") play("space");
    else if (kind === "backspace") play("backspace");
    else play("keyDown");
  });
  machine.bus.on("linkage", () => play("linkage"));
  machine.bus.on("impact", () => play("impact"));
  machine.bus.on("typebarRest", () => play("rest"));
  machine.bus.on("escapement", () => play("escapement"));
  machine.bus.on("bell", () => play("bell"));
  machine.bus.on("clash", () => play("clash"));
  machine.bus.on("shiftChange", ({ engaged }) => play("shift", engaged ? 1 : 0.6));
  machine.bus.on("carriageReturnStart", () => {
    play("returnPull");
    window.setTimeout(() => play("returnFly"), 180);
    window.setTimeout(() => play("ratchet"), 500);
  });
  machine.bus.on("paperFeed", () => {
    play("paperOut");
    window.setTimeout(() => play("paperIn"), 320);
  });
  machine.bus.on("rejected", ({ reason }) => {
    if (reason === "margin") play("bell");
    if (reason === "exploded") play("rest", 0.7);
  });
}
