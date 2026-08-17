import { useState, useEffect } from "react";
import { useStore } from "../app/store";
import { getCore } from "../app/core";
import {
  type ProjectManuscript,
  getLibrary,
  createProject,
  deleteProject,
  duplicateProject,
  syncActiveManuscriptToLibrary,
} from "../document/libraryStorage";
import { DocumentEditor } from "./DocumentEditor";
import {
  FolderOpen,
  FileEdit,
  Sliders,
  Info,
  Plus,
  Trash2,
  Copy,
  Type,
  BookOpen,
  ShieldCheck,
  Search,
  Sparkles,
  Volume2,
  Sun,
  X,
} from "lucide-react";
import type { MachineTheme } from "../scene/Materials";

const THEMES: Array<{ id: MachineTheme; name: string; hex: string; desc: string }> = [
  { id: "midnight", name: "Midnight Black", hex: "#181818", desc: "Glossy Jet Enamel with nickel trim" },
  { id: "olive", name: "Vintage Olive", hex: "#3B4436", desc: "1930s Army & Office Green" },
  { id: "burgundy", name: "Burgundy Maroon", hex: "#4A1521", desc: "Art Deco deep burgundy lacquer" },
  { id: "turquoise", name: "Seafoam Turquoise", hex: "#2A6066", desc: "Mid-Century vibrant turquoise" },
  { id: "silver", name: "Brushed Silver", hex: "#D4D4D8", desc: "Industrial machined aluminum" },
];

export function MainMenuModal() {
  const state = useStore();
  const core = getCore();
  const open = state.mainMenuOpen;

  const [tab, setTab] = useState<"library" | "editor" | "options" | "about">("library");
  const [projects, setProjects] = useState<ProjectManuscript[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activeEditingId, setActiveEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Sync state tab
  useEffect(() => {
    if (state.mainMenuTab) {
      setTab(state.mainMenuTab);
    }
  }, [state.mainMenuTab]);

  // Load library projects whenever menu opens or updates
  useEffect(() => {
    if (open) {
      // Sync active typewriter manuscript first so the user's latest typed work is always available in the library!
      if (!core.manuscript.isEmpty) {
        syncActiveManuscriptToLibrary(
          core.manuscript,
          state.documentTitle || "Active Typewriter Draft",
        );
      }
      setProjects(getLibrary());
    }
  }, [open, core.manuscript, state.documentTitle]);

  const refreshList = () => {
    setProjects(getLibrary());
  };

  const handleCreateNew = () => {
    const newProj = createProject("New Manuscript Draft", "Platen Scribe", "");
    refreshList();
    setActiveEditingId(newProj.id);
    setTab("editor");
  };

  const handleDelete = (id: string) => {
    deleteProject(id);
    setDeleteConfirmId(null);
    refreshList();
  };

  const handleDuplicate = (id: string) => {
    duplicateProject(id);
    refreshList();
    state.showPlaque("MANUSCRIPT DUPLICATED IN LIBRARY", 3000);
  };

  const handleResumeInTypewriter = (proj: ProjectManuscript) => {
    // If project has high-fidelity manuscriptData, restore it, otherwise loadText
    if (proj.manuscriptData && proj.manuscriptData.pages) {
      core.manuscript.restore(proj.manuscriptData);
    } else {
      core.manuscript.loadText(proj.text, 0);
    }
    state.setDocumentTitle(proj.title);
    state.setCameraMode("write");
    state.setMainMenuOpen(false);
    state.showPlaque(`RESUMED: "${proj.title.toUpperCase()}"`, 3500);
  };

  const handleOpenInEditor = (proj: ProjectManuscript) => {
    setActiveEditingId(proj.id);
    setTab("editor");
  };

  if (!open) return null;

  // Filter projects by search query and tag
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      searchQuery.trim() === "" ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = !selectedTag || p.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  const allTags = Array.from(new Set(projects.flatMap((p) => p.tags)));

  return (
    <div className="main-menu-overlay" onClick={() => state.setMainMenuOpen(false)}>
      <div
        className="main-menu-modal"
        role="dialog"
        aria-label="Platen Main Menu and Library"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Masthead Navigation Bar */}
        <header className="main-menu-header">
          <div className="main-menu-brand">
            <div className="brand-badge">PLATEN</div>
            <span className="brand-version">v.01 MECHANICAL INTERFACE</span>
          </div>

          {/* Tab Navigation */}
          <nav className="main-menu-nav">
            <button
              className={`main-nav-btn ${tab === "library" ? "active" : ""}`}
              onClick={() => {
                setTab("library");
                state.setMainMenuTab("library");
              }}
            >
              <FolderOpen size={14} />
              <span>Projects & Library</span>
              <span className="count-pill">{projects.length}</span>
            </button>

            <button
              className={`main-nav-btn ${tab === "editor" ? "active" : ""}`}
              onClick={() => {
                setTab("editor");
                state.setMainMenuTab("editor");
              }}
            >
              <FileEdit size={14} />
              <span>Document Editor</span>
            </button>

            <button
              className={`main-nav-btn ${tab === "options" ? "active" : ""}`}
              onClick={() => {
                setTab("options");
                state.setMainMenuTab("options");
              }}
            >
              <Sliders size={14} />
              <span>Options & Finish</span>
            </button>

            <button
              className={`main-nav-btn ${tab === "about" ? "active" : ""}`}
              onClick={() => {
                setTab("about");
                state.setMainMenuTab("about");
              }}
            >
              <Info size={14} />
              <span>About & Manifesto</span>
            </button>
          </nav>

          {/* Close / Resume button */}
          <button
            className="main-menu-close-btn"
            onClick={() => state.setMainMenuOpen(false)}
            aria-label="Close menu and resume typing"
            title="Resume writing (ESC)"
          >
            <span>Resume Typewriter</span>
            <span className="esc-key">ESC</span>
            <X size={16} />
          </button>
        </header>

        {/* Modal Main Body */}
        <div className="main-menu-content">
          {/* ═════════ TAB 1: PROJECTS & LIBRARY ═════════ */}
          {tab === "library" && (
            <div className="library-view">
              {/* Library Actions Toolbar */}
              <div className="library-toolbar">
                <div className="library-search-wrapper">
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    className="library-search-input"
                    placeholder="Search titles, text, or author..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="search-clear-btn"
                      onClick={() => setSearchQuery("")}
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="library-tag-filters">
                  <button
                    className={`tag-chip ${selectedTag === null ? "active" : ""}`}
                    onClick={() => setSelectedTag(null)}
                  >
                    All ({projects.length})
                  </button>
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      className={`tag-chip ${selectedTag === tag ? "active" : ""}`}
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>

                <button
                  className="hud-btn accent new-proj-btn"
                  onClick={handleCreateNew}
                >
                  <Plus size={14} style={{ marginRight: "6px" }} /> New Manuscript
                </button>
              </div>

              {/* Manuscript Cards Grid */}
              <div className="manuscripts-grid">
                {filteredProjects.length === 0 ? (
                  <div className="library-empty-state">
                    <BookOpen size={40} className="empty-icon" />
                    <h3>No manuscripts found</h3>
                    <p>Start a new manuscript or adjust your search filter.</p>
                    <button className="hud-btn accent" onClick={handleCreateNew}>
                      <Plus size={14} style={{ marginRight: "6px" }} /> Create First Manuscript
                    </button>
                  </div>
                ) : (
                  filteredProjects.map((proj) => {
                    const isDeleting = deleteConfirmId === proj.id;
                    const previewText =
                      proj.text && proj.text.trim()
                        ? proj.text.replace(/[\f\n\r]+/g, " ").slice(0, 160)
                        : "Empty manuscript page ready for steel impact...";

                    return (
                      <div key={proj.id} className="manuscript-card">
                        <div className="card-top">
                          <div className="card-tags">
                            {proj.tags.map((t) => (
                              <span key={t} className="card-tag">
                                {t}
                              </span>
                            ))}
                          </div>
                          <span className="card-date">
                            {new Date(proj.updatedAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        <h3 className="card-title">{proj.title}</h3>
                        <div className="card-author">By {proj.author || "Platen Scribe"}</div>

                        {/* Monospace Preview Sheet */}
                        <div className="card-preview-sheet">
                          <p className="card-preview-text">“{previewText}”</p>
                        </div>

                        {/* Detailed Metrics Badge */}
                        <div className="card-metrics">
                          <div className="metric-item">
                            <strong>{proj.stats.words}</strong>
                            <span>words</span>
                          </div>
                          <div className="metric-item">
                            <strong>{proj.stats.chars}</strong>
                            <span>chars</span>
                          </div>
                          <div className="metric-item">
                            <strong>{proj.stats.pages}</strong>
                            <span>{proj.stats.pages === 1 ? "page" : "pages"}</span>
                          </div>
                          <div className="metric-item">
                            <span className="metric-icon">
                              <ShieldCheck size={11} className="text-amber-400" />
                            </span>
                            <span>Local Seal</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="card-actions">
                          {isDeleting ? (
                            <div className="delete-confirm-row">
                              <span style={{ fontSize: "11px", color: "var(--ink-muted)" }}>
                                Delete draft?
                              </span>
                              <button
                                className="hud-btn small danger"
                                onClick={() => handleDelete(proj.id)}
                              >
                                Yes, Delete
                              </button>
                              <button
                                className="hud-btn small"
                                onClick={() => setDeleteConfirmId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                className="hud-btn small accent resume-btn"
                                onClick={() => handleResumeInTypewriter(proj)}
                                title="Load this manuscript into the 3D Typewriter canvas"
                              >
                                <Type size={12} style={{ marginRight: "4px" }} /> Resume
                              </button>

                              <button
                                className="hud-btn small"
                                onClick={() => handleOpenInEditor(proj)}
                                title="Edit in lightweight Word/Docs document editor"
                              >
                                <FileEdit size={12} style={{ marginRight: "4px" }} /> Edit
                              </button>

                              <button
                                className="hud-btn small ghost"
                                onClick={() => handleDuplicate(proj.id)}
                                title="Duplicate manuscript"
                              >
                                <Copy size={12} />
                              </button>

                              <button
                                className="hud-btn small ghost danger"
                                onClick={() => setDeleteConfirmId(proj.id)}
                                title="Remove from library"
                              >
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ═════════ TAB 2: DOCUMENT EDITOR ═════════ */}
          {tab === "editor" && (
            <DocumentEditor
              projectId={activeEditingId}
              onBackToLibrary={() => setTab("library")}
              onResumeInTypewriter={() => {
                state.setMainMenuOpen(false);
              }}
            />
          )}

          {/* ═════════ TAB 3: OPTIONS & PREFERENCES ═════════ */}
          {tab === "options" && (
            <div className="options-view">
              <div className="options-grid">
                {/* Section 1: Chassis Finish */}
                <div className="options-panel">
                  <div className="options-panel-header">
                    <Sparkles size={16} />
                    <h3>Chassis & Enamel Finish</h3>
                  </div>
                  <p className="options-panel-desc">
                    Select authentic lacquer, baked enamel, and metallic coatings from 1930s-1960s typewriter workshops.
                  </p>
                  <div className="theme-options-list">
                    {THEMES.map((th) => {
                      const active = state.machineTheme === th.id;
                      return (
                        <button
                          key={th.id}
                          className={`theme-option-btn ${active ? "active" : ""}`}
                          onClick={() => state.setMachineTheme(th.id)}
                        >
                          <span
                            className="theme-color-dot"
                            style={{ backgroundColor: th.hex }}
                          />
                          <div className="theme-meta">
                            <span className="theme-name">{th.name}</span>
                            <span className="theme-desc">{th.desc}</span>
                          </div>
                          {active && <span className="theme-check">✓ Active</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2: Audio & Mechanical Sound */}
                <div className="options-panel">
                  <div className="options-panel-header">
                    <Volume2 size={16} />
                    <h3>Mechanical Sound Engine</h3>
                  </div>
                  <p className="options-panel-desc">
                    Physical escapement clicks, typebar inertia clacks, return ratchet bell, and platen rubber acoustic damping.
                  </p>
                  <div className="options-controls-stack">
                    <div className="option-row">
                      <span>Mechanical Audio Sound</span>
                      <button
                        className={`hud-btn small ${state.soundOn ? "on" : ""}`}
                        onClick={() => {
                          core.sound.setEnabled(!state.soundOn);
                          state.toggleSound();
                        }}
                      >
                        {state.soundOn ? "Sound: ENABLED" : "Sound: MUTED"}
                      </button>
                    </div>

                    <div className="option-row">
                      <span>Unicode Input Adapter</span>
                      <button
                        className={`hud-btn small ${state.unicodeAdapter ? "on" : ""}`}
                        onClick={state.toggleUnicodeAdapter}
                      >
                        {state.unicodeAdapter ? "Unicode: ON" : "Unicode: OFF"}
                      </button>
                    </div>

                    <div className="option-row">
                      <span>Auto-Carriage Return</span>
                      <button
                        className={`hud-btn small ${state.autoReturn ? "on" : ""}`}
                        onClick={state.toggleAutoReturn}
                      >
                        {state.autoReturn ? "Auto-Return: ON" : "Auto-Return: OFF"}
                      </button>
                    </div>

                    <div className="option-row">
                      <span>Auto-Sheet Feed</span>
                      <button
                        className={`hud-btn small ${state.autoNextPage ? "on" : ""}`}
                        onClick={state.toggleAutoNextPage}
                      >
                        {state.autoNextPage ? "Auto-Sheet: ON" : "Auto-Sheet: OFF"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section 3: Lighting & Studio Atmosphere */}
                <div className="options-panel">
                  <div className="options-panel-header">
                    <Sun size={16} />
                    <h3>Lighting & Atmosphere</h3>
                  </div>
                  <p className="options-panel-desc">
                    Adjust real-time PBR studio fill, desk lamp spotlight, and dynamic clearcoat gloss reflections.
                  </p>
                  <div className="options-controls-stack">
                    <div className="option-row">
                      <span>Studio Ambient Light</span>
                      <button
                        className={`hud-btn small ${state.studioLightEnabled ? "on" : ""}`}
                        onClick={state.toggleStudioLight}
                      >
                        {state.studioLightEnabled ? "Studio: ON" : "Studio: OFF"}
                      </button>
                    </div>

                    <div className="option-row">
                      <span>Desk Lamp / Torch</span>
                      <button
                        className={`hud-btn small ${state.deskLampEnabled ? "on" : ""}`}
                        onClick={state.toggleDeskLamp}
                      >
                        {state.deskLampEnabled ? "Lamp: ON" : "Lamp: OFF"}
                      </button>
                    </div>

                    <div className="option-row">
                      <span>Clearcoat Reflections</span>
                      <button
                        className={`hud-btn small ${state.reflectionsEnabled ? "on" : ""}`}
                        onClick={state.toggleReflections}
                      >
                        {state.reflectionsEnabled ? "Reflect: ON" : "Reflect: OFF"}
                      </button>
                    </div>

                    <div className="option-row">
                      <span>Paper Conveyor Mode</span>
                      <div className="segmented">
                        <button
                          className={`hud-btn small seg ${state.feedMode === "scroll" ? "on" : ""}`}
                          onClick={() => state.setFeedMode("scroll")}
                        >
                          Continuous
                        </button>
                        <button
                          className={`hud-btn small seg ${state.feedMode === "sheet" ? "on" : ""}`}
                          onClick={() => state.setFeedMode("sheet")}
                        >
                          Single A4
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Cryptographic Authorship */}
                <div className="options-panel">
                  <div className="options-panel-header">
                    <ShieldCheck size={16} />
                    <h3>Sovereignty & Cryptography</h3>
                  </div>
                  <p className="options-panel-desc">
                    Zero-telemetry sovereign architecture. Keystroke flight time and entropy are signed locally with zero cloud dependencies.
                  </p>
                  <div className="security-summary-box">
                    <div className="security-row">
                      <span className="security-label">Cloud Telemetry:</span>
                      <span className="security-val text-emerald-400">Zero (Local Only)</span>
                    </div>
                    <div className="security-row">
                      <span className="security-label">Storage Target:</span>
                      <span className="security-val">Browser LocalStorage Vault</span>
                    </div>
                    <div className="security-row">
                      <span className="security-label">Authorship Seal:</span>
                      <span className="security-val">Steganographic Zero-Width Unicode</span>
                    </div>
                    <div className="security-row">
                      <span className="security-label">Physical Ledger:</span>
                      <span className="security-val">Nanosecond Flight Time Audit</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════ TAB 4: ABOUT & PHILOSOPHY ═════════ */}
          {tab === "about" && (
            <div className="about-view">
              <div className="about-hero">
                <h2>THE PLATEN MANIFESTO</h2>
                <p className="about-lead">
                  “No algorithms, no autocomplete—just ink, steel, and intention. Crafted for the weight of genuine writing.”
                </p>
              </div>

              <div className="about-grid">
                <div className="about-card">
                  <h3>Ink & Steel Philosophy</h3>
                  <p>
                    Every letter on this page arrived the slow way: a finger fell, a linkage turned, a steel bar rose from the basket, and a small block of type struck a ribbon against rubber and bone-white paper.
                  </p>
                  <p>
                    The machine does not remember anything. The paper does. What you write here is yours to hold, own, and carry.
                  </p>
                </div>

                <div className="about-card">
                  <h3>Sovereign Privacy</h3>
                  <p>
                    Platen is built from the ground up to never send your words across any network. There are no backend telemetry databases or external AI trackers. Everything is written and rendered directly in your browser.
                  </p>
                </div>

                <div className="about-card">
                  <h3>Mechanical Keystroke Ledger</h3>
                  <p>
                    Platen records the physical physics of every stroke: travel resistance, flight time variance, escapement movement, and cadence entropy, allowing you to export cryptographic proof of human authorship.
                  </p>
                </div>

                <div className="about-card">
                  <h3>Keyboard Shortcuts</h3>
                  <div className="shortcuts-table">
                    <div className="sc-row">
                      <kbd>ESC</kbd>
                      <span>Toggle Main Menu & Library</span>
                    </div>
                    <div className="sc-row">
                      <kbd>Enter</kbd>
                      <span>Carriage Return & Line Advance</span>
                    </div>
                    <div className="sc-row">
                      <kbd>Backspace</kbd>
                      <span>Step Carriage Back (Overstrike)</span>
                    </div>
                    <div className="sc-row">
                      <kbd>⌘ / Ctrl + Z</kbd>
                      <span>Undo Mechanical Stroke</span>
                    </div>
                    <div className="sc-row">
                      <kbd>⌘ / Ctrl + Enter</kbd>
                      <span>Insert Fresh Paper Sheet</span>
                    </div>
                    <div className="sc-row">
                      <kbd>PageUp / PageDown</kbd>
                      <span>Scroll Paper Platen Roller</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
