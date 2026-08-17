import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { useStore } from "../app/store";
import { t } from "../app/i18n";
import {
  verifyAndExtractOwnership,
  extractTextFromFile,
  type VerificationResult,
  stripZeroWidthCharacters,
} from "../steganography/SteganographyEncoder";

export function VerifyDrawer() {
  const open = useStore((s) => s.verifyOpen);
  const setOpen = useStore((s) => s.setVerifyOpen);

  const [inputText, setInputText] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loadedFileMeta, setLoadedFileMeta] = useState<{
    name: string;
    type: string;
    size: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const runVerification = async (textToVerify: string) => {
    if (!textToVerify.trim()) return;
    setVerifying(true);
    try {
      const res = await verifyAndExtractOwnership(textToVerify);
      setResult(res);
    } catch {
      setResult({
        hasWatermark: false,
        isValid: false,
        tampered: false,
        isUnaltered: false,
        similarityScore: 0,
        originalRetentionPercent: 0,
        postDraftModificationPercent: 0,
        verdictGrade: "unverified",
        statusHeadline: "VERIFICATION FAILED",
        statusDescription: "An error occurred while inspecting the cryptographic seal.",
        payload: null,
        extractedCleanText: stripZeroWidthCharacters(textToVerify),
        error: "Verification failed.",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleManualVerify = () => {
    runVerification(inputText);
  };

  const processFile = async (file: File) => {
    setVerifying(true);
    try {
      const { text, fileName, fileType } = await extractTextFromFile(file);
      setInputText(text);
      setLoadedFileMeta({
        name: fileName,
        type: fileType,
        size: `${(file.size / 1024).toFixed(1)} KB`,
      });
      await runVerification(text);
    } catch (err) {
      console.error("Error processing dropped file:", err);
      setResult({
        hasWatermark: false,
        isValid: false,
        tampered: false,
        isUnaltered: false,
        similarityScore: 0,
        originalRetentionPercent: 0,
        postDraftModificationPercent: 0,
        verdictGrade: "unverified",
        statusHeadline: "FILE READ ERROR",
        statusDescription: "Could not parse or extract text from the provided file.",
        payload: null,
        extractedCleanText: "",
        error: err instanceof Error ? err.message : "Failed to read file.",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await processFile(file);
    }
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await processFile(file);
    }
  };

  const handleClear = () => {
    setInputText("");
    setResult(null);
    setLoadedFileMeta(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="drawer-backdrop" onClick={() => setOpen(false)}>
      <aside
        className="drawer verify-drawer"
        aria-label="Verify Platen Document Ownership"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="part-info-head">
          <span className="part-info-system">PLATEN · OWNERSHIP & CADENCE VERIFIER</span>
          <button
            className="hud-btn small"
            onClick={() => setOpen(false)}
            aria-label="Close ownership verifier"
          >
            ×
          </button>
        </div>

        <div className="verify-hero">
          <div className="verify-hero-badge">📜 WRITE TO HOLD, OWN AND CARRY</div>
          <p className="field-note" style={{ marginTop: "4px" }}>
            Drop any exported Platen document (DOCX, PDF, TXT, MD, JSON Certificate) or paste text.
            The verifier inspects the invisible zero-width seal to certify authorship, original typing cadence,
            and calculates the exact percentage of original draft retained vs. subsequent edits.
          </p>
        </div>

        {/* --- File Drag & Drop Target --- */}
        <div
          className={`verify-dropzone ${isDragging ? "dragging" : ""} ${loadedFileMeta ? "has-file" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Drop document file or click to browse"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.docx,.pdf,.json"
            style={{ display: "none" }}
            onChange={handleFileInputChange}
          />
          {loadedFileMeta ? (
            <div className="dropzone-file-info">
              <span className="dropzone-icon">📄</span>
              <div className="dropzone-details">
                <span className="dropzone-filename">{loadedFileMeta.name}</span>
                <span className="dropzone-meta">
                  {loadedFileMeta.type} · {loadedFileMeta.size} · Click or drop another file to replace
                </span>
              </div>
            </div>
          ) : (
            <div className="dropzone-prompt">
              <span className="dropzone-icon">📥</span>
              <div className="dropzone-text">
                <strong style={{ color: "var(--nickel)" }}>DROP DOCUMENT FILE HERE</strong>
                <span style={{ fontSize: "10px", color: "var(--bone-dim)" }}>
                  Supports .DOCX, .PDF, .TXT, .MD, or .JSON Certificates (or click to browse)
                </span>
              </div>
            </div>
          )}
        </div>

        <label className="field" style={{ display: "flex", flexDirection: "column", marginTop: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>OR PASTE TEXT DIRECTLY</span>
            {loadedFileMeta && (
              <span style={{ fontSize: "9px", color: "var(--nickel)" }}>Extracted from {loadedFileMeta.name}</span>
            )}
          </div>
          <textarea
            className="verify-textarea"
            rows={5}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setLoadedFileMeta(null);
              if (result) setResult(null);
            }}
            placeholder="Paste text with invisible ownership seal or drag a file above..."
          />
        </label>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="hud-btn accent"
            style={{ flex: 1 }}
            onClick={handleManualVerify}
            disabled={verifying || !inputText.trim()}
          >
            {verifying ? "INSPECTING CRYPTOGRAPHY…" : "VERIFY OWNERSHIP & RETENTION"}
          </button>
          {inputText && (
            <button className="hud-btn ghost" onClick={handleClear}>
              CLEAR
            </button>
          )}
        </div>

        {result && (
          <div
            className={`verification-card ${
              result.hasWatermark && result.isValid
                ? result.verdictGrade === "exact" || result.verdictGrade === "high_retention"
                  ? "valid"
                  : "modified"
                : "invalid"
            }`}
          >
            {result.hasWatermark && result.payload ? (
              <>
                <div className={`verify-status-badge ${result.verdictGrade}`}>
                  {result.statusHeadline}
                  <p className="field-note" style={{ marginTop: "4px", color: "inherit", opacity: 0.9 }}>
                    {result.statusDescription}
                  </p>
                </div>

                {/* --- Retention & Evolution Meter --- */}
                <div className="verify-retention-meter">
                  <div className="meter-header">
                    <span className="meter-label">ORIGINAL DRAFT RETENTION</span>
                    <span className="meter-val">
                      <strong>{result.originalRetentionPercent}%</strong> ORIGINAL ·{" "}
                      <span style={{ opacity: 0.75 }}>{result.postDraftModificationPercent}% REVISED</span>
                    </span>
                  </div>
                  <div className="meter-track">
                    <div
                      className="meter-fill original"
                      style={{ width: `${result.originalRetentionPercent}%` }}
                    />
                    <div
                      className="meter-fill revised"
                      style={{ width: `${result.postDraftModificationPercent}%` }}
                    />
                  </div>
                  <div className="meter-legend">
                    <span className="legend-item">
                      <span className="legend-dot orig" />
                      Original First Draft: {result.wordDiff?.original} words
                    </span>
                    <span className="legend-item">
                      <span className="legend-dot rev" />
                      Current Text: {result.wordDiff?.current} words
                    </span>
                  </div>
                </div>

                {/* --- Audit Data Grid --- */}
                <div className="verify-field-grid">
                  <div className="verify-field">
                    <span className="verify-lbl">PROTOCOL / MANIFESTO</span>
                    <span className="verify-val">{result.payload.manifesto}</span>
                  </div>
                  <div className="verify-field">
                    <span className="verify-lbl">TITLE</span>
                    <span className="verify-val">{result.payload.title || "Untitled"}</span>
                  </div>
                  <div className="verify-field">
                    <span className="verify-lbl">AUTHOR</span>
                    <span className="verify-val">{result.payload.author || "Anonymous"}</span>
                  </div>
                  <div className="verify-field">
                    <span className="verify-lbl">FIRST DRAFT TIMESTAMP</span>
                    <span className="verify-val">{new Date(result.payload.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="verify-field">
                    <span className="verify-lbl">BIOMETRIC CADENCE VARIANCE</span>
                    <span className="verify-val">
                      {Math.round(result.payload.keystrokeEntropyScore * 100)}% ({result.payload.verdict})
                    </span>
                  </div>
                  <div className="verify-field">
                    <span className="verify-lbl">ORIGINAL RECORDED KEYSTROKES</span>
                    <span className="verify-val">{result.payload.totalKeystrokes} strokes</span>
                  </div>
                  <div className="verify-field">
                    <span className="verify-lbl">CORE PRESERVED WORDS</span>
                    <span className="verify-val">
                      ~{result.wordDiff?.preservedMatches} / {result.wordDiff?.original} words
                    </span>
                  </div>
                  <div className="verify-field full">
                    <span className="verify-lbl">ORIGINAL FIRST DRAFT SHA-256</span>
                    <span className="verify-val mono">{result.payload.sha256TextHash}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="verify-status-badge unverified">
                ✕ NO PLATEN WATERMARK DETECTED
                <p className="field-note" style={{ marginTop: "6px", color: "inherit" }}>
                  This document does not contain a Platen zero-width cryptographic seal.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="field-note dim" style={{ marginTop: "auto" }}>
          {t("export.privacy")}
        </div>
      </aside>
    </div>
  );
}
