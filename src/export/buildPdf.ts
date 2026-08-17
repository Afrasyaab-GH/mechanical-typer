import { jsPDF } from "jspdf";
import type { Manuscript } from "../document/Manuscript";
import {
  createZeroWidthWatermarkString,
  stripZeroWidthCharacters,
} from "../steganography/SteganographyEncoder";

export interface PdfOptions {
  title: string;
  author: string;
  overstrikeMode?: "final" | "annotated";
  entropyScore?: number;
  keystrokeCount?: number;
}

export interface PdfResult {
  bytes: Uint8Array;
  blob: Blob;
  fileName: string;
  size: number;
  pageCount: number;
  wordCount: number;
  charCount: number;
}

export const PDF_MIME = "application/pdf";

/**
 * Builds an authentic typewriter PDF document with embedded zero-width steganographic seal.
 */
export async function buildPdf(
  manuscript: Manuscript,
  options: PdfOptions,
): Promise<PdfResult> {
  const fullCleanText = stripZeroWidthCharacters(manuscript.getText());
  const zwWatermark = await createZeroWidthWatermarkString(fullCleanText, {
    author: options.author || undefined,
    title: options.title || undefined,
    entropyScore: options.entropyScore,
    keystrokeCount: options.keystrokeCount,
  });

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4", // 210 x 297 mm
  });

  // Metadata properties
  doc.setProperties({
    title: options.title || "Platen Manuscript",
    author: options.author || "Platen Typist",
    subject: "Platen Sovereign Manuscript · Write to hold, own and carry.",
    keywords: "Platen, Typewriter, Sovereign Authorship, Steganography, Mechanical Typer",
    creator: "Platen: 3D Typewriter (Write to hold, own and carry)",
  });

  const marginLeft = 25.4; // 1 inch
  const marginTop = 25.4;
  const fontSize = 10; // 10pt monospace
  const lineHeightMm = 5.5; // ~15.6pt pitch

  doc.setFont("courier", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(30, 28, 26); // Rich vintage typewriter ink

  const pages = manuscript.pages;
  let watermarkInjected = false;

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage("a4", "portrait");
      doc.setFont("courier", "normal");
      doc.setFontSize(fontSize);
      doc.setTextColor(30, 28, 26);
    }

    const rows = pages[pageIdx] ?? [];

    for (let lineIdx = 0; lineIdx < rows.length; lineIdx++) {
      const glyphs = rows[lineIdx] ?? [];
      let lineText = "";
      let col = 0;

      for (const glyph of glyphs) {
        if (glyph.col > col) {
          lineText += " ".repeat(glyph.col - col);
        }
        lineText += glyph.char;
        col = glyph.col + 1;
      }

      if (!watermarkInjected && lineText.trim().length > 0) {
        // Inject the invisible zero-width watermark into the first printable line
        lineText = lineText + zwWatermark;
        watermarkInjected = true;
      }

      const yPos = marginTop + lineIdx * lineHeightMm;
      if (yPos < 280 && lineText.length > 0) {
        doc.text(lineText, marginLeft, yPos);
      }
    }

    // Sheet page numbering in subtle typewriter style at bottom
    if (pages.length > 1) {
      doc.setFontSize(8);
      doc.setTextColor(120, 115, 105);
      doc.text(`— ${pageIdx + 1} —`, 105, 285, { align: "center" });
      doc.setFontSize(fontSize);
      doc.setTextColor(30, 28, 26);
    }
  }

  // If entire manuscript was blank, inject watermark
  if (!watermarkInjected) {
    doc.text(zwWatermark, marginLeft, marginTop);
  }

  const arrayBuffer = doc.output("arraybuffer");
  const bytes = new Uint8Array(arrayBuffer);
  const blob = new Blob([bytes], { type: PDF_MIME });

  const safeTitle = (options.title || "manuscript")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const fileName = `${safeTitle || "manuscript"}.pdf`;

  return {
    bytes,
    blob,
    fileName,
    size: bytes.byteLength,
    pageCount: pages.length,
    wordCount: manuscript.wordCount,
    charCount: manuscript.charCount,
  };
}
