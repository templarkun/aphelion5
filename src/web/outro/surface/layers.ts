/**
 * Surface Terraform: the painted layers of the valley (designer 2026-11-19; new look 2026-11-21:
 * hard, gritty science fiction, geological, not botanical). Far to near: the distant ranges, the
 * valley floor, the jagged basalt ridges at its sides, the rocks right in front of the camera.
 * Each is painted twice: barren (dark volcanic basalt under a coat of ochre dust, fractured strata,
 * columnar joints, dry canyon beds) and wet (the same rock after the water has come: darker, slate
 * and olive, wet obsidian, mineral stains, puddles that hold the sky). Painted in the angular units
 * of world.ts, so it lines up with what is drawn over it each frame. No plants are ever drawn.
 *
 * The rock's grain comes from two textures baked once from seeded noise (fBm): a lit relief and a
 * set of warped strata, laid over each silhouette. The ridgelines are multi-octave ridged noise.
 *
 * Every point of a layer knows the moment the wet front reaches it (world.ts `bloomAt`, worked out
 * once into a small `arrive` picture); each frame the wet version is shown where the front has
 * passed, with a faint cold sheen where it is passing now. So any moment can be drawn by itself.
 * The distant ranges only fade from one to the other. The barren pictures are made at once; the
 * wet ones a little at a time during the first acts (`jobs`). Looks only.
 */

import { clamp, lerp, rng, smooth } from "../../briefing/styles/intro2/math3.js";
import { BLOOM_FULL } from "./timeline.js";
import { bloomAt, HC, nf, POOL_DEFS, SPIRE_PLACES, streamPaths } from "./world.js";

type C3 = readonly [number, number, number];
const css = (c: C3, a = 1) => `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0} / ${a.toFixed(3)})`;
const mixC = (a: C3, b: C3, k: number): C3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

/** How long a point of ground takes to turn wet, s; its front shows a cold sheen for the first GLOW s. */
export const BLOOM_FADE = 0.5;
const GLOW = 0.5;
const GLOW_RGB: C3 = [150, 172, 184];
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
  wet: HTMLCanvasElement | undefined;
  /** Cold light along the crests, shown when the sun breaks through (boards of rock). */
  crest: HTMLCanvasElement | undefined;
  mask: Mask | undefined;
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
  /** Tiles of TILE layer px: the earliest and latest arrival in each (so most of a layer is drawn whole, barren or wet). */
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

// ---------------------------------------------------------------- baked textures (seeded, made once)

/** Fine speckle, laid over a picture so the rock has a grain. */
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

/** Multi-octave noise (fBm) on the repeating field of world.ts, about 0..1; `ridged` folds each octave into sharp crests. */
export function fbm(x: number, y: number, octaves: number, ridged = false): number {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    let n = nf(x * f + o * 31.7, y * f + o * 17.3);
    if (ridged) {
      n = 1 - Math.abs(n * 2 - 1);
      n *= n;
    }
    s += n * a;
    norm += a;
    a *= 0.5;
    f *= 2;
  }
  return s / norm;
}

const TEX = 512;
/**
 * The lit relief of rough rock: an fBm height field lit from the upper left, grey about 128 (for an
 * overlay). It repeats every TEX px (the noise field repeats every 256 texels; every octave here
 * is a multiple of that).
 */
let reliefTex: HTMLCanvasElement | undefined;
function relief(): HTMLCanvasElement {
  if (reliefTex) return reliefTex;
  const hgt = new Float32Array(TEX * TEX);
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      // Base octave: 0.5 texel per px (period 512); ridged crests over it.
      const a = fbm(x * 0.5, y * 0.5, 4);
      const b = fbm(x * 0.5 + 101, y * 0.5 + 57, 3, true);
      hgt[y * TEX + x] = a * 0.6 + b * 0.55;
    }
  }
  const c = canvas(TEX, TEX);
  const g = c.getContext("2d")!;
  const im = g.createImageData(TEX, TEX);
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const h0 = hgt[y * TEX + x]!;
      const hx = hgt[y * TEX + ((x + 1) & (TEX - 1))]! - hgt[y * TEX + ((x - 1) & (TEX - 1))]!;
      const hy = hgt[((y + 1) & (TEX - 1)) * TEX + x]! - hgt[((y - 1) & (TEX - 1)) * TEX + x]!;
      // Light from the upper left: faces rising to the right and down are dark.
      const lit = -(hx * 0.62 + hy * 0.78) * 900;
      const v = clamp(128 + lit + (h0 - 0.55) * 60, 18, 240);
      const o = (y * TEX + x) * 4;
      im.data[o] = im.data[o + 1] = im.data[o + 2] = v;
      im.data[o + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return (reliefTex = c);
}

/** Layered strata: warped bands of rock, each a little lighter or darker, with dark bedding lines; repeats every TEX px across and 256 down. */
let strataTex: HTMLCanvasElement | undefined;
function strata(): HTMLCanvasElement {
  if (strataTex) return strataTex;
  const H = 256;
  const c = canvas(TEX, H);
  const g = c.getContext("2d")!;
  const im = g.createImageData(TEX, H);
  const band = Array.from({ length: 32 }, (_, i) => {
    const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453;
    return x - Math.floor(x);
  });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < TEX; x++) {
      // The warp repeats: 0.5 texel per px across (period 512), 1 per px down (period 256).
      const s = y + (nf(x * 0.5, y + 90) - 0.5) * 22 + (nf(x * 2, y * 4 + 7) - 0.5) * 3;
      const q = ((s / 8) % 32 + 32) % 32;
      const k = Math.floor(q);
      const f = q - k;
      // A dark bedding line at the foot of each band, a light lip just above it.
      const line = Math.exp(-(((1 - f) * 8) ** 2)) * 0.9 - Math.exp(-(((0.86 - f) * 10) ** 2)) * 0.35;
      const v = clamp(128 + (band[k]! - 0.5) * 70 - line * 80 + (nf(x * 4 + 33, y * 4) - 0.5) * 22, 10, 245);
      const o = (y * TEX + x) * 4;
      im.data[o] = im.data[o + 1] = im.data[o + 2] = v;
      im.data[o + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return (strataTex = c);
}

/** Lay a baked texture over what is drawn (already clipped), `k` px per texel, with a blend. */
function texture(g: CanvasRenderingContext2D, tex: HTMLCanvasElement, w: number, h: number, k: number, ky: number, op: GlobalCompositeOperation, alpha: number, ox = 0, oy = 0, tilt = 0): void {
  g.save();
  g.globalCompositeOperation = op;
  g.globalAlpha = alpha;
  g.fillStyle = g.createPattern(tex, "repeat")!;
  g.translate(ox, oy);
  if (tilt) g.rotate(tilt);
  g.scale(k, ky);
  const pad = Math.hypot(w, h);
  g.fillRect((-pad - ox) / k, (-pad - oy) / ky, (w + pad * 2) / k, (h + pad * 2) / ky);
  g.restore();
}

/** A soft round blot (a patch of dust, a stain, a puddle), flattened by `flat`. */
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

/** Jagged rock: ridged multi-octave noise, 0..1 or a little over. */
function jag(u: number, seed: number, freq: number): number {
  let y = 0;
  let amp = 0.6;
  let f = freq;
  for (let o = 0; o < 7; o++) {
    const n = clamp((nf(u * f + seed * 37 + o * 53, seed * 11 + o * 29) - 0.5) * 3.2, -1, 1);
    const r = 1 - Math.abs(n);
    y += r * r * r * amp;
    amp *= 0.5;
    f *= 2.13;
  }
  return y;
}
/** Ledges: the height pulled a little towards steps, so the crests read as fractured strata. */
function ledges(h: number, step: number): number {
  const q = h / step;
  const k = Math.floor(q);
  const f = q - k;
  return (k + f * f * f * (f * (f * 6 - 15) + 10) * 0.6 + f * 0.4) * step;
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

/** Points of a board's top line in layer px. */
function profile(b: BoardSpec, R: number, v0: number): [number, number][] {
  const pts: [number, number][] = [];
  const step = 1.5 / R;
  for (let u = b.u0; u <= b.u1 + step; u += step) {
    const v = (HC - b.height(u)) / b.Z;
    pts.push([(u - b.u0) * R, (v - v0) * R]);
  }
  return pts;
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
  /** How strongly the relief and the strata show. */
  relief: number;
  strata: number;
}
/** Dark basalt under a coat of ochre dust (#2d2926, #1a1817, lit faces #4a423b, dust #8c583a). */
const BARREN_ROCK: RockLook = { top: [52, 44, 38], base: [26, 24, 23], face: [96, 78, 62], shade: [10, 9, 9], scree: [74, 54, 40], relief: 0.62, strata: 0.5 };
/** Wet basalt: slate-olive (#1f2e2b), wet obsidian (#12171a), moss-slate light (#263834). */
const WET_ROCK: RockLook = { top: [34, 44, 44], base: [18, 23, 26], face: [62, 78, 76], shade: [6, 8, 9], scree: [31, 46, 43], relief: 0.58, strata: 0.42 };
const DUST: C3 = [140, 98, 66];
const SHEEN: C3 = [196, 212, 220];

/**
 * Paint a board of rock: the silhouette, the lit relief and strata laid over it, faces lit along
 * one side, columnar joints and gullies, fractures, scree at the foot; barren: ochre dust settled
 * on the ledges; wet: darker, with cold wet sheen on the ledges and mineral stains running down.
 */
function paintRock(g: CanvasRenderingContext2D, b: BoardSpec, pts: [number, number][], lw: number, lh: number, R: number, look: RockLook, wet: boolean): void {
  const R0 = rng(b.seed);
  const baseY = lh;
  let minY = Infinity;
  for (const p of pts) minY = Math.min(minY, p[1]);
  const k = R / 900;
  silhouette(g, pts, baseY);
  const grd = g.createLinearGradient(0, minY, 0, baseY);
  grd.addColorStop(0, css(look.top));
  grd.addColorStop(0.55, css(mixC(look.top, look.base, 0.6)));
  grd.addColorStop(1, css(look.base));
  g.fillStyle = grd;
  g.fill();
  g.save();
  silhouette(g, pts, baseY);
  g.clip();
  // The rock's own grain: relief at a size that goes with its distance, strata dipping a little.
  const px = clamp((R / b.Z) * 0.0032, 0.45, 2.6);
  texture(g, relief(), lw, lh, px, px, "overlay", look.relief, b.seed * 13, b.seed * 7);
  texture(g, strata(), lw, lh, px * 1.4, px * 0.9, "soft-light", look.strata, b.seed * 29, minY, (b.sunSide * -0.06));
  // Faces: from the top line, broad wedges down the slope, lit on the sun's side.
  const n = pts.length;
  for (let i = 3; i < n - 3; i += 3) {
    const [x, y] = pts[i]!;
    const slope = pts[i + 3]![1] - pts[i - 3]![1];
    const lit = clamp((slope * b.sunSide) / 7);
    const dark = clamp((-slope * b.sunSide) / 7);
    const len = (baseY - y) * (0.3 + 0.6 * R0());
    if (lit > 0.05) {
      g.fillStyle = css(look.face, 0.08 + 0.26 * lit);
      g.beginPath();
      g.moveTo(x - 2.5, y + 0.5);
      g.lineTo(x + 3.5, y + 0.5);
      g.lineTo(x + 3.5 + b.sunSide * len * 0.2, y + len);
      g.lineTo(x - 2.5 + b.sunSide * len * 0.28, y + len * 0.85);
      g.fill();
    } else if (dark > 0.05) {
      g.fillStyle = css(look.shade, 0.18 + 0.34 * dark);
      g.fillRect(x - 2, y, 4.5, len * 0.95);
    }
  }
  // Columnar joints: the basalt cooled into tall columns; faint vertical lines, lit on one edge.
  g.lineCap = "butt";
  const every = Math.max(2.2, 5.5 * k * (4 / b.Z) ** 0.4);
  for (let x = R0() * every; x < lw; x += every * (0.7 + 0.6 * R0())) {
    const i = Math.min(n - 1, Math.max(0, Math.round((x / lw) * (n - 1))));
    const y = pts[i]![1];
    const len = (baseY - y) * (0.25 + 0.55 * R0());
    if (len < 3) continue;
    const y0 = y + (baseY - y) * 0.05 * R0();
    g.strokeStyle = css(look.shade, 0.16 + 0.18 * R0());
    g.lineWidth = Math.max(0.5, 0.8 * k);
    g.beginPath();
    g.moveTo(x, y0);
    g.lineTo(x + (R0() - 0.5) * 2, y0 + len);
    g.stroke();
    g.strokeStyle = css(look.face, 0.06 + 0.06 * R0());
    g.beginPath();
    g.moveTo(x + b.sunSide * 1.1, y0);
    g.lineTo(x + b.sunSide * 1.1 + (R0() - 0.5) * 2, y0 + len * 0.8);
    g.stroke();
  }
  // Gullies and fractures: thin dark jagged lines running down and across from the crest.
  g.lineCap = "round";
  g.lineJoin = "miter";
  for (let i = 0; i < n; i += 4) {
    if (R0() > 0.4) continue;
    const [x, y] = pts[i]!;
    const len = (baseY - y) * (0.2 + 0.7 * R0());
    g.strokeStyle = css(look.shade, 0.24 + 0.24 * R0());
    g.lineWidth = Math.max(0.6, R * 0.0016 * (0.5 + R0()));
    g.beginPath();
    g.moveTo(x, y + 1.5);
    let gx = x;
    for (let q = 1; q <= 6; q++) {
      gx += (R0() - 0.5) * 7 + b.sunSide * 1.2;
      g.lineTo(gx, y + (len * q) / 6);
    }
    g.stroke();
  }
  // Scree at the foot of the slope: dust and broken rock, or dark wet gravel.
  const foot = g.createLinearGradient(0, baseY - (baseY - minY) * 0.4, 0, baseY);
  foot.addColorStop(0, css(look.scree, 0));
  foot.addColorStop(1, css(look.scree, wet ? 0.7 : 0.6));
  g.fillStyle = foot;
  g.fillRect(0, minY, lw, baseY - minY);
  const R1 = rng(b.seed + 9);
  if (!wet) {
    // Ochre dust lying on the ledges and the tops, blown into streaks down the lee slopes.
    g.lineCap = "round";
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1]!;
      const p = pts[i]!;
      const flat = 1 - clamp(Math.abs(p[1] - a[1]) / 2.5);
      if (flat < 0.2) continue;
      g.strokeStyle = css(DUST, 0.22 * flat);
      g.lineWidth = (2 + 4 * nf(i * 0.3, b.seed)) * k;
      g.beginPath();
      g.moveTo(a[0], a[1] + 1.5 * k);
      g.lineTo(p[0], p[1] + 1.5 * k);
      g.stroke();
    }
    for (let i = 0; i < n * 0.25; i++) {
      const p = pts[Math.floor(R1() * n)]!;
      const y = p[1] + (baseY - p[1]) * (0.15 + 0.8 * R1());
      blot(g, p[0], y, (6 + R1() * 18) * k, 0.35, DUST, 0.12);
    }
  } else {
    // Mineral stains where the water ran down the faces: pale and dark streaks below the ledges.
    for (let i = 0; i < n * 0.22; i++) {
      const p = pts[Math.floor(R1() * n)]!;
      const y0 = p[1] + (baseY - p[1]) * R1() * 0.5;
      const len = (baseY - y0) * (0.2 + 0.5 * R1());
      const pale = R1() < 0.4;
      g.strokeStyle = css(pale ? [120, 138, 132] : [8, 11, 12], pale ? 0.07 : 0.2);
      g.lineWidth = (0.8 + R1() * 2.2) * k;
      g.beginPath();
      g.moveTo(p[0], y0);
      g.lineTo(p[0] + (R1() - 0.5) * 3, y0 + len);
      g.stroke();
    }
    // Cold wet sheen on the ledges and the tops, catching the clear sky.
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1]!;
      const p = pts[i]!;
      const facing = clamp(0.35 + ((p[1] - a[1]) * b.sunSide) / 3);
      const glint = Math.pow(nf(i * 0.9 + b.seed, 3), 3) * 2;
      g.strokeStyle = css(SHEEN, clamp(0.05 + 0.2 * facing * glint));
      g.lineWidth = Math.max(0.6, 0.9 * k);
      g.beginPath();
      g.moveTo(a[0], a[1] + 0.8);
      g.lineTo(p[0], p[1] + 0.8);
      g.stroke();
    }
    for (let i = 0; i < n * 0.35; i++) {
      const p = pts[Math.floor(R1() * n)]!;
      const y = p[1] + (baseY - p[1]) * Math.pow(R1(), 1.6) * 0.8;
      g.fillStyle = css(SHEEN, 0.06 + 0.1 * R1());
      g.fillRect(p[0] - 3 * k, y, (3 + R1() * 9) * k, Math.max(0.6, 0.7 * k));
    }
  }
  g.restore();
  grain(g, lw, lh, wet ? 0.22 : 0.3, () => silhouette(g, pts, baseY));
}

/** The cold light along a board's crest: strongest on the slopes that face the sun. */
function paintCrest(g: CanvasRenderingContext2D, b: BoardSpec, pts: [number, number][], R: number): void {
  g.save();
  g.globalCompositeOperation = "lighter";
  g.lineCap = "round";
  g.lineJoin = "round";
  const n = pts.length;
  for (const [wide, a] of [
    [4, 0.04],
    [1.5, 0.13],
    [0.7, 0.3],
  ] as const) {
    g.lineWidth = Math.max(0.6, wide * (R / 900));
    for (let i = 1; i < n - 1; i++) {
      const slope = (pts[i + 1]![1] - pts[i - 1]![1]) * b.sunSide;
      const k = clamp(0.2 + slope / 3);
      if (k < 0.05) continue;
      g.strokeStyle = `rgb(${(196 + 30 * k) | 0} ${(212 + 24 * k) | 0} ${(226 + 20 * k) | 0} / ${(a * k).toFixed(3)})`;
      g.beginPath();
      g.moveTo(pts[i - 1]![0], pts[i - 1]![1] + 0.5);
      g.lineTo(pts[i + 1]![0], pts[i + 1]![1] + 0.5);
      g.stroke();
    }
  }
  g.restore();
}

// ---------------------------------------------------------------- the distant ranges

/** The distant volcano (u), whose crater glows dully and smokes while the world is barren (the smoke is drawn by the scene). */
export const VOLCANO_U = 0.58;
const VOLCANO_Z = 32;
export const volcanoTop = (): number => (HC - farBackH(VOLCANO_U)) / VOLCANO_Z;
function farBackH(u: number): number {
  return 1.0 + 2.1 * ledges(jag(u, 3, 70), 0.18) + 2.6 * Math.exp(-(((u - VOLCANO_U) / 0.075) ** 2)) - 0.45 * Math.exp(-(((u - VOLCANO_U) / 0.012) ** 2));
}

/** The ranges, far to near: depth (km), height (km) at u, colour barren and wet, how much grain shows. */
const RANGES: { Z: number; H: (u: number) => number; barren: C3; wet: C3; grain: number }[] = [
  { Z: 70, H: (u) => 2.2 + 3.6 * jag(u, 41, 34) * (0.6 + 0.4 * Math.sin(u * 2.1 + 0.4)), barren: [104, 80, 62], wet: [70, 86, 100], grain: 0.1 },
  { Z: 46, H: (u) => 1.1 + 2.6 * ledges(jag(u, 17, 52), 0.2), barren: [82, 64, 52], wet: [48, 62, 74], grain: 0.16 },
  { Z: VOLCANO_Z, H: farBackH, barren: [64, 52, 44], wet: [36, 48, 58], grain: 0.22 },
  { Z: 20, H: (u) => 0.25 + 1.2 * ledges(jag(u, 8, 120), 0.14) * (0.55 + 0.45 * Math.sin(u * 3 + 1)), barren: [44, 38, 34], wet: [28, 38, 40], grain: 0.3 },
];
/** The haze the ranges dissolve into, barren (dust) and wet (cold steel blue). */
const FAR_HAZE: [C3, C3] = [
  [128, 96, 70],
  [92, 108, 120],
];

function paintFar(g: CanvasRenderingContext2D, lw: number, lh: number, R: number, u0: number, v0: number, wet: boolean): void {
  const horizon = (0 - v0) * R;
  const haze = FAR_HAZE[wet ? 1 : 0];
  const line = (H: (u: number) => number, Zr: number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let x = -2; x <= lw + 2; x += 1.5) {
      const u = u0 + x / R;
      pts.push([x, ((HC - H(u)) / Zr - v0) * R]);
    }
    return pts;
  };
  for (const [q, rg] of RANGES.entries()) {
    const pts = line(rg.H, rg.Z);
    let top = Infinity;
    for (const p of pts) top = Math.min(top, p[1]);
    const c = wet ? rg.wet : rg.barren;
    // Each range: darker at its crest, dissolving into the haze towards its foot.
    silhouette(g, pts, lh);
    const gr = g.createLinearGradient(0, top, 0, horizon);
    gr.addColorStop(0, css(c));
    gr.addColorStop(0.55, css(mixC(c, haze, 0.25)));
    gr.addColorStop(1, css(mixC(c, haze, 0.75)));
    g.fillStyle = gr;
    g.fill();
    g.save();
    silhouette(g, pts, lh);
    g.clip();
    const px = clamp((R / rg.Z) * 0.006, 0.3, 1.4);
    texture(g, relief(), lw, lh, px, px * 0.8, "overlay", rg.grain * 1.8, q * 97, q * 41);
    texture(g, strata(), lw, lh, px * 1.6, px * 0.7, "soft-light", rg.grain * 1.4, q * 53, top);
    // Lit and shaded flanks: short strokes down from the crest, by slope.
    g.lineCap = "round";
    const R1 = rng(31 + q * 7);
    for (let i = 2; i < pts.length - 2; i += 1 + Math.floor(R1() * 2)) {
      const [x, y] = pts[i]!;
      const slope = pts[i + 2]![1] - pts[i - 2]![1];
      const len = (horizon - y) * (0.15 + 0.55 * R1());
      if (len <= 1) continue;
      g.strokeStyle = slope < 0 ? css(mixC(c, [210, 220, 228], 0.35), 0.05 + 0.1 * clamp(-slope / 4)) : css([8, 9, 10], 0.05 + 0.12 * clamp(slope / 4));
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(x, y + 0.5);
      g.lineTo(x + (slope < 0 ? -1 : 1) * len * 0.16, y + len);
      g.stroke();
    }
    g.restore();
    if (!wet && rg.Z === VOLCANO_Z) {
      // The volcano's crater glows a dull ember red through the dust.
      g.save();
      silhouette(g, pts, lh);
      g.clip();
      blot(g, (VOLCANO_U - u0) * R, (volcanoTop() - v0) * R + 3, R * 0.014, 0.45, [190, 74, 36], 0.45);
      g.restore();
    }
    // Heavy haze where each range meets the one in front.
    const hz = g.createLinearGradient(0, top + (horizon - top) * 0.35, 0, horizon + 2);
    hz.addColorStop(0, css(haze, 0));
    hz.addColorStop(1, css(haze, 0.8 - q * 0.08));
    g.save();
    silhouette(g, pts, lh);
    g.clip();
    g.fillStyle = hz;
    g.fillRect(0, 0, lw, lh);
    g.restore();
  }
  grain(g, lw, lh, 0.12);
}

// ---------------------------------------------------------------- the valley floor

interface FloorThings {
  drifts: { X: number; Z: number; r: number }[];
  boulders: { X: number; Z: number; s: number; pts: [number, number][]; k: number }[];
  cracks: { pts: [number, number][]; vent: boolean }[];
  puddles: { X: number; Z: number; r: number; k: number }[];
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
  const drifts = Array.from({ length: 320 }, () => ({ ...pick(1), r: 0 })).map((p) => ({ ...p, r: p.Z * (0.03 + 0.1 * R()) }));
  const boulders = Array.from({ length: 220 }, () => {
    const at = pick(0.55);
    const m = 5 + Math.floor(R() * 3);
    const pts = Array.from({ length: m }, (_, i): [number, number] => {
      const a = (i / m) * Math.PI * 2 + (R() - 0.5) * 0.5;
      const r = 0.55 + R() * 0.55;
      return [Math.cos(a) * r, Math.sin(a) * r * 0.6 - (Math.sin(a) < 0 ? 0.3 : 0)];
    });
    return { ...at, s: 0.004 + 0.016 * R() * R() + 0.004 * R(), pts, k: R() };
  });
  const cracks = Array.from({ length: 150 }, (_, i) => {
    let { X, Z } = pick(0.6);
    const pts: [number, number][] = [[X, Z]];
    let a = R() * Math.PI * 2;
    for (let k = 0; k < 6; k++) {
      a += (R() < 0.5 ? -1 : 1) * (0.5 + R() * 0.6);
      // Plate edges: about the same size on the picture near and far.
      const l = (0.005 + R() * 0.012) * Z;
      X += Math.cos(a) * l;
      Z = Math.max(0.3, Z + Math.sin(a) * l);
      pts.push([X, Z]);
    }
    return { pts, vent: i % 25 === 0 };
  });
  const puddles: FloorThings["puddles"] = [];
  for (let i = 0; puddles.length < 120 && i < 900; i++) {
    const at = pick(0.7);
    if (nearStream(at.X, at.Z) > 0.6 && R() < 0.7) continue;
    puddles.push({ ...at, r: 0.003 + 0.014 * R() * R(), k: R() });
  }
  return { drifts, boulders, cracks, puddles };
}

function paintFloor(g: CanvasRenderingContext2D, lw: number, lh: number, R: number, u0: number, things: FloorThings, wet: boolean): void {
  const at = (X: number, Z: number): [number, number] => [(X / Z - u0) * R, (HC / Z) * R];
  // The ground: lost in haze far away, dark basalt near.
  const grd = g.createLinearGradient(0, 0, 0, lh);
  const stops: [number, C3][] = wet
    ? [
        [0, [96, 110, 120]],
        [0.03, [54, 64, 68]],
        [0.15, [36, 44, 44]],
        [0.45, [27, 33, 33]],
        [1, [18, 22, 24]],
      ]
    : [
        [0, [112, 86, 64]],
        [0.03, [76, 60, 48]],
        [0.15, [52, 44, 38]],
        [0.45, [36, 32, 29]],
        [1, [24, 22, 21]],
      ];
  for (const [s, c] of stops) grd.addColorStop(s, css(c));
  g.fillStyle = grd;
  g.fillRect(0, 0, lw, lh);
  // The rock's relief, foreshortened: in bands, each squashed as much as its distance asks.
  for (let y = 0; y < lh; ) {
    const v = Math.max(0.004, (y + 1) / R);
    const Z = HC / v;
    const bh = Math.max(2, Math.min(24, y * 0.08));
    const kx = clamp((R * 0.0016) / Z, 0.05, 3);
    const fade = smooth(0.006, 0.05, v);
    g.save();
    g.beginPath();
    g.rect(0, y, lw, bh + 0.5);
    g.clip();
    texture(g, relief(), lw, lh, kx * 2.2, kx * 2.2 * (HC / Z) * 2.4, "overlay", (wet ? 0.55 : 0.6) * fade, 0, 0);
    texture(g, strata(), lw, lh, kx * 4, kx * 4 * (HC / Z) * 1.4, "soft-light", 0.3 * fade, 77, 0);
    g.restore();
    y += bh;
  }
  if (!wet) {
    // Ochre dust drifts, blown long by the wind.
    for (const d of things.drifts) {
      const [x, y] = at(d.X, d.Z);
      const rx = (d.r / d.Z) * R;
      blot(g, x, y, rx * 1.6, Math.max(0.015, (HC / d.Z) * 0.6), DUST, 0.2);
    }
  } else {
    // Darker wet patches where the water soaked in.
    for (const d of things.drifts) {
      const [x, y] = at(d.X, d.Z);
      const rx = (d.r / d.Z) * R;
      blot(g, x, y, rx * 1.3, Math.max(0.015, HC / d.Z), [8, 12, 14], 0.3);
    }
  }
  // The canyon beds: dry and cracked, or dark wet banks round the water.
  const paths = streamPaths();
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const p of paths) {
    const passes: [number, C3, number][] = wet
      ? [
          [2.6, [8, 11, 13], 0.3],
          [1.12, [10, 13, 15], 0.9],
        ]
      : [
          [1.8, [96, 76, 58], 0.16],
          [1.12, [26, 22, 20], 0.85],
          [0.5, [12, 11, 10], 0.8],
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
    blot(g, x, y, rx * (wet ? 1.7 : 1.3), HC / pd.Z, wet ? [10, 14, 16] : [22, 18, 16], 0.85);
  }
  // Fractures in the basalt plates; while barren a few dull vents.
  for (const c of things.cracks) {
    const Z = c.pts[0]![1];
    g.strokeStyle = c.vent && !wet ? "rgb(170 70 34 / 0.4)" : wet ? "rgb(4 6 7 / 0.5)" : "rgb(8 7 7 / 0.45)";
    g.lineWidth = Math.max(0.5, Math.min(2.2, (0.0016 / Z) * R));
    g.beginPath();
    for (const [i, q] of c.pts.entries()) {
      const [x, y] = at(q[0], q[1]);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    if (c.vent && !wet) {
      const [x, y] = at(c.pts[2]![0], c.pts[2]![1]);
      blot(g, x, y, (0.04 / Z) * R, 0.4, [180, 70, 34], 0.18);
    }
  }
  // Boulders of basalt: lit on top (dust, or a wet glint), a shadow on the ground.
  for (const b of things.boulders) {
    const [x, y] = at(b.X, b.Z);
    const s = (b.s / b.Z) * R;
    if (s < 0.8) continue;
    g.fillStyle = "rgb(0 0 0 / 0.32)";
    g.beginPath();
    g.ellipse(x - s * 0.4, y + s * 0.42, s * 0.95, s * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = wet ? css([14, 18, 20]) : css([28, 25, 23]);
    g.beginPath();
    for (const [i, q] of b.pts.entries()) {
      if (i) g.lineTo(x + q[0] * s, y + q[1] * s);
      else g.moveTo(x + q[0] * s, y + q[1] * s);
    }
    g.closePath();
    g.fill();
    g.fillStyle = wet ? css(SHEEN, 0.22 + 0.2 * b.k) : css(DUST, 0.45);
    g.beginPath();
    g.ellipse(x - s * 0.1, y - s * 0.36, s * (wet ? 0.3 : 0.48), s * (wet ? 0.07 : 0.16), -0.15, 0, Math.PI * 2);
    g.fill();
  }
  if (wet) {
    // Puddles holding the cold sky, each with a sharp glint.
    for (const p of things.puddles) {
      const [x, y] = at(p.X, p.Z);
      const rx = (p.r / p.Z) * R;
      if (rx < 0.6) continue;
      const flat = Math.max(0.05, (HC / p.Z) * 1.4);
      blot(g, x, y, rx * 1.6, flat, [6, 9, 11], 0.35);
      blot(g, x + rx * 0.15, y, rx, flat, [64 + 24 * p.k, 78 + 24 * p.k, 90 + 24 * p.k], 0.45);
      g.fillStyle = css(SHEEN, 0.35);
      g.fillRect(x - rx * 0.3, y - rx * flat * 0.3, rx * 0.45, Math.max(0.5, rx * flat * 0.2));
    }
    // Fine wet sheen streaks over the plain, flattened by distance.
    const R2 = rng(4141);
    for (let i = 0; i < 500; i++) {
      const v = 0.006 + (lh / R - 0.006) * Math.pow(R2(), 1.4);
      const Z = HC / v;
      const x = R2() * lw;
      const len = (0.03 + 0.08 * R2()) * (R / Z) * 6;
      g.fillStyle = css(SHEEN, 0.04 + 0.06 * R2());
      g.fillRect(x, v * R, len, Math.max(0.5, (R * HC * 0.01) / (Z * Z)));
    }
  }
  // Haze over the far plain.
  const hz = g.createLinearGradient(0, 0, 0, R * 0.05);
  const hc = FAR_HAZE[wet ? 1 : 0];
  hz.addColorStop(0, css(hc, 0.9));
  hz.addColorStop(1, css(hc, 0));
  g.fillStyle = hz;
  g.fillRect(0, 0, lw, R * 0.05);
  grain(g, lw, lh, wet ? 0.2 : 0.28);
}

// ---------------------------------------------------------------- the near rocks

function paintNear(g: CanvasRenderingContext2D, b: BoardSpec, pts: [number, number][], lw: number, lh: number, R: number, wet: boolean): void {
  paintRock(g, b, pts, lw, lh, R, wet ? { ...WET_ROCK, top: [22, 28, 29], base: [13, 17, 19], relief: 0.7 } : { ...BARREN_ROCK, top: [38, 33, 30], base: [20, 18, 17], relief: 0.72 }, wet);
  if (wet) {
    // Beads of water along the top edges, catching the light.
    const R1 = rng(b.seed + 77);
    for (let i = 0; i < pts.length; i += 3) {
      const p = pts[i]!;
      if (p[1] > lh - 4 || R1() < 0.55) continue;
      const r = (0.6 + R1() * 1.4) * (R / 900);
      g.fillStyle = css(SHEEN, 0.35 + 0.35 * R1());
      g.fillRect(p[0], p[1] + 1 + R1() * 6 * (R / 900), r * 2, r);
    }
  }
}

// ---------------------------------------------------------------- the masks

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

/** How a layer looks at time t: all barren, all wet, or the tide passing over it. */
export function layerState(l: Layer, t: number): "barren" | "wet" | "mix" {
  const m = l.mask;
  if (!l.wet) return "barren";
  if (!m) return t >= BLOOM_FULL + BLOOM_FADE ? "wet" : t < 7.6 ? "barren" : "mix";
  if (m.rows < m.mh || t <= m.lo) return "barren";
  if (t >= m.hi + GLOW) return "wet";
  return "mix";
}

/**
 * Draw a layer with the tide passing over it, into g already set to the layer's own px: the barren
 * picture, the tiles the tide has passed whole from the wet one, and over the tiles it is
 * passing now (one box round them all) the wet picture through the arrival picture, with its
 * wet sheen at its front. `tmp`: a canvas as big as the layer.
 */
export function drawMix(g: CanvasRenderingContext2D, l: Layer, t: number, tmp: HTMLCanvasElement): void {
  const m = l.mask!;
  const wet = l.wet!;
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
        if (sw > 0 && sh > 0) g.drawImage(wet, sx, sy, sw, sh, sx, sy, sw, sh);
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
      gd[o + 3] = (fr * fr * 80) | 0;
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
  tg.drawImage(wet, sx, sy, sw, sh, 0, 0, sw, sh);
  tg.globalCompositeOperation = "destination-in";
  tg.drawImage(m.cv, mx0, my0, mx1 - mx0, my1 - my0, 0, 0, sw, sh);
  // The wet sheen at its front, only on what is there (a board of rock has empty sky round it).
  tg.globalCompositeOperation = "source-atop";
  tg.drawImage(m.glow, mx0, my0, mx1 - mx0, my1 - my0, 0, 0, sw, sh);
  tg.globalCompositeOperation = "source-over";
  g.drawImage(tmp, 0, 0, sw, sh, sx, sy, sw, sh);
}

// ---------------------------------------------------------------- building it all

export interface Valley {
  layers: Layer[];
  /** Make the wet pictures a little at a time: returns true when all are made. */
  prepare(budget: number): boolean;
  /** Layer px per angular unit asked for. */
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

  // The distant ranges.
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
    const l: Layer = { id: "far", kind: "board", Z, u0, u1, v0, v1, R: Rf, lw: barren.width, lh: barren.height, barren, wet: undefined, crest: undefined, mask: undefined };
    layers.push(l);
    jobs.push(() => {
      const c = canvas(lw, lh);
      paintFar(c.getContext("2d")!, c.width, c.height, Rf, u0, v0, true);
      l.wet = c;
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
    const l: Layer = { id: "floor", kind: "floor", Z: 0, u0, u1, v0: 0, v1: vmax, R: Rf, lw, lh, barren, wet: undefined, crest: undefined, mask: newMask(lw, lh) };
    layers.push(l);
    jobs.push(() => {
      const c = canvas(lw, lh);
      paintFloor(c.getContext("2d")!, lw, lh, Rf, u0, things, true);
      l.wet = c;
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
        return e * ledges(0.34 + 0.66 * jag(u, 21, 45) + 0.12 * jag(u, 22, 150), 0.07) + e * needles(u, 21, 0.11, 0.05);
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
        return e * ledges(0.32 + 0.64 * jag(u, 7, 50) + 0.1 * jag(u, 8, 170), 0.06) + e * needles(u, 7, 0.1, 0.05);
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
        return e * ledges(0.12 + 0.17 * jag(u, 55, 30) + 0.05 * jag(u, 56, 110), 0.025) - 0.02;
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
    const pts = profile(b, Rb, v0);
    const barren = canvas(lw, lh);
    if (b.id === "near") paintNear(barren.getContext("2d")!, b, pts, lw, lh, Rb, false);
    else paintRock(barren.getContext("2d")!, b, pts, lw, lh, Rb, BARREN_ROCK, false);
    const crest = canvas(lw, lh);
    paintCrest(crest.getContext("2d")!, b, pts, Rb);
    const l: Layer = { id: b.id, kind: "board", Z: b.Z, u0: b.u0, u1: b.u1, v0, v1, R: Rb, lw, lh, barren, wet: undefined, crest, mask: newMask(lw, lh) };
    layers.push(l);
    jobs.push(() => {
      const c = canvas(lw, lh);
      if (b.id === "near") paintNear(c.getContext("2d")!, b, pts, lw, lh, Rb, true);
      else paintRock(c.getContext("2d")!, b, pts, lw, lh, Rb, WET_ROCK, true);
      l.wet = c;
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
