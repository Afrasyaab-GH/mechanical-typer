import type { ReactNode } from "react";
import { getCore } from "../app/core";
import { useStore } from "../app/store";
import { t } from "../app/i18n";
import { SAMPLE_MANUSCRIPT } from "../document/Manuscript";

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="panel-section">
      <div className="section-label">{label}</div>
      <div className="section-body">{children}</div>
    </section>
  );
}

const CAMERA_MODES = ["write", "paper", "mechanism", "inspect"] as const;

export function ControlDesk() {
  const state = useStore();
  const core = getCore();
  const { machine, manuscript } = core;
  const exploded = state.explodeTarget > 0.5;

  if (state.panelHidden) {
    return (
      <button
        className="hud-btn panel-chip"
        onClick={state.togglePanel}
        aria-label="Show control panel"
        aria-expanded={false}
      >
        {t("panel.show")} ▴
      </button>
    );
  }

  return (
    <div className="control-bar panel" role="toolbar" aria-label="Machine controls">
      <div className="panel-head">
        <span className="panel-title">CONTROL DESK</span>
        <button
          className="hud-btn small ghost"
          onClick={state.togglePanel}
          aria-label="Hide control panel"
          aria-expanded={true}
        >
          {t("panel.hide")} ▾
        </button>
      </div>
      <div className="panel-grid">
        <Section label={t("sec.machine")}>
          <button
            className="hud-btn accent"
            aria-label={exploded ? "Assemble the machine" : "Explode the machine"}
            onClick={() => state.setExplodeTarget(exploded ? 0 : 1)}
          >
            {exploded ? t("btn.assemble") : t("btn.explode")}
          </button>
          <input
            className="explode-slider"
            type="range"
            min={0}
            max={100}
            value={Math.round(state.explodeTarget * 100)}
            aria-label="Explode level"
            onChange={(event) => state.setExplodeTarget(Number(event.target.value) / 100)}
          />
          <span className="explode-value">{Math.round(state.explodeCurrent * 100)}%</span>
          <button
            className={`hud-btn ${state.cutaway ? "on" : ""}`}
            aria-pressed={state.cutaway}
            aria-label="Cutaway view"
            onClick={() => {
              if (!state.cutaway) state.setExplodeTarget(0);
              state.toggleCutaway();
            }}
          >
            {t("btn.cutaway")}
          </button>
        </Section>

        <Section label={t("sec.view")}>
          <div className="segmented" role="group" aria-label="Camera mode">
            {CAMERA_MODES.map((mode) => (
              <button
                key={mode}
                className={`hud-btn seg ${state.cameraMode === mode ? "on" : ""}`}
                aria-pressed={state.cameraMode === mode}
                onClick={() => state.setCameraMode(mode)}
              >
                {t(`btn.${mode}`)}
              </button>
            ))}
          </div>
          <button
            className={`hud-btn ${state.soundOn ? "on" : ""}`}
            aria-pressed={state.soundOn}
            aria-label="Toggle sound"
            onClick={() => {
              core.sound.setEnabled(!state.soundOn);
              state.toggleSound();
            }}
          >
            {t("btn.sound")}
          </button>
        </Section>

        <Section label={t("sec.document")}>
          <button className="hud-btn" onClick={() => machine.newSheet()} aria-label="Insert a new sheet">
            {t("btn.newSheet")}
          </button>
          <button className="hud-btn" onClick={() => manuscript.undo()} disabled={!manuscript.canUndo} aria-label="Undo">
            {t("btn.undo")}
          </button>
          <button className="hud-btn" onClick={() => manuscript.redo()} disabled={!manuscript.canRedo} aria-label="Redo">
            {t("btn.redo")}
          </button>
          <button className="hud-btn accent" onClick={() => state.setExportOpen(true)} aria-label="Export as Word document">
            {t("btn.export")}
          </button>
          <button
            className="hud-btn danger"
            onClick={() => state.setClearConfirm(true)}
            aria-label="Clear the entire manuscript"
            disabled={manuscript.isEmpty}
          >
            {t("btn.clear")}
          </button>
        </Section>

        {/* ═══ LAYOUT ═══ */}
        <section className="panel-section modern">
          <div className="section-label">LAYOUT</div>
          <div className="section-body" style={{ width: "100%" }}>
            <div className="modern-grid">
              {/* --- Automations --- */}
              <div className="modern-row">
                <span className="modern-sublabel">Automations:</span>
                <button
                  className={`hud-btn small ${state.autoReturn ? "on" : ""}`}
                  aria-pressed={state.autoReturn}
                  aria-label="Toggle modern auto-return carriage"
                  onClick={() => {
                    manuscript.autoReturn = !state.autoReturn;
                    state.toggleAutoReturn();
                    if (!state.autoReturn) state.showPlaqueKey("plaque.autoreturn", 4000);
                  }}
                  title="Auto-Return: Automatically executes carriage return and line advance at the right margin."
                >
                  Auto-Return: {state.autoReturn ? "ON" : "OFF"}
                </button>

                <button
                  className={`hud-btn small ${state.autoNextPage ? "on" : ""}`}
                  aria-pressed={state.autoNextPage}
                  aria-label="Toggle automatic next page sheet feed"
                  onClick={() => {
                    manuscript.autoNextPage = !state.autoNextPage;
                    state.toggleAutoNextPage();
                    if (!state.autoNextPage) state.showPlaqueKey("plaque.autoNextPage", 4000);
                  }}
                  title="Auto-Sheet Feed: Automatically feeds in a fresh paper sheet when reaching the bottom of the page."
                >
                  Auto-Sheet: {state.autoNextPage ? "ON" : "OFF"}
                </button>

                <button
                  className={`hud-btn small ${state.unicodeAdapter ? "on" : ""}`}
                  aria-pressed={state.unicodeAdapter}
                  aria-label="Toggle modern Unicode input adapter"
                  onClick={() => state.toggleUnicodeAdapter()}
                  title="Unicode Adapter: Digital IME composition for non-ASCII keystrokes."
                >
                  Unicode: {state.unicodeAdapter ? "ON" : "OFF"}
                </button>

                <button
                  className={`hud-btn small ${state.feedMode === "scroll" ? "on" : ""}`}
                  aria-pressed={state.feedMode === "scroll"}
                  aria-label="Toggle paper feed mode"
                  onClick={() => state.setFeedMode(state.feedMode === "scroll" ? "sheet" : "scroll")}
                  title={state.feedMode === "scroll" ? "Continuous Scroll Feed (Active)" : "Standard Single A4 Sheet (Active)"}
                >
                  {state.feedMode === "scroll" ? "Feed: Continuous" : "Feed: Single A4"}
                </button>
              </div>

              {/* --- Typography & Pitch --- */}
              <div className="modern-row">
                <span className="modern-sublabel">Typography:</span>
                <select
                  className="hud-select"
                  value={state.typewriterFont}
                  onChange={(e) => state.setTypewriterFont(e.target.value)}
                  aria-label="Select typewriter font family"
                  title="Typewriter Font: Change the typeface stamped onto the paper."
                >
                  <option value="Courier Prime">Courier Prime (Standard 1930s)</option>
                  <option value="Special Elite">Special Elite (Vintage Distressed)</option>
                  <option value="Cutive Mono">Cutive Mono (Remington Serif)</option>
                  <option value="IBM Plex Mono">IBM Plex Mono (Selectric)</option>
                  <option value="Space Mono">Space Mono (Modernist)</option>
                  <option value="DM Mono">DM Mono (Clean Electric)</option>
                </select>

                <span className="modern-sublabel" style={{ marginLeft: "6px" }}>Pitch:</span>
                <div className="segmented">
                  {[
                    { label: "10pt", size: 42, title: "10 Pitch (Compact Pica)" },
                    { label: "12pt", size: 50, title: "12 Pitch (Standard)" },
                    { label: "14pt", size: 58, title: "14 Pitch (Large Elite)" },
                    { label: "16pt", size: 66, title: "16 Pitch (Headline)" },
                  ].map((s) => (
                    <button
                      key={s.size}
                      className={`hud-btn small seg ${state.typewriterFontSize === s.size ? "on" : ""}`}
                      onClick={() => state.setTypewriterFontSize(s.size)}
                      title={s.title}
                      aria-pressed={state.typewriterFontSize === s.size}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ STUDIO ═══ */}
        <section className="panel-section modern">
          <div className="section-label">STUDIO</div>
          <div className="section-body" style={{ width: "100%" }}>
            <div className="modern-grid">
              <div className="modern-row">
                <span className="modern-sublabel">Finish:</span>
                <button
                  className={`hud-btn small ${state.reflectionsEnabled ? "on" : ""}`}
                  aria-pressed={state.reflectionsEnabled}
                  aria-label="Toggle environment reflections"
                  onClick={() => state.toggleReflections()}
                  title={state.reflectionsEnabled ? "Reflections: ON (Gloss finish)" : "Reflections: OFF (Matte finish)"}
                >
                  {state.reflectionsEnabled ? "Reflect: ON" : "Reflect: OFF"}
                </button>
                <button
                  className="hud-btn small accent"
                  aria-label="Open finish and lighting customizer"
                  onClick={() => state.setCustomizeOpen(true)}
                  title="Open the full Studio & Finish customization panel"
                >
                  Customize ▸
                </button>
              </div>
              <div className="modern-row">
                <span className="modern-sublabel">Lighting:</span>
                <button
                  className={`hud-btn small ${state.studioLightEnabled ? "on" : ""}`}
                  aria-pressed={state.studioLightEnabled}
                  aria-label="Toggle studio ambient lighting"
                  onClick={() => state.toggleStudioLight()}
                  title={state.studioLightEnabled ? "Studio Light: ON" : "Studio Light: OFF"}
                >
                  {state.studioLightEnabled ? "Studio: ON" : "Studio: OFF"}
                </button>
                <button
                  className={`hud-btn small ${state.deskLampEnabled ? "on" : ""}`}
                  aria-pressed={state.deskLampEnabled}
                  aria-label="Toggle desk lamp / torch bulb"
                  onClick={() => state.toggleDeskLamp()}
                  title={state.deskLampEnabled ? "Desk Lamp: ON" : "Desk Lamp: OFF"}
                >
                  {state.deskLampEnabled ? "Lamp: ON" : "Lamp: OFF"}
                </button>
                <button
                  className="hud-btn small"
                  onClick={() => {
                    manuscript.loadText(SAMPLE_MANUSCRIPT, performance.now());
                    state.showPlaqueKey("plaque.sample");
                  }}
                  aria-label="Load the sample manuscript"
                >
                  {t("btn.sample")}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div className="panel-stats" aria-live="off">
        <span>
          {state.stats.words} {state.stats.words === 1 ? t("stats.word") : t("stats.words")} ·{" "}
          {state.stats.pages} {state.stats.pages === 1 ? t("stats.page") : t("stats.pages")} · L
          {state.stats.line + 1} C{state.stats.col + 1}
        </span>
      </div>
    </div>
  );
}
