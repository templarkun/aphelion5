/**
 * Resonance, a mission win (designer 2026-11-27: "make 2 more ... be ambitious"; times in timeline.ts
 * RESONANCE): the Field becomes a surface of light that ripples, echoes and then rings as one.
 *
 * 1. (0-1.0 s) The Field dims. The Mission bar's cells charge one by one, each with a small ripple; the
 *    last lets a drop of light fall, trailing particles, into the sector the unit left (the middle after
 *    the Developer tool).
 * 2. (1.0-3.0 s) The splash: a crown of particles. Ripples run out over the Field and echo back off its
 *    edges; an answering drop falls on the far side and the two sets of ripples cross. The surface is
 *    drawn as particles (bright on the crests, faint violet in the troughs) and every tile rides the
 *    waves, rising and falling with the surface under it.
 * 3. (3.0-4.4 s) The ripples calm and the whole Field rings as one: every tile rises and falls together,
 *    louder each beat, rings of particles leaving every sector on each beat; then it locks flat in a
 *    flash, a lattice of light joins every sector to its neighbours and the bar turns gold; the banner.
 * 4. (4.4-5.8 s) The lattice fades and motes lift off the still surface.
 *
 * Every moving thing is worked out from the time alone: the surface is a sum of circular waves (each
 * echo an image of its source beyond an edge), never a simulation stepped frame by frame. A slow machine
 * draws a coarser surface and fewer particles (`q`), never slower. The same colours for every Company.
 * Screen only: no rule here.
 */

import { easeOut } from "../anim.js";
import { RESONANCE as R_, span } from "./timeline.js";
import { type Geo, hexPath, hexPts, puff, rgba, seq } from "./winKit.js";

const CYAN = "92 214 255";
const ICE = "190 240 255";
const WHITE = "255 255 255";
const VIOLET = "170 128 255";
const GOLD = "255 206 120";

/** A source of ripples: where (Field pixels), when it starts (s), how strong. */
export interface Source {
  x: number;
  y: number;
  t0: number;
  amp: number;
}

/** The Resonance plan for one Field: its sources (with their echoes), the ripple speed, the second drop's sector. */
export interface Ripples {
  sources: Source[];
  /** Ripple speed (pixels a second). */
  c: number;
  tile: number;
  /** The first drop (where the unit left) and the answering drop, Field pixels. */
  first: [number, number];
  second: [number, number];
}

/** When cell i of n charges (s). */
export function resonanceCellAt(i: number, n: number): number {
  const step = n > 1 ? Math.min(R_.cellStep, R_.cellsIn / (n - 1)) : 0;
  return R_.cellsAt + i * step;
}

/**
 * The ripples on a Field: the first drop at the sector nearest (ox, oy), the answering drop at the sector
 * farthest from it; each echoes off the four edges of the sectors' box (an image of the source mirrored
 * beyond each edge, weaker). The speed lets a ripple cross the farthest stretch in RESONANCE.cross.
 */
export function ripplesOf(sectors: readonly (readonly [string, number, number])[], tile: number, ox: number, oy: number): Ripples {
  const pts = sectors.length ? sectors.map(([, x, y]) => [x, y] as [number, number]) : [[ox, oy] as [number, number]];
  const near = pts.reduce((a, b) => (Math.hypot(b[0] - ox, b[1] - oy) < Math.hypot(a[0] - ox, a[1] - oy) ? b : a));
  const far = pts.reduce((a, b) => (Math.hypot(b[0] - near[0], b[1] - near[1]) > Math.hypot(a[0] - near[0], a[1] - near[1]) ? b : a));
  const reach = Math.max(tile, Math.hypot(far[0] - near[0], far[1] - near[1]) + tile * 0.5);
  const pad = tile * 0.55;
  const minX = Math.min(...pts.map((p) => p[0])) - pad;
  const maxX = Math.max(...pts.map((p) => p[0])) + pad;
  const minY = Math.min(...pts.map((p) => p[1])) - pad;
  const maxY = Math.max(...pts.map((p) => p[1])) + pad;
  const sources: Source[] = [];
  const add = (x: number, y: number, t0: number, amp: number) => {
    sources.push({ x, y, t0, amp });
    sources.push({ x: 2 * minX - x, y, t0, amp: amp * 0.55 }, { x: 2 * maxX - x, y, t0, amp: amp * 0.55 });
    sources.push({ x, y: 2 * minY - y, t0, amp: amp * 0.55 }, { x, y: 2 * maxY - y, t0, amp: amp * 0.55 });
  };
  add(near[0], near[1], R_.splash, 1);
  add(far[0], far[1], R_.echoAt, 0.8);
  return { sources, c: reach / R_.cross, tile, first: near, second: far };
}

/** The ripples' height at (x, y) at time t (about -1..1; 0 = still), Field pixels. */
export function rippleAt(rp: Ripples, x: number, y: number, t: number): number {
  const calm = 1 - easeOut(span(t, R_.calm));
  if (calm <= 0) return 0;
  let h = 0;
  for (const s of rp.sources) {
    const d = Math.hypot(x - s.x, y - s.y);
    const age = t - s.t0 - d / rp.c;
    if (age <= 0) continue;
    h += (s.amp * Math.sin(2 * Math.PI * R_.freq * age) * Math.exp(-age / R_.decay) * Math.min(1, age / 0.1)) / (1 + d / (3 * rp.tile));
  }
  return h * calm;
}

/** The whole Field ringing as one in act 3 (the same for every tile): louder each beat, flat at the lock. */
export function ringAt(t: number): number {
  const u = span(t, R_.ring);
  if (u <= 0 || u >= 1) return 0;
  return 0.95 * u ** 0.6 * Math.sin(2 * Math.PI * R_.beats * u);
}
/** When each beat of the ring peaks (s). */
export const beatTimes = (): number[] => Array.from({ length: R_.beats }, (_, k) => R_.ring[0] + ((k + 0.25) / R_.beats) * (R_.ring[1] - R_.ring[0]));

/** A tile riding the surface: lifted on a crest, sunk in a trough; a small snap at the lock. */
export function resonanceLook(rp: Ripples, x: number, y: number, t: number): { dx: number; dy: number; scale: number } | undefined {
  const h = rippleAt(rp, x, y, t) + ringAt(t);
  const a = t - R_.lock;
  const snap = a >= 0 && a < 0.35 ? 0.035 * Math.exp(-a / 0.07) * Math.cos(a * 38) : 0;
  if (Math.abs(h) < 0.002 && !snap) return undefined;
  return { dx: 0, dy: -h * rp.tile * 0.1, scale: 1 + 0.045 * h + snap };
}

// The surface's sample points (on the board only), made once per Field.
const GRIDS = new WeakMap<object, [number, number][]>();
function gridOf(geo: Geo): [number, number][] {
  let g = GRIDS.get(geo.sectors);
  if (g) return g;
  const step = geo.tile * 0.2;
  const out: [number, number][] = [];
  const r = seq(5531);
  for (let y = 0; y <= geo.fh; y += step)
    for (let x = 0; x <= geo.fw; x += step) {
      const jx = x + (r() - 0.5) * step * 0.6;
      const jy = y + (r() - 0.5) * step * 0.6;
      if (geo.sectors.some(([, sx, sy]) => Math.hypot(jx - sx, jy - sy) < geo.tile * 0.45)) out.push([jx, jy]);
    }
  g = out;
  GRIDS.set(geo.sectors, g);
  return g;
}

// Where the board is (within a tile's half of a sector), looked up on a coarse grid made once per Field.
const MASKS = new WeakMap<object, (x: number, y: number) => boolean>();
function maskOf(geo: Geo): (x: number, y: number) => boolean {
  let f = MASKS.get(geo.sectors);
  if (f) return f;
  const cell = Math.max(2, geo.tile * 0.08);
  const w = Math.ceil(geo.fw / cell) + 1;
  const h = Math.ceil(geo.fh / cell) + 1;
  const bits = new Uint8Array(w * h);
  const rr = geo.tile * 0.47;
  for (const [, sx, sy] of geo.sectors)
    for (let gy = Math.max(0, Math.floor((sy - rr) / cell)); gy <= Math.min(h - 1, Math.ceil((sy + rr) / cell)); gy++)
      for (let gx = Math.max(0, Math.floor((sx - rr) / cell)); gx <= Math.min(w - 1, Math.ceil((sx + rr) / cell)); gx++)
        if (Math.hypot(gx * cell - sx, gy * cell - sy) < rr) bits[gy * w + gx] = 1;
  f = (x, y) => {
    const gx = Math.round(x / cell);
    const gy = Math.round(y / cell);
    return gx >= 0 && gy >= 0 && gx < w && gy < h && bits[gy * w + gx] === 1;
  };
  MASKS.set(geo.sectors, f);
  return f;
}

// Particles fixed once (each with a rank: a slow machine draws only those below its quality).
const CROWN = (() => {
  const r = seq(7121);
  return Array.from({ length: 46 }, (_, i) => ({ a: r() * Math.PI * 2, v: 0.4 + r() * 1.1, up: 0.6 + r() * 1.4, life: 0.45 + r() * 0.5, size: 0.5 + r() * 0.9, white: r() < 0.4, rank: i / 46 }));
})();
const DROPLET = (() => {
  const r = seq(3907);
  return Array.from({ length: 9 }, () => ({ a: r() * Math.PI * 2, d: r(), w: 6 + r() * 10 }));
})();
const LIFT = (() => {
  const r = seq(2297);
  return Array.from({ length: 90 }, (_, i) => ({ pick: r(), born: R_.fade - 0.3 + r() * 1.2, life: 0.9 + r() * 0.7, rise: 0.25 + r() * 0.5, size: 0.6 + r(), gold: r() < 0.35, rank: i / 90 }));
})();

/** A drop of light at (x, y): a cluster of wobbling particles. */
function droplet(g: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, a: number): void {
  puff(g, CYAN, x, y, s * 2.2, 0.45 * a);
  for (const d of DROPLET) {
    const ang = d.a + t * d.w;
    puff(g, ICE, x + Math.cos(ang) * s * 0.45 * d.d, y + Math.sin(ang) * s * 0.6 * d.d, s * 0.5, 0.8 * a);
  }
  puff(g, WHITE, x, y, s * 0.6, a);
}

/** A falling drop with a trail: from (x0, y0) to (x1, y1), u 0..1 (gravity: slow, then fast). */
function fall(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, u: number, s: number, t: number, a: number, q: number): void {
  const at = (v: number) => {
    const e = v * v;
    return [x0 + (x1 - x0) * (0.3 * v + 0.7 * e), y0 + (y1 - y0) * e] as const;
  };
  const trail = q > 0.6 ? 9 : 5;
  for (let k = trail; k >= 1; k--) {
    const v = Math.max(0, u - k * 0.035);
    const [x, y] = at(v);
    puff(g, k % 2 ? CYAN : ICE, x, y, s * (0.9 - k * 0.07), (0.6 - k * 0.055) * a);
  }
  const [x, y] = at(u);
  droplet(g, x, y, s, t, a);
}

/** Neighbouring sectors (centres less than a tile apart), each pair once. */
export function latticeOf(sectors: readonly (readonly [string, number, number])[], tile: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < sectors.length; i++)
    for (let j = i + 1; j < sectors.length; j++) {
      const [, ax, ay] = sectors[i]!;
      const [, bx, by] = sectors[j]!;
      if (Math.hypot(ax - bx, ay - by) < tile) out.push([ax, ay, bx, by]);
    }
  return out;
}

/**
 * One frame of Resonance, drawn on MissionWin's page-wide canvas. `all` is how much of it shows (1 until
 * the cross-fade); `still`: the reduced-motion picture (the bar lit, the lattice and every sector lit).
 */
export function paintResonance(g: CanvasRenderingContext2D, geo: Geo, t: number, still: boolean, all: number, q: number, rp: Ripples, lattice: [number, number, number, number][]): void {
  const { fx, fy, fw, fh, tile } = geo;
  const R = tile * 0.46;
  const n = geo.cells.length;
  const locked = still || t >= R_.lock;
  const keep = still ? 1 : 1 - span(t, [R_.fade, R_.out[1]]);

  g.save();
  g.globalCompositeOperation = "lighter";
  // Act 1: the cells charge, each with a small ripple of particles; gold once the Field has locked.
  geo.cells.forEach((c, i) => {
    const at = resonanceCellAt(i, n);
    const age = still ? 9 : t - at;
    if (age < -0.15) return;
    const x = c.left + c.width / 2;
    const y = c.top + c.height / 2;
    const s = Math.max(c.width, c.height);
    const charge = Math.min(1, (age + 0.15) / 0.15);
    const lockAge = t - R_.lock;
    const flare = !still && lockAge >= 0 ? Math.exp(-lockAge / 0.2) : 0;
    const grd = g.createRadialGradient(x, y, 0, x, y, s * (1.4 + flare));
    grd.addColorStop(0, rgba(WHITE, (0.3 * charge + 0.7 * flare) * all));
    grd.addColorStop(0.35, rgba(locked ? GOLD : CYAN, (0.35 * charge + 0.4 * flare) * all));
    grd.addColorStop(1, rgba(CYAN, 0));
    g.fillStyle = grd;
    g.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
    if (!still && age >= 0 && age < 0.5) {
      const u = age / 0.5;
      const m = Math.round(14 * q);
      for (let k = 0; k < m; k++) {
        const a = (k / m) * Math.PI * 2;
        puff(g, ICE, x + Math.cos(a) * s * (0.6 + 1.1 * u), y + Math.sin(a) * s * 0.5 * (0.6 + 1.1 * u), s * 0.08, (1 - u) * 0.8 * all);
      }
    }
  });
  // The drops: the first from the last cell, the answer from above the page.
  if (!still) {
    const last = geo.cells[n - 1];
    const [x1, y1] = [fx + rp.first[0], fy + rp.first[1]];
    if (last && t >= R_.drop[0] && t < R_.drop[1]) fall(g, last.left + last.width / 2, last.bottom, x1, y1, span(t, R_.drop), tile * 0.09, t, all, q);
    const [x2, y2] = [fx + rp.second[0], fy + rp.second[1]];
    const e0 = R_.echoAt - (R_.drop[1] - R_.drop[0]);
    if (t >= e0 && t < R_.echoAt) fall(g, x2 + tile * 0.4, -20, x2, y2, span(t, [e0, R_.echoAt]), tile * 0.08, t, all, q);
  }
  g.restore();

  // The Field itself, clipped to it.
  g.save();
  g.beginPath();
  g.rect(fx, fy, fw, fh);
  g.clip();
  g.globalCompositeOperation = "lighter";
  // Act 2: the surface. Every crest of every ripple (and of its echoes off the edges) is a ring of
  // particles, on the board only: bright where strong, a faint violet line along each trough.
  if (!still && t >= R_.splash && t < R_.calm[1] + 0.05) {
    const mask = maskOf(geo);
    const calm = 1 - easeOut(span(t, R_.calm));
    const gap = tile * (q > 0.7 ? 0.1 : 0.15);
    for (const s of rp.sources) {
      for (let j = 0; j < 12; j++) {
        for (const trough of [false, true]) {
          const age = (j + (trough ? 0.75 : 0.25)) / R_.freq;
          const r = rp.c * (t - s.t0 - age);
          if (r <= 0) continue;
          const A = ((s.amp * Math.exp(-age / R_.decay)) / (1 + r / (3 * tile))) * calm;
          if (A < 0.07) continue;
          const m = Math.min(260, Math.ceil((2 * Math.PI * r) / gap));
          for (let k = 0; k < m; k++) {
            const a = (k / m) * Math.PI * 2 + j * 0.37;
            const x = s.x + Math.cos(a) * r;
            const y = s.y + Math.sin(a) * r;
            if (!mask(x, y)) continue;
            if (trough) puff(g, VIOLET, fx + x, fy + y, tile * 0.04, Math.min(1, A) * 0.4 * all);
            else {
              const tw = 0.8 + 0.2 * Math.sin(k * 2.3 + t * 20);
              puff(g, A > 0.5 ? WHITE : A > 0.25 ? ICE : CYAN, fx + x, fy + y - A * tile * 0.1, tile * (0.035 + 0.03 * Math.min(1, A)), Math.min(1, A * 1.5) * tw * all);
            }
          }
        }
      }
    }
  }
  // The splashes: crowns of particles thrown up and falling back.
  if (!still)
    for (const [sx, sy, t0, big] of [
      [rp.first[0], rp.first[1], R_.splash, 1],
      [rp.second[0], rp.second[1], R_.echoAt, 0.8],
    ] as const) {
      const age = t - t0;
      if (age < 0 || age > 1.1) continue;
      const x = fx + sx;
      const y = fy + sy;
      const k = Math.exp(-age / 0.1);
      puff(g, WHITE, x, y, tile * (0.35 + 0.5 * k) * big, 0.9 * k * all);
      for (const c of CROWN) {
        if (c.rank > q || age > c.life) continue;
        const u = age / c.life;
        const d = tile * 0.5 * c.v * big * (1 - Math.exp(-age * 5));
        const lift = tile * c.up * big * (age * 1.6 - age * age * 2.4);
        puff(g, c.white ? WHITE : CYAN, x + Math.cos(c.a) * d, y + Math.sin(c.a) * d * 0.5 - Math.max(0, lift), tile * 0.035 * c.size, (1 - u) * all);
      }
    }
  // Act 3: the ring. Every sector's edge glows with the beat; rings of particles leave each on every beat.
  if (!still && t >= R_.ring[0] && t < R_.lock) {
    const h = Math.abs(ringAt(t));
    const beats = beatTimes();
    for (const [, sx, sy] of geo.sectors) {
      const x = fx + sx;
      const y = fy + sy - ringAt(t) * tile * 0.1;
      hexPath(g, x, y, R * (1 + 0.045 * ringAt(t)));
      g.strokeStyle = rgba(ICE, (0.25 + 0.6 * h) * all);
      g.lineWidth = 1 + 1.5 * h;
      g.stroke();
      for (const b of beats) {
        const age = t - b;
        if (age < 0 || age > 0.35) continue;
        const u = age / 0.35;
        const pts = hexPts(x, y, R * (0.95 + 0.4 * easeOut(u)));
        const m = q > 0.7 ? 6 : 4;
        for (let e = 0; e < 6; e++) {
          const [ax, ay] = pts[e]!;
          const [bx, by] = pts[(e + 1) % 6]!;
          for (let j = 0; j < m; j++) {
            const w = (j + 0.5) / m;
            puff(g, j % 2 ? CYAN : ICE, ax + (bx - ax) * w, ay + (by - ay) * w, R * 0.05, (1 - u) * 0.9 * all);
          }
        }
      }
    }
  }
  // The lock: a flash over every sector, then the lattice of light joining neighbours, and lit edges.
  if (locked) {
    const age = still ? 9 : t - R_.lock;
    const flash = Math.exp(-age / 0.12);
    const [ox, oy] = rp.first;
    for (const [, sx, sy] of geo.sectors) {
      const x = fx + sx;
      const y = fy + sy;
      if (flash > 0.02) puff(g, WHITE, x, y, R * 1.3, 0.55 * flash * all);
      const on = still ? 1 : span(age, [Math.hypot(sx - ox, sy - oy) / (rp.c * 3), Math.hypot(sx - ox, sy - oy) / (rp.c * 3) + 0.15]);
      const a = on * keep * all;
      hexPath(g, x, y, R * 0.94);
      g.strokeStyle = rgba(CYAN, 0.45 * a);
      g.lineWidth = 1;
      g.stroke();
      for (const [px, py] of hexPts(x, y, R * 0.94)) puff(g, GOLD, px, py, R * 0.07, 0.8 * a);
    }
    for (const [ax, ay, bx, by] of lattice) {
      const mid = Math.hypot((ax + bx) / 2 - ox, (ay + by) / 2 - oy);
      const on = still ? 1 : span(age, [mid / (rp.c * 3), mid / (rp.c * 3) + 0.2]);
      if (on <= 0) continue;
      const L = Math.hypot(bx - ax, by - ay);
      const m = Math.max(5, Math.round((L / tile) * 22 * q));
      for (let j = 0; j <= m; j++) {
        const w = j / m;
        if (w > on) break;
        const shimmer = 0.75 + 0.25 * Math.sin(t * 9 + j * 1.3 + ax * 0.01);
        // A pulse of light runs along each link and back.
        const run = Math.exp(-(((w - (0.5 + 0.5 * Math.sin(t * 3 + ax * 0.02))) * 6) ** 2));
        puff(g, run > 0.5 ? WHITE : j % 3 ? CYAN : ICE, fx + ax + (bx - ax) * w, fy + ay + (by - ay) * w, tile * (0.018 + 0.02 * run), (0.55 + 0.45 * run) * shimmer * keep * all);
      }
    }
  }
  // Act 4: motes lift off the still surface.
  if (!still && t >= R_.fade - 0.3) {
    const pts = gridOf(geo);
    for (const m of LIFT) {
      if (m.rank > q || pts.length === 0) continue;
      const age = t - m.born;
      if (age < 0 || age > m.life) continue;
      const u = age / m.life;
      const [x, y] = pts[Math.floor(m.pick * pts.length)]!;
      puff(g, m.gold ? GOLD : ICE, fx + x + Math.sin(age * 3 + m.pick * 20) * tile * 0.06, fy + y - m.rise * tile * u, tile * 0.03 * m.size, Math.sin(Math.PI * u) * 0.85 * all);
    }
  }
  g.restore();
}
