import { EventBus } from "./events";
import {
  CARRIAGE_RETURN_MS,
  CLASH_DELAY_MS,
  CLASH_WINDOW_MS,
  ESCAPEMENT_MS,
  EXPLODE_LOCK,
  IMPACT_MS,
  LEFT_COL,
  LINKAGE_MS,
  RIBBON_STEP,
  RIGHT_MARGIN,
  TYPEBAR_CYCLE_MS,
} from "./constants";
import {
  IME_TYPEBAR,
  KEY_BY_CODE,
  adjacentTypebars,
  resolveChar,
} from "./keyboardLayout";
import { Manuscript } from "../document/Manuscript";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInQuad = (v: number) => v * v;
const easeOutQuad = (v: number) => 1 - (1 - v) * (1 - v);
const easeInOutQuad = (v: number) => (v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2);

type ActorKind = "char" | "space" | "backspace" | "tab";

interface QueuedPress {
  code: string;
  kind: ActorKind;
  char: string | null;
  typebar: number;
  viaUnicodeAdapter: boolean;
}

interface Actor extends QueuedPress {
  id: number;
  start: number;
  impacted: boolean;
  applied: boolean;
  linked: boolean;
  escaped: boolean;
  rested: boolean;
  clashDelayed: boolean;
}

interface CarriageAnim {
  from: number;
  to: number;
  start: number;
  dur: number;
}

interface ReturnAnim {
  start: number;
  docApplied: boolean;
}

export interface PressOptions {
  repeat?: boolean;
  key?: string;
  shiftKey?: boolean;
  viaAdapter?: boolean;
}

/**
 * The mechanical state machine: keys, actors (in-flight keystrokes),
 * escapement, carriage, basket shift, ribbon feed, carriage return.
 */
export class MachineState {
  manuscript: Manuscript;
  bus = new EventBus();
  now = 0;
  timeScale = 1;
  paused = false;
  actors: Actor[] = [];
  pressed = new Set<string>();
  capsLock = false;
  explode = 0;
  carriageCols = LEFT_COL;
  basketShift = 0;
  platenRotation = 0;
  ribbonAngle = 0;
  ribbonDirection = 1;
  escapeWheelAngle = 0;
  returnLeverPull = 0;
  bellFlash = 0;
  carriageTarget = LEFT_COL;
  carriageAnim: CarriageAnim | null = null;
  returnAnim: ReturnAnim | null = null;
  shiftTarget = 0;
  shiftDownCount = 0;
  private actorId = 1;
  private ribbonCharsSinceReverse = 0;
  private bellFlashUntil = 0;
  escapeWheelTarget = 0;
  private platenBase = 0;
  platenStep = 0.28;

  constructor(manuscript?: Manuscript) {
    this.manuscript = manuscript ?? new Manuscript();
    this.manuscript.bus.on("bell", () => this.ringBell());
    this.manuscript.bus.on("structure", () => {
      this.carriageTarget = this.manuscript.cursor.col;
      this.carriageCols = this.manuscript.cursor.col;
      this.platenBase = this.manuscript.cursor.line * this.platenStep;
      this.platenRotation = this.platenBase;
    });
  }

  get shiftEngaged(): boolean {
    return this.shiftDownCount > 0 || this.capsLock;
  }

  get returnInProgress(): boolean {
    return this.returnAnim !== null;
  }

  get canType(): boolean {
    return this.explode <= EXPLODE_LOCK;
  }

  /** Column the carriage will reach once queued actors complete. */
  projectedCol(): number {
    let col = this.manuscript.cursor.col;
    for (const actor of this.actors) {
      if (actor.impacted || actor.escaped) continue;
      if (actor.kind === "char" || actor.kind === "space") {
        if (col >= RIGHT_MARGIN && this.manuscript.autoReturn) {
          col = 1;
        } else {
          col++;
        }
      } else if (actor.kind === "backspace") {
        col = Math.max(LEFT_COL, col - 1);
      } else if (actor.kind === "tab") {
        if (col >= RIGHT_MARGIN && this.manuscript.autoReturn) col = 0;
        col = Math.min(RIGHT_MARGIN, (Math.floor(col / 8) + 1) * 8);
      }
    }
    return col;
  }

  press(code: string, options: PressOptions = {}): boolean {
    if (options.repeat && code !== "Backspace") return false;
    if (code === "CapsLock") {
      if (this.canType) {
        this.capsLock = !this.capsLock;
        this.bus.emit("shiftChange", { engaged: this.shiftEngaged });
      }
      return this.canType;
    }
    if (!this.canType) {
      this.bus.emit("rejected", { reason: "exploded" });
      return false;
    }
    const def = KEY_BY_CODE[code];
    if (!def) return false;
    this.pressed.add(code);
    switch (def.kind) {
      case "shift":
        this.shiftDownCount++;
        this.bus.emit("shiftChange", { engaged: this.shiftEngaged });
        return true;
      case "space":
        return this.enqueue({ code, kind: "space", char: null, typebar: -1, viaUnicodeAdapter: false });
      case "backspace": {
        const result = this.manuscript.apply({ type: "BACKSPACE", timestamp: this.now });
        if (result.accepted) {
          this.releaseEscapement(-1);
          this.bus.emit("keyTravel", { code, kind: "backspace" });
          this.actors.push({
            id: this.actorId++,
            code,
            kind: "backspace",
            char: null,
            typebar: -1,
            start: this.now,
            impacted: true,
            applied: true,
            linked: true,
            escaped: true,
            rested: false,
            clashDelayed: false,
            viaUnicodeAdapter: false,
          });
        }
        return result.accepted;
      }
      case "tab":
        return this.enqueue({ code, kind: "tab", char: null, typebar: -1, viaUnicodeAdapter: false });
      case "char": {
        let char = resolveChar(def, this.shiftDownCount > 0 || options.shiftKey === true, this.capsLock);
        if (!char) return false;
        const key = options.key;
        if (key && key.length === 1 && key !== char && (key === def.lower || key === def.upper)) char = key;
        return this.enqueue({
          code,
          kind: "char",
          char,
          typebar: def.typebar,
          viaUnicodeAdapter: options.viaAdapter === true,
        });
      }
    }
  }

  /** Routes committed Unicode text through the IME typebar. */
  pressUnicode(text: string): boolean {
    if (!this.canType) {
      this.bus.emit("rejected", { reason: "exploded" });
      return false;
    }
    let accepted = false;
    for (const char of text) {
      if (char === "\n") {
        this.carriageReturn();
        continue;
      }
      if (char === " ") {
        accepted =
          this.enqueue({ code: "Space", kind: "space", char: null, typebar: -1, viaUnicodeAdapter: true }) ||
          accepted;
        continue;
      }
      accepted =
        this.enqueue({ code: "IME", kind: "char", char, typebar: IME_TYPEBAR, viaUnicodeAdapter: true }) ||
        accepted;
    }
    return accepted;
  }

  release(code: string): void {
    this.pressed.delete(code);
    const def = KEY_BY_CODE[code];
    if (def?.kind === "shift") {
      this.shiftDownCount = Math.max(0, this.shiftDownCount - 1);
      this.bus.emit("shiftChange", { engaged: this.shiftEngaged });
    }
  }

  releaseAll(): void {
    this.pressed.clear();
    if (this.shiftDownCount > 0) {
      this.shiftDownCount = 0;
      this.bus.emit("shiftChange", { engaged: this.shiftEngaged });
    }
  }

  carriageReturn(): boolean {
    if (!this.canType) {
      this.bus.emit("rejected", { reason: "exploded" });
      return false;
    }
    if (this.returnAnim) return false;
    this.returnAnim = { start: this.now, docApplied: false };
    this.bus.emit("carriageReturnStart", {});
    return true;
  }

  newSheet(): boolean {
    const result = this.manuscript.apply({ type: "NEW_SHEET", timestamp: this.now });
    if (result.accepted) this.bus.emit("paperFeed", {});
    return result.accepted;
  }

  setExplode(value: number): void {
    this.explode = value;
  }

  private enqueue(press: QueuedPress): boolean {
    if (press.kind === "char" || press.kind === "space") {
      if (this.manuscript.pageFull) {
        this.bus.emit("rejected", { reason: "pageFull" });
        return false;
      }
      if (this.projectedCol() >= RIGHT_MARGIN && !this.manuscript.autoReturn) {
        this.bus.emit("rejected", { reason: "margin" });
        this.ringBell();
        return false;
      }
    }

    let start = this.now;
    if (this.returnAnim) start = this.returnAnim.start + CARRIAGE_RETURN_MS;

    // Typebar clash: same or adjacent typebar inside the collision window
    // delays the later strike.
    let clash = false;
    if (press.typebar >= 0) {
      for (let attempt = 0; attempt < 4; attempt++) {
        let moved = false;
        for (const other of this.actors) {
          if (other.typebar < 0) continue;
          const same = other.typebar === press.typebar;
          const adjacent = !same && adjacentTypebars(press.typebar).includes(other.typebar);
          if (!same && !adjacent) continue;
          if (start < other.start + CLASH_WINDOW_MS && start + CLASH_WINDOW_MS > other.start) {
            const delayed = other.start + CLASH_DELAY_MS;
            if (delayed > start) {
              start = delayed;
              moved = true;
              clash = true;
            }
          }
        }
        if (!moved) break;
      }
    }

    const actor: Actor = {
      id: this.actorId++,
      code: press.code,
      kind: press.kind,
      char: press.char,
      typebar: press.typebar,
      start,
      impacted: false,
      applied: false,
      linked: false,
      escaped: false,
      rested: false,
      clashDelayed: clash,
      viaUnicodeAdapter: press.viaUnicodeAdapter,
    };
    this.actors.push(actor);
    if (clash) this.bus.emit("clash", { code: press.code, delayMs: CLASH_DELAY_MS });
    if (start <= this.now) this.bus.emit("keyTravel", { code: press.code, kind: press.kind });
    return true;
  }

  ringBell(): void {
    this.bellFlashUntil = this.now + 600;
    this.bus.emit("bell", {});
  }

  update(deltaMs: number): void {
    if (this.paused) return;
    const dt = Math.min(deltaMs, 100) * this.timeScale;
    this.now += dt;

    // --- Carriage return sequence (~720ms) ---
    if (this.returnAnim) {
      const progress = clamp01((this.now - this.returnAnim.start) / CARRIAGE_RETURN_MS);
      this.returnLeverPull =
        progress < 0.25
          ? easeOutQuad(progress / 0.25)
          : progress > 0.55
            ? Math.max(0, 1 - (progress - 0.55) / 0.3)
            : 1;
      if (progress >= 0.2 && progress < 0.7) {
        const fly = easeInOutQuad((progress - 0.2) / 0.5);
        this.carriageCols = this.carriageTarget + (LEFT_COL - this.carriageTarget) * fly;
      }
      if (progress >= 0.6 && progress < 1) {
        const roll = easeOutQuad((progress - 0.6) / 0.4);
        this.platenRotation = this.platenBase + roll * this.platenStep;
      }
      if (progress >= 0.65 && !this.returnAnim.docApplied) {
        this.returnAnim.docApplied = true;
        const result = this.manuscript.apply({ type: "CARRIAGE_RETURN", timestamp: this.now });
        this.carriageTarget = LEFT_COL;
        this.carriageCols = LEFT_COL;
        this.platenBase += this.platenStep;
        if (result.blockedByPageFull) this.platenBase -= this.platenStep;
      }
      if (progress >= 1) {
        this.returnLeverPull = 0;
        this.returnAnim = null;
        this.bus.emit("carriageReturnDone", { pageFull: this.manuscript.pageFull });
      }
    }

    // --- Actor timeline ---
    for (const actor of this.actors) {
      const elapsed = this.now - actor.start;
      if (elapsed < 0) continue;
      if (!actor.linked && elapsed >= LINKAGE_MS && actor.typebar >= 0) {
        actor.linked = true;
        this.bus.emit("linkage", { code: actor.code, typebar: actor.typebar });
      }
      if (!actor.impacted && elapsed >= IMPACT_MS) {
        actor.impacted = true;
        this.onImpact(actor);
      }
      if (!actor.escaped && elapsed >= ESCAPEMENT_MS) {
        actor.escaped = true;
        this.onEscape(actor);
      }
      if (!actor.rested && elapsed >= TYPEBAR_CYCLE_MS) {
        actor.rested = true;
        if (actor.typebar >= 0) this.bus.emit("typebarRest", { code: actor.code, typebar: actor.typebar });
      }
    }
    if (this.actors.length > 64 || (this.actors.length > 0 && this.actors[0].rested)) {
      this.actors = this.actors.filter((a) => !a.rested || this.now - a.start < TYPEBAR_CYCLE_MS + 400);
    }

    // --- Basket shift easing (~120ms) ---
    this.shiftTarget = this.shiftEngaged ? 1 : 0;
    const shiftRate = dt / 120;
    if (this.basketShift < this.shiftTarget) {
      this.basketShift = Math.min(this.shiftTarget, this.basketShift + shiftRate);
    } else if (this.basketShift > this.shiftTarget) {
      this.basketShift = Math.max(this.shiftTarget, this.basketShift - shiftRate);
    }

    // --- One-cell carriage movement ---
    if (this.carriageAnim) {
      const progress = clamp01((this.now - this.carriageAnim.start) / this.carriageAnim.dur);
      this.carriageCols =
        this.carriageAnim.from + (this.carriageAnim.to - this.carriageAnim.from) * easeOutQuad(progress);
      if (progress >= 1) this.carriageAnim = null;
    }

    this.escapeWheelAngle +=
      (this.escapeWheelTarget - this.escapeWheelAngle) * Math.min(1, dt / 60);
    this.bellFlash = this.now < this.bellFlashUntil ? 1 : Math.max(0, this.bellFlash - dt / 300);
  }

  private onImpact(actor: Actor): void {
    if (actor.kind === "char" && actor.char !== null) {
      const result = this.manuscript.apply({
        type: "TYPE_CHAR",
        char: actor.char,
        code: actor.code,
        timestamp: this.now,
        viaUnicodeAdapter: actor.viaUnicodeAdapter,
      });
      actor.applied = result.accepted;
      if (result.accepted) {
        if (result.autoReturned) {
          this.platenBase += this.platenStep;
          this.platenRotation = this.platenBase;
          this.carriageTarget = 0;
          this.carriageAnim = { from: this.carriageCols, to: 0, start: this.now, dur: 180 };
          this.bus.emit("carriageReturnStart", {});
          this.bus.emit("carriageReturnDone", { pageFull: this.manuscript.pageFull });
        }
        this.bus.emit("impact", {
          char: actor.char,
          code: actor.code,
          typebar: actor.typebar,
          viaUnicodeAdapter: actor.viaUnicodeAdapter,
        });
      } else if (result.blockedByMargin) {
        this.bus.emit("rejected", { reason: "margin" });
      } else if (result.blockedByPageFull) {
        this.bus.emit("rejected", { reason: "pageFull" });
      }
    } else if (actor.kind === "space") {
      const result = this.manuscript.apply({ type: "SPACE", timestamp: this.now });
      actor.applied = result.accepted;
      if (result.accepted) {
        if (result.autoReturned) {
          this.platenBase += this.platenStep;
          this.platenRotation = this.platenBase;
          this.carriageTarget = 0;
          this.carriageAnim = { from: this.carriageCols, to: 0, start: this.now, dur: 180 };
          this.bus.emit("carriageReturnStart", {});
          this.bus.emit("carriageReturnDone", { pageFull: this.manuscript.pageFull });
        }
      } else if (result.blockedByMargin) {
        this.bus.emit("rejected", { reason: "margin" });
      }
    }
  }

  private onEscape(actor: Actor): void {
    switch (actor.kind) {
      case "char":
        if (actor.applied) this.releaseEscapement(1);
        break;
      case "space":
        if (actor.applied) this.releaseEscapement(1);
        break;
      case "backspace":
        break;
      case "tab": {
        const before = this.manuscript.cursor.col;
        if (this.manuscript.apply({ type: "TAB", timestamp: this.now }).accepted) {
          this.releaseEscapement(this.manuscript.cursor.col - before);
        }
        break;
      }
    }
  }

  private releaseEscapement(teeth: number): void {
    if (teeth === 0) return;
    this.bus.emit("escapement", { kind: teeth > 0 ? "char" : "backspace" });
    this.escapeWheelTarget += teeth * 0.35;
    const from = this.carriageCols;
    const to = Math.max(LEFT_COL, Math.min(RIGHT_MARGIN, this.manuscript.cursor.col));
    this.carriageTarget = to;
    this.carriageAnim = { from, to, start: this.now, dur: 90 };
    if (teeth > 0) {
      this.ribbonAngle += RIBBON_STEP * this.ribbonDirection;
      this.ribbonCharsSinceReverse++;
      if (this.ribbonCharsSinceReverse > 900) {
        this.ribbonDirection *= -1;
        this.ribbonCharsSinceReverse = 0;
      }
    }
  }

  /** Keycap depression curve: 0–35ms down, held to 115ms, returned by 210ms. */
  keyDip(code: string): number {
    let dip = 0;
    for (const actor of this.actors) {
      if (actor.code !== code) continue;
      const elapsed = this.now - actor.start;
      if (elapsed < 0) continue;
      let value: number;
      if (elapsed < 35) value = easeOutQuad(elapsed / 35);
      else if (elapsed < 115) value = 1;
      else if (elapsed < 210) value = 1 - easeInOutQuad((elapsed - 115) / 95);
      else value = 0;
      dip = Math.max(dip, value);
    }
    return dip;
  }

  /** Typebar swing: rises 20–100ms, contacts 100–115ms, returns by 210ms. */
  typebarSwing(typebar: number): number {
    let swing = 0;
    for (const actor of this.actors) {
      if (actor.typebar !== typebar) continue;
      const elapsed = this.now - actor.start;
      if (elapsed < 20) continue;
      let value: number;
      if (elapsed < 100) value = easeInQuad((elapsed - 20) / 80) * 1.08;
      else if (elapsed < 115) value = 1.08 - 0.08 * easeOutQuad((elapsed - 100) / 15);
      else if (elapsed < 210) value = 1 - easeInOutQuad((elapsed - 115) / 95);
      else value = 0;
      swing = Math.max(swing, value);
    }
    return swing;
  }

  /** Ribbon vibrator lift: starts 55ms, holds 100–130ms, drops by 175ms. */
  vibratorLift(): number {
    let lift = 0;
    for (const actor of this.actors) {
      if (actor.typebar < 0) continue;
      const elapsed = this.now - actor.start;
      let value = 0;
      if (elapsed >= 55 && elapsed < 100) value = easeOutQuad((elapsed - 55) / 45);
      else if (elapsed >= 100 && elapsed < 130) value = 1;
      else if (elapsed >= 130 && elapsed < 175) value = 1 - easeInQuad((elapsed - 130) / 45);
      lift = Math.max(lift, value);
    }
    return lift;
  }

  universalBarDip(): number {
    let dip = 0;
    for (const actor of this.actors) {
      const elapsed = this.now - actor.start;
      if (elapsed >= 30 && elapsed < 120) dip = 1;
    }
    return dip;
  }

  get spoolAngle(): number {
    return this.ribbonAngle * (0.05 / RIBBON_STEP);
  }

  get jamActive(): boolean {
    const now = this.now;
    return this.actors.some((a) => a.clashDelayed && now - a.start < 200);
  }
}
