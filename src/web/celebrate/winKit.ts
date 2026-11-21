/**
 * What the wins share (Mission Complete, Perimeter Sweep, Sector Flip; MissionWin.tsx): where the Field
 * and the Mission bar are on the page, a few drawing helpers, and how well this machine keeps up (a slow
 * one draws fewer particles and no blur, never slower). Screen only: no rule here.
 */

import type { WinShow } from "./detect.js";
import { type ShinePath, shinePath } from "./shine.js";

export interface Geo {
  /** The Field on the page. */
  fx: number;
  fy: number;
  fw: number;
  fh: number;
  /** A tile's height (two hex radii). */
  tile: number;
  /** Sector centres, in the Field's own pixels. */
  sectors: [string, number, number][];
  /** Mission Complete's sweep across the Field (shine.ts). */
  shine: ShinePath;
  /** Where the wave starts (Perimeter Sweep, Sector Flip), in the Field's own pixels: the sector the unit left, else the middle. */
  ox: number;
  oy: number;
  /** The objective's cells in the Mission bar, on the page. */
  cells: DOMRect[];
}

export function measure(show: WinShow): Geo | undefined {
  const el = document.querySelector<HTMLElement>(".field");
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return undefined;
  const raw: Record<string, [number, number]> = JSON.parse(el.dataset.sectors ?? "{}");
  const sectors = Object.entries(raw).map(([k, [x, y]]) => [k, x, y] as [string, number, number]);
  const tile = Number(el.dataset.tile) || Math.min(r.width, r.height) / 6;
  const from = show.from ? raw[show.from] : undefined;
  const shine = shinePath(r.width, r.height, tile, from);
  const cells = [...document.querySelectorAll<HTMLElement>("[data-mission-bar] [data-mission-group] .m-cell")].map((c) => c.getBoundingClientRect());
  return { fx: r.left, fy: r.top, fw: r.width, fh: r.height, tile, sectors, shine, ox: from?.[0] ?? r.width / 2, oy: from?.[1] ?? r.height / 2, cells };
}

export const rgba = (rgb: string, a: number) => `rgba(${rgb.trim().split(/\s+/).join(",")},${Math.max(0, Math.min(1, a)).toFixed(3)})`;

/** A small fixed random sequence (the same every time). */
export function seq(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}

/** A soft round particle of one colour (made once). */
const DOTS = new Map<string, HTMLCanvasElement>();
export function dot(rgb: string): HTMLCanvasElement {
  let c = DOTS.get(rgb);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.2, rgba(rgb, 0.95));
  grd.addColorStop(0.5, rgba(rgb, 0.3));
  grd.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  DOTS.set(rgb, c);
  return c;
}

/** A soft particle at (x, y), radius r, see-through a. */
export function puff(g: CanvasRenderingContext2D, rgb: string, x: number, y: number, r: number, a: number): void {
  if (a <= 0.004 || r <= 0.05) return;
  g.globalAlpha = Math.min(1, a);
  g.drawImage(dot(rgb), x - r, y - r, 2 * r, 2 * r);
  g.globalAlpha = 1;
}

/** A pointy-topped hexagon's corners (as the Field draws its sectors). */
export function hexPts(x: number, y: number, r: number, sy = 1): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return [x + r * Math.cos(a), y + r * Math.sin(a) * sy] as [number, number];
  });
}

export function hexPath(g: CanvasRenderingContext2D, x: number, y: number, r: number, sy = 1): void {
  g.beginPath();
  hexPts(x, y, r, sy).forEach(([px, py], i) => (i === 0 ? g.moveTo(px, py) : g.lineTo(px, py)));
  g.closePath();
}

/** The lowest share of the particles a slow machine still draws. */
export const MIN_QUALITY = 0.4;
let quality = 1;
let qLast = 0;
let qFrames = 0;
let qLate = 0;
/** Called once a frame: below about 40 frames a second the quality drops (fewer particles, no blur). */
export function keepUp(now: number): number {
  if (qLast && now - qLast < 400) {
    qFrames++;
    if (now - qLast > 25) qLate++;
    if (qFrames >= 30) {
      if (qLate > 20 && quality > MIN_QUALITY) quality = Math.max(MIN_QUALITY, quality * 0.85);
      qFrames = qLate = 0;
    }
  }
  qLast = now;
  return quality;
}
/** The quality now (1 = everything). */
export const winQuality = () => quality;
/** For the tests and the browser check: start again at full quality, or force one. */
export function setWinQuality(q: number): void {
  quality = Math.max(MIN_QUALITY, Math.min(1, q));
}
