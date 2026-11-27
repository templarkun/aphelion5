/**
 * Chain Surge, a mission win (designer 2026-11-27: "be creative and put more effort"; times in
 * timeline.ts SURGE): the win as a surge of lightning that runs through the whole Field and back.
 *
 * 1. (0-0.9 s) The Field dims. An arc runs cell to cell along the Mission bar, lighting each; from the
 *    last one a bolt drops into the sector the unit left (the middle after the Developer tool).
 * 2. (0.9-2.85 s) The surge leaps sector to sector, outwards from there along the Field's own
 *    neighbours (a tree, breadth first): each leap a jagged bolt with a white core, a cyan body and
 *    particles riding it; each sector struck flashes its edge, throws sparks and jumps a little; every
 *    leap settles into a faint, flickering link, so the Field ends up wired together.
 * 3. (2.85-3.9 s) Light packets run along every link back to where it began; a bolt climbs from there
 *    to the Mission bar, which turns gold; the standard banner slams in.
 * 4. (3.9-5.4 s) The network crumbles into motes that rise and fade; everything cross-fades out.
 *
 * Every moving thing is worked out from the time alone (a bolt's jagged path is redrawn from a seed that
 * changes every 50 ms, never from the frame before). A slow machine draws fewer particles and no glow
 * passes (`q`), never slower. The same colours for every Company. Screen only: no rule here.
 */

import { easeOut } from "../anim.js";
import { SURGE, span } from "./timeline.js";
import { type Geo, hexPath, hexPts, puff, rgba, seq } from "./winKit.js";

const CYAN = "92 214 255";
const ICE = "190 240 255";
const WHITE = "255 255 255";
const VIOLET = "170 128 255";
const GOLD = "255 206 120";

/** One leap of the surge: from a sector (or the Mission bar for the first) to a sector. */
export interface Leap {
  key: string;
  /** The sector it leaps from (undefined: the first sector, struck from the Mission bar). */
  from: string | undefined;
  depth: number;
  /** When it strikes (s). */
  at: number;
}

/** When cell i of n lights (s). */
export function surgeCellAt(i: number, n: number): number {
  const step = n > 1 ? Math.min(SURGE.cellStep, SURGE.cellsIn / (n - 1)) : 0;
  return SURGE.cellsAt + i * step;
}

/**
 * The surge's way through the Field: breadth first from the sector nearest (ox, oy), along neighbours
 * (centres less than a tile apart); a sector no neighbour reaches (a hole in the Field) is struck from
 * the nearest one already lit. Every sector is struck by spread[1].
 */
export function surgeTree(sectors: readonly (readonly [string, number, number])[], tile: number, ox: number, oy: number): Leap[] {
  if (sectors.length === 0) return [];
  const pos = new Map(sectors.map(([k, x, y]) => [k, [x, y] as const]));
  const first = [...sectors].sort((a, b) => Math.hypot(a[1] - ox, a[2] - oy) - Math.hypot(b[1] - ox, b[2] - oy))[0]![0];
  const depth = new Map<string, number>([[first, 0]]);
  const parent = new Map<string, string | undefined>([[first, undefined]]);
  const order: string[] = [first];
  const near = (a: string, b: string) => {
    const p = pos.get(a)!;
    const q = pos.get(b)!;
    return Math.hypot(p[0] - q[0], p[1] - q[1]);
  };
  const keys = sectors.map(([k]) => k).sort();
  let head = 0;
  while (order.length < keys.length) {
    while (head < order.length) {
      const k = order[head++]!;
      for (const o of keys) if (!depth.has(o) && near(k, o) < tile * 1.0) (depth.set(o, depth.get(k)! + 1), parent.set(o, k), order.push(o));
    }
    if (order.length >= keys.length) break;
    // A hole: the nearest unlit sector to any lit one is struck from it.
    let best: [string, string, number] | undefined;
    for (const o of keys) {
      if (depth.has(o)) continue;
      for (const k of order) {
        const d = near(k, o);
        if (!best || d < best[2]) best = [o, k, d];
      }
    }
    const [o, k] = best!;
    depth.set(o, depth.get(k)! + 1);
    parent.set(o, k);
    order.push(o);
  }
  const deepest = Math.max(1, ...depth.values());
  const hop = Math.min(SURGE.maxHop, (SURGE.spread[1] - SURGE.spread[0] - 0.06) / deepest);
  // Within one depth the leaps are a little apart (a crackle, not a single clap), by angle round the start.
  const angle = (k: string) => {
    const p = pos.get(k)!;
    return (Math.atan2(p[1] - oy, p[0] - ox) + Math.PI * 2.5) % (Math.PI * 2);
  };
  return order.map((k) => {
    const d = depth.get(k)!;
    const jitter = d === 0 ? 0 : (angle(k) / (Math.PI * 2)) * Math.min(0.06, hop * 0.35);
    return { key: k, from: parent.get(k), depth: d, at: SURGE.spread[0] + d * hop + jitter };
  });
}

/** How long a leap takes to reach its sector (s): the bolt grows from where it leaps. */
export const leapGrow = (depth: number) => (depth === 0 ? SURGE.drop[1] - SURGE.drop[0] : 0.07);

/** A struck sector's tile: it jumps (a short lift and a ring of settling), then rests. */
export function surgeLook(age: number, tile: number): { dx: number; dy: number; scale: number } | undefined {
  if (!(age >= 0 && age < 0.5)) return undefined;
  const k = Math.exp(-age / 0.09);
  return { dx: 0, dy: -tile * 0.05 * k, scale: 1 + 0.075 * k + 0.02 * Math.sin(age * 34) * Math.exp(-age / 0.14) };
}

/** When the packets on a leap of this depth run home (s), the deepest first, the last reaching the start at pulse[1]. */
export function packetSpan(depth: number, deepest: number): [number, number] {
  const D = Math.max(1, deepest);
  const h = (SURGE.pulse[1] - SURGE.pulse[0]) / D;
  const a = SURGE.pulse[0] + (D - depth) * h;
  return [a, a + h];
}

// --- Lightning -----------------------------------------------------------------------------------------

/** A jagged path from (x0, y0) to (x1, y1): midpoint displacement, from a seed (the same seed, the same bolt). */
function boltPath(x0: number, y0: number, x1: number, y1: number, seed: number, rough: number, levels: number): [number, number][] {
  const r = seq(seed);
  let pts: [number, number][] = [
    [x0, y0],
    [x1, y1],
  ];
  const L = Math.hypot(x1 - x0, y1 - y0);
  const nx = L > 0 ? -(y1 - y0) / L : 0;
  const ny = L > 0 ? (x1 - x0) / L : 1;
  let amp = L * rough;
  for (let lv = 0; lv < levels; lv++) {
    const next: [number, number][] = [pts[0]!];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1]!;
      const [bx, by] = pts[i]!;
      const off = (r() - 0.5) * 2 * amp;
      next.push([(ax + bx) / 2 + nx * off, (ay + by) / 2 + ny * off], [bx, by]);
    }
    pts = next;
    amp *= 0.52;
  }
  return pts;
}

/** The part of a path up to share u of its length (the bolt growing), and its end. */
function cut(pts: [number, number][], u: number): [number, number][] {
  if (u >= 1) return pts;
  const n = pts.length - 1;
  const f = Math.max(0, u) * n;
  const i = Math.floor(f);
  const out = pts.slice(0, i + 1);
  const a = pts[i]!;
  const b = pts[Math.min(n, i + 1)]!;
  out.push([a[0] + (b[0] - a[0]) * (f - i), a[1] + (b[1] - a[1]) * (f - i)]);
  return out;
}

function stroke(g: CanvasRenderingContext2D, pts: [number, number][], rgb: string, a: number, w: number): void {
  if (a <= 0.004 || pts.length < 2) return;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.strokeStyle = rgba(rgb, a);
  g.lineWidth = w;
  g.stroke();
}

/**
 * One lightning bolt: a wide soft glow, a cyan body, a white core, a fork or two, and particles riding
 * it. `u` how far it has grown (0-1), `a` how bright, `w` the width scale (pixels).
 */
function bolt(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, seed: number, t: number, u: number, a: number, w: number, q: number): void {
  if (a <= 0.01 || u <= 0) return;
  const tick = Math.floor(t / 0.05);
  const pts = cut(boltPath(x0, y0, x1, y1, seed * 977 + tick * 131, 0.16, 5), u);
  if (q > 0.6) stroke(g, pts, CYAN, 0.16 * a, w * 5);
  stroke(g, pts, CYAN, 0.6 * a, w * 1.8);
  stroke(g, pts, WHITE, 0.95 * a, Math.max(1, w * 0.7));
  // Forks off the main path (fewer on a slow machine).
  const r = seq(seed * 31 + tick * 7);
  const forks = q > 0.75 ? 2 : q > 0.5 ? 1 : 0;
  for (let f = 0; f < forks; f++) {
    const at = 0.25 + r() * 0.5;
    const [fx0, fy0] = pts[Math.min(pts.length - 1, Math.floor(at * (pts.length - 1)))]!;
    const L = Math.hypot(x1 - x0, y1 - y0) * (0.18 + r() * 0.22);
    const dir = Math.atan2(y1 - y0, x1 - x0) + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.7);
    const fp = boltPath(fx0, fy0, fx0 + Math.cos(dir) * L, fy0 + Math.sin(dir) * L, seed * 53 + tick * 17 + f, 0.22, 3);
    stroke(g, fp, CYAN, 0.45 * a, w * 0.9);
    stroke(g, fp, ICE, 0.7 * a, Math.max(0.6, w * 0.35));
  }
  // Particles riding it: they are what the bolt is made of.
  const n = Math.round(10 * q);
  for (let i = 0; i < n; i++) {
    const p = (i / n + t * 2.6 + seed * 0.137) % 1;
    if (p > u) continue;
    const [px, py] = pts[Math.min(pts.length - 1, Math.floor(p * (pts.length - 1)))]!;
    puff(g, i % 3 ? CYAN : WHITE, px, py, w * (1.2 + (i % 4) * 0.5), 0.8 * a);
  }
}

// Particles fixed once (each with a rank: a slow machine draws only those below its quality).
const SPARKS = (() => {
  const r = seq(8807);
  return Array.from({ length: 14 }, (_, i) => ({ a: r() * Math.PI * 2, v: 0.5 + r() * 1.3, life: 0.3 + r() * 0.45, size: 0.6 + r(), white: r() < 0.4, rank: i / 14 }));
})();
const MOTES = (() => {
  const r = seq(4471);
  return Array.from({ length: 9 }, (_, i) => ({ at: (i + r() * 0.8) / 9, born: r() * 0.5, life: 0.8 + r() * 0.7, rise: 0.5 + r() * 0.9, drift: (r() - 0.5) * 0.6, size: 0.6 + r() * 0.9, violet: r() < 0.3, rank: i / 9 }));
})();
const CROWN = (() => {
  const r = seq(1907);
  return Array.from({ length: 26 }, (_, i) => ({ a: r() * Math.PI * 2, v: 0.6 + r() * 1.8, life: 0.4 + r() * 0.5, gold: r() < 0.5, rank: i / 26 }));
})();

/** A struck sector's edge: white flash with spokes to its corners, then a steady, faintly flickering cyan line. */
function struckEdge(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, age: number, t: number, all: number, settle: number, q: number, seed: number): void {
  if (age < 0) return;
  const k = Math.exp(-age / 0.16);
  if (k > 0.02) {
    hexPath(g, cx, cy, R);
    g.fillStyle = rgba(ICE, 0.22 * k * all);
    g.fill();
    if (q > 0.6) {
      g.strokeStyle = rgba(CYAN, 0.3 * k * all);
      g.lineWidth = R * 0.2;
      g.stroke();
    }
    // Spokes: the charge runs out to the six corners as streams of particles.
    const pts = hexPts(cx, cy, R);
    const reach = easeOut(Math.min(1, age / 0.1));
    const per = q > 0.75 ? 6 : q > 0.5 ? 4 : 3;
    for (const [x, y] of pts)
      for (let j = 1; j <= per; j++) {
        const f = (j / per) * reach;
        puff(g, j === per ? WHITE : ICE, cx + (x - cx) * f, cy + (y - cy) * f, R * (0.05 + 0.04 * (j === per ? 1 : 0)), 0.85 * k * all);
      }
    puff(g, WHITE, cx, cy, R * (0.5 + 0.6 * k), 0.8 * k * all);
  }
  // The steady edge, flickering like a live wire.
  const flick = 0.75 + 0.25 * Math.sin(t * 41 + seed) * Math.sin(t * 17 + seed * 2);
  const a = Math.min(1, age / 0.2) * settle * all;
  hexPath(g, cx, cy, R * 0.95);
  g.strokeStyle = rgba(k > 0.3 ? WHITE : CYAN, (0.5 * flick + 0.5 * k) * a);
  g.lineWidth = 1 + 1.6 * k;
  g.stroke();
  // Sparks thrown off as it is struck.
  for (const s of SPARKS) {
    if (s.rank > q || age > s.life) continue;
    const u = age / s.life;
    const d = R * s.v * 1.6 * (1 - Math.exp(-age * 7));
    const x = cx + Math.cos(s.a + seed) * d;
    const y = cy + Math.sin(s.a + seed) * d + R * 2.2 * age * age;
    puff(g, s.white ? WHITE : CYAN, x, y, R * 0.07 * s.size * (1 - 0.5 * u), (1 - u) * all);
  }
}

/**
 * One frame of Chain Surge, drawn on MissionWin's page-wide canvas. `all` is how much of it shows (1 until
 * the cross-fade); `still`: the reduced-motion picture (the bar lit, the Field wired, the start glowing).
 */
export function paintSurge(g: CanvasRenderingContext2D, geo: Geo, t: number, still: boolean, all: number, q: number, leaps: Leap[]): void {
  const { fx, fy, fw, fh, tile } = geo;
  const R = tile * 0.46;
  const n = geo.cells.length;
  const at = new Map(geo.sectors.map(([k, x, y]) => [k, [fx + x, fy + y] as const]));
  const cellMid = (c: DOMRect) => [c.left + c.width / 2, c.top + c.height / 2] as const;
  const lastCell = geo.cells[n - 1];
  const barEnd = lastCell ? cellMid(lastCell) : ([fx + fw / 2, fy - 20] as const);
  const deepest = Math.max(1, ...leaps.map((l) => l.depth));
  const home = leaps[0];
  const homeAt = home ? at.get(home.key) : undefined;
  // How much of the network still stands (it crumbles in act 4).
  const stand = still ? 1 : 1 - span(t, [SURGE.crumble, SURGE.crumble + 0.5]);

  g.save();
  g.globalCompositeOperation = "lighter";

  // Act 1: the arc runs cell to cell; each lights; they stay lit.
  geo.cells.forEach((c, i) => {
    const on = still ? 9 : t - surgeCellAt(i, n);
    if (on < 0) return;
    const [x, y] = cellMid(c);
    const s = Math.max(c.width, c.height);
    const k = Math.exp(-on / 0.14);
    const glow = 0.3 + 0.9 * k;
    const Rg = s * (1.3 + 1.4 * k);
    const grd = g.createRadialGradient(x, y, 0, x, y, Rg);
    grd.addColorStop(0, rgba(WHITE, glow * all));
    grd.addColorStop(0.3, rgba(CYAN, 0.55 * glow * all));
    grd.addColorStop(1, rgba(CYAN, 0));
    g.fillStyle = grd;
    g.fillRect(x - Rg, y - Rg, 2 * Rg, 2 * Rg);
    // The arc from the cell before.
    if (i > 0 && !still) {
      const [px, py] = cellMid(geo.cells[i - 1]!);
      const age = on;
      const grow = Math.min(1, (age + 0.06) / 0.06);
      const a = age < SURGE.arc ? 1 - 0.6 * (age / SURGE.arc) : 0.4 * stand * (1 - span(t, [SURGE.drop[1], SURGE.drop[1] + 0.6]));
      bolt(g, px, py, x, y, 50 + i, t, grow, a * all, Math.max(1.2, s * 0.08), q);
    }
  });

  // The bolt down from the last cell into the first sector, and the uplink back in act 3.
  if (!still && homeAt && lastCell) {
    const [x0, y0] = barEnd;
    const [x1, y1] = homeAt;
    if (t >= SURGE.drop[0] && t < SURGE.drop[1] + 0.35) {
      const u = easeOut(span(t, SURGE.drop));
      const a = t < SURGE.drop[1] ? 1 : 1 - (t - SURGE.drop[1]) / 0.35;
      bolt(g, x0, y0, x1, y1, 7, t, u, a * all, Math.max(1.6, tile * 0.03), q);
    }
    if (t >= SURGE.uplink[0] && t < SURGE.uplink[1] + 0.4) {
      const u = easeOut(span(t, SURGE.uplink));
      const a = t < SURGE.uplink[1] ? 1 : 1 - (t - SURGE.uplink[1]) / 0.4;
      bolt(g, x1, y1, x0, y0, 9, t, u, a * all, Math.max(2, tile * 0.04), q);
    }
    // The bar takes the charge: a gold crown of sparks round the last cell.
    const age = t - SURGE.uplink[1];
    if (age >= 0 && age < 1) {
      const s = Math.max(14, lastCell.height * 1.4);
      const k = Math.exp(-age / 0.2);
      const fl = g.createRadialGradient(x0, y0, 0, x0, y0, s * 3);
      fl.addColorStop(0, rgba(WHITE, 0.9 * k * all));
      fl.addColorStop(0.3, rgba(GOLD, 0.5 * k * all));
      fl.addColorStop(1, rgba(GOLD, 0));
      g.fillStyle = fl;
      g.fillRect(x0 - s * 3, y0 - s * 3, s * 6, s * 6);
      for (const c of CROWN) {
        if (c.rank > q || age > c.life) continue;
        const u = age / c.life;
        const d = s * c.v * 2 * (1 - Math.exp(-age * 6));
        puff(g, c.gold ? GOLD : WHITE, x0 + Math.cos(c.a) * d, y0 + Math.sin(c.a) * d + s * age * age * 3, s * 0.12, (1 - u) * all);
      }
    }
  }
  g.restore();

  // Act 2 and on: the Field, clipped to itself.
  g.save();
  g.beginPath();
  g.rect(fx, fy, fw, fh);
  g.clip();
  g.globalCompositeOperation = "lighter";
  leaps.forEach((l, i) => {
    const p1 = at.get(l.key);
    if (!p1) return;
    const age = still ? 9 : t - l.at;
    const p0 = l.from ? at.get(l.from) : undefined;
    // The leap: growing towards the sector, a flash at the strike, then a faint live link.
    if (p0 && stand > 0) {
      const grow = leapGrow(l.depth);
      const u = still ? 1 : span(t, [l.at - grow, l.at]);
      if (u > 0) {
        const a = still ? 0.22 : age < 0 ? 1 : age < SURGE.arc ? 1 - 0.78 * easeOut(age / SURGE.arc) : 0.22 * (0.7 + 0.3 * Math.sin(t * 23 + i * 1.7));
        bolt(g, p0[0], p0[1], p1[0], p1[1], 100 + i, still ? 0 : t, u, a * all * stand, Math.max(1, tile * (age < SURGE.arc ? 0.022 : 0.012)), age < SURGE.arc ? q : q * 0.5);
      }
    }
    struckEdge(g, p1[0], p1[1], R, age, still ? 0 : t, all, stand, q, i * 2.3);
    // Act 3: a packet runs home along the link (child to parent).
    if (!still && p0) {
      const [a0, a1] = packetSpan(l.depth, deepest);
      const u = span(t, [a0, a1]);
      if (u > 0 && u < 1) {
        const x = p1[0] + (p0[0] - p1[0]) * u;
        const y = p1[1] + (p0[1] - p1[1]) * u;
        // A comet of particles: a bright head and a fading tail behind it.
        puff(g, CYAN, x, y, tile * 0.16, 0.5 * all);
        puff(g, WHITE, x, y, tile * 0.07, 0.95 * all);
        const tail = q > 0.6 ? 7 : 4;
        for (let j = 1; j <= tail; j++) {
          const v = Math.max(0, u - j * 0.045);
          const f = 1 - j / (tail + 1);
          const wob = Math.sin(t * 40 + j * 1.9 + i) * tile * 0.015 * j;
          puff(g, j % 2 ? ICE : CYAN, p1[0] + (p0[0] - p1[0]) * v + wob, p1[1] + (p0[1] - p1[1]) * v - wob, tile * 0.05 * f + 0.5, 0.75 * f * all);
        }
      }
      // Its sector glows as the packet leaves it.
      if (t >= a0 && t < a0 + 0.3) puff(g, ICE, p1[0], p1[1], R * 0.9, 0.35 * (1 - (t - a0) / 0.3) * all);
    }
  });
  // The start gathers the charge as the packets come home, then fires it up.
  if (homeAt) {
    const [hx, hy] = homeAt;
    const fill = still ? 0.7 : span(t, [SURGE.pulse[0], SURGE.uplink[0]]) * (1 - span(t, [SURGE.uplink[1], SURGE.uplink[1] + 0.6]));
    if (fill > 0) {
      const pulse = 0.85 + 0.15 * Math.sin(t * 30);
      puff(g, CYAN, hx, hy, R * (1 + 1.2 * fill) * pulse, 0.6 * fill * all);
      puff(g, WHITE, hx, hy, R * 0.6 * fill, 0.9 * fill * all);
    }
  }
  // Act 4: the network crumbles into motes that rise (from the links and the edges).
  if (!still && t >= SURGE.crumble) {
    const age0 = t - SURGE.crumble;
    leaps.forEach((l, i) => {
      const p1 = at.get(l.key);
      if (!p1) return;
      const p0 = (l.from ? at.get(l.from) : undefined) ?? p1;
      for (const m of MOTES) {
        if (m.rank > q) continue;
        const age = age0 - m.born * 0.6 - (i % 7) * 0.03;
        if (age < 0 || age > m.life) continue;
        const u = age / m.life;
        const x = p0[0] + (p1[0] - p0[0]) * m.at + Math.sin(age * 3 + i) * tile * 0.08 + m.drift * tile * u;
        const y = p0[1] + (p1[1] - p0[1]) * m.at - m.rise * tile * u;
        puff(g, m.violet ? VIOLET : CYAN, x, y, tile * 0.035 * m.size * (1 - 0.4 * u), Math.sin(Math.PI * Math.min(1, u * 1.4)) * 0.85 * all);
      }
    });
  }
  g.restore();
}
