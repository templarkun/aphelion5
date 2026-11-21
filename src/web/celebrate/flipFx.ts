/**
 * Sector Flip, the third win (designer 2026-11-21; times in timeline.ts FLIP). Every sector is a heavy,
 * precision-made plate: in a wave across the Field, column by column, each lifts off the board with its
 * shadow left beneath, turns a full 360° (its bevelled edge and the circuit-and-chevron underside showing
 * on the way round), comes back right side up with a bright rim and slams down hard: a small shock ring,
 * a puff of dust and sparks at its rim, a 1-2 px jolt of the whole board. Units stay on their tiles (the
 * Field's own tiles are what moves, through the win's `onShake` looks). Cleared sectors have no plate:
 * their edge only lights as the wave passes.
 *
 * Every moving thing is worked out from the time alone. A slow machine draws fewer motes and sparks and no
 * blur (`q`); the flips and the slams keep their timing. Screen only: no rule here.
 */

import { easeInOut, easeOut } from "../anim.js";
import { type Geo, hexPath, hexPts, puff, rgba, seq } from "./winKit.js";
import { FLIP, span } from "./timeline.js";

const CYAN = "118 222 255";
const WHITE = "255 255 255";
const GOLD = "255 210 130";
const DUST = "176 160 140";

/** One sector's pose at u seconds from the start of its flip: lift (0-1), turn (radians, 0 to 2π), the time since it slammed down (or -1). */
export function flipPose(u: number): { lift: number; turn: number; slam: number } {
  let lift = 0;
  if (u > FLIP.lift[0] && u < FLIP.drop[1]) {
    if (u < FLIP.lift[1]) lift = easeOut(span(u, FLIP.lift));
    else if (u < FLIP.drop[0]) lift = 1;
    else lift = 1 - span(u, FLIP.drop) ** 2;
  }
  const turn = 2 * Math.PI * easeInOut(span(u, FLIP.turn));
  return { lift, turn, slam: u >= FLIP.slamAt ? u - FLIP.slamAt : -1 };
}

/**
 * When each sector starts its flip (s): a wave across the Field, column by column from the side away
 * from the sector the unit left (left to right when none), at most FLIP.maxStep apart; a little later
 * further down in a column. Every slam lands by the end of FLIP.flips.
 */
export function flipStarts(sectors: readonly (readonly [string, number, number])[], tile: number, from?: readonly [number, number]): Map<string, number> {
  const out = new Map<string, number>();
  if (sectors.length === 0) return out;
  const xs = sectors.map((s) => s[1]);
  const ys = sectors.map((s) => s[2]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  // Away from the sector the unit left: start on its side.
  const rightToLeft = from ? from[0] > (minX + maxX) / 2 : false;
  const col = (x: number) => Math.round(((rightToLeft ? maxX - x : x - minX) / Math.max(1, tile)) * 2.3);
  const cols = Math.max(...sectors.map((s) => col(s[1]))) + 1;
  const down = 0.04;
  const room = FLIP.flips[1] - FLIP.flips[0] - FLIP.slamAt - down;
  const step = cols > 1 ? Math.min(FLIP.maxStep, room / (cols - 1)) : 0;
  for (const [k, x, y] of sectors) out.set(k, FLIP.flips[0] + col(x) * step + (maxY > minY ? ((y - minY) / (maxY - minY)) * down : 0));
  return out;
}

/** The board's small jolt (pixels down) from every slam so far: a damped 1-2 px impulse each. */
export function boardJolt(t: number, starts: Iterable<number>, tile: number): number {
  let j = 0;
  const A = Math.max(1, Math.min(2, tile / 45));
  for (const s of starts) {
    const a = t - s - FLIP.slamAt;
    if (a >= 0 && a < 0.22) j += A * Math.exp(-a / 0.05) * Math.cos(a * 85);
  }
  return Math.max(-2.5, Math.min(2.5, j));
}

/** How a sector's tile looks now (the Field applies it, MissionWin's onShake). */
export interface FlipLook {
  dx: number;
  dy: number;
  scale?: number;
  sy?: number;
  alpha?: number;
  z?: number;
}

/** The plate's thickness against a tile's height. */
const THICK = 0.1;
/** How high a sector lifts, against a tile's height. */
const LIFT = 0.2;

/** A sector's tile at time t: lifted, turned, its face hidden while its underside shows (drawn by paintFlip). */
export function flipLook(t: number, start: number | undefined, tile: number, jolt: number): FlipLook {
  if (start === undefined) return { dx: 0, dy: jolt };
  const { lift, turn, slam } = flipPose(t - start);
  if (lift <= 0 && slam < 0) return { dx: 0, dy: jolt };
  if (lift <= 0) {
    // Landed hard: a moment's squash.
    if (slam >= 0.12) return { dx: 0, dy: jolt };
    return { dx: 0, dy: jolt, scale: 1 - 0.035 * Math.exp(-slam / 0.035) };
  }
  const scale = 1 + 0.06 * lift;
  const H = tile * LIFT * lift;
  const c = Math.cos(turn);
  const top = -((tile * THICK * scale) / 2) * Math.sin(turn);
  return { dx: 0, dy: jolt - H + top, scale, sy: c, alpha: c > 0.02 ? 1 : 0, z: 500 };
}

const DUSTS = Array.from({ length: 5 }, (_, k) => {
  const r = seq(510 + 17 * k);
  return Array.from({ length: 22 }, (_, i) => ({ edge: r() * 6, v: 0.25 + r() * 0.6, rise: r() * 0.3, life: 0.3 + r() * 0.4, size: 0.6 + r() * 1.2, spark: r() < 0.3, rank: i / 22 }));
});
const MOTES = (() => {
  const r = seq(8123);
  return Array.from({ length: 70 }, (_, i) => ({ x: r(), y: r(), born: 4.1 + r() * 0.9, life: 0.8 + r() * 0.6, vx: (r() - 0.5) * 0.06, vy: -0.03 - r() * 0.06, size: 0.5 + r(), rank: i / 70 }));
})();

/** The underside: dark machined metal with a rim light, circuit traces to the corners and three chevrons. */
function underside(g: CanvasRenderingContext2D, x: number, y: number, R: number, sq: number, all: number): void {
  g.save();
  g.translate(x, y);
  g.scale(1, Math.max(0.02, sq));
  hexPath(g, 0, 0, R);
  const base = g.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R * 1.1);
  base.addColorStop(0, `rgba(58,66,78,${all.toFixed(3)})`);
  base.addColorStop(0.7, `rgba(24,28,36,${all.toFixed(3)})`);
  base.addColorStop(1, `rgba(12,14,19,${all.toFixed(3)})`);
  g.fillStyle = base;
  g.fill();
  g.save();
  g.clip();
  g.globalCompositeOperation = "lighter";
  g.lineWidth = 1;
  // Circuit traces from a core to every corner, each with a node.
  g.strokeStyle = rgba(CYAN, 0.55 * all);
  for (const [px, py] of hexPts(0, 0, R * 0.78)) {
    g.beginPath();
    g.moveTo(px * 0.22, py * 0.22);
    g.lineTo(px * 0.55, py * 0.55);
    g.lineTo(px * 0.55 + (py > 0 ? R * 0.08 : -R * 0.08), py * 0.8);
    g.stroke();
    puff(g, CYAN, px * 0.55, py * 0.55, R * 0.06, 0.8 * all);
  }
  // Three chevrons.
  g.strokeStyle = rgba(GOLD, 0.7 * all);
  g.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    const yy = -R * 0.18 + i * R * 0.17;
    g.beginPath();
    g.moveTo(-R * 0.26, yy + R * 0.1);
    g.lineTo(0, yy - R * 0.04);
    g.lineTo(R * 0.26, yy + R * 0.1);
    g.stroke();
  }
  g.restore();
  // A crisp 1 px rim and the light catching its upper edge.
  hexPath(g, 0, 0, R);
  g.strokeStyle = rgba(CYAN, 0.45 * all);
  g.lineWidth = 1;
  g.stroke();
  g.restore();
}

/** The plate's bevelled edge between its top and bottom faces (both squashed by sq, `off` apart up and down). */
function plateEdge(g: CanvasRenderingContext2D, x: number, y: number, R: number, sq: number, off: number, all: number): void {
  const a = hexPts(x, y - off, R, sq);
  const b = hexPts(x, y + off, R, sq);
  const grd = g.createLinearGradient(x, y - Math.abs(off) - R * Math.abs(sq), x, y + Math.abs(off) + R * Math.abs(sq));
  grd.addColorStop(0, `rgba(96,106,120,${all.toFixed(3)})`);
  grd.addColorStop(0.5, `rgba(40,45,55,${all.toFixed(3)})`);
  grd.addColorStop(1, `rgba(16,18,24,${all.toFixed(3)})`);
  g.fillStyle = grd;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    g.moveTo(a[i]![0], a[i]![1]);
    g.lineTo(a[j]![0], a[j]![1]);
    g.lineTo(b[j]![0], b[j]![1]);
    g.lineTo(b[i]![0], b[i]![1]);
    g.closePath();
  }
  g.fill();
  // Machined grooves: a thin bright line along the middle of the edge.
  g.strokeStyle = rgba(CYAN, 0.25 * all);
  g.lineWidth = 1;
  g.beginPath();
  a.forEach(([ax, ay], i) => {
    const [bx, by] = b[i]!;
    if (i === 0) g.moveTo((ax + bx) / 2, (ay + by) / 2);
    else g.lineTo((ax + bx) / 2, (ay + by) / 2);
  });
  g.closePath();
  g.stroke();
}

/** The settled "secured" rim of a sector. */
function securedRim(g: CanvasRenderingContext2D, x: number, y: number, R: number, flash: number, a: number): void {
  hexPath(g, x, y, R);
  if (flash > 0.02) {
    g.strokeStyle = rgba(CYAN, 0.3 * flash);
    g.lineWidth = Math.max(4, R * 0.18);
    g.stroke();
    g.strokeStyle = rgba(WHITE, 0.95 * flash);
    g.lineWidth = 1.5 + 2 * flash;
    g.stroke();
  }
  if (a > 0.01) {
    hexPath(g, x, y, R * 0.95);
    g.strokeStyle = rgba(CYAN, 0.55 * a);
    g.lineWidth = 1;
    g.stroke();
  }
}

/**
 * One frame of Sector Flip. `starts`: when each sector's flip begins (flipStarts); `flat`: sectors with no
 * plate (Cleared); `all`: how much of it shows; `still`: the reduced-motion picture (every sector secured).
 */
export function paintFlip(g: CanvasRenderingContext2D, geo: Geo, t: number, still: boolean, all: number, q: number, starts: Map<string, number>, flat: Set<string>): void {
  const { fx, fy, fw, fh, tile } = geo;
  const R = tile * 0.46;
  const n = geo.cells.length;
  // The Field dims: its own tiles (MissionWin's onShake).

  // Act 1: the cells light in sequence; the last pulses with a ring and locks in.
  g.save();
  g.globalCompositeOperation = "lighter";
  const step = n > 1 ? Math.min(FLIP.cellStep, FLIP.cellsIn / (n - 1)) : 0;
  geo.cells.forEach((c, i) => {
    const age = still ? 9 : t - (FLIP.cellsAt + i * step);
    if (age < 0) return;
    const x = c.left + c.width / 2;
    const y = c.top + c.height / 2;
    const s = Math.max(c.width, c.height);
    const k = Math.exp(-age / 0.15);
    const Rg = s * (1.3 + 1.3 * k);
    const grd = g.createRadialGradient(x, y, 0, x, y, Rg);
    grd.addColorStop(0, rgba(WHITE, (0.3 + 0.7 * k) * all));
    grd.addColorStop(0.35, rgba(CYAN, (0.25 + 0.4 * k) * all));
    grd.addColorStop(1, rgba(CYAN, 0));
    g.fillStyle = grd;
    g.fillRect(x - Rg, y - Rg, 2 * Rg, 2 * Rg);
    if (i === n - 1 && !still) {
      const u = span(age, [FLIP.lockAfter, FLIP.lockAfter + 0.55]);
      if (u > 0 && u < 1) {
        g.strokeStyle = rgba(CYAN, (1 - u) * all);
        g.lineWidth = 1 + 2 * (1 - u);
        g.beginPath();
        g.arc(x, y, s * (0.7 + 2.4 * easeOut(u)), 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = rgba(WHITE, 0.8 * (1 - u) * all);
        g.lineWidth = 1;
        g.beginPath();
        g.arc(x, y, s * (0.5 + 1.4 * easeOut(u)), 0, Math.PI * 2);
        g.stroke();
      }
    }
  });
  g.restore();

  g.save();
  g.beginPath();
  g.rect(fx, fy, fw, fh);
  g.clip();
  const jolt = still ? 0 : boardJolt(t, starts.values(), tile);
  // Act 2, in two passes: first the shadows, edges and undersides (the plates in the air), then the light.
  const lifted: [number, number, ReturnType<typeof flipPose>, number][] = [];
  for (const [k, sx, sy] of geo.sectors) {
    const st = starts.get(k);
    if (st === undefined || flat.has(k) || still) continue;
    const pose = flipPose(t - st);
    if (pose.lift > 0) lifted.push([fx + sx, fy + sy + jolt, pose, st]);
  }
  for (const [x, y, pose] of lifted) {
    const scale = 1 + 0.06 * pose.lift;
    const H = tile * LIFT * pose.lift;
    const c = Math.cos(pose.turn);
    const off = ((tile * THICK * scale) / 2) * Math.sin(pose.turn);
    const cy = y - H;
    const Rs = R * scale;
    // The visible face (the Field's tile while right side up, else the underside): nothing drawn over it.
    g.save();
    g.beginPath();
    g.rect(fx, fy, fw, fh);
    for (const [i, [px, py]] of hexPts(x, cy - (c > 0 ? off : -off), Rs, Math.abs(c)).entries()) {
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.clip("evenodd");
    // The shadow left on the board, softer and further off the higher it is.
    if (q > 0.6) g.filter = `blur(${(2 + 6 * pose.lift).toFixed(1)}px)`;
    hexPath(g, x + H * 0.22, y + H * 0.34, R * (1 + 0.06 * pose.lift));
    g.fillStyle = `rgba(0,0,0,${(0.62 * pose.lift * all).toFixed(3)})`;
    g.fill();
    g.filter = "none";
    plateEdge(g, x, cy, Rs, c, off, all);
    g.restore();
    if (c <= 0.02) underside(g, x, cy + off, Rs, -c, all);
  }
  g.globalCompositeOperation = "lighter";
  for (const [k, sx, sy] of geo.sectors) {
    const x = fx + sx;
    const y = fy + sy + jolt;
    const st = starts.get(k);
    if (still || st === undefined) {
      securedRim(g, x, y, R, 0, 0.9 * all);
      continue;
    }
    const u = t - st;
    if (u < 0) continue;
    if (flat.has(k)) {
      // No plate: its edge lights as the wave passes it.
      const flash = u < FLIP.slamAt ? 0 : Math.exp(-(u - FLIP.slamAt) / 0.18);
      if (u >= FLIP.slamAt) securedRim(g, x, y, R, flash * all, Math.min(1, (u - FLIP.slamAt) / 0.3) * 0.9 * all);
      continue;
    }
    const pose = flipPose(u);
    if (pose.lift > 0) {
      // Back right side up: a bright rim on the face.
      const fl = span(u, [FLIP.turn[1] - 0.06, FLIP.turn[1]]) * Math.exp(-Math.max(0, u - FLIP.turn[1]) / 0.1);
      if (fl > 0.02) {
        const scale = 1 + 0.06 * pose.lift;
        securedRim(g, x, y - tile * LIFT * pose.lift, R * scale, fl * all, 0);
      }
      continue;
    }
    if (pose.slam < 0) continue;
    const a = pose.slam;
    // Landed: a small shock ring, dust and sparks at the rim, then the settled rim.
    const ring = span(a, [0, 0.35]);
    if (ring < 1) {
      g.beginPath();
      g.arc(x, y, R * (1 + 0.9 * easeOut(ring)), 0, Math.PI * 2);
      g.strokeStyle = rgba(CYAN, 0.6 * (1 - ring) * all);
      g.lineWidth = 1 + 1.5 * (1 - ring);
      g.stroke();
    }
    const pts = hexPts(x, y, R);
    const set = DUSTS[(Math.abs(Math.round(sx * 7 + sy * 3)) >>> 0) % DUSTS.length]!;
    for (const d of set) {
      if (d.rank > q || a > d.life) continue;
      const i = Math.floor(d.edge);
      const f = d.edge - i;
      const [ax, ay] = pts[i]!;
      const [bx, by] = pts[(i + 1) % 6]!;
      const ex = ax + (bx - ax) * f;
      const ey = ay + (by - ay) * f;
      const dist = tile * d.v * 0.4 * (1 - Math.exp(-a * 7));
      const ux = (ex - x) / R;
      const uy = (ey - y) / R;
      const life = 1 - a / d.life;
      if (d.spark) puff(g, WHITE, ex + ux * dist * 1.6, ey + uy * dist * 1.6 - tile * d.rise * a, tile * 0.03 * d.size, life * all);
      else {
        g.globalCompositeOperation = "source-over";
        puff(g, DUST, ex + ux * dist, ey + uy * dist - tile * d.rise * a * 0.5, tile * 0.06 * d.size * (1 + a * 2), 0.35 * life * all);
        g.globalCompositeOperation = "lighter";
      }
    }
    securedRim(g, x, y, R, Math.exp(-a / 0.14) * 0.8 * all, Math.min(1, a / 0.3) * 0.9 * all);
  }
  // Act 4: fine energy motes drift over the board.
  if (!still)
    for (const m of MOTES) {
      if (m.rank > q) continue;
      const age = t - m.born;
      if (age < 0 || age > m.life) continue;
      const u = age / m.life;
      puff(g, m.rank < 0.3 ? WHITE : CYAN, fx + fw * (m.x + m.vx * age * 4), fy + fh * (m.y + m.vy * age * 4), tile * 0.03 * m.size, Math.sin(Math.PI * u) * all * 0.85);
    }
  g.restore();
}
