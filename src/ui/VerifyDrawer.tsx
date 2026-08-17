import { useState } from "react";
import { useStore } from "../app/store";
import { t } from "../app/i18n";
import {
  verifyAndExtractOwnership,
  type VerificationResult,
  stripZeroWidthCharacters,
} from "../steganography/SteganographyEncoder";

export function VerifyDrawer() {
  const open = useStore((s) => s.verifyOpen);
  const setOpen = useStore((s) => s.setVerifyOpen);

  const [inputText, setInputText] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  if (!open) return null;

  const handleVerify = async () => {
    if (!inputText.trim()) return;
    setVerifying(true);
    try {
      const res = await verifyAndExtractOwnership(inputText);
      setResult(res);
    } catch {
      setResult({
        hasWatermark: false,
        isValid: false,
        tampered: false,
        payload: null,
        extractedCleanText: stripZeroWidthCharacters(inputText),
        error: "Verification failed.",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleClear = () => {
    setInputText("");
    setResult(null);
  };

  return (
    <div className="drawer-backdrop" onClick={() => setOpen(false)}>
      <aside
        className="drawer verify-drawer"
        aria-label="Verify Platen Document Ownership"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="part-info-head">
          <span className="part-info-system">PLATEN · OWNERSHIP VERIFIER</span>
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
            Paste any text extracted from Platen documents (DOCX, PDF, copied text).
            This tool inspects the invisible zero-width cryptographic seal to verify ownership,
            integrity, and human typing cadence.
          </p>
        </div>

        <label className="field" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <span>PASTE TEXT TO VERIFY</span>
          <textarea
            className="verify-textarea"
            rows={7}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (result) setResult(null);
            }}
            placeholder="Paste text with invisible ownership seal here..."
          />
        </label>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className="hud-btn accent"
            style={{ flex: 1 }}
            onClick={handleVerify}
            disabled={verifying || !inputText.trim()}
          >
            {verifying ? "INSPECTING CRYPTOGRAPHY…" : "VERIFY OWNERSHIP & PROOF"}
          </button>
          {inputText && (
            <button className="hud-btn ghost" onClick={handleClear}>
              CLEAR
            </button>
          )}
        </div>

        {result && (
          <div className={`verification-card ${result.hasWatermark && result.isValid && !result.tampered ? "valid" : "invalid"}`}>
            {result.hasWatermark && result.payload ? (
              <>
                <div className="verify-status-badge">
                  {result.tampered ? "⚠️ WATERMARK FOUND · TEXT MODIFIED" : "✓ CERTIFIED PLATEN SOVEREIGN TEXT"}
                </div>
                <div className="verify-field-grid">
                  <div className="verify-field">
                    <span className="verify-lbl">MANIFESTO</span>
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
                    <span className="verify-lbl">AUTHORED ON</span>
                    <span className="verify-val">{new Date(result.payload.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="verify-field">
                    <span className="verify-lbl">HUMAN CADENCE VARIANCE</span>
                    <span className="verify-val">{Math.round(result.payload.keystrokeEntropyScore * 100)}% ({result.payload.verdict})</span>
                  </div>
                  <div className="verify-field">
                    <span className="verify-lbl">RECORDED KEYSTROKES</span>
                    <span className="verify-val">{result.payload.totalKeystrokes}</span>
                  </div>
                  <div className="verify-field full">
                    <span className="verify-lbl">SHA-256 TEXT HASH</span>
                    <span className="verify-val mono">{result.payload.sha256TextHash}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="verify-status-badge unverified">
                ✕ NO PLATEN OWNERSHIP WATERMARK DETECTED
                <p className="field-note" style={{ marginTop: "6px", color: "inherit" }}>
                  This text does not contain a Platen zero-width cryptographic seal.
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
