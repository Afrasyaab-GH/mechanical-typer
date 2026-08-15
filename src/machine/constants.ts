/** Manuscript document rules. */
export const COLS = 72; // monospaced cells per line
export const LINES = 44; // lines per page
export const LEFT_COL = 0; // initial / home column
export const RIGHT_MARGIN = 72; // right margin column
export const BELL_COL = 66; // margin bell rings here (6 before margin)

/** Mechanical animation timing (ms). */
export const IMPACT_MS = 45; // snappy type slug impact after keystroke
export const TYPEBAR_CYCLE_MS = 110; // full typebar rise + return
export const CARRIAGE_RETURN_MS = 620; // complete carriage return
export const CLASH_WINDOW_MS = 20; // typebar collision window
export const CLASH_DELAY_MS = 35; // stagger applied after a clash
export const LINKAGE_MS = 10; // link-rod pull event
export const ESCAPEMENT_MS = 55; // escapement release event
export const CARRIAGE_STEP_MS = 60; // one-cell carriage movement

/** Ribbon feed. */
export const RIBBON_STEP = 0.011; // ribbon advance per character (rad)
export const SPOOL_RATIO = 0.05 / 0.011; // spool angle per ribbon angle

/** Exploded view threshold above which typing is disabled. */
export const EXPLODE_LOCK = 0.08;

/** Typography. */
export const FONT_FAMILY = "Courier Prime";
export const FONT_FALLBACKS = ["Courier New", "Liberation Mono", "monospace"];

/** Paper CanvasTexture geometry (300 DPI A4: 2480 x 3508). */
export const PAPER = {
  W: 2480,
  H: 3508,
  MARGIN_X: 240,
  MARGIN_TOP: 260,
  FONT_PX: 50,
  get TEXT_W() {
    return this.W - this.MARGIN_X * 2;
  },
  get TEXT_H() {
    return this.H - this.MARGIN_TOP * 2;
  },
  get CELL_W() {
    return this.TEXT_W / COLS;
  },
  get LINE_H() {
    return this.TEXT_H / LINES;
  },
} as const;

/** Local storage key for the on-device draft. */
export const DRAFT_KEY = "impact-no-01-draft";

/** Deterministic hash for glyph variation (FNV-1a + murmur finalizer). */
export function hashSeed(...values: number[]): number {
  let h = 2166136261;
  for (const v of values) {
    h ^= v >>> 0 & 65535;
    h = Math.imul(h, 16777619);
    h ^= (v >>> 16) & 65535;
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 1540483477);
  h ^= h >>> 15;
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry-ish) from a 32-bit seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 1831565813) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Per-glyph deterministic variation. */
export function glyphVariation(
  page: number,
  line: number,
  col: number,
  char: string,
  strike: number,
): { inkOpacity: number; xJitter: number; yJitter: number; variant: number } {
  const rand = seededRandom(hashSeed(page, line, col, char.charCodeAt(0), strike));
  return {
    inkOpacity: 0.88 + rand() * 0.12,
    xJitter: (rand() - 0.5) * 0.8,
    yJitter: (rand() - 0.5) * 0.8,
    variant: Math.floor(rand() * 6),
  };
}
