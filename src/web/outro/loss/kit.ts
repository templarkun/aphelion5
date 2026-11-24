/**
 * Drawing helpers shared by the two loss outros: soft light sprites (energy is drawn as particles,
 * the designer's standing taste), film grain, vignette. Everything that moves is worked out from the
 * film time and a fixed scatter (`hash01`), so any moment can be drawn by itself (a skip, a still).
 */

import type { Rgb } from "../types.js";

export { hash01 } from "./timeline.js";

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 0 before a, 1 after b, a smooth step between. */
export function smooth(a: number, b: number, t: number): number {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
}
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** "r g b" -> [r, g, b]. */
export function rgbOf(c: Rgb): [number, number, number] {
  const [r = 255, g = 255, b = 255] = c.split(/\s+/).map(Number);
  return [r, g, b];
}
export const rgba = (c: [number, number, number], a: number): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** The enemy's colours: crimson to ember orange, the same in every loss outro. */
export const HOSTILE: [number, number, number] = [255, 58, 46];
export const EMBER: [number, number, number] = [255, 140, 60];

const sprites = new Map<string, HTMLCanvasElement>();
/** A soft round light of one colour, white-hot in the middle (cached per colour). */
export function sprite(c: [number, number, number]): HTMLCanvasElement {
  const key = c.join(",");
  let s = sprites.get(key);
  if (s) return s;
  s = document.createElement("canvas");
  s.width = s.height = 64;
  const g = s.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.12, rgba(c, 0.95));
  gr.addColorStop(0.4, rgba(c, 0.35));
  gr.addColorStop(1, rgba(c, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  sprites.set(key, s);
  return s;
}

/** One light: size = its radius in points; alpha 0..1. Call inside a "lighter" composite for glow. */
export function glow(g: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, size: number, alpha: number): void {
  if (alpha <= 0.004 || size <= 0.2) return;
  g.globalAlpha = Math.min(1, alpha);
  g.drawImage(img, x - size, y - size, size * 2, size * 2);
}

let grainTile: HTMLCanvasElement | undefined;
/** Film grain over the whole picture, moving every frame; amount 0..1. */
export function grain(g: CanvasRenderingContext2D, w: number, h: number, t: number, amount: number): void {
  if (amount <= 0) return;
  if (!grainTile) {
    grainTile = document.createElement("canvas");
    grainTile.width = grainTile.height = 160;
    const gg = grainTile.getContext("2d")!;
    const d = gg.createImageData(160, 160);
    let seed = 1234567;
    for (let i = 0; i < d.data.length; i += 4) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      const v = seed >>> 24;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    gg.putImageData(d, 0, 0);
  }
  const f = Math.floor(t * 24);
  const ox = -((f * 53) % 160);
  const oy = -((f * 97) % 160);
  g.save();
  g.globalCompositeOperation = "overlay";
  g.globalAlpha = amount;
  for (let y = oy; y < h; y += 160) for (let x = ox; x < w; x += 160) g.drawImage(grainTile, x, y);
  g.restore();
}

/** Darker corners. */
export function vignette(g: CanvasRenderingContext2D, w: number, h: number, strength: number): void {
  const r = Math.hypot(w, h) / 2;
  const v = g.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, `rgba(0,0,0,${strength})`);
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
}

/** The part of the picture the Debrief card leaves open (at the side, or above it along the foot). */
export interface FreeArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a film puts its middle: the open part once the card is in, easing over from the whole picture. */
export function frameOf(w: number, h: number, free: FreeArea | undefined, k: number): { cx: number; cy: number; s: number } {
  const f = free ?? { x: 0, y: 0, w, h };
  const cx = lerp(w / 2, f.x + f.w / 2, k);
  const cy = lerp(h / 2, f.y + f.h / 2, k);
  const s = lerp(Math.min(w, h), Math.min(f.w, f.h * 1.15), k);
  return { cx, cy, s: Math.max(120, s) };
}

export interface LossScene {
  /** Draw film time t into g (w x h points); `quality` 0.45..1 asks for fewer particles on a slow machine. */
  draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, free: FreeArea | undefined, quality: number): void;
}
