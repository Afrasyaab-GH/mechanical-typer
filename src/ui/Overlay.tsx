import { useEffect, useState } from "react";
import { getCore } from "../app/core";
import { useStore } from "../app/store";
import { t } from "../app/i18n";
import { discardDraft, loadDraft } from "../document/draftStorage";
import type { InputManager } from "../input/InputManager";
import { getCanvasVideoRecorder } from "../recorder/CanvasVideoRecorder";
import { ControlDesk } from "./ControlDesk";
import { PartInfo } from "./PartInfo";
import { ExportDrawer } from "./ExportDrawer";
import { CustomizeDrawer } from "./CustomizeDrawer";

import { VerifyDrawer } from "./VerifyDrawer";

export function Overlay({ manager }: { manager: InputManager | null }) {
  const state = useStore();
  const core = getCore();
  const [hasTyped, setHasTyped] = useState(false);
  const [imePreview, setImePreview] = useState("");

  const recorder = getCanvasVideoRecorder();
  const recording = useStore((s) => s.recording);
  const setRecording = useStore((s) => s.setRecording);
  const recordingDuration = useStore((s) => s.recordingDuration);
  const setRecordingDuration = useStore((s) => s.setRecordingDuration);
  const setHasRecordedVideo = useStore((s) => s.setHasRecordedVideo);

  useEffect(() => {
    const unsubStatus = recorder.onStatusChange((status) => {
      setRecording(status === "recording");
    });
    const unsubTick = recorder.onTick((duration) => {
      setRecordingDuration(duration);
    });
    return () => {
      unsubStatus();
      unsubTick();
    };
  }, [recorder, setRecording, setRecordingDuration]);

  const toggleRecording = async () => {
    if (recorder.isRecording()) {
      const blob = await recorder.stop();
      if (blob && blob.size > 0) {
        setHasRecordedVideo(true);
        state.showPlaqueKey("plaque.recStopped", 4500);
      }
    } else {
      const canvas = document.querySelector("canvas");
      if (!canvas) {
        state.showPlaque("CANVAS NOT AVAILABLE");
        return;
      }
      const audioNodes = core.sound.getAudioNodes();
      const started = recorder.start(canvas, audioNodes, { fps: 60 });
      if (started) {
        state.showPlaqueKey("plaque.recStarted", 3500);
      }
    }
  };

  useEffect(() => core.machine.bus.on("impact", () => setHasTyped(true)), [core]);
  useEffect(() => {
    if (!manager) return;
    return manager.imeBus.on("preview", ({ text }) => setImePreview(text as string));
  }, [manager]);

  const exploded = state.explodeCurrent > 0.08;
  const atMargin = state.stats.col >= core.manuscript.bellCol && !state.stats.pageFull && !exploded;
  const pageFull = state.stats.pageFull && !exploded;

  const resumeDraft = () => {
    const draft = loadDraft();
    if (draft) {
      core.manuscript.restore(draft);
      state.showPlaqueKey("plaque.draftRestored");
    }
    state.setDraftExists(false);
  };

  return (
    <div className="overlay">
      <header className="hud-title">
        <h1>PLATEN</h1>
        <p className="subtitle">{t("subtitle")}</p>
        <p className="tagline">{t("tagline1")}</p>
      </header>

      {/* Top-Right Vintage Video & Audio Proof of Authorship Recorder */}
      <div className="hud-rec-container">
        <button
          className={`hud-btn hud-rec-btn ${recording ? "recording" : ""}`}
          onClick={toggleRecording}
          aria-label={recording ? "Stop Recording Proof" : "Start Recording Proof"}
          title={
            recording
              ? "Stop 60 FPS video recording"
              : "Record 60 FPS video with synchronized mechanical sound effects"
          }
        >
          <span className="hud-rec-dot" />
          <span className="hud-rec-label">{recording ? t("btn.stopRec") : t("btn.rec")}</span>
          {recording && (
            <span className="hud-rec-timer">
              {String(Math.floor(recordingDuration / 60)).padStart(2, "0")}:
              {String(recordingDuration % 60).padStart(2, "0")}
            </span>
          )}
        </button>
      </div>

      {!hasTyped && <div className="hud-hint">{t("hint")}</div>}

      <div className="plaque-stack" aria-live="polite">
        {exploded && <div className="plaque warn">{t("plaque.assemble")}</div>}
        {atMargin && <div className="plaque">{t("plaque.margin")}</div>}
        {pageFull && <div className="plaque">{t("plaque.pageFull")}</div>}
        {state.plaque && <div className="plaque transient">{state.plaque}</div>}
        {state.plaqueKey && <div className="plaque transient">{t(state.plaqueKey)}</div>}
        {state.unicodeAdapter && <div className="plaque note">{t("plaque.unicode")}</div>}
        {state.autoReturn && <div className="plaque note">{t("plaque.autoreturn")}</div>}
      </div>

      {imePreview && (
        <div className="ime-preview" aria-hidden={true}>
          {imePreview}
        </div>
      )}

      {state.draftExists && core.manuscript.isEmpty && (
        <div className="confirm-card" role="dialog" aria-label="Restore local draft">
          <p>{t("confirm.draft")}</p>
          <div>
            <button className="hud-btn accent" onClick={resumeDraft}>
              {t("confirm.resume")}
            </button>
            <button
              className="hud-btn"
              onClick={() => {
                discardDraft();
                state.setDraftExists(false);
              }}
            >
              {t("confirm.discard")}
            </button>
          </div>
        </div>
      )}

      {state.clearConfirm && (
        <div className="confirm-card" role="alertdialog" aria-label="Confirm clearing the manuscript">
          <p>{t("confirm.clear")}</p>
          <div>
            <button
              className="hud-btn danger"
              onClick={() => {
                core.manuscript.clear();
                state.setClearConfirm(false);
                state.showPlaqueKey("plaque.cleared");
              }}
            >
              {t("confirm.confirm")}
            </button>
            <button className="hud-btn" onClick={() => state.setClearConfirm(false)}>
              {t("confirm.cancel")}
            </button>
          </div>
        </div>
      )}

      <PartInfo />
      <ExportDrawer />
      <VerifyDrawer />
      <CustomizeDrawer />
      <ControlDesk />

      <footer className="hud-footer">{t("footer")}</footer>
      <div className="sr-only" aria-live="polite" aria-label="Manuscript text">
        {core.manuscript.getText().replace(/\f/g, "\n\n— new sheet —\n\n")}
      </div>
    </div>
  );
}
