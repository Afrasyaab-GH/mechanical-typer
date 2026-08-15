import { useEffect, useState } from "react";
import { getCore } from "../app/core";
import { useStore } from "../app/store";
import { t } from "../app/i18n";
import { buildDocx, DOCX_MIME, type OverstrikeMode } from "../export/buildDocx";

const FONT_URL = "fonts/CourierPrime-Regular.ttf";

export function ExportDrawer() {
  const open = useStore((s) => s.exportOpen);
  const setOpen = useStore((s) => s.setExportOpen);
  const exporting = useStore((s) => s.exporting);
  const setExporting = useStore((s) => s.setExporting);
  const result = useStore((s) => s.exportResult);
  const setResult = useStore((s) => s.setExportResult);
  const error = useStore((s) => s.exportError);
  const setError = useStore((s) => s.setExportError);
  const core = getCore();

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [overstrikeMode, setOverstrikeMode] = useState<OverstrikeMode>("final");
  const [fontAvailable, setFontAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setError(null);
    let cancelled = false;
    fetch(FONT_URL)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.arrayBuffer();
      })
      .then(() => !cancelled && setFontAvailable(true))
      .catch(() => !cancelled && setFontAvailable(false));
    return () => {
      cancelled = true;
    };
  }, [open, setResult, setError]);

  if (!open) return null;

  const manuscript = core.manuscript;

  const doExport = async () => {
    if (exporting) return;
    setExporting(true);
    setError(null);
    setResult(null);
    try {
      let fontData: ArrayBuffer | undefined;
      try {
        const response = await fetch(FONT_URL);
        if (response.ok) fontData = await response.arrayBuffer();
      } catch {
        fontData = undefined;
      }
      const docx = await buildDocx(manuscript, {
        title: title.trim(),
        author: author.trim(),
        overstrikeMode,
        embedFont: fontData !== undefined,
        fontData,
      });
      const blob = new Blob([docx.bytes.buffer as ArrayBuffer], { type: DOCX_MIME });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = docx.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 8000);
      setResult(docx);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="drawer-backdrop" onClick={() => setOpen(false)}>
      <aside className="drawer" aria-label={t("export.settings")} onClick={(event) => event.stopPropagation()}>
        <div className="part-info-head">
          <span className="part-info-system">{t("export.title")}</span>
          <button className="hud-btn small" onClick={() => setOpen(false)} aria-label="Close export settings">
            ×
          </button>
        </div>
        <label className="field">
          <span>{t("export.docTitle")}</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("export.untitled")}
          />
        </label>
        <label className="field">
          <span>{t("export.author")}</span>
          <input value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="" />
        </label>
        <label className="field">
          <span>{t("export.overstrike")}</span>
          <select value={overstrikeMode} onChange={(event) => setOverstrikeMode(event.target.value as OverstrikeMode)}>
            <option value="final">{t("export.keepFinal")}</option>
            <option value="annotated">{t("export.annotated")}</option>
          </select>
        </label>
        <div className="field-note">
          {fontAvailable === null && t("export.fontChecking")}
          {fontAvailable === true && t("export.fontOk")}
          {fontAvailable === false && t("export.fontMissing")}
        </div>
        <div className="field-note">
          {manuscript.pages.length} {manuscript.pages.length === 1 ? t("stats.page") : t("stats.pages")} ·{" "}
          {manuscript.wordCount} {manuscript.wordCount === 1 ? t("stats.word") : t("stats.words")} ·{" "}
          {manuscript.charCount} {manuscript.charCount === 1 ? t("stats.character") : t("stats.characters")}
        </div>
        <button
          className="hud-btn accent wide"
          onClick={doExport}
          disabled={exporting || manuscript.charCount === 0}
          aria-label="Generate and download the DOCX file"
        >
          {exporting ? t("export.generating") : t("export.go")}
        </button>
        {result && (
          <div className="export-result" role="status">
            <div>{result.fileName}</div>
            <div>
              {(result.size / 1024).toFixed(1)} KB · {result.fontEmbedded ? t("export.embedded") : t("export.referenced")}
            </div>
            <div className="field-note">{result.fontNote}</div>
          </div>
        )}
        {error && (
          <div className="export-error" role="alert">
            {t("export.failed")}
            <br />
            {error}
          </div>
        )}
        <div className="field-note dim">{t("export.privacy")}</div>
      </aside>
    </div>
  );
}
