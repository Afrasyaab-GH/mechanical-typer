import { DRAFT_KEY } from "../machine/constants";
import type { Manuscript, ManuscriptJSON } from "./Manuscript";

/**
 * A draft is worth recovering only when it carries real text.
 * Empty, whitespace-only, or malformed payloads are not drafts.
 */
function draftHasText(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const pages: unknown = (data as { pages?: unknown }).pages;
  if (!Array.isArray(pages)) return false;
  // Serialized shape is Glyph[][][] — sparse rows of { col, char, ... }.
  for (const page of pages) {
    if (!Array.isArray(page)) return false;
    for (const line of page) {
      if (!Array.isArray(line)) return false;
      for (const glyph of line) {
        if (!glyph || typeof glyph !== "object") return false;
        const char = (glyph as { char?: unknown }).char;
        if (typeof char !== "string") return false;
        if (char.trim().length > 0) return true;
      }
    }
  }
  return false;
}

/**
 * Local draft persistence. The manuscript never leaves this device:
 * everything stays in localStorage under "impact-no-01-draft".
 */
export function saveDraft(manuscript: Manuscript): boolean {
  try {
    const data = manuscript.toJSON();
    if (!draftHasText(data)) {
      // An empty manuscript is not a draft: drop any stale copy and
      // never write a new empty one.
      localStorage.removeItem(DRAFT_KEY);
      return false;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadDraft(): ManuscriptJSON | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ManuscriptJSON;
    if (!draftHasText(data)) {
      // Ignore and delete empty, whitespace-only, or malformed drafts.
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return data;
  } catch {
    // Corrupt payload: delete it so it never blocks a fresh start.
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* storage unavailable */
    }
    return null;
  }
}

export function discardDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Debounced auto-save used after manuscript changes. */
export function createDraftAutoSaver(manuscript: Manuscript, delayMs = 900): () => void {
  let timer = 0;
  return () => {
    window.clearTimeout(timer);
    if (!draftHasText(manuscript.toJSON())) {
      // The document just became empty (undo-all, clear): remove the
      // stored draft at once instead of saving an empty one.
      discardDraft();
      return;
    }
    timer = window.setTimeout(() => saveDraft(manuscript), delayMs);
  };
}
