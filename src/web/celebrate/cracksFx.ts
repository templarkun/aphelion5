/**
 * Cracks in a dying Omega unit (designer 2026-11-20: the old ones looked like plain SVG lines; two
 * styles, one per kill). A crack is a tapered wedge, wide where it starts and sharp at its tip, with
 * finer branches; light (energy) shows through it with particles (designer: energy is drawn with
 * particles).
 *
 * - `fractureLight` (Alpha Down): thin violet fractures with a dark split edge, a soft bloom along
 *   them, a bright point running at each growing tip, motes of light leaking out and drifting up.
 * - `moltenFlow` (Beta Breach, designer 2026-11-20 round 5: the molten fissures looked too static and
 *   fixed, "more fluid particles, less stiff"): no drawn shapes at all. Streams of molten particles ooze
 *   out of a churning pool in its middle along ways that bend with a slow flow field (they keep
 *   creeping and swaying while they grow), the particles stream outwards along them, each front is a
 *   swelling bulb of white-hot droplets, streams split as they go; a soft charred trail under them;
 *   embers spat out.
 *
 * Everything is worked out from the time alone. Screen only: nothing here is a rule.
 */

import type { Graphics } from "pixi.js";
import { easeOut } from "../anim.js";
import { mixColour, noise3 } from "../noise.js";
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

/** One molten stream of Beta Breach: a main one from the pool, or a branch off a main one. */
interface Stream {
  /** Its way out (radians) from the pool; a branch: how far it turns off its main stream's way. */
  a: number;
  /** How far it reaches when fully grown (tile radii). */
  reach: number;
  /** Width where it starts (tile radii). */
  w: number;
  /** When it starts to flow (0-1 of the growth); a branch: where along its main stream it splits off (0-1). */
  at: number;
  /** The main stream it splits off (-1 for a main stream). */
  parent: number;
  seed: number;
}
const FLOW_STEPS = 16;
const POOL: readonly [number, number] = [0.04, 0.02];
const STREAMS: Stream[] = (() => {
  const r = seq(5521);
  const out: Stream[] = [];
  const N = 7;
  for (let i = 0; i < N; i++) out.push({ a: (i / N) * Math.PI * 2 + r() * 0.5, reach: 0.74 + r() * 0.18, w: 0.075 + r() * 0.03, at: i * 0.045 + r() * 0.05, parent: -1, seed: 3 + r() * 40 });
  for (let i = 0; i < N; i++) {
    const nb = r() < 0.55 ? 2 : 1;
    for (let b = 0; b < nb; b++) {
      const side = (b === 0) === r() < 0.5 ? -1 : 1;
      out.push({ a: side * (0.55 + r() * 0.45), reach: 0.26 + r() * 0.2, w: 0.045 + r() * 0.015, at: 0.28 + r() * 0.42, parent: i, seed: 60 + r() * 40 });
    }
  }
  return out;
})();

/** A way traced through the slow flow field from (x, y): it bends with the noise, always pulled back towards its first way, inside the tile. */
function trace(x: number, y: number, ang: number, reach: number, seed: number, t: number, steps: number): [number, number][] {
  const pts: [number, number][] = [[x, y]];
  const st = reach / steps;
  let a = ang;
  for (let k = 0; k < steps; k++) {
    const [px, py] = pts[pts.length - 1]!;
    a += noise3(px * 2.3 + seed, py * 2.3 - seed, t * 0.6 + seed * 0.37) * 0.6;
    a += (ang - a) * 0.2;
    let nx = px + Math.cos(a) * st;
    let ny = py + Math.sin(a) * st;
    const d = Math.hypot(nx, ny);
    if (d > 0.9) {
      nx *= 0.9 / d;
      ny *= 0.9 / d;
    }
    pts.push([nx, ny]);
  }
  return pts;
}

/** A stream as it is at time t with the growth `grow` (0-1): its whole way (tile radii), widths, how much of it has flowed (0-1). */
export interface Flow {
  pts: [number, number][];
  w: number[];
  len: number;
  depth: number;
  growing: boolean;
}

/** Beta Breach's streams at time t (s) and growth `grow` (0-1): the same for the same t and grow; their ways creep as t goes on. */
export function betaFlows(grow: number, t: number): Flow[] {
  const main: (Flow | undefined)[] = [];
  const out: Flow[] = [];
  for (const s of STREAMS) {
    let x0 = POOL[0];
    let y0 = POOL[1];
    let ang = s.a;
    let len: number;
    let depth = 0;
    if (s.parent < 0) {
      len = easeOut(Math.max(0, Math.min(1, (grow - s.at) / (1 - s.at))));
    } else {
      const p = main[s.parent];
      if (!p || p.len <= s.at) continue;
      const i = Math.min(FLOW_STEPS - 1, Math.floor(s.at * FLOW_STEPS));
      [x0, y0] = p.pts[i]!;
      const [qx, qy] = p.pts[i + 1]!;
      ang = Math.atan2(qy - y0, qx - x0) + s.a;
      len = easeOut(Math.min(1, (p.len - s.at) / Math.max(0.2, 1 - s.at)));
      depth = 1;
    }
    const steps = depth ? FLOW_STEPS / 2 : FLOW_STEPS;
    const pts = len > 0 ? trace(x0, y0, ang, s.reach, s.seed, t, steps) : [[x0, y0] as [number, number]];
    const w = pts.map((_, k) => s.w * (1 - 0.7 * (k / steps)));
    const f: Flow = { pts, w, len, depth, growing: len > 0 && len < 1 };
    if (s.parent < 0) main.push(f);
    if (len > 0) out.push(f);
  }
  return out;
}

/** The point, the way (radians) and the width at fraction u (0-1) of a stream's whole way. */
function at(f: Flow, u: number): { x: number; y: number; dir: number; w: number } {
  const n = f.pts.length - 1;
  const i = Math.min(n - 1, Math.floor(u * n));
  const k = u * n - i;
  const a = f.pts[i]!;
  const b = f.pts[i + 1]!;
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, dir: Math.atan2(b[1] - a[1], b[0] - a[0]), w: f.w[i]! + (f.w[i + 1]! - f.w[i]!) * k };
}

/** Molten colour by temperature (0 dull red ... 1 white-hot). */
function lava(temp: number): number {
  const k = Math.max(0, Math.min(1, temp));
  if (k < 0.4) return mixColour(0xc0200c, 0xff6a14, k / 0.4);
  if (k < 0.75) return mixColour(0xff6a14, 0xffc45a, (k - 0.4) / 0.35);
  return mixColour(0xffc45a, 0xfff6e8, (k - 0.75) / 0.25);
}

/** Embers spat out of the streams: which stream, where along it, how often, how they fly. */
const EMBERS = (() => {
  const r = seq(8819);
  return Array.from({ length: 70 }, () => ({ s: r(), u: 0.1 + r() * 0.85, period: 0.4 + r() * 0.5, ph: r(), ang: r() * Math.PI * 2, speed: 0.6 + r() * 1.2, size: 0.5 + r(), hot: r() < 0.4, sway: r() * 6.28 }));
})();
/** Particles churning in the pool in its middle. */
const CHURN = (() => {
  const r = seq(7243);
  return Array.from({ length: 16 }, (_, i) => ({ a: (i / 16) * Math.PI * 2, spin: 0.8 + r() * 1.4, rad: 0.4 + r() * 0.6, size: 0.6 + r() * 0.6, seed: r() * 30 }));
})();

/** Beta Breach's molten streams (no shapes, only particles and a soft charred trail). `heat` (0-1) how far the core has heated (whiter, wider, brighter). */
export function moltenFlow(d: CrackDraw & { heat: number }): void {
  const { under, motes: m, grow, t, x, y, r, heat } = d;
  const boost = d.boost ?? 0;
  const pulse = 0.85 + 0.15 * Math.sin(t * 11) + 0.35 * boost;
  const flows = betaFlows(grow, t);
  const swell = 0.8 + 0.3 * heat + 0.2 * boost;
  const P = (u: { x: number; y: number }) => [x + u.x * r, y + u.y * r] as const;

  // The pool in its middle: a churning knot of molten droplets, bigger as it fills.
  if (grow > 0) {
    const g = Math.min(1, grow * 2.5);
    const [cx, cy] = [x + POOL[0] * r, y + POOL[1] * r];
    under.circle(cx, cy, r * 0.22 * g).fill({ color: 0x1a0700, alpha: 0.35 });
    m.dot(cx, cy, r * (0.7 + 0.25 * heat) * g, 0xc0200c, 0.12 * pulse);
    for (const c of CHURN) {
      const a = c.a + t * c.spin;
      const rr = r * (0.04 + 0.11 * g) * c.rad * (0.75 + 0.5 * noise3(c.seed, t * 1.5, 0.5));
      m.dot(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, r * 0.16 * c.size * g * swell, lava(0.45 + 0.4 * heat + 0.2 * boost), 0.6, 1.6, a + Math.PI / 2);
    }
  }

  flows.forEach((f, fi) => {
    const main = f.depth === 0;
    const steps = f.pts.length - 1;
    const w = (u: number) => at(f, u).w * swell;
    // A soft charred trail under the stream.
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      if (u > f.len) break;
      const p = at(f, Math.min(u, f.len));
      const [px, py] = P(p);
      // (half steps too, so the trail is smooth, not beaded)
      for (const h of k < steps ? [0, 0.5] : [0]) {
        const v = Math.min((k + h) / steps, f.len);
        const q = at(f, v);
        const [qx, qy] = P(q);
        under.circle(qx, qy, w(v) * r * 1.9).fill({ color: 0x1a0700, alpha: 0.11 });
        under.circle(qx, qy, w(v) * r * 1.15).fill({ color: 0x120400, alpha: 0.2 });
      }
      // A dull red glow round it and a hot thread through it.
      m.dot(px, py, w(u) * r * 3.2, 0xc0200c, (main ? 0.12 : 0.09) * pulse);
      m.dot(px, py, w(u) * r * 0.95, lava(0.35 + 0.3 * heat + 0.2 * (1 - u)), 0.4, 2.4, p.dir);
    }
    // Molten particles streaming outwards along it, churning a little from side to side.
    const M = main ? 34 : 16;
    const speed = main ? 0.85 : 1.1;
    for (let j = 0; j < M; j++) {
      const u = (j / M + t * speed + fi * 0.137) % 1;
      if (u > f.len) continue;
      const p = at(f, u);
      const side = Math.sin(t * 9 + j * 1.7 + fi) * p.w * 0.35;
      const [px, py] = P({ x: p.x - Math.sin(p.dir) * side, y: p.y + Math.cos(p.dir) * side });
      const head = Math.max(0, 1 - (f.len - u) / 0.15);
      m.dot(px, py, w(u) * r * (1.4 + 0.4 * Math.sin(j * 2.3 + t * 7)), lava(0.2 + 0.3 * heat + 0.5 * head + 0.2 * boost), 0.55, 2.3, p.dir);
    }
    // The front: a swelling bulb of white-hot droplets, a few drops running ahead of it.
    if (f.growing) {
      const p = at(f, f.len);
      const [hx, hy] = P(p);
      const bulb = (main ? 0.12 : 0.08) * r * (1 + 0.15 * Math.sin(t * 13 + fi));
      m.dot(hx, hy, bulb * 2.6, 0xff6a14, 0.25);
      for (let k = 0; k < 4; k++) {
        const a = t * 5 + k * 1.57 + fi;
        m.dot(hx + Math.cos(a) * bulb * 0.35, hy + Math.sin(a) * bulb * 0.35, bulb * (1.1 - 0.15 * k), k ? 0xffb04a : 0xfff2d8, 0.75);
      }
      for (let k = 1; k <= 2; k++) {
        const ahead = ((t * 2.2 + k * 0.5 + fi * 0.3) % 1) * r * 0.09 * k;
        const fl = 0.5 + 0.5 * Math.sin(t * 21 + k * 3 + fi);
        m.dot(hx + Math.cos(p.dir) * ahead, hy + Math.sin(p.dir) * ahead, bulb * 0.45, 0xffe2a8, 0.8 * fl);
      }
    } else if (f.len >= 1) {
      // A fully grown stream pools at its end, glowing and throbbing.
      const p = at(f, 1);
      const [hx, hy] = P(p);
      m.dot(hx, hy, r * (main ? 0.2 : 0.13) * pulse, lava(0.6 + 0.3 * heat), 0.6);
    }
  });

  // Embers spat out of the streams again and again, arcing, swaying and falling.
  if (!flows.length) return;
  for (const [i, e] of EMBERS.entries()) {
    const f = flows[Math.floor(e.s * flows.length)]!;
    if (f.len < e.u) continue;
    const u = (t / e.period + e.ph) % 1;
    const [bx, by] = P(at(f, e.u));
    const s = e.speed * r * (0.8 + 0.6 * boost);
    const tt = u * e.period;
    const px = bx + Math.cos(e.ang) * s * tt + Math.sin(t * 5 + e.sway) * r * 0.04 * u;
    const py = by + Math.sin(e.ang) * s * tt - 1.2 * r * tt + 2.4 * r * tt * tt;
    const vx = Math.cos(e.ang) * s;
    const vy = Math.sin(e.ang) * s - 1.2 * r + 4.8 * r * tt;
    m.dot(px, py, r * 0.05 * e.size, e.hot || i % 4 === 0 ? 0xffe2a8 : 0xff8a2a, (1 - u) * (0.9 + 0.3 * boost), 2.2, Math.atan2(vy, vx));
  }
}
