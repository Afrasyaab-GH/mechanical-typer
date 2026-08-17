import { useEffect, useRef } from "react";
import { useStore } from "../app/store";
import { getCore } from "../app/core";

export function Sidebar() {
  const state = useStore();
  const core = getCore();
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarOpen = state.sidebarOpen;
  const setSidebarOpen = state.setSidebarOpen;

  // Close sidebar on click outside or ESC key
  useEffect(() => {
    if (!sidebarOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".menu-trigger-btn")) return;
      if (sidebarRef.current && !sidebarRef.current.contains(target)) {
        setSidebarOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    const timer = setTimeout(() => {
      window.addEventListener("mousedown", handleOutsideClick);
      window.addEventListener("touchstart", handleOutsideClick);
      window.addEventListener("keydown", handleKeyDown);
    }, 50);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("touchstart", handleOutsideClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sidebarOpen, setSidebarOpen]);

  const handleNewManuscript = () => {
    state.setSidebarOpen(false);
    if (state.mainMenuOpen) {
      state.setMainMenuOpen(false);
    }
    if (!core.manuscript.isEmpty) {
      state.setClearConfirm(true);
    } else {
      state.setCameraMode("write");
      state.showPlaque("FRESH MANUSCRIPT SHEET LOADED", 3000);
    }
  };

  const handleOpenLibrary = () => {
    state.setSidebarOpen(false);
    state.setMainMenuTab("library");
    state.setMainMenuOpen(true);
  };

  const handleOpenArchive = () => {
    state.setSidebarOpen(false);
    state.setMainMenuTab("editor");
    state.setMainMenuOpen(true);
  };

  const handleOpenSettings = () => {
    state.setSidebarOpen(false);
    state.setCustomizeOpen(true);
  };

  const handleOpenAbout = () => {
    state.setSidebarOpen(false);
    state.setMainMenuTab("about");
    state.setMainMenuOpen(true);
  };

  const isWritingActive = !state.mainMenuOpen && !state.customizeOpen && !state.exportOpen && !state.verifyOpen;
  const isLibraryActive = state.mainMenuOpen && state.mainMenuTab === "library";
  const isArchiveActive = state.mainMenuOpen && state.mainMenuTab === "editor";
  const isSettingsActive = state.customizeOpen || (state.mainMenuOpen && state.mainMenuTab === "options");
  const isAboutActive = state.mainMenuOpen && state.mainMenuTab === "about";

  return (
    <>
      {/* Backdrop overlay for smooth window click-to-close */}
      <div
        className={`sidebar-backdrop ${state.sidebarOpen ? "open" : ""}`}
        onClick={() => state.setSidebarOpen(false)}
        aria-hidden={!state.sidebarOpen}
      />

      <aside
        ref={sidebarRef}
        className={`sidebar sidebar-drawer ${state.sidebarOpen ? "open" : ""}`}
        aria-label="Platen Navigation Drawer"
        aria-hidden={!state.sidebarOpen}
      >
        <div className="top-meta">
          <div className="brand-section">
            <div className="brand-header-row">
              <h1 className="brand-logo">PLATEN</h1>
              <button
                className="drawer-close-btn"
                onClick={() => state.setSidebarOpen(false)}
                aria-label="Close menu drawer"
                title="Close drawer (ESC)"
              >
                ✕
              </button>
            </div>
            <span className="brand-version">Mechanical Interface v.01</span>
          </div>

          <nav className="main-nav" aria-label="Main Navigation">
            <div className="nav-group">
              <span className="nav-label">Writing</span>
              <button
                className={`nav-item ${isWritingActive ? "active" : ""}`}
                onClick={handleNewManuscript}
                title="Start or focus typewriter manuscript"
              >
                <span className="nav-icon">✎</span> New Manuscript
              </button>
              <button
                className={`nav-item ${isLibraryActive ? "active" : ""}`}
                onClick={handleOpenLibrary}
                title="Open manuscripts library and drafts"
              >
                <span className="nav-icon">🗄</span> Library Files
              </button>
              <button
                className={`nav-item ${isArchiveActive ? "active" : ""}`}
                onClick={handleOpenArchive}
                title="Open distraction-free document editor & archive"
              >
                <span className="nav-icon">⏳</span> Document Editor / Archive
              </button>
            </div>

            <div className="nav-group">
              <span className="nav-label">System</span>
              <button
                className={`nav-item ${isSettingsActive ? "active" : ""}`}
                onClick={handleOpenSettings}
                title="Customize finishes, audio, and lighting"
              >
                <span className="nav-icon">⚙</span> Settings & Chassis
              </button>
              <button
                className={`nav-item ${isAboutActive ? "active" : ""}`}
                onClick={handleOpenAbout}
                title="About Platen and Sovereign Typing Manifesto"
              >
                <span className="nav-icon">ⓘ</span> About & Manifesto
              </button>
            </div>
          </nav>
        </div>

        <div className="sidebar-footer">
          Platen System [Secure Mode]<br />
          Writing resides locally.
        </div>
      </aside>
    </>
  );
}
