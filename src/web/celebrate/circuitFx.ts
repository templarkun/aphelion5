/**
 * Circuit Trace, a mission win (designer 2026-11-28: "create 2 more ... be ambitious"; times in
 * timeline.ts CIRCUIT): the board becomes a circuit. A pulse from the Mission bar runs into the gutters
 * between the sectors and spreads along every edge; each sector powers up as its six edges close.
 *
 * 1. (0-0.9 s) The Field dims; a faint blueprint of every sector's edges shows in the gutters; the
 *    Mission bar's cells light one by one and a pulse drops from the bar into the board's top corner.
 * 2. (0.9-3.2 s) Traces of particles run along the edges from that corner, forking at every corner of
 *    every sector (each edge lit from whichever end the trace reaches first; two traces meeting in the
 *    middle of an edge spark). When a sector's last edge closes it powers up: a flash, three traces run
 *    in from its corners to a node in its middle, its tile jolts.
 * 3. (3.2-4.4 s) Packets of light race round the whole circuit; it locks gold, every tile pops, the bar
 *    turns gold; the banner.
 * 4. (4.4-5.6 s) The traces cool from the edge of the Field inwards, throwing off sparks; everything fades.
 *
 * The circuit is laid once from the sectors' centres (`circuitOf`); every trace's place is worked out
 * from the time alone, never stepped frame by frame. A slow machine draws fewer particles (`q`), never
 * slower. The same colours for every Company. Screen only: no rule here.
 */

import { CIRCUIT as C_, span } from "./timeline.js";
import { type Geo, hexPts, puff, rgba } from "./winKit.js";

const CYAN = "92 214 255";
const ICE = "190 240 255";
const WHITE = "255 255 255";
const VIOLET = "170 128 255";
const GOLD = "255 206 120";

/** The board as a circuit: corners, edges (the sectors' sides; `jump` = a leap between two parts of the board that do not touch), and when the trace reaches each corner. */
export interface Circuit {
  /** Corner radius (Field pixels): half the gap between two sectors' centres over cos 30. */
  r: number;
  verts: [number, number][];
  edges: { a: number; b: number; len: number; jump: boolean }[];
  /** When the trace reaches each corner (s). */
  at: number[];
  /** The trace's speed (pixels a second). */
  speed: number;
  /** The corner it enters by. */
  entry: number;
  /** Each sector's corners, and when its last edge closes (s). */
  sectors: { key: string; x: number; y: number; corners: number[]; closes: number }[];
}

/** When cell i of n lights (s). */
export function circuitCellAt(i: number, n: number): number {
  const step = n > 1 ? Math.min(C_.cellStep, C_.cellsIn / (n - 1)) : 0;
  return C_.cellsAt + i * step;
}

/** The time the trace reaches a point s pixels along edge e (from its end a). */
export function litAt(c: Circuit, e: number, s: number): number {
  const ed = c.edges[e]!;
  return Math.min(c.at[ed.a]! + s / c.speed, c.at[ed.b]! + (ed.len - s) / c.speed);
}

/** When edge e is lit along its whole length (its two traces meet). */
export function edgeDone(c: Circuit, e: number): number {
  const ed = c.edges[e]!;
  return Math.min(Math.max(c.at[ed.a]!, c.at[ed.b]!), (c.at[ed.a]! + c.at[ed.b]! + ed.len / c.speed) / 2);
}

/** Lay the circuit: the sectors' corners, merged where sectors touch; the trace enters at the top corner nearest the middle and spreads by the shortest way. */
export function circuitOf(sectors: readonly (readonly [string, number, number])[], fw: number, tile: number): Circuit {
  let d = Infinity;
  for (let i = 0; i < sectors.length; i++) for (let j = i + 1; j < sectors.length; j++) d = Math.min(d, Math.hypot(sectors[i]![1] - sectors[j]![1], sectors[i]![2] - sectors[j]![2]));
  if (!Number.isFinite(d) || d <= 0) d = tile;
  const r = d / Math.sqrt(3);
  const verts: [number, number][] = [];
  const vid = (x: number, y: number) => {
    for (let i = 0; i < verts.length; i++) if (Math.hypot(verts[i]![0] - x, verts[i]![1] - y) < r * 0.2) return i;
    verts.push([x, y]);
    return verts.length - 1;
  };
  const edges: Circuit["edges"] = [];
  const has = new Set<string>();
  const secs = sectors.map(([key, x, y]) => {
    const corners = hexPts(x, y, r).map(([px, py]) => vid(px, py));
    for (let i = 0; i < 6; i++) {
      const a = corners[i]!;
      const b = corners[(i + 1) % 6]!;
      const k = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (has.has(k)) continue;
      has.add(k);
      edges.push({ a, b, len: Math.hypot(verts[a]![0] - verts[b]![0], verts[a]![1] - verts[b]![1]), jump: false });
    }
    return { key, x, y, corners, closes: 0 };
  });
  const V = verts.length;
  let entry = 0;
  for (let i = 1; i < V; i++) {
    const s = (v: [number, number]) => v[1] + Math.abs(v[0] - fw / 2) * 0.35;
    if (s(verts[i]!) < s(verts[entry]!) - 1e-6) entry = i;
  }
  // Shortest ways from the entry (Dijkstra on a small board); parts that do not touch are joined by a jump.
  const dist = new Array<number>(V).fill(Infinity);
  const adj = (): number[][] => {
    const l: number[][] = Array.from({ length: V }, () => []);
    edges.forEach((e, i) => (l[e.a]!.push(i), l[e.b]!.push(i)));
    return l;
  };
  if (V) dist[entry] = 0;
  for (;;) {
    const list = adj();
    const done = new Array<boolean>(V).fill(false);
    for (;;) {
      let u = -1;
      for (let i = 0; i < V; i++) if (!done[i] && dist[i]! < Infinity && (u < 0 || dist[i]! < dist[u]!)) u = i;
      if (u < 0) break;
      done[u] = true;
      for (const ei of list[u]!) {
        const e = edges[ei]!;
        const w = e.a === u ? e.b : e.a;
        if (dist[u]! + e.len < dist[w]!) dist[w] = dist[u]! + e.len;
      }
    }
    let best: [number, number, number] | undefined;
    for (let i = 0; i < V; i++) {
      if (dist[i] !== Infinity) continue;
      for (let j = 0; j < V; j++) {
        if (dist[j] === Infinity) continue;
        const g = Math.hypot(verts[i]![0] - verts[j]![0], verts[i]![1] - verts[j]![1]);
        if (!best || g < best[2]) best = [j, i, g];
      }
    }
    if (!best) break;
    edges.push({ a: best[0], b: best[1], len: best[2], jump: true });
  }
  const far = Math.max(1, ...dist.filter((x) => Number.isFinite(x)));
  const speed = far / (C_.run[1] - C_.run[0]);
  const at = dist.map((x) => C_.run[0] + x / speed);
  const c: Circuit = { r, verts, edges, at, speed, entry, sectors: secs };
  const edgeOf = new Map(edges.map((e, i) => [e.a < e.b ? `${e.a}-${e.b}` : `${e.b}-${e.a}`, i]));
  for (const s of secs) {
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const a = s.corners[i]!;
      const b = s.corners[(i + 1) % 6]!;
      last = Math.max(last, edgeDone(c, edgeOf.get(a < b ? `${a}-${b}` : `${b}-${a}`)!));
    }
    s.closes = last;
  }
  return c;
}

/** A tile's look: a jolt as its sector powers up, a pop at the lock. */
export function circuitLook(closes: number, t: number, tile: number): { dx: number; dy: number; scale: number } | undefined {
  const a = t - closes;
  const p = a >= 0 && a < 0.5 ? Math.exp(-a / 0.09) * Math.cos(a * 30) : 0;
  const l = t - C_.lock;
  const b = l >= 0 && l < 0.6 ? Math.exp(-l / 0.12) * Math.cos(l * 22) : 0;
  if (Math.abs(p) < 0.01 && Math.abs(b) < 0.01) return undefined;
  return { dx: 0, dy: -tile * (0.05 * p + 0.035 * b), scale: 1 + 0.05 * Math.max(0, p) + 0.03 * b };
}

/** How far a point is from cooling (1 lit .. 0 cold): the edge of the Field cools first. */
function warmth(t: number, x: number, y: number, fw: number, fh: number): number {
  if (t < C_.cool) return 1;
  const dc = Math.hypot(x - fw / 2, y - fh / 2) / (Math.hypot(fw, fh) / 2);
  const at = C_.cool + (1 - Math.min(1, dc)) * 0.7;
  return 1 - span(t, [at, at + 0.4]);
}

/**
 * One frame of Circuit Trace, drawn on MissionWin's page-wide canvas. `all` is how much of it shows (1 until
 * the cross-fade); `still`: the reduced-motion picture (the whole circuit locked gold).
 */
export function paintCircuit(g: CanvasRenderingContext2D, geo: Geo, t: number, still: boolean, all: number, q: number, c: Circuit): void {
  const { fx, fy, fw, fh, tile } = geo;
  const n = geo.cells.length;
  const tt = still ? C_.lock + 0.3 : t;
  const gold = still || t >= C_.lock;
  const lockAge = still ? 9 : t - C_.lock;
  const lockK = lockAge >= 0 ? Math.exp(-lockAge / 0.16) : 0;

  // The cells; gold at the lock.
  g.save();
  g.globalCompositeOperation = "lighter";
  geo.cells.forEach((cell, i) => {
    const age = still ? 9 : t - circuitCellAt(i, n);
    if (age < 0) return;
    const x = cell.left + cell.width / 2;
    const y = cell.top + cell.height / 2;
    const s = Math.max(cell.width, cell.height);
    const k = Math.exp(-age / 0.15);
    const grd = g.createRadialGradient(x, y, 0, x, y, s * (1.3 + 1.2 * (k + lockK)));
    grd.addColorStop(0, rgba(WHITE, (0.3 + 0.7 * (k + lockK)) * all));
    grd.addColorStop(0.35, rgba(gold ? GOLD : CYAN, (0.3 + 0.3 * k) * all));
    grd.addColorStop(1, rgba(CYAN, 0));
    g.fillStyle = grd;
    g.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
  });
  // The pulse dropping from the bar into the entry corner (not clipped).
  if (!still && c.verts.length) {
    const u = span(t, C_.drop);
    if (u > 0 && u < 1) {
      const cell = n ? geo.cells[Math.floor(n / 2)]! : undefined;
      const sx = cell ? cell.left + cell.width / 2 : fx + fw / 2;
      const sy = cell ? cell.top + cell.height / 2 : fy - tile;
      const [ex, ey] = c.verts[c.entry]!;
      for (let k = 0; k < 12; k++) {
        const w = Math.max(0, u - k * 0.025);
        const e = w * w;
        puff(g, k === 0 ? WHITE : CYAN, sx + (fx + ex - sx) * e, sy + (fy + ey - sy) * e, tile * (0.08 - k * 0.005), (1 - k / 12) * all);
      }
    }
  }
  g.restore();

  g.save();
  g.beginPath();
  g.rect(fx, fy, fw, fh);
  g.clip();
  g.globalCompositeOperation = "lighter";
  const blueprint = still ? 0 : span(t, [0.15, 0.7]) * (1 - span(t, [C_.lock, C_.lock + 0.3]));
  const per = Math.max(4, Math.round(10 * q));
  // The edges: a faint blueprint, then the trace (a running head where it is lit just now), packets in the surge.
  c.edges.forEach((e, ei) => {
    if (e.jump) return;
    const [ax, ay] = c.verts[e.a]!;
    const [bx, by] = c.verts[e.b]!;
    for (let m = 0; m <= per; m++) {
      const v = m / per;
      const x = ax + (bx - ax) * v;
      const y = ay + (by - ay) * v;
      const lit = litAt(c, ei, e.len * v);
      const age = tt - lit;
      const w = still ? (gold ? 1 : 1) : warmth(t, x, y, fw, fh);
      if (age < 0) {
        if (blueprint > 0.01 && m % 2 === 0) puff(g, CYAN, fx + x, fy + y, tile * 0.025, 0.18 * blueprint * all);
        continue;
      }
      if (w <= 0) continue;
      const head = Math.exp(-age / 0.07);
      const col = gold ? (lockK > 0.3 ? WHITE : GOLD) : head > 0.4 ? WHITE : m % 3 === 0 ? ICE : CYAN;
      puff(g, col, fx + x, fy + y, tile * (0.03 + 0.03 * head + 0.02 * lockK), (0.55 + 0.45 * head + 0.3 * lockK) * w * all);
    }
    // Where two traces meet mid-edge: a spark.
    const meet = (c.at[e.a]! + c.at[e.b]! + e.len / c.speed) / 2;
    if (!still && meet < Math.max(c.at[e.a]!, c.at[e.b]!) - 1e-6) {
      const sa = (meet - c.at[e.a]!) * c.speed;
      const age = t - meet;
      if (age >= 0 && age < 0.35) {
        const x = ax + ((bx - ax) * sa) / e.len;
        const y = ay + ((by - ay) * sa) / e.len;
        const k = Math.exp(-age / 0.08);
        puff(g, WHITE, fx + x, fy + y, tile * 0.14 * k + tile * 0.04, k * all);
        for (let j = 0; j < 5; j++) {
          const a = j * 1.26 + ei;
          const dd = tile * 0.25 * age / 0.35;
          puff(g, ICE, fx + x + Math.cos(a) * dd, fy + y + Math.sin(a) * dd, tile * 0.02, (1 - age / 0.35) * all);
        }
      }
    }
    // The surge: two packets race along every edge.
    if (!still && t >= C_.surge[0] && t < C_.surge[1] + 0.2) {
      const a0 = 1 - span(t, [C_.surge[1], C_.surge[1] + 0.2]);
      for (let p = 0; p < 2; p++) {
        const v = ((t - C_.surge[0]) * 2.6 + p * 0.5 + ei * 0.137) % 1;
        const x = ax + (bx - ax) * v;
        const y = ay + (by - ay) * v;
        puff(g, WHITE, fx + x, fy + y, tile * 0.06, 0.9 * a0 * all);
        puff(g, GOLD, fx + x, fy + y, tile * 0.13, 0.25 * a0 * all);
      }
    }
  });
  // The corners: a node once the trace reaches it; the entry burns brightest.
  c.verts.forEach(([x, y], i) => {
    const age = tt - c.at[i]!;
    if (age < 0) return;
    const w = still ? 1 : warmth(t, x, y, fw, fh);
    if (w <= 0) return;
    const k = Math.exp(-age / 0.12);
    puff(g, gold ? GOLD : i === c.entry ? WHITE : VIOLET, fx + x, fy + y, tile * (0.05 + 0.07 * k + (i === c.entry ? 0.04 : 0)), (0.6 + 0.4 * k) * w * all);
  });
  // The sectors powering up: a flash, three traces in from alternate corners to a node in the middle.
  for (const s of c.sectors) {
    const age = tt - s.closes;
    if (age < 0) continue;
    const x = fx + s.x;
    const y = fy + s.y;
    const w = still ? 1 : warmth(t, s.x, s.y, fw, fh);
    if (w <= 0) continue;
    const k = Math.exp(-age / 0.14);
    if (k > 0.02) puff(g, ICE, x, y, c.r * 1.2, 0.35 * k * all);
    const grow = Math.min(1, age / 0.25);
    for (const ci of [0, 2, 4]) {
      const [px, py] = c.verts[s.corners[ci]!]!;
      for (let m = 1; m <= 4; m++) {
        const v = (m / 4) * grow;
        puff(g, gold ? GOLD : CYAN, fx + px + (s.x - px) * v, fy + py + (s.y - py) * v, tile * 0.025, 0.7 * w * all);
      }
    }
    puff(g, gold ? GOLD : WHITE, x, y, tile * (0.06 + 0.06 * k), (0.7 + 0.3 * k) * w * all);
  }
  // Cooling: sparks thrown off as the traces go cold.
  if (!still && t >= C_.cool) {
    c.verts.forEach(([x, y], i) => {
      if (i % 2) return;
      const dc = Math.hypot(x - fw / 2, y - fh / 2) / (Math.hypot(fw, fh) / 2);
      const at = C_.cool + (1 - Math.min(1, dc)) * 0.7;
      const age = t - at;
      if (age < 0 || age > 0.7) return;
      const a = i * 2.39;
      const dd = tile * 0.5 * age;
      puff(g, GOLD, fx + x + Math.cos(a) * dd, fy + y + Math.sin(a) * dd - tile * age * 0.4, tile * 0.025, (1 - age / 0.7) * all);
    });
  }
  g.restore();
}
