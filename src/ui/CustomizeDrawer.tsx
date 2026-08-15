import { useStore, type CameraMode } from "../app/store";
import type { MachineTheme } from "../scene/Materials";

const THEMES: Array<{ id: MachineTheme; name: string; hex: string; desc: string }> = [
  { id: "midnight", name: "Midnight Black", hex: "#181818", desc: "Glossy Jet Enamel with nickel trim" },
  { id: "olive", name: "Vintage Olive", hex: "#3B4436", desc: "1930s Army & Office Green" },
  { id: "burgundy", name: "Burgundy Maroon", hex: "#4A1521", desc: "Art Deco deep burgundy lacquer" },
  { id: "turquoise", name: "Seafoam Turquoise", hex: "#2A6066", desc: "Mid-Century vibrant turquoise" },
  { id: "silver", name: "Brushed Silver", hex: "#D4D4D8", desc: "Industrial machined aluminum" },
];

const WARMTH_PRESETS = [
  { label: "Daylight", hex: "#E8F0FE" },
  { label: "Studio Soft", hex: "#FFE4B5" },
  { label: "Warm Tungsten", hex: "#FFD9A6" },
  { label: "Amber Glow", hex: "#FFA834" },
];

const BULB_WARMTH_PRESETS = [
  { label: "Golden 2700K", hex: "#FFB86C" },
  { label: "Vintage Amber", hex: "#FF9632" },
  { label: "Soft 3500K", hex: "#FFE7C8" },
  { label: "Neutral 5000K", hex: "#FFFFFF" },
];

const CAMERAS: Array<{ id: CameraMode; label: string; desc: string }> = [
  { id: "write", label: "Write Mode", desc: "Direct downward line-of-sight to the typing horizon" },
  { id: "paper", label: "Paper Focus", desc: "Close-up view of the printed A4 sheet" },
  { id: "mechanism", label: "Mechanism", desc: "Side-angle view of typebars and escapement" },
  { id: "inspect", label: "Free Orbit", desc: "Full 360° mouse-pan and rotation" },
];

const FONTS = [
  { id: "Courier Prime", name: "Courier Prime", desc: "Classic 1930s Monospace Standard" },
  { id: "Special Elite", name: "Special Elite", desc: "Vintage Distressed & Weathered Ribbon" },
  { id: "Cutive Mono", name: "Cutive Mono", desc: "Remington Mechanical Book Serif" },
  { id: "IBM Plex Mono", name: "IBM Plex Mono", desc: "Selectric High-Precision Typewriter" },
  { id: "Space Mono", name: "Space Mono", desc: "Modernist Editorial Monospace" },
  { id: "DM Mono", name: "DM Mono", desc: "Clean Electric Sans-Monospace" },
];

export function CustomizeDrawer() {
  const open = useStore((s) => s.customizeOpen);
  const setOpen = useStore((s) => s.setCustomizeOpen);

  const documentTitle = useStore((s) => s.documentTitle);
  const setDocumentTitle = useStore((s) => s.setDocumentTitle);

  const feedMode = useStore((s) => s.feedMode);
  const setFeedMode = useStore((s) => s.setFeedMode);

  const typewriterFont = useStore((s) => s.typewriterFont);
  const setTypewriterFont = useStore((s) => s.setTypewriterFont);
  const typewriterFontSize = useStore((s) => s.typewriterFontSize);
  const setTypewriterFontSize = useStore((s) => s.setTypewriterFontSize);

  const autoReturn = useStore((s) => s.autoReturn);
  const toggleAutoReturn = useStore((s) => s.toggleAutoReturn);
  const autoNextPage = useStore((s) => s.autoNextPage);
  const toggleAutoNextPage = useStore((s) => s.toggleAutoNextPage);

  const theme = useStore((s) => s.machineTheme);
  const setTheme = useStore((s) => s.setMachineTheme);

  const studioLightEnabled = useStore((s) => s.studioLightEnabled);
  const setStudioLightEnabled = useStore((s) => s.setStudioLightEnabled);
  const lightIntensity = useStore((s) => s.lightIntensity);
  const setLightIntensity = useStore((s) => s.setLightIntensity);
  const lightWarmth = useStore((s) => s.lightWarmth);
  const setLightWarmth = useStore((s) => s.setLightWarmth);

  const reflectionsEnabled = useStore((s) => s.reflectionsEnabled);
  const setReflectionsEnabled = useStore((s) => s.setReflectionsEnabled);
  const reflectionIntensity = useStore((s) => s.reflectionIntensity);
  const setReflectionIntensity = useStore((s) => s.setReflectionIntensity);

  const deskLampEnabled = useStore((s) => s.deskLampEnabled);
  const setDeskLampEnabled = useStore((s) => s.setDeskLampEnabled);
  const deskLampIntensity = useStore((s) => s.deskLampIntensity);
  const setDeskLampIntensity = useStore((s) => s.setDeskLampIntensity);
  const deskLampWarmth = useStore((s) => s.deskLampWarmth);
  const setDeskLampWarmth = useStore((s) => s.setDeskLampWarmth);

  const cameraMode = useStore((s) => s.cameraMode);
  const setCameraMode = useStore((s) => s.setCameraMode);

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={() => setOpen(false)}>
      <aside
        className="drawer"
        aria-label="Studio and finish customization"
        onClick={(event) => event.stopPropagation()}
        style={{ width: "400px", maxHeight: "92vh", overflowY: "auto" }}
      >
        <div className="part-info-head">
          <span className="part-info-system">STUDIO & FINISH CUSTOMIZER</span>
          <button className="hud-btn small" onClick={() => setOpen(false)} aria-label="Close customizer">
            ×
          </button>
        </div>

        {/* --- Document Header Title --- */}
        <div style={{ marginTop: "12px" }}>
          <div className="section-label" style={{ marginBottom: "6px", color: "var(--nickel)", fontSize: "11px", letterSpacing: "0.1em" }}>
            PAGE HEADER TITLE
          </div>
          <label className="field" style={{ marginBottom: "6px" }}>
            <input
              type="text"
              value={documentTitle}
              onChange={(event) => setDocumentTitle(event.target.value)}
              placeholder="— THE IMPACT NO. 01 —"
              style={{ width: "100%", padding: "8px 10px", fontSize: "13px", boxSizing: "border-box" }}
              aria-label="Configurable page header title"
            />
          </label>
        </div>

        {/* --- Paper Feed Conveyor Mode --- */}
        <div style={{ marginTop: "12px" }}>
          <div className="section-label" style={{ marginBottom: "6px", color: "var(--nickel)", fontSize: "11px", letterSpacing: "0.1em" }}>
            PAPER FEED CONVEYOR
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button
              className={`hud-btn small ${feedMode === "scroll" ? "on" : ""}`}
              onClick={() => setFeedMode("scroll")}
              title="Continuous roll feed without page-end truncation"
            >
              Continuous Scroll
            </button>
            <button
              className={`hud-btn small ${feedMode === "sheet" ? "on" : ""}`}
              onClick={() => setFeedMode("sheet")}
              title="Standard single A4 sheet with visible drain into roller"
            >
              Standard Sheet (A4)
            </button>
          </div>
        </div>

        {/* --- Modern Automation Aids --- */}
        <div style={{ marginTop: "14px" }}>
          <div className="section-label" style={{ marginBottom: "8px", color: "var(--nickel)", fontSize: "11px", letterSpacing: "0.1em" }}>
            MODERN AUTOMATION AIDS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button
              className={`hud-btn small ${autoReturn ? "on" : ""}`}
              onClick={toggleAutoReturn}
              title="Auto-Return: Automatically executes carriage return at the right margin"
            >
              Auto-Return: {autoReturn ? "ON" : "OFF"}
            </button>
            <button
              className={`hud-btn small ${autoNextPage ? "on" : ""}`}
              onClick={toggleAutoNextPage}
              title="Auto-Sheet Feed: Automatically feeds new paper sheet when reaching page bottom"
            >
              Auto-Sheet: {autoNextPage ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* --- Typewriter Font & Text Size --- */}
        <div style={{ marginTop: "14px" }}>
          <div className="section-label" style={{ marginBottom: "8px", color: "var(--nickel)", fontSize: "11px", letterSpacing: "0.1em" }}>
            TYPEWRITER TYPOGRAPHY & PITCH
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "6px", marginBottom: "8px" }}>
            {FONTS.map((f) => {
              const active = typewriterFont === f.id;
              return (
                <button
                  key={f.id}
                  className={`hud-btn ${active ? "accent" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    textAlign: "left",
                  }}
                  onClick={() => setTypewriterFont(f.id)}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "12px", fontFamily: f.id }}>{f.name}</div>
                    <div style={{ fontSize: "10.5px", color: "var(--bone-dim)", marginTop: "1px" }}>{f.desc}</div>
                  </div>
                  {active && <span style={{ color: "var(--nickel)", fontSize: "12px" }}>✓</span>}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--bone-dim)" }}>Text Size / Pitch:</span>
            <div className="segmented">
              {[
                { label: "10pt", size: 42, title: "10 Pitch (Compact Pica)" },
                { label: "12pt", size: 50, title: "12 Pitch (Standard)" },
                { label: "14pt", size: 58, title: "14 Pitch (Large Elite)" },
                { label: "16pt", size: 66, title: "16 Pitch (Headline)" },
              ].map((s) => (
                <button
                  key={s.size}
                  className={`hud-btn small seg ${typewriterFontSize === s.size ? "on" : ""}`}
                  onClick={() => setTypewriterFontSize(s.size)}
                  title={s.title}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* --- Chassis Enamel Finish --- */}
        <div style={{ marginTop: "14px" }}>
          <div className="section-label" style={{ marginBottom: "8px", color: "var(--nickel)", fontSize: "11px", letterSpacing: "0.1em" }}>
            ENAMEL FINISH PRESETS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "6px" }}>
            {THEMES.map((t) => {
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  className={`hud-btn ${active ? "accent" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    textAlign: "left",
                    padding: "8px 12px",
                    border: active ? "1px solid var(--nickel)" : "1px solid var(--line-soft)",
                    background: active ? "rgba(176, 141, 87, 0.15)" : "rgba(20, 18, 16, 0.6)",
                  }}
                  onClick={() => setTheme(t.id)}
                >
                  <span
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      backgroundColor: t.hex,
                      border: "2px solid rgba(255,255,255,0.4)",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "12px" }}>{t.name}</div>
                    <div style={{ fontSize: "10.5px", color: "var(--bone-dim)", marginTop: "1px" }}>{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* --- Lighting Scenarios / Presets --- */}
        <div style={{ marginTop: "16px" }}>
          <div className="section-label" style={{ marginBottom: "8px", color: "var(--nickel)", fontSize: "11px", letterSpacing: "0.1em" }}>
            LIGHTING SCENARIO PRESETS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            <button
              className="hud-btn small"
              onClick={() => {
                setStudioLightEnabled(true);
                setLightIntensity(1.0);
                setDeskLampEnabled(true);
                setDeskLampIntensity(1.2);
                setReflectionsEnabled(true);
                setReflectionIntensity(0.85);
              }}
              title="Balanced studio fill with warm desk lamp spotlight"
            >
              Full Studio
            </button>
            <button
              className="hud-btn small"
              onClick={() => {
                setStudioLightEnabled(false);
                setDeskLampEnabled(true);
                setDeskLampIntensity(1.8);
                setReflectionsEnabled(true);
                setReflectionIntensity(0.85);
              }}
              title="Moody night scene lit solely by the banker's desk lamp"
            >
              Desk Lamp Only
            </button>
            <button
              className="hud-btn small"
              onClick={() => {
                setStudioLightEnabled(true);
                setLightIntensity(1.2);
                setDeskLampEnabled(true);
                setDeskLampIntensity(0.8);
                setReflectionsEnabled(false);
                setReflectionIntensity(1.0);
              }}
              title="Matte finish with zero environmental reflections"
            >
              Matte High Key
            </button>
            <button
              className="hud-btn small"
              onClick={() => {
                setStudioLightEnabled(true);
                setLightIntensity(0.3);
                setDeskLampEnabled(true);
                setDeskLampIntensity(0.7);
                setReflectionsEnabled(true);
                setReflectionIntensity(0.5);
              }}
              title="Dim intimate ambient lighting"
            >
              Intimate Dim
            </button>
          </div>
        </div>

        {/* --- Environment Reflections Control --- */}
        <div style={{ marginTop: "16px", padding: "10px", background: "rgba(0,0,0,0.25)", borderRadius: "4px", border: "1px solid var(--line-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--nickel)", letterSpacing: "0.08em" }}>
              ENVIRONMENT REFLECTIONS
            </span>
            <button
              className={`hud-btn small ${reflectionsEnabled ? "on" : ""}`}
              style={{ padding: "3px 10px", fontSize: "10.5px" }}
              onClick={() => setReflectionsEnabled(!reflectionsEnabled)}
            >
              {reflectionsEnabled ? "Reflections: ON" : "Reflections: OFF"}
            </button>
          </div>

          <label className="field" style={{ display: "block", marginBottom: "4px", opacity: reflectionsEnabled ? 1 : 0.45 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
              <span>Reflection Strength</span>
              <span>{reflectionsEnabled ? `${Math.round(reflectionIntensity * 100)}%` : "Disabled (0%)"}</span>
            </div>
            <input
              type="range"
              min={0}
              max={150}
              disabled={!reflectionsEnabled}
              value={reflectionsEnabled ? Math.round(reflectionIntensity * 100) : 0}
              style={{ width: "100%", accentColor: "var(--nickel)" }}
              onChange={(e) => setReflectionIntensity(Number(e.target.value) / 100)}
            />
          </label>
        </div>

        {/* --- Studio / Default Lighting Controls --- */}
        <div style={{ marginTop: "12px", padding: "10px", background: "rgba(0,0,0,0.25)", borderRadius: "4px", border: "1px solid var(--line-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--nickel)", letterSpacing: "0.08em" }}>
              STUDIO & AMBIENT LIGHT
            </span>
            <button
              className={`hud-btn small ${studioLightEnabled ? "on" : ""}`}
              style={{ padding: "3px 10px", fontSize: "10.5px" }}
              onClick={() => setStudioLightEnabled(!studioLightEnabled)}
            >
              {studioLightEnabled ? "Studio: ON" : "Studio: OFF"}
            </button>
          </div>

          <label className="field" style={{ display: "block", marginBottom: "8px", opacity: studioLightEnabled ? 1 : 0.45 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
              <span>Studio Intensity</span>
              <span>{studioLightEnabled ? `${Math.round(lightIntensity * 100)}%` : "0% (Off)"}</span>
            </div>
            <input
              type="range"
              min={0}
              max={220}
              disabled={!studioLightEnabled}
              value={studioLightEnabled ? Math.round(lightIntensity * 100) : 0}
              style={{ width: "100%", accentColor: "var(--nickel)" }}
              onChange={(e) => setLightIntensity(Number(e.target.value) / 100)}
            />
          </label>

          <div style={{ fontSize: "11px", marginBottom: "6px", opacity: studioLightEnabled ? 1 : 0.45 }}>Studio Warmth</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", opacity: studioLightEnabled ? 1 : 0.45 }}>
            {WARMTH_PRESETS.map((p) => {
              const active = lightWarmth.toLowerCase() === p.hex.toLowerCase();
              return (
                <button
                  key={p.hex}
                  disabled={!studioLightEnabled}
                  className={`hud-btn small ${active ? "on" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 8px",
                    fontSize: "11px",
                  }}
                  onClick={() => setLightWarmth(p.hex)}
                >
                  <span
                    style={{
                      width: "11px",
                      height: "11px",
                      borderRadius: "50%",
                      backgroundColor: p.hex,
                      border: "1px solid rgba(0,0,0,0.4)",
                    }}
                  />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* --- Desk Lamp / Torch / Bulb Controls --- */}
        <div style={{ marginTop: "12px", padding: "10px", background: "rgba(0,0,0,0.25)", borderRadius: "4px", border: "1px solid var(--line-soft)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--nickel)", letterSpacing: "0.08em" }}>
              DESK LAMP / TORCH BULB
            </span>
            <button
              className={`hud-btn small ${deskLampEnabled ? "on" : ""}`}
              style={{ padding: "3px 10px", fontSize: "10.5px" }}
              onClick={() => setDeskLampEnabled(!deskLampEnabled)}
            >
              {deskLampEnabled ? "Lamp: ON" : "Lamp: OFF"}
            </button>
          </div>

          <label className="field" style={{ display: "block", marginBottom: "8px", opacity: deskLampEnabled ? 1 : 0.45 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
              <span>Lamp Intensity</span>
              <span>{deskLampEnabled ? `${Math.round(deskLampIntensity * 100)}%` : "0% (Off)"}</span>
            </div>
            <input
              type="range"
              min={0}
              max={250}
              disabled={!deskLampEnabled}
              value={deskLampEnabled ? Math.round(deskLampIntensity * 100) : 0}
              style={{ width: "100%", accentColor: "var(--nickel)" }}
              onChange={(e) => setDeskLampIntensity(Number(e.target.value) / 100)}
            />
          </label>

          <div style={{ fontSize: "11px", marginBottom: "6px", opacity: deskLampEnabled ? 1 : 0.45 }}>Bulb Filament Color</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", opacity: deskLampEnabled ? 1 : 0.45 }}>
            {BULB_WARMTH_PRESETS.map((p) => {
              const active = deskLampWarmth.toLowerCase() === p.hex.toLowerCase();
              return (
                <button
                  key={p.hex}
                  disabled={!deskLampEnabled}
                  className={`hud-btn small ${active ? "on" : ""}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "5px 8px",
                    fontSize: "11px",
                  }}
                  onClick={() => setDeskLampWarmth(p.hex)}
                >
                  <span
                    style={{
                      width: "11px",
                      height: "11px",
                      borderRadius: "50%",
                      backgroundColor: p.hex,
                      border: "1px solid rgba(0,0,0,0.4)",
                    }}
                  />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* --- Camera Presets --- */}
        <div style={{ marginTop: "16px" }}>
          <div className="section-label" style={{ marginBottom: "8px", color: "var(--nickel)", fontSize: "11px", letterSpacing: "0.1em" }}>
            CAMERA VIEWPOINTS
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {CAMERAS.map((c) => (
              <button
                key={c.id}
                className={`hud-btn small ${cameraMode === c.id ? "on" : ""}`}
                onClick={() => setCameraMode(c.id)}
                title={c.desc}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field-note dim" style={{ marginTop: "18px", marginBottom: "8px" }}>
          Dynamic environment reflection, clearcoat gloss, and dual-source PBR illumination are computed in real-time.
        </div>
      </aside>
    </div>
  );
}

