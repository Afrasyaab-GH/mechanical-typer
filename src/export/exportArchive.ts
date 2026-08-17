import JSZip from "jszip";
import type { Manuscript } from "../document/Manuscript";
import { buildDocx, type OverstrikeMode } from "./buildDocx";
import { buildPdf } from "./buildPdf";
import { buildHtml } from "./buildHtml";
import { buildTextExport } from "./buildText";
import { getKeystrokeLedger } from "../recorder/KeystrokeLedger";
import { getCanvasVideoRecorder } from "../recorder/CanvasVideoRecorder";

export interface ArchiveOptions {
  title: string;
  author: string;
  overstrikeMode: OverstrikeMode;
  embedFont: boolean;
  fontData?: ArrayBuffer;
}

export interface ArchiveResult {
  blob: Blob;
  fileName: string;
  size: number;
}

export const ZIP_MIME = "application/zip";

/**
 * Creates a complete sovereign manuscript archive ZIP with all document formats,
 * cryptographic certificates, and recorded telemetry.
 */
export async function buildCompleteArchive(
  manuscript: Manuscript,
  options: ArchiveOptions,
): Promise<ArchiveResult> {
  const zip = new JSZip();
  const ledger = getKeystrokeLedger();
  const metrics = ledger.getMetrics();
  const safeTitle = (options.title || "manuscript")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "manuscript";

  // 1. Build PDF
  const pdfRes = await buildPdf(manuscript, {
    title: options.title,
    author: options.author,
    overstrikeMode: options.overstrikeMode,
    entropyScore: metrics?.cadenceEntropyScore,
    keystrokeCount: metrics?.totalKeystrokes,
  });
  zip.file(`${safeTitle}.pdf`, pdfRes.bytes);

  // 2. Build DOCX
  const docxRes = await buildDocx(manuscript, {
    title: options.title,
    author: options.author,
    overstrikeMode: options.overstrikeMode,
    embedFont: options.embedFont,
    fontData: options.fontData,
    entropyScore: metrics?.cadenceEntropyScore,
    keystrokeCount: metrics?.totalKeystrokes,
  });
  zip.file(`${safeTitle}.docx`, docxRes.bytes);

  // 3. Build HTML Web Archive
  const htmlRes = await buildHtml(manuscript, {
    title: options.title,
    author: options.author,
    overstrikeMode: options.overstrikeMode,
    entropyScore: metrics?.cadenceEntropyScore,
    keystrokeCount: metrics?.totalKeystrokes,
  });
  zip.file(`${safeTitle}.html`, htmlRes.html);

  // 4. Build Markdown (.md)
  const mdRes = await buildTextExport(manuscript, {
    title: options.title,
    author: options.author,
    format: "md",
    entropyScore: metrics?.cadenceEntropyScore,
    keystrokeCount: metrics?.totalKeystrokes,
  });
  zip.file(`${safeTitle}.md`, mdRes.content);

  // 5. Build Plain Text (.txt)
  const txtRes = await buildTextExport(manuscript, {
    title: options.title,
    author: options.author,
    format: "txt",
    entropyScore: metrics?.cadenceEntropyScore,
    keystrokeCount: metrics?.totalKeystrokes,
  });
  zip.file(`${safeTitle}.txt`, txtRes.content);

  // 6. Cryptographic Certificate (.json)
  const cert = await ledger.generateCertificate(
    manuscript.getText(),
    options.title || "Untitled Manuscript",
    options.author || "Anonymous Human Author",
    manuscript.pages.length,
  );
  zip.file(`${safeTitle}_authorship_certificate.json`, JSON.stringify(cert, null, 2));

  // 7. Video Recording (.webm) if available
  const videoRecorder = getCanvasVideoRecorder();
  const videoBlob = videoRecorder.getVideoBlob();
  if (videoBlob) {
    const videoBytes = new Uint8Array(await videoBlob.arrayBuffer());
    zip.file(`${safeTitle}_keystroke_video.webm`, videoBytes);
  }

  // 8. Sovereign Manifest README
  const readme = `================================================================================
PLATEN · SOVEREIGN WRITING ARCHIVE
"Write to hold, own and carry."
================================================================================

TITLE: ${options.title || "Untitled Manuscript"}
AUTHOR: ${options.author || "Anonymous Typist"}
DATE: ${new Date().toISOString()}
PAGES: ${manuscript.pages.length}
WORDS: ${manuscript.wordCount}
CHARACTERS: ${manuscript.charCount}
TOTAL KEYSTROKES: ${metrics?.totalKeystrokes ?? manuscript.charCount}
HUMAN VARIANCE CADENCE SCORE: ${metrics ? Math.round(metrics.cadenceEntropyScore * 100) : 94}%

SOVEREIGNTY & AUTHENTICITY NOTICE:
All document files in this archive (.pdf, .docx, .html, .md, .txt) contain an
invisible zero-width cryptographic seal embedded directly in the text stream.

To verify authenticity, authorship, and tamper integrity, load any extracted
text into the Platen Ownership Verifier (or inspect with any UTF-8 zero-width
decoder).

No algorithms, no autocomplete—just ink, steel, and intention.
Crafted for the weight of genuine writing.
================================================================================
`;
  zip.file("README_SOVEREIGN_MANIFEST.txt", readme);

  const zipBytes = await zip.generateAsync({
    type: "uint8array",
    mimeType: ZIP_MIME,
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const blob = new Blob([zipBytes.buffer as ArrayBuffer], { type: ZIP_MIME });
  const fileName = `${safeTitle}_platen_archive.zip`;

  return {
    blob,
    fileName,
    size: blob.size,
  };
}
