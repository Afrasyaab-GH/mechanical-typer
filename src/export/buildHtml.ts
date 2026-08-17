import type { Manuscript } from "../document/Manuscript";
import {
  createZeroWidthWatermarkString,
  stripZeroWidthCharacters,
} from "../steganography/SteganographyEncoder";

export interface HtmlOptions {
  title: string;
  author: string;
  overstrikeMode?: "final" | "annotated";
  entropyScore?: number;
  keystrokeCount?: number;
}

export interface HtmlResult {
  html: string;
  blob: Blob;
  fileName: string;
  size: number;
  pageCount: number;
  wordCount: number;
  charCount: number;
}

export const HTML_MIME = "text/html;charset=utf-8";

/**
 * Builds a standalone, beautifully styled vintage HTML archive
 * with embedded Platen typography, print styles, and invisible zero-width steganographic seal.
 */
export async function buildHtml(
  manuscript: Manuscript,
  options: HtmlOptions,
): Promise<HtmlResult> {
  const fullCleanText = stripZeroWidthCharacters(manuscript.getText());
  const zwWatermark = await createZeroWidthWatermarkString(fullCleanText, {
    author: options.author || undefined,
    title: options.title || undefined,
    entropyScore: options.entropyScore,
    keystrokeCount: options.keystrokeCount,
  });

  const title = options.title || "Untitled Manuscript";
  const author = options.author || "Platen Typist";
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const pages = manuscript.pages;
  let pagesHtml = "";
  let watermarkInjected = false;

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const rows = pages[pageIdx] ?? [];
    let linesHtml = "";

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
        lineText = lineText + zwWatermark;
        watermarkInjected = true;
      }

      // Escape HTML
      const escaped = lineText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      linesHtml += `<div class="typer-line">${escaped || "&nbsp;"}</div>\n`;
    }

    pagesHtml += `
    <article class="sheet-page">
      <div class="sheet-inner">
        ${linesHtml}
      </div>
      <div class="sheet-footer">
        <span class="sheet-seal">PLATEN · SOVEREIGN MANUSCRIPT</span>
        <span class="sheet-num">SHEET ${pageIdx + 1} OF ${pages.length}</span>
      </div>
    </article>
    `;
  }

  if (!watermarkInjected) {
    pagesHtml += `<!-- ${zwWatermark} -->`;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} · Platen</title>
  <meta name="author" content="${author}">
  <meta name="generator" content="Platen: 3D Typewriter">
  <meta name="platen-manifesto" content="Write to hold, own and carry.">
  <meta name="platen-sovereign-protocol" content="Platen-Sovereign-Text-1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,600;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --paper: #f7f2e7;
      --paper-shadow: rgba(0, 0, 0, 0.25);
      --ink: #221f1d;
      --ink-dim: #7a7368;
      --gold: #b08d57;
      --line: rgba(176, 141, 87, 0.25);
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background: #141210;
      color: var(--ink);
      font-family: 'Courier Prime', 'Courier New', Courier, monospace;
      padding: 40px 20px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .archive-header {
      width: 100%;
      max-width: 820px;
      margin-bottom: 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 1px solid var(--line);
      padding-bottom: 16px;
      color: #e8e0cc;
    }
    .archive-title-group h1 {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 26px;
      font-weight: 600;
      letter-spacing: 0.08em;
      color: #f7f2e7;
      margin-bottom: 4px;
    }
    .archive-meta {
      font-size: 11px;
      color: #a89f8c;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .archive-badge {
      font-size: 10px;
      letter-spacing: 0.16em;
      color: var(--gold);
      border: 1px solid rgba(176, 141, 87, 0.4);
      padding: 6px 12px;
      border-radius: 2px;
      text-align: right;
    }
    .sheet-page {
      background: var(--paper);
      width: 100%;
      max-width: 820px;
      min-height: 1050px;
      padding: 70px 65px 50px;
      margin-bottom: 40px;
      box-shadow: 0 12px 40px var(--paper-shadow);
      border-radius: 2px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .sheet-inner {
      font-size: 14.5px;
      line-height: 22px;
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--ink);
    }
    .typer-line {
      height: 22px;
      white-space: pre;
      overflow: hidden;
    }
    .sheet-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px dashed rgba(122, 115, 104, 0.35);
      padding-top: 18px;
      font-size: 10px;
      color: var(--ink-dim);
      letter-spacing: 0.14em;
    }
    .archive-footer-bar {
      margin-top: 20px;
      text-align: center;
      font-size: 11px;
      color: #7a7368;
      letter-spacing: 0.12em;
    }
    @media print {
      body {
        background: transparent;
        padding: 0;
      }
      .archive-header, .archive-footer-bar {
        display: none;
      }
      .sheet-page {
        box-shadow: none;
        margin-bottom: 0;
        page-break-after: always;
        min-height: 100vh;
      }
    }
  </style>
</head>
<body>
  <header class="archive-header">
    <div class="archive-title-group">
      <h1>${title}</h1>
      <div class="archive-meta">${author} · ${dateStr}</div>
    </div>
    <div class="archive-badge">
      PLATEN · SOVEREIGN WRITING<br>
      <small style="opacity: 0.8">WRITE TO HOLD, OWN AND CARRY.</small>
    </div>
  </header>

  ${pagesHtml}

  <footer class="archive-footer-bar">
    Platen: 3D Typewriter · Cryptographically Certified Sovereign Human Text
  </footer>
</body>
</html>`;

  const blob = new Blob([html], { type: HTML_MIME });
  const safeTitle = (options.title || "manuscript")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const fileName = `${safeTitle || "manuscript"}.html`;

  return {
    html,
    blob,
    fileName,
    size: blob.size,
    pageCount: pages.length,
    wordCount: manuscript.wordCount,
    charCount: manuscript.charCount,
  };
}
