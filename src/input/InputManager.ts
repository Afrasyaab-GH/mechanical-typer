import { EventBus } from "../machine/events";
import { KEY_BY_CODE } from "../machine/keyboardLayout";
import { useStore } from "../app/store";
import type { Core } from "../app/core";
import { discardDraft, loadDraft, saveDraft } from "../document/draftStorage";

/**
 * Physical keyboard + optional IME adapter field wiring.
 * Handles shortcuts, composition events, visibility pauses and the
 * beforeunload guard. Nothing ever leaves the device.
 */
export class InputManager {
  imeBus = new EventBus();
  private core: Core;
  private ime: HTMLTextAreaElement | null = null;
  private composing = false;
  private detachFns: Array<() => void> = [];

  constructor(core: Core) {
    this.core = core;
  }

  attach(textarea: HTMLTextAreaElement): void {
    this.ime = textarea;
    const listen = <K extends keyof WindowEventMap>(
      type: K,
      handler: (event: WindowEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      window.addEventListener(type, handler as EventListener, options);
      this.detachFns.push(() => window.removeEventListener(type, handler as EventListener, options));
    };

    listen("keydown", (event) => this.onKeyDown(event));
    listen("keyup", (event) => this.core.machine.release(event.code));
    listen("blur", () => this.core.machine.releaseAll());
    listen("pointerdown", () => this.core.sound.unlock(), { capture: true });

    const onVisibility = () => {
      this.core.machine.paused = document.hidden;
      if (document.hidden) this.core.machine.releaseAll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    this.detachFns.push(() => document.removeEventListener("visibilitychange", onVisibility));

    listen("beforeunload", (event) => {
      if (!this.core.manuscript.isEmpty) {
        event.preventDefault();
        event.returnValue = "";
      }
    });

    textarea.addEventListener("compositionstart", () => {
      this.composing = true;
    });
    textarea.addEventListener("compositionupdate", (event) => {
      this.imeBus.emit("preview", { text: (event as CompositionEvent).data ?? "" });
    });
    textarea.addEventListener("compositionend", (event) => {
      this.composing = false;
      const text = (event as CompositionEvent).data ?? "";
      textarea.value = "";
      this.imeBus.emit("preview", { text: "" });
      if (text) this.imeBus.emit("commit", { text });
    });
    textarea.addEventListener("input", () => {
      if (!this.composing && textarea.value) {
        const text = textarea.value;
        textarea.value = "";
        this.imeBus.emit("commit", { text });
      }
    });

    this.imeBus.on("commit", ({ text }) => {
      if (useStore.getState().unicodeAdapter) this.core.machine.pressUnicode(text as string);
    });
  }

  focusIme(): void {
    this.ime?.focus({ preventScroll: true });
  }

  onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isEditingField =
      target &&
      (target.tagName === "INPUT" ||
        (target.tagName === "TEXTAREA" && !target.classList.contains("ime-input")) ||
        target.isContentEditable);

    if (isEditingField) {
      if (event.code === "Escape") {
        const state = useStore.getState();
        if (state.mainMenuOpen) {
          state.setMainMenuOpen(false);
        }
      }
      return;
    }

    this.core.sound.unlock();
    const state = useStore.getState();
    const { machine, manuscript } = this.core;

    if (event.code === "Escape") {
      if (state.sidebarOpen) {
        state.setSidebarOpen(false);
        return;
      }
      if (!state.panelHidden) {
        state.setPanelHidden(true);
        return;
      }
      if (state.exportOpen) {
        state.setExportOpen(false);
        return;
      }
      if (state.customizeOpen) {
        state.setCustomizeOpen(false);
        return;
      }
      if (state.verifyOpen) {
        state.setVerifyOpen(false);
        return;
      }
      if (state.selectedPart) {
        state.selectPart(null);
        return;
      }
      if (state.clearConfirm) {
        state.setClearConfirm(false);
        return;
      }
      if (state.mainMenuOpen) {
        state.setMainMenuOpen(false);
        return;
      }
      state.toggleSidebar();
      return;
    }

    if (state.mainMenuOpen || state.sidebarOpen) {
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        this.core.ledger.record("undo", "Undo", undefined, manuscript.cursor.col, manuscript.cursor.line, manuscript.cursor.page);
        manuscript.undo();
        return;
      }
      if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        this.core.ledger.record("redo", "Redo", undefined, manuscript.cursor.col, manuscript.cursor.line, manuscript.cursor.page);
        manuscript.redo();
        return;
      }
      if (key === "s") {
        event.preventDefault();
        this.saveDraft();
        return;
      }
      if (event.code === "Enter") {
        event.preventDefault();
        this.core.ledger.record("sheet", "Enter", undefined, manuscript.cursor.col, manuscript.cursor.line, manuscript.cursor.page);
        machine.newSheet();
        return;
      }
      return;
    }

    // While a dialog or the export drawer is open, Tab keeps its native
    // focus-navigation role so every control stays keyboard-reachable.
    if (
      event.code === "Tab" &&
      (state.exportOpen || state.clearConfirm || (state.draftExists && this.core.manuscript.isEmpty))
    ) {
      return;
    }
    if (this.composing) return;
    if (event.code === "Enter") {
      event.preventDefault();
      this.core.ledger.record("return", "Enter", "\n", manuscript.cursor.col, manuscript.cursor.line, manuscript.cursor.page);
      machine.carriageReturn();
      return;
    }
    if (event.code === "CapsLock") {
      event.preventDefault();
      machine.press("CapsLock");
      return;
    }
    if (event.code === "PageUp") {
      event.preventDefault();
      if (state.feedMode === "scroll") {
        manuscript.scrollLines(-10);
      } else {
        manuscript.prevPage();
      }
      return;
    }
    if (event.code === "PageDown") {
      event.preventDefault();
      if (state.feedMode === "scroll") {
        manuscript.scrollLines(10);
      } else {
        manuscript.nextPage();
      }
      return;
    }
    if (KEY_BY_CODE[event.code]) {
      event.preventDefault();
      const actionType = event.code === "Space" ? "space" : event.code === "Backspace" ? "backspace" : "press";
      this.core.ledger.record(actionType, event.code, event.key.length === 1 ? event.key : undefined, manuscript.cursor.col, manuscript.cursor.line, manuscript.cursor.page);
      machine.press(event.code, { repeat: event.repeat, key: event.key, shiftKey: event.shiftKey });
    }
  }

  saveDraft(): void {
    const state = useStore.getState();
    if (this.core.manuscript.getText().trim().length === 0) {
      // Nothing meaningful to keep: an empty manuscript is not a draft.
      discardDraft();
      state.setDraftExists(false);
      return;
    }
    if (saveDraft(this.core.manuscript)) {
      state.setDraftExists(true);
      state.bumpSaveTick();
      state.showPlaqueKey("plaque.draftSaved");
    } else {
      state.showPlaqueKey("plaque.draftFailed");
    }
  }

  static loadDraft() {
    return loadDraft();
  }

  static discardDraft(): void {
    discardDraft();
  }

  detach(): void {
    for (const detach of this.detachFns) detach();
    this.detachFns = [];
  }
}
