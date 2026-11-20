/**
 * Field Array, the second kill for Gamma (designer 2026-11-20, I26: "change perspective or use sectors in
 * some unusual way"; both plans built). The whole Field becomes the weapon. About 8.2 s (ARRAY in
 * timeline.ts):
 *
 * 1. Arming: from the Field's edge inwards, ring by ring, every sector's edge is traced by energy and
 *    lights up, an emitter waking in its middle; the zoom closes in slowly.
 * 2. Lattice: beams of particles leap from each sector to its neighbour one ring nearer the Gamma, a
 *    lattice that tightens on it; the Gamma pushes back with a shield of hexagonal cells, which crack one
 *    by one and burst; the shield breaks.
 * 3. Cut: the camera turns to a side view (the Field seen nearly edge-on, tilt.ts); the beams lift the
 *    Gamma out of its sector as a column, then blades of light cut it into slices that slide apart.
 * 4. Fall: back to the view from above as the slices fall into the sector, which caves in to stars, then
 *    shows what lay beneath; the lattice crumbles into falling sparks; "GAMMA DOWN · 1 / 2" turns to "2 / 2".
 * 5. Back: the zoom eases back.
 *
 * Energy is drawn with particles (designer's standing taste). Everything is worked out from the time alone.
 * Screen only: nothing here is a rule.
 */

import { Graphics } from "pixi.js";
import type { Step } from "../anim.js";
import { easeInOut, easeOut, easeOutBack } from "../anim.js";
import { playArrayArm, playGammaCut, playLatticeLock, playTargetLock } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, around, closeupStep, hexCorners, motes, seq } from "./closeup.js";
import { boardHex, drawSlots, hexDist, project, tiltBoard } from "./tilt.js";
import { ARRAY as T, span } from "./timeline.js";

const CYAN = 0x5ce1ff;
const TEAL = 0x38f2c8;
const ICE = 0xe6fbff;
const VIOLET = 0x7a3cff;
const MAGENTA = 0xff4fd8;
const LILAC = 0xc9a6ff;
/** How far the camera turns for the side view (radians: 78°). */
const SIDE = (78 * Math.PI) / 180;
/** Where the blades cut the column (shares of its height), bottom to top. */
const CUTS = [0.24, 0.46, 0.66, 0.84] as const;
/** The shield's cells: a ring of twelve low round it and six higher, a dome (board-plane radius and height in unit radii). */
const CELLS = (() => {
  const r = seq(5167);
  const out: { a: number; r: number; h: number; at: number }[] = [];
  for (let i = 0; i < 12; i++) out.push({ a: (i / 12) * Math.PI * 2, r: 1.18, h: 0.12, at: r() });
  for (let i = 0; i < 6; i++) out.push({ a: (i / 6) * Math.PI * 2 + 0.26, r: 0.66, h: 0.55, at: r() });
  // The order they crack in.
  const order = out.map((c, i) => ({ i, k: c.at })).sort((a, b) => a.k - b.k);
  order.forEach((o, n) => (out[o.i]!.at = n / (out.length - 1)));
  return out;
})();
const SPARKS = (() => {
  const r = seq(2287);
  return Array.from({ length: 8 }, () => ({ a: r() * Math.PI * 2, v: 0.6 + r() * 0.9, up: r() * 0.6 }));
})();
const STARS = (() => {
  const r = seq(8803);
  return Array.from({ length: 26 }, () => ({ x: (r() - 0.5) * 1.5, y: (r() - 0.5) * 1.5, s: 0.4 + r(), tw: r() * 6.28 }));
})();

/** The column's height (unit radii) at time t. */
function columnAt(t: number): number {
  return 2.3 * easeOutBack(span(t, T.rise));
}

/** Field Array as a Field step (and its still picture for reduced motion and Instant). */
export function gammaArrayStep(env: KillEnv, k: KillTarget): Step {
  /** Each sector: its ring (hex distance from the Gamma) and where its beam goes (a neighbour one ring nearer). */
  let net: Map<string, { d: number; to: string; idx: number }> | undefined;
  let maxD = 1;
  const netOf = () => {
    if (net) return net;
    const cs = env.centres?.() ?? [];
    const pos = new Map(cs.map(([key, x, y]) => [key, [x, y] as const]));
    const g = pos.get(k.sector) ?? [0, 0];
    net = new Map();
    cs.forEach(([key, x, y], idx) => {
      const d = hexDist(key, k.sector);
      if (d < 1) return;
      maxD = Math.max(maxD, d);
      let to = k.sector;
      if (d > 1) {
        let best = Infinity;
        for (const n of around(key)) {
          const p = pos.get(n.key);
          if (!p || hexDist(n.key, k.sector) !== d - 1) continue;
          const dist = Math.hypot(p[0] - g[0], p[1] - g[1]) + Math.hypot(p[0] - x, p[1] - y) * 0.01;
          if (dist < best) (best = dist), (to = n.key);
        }
      }
      net!.set(key, { d, to, idx });
    });
    return net;
  };
  const armAt = (d: number) => T.arm[0] + ((maxD - d) / Math.max(1, maxD - 1)) * (T.arm[1] - T.arm[0] - 0.3);
  const beamAt = (d: number) => T.beams[0] + ((maxD - d) / Math.max(1, maxD - 1)) * (T.beams[1] - T.beams[0] - 0.3);

  return closeupStep(env, k, {
    times: { total: T.total, zoomIn: T.zoomIn, back: T.back, breakAt: T.fall[1] - 0.05, wreckIn: T.wreckIn, label: T.label, count: T.count, stillAt: T.count + 0.3 },
    size: 0.13,
    hole: 3.4,
    title: `${k.name.toUpperCase()} DOWN`,
    accent: CYAN,
    ink: ICE,
    inkLine: 0x06324a,
    labelScale: 1.25,
    build: (back, front, under) => {
      const slots = new Graphics();
      under.addChild(slots);
      const dim = new Graphics();
      const hole = new Graphics();
      const lines = new Graphics();
      lines.blendMode = "add";
      const column = new Graphics();
      back.addChild(dim, hole, lines, column);
      const pm = motes(front, 1700);
      const top = new Graphics();
      top.blendMode = "add";
      const white = new Graphics();
      white.blendMode = "add";
      front.addChild(top, white);
      return { slots, dim, hole, lines, column, pm, top, white };
    },
    shake: (t, Rs) => {
      let a = 0;
      if (t > T.lock) a += 0.04 * Math.max(0, 1 - (t - T.lock) / 0.4);
      if (t > T.cut) a += 0.05 * Math.max(0, 1 - (t - T.cut) / 0.45);
      if (t > T.fall[1] - 0.1) a += 0.025 * Math.max(0, 1 - (t - T.fall[1] + 0.1) / 0.35);
      const w = t * 57;
      return [Math.sin(w) * a * Rs, Math.cos(w * 1.4) * a * Rs * 0.6];
    },
    tile: (t) => ({ scale: 1 - 0.5 * span(t, T.fall) ** 2, alpha: 1 - span(t, [T.fall[1] - 0.3, T.fall[1] - 0.05]) }),
    sounds: (crossed) => {
      if (crossed(T.arm[0])) playArrayArm();
      if (crossed(T.shield[0] + 0.3)) playTargetLock();
      if (crossed(T.lock)) playLatticeLock();
      if (crossed(T.cut)) playGammaCut();
    },
    draw: (f, b) => {
      const { t, still, Sx, Sy, Rs, w, h } = f;
      const D = Rs * 10;
      const sideU = still ? 0 : t < T.flat[0] ? easeInOut(span(t, T.side)) : 1 - easeInOut(span(t, T.flat));
      const th = SIDE * sideU;
      const N = netOf();
      const centres = env.centres?.() ?? [];
      // The column's height, kept on the screen above the unit.
      const Hc = columnAt(t) * Math.min(Rs, Math.max(Rs * 0.5, (Sy - 50) / 2.7));
      /** A slice's sideways slide and drop (j from the bottom; the top slice carries the tile). */
      const slideU = still ? 0 : easeOut(span(t, T.slide));
      const fallU = still ? 0 : span(t, T.fall);
      const sliceShift = (j: number): [number, number] => (j === 0 ? [0, 0] : [(j % 2 ? 1 : -1) * Rs * (0.16 + 0.1 * j) * slideU, Rs * 0.08 * ((j % 3) - 1) * slideU]);
      const sliceDrop = (j: number) => Rs * 2.6 * fallU * fallU * (1 + 0.15 * j);
      const topJ = CUTS.length;

      const placed = tiltBoard(f, centres, th, D, (key) => {
        if (key !== k.sector || still || t >= T.fall[1] - 0.05) return undefined;
        // The tile is the column's top until it falls into the sector.
        return { H: Math.max(0, Hc - (t > T.fall[0] ? sliceDrop(topJ) : 0)), shift: sliceShift(topJ), z: 5000 };
      });
      const where = new Map(placed.map((p) => [p.key, p]));
      // The Gamma's stand-in (it leaves no Wreck) follows the board and the column.
      const g0 = env.ghost && !env.ghost.destroyed && env.ghost.visible ? env.ghost : undefined;
      if (g0) {
        const Lg = f.look(k.sector);
        g0.position.set(f.cx + Lg.dx, f.cy + Lg.dy);
        g0.scale.set(Lg.scale * Lg.scaleX, Lg.scale);
      }
      env.slots?.(false);
      drawSlots(b.slots.clear(), placed, Rs, th);
      const P = (X: number, Y: number, H: number) => {
        const pr = project(X, Y, H, th, D);
        return { x: Sx + pr.x, y: Sy + pr.y, p: pr.p };
      };

      const lines = b.lines.clear();
      const column = b.column.clear();
      // The Field dims a little so the energy reads, until the view is from above again.
      const dimA = still ? 0 : 0.42 * span(t, [0, 0.5]) * (1 - span(t, T.flat));
      const dim = b.dim.clear();
      if (dimA > 0.01) dim.rect(0, 0, w, h).fill({ color: 0x02040c, alpha: dimA });
      const hole = b.hole.clear();
      const top = b.top.clear();
      const white = b.white.clear();
      b.pm.begin();
      // The lattice crumbles after the cut.
      const crumble = still ? 1 : span(t, [T.cut + 0.3, T.flat[1]]);
      const live = 1 - crumble;

      // Act 1: each sector's edge traced by energy from a corner, then lit, with an emitter in its middle.
      for (const [key, n] of N) {
        const pl = where.get(key);
        if (!pl) continue;
        const at = armAt(n.d);
        const u = still ? 0 : span(t, [at, at + 0.32]);
        if (u <= 0) continue;
        const pulse = 0.75 + 0.25 * Math.sin(t * 6 + n.idx);
        const al = live * (n.d > 3 ? 0.65 : 1);
        if (al < 0.02) continue;
        const pts = boardHex(pl.sx, pl.sy, Rs * 0.93, pl.p, th);
        const per = 6 * easeOut(u);
        const whole = Math.floor(per);
        const path: number[] = [pts[0]!, pts[1]!];
        for (let e = 1; e <= whole && e <= 6; e++) path.push(pts[(e % 6) * 2]!, pts[(e % 6) * 2 + 1]!);
        let hx = pts[(whole % 6) * 2]!;
        let hy = pts[(whole % 6) * 2 + 1]!;
        if (whole < 6) {
          const fr = per - whole;
          const nx = pts[((whole + 1) % 6) * 2]!;
          const ny = pts[((whole + 1) % 6) * 2 + 1]!;
          hx += (nx - hx) * fr;
          hy += (ny - hy) * fr;
          path.push(hx, hy);
          b.pm.dot(hx, hy, Rs * 0.16 * pl.p, ICE, al);
        }
        lines.poly(path, false).stroke({ width: Math.max(6, Rs * 0.16 * pl.p), color: CYAN, alpha: 0.22 * al * pulse });
        lines.poly(path, false).stroke({ width: 2.2, color: ICE, alpha: 0.9 * al });
        // A spark at each corner reached.
        for (let e = 0; e <= Math.min(whole, 5); e++) b.pm.dot(pts[e * 2]!, pts[e * 2 + 1]!, Rs * 0.1 * pl.p, ICE, 0.7 * al * pulse);
        // Particles riding the edge.
        if (u >= 1)
          for (let j = 0; j < 7; j++) {
            const v = (t * 0.5 + j / 7 + n.idx * 0.21) % 1;
            const e = Math.floor(v * 6);
            const fr = v * 6 - e;
            const ax = pts[e * 2]!;
            const ay = pts[e * 2 + 1]!;
            const bx = pts[((e + 1) % 6) * 2]!;
            const by = pts[((e + 1) % 6) * 2 + 1]!;
            b.pm.dot(ax + (bx - ax) * fr, ay + (by - ay) * fr, Rs * 0.07 * pl.p, j % 2 ? CYAN : TEAL, 0.8 * al, 2.5, Math.atan2(by - ay, bx - ax));
          }
        // The emitter in its middle.
        const eu = span(t, [at + 0.2, at + 0.45]);
        if (eu > 0) {
          b.pm.dot(pl.sx, pl.sy, Rs * 0.22 * pl.p * eu, CYAN, 0.35 * al * pulse);
          b.pm.dot(pl.sx, pl.sy, Rs * 0.07 * pl.p, ICE, al);
        }
      }

      // Act 2: beams leap ring by ring towards the Gamma, particles flowing along them; later they reach the column.
      const shieldGone = still || t >= T.lock;
      const g = where.get(k.sector);
      let ringOne = 0;
      for (const [key, n] of N) {
        const a = where.get(key);
        if (!a) continue;
        const at = beamAt(n.d);
        const u = still ? 0 : span(t, [at, at + 0.3]);
        if (u <= 0 || live < 0.02) continue;
        let tx: number;
        let ty: number;
        if (n.d === 1) {
          // To the shield's edge, then to the Gamma; on the column at a cut's height once it rises.
          const j = ringOne++;
          const H = Hc > 1 ? Hc * CUTS[j % CUTS.length]! : 0;
          const c = P(0, 0, H);
          const stop = shieldGone || Hc > 1 ? (Hc > 1 ? Rs * 0.25 : Rs * 0.1) : Rs * 1.12;
          const dx = c.x - a.sx;
          const dy = c.y - a.sy;
          const d = Math.hypot(dx, dy) || 1;
          tx = c.x - (dx / d) * stop * c.p;
          ty = c.y - (dy / d) * stop * c.p;
        } else {
          const bt = where.get(n.to);
          if (!bt) continue;
          tx = bt.sx;
          ty = bt.sy;
        }
        const e = easeOut(u);
        const ex = a.sx + (tx - a.sx) * e;
        const ey = a.sy + (ty - a.sy) * e;
        const al = live * (n.d > 3 ? 0.7 : 1);
        lines.moveTo(a.sx, a.sy).lineTo(ex, ey).stroke({ width: Math.max(5, Rs * 0.1), color: CYAN, alpha: 0.12 * al });
        lines.moveTo(a.sx, a.sy).lineTo(ex, ey).stroke({ width: 1.8, color: ICE, alpha: 0.6 * al });
        const ang = Math.atan2(ty - a.sy, tx - a.sx);
        for (let j = 0; j < 5; j++) {
          const v = (t * 1.7 + j / 5 + n.idx * 0.37) % 1;
          if (v > e) continue;
          b.pm.dot(a.sx + (tx - a.sx) * v, a.sy + (ty - a.sy) * v, Rs * 0.07, j % 2 ? CYAN : ICE, 0.9 * al, 3, ang);
        }
        if (u < 1) b.pm.dot(ex, ey, Rs * 0.16, ICE, al);
        else if (n.d === 1) b.pm.dot(tx, ty, Rs * (0.12 + 0.05 * Math.sin(t * 30 + n.idx)), 0xffffff, 0.9 * al);
      }
      // The lattice crumbling: sparks falling from where the beams were.
      if (crumble > 0 && crumble < 1 && !still)
        for (const [key, n] of N) {
          const a = where.get(key);
          const bt = n.d === 1 ? g : where.get(n.to);
          if (!a || !bt || n.d > 4) continue;
          for (let j = 0; j < 3; j++) {
            const v = (j + 0.5) / 3;
            const fall = crumble * crumble * Rs * (1.2 + j * 0.3);
            b.pm.dot(a.sx + (bt.sx - a.sx) * v, a.sy + (bt.sy - a.sy) * v + fall, Rs * 0.06, j % 2 ? CYAN : ICE, 0.8 * (1 - crumble));
          }
        }

      // The Gamma's shield: a dome of hexagonal cells, flaring as beams strike, cracking one by one, bursting.
      if (!still && t > T.shield[0] && t < T.lock + 0.5) {
        const inU = easeOut(span(t, [T.shield[0], T.shield[0] + 0.45]));
        for (const c of CELLS) {
          const ct = T.crack[0] + c.at * (T.crack[1] - T.crack[0]);
          const bu = span(t, [ct, ct + 0.32]);
          const X = Math.cos(c.a) * c.r * Rs;
          const Y = Math.sin(c.a) * c.r * Rs;
          const H = c.h * Rs;
          if (bu < 1) {
            const sc = Rs * 0.24 * inU * (1 + 0.35 * bu);
            const hit = Math.max(0, Math.sin(t * 23 + c.a * 5)) * span(t, [T.beams[1] - 0.3, ct]);
            const al = (1 - bu) * (0.7 + 0.3 * hit);
            const cs = hexCorners(0, 0, sc).map(([x, y]) => P(X + x, Y + y, H));
            const flat = cs.flatMap((q) => [q.x, q.y]);
            // A faint film and a fine edge; the cell itself is made of particles shimmering along its edges.
            lines.poly(flat).fill({ color: VIOLET, alpha: 0.06 * al });
            lines.poly(flat).stroke({ width: 1, color: bu > 0 ? 0xffffff : MAGENTA, alpha: 0.45 * al });
            cs.forEach((q, j) => {
              const n2 = cs[(j + 1) % 6]!;
              for (let m = 0; m < 2; m++) {
                const v = (m + 0.5 + 0.5 * Math.sin(t * 5 + j + c.a * 3)) / 2;
                const sh = 0.6 + 0.4 * Math.sin(t * 19 + j * 2.3 + m + c.a * 7);
                b.pm.dot(q.x + (n2.x - q.x) * v, q.y + (n2.y - q.y) * v, Rs * 0.06, m ? MAGENTA : LILAC, al * sh, 2, Math.atan2(n2.y - q.y, n2.x - q.x));
              }
              b.pm.dot(q.x, q.y, Rs * 0.07, 0xffffff, 0.7 * al);
            });
            if (t > ct - 0.18 && bu === 0) {
              // About to crack: white lines across it.
              const q0 = cs[0]!;
              const q3 = cs[3]!;
              top.moveTo(q0.x, q0.y).lineTo(q3.x, q3.y).stroke({ width: 1.5, color: 0xffffff, alpha: span(t, [ct - 0.18, ct]) });
            }
          }
          if (bu > 0 && bu < 1) {
            const q = P(X, Y, H);
            for (const s of SPARKS) {
              const r = Rs * s.v * easeOut(bu);
              b.pm.dot(q.x + Math.cos(s.a + c.a) * r, q.y + Math.sin(s.a + c.a) * r * 0.7 - Rs * s.up * bu + Rs * 0.4 * bu * bu, Rs * 0.07, s.v > 1.1 ? 0xffffff : MAGENTA, 1 - bu);
            }
          }
        }
        // The shield breaks: a ring of light and a flash.
        const lk = span(t, [T.lock, T.lock + 0.45]);
        if (lk > 0 && lk < 1) {
          const ring: number[] = [];
          for (let j = 0; j <= 48; j++) {
            const a = (j / 48) * Math.PI * 2;
            const q = P(Math.cos(a) * Rs * (1.2 + 2 * easeOut(lk)), Math.sin(a) * Rs * (1.2 + 2 * easeOut(lk)), 0);
            ring.push(q.x, q.y);
          }
          lines.poly(ring, true).stroke({ width: 3 + 8 * (1 - lk), color: MAGENTA, alpha: 0.8 * (1 - lk) });
          white.rect(0, 0, w, h).fill({ color: 0xf0e0ff, alpha: 0.18 * (1 - lk) ** 2 });
        }
      }

      // Act 3: the column, lifted out of the sector, cut into slices that slide apart and fall.
      if (!still && Hc > 1) {
        const bounds = [0, ...CUTS.map((c) => c * Hc), Hc];
        const cutDone = t >= T.cut;
        const slices = cutDone ? bounds.length - 1 : 1;
        const fade = 1 - span(t, [T.fall[1] - 0.35, T.fall[1]]);
        for (let j = 0; j < slices; j++) {
          const h0 = cutDone ? bounds[j]! : 0;
          const h1 = cutDone ? bounds[j + 1]! : Hc;
          const [sx, sy] = cutDone ? sliceShift(j) : [0, 0];
          const drop = t > T.fall[0] ? sliceDrop(j) : 0;
          const shrink = 1 - 0.45 * fallU * fallU;
          const lo = h0 - drop;
          const hi = h1 - drop;
          if (hi <= 0 && lo <= 0 && t > T.fall[0]) continue;
          const cs = hexCorners(0, 0, Rs * 0.9 * shrink);
          const at = (i: number, H: number) => P(sx + cs[i % 6]![0], sy + cs[i % 6]![1], Math.max(0, H));
          // The faces turned to the camera (normals between them point down the screen: corners 0-1, 1-2, 2-3).
          for (const [i, shade] of [
            [0, 0.55],
            [3, 0.55],
            [2, 0.75],
            [1, 1],
          ] as const) {
            const a0 = at(i, lo);
            const a1 = at(i + 1, lo);
            const b1 = at(i + 1, hi);
            const b0 = at(i, hi);
            const quad = [a0.x, a0.y, a1.x, a1.y, b1.x, b1.y, b0.x, b0.y];
            column.poly(quad).fill({ color: shade > 0.9 ? 0x3b2070 : shade > 0.7 ? 0x2c1658 : 0x1f0f40, alpha: fade });
            column.poly(quad).stroke({ width: 1.2, color: LILAC, alpha: 0.7 * fade });
          }
          // A cut face glows white-hot, cooling; energy runs up the column's front edges.
          if (cutDone && j < slices - 1) {
            const cool = span(t, [T.cut, T.cut + 1.2]);
            const capPts = cs.flatMap((_, i) => {
              const q = at(i, hi);
              return [q.x, q.y];
            });
            column.poly(capPts).fill({ color: cool < 0.5 ? 0xfff2e0 : 0xff9a4a, alpha: (1 - 0.7 * cool) * fade });
          }
          // A band of light rising over the near faces.
          if (!cutDone || j > 0) {
            const band = ((t * 0.9) % 1) * Hc - drop;
            if (band > lo && band < hi) {
              const q1 = at(1, band);
              const q2 = at(2, band);
              const q3 = at(3, band);
              top.moveTo(q1.x, q1.y).lineTo(q2.x, q2.y).lineTo(q3.x, q3.y).stroke({ width: 2, color: LILAC, alpha: 0.6 * fade });
            }
          }
          for (const i of [1, 2]) {
            for (let m = 0; m < 3; m++) {
              const v = (t * 1.3 + m / 3 + j * 0.3 + i * 0.5) % 1;
              const q = at(i, lo + (hi - lo) * v);
              b.pm.dot(q.x, q.y, Rs * 0.07, m % 2 ? LILAC : MAGENTA, 0.85 * fade, 2.5, -Math.PI / 2);
            }
          }
        }
        // A glow round its foot as it rises.
        const foot = P(0, 0, 0);
        b.pm.dot(foot.x, foot.y, Rs * 2.2 * foot.p, VIOLET, 0.3 * (1 - span(t, T.fall)));
        // The blades: four lines of light sweep across it at the cuts, throwing sparks.
        const bladeEnd = T.cut + 0.7;
        if (t > T.cut - 0.05 && t < bladeEnd) {
          CUTS.forEach((c, j) => {
            const s0 = T.cut + j * 0.04;
            const u = span(t, [s0, s0 + 0.16]);
            const fadeB = 1 - span(t, [s0 + 0.16, bladeEnd]);
            if (u <= 0) return;
            const H = c * Hc;
            const a = P(-Rs * 1.9, 0, H);
            const z = P(Rs * 1.9, 0, H);
            const ex = a.x + (z.x - a.x) * easeOut(u);
            const ey = a.y + (z.y - a.y) * easeOut(u);
            top.moveTo(a.x, a.y).lineTo(ex, ey).stroke({ width: Rs * 0.12 * fadeB + 1, color: CYAN, alpha: 0.4 * fadeB });
            top.moveTo(a.x, a.y).lineTo(ex, ey).stroke({ width: 2.5, color: 0xffffff, alpha: fadeB });
            if (u < 1) b.pm.dot(ex, ey, Rs * 0.25, ICE, 1);
            for (let m = 0; m < 8; m++) {
              const v = span(t, [s0 + 0.08, s0 + 0.6]);
              if (v <= 0 || v >= 1) continue;
              const side = m % 2 ? 1 : -1;
              const q = P(side * Rs * 0.9, 0, H);
              const r = Rs * (0.3 + 0.12 * m) * easeOut(v);
              b.pm.dot(q.x + side * r, q.y - Rs * 0.2 * Math.sin(m) * v + Rs * 0.6 * v * v, Rs * 0.06, m % 3 ? 0xffe2a8 : 0xffffff, 1 - v, 2.5, side > 0 ? 0 : Math.PI);
            }
          });
          const fl = 1 - span(t, [T.cut, T.cut + 0.3]);
          if (t >= T.cut && fl > 0) white.rect(0, 0, w, h).fill({ color: 0xe0f8ff, alpha: 0.16 * fl * fl });
        }
      }

      // Act 4: the sector caved in to stars, then what lay beneath shows again.
      const hu = still ? 0 : span(t, T.hole) > 0 ? Math.min(1, span(t, [T.hole[0], T.hole[0] + 0.2])) * (1 - span(t, [T.wreckIn[0] + 0.1, T.wreckIn[1] + 0.2])) : 0;
      if (hu > 0.01) {
        const q = P(0, 0, 0);
        const hx = boardHex(q.x, q.y, Rs * 0.93, q.p, th);
        hole.poly(hx).fill({ color: 0x01020a, alpha: 0.95 * hu });
        for (const s of STARS) b.pm.dot(q.x + s.x * Rs * q.p * 0.9, q.y + s.y * Rs * q.p * 0.9 * Math.cos(th), Rs * 0.05 * s.s, s.s > 1.1 ? CYAN : ICE, hu * (0.5 + 0.5 * Math.sin(t * 7 + s.tw)));
        hole.poly(hx).stroke({ width: Math.max(2, Rs * 0.05), color: CYAN, alpha: 0.85 * hu });
      }
      b.pm.end();
    },
  });
}
