import * as THREE from "three";
import { MINCHO_FONT_FAMILY, SCENE_TOKENS } from "./tokens";

export interface KanjiTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

interface CanvasPair {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

function createCanvas2D(width: number, height: number): CanvasPair | null {
  if (typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    return { canvas, ctx };
  } catch {
    return null;
  }
}

/** Deterministic pseudo-random generator so procedural grain never flickers across mounts. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawWashiFibers(
  ctx: CanvasRenderingContext2D,
  size: number,
  seed: number,
  strength: number,
): void {
  const rand = mulberry32(seed);
  ctx.save();
  for (let i = 0; i < 360; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 8 + rand() * 34;
    const angle = (rand() - 0.5) * 0.45;
    const warm = rand() > 0.45;
    ctx.strokeStyle = warm
      ? `rgba(176, 158, 134, ${strength * (0.4 + rand() * 0.6)})`
      : `rgba(255, 253, 248, ${strength * (0.5 + rand() * 0.5)})`;
    ctx.lineWidth = 0.6 + rand() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.restore();
}

export function createKanjiTextures(kanji: string): KanjiTextureSet | null {
  const size = 512;
  const colorTarget = createCanvas2D(size, size);
  const bumpTarget = createCanvas2D(size, size);
  if (!colorTarget || !bumpTarget) return null;

  const { canvas: colorCanvas, ctx: c } = colorTarget;
  const { canvas: bumpCanvas, ctx: b } = bumpTarget;

  // Color map: warm washi plaque with fine fibers, subtle indigo frame, sumi Mincho kanji.
  const bg = c.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, "#FEFDFB");
  bg.addColorStop(0.6, "#F8F3EA");
  bg.addColorStop(1, "#EFE8DC");
  c.fillStyle = bg;
  c.fillRect(0, 0, size, size);

  drawWashiFibers(c, size, 4109, 0.14);

  // Subtle corner vignette for physical paper depth.
  const vignette = c.createRadialGradient(
    size * 0.46,
    size * 0.42,
    size * 0.18,
    size * 0.5,
    size * 0.5,
    size * 0.72,
  );
  vignette.addColorStop(0, "rgba(255, 255, 255, 0)");
  vignette.addColorStop(1, "rgba(138, 106, 74, 0.12)");
  c.fillStyle = vignette;
  c.fillRect(0, 0, size, size);

  // Indigo editorial double frame.
  c.strokeStyle = "rgba(32, 63, 124, 0.36)";
  c.lineWidth = 2.5;
  c.strokeRect(26, 26, size - 52, size - 52);
  c.strokeStyle = "rgba(32, 63, 124, 0.16)";
  c.lineWidth = 1.25;
  c.strokeRect(36, 36, size - 72, size - 72);

  // Crisp sumi Mincho glyph with subtle carved shadow edge.
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.font = `600 304px ${MINCHO_FONT_FAMILY}`;
  c.fillStyle = "rgba(19, 22, 29, 0.10)";
  c.fillText(kanji, size / 2 + 3, size / 2 + 12);
  c.fillStyle = SCENE_TOKENS.foreground;
  c.fillText(kanji, size / 2, size / 2 + 8);

  // Bump map: mid-gray paper ground with embossed relief for border + glyph.
  b.fillStyle = "#767676";
  b.fillRect(0, 0, size, size);

  const rand = mulberry32(9973);
  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 6 + rand() * 26;
    const v = rand() > 0.5 ? 132 : 108;
    b.strokeStyle = `rgba(${v}, ${v}, ${v}, 0.25)`;
    b.lineWidth = 1;
    b.beginPath();
    b.moveTo(x, y);
    b.lineTo(x + len, y + (rand() - 0.5) * 4);
    b.stroke();
  }

  b.strokeStyle = "#5c5c5c";
  b.lineWidth = 3;
  b.strokeRect(26, 26, size - 52, size - 52);

  b.textAlign = "center";
  b.textBaseline = "middle";
  b.font = `600 304px ${MINCHO_FONT_FAMILY}`;
  b.shadowColor = "#dcdcdc";
  b.shadowBlur = 6;
  b.fillStyle = "#efefef";
  b.fillText(kanji, size / 2, size / 2 + 8);
  b.shadowBlur = 0;

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  map.needsUpdate = true;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.anisotropy = 4;
  bumpMap.needsUpdate = true;

  return { map, bumpMap };
}

export function createWoodTexture(): THREE.CanvasTexture | null {
  const size = 512;
  const target = createCanvas2D(size, size);
  if (!target) return null;

  const { canvas, ctx } = target;
  const rand = mulberry32(2026);

  // Base warm cedar-walnut tone anchored to SCENE_TOKENS.deskWood (#8A6A4A).
  ctx.fillStyle = SCENE_TOKENS.deskWood;
  ctx.fillRect(0, 0, size, size);

  // Subtle horizontal wood grain bands modulated with gentle organic waves.
  for (let y = 0; y < size; y += 2) {
    const wave =
      Math.sin((y / size) * Math.PI * 10) * 0.5 +
      Math.sin((y / size) * Math.PI * 24 + 1.2) * 0.3;
    const shade =
      wave > 0 ? "rgba(166, 134, 98, 0.14)" : "rgba(88, 63, 40, 0.15)";
    ctx.fillStyle = shade;
    ctx.fillRect(0, y, size, 2);
  }

  // Fine elongated grain fibers and occasional darker pores.
  for (let i = 0; i < 240; i++) {
    const y = rand() * size;
    const amp = 2 + rand() * 5;
    const freq = 0.008 + rand() * 0.012;
    const phase = rand() * Math.PI * 2;
    const isDark = rand() > 0.35;
    ctx.strokeStyle = isDark
      ? `rgba(74, 52, 32, ${0.07 + rand() * 0.11})`
      : `rgba(196, 166, 130, ${0.06 + rand() * 0.08})`;
    ctx.lineWidth = 0.7 + rand() * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 32) {
      ctx.lineTo(x, y + Math.sin(x * freq + phase) * amp);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.3, 1.3);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function createWashiTexture(
  withCardLines = false,
): THREE.CanvasTexture | null {
  const size = 512;
  const target = createCanvas2D(size, size);
  if (!target) return null;

  const { canvas, ctx } = target;

  ctx.fillStyle = SCENE_TOKENS.card;
  ctx.fillRect(0, 0, size, size);

  drawWashiFibers(ctx, size, withCardLines ? 731 : 317, 0.13);

  // Delicate paper border tone.
  ctx.strokeStyle = "rgba(138, 106, 74, 0.14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, size - 8, size - 8);

  if (withCardLines) {
    // Editorial indigo card rulings (#203F7C).
    ctx.strokeStyle = "rgba(32, 63, 124, 0.42)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(46, 112);
    ctx.lineTo(size - 46, 112);
    ctx.stroke();

    ctx.strokeStyle = "rgba(32, 63, 124, 0.18)";
    ctx.lineWidth = 1.5;
    for (let y = 176; y <= 416; y += 60) {
      ctx.beginPath();
      ctx.moveTo(46, y);
      ctx.lineTo(size - 46, y);
      ctx.stroke();
    }

    // Abstract ink strokes hinting at study notes without placing readable long text on 3D.
    ctx.fillStyle = "rgba(19, 22, 29, 0.55)";
    ctx.fillRect(54, 72, 138, 14);
    ctx.fillStyle = "rgba(19, 22, 29, 0.22)";
    ctx.fillRect(54, 146, 224, 9);
    ctx.fillRect(54, 206, 186, 9);
    ctx.fillRect(54, 266, 250, 9);
    ctx.fillRect(54, 326, 152, 9);

    // Small vermilion hanko impression on the corner of the top card.
    const cx = size - 92;
    const cy = size - 96;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.07);
    ctx.strokeStyle = "rgba(211, 62, 33, 0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(211, 62, 33, 0.85)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 26px ${MINCHO_FONT_FAMILY}`;
    ctx.fillText("済", 0, 2);
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture | null {
  const size = 128;
  const target = createCanvas2D(size, size);
  if (!target) return null;

  const { canvas, ctx } = target;
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(19, 22, 29, 0.20)");
  gradient.addColorStop(0.55, "rgba(19, 22, 29, 0.09)");
  gradient.addColorStop(1, "rgba(19, 22, 29, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
