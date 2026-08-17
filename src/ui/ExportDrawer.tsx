import { useEffect, useState } from "react";
import { getCore } from "../app/core";
import { useStore } from "../app/store";
import { t } from "../app/i18n";
import { buildDocx, DOCX_MIME, type OverstrikeMode } from "../export/buildDocx";
import { buildPdf } from "../export/buildPdf";
import { buildHtml } from "../export/buildHtml";
import { buildTextExport } from "../export/buildText";
import { buildCompleteArchive } from "../export/exportArchive";
import { getCanvasVideoRecorder } from "../recorder/CanvasVideoRecorder";
import { getKeystrokeLedger, type CadenceMetrics } from "../recorder/KeystrokeLedger";
import { injectOwnershipWatermark } from "../steganography/SteganographyEncoder";

const FONT_URL = "fonts/CourierPrime-Regular.ttf";

export type ExportFormat = "pdf" | "docx" | "html" | "md" | "txt" | "zip";

interface ExportFileInfo {
  fileName: string;
  size: number;
  format: string;
  note?: string;
}

export function ExportDrawer() {
  const open = useStore((s) => s.exportOpen);
  const setOpen = useStore((s) => s.setExportOpen);
  const exporting = useStore((s) => s.exporting);
  const setExporting = useStore((s) => s.setExporting);
  const error = useStore((s) => s.exportError);
  const setError = useStore((s) => s.setExportError);

  const recording = useStore((s) => s.recording);
  const setRecording = useStore((s) => s.setRecording);
  const setHasRecordedVideo = useStore((s) => s.setHasRecordedVideo);

  const core = getCore();
  const recorder = getCanvasVideoRecorder();
  const ledger = getKeystrokeLedger();

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("pdf");
  const [overstrikeMode, setOverstrikeMode] = useState<OverstrikeMode>("final");
  const [fontAvailable, setFontAvailable] = useState<boolean | null>(null);
  const [certExporting, setCertExporting] = useState(false);
  const [metrics, setMetrics] = useState<CadenceMetrics | null>(null);
  const [lastExport, setLastExport] = useState<ExportFileInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    setLastExport(null);
    setError(null);
    setMetrics(ledger.getMetrics());

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
  }, [open, setError, ledger]);

  if (!open) return null;

  const manuscript = core.manuscript;
  const hasVideo = recorder.hasRecording();
  const videoBlob = recorder.getVideoBlob();
  const videoSizeMb = videoBlob ? (videoBlob.size / (1024 * 1024)).toFixed(1) : null;

  const triggerDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 8000);
  };

  const handleExport = async (formatToExport: ExportFormat = selectedFormat) => {
    if (exporting || manuscript.charCount === 0) return;
    setExporting(true);
    setError(null);
    setLastExport(null);

    try {
      const cleanTitle = title.trim();
      const cleanAuthor = author.trim();
      const currentMetrics = ledger.getMetrics();

      if (formatToExport === "pdf") {
        const res = await buildPdf(manuscript, {
          title: cleanTitle,
          author: cleanAuthor,
          overstrikeMode,
          entropyScore: currentMetrics?.cadenceEntropyScore,
          keystrokeCount: currentMetrics?.totalKeystrokes,
        });
        triggerDownload(res.blob, res.fileName);
        setLastExport({
          fileName: res.fileName,
          size: res.size,
          format: "PDF Document",
          note: "A4 Monospace layout with embedded zero-width seal.",
        });
        useStore.getState().showPlaque("SOVEREIGN PDF EXPORTED", 4000);
      } else if (formatToExport === "docx") {
        let fontData: ArrayBuffer | undefined;
        try {
          const response = await fetch(FONT_URL);
          if (response.ok) fontData = await response.arrayBuffer();
        } catch {
          fontData = undefined;
        }

        const res = await buildDocx(manuscript, {
          title: cleanTitle,
          author: cleanAuthor,
          overstrikeMode,
          embedFont: fontData !== undefined,
          fontData,
          entropyScore: currentMetrics?.cadenceEntropyScore,
          keystrokeCount: currentMetrics?.totalKeystrokes,
        });
        const blob = new Blob([res.bytes.buffer as ArrayBuffer], { type: DOCX_MIME });
        triggerDownload(blob, res.fileName);
        setLastExport({
          fileName: res.fileName,
          size: res.size,
          format: "Word (.docx)",
          note: res.fontEmbedded ? "Courier Prime embedded + zero-width seal." : "System Courier Prime + zero-width seal.",
        });
        useStore.getState().showPlaque("SOVEREIGN DOCX EXPORTED", 4000);
      } else if (formatToExport === "html") {
        const res = await buildHtml(manuscript, {
          title: cleanTitle,
          author: cleanAuthor,
          overstrikeMode,
          entropyScore: currentMetrics?.cadenceEntropyScore,
          keystrokeCount: currentMetrics?.totalKeystrokes,
        });
        triggerDownload(res.blob, res.fileName);
        setLastExport({
          fileName: res.fileName,
          size: res.size,
          format: "Web Archive (.html)",
          note: "Standalone vintage HTML page with print stylesheet & seal.",
        });
        useStore.getState().showPlaque("VINTAGE WEB ARCHIVE EXPORTED", 4000);
      } else if (formatToExport === "md" || formatToExport === "txt") {
        const res = await buildTextExport(manuscript, {
          title: cleanTitle,
          author: cleanAuthor,
          format: formatToExport,
          entropyScore: currentMetrics?.cadenceEntropyScore,
          keystrokeCount: currentMetrics?.totalKeystrokes,
        });
        triggerDownload(res.blob, res.fileName);
        setLastExport({
          fileName: res.fileName,
          size: res.size,
          format: formatToExport === "md" ? "Markdown (.md)" : "Plain Text (.txt)",
          note: "Clean character stream with invisible zero-width seal.",
        });
        useStore.getState().showPlaque(`${formatToExport.toUpperCase()} DOCUMENT EXPORTED`, 4000);
      } else if (formatToExport === "zip") {
        let fontData: ArrayBuffer | undefined;
        try {
          const response = await fetch(FONT_URL);
          if (response.ok) fontData = await response.arrayBuffer();
        } catch {
          fontData = undefined;
        }

        const res = await buildCompleteArchive(manuscript, {
          title: cleanTitle,
          author: cleanAuthor,
          overstrikeMode,
          embedFont: fontData !== undefined,
          fontData,
        });
        triggerDownload(res.blob, res.fileName);
        setLastExport({
          fileName: res.fileName,
          size: res.size,
          format: "Complete Archive (.zip)",
          note: "PDF, DOCX, HTML, MD, TXT, Certificates & Video included.",
        });
        useStore.getState().showPlaque("COMPLETE SOVEREIGN ARCHIVE EXPORTED", 4000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  const doExportVideo = async () => {
    if (recording) {
      const blob = await recorder.stop();
      if (blob && blob.size > 0) {
        setHasRecordedVideo(true);
        setRecording(false);
        recorder.download();
      }
    } else if (hasVideo) {
      recorder.download();
    }
  };

  const doExportCertificate = async () => {
    if (certExporting) return;
    setCertExporting(true);
    try {
      const text = manuscript.getText();
      await ledger.downloadCertificate(
        text,
        title.trim() || "Untitled Manuscript",
        author.trim() || "Anonymous Human Author",
        manuscript.pages.length,
      );
      useStore.getState().showPlaque("AUTHORSHIP CERTIFICATE DOWNLOADED", 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCertExporting(false);
    }
  };

  const getFormatActionLabel = () => {
    switch (selectedFormat) {
      case "pdf":
        return t("export.goPdf");
      case "docx":
        return t("export.goDocx");
      case "html":
        return t("export.goHtml");
      case "md":
        return t("export.goMd");
      case "txt":
        return t("export.goTxt");
      case "zip":
        return t("export.goZip");
      default:
        return t("export.go");
    }
  };

  return (
    <div className="drawer-backdrop" onClick={() => setOpen(false)}>
      <aside className="drawer export-drawer-expanded" aria-label={t("export.settings")} onClick={(event) => event.stopPropagation()}>
        <div className="part-info-head">
          <span className="part-info-system">{t("export.title")}</span>
          <button className="hud-btn small" onClick={() => setOpen(false)} aria-label="Close export settings">
            ×
          </button>
        </div>

        {/* --- Document Metadata --- */}
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

        {/* --- Export Format Selector Grid --- */}
        <div className="field">
          <span>{t("export.format")}</span>
          <div className="format-picker-grid">
            <button
              type="button"
              className={`format-card ${selectedFormat === "pdf" ? "active" : ""}`}
              onClick={() => setSelectedFormat("pdf")}
            >
              <span className="format-ext">.PDF</span>
              <span className="format-desc">Printable PDF</span>
            </button>
            <button
              type="button"
              className={`format-card ${selectedFormat === "docx" ? "active" : ""}`}
              onClick={() => setSelectedFormat("docx")}
            >
              <span className="format-ext">.DOCX</span>
              <span className="format-desc">Word Doc</span>
            </button>
            <button
              type="button"
              className={`format-card ${selectedFormat === "html" ? "active" : ""}`}
              onClick={() => setSelectedFormat("html")}
            >
              <span className="format-ext">.HTML</span>
              <span className="format-desc">Web Page</span>
            </button>
            <button
              type="button"
              className={`format-card ${selectedFormat === "md" ? "active" : ""}`}
              onClick={() => setSelectedFormat("md")}
            >
              <span className="format-ext">.MD</span>
              <span className="format-desc">Markdown</span>
            </button>
            <button
              type="button"
              className={`format-card ${selectedFormat === "txt" ? "active" : ""}`}
              onClick={() => setSelectedFormat("txt")}
            >
              <span className="format-ext">.TXT</span>
              <span className="format-desc">Plain Text</span>
            </button>
            <button
              type="button"
              className={`format-card zip-card ${selectedFormat === "zip" ? "active" : ""}`}
              onClick={() => setSelectedFormat("zip")}
            >
              <span className="format-ext">.ZIP</span>
              <span className="format-desc">All Formats</span>
            </button>
          </div>
        </div>

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

        {/* --- Main Document Export Action --- */}
        <button
          className="hud-btn accent wide"
          onClick={() => handleExport(selectedFormat)}
          disabled={exporting || manuscript.charCount === 0}
          aria-label="Generate and download the sovereign document"
        >
          {exporting ? t("export.generating") : getFormatActionLabel()}
        </button>

        {lastExport && (
          <div className="export-result" role="status">
            <div style={{ fontWeight: 600, color: "var(--nickel)" }}>{lastExport.fileName}</div>
            <div>
              {(lastExport.size / 1024).toFixed(1)} KB · {lastExport.format} · <span style={{ color: "#72db8d" }}>✓ Sealed</span>
            </div>
            {lastExport.note && <div className="field-note">{lastExport.note}</div>}
          </div>
        )}

        {/* --- PROOF OF HUMAN AUTHORSHIP SECTION --- */}
        <div className="export-proof-section">
          <div className="export-proof-header">
            <span className="export-proof-badge">🛡️ PROOF OF HUMAN AUTHORSHIP</span>
          </div>
          <p className="export-proof-desc">
            {t("export.proofDesc")}
          </p>

          {metrics && metrics.totalKeystrokes > 0 && (
            <div className="export-telemetry-card">
              <div className="telemetry-stat">
                <span className="telemetry-val">{metrics.totalKeystrokes}</span>
                <span className="telemetry-lbl">Keystrokes</span>
              </div>
              <div className="telemetry-stat">
                <span className="telemetry-val">{Math.round(metrics.cadenceEntropyScore * 100)}%</span>
                <span className="telemetry-lbl">Human Variance</span>
              </div>
              <div className="telemetry-stat">
                <span className="telemetry-val">{metrics.backspaceCount}</span>
                <span className="telemetry-lbl">Revisions</span>
              </div>
              <div className="telemetry-stat">
                <span className="telemetry-val">{metrics.medianIkiMs}ms</span>
                <span className="telemetry-lbl">Median IKI</span>
              </div>
            </div>
          )}

          {/* Export Video Proof Button */}
          <button
            className={`hud-btn wide proof-btn ${recording ? "recording" : ""}`}
            onClick={doExportVideo}
            disabled={!recording && !hasVideo}
            aria-label="Export recorded WebM video proof"
          >
            {recording
              ? "⏹ STOP & SAVE VIDEO PROOF (.WEBM)"
              : hasVideo
                ? `EXPORT VIDEO PROOF (.WEBM) · ${videoSizeMb} MB`
                : t("export.exportVideo")}
          </button>
          {!recording && !hasVideo && (
            <div className="field-note dim" style={{ marginTop: "4px", textAlign: "center" }}>
              {t("export.noVideoYet")}
            </div>
          )}

          {/* Export Cryptographic Authorship Certificate Button */}
          <button
            className="hud-btn wide proof-btn"
            style={{ marginTop: "8px" }}
            onClick={doExportCertificate}
            disabled={certExporting || (metrics ? metrics.totalKeystrokes === 0 : true)}
            aria-label="Export Authorship Certificate JSON"
          >
            {certExporting ? "GENERATING SIGNED CERTIFICATE…" : t("export.exportCert")}
          </button>

          {/* Copy Text with Invisible Steganographic Seal */}
          <button
            className="hud-btn wide proof-btn"
            style={{ marginTop: "8px" }}
            onClick={async () => {
              const text = manuscript.getText();
              if (!text.trim()) return;
              const watermarked = await injectOwnershipWatermark(text, {
                author: author.trim() || undefined,
                title: title.trim() || undefined,
                entropyScore: metrics?.cadenceEntropyScore,
                keystrokeCount: metrics?.totalKeystrokes,
              });
              await navigator.clipboard.writeText(watermarked);
              useStore.getState().showPlaqueKey("plaque.copiedWatermarked", 4500);
            }}
            disabled={manuscript.charCount === 0}
            aria-label="Copy text with embedded zero-width invisible ownership watermark"
          >
            📋 COPY WITH INVISIBLE SOVEREIGN SEAL
          </button>

          {/* Open Verifier Drawer */}
          <button
            className="hud-btn wide ghost"
            style={{ marginTop: "8px", borderColor: "var(--line)" }}
            onClick={() => {
              setOpen(false);
              useStore.getState().setVerifyOpen(true);
            }}
            aria-label="Open Ownership Verifier"
          >
            🔍 OPEN OWNERSHIP & CADENCE VERIFIER
          </button>

          <div className="field-note dim" style={{ marginTop: "6px", textAlign: "center" }}>
            Zero-width cryptographic steganography · Write to hold, own and carry.
          </div>
        </div>

        {error && (
          <div className="export-error" role="alert">
            {t("export.failed")}
            <br />
            {error}
          </div>
        )}
        <div className="field-note dim" style={{ marginTop: "14px" }}>{t("export.privacy")}</div>
      </aside>
    </div>
  );
}
