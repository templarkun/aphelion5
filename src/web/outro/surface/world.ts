/**
 * Surface Terraform: the valley (designer 2026-11-19). Where everything stands, and when the water
 * and the wet front (the "tide": the basalt turning wet and mineral-rich; new look 2026-11-21, no
 * plants) reach each place. Looks only.
 *
 * The world is in kilometres: X to the right, Y up (the valley floor is Y = 0), Z away from the
 * camera, which stands HC above the floor on a rise at the valley's near end, looking across it.
 * A point is put into the picture by `project`: x = cx + f·((X − camX)/Z − pan), y = hy + f·(HC − Y)/Z
 * (camX: the camera's slow sideways drift, which gives the layers their parallax; pan and hy: where
 * the picture is pointed). The ground and the boards of rock are painted once (layers.ts) in the
 * same angular units u = X/Z, v = (HC − Y)/Z, so they line up with the spires, the water and the
 * plumes drawn over them each frame.
 */

import { clamp } from "../../briefing/styles/intro2/math3.js";
import { BLOOM_AT, BLOOM_FULL, WATER_AT } from "./timeline.js";

/** The camera's height over the valley floor, km. */
export const HC = 0.35;
/** The storm's cloud deck, km over the floor; HREL over the camera. */
export const CEIL = 4.2;
export const HREL = CEIL - HC;

/** The three spires: where they stand, their length (km, the anchor spike included), how they are turned. Order: the great one, the near one, the far one. */
export interface Spire {
  X: number;
  Z: number;
  L: number;
  spin: number;
}
export const SPIRE_PLACES: Spire[] = [
  { X: 0, Z: 8, L: 2.8, spin: 0.82 },
  { X: 1.15, Z: 4.6, L: 1.5, spin: 0.6 },
  { X: -4.35, Z: 15, L: 2.8, spin: 1.0 },
];
/**
 * Where the far pylons stand, beyond the horizon (designer 2026-11-19, I17): u across the picture
 * (X / Z) and Z, km. Used in this order; 2.0 drops at most twelve pylons, so nine places at most.
 */
export const FAR_PLACES: { u: number; Z: number }[] = [
  { u: -0.6, Z: 58 },
  { u: 0.4, Z: 52 },
  { u: -0.15, Z: 70 },
  { u: 0.72, Z: 64 },
  { u: -0.85, Z: 66 },
  { u: 0.18, Z: 76 },
  { u: -0.4, Z: 80 },
  { u: 0.95, Z: 72 },
  { u: 0.55, Z: 84 },
];
/** How much of a spire is under the rock (a share of its length): the anchor spike and a little more. */
export const BURY = 0.2;

/** Where the sun and the two moons stand in the sky: u across, e above the horizon (in units of the focal length). */
export const SUN_DIR = { u: -0.2, e: 0.27 };
export const MOONS = [
  { u: 0.43, e: 0.56, r: 0.05, rgb: "176 182 190", phase: 0.62 },
  { u: -0.56, e: 0.64, r: 0.02, rgb: "190 182 172", phase: 0.35 },
];

/** A dry canyon bed that fills with water: from a spire's foot, through these points (X, Z). */
export interface StreamDef {
  from: number;
  pts: [number, number][];
  /** Its width, km, at the start and at the end. */
  w0: number;
  w1: number;
  /** When water starts down it, after WATER_AT, and how long it takes to reach its end. */
  delay: number;
  dur: number;
}
export const STREAM_DEFS: StreamDef[] = [
  {
    from: 0,
    pts: [[0.05, 7.7], [0.25, 7.2], [0.6, 6.5], [0.45, 5.6], [-0.1, 4.7], [-0.4, 3.7], [-0.1, 2.9], [0.3, 2.25], [0.18, 1.65], [-0.12, 1.15], [-0.05, 0.7], [0.12, 0.3], [0.2, 0.05]],
    w0: 0.04,
    w1: 0.055,
    delay: 0,
    dur: 2.5,
  },
  { from: 1, pts: [[1.08, 4.35], [0.98, 3.85], [0.82, 3.2], [0.58, 2.6], [0.32, 2.25]], w0: 0.035, w1: 0.05, delay: 0.2, dur: 1.2 },
  { from: 2, pts: [[-4.2, 14.4], [-3.7, 12.8], [-3.0, 11.0], [-2.5, 9.2], [-2.1, 7.4], [-1.75, 5.9], [-1.4, 4.95]], w0: 0.09, w1: 0.11, delay: 0.3, dur: 2.3 },
];
/** Pools and a lake that fill when their stream reaches them. */
export const POOL_DEFS = [
  { X: 0.66, Z: 6.35, r: 0.3, stream: 0 },
  { X: -1.38, Z: 4.85, r: 0.5, stream: 2 },
  { X: 0.3, Z: 2.25, r: 0.16, stream: 0 },
  { X: -0.1, Z: 1.12, r: 0.075, stream: 0 },
];

// ---- A smooth noise field that repeats every N texels: looked up anywhere, cheaply.
const N = 256;
let field: Float32Array | undefined;
function makeField(): Float32Array {
  const f = new Float32Array(N * N);
  let s = 424242;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  // Octaves of value noise on lattices that divide N, so the sum repeats.
  for (const [cells, amp] of [
    [8, 0.5],
    [16, 0.26],
    [32, 0.14],
    [64, 0.07],
    [128, 0.03],
  ] as const) {
    const lat = Float32Array.from({ length: cells * cells }, rnd);
    const step = N / cells;
    for (let y = 0; y < N; y++) {
      const gy = y / step;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      const r0 = (y0 % cells) * cells;
      const r1 = ((y0 + 1) % cells) * cells;
      for (let x = 0; x < N; x++) {
        const gx = x / step;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const c0 = x0 % cells;
        const c1 = (x0 + 1) % cells;
        const a = lat[r0 + c0]! + (lat[r0 + c1]! - lat[r0 + c0]!) * sx;
        const b = lat[r1 + c0]! + (lat[r1 + c1]! - lat[r1 + c0]!) * sx;
        f[y * N + x] = f[y * N + x]! + (a + (b - a) * sy) * amp;
      }
    }
  }
  return f;
}
/** Noise 0..1 (about 0.5 on average) at (x, y) in texels; one feature is about 16-32 texels across. */
export function nf(x: number, y: number): number {
  const f = (field ??= makeField());
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const ax = x - fx;
  const ay = y - fy;
  const x0 = fx & (N - 1);
  const y0 = fy & (N - 1);
  const x1 = (x0 + 1) & (N - 1);
  const y1 = (y0 + 1) & (N - 1);
  const a = f[y0 * N + x0]!;
  const b = f[y0 * N + x1]!;
  const c = f[y1 * N + x0]!;
  const d = f[y1 * N + x1]!;
  return a + (b - a) * ax + (c - a + (d - c - b + a) * ax) * ay;
}

// ---- The streams, sampled densely along a smooth curve through their points.
export interface StreamPath {
  def: StreamDef;
  /** Samples: X, Z, distance along from the start (km), and the way across (unit, in the ground). */
  x: Float64Array;
  z: Float64Array;
  s: Float64Array;
  nx: Float64Array;
  nz: Float64Array;
  length: number;
}
function catmull(p: [number, number][], per: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(0, i - 1)]!;
    const b = p[i]!;
    const c = p[i + 1]!;
    const d = p[Math.min(p.length - 1, i + 2)]!;
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (q: number, r: number, s: number, u: number) => 0.5 * (2 * r + (-q + s) * t + (2 * q - 5 * r + 4 * s - u) * t2 + (-q + 3 * r - 3 * s + u) * t3);
      out.push([f(a[0], b[0], c[0], d[0]), f(a[1], b[1], c[1], d[1])]);
    }
  }
  out.push(p[p.length - 1]!);
  return out;
}
let paths: StreamPath[] | undefined;
export function streamPaths(): StreamPath[] {
  return (paths ??= STREAM_DEFS.map((def) => {
    const sp = SPIRE_PLACES[def.from]!;
    const pts = catmull([[sp.X, sp.Z], ...def.pts], 10);
    const n = pts.length;
    const x = new Float64Array(n);
    const z = new Float64Array(n);
    const s = new Float64Array(n);
    const nx = new Float64Array(n);
    const nz = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = pts[i]![0];
      z[i] = pts[i]![1];
      if (i) s[i] = s[i - 1]! + Math.hypot(x[i]! - x[i - 1]!, z[i]! - z[i - 1]!);
    }
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      const dx = x[b]! - x[a]!;
      const dz = z[b]! - z[a]!;
      const l = Math.hypot(dx, dz) || 1;
      nx[i] = -dz / l;
      nz[i] = dx / l;
    }
    return { def, x, z, s, nx, nz, length: s[n - 1]! };
  }));
}

/** When the water reaches distance d (km) along stream k. */
export function waterAt(k: number, d: number): number {
  const p = streamPaths()[k]!;
  return WATER_AT + p.def.delay + p.def.dur * Math.pow(clamp(d / p.length), 0.8);
}
/** How far along stream k the water has come by time t, km. */
export function waterReach(k: number, t: number): number {
  const p = streamPaths()[k]!;
  const u = clamp((t - WATER_AT - p.def.delay) / p.def.dur);
  return p.length * Math.pow(u, 1 / 0.8);
}
/** When a pool starts to fill: its stream's water reaches the sample nearest to it. */
export function poolAt(i: number): number {
  const pd = POOL_DEFS[i]!;
  const p = streamPaths()[pd.stream]!;
  let best = 0;
  let bd = Infinity;
  for (let k = 0; k < p.x.length; k++) {
    const d = Math.hypot(p.x[k]! - pd.X, p.z[k]! - pd.Z);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return waterAt(pd.stream, p.s[best]!);
}

/** The wet front ("bloom" in the names): how fast it spreads from each spire's foot (km/s), and how much later it starts there. */
const TIDE = [
  { sp: 2.3, after: 0 },
  { sp: 2.1, after: 0.25 },
  { sp: 4.6, after: 0.4 },
];
/** Along the streams the rock turns wet soon after the water comes (s), and the wet spreads out from the banks this fast (km/s). */
const BANK_AFTER = 0.3;
const BANK_SP = 1.5;

/**
 * When the wet front reaches the ground at (X, Z): the soonest of the spires' own fronts and the
 * banks of the water, made uneven by the noise, and never later than BLOOM_FULL.
 */
export function bloomAt(X: number, Z: number): number {
  let a = Infinity;
  for (let i = 0; i < SPIRE_PLACES.length; i++) {
    const s = SPIRE_PLACES[i]!;
    const d = Math.hypot(X - s.X, (Z - s.Z) * 0.85);
    a = Math.min(a, BLOOM_AT + TIDE[i]!.after + d / TIDE[i]!.sp);
  }
  const ps = streamPaths();
  for (let k = 0; k < ps.length; k++) {
    const p = ps[k]!;
    // Every fourth sample is near enough.
    for (let j = 0; j < p.x.length; j += 4) {
      const d = Math.hypot(X - p.x[j]!, Z - p.z[j]!);
      if (d > 2.2) continue;
      a = Math.min(a, waterAt(k, p.s[j]!) + BANK_AFTER + d / BANK_SP);
    }
  }
  // Uneven fingers of wet ground.
  const n = nf(X * 9 + 31, Z * 5 + 7);
  const m = nf(X * 30 + 3, Z * 18 + 90);
  a += (n - 0.5) * 1.3 + (m - 0.5) * 0.45;
  return Math.max(BLOOM_AT, Math.min(a, BLOOM_FULL - 0.25 + 0.3 * n));
}

/** The picture's projection for one frame. */
export interface View {
  w: number;
  h: number;
  /** Focal length, px. */
  f: number;
  cx: number;
  /** The horizon's height in the picture, px. */
  hy: number;
  camX: number;
  pan: number;
}
/** The point (X, Y, Z) in the picture: [x, y]; Z must be > 0. */
export function project(v: View, X: number, Y: number, Z: number, out: [number, number]): [number, number] {
  out[0] = v.cx + v.f * ((X - v.camX) / Z - v.pan);
  out[1] = v.hy + (v.f * (HC - Y)) / Z;
  return out;
}
