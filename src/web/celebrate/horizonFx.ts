/**
 * Event Horizon, the first kill for Gamma (designer 2026-11-20, I26: "change perspective or use sectors in
 * some unusual way"; both plans built). About 8 s (HORIZON in timeline.ts):
 *
 * 1. Tilt: the zoom, and the camera swings down: the whole Field tilts back into a 3D board seen from a
 *    low angle (tilt.ts); hexagonal brackets slam onto the Gamma.
 * 2. Gravity: the Gamma collapses into a black sphere with a disc of particles whirling round it (its far
 *    side bent up over the top); the space of the board sags into a well; the two rings of sectors round it
 *    lift off the board, tilting and wobbling, pulled in, with streams of light torn off them spiralling in;
 *    the Gamma itself falls in.
 * 3. Snap: the sphere shrinks to a point; a frozen, colourless moment; a jet of light fires up and a flat
 *    shock wave races over the board, flipping every sector it passes like a card.
 * 4. Settle: the lifted sectors drop back onto the board one by one, with dust; the Gamma's sector is a
 *    fading crater over what lay beneath; the label "GAMMA DOWN · 1 / 2" turns to "2 / 2".
 * 5. Back: the board turns flat again as the zoom eases back.
 *
 * Energy is drawn with particles (designer's standing taste). Everything is worked out from the time alone.
 * Screen only: nothing here is a rule.
 */

import { Graphics } from "pixi.js";
import type { Step } from "../anim.js";
import { easeInOut, easeOut } from "../anim.js";
import { playGammaCollapse, playGammaJet, playSectorLand, playTargetLock } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, closeupStep, glowSprite, hexCorners, motes, seq } from "./closeup.js";
import { boardHex, drawSlots, hexDist, project, tiltBoard } from "./tilt.js";
import { HORIZON as T, span } from "./timeline.js";

const VIOLET = 0x7a3cff;
const MAGENTA = 0xff4fd8;
const LILAC = 0xc9a6ff;
const CYAN = 0x6fe3ff;
const PALE = 0xf4ecff;
/** How far the board tilts back (radians: 60°). */
const THETA = (60 * Math.PI) / 180;

/** The disc's particles: radius (sphere radii), where they start, how bright. */
const DISC = (() => {
  const r = seq(6113);
  return Array.from({ length: 230 }, () => ({ r: 1.25 + 2.2 * r() ** 1.6, a: r() * Math.PI * 2, size: 0.5 + r(), hue: r(), tw: r() * 6.28 }));
})();
/** The bent-up far side of the disc over the sphere's top. */
const ARC = (() => {
  const r = seq(4471);
  return Array.from({ length: 70 }, () => ({ u: r(), off: (r() - 0.5) * 0.18, size: 0.6 + r() * 0.8, sp: 0.15 + r() * 0.25 }));
})();
/** The jet's particles. */
const JET = (() => {
  const r = seq(9203);
  return Array.from({ length: 110 }, () => ({ ph: r(), x: (r() - 0.5) * 2, sp: 1.1 + r() * 1.4, size: 0.5 + r(), hot: r() < 0.4 }));
})();
/** Sparks round the crater's rim. */
const RIM = (() => {
  const r = seq(3391);
  return Array.from({ length: 30 }, () => ({ a: r() * Math.PI * 2, ph: r(), sp: 0.5 + r() * 0.8, up: 0.3 + r() * 0.5 }));
})();

/** The singularity's size (sphere radii of Rs) at time t. */
function sphereAt(t: number): number {
  const grow = easeOut(span(t, T.collapse));
  const fed = 0.18 * span(t, T.swallow);
  const shrink = 1 - easeInOut(span(t, [T.snap - 0.2, T.snap]));
  return t >= T.snap ? 0 : (0.36 + fed) * grow * shrink * (1 + 0.04 * Math.sin(t * 17));
}
/** How deep the board's space sags (0-1), with the ripple after the snap. */
function wellAt(t: number): number {
  if (t < T.snap) return easeOut(span(t, T.collapse)) * (0.6 + 0.4 * span(t, T.swallow));
  const u = span(t, [T.snap, T.wave[1]]);
  return (1 - u) * Math.cos(u * 9) * (t < T.jet[0] ? 1.15 : 1);
}

/** Where a lifted sector is at time t: lifted, pulled in, turned, tipped (before the wave's flip). */
function liftedPose(t: number, d: number, i: number, order: number, n: number, hit: number, Rs: number): { H: number; inward: number; turn: number; tip: number; landed: number } {
  const L0 = d === 1 ? T.lift1 : T.lift2;
  const st = (i % 5) * 0.06;
  const tp = Math.min(t, T.snap);
  const lu = easeInOut(span(tp, [L0[0] + st, L0[1] + st]));
  const pu = span(tp, [L0[0] + st, T.snap]);
  const hi = d === 1 ? 0.95 : 0.6;
  let H = Rs * (hi * lu + 0.08 * Math.sin(tp * 3.1 + i) * lu + 0.25 * pu * pu * (d === 1 ? 1 : 0.6));
  let inward = (d === 1 ? 0.3 : 0.17) * pu * pu + 0.03 * lu;
  const side = i % 2 ? 1 : -1;
  let turn = (0.35 * pu * pu + 0.1 * Math.sin(tp * (6 + (i % 4)) + i) * pu) * side;
  // Lifted, each turns a little towards the camera (more face-on), wobbling.
  let tip = -0.42 * lu + 0.22 * Math.sin(tp * 4.3 + i * 1.7) * pu;
  // The frozen moment: a fine tremble.
  if (t > T.snap && t < T.jet[0]) turn += 0.015 * Math.sin(t * 90 + i);
  // Thrown up a little by the wave, then dropped back one by one.
  const ls = T.land[0] + (order / Math.max(1, n - 1)) * (T.land[1] - T.land[0] - 0.5);
  const fall = span(t, [ls, ls + 0.45]);
  const k = 1 - fall * fall;
  const kick = t > hit ? Rs * 0.35 * Math.sin(Math.PI * span(t, [hit, ls + 0.45])) : 0;
  H = H * k + kick * k;
  inward *= k;
  turn *= k;
  tip *= k;
  if (fall >= 1) H += Rs * 0.07 * Math.sin(Math.PI * span(t, [ls + 0.45, ls + 0.7]));
  return { H, inward, turn, tip, landed: ls + 0.45 };
}

/** Event Horizon as a Field step (and its still picture for reduced motion and Instant). */
export function gammaHorizonStep(env: KillEnv, k: KillTarget): Step {
  /** The lifted sectors (rings 1 and 2), in the order they land: ring 2 first, then round by angle. */
  let lifted: { key: string; d: number; i: number; order: number }[] | undefined;
  const landed = new Set<number>();
  const liftedOf = () => {
    if (lifted) return lifted;
    const all = (env.centres?.() ?? []).map(([key]) => ({ key, d: hexDist(key, k.sector) })).filter((x) => x.d === 1 || x.d === 2);
    const [q0, r0] = k.sector.split(",").map(Number) as [number, number];
    const ang = (key: string) => {
      const [q, r] = key.split(",").map(Number) as [number, number];
      return Math.atan2(-(q - q0) * 0.866, r - r0 + (q - q0) * 0.5);
    };
    all.sort((a, b) => b.d - a.d || ang(a.key) - ang(b.key));
    lifted = all.map((x, order) => ({ ...x, i: order, order }));
    return lifted;
  };

  return closeupStep(env, k, {
    times: { total: T.total, zoomIn: T.zoomIn, back: T.back, breakAt: T.snap, wreckIn: T.wreckIn, label: T.label, count: T.count, stillAt: T.count + 0.3 },
    size: 0.12,
    hole: 3.6,
    title: `${k.name.toUpperCase()} DOWN`,
    accent: VIOLET,
    ink: PALE,
    inkLine: 0x2a0c5a,
    labelScale: 1.25,
    build: (back, front, under) => {
      const slots = new Graphics();
      under.addChild(slots);
      const backs = new Graphics();
      const grid = new Graphics();
      grid.blendMode = "add";
      const crater = new Graphics();
      back.addChild(backs, crater, grid);
      // The halo, the far half of the disc, then the sphere in front of it; everything else in front of them.
      const halo = glowSprite(back, VIOLET);
      const far = motes(back, 260);
      const ball = new Graphics();
      const freeze = new Graphics();
      back.addChild(ball, freeze);
      const pm = motes(front, 760);
      const lines = new Graphics();
      lines.blendMode = "add";
      const jetGlow = Array.from({ length: 9 }, () => glowSprite(front, VIOLET));
      const white = new Graphics();
      white.blendMode = "add";
      front.addChild(lines, white);
      return { slots, backs, grid, crater, far, halo, ball, freeze, pm, lines, jetGlow, white };
    },
    shake: (t, Rs) => {
      let a = 0;
      if (t > T.jet[0]) a += 0.07 * Math.max(0, 1 - (t - T.jet[0]) / 0.55);
      if (t > T.lock && t < T.lock + 0.2) a += 0.02 * (1 - (t - T.lock) / 0.2);
      const L = lifted ?? [];
      for (const s of L) {
        const ls = T.land[0] + (s.order / Math.max(1, L.length - 1)) * (T.land[1] - T.land[0] - 0.5) + 0.45;
        if (t > ls && t < ls + 0.15) a += 0.015 * (1 - (t - ls) / 0.15);
      }
      const w = t * 61;
      return [Math.sin(w) * a * Rs, Math.cos(w * 1.3) * a * Rs * 0.7];
    },
    tile: (t) => {
      const u = span(t, T.swallow);
      return { scale: 1 - 0.85 * u * u, alpha: 1 - span(t, [T.swallow[1] - 0.25, T.swallow[1]]) };
    },
    sounds: (crossed) => {
      if (crossed(T.lock)) playTargetLock();
      if (crossed(T.collapse[0])) playGammaCollapse();
      if (crossed(T.jet[0])) playGammaJet();
    },
    draw: (f, b) => {
      const { t, still, Sx, Sy, Rs, w, h } = f;
      const D = Rs * 10;
      const tiltU = still ? 1 : t < T.back[0] ? easeInOut(span(t, T.tilt)) : 1 - easeInOut(span(t, T.back));
      const th = THETA * tiltU;
      const L = liftedOf();
      const byKey = new Map(L.map((s) => [s.key, s]));
      const centres = env.centres?.() ?? [];
      // How far out the farthest sector is, and when the wave reaches a sector.
      let maxR = Rs * 3;
      for (const [, x, y] of centres) maxR = Math.max(maxR, Math.hypot((x - f.cx) * f.z, (y - f.cy) * f.z));
      const waveR = maxR * 1.15 + Rs * 2;
      const hitAt = (r: number) => T.wave[0] + (r / waveR) ** 2 * (T.wave[1] - T.wave[0]);
      const Hs = Rs * 0.35;

      // The board tilted, the rings lifted, every sector flipped by the wave.
      const placed = tiltBoard(f, centres, th, D, (key, X, Y) => {
        if (key === k.sector) {
          // It falls into the sphere, spinning; after the snap what lay beneath lies flat in the crater.
          const u = span(t, T.swallow);
          return still || t >= T.snap ? undefined : { H: Hs * u * u, turn: 5 * u * u, z: 4000 };
        }
        const r = Math.hypot(X, Y);
        const hit = hitAt(r);
        const fu = still ? 0 : easeInOut(span(t, [hit, hit + 0.42]));
        const s = byKey.get(key);
        if (!s) return fu > 0 && fu < 1 ? { tip: Math.PI * 2 * fu, H: Rs * 0.18 * Math.sin(Math.PI * fu) } : undefined;
        if (still) return undefined;
        const p = liftedPose(t, s.d, s.i, s.order, L.length, hit, Rs);
        return { H: p.H, inward: p.inward, turn: p.turn, tip: p.tip + Math.PI * 2 * fu, z: 2000 + Math.round(p.H) };
      });
      // The Gamma's stand-in (it leaves no Wreck) tilts with the board until it is gone.
      const g0 = env.ghost && !env.ghost.destroyed && env.ghost.visible ? env.ghost : undefined;
      if (g0) {
        const Lg = f.look(k.sector);
        g0.position.set(f.cx + Lg.dx, f.cy + Lg.dy);
        g0.scale.set(Lg.scale * Lg.scaleX, Lg.scale);
        g0.rotation = Lg.turn ?? 0;
      }
      env.slots?.(false);
      const slots = b.slots.clear();
      drawSlots(slots, placed, Rs, th);
      const P = (X: number, Y: number, H: number) => {
        const pr = project(X, Y, H, th, D);
        return { x: Sx + pr.x, y: Sy + pr.y, p: pr.p };
      };

      // Sounds of the landings.
      if (!still)
        for (const s of L) {
          const at = T.land[0] + (s.order / Math.max(1, L.length - 1)) * (T.land[1] - T.land[0] - 0.5) + 0.45;
          if (t >= at && !landed.has(s.order)) {
            landed.add(s.order);
            if (t < at + 0.2) playSectorLand(s.order, L.length);
          }
        }

      const backs = b.backs.clear();
      const grid = b.grid.clear();
      const crater = b.crater.clear();
      const ball = b.ball.clear();
      const freeze = b.freeze.clear();
      const lines = b.lines.clear();
      const white = b.white.clear();
      b.far.begin();
      b.pm.begin();

      // The back of a sector while the wave flips it (it shows its back for a moment), and sparks on its edge.
      for (const pl of placed) {
        if (pl.key === k.sector) continue;
        if (pl.sq < 0) {
          const s = byKey.get(pl.key);
          const turn = s && !still ? liftedPose(t, s.d, s.i, s.order, L.length, hitAt(Math.hypot(pl.X, pl.Y)), Rs).turn : 0;
          const c = Math.cos(turn);
          const sn = Math.sin(turn);
          const pts = hexCorners(0, 0, Rs * pl.p).flatMap(([x, y]) => {
            const yy = y * -pl.sq;
            return [pl.sx + x * c - yy * sn, pl.sy + x * sn + yy * c];
          });
          backs.poly(pts).fill({ color: 0x0e1020 }).stroke({ width: 2, color: CYAN, alpha: 0.7 });
        }
        if (Math.abs(pl.sq) < 0.25 && !still) {
          for (let j = 0; j < 4; j++) {
            const a = j * 1.7 + t * 9;
            b.pm.dot(pl.sx + Math.cos(a) * Rs * pl.p * 0.9, pl.sy + Math.sin(a) * Rs * pl.p * 0.12, Rs * 0.07, j % 2 ? CYAN : 0xffffff, 0.8 * (1 - Math.abs(pl.sq) * 4), 3, 0);
          }
        }
      }

      // The board's space sagging into a well round the Gamma: a faint polar grid, bent down.
      const gv = still ? 0 : span(t, [T.collapse[0], T.collapse[0] + 0.4]) * (1 - span(t, [T.land[1], T.back[0]]));
      if (gv > 0.01) {
        const W = wellAt(t);
        const rw = t > T.jet[0] ? Math.sqrt(span(t, T.wave)) * waveR : -1;
        const sag = (r: number) => {
          let H = -W * Rs * 1.5 / (1 + (r / (Rs * 0.9)) ** 2);
          if (rw > 0) H += Rs * 0.25 * Math.exp(-(((r - rw) / (Rs * 0.6)) ** 2)) * (1 - span(t, T.wave));
          return H;
        };
        for (let ring = 1; ring <= 7; ring++) {
          const r = ring * Rs * 0.85;
          const pts: number[] = [];
          for (let j = 0; j <= 48; j++) {
            const a = (j / 48) * Math.PI * 2;
            const q = P(Math.cos(a) * r, Math.sin(a) * r, sag(r));
            pts.push(q.x, q.y);
          }
          grid.poly(pts, false).stroke({ width: 1.2, color: ring % 2 ? 0x6fa8ff : VIOLET, alpha: 0.22 * gv });
        }
        for (let j = 0; j < 16; j++) {
          const a = (j / 16) * Math.PI * 2;
          const pts: number[] = [];
          for (let s = 0; s <= 14; s++) {
            const r = Rs * (0.45 + s * 0.42);
            const q = P(Math.cos(a) * r, Math.sin(a) * r, sag(r));
            pts.push(q.x, q.y);
          }
          grid.poly(pts, false).stroke({ width: 1, color: 0x6fa8ff, alpha: 0.16 * gv });
        }
      }

      // Act 1: hexagonal brackets slam onto the Gamma, lock with a flash, then are pulled in and fade.
      if (!still && t > T.bracketsIn[0] && t < T.collapse[0] + 0.7) {
        const bu = easeOut(span(t, T.bracketsIn));
        const gone = span(t, [T.collapse[0] + 0.2, T.collapse[0] + 0.7]);
        const rr = Rs * (2.3 - 1.2 * bu - 0.5 * gone);
        const lockF = t >= T.lock ? Math.max(0, 1 - (t - T.lock) / 0.35) : 0;
        const al = Math.min(1, span(t, [T.bracketsIn[0], T.bracketsIn[0] + 0.15])) * (1 - gone);
        const corners = hexCorners(0, 0, rr).map(([x, y]) => P(x, y, 0));
        corners.forEach((c, i) => {
          const a = corners[(i + 5) % 6]!;
          const n = corners[(i + 1) % 6]!;
          const arm = 0.28;
          const p1 = [c.x + (a.x - c.x) * arm, c.y + (a.y - c.y) * arm];
          const p2 = [c.x + (n.x - c.x) * arm, c.y + (n.y - c.y) * arm];
          lines.moveTo(p1[0]!, p1[1]!).lineTo(c.x, c.y).lineTo(p2[0]!, p2[1]!).stroke({ width: 3 + 3 * lockF, color: lockF > 0 ? 0xffffff : LILAC, alpha: al });
          for (let j = 0; j < 3; j++) {
            const u = (t * 2.2 + j / 3 + i * 0.17) % 1;
            b.pm.dot(c.x + (a.x - c.x) * arm * u, c.y + (a.y - c.y) * arm * u, Rs * 0.06, LILAC, al * 0.8);
          }
        });
        if (lockF > 0) {
          const ring = hexCorners(0, 0, rr * 0.97).flatMap(([x, y]) => {
            const q = P(x, y, 0);
            return [q.x, q.y];
          });
          lines.poly(ring).stroke({ width: 2 + 8 * lockF, color: LILAC, alpha: 0.7 * lockF });
        }
      }

      // Act 2: the black sphere, its halo, the disc round it (far half behind the sphere), the bent-up arc over it.
      const rs = still ? 0 : Rs * sphereAt(t);
      const C = P(0, 0, Hs);
      const discOn = still ? 0 : span(t, [T.collapse[0], T.collapse[0] + 0.5]) * (t < T.snap ? 1 : 0);
      b.halo.visible = rs > 1;
      if (b.halo.visible) {
        b.halo.position.set(C.x, C.y);
        b.halo.width = b.halo.height = rs * 7;
        b.halo.alpha = 0.55 * discOn;
      }
      if (discOn > 0.01) {
        const spin = t * 2.4;
        for (const [i, d] of DISC.entries()) {
          const r = d.r * rs;
          const a = d.a + spin / d.r ** 1.5;
          const X = Math.cos(a) * r;
          const Y = Math.sin(a) * r;
          const q = P(X, Y, Hs);
          const q2 = P(Math.cos(a + 0.08) * r, Math.sin(a + 0.08) * r, Hs);
          const hot = 1 - (d.r - 1.25) / 2.2;
          const col = hot > 0.75 ? 0xffffff : hot > 0.45 ? (d.hue < 0.5 ? MAGENTA : PALE) : d.hue < 0.6 ? VIOLET : CYAN;
          const pool = Y < 0 ? b.far : b.pm;
          pool.dot(q.x, q.y, Rs * 0.07 * d.size * (0.6 + hot), col, discOn * (0.45 + 0.5 * hot) * (0.8 + 0.2 * Math.sin(t * 13 + d.tw)), 3.2, Math.atan2(q2.y - q.y, q2.x - q.x));
          if (i % 3 === 0 && hot > 0.6) pool.dot(q.x, q.y, Rs * 0.22 * hot, MAGENTA, 0.12 * discOn);
        }
        // The far side bent up over the top of the sphere (and a fainter one under it).
        for (const [j, a] of ARC.entries()) {
          const u = (a.u + t * a.sp) % 1;
          const ang = Math.PI + u * Math.PI;
          const rx = rs * (1.55 + a.off);
          const ry = rs * (1.3 + a.off);
          const under = j % 4 === 0;
          const y = under ? C.y - Math.sin(ang) * ry * 0.8 : C.y + Math.sin(ang) * ry;
          b.pm.dot(C.x + Math.cos(ang) * rx, y, Rs * 0.06 * a.size, j % 3 ? PALE : MAGENTA, discOn * (under ? 0.35 : 0.75), 2.5, ang + Math.PI / 2);
        }
      }
      if (rs > 0.5) {
        ball.circle(C.x, C.y, rs).fill({ color: 0x000000, alpha: 1 });
        ball.circle(C.x, C.y, rs * 1.04).stroke({ width: Math.max(1.5, rs * 0.06), color: PALE, alpha: 0.9 * discOn });
      }
      // Streams of light torn off the lifted sectors, spiralling into the disc.
      if (!still && t > T.lift1[0] && t < T.snap) {
        for (const pl of placed) {
          const s = byKey.get(pl.key);
          if (!s || !pl.lifted) continue;
          const pose = liftedPose(t, s.d, s.i, s.order, L.length, 99, Rs);
          const r0 = Math.hypot(pl.X, pl.Y) * (1 - pose.inward);
          const a0 = Math.atan2(pl.Y, pl.X);
          for (let j = 0; j < 6; j++) {
            const u = (t * 0.9 + j / 6 + s.i * 0.13) % 1;
            const r = r0 * (1 - u) ** 1.4 + rs * 1.3 * (1 - (1 - u) ** 1.4) - Rs * 0.5 * (1 - u) * u;
            const a = a0 + 2.4 * u;
            const q = P(Math.cos(a) * r, Math.sin(a) * r, pose.H * (1 - u) + Hs * u);
            b.pm.dot(q.x, q.y, Rs * 0.06 * (1.2 - u * 0.5), u > 0.6 ? 0xffffff : LILAC, Math.sin(Math.PI * u) * 0.85 * discOn, 2.4, a + Math.PI / 2);
          }
        }
      }

      // Act 3: the point, the frozen colourless moment, the flash, the jet, the shock wave over the board.
      if (!still && t >= T.snap - 0.2 && t < T.jet[0] + 0.15) {
        const fz = span(t, [T.snap, T.snap + 0.06]) * (1 - span(t, [T.jet[0], T.jet[0] + 0.15]));
        if (fz > 0) freeze.rect(0, 0, w, h).fill({ color: 0x0a0c14, alpha: 0.55 * fz });
        const pt = 1 + 0.5 * Math.sin(t * 60);
        b.pm.dot(C.x, C.y, Rs * 0.12 * pt, 0xffffff, 1);
        b.pm.dot(C.x, C.y, Rs * 0.5, LILAC, 0.35 * fz + 0.2);
      }
      const ju = still ? 0 : span(t, T.jet);
      const jOn = ju > 0 && ju < 1 ? Math.min(1, ju / 0.08) * (1 - span(t, [T.jet[0] + 0.5, T.jet[1]])) : 0;
      const fl = still ? 0 : 1 - span(t, [T.jet[0], T.jet[0] + 0.35]);
      if (fl > 0 && t >= T.jet[0]) white.rect(0, 0, w, h).fill({ color: 0xe8dcff, alpha: 0.7 * fl * fl });
      b.jetGlow.forEach((g, i) => {
        g.visible = jOn > 0.01;
        if (!g.visible) return;
        const v = i / (b.jetGlow.length - 1);
        const top = C.y - (C.y + Rs) * Math.min(1, ju / 0.12);
        g.position.set(C.x, C.y + (top - C.y) * v);
        g.width = Rs * (0.9 + 1.6 * v) * (1 + 0.3 * fl);
        g.height = Rs * 1.6;
        g.alpha = 0.5 * jOn;
      });
      if (jOn > 0.01) {
        const len = (C.y + Rs) * Math.min(1, ju / 0.12);
        const w0 = Rs * 0.16 * (1 + 0.6 * fl);
        const w1 = Rs * 0.7;
        lines.poly([C.x - w0, C.y, C.x + w0, C.y, C.x + w1, C.y - len, C.x - w1, C.y - len]).fill({ color: MAGENTA, alpha: 0.35 * jOn });
        lines.poly([C.x - w0 * 0.4, C.y, C.x + w0 * 0.4, C.y, C.x + w1 * 0.3, C.y - len, C.x - w1 * 0.3, C.y - len]).fill({ color: 0xffffff, alpha: 0.85 * jOn });
        for (const p of JET) {
          const u = (p.ph + t * p.sp) % 1;
          const y = C.y - len * u;
          const spread = w0 + (w1 - w0) * u;
          b.pm.dot(C.x + p.x * spread * 0.8, y, Rs * 0.07 * p.size * (1 + u), p.hot ? 0xffffff : u > 0.5 ? CYAN : LILAC, jOn * (1 - u * 0.6), 4, Math.PI / 2);
        }
      }
      // The shock wave: a ring of light flat on the board, racing out past the Field's edge.
      if (!still && t >= T.wave[0] && t < T.wave[1] + 0.1) {
        const u = span(t, T.wave);
        const r = Math.sqrt(u) * waveR;
        const al = 1 - u;
        const pts: { x: number; y: number }[] = [];
        for (let j = 0; j <= 72; j++) {
          const a = (j / 72) * Math.PI * 2;
          pts.push(P(Math.cos(a) * r, Math.sin(a) * r, 0));
        }
        const flatPts = pts.flatMap((q) => [q.x, q.y]);
        lines.poly(flatPts, true).stroke({ width: Rs * 0.35 * al + 2, color: VIOLET, alpha: 0.35 * al });
        lines.poly(flatPts, true).stroke({ width: 3, color: PALE, alpha: 0.9 * al });
        pts.forEach((q, j) => {
          if (j % 2) return;
          b.pm.dot(q.x, q.y, Rs * 0.1 * (0.6 + 0.4 * Math.sin(j * 2.1 + t * 20)), j % 4 ? CYAN : 0xffffff, al, 2.2, (j / 72) * Math.PI * 2 + Math.PI / 2);
        });
      }

      // Act 4: dust as each lifted sector lands; the crater where the Gamma was, fading.
      if (!still)
        for (const s of L) {
          const at = T.land[0] + (s.order / Math.max(1, L.length - 1)) * (T.land[1] - T.land[0] - 0.5) + 0.45;
          const u = span(t, [at, at + 0.5]);
          if (u <= 0 || u >= 1) continue;
          const pl = placed.find((x) => x.key === s.key);
          if (!pl) continue;
          for (let j = 0; j < 12; j++) {
            const a = (j / 12) * Math.PI * 2 + s.i;
            const r = Rs * (0.85 + 0.6 * easeOut(u));
            const q = P(pl.X + Math.cos(a) * r, pl.Y + Math.sin(a) * r, Rs * 0.1 * u);
            b.pm.dot(q.x, q.y, Rs * 0.09 * (1 - u * 0.5), j % 3 ? 0x9fb4d8 : LILAC, 0.75 * (1 - u));
          }
        }
      const cr = still ? 0.6 : span(t, [T.snap, T.snap + 0.3]) * (1 - span(t, [5.4, T.back[0] + 0.4]));
      if (cr > 0.01) {
        const g = P(0, 0, 0);
        crater.poly(boardHex(g.x, g.y, Rs * 0.95, g.p, th)).fill({ color: 0x07040c, alpha: 0.6 * cr });
        crater.poly(boardHex(g.x, g.y, Rs * 0.95, g.p, th)).stroke({ width: Math.max(2, Rs * 0.05), color: VIOLET, alpha: 0.8 * cr });
        for (const s of RIM) {
          const u = still ? 0.5 : (s.ph + t * s.sp) % 1;
          const hx = hexCorners(0, 0, Rs * 0.95);
          const e = Math.floor((s.a / (Math.PI * 2)) * 6) % 6;
          const f0 = ((s.a / (Math.PI * 2)) * 6) % 1;
          const a = hx[e]!;
          const c = hx[(e + 1) % 6]!;
          const q = P(a[0] + (c[0] - a[0]) * f0, a[1] + (c[1] - a[1]) * f0, Rs * s.up * u);
          b.pm.dot(q.x, q.y, Rs * 0.06, s.ph < 0.5 ? LILAC : MAGENTA, cr * Math.sin(Math.PI * u));
        }
      }
      b.far.end();
      b.pm.end();
    },
  });
}
