import type { Manuscript } from "../document/Manuscript";
import {
  injectOwnershipWatermark,
  stripZeroWidthCharacters,
} from "../steganography/SteganographyEncoder";

export interface TextExportOptions {
  title: string;
  author: string;
  format: "txt" | "md";
  entropyScore?: number;
  keystrokeCount?: number;
}

export interface TextExportResult {
  content: string;
  blob: Blob;
  fileName: string;
  size: number;
  wordCount: number;
  charCount: number;
}

/**
 * Builds Plain Text (.txt) or Markdown (.md) export with embedded zero-width steganographic seal.
 */
export async function buildTextExport(
  manuscript: Manuscript,
  options: TextExportOptions,
): Promise<TextExportResult> {
  const rawText = manuscript.getText();
  const clean = stripZeroWidthCharacters(rawText);

  let formattedContent = "";

  if (options.format === "md") {
    const title = options.title || "Untitled Manuscript";
    const author = options.author || "Platen Typist";
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    formattedContent = `# ${title}\n\n*Author: ${author}*  \n*Date: ${dateStr}*  \n*Protocol: Platen Sovereign Writing — Write to hold, own and carry.*\n\n---\n\n`;

    // Sheets formatted with markdown dividers
    const sheets = clean.split("\f");
    formattedContent += sheets.join("\n\n---\n\n");
  } else {
    // Plain text with sheet divider
    formattedContent = clean.replace(/\f/g, "\n\n=== SHEET BREAK ===\n\n");
  }

  // Inject zero-width invisible cryptographic seal
  const sealedContent = await injectOwnershipWatermark(formattedContent, {
    author: options.author || undefined,
    title: options.title || undefined,
    entropyScore: options.entropyScore,
    keystrokeCount: options.keystrokeCount,
  });

  const mime = options.format === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8";
  const blob = new Blob([sealedContent], { type: mime });

  const safeTitle = (options.title || "manuscript")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const extension = options.format === "md" ? "md" : "txt";
  const fileName = `${safeTitle || "manuscript"}.${extension}`;

  return {
    content: sealedContent,
    blob,
    fileName,
    size: blob.size,
    wordCount: manuscript.wordCount,
    charCount: manuscript.charCount,
  };
}
