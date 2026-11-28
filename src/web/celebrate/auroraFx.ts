/**
 * Aurora, a mission win (designer 2026-11-28: "create 2 more ... be ambitious"; times in timeline.ts
 * AURORA): the Field falls into night and three curtains of aurora light fold down across it; the rays
 * turn to meet in a crown over the banner.
 *
 * 1. (0-1.0 s) The Field darkens as night falls; stars come out over it; the Mission bar's cells shimmer
 *    and the first curtain unfurls from the top of the Field.
 * 2. (1.0-3.3 s) Three curtains fold down across the Field one after another: each a wavering lower edge
 *    of bright cyan particles with rays rising from it that fade up into violet and rose, bright patches
 *    running along it. Each sector a curtain passes glows in its light and sways gently.
 * 3. (3.3-4.6 s) The curtains gather into one band across the middle; their rays turn to meet in a point
 *    over it (a corona, as a real aurora overhead does); it flares gold, every tile lifts a little, the
 *    bar turns gold; the banner sits under the crown.
 * 4. (4.6-6.0 s) The light climbs away off the top of the Field; the stars fade; everything fades.
 *
 * Every ray and every particle is worked out from the time alone, never stepped frame by frame. A slow
 * machine draws fewer rays (`q`), never slower. The same colours for every Company. Screen only: no rule.
 */

import { easeInOut, easeOut } from "../anim.js";
import { AURORA as A_, span } from "./timeline.js";
import { type Geo, hexPts, puff, rgba, seq } from "./winKit.js";

const TEAL = "90 235 215";
const ICE = "190 240 255";
const WHITE = "255 255 255";
const VIOLET = "160 120 255";
const ROSE = "255 130 210";
const GOLD = "255 206 120";
/** Each curtain's lower edge, and the colour its rays fade into. */
const EDGE = [TEAL, ICE, TEAL] as const;
const TOP = [VIOLET, ROSE, VIOLET] as const;
const PH = [0.3, 2.1, 4.4];

/** When cell i of n shimmers (s). */
export function auroraCellAt(i: number, n: number): number {
  const step = n > 1 ? Math.min(A_.cellStep, A_.cellsIn / (n - 1)) : 0;
  return A_.cellsAt + i * step;
}

/** How far curtain k has come down (0 at the top of the Field, 1 at the bottom). */
export function descent(k: number, t: number): number {
  return easeInOut(Math.min(1, Math.max(0, (t - A_.curtains[k]!) / A_.cross)));
}

/** Where each curtain comes to rest (share of the Field's height): the first lowest. */
const REST = [0.98, 0.82, 0.66];

/** Where curtain k's lower edge is at x (Field pixels) at time t: folding down, then gathered into one band across the middle, then climbing away. */
export function curtainEdge(k: number, x: number, t: number, fw: number, fh: number): number {
  const u = x / (fw || 1);
  const wave = fh * 0.06 * Math.sin(u * Math.PI * 2 * 1.3 + PH[k]! + t * 0.9) + fh * 0.03 * Math.sin(u * Math.PI * 2 * 3.1 - t * 1.7 + PH[k]! * 2);
  const down = -0.12 * fh + descent(k, t) * (REST[k]! + 0.12) * fh + wave;
  const g = easeInOut(span(t, A_.gather));
  const band = fh * (0.56 + (k - 1) * 0.04) + wave * 0.35;
  const up = t > A_.fade ? -fh * 1.3 * easeInOut(span(t, [A_.fade, A_.out[1]])) : 0;
  return down + (band - down) * g + up;
}

/** Curtain k is showing at time t. */
export const curtainOn = (k: number, t: number) => t >= A_.curtains[k]!;

/** The crown's point over the Field's middle (Field pixels). */
export const crownAt = (fw: number, fh: number): [number, number] => [fw / 2, fh * 0.14];

/** How much the curtains light the point (x, y) at time t (0..1): most at a lower edge, softly under the rays above it. */
export function auroraTouch(fw: number, fh: number, tile: number, x: number, y: number, t: number): number {
  let best = 0;
  const ray = fh * 0.28;
  for (let k = 0; k < 3; k++) {
    if (!curtainOn(k, t)) continue;
    const on = Math.min(1, (t - A_.curtains[k]!) / 0.3);
    const d = y - curtainEdge(k, x, t, fw, fh);
    const edge = Math.exp(-((d / (tile * 0.6)) ** 2));
    const under = d < 0 && d > -ray ? 0.4 * (1 + d / ray) : 0;
    best = Math.max(best, Math.max(edge, under) * on);
  }
  return best * (1 - span(t, [A_.fade, A_.out[0]]));
}

/** A tile's look: glowing tiles sway as the light passes; every tile lifts a little at the crown. */
export function auroraLook(fw: number, fh: number, x: number, y: number, t: number, tile: number): { dx: number; dy: number; scale: number } | undefined {
  const p = auroraTouch(fw, fh, tile, x, y, t);
  const age = t - A_.crown;
  const b = age >= 0 && age < 0.7 ? Math.exp(-age / 0.15) * Math.cos(age * 18) : 0;
  if (p < 0.02 && Math.abs(b) < 0.01) return undefined;
  return { dx: tile * 0.045 * p * Math.sin(t * 4.5 + x * 0.03), dy: -tile * (0.03 * p + 0.04 * b), scale: 1 + 0.03 * p + 0.03 * b };
}

// The stars, fixed once.
const STARS = (() => {
  const r = seq(9137);
  return Array.from({ length: 140 }, (_, i) => ({ x: r(), y: r(), s: 0.4 + r() * 1.1, tw: r() * 6.3, w: 1 + r() * 3, rank: i / 140 }));
})();

/**
 * One frame of Aurora, drawn on MissionWin's page-wide canvas. `all` is how much of it shows (1 until the
 * cross-fade); `still`: the reduced-motion picture (the band and its crown over the middle).
 */
export function paintAurora(g: CanvasRenderingContext2D, geo: Geo, t: number, still: boolean, all: number, q: number): void {
  const { fx, fy, fw, fh, tile } = geo;
  const n = geo.cells.length;
  const tt = still ? A_.crown + 0.4 : t;
  const crownAge = still ? 9 : t - A_.crown;
  const crownK = crownAge >= 0 ? Math.exp(-crownAge / 0.2) : 0;
  const gold = still || t >= A_.crown;

  // The cells shimmer in the aurora's colours; gold at the crown.
  g.save();
  g.globalCompositeOperation = "lighter";
  geo.cells.forEach((c, i) => {
    const age = still ? 9 : t - auroraCellAt(i, n);
    if (age < 0) return;
    const x = c.left + c.width / 2;
    const y = c.top + c.height / 2;
    const s = Math.max(c.width, c.height);
    const sh = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.3);
    const k = Math.exp(-age / 0.25);
    const grd = g.createRadialGradient(x, y, 0, x, y, s * (1.3 + 1.0 * (k + crownK)));
    grd.addColorStop(0, rgba(WHITE, (0.25 + 0.6 * (k + crownK) + 0.15 * sh) * all));
    grd.addColorStop(0.35, rgba(gold ? GOLD : i % 2 ? VIOLET : TEAL, (0.3 + 0.2 * sh) * all));
    grd.addColorStop(1, rgba(TEAL, 0));
    g.fillStyle = grd;
    g.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
  });
  g.restore();

  g.save();
  g.beginPath();
  g.rect(fx, fy, fw, fh);
  g.clip();
  g.globalCompositeOperation = "lighter";

  // The stars.
  const night = still ? 1 : easeOut(span(t, A_.dim)) * (1 - span(t, [A_.fade, A_.out[1]]));
  for (const s of STARS) {
    if (s.rank > q) continue;
    const tw = 0.45 + 0.55 * Math.sin((still ? 0 : t) * s.w + s.tw) ** 2;
    puff(g, s.rank < 0.15 ? ICE : WHITE, fx + s.x * fw, fy + s.y * fh, tile * 0.018 * s.s, tw * night * 0.8 * all);
  }

  // The sectors the light falls on glow in it; gold corners at the crown.
  const R = tile * 0.46;
  for (const [, sx, sy] of geo.sectors) {
    const p = still ? 0 : auroraTouch(fw, fh, tile, sx, sy, t);
    const x = fx + sx;
    const y = fy + sy;
    if (p > 0.03) puff(g, TEAL, x, y, R * 1.15, 0.22 * p * all);
    const corner = still ? 0.7 : crownAge >= 0 ? Math.min(1, crownAge / 0.2) * (0.5 + 0.5 * crownK) * (1 - span(t, [A_.fade, A_.out[0]])) : 0;
    if (corner > 0.02) for (const [px, py] of hexPts(x, y, R * 0.96)) puff(g, crownK > 0.3 ? WHITE : GOLD, px, py, R * 0.07, corner * all);
  }

  // The curtains: columns of rays rising from each wavering lower edge.
  const [cx, cy] = crownAt(fw, fh);
  const cols = Math.max(24, Math.round(80 * q));
  const gth = easeInOut(span(tt, A_.gather));
  const steps = 15;
  for (let k = 0; k < 3; k++) {
    if (!still && !curtainOn(k, t)) continue;
    const on = still ? 1 : Math.min(1, (t - A_.curtains[k]!) / 0.5);
    for (let j = 0; j <= cols; j++) {
      const x = (j / cols) * fw * 1.1 - fw * 0.05;
      const yb = curtainEdge(k, x, tt, fw, fh);
      // Bright patches running along the edge, and each ray's own flicker.
      const patch = 0.45 + 0.55 * Math.sin(x * 0.025 - tt * 3.2 + k * 2) ** 2;
      const flick = 0.75 + 0.25 * Math.sin(tt * 13 + j * 2.7 + k);
      const len = fh * (0.2 + 0.1 * Math.sin(j * 1.7 + tt * 1.3 + k)) * (0.6 + 0.4 * on);
      // Straight up, turning to meet the crown as the curtains gather.
      const dxC = cx - x;
      const dyC = cy - yb;
      const dC = Math.hypot(dxC, dyC) || 1;
      const ux = (dxC / dC) * gth;
      const uy = -(1 - gth) + (dyC / dC) * gth;
      const uL = Math.hypot(ux, uy) || 1;
      const L = len * (1 - gth) + dC * 0.85 * gth;
      const sway = tile * 0.08 * Math.sin(tt * 1.6 + j * 0.4 + k);
      for (let m = 0; m < steps; m++) {
        const v = m / (steps - 1);
        const px = fx + x + (ux / uL) * L * v + sway * v;
        const py = fy + yb + (uy / uL) * L * v;
        const a = (1 - v) ** 1.4 * patch * flick * on * all * (m === 0 ? 1 : 0.6);
        puff(g, m === 0 ? (patch > 0.85 ? WHITE : EDGE[k]!) : v < 0.4 ? EDGE[k]! : TOP[k]!, px, py, tile * (m === 0 ? 0.055 : 0.07 - 0.015 * v), a * (m === 0 ? 1 : 0.7));
      }
      // A faint curtain glow below the edge.
      if (j % 3 === 0) puff(g, EDGE[k]!, fx + x, fy + yb + tile * 0.12, tile * 0.25, 0.08 * patch * on * all);
    }
  }

  // The crown: a flare where the rays meet, with rays of particles out of it.
  if (gth > 0 || still) {
    const glow = (still ? 0.6 : gth * 0.5 + crownK) * (still ? 1 : 1 - span(t, [A_.fade, A_.out[1]]));
    puff(g, gold ? GOLD : VIOLET, fx + cx, fy + cy, tile * (0.9 + 0.5 * crownK), 0.22 * glow * all);
    puff(g, WHITE, fx + cx, fy + cy, tile * (0.16 + 0.22 * crownK), 0.8 * glow * all);
    if (crownAge >= 0 || still) {
      const rays = 18;
      const reach = tile * (1.2 + (still ? 1 : easeOut(Math.min(1, crownAge / 0.5))) * 1.6);
      for (let j = 0; j < rays; j++) {
        const a = (j / rays) * Math.PI * 2 + (still ? 0 : t * 0.25);
        for (let m = 1; m <= 6; m++) {
          const v = m / 6;
          puff(g, m < 3 ? WHITE : GOLD, fx + cx + Math.cos(a) * reach * v, fy + cy + Math.sin(a) * reach * v * 0.7, tile * 0.03, (1 - v) * glow * all);
        }
      }
    }
  }
  g.restore();
}
