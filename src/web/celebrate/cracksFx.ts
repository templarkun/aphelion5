/**
 * Cracks in a dying Omega unit (designer 2026-11-20: the old ones looked like plain SVG lines; two
 * styles, one per kill). A crack is a tapered wedge, wide where it starts and sharp at its tip, with
 * finer branches; light (energy) shows through it with particles (designer: energy is drawn with
 * particles).
 *
 * - `fractureLight` (Alpha Down): thin violet fractures with a dark split edge, a soft bloom along
 *   them, a bright point running at each growing tip, motes of light leaking out and drifting up.
 * - `moltenFissures` (Beta Breach): wider, rougher fissures, charred at the edge, deep red to orange
 *   to white-hot inside, glowing knots where they fork, pulsing with the heat; embers spit out of them.
 *
 * Everything is worked out from the time alone. Screen only: nothing here is a rule.
 */

import type { Graphics } from "pixi.js";
import { easeOut } from "../anim.js";
import { type Motes, seq } from "./closeup.js";

/** One crack: points in tile radii from the tile's middle, its width (tile radii) at each, when it starts to grow (0-1). */
export interface Crack {
  pts: [number, number][];
  w: number[];
  at: number;
  /** 0 a main crack, 1 a branch, 2 a twig. */
  depth: number;
}

export interface CrackShape {
  /** Main cracks. */
  n: number;
  /** Where they start (tile radii). */
  origin: readonly [number, number];
  /** How far a main crack reaches, from to (tile radii). */
  reach: readonly [number, number];
  /** Step between points, from to (tile radii). */
  step: readonly [number, number];
  /** How much the way turns at each step (radians). */
  wander: number;
  /** Width at the start (tile radii). */
  width: number;
  /** Chance of a branch at each point of a main crack (and half as much on a branch). */
  fork: number;
}

/** A set of cracks, the same for the same seed. */
export function crackTree(seed: number, s: CrackShape): Crack[] {
  const rnd = seq(seed);
  const out: Crack[] = [];
  const grow = (x: number, y: number, ang: number, reach: number, w0: number, at: number, depth: number) => {
    const pts: [number, number][] = [[x, y]];
    let len = 0;
    let a = ang;
    while (len < reach) {
      const st = Math.min(reach - len, s.step[0] + rnd() * (s.step[1] - s.step[0]));
      len += st;
      a += (rnd() - 0.5) * s.wander;
      const [px, py] = pts[pts.length - 1]!;
      const nx = px + Math.cos(a) * st;
      const ny = py + Math.sin(a) * st;
      // Never past the tile's edge.
      if (Math.hypot(nx, ny) > 0.93) break;
      pts.push([nx, ny]);
    }
    if (pts.length < 2) return;
    const w = pts.map((_, i) => w0 * (1 - 0.88 * (i / (pts.length - 1))) ** 1.2);
    out.push({ pts, w, at, depth });
    if (depth >= 2) return;
    for (let i = 1; i < pts.length - 1; i++) {
      if (rnd() > s.fork * (depth === 0 ? 1 : 0.5)) continue;
      const side = rnd() < 0.5 ? -1 : 1;
      const [px, py] = pts[i]!;
      const [qx, qy] = pts[i + 1]!;
      const dir = Math.atan2(qy - py, qx - px) + side * (0.5 + rnd() * 0.6);
      const along = i / (pts.length - 1);
      grow(px, py, dir, reach * (0.25 + rnd() * 0.25), w[i]! * 0.7, at + (1 - at) * along * 0.75, depth + 1);
    }
  };
  for (let i = 0; i < s.n; i++) {
    const a = (i / s.n) * Math.PI * 2 + rnd() * 0.6;
    grow(s.origin[0], s.origin[1], a, s.reach[0] + rnd() * (s.reach[1] - s.reach[0]), s.width * (0.75 + 0.5 * rnd()), i * 0.035, 0);
  }
  return out;
}

/** A crack grown to `grow` (0-1 of the whole set's growth), in pixels: its points, widths and whether it is still growing. */
function grown(c: Crack, grow: number, x0: number, y0: number, r: number): { pts: [number, number][]; w: number[]; growing: boolean } | undefined {
  const f = Math.max(0, Math.min(1, (grow - c.at) / (1 - c.at)));
  if (f <= 0) return undefined;
  const P = c.pts.map(([x, y]) => [x0 + x * r, y0 + y * r] as [number, number]);
  const lens = P.slice(1).map((p, i) => Math.hypot(p[0] - P[i]![0], p[1] - P[i]![1]));
  let left = easeOut(f) * lens.reduce((a, x) => a + x, 0);
  const pts: [number, number][] = [P[0]!];
  const w: number[] = [c.w[0]! * r];
  for (let i = 0; i < lens.length && left > 0; i++) {
    const take = Math.min(1, left / lens[i]!);
    const a = P[i]!;
    const b = P[i + 1]!;
    pts.push([a[0] + (b[0] - a[0]) * take, a[1] + (b[1] - a[1]) * take]);
    w.push((c.w[i]! + (c.w[i + 1]! - c.w[i]!) * take) * r);
    left -= lens[i]!;
  }
  // While it grows its tip is sharp.
  if (f < 1) w[w.length - 1] = 0;
  return { pts, w, growing: f < 1 };
}

/** A tapered wedge along the points, `k` times their widths. */
function wedge(g: Graphics, pts: [number, number][], w: number[], k: number, color: number, alpha: number): void {
  if (pts.length < 2 || alpha < 0.01) return;
  const L: [number, number][] = [];
  const R: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    const h = (w[i]! * k) / 2;
    const [x, y] = pts[i]!;
    L.push([x - (dy / d) * h, y + (dx / d) * h]);
    R.push([x + (dy / d) * h, y - (dx / d) * h]);
  }
  g.poly([...L, ...R.reverse()].flat()).fill({ color, alpha });
}

/** A point at fraction u (0-1) along a path. */
function along(pts: [number, number][], u: number): [number, number] {
  const i = Math.min(pts.length - 2, Math.floor(u * (pts.length - 1)));
  const f = u * (pts.length - 1) - i;
  const a = pts[i]!;
  const b = pts[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

export interface CrackDraw {
  /** Dark things (drawn normally, over the tile). */
  under: Graphics;
  /** Light (drawn additively). */
  light: Graphics;
  motes: Motes;
  /** The cracks' growth (0-1), time (s), the tile's middle and radius on the screen. */
  grow: number;
  t: number;
  x: number;
  y: number;
  r: number;
  /** Extra brightness (0-1): a surge, the flare before the burst. */
  boost?: number;
}

const ALPHA_SHAPE: CrackShape = { n: 6, origin: [0.1, -0.06], reach: [0.75, 0.9], step: [0.06, 0.11], wander: 0.75, width: 0.05, fork: 0.22 };
const ALPHA_CRACKS = crackTree(9137, ALPHA_SHAPE);
/** Motes leaking out of Alpha's cracks: which crack, where along it, when (after it reaches there), how they drift. */
const LEAK = (() => {
  const r = seq(3307);
  return Array.from({ length: 80 }, () => ({ c: Math.floor(r() * ALPHA_CRACKS.length), u: 0.15 + r() * 0.85, delay: r() * 0.7, life: 0.45 + r() * 0.6, dx: (r() - 0.5) * 0.5, up: 0.25 + r() * 0.45, size: 0.5 + r(), ph: r() * 6.28 }));
})();

/** Alpha Down's cracks: violet light through thin fractures. */
export function fractureLight(d: CrackDraw): void {
  const { under, light, motes: m, grow, t, x, y, r } = d;
  const boost = d.boost ?? 0;
  const VIOLET = 0x9b6bd6;
  const LILAC = 0xc9a6ff;
  const PALE = 0xf3e8ff;
  const shown = ALPHA_CRACKS.map((c) => grown(c, grow, x, y, r));
  shown.forEach((g, i) => {
    if (!g) return;
    const depth = ALPHA_CRACKS[i]!.depth;
    // The split: a dark edge either side, then the light inside it.
    wedge(under, g.pts, g.w, 2.8, 0x12061c, 0.72);
    wedge(light, g.pts, g.w, 1.6, VIOLET, 0.45 + 0.3 * boost);
    wedge(light, g.pts, g.w, 0.9, LILAC, 0.95);
    wedge(light, g.pts, g.w, 0.32, depth ? PALE : 0xffffff, 0.95);
    // A soft bloom along the main cracks.
    if (depth === 0) {
      for (let j = 1; j < g.pts.length; j += 2) {
        const [px, py] = g.pts[j]!;
        m.dot(px, py, r * (0.32 + 0.2 * boost) * (g.w[j]! / r / 0.05 + 0.4), VIOLET, 0.16 + 0.12 * boost);
      }
    }
    // A bright point runs at the growing tip.
    if (g.growing) {
      const [px, py] = g.pts[g.pts.length - 1]!;
      m.dot(px, py, r * (depth ? 0.08 : 0.12), 0xffffff, 0.95);
      m.dot(px, py, r * 0.24, LILAC, 0.3);
    }
  });
  // Motes of light leak out of the cracks and drift up, flickering.
  for (const [i, p] of LEAK.entries()) {
    const c = ALPHA_CRACKS[p.c]!;
    const g = shown[p.c];
    if (!g) continue;
    const reached = c.at + (1 - c.at) * p.u;
    const age = (grow - reached) * 1.2 - p.delay * 0.4;
    const life = p.life;
    const a0 = age / life;
    if (a0 <= 0) continue;
    const u = a0 % 1;
    const full = c.pts.map(([px, py]) => [x + px * r, y + py * r] as [number, number]);
    const [bx, by] = along(full, p.u);
    const px = bx + p.dx * r * u + Math.sin(t * 6 + p.ph) * r * 0.03;
    const py = by - p.up * r * u;
    const fl = 0.6 + 0.4 * Math.sin(t * 23 + i);
    m.dot(px, py, r * 0.06 * p.size, i % 3 ? LILAC : 0xffffff, Math.sin(Math.PI * u) * fl * (0.8 + 0.4 * boost));
  }
}

const BETA_SHAPE: CrackShape = { n: 7, origin: [0.04, 0.02], reach: [0.78, 0.95], step: [0.05, 0.09], wander: 0.62, width: 0.1, fork: 0.26 };
const BETA_CRACKS = crackTree(5521, BETA_SHAPE);
/** Embers spat out of Beta's fissures: which crack, where along it, how often, how they fly. */
const EMBERS = (() => {
  const r = seq(8819);
  return Array.from({ length: 90 }, () => ({ c: Math.floor(r() * BETA_CRACKS.length), u: 0.1 + r() * 0.9, period: 0.35 + r() * 0.5, ph: r(), ang: r() * Math.PI * 2, speed: 0.7 + r() * 1.3, size: 0.5 + r(), hot: r() < 0.4 }));
})();

/** Beta Breach's cracks: molten fissures. `heat` (0-1) how far the core has heated (whiter, brighter). */
export function moltenFissures(d: CrackDraw & { heat: number }): void {
  const { under, light, motes: m, grow, t, x, y, r, heat } = d;
  const boost = d.boost ?? 0;
  const pulse = 0.85 + 0.15 * Math.sin(t * 11) + 0.35 * boost;
  const shown = BETA_CRACKS.map((c) => grown(c, grow, x, y, r));
  shown.forEach((g, i) => {
    if (!g) return;
    const depth = BETA_CRACKS[i]!.depth;
    // Charred edge, then deep red, orange, white-hot inside.
    wedge(under, g.pts, g.w, 2.6, 0x1a0700, 0.7);
    wedge(light, g.pts, g.w, 1.7, 0xc0200c, 0.55 * pulse);
    wedge(light, g.pts, g.w, 1.05, 0xff7a1e, 0.85 * pulse);
    wedge(light, g.pts, g.w, 0.45, heat > 0.6 ? 0xffffff : 0xffd27a, 0.9);
    // A heat haze along the main fissures.
    if (depth === 0) {
      for (let j = 1; j < g.pts.length; j += 3) {
        const [px, py] = g.pts[j]!;
        m.dot(px, py, r * (0.3 + 0.15 * heat), 0xff5a1a, (0.14 + 0.1 * boost) * pulse);
      }
    }
    // A glowing knot where a branch forks off, and at a growing tip.
    if (depth > 0) {
      const [px, py] = g.pts[0]!;
      m.dot(px, py, r * 0.14 * pulse, 0xffe2a8, 0.85);
    }
    if (g.growing) {
      const [px, py] = g.pts[g.pts.length - 1]!;
      m.dot(px, py, r * 0.12, 0xffffff, 0.9);
    }
  });
  // Embers spit out of the fissures again and again, arcing and falling.
  for (const [i, e] of EMBERS.entries()) {
    const c = BETA_CRACKS[e.c]!;
    if (!shown[e.c] || grow < c.at + (1 - c.at) * e.u) continue;
    const u = (t / e.period + e.ph) % 1;
    const full = c.pts.map(([px, py]) => [x + px * r, y + py * r] as [number, number]);
    const [bx, by] = along(full, e.u);
    const s = e.speed * r * (0.8 + 0.6 * boost);
    const tt = u * e.period;
    const px = bx + Math.cos(e.ang) * s * tt;
    const py = by + Math.sin(e.ang) * s * tt - 1.2 * r * tt + 2.4 * r * tt * tt;
    const vx = Math.cos(e.ang) * s;
    const vy = Math.sin(e.ang) * s - 1.2 * r + 4.8 * r * tt;
    m.dot(px, py, r * 0.05 * e.size, e.hot || i % 4 === 0 ? 0xffe2a8 : 0xff8a2a, (1 - u) * (0.9 + 0.3 * boost), 2.2, Math.atan2(vy, vx));
  }
}
