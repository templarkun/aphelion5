/**
 * Dimensional Shatter, the third kill for Gamma (designer 2026-11-21): the flat tile stops being a flat
 * tile. 8.0 s in four acts (SHATTER in timeline.ts):
 *
 * 1. Reactor criticality (0-2.2): a frozen moment on the killing blow (0.2 s, nothing moves), then the zoom
 *    and the board tilts back into 3D (tilt.ts) under a tremor that grows faster and harder
 *    (`shakeOffset`). Crimson and white-hot plasma fractures spread from the middle of the tile to its six
 *    edges with rays of light leaking up out of them; motes and loose chips of the sectors round it are
 *    pulled in to a tiny collapsing singularity in its core.
 * 2. Slow-motion shatter (2.2-4.8): the tile bursts upwards into 28-36 shards (a Voronoi breakage, the same
 *    every time; the fractures were its edges), dark glass with dying circuitry on top and glowing broken
 *    faces, each a solid that tumbles in perspective, rim-lit by the core. Time slows almost to a stop
 *    (`timeDilation`, `shardTime`): the shards and sparks hang at the top of the blast while arcs of plasma
 *    jump between them, and a rift into dark space tears open under them and pulses.
 * 3. Shock wave (4.8-6.6): time snaps back: the core implodes into a blinding white-gold flash, the shards are
 *    blasted away and burn up; a searing white-cyan ring, then a distortion wave in split colours (it lifts
 *    the sectors as it passes) run across the whole Field; each sector's edge flares as the first reaches it
 *    and turns from threat crimson to the cleared colour.
 * 4. Purified (6.6-8.0): a smouldering crater, golden-cyan embers rising, telemetry ticks "TARGET
 *    NEUTRALIZED // SECTOR CLEAR"; the board turns flat as the zoom eases back and the glow settles.
 *
 * Reduced motion or Instant: 2 s of light only, a flash of the plasma core and a clean liberation wave over
 * the hexes, ring by ring (no shake, nothing flying). A slow machine draws fewer particles, never slower.
 * The same colours for every Company (I25). Energy is drawn with particles (designer's standing taste).
 * Every moving thing is worked out from the time alone. Screen only: nothing here is a rule.
 */

import { Graphics, Text } from "pixi.js";
import type { Step } from "../anim.js";
import { easeInOut, easeOut } from "../anim.js";
import { playBossCoreCritical, playCataclysmShockwave, playDimensionalRift, playSectorPurified, playSlowMoShatter } from "../briefing/soundHooks.js";
import { mixColour as mix } from "../noise.js";
import { type Frame, type KillEnv, type KillTarget, type Motes, bolt, closeupStep, flat, glowSprite, hexCorners, motes, seq, strokePath } from "./closeup.js";
import { boardHex, drawSlots, hexDist, project, tiltBoard } from "./tilt.js";
import { SHATTER as T, shardTime, span, timeDilation } from "./timeline.js";

const CRIMSON = 0xff2847;
const DEEP = 0x8a0b22;
const EMBER = 0xff6a2a;
const HOT = 0xffe6c4;
const MAGENTA = 0xff3d9a;
const VIOLET = 0x9b6bd6;
const OBSIDIAN = 0x0a0710;
/** The cleared colour: the same for every Company (I25), Mission Complete's energy. */
const CLEAR = 0x5cd6ff;
const ICE = 0xe4fbff;
const GOLD = 0xffcf6a;
/** How far the board tilts back (radians: 54°). */
const THETA = (54 * Math.PI) / 180;
/** The fewest particles a slow machine draws (a share of them all). */
const MIN_QUALITY = 0.45;

// ---------------------------------------------------------------------------------------------------
// Time

/** The screen's shake at time t, in unit radii (the killing blow held still, the tremor, the blasts). */
export function shakeOffset(t: number): readonly [number, number] {
  if (t < T.hitStop[1]) return [0.018, -0.012];
  let a = 0;
  let ph = 0;
  if (t < T.shatter) {
    const u = (t - T.hitStop[1]) / (T.shatter - T.hitStop[1]);
    a = 0.004 + 0.045 * u ** 2.4;
    const s = t - T.hitStop[1];
    ph = 2 * Math.PI * (8 * s + 7 * s * s);
  } else if (t < T.blast) {
    const tau = shardTime(t);
    a = 0.07 * Math.exp(-tau / 0.03) + 0.006 * riftPulse(t) * span(t, T.rift);
    ph = 2 * Math.PI * 31 * tau + t * 23;
  } else {
    a = 0.11 * Math.exp(-(t - T.blast) / 0.22) + 0.008 * (1 - span(t, [T.blast, 6.2]));
    ph = 2 * Math.PI * 27 * t;
  }
  return [(a * (Math.sin(ph) + 0.6 * Math.sin(1.7 * ph + 1.3))) / 1.6, (a * (Math.cos(1.13 * ph + 0.4) + 0.5 * Math.sin(2.3 * ph))) / 1.5];
}

/** The reactor's heartbeat in act 1 (0-1, a sharp beat that comes faster as it goes critical). */
function heartbeat(t: number): number {
  const s = Math.max(0, t - T.hitStop[1]);
  const ph = 2.2 * s + 1.1 * s * s;
  return Math.max(0, Math.sin(ph * Math.PI * 2)) ** 6;
}
/** The rift's violent pulse (0-1). */
function riftPulse(t: number): number {
  return Math.abs(Math.sin(t * Math.PI * 2.6)) ** 7 * (0.7 + 0.3 * Math.sin(t * 5.3));
}

// ---------------------------------------------------------------------------------------------------
// The breakage: a Voronoi of seeds in the tile (unit radius, pointy top as the Field draws it), each edge
// between two cells made jagged the same way from both sides, so the shards fit and the fractures were
// their edges.

interface Cell {
  /** Its outline round its centre (unit radii), and that centre on the tile. */
  pts: [number, number][];
  cx: number;
  cy: number;
  /** For each outline edge: an inside fracture (true) or the tile's own rim. */
  inner: boolean[];
  /** The outline's winding as seen from above (1 or -1). */
  wind: number;
  /** Its neighbours. */
  near: number[];
  /** Circuit traces on its top (unit radii, round its centre). */
  circuit: [number, number][][];
}
interface Breakage {
  cells: Cell[];
  /** The fractures: each a jagged path, its distance from the middle at its near and far ends. */
  cracks: { pts: [number, number][]; d0: number; d1: number; main: boolean }[];
  pairs: [number, number][];
}

const SEEDS = (() => {
  const r = seq(70411);
  const inHex = (x: number, y: number) => [0, 1, 2, 3, 4, 5].every((k) => x * Math.cos((k * Math.PI) / 3) + y * Math.sin((k * Math.PI) / 3) <= 0.84);
  const out: [number, number][] = [[0.03, -0.02]];
  let tries = 0;
  while (out.length < 36 && tries++ < 5000) {
    const rad = 0.95 * r() ** 0.62;
    const a = r() * Math.PI * 2;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (!inHex(x, y)) continue;
    const gap = 0.1 + 0.09 * rad;
    if (out.some(([px, py]) => Math.hypot(px - x, py - y) < gap)) continue;
    out.push([x, y]);
  }
  return out;
})();

function hashUnit(n: number): number {
  let h = (n * 2654435761) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return ((h >>> 0) % 100000) / 100000;
}

const BREAKS = new Map<number, Breakage>();
/** The breakage with n shards (28-36), the same every time. */
export function breakage(n: number): Breakage {
  const had = BREAKS.get(n);
  if (had) return had;
  const seeds = SEEDS.slice(0, Math.max(3, Math.min(SEEDS.length, n)));
  type V = { p: [number, number]; lab: number };
  const raw = seeds.map((si, i) => {
    let poly: V[] = hexCorners(0, 0, 1).map((p) => ({ p, lab: -1 }));
    seeds.forEach((sj, j) => {
      if (j === i) return;
      const nx = sj[0] - si[0];
      const ny = sj[1] - si[1];
      const mx = (si[0] + sj[0]) / 2;
      const my = (si[1] + sj[1]) / 2;
      const side = (p: [number, number]) => (p[0] - mx) * nx + (p[1] - my) * ny;
      const out: V[] = [];
      for (let k = 0; k < poly.length; k++) {
        const A = poly[k]!;
        const B = poly[(k + 1) % poly.length]!;
        const sa = side(A.p);
        const sb = side(B.p);
        const cut = (): [number, number] => {
          const f = sa / (sa - sb);
          return [A.p[0] + (B.p[0] - A.p[0]) * f, A.p[1] + (B.p[1] - A.p[1]) * f];
        };
        if (sa <= 0) out.push(A);
        if (sa <= 0 && sb > 0) out.push({ p: cut(), lab: j });
        if (sa > 0 && sb <= 0) out.push({ p: cut(), lab: A.lab });
      }
      poly = out;
    });
    return poly;
  });
  // Jagged inside edges: two points at a third and two thirds, pushed sideways the same way from both cells.
  const jag = (i: number, j: number, p: [number, number], q: [number, number]): [number, number][] => {
    const lo = Math.min(i, j);
    const hi = Math.max(i, j);
    const sl = seeds[lo]!;
    const sh = seeds[hi]!;
    const nl = Math.hypot(sh[0] - sl[0], sh[1] - sl[1]) || 1;
    const n = [(sh[0] - sl[0]) / nl, (sh[1] - sl[1]) / nl];
    const e = [-n[1]!, n[0]!];
    const tp = p[0] * e[0]! + p[1] * e[1]!;
    const tq = q[0] * e[0]! + q[1] * e[1]!;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const h1 = (hashUnit(lo * 97 + hi * 13 + 1) - 0.5) * 2 * 0.09 * len;
    const h2 = (hashUnit(lo * 97 + hi * 13 + 2) - 0.5) * 2 * 0.09 * len;
    const at = (f: number, h: number): [number, number] => [p[0] + (q[0] - p[0]) * f + n[0]! * h, p[1] + (q[1] - p[1]) * f + n[1]! * h];
    if (len < 0.035) return [];
    return tp < tq ? [at(1 / 3, h1), at(2 / 3, h2)] : [at(1 / 3, h2), at(2 / 3, h1)];
  };
  const crackSeen = new Set<string>();
  const cracks: Breakage["cracks"] = [];
  const pairs: [number, number][] = [];
  const rnd = seq(88213);
  const cells: Cell[] = raw.map((poly, i) => {
    const full: [number, number][] = [];
    const inner: boolean[] = [];
    const near = new Set<number>();
    poly.forEach((v, k) => {
      const w = poly[(k + 1) % poly.length]!;
      full.push(v.p);
      if (v.lab >= 0) {
        near.add(v.lab);
        const mid = jag(i, v.lab, v.p, w.p);
        inner.push(true, ...mid.map(() => true));
        full.push(...mid);
        const key = `${Math.min(i, v.lab)}|${Math.max(i, v.lab)}`;
        if (!crackSeen.has(key)) {
          crackSeen.add(key);
          pairs.push([Math.min(i, v.lab), Math.max(i, v.lab)]);
          const path = [v.p, ...mid, w.p];
          const da = Math.hypot(v.p[0], v.p[1]);
          const db = Math.hypot(w.p[0], w.p[1]);
          // Main fractures run outwards (spokes of the web); the others join them (its rings), fainter and a little later.
          const main = Math.abs(db - da) / Math.max(1e-6, Math.hypot(w.p[0] - v.p[0], w.p[1] - v.p[1])) > 0.5;
          cracks.push(da <= db ? { pts: path, d0: da, d1: db, main } : { pts: [...path].reverse(), d0: db, d1: da, main });
        }
      } else inner.push(false);
    });
    // Its centre (area centroid) and winding.
    let A = 0;
    let cx = 0;
    let cy = 0;
    for (let k = 0; k < full.length; k++) {
      const [x0, y0] = full[k]!;
      const [x1, y1] = full[(k + 1) % full.length]!;
      const c = x0 * y1 - x1 * y0;
      A += c;
      cx += (x0 + x1) * c;
      cy += (y0 + y1) * c;
    }
    cx /= 3 * A || 1;
    cy /= 3 * A || 1;
    const pts = full.map(([x, y]) => [x - cx, y - cy] as [number, number]);
    // One or two right-angled traces and their pads, kept well inside.
    const circuit: [number, number][][] = [];
    const reach = Math.min(...pts.map(([x, y]) => Math.hypot(x, y))) * 0.75;
    for (let c = 0; c < (rnd() < 0.5 ? 1 : 2); c++) {
      const a = Math.floor(rnd() * 4) * (Math.PI / 2) + (rnd() - 0.5) * 0.3;
      const l1 = reach * (0.5 + rnd() * 0.5);
      const x0 = (rnd() - 0.5) * reach * 0.6;
      const y0 = (rnd() - 0.5) * reach * 0.6;
      const x1 = x0 + Math.cos(a) * l1;
      const y1 = y0 + Math.sin(a) * l1;
      const b = a + (rnd() < 0.5 ? 1 : -1) * (Math.PI / 2);
      const l2 = reach * (0.3 + rnd() * 0.4);
      circuit.push([
        [x0, y0],
        [x1, y1],
        [x1 + Math.cos(b) * l2, y1 + Math.sin(b) * l2],
      ]);
    }
    return { pts, cx, cy, inner, wind: Math.sign(A) || 1, near: [...near], circuit };
  });
  const out = { cells, cracks, pairs };
  BREAKS.set(n, out);
  return out;
}

// ---------------------------------------------------------------------------------------------------
// The shards' flight: up and out, then hanging in bullet time; all from the shards' own clock.

interface Flight {
  /** Peak height (unit radii) and the moment of the peak on the shards' clock. */
  hp: number;
  tp: number;
  /** How far out at the peak (unit radii) and which way. */
  out: number;
  dir: number;
  /** Tumble: axis and speed (radians a second on the shards' clock). */
  ax: [number, number, number];
  w: number;
  /** A share of the particles: drawn when the machine keeps up (quality). */
  rank: number;
  shade: number;
}
export function flights(b: Breakage): Flight[] {
  const r = seq(51929);
  return b.cells.map((c) => {
    const d = Math.hypot(c.cx, c.cy);
    const ax0 = r() - 0.5;
    const ay0 = r() - 0.5;
    const az0 = (r() - 0.5) * 0.5;
    const al = Math.hypot(ax0, ay0, az0) || 1;
    return {
      hp: 0.55 + 0.75 * (1 - d) + r() * 0.35,
      tp: 0.31 + r() * 0.07,
      out: 0.2 + 0.85 * d + r() * 0.3,
      dir: (d > 0.05 ? Math.atan2(c.cy, c.cx) : r() * Math.PI * 2) + (r() - 0.5) * 0.5,
      ax: [ax0 / al, ay0 / al, az0 / al],
      w: (8 + r() * 14) * (r() < 0.5 ? -1 : 1),
      rank: r(),
      shade: r(),
    };
  });
}
/** A shard's centre (unit radii: across, down, up) and turn (radians) on the shards' clock tau. */
export function shardAt(f: Flight, c: Cell, tau: number): { x: number; y: number; h: number; ang: number } {
  const g = (2 * f.hp) / (f.tp * f.tp);
  const h = g * f.tp * tau - (g * tau * tau) / 2;
  const K = 0.25;
  const o = (f.out * (1 - Math.exp(-tau / K))) / (1 - Math.exp(-f.tp / K));
  return { x: c.cx + Math.cos(f.dir) * o, y: c.cy + Math.sin(f.dir) * o, h: Math.max(0, h), ang: f.w * tau };
}
/** A point turned about a unit axis (Rodrigues). */
function turn(v: readonly [number, number, number], a: readonly [number, number, number], ang: number): [number, number, number] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const d = (v[0] * a[0] + v[1] * a[1] + v[2] * a[2]) * (1 - c);
  return [v[0] * c + (a[1] * v[2] - a[2] * v[1]) * s + a[0] * d, v[1] * c + (a[2] * v[0] - a[0] * v[2]) * s + a[1] * d, v[2] * c + (a[0] * v[1] - a[1] * v[0]) * s + a[2] * d];
}
function area(pts: readonly number[]): number {
  let A = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + 2) % pts.length;
    A += pts[i]! * pts[j + 1]! - pts[j]! * pts[i + 1]!;
  }
  return A / 2;
}

// ---------------------------------------------------------------------------------------------------
// Particles, each the same every time (shares of their counts are drawn on a slow machine).

const pick = <X>(n: number, seed: number, f: (r: () => number, i: number) => X): (X & { rank: number })[] => {
  const r = seq(seed);
  return Array.from({ length: n }, (_, i) => ({ ...f(r, i), rank: r() }));
};
/** Act 1: motes of the sectors round it, spiralling in. */
const PULL = pick(150, 4419, (r) => ({ r0: 1.25 + r() * 3.1, a0: r() * Math.PI * 2, per: 0.75 + r() * 0.65, ph: r(), size: 0.5 + r(), hue: r() }));
/** Act 1: loose chips of the sectors round it, hopping in. */
const CHIPS = pick(36, 6521, (r) => ({ ring: r() < 0.65 ? 1 : 2, side: r(), at: 0.55 + r() * 1.35, dur: 0.45 + r() * 0.35, hops: 1 + Math.floor(r() * 3), size: 0.04 + r() * 0.05, spin: (r() - 0.5) * 14, off: (r() - 0.5) * 0.6 }));
/** Act 1: rays of light leaking up out of the fractures. */
const RAYS = pick(26, 3137, (r) => ({ c: r(), u: 0.25 + r() * 0.7, len: 0.7 + r() * 0.9, w: 0.07 + r() * 0.08, ph: r() * 6.28 }));
/** Act 1: light leaking from the fractures. */
const LEAK = pick(90, 2213, (r) => ({ c: r(), u: r(), up: 0.2 + r() * 0.5, life: 0.4 + r() * 0.5, ph: r(), size: 0.5 + r() }));
/** Act 2: sparks thrown up by the burst, hanging in bullet time. */
const SPARKS = pick(170, 9907, (r) => {
  const a = r() * Math.PI * 2;
  const up = 0.25 + r() * 0.75;
  const sp = 1.5 + r() * 6;
  return { vx: Math.cos(a) * sp * Math.sqrt(1 - up * up), vy: Math.sin(a) * sp * Math.sqrt(1 - up * up), vh: sp * up, size: 0.4 + r(), tw: r() * 6.28, hot: r() };
});
/** Act 2: the frozen ring of the burst and the rift's edge. */
const RING = pick(64, 1171, (r, i) => ({ a: (i / 64) * Math.PI * 2 + r() * 0.05, j: r(), size: 0.6 + r() * 0.8 }));
const RIFT = pick(90, 7741, (r) => ({ s: r() * 2 - 1, side: r() < 0.5 ? -1 : 1, ph: r(), sp: 0.5 + r() * 1.2, up: 0.3 + r() * 0.9, size: 0.5 + r() }));
const VOID = pick(46, 3901, (r) => ({ s: (r() * 2 - 1) * 0.8, v: (r() * 2 - 1) * 0.7, ph: r() * 6.28, sp: 0.3 + r() * 0.8, star: r() < 0.45 }));
const CORONA = pick(40, 5153, (r) => ({ a: r() * Math.PI * 2, rr: 1.1 + r() * 0.9, sp: 1.5 + r() * 2.5, size: 0.5 + r() }));
/** Act 3: the fireball's embers; the shards' vapour. */
const FIRE = pick(90, 6133, (r) => {
  const a = r() * Math.PI * 2;
  const up = r() * 0.8;
  return { vx: Math.cos(a), vy: Math.sin(a), vh: up, sp: 6 + r() * 14, size: 0.5 + r(), gold: r() < 0.6 };
});
/** Act 4: golden-cyan embers rising from the crater, sparks on its rim. */
const RISE = pick(80, 8429, (r) => ({ x: (r() - 0.5) * 1.5, y: (r() - 0.5) * 1.3, ph: r(), sp: 0.35 + r() * 0.45, sway: r() * 6.28, size: 0.5 + r(), gold: r() < 0.5 }));
const RIM = pick(30, 2777, (r) => ({ e: Math.floor(r() * 6), f: r(), ph: r(), sp: 0.6 + r() * 0.6 }));

/** A point on the tilted board (screen pixels from the unit, H up) on the screen. */
type Proj = (X: number, Y: number, H: number) => { x: number; y: number; p: number };
/** A particle, drawn only as far as the machine keeps up (its rank against the quality). */
type Dot = (m: Motes, rank: number, x: number, y: number, size: number, tint: number, alpha: number, stretch?: number, rot?: number) => void;

/** A point at fraction u along a path. */
function along(pts: readonly [number, number][], u: number): [number, number] {
  if (u <= 0) return pts[0]!;
  let total = 0;
  const lens: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
    lens.push(l);
    total += l;
  }
  let want = Math.min(1, u) * total;
  for (let i = 0; i < lens.length; i++) {
    if (want <= lens[i]! || i === lens.length - 1) {
      const f = lens[i]! > 0 ? Math.min(1, want / lens[i]!) : 0;
      const a = pts[i]!;
      const b = pts[i + 1]!;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    want -= lens[i]!;
  }
  return pts[pts.length - 1]!;
}
/** The part of a path up to fraction u. */
function partPath(pts: readonly [number, number][], u: number): [number, number][] {
  if (u >= 1) return [...pts];
  const out: [number, number][] = [pts[0]!];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  let want = u * total;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
    if (want >= l) {
      out.push(pts[i]!);
      want -= l;
    } else {
      const f = l > 0 ? want / l : 0;
      out.push([pts[i - 1]![0] + (pts[i]![0] - pts[i - 1]![0]) * f, pts[i - 1]![1] + (pts[i]![1] - pts[i - 1]![1]) * f]);
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------
// How well this machine keeps up: below about 40 frames a second, fewer particles (never slower).

let quality = 1;
let qLast = 0;
let qFrames = 0;
let qLate = 0;
function keepUp(): void {
  const now = typeof performance === "undefined" ? 0 : performance.now();
  if (qLast && now - qLast < 400) {
    qFrames++;
    if (now - qLast > 25) qLate++;
    if (qFrames >= 30) {
      if (qLate > 20 && quality > MIN_QUALITY) quality = Math.max(MIN_QUALITY, quality * 0.85);
      qFrames = qLate = 0;
    }
  }
  qLast = now;
}
/** How much of a particle of this rank shows (0-1): the share above the quality fades out. */
const shown = (rank: number) => Math.max(0, Math.min(1, (quality - rank) / 0.08));
/** The number of shards for this machine (28-36). */
export function shardCount(q = quality): number {
  return Math.round(28 + (8 * (Math.max(MIN_QUALITY, Math.min(1, q)) - MIN_QUALITY)) / (1 - MIN_QUALITY));
}

// ---------------------------------------------------------------------------------------------------

/** Dimensional Shatter as a Field step (and its 2 s of light for reduced motion and Instant). */
export function gammaShatterStep(env: KillEnv, k: KillTarget): Step {
  const B = breakage(shardCount());
  const FL = flights(B);
  /** Every sector, its hex distance from the Gamma, and each sector's place in the order of rings (for chips and the still wave). */
  let rings: Map<string, number> | undefined;
  let maxD = 1;
  const ringsOf = () => {
    if (rings) return rings;
    rings = new Map();
    for (const [key] of env.centres?.() ?? []) {
      const d = hexDist(key, k.sector);
      rings.set(key, d);
      maxD = Math.max(maxD, d);
    }
    return rings;
  };
  /** The sectors round it the chips come from (board pixels from the Gamma at zoom 1). */
  let chipFrom: { ring1: [number, number][]; ring2: [number, number][] } | undefined;

  return closeupStep(env, k, {
    times: { total: T.total, zoomIn: T.zoomIn, back: T.back, breakAt: T.shatter, wreckIn: T.wreckIn, label: T.label, count: T.count, stillAt: T.count + 0.4, stillTotal: T.still },
    size: 0.115,
    hole: 2.6,
    // Lower than the other kills: the shards fly up above it.
    focus: (wide) => (wide ? [0.42, 0.62] : [0.5, 0.52]),
    title: `${k.name.toUpperCase()} DOWN`,
    accent: CLEAR,
    ink: ICE,
    inkLine: 0x0b2a3a,
    labelScale: 1.25,
    build: (back, front, under) => {
      const slots = new Graphics();
      under.addChild(slots);
      const grade = new Graphics();
      const crater = new Graphics();
      const darkCracks = new Graphics();
      const borders = new Graphics();
      borders.blendMode = "add";
      const waves = new Graphics();
      waves.blendMode = "add";
      const riftGlow = new Graphics();
      riftGlow.blendMode = "add";
      const riftBody = new Graphics();
      const light = new Graphics();
      light.blendMode = "add";
      back.addChild(grade, crater, darkCracks, borders, waves, riftGlow, riftBody, light);
      const rays = Array.from({ length: RAYS.length }, () => glowSprite(back, CRIMSON));
      const far = motes(back, 260);
      const chips = new Graphics();
      const shards = new Graphics();
      const rims = new Graphics();
      rims.blendMode = "add";
      back.addChild(chips, shards, rims);
      const halo = glowSprite(front, CRIMSON);
      const fireball = glowSprite(front, GOLD);
      const pm = motes(front, 720);
      const arcs = new Graphics();
      arcs.blendMode = "add";
      const flash = new Graphics();
      flash.blendMode = "add";
      const plate = new Graphics();
      const hud = new Graphics();
      hud.blendMode = "add";
      const dpr = typeof window === "undefined" ? 1 : Math.min(3, window.devicePixelRatio || 1);
      const tele = new Text({ text: "", resolution: dpr * 2, style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 14, fontWeight: "700", fill: ICE, letterSpacing: 2 } });
      tele.anchor.set(0.5, 1);
      tele.visible = false;
      front.addChild(arcs, flash, plate, hud, tele);
      return { slots, grade, crater, darkCracks, borders, waves, riftGlow, riftBody, light, rays, far, chips, shards, rims, halo, fireball, pm, arcs, flash, plate, hud, tele };
    },
    shake: (t, Rs) => {
      const [x, y] = shakeOffset(t);
      return [x * Rs, y * Rs];
    },
    dark: (t) => (t < T.blast ? 1 : 1 - 0.72 * easeOut(span(t, [T.blast, 6.1]))),
    tile: (t) => {
      const collapse = span(t, [1.85, T.shatter]);
      return { scale: t < T.hitStop[1] ? 1 : 1 - 0.05 * collapse * collapse + 0.012 * heartbeat(t), alpha: 1 };
    },
    sounds: (crossed) => {
      if (crossed(T.critical)) playBossCoreCritical();
      if (crossed(T.shatter)) playSlowMoShatter();
      if (crossed(T.rift[0])) playDimensionalRift();
      if (crossed(T.blast)) playCataclysmShockwave();
      if (crossed(T.purified)) playSectorPurified();
    },
    draw: (f, b) => {
      const { t, still, Sx, Sy, Rs, w, h } = f;
      if (!still) keepUp();
      const D = Rs * 10;
      const tiltU = still ? 0 : t < T.back[0] ? easeInOut(span(t, T.tilt)) : 1 - easeInOut(span(t, T.back));
      const th = THETA * tiltU;
      const R = ringsOf();
      const centres = env.centres?.() ?? [];
      let maxR = Rs * 3;
      for (const [, x, y] of centres) maxR = Math.max(maxR, Math.hypot((x - f.cx) * f.z, (y - f.cy) * f.z));
      const waveR = maxR * 1.1 + Rs * 2.5;
      /** The searing ring's radius at time t, and when it reaches radius r. */
      const r1At = (tt: number) => waveR * (1 - (1 - span(tt, T.wave1)) ** 1.6);
      const hitAt = (r: number) => T.wave1[0] + (1 - Math.max(0, 1 - r / waveR) ** (1 / 1.6)) * (T.wave1[1] - T.wave1[0]);
      const r2 = waveR * (1 - (1 - span(t, T.wave2)) ** 1.5);
      const w2On = t > T.wave2[0] && t < T.wave2[1] ? 1 - span(t, T.wave2) : 0;
      const pull = still ? 0 : span(t, T.pull);
      const amp = still ? 0 : t < T.shatter ? Math.max(0, (t - T.hitStop[1]) / (T.shatter - T.hitStop[1])) : 0;

      // The board: tilted; the sectors round it shiver with the tremor and lean in; the distortion wave lifts them.
      let placed: ReturnType<typeof tiltBoard> = [];
      if (!still) {
        placed = tiltBoard(f, centres, th, D, (key, X, Y) => {
          if (key === k.sector) return undefined;
          const d = R.get(key) ?? 9;
          const r = Math.hypot(X, Y);
          let H = 0;
          let push = 0;
          if (d <= 2 && t < T.shatter + 0.3) {
            const s = d === 1 ? 1 : 0.45;
            H += Rs * 0.035 * s * amp * amp * Math.abs(Math.sin(t * 41 + d * 7 + X * 0.05));
            push -= Rs * 0.05 * s * pull * pull;
          }
          if (w2On > 0) {
            const bump = Math.exp(-(((r - r2) / (Rs * 0.7)) ** 2));
            H += Rs * 0.26 * bump * w2On;
            push += Rs * 0.12 * bump * w2On;
          }
          if (t > T.blast && t < T.wave1[1] + 0.2) {
            const hit = hitAt(r);
            const u = span(t, [hit, hit + 0.3]);
            H += Rs * 0.08 * Math.sin(Math.PI * u);
          }
          if (H < 0.3 && Math.abs(push) < 0.3) return undefined;
          const dl = r || 1;
          return { H, shift: [(X / dl) * push, (Y / dl) * push] };
        });
        env.slots?.(false);
        drawSlots(b.slots.clear(), placed, Rs, th);
      } else b.slots.clear();
      // The Gamma's stand-in (it leaves no Wreck) tilts with the board until it breaks.
      const g0 = env.ghost && !env.ghost.destroyed && env.ghost.visible ? env.ghost : undefined;
      if (g0 && !still) {
        const Lg = f.look(k.sector);
        g0.position.set(f.cx + Lg.dx, f.cy + Lg.dy);
        g0.scale.set(Lg.scale * Lg.scaleX, Lg.scale);
        g0.rotation = Lg.turn ?? 0;
      }
      const P = (X: number, Y: number, H: number) => {
        const pr = project(X, Y, H, th, D);
        return { x: Sx + pr.x, y: Sy + pr.y, p: pr.p, near: pr.near };
      };
      /** A point on the tile (unit radii) on the screen. */
      const PT = (x: number, y: number, H = 0) => P(x * Rs, y * Rs, H * Rs);

      const grade = b.grade.clear();
      const crater = b.crater.clear();
      const darkCracks = b.darkCracks.clear();
      const borders = b.borders.clear();
      const waves = b.waves.clear();
      const riftGlow = b.riftGlow.clear();
      const riftBody = b.riftBody.clear();
      const light = b.light.clear();
      const chips = b.chips.clear();
      const shards = b.shards.clear();
      const rims = b.rims.clear();
      const arcs = b.arcs.clear();
      const flash = b.flash.clear();
      const hud = b.hud.clear();
      const plate = b.plate.clear();
      b.far.begin();
      b.pm.begin();
      const dot: Dot = (m, rank, x, y, size, tint, alpha, stretch, rot) => {
        const s = shown(rank);
        if (s > 0) m.dot(x, y, size, tint, alpha * s, stretch, rot);
      };

      if (still) drawStill(f, b, P, PT, dot);
      else {
        // ---- The frozen moment on the killing blow: a stark frame, nothing moves.
        if (t < T.hitStop[1] + 0.12) {
          const hold = t < T.hitStop[1] ? 1 : 1 - span(t, [T.hitStop[1], T.hitStop[1] + 0.12]);
          grade.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.35 * hold });
          const c = PT(0, 0);
          flash.poly(flat(hexCorners(c.x, c.y, Rs * 1.0))).fill({ color: 0xffffff, alpha: 0.42 * hold });
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + 0.3;
            const len = Rs * (i % 2 ? 0.55 : 0.85);
            light.moveTo(c.x, c.y).lineTo(c.x + Math.cos(a) * len, c.y + Math.sin(a) * len).stroke({ width: 2, color: 0xffffff, alpha: 0.85 * hold });
          }
          b.pm.dot(c.x, c.y, Rs * 0.5, 0xffffff, 0.9 * hold);
        }

        // ---- Act 1: fractures, rays, the pull, the core.
        const crackU = span(t, T.cracks);
        const front = 1.08 * crackU ** 1.35;
        const crackOn = t < T.shatter + 0.05;
        if (crackOn && crackU > 0) {
          const beat = heartbeat(t);
          const I = (0.55 + 0.45 * crackU) * (0.75 + 0.5 * beat) + span(t, [1.9, T.shatter]) * 0.8;
          // One path per look: the dark split, the crimson bloom, the red-hot line, the white-hot core.
          const lit: { pts: [number, number][]; main: boolean }[] = [];
          // The tile darkens as it heats, so the light in it shows.
          const hexOn = hexCorners(0, 0, 1).flatMap(([x, y]) => {
            const q = PT(x, y);
            return [q.x, q.y];
          });
          darkCracks.poly(hexOn).fill({ color: 0x07030c, alpha: 0.6 * Math.min(1, crackU * 1.6) });
          for (const c of B.cracks) {
            const u = (front - c.d0 - (c.main ? 0 : 0.14)) / Math.max(0.05, c.d1 - c.d0);
            if (u <= 0) continue;
            const part = partPath(c.pts, Math.min(1, u)).map(([x, y]) => {
              const q = PT(x, y);
              return [q.x, q.y] as [number, number];
            });
            lit.push({ pts: part, main: c.main });
            // A bright point running at a growing tip.
            if (u < 1 && c.main) {
              const tip = part[part.length - 1]!;
              dot(b.pm, 0.1, tip[0], tip[1], Rs * 0.11, HOT, 0.9);
            }
          }
          const stroke = (g: Graphics, main: boolean, width: number, color: number, alpha: number) => {
            let any = false;
            for (const l of lit) {
              if (l.main !== main) continue;
              g.moveTo(l.pts[0]![0], l.pts[0]![1]);
              for (const p of l.pts.slice(1)) g.lineTo(p[0], p[1]);
              any = true;
            }
            if (any) g.stroke({ width, color, alpha: Math.min(1, alpha) });
          };
          stroke(darkCracks, true, Rs * 0.06, 0x030105, 0.85);
          stroke(darkCracks, false, Rs * 0.035, 0x030105, 0.7);
          stroke(light, true, Rs * 0.16, DEEP, 0.4 * I);
          stroke(light, true, Rs * 0.065, CRIMSON, 0.8 * I);
          stroke(light, true, Rs * 0.022, HOT, Math.min(1, 0.95 * I));
          stroke(light, false, Rs * 0.08, DEEP, 0.28 * I);
          stroke(light, false, Rs * 0.026, CRIMSON, 0.6 * I);
          // The rim heats once the fractures reach it.
          const rimU = span(front, [0.8, 1.05]);
          if (rimU > 0) {
            const pts = hexCorners(0, 0, 1).flatMap(([x, y]) => {
              const q = PT(x, y);
              return [q.x, q.y];
            });
            light.poly(pts).stroke({ width: Rs * 0.05, color: CRIMSON, alpha: 0.5 * rimU * I });
          }
          // Light leaking out of the fractures and drifting up.
          for (const m of LEAK) {
            const c = B.cracks[Math.floor(m.c * B.cracks.length)]!;
            const reach = (front - c.d0) / Math.max(0.05, c.d1 - c.d0);
            if (reach < m.u) continue;
            const life = ((t * 0.9) / m.life + m.ph) % 1;
            const [x, y] = along(c.pts, m.u);
            const q = PT(x, y, m.up * life);
            dot(b.pm, m.rank, q.x, q.y, Rs * 0.05 * m.size, life < 0.4 ? HOT : CRIMSON, 0.85 * Math.sin(Math.PI * life) * I);
          }
          // Rays of light leaking up out of the fractures (soft, long, flickering).
          b.rays.forEach((s, i) => {
            const r = RAYS[i]!;
            const c = B.cracks[Math.floor(r.c * B.cracks.length)]!;
            const reach = (front - c.d0) / Math.max(0.05, c.d1 - c.d0);
            const on = Math.max(0, Math.min(1, (reach - r.u) * 4)) * shown(r.rank);
            s.visible = on > 0.01;
            if (!s.visible) return;
            const [x, y] = along(c.pts, r.u);
            const a = PT(x, y, 0);
            const top = PT(x, y, r.len * (0.6 + 0.6 * crackU));
            const len = Math.hypot(top.x - a.x, top.y - a.y);
            s.position.set((a.x + top.x) / 2, (a.y + top.y) / 2);
            s.rotation = Math.atan2(top.y - a.y, top.x - a.x) + Math.PI / 2;
            s.width = Rs * r.w * 2;
            s.height = Math.max(Rs * 0.2, len * 1.25);
            s.tint = mix(CRIMSON, EMBER, 0.5 + 0.5 * Math.sin(t * 7 + r.ph));
            s.alpha = on * (0.26 + 0.2 * Math.sin(t * 13 + r.ph) + 0.25 * heartbeat(t));
          });
        } else b.rays.forEach((s) => (s.visible = false));

        // Motes of the sectors round it, spiralling in to the core; loose chips hopping in.
        if (pull > 0 && t < T.shatter) {
          const ramp = Math.min(1, pull * 1.6);
          for (const m of PULL) {
            if (m.rank > ramp) continue;
            const u = ((t - T.pull[0]) / m.per + m.ph) % 1;
            const e = u * u;
            const r = m.r0 * (1 - e) + 0.08;
            const a = m.a0 + 1.9 * e;
            const q = PT(Math.cos(a) * r, Math.sin(a) * r, 0.05 + 0.3 * e);
            const q2 = PT(Math.cos(a - 0.15) * (r + 0.25 * u), Math.sin(a - 0.15) * (r + 0.25 * u), 0.05 + 0.3 * e);
            const col = u > 0.75 ? HOT : m.hue < 0.5 ? CRIMSON : VIOLET;
            dot(b.pm, m.rank, q.x, q.y, Rs * 0.045 * m.size * (0.6 + 0.6 * u), col, Math.sin(Math.PI * Math.min(1, u * 1.15)) * 0.8 * ramp, 1 + 3 * e, Math.atan2(q.y - q2.y, q.x - q2.x));
          }
          if (!chipFrom) {
            const all = centres.filter(([key]) => key !== k.sector);
            const off = (x: number, y: number) => [(x - f.cx) / f.z, (y - f.cy) / f.z] as [number, number];
            chipFrom = { ring1: all.filter(([key]) => R.get(key) === 1).map(([, x, y]) => off(x, y)), ring2: all.filter(([key]) => R.get(key) === 2).map(([, x, y]) => off(x, y)) };
          }
          for (const c of CHIPS) {
            const list = c.ring === 1 ? chipFrom.ring1 : chipFrom.ring2;
            if (!list.length || shown(c.rank) <= 0) continue;
            const u = span(t, [c.at, c.at + c.dur]);
            if (u <= 0 || u >= 1) continue;
            const [ox, oy] = list[Math.floor(c.side * list.length)]!;
            // From the sector's edge nearest the Gamma (unit radii), a little to one side.
            const hyp = Math.hypot(ox, oy) || 1;
            const ux = ox / hyp;
            const uy = oy / hyp;
            const sr = (hyp * f.z) / Rs - 0.75;
            const sx = ux * sr - uy * c.off * 0.6;
            const sy = uy * sr + ux * c.off * 0.6;
            const e = u * u;
            const x = sx * (1 - e);
            const y = sy * (1 - e);
            const H = 0.18 * Math.abs(Math.sin(Math.PI * c.hops * u)) * (1 - u);
            const q = PT(x, y, H);
            const a = c.spin * u;
            const s = Rs * c.size * q.p;
            const tri = [0, 1, 2].flatMap((i) => [q.x + Math.cos(a + i * 2.1) * s, q.y + Math.sin(a + i * 2.1) * s * 0.8]);
            chips.poly(tri).fill({ color: 0x1b1424, alpha: 1 - span(u, [0.85, 1]) }).stroke({ width: 1, color: CRIMSON, alpha: 0.7 * (1 - u) });
          }
        }
        // The core collapsing into a tiny singularity: a dark point in a ring of light, a crimson halo.
        const coreU = span(t, T.core);
        if (coreU > 0 && t < T.shatter) {
          const c = PT(0, 0, 0.18);
          const beat = heartbeat(t);
          const rr = Rs * (0.05 + 0.07 * coreU) * (1 - 0.35 * span(t, [1.95, T.shatter]));
          b.halo.visible = true;
          b.halo.position.set(c.x, c.y);
          b.halo.width = b.halo.height = Rs * (1.2 + 1.4 * coreU + 0.6 * beat);
          b.halo.tint = CRIMSON;
          b.halo.alpha = 0.55 * coreU + 0.25 * beat;
          dot(b.pm, 0, c.x, c.y, rr * 6, HOT, 0.6 + 0.4 * beat);
          riftBody.circle(c.x, c.y, rr).fill({ color: 0x000000 });
          for (let j = 0; j < 14; j++) {
            const a = (j / 14) * Math.PI * 2 + t * 6;
            dot(b.pm, (j * 0.05) % 1, c.x + Math.cos(a) * rr * 1.2, c.y + Math.sin(a) * rr * 1.2, Math.max(2, rr * 0.5), j % 3 ? HOT : CRIMSON, 0.95, 2.2, a + Math.PI / 2);
          }
          for (const m of CORONA) {
            const a = m.a + t * m.sp;
            const r = rr * (1.6 + m.rr * 1.4);
            dot(b.pm, m.rank, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.8, Rs * 0.035 * m.size, m.rank < 0.5 ? CRIMSON : HOT, 0.75 * coreU, 2.5, a + Math.PI / 2);
          }
        } else if (t < T.blast || t > T.blast + 0.6) b.halo.visible = false;

        // The sectors' edges: threat crimson that grows through acts 1 and 2, then the wave's flare and the cleared colour.
        const threat = 0.18 + 0.32 * span(t, [0.3, T.shatter]) + 0.08 * (t > T.shatter && t < T.blast ? riftPulse(t) : heartbeat(t));
        const settle = 1 - span(t, [7.0, T.total]);
        for (const pl of placed) {
          if (pl.key === k.sector) continue;
          const r = Math.hypot(pl.X, pl.Y);
          const hit = hitAt(r);
          const pts = hexCorners(0, 0, Rs * 0.97 * pl.p).flatMap(([x, y]) => [pl.sx + x, pl.sy + y * pl.sq]);
          if (t < hit) {
            const near = Math.max(0.35, 1 - r / (Rs * 7));
            borders.poly(pts).stroke({ width: 2.2, color: CRIMSON, alpha: Math.min(1, threat * near * 1.4) });
          } else {
            const fl = Math.exp(-(t - hit) / 0.2);
            const calm = (0.35 + 0.1 * Math.sin(t * 2.4 + r * 0.02)) * settle;
            borders.poly(pts).stroke({ width: 1.6 + 5 * fl, color: mix(CLEAR, 0xffffff, fl), alpha: Math.min(1, calm + fl) });
            if (fl > 0.05)
              for (let j = 0; j < 6; j++) {
                const [x, y] = [pts[j * 2]!, pts[j * 2 + 1]!];
                const u = 1 - fl;
                dot(b.pm, (j * 0.13 + r * 0.001) % 1, x + (x - pl.sx) * 0.4 * u, y + (y - pl.sy) * 0.4 * u - Rs * 0.2 * u, Rs * 0.06, j % 2 ? CLEAR : GOLD, fl);
              }
          }
        }

        // ---- Act 2: the burst, bullet time, the rift, the shards, the arcs.
        const tau = shardTime(t);
        const slowOn = t >= T.shatter && t < T.blast;
        if (t >= T.shatter && t < T.shatter + 0.16) {
          const u = span(t, [T.shatter, T.shatter + 0.16]);
          flash.rect(0, 0, w, h).fill({ color: 0xfff2e8, alpha: 0.7 * (1 - u) ** 2 });
        }
        if (slowOn) {
          // Bullet time: the world dims and cools; only the light moves at the clock's speed.
          const g = span(t, [T.shatter + 0.05, T.slow[1]]) * (1 - span(t, [T.implode[0], T.blast]));
          grade.rect(0, 0, w, h).fill({ color: 0x050310, alpha: 0.32 * g });
          // The burst's ring, frozen on the board.
          const rr = Rs * 3.4 * (1 - Math.exp(-tau / 0.11));
          const ra = Math.max(0, 1 - tau / 0.5) * (1 - span(t, T.implode));
          if (ra > 0.01) {
            const ring: number[] = [];
            for (let j = 0; j <= 60; j++) {
              const a = (j / 60) * Math.PI * 2;
              const q = P(Math.cos(a) * rr, Math.sin(a) * rr, 0);
              ring.push(q.x, q.y);
            }
            waves.poly(ring, false).stroke({ width: Rs * 0.12, color: CRIMSON, alpha: 0.25 * ra });
            waves.poly(ring, false).stroke({ width: 1.5, color: HOT, alpha: 0.7 * ra });
            for (const m of RING) {
              const q = P(Math.cos(m.a) * rr * (0.97 + m.j * 0.06), Math.sin(m.a) * rr * (0.97 + m.j * 0.06), Rs * 0.04 * m.j);
              dot(b.far, m.rank, q.x, q.y, Rs * 0.06 * m.size, m.j < 0.4 ? HOT : EMBER, ra * (0.6 + 0.4 * Math.sin(t * 9 + m.a * 5)), 2.5, m.a + Math.PI / 2);
            }
          }
          drawRift(t, Rs, P, riftGlow, riftBody, light, b.far, b.pm, dot);
        }

        // The shards: up and out, tumbling, hanging in bullet time; pulled in by the implosion; blasted away and burnt up.
        if (t >= T.shatter && t < T.blast + 0.45) {
          const imp = easeOut(span(t, T.implode)) ** 2;
          const gone = span(t, [T.blast, T.blast + 0.4]);
          const heat = t < T.implode[0] ? 1 - 0.6 * span(t, [T.shatter, T.implode[0]]) : 0.4 + 0.6 * span(t, T.implode);
          const list = B.cells.map((c, i) => {
            const fl = FL[i]!;
            const at = shardAt(fl, c, Math.min(tau, shardTime(T.blast)));
            let x = at.x;
            let y = at.y;
            let H = at.h;
            // Pulled in towards the core, then blasted out from it.
            x *= 1 - 0.3 * imp;
            y *= 1 - 0.3 * imp;
            H = H * (1 - 0.25 * imp) + 0.25 * imp;
            if (t > T.blast) {
              const s = t - T.blast;
              const dl = Math.hypot(x, y, H - 0.25) || 1;
              const go = 26 * s + 30 * s * s;
              x += (x / dl) * go;
              y += (y / dl) * go;
              H += ((H - 0.25) / dl) * go;
            }
            return { i, c, fl, x, y, H, ang: at.ang + (t > T.blast ? fl.w * (t - T.blast) : 0), near: P(x * Rs, y * Rs, H * Rs).near };
          });
          list.sort((a, c) => a.near - c.near);
          const th3 = Rs * 0.05;
          for (const s of list) {
            const al = 1 - gone;
            if (al <= 0.01) continue;
            const hotNow = Math.min(1, heat + gone * 1.5);
            const top: number[] = [];
            const bot: number[] = [];
            const n = turn([0, 0, 1], s.fl.ax, s.ang);
            for (const [vx, vy] of s.c.pts) {
              const v = turn([vx, vy, 0], s.fl.ax, s.ang);
              const a = P((s.x + v[0]) * Rs, (s.y + v[1]) * Rs, (s.H + v[2]) * Rs);
              const z = P((s.x + v[0]) * Rs - n[0] * th3, (s.y + v[1]) * Rs - n[1] * th3, (s.H + v[2]) * Rs - n[2] * th3);
              top.push(a.x, a.y);
              bot.push(z.x, z.y);
            }
            const A = area(top);
            const up = Math.sign(A) === s.c.wind;
            const p0 = P(s.x * Rs, s.y * Rs, s.H * Rs).p;
            let rest = 0;
            for (let j = 0; j < s.c.pts.length; j++) {
              const [ax, ay] = s.c.pts[j]!;
              const [bx, by] = s.c.pts[(j + 1) % s.c.pts.length]!;
              rest += ax * by - bx * ay;
            }
            const facing = Math.min(1, Math.abs(A) / Math.max(1e-6, (Math.abs(rest / 2) * Rs * Rs * p0 * p0)));
            // The broken faces that show: incandescent; the tile's own rim: dark.
            const m = s.c.pts.length;
            for (let j = 0; j < m; j++) {
              const j2 = (j + 1) % m;
              const quad = [top[j2 * 2]!, top[j2 * 2 + 1]!, top[j * 2]!, top[j * 2 + 1]!, bot[j * 2]!, bot[j * 2 + 1]!, bot[j2 * 2]!, bot[j2 * 2 + 1]!];
              if (Math.sign(area(quad)) !== s.c.wind) continue;
              if (s.c.inner[j]) shards.poly(quad).fill({ color: mix(DEEP, mix(CRIMSON, HOT, 0.5 * gone), 0.35 + 0.65 * hotNow), alpha: al });
              else shards.poly(quad).fill({ color: 0x1a1226, alpha: al });
            }
            const cap = up ? top : bot;
            const capCol = up ? mix(mix(0x150c26, s.fl.shade < 0.35 ? 0x2a2140 : 0x5e3f96, facing ** 2), HOT, gone * 0.8) : mix(mix(OBSIDIAN, 0x4a3d66, facing ** 4), DEEP, 0.35 * span(t, T.rift) * (t < T.blast ? 1 : 0));
            shards.poly(cap).fill({ color: mix(capCol, 0xffffff, gone * 0.6), alpha: al });
            // Rim light: brighter edge-on and when the core flares.
            const rim = (0.35 + 0.65 * (1 - facing)) * (0.7 + 0.3 * Math.sin(t * 11 + s.i));
            rims.poly(cap).stroke({ width: 4 + 4 * imp, color: imp > 0.2 ? GOLD : CRIMSON, alpha: 0.14 * al });
            rims.poly(cap).stroke({ width: 0.9 + 1.1 * (1 - facing) + 1.5 * imp, color: imp > 0.2 ? GOLD : up ? MAGENTA : CRIMSON, alpha: Math.min(1, rim * al + imp) });
            // Plasma clinging to its corners.
            if (al > 0.5 && t < T.blast)
              for (let j = 0; j < cap.length / 2; j += 3) dot(b.pm, (s.fl.rank + j * 0.07) % 1, cap[j * 2]!, cap[j * 2 + 1]!, Rs * 0.06 * (0.7 + 0.5 * Math.sin(t * 9 + j + s.i)), j % 2 ? HOT : MAGENTA, 0.55 * al);
            // Dying circuitry on the top.
            if (up && heat > 0.3 && al > 0.5) {
              for (const tr of s.c.circuit) {
                const pts = tr.map(([cx, cy]) => {
                  const v = turn([cx, cy, 0], s.fl.ax, s.ang);
                  const q = P((s.x + v[0]) * Rs, (s.y + v[1]) * Rs, (s.H + v[2]) * Rs);
                  return [q.x, q.y] as [number, number];
                });
                const fl2 = 0.55 + 0.45 * Math.sin(t * 17 + s.i * 3.3);
                strokePath(rims, pts, 1.2, s.fl.shade < 0.5 ? CRIMSON : HOT, heat * fl2 * facing * al);
                const end = pts[pts.length - 1]!;
                dot(b.pm, s.fl.rank, end[0], end[1], Rs * 0.05, HOT, heat * fl2 * facing * al);
              }
            }
            // Burning up: vapour streaming off it.
            if (gone > 0) {
              const c = P(s.x * Rs, s.y * Rs, s.H * Rs);
              for (let j = 0; j < 6; j++) {
                const u = (j / 6 + gone) % 1;
                const back3 = P((s.x * (1 - u * 0.25)) * Rs, (s.y * (1 - u * 0.25)) * Rs, (s.H * (1 - u * 0.25) + 0.05 * j) * Rs);
                dot(b.pm, (s.fl.rank + j * 0.17) % 1, back3.x, back3.y, Rs * 0.09 * (1 - u) * c.p, j % 2 ? GOLD : HOT, (1 - gone) * (1 - u), 2.5, Math.atan2(c.y - back3.y, c.x - back3.x));
              }
            }
          }
          // Sparks hanging in the air: short streaks that shrink to points as time slows.
          const rate = timeDilation(t);
          for (const sp of SPARKS) {
            if (shown(sp.rank) <= 0) continue;
            const tt = Math.min(tau, shardTime(T.blast));
            const g = 9;
            const X = sp.vx * tt;
            const Y = sp.vy * tt;
            const H = Math.max(0, sp.vh * tt - (g * tt * tt) / 2);
            let fade = Math.max(0, 1 - tt / 0.55);
            if (t > T.blast) fade *= 1 - gone;
            if (fade <= 0.01) continue;
            const q = P(X * Rs, Y * Rs, H * Rs);
            const ah = sp.vh - g * tt;
            const q2 = P((X - sp.vx * 0.03) * Rs, (Y - sp.vy * 0.03) * Rs, (H - ah * 0.03) * Rs);
            const len = Math.hypot(q.x - q2.x, q.y - q2.y);
            const tw = 0.65 + 0.35 * Math.sin(t * 19 + sp.tw);
            dot(b.pm, sp.rank, q.x, q.y, Rs * 0.06 * sp.size * q.p, sp.hot < 0.35 ? HOT : sp.hot < 0.75 ? EMBER : CRIMSON, fade * tw, 1 + (rate * len * 8) / (Rs * 0.06), Math.atan2(q.y - q2.y, q.x - q2.x));
          }
          // Arcs of plasma between neighbouring shards and down to the core, flickering at the clock's speed.
          const arcOn = span(t, T.arcs) * (1 - span(t, [T.arcs[1] - 0.1, T.arcs[1]]));
          if (arcOn > 0.01 && B.pairs.length) {
            const pos = new Map(list.map((s) => [s.i, P(s.x * Rs, s.y * Rs, s.H * Rs)]));
            const slots = Math.max(3, Math.round(10 * quality));
            for (let a = 0; a < slots + 3; a++) {
              const ep = Math.floor((t + a * 0.037) / 0.17);
              if (hashUnit(ep * 131 + a * 7) < 0.3) continue;
              let p1: { x: number; y: number };
              let p2: { x: number; y: number };
              if (a < slots) {
                const pr = B.pairs[Math.floor(hashUnit(ep * 977 + a * 31) * B.pairs.length)]!;
                p1 = pos.get(pr[0])!;
                p2 = pos.get(pr[1])!;
              } else {
                p1 = P(0, 0, Rs * 0.12);
                p2 = pos.get(Math.floor(hashUnit(ep * 389 + a) * B.cells.length))!;
              }
              if (!p1 || !p2) continue;
              const pts = bolt(p1.x, p1.y, p2.x, p2.y, Math.floor(t / 0.05) * 13 + a * 101, 0.24, 8);
              const fl = arcOn * (0.6 + 0.4 * Math.sin(t * 60 + a));
              strokePath(arcs, pts, 5, MAGENTA, 0.22 * fl);
              strokePath(arcs, pts, 2.2, CRIMSON, 0.6 * fl);
              strokePath(arcs, pts, 1, 0xffffff, 0.95 * fl);
              for (let j = 1; j < pts.length - 1; j += 2) dot(b.pm, (a * 0.07 + j * 0.11) % 1, pts[j]![0], pts[j]![1], Rs * 0.06, j % 4 === 1 ? 0xffffff : MAGENTA, 0.7 * fl);
            }
          }
        }

        // ---- Act 3: the implosion's point, the blinding flash, the fireball, the two waves.
        if (t >= T.implode[0] && t < T.blast) {
          const u = span(t, T.implode);
          const c = PT(0, 0, 0.25);
          dot(b.pm, 0, c.x, c.y, Rs * (0.2 + 0.5 * u * u), 0xfff4d6, 0.6 + 0.4 * u);
          dot(b.pm, 0, c.x, c.y, Rs * (1.6 - 1.2 * u), GOLD, 0.35 * u);
          for (let j = 0; j < 24; j++) {
            const a = (j / 24) * Math.PI * 2 + t * 3;
            const r = Rs * (2.4 * (1 - ((u * 2 + j * 0.13) % 1)));
            dot(b.pm, (j * 0.041) % 1, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.75, Rs * 0.06, j % 2 ? GOLD : 0xffffff, 0.8 * u, 3, a);
          }
        }
        if (t >= T.blast && t < T.blast + 0.6) {
          const u = span(t, [T.blast, T.blast + 0.6]);
          flash.rect(0, 0, w, h).fill({ color: 0xfff3d2, alpha: 0.85 * Math.max(0, 1 - u * 1.25) ** 3 });
          const c = PT(0, 0, 0.25);
          b.fireball.visible = true;
          b.fireball.position.set(c.x, c.y);
          b.fireball.width = b.fireball.height = Rs * (1.5 + 7 * easeOut(u));
          b.fireball.alpha = 0.75 * (1 - u);
          b.halo.visible = true;
          b.halo.position.set(c.x, c.y);
          b.halo.tint = CLEAR;
          b.halo.width = b.halo.height = Rs * (2 + 10 * easeOut(u));
          b.halo.alpha = 0.35 * Math.max(0, 1 - u * 1.4);
          for (const m of FIRE) {
            const s = (t - T.blast) * m.sp;
            const q = P(m.vx * s * Rs, m.vy * s * Rs, (0.25 + m.vh * s - 3 * (t - T.blast) ** 2) * Rs);
            dot(b.pm, m.rank, q.x, q.y, Rs * 0.05 * m.size * q.p, m.gold ? GOLD : ICE, 1 - u, 3, Math.atan2(m.vy, m.vx));
          }
        } else b.fireball.visible = false;
        if (t >= T.blast && t < T.wave2[1] + 0.05) {
          const ring = (r: number, H = 0) => {
            const pts: number[] = [];
            for (let j = 0; j <= 80; j++) {
              const a = (j / 80) * Math.PI * 2;
              const q = P(Math.cos(a) * r, Math.sin(a) * r, H);
              pts.push(q.x, q.y);
            }
            return pts;
          };
          const u1 = span(t, T.wave1);
          if (u1 < 1) {
            const r1 = r1At(t);
            const al = 1 - u1 * u1;
            waves.poly(ring(r1 * 0.94), false).stroke({ width: Rs * 0.5, color: CLEAR, alpha: 0.16 * al });
            waves.poly(ring(r1), false).stroke({ width: Rs * 0.16, color: ICE, alpha: 0.5 * al });
            waves.poly(ring(r1), false).stroke({ width: 2.5, color: 0xffffff, alpha: al });
            for (let j = 0; j < 90; j++) {
              const a = (j / 90) * Math.PI * 2 + 0.02 * Math.sin(j * 7.1);
              const back = r1 * (1 - 0.06 * ((j * 0.37) % 1));
              const q = P(Math.cos(a) * back, Math.sin(a) * back, Rs * 0.05 * ((j * 0.61) % 1));
              dot(b.pm, (j * 0.0111) % 1, q.x, q.y, Rs * 0.08 * q.p, j % 3 ? ICE : CLEAR, al * (0.6 + 0.4 * Math.sin(t * 30 + j)), 2.6, a + Math.PI / 2);
            }
          }
          // The distortion wave: the colours split apart, a dark band of bent light just inside.
          if (w2On > 0) {
            const dl = Rs * (0.035 + 0.05 * (1 - w2On));
            for (const [off, col, a] of [
              [dl, 0xff3048, 0.5],
              [0, 0x3dff9a, 0.36],
              [-dl, 0x3d6bff, 0.55],
            ] as const) {
              const pts = ring(r2 + off);
              waves.poly(pts, false).stroke({ width: Rs * 0.16, color: col, alpha: 0.12 * a * w2On * 2 });
              waves.poly(pts, false).stroke({ width: 1.5, color: col, alpha: a * w2On });
            }
            grade.poly(ring(r2 - dl * 2.2), false).stroke({ width: Rs * 0.4, color: 0x02040a, alpha: 0.22 * w2On });
          }
        }

        // ---- Act 4: the crater (over what lay beneath), its smouldering rim, embers, the telemetry.
        const cr = span(t, [T.blast, T.blast + 0.25]) * (1 - span(t, [7.2, T.total]));
        if (cr > 0.01) {
          const g = P(0, 0, 0);
          crater.poly(boardHex(g.x, g.y, Rs * 0.96, g.p, th)).fill({ color: 0x080506, alpha: 0.62 * cr });
          const cool = span(t, [T.blast, 7.4]);
          light.poly(boardHex(g.x, g.y, Rs * 0.96, g.p, th)).stroke({ width: Math.max(2, Rs * 0.06), color: mix(EMBER, GOLD, cool), alpha: (0.85 - 0.35 * cool) * cr });
          light.poly(boardHex(g.x, g.y, Rs * 0.7, g.p, th)).stroke({ width: Math.max(1, Rs * 0.025), color: CLEAR, alpha: 0.35 * cr * span(t, [5.4, 6.4]) });
          const hx = hexCorners(0, 0, Rs * 0.96);
          for (const s of RIM) {
            const u = (s.ph + t * s.sp) % 1;
            const a = hx[s.e]!;
            const c = hx[(s.e + 1) % 6]!;
            const q = P(a[0] + (c[0] - a[0]) * s.f, a[1] + (c[1] - a[1]) * s.f, Rs * 0.4 * u);
            dot(b.pm, s.rank, q.x, q.y, Rs * 0.05, u < 0.4 ? GOLD : EMBER, cr * Math.sin(Math.PI * u));
          }
        }
        const em = span(t, [5.6, 6.8]) * (1 - span(t, [7.4, T.total]));
        if (em > 0.01)
          for (const m of RISE) {
            const u = (m.ph + (t - 5.6) * m.sp) % 1;
            const q = P((m.x + 0.12 * Math.sin(t * 1.7 + m.sway)) * Rs, m.y * Rs, (0.05 + 1.5 * u) * Rs);
            dot(b.pm, m.rank, q.x, q.y, Rs * 0.08 * m.size * (1 - 0.4 * u), m.gold ? GOLD : CLEAR, em * Math.sin(Math.PI * u));
          }
        const tu = span(t, T.telemetry);
        if (tu > 0 && tu < 1) drawTelemetry(t, f, P, plate, hud, b.tele, dot, b.pm);
        else b.tele.visible = false;
      }
      b.far.end();
      b.pm.end();
    },
  });

  /** Reduced motion and Instant (2 s of light, nothing moves): the plasma core flashes, then the hexes light ring by ring. */
  function drawStill(f: Frame, b: { borders: Graphics; crater: Graphics; light: Graphics; plate: Graphics; hud: Graphics; tele: Text; pm: Motes; rays: { visible: boolean }[]; halo: { visible: boolean }; fireball: { visible: boolean } }, P: Proj, PT: (x: number, y: number, H?: number) => { x: number; y: number; p: number }, dot: Dot) {
    const { st, Rs, Sx, Sy, z, cx, cy, fade } = f;
    b.rays.forEach((s) => (s.visible = false));
    b.halo.visible = false;
    b.fireball.visible = false;
    const R = ringsOf();
    // The crater, quiet.
    const g = PT(0, 0);
    b.crater.poly(flat(hexCorners(g.x, g.y, Rs * 0.96))).fill({ color: 0x080506, alpha: 0.55 * fade });
    b.light.poly(flat(hexCorners(g.x, g.y, Rs * 0.96))).stroke({ width: Math.max(2, Rs * 0.05), color: GOLD, alpha: 0.7 * fade });
    // The plasma core: a crisp flash that fades.
    const fl = Math.min(1, st / 0.12) * (1 - span(st, [0.25, 1.0]));
    if (fl > 0.01) {
      b.light.poly(flat(hexCorners(g.x, g.y, Rs * 0.96))).fill({ color: 0xfff0c8, alpha: 0.55 * fl });
      dot(b.pm, 0, g.x, g.y, Rs * 0.9, 0xffffff, fl);
      dot(b.pm, 0, g.x, g.y, Rs * 3.4, GOLD, 0.8 * fl);
      dot(b.pm, 0, g.x, g.y, Rs * 7, CLEAR, 0.35 * fl);
    }
    // The liberation wave: each sector's edge lights, ring by ring, crimson to the cleared colour.
    for (const [key, x, y] of env.centres?.() ?? []) {
      if (key === k.sector) continue;
      const d = R.get(key) ?? 1;
      const at = 0.35 + 1.0 * ((d - 1) / Math.max(1, maxD - 1));
      const sx = Sx + (x - cx) * z;
      const sy = Sy + (y - cy) * z;
      const pts = flat(hexCorners(sx, sy, Rs * 0.97));
      if (st < at) b.borders.poly(pts).stroke({ width: 1.5, color: CRIMSON, alpha: 0.35 * fade });
      else {
        const u = span(st, [at, at + 0.3]);
        b.borders.poly(pts).stroke({ width: 1.6 + 3 * (1 - u), color: mix(0xffffff, CLEAR, u), alpha: (0.45 + 0.55 * (1 - u)) * fade });
      }
    }
    drawTelemetry(T.telemetry[0] + 0.9, f, P, b.plate, b.hud, b.tele, dot, b.pm, fade);
  }
}

/** The rift into dark space under the shards: a jagged tear on the board that opens, pulses and collapses. */
function drawRift(t: number, Rs: number, P: Proj, glow: Graphics, body: Graphics, light: Graphics, far: Motes, pm: Motes, dot: Dot): void {
  const open = easeOut(span(t, [T.rift[0], T.rift[0] + 0.5])) * (1 - easeInOut(span(t, [T.implode[0], T.blast])));
  if (open <= 0.01) return;
  const pulse = riftPulse(t);
  const ang = 0.42;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const L = Rs * 1.05 * (0.6 + 0.4 * open);
  const W = Rs * 0.3 * open * (1 + 0.45 * pulse);
  const N = 22;
  /** The tear's edge at s (-1..1) on one side, jagged and crawling. */
  const edge = (s: number, side: number, grow = 1): [number, number] => {
    const jag = 0.78 + 0.16 * Math.sin(s * 5.1 + side * 2.1 + t * 2.3) + 0.08 * Math.sin(s * 13.7 - t * 4.1 + side);
    const half = W * grow * (1 - s * s) ** 0.75 * jag * side;
    const x = s * L;
    return [x * ca - half * sa, x * sa + half * ca];
  };
  const shape = (grow: number) => {
    const pts: number[] = [];
    for (let i = 0; i <= N; i++) {
      const [x, y] = edge(-1 + (2 * i) / N, 1, grow);
      const q = P(x, y, 0);
      pts.push(q.x, q.y);
    }
    for (let i = N - 1; i > 0; i--) {
      const [x, y] = edge(-1 + (2 * i) / N, -1, grow);
      const q = P(x, y, 0);
      pts.push(q.x, q.y);
    }
    return pts;
  };
  glow.poly(shape(2.6)).fill({ color: DEEP, alpha: 0.28 * open * (0.6 + 0.4 * pulse) });
  glow.poly(shape(1.6)).fill({ color: MAGENTA, alpha: 0.22 * open * (0.5 + 0.5 * pulse) });
  const inner = shape(1);
  body.poly(inner).fill({ color: 0x000000, alpha: 0.96 * open });
  light.poly(inner).stroke({ width: Rs * 0.05 * (1 + pulse), color: CRIMSON, alpha: 0.5 * open });
  light.poly(inner).stroke({ width: 1, color: HOT, alpha: 0.8 * open });
  // Its lips crackle with particles.
  for (let i = 0; i <= 26; i++) {
    const side = i % 2 ? 1 : -1;
    const sv = -0.95 + (1.9 * i) / 26;
    const [x, y] = edge(sv, side, 1);
    const q = P(x, y, 0);
    dot(pm, (i * 0.037) % 1, q.x, q.y, Rs * (0.05 + 0.04 * pulse) * (0.7 + 0.5 * Math.sin(t * 13 + i * 1.7)), i % 3 ? CRIMSON : HOT, 0.85 * open);
  }
  // Looking through it: dark matter swirling, far stars.
  for (const v of VOID) {
    const s = v.s + 0.06 * Math.sin(t * v.sp + v.ph);
    const [ex, ey] = edge(s, 1, 1);
    const [fx, fy] = edge(s, -1, 1);
    const m = 0.5 + 0.5 * v.v * Math.cos(t * v.sp * 0.7 + v.ph);
    const q = P(fx + (ex - fx) * m, fy + (ey - fy) * m, 0);
    if (v.star) dot(far, v.rank, q.x, q.y, Rs * 0.025, 0xdfe6ff, open * (0.5 + 0.5 * Math.sin(t * 4 + v.ph)));
    else dot(far, v.rank, q.x, q.y, Rs * 0.12, v.ph < 3 ? 0x3a1a7a : 0x1a2a6a, 0.45 * open, 2, ang);
  }
  // Particles spilling up out of its lips and falling back in; a flare of them on each pulse.
  for (const r of RIFT) {
    const u = (r.ph + t * r.sp) % 1;
    const [x, y] = edge(r.s * 0.9, r.side, 1);
    const q = P(x, y, Rs * r.up * Math.sin(Math.PI * u) * (0.6 + 0.6 * pulse));
    dot(pm, r.rank, q.x, q.y, Rs * 0.04 * r.size, u < 0.5 ? HOT : CRIMSON, open * Math.sin(Math.PI * u) * 0.9);
  }
  // The dark-matter core hanging over it, its corona swirling, beating with the pulse.
  const c = P(0, 0, Rs * 0.12);
  const rr = Rs * (0.1 + 0.07 * pulse) * open;
  dot(pm, 0, c.x, c.y, Rs * (0.9 + 0.8 * pulse), CRIMSON, 0.35 * open);
  body.circle(c.x, c.y, rr).fill({ color: 0x000000 });
  for (let j = 0; j < 18; j++) {
    const a = (j / 18) * Math.PI * 2 - t * 4;
    dot(pm, (j * 0.043) % 1, c.x + Math.cos(a) * rr * 1.15, c.y + Math.sin(a) * rr * 1.15, Math.max(2, rr * 0.4), pulse > 0.4 || j % 3 === 0 ? HOT : MAGENTA, 0.9 * open, 2.4, a + Math.PI / 2);
  }
  for (const m of CORONA) {
    const a = m.a + t * m.sp * 1.3;
    const r = rr * (1.4 + m.rr) + Rs * 0.04;
    dot(pm, m.rank, c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.8, Rs * 0.035 * m.size, m.rank < 0.5 ? MAGENTA : HOT, 0.8 * open, 2.5, a + Math.PI / 2);
  }
}

/** "TARGET NEUTRALIZED // SECTOR CLEAR": holographic telemetry over the crater, typed in, with ticks and a scan line. */
function drawTelemetry(t: number, f: Frame, P: Proj, plate: Graphics, hud: Graphics, tele: Text, dot: Dot, pm: Motes, fade = 1): void {
  const { Rs, R, Z, w } = f;
  const u = span(t, T.telemetry);
  const al = fade * Math.min(1, u * 8) * (1 - span(t, [7.55, T.telemetry[1]]));
  if (al <= 0.01) {
    tele.visible = false;
    return;
  }
  const words = "TARGET NEUTRALIZED // SECTOR CLEAR";
  const typed = f.still ? words.length : Math.round(words.length * span(t, [T.telemetry[0] + 0.05, T.telemetry[0] + 0.6]));
  const blink = !f.still && typed < words.length ? (Math.floor(t * 12) % 2 ? "▌" : " ") : "";
  const text = words.slice(0, typed) + blink;
  const fs = Math.round(Math.max(10, Math.min(18, R * Z * 0.17)));
  if (tele.style.fontSize !== fs) tele.style.fontSize = fs;
  if (tele.text !== text) tele.text = text;
  // Over the crater, kept on the screen.
  const c = P(0, 0, 0);
  const y = Math.max(fs * 2.4, c.y - Rs * 1.25);
  const x = Math.max(8 + tele.width / 2, Math.min(w - 8 - tele.width / 2, c.x));
  tele.visible = true;
  tele.position.set(x, y);
  tele.alpha = al * (0.85 + 0.15 * Math.sin(t * 40));
  // Brackets round the crater, ticks along a rule under the words, a scan line across the crater.
  const box = Rs * 1.12;
  const arm = Rs * 0.28;
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const px = c.x + sx * box;
    const py = c.y + sy * box * 0.78;
    hud.moveTo(px - sx * arm, py).lineTo(px, py).lineTo(px, py - sy * arm).stroke({ width: 1.5, color: CLEAR, alpha: 0.85 * al });
  }
  const rw = Math.max(tele.width, Rs * 2);
  const ry = y + fs * 0.35;
  plate.roundRect(x - rw / 2 - fs * 0.6, y - tele.height - fs * 0.35, rw + fs * 1.2, tele.height + fs * 1.4, 4).fill({ color: 0x03101a, alpha: 0.72 * al });
  hud.moveTo(x - rw / 2, ry).lineTo(x + rw / 2, ry).stroke({ width: 1, color: CLEAR, alpha: 0.6 * al });
  const ticks = 24;
  const shownTicks = f.still ? ticks : Math.round(ticks * span(t, [T.telemetry[0], T.telemetry[0] + 0.5]));
  for (let i = 0; i <= shownTicks; i++) {
    const tx = x - rw / 2 + (rw * i) / ticks;
    hud.moveTo(tx, ry).lineTo(tx, ry + (i % 6 === 0 ? fs * 0.5 : fs * 0.22)).stroke({ width: 1, color: CLEAR, alpha: 0.6 * al });
  }
  if (!f.still) {
    const su = (t * 0.9) % 1;
    const sy = c.y - box * 0.78 + su * box * 1.56;
    hud.moveTo(c.x - box, sy).lineTo(c.x + box, sy).stroke({ width: 1, color: ICE, alpha: 0.4 * al * Math.sin(Math.PI * su) });
    dot(pm, 0, c.x + box * (2 * ((t * 1.3) % 1) - 1), sy, Rs * 0.05, ICE, 0.7 * al);
  }
}
