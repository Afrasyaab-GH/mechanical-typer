import { create } from "zustand";
import type { MachineTheme } from "../scene/Materials";

export type CameraMode = "write" | "paper" | "mechanism" | "inspect";

export interface Stats {
  chars: number;
  words: number;
  page: number;
  pages: number;
  line: number;
  col: number;
  pageFull: boolean;
}

export interface Trace {
  chain: string[];
  index: number;
}

export interface ExportResult {
  fileName: string;
  size: number;
  fontEmbedded: boolean;
  fontNote: string;
  pageCount: number;
  wordCount: number;
  charCount: number;
}

interface AppState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  panelHidden: boolean;
  setPanelHidden: (hidden: boolean) => void;
  togglePanel: () => void;

  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;

  machineTheme: MachineTheme;
  setMachineTheme: (theme: MachineTheme) => void;

  documentTitle: string;
  setDocumentTitle: (title: string) => void;

  feedMode: "sheet" | "scroll";
  setFeedMode: (mode: "sheet" | "scroll") => void;

  lightIntensity: number;
  setLightIntensity: (intensity: number) => void;

  lightWarmth: string;
  setLightWarmth: (warmth: string) => void;

  studioLightEnabled: boolean;
  toggleStudioLight: () => void;
  setStudioLightEnabled: (enabled: boolean) => void;

  reflectionsEnabled: boolean;
  toggleReflections: () => void;
  setReflectionsEnabled: (enabled: boolean) => void;
  reflectionIntensity: number;
  setReflectionIntensity: (intensity: number) => void;

  deskLampEnabled: boolean;
  toggleDeskLamp: () => void;
  setDeskLampEnabled: (enabled: boolean) => void;
  deskLampIntensity: number;
  setDeskLampIntensity: (intensity: number) => void;
  deskLampWarmth: string;
  setDeskLampWarmth: (warmth: string) => void;

  customizeOpen: boolean;
  setCustomizeOpen: (open: boolean) => void;

  explodeTarget: number;
  explodeCurrent: number;
  setExplodeTarget: (value: number) => void;
  setExplodeCurrent: (value: number) => void;

  cutaway: boolean;
  toggleCutaway: () => void;

  soundOn: boolean;
  toggleSound: () => void;

  unicodeAdapter: boolean;
  toggleUnicodeAdapter: () => void;

  autoReturn: boolean;
  toggleAutoReturn: () => void;
  setAutoReturn: (enabled: boolean) => void;

  autoNextPage: boolean;
  toggleAutoNextPage: () => void;
  setAutoNextPage: (enabled: boolean) => void;

  typewriterFont: string;
  setTypewriterFont: (font: string) => void;

  typewriterFontSize: number;
  setTypewriterFontSize: (size: number) => void;

  typewriterLetterSpacing: number;
  setTypewriterLetterSpacing: (spacing: number) => void;

  typewriterLineSpacing: number;
  setTypewriterLineSpacing: (spacing: number) => void;

  selectedPart: string | null;
  selectPart: (id: string | null) => void;

  trace: Trace | null;
  startTrace: (chain: string[]) => void;
  advanceTrace: () => void;
  stopTrace: () => void;

  slowMotion: boolean;
  setSlowMotion: (on: boolean) => void;

  stats: Stats;
  setStats: (stats: Stats) => void;

  plaque: string | null;
  plaqueKey: string | null;
  showPlaque: (text: string, ms?: number) => void;
  showPlaqueKey: (key: string, ms?: number) => void;

  bellTick: number;
  jamTick: number;

  exportOpen: boolean;
  setExportOpen: (open: boolean) => void;
  exporting: boolean;
  setExporting: (on: boolean) => void;
  exportResult: ExportResult | null;
  setExportResult: (result: ExportResult | null) => void;
  exportError: string | null;
  setExportError: (error: string | null) => void;

  recording: boolean;
  setRecording: (recording: boolean) => void;
  recordingDuration: number;
  setRecordingDuration: (duration: number) => void;
  hasRecordedVideo: boolean;
  setHasRecordedVideo: (has: boolean) => void;

  verifyOpen: boolean;
  setVerifyOpen: (open: boolean) => void;

  clearConfirm: boolean;
  setClearConfirm: (open: boolean) => void;

  draftExists: boolean;
  setDraftExists: (exists: boolean) => void;
  saveTick: number;
  bumpSaveTick: () => void;

  mainMenuOpen: boolean;
  setMainMenuOpen: (open: boolean) => void;
  toggleMainMenu: () => void;
  mainMenuTab: "library" | "editor" | "options" | "about";
  setMainMenuTab: (tab: "library" | "editor" | "options" | "about") => void;
  selectedProjectId: string | null;
  setSelectedProjectId: (id: string | null) => void;

  motionReduced: boolean;
}

let plaqueTimer = 0;

export const useStore = create<AppState>((set, get) => ({
  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  panelHidden: true,
  setPanelHidden: (panelHidden) => set({ panelHidden }),
  togglePanel: () => set((s) => ({ panelHidden: !s.panelHidden })),

  cameraMode: "write",
  setCameraMode: (cameraMode) => set({ cameraMode }),

  machineTheme: "midnight",
  setMachineTheme: (machineTheme) => set({ machineTheme }),

  documentTitle: "— THE IMPACT NO. 01 —",
  setDocumentTitle: (documentTitle) => set({ documentTitle }),

  feedMode: "scroll",
  setFeedMode: (feedMode) => set({ feedMode }),

  lightIntensity: 1.2,
  setLightIntensity: (lightIntensity) => set({ lightIntensity: Math.min(2.5, Math.max(0.0, lightIntensity)) }),

  lightWarmth: "#ffd9a6",
  setLightWarmth: (lightWarmth) => set({ lightWarmth }),

  studioLightEnabled: true,
  toggleStudioLight: () => set((s) => ({ studioLightEnabled: !s.studioLightEnabled })),
  setStudioLightEnabled: (studioLightEnabled) => set({ studioLightEnabled }),

  reflectionsEnabled: false,
  reflectionIntensity: 1.0,
  toggleReflections: () =>
    set((s) => {
      const nextEnabled = !s.reflectionsEnabled;
      return {
        reflectionsEnabled: nextEnabled,
        reflectionIntensity: nextEnabled && s.reflectionIntensity <= 0.05 ? 1.0 : s.reflectionIntensity,
      };
    }),
  setReflectionsEnabled: (reflectionsEnabled) =>
    set((s) => ({
      reflectionsEnabled,
      reflectionIntensity: reflectionsEnabled && s.reflectionIntensity <= 0.05 ? 1.0 : s.reflectionIntensity,
    })),
  setReflectionIntensity: (reflectionIntensity) =>
    set({ reflectionIntensity: Math.min(2.0, Math.max(0.0, reflectionIntensity)) }),

  deskLampEnabled: true,
  toggleDeskLamp: () => set((s) => ({ deskLampEnabled: !s.deskLampEnabled })),
  setDeskLampEnabled: (deskLampEnabled) => set({ deskLampEnabled }),
  deskLampIntensity: 0.8,
  setDeskLampIntensity: (deskLampIntensity) =>
    set({ deskLampIntensity: Math.min(2.5, Math.max(0.0, deskLampIntensity)) }),
  deskLampWarmth: "#ffb86c",
  setDeskLampWarmth: (deskLampWarmth) => set({ deskLampWarmth }),

  customizeOpen: false,
  setCustomizeOpen: (customizeOpen) => set({ customizeOpen }),

  explodeTarget: 0,
  explodeCurrent: 0,
  setExplodeTarget: (value) => set({ explodeTarget: Math.min(1, Math.max(0, value)) }),
  setExplodeCurrent: (value) => {
    const current = get().explodeCurrent;
    if (Math.abs(current - value) > 0.004 || value === 0 || value === 1) set({ explodeCurrent: value });
  },

  cutaway: false,
  toggleCutaway: () => set((s) => ({ cutaway: !s.cutaway })),

  soundOn: true,
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),

  unicodeAdapter: false,
  toggleUnicodeAdapter: () => set((s) => ({ unicodeAdapter: !s.unicodeAdapter })),

  autoReturn: false,
  toggleAutoReturn: () => set((s) => ({ autoReturn: !s.autoReturn })),
  setAutoReturn: (autoReturn) => set({ autoReturn }),

  autoNextPage: true,
  toggleAutoNextPage: () => set((s) => ({ autoNextPage: !s.autoNextPage })),
  setAutoNextPage: (autoNextPage) => set({ autoNextPage }),

  typewriterFont: "Courier Prime",
  setTypewriterFont: (typewriterFont) => set({ typewriterFont }),

  typewriterFontSize: 50,
  setTypewriterFontSize: (typewriterFontSize) => set({ typewriterFontSize: Math.max(32, Math.min(80, typewriterFontSize)) }),

  typewriterLetterSpacing: 1.0,
  setTypewriterLetterSpacing: (typewriterLetterSpacing) =>
    set({ typewriterLetterSpacing: Math.max(0.7, Math.min(1.6, typewriterLetterSpacing)) }),

  typewriterLineSpacing: 1.0,
  setTypewriterLineSpacing: (typewriterLineSpacing) =>
    set({ typewriterLineSpacing: Math.max(0.8, Math.min(2.0, typewriterLineSpacing)) }),

  selectedPart: null,
  selectPart: (selectedPart) => set({ selectedPart }),

  trace: null,
  startTrace: (chain) => set({ trace: { chain, index: 0 } }),
  advanceTrace: () => {
    const trace = get().trace;
    if (!trace) return;
    if (trace.index >= trace.chain.length - 1) set({ trace: null });
    else set({ trace: { ...trace, index: trace.index + 1 } });
  },
  stopTrace: () => set({ trace: null }),

  slowMotion: false,
  setSlowMotion: (slowMotion) => set({ slowMotion }),

  stats: { chars: 0, words: 0, page: 0, pages: 1, line: 0, col: 0, pageFull: false },
  setStats: (stats) => set({ stats }),

  plaque: null,
  plaqueKey: null,
  showPlaque: (text, ms = 3200) => {
    window.clearTimeout(plaqueTimer);
    set({ plaque: text, plaqueKey: null });
    plaqueTimer = window.setTimeout(() => set({ plaque: null }), ms);
  },
  showPlaqueKey: (key, ms = 3200) => {
    window.clearTimeout(plaqueTimer);
    set({ plaqueKey: key, plaque: null });
    plaqueTimer = window.setTimeout(() => set({ plaqueKey: null }), ms);
  },

  bellTick: 0,
  jamTick: 0,

  exportOpen: false,
  setExportOpen: (exportOpen) => set({ exportOpen }),
  exporting: false,
  setExporting: (exporting) => set({ exporting }),
  exportResult: null,
  setExportResult: (exportResult) => set({ exportResult }),
  exportError: null,
  setExportError: (exportError) => set({ exportError }),

  recording: false,
  setRecording: (recording) => set({ recording }),
  recordingDuration: 0,
  setRecordingDuration: (recordingDuration) => set({ recordingDuration }),
  hasRecordedVideo: false,
  setHasRecordedVideo: (hasRecordedVideo) => set({ hasRecordedVideo }),

  verifyOpen: false,
  setVerifyOpen: (verifyOpen) => set({ verifyOpen }),

  clearConfirm: false,
  setClearConfirm: (clearConfirm) => set({ clearConfirm }),

  draftExists: false,
  setDraftExists: (draftExists) => set({ draftExists }),
  saveTick: 0,
  bumpSaveTick: () => set((s) => ({ saveTick: s.saveTick + 1 })),

  mainMenuOpen: false,
  setMainMenuOpen: (mainMenuOpen) => set({ mainMenuOpen }),
  toggleMainMenu: () => set((s) => ({ mainMenuOpen: !s.mainMenuOpen })),
  mainMenuTab: "library",
  setMainMenuTab: (mainMenuTab) => set({ mainMenuTab }),
  selectedProjectId: null,
  setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),

  motionReduced:
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
}));
