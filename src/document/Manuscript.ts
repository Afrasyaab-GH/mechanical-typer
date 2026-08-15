import { EventBus } from "../machine/events";
import {
  BELL_COL,
  COLS,
  LEFT_COL,
  LINES,
  RIGHT_MARGIN,
  glyphVariation,
} from "../machine/constants";

export interface Glyph {
  char: string;
  code: string;
  page: number;
  line: number;
  col: number;
  timestamp: number;
  inkOpacity: number;
  xJitter: number;
  yJitter: number;
  overstrikeCount: number;
  history: string[];
  viaUnicodeAdapter: boolean;
}

export interface Cursor {
  page: number;
  line: number;
  col: number;
}

export type EditAction =
  | { type: "TYPE_CHAR"; char: string; code: string; timestamp: number; viaUnicodeAdapter?: boolean }
  | { type: "SPACE"; timestamp: number }
  | { type: "TAB"; timestamp: number }
  | { type: "BACKSPACE"; timestamp: number }
  | { type: "CARRIAGE_RETURN"; timestamp: number }
  | { type: "NEW_SHEET"; timestamp: number };

export interface EditResult {
  accepted: boolean;
  blockedByMargin?: boolean;
  blockedByPageFull?: boolean;
  pageFull?: boolean;
  bell?: boolean;
  autoReturned?: boolean;
}

type UndoEntry =
  | { kind: "glyph"; cursorBefore: Cursor; before: Glyph | null; after: Glyph }
  | { kind: "cursor"; cursorBefore: Cursor; cursorAfter: Cursor }
  | { kind: "sheet"; cursorBefore: Cursor; pageAdded: number };

export interface ManuscriptJSON {
  pages: Glyph[][][];
  cursor: Cursor;
  pageFull: boolean;
  version?: number;
}

/**
 * The mechanical document: 44 lines per page, 72 cells per line.
 * Backspace moves the carriage but never erases ink; typing into an
 * occupied cell creates an overstrike.
 */
export class Manuscript {
  pages: Glyph[][][] = [Array.from({ length: LINES }, () => [])];
  cursor: Cursor = { page: 0, line: 0, col: LEFT_COL };
  pageFull = false;
  autoReturn = false;
  autoNextPage = true;
  bus = new EventBus();
  undoStack: UndoEntry[] = [];
  redoStack: UndoEntry[] = [];
  private strikeCounter = 0;

  glyphAt(page: number, line: number, col: number): Glyph | null {
    const row = this.pages[page]?.[line];
    if (!row) return null;
    for (const glyph of row) if (glyph.col === col) return glyph;
    return null;
  }

  lineText(page: number, line: number): string {
    const cells = new Array<string>(COLS).fill(" ");
    for (const glyph of this.pages[page]?.[line] ?? []) cells[glyph.col] = glyph.char;
    return cells.join("").replace(/\s+$/u, "");
  }

  pageText(page: number): string {
    const lines: string[] = [];
    const rows = this.pages[page] ?? [];
    for (let i = 0; i < rows.length; i++) lines.push(this.lineText(page, i));
    return lines.join("\n").replace(/\n+$/u, "");
  }

  getText(): string {
    return this.pages.map((_, page) => this.pageText(page)).join("\f");
  }

  get charCount(): number {
    let count = 0;
    for (const page of this.pages) for (const line of page) count += line.length;
    return count;
  }

  get wordCount(): number {
    const text = this.getText().replace(/\f/g, " ").trim();
    return text ? text.split(/\s+/u).length : 0;
  }

  get isEmpty(): boolean {
    return (
      this.charCount === 0 &&
      this.cursor.page === 0 &&
      this.cursor.line === 0 &&
      this.cursor.col === 0
    );
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  apply(action: EditAction): EditResult {
    switch (action.type) {
      case "TYPE_CHAR":
        return this.typeChar(action.char, action.code, action.timestamp, action.viaUnicodeAdapter === true);
      case "SPACE":
        return this.advanceCursor(1);
      case "TAB": {
        const target = Math.min(RIGHT_MARGIN, (Math.floor(this.cursor.col / 8) + 1) * 8);
        return this.advanceCursor(target - this.cursor.col);
      }
      case "BACKSPACE":
        return this.backspace();
      case "CARRIAGE_RETURN":
        return this.carriageReturn();
      case "NEW_SHEET":
        return this.newSheet();
    }
  }

  private typeChar(char: string, code: string, timestamp: number, viaUnicodeAdapter: boolean): EditResult {
    if (this.pageFull) {
      if (this.autoNextPage) {
        this.newSheet();
        return this.typeChar(char, code, timestamp, viaUnicodeAdapter);
      }
      this.bus.emit("rejected", { reason: "pageFull" });
      return { accepted: false, blockedByPageFull: true };
    }
    if (this.cursor.col >= RIGHT_MARGIN) {
      if (this.autoReturn) {
        const returned = this.carriageReturn();
        if (!returned.accepted) return returned;
        const result = this.typeChar(char, code, timestamp, viaUnicodeAdapter);
        result.autoReturned = true;
        return result;
      }
      this.bus.emit("rejected", { reason: "margin" });
      return { accepted: false, blockedByMargin: true };
    }

    const { page, line, col } = this.cursor;
    const variation = glyphVariation(page, line, col, char, this.strikeCounter++);
    const existing = this.glyphAt(page, line, col);
    let glyph: Glyph;

    if (existing) {
      const overstrikeCount = existing.overstrikeCount + 1;
      glyph = {
        ...existing,
        char,
        code,
        timestamp,
        overstrikeCount,
        history: [...existing.history, existing.char],
        inkOpacity: Math.min(1, Math.max(existing.inkOpacity, variation.inkOpacity) + 0.06 * overstrikeCount),
        xJitter: existing.xJitter + variation.xJitter * (0.5 + 0.5 * overstrikeCount),
        yJitter: existing.yJitter + variation.yJitter * (0.5 + 0.5 * overstrikeCount),
        viaUnicodeAdapter,
      };
      const row = this.pages[page][line];
      row[row.indexOf(existing)] = glyph;
    } else {
      glyph = {
        char,
        code,
        page,
        line,
        col,
        timestamp,
        inkOpacity: variation.inkOpacity,
        xJitter: variation.xJitter,
        yJitter: variation.yJitter,
        overstrikeCount: 0,
        history: [],
        viaUnicodeAdapter,
      };
      const row = this.pages[page][line];
      let index = 0;
      while (index < row.length && row[index].col < col) index++;
      row.splice(index, 0, glyph);
    }

    const cursorBefore = { ...this.cursor };
    this.undoStack.push({ kind: "glyph", cursorBefore, before: existing, after: glyph });
    this.redoStack.length = 0;
    const bell = this.cursor.col === BELL_COL - 1;
    this.cursor.col++;
    this.bus.emit("changed", { page });
    if (bell) this.bus.emit("bell", {});
    return { accepted: true, bell };
  }

  private advanceCursor(amount: number): EditResult {
    if (this.pageFull) {
      if (this.autoNextPage) {
        this.newSheet();
        return this.advanceCursor(amount);
      }
      this.bus.emit("rejected", { reason: "pageFull" });
      return { accepted: false, blockedByPageFull: true };
    }
    if (amount <= 0) return { accepted: false };
    if (this.cursor.col >= RIGHT_MARGIN) {
      if (this.autoReturn) {
        const result = this.carriageReturn();
        if (result.accepted) {
          result.autoReturned = true;
          this.advanceCursor(amount);
        }
        return result;
      }
      this.bus.emit("rejected", { reason: "margin" });
      return { accepted: false, blockedByMargin: true };
    }
    const cursorBefore = { ...this.cursor };
    const bell = this.cursor.col < BELL_COL && this.cursor.col + amount >= BELL_COL;
    this.cursor.col = Math.min(RIGHT_MARGIN, this.cursor.col + amount);
    this.undoStack.push({ kind: "cursor", cursorBefore, cursorAfter: { ...this.cursor } });
    this.redoStack.length = 0;
    this.bus.emit("changed", { page: this.cursor.page });
    if (bell) this.bus.emit("bell", {});
    return { accepted: true, bell };
  }

  private backspace(): EditResult {
    if (this.pageFull) return { accepted: false, blockedByPageFull: true };
    const page = this.cursor.page;
    const line = this.cursor.line;
    const row = this.pages[page]?.[line] ?? [];

    if (this.cursor.col > LEFT_COL) {
      const cursorBefore = { ...this.cursor };
      const targetCol = this.cursor.col - 1;
      const glyphIndex = row.findIndex((g) => g.col === targetCol);
      let deletedGlyph: Glyph | null = null;
      if (glyphIndex !== -1) {
        deletedGlyph = row.splice(glyphIndex, 1)[0];
      }
      this.cursor.col = targetCol;
      if (deletedGlyph) {
        this.undoStack.push({ kind: "glyph", cursorBefore, before: deletedGlyph, after: deletedGlyph });
      } else {
        this.undoStack.push({ kind: "cursor", cursorBefore, cursorAfter: { ...this.cursor } });
      }
      this.redoStack.length = 0;
      this.bus.emit("changed", { page });
      return { accepted: true };
    } else if (this.cursor.col <= LEFT_COL && this.cursor.line > 0) {
      const cursorBefore = { ...this.cursor };
      this.cursor.line--;
      const prevRow = this.pages[page]?.[this.cursor.line] ?? [];
      if (prevRow.length > 0) {
        const lastGlyph = prevRow[prevRow.length - 1];
        this.cursor.col = Math.min(RIGHT_MARGIN, lastGlyph.col + 1);
      } else {
        this.cursor.col = LEFT_COL;
      }
      this.undoStack.push({ kind: "cursor", cursorBefore, cursorAfter: { ...this.cursor } });
      this.redoStack.length = 0;
      this.bus.emit("changed", { page });
      return { accepted: true };
    }

    return { accepted: false };
  }

  private carriageReturn(): EditResult {
    if (this.pageFull) {
      if (this.autoNextPage) {
        this.newSheet();
        return { accepted: true };
      }
      this.bus.emit("rejected", { reason: "pageFull" });
      return { accepted: false, blockedByPageFull: true };
    }
    const cursorBefore = { ...this.cursor };
    if (this.cursor.line >= LINES - 1) {
      if (this.autoNextPage) {
        this.newSheet();
        return { accepted: true };
      }
      this.pageFull = true;
      this.bus.emit("rejected", { reason: "pageFull" });
      return { accepted: false, blockedByPageFull: true, pageFull: true };
    }
    this.cursor.line++;
    this.cursor.col = LEFT_COL;
    this.undoStack.push({ kind: "cursor", cursorBefore, cursorAfter: { ...this.cursor } });
    this.redoStack.length = 0;
    this.bus.emit("changed", { page: this.cursor.page });
    return { accepted: true };
  }

  private newSheet(): EditResult {
    const cursorBefore = { ...this.cursor };
    this.pages.push(Array.from({ length: LINES }, () => []));
    this.cursor = { page: this.pages.length - 1, line: 0, col: LEFT_COL };
    this.pageFull = false;
    this.undoStack.push({ kind: "sheet", cursorBefore, pageAdded: this.cursor.page });
    this.redoStack.length = 0;
    this.bus.emit("structure", {});
    return { accepted: true };
  }

  prevPage(): boolean {
    if (this.cursor.page > 0) {
      this.cursor.page--;
      this.cursor.line = 0;
      this.cursor.col = LEFT_COL;
      this.pageFull = false;
      this.bus.emit("changed", { page: this.cursor.page });
      this.bus.emit("structure", {});
      return true;
    }
    return false;
  }

  nextPage(): boolean {
    if (this.cursor.page < this.pages.length - 1) {
      this.cursor.page++;
      this.cursor.line = 0;
      this.cursor.col = LEFT_COL;
      this.pageFull = false;
      this.bus.emit("changed", { page: this.cursor.page });
      this.bus.emit("structure", {});
      return true;
    }
    return false;
  }

  scrollLines(delta: number): void {
    // Moves cursor.line up or down across pages
    const totalLines = this.pages.length * LINES;
    let currentGlobal = this.cursor.page * LINES + this.cursor.line;
    currentGlobal = Math.max(0, Math.min(totalLines - 1, currentGlobal + delta));
    this.cursor.page = Math.floor(currentGlobal / LINES);
    this.cursor.line = currentGlobal % LINES;
    this.bus.emit("changed", { page: this.cursor.page });
    this.bus.emit("structure", {});
  }

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    switch (entry.kind) {
      case "glyph": {
        const { page, line, col } = entry.after;
        const row = this.pages[page][line];
        const index = row.findIndex((g) => g.col === col);
        if (index >= 0) {
          if (entry.before) row[index] = entry.before;
          else row.splice(index, 1);
        }
        this.cursor = { ...entry.cursorBefore };
        this.pageFull = false;
        break;
      }
      case "cursor":
        this.cursor = { ...entry.cursorBefore };
        this.pageFull = false;
        break;
      case "sheet":
        this.pages.splice(entry.pageAdded, 1);
        this.cursor = { ...entry.cursorBefore };
        this.pageFull = false;
        break;
    }
    this.redoStack.push(entry);
    this.bus.emit("changed", { page: this.cursor.page });
    this.bus.emit("structure", {});
    return true;
  }

  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    switch (entry.kind) {
      case "glyph": {
        const { page, line, col } = entry.after;
        const row = this.pages[page][line];
        const index = row.findIndex((g) => g.col === col);
        if (index >= 0) row[index] = entry.after;
        else {
          let insert = 0;
          while (insert < row.length && row[insert].col < col) insert++;
          row.splice(insert, 0, entry.after);
        }
        this.cursor = { page, line, col: col + 1 };
        break;
      }
      case "cursor":
        this.cursor = { ...entry.cursorAfter };
        break;
      case "sheet":
        this.pages.splice(entry.pageAdded, 0, Array.from({ length: LINES }, () => []));
        this.cursor = { page: entry.pageAdded, line: 0, col: LEFT_COL };
        this.pageFull = false;
        break;
    }
    this.undoStack.push(entry);
    this.bus.emit("changed", { page: this.cursor.page });
    this.bus.emit("structure", {});
    return true;
  }

  clear(): void {
    this.pages = [Array.from({ length: LINES }, () => [])];
    this.cursor = { page: 0, line: 0, col: LEFT_COL };
    this.pageFull = false;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.bus.emit("structure", {});
    this.bus.emit("changed", { page: 0 });
  }

  /** Types a block of text mechanically (sample manuscript). */
  loadText(text: string, timestamp: number): void {
    this.clear();
    for (const pageText of text.split("\f")) {
      if (this.cursor.page > 0) this.newSheet();
      for (const line of pageText.split("\n")) {
        for (const char of line.slice(0, RIGHT_MARGIN)) {
          this.typeChar(char, char === " " ? "Space" : "SAMPLE", timestamp, false);
        }
        this.carriageReturn();
        if (this.pageFull) break;
      }
      this.pageFull = false;
    }
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.cursor = { page: 0, line: 0, col: LEFT_COL };
    this.pageFull = false;
    this.bus.emit("structure", {});
    this.bus.emit("changed", { page: 0 });
  }

  toJSON(): ManuscriptJSON {
    return { pages: this.pages, cursor: this.cursor, pageFull: this.pageFull, version: 1 };
  }

  restore(data: ManuscriptJSON): void {
    this.pages = data.pages;
    this.cursor = data.cursor;
    this.pageFull = data.pageFull;
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.bus.emit("structure", {});
    this.bus.emit("changed", { page: this.cursor.page });
  }

  static fromJSON(data: ManuscriptJSON): Manuscript {
    const manuscript = new Manuscript();
    manuscript.restore(data);
    return manuscript;
  }
}

export const SAMPLE_MANUSCRIPT = `THE IMPACT No. 01\fBefore words became data, they were impact.\f\fEvery letter on this page arrived the slow way:
a finger fell, a lever turned, a steel bar rose
from the basket, and a small block of type struck
a ribbon against rubber and bone-white paper.

The machine did not remember anything.
The paper did.`;
