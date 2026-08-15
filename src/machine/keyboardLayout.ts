export type KeyKind = "char" | "space" | "backspace" | "tab" | "shift";

export interface KeyDef {
  code: string;
  kind: KeyKind;
  lower: string | null;
  upper: string | null;
  labelTop: string;
  labelBottom: string;
  /** Index into the typebar basket, -1 for non-character keys. */
  typebar: number;
  row: number;
  col: number;
  w: number;
}

type RawKey = [code: string, lower: string, upper: string, row: number, col: number];

/** The historical mechanical layout: four rows of character keys. */
const CHARACTER_ROWS: RawKey[] = [
  ["Digit1", "1", "!", 0, 0],
  ["Digit2", "2", '"', 0, 1],
  ["Digit3", "3", "#", 0, 2],
  ["Digit4", "4", "$", 0, 3],
  ["Digit5", "5", "%", 0, 4],
  ["Digit6", "6", "&", 0, 5],
  ["Digit7", "7", "'", 0, 6],
  ["Digit8", "8", "(", 0, 7],
  ["Digit9", "9", ")", 0, 8],
  ["Digit0", "0", "0", 0, 9],
  ["Minus", "-", "_", 0, 10],
  ["Equal", "=", "+", 0, 11],
  ["KeyQ", "q", "Q", 1, 1.6],
  ["KeyW", "w", "W", 1, 2.6],
  ["KeyE", "e", "E", 1, 3.6],
  ["KeyR", "r", "R", 1, 4.6],
  ["KeyT", "t", "T", 1, 5.6],
  ["KeyY", "y", "Y", 1, 6.6],
  ["KeyU", "u", "U", 1, 7.6],
  ["KeyI", "i", "I", 1, 8.6],
  ["KeyO", "o", "O", 1, 9.6],
  ["KeyP", "p", "P", 1, 10.6],
  ["KeyA", "a", "A", 2, 1.9],
  ["KeyS", "s", "S", 2, 2.9],
  ["KeyD", "d", "D", 2, 3.9],
  ["KeyF", "f", "F", 2, 4.9],
  ["KeyG", "g", "G", 2, 5.9],
  ["KeyH", "h", "H", 2, 6.9],
  ["KeyJ", "j", "J", 2, 7.9],
  ["KeyK", "k", "K", 2, 8.9],
  ["KeyL", "l", "L", 2, 9.9],
  ["Semicolon", ";", ":", 2, 10.9],
  ["Quote", "'", '"', 2, 11.9],
  ["KeyZ", "z", "Z", 3, 2.4],
  ["KeyX", "x", "X", 3, 3.4],
  ["KeyC", "c", "C", 3, 4.4],
  ["KeyV", "v", "V", 3, 5.4],
  ["KeyB", "b", "B", 3, 6.4],
  ["KeyN", "n", "N", 3, 7.4],
  ["KeyM", "m", "M", 3, 8.4],
  ["Comma", ",", "<", 3, 9.4],
  ["Period", ".", ">", 3, 10.4],
  ["Slash", "/", "?", 3, 11.4],
];

export const KEYS: KeyDef[] = [];
export const KEY_BY_CODE: Record<string, KeyDef> = {};

let typebarCount = 0;
for (const [code, lower, upper, row, col] of CHARACTER_ROWS) {
  const def: KeyDef = {
    code,
    kind: "char",
    lower,
    upper,
    labelTop: upper,
    labelBottom: lower,
    typebar: typebarCount++,
    row,
    col,
    w: 1,
  };
  KEYS.push(def);
  KEY_BY_CODE[code] = def;
}

function addSpecial(
  code: string,
  kind: KeyKind,
  labelTop: string,
  labelBottom: string,
  row: number,
  col: number,
  w: number,
): KeyDef {
  const def: KeyDef = {
    code,
    kind,
    lower: null,
    upper: null,
    labelTop,
    labelBottom,
    typebar: -1,
    row,
    col,
    w,
  };
  KEYS.push(def);
  KEY_BY_CODE[code] = def;
  return def;
}

addSpecial("Backspace", "backspace", "BACK", "SPACE", 0, 12.4, 2.1);
addSpecial("Tab", "tab", "TAB", "", 1, 0, 1.4);
addSpecial("ShiftLeft", "shift", "SHIFT", "", 3, 0, 2.2);
addSpecial("ShiftRight", "shift", "SHIFT", "", 3, 12.6, 2.2);
addSpecial("Space", "space", "", "", 4, 3.4, 7.2);

/** Number of mechanical typebars (one per character key). */
export const TYPEBAR_COUNT = typebarCount;
/** The extra fictional typebar reserved for the Unicode adapter. */
export const IME_TYPEBAR = TYPEBAR_COUNT;

/** Resolves the printable character for a key press. */
export function resolveChar(def: KeyDef, shiftDown: boolean, capsLock: boolean): string | null {
  if (def.kind !== "char" || def.lower === null) return null;
  const isLetter = def.lower >= "a" && def.lower <= "z";
  const shifted = isLetter ? shiftDown !== capsLock : shiftDown;
  return shifted ? def.upper : def.lower;
}

/** Adjacent typebars (for clash detection). */
export function adjacentTypebars(index: number): number[] {
  const result: number[] = [];
  if (index > 0) result.push(index - 1);
  if (index < TYPEBAR_COUNT - 1) result.push(index + 1);
  return result;
}

/** The highlight chain for FOLLOW THE KEYSTROKE. */
export function traceChainFor(code: string): string[] {
  const def = KEY_BY_CODE[code];
  if (!def) return [];
  switch (def.kind) {
    case "char":
      return [
        `key.${code}`,
        `lever.${code}`,
        `link.${code}`,
        `typebar.${def.typebar}`,
        "vibrator",
        "platen",
        "escapement.starWheel",
        "carriage.body",
      ];
    case "space":
      return [`key.${code}`, `lever.${code}`, "universalBar", "escapement.starWheel", "carriage.body"];
    case "backspace":
      return [
        `key.${code}`,
        `lever.${code}`,
        "escapement.backspacePawl",
        "escapement.starWheel",
        "carriage.body",
      ];
    case "shift":
      return [
        `key.${code}`,
        `lever.${code}`,
        code === "ShiftLeft" ? "shift.rodL" : "shift.rodR",
        "basket.segment",
      ];
    case "tab":
      return [`key.${code}`, `lever.${code}`, "escapement.starWheel", "carriage.body"];
  }
}
