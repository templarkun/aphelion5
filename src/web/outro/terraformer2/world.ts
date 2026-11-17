/**
 * Terraformer 2.0: the ground of the target sector and the storm over it (designer 2026-11-17).
 * Before: dark ash ground under a deck of toxic storm clouds, rust red and ash grey, lit from
 * below by red glows and lightning. After: as each pylon anchors and fires its beam, soft emerald
 * and cyan fronts swirl outwards through the cloud deck and clear it, and beneath it the ground
 * turns to deep blue ocean and green and teal land, with thin white clouds drifting over it.
 * Not a grid: everything is soft and uneven.
 *
 * The ground and the clouds over it are one solid picture laid on the globe piece by piece (solid,
 * so no seams show where the pieces meet). Near the sector (NEAR_SPAN) it changes with time: every
 * point of it knows the moment the clearing reaches it, so any moment of the film can be drawn by
 * itself; only the points whose look changes are worked out again each frame. Farther out the
 * storm is one still picture. The deck counts as CLOUD_ALT above the ground for what sinks into it
 * (`fog` says how thick it still is over a place). The pictures are made a little at a time during
 * the first act (`prepare`), so the film never stops to make them. Looks only.
 */

import { noise3 } from "../../noise.js";
import { clamp, cross, ease, rng, smooth, TAU, unit, type V3 } from "../../briefing/styles/intro2/math3.js";
import { softSprite } from "../terraformer/pylon.js";
import type { SitePlace } from "../terraformer/timeline.js";
import { DEG, place, see, type Cam } from "../terraformer/view.js";

/** The cloud deck's height over the ground, planet radii (what sinks into it is hidden). */
export const CLOUD_ALT = 0.02;
/** The changing part: lon and lat within this many degrees of the sector's middle. */
const NEAR_SPAN = 20;
const NEAR_PX = 448;
const NEAR_CELLS = 28;
/** It fades into the still storm between these distances from the middle (degrees). */
const SEAM_IN = 17;
const SEAM_OUT = 19.8;
/** The still storm round it, fading into the night side at its edge. */
const FAR_SPAN = 40;
const FAR_PX = 256;
const FAR_CELLS = 24;
const NIGHT = [5, 9, 16] as const;
/** How far a pylon's clearing reaches (degrees), and how fast it slows (its time constant, s). */
export const SEED_REACH = 6.4;
const SEED_TAU = 1.25;
/** The hole the braking thrusters blow in the deck as a pylon sinks through it (degrees). */
const HOLE = 0.9;
/** How long a point of cloud takes to clear, s; its front glows for the first GLOW s. */
const FADE = 0.9;
const GLOW = 0.36;
/** How long a point of ground takes to change, s. */
const GROW = 1.1;

const EMERALD = [60, 236, 170] as const;
const CYAN = [120, 226, 255] as const;
const WISP = [214, 232, 236] as const;

export interface WorldSite extends SitePlace {
  /** The pylon anchors. */
  at: number;
  /** Its thrusters blow the hole in the deck (it sinks through the deck). */
  through: number;
  /** The clearing starts (its beam has fired). */
  seed: number;
  n: V3;
  e1: V3;
  e2: V3;
}

export interface World {
  sites: WorldSite[];
  /** Make the pictures a little at a time (call once a frame); true when all are made. `budget` ms. */
  prepare(budget: number): boolean;
  /** The ground under the storm, the deck, its lightning, its glowing fronts and seeding rings (inside the globe's shape). */
  surface(g: CanvasRenderingContext2D, c: Cam, t: number): void;
  /** How thick the cloud deck is over lon, lat at time t, 0 (clear) .. 1. */
  fog(lon: number, lat: number, t: number): number;
  /** The moment the clouds over lon, lat start to clear (Infinity: never). */
  clearedAt(lon: number, lat: number): number;
  /** How much of the sector is changed, 0..1. */
  progress(t: number): number;
}

function fbm(x: number, y: number, z: number, oct: number): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    v += a * noise3(x * f, y * f, z * f);
    a *= 0.5;
    f *= 2.03;
  }
  return v;
}

/** The toxic storm at lon, lat: [r, g, b, cover 0..1]. The same everywhere, near and far, so the two pictures meet without a seam. */
function storm(lon: number, lat: number, out: number[]): void {
  // Swirled: the coordinates pushed about by a slow field.
  const wx = lon + 5 * noise3(lon * 0.045, lat * 0.045, 7.3);
  const wy = lat + 5 * noise3(lon * 0.045 + 31, lat * 0.045, 2.1);
  const big = fbm(wx * 0.085, wy * 0.085, 1.7, 3);
  const fine = noise3(wx * 0.42, wy * 0.42, 5.1);
  out[3] = clamp(0.8 + 1.1 * big + 0.22 * fine);
  const dens = clamp(0.5 + 1.2 * big + 0.35 * fine);
  // Red glows from below (fires, the planet's wounds) and their rust light on the cloud.
  const ember = Math.pow(clamp(noise3(lon * 0.16 + 9, lat * 0.16, 3.3) * 1.6 + 0.1), 3);
  out[0] = 46 + 74 * dens + 150 * ember;
  out[1] = 34 + 40 * dens + 40 * ember;
  out[2] = 32 + 28 * dens + 8 * ember;
}
/** The dark ash ground at lon, lat: [r, g, b, land, ridge, grit] (the last three shape the new ground). */
function ash(lon: number, lat: number, out: number[]): void {
  const land = fbm(lon * 0.1 + 3.1, lat * 0.1 + 7.7, 1.3, 4);
  const ridge = Math.pow(1 - Math.abs(noise3(lon * 0.38 + 5, lat * 0.38 + 9, 2)), 5);
  const grit = noise3(lon * 1.6, lat * 1.6, 4.4);
  const light = clamp(0.16 + 0.45 * ridge * clamp(0.5 + land) + 0.12 * grit + 0.1 * land);
  // Glowing cracks: the planet's fires, dull red.
  const crack = Math.pow(clamp(1 - Math.abs(noise3(lon * 0.7 + 2, lat * 0.7 + 6, 7.7)) * 7), 2) * clamp(0.3 + land * 2);
  out[0] = 16 + 60 * light + 80 * crack;
  out[1] = 12 + 44 * light + 18 * crack;
  out[2] = 12 + 36 * light + 8 * crack;
  out[3] = land;
  out[4] = ridge;
  out[5] = grit;
}

export function createWorld(places: SitePlace[], anchors: number[], through: number[], seedDelay: number): World {
  const sites: WorldSite[] = places.map((p, i) => {
    const n = place(p.lon, p.lat);
    const e1 = unit(cross([0, 1, 0], n));
    const e2 = cross(n, e1);
    return { lon: p.lon, lat: p.lat, at: anchors[i]!, through: through[i]!, seed: anchors[i]! + seedDelay, n, e1, e2 };
  });
  const R = rng(4711 + sites.length * 13);
  const first = Math.min(...sites.map((s) => s.seed));
  const last = Math.max(...sites.map((s) => s.seed));

  /** The moment the seeding front reaches lon, lat; Infinity if it never does. */
  const seedTime = (lon: number, lat: number, warp: number): number => {
    let best = Infinity;
    for (let i = 0; i < sites.length; i++) {
      const s = sites[i]!;
      const dx = lon - s.lon;
      const dy = lat - s.lat;
      const d = Math.hypot(dx, dy);
      // Swirling fronts: the distance pushed in and out by the noise, and by uneven arms turning round the pylon.
      const ang = Math.atan2(dy, dx) + d * 0.32;
      const arms = 0.3 * Math.sin(3 * ang + i * 1.7) + 0.75 * noise3(Math.cos(ang) * 1.4 + i * 3.1, Math.sin(ang) * 1.4, d * 0.12 + i);
      const r = Math.max(0, d + warp * 1.25 + arms * Math.min(1, d / 2.5));
      if (r >= SEED_REACH) continue;
      best = Math.min(best, s.seed - SEED_TAU * Math.log(1 - r / SEED_REACH));
    }
    return best;
  };
  const holeTime = (lon: number, lat: number, warp: number): number => {
    let best = Infinity;
    for (const s of sites) {
      const d = Math.hypot(lon - s.lon, lat - s.lat) + warp * 0.25;
      if (d < HOLE) best = Math.min(best, s.through - 0.15 + Math.pow(Math.max(0, d) / HOLE, 1.5) * 0.9);
    }
    return best;
  };

  // ---- The near picture: every point's look before and after, and when it changes.
  const N = NEAR_PX * NEAR_PX;
  const cloud = new Uint8ClampedArray(N * 4); // the storm's colour and cover
  const wisp = new Uint8Array(N); // after: thin white cloud
  const groundB = new Uint8ClampedArray(N * 3);
  const groundA = new Uint8ClampedArray(N * 3);
  const edge = new Uint8Array(N); // fades into the still storm
  const Tc = new Float32Array(N);
  const Tg = new Float32Array(N);
  const viaHole = new Uint8Array(N);
  /** When the seeding front reaches the point (Tg is a little later); wisps only form after it. */
  const Ts = new Float32Array(N);
  let made = 0; // rows made
  let order: Uint32Array | undefined;
  let starts: Float32Array | undefined;
  /** The longest time a point takes to change, from its first change to its last. */
  let longest = 0;
  let near: HTMLCanvasElement | undefined;
  let img: ImageData | undefined;
  let nearT = NaN;
  let far: HTMLCanvasElement | undefined;

  const st = [0, 0, 0, 0];
  const gr = [0, 0, 0, 0, 0, 0];
  function makeFar(): void {
    const cv = document.createElement("canvas");
    cv.width = cv.height = FAR_PX;
    const a = cv.getContext("2d")!.createImageData(FAR_PX, FAR_PX);
    for (let y = 0; y < FAR_PX; y++) {
      const lat = (((y + 0.5) / FAR_PX) * 2 - 1) * FAR_SPAN;
      for (let x = 0; x < FAR_PX; x++) {
        const lon = (((x + 0.5) / FAR_PX) * 2 - 1) * FAR_SPAN;
        storm(lon, lat, st);
        ash(lon, lat, gr);
        const out = smooth(FAR_SPAN * 0.72, FAR_SPAN * 0.98, Math.hypot(lon, lat));
        const i = (y * FAR_PX + x) * 4;
        for (let ch = 0; ch < 3; ch++) a.data[i + ch] = (gr[ch]! + (st[ch]! - gr[ch]!) * st[3]!) * (1 - out) + NIGHT[ch]! * out;
        a.data[i + 3] = 255;
      }
    }
    cv.getContext("2d")!.putImageData(a, 0, 0);
    far = cv;
  }

  function makeRow(y: number): void {
    const lat = (((y + 0.5) / NEAR_PX) * 2 - 1) * NEAR_SPAN;
    for (let x = 0; x < NEAR_PX; x++) {
      const lon = (((x + 0.5) / NEAR_PX) * 2 - 1) * NEAR_SPAN;
      const k = y * NEAR_PX + x;
      storm(lon, lat, st);
      cloud[k * 4] = st[0]!;
      cloud[k * 4 + 1] = st[1]!;
      cloud[k * 4 + 2] = st[2]!;
      cloud[k * 4 + 3] = 255 * st[3]!;
      edge[k] = 255 * (1 - smooth(SEAM_IN, SEAM_OUT, Math.hypot(lon, lat)));
      const warp = fbm(lon * 0.32 + 4, lat * 0.32 + 8, 6.6, 2);
      const seed = seedTime(lon, lat, warp);
      const hole = holeTime(lon, lat, warp);
      Tc[k] = Math.min(seed, hole);
      viaHole[k] = hole < seed ? 1 : 0;
      Ts[k] = seed;
      Tg[k] = seed + 0.25;
      // Thin white clouds after, in streaks that curl round the nearest pylon.
      let ns = sites[0]!;
      let nd = Infinity;
      for (const s of sites) {
        const d = Math.hypot(lon - s.lon, lat - s.lat);
        if (d < nd) {
          nd = d;
          ns = s;
        }
      }
      const ang = Math.atan2(lat - ns.lat, lon - ns.lon);
      const curl = noise3(Math.cos(ang + nd * 0.32) * 2.2 + nd * 0.25, Math.sin(ang + nd * 0.32) * 2.2, nd * 0.5 + 3.3);
      wisp[k] = 255 * clamp(0.05 + 0.5 * curl + 0.25 * noise3(lon * 0.6, lat * 0.6, 8.8)) * 0.22 * smooth(0.8, 2.6, nd);
      // The ground: dark ash before; after, ocean below the sea line and green and teal land above it.
      ash(lon, lat, gr);
      groundB[k * 3] = gr[0]!;
      groundB[k * 3 + 1] = gr[1]!;
      groundB[k * 3 + 2] = gr[2]!;
      const land = gr[3]!;
      const ridge = gr[4]!;
      const grit = gr[5]!;
      const sea = land + 0.18 * noise3(lon * 0.28, lat * 0.28, 9.9) + 0.02;
      // Ocean and land, mixed over a narrow shore so the coast is smooth, not stepped.
      const deep = clamp(-sea * 4);
      const or = 12 + 18 * (1 - deep) + 6 * grit;
      const og = 48 + 70 * (1 - deep) + 6 * grit;
      const ob = 104 + 60 * (1 - deep);
      // Land: pale shores, teal and green lowlands, darker forest, olive and tan uplands; relief shaded.
      const hi = clamp(sea * 2.6);
      const shore = 1 - smooth(0, 0.035, sea);
      const forest = clamp(0.5 + 1.8 * noise3(lon * 0.55 + 7, lat * 0.55, 1.9));
      const sh = 0.62 + 0.5 * ridge + 0.16 * grit + 0.12 * noise3(lon * 0.9, lat * 0.9, 6.1);
      const up = smooth(0.35, 0.9, hi);
      let lr = 34 - 14 * forest + 74 * up;
      let lg = 118 - 34 * forest + 2 * up;
      let lb = 86 - 40 * forest - 22 * up;
      lr = (lr + (150 - lr) * shore * 0.6) * sh;
      lg = (lg + (176 - lg) * shore * 0.6) * sh;
      lb = (lb + (150 - lb) * shore * 0.6) * sh;
      const m = smooth(-0.012, 0.012, sea);
      groundA[k * 3] = or + (lr - or) * m;
      groundA[k * 3 + 1] = og + (lg - og) * m;
      groundA[k * 3 + 2] = ob + (lb - ob) * m;
    }
  }

  function finish(): void {
    // The points that change, by the moment they start to (a native sort of packed numbers: fast).
    const Q = 4096;
    const packed: number[] = [];
    for (let k = 0; k < N; k++) {
      const s = Tc[k]!;
      if (!Number.isFinite(s)) continue;
      packed.push(Math.round(Math.max(0, s) * Q) * 262144 + k);
      const end = Math.max(s + FADE, Number.isFinite(Tg[k]!) ? Tg[k]! + GROW : -Infinity);
      longest = Math.max(longest, end - s);
    }
    const arr = Float64Array.from(packed).sort();
    order = new Uint32Array(arr.length);
    starts = new Float32Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      const k = arr[i]! % 262144;
      order[i] = k;
      starts[i] = Tc[k]!;
    }
    near = document.createElement("canvas");
    near.width = near.height = NEAR_PX;
    img = near.getContext("2d")!.createImageData(NEAR_PX, NEAR_PX);
  }

  function prepare(budget: number): boolean {
    if (near) return true;
    const t0 = performance.now();
    if (!far) {
      makeFar();
      if (performance.now() - t0 > budget) return false;
    }
    while (made < NEAR_PX) {
      makeRow(made++);
      if (made % 4 === 0 && performance.now() - t0 > budget) return false;
    }
    finish();
    return true;
  }

  // ---- A point of cloud and of ground at time t.
  /** The cloud over point k: writes its colour into c3 and returns its cover 0..1. */
  const c3 = [0, 0, 0];
  function cloudAt(k: number, t: number): number {
    const o = k * 4;
    let before = cloud[o + 3]! / 255;
    c3[0] = cloud[o]!;
    c3[1] = cloud[o + 1]!;
    c3[2] = cloud[o + 2]!;
    if (!(t >= Tc[k]!)) return before;
    if (viaHole[k] === 1) {
      // The thrusters' wash thins the deck round a pylon as it sinks through (a pale cyan swirl), not a clean cut.
      const h = t - Tc[k]!;
      const f = ease(clamp(h / FADE));
      const glow = h < GLOW * 1.6 ? Math.sin((Math.PI * h) / (GLOW * 1.6)) * 0.3 : 0;
      for (let ch = 0; ch < 3; ch++) c3[ch] = c3[ch]! + (CYAN[ch]! - c3[ch]!) * glow;
      before *= 1 - 0.72 * f;
      if (!(t >= Ts[k]!)) return before;
    }
    const tau = t - Ts[k]!;
    const w = wisp[k]! / 255;
    if (tau >= FADE) {
      c3[0] = WISP[0];
      c3[1] = WISP[1];
      c3[2] = WISP[2];
      return w;
    }
    const f = ease(tau / FADE);
    const glow = tau < GLOW ? Math.sin((Math.PI * tau) / GLOW) : 0;
    const gk = glow * 0.48;
    for (let ch = 0; ch < 3; ch++) c3[ch] = c3[ch]! + (WISP[ch]! - c3[ch]!) * f + (EMERALD[ch]! - c3[ch]!) * gk;
    return Math.max(before * (1 - f) + w * f, before * gk * 0.85);
  }
  const g3 = [0, 0, 0];
  function groundAt(k: number, t: number): void {
    const q = k * 3;
    const tau = t - Tg[k]!;
    if (!(tau >= 0)) {
      g3[0] = groundB[q]!;
      g3[1] = groundB[q + 1]!;
      g3[2] = groundB[q + 2]!;
      return;
    }
    if (tau >= GROW) {
      g3[0] = groundA[q]!;
      g3[1] = groundA[q + 1]!;
      g3[2] = groundA[q + 2]!;
      return;
    }
    const f = ease(tau / GROW);
    // A fresh green light runs ahead of the new ground.
    const life = tau < 0.6 ? Math.sin((Math.PI * tau) / 0.6) * 0.12 : 0;
    for (let ch = 0; ch < 3; ch++) g3[ch] = groundB[q + ch]! + (groundA[q + ch]! - groundB[q + ch]!) * f + (EMERALD[ch]! - groundB[q + ch]!) * life;
  }
  function point(k: number, t: number, d: Uint8ClampedArray): void {
    const a = cloudAt(k, t);
    groundAt(k, t);
    const o = k * 4;
    d[o] = g3[0]! + (c3[0]! - g3[0]!) * a;
    d[o + 1] = g3[1]! + (c3[1]! - g3[1]!) * a;
    d[o + 2] = g3[2]! + (c3[2]! - g3[2]!) * a;
    d[o + 3] = edge[k]!;
  }

  const lowerBound = (a: Float32Array, v: number) => {
    let lo = 0;
    let hi = a.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (a[m]! < v) lo = m + 1;
      else hi = m;
    }
    return lo;
  };
  /** Bring the near picture to time t: every point when going back, else only those whose look can have changed since. */
  function update(t: number): void {
    if (nearT === t) return;
    const d = img!.data;
    let x0 = NEAR_PX;
    let y0 = NEAR_PX;
    let x1 = -1;
    let y1 = -1;
    if (!(t >= nearT)) {
      for (let k = 0; k < N; k++) point(k, t, d);
      x0 = y0 = 0;
      x1 = y1 = NEAR_PX - 1;
    } else {
      const lo = lowerBound(starts!, nearT - longest - 0.02);
      const hi = lowerBound(starts!, t + 1e-6);
      for (let i = lo; i < hi; i++) {
        const k = order![i]!;
        point(k, t, d);
        const x = k % NEAR_PX;
        const y = (k - x) / NEAR_PX;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    nearT = t;
    if (x1 >= x0) near!.getContext("2d")!.putImageData(img!, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }

  // ---- Laying a picture on the globe, piece by piece.
  const meshes = new Map<string, { sx: Float32Array; sy: Float32Array; ok: Uint8Array }>();
  const corner = (c: Cam, lon: number, lat: number, out: number[], o: number): boolean => {
    const p = place(lon, lat);
    if (!(p[0] * c.pos[0] + p[1] * c.pos[1] + p[2] * c.pos[2] > 1.0005) || !see(c, p[0], p[1], p[2])) return false;
    out[o] = c.sx;
    out[o + 1] = c.sy;
    return true;
  };
  const q = new Array<number>(8).fill(0);
  /**
   * One piece: the texels sx, sy, sw, sh of `tex` over lon0..lon1, lat0..lat1. Each piece is set on its
   * own corners (stretched flat between them); a piece that is big in the picture is cut in four first,
   * so the ground keeps its true perspective. It takes a texel more on each side, so its edges join
   * smoothly with the next piece.
   */
  function piece(g: CanvasRenderingContext2D, c: Cam, tex: HTMLCanvasElement, lon0: number, lat0: number, lon1: number, lat1: number, sx: number, sy: number, sw: number, sh: number, x00: number, y00: number, x10: number, y10: number, x01: number, y01: number, x11: number, y11: number, depth: number): void {
    const xa = Math.min(x00, x10, x01, x11);
    const xb = Math.max(x00, x10, x01, x11);
    const ya = Math.min(y00, y10, y01, y11);
    const yb = Math.max(y00, y10, y01, y11);
    if (xb < 0 || xa > c.w || yb < 0 || ya > c.h) return;
    const size = Math.max(xb - xa, yb - ya);
    if (size > 3 * Math.max(c.w, c.h)) return;
    if (size > 170 && depth < 2) {
      const lm = (lon0 + lon1) / 2;
      const am = (lat0 + lat1) / 2;
      const P: number[] = new Array(10);
      if (corner(c, lm, lat0, P, 0) && corner(c, lon0, am, P, 2) && corner(c, lm, am, P, 4) && corner(c, lon1, am, P, 6) && corner(c, lm, lat1, P, 8)) {
        const hw = sw / 2;
        const hh = sh / 2;
        piece(g, c, tex, lon0, lat0, lm, am, sx, sy, hw, hh, x00, y00, P[0]!, P[1]!, P[2]!, P[3]!, P[4]!, P[5]!, depth + 1);
        piece(g, c, tex, lm, lat0, lon1, am, sx + hw, sy, hw, hh, P[0]!, P[1]!, x10, y10, P[4]!, P[5]!, P[6]!, P[7]!, depth + 1);
        piece(g, c, tex, lon0, am, lm, lat1, sx, sy + hh, hw, hh, P[2]!, P[3]!, P[4]!, P[5]!, x01, y01, P[8]!, P[9]!, depth + 1);
        piece(g, c, tex, lm, am, lon1, lat1, sx + hw, sy + hh, hw, hh, P[4]!, P[5]!, P[6]!, P[7]!, P[8]!, P[9]!, x11, y11, depth + 1);
        return;
      }
    }
    // Set on three corners; one texel more on each side (clamped at the picture's own edge).
    const mx = Math.min(1, sx);
    const my = Math.min(1, sy);
    const mw = Math.min(1, tex.width - sx - sw);
    const mh = Math.min(1, tex.height - sy - sh);
    g.save();
    g.transform(x10 - x00, y10 - y00, x01 - x00, y01 - y00, x00, y00);
    g.drawImage(tex, sx - mx, sy - my, sw + mx + mw, sh + my + mh, -mx / sw - 0.004, -my / sh - 0.004, 1 + (mx + mw) / sw + 0.008, 1 + (my + mh) / sh + 0.008);
    g.restore();
  }
  /** Draw `tex` over the globe (lon, lat within ±span); `skip` leaves out pieces wholly within that many degrees of the middle. */
  function lay(g: CanvasRenderingContext2D, c: Cam, tex: HTMLCanvasElement, id: string, span: number, cells: number, skip = 0): void {
    const n = cells + 1;
    let m = meshes.get(id);
    if (!m) {
      m = { sx: new Float32Array(n * n), sy: new Float32Array(n * n), ok: new Uint8Array(n * n) };
      meshes.set(id, m);
    }
    const deg = (i: number) => ((i / cells) * 2 - 1) * span;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        m.ok[k] = corner(c, deg(i), deg(j), q, 0) ? 1 : 0;
        m.sx[k] = q[0]!;
        m.sy[k] = q[1]!;
      }
    const cell = tex.width / cells;
    for (let j = 0; j < cells; j++)
      for (let i = 0; i < cells; i++) {
        if (skip > 0) {
          // Its farthest corner from the middle.
          const lo = Math.max(Math.abs((i / cells) * 2 - 1), Math.abs(((i + 1) / cells) * 2 - 1)) * span;
          const la = Math.max(Math.abs((j / cells) * 2 - 1), Math.abs(((j + 1) / cells) * 2 - 1)) * span;
          if (Math.hypot(lo, la) < skip) continue;
        }
        const k00 = j * n + i;
        const k10 = k00 + 1;
        const k01 = k00 + n;
        const k11 = k01 + 1;
        if (!m.ok[k00] || !m.ok[k10] || !m.ok[k01] || !m.ok[k11]) continue;
        piece(g, c, tex, deg(i), deg(j), deg(i + 1), deg(j + 1), i * cell, j * cell, cell, cell, m.sx[k00]!, m.sy[k00]!, m.sx[k10]!, m.sy[k10]!, m.sx[k01]!, m.sy[k01]!, m.sx[k11]!, m.sy[k11]!, 0);
      }
  }

  // ---- Sprites and the storm's lightning.
  const bolt = softSprite("255 150 110", 0.8, 96);
  const ember = softSprite("150 110 90", 0, 96);
  const front = softSprite("90 240 190", 0.5, 128);
  const flashes = Array.from({ length: 110 }, () => {
    const a = R() * TAU;
    const d = Math.sqrt(R()) * 28;
    return { lon: Math.cos(a) * d, lat: Math.sin(a) * d * 0.8, at: R() * 18, size: 0.5 + R() * 1.4 };
  });
  const RING = 64;
  const rx = new Float32Array(RING + 1);
  const ry = new Float32Array(RING + 1);
  /** A circle on the ground round a site, deg wide: false if part of it is out of sight. */
  function ringOn(c: Cam, s: WorldSite, deg: number): boolean {
    const cr = Math.cos(deg * DEG);
    const sr = Math.sin(deg * DEG);
    for (let i = 0; i <= RING; i++) {
      const a = (i / RING) * TAU;
      const x = s.n[0] * cr + s.e1[0] * Math.cos(a) * sr + s.e2[0] * Math.sin(a) * sr;
      const y = s.n[1] * cr + s.e1[1] * Math.cos(a) * sr + s.e2[1] * Math.sin(a) * sr;
      const z = s.n[2] * cr + s.e1[2] * Math.cos(a) * sr + s.e2[2] * Math.sin(a) * sr;
      if (!see(c, x, y, z)) return false;
      rx[i] = c.sx;
      ry[i] = c.sy;
    }
    return true;
  }
  /** A soft light lying flat on the ground at lon, lat, deg wide. */
  function flat(g: CanvasRenderingContext2D, c: Cam, spr: HTMLCanvasElement, lon: number, lat: number, deg: number, alpha: number): void {
    const p = place(lon, lat);
    if (!see(c, p[0], p[1], p[2])) return;
    const x0 = c.sx;
    const y0 = c.sy;
    const e = place(lon + deg, lat);
    if (!see(c, e[0], e[1], e[2])) return;
    const ax = c.sx - x0;
    const ay = c.sy - y0;
    const nn = place(lon, lat + deg);
    if (!see(c, nn[0], nn[1], nn[2])) return;
    if (Math.abs(ax) + Math.abs(ay) > 4 * c.w) return;
    g.save();
    g.transform(ax, ay, c.sx - x0, c.sy - y0, x0, y0);
    g.globalAlpha = alpha;
    g.drawImage(spr, -1, -1, 2, 2);
    g.restore();
  }

  function surface(g: CanvasRenderingContext2D, c: Cam, t: number): void {
    if (far) lay(g, c, far, "far", FAR_SPAN, FAR_CELLS, near ? SEAM_IN - 2.5 : 0);
    if (near) {
      update(t);
      lay(g, c, near, "near", NEAR_SPAN, NEAR_CELLS);
    }
    g.save();
    g.globalCompositeOperation = "lighter";
    // Lightning inside the storm, where it has not cleared yet.
    for (const f of flashes) {
      const age = t - f.at;
      if (age < 0 || age > 0.32) continue;
      if (clearedAt(f.lon, f.lat) <= t) continue;
      const flick = age < 0.08 ? 1 : age < 0.14 ? 0.3 : age < 0.2 ? 0.8 : 1 - (age - 0.2) / 0.12;
      flat(g, c, bolt, f.lon, f.lat, f.size, 0.6 * flick);
    }
    const wide = clamp(c.focal / 900, 0.6, 2);
    for (const [i, s] of sites.entries()) {
      // Ash and cloud blown out as a pylon sinks through and anchors.
      const age0 = t - s.at;
      if (age0 > 0 && age0 < 1.6) flat(g, c, ember, s.lon, s.lat, 0.4 + 1.6 * ease(age0 / 1.6), 0.3 * (1 - age0 / 1.6));
      // The bloom where its beam pierces the deck.
      const age = t - s.seed;
      if (age > -0.2) {
        const k = clamp((age + 0.2) / 0.5);
        flat(g, c, front, s.lon, s.lat, 0.6 + 1.4 * k + 0.08 * Math.sin(t * 2.3 + i), 0.6 * k * (0.75 + 0.25 * Math.sin(t * 3.1 + i)));
      }
      if (age <= 0) continue;
      // The seeding rings: soft, one after another, slowing as they spread.
      for (let q = 0; q < 3; q++) {
        const ra = age - q * 1.2;
        if (ra <= 0 || ra > 2.4) continue;
        const deg = 0.5 + (SEED_REACH + 0.8) * (1 - Math.exp(-ra / 1.1));
        const a = Math.sin((Math.PI * ra) / 2.4) * (q === 0 ? 0.6 : 0.35);
        if (!ringOn(c, s, deg)) continue;
        g.beginPath();
        g.moveTo(rx[0]!, ry[0]!);
        for (let p = 1; p <= RING; p++) g.lineTo(rx[p]!, ry[p]!);
        for (const [w, rgb, al] of [
          [16, "40 200 150", 0.06],
          [7, "70 230 190", 0.12],
          [2.4, "150 245 225", 0.3],
        ] as const) {
          g.strokeStyle = `rgb(${rgb} / ${(al * a).toFixed(3)})`;
          g.lineWidth = w * wide;
          g.stroke();
        }
      }
    }
    g.restore();
  }

  const index = (lon: number, lat: number) => {
    const x = Math.min(NEAR_PX - 1, Math.max(0, Math.floor(((lon / NEAR_SPAN + 1) / 2) * NEAR_PX)));
    const y = Math.min(NEAR_PX - 1, Math.max(0, Math.floor(((lat / NEAR_SPAN + 1) / 2) * NEAR_PX)));
    return y * NEAR_PX + x;
  };
  function clearedAt(lon: number, lat: number): number {
    if (Math.abs(lon) >= NEAR_SPAN || Math.abs(lat) >= NEAR_SPAN) return Infinity;
    if (made >= NEAR_PX) return Tc[index(lon, lat)]!;
    return Math.min(seedTime(lon, lat, 0), holeTime(lon, lat, 0));
  }
  function fog(lon: number, lat: number, t: number): number {
    if (made >= NEAR_PX && Math.abs(lon) < NEAR_SPAN && Math.abs(lat) < NEAR_SPAN) return clamp(cloudAt(index(lon, lat), t));
    storm(lon, lat, st);
    return t >= clearedAt(lon, lat) ? 0 : st[3]!;
  }

  const progress = (t: number) => smooth(first, last + 3, t);

  return { sites, prepare, surface, fog, clearedAt, progress };
}
