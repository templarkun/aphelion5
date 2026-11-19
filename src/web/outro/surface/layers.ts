/**
 * Surface Terraform: the painted layers of the valley (designer 2026-11-19), far to near: the
 * distant mountains, the valley floor, the jagged volcanic ridges at its sides, the rocks right in
 * front of the camera. Each is painted twice, once barren (dark volcanic rock, red ash, dry canyon
 * beds) and once living (emerald and teal growth, moss, glowing flowers, banks along the water), in
 * the angular units of world.ts, so it lines up with what is drawn over it each frame.
 *
 * Every point of a layer knows the moment the green tide reaches it (world.ts `bloomAt`, worked out
 * once into a small `arrive` picture); each frame the living version is shown where the tide has
 * passed, with a glowing front where it is passing now. So any moment can be drawn by itself.
 * The distant mountains only fade from one to the other. The barren pictures are made at once;
 * the living ones a little at a time during the first acts (`jobs`). Looks only.
 */

import { clamp, lerp, rng, smooth } from "../../briefing/styles/intro2/math3.js";
import { BLOOM_FULL } from "./timeline.js";
import { bloomAt, HC, nf, POOL_DEFS, SPIRE_PLACES, streamPaths } from "./world.js";

type C3 = readonly [number, number, number];
const css = (c: C3, a = 1) => `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0} / ${a.toFixed(3)})`;
const mixC = (a: C3, b: C3, k: number): C3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/** How long a point of ground takes to turn green, s; its front glows for the first GLOW s. */
export const BLOOM_FADE = 0.5;
const GLOW = 0.5;
const GLOW_RGB: C3 = [90, 255, 200];
/** The arrival pictures are this many times coarser than the layer. */
const MASK = 4;

export interface Layer {
  id: "far" | "floor" | "ridgeL" | "ridgeR" | "near";
  /** "board": a flat piece of scenery standing at depth Z; "floor": the valley floor (drawn sheared, so its parallax is right at every depth). */
  kind: "board" | "floor";
  Z: number;
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  /** Layer px per angular unit. */
  R: number;
  lw: number;
  lh: number;
  barren: HTMLCanvasElement;
  lush: HTMLCanvasElement | undefined;
  /** Golden light along the crests, shown when the sun breaks through (boards of rock). */
  crest: HTMLCanvasElement | undefined;
  mask: Mask | undefined;
  /** The top of a board's rock at u (v units): for the glowing flowers placed on it. */
  top?: ((u: number) => number) | undefined;
}
interface Mask {
  mw: number;
  mh: number;
  arrive: Float32Array;
  rows: number;
  lo: number;
  hi: number;
  cv: HTMLCanvasElement;
  img: ImageData;
  glow: HTMLCanvasElement;
  glowImg: ImageData;
  /** Tiles of TILE layer px: the earliest and latest arrival in each (so most of a layer is drawn whole, barren or living). */
  tx: number;
  ty: number;
  tlo: Float32Array;
  thi: Float32Array;
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Fine speckle, laid over a picture so the rock and the growth have a grain. */
let grainTile: HTMLCanvasElement | undefined;
function grain(g: CanvasRenderingContext2D, w: number, h: number, alpha: number, clip?: () => void): void {
  if (!grainTile) {
    grainTile = canvas(160, 160);
    const gg = grainTile.getContext("2d")!;
    const im = gg.createImageData(160, 160);
    const R = rng(777);
    for (let i = 0; i < 160 * 160; i++) {
      const v = 70 + R() * 120;
      im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
      im.data[i * 4 + 3] = 255;
    }
    gg.putImageData(im, 0, 0);
  }
  g.save();
  if (clip) {
    clip();
    g.clip();
  }
  g.globalCompositeOperation = "overlay";
  g.globalAlpha = alpha;
  g.fillStyle = g.createPattern(grainTile, "repeat")!;
  g.fillRect(0, 0, w, h);
  g.restore();
}

/** A soft round blot (a patch of ash, moss or flowers), flattened by `flat`. */
function blot(g: CanvasRenderingContext2D, x: number, y: number, rx: number, flat: number, c: C3, a: number): void {
  if (rx < 0.4) return;
  g.save();
  g.translate(x, y);
  g.scale(1, flat);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  grd.addColorStop(0, css(c, a));
  grd.addColorStop(0.6, css(c, a * 0.55));
  grd.addColorStop(1, css(c, 0));
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, 0, rx, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------- profiles of rock

/** Jagged rock: ridged noise, 0..1. */
function jag(u: number, seed: number, freq: number): number {
  let y = 0;
  let amp = 0.6;
  let f = freq;
  for (let o = 0; o < 6; o++) {
    const n = clamp((nf(u * f + seed * 37 + o * 53, seed * 11 + o * 29) - 0.5) * 3.2, -1, 1);
    const r = 1 - Math.abs(n);
    y += r * r * r * amp;
    amp *= 0.48;
    f *= 2.17;
  }
  return y;
}
/** Needles of rock standing out of a crest: thin sharp spikes at fixed places. */
function needles(u: number, seed: number, every: number, high: number): number {
  const k = Math.floor(u / every);
  let y = 0;
  for (let j = k - 1; j <= k + 1; j++) {
    const R = rng(Math.abs(j * 7919 + seed * 104729) % 2147483646 + 1);
    if (R() < 0.45) continue;
    const c = (j + 0.2 + 0.6 * R()) * every;
    const wd = every * (0.12 + 0.2 * R());
    const d = Math.abs(u - c) / wd;
    if (d < 1) y = Math.max(y, high * (0.4 + 0.6 * R()) * (1 - d) * (1 - d * 0.4));
  }
  return y;
}

interface BoardSpec {
  id: Layer["id"];
  Z: number;
  u0: number;
  u1: number;
  /** Height of the rock (km over the floor) at u. */
  height: (u: number) => number;
  seed: number;
  /** Which way the slopes the sun lights face: +1 slopes falling to the right, −1 to the left. */
  sunSide: 1 | -1;
}

/** Points of a board's top line in layer px; and the top's v at any u. */
function profile(b: BoardSpec, R: number, v0: number): { pts: [number, number][]; top: (u: number) => number } {
  const pts: [number, number][] = [];
  const step = 2 / R;
  for (let u = b.u0; u <= b.u1 + step; u += step) {
    const v = (HC - b.height(u)) / b.Z;
    pts.push([(u - b.u0) * R, (v - v0) * R]);
  }
  const top = (u: number) => (HC - b.height(u)) / b.Z;
  return { pts, top };
}

function silhouette(g: CanvasRenderingContext2D, pts: [number, number][], bottom: number): void {
  g.beginPath();
  g.moveTo(pts[0]![0], bottom);
  for (const p of pts) g.lineTo(p[0], p[1]);
  g.lineTo(pts[pts.length - 1]![0], bottom);
  g.closePath();
}

interface RockLook {
  top: C3;
  base: C3;
  face: C3;
  shade: C3;
  scree: C3;
  strata: number;
}
const BARREN_ROCK: RockLook = { top: [34, 26, 30], base: [62, 34, 26], face: [104, 66, 48], shade: [14, 10, 12], scree: [96, 44, 28], strata: 0.35 };
const LUSH_ROCK: RockLook = { top: [36, 52, 50], base: [30, 92, 66], face: [86, 116, 96], shade: [10, 22, 20], scree: [40, 120, 80], strata: 0.15 };

/** Paint a board of rock: the silhouette, faces lit along one side, gullies, strata, scree at the foot; living: growth over the lower slopes. */
function paintRock(g: CanvasRenderingContext2D, b: BoardSpec, pts: [number, number][], lw: number, lh: number, R: number, look: RockLook, lush: boolean): void {
  const R0 = rng(b.seed);
  const baseY = lh;
  let minY = Infinity;
  for (const p of pts) minY = Math.min(minY, p[1]);
  silhouette(g, pts, baseY);
  const grd = g.createLinearGradient(0, minY, 0, baseY);
  grd.addColorStop(0, css(look.top));
  grd.addColorStop(1, css(look.base));
  g.fillStyle = grd;
  g.fill();
  g.save();
  silhouette(g, pts, baseY);
  g.clip();
  // Faces: from each point of the top line, a wedge down the slope, lit on the sun's side.
  const n = pts.length;
  for (let i = 2; i < n - 2; i += 2) {
    const [x, y] = pts[i]!;
    const slope = pts[i + 2]![1] - pts[i - 2]![1];
    const lit = clamp((slope * b.sunSide) / 6);
    const dark = clamp((-slope * b.sunSide) / 6);
    const len = (baseY - y) * (0.25 + 0.6 * R0());
    if (lit > 0.05) {
      g.fillStyle = css(look.face, 0.1 + 0.32 * lit);
      g.beginPath();
      g.moveTo(x - 2, y + 1);
      g.lineTo(x + 3, y + 1);
      g.lineTo(x + 3 + b.sunSide * len * 0.25, y + len);
      g.lineTo(x - 2 + b.sunSide * len * 0.32, y + len * 0.8);
      g.fill();
    } else if (dark > 0.05) {
      g.fillStyle = css(look.shade, 0.15 + 0.3 * dark);
      g.fillRect(x - 1.5, y, 3.5, len * 0.9);
    }
  }
  // Gullies: thin dark lines running down from the crest.
  g.lineCap = "round";
  for (let i = 0; i < n; i += 3) {
    if (R0() > 0.45) continue;
    const [x, y] = pts[i]!;
    const len = (baseY - y) * (0.2 + 0.7 * R0());
    g.strokeStyle = css(look.shade, 0.18 + 0.2 * R0());
    g.lineWidth = Math.max(0.6, R * 0.0018 * (0.5 + R0()));
    g.beginPath();
    g.moveTo(x, y + 2);
    let gx = x;
    for (let k = 1; k <= 4; k++) {
      gx += (R0() - 0.5) * 6 + b.sunSide * 1.5;
      g.lineTo(gx, y + (len * k) / 4);
    }
    g.stroke();
  }
  // Strata.
  for (let k = 0; k < 9; k++) {
    const yy = minY + (baseY - minY) * (0.2 + 0.75 * R0());
    g.strokeStyle = css(look.shade, look.strata * (0.4 + 0.6 * R0()));
    g.lineWidth = Math.max(0.6, R * 0.0012);
    g.beginPath();
    for (let x = 0; x <= lw; x += 12) {
      const y = yy + Math.sin(x * 0.01 + k) * 6 + (nf(x * 0.05 + k * 40, k * 13) - 0.5) * 18;
      if (x) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
  }
  // Scree and ash (barren) or growth (living) over the foot of the slope.
  const foot = g.createLinearGradient(0, baseY - (baseY - minY) * 0.45, 0, baseY);
  foot.addColorStop(0, css(look.scree, 0));
  foot.addColorStop(1, css(look.scree, lush ? 0.85 : 0.6));
  g.fillStyle = foot;
  g.fillRect(0, minY, lw, baseY - minY);
  if (lush) {
    // Growth over the slopes below an uneven tree line; moss on the rock above it.
    const R1 = rng(b.seed + 5);
    const k = R / 900;
    const line = (x: number, y: number) => y + (baseY - y) * (0.12 + 0.55 * nf(x * 0.03 + b.seed * 9, 17 + b.seed));
    g.save();
    g.beginPath();
    g.moveTo(pts[0]![0], baseY);
    for (const p of pts) g.lineTo(p[0], line(p[0], p[1]));
    g.lineTo(pts[n - 1]![0], baseY);
    g.closePath();
    const gg = g.createLinearGradient(0, minY, 0, baseY);
    gg.addColorStop(0, css([46, 132, 92], 0.85));
    gg.addColorStop(1, css([24, 104, 72], 0.95));
    g.fillStyle = gg;
    g.fill();
    g.clip();
    const greens: C3[] = [
      [34, 128, 84],
      [28, 140, 120],
      [70, 170, 96],
      [16, 84, 62],
      [120, 200, 112],
      [40, 150, 140],
    ];
    // Foliage: fine speckle of many greens.
    for (let i = 0; i < n * 9; i++) {
      const p = pts[Math.floor(R1() * n)]!;
      const y = p[1] + (baseY - p[1]) * Math.pow(R1(), 0.8);
      const r = (0.6 + R1() * 2.2) * k;
      g.fillStyle = css(greens[Math.floor(R1() * greens.length)]!, 0.55 + 0.35 * R1());
      g.fillRect(p[0] + (R1() - 0.5) * 6, y, r * 1.6, r);
    }
    // Clumps of trees: three small crowns each, dark below, lit on the sun's side.
    for (let i = 0; i < n * 0.9; i++) {
      const p = pts[Math.floor(R1() * n)]!;
      const y = p[1] + (baseY - p[1]) * (0.25 + 0.75 * Math.pow(R1(), 0.6));
      const r = (1 + R1() * 2.2) * k;
      for (let c = 0; c < 3; c++) {
        const cx = p[0] + (c - 1) * r * 1.1 + (R1() - 0.5) * r;
        const cy = y + (R1() - 0.5) * r * 0.8;
        g.fillStyle = css([10 + c * 4, 58 + c * 8, 46 + c * 4], 0.9);
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = css(greens[(c + i) % greens.length]!, 0.55);
        g.beginPath();
        g.arc(cx + b.sunSide * r * 0.25, cy - r * 0.35, r * 0.5, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
    for (let i = 0; i < n * 0.5; i++) {
      const p = pts[Math.floor(R1() * n)]!;
      const y = p[1] + (baseY - p[1]) * R1() * 0.4;
      blot(g, p[0], y, (2 + R1() * 6) * k, 0.6, [60, 140, 96], 0.25);
    }
  } else {
    // Ash streaks down the slopes.
    const R1 = rng(b.seed + 9);
    for (let i = 0; i < n * 0.4; i++) {
      const p = pts[Math.floor(R1() * n)]!;
      const y = p[1] + (baseY - p[1]) * (0.4 + 0.6 * R1());
      blot(g, p[0], y, (6 + R1() * 16) * (R / 900), 0.5, [120, 56, 34], 0.25);
    }
  }
  g.restore();
  grain(g, lw, lh, lush ? 0.22 : 0.3, () => silhouette(g, pts, baseY));
}

/** The golden light along a board's crest: strongest on the slopes that face the sun. */
function paintCrest(g: CanvasRenderingContext2D, b: BoardSpec, pts: [number, number][], R: number): void {
  g.save();
  g.globalCompositeOperation = "lighter";
  g.lineCap = "round";
  g.lineJoin = "round";
  const n = pts.length;
  for (const [wide, a] of [
    [6, 0.1],
    [2.2, 0.35],
    [0.9, 0.7],
  ] as const) {
    g.lineWidth = Math.max(0.7, wide * (R / 900));
    for (let i = 1; i < n - 1; i++) {
      const slope = (pts[i + 1]![1] - pts[i - 1]![1]) * b.sunSide;
      const k = clamp(0.25 + slope / 4);
      if (k < 0.05) continue;
      g.strokeStyle = `rgb(255 ${(190 + 40 * k) | 0} ${(110 + 60 * k) | 0} / ${(a * k).toFixed(3)})`;
      g.beginPath();
      g.moveTo(pts[i - 1]![0], pts[i - 1]![1] + 0.5);
      g.lineTo(pts[i + 1]![0], pts[i + 1]![1] + 0.5);
      g.stroke();
    }
  }
  g.restore();
}

// ---------------------------------------------------------------- the distant mountains

/** The distant volcano (u), whose crater glows and smokes while the world is barren (the smoke is drawn by the scene). */
export const VOLCANO_U = 0.58;
const VOLCANO_Z = 32;
export const volcanoTop = (): number => (HC - farBackH(VOLCANO_U)) / VOLCANO_Z;
function farBackH(u: number): number {
  return 1.2 + 2.3 * jag(u, 3, 70) + 2.9 * Math.exp(-(((u - VOLCANO_U) / 0.075) ** 2)) - 0.5 * Math.exp(-(((u - VOLCANO_U) / 0.012) ** 2));
}

function paintFar(g: CanvasRenderingContext2D, lw: number, lh: number, R: number, u0: number, v0: number, lush: boolean): void {
  const frontH = (u: number) => 0.25 + 1.15 * jag(u, 8, 130) * (0.55 + 0.45 * Math.sin(u * 3 + 1));
  const line = (H: (u: number) => number, Zr: number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let x = -2; x <= lw + 2; x += 2) {
      const u = u0 + x / R;
      pts.push([x, ((HC - H(u)) / Zr - v0) * R]);
    }
    return pts;
  };
  const back = line(farBackH, VOLCANO_Z);
  const front = line(frontH, 14);
  const horizon = (0 - v0) * R;
  const both = () => {
    silhouette(g, back, lh);
    const p = new Path2D();
    p.moveTo(front[0]![0], lh);
    for (const q of front) p.lineTo(q[0], q[1]);
    p.lineTo(front[front.length - 1]![0], lh);
    p.closePath();
    g.clip(p);
  };
  /** Relief on a range: gullies down from the crest, the sun's side a little lighter. */
  const relief = (pts: [number, number][], dark: C3, light: C3, seed: number) => {
    const R1 = rng(seed);
    g.save();
    silhouette(g, pts, lh);
    g.clip();
    g.lineCap = "round";
    for (let i = 2; i < pts.length - 2; i += 1 + Math.floor(R1() * 3)) {
      const [x, y] = pts[i]!;
      const slope = pts[i + 2]![1] - pts[i - 2]![1];
      const len = (horizon - y) * (0.2 + 0.6 * R1());
      if (len <= 1) continue;
      g.strokeStyle = slope < 0 ? css(light, 0.05 + 0.14 * clamp(-slope / 4)) : css(dark, 0.05 + 0.14 * clamp(slope / 4));
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(x, y + 0.5);
      g.lineTo(x + (slope < 0 ? -1 : 1) * len * 0.18, y + len);
      g.stroke();
    }
    g.restore();
  };
  // The back range: high, hazy.
  silhouette(g, back, lh);
  const gb = g.createLinearGradient(0, horizon - R * 0.15, 0, horizon);
  gb.addColorStop(0, css(lush ? [112, 150, 178] : [88, 64, 58]));
  gb.addColorStop(1, css(lush ? [170, 204, 220] : [132, 94, 72]));
  g.fillStyle = gb;
  g.fill();
  relief(back, lush ? [70, 104, 136] : [50, 34, 32], lush ? [210, 230, 240] : [170, 120, 90], 31);
  if (lush) {
    // Snow on the high peaks.
    g.save();
    silhouette(g, back, lh);
    g.clip();
    const snow = horizon - R * 0.085;
    for (let i = 0; i < back.length; i++) {
      const p = back[i]!;
      if (p[1] > snow) continue;
      g.fillStyle = "rgb(244 250 255 / 0.7)";
      g.fillRect(p[0] - 1, p[1], 2.5, (snow - p[1]) * (0.35 + 0.3 * nf(i * 0.7, 5)));
    }
    g.restore();
  } else {
    // The volcano's crater glows a dull red.
    const cx = (VOLCANO_U - u0) * R;
    const cy = (volcanoTop() - v0) * R;
    g.save();
    silhouette(g, back, lh);
    g.clip();
    blot(g, cx, cy + 3, R * 0.016, 0.45, [255, 90, 40], 0.75);
    g.restore();
  }
  // The front range: darker, nearer.
  silhouette(g, front, lh);
  const gf = g.createLinearGradient(0, horizon - R * 0.08, 0, horizon);
  gf.addColorStop(0, css(lush ? [52, 112, 96] : [56, 38, 36]));
  gf.addColorStop(1, css(lush ? [86, 152, 122] : [88, 54, 42]));
  g.fillStyle = gf;
  g.fill();
  relief(front, lush ? [24, 70, 60] : [30, 20, 20], lush ? [130, 200, 140] : [140, 90, 64], 47);
  if (lush) {
    g.save();
    silhouette(g, front, lh);
    g.clip();
    const R1 = rng(41);
    for (let i = 0; i < 260; i++) blot(g, R1() * lw, horizon - R1() * R * 0.05, R * (0.003 + R1() * 0.008), 0.5, R1() > 0.5 ? [120, 196, 124] : [40, 116, 98], 0.4);
    g.restore();
  }
  // Haze where the mountains meet the plain.
  g.save();
  both();
  const hz = g.createLinearGradient(0, horizon - R * 0.07, 0, horizon + 2);
  hz.addColorStop(0, css(lush ? [200, 228, 240] : [150, 104, 70], 0));
  hz.addColorStop(1, css(lush ? [200, 228, 240] : [150, 104, 70], 0.7));
  g.fillStyle = hz;
  g.fillRect(0, 0, lw, lh);
  g.restore();
  grain(g, lw, lh, 0.12, both);
}

// ---------------------------------------------------------------- the valley floor

interface FloorThings {
  patches: { X: number; Z: number; r: number; k: number }[];
  boulders: { X: number; Z: number; s: number; pts: [number, number][]; k: number }[];
  cracks: { pts: [number, number][]; glow: boolean }[];
  tufts: { X: number; Z: number; h: number; k: number; lean: number }[];
  trees: { X: number; Z: number; h: number; r: number; k: number; lean: number }[];
  spots: { X: number; Z: number; k: number }[];
}

function nearStream(X: number, Z: number): number {
  let best = Infinity;
  for (const p of streamPaths()) for (let j = 0; j < p.x.length; j += 2) best = Math.min(best, Math.hypot(X - p.x[j]!, Z - p.z[j]!));
  return best;
}

function floorThings(u0: number, u1: number, vmax: number): FloorThings {
  const R = rng(2026);
  const pick = (bias: number) => {
    const v = 0.004 + (vmax - 0.004) * Math.pow(R(), bias);
    const Z = HC / v;
    const X = (u0 + R() * (u1 - u0)) * Z;
    return { X, Z };
  };
  const patches = Array.from({ length: 460 }, () => ({ ...pick(1), r: 0, k: Math.floor(R() * 5) })).map((p) => ({ ...p, r: p.Z * (0.03 + 0.09 * R()) }));
  const boulders = Array.from({ length: 170 }, () => {
    const at = pick(0.55);
    const m = 6 + Math.floor(R() * 3);
    const pts = Array.from({ length: m }, (_, i): [number, number] => {
      const a = (i / m) * Math.PI * 2;
      const r = 0.6 + R() * 0.5;
      return [Math.cos(a) * r, Math.sin(a) * r * 0.62 - (Math.sin(a) < 0 ? 0.25 : 0)];
    });
    return { ...at, s: 0.004 + 0.016 * R() * R() + 0.004 * R(), pts, k: R() };
  });
  const cracks = Array.from({ length: 80 }, (_, i) => {
    let { X, Z } = pick(0.6);
    const pts: [number, number][] = [[X, Z]];
    let a = R() * Math.PI * 2;
    for (let k = 0; k < 5; k++) {
      a += (R() - 0.5) * 1.6;
      const l = 0.02 + R() * 0.08 * Math.min(Z, 4);
      X += Math.cos(a) * l;
      Z = Math.max(0.3, Z + Math.sin(a) * l);
      pts.push([X, Z]);
    }
    return { pts, glow: i % 6 === 0 };
  });
  const tufts: FloorThings["tufts"] = [];
  for (let i = 0; i < 2800; i++) {
    const at = pick(0.8);
    // Thicker growth along the water.
    if (nearStream(at.X, at.Z) > 0.25 && R() < 0.35) continue;
    tufts.push({ ...at, h: 0.006 + 0.016 * R(), k: Math.floor(R() * 6), lean: (R() - 0.5) * 0.8 });
  }
  const trees: FloorThings["trees"] = [];
  for (let i = 0; trees.length < 80 && i < 600; i++) {
    const Z = 0.9 + Math.pow(R(), 1.4) * 9;
    const X = (u0 + R() * (u1 - u0)) * Z;
    const d = nearStream(X, Z);
    if (d < 0.08 || SPIRE_PLACES.some((s) => Math.hypot(X - s.X, Z - s.Z) < 0.45)) continue;
    if (d > 0.9 && R() < 0.6) continue;
    trees.push({ X, Z, h: 0.025 + 0.06 * R(), r: 0.012 + 0.02 * R(), k: Math.floor(R() * 3), lean: (R() - 0.5) * 0.4 });
  }
  const spots = Array.from({ length: 700 }, () => ({ ...pick(0.9), k: Math.floor(R() * 4) }));
  return { patches, boulders, cracks, tufts, trees, spots };
}

const BARREN_PATCH: C3[] = [
  [92, 40, 26],
  [40, 28, 28],
  [120, 74, 46],
  [70, 62, 60],
  [110, 46, 30],
];
const LUSH_PATCH: C3[] = [
  [60, 168, 96],
  [22, 128, 116],
  [14, 70, 52],
  [140, 200, 96],
  [96, 84, 190],
];
const TUFT: C3[] = [
  [40, 150, 90],
  [24, 130, 120],
  [90, 190, 100],
  [16, 90, 66],
  [150, 214, 120],
  [60, 200, 170],
];
const SPOT: C3[] = [
  [120, 255, 230],
  [190, 140, 255],
  [210, 255, 120],
  [255, 170, 230],
];

function paintFloor(g: CanvasRenderingContext2D, lw: number, lh: number, R: number, u0: number, things: FloorThings, lush: boolean): void {
  const at = (X: number, Z: number): [number, number] => [(X / Z - u0) * R, (HC / Z) * R];
  // The ground: hazy far away, deeper near.
  const grd = g.createLinearGradient(0, 0, 0, lh);
  if (lush) {
    grd.addColorStop(0, css([150, 196, 196]));
    grd.addColorStop(0.03, css([84, 156, 132]));
    grd.addColorStop(0.15, css([36, 126, 88]));
    grd.addColorStop(0.45, css([22, 98, 70]));
    grd.addColorStop(1, css([12, 66, 48]));
  } else {
    grd.addColorStop(0, css([142, 100, 72]));
    grd.addColorStop(0.03, css([112, 66, 46]));
    grd.addColorStop(0.15, css([88, 44, 30]));
    grd.addColorStop(0.45, css([58, 32, 26]));
    grd.addColorStop(1, css([34, 22, 20]));
  }
  g.fillStyle = grd;
  g.fillRect(0, 0, lw, lh);
  for (const p of things.patches) {
    const [x, y] = at(p.X, p.Z);
    const rx = (p.r / p.Z) * R;
    blot(g, x, y, rx, Math.max(0.02, HC / p.Z), lush ? LUSH_PATCH[p.k]! : BARREN_PATCH[p.k]!, lush && p.k === 4 ? 0.22 : 0.42);
  }
  // The canyon beds: dry and cracked, or green banks round the water.
  const paths = streamPaths();
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const p of paths) {
    const passes: [number, C3, number][] = lush
      ? [
          [2.6, [70, 176, 96], 0.12],
          [1.6, [52, 160, 100], 0.22],
          [1.12, [12, 56, 42], 0.8],
        ]
      : [
          [1.7, [128, 84, 58], 0.28],
          [1.12, [40, 22, 18], 0.85],
          [0.5, [16, 10, 10], 0.8],
        ];
    for (const [k, c, a] of passes) {
      for (let j = 1; j < p.x.length; j++) {
        const Z = (p.z[j]! + p.z[j - 1]!) / 2;
        if (Z < 0.25) continue;
        const wd = lerp(p.def.w0, p.def.w1, p.s[j]! / p.length) * k;
        const [x0, y0] = at(p.x[j - 1]!, p.z[j - 1]!);
        const [x1, y1] = at(p.x[j]!, p.z[j]!);
        g.strokeStyle = css(c, a);
        g.lineWidth = Math.max(0.6, (wd / Z) * R * Math.max(0.35, Math.abs(p.nx[j]!)) + (wd * HC * Math.abs(p.nz[j]!) * R) / (Z * Z));
        g.beginPath();
        g.moveTo(x0, y0);
        g.lineTo(x1, y1);
        g.stroke();
      }
    }
  }
  for (const pd of POOL_DEFS) {
    const [x, y] = at(pd.X, pd.Z);
    const rx = (pd.r / pd.Z) * R;
    blot(g, x, y, rx * (lush ? 1.7 : 1.3), HC / pd.Z, lush ? [40, 140, 90] : [30, 18, 18], lush ? 0.55 : 0.85);
  }
  if (!lush) {
    // Cracks, a few glowing like vents.
    for (const c of things.cracks) {
      const Z = c.pts[0]![1];
      g.strokeStyle = c.glow ? "rgb(255 110 50 / 0.55)" : "rgb(10 6 8 / 0.7)";
      g.lineWidth = Math.max(0.5, (0.006 / Z) * R);
      g.beginPath();
      for (const [i, q] of c.pts.entries()) {
        const [x, y] = at(q[0], q[1]);
        if (i) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
      if (c.glow) {
        const [x, y] = at(c.pts[2]![0], c.pts[2]![1]);
        blot(g, x, y, (0.05 / Z) * R, 0.4, [255, 90, 40], 0.25);
      }
    }
  }
  // Boulders, mossy on top when living.
  for (const b of things.boulders) {
    const [x, y] = at(b.X, b.Z);
    const s = (b.s / b.Z) * R;
    if (s < 0.8) continue;
    g.fillStyle = lush ? css([18, 40, 34]) : css([24, 16, 16]);
    g.beginPath();
    for (const [i, q] of b.pts.entries()) {
      if (i) g.lineTo(x + q[0] * s, y + q[1] * s);
      else g.moveTo(x + q[0] * s, y + q[1] * s);
    }
    g.closePath();
    g.fill();
    g.fillStyle = lush ? css([86, 176, 104], 0.8) : css([120, 74, 50], 0.55);
    g.beginPath();
    g.ellipse(x + s * 0.12, y - s * 0.32, s * 0.5, s * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    // Its shadow on the ground.
    g.fillStyle = "rgb(0 0 0 / 0.3)";
    g.beginPath();
    g.ellipse(x - s * 0.35, y + s * 0.45, s * 0.9, s * 0.18, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (lush) {
    // Tufts of growth: three blades each, grouped by colour into one path.
    for (let k = 0; k < TUFT.length; k++) {
      g.strokeStyle = css(TUFT[k]!, 0.85);
      for (const thick of [0, 1]) {
        g.lineWidth = thick ? 1.6 * (R / 900) : 0.9 * (R / 900);
        g.beginPath();
        for (const t of things.tufts) {
          if (t.k !== k) continue;
          const hpx = (t.h / t.Z) * R;
          if ((hpx > 7) !== !!thick || hpx < 0.8) continue;
          const [x, y] = at(t.X, t.Z);
          for (let b = -1; b <= 1; b++) {
            g.moveTo(x + b * hpx * 0.12, y);
            g.quadraticCurveTo(x + (t.lean + b * 0.3) * hpx * 0.3, y - hpx * 0.6, x + (t.lean + b * 0.45) * hpx * 0.55, y - hpx * (1 - Math.abs(b) * 0.2));
          }
        }
        g.stroke();
      }
    }
    // Alien trees: a curved stalk, round canopies, glowing seed pods.
    for (const tr of things.trees) {
      const [x, y] = at(tr.X, tr.Z);
      const hpx = (tr.h / tr.Z) * R;
      const r = (tr.r / tr.Z) * R;
      if (hpx < 2) continue;
      const tx = x + tr.lean * hpx;
      const ty = y - hpx;
      g.strokeStyle = css([20, 44, 36]);
      g.lineWidth = Math.max(0.8, r * 0.22);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x - tr.lean * hpx * 0.4, y - hpx * 0.5, tx, ty);
      g.stroke();
      const cols: C3[][] = [
        [
          [16, 110, 96],
          [60, 190, 160],
        ],
        [
          [24, 120, 66],
          [120, 210, 110],
        ],
        [
          [60, 50, 140],
          [150, 120, 240],
        ],
      ];
      const [dark, light] = cols[tr.k]!;
      g.fillStyle = css(dark!);
      g.beginPath();
      g.ellipse(tx, ty, r * 1.2, r * 0.8, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = css(light!, 0.85);
      g.beginPath();
      g.ellipse(tx + r * 0.2, ty - r * 0.25, r * 0.7, r * 0.42, 0, 0, Math.PI * 2);
      g.fill();
      blot(g, x, y + r * 0.2, r * 1.6, 0.25, [0, 0, 0], 0.35);
    }
    // Flowers and moss lights, small and many.
    for (const s of things.spots) {
      const [x, y] = at(s.X, s.Z);
      const r = Math.max(0.5, (0.003 / s.Z) * R);
      g.fillStyle = css(SPOT[s.k]!, 0.7);
      g.fillRect(x - r / 2, y - r / 2, r, r);
    }
  }
  // Haze over the far plain.
  const hz = g.createLinearGradient(0, 0, 0, R * 0.05);
  hz.addColorStop(0, css(lush ? [196, 226, 238] : [150, 104, 70], 0.85));
  hz.addColorStop(1, css(lush ? [196, 226, 238] : [150, 104, 70], 0));
  g.fillStyle = hz;
  g.fillRect(0, 0, lw, R * 0.05);
  grain(g, lw, lh, lush ? 0.2 : 0.28);
}

// ---------------------------------------------------------------- the near rocks

function paintNear(g: CanvasRenderingContext2D, b: BoardSpec, pts: [number, number][], lw: number, lh: number, R: number, lush: boolean): void {
  paintRock(g, b, pts, lw, lh, R, lush ? { ...LUSH_ROCK, top: [20, 40, 34], base: [16, 52, 38] } : { ...BARREN_ROCK, top: [22, 16, 16], base: [30, 18, 16] }, lush);
  if (lush) {
    // Moss along the tops and glowing caps and flowers on it.
    const R1 = rng(b.seed + 77);
    g.save();
    silhouette(g, pts, lh);
    g.clip();
    g.lineCap = "round";
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const p = pts[i]!;
      if (p[1] > lh - 4) continue;
      g.strokeStyle = css(R1() < 0.5 ? [70, 170, 90] : [110, 200, 110], 0.8);
      g.lineWidth = (2.5 + 5 * nf(i * 0.4, 9)) * (R / 900);
      g.beginPath();
      g.moveTo(a[0], a[1] + 1);
      g.lineTo(p[0], p[1] + 1);
      g.stroke();
    }
    g.restore();
    for (let i = 0; i < pts.length; i += 7) {
      const p = pts[i]!;
      if (p[1] > lh - 4 || R1() < 0.4) continue;
      const r = (2 + R1() * 4) * (R / 900);
      const c = SPOT[Math.floor(R1() * SPOT.length)]!;
      g.strokeStyle = css([30, 80, 60]);
      g.lineWidth = Math.max(0.6, r * 0.25);
      g.beginPath();
      g.moveTo(p[0], p[1] + 2);
      g.lineTo(p[0] + (R1() - 0.5) * r, p[1] - r * 1.6);
      g.stroke();
      blot(g, p[0], p[1] - r * 1.7, r * 1.4, 1, c, 0.9);
    }
  } else {
    // Embers in the cracks.
    const R1 = rng(b.seed + 13);
    for (let i = 0; i < pts.length; i += 9) {
      if (R1() < 0.7) continue;
      const p = pts[i]!;
      const y = p[1] + (lh - p[1]) * (0.3 + 0.6 * R1());
      blot(g, p[0], y, (3 + R1() * 6) * (R / 900), 0.4, [255, 96, 40], 0.4);
    }
  }
}

// ---------------------------------------------------------------- the masks

/** Tile size, layer px (a multiple of MASK). */
const TILE = 128;
const TM = TILE / MASK;

function newMask(lw: number, lh: number): Mask {
  const mw = Math.max(2, Math.ceil(lw / MASK));
  const mh = Math.max(2, Math.ceil(lh / MASK));
  const cv = canvas(mw, mh);
  const glow = canvas(mw, mh);
  const tx = Math.ceil(lw / TILE);
  const ty = Math.ceil(lh / TILE);
  return {
    mw,
    mh,
    arrive: new Float32Array(mw * mh).fill(Infinity),
    rows: 0,
    lo: Infinity,
    hi: -Infinity,
    cv,
    img: cv.getContext("2d")!.createImageData(mw, mh),
    glow,
    glowImg: glow.getContext("2d")!.createImageData(mw, mh),
    tx,
    ty,
    tlo: new Float32Array(tx * ty).fill(Infinity),
    thi: new Float32Array(tx * ty).fill(-Infinity),
  };
}

/** Work out `rows` more rows of a layer's arrival picture. Returns true when it is complete. */
function maskRows(l: Layer, rows: number): boolean {
  const m = l.mask!;
  const end = Math.min(m.mh, m.rows + rows);
  for (let y = m.rows; y < end; y++) {
    const v = l.v0 + ((y + 0.5) * MASK) / l.R;
    for (let x = 0; x < m.mw; x++) {
      const u = l.u0 + ((x + 0.5) * MASK) / l.R;
      let a: number;
      if (l.kind === "floor") {
        const Z = HC / Math.max(v, 0.006);
        a = bloomAt(u * Z, Z);
      } else {
        const Y = Math.max(0, HC - v * l.Z);
        const climb = l.id === "near" ? 3.2 : 1.7;
        a = Math.min(BLOOM_FULL - 0.1, bloomAt(u * l.Z, l.Z) + Y * climb + (nf(x * 0.7 + 5, y * 0.7 + 61) - 0.5) * 0.5);
      }
      m.arrive[y * m.mw + x] = a;
      if (a < m.lo) m.lo = a;
      if (a > m.hi) m.hi = a;
      const ti = Math.floor(y / TM) * m.tx + Math.floor(x / TM);
      if (a < m.tlo[ti]!) m.tlo[ti] = a;
      if (a > m.thi[ti]!) m.thi[ti] = a;
    }
  }
  m.rows = end;
  return end >= m.mh;
}

/** How a layer looks at time t: all barren, all living, or the tide passing over it. */
export function layerState(l: Layer, t: number): "barren" | "lush" | "mix" {
  const m = l.mask;
  if (!l.lush) return "barren";
  if (!m) return t >= BLOOM_FULL + BLOOM_FADE ? "lush" : t < 7.6 ? "barren" : "mix";
  if (m.rows < m.mh || t <= m.lo) return "barren";
  if (t >= m.hi + GLOW) return "lush";
  return "mix";
}

/**
 * Draw a layer with the tide passing over it, into g already set to the layer's own px: the barren
 * picture, the tiles the tide has passed whole from the living one, and over the tiles it is
 * passing now (one box round them all) the living picture through the arrival picture, with its
 * glowing front. `tmp`: a canvas as big as the layer.
 */
export function drawMix(g: CanvasRenderingContext2D, l: Layer, t: number, tmp: HTMLCanvasElement): void {
  const m = l.mask!;
  const lush = l.lush!;
  g.drawImage(l.barren, 0, 0);
  // The box of tiles the tide is passing.
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -1;
  let by1 = -1;
  for (let ty = 0; ty < m.ty; ty++) {
    // Runs of tiles it has passed, drawn whole.
    let run = -1;
    for (let tx = 0; tx <= m.tx; tx++) {
      const ti = ty * m.tx + tx;
      const done = tx < m.tx && t >= m.thi[ti]! + GLOW;
      if (done && run < 0) run = tx;
      if (!done && run >= 0) {
        const sx = run * TILE;
        const sy = ty * TILE;
        const sw = Math.min(l.lw, tx * TILE + 1) - sx;
        const sh = Math.min(l.lh, sy + TILE + 1) - sy;
        if (sw > 0 && sh > 0) g.drawImage(lush, sx, sy, sw, sh, sx, sy, sw, sh);
        run = -1;
      }
      if (tx < m.tx && !done && t > m.tlo[ti]!) {
        bx0 = Math.min(bx0, tx);
        by0 = Math.min(by0, ty);
        bx1 = Math.max(bx1, tx + 1);
        by1 = Math.max(by1, ty + 1);
      }
    }
  }
  if (bx1 < 0) return;
  // The arrival picture brought up to t inside the box.
  const mx0 = bx0 * TM;
  const my0 = by0 * TM;
  const mx1 = Math.min(m.mw, bx1 * TM);
  const my1 = Math.min(m.mh, by1 * TM);
  const d = m.img.data;
  const gd = m.glowImg.data;
  for (let y = my0; y < my1; y++) {
    for (let x = mx0; x < mx1; x++) {
      const i = y * m.mw + x;
      const a = m.arrive[i]!;
      const k = (t - a) / BLOOM_FADE;
      const o = i * 4;
      d[o] = d[o + 1] = d[o + 2] = 255;
      d[o + 3] = k <= 0 ? 0 : k >= 1 ? 255 : (k * k * (3 - 2 * k) * 255) | 0;
      const q = (t - a) / GLOW;
      const fr = q <= 0 || q >= 1 ? 0 : 4 * q * (1 - q);
      gd[o] = GLOW_RGB[0];
      gd[o + 1] = GLOW_RGB[1];
      gd[o + 2] = GLOW_RGB[2];
      gd[o + 3] = (fr * fr * 150) | 0;
    }
  }
  m.cv.getContext("2d")!.putImageData(m.img, 0, 0, mx0, my0, mx1 - mx0, my1 - my0);
  m.glow.getContext("2d")!.putImageData(m.glowImg, 0, 0, mx0, my0, mx1 - mx0, my1 - my0);
  const sx = mx0 * MASK;
  const sy = my0 * MASK;
  const sw = Math.min(l.lw, mx1 * MASK) - sx;
  const sh = Math.min(l.lh, my1 * MASK) - sy;
  const tg = tmp.getContext("2d")!;
  tg.globalCompositeOperation = "copy";
  tg.drawImage(lush, sx, sy, sw, sh, 0, 0, sw, sh);
  tg.globalCompositeOperation = "destination-in";
  tg.drawImage(m.cv, mx0, my0, mx1 - mx0, my1 - my0, 0, 0, sw, sh);
  // The glowing front, only on what is there (a board of rock has empty sky round it).
  tg.globalCompositeOperation = "source-atop";
  tg.drawImage(m.glow, mx0, my0, mx1 - mx0, my1 - my0, 0, 0, sw, sh);
  tg.globalCompositeOperation = "source-over";
  g.drawImage(tmp, 0, 0, sw, sh, sx, sy, sw, sh);
}

// ---------------------------------------------------------------- building it all

export interface Valley {
  layers: Layer[];
  /** Make the living pictures a little at a time: returns true when all are made. */
  prepare(budget: number): boolean;
  /** For the glowing flowers on the rock: v of the top of a board at u. */
  R: number;
  U: number;
  vmax: number;
}

/**
 * The layers for a picture whose half-width is U angular units (pan and drift included) and whose
 * floor reaches down to vmax; R layer px per angular unit.
 */
export function createValley(U: number, vmax: number, R0: number): Valley {
  const layers: Layer[] = [];
  const jobs: (() => boolean)[] = [];
  const R = Math.round(clamp(R0, 260, 1000));

  // The distant mountains.
  {
    const Z = 20;
    const u0 = -U - 0.05;
    const u1 = U + 0.05;
    const v0 = -0.2;
    const v1 = 0.02;
    const Rf = Math.min(R, 900);
    const lw = (u1 - u0) * Rf;
    const lh = (v1 - v0) * Rf;
    const barren = canvas(lw, lh);
    paintFar(barren.getContext("2d")!, barren.width, barren.height, Rf, u0, v0, false);
    const l: Layer = { id: "far", kind: "board", Z, u0, u1, v0, v1, R: Rf, lw: barren.width, lh: barren.height, barren, lush: undefined, crest: undefined, mask: undefined };
    layers.push(l);
    jobs.push(() => {
      const c = canvas(lw, lh);
      paintFar(c.getContext("2d")!, c.width, c.height, Rf, u0, v0, true);
      l.lush = c;
      return true;
    });
  }

  // The valley floor: kept under about 1.6 million points.
  {
    const u0 = -U - (0.16 * vmax) / HC;
    const u1 = U + (0.16 * vmax) / HC;
    const Rf = Math.round(Math.min(R, Math.sqrt(1.6e6 / ((u1 - u0) * vmax))));
    const lw = Math.ceil((u1 - u0) * Rf);
    const lh = Math.ceil(vmax * Rf);
    const things = floorThings(u0, u1, vmax);
    const barren = canvas(lw, lh);
    paintFloor(barren.getContext("2d")!, lw, lh, Rf, u0, things, false);
    const l: Layer = { id: "floor", kind: "floor", Z: 0, u0, u1, v0: 0, v1: vmax, R: Rf, lw, lh, barren, lush: undefined, crest: undefined, mask: newMask(lw, lh) };
    layers.push(l);
    jobs.push(() => {
      const c = canvas(lw, lh);
      paintFloor(c.getContext("2d")!, lw, lh, Rf, u0, things, true);
      l.lush = c;
      return true;
    });
    jobs.push(() => maskRows(l, 10));
  }

  // The ridges at the valley's sides, and the rocks just in front of the camera.
  const boards: BoardSpec[] = [
    {
      id: "ridgeR",
      Z: 5.6,
      u0: 0.34,
      u1: U + 0.06,
      seed: 21,
      sunSide: -1,
      height: (u) => {
        const e = smooth(0.34, 0.6, u) * (0.55 + 0.5 * smooth(0.6, 1.3, u));
        return e * (0.32 + 0.6 * jag(u, 21, 45) + 0.3 * jag(u, 22, 150) + needles(u, 21, 0.09, 0.22));
      },
    },
    {
      id: "ridgeL",
      Z: 3.6,
      u0: -U - 0.06,
      u1: -0.25,
      seed: 7,
      sunSide: 1,
      height: (u) => {
        const e = smooth(-0.25, -0.55, u) * (0.6 + 0.45 * smooth(-0.6, -1.3, u));
        return e * (0.3 + 0.6 * jag(u, 7, 50) + 0.28 * jag(u, 8, 170) + needles(u, 7, 0.08, 0.24));
      },
    },
    {
      id: "near",
      Z: 0.9,
      u0: -U - 0.2,
      u1: U + 0.2,
      seed: 55,
      sunSide: 1,
      height: (u) => {
        const a = Math.abs(u);
        const e = smooth(0.4, 0.78, a) * (0.7 + 0.5 * smooth(0.8, 1.3, a));
        return e * (0.12 + 0.16 * jag(u, 55, 30) + 0.08 * jag(u, 56, 110) + needles(u, 55, 0.12, 0.05)) - 0.02;
      },
    },
  ];
  for (const b of boards) {
    if (b.u1 <= b.u0 + 0.02) continue;
    let minV = Infinity;
    for (let u = b.u0; u <= b.u1; u += 0.002) minV = Math.min(minV, (HC - b.height(u)) / b.Z);
    const v0 = minV - 0.012;
    // A board ends a little under its foot; nearer ground shows below it.
    const v1 = HC / b.Z + (b.id === "near" ? 0.02 : 0.004);
    if (v0 >= vmax) continue;
    const Rb = Math.round(Math.min(R, Math.sqrt(1.2e6 / ((b.u1 - b.u0) * (v1 - v0)))));
    const lw = Math.ceil((b.u1 - b.u0) * Rb);
    const lh = Math.ceil((v1 - v0) * Rb);
    const { pts, top } = profile(b, Rb, v0);
    const barren = canvas(lw, lh);
    if (b.id === "near") paintNear(barren.getContext("2d")!, b, pts, lw, lh, Rb, false);
    else paintRock(barren.getContext("2d")!, b, pts, lw, lh, Rb, BARREN_ROCK, false);
    const crest = canvas(lw, lh);
    paintCrest(crest.getContext("2d")!, b, pts, Rb);
    const l: Layer = { id: b.id, kind: "board", Z: b.Z, u0: b.u0, u1: b.u1, v0, v1, R: Rb, lw, lh, barren, lush: undefined, crest, mask: newMask(lw, lh), top };
    layers.push(l);
    jobs.push(() => {
      const c = canvas(lw, lh);
      if (b.id === "near") paintNear(c.getContext("2d")!, b, pts, lw, lh, Rb, true);
      else paintRock(c.getContext("2d")!, b, pts, lw, lh, Rb, LUSH_ROCK, true);
      l.lush = c;
      return true;
    });
    jobs.push(() => maskRows(l, 14));
  }
  // Far to near, as they are drawn.
  const order: Layer["id"][] = ["far", "floor", "ridgeR", "ridgeL", "near"];
  layers.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  let next = 0;
  return {
    layers,
    R,
    U,
    vmax,
    prepare(budget) {
      const t0 = performance.now();
      while (next < jobs.length) {
        if (jobs[next]!()) next++;
        if (performance.now() - t0 > budget) break;
      }
      return next >= jobs.length;
    },
  };
}
