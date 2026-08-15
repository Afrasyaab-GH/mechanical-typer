import { useEffect, useState } from "react";
import { getCore } from "../app/core";
import { useStore } from "../app/store";
import { t } from "../app/i18n";
import { discardDraft, loadDraft } from "../document/draftStorage";
import type { InputManager } from "../input/InputManager";
import { ControlDesk } from "./ControlDesk";
import { PartInfo } from "./PartInfo";
import { ExportDrawer } from "./ExportDrawer";
import { CustomizeDrawer } from "./CustomizeDrawer";

export function Overlay({ manager }: { manager: InputManager | null }) {
  const state = useStore();
  const core = getCore();
  const [hasTyped, setHasTyped] = useState(false);
  const [imePreview, setImePreview] = useState("");

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
        <h1>THE IMPACT No. 01</h1>
        <p className="subtitle">{t("subtitle")}</p>
        <p className="tagline">{t("tagline1")}</p>
      </header>

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
      <CustomizeDrawer />
      <ControlDesk />

      <footer className="hud-footer">{t("footer")}</footer>
      <div className="sr-only" aria-live="polite" aria-label="Manuscript text">
        {core.manuscript.getText().replace(/\f/g, "\n\n— new sheet —\n\n")}
      </div>
    </div>
  );
}
