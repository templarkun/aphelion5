/**
 * Murmuration, a mission win (designer 2026-11-27: "make 2 more ... be ambitious"; times in timeline.ts
 * MURMUR): a swarm of hundreds of drones of light claims the Field and forms an emblem round the banner.
 *
 * 1. (0-1.1 s) The Field dims. Streams of drones pour from every cell of the Mission bar down into the
 *    sector the unit left (the middle after the Developer tool) and wheel there as one flock.
 * 2. (1.1-3.15 s) The flock swoops from sector to sector over the whole Field (nearest first, a smooth
 *    curve through them), stretching into a tail and breathing in and out like a flock of starlings; each
 *    sector it passes is claimed: a tracer of particles runs round its edge, its tile is pushed along by
 *    the swarm's wind and settles, and its edge stays lit with gold corners.
 * 3. (3.15-4.6 s) The drones peel off and form an emblem round the middle of the Field (two hexagons
 *    and six spokes, slowly turning); it flares and the Mission bar turns gold; the banner sits inside it.
 * 4. (4.6-6.0 s) The emblem bursts: every drone streaks out off the Field; everything fades.
 *
 * Every drone's place is worked out from the time alone (the flock's path, the drone's lag behind its
 * head and its own wobble), never stepped frame by frame. A slow machine draws fewer drones (`q`), never
 * slower. The same colours for every Company. Screen only: no rule here.
 */

import { easeInOut } from "../anim.js";
import { MURMUR as M_, span } from "./timeline.js";
import { type Geo, hexPath, hexPts, puff, rgba, seq } from "./winKit.js";

const CYAN = "92 214 255";
const ICE = "190 240 255";
const WHITE = "255 255 255";
const VIOLET = "170 128 255";
const GOLD = "255 206 120";

/** The flock's way over the Field: the sectors in the order it visits them and when it reaches each. */
export interface Flight {
  /** Sector keys and centres (Field pixels), in order; the first is where the unit left. */
  stops: [string, number, number][];
  /** When the flock's head reaches each stop (s). */
  at: number[];
  /** Cumulative length along the curve to each stop (pixels). */
  len: number[];
}

/** When cell i of n releases its drones (s). */
export function swarmCellAt(i: number, n: number): number {
  const step = n > 1 ? Math.min(M_.cellStep, M_.cellsIn / (n - 1)) : 0;
  return M_.cellsAt + i * step;
}

/** The route's pace: 0..1 of the way at share u of the time (a gentle start and finish, never still between). */
export const pace = (u: number) => 0.75 * u + 0.25 * (3 * u * u - 2 * u * u * u);
function unpace(s: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (pace(m) < s) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** The flock's way: nearest unvisited sector each time, from the one nearest (ox, oy). */
export function flightOf(sectors: readonly (readonly [string, number, number])[], ox: number, oy: number): Flight {
  if (sectors.length === 0) return { stops: [["", ox, oy]], at: [M_.route[0]], len: [0] };
  const left = sectors.map((s) => [...s] as [string, number, number]);
  left.sort((a, b) => Math.hypot(a[1] - ox, a[2] - oy) - Math.hypot(b[1] - ox, b[2] - oy) || a[0].localeCompare(b[0]));
  const stops: [string, number, number][] = [left.shift()!];
  while (left.length) {
    const [, x, y] = stops[stops.length - 1]!;
    let best = 0;
    for (let i = 1; i < left.length; i++) if (Math.hypot(left[i]![1] - x, left[i]![2] - y) < Math.hypot(left[best]![1] - x, left[best]![2] - y) - 1e-6) best = i;
    stops.push(left.splice(best, 1)[0]!);
  }
  const len = [0];
  for (let i = 1; i < stops.length; i++) len.push(len[i - 1]! + Math.hypot(stops[i]![1] - stops[i - 1]![1], stops[i]![2] - stops[i - 1]![2]));
  const total = len[len.length - 1]! || 1;
  const at = len.map((l) => M_.route[0] + unpace(l / total) * (M_.route[1] - M_.route[0]));
  return { stops, at, len };
}

/** The flock's head at time t (Field pixels): a Catmull-Rom curve through the stops, at the route's pace. */
export function headAt(f: Flight, t: number): [number, number] {
  const n = f.stops.length;
  if (n === 1 || t <= M_.route[0]) return [f.stops[0]![1], f.stops[0]![2]];
  if (t >= M_.route[1]) return [f.stops[n - 1]![1], f.stops[n - 1]![2]];
  const total = f.len[n - 1]! || 1;
  const d = pace(span(t, M_.route)) * total;
  let i = 0;
  while (i < n - 2 && f.len[i + 1]! < d) i++;
  const seg = f.len[i + 1]! - f.len[i]! || 1;
  const u = (d - f.len[i]!) / seg;
  const P = (k: number) => f.stops[Math.max(0, Math.min(n - 1, k))]!;
  const [, x0, y0] = P(i - 1);
  const [, x1, y1] = P(i);
  const [, x2, y2] = P(i + 1);
  const [, x3, y3] = P(i + 2);
  const cr = (a: number, b: number, c: number, e: number) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - e) * u * u + (-a + 3 * b - 3 * c + e) * u * u * u);
  return [cr(x0, x1, x2, x3), cr(y0, y1, y2, y3)];
}

/** A claimed sector's tile: pushed along by the swarm's wind, then settling. */
export function murmurLook(f: Flight, i: number, t: number, tile: number): { dx: number; dy: number; scale: number } | undefined {
  const tc = f.at[i]!;
  const age = t - tc;
  const fl = t - M_.flare;
  const lift = fl >= 0 && fl < 0.5 ? 0.03 * Math.exp(-fl / 0.12) : 0;
  if (!(age >= 0 && age < 0.6) && !lift) return undefined;
  if (!(age >= 0 && age < 0.6)) return { dx: 0, dy: 0, scale: 1 + lift };
  const [ax, ay] = headAt(f, tc - 0.03);
  const [bx, by] = headAt(f, tc + 0.03);
  const L = Math.hypot(bx - ax, by - ay) || 1;
  const A = tile * 0.07 * Math.exp(-age / 0.13) * Math.cos(age * 16);
  return { dx: ((bx - ax) / L) * A, dy: ((by - ay) / L) * A - tile * 0.02 * Math.exp(-age / 0.1), scale: 1 + 0.05 * Math.exp(-age / 0.12) + lift };
}

// The drones, fixed once (each with a rank: a slow machine draws only those below its quality).
const N = 460;
const DRONES = (() => {
  const r = seq(4409);
  return Array.from({ length: N }, (_, i) => ({
    lag: r() ** 1.5,
    w1: 1.0 + r() * 1.4,
    w2: 2.2 + r() * 1.6,
    p1: r() * 6.3,
    p2: r() * 6.3,
    p3: r() * 6.3,
    p4: r() * 6.3,
    a1: 0.5 + r() * 0.6,
    a2: 0.15 + r() * 0.3,
    born: r() * 0.4,
    swirl: (r() - 0.5) * 2,
    // Evenly spread over the emblem, also for the first few (a slow machine draws only those).
    slot: (i * 0.6180339887) % 1,
    delay: r(),
    spin: (r() - 0.5) * 1.2,
    v: 0.6 + r() * 1.2,
    col: r(),
    rank: i / N,
  }));
})();

type Drone = (typeof DRONES)[number];

/** A drone's own wobble round the flock's head (Field pixels): the flock breathes in and out. */
function wobble(d: Drone, t: number, tile: number): [number, number] {
  const breath = 0.75 + 0.25 * Math.sin(t * 2.6);
  const R = tile * 0.55 * breath;
  return [R * (d.a1 * Math.sin(d.w1 * t + d.p1) + d.a2 * Math.sin(d.w2 * t + d.p2)), R * 0.8 * (d.a1 * Math.cos(d.w1 * 0.9 * t + d.p3) + d.a2 * Math.sin(d.w2 * 1.1 * t + d.p4))];
}

/** Where drone d is in the flock at time t (Field pixels): its lagged place on the path plus its wobble. */
function inFlock(f: Flight, d: Drone, t: number, tile: number): [number, number] {
  const [hx, hy] = headAt(f, t - d.lag * M_.lag);
  const [wx, wy] = wobble(d, t, tile);
  return [hx + wx, hy + wy];
}

/** The emblem's point for a drone (Field pixels, round the middle): two hexagons and six spokes, slowly turning. */
function emblem(d: Drone, cx: number, cy: number, Re: number, t: number): [number, number] {
  const turn = Math.max(0, t - M_.form[0]) * 0.22;
  const s = d.slot;
  let x: number;
  let y: number;
  if (s < 0.55 || s >= 0.8) {
    // On a hexagon (outer 55%, inner the last 20%): along its six sides.
    const inner = s >= 0.8;
    const u = inner ? (s - 0.8) / 0.2 : s / 0.55;
    const r = inner ? Re * 0.6 : Re;
    const rot = inner ? Math.PI / 6 : 0;
    const e = Math.floor(u * 6);
    const w = u * 6 - e;
    const a0 = rot - Math.PI / 2 + (e * Math.PI) / 3;
    const a1 = a0 + Math.PI / 3;
    x = r * (Math.cos(a0) + (Math.cos(a1) - Math.cos(a0)) * w);
    y = r * (Math.sin(a0) + (Math.sin(a1) - Math.sin(a0)) * w);
  } else {
    // On a spoke from the inner hexagon's corner to the outer one's.
    const u = (s - 0.55) / 0.25;
    const k = Math.floor(u * 6);
    const w = u * 6 - k;
    const a = -Math.PI / 2 + (k * Math.PI) / 3;
    const r = Re * (0.6 * Math.cos(Math.PI / 6) + (1 - 0.6 * Math.cos(Math.PI / 6)) * w);
    x = r * Math.cos(a);
    y = r * Math.sin(a);
  }
  const c = Math.cos(turn);
  const sn = Math.sin(turn);
  const jit = Re * 0.012;
  return [cx + x * c - y * sn + jit * Math.sin(t * 9 + d.p1), cy + (x * sn + y * c) * 0.9 + jit * Math.cos(t * 8 + d.p2)];
}

/** A drone's place on the page at time t, or undefined before it leaves its cell. */
function droneAt(geo: Geo, f: Flight, d: Drone, i: number, t: number): [number, number] | undefined {
  const { fx, fy, fw, fh, tile } = geo;
  const n = geo.cells.length;
  const page = ([x, y]: [number, number]) => [fx + x, fy + y] as [number, number];
  const cx = fw / 2;
  const cy = fh / 2;
  const Re = Math.min(fw, fh) * 0.4;
  if (t >= M_.burst) {
    const [ex, ey] = emblem(d, cx, cy, Re, M_.burst);
    const age = t - M_.burst;
    const a = Math.atan2(ey - cy, ex - cx) + d.spin * age;
    const dist = tile * d.v * (age * 2.2 + age * age * 7);
    return page([ex + Math.cos(a) * dist, ey + Math.sin(a) * dist]);
  }
  if (t >= M_.form[0]) {
    const e = easeInOut(span(t, [M_.form[0] + d.delay * 0.2, M_.form[1]]));
    const [ax, ay] = inFlock(f, d, t, tile);
    const [bx, by] = emblem(d, cx, cy, Re, t);
    return page([ax + (bx - ax) * e, ay + (by - ay) * e]);
  }
  // Act 1: from its cell (page) down into the flock.
  const cell = geo.cells.length ? geo.cells[i % n]! : undefined;
  const born = (cell ? swarmCellAt(i % n, n) : 0) + d.born;
  if (t < born) return undefined;
  const target = page(inFlock(f, d, t, tile));
  const u = span(t, [born, born + 0.6]);
  if (!cell || u >= 1) return target;
  const sx = cell.left + cell.width / 2;
  const sy = cell.top + cell.height / 2;
  const e = easeInOut(u);
  // A curve that swings out to one side on the way down.
  const mx = (sx + target[0]) / 2 + d.swirl * tile * 1.2;
  const my = (sy + target[1]) / 2;
  const x = (1 - e) ** 2 * sx + 2 * (1 - e) * e * mx + e * e * target[0];
  const y = (1 - e) ** 2 * sy + 2 * (1 - e) * e * my + e * e * target[1];
  return [x, y];
}

/**
 * One frame of Murmuration, drawn on MissionWin's page-wide canvas. `all` is how much of it shows (1 until
 * the cross-fade); `still`: the reduced-motion picture (every sector claimed, the emblem formed).
 */
export function paintMurmuration(g: CanvasRenderingContext2D, geo: Geo, t: number, still: boolean, all: number, q: number, f: Flight): void {
  const { fx, fy, fw, fh, tile } = geo;
  const R = tile * 0.46;
  const n = geo.cells.length;
  const keep = still ? 1 : 1 - span(t, [M_.burst, M_.out[1]]);
  const tt = still ? M_.form[1] + 0.4 : t;

  g.save();
  g.globalCompositeOperation = "lighter";
  // The cells: each lights as it releases its drones; gold once the emblem flares.
  geo.cells.forEach((c, i) => {
    const age = still ? 9 : t - swarmCellAt(i, n);
    if (age < 0) return;
    const x = c.left + c.width / 2;
    const y = c.top + c.height / 2;
    const s = Math.max(c.width, c.height);
    const k = Math.exp(-age / 0.15);
    const gold = still || t >= M_.flare;
    const fl = !still && t >= M_.flare ? Math.exp(-(t - M_.flare) / 0.2) : 0;
    const grd = g.createRadialGradient(x, y, 0, x, y, s * (1.3 + 1.2 * (k + fl)));
    grd.addColorStop(0, rgba(WHITE, (0.3 + 0.7 * (k + fl)) * all));
    grd.addColorStop(0.35, rgba(gold ? GOLD : CYAN, (0.3 + 0.3 * k) * all));
    grd.addColorStop(1, rgba(CYAN, 0));
    g.fillStyle = grd;
    g.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
  });
  g.restore();

  // The claimed sectors, on the Field.
  g.save();
  g.beginPath();
  g.rect(fx, fy, fw, fh);
  g.clip();
  g.globalCompositeOperation = "lighter";
  f.stops.forEach(([key, sx, sy], i) => {
    if (!key) return;
    const age = still ? 9 : t - f.at[i]!;
    if (age < 0) return;
    const x = fx + sx;
    const y = fy + sy;
    const k = Math.exp(-age / 0.14);
    if (k > 0.02) {
      hexPath(g, x, y, R);
      g.fillStyle = rgba(ICE, 0.18 * k * all);
      g.fill();
    }
    // The tracer: particles run once round the edge from the side the swarm came in.
    const pts = hexPts(x, y, R * 0.95);
    const run = Math.min(1, age / 0.28);
    const m = Math.round(24 * q);
    for (let j = 0; j < m; j++) {
      const w = (j / m) * run;
      const e = Math.floor(w * 6) % 6;
      const v = w * 6 - Math.floor(w * 6);
      const [ax, ay] = pts[e]!;
      const [bx, by] = pts[(e + 1) % 6]!;
      const head = run < 1 && j / m > run - 0.1;
      puff(g, head ? WHITE : CYAN, ax + (bx - ax) * v, ay + (by - ay) * v, R * (head ? 0.09 : 0.05), (head ? 1 : 0.35 + 0.5 * k) * keep * all);
    }
    for (const [px, py] of pts) puff(g, GOLD, px, py, R * 0.07, Math.min(1, age / 0.3) * 0.8 * keep * all);
  });
  // The flock's glow round its head while it flies.
  if (!still && t >= M_.gather - 0.4 && t < M_.form[1]) {
    const [hx, hy] = headAt(f, t);
    const a = Math.min(1, (t - (M_.gather - 0.4)) / 0.4) * (1 - span(t, M_.form));
    puff(g, CYAN, fx + hx, fy + hy, tile * 1.1, 0.16 * a * all);
  }
  // The emblem's flare.
  if (!still && t >= M_.flare && t < M_.flare + 0.6) {
    const age = t - M_.flare;
    const k = Math.exp(-age / 0.15);
    puff(g, WHITE, fx + fw / 2, fy + fh / 2, Math.min(fw, fh) * (0.3 + 0.3 * (1 - k)), 0.35 * k * all);
  }
  g.restore();

  // The drones: a streak from where each was a moment ago, and a bright head. Not clipped: they come from the bar.
  g.save();
  g.globalCompositeOperation = "lighter";
  const glow = !still && t >= M_.flare && t < M_.flare + 0.5 ? Math.exp(-(t - M_.flare) / 0.15) : 0;
  const fadeOut = still ? 1 : t >= M_.burst ? 1 - span(t, [M_.burst + 0.2, M_.burst + 1.0]) : 1;
  g.lineCap = "round";
  for (let i = 0; i < N; i++) {
    const d = DRONES[i]!;
    if (d.rank > q) continue;
    const p = droneAt(geo, f, d, i, tt);
    if (!p) continue;
    const back = still ? undefined : droneAt(geo, f, d, i, tt - 0.018);
    const col = d.col < 0.1 ? GOLD : d.col < 0.18 ? VIOLET : d.col < 0.45 ? ICE : CYAN;
    const a = (0.75 + 0.25 * Math.sin(t * 13 + i)) * fadeOut * all;
    if (back && Math.hypot(p[0] - back[0], p[1] - back[1]) > 1.5) {
      g.strokeStyle = rgba(col, 0.3 * a);
      g.lineWidth = Math.max(0.8, tile * 0.008);
      g.beginPath();
      g.moveTo(back[0], back[1]);
      g.lineTo(p[0], p[1]);
      g.stroke();
    }
    puff(g, glow > 0.05 && d.col > 0.45 ? WHITE : col, p[0], p[1], tile * (0.028 + 0.02 * glow), a);
  }
  g.restore();
}
