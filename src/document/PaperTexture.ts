import * as THREE from "three";
import { PAPER } from "../machine/constants";
import type { Glyph, Manuscript } from "./Manuscript";

/**
 * Builds the aged-paper background: a warm vertical gradient,
 * high-density realistic organic fibers, and subtle edge vignetting.
 */
function buildPaperBackground(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = PAPER.W;
  canvas.height = PAPER.H;
  const ctx = canvas.getContext("2d")!;

  // Warm parchment base
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#f8f3e6");
  gradient.addColorStop(0.3, "#f4ece0");
  gradient.addColorStop(0.7, "#f2e8d8");
  gradient.addColorStop(1, "#eee2ce");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Micro-texture noise / fibers
  let seed = 17;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };

  ctx.strokeStyle = "rgba(105, 88, 65, 0.045)";
  ctx.lineWidth = 1.0;
  for (let i = 0; i < 4500; i++) {
    const x = rand() * canvas.width;
    const y = rand() * canvas.height;
    const angle = rand() * Math.PI;
    const length = 2.0 + rand() * 6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }

  // Soft edge vignette
  const edgeGradientH = ctx.createLinearGradient(0, 0, canvas.width, 0);
  edgeGradientH.addColorStop(0, "rgba(70, 55, 38, 0.08)");
  edgeGradientH.addColorStop(0.05, "rgba(70, 55, 38, 0)");
  edgeGradientH.addColorStop(0.95, "rgba(70, 55, 38, 0)");
  edgeGradientH.addColorStop(1, "rgba(70, 55, 38, 0.08)");
  ctx.fillStyle = edgeGradientH;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const edgeGradientV = ctx.createLinearGradient(0, 0, 0, canvas.height);
  edgeGradientV.addColorStop(0, "rgba(70, 55, 38, 0.07)");
  edgeGradientV.addColorStop(0.03, "rgba(70, 55, 38, 0)");
  edgeGradientV.addColorStop(0.97, "rgba(70, 55, 38, 0)");
  edgeGradientV.addColorStop(1, "rgba(70, 55, 38, 0.09)");
  ctx.fillStyle = edgeGradientV;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas;
}

/**
 * Live 300 DPI A4 paper texture. Repaints synchronously on every keystroke
 * or edit, immediately setting texture.needsUpdate = true for instant GPU rendering.
 */
export class PaperTexture {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  documentTitle = "— THE IMPACT NO. 01 —";
  fontFamily = "Courier Prime";
  fontSizePx = 50;
  private ctx: CanvasRenderingContext2D;
  private background: HTMLCanvasElement;
  private manuscript: Manuscript;
  fontReady = false;
  onRepaint: (() => void) | null = null;

  constructor(manuscript: Manuscript) {
    this.manuscript = manuscript;
    this.canvas = document.createElement("canvas");
    this.canvas.width = PAPER.W;
    this.canvas.height = PAPER.H;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: false })!;
    this.background = buildPaperBackground();

    // Persistent GPU CanvasTexture
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 16;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.wrapS = THREE.ClampToEdgeWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;

    this.repaint();

    if (typeof document !== "undefined" && document.fonts) {
      document.fonts
        .load(`bold ${this.fontSizePx}px "${this.fontFamily}"`)
        .then(() => {
          this.fontReady = true;
          this.repaint();
        })
        .catch(() => {});
    }

    manuscript.bus.on("changed", () => this.repaint());
    manuscript.bus.on("structure", () => this.repaint());
  }

  setTitle(title: string): void {
    this.documentTitle = title;
    this.repaint();
  }

  setFont(fontFamily: string, fontSizePx?: number): void {
    this.fontFamily = fontFamily;
    if (fontSizePx !== undefined && fontSizePx > 0) {
      this.fontSizePx = fontSizePx;
    }
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts
        .load(`bold ${this.fontSizePx}px "${this.fontFamily}"`)
        .then(() => {
          this.repaint();
        })
        .catch(() => {
          this.repaint();
        });
    } else {
      this.repaint();
    }
  }

  feedMode: "sheet" | "scroll" = "sheet";

  setFeedMode(mode: "sheet" | "scroll"): void {
    if (this.feedMode !== mode) {
      this.feedMode = mode;
      this.repaint(mode);
    }
  }

  private drawGlyph(glyph: Glyph): void {
    const ctx = this.ctx;
    const x = PAPER.MARGIN_X + glyph.col * PAPER.CELL_W + glyph.xJitter * 1.5;
    const y = PAPER.MARGIN_TOP + glyph.line * PAPER.LINE_H + PAPER.LINE_H * 0.76 + glyph.yJitter * 1.5;

    ctx.font = `bold ${this.fontSizePx}px "${this.fontFamily}", "Courier Prime", "Courier New", monospace`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    const impressions = [...glyph.history, glyph.char];
    impressions.forEach((char, index) => {
      const isFinal = index === impressions.length - 1;
      const opacity = isFinal ? glyph.inkOpacity : Math.min(0.95, glyph.inkOpacity * 0.85);
      const dx = isFinal ? 0 : (index % 2 === 0 ? 0.9 : -0.8) * (1 + index * 0.4);
      const dy = isFinal ? 0 : (index % 2 === 0 ? -0.8 : 0.9) * (1 + index * 0.4);

      // Primary crisp ink impression
      ctx.fillStyle = `rgba(17, 17, 17, ${opacity.toFixed(3)})`;
      ctx.fillText(char, x + dx, y + dy);

      // Organic micro-bleed halo
      ctx.fillStyle = `rgba(28, 24, 20, ${(opacity * 0.18).toFixed(3)})`;
      ctx.fillText(char, x + dx + 0.9, y + dy + 0.6);
    });
  }

  repaint(feedMode: "sheet" | "scroll" = this.feedMode, activeGlobalLine?: number): void {
    this.feedMode = feedMode;
    const currentGlobalLine =
      activeGlobalLine !== undefined
        ? activeGlobalLine
        : this.manuscript.cursor.page * 44 + this.manuscript.cursor.line;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.background, 0, 0);

    if (this.documentTitle && feedMode === "sheet") {
      ctx.font = `600 36px "Courier Prime", monospace`;
      ctx.fillStyle = "#332e24";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.documentTitle, this.canvas.width / 2, 160);
      ctx.textAlign = "left";
    }

    if (feedMode === "sheet") {
      const page = Math.min(this.manuscript.cursor.page, this.manuscript.pages.length - 1);
      const rows = this.manuscript.pages[page] ?? [];
      for (const line of rows) {
        for (const glyph of line) {
          this.drawGlyph(glyph);
        }
      }
    } else {
      // CONTINUOUS SCROLL MODE:
      // 48 lines fill the exact 0..1 UV canvas height
      const SCROLL_LOOP_LINES = 48;
      const lineSpacing = this.canvas.height / SCROLL_LOOP_LINES;
      const minVisibleLine = Math.max(0, currentGlobalLine - SCROLL_LOOP_LINES + 3);

      for (let p = 0; p < this.manuscript.pages.length; p++) {
        const pageRows = this.manuscript.pages[p] ?? [];
        for (let l = 0; l < pageRows.length; l++) {
          const gLine = p * 44 + l;
          if (gLine >= minVisibleLine && gLine <= currentGlobalLine) {
            const cyclicLine = ((gLine % SCROLL_LOOP_LINES) + SCROLL_LOOP_LINES) % SCROLL_LOOP_LINES;
            for (const glyph of pageRows[l]) {
              const x = PAPER.MARGIN_X + glyph.col * PAPER.CELL_W + glyph.xJitter * 1.5;
              const y = cyclicLine * lineSpacing + lineSpacing * 0.72 + glyph.yJitter * 1.5;

              const impressions = [...glyph.history, glyph.char];
              impressions.forEach((char, index) => {
                const isFinal = index === impressions.length - 1;
                const opacity = isFinal ? glyph.inkOpacity : Math.min(0.95, glyph.inkOpacity * 0.85);
                const dx = isFinal ? 0 : (index % 2 === 0 ? 0.9 : -0.8) * (1 + index * 0.4);
                const dy = isFinal ? 0 : (index % 2 === 0 ? -0.8 : 0.9) * (1 + index * 0.4);

                ctx.font = `bold ${this.fontSizePx}px "${this.fontFamily}", "Courier Prime", monospace`;
                ctx.textBaseline = "alphabetic";
                ctx.textAlign = "left";

                ctx.fillStyle = `rgba(17, 17, 17, ${opacity.toFixed(3)})`;
                ctx.fillText(char, x + dx, y + dy);

                ctx.fillStyle = `rgba(28, 24, 20, ${(opacity * 0.18).toFixed(3)})`;
                ctx.fillText(char, x + dx + 0.9, y + dy + 0.6);
              });
            }
          }
        }
      }
    }

    this.texture.needsUpdate = true;
    this.onRepaint?.();
  }
}

export default PaperTexture;
