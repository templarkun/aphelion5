/**
 * Armillary, a mission win (designer 2026-11-27: "create 2 more ... be ambitious"; times in timeline.ts
 * ARMILLARY): three great rings of particles are drawn round the Field like an armillary sphere, tumble
 * through the board lighting every sector they cross, then fall into one plane and lock as a triple halo.
 *
 * 1. (0-1.1 s) The Field dims. Three orbs drop from the Mission bar, one after another; each runs once
 *    round and leaves a ring of particles behind it, each ring in its own tilt.
 * 2. (1.1-3.1 s) The rings tumble in three dimensions, each round its own axes, their particles streaming
 *    along them, a bright runner on each; the near side of a ring is brighter and bigger, the far side
 *    dim. Every sector the near side crosses lifts and lights as it passes, and the first time with a
 *    burst; it keeps gold corners.
 * 3. (3.1-4.5 s) The rings fall into one plane, seen from a little above, and nest round the middle;
 *    they lock in a flash with tick marks round the outer one, every tile gives a small bounce, the bar
 *    turns gold; the banner sits inside the halo.
 * 4. (4.5-5.8 s) The halo widens and breaks into motes; everything fades.
 *
 * The rings' tilts and every particle's place are worked out from the time alone, never stepped frame by
 * frame. A slow machine draws fewer particles (`q`), never slower. The same colours for every Company.
 * Screen only: no rule here.
 */

import { easeInOut, easeOut } from "../anim.js";
import { ARMILLARY as A_, span } from "./timeline.js";
import { type Geo, hexPts, puff, rgba, seq } from "./winKit.js";

const CYAN = "92 214 255";
const ICE = "190 240 255";
const WHITE = "255 255 255";
const VIOLET = "170 128 255";
const GOLD = "255 206 120";
const RING_COL = [CYAN, VIOLET, ICE] as const;

// Each ring's tumble: its normal's two angles start at A0 / B0 and turn at WA / WB (radians a second).
const A0 = [1.15, 1.95, 0.55];
const WA = [0.6, -0.75, 0.95];
const B0 = [0.2, 2.3, 4.2];
const WB = [0.95, -0.6, 0.5];
// The plane they lock in: seen from a little above (its normal points up and a little at the camera).
const A_F = Math.acos(0.42);
const B_F = -Math.PI / 2;
// Ring sizes while they tumble, and nested in the halo (shares of the base radius).
const FREE = [1, 0.88, 0.76];
const NEST = [0.95, 0.8, 0.65];
// How fast the particles stream along each ring (radians a second).
const SPIN = [1.3, -1.0, 1.7];

/** The nearest copy of angle `to` (mod 2 pi) to `from`. */
const near = (from: number, to: number) => to + 2 * Math.PI * Math.round((from - to) / (2 * Math.PI));

/** Ring i's normal angles at time t: tumbling, then eased into the locked plane. */
export function ringAngles(i: number, t: number): [number, number] {
  const tf = Math.min(t, A_.align[0]);
  const af = A0[i]! + WA[i]! * tf + (t > A_.align[0] ? WA[i]! * 0.4 * Math.min(t - A_.align[0], 0.6) : 0);
  const bf = B0[i]! + WB[i]! * tf + (t > A_.align[0] ? WB[i]! * 0.4 * Math.min(t - A_.align[0], 0.6) : 0);
  const e = easeInOut(span(t, A_.align));
  if (e <= 0) return [af, bf];
  const at = near(af, A_F);
  const bt = near(bf, B_F);
  return [af + (at - af) * e, bf + (bt - bf) * e];
}

/** Ring i at time t: its middle and radius (Field pixels) and its two axes in the plane (unit vectors, z at the camera). */
export function ringFrame(i: number, t: number, fw: number, fh: number): { cx: number; cy: number; r: number; u: [number, number, number]; v: [number, number, number]; base: number } {
  const [a, b] = ringAngles(i, t);
  const n: [number, number, number] = [Math.sin(a) * Math.cos(b), Math.sin(a) * Math.sin(b), Math.cos(a)];
  const u: [number, number, number] = [-Math.sin(b), Math.cos(b), 0];
  const v: [number, number, number] = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const base = Math.min(fw * 0.5, fh * 0.52);
  const e = easeInOut(span(t, A_.align));
  const grow = t > A_.release ? 1 + 0.7 * easeOut(span(t, [A_.release, A_.out[1]])) : 1;
  const r = base * (FREE[i]! + (NEST[i]! - FREE[i]!) * e) * grow;
  return { cx: fw / 2, cy: fh / 2, r, u, v, base };
}

/** A point of ring i at angle phi, on the screen (Field pixels), with its depth (-1 far .. 1 near) and perspective scale. */
export function ringPoint(i: number, phi: number, t: number, fw: number, fh: number): [number, number, number, number] {
  const f = ringFrame(i, t, fw, fh);
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  const x = f.r * (c * f.u[0] + s * f.v[0]);
  const y = f.r * (c * f.u[1] + s * f.v[1]);
  const z = f.r * (c * f.u[2] + s * f.v[2]);
  const p = 1 / (1 - z / (3.5 * f.base));
  return [f.cx + x * p, f.cy + y * p, z / f.r, p];
}

/** How much the rings' near sides touch the point (x, y) at time t (0..1); only while they tumble. */
export function armillaryTouch(fw: number, fh: number, tile: number, x: number, y: number, t: number): number {
  if (t < A_.spin[0] - 0.3 || t > A_.align[1]) return 0;
  const on = span(t, [A_.spin[0] - 0.3, A_.spin[0]]) * (1 - span(t, A_.align));
  let best = 0;
  const reach = tile * 0.6;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 48; j++) {
      const [px, py, z] = ringPoint(i, (j / 48) * Math.PI * 2, t, fw, fh);
      if (z <= 0) continue;
      const d = Math.hypot(px - x, py - y);
      if (d < reach) best = Math.max(best, (1 - d / reach) * Math.min(1, z * 2.5));
    }
  }
  return best * on;
}

/** When each sector is first touched by a ring (s), sampled over the tumble; the ones never touched are left out. */
export function armillaryPlan(sectors: readonly (readonly [string, number, number])[], fw: number, fh: number, tile: number): Map<string, number> {
  const first = new Map<string, number>();
  for (let t = A_.spin[0] - 0.3; t <= A_.align[1]; t += 1 / 30) {
    for (const [k, x, y] of sectors) if (!first.has(k) && armillaryTouch(fw, fh, tile, x, y, t) > 0.45) first.set(k, t);
  }
  return first;
}

/** A tile's look: lifted while a ring passes over it, a small bounce when the halo locks. */
export function armillaryLook(fw: number, fh: number, x: number, y: number, t: number, tile: number): { dx: number; dy: number; scale: number } | undefined {
  const p = armillaryTouch(fw, fh, tile, x, y, t);
  const age = t - A_.lock;
  const b = age >= 0 && age < 0.6 ? Math.exp(-age / 0.12) * Math.cos(age * 22) : 0;
  if (p < 0.01 && Math.abs(b) < 0.01) return undefined;
  return { dx: 0, dy: -tile * (0.08 * p + 0.04 * b), scale: 1 + 0.07 * p + 0.03 * b };
}

/** How much of ring i is drawn at time t (0..1): its orb runs once round. */
export function ringDrawn(i: number, t: number): number {
  return span(t, [A_.launch[i]! + 0.35, A_.launch[i]! + 0.35 + A_.draw]);
}

// The motes the halo breaks into, fixed once.
const MOTES = (() => {
  const r = seq(6263);
  return Array.from({ length: 240 }, (_, i) => ({ ring: i % 3, phi: r() * Math.PI * 2, v: 0.4 + r() * 1.2, up: r(), rank: i / 240 }));
})();

/**
 * One frame of Armillary, drawn on MissionWin's page-wide canvas. `all` is how much of it shows (1 until
 * the cross-fade); `still`: the reduced-motion picture (the halo locked round the middle). `first`: when
 * each sector was first touched (armillaryPlan).
 */
export function paintArmillary(g: CanvasRenderingContext2D, geo: Geo, t: number, still: boolean, all: number, q: number, first: Map<string, number>): void {
  const { fx, fy, fw, fh, tile } = geo;
  const n = geo.cells.length;
  const R = tile * 0.46;
  const tt = still ? A_.lock + 0.3 : t;
  const gold = still || t >= A_.lock;
  const lockAge = still ? 9 : t - A_.lock;
  const lockK = lockAge >= 0 ? Math.exp(-lockAge / 0.18) : 0;

  // The cells: they light as the orbs leave; gold once the halo locks.
  g.save();
  g.globalCompositeOperation = "lighter";
  geo.cells.forEach((c, i) => {
    const age = still ? 9 : t - A_.launch[0] + 0.1;
    if (age < 0) return;
    const x = c.left + c.width / 2;
    const y = c.top + c.height / 2;
    const s = Math.max(c.width, c.height);
    const k = Math.exp(-Math.max(0, age - i * 0.03) / 0.2);
    const grd = g.createRadialGradient(x, y, 0, x, y, s * (1.3 + 1.2 * (k + lockK)));
    grd.addColorStop(0, rgba(WHITE, (0.3 + 0.7 * (k + lockK)) * all));
    grd.addColorStop(0.35, rgba(gold ? GOLD : CYAN, (0.3 + 0.3 * k) * all));
    grd.addColorStop(1, rgba(CYAN, 0));
    g.fillStyle = grd;
    g.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
  });
  // The orbs' drop from the bar to where each ring starts (not clipped: they come from the bar).
  if (!still) {
    for (let i = 0; i < 3; i++) {
      const u = span(t, [A_.launch[i]!, A_.launch[i]! + 0.35]);
      if (u <= 0 || u >= 1) continue;
      const cell = n ? geo.cells[Math.round((i * (n - 1)) / 2)]! : undefined;
      const sx = cell ? cell.left + cell.width / 2 : fx + fw / 2;
      const sy = cell ? cell.top + cell.height / 2 : fy - tile;
      const [ex0, ey0] = ringPoint(i, 0, t, fw, fh);
      const ex = fx + ex0;
      const ey = fy + ey0;
      for (let k = 0; k < 10; k++) {
        const w = Math.max(0, u - k * 0.03);
        const e = w * w;
        puff(g, k === 0 ? WHITE : RING_COL[i]!, sx + (ex - sx) * e, sy + (ey - sy) * e, tile * (0.09 - k * 0.006), (1 - k / 10) * all);
      }
    }
  }
  g.restore();

  g.save();
  g.beginPath();
  g.rect(fx - tile, fy - tile, fw + tile * 2, fh + tile * 2);
  g.clip();
  g.globalCompositeOperation = "lighter";

  // The sectors: lit while a ring passes, a burst the first time, gold corners after; all flash at the lock.
  const keep = still ? 1 : 1 - span(t, [A_.release, A_.out[0]]);
  for (const [k, sx, sy] of geo.sectors) {
    const x = fx + sx;
    const y = fy + sy;
    const p = still ? 0 : armillaryTouch(fw, fh, tile, sx, sy, t);
    const f0 = first.get(k);
    const age = still ? 9 : f0 === undefined ? -1 : t - f0;
    const burst = age >= 0 ? Math.exp(-age / 0.16) : 0;
    const pts = hexPts(x, y, R * 0.96);
    if (p > 0.02 || burst > 0.02) puff(g, ICE, x, y, R * 1.1, (0.18 * p + 0.3 * burst) * all);
    const corner = (age >= 0 ? Math.min(1, age / 0.25) * 0.7 : 0) + lockK * 0.8 + (still ? 0.7 : 0);
    pts.forEach(([px, py], j) => {
      const [qx, qy] = pts[(j + 1) % 6]!;
      if (corner > 0.02) puff(g, lockK > 0.3 ? WHITE : GOLD, px, py, R * 0.075, Math.min(1, corner) * keep * all);
      if (p > 0.05) {
        for (let m = 1; m < 4; m++) puff(g, CYAN, px + ((qx - px) * m) / 4, py + ((qy - py) * m) / 4, R * 0.05, p * all);
      }
    });
  }

  // The rings: far side dim and small, near side bright; particles stream along; a runner on each.
  const M = Math.round(220 * q);
  const ringAlpha = (1 - span(tt, [A_.release, A_.release + 0.9])) * all;
  for (let i = 0; i < 3; i++) {
    const drawn = still ? 1 : ringDrawn(i, t);
    if (drawn <= 0) continue;
    const col = gold ? (i === 1 ? GOLD : WHITE) : RING_COL[i]!;
    const flow = (still ? 0 : t) * SPIN[i]!;
    for (let j = 0; j < M; j++) {
      const base = (j / M) * Math.PI * 2;
      if (base > drawn * Math.PI * 2) break;
      const phi = base + flow * (gold ? 0.3 : 1);
      const [px, py, z, pp] = ringPoint(i, phi, tt, fw, fh);
      const front = (z + 1) / 2;
      const tw = 0.7 + 0.3 * Math.sin(t * 11 + j * 2.3 + i);
      const a = (0.25 + 0.75 * front) * tw * ringAlpha * (1 + lockK);
      puff(g, j % 6 === 0 ? WHITE : col, fx + px, fy + py, tile * 0.034 * pp * (0.7 + 0.55 * front), a);
      // A short wake behind each particle on the near side.
      if (front > 0.55 && j % 2 === 0) {
        const [bx, by] = ringPoint(i, phi - 0.05 * Math.sign(SPIN[i]!), tt, fw, fh);
        puff(g, col, fx + bx, fy + by, tile * 0.02 * pp, a * 0.45);
      }
    }
    // The runner: a bright head with a tail, round the ring three times faster.
    if (!still && drawn >= 1 && t < A_.lock) {
      const head = t * SPIN[i]! * 3;
      for (let k = 0; k < 14; k++) {
        const [px, py, z, pp] = ringPoint(i, head - Math.sign(SPIN[i]!) * k * 0.04, t, fw, fh);
        puff(g, k === 0 ? WHITE : col, fx + px, fy + py, tile * (0.08 - k * 0.004) * pp, (1 - k / 14) * (0.5 + 0.5 * (z + 1) / 2) * all);
      }
    } else if (!still && drawn > 0 && drawn < 1) {
      // While the ring is being drawn its orb leads it.
      const [px, py, , pp] = ringPoint(i, drawn * Math.PI * 2 + flow, t, fw, fh);
      puff(g, WHITE, fx + px, fy + py, tile * 0.1 * pp, all);
      puff(g, RING_COL[i]!, fx + px, fy + py, tile * 0.3 * pp, 0.3 * all);
    }
  }

  // The lock: a flash round the halo and tick marks round its outer ring.
  if (lockAge >= 0) {
    const f = ringFrame(0, tt, fw, fh);
    const ticks = 36;
    const tickA = (still ? 0.8 : Math.min(1, lockAge / 0.15) * 0.8) * ringAlpha;
    for (let j = 0; j < ticks; j++) {
      const phi = (j / ticks) * Math.PI * 2;
      const [px, py, z, pp] = ringPoint(0, phi, tt, fw, fh);
      const dx = px - f.cx;
      const dy = py - f.cy;
      const L = Math.hypot(dx, dy) || 1;
      const len = tile * (j % 3 === 0 ? 0.22 : 0.11);
      for (let m = 1; m <= 3; m++) puff(g, GOLD, fx + px + (dx / L) * len * (m / 3), fy + py + (dy / L) * len * (m / 3), tile * 0.02 * pp, tickA * (0.4 + 0.6 * (z + 1) / 2));
    }
    if (lockK > 0.02) puff(g, WHITE, fx + fw / 2, fy + fh / 2, f.r * 1.1, 0.35 * lockK * all);
  }

  // The release: the halo breaks into motes that drift out and up.
  if (!still && t >= A_.release) {
    const age = t - A_.release;
    for (const m of MOTES) {
      if (m.rank > q) continue;
      const [px, py] = ringPoint(m.ring, m.phi, A_.release, fw, fh);
      const dx = px - fw / 2;
      const dy = py - fh / 2;
      const s = 1 + age * m.v * 0.5;
      const a = (1 - span(age, [0.2, 1.3])) * all;
      if (a <= 0) continue;
      puff(g, m.up < 0.4 ? GOLD : ICE, fx + fw / 2 + dx * s, fy + fh / 2 + dy * s - tile * age * m.up * 0.8, tile * 0.025, a);
    }
  }
  g.restore();
}
