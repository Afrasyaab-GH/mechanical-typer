import { useEffect, useMemo, useRef, useState } from "react";
import { getCore, wireAudio } from "./core";
import { useStore } from "./store";
import { loadDraft, createDraftAutoSaver } from "../document/draftStorage";
import { InputManager } from "../input/InputManager";
import { TypewriterScene } from "../scene/TypewriterScene";
import { Overlay } from "../ui/Overlay";
import { Sidebar } from "../ui/Sidebar";

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function WebGLFallback() {
  return (
    <div className="webgl-fallback">
      <h1>PLATEN: 3D TYPEWRITER</h1>
      <p className="plaque warn">THIS BROWSER CANNOT START THE 3D TYPEWRITER.</p>
      <p>Enable hardware acceleration or use a modern WebGL-capable browser.</p>
    </div>
  );
}

export default function App() {
  const core = useMemo(() => getCore(), []);
  const [hasWebGL] = useState(webglAvailable);
  const imeRef = useRef<HTMLTextAreaElement>(null);
  const [manager, setManager] = useState<InputManager | null>(null);

  useEffect(() => {
    wireAudio(core);
    (window as unknown as { __impactCore?: typeof core }).__impactCore = core;
    const input = new InputManager(core);
    if (imeRef.current) input.attach(imeRef.current);
    setManager(input);

    const state = useStore.getState();
    const updateStats = () => {
      const manuscript = core.manuscript;
      useStore.getState().setStats({
        chars: manuscript.charCount,
        words: manuscript.wordCount,
        page: manuscript.cursor.page,
        pages: manuscript.pages.length,
        line: manuscript.cursor.line,
        col: manuscript.cursor.col,
        pageFull: manuscript.pageFull,
      });
    };
    const offChanged = core.manuscript.bus.on("changed", updateStats);
    const offStructure = core.manuscript.bus.on("structure", updateStats);
    updateStats();

    const offRejected = core.machine.bus.on("rejected", ({ reason }) => {
      const store = useStore.getState();
      if (reason === "exploded") store.showPlaqueKey("plaque.assemble");
      else if (reason === "pageFull") store.showPlaqueKey("plaque.pageFullDone");
    });
    const offBell = core.manuscript.bus.on("bell", () => {
      useStore.setState((s) => ({ bellTick: s.bellTick + 1 }));
    });
    const offClash = core.machine.bus.on("clash", () => {
      useStore.setState((s) => ({ jamTick: s.jamTick + 1 }));
      useStore.getState().showPlaqueKey("plaque.clash");
    });
    const offReturnDone = core.machine.bus.on("carriageReturnDone", ({ pageFull }) => {
      if (pageFull) useStore.getState().showPlaqueKey("plaque.pageFullDone", 6000);
    });

    // Debounced local auto-save; the manuscript never leaves this device.
    const autoSave = createDraftAutoSaver(core.manuscript);
    const offAutoSave1 = core.manuscript.bus.on("changed", autoSave);
    const offAutoSave2 = core.manuscript.bus.on("structure", autoSave);

    if (loadDraft()) state.setDraftExists(true);
    core.paper.setFeedMode(state.feedMode);
    core.manuscript.setTypeStyle(
      state.typewriterFont,
      state.typewriterFontSize,
      state.typewriterLetterSpacing,
      state.typewriterLineSpacing,
    );

    const offStoreSubscriptions = useStore.subscribe((current, previous) => {
      if (current.unicodeAdapter && !previous.unicodeAdapter) input.focusIme();
      if (current.feedMode !== previous.feedMode) {
        core.paper.setFeedMode(current.feedMode);
      }
      if (current.documentTitle !== previous.documentTitle) {
        core.paper.setTitle(current.documentTitle);
      }
      if (
        current.typewriterFont !== previous.typewriterFont ||
        current.typewriterFontSize !== previous.typewriterFontSize ||
        current.typewriterLetterSpacing !== previous.typewriterLetterSpacing ||
        current.typewriterLineSpacing !== previous.typewriterLineSpacing
      ) {
        core.manuscript.setTypeStyle(
          current.typewriterFont,
          current.typewriterFontSize,
          current.typewriterLetterSpacing,
          current.typewriterLineSpacing,
        );
        core.paper.setFont(
          current.typewriterFont,
          current.typewriterFontSize,
          current.typewriterLetterSpacing,
          current.typewriterLineSpacing,
        );
      }
      if (current.autoReturn !== previous.autoReturn) {
        core.manuscript.autoReturn = current.autoReturn;
      }
      if (current.autoNextPage !== previous.autoNextPage) {
        core.manuscript.autoNextPage = current.autoNextPage;
      }
    });

    return () => {
      input.detach();
      offChanged();
      offStructure();
      offRejected();
      offBell();
      offClash();
      offReturnDone();
      offAutoSave1();
      offAutoSave2();
      offStoreSubscriptions();
    };
  }, [core]);

  if (!hasWebGL) return <WebGLFallback />;

  return (
    <div id="root-layout" className="root-layout">
      <Sidebar />
      <main className="editor-view">
        <div className="canvas-container">
          <TypewriterScene />
        </div>
        <Overlay manager={manager} />
      </main>
      <textarea
        ref={imeRef}
        className="ime-input"
        aria-label="Input method adapter field"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
}
