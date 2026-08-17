import { useState, useEffect, useRef } from "react";
import { useStore } from "../app/store";
import { getCore } from "../app/core";
import {
  type ProjectManuscript,
  getProject,
  saveProject,
  syncActiveManuscriptToLibrary,
} from "../document/libraryStorage";
import {
  Save,
  Type,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  Heading1,
  Heading2,
  Quote,
  CheckCircle,
  Clock,
  BookOpen,
} from "lucide-react";

interface DocumentEditorProps {
  projectId: string | null;
  onBackToLibrary: () => void;
  onResumeInTypewriter: (project: ProjectManuscript) => void;
}

export function DocumentEditor({
  projectId,
  onBackToLibrary,
  onResumeInTypewriter,
}: DocumentEditorProps) {
  const state = useStore();
  const core = getCore();

  const [project, setProject] = useState<ProjectManuscript | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [fontFamily, setFontFamily] = useState("Courier Prime");
  const [fontSize, setFontSize] = useState(16);
  const [alignment, setAlignment] = useState<"left" | "center" | "right">("left");
  const [savedStatus, setSavedStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [selectedTag, setSelectedTag] = useState("Draft");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Load project on mount or when projectId changes
  useEffect(() => {
    if (projectId) {
      const p = getProject(projectId);
      if (p) {
        setProject(p);
        setTitle(p.title);
        setAuthor(p.author || "Platen Scribe");
        setContent(p.text || "");
        setSelectedTag(p.tags[0] || "Draft");
      }
    } else {
      // Sync from active typewriter if no project specified
      const activeProj = syncActiveManuscriptToLibrary(
        core.manuscript,
        state.documentTitle || "Active Manuscript",
      );
      setProject(activeProj);
      setTitle(activeProj.title);
      setAuthor(activeProj.author || "Platen Scribe");
      setContent(activeProj.text || "");
      setSelectedTag(activeProj.tags[0] || "Active Typewriter");
    }
  }, [projectId, core.manuscript, state.documentTitle]);

  // Debounced auto-save to library
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setSavedStatus("unsaved");

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      if (project) {
        setSavedStatus("saving");
        const updated = saveProject({
          id: project.id,
          title,
          author,
          text: newContent,
          tags: [selectedTag],
        });
        if (updated) {
          setProject(updated);
          setSavedStatus("saved");
        }
      }
    }, 800);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (project) {
      saveProject({ id: project.id, title: newTitle });
    }
  };

  const handleAuthorChange = (newAuthor: string) => {
    setAuthor(newAuthor);
    if (project) {
      saveProject({ id: project.id, author: newAuthor });
    }
  };

  // Formatting helpers for the markdown/typewriter document editor
  const applyFormat = (prefix: string, suffix = "") => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selectedText = content.substring(start, end);
    const replacement = `${prefix}${selectedText || "text"}${suffix}`;

    const newContent =
      content.substring(0, start) + replacement + content.substring(end);
    handleContentChange(newContent);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(
        start + prefix.length,
        start + replacement.length - suffix.length,
      );
    }, 10);
  };

  const insertLinePrefix = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const newContent =
      content.substring(0, lineStart) + prefix + content.substring(lineStart);
    handleContentChange(newContent);

    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length);
    }, 10);
  };

  // Metrics
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;
  const lines = content.split("\n").length;
  const pages = Math.max(1, Math.ceil(lines / 34));
  const readingTimeMin = Math.max(1, Math.ceil(words / 200));

  const handleSendToTypewriter = () => {
    if (!project) return;
    // Save current content first
    saveProject({
      id: project.id,
      title,
      author,
      text: content,
      tags: [selectedTag],
    });

    // Load into typewriter manuscript
    core.manuscript.loadText(content, 0);
    state.setDocumentTitle(title);
    onResumeInTypewriter(project);
  };

  return (
    <div className="doc-editor-container">
      {/* Top Header */}
      <div className="doc-editor-header">
        <div className="doc-editor-header-left">
          <button
            className="hud-btn small ghost"
            onClick={onBackToLibrary}
            aria-label="Back to Library"
            title="Return to Projects & Library"
          >
            ← Library
          </button>
          <div className="doc-title-input-wrapper">
            <input
              type="text"
              className="doc-title-input"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Document Title"
              aria-label="Document Title"
            />
            <div className="doc-meta-row">
              <input
                type="text"
                className="doc-author-input"
                value={author}
                onChange={(e) => handleAuthorChange(e.target.value)}
                placeholder="Author Name"
                aria-label="Author Name"
              />
              <span className="doc-status-badge">
                {savedStatus === "saved" && (
                  <>
                    <CheckCircle size={11} className="text-emerald-400" /> Saved Locally
                  </>
                )}
                {savedStatus === "saving" && "Saving…"}
                {savedStatus === "unsaved" && "● Unsaved edits"}
              </span>
            </div>
          </div>
        </div>

        <div className="doc-editor-header-right">
          <button
            className="hud-btn small"
            onClick={() => {
              if (project) {
                saveProject({ id: project.id, title, author, text: content });
                setSavedStatus("saved");
                state.showPlaqueKey("plaque.draftSaved");
              }
            }}
            title="Save Manuscript Immediately"
          >
            <Save size={13} style={{ marginRight: "4px" }} /> Save
          </button>

          <button
            className="hud-btn small accent"
            onClick={handleSendToTypewriter}
            title="Load this manuscript into the 3D Typewriter canvas and resume mechanical typing"
          >
            <Type size={13} style={{ marginRight: "6px" }} /> Resume in 3D Typewriter
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="doc-toolbar">
        <div className="doc-toolbar-group">
          <select
            className="doc-toolbar-select"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            title="Font Family"
          >
            <option value="Courier Prime">Courier Prime (Standard)</option>
            <option value="Space Mono">Space Mono (Editorial)</option>
            <option value="Special Elite">Special Elite (Weathered)</option>
            <option value="IBM Plex Mono">IBM Plex Mono (Selectric)</option>
            <option value="Cutive Mono">Cutive Mono (Remington Serif)</option>
          </select>

          <select
            className="doc-toolbar-select small"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            title="Font Size"
          >
            <option value="14">14px</option>
            <option value="16">16px</option>
            <option value="18">18px</option>
            <option value="20">20px</option>
            <option value="22">22px</option>
          </select>
        </div>

        <div className="doc-toolbar-divider" />

        <div className="doc-toolbar-group">
          <button
            className="doc-tool-btn"
            onClick={() => insertLinePrefix("# ")}
            title="Heading 1"
          >
            <Heading1 size={14} />
          </button>
          <button
            className="doc-tool-btn"
            onClick={() => insertLinePrefix("## ")}
            title="Heading 2"
          >
            <Heading2 size={14} />
          </button>
          <button
            className="doc-tool-btn"
            onClick={() => applyFormat("**", "**")}
            title="Bold"
          >
            <Bold size={14} />
          </button>
          <button
            className="doc-tool-btn"
            onClick={() => applyFormat("*", "*")}
            title="Italic"
          >
            <Italic size={14} />
          </button>
          <button
            className="doc-tool-btn"
            onClick={() => applyFormat("__", "__")}
            title="Underline"
          >
            <Underline size={14} />
          </button>
          <button
            className="doc-tool-btn"
            onClick={() => applyFormat("~~", "~~")}
            title="Strikethrough"
          >
            <Strikethrough size={14} />
          </button>
        </div>

        <div className="doc-toolbar-divider" />

        <div className="doc-toolbar-group">
          <button
            className={`doc-tool-btn ${alignment === "left" ? "active" : ""}`}
            onClick={() => setAlignment("left")}
            title="Align Left"
          >
            <AlignLeft size={14} />
          </button>
          <button
            className={`doc-tool-btn ${alignment === "center" ? "active" : ""}`}
            onClick={() => setAlignment("center")}
            title="Align Center"
          >
            <AlignCenter size={14} />
          </button>
          <button
            className={`doc-tool-btn ${alignment === "right" ? "active" : ""}`}
            onClick={() => setAlignment("right")}
            title="Align Right"
          >
            <AlignRight size={14} />
          </button>
          <button
            className="doc-tool-btn"
            onClick={() => insertLinePrefix("> ")}
            title="Blockquote"
          >
            <Quote size={14} />
          </button>
          <button
            className="doc-tool-btn"
            onClick={() => insertLinePrefix("- ")}
            title="Bullet List"
          >
            <List size={14} />
          </button>
        </div>

        <div className="doc-toolbar-divider" />

        <div className="doc-toolbar-group">
          <button
            className="doc-tool-btn"
            onClick={() => {
              const el = textareaRef.current;
              if (!el) return;
              const start = el.selectionStart;
              const replacement = `\n\n\f--- PAGE BREAK ---\n\n`;
              const newContent =
                content.substring(0, start) + replacement + content.substring(start);
              handleContentChange(newContent);
            }}
            title="Insert Page/Sheet Break"
          >
            <BookOpen size={14} style={{ marginRight: "3px" }} /> Page Break
          </button>
        </div>

        <div className="doc-toolbar-meta">
          <span>{words} words</span>
          <span>·</span>
          <span>{chars} chars</span>
          <span>·</span>
          <span>{pages} {pages === 1 ? "page" : "pages"}</span>
          <span>·</span>
          <span title="Estimated silent reading time">
            <Clock size={11} style={{ display: "inline", marginRight: "2px", verticalAlign: "middle" }} />
            {readingTimeMin} min
          </span>
        </div>
      </div>

      {/* Main Document Workspace */}
      <div className="doc-workspace">
        <div className="doc-page-container">
          <div className="doc-page-sheet" style={{ fontFamily }}>
            <div className="doc-sheet-watermark">PLATEN BOND · SOVEREIGN WRITING</div>
            <textarea
              ref={textareaRef}
              className="doc-sheet-textarea"
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Begin writing your manuscript here... Ink, steel, and intention."
              style={{
                fontFamily,
                fontSize: `${fontSize}px`,
                textAlign: alignment,
                lineHeight: "1.75",
              }}
              spellCheck={false}
              aria-label="Manuscript Content"
            />
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="doc-editor-footer">
        <div>
          <span>Local Storage: <strong>Encrypted in Browser Cache</strong></span>
          <span style={{ margin: "0 8px" }}>·</span>
          <span>Zero Server Uploads</span>
        </div>
        <div>
          <span>Press <strong>ESC</strong> to return to Typewriter</span>
        </div>
      </div>
    </div>
  );
}
