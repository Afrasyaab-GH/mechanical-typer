import {
  Document,
  LineRuleType,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx";
import JSZip from "jszip";
import type { Manuscript } from "../document/Manuscript";
import { FONT_FALLBACKS, FONT_FAMILY } from "../machine/constants";

import {
  createZeroWidthWatermarkString,
  stripZeroWidthCharacters,
} from "../steganography/SteganographyEncoder";

export type OverstrikeMode = "final" | "annotated";

export interface DocxOptions {
  title: string;
  author: string;
  overstrikeMode: OverstrikeMode;
  embedFont: boolean;
  fontData?: ArrayBuffer;
  entropyScore?: number;
  keystrokeCount?: number;
}

export interface DocxResult {
  bytes: Uint8Array;
  fileName: string;
  size: number;
  fontEmbedded: boolean;
  fontNote: string;
  pageCount: number;
  wordCount: number;
  charCount: number;
}

/* ------------------------- document structure ------------------------- */

const LINE_SPACING = Math.round(15.8 * 20); // exact 15.8pt line pitch
const PAGE_WIDTH = 11906; // A4, twips
const PAGE_HEIGHT = 16838;
const MARGIN = 1440; // 1 inch

/** One mechanical line → Word runs, honoring the overstrike mode. */
function lineRuns(
  manuscript: Manuscript,
  page: number,
  line: number,
  mode: OverstrikeMode,
  watermarkPrefix = "",
): TextRun[] {
  const glyphs = manuscript.pages[page]?.[line] ?? [];
  const runs: Array<{ text: string; strike: boolean }> = [];
  let current = "";
  let col = 0;
  const flush = () => {
    if (current) {
      runs.push({ text: current, strike: false });
      current = "";
    }
  };
  for (const glyph of glyphs) {
    if (glyph.col > col) current += " ".repeat(glyph.col - col);
    if (mode === "annotated" && glyph.history.length > 0) {
      flush();
      runs.push({ text: glyph.history.join(""), strike: true });
    }
    current += glyph.char;
    col = glyph.col + 1;
  }
  flush();
  if (runs.length === 0) runs.push({ text: "", strike: false });
  if (watermarkPrefix && runs.length > 0) {
    runs[0].text = watermarkPrefix + runs[0].text;
  }
  return runs.map((run) => new TextRun({ text: run.text, strike: run.strike }));
}

function buildDocument(manuscript: Manuscript, options: DocxOptions, watermark = ""): Document {
  const children: Paragraph[] = [];
  let watermarkInjected = false;

  for (let page = 0; page < manuscript.pages.length; page++) {
    const rows = manuscript.pages[page];
    for (let line = 0; line < rows.length; line++) {
      const prefix = !watermarkInjected ? watermark : "";
      const runs = lineRuns(manuscript, page, line, options.overstrikeMode, prefix);
      if (prefix) watermarkInjected = true;

      children.push(
        new Paragraph({
          spacing: { before: 0, after: 0, line: LINE_SPACING, lineRule: LineRuleType.EXACT },
          children: runs,
        }),
      );
    }
    if (page < manuscript.pages.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }
  return new Document({
    creator: options.author || undefined,
    title: options.title || undefined,
    description: "Platen · Write to hold, own and carry. Sovereignty certified.",
    styles: {
      default: {
        document: {
          run: { font: FONT_FAMILY, size: 24 },
          paragraph: { spacing: { before: 0, after: 0 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        children,
      },
    ],
  });
}

/* --------------------------- font embedding --------------------------- */

const ODCTF_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.obfuscatedFont";
const FONT_TABLE_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml";
const FONT_TABLE_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable";
const FONT_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font";

/** Reads the fsType embedding bits from the font's OS/2 table. */
function embeddingPermission(font: ArrayBuffer): "installable" | "editable" | "preview-print" | "restricted" | "unknown" {
  try {
    const view = new DataView(font);
    const tableCount = view.getUint16(4);
    for (let i = 0; i < tableCount; i++) {
      const record = 12 + i * 16;
      const tag = String.fromCharCode(
        view.getUint8(record),
        view.getUint8(record + 1),
        view.getUint8(record + 2),
        view.getUint8(record + 3),
      );
      if (tag === "OS/2") {
        const offset = view.getUint32(record + 8);
        const fsType = view.getUint16(offset + 8) & 15;
        return fsType === 2 ? "restricted" : fsType === 4 ? "preview-print" : fsType === 8 ? "editable" : "installable";
      }
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

function fontKeyFrom(bytes: Uint8Array): string {
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}}`.toUpperCase();
}

function randomGuidBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

/** odttf obfuscation: XOR the first 32 bytes with the reversed GUID. */
function obfuscateFont(font: ArrayBuffer, guid: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(font.slice(0));
  for (let i = 0; i < 32 && i < bytes.length; i++) bytes[i] ^= guid[15 - (i % 16)];
  return bytes;
}

function fontEntryXml(fontKey: string): string {
  return `<w:font w:name="${FONT_FAMILY}"><w:panose1 w:val="02060509020000020004"/><w:charset w:val="00"/><w:family w:val="modern"/><w:pitch w:val="fixed"/><w:sig w:usb0="00000003" w:usb1="00000000" w:usb2="00000000" w:usb3="00000000" w:csb0="00000001" w:csb1="00000000"/><w:embedRegular r:id="rIdCourierPrimeRegular" w:fontKey="${fontKey}" w:subsetted="false"/></w:font>`;
}

function fontTableXml(fontKey: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${fontEntryXml(fontKey)}</w:fonts>`;
}

const FONT_RELATIONSHIP = `<Relationship Id="rIdCourierPrimeRegular" Type="${FONT_REL}" Target="fonts/CourierPrime-Regular.odttf"/>`;

function injectRelationship(xml: string, relationship: string): string {
  if (xml.includes("</Relationships>")) return xml.replace("</Relationships>", `${relationship}</Relationships>`);
  return xml.replace(/<Relationships([^>]*)\/>/u, `<Relationships$1>${relationship}</Relationships>`);
}

function injectFontEntry(xml: string, entry: string): string {
  if (xml.includes("</w:fonts>")) return xml.replace("</w:fonts>", `${entry}</w:fonts>`);
  return xml.replace(/<w:fonts([^>]*)\/>/u, `<w:fonts$1>${entry}</w:fonts>`);
}

/**
 * Embeds Courier Prime (SIL OFL, installable fsType) into the DOCX package
 * as an obfuscated odttf part, wiring fontTable, relationships, content
 * types and settings. Returns null when embedding is not permitted/possible.
 */
async function embedFontIntoDocx(
  docxBytes: Uint8Array<ArrayBuffer>,
  fontData: ArrayBuffer,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const permission = embeddingPermission(fontData);
  if (permission === "restricted" || permission === "unknown") return null;
  const zip = await JSZip.loadAsync(docxBytes);
  const guid = randomGuidBytes();
  const fontKey = fontKeyFrom(guid);
  const obfuscated = obfuscateFont(fontData, guid);

  zip.file("word/fonts/CourierPrime-Regular.odttf", obfuscated);

  const fontTable = zip.file("word/fontTable.xml");
  if (fontTable) {
    const xml = await fontTable.async("string");
    zip.file("word/fontTable.xml", injectFontEntry(xml, fontEntryXml(fontKey)));
  } else {
    zip.file("word/fontTable.xml", fontTableXml(fontKey));
  }

  const fontTableRels = zip.file("word/_rels/fontTable.xml.rels");
  if (fontTableRels) {
    const xml = await fontTableRels.async("string");
    if (!xml.includes("CourierPrime-Regular.odttf")) {
      zip.file("word/_rels/fontTable.xml.rels", injectRelationship(xml, FONT_RELATIONSHIP));
    }
  } else {
    zip.file(
      "word/_rels/fontTable.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${FONT_RELATIONSHIP}</Relationships>`,
    );
  }

  const contentTypes = zip.file("[Content_Types].xml");
  if (!contentTypes) return null;
  let typesXml = await contentTypes.async("string");
  if (!typesXml.includes('Extension="odttf"')) {
    typesXml = typesXml.replace("</Types>", `<Default Extension="odttf" ContentType="${ODCTF_CONTENT_TYPE}"/></Types>`);
  }
  if (!typesXml.includes("fontTable.xml")) {
    typesXml = typesXml.replace(
      "</Types>",
      `<Override PartName="/word/fontTable.xml" ContentType="${FONT_TABLE_CONTENT_TYPE}"/></Types>`,
    );
  }
  zip.file("[Content_Types].xml", typesXml);

  const documentRels = zip.file("word/_rels/document.xml.rels");
  if (!documentRels) return null;
  let relsXml = await documentRels.async("string");
  if (!relsXml.includes("fontTable")) {
    relsXml = injectRelationship(
      relsXml,
      `<Relationship Id="rIdFontTable" Type="${FONT_TABLE_REL}" Target="fontTable.xml"/>`,
    );
    zip.file("word/_rels/document.xml.rels", relsXml);
  }

  const settings = zip.file("word/settings.xml");
  if (settings) {
    let settingsXml = await settings.async("string");
    if (!settingsXml.includes("embedTrueTypeFonts")) {
      settingsXml = settingsXml.replace(/(<w:settings[^>]*>)/u, "$1<w:embedTrueTypeFonts/>");
      zip.file("word/settings.xml", settingsXml);
    }
  }

  return zip.generateAsync({
    type: "uint8array",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }) as Promise<Uint8Array<ArrayBuffer>>;
}

/* ------------------------------ public API ---------------------------- */

export function docxFileName(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `Platen_Manuscript_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}.docx`;
}

/** Builds the DOCX entirely in the browser. No network calls. */
export async function buildDocx(manuscript: Manuscript, options: DocxOptions): Promise<DocxResult> {
  const fullCleanText = stripZeroWidthCharacters(manuscript.getText());
  const watermark = await createZeroWidthWatermarkString(fullCleanText, {
    author: options.author || undefined,
    title: options.title || undefined,
    entropyScore: options.entropyScore,
    keystrokeCount: options.keystrokeCount,
  });

  const document = buildDocument(manuscript, options, watermark);
  let bytes: Uint8Array<ArrayBuffer> = new Uint8Array(await (await Packer.toBlob(document)).arrayBuffer());

  let fontEmbedded = false;
  let fontNote: string;
  if (options.embedFont && options.fontData) {
    const embedded = await embedFontIntoDocx(bytes, options.fontData);
    if (embedded) {
      bytes = embedded;
      fontEmbedded = true;
      fontNote = "Courier Prime embedded (SIL OFL, installable fsType).";
    } else {
      fontNote = "Font embedding unavailable — Courier Prime named, falls back to recipient system fonts.";
    }
  } else {
    fontNote = `Courier Prime named; falls back to ${FONT_FALLBACKS.join(", ")} on the recipient's system.`;
  }

  return {
    bytes,
    fileName: docxFileName(),
    size: bytes.byteLength,
    fontEmbedded,
    fontNote,
    pageCount: manuscript.pages.length,
    wordCount: manuscript.wordCount,
    charCount: manuscript.charCount,
  };
}

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
