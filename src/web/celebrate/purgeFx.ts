/**
 * Alpha Purge, the second kill for Alpha (designer 2026-11-20, I21), drawn on the Field (PixiJS) in the
 * close-up every kill shares (closeup.ts). About 4.5 s, as Alpha Down, but a different act:
 *
 * 1. Cage (0-0.8 s): the Field zooms in on the unit and the rest darkens; six energy walls of a
 *    containment cage gather round the tile, each a swarm of particles streaming in from outside
 *    (designer 2026-11-20: energy is drawn with particles, not flat shapes), and lock with a flash of
 *    particles (playTargetLock).
 * 2. Crush (0.8-1.62 s): the cage closes in, its particles seething, arcs of cold light crackle from its
 *    corners into the unit with sparks, its glyph glows white; then the cage crushes it to a point and
 *    its particles are flung up the pillar of light.
 * 3. Purge (1.62-2.7 s): a pillar of light fires straight up out of the Field (playPurgeBeam), a flat
 *    flare streaks sideways, the sector's outline flashes, motes rise; the Wreck forms again under a scan
 *    line (4.8); the label counts up ("ALPHA PURGED · 5 / 6" to "6 / 6").
 * 4. Back (3.6-4.5 s): the zoom eases back.
 *
 * Screen only: nothing here is a rule.
 */

import { Graphics, Sprite, Texture } from "pixi.js";
import type { Step } from "../anim.js";
import { easeInOut, easeOut } from "../anim.js";
import { playPurgeBeam, playTargetLock } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, bolt, closeupStep, flat, glowSprite, hexCorners, motes, seq, strokePath } from "./closeup.js";
import { PURGE, span } from "./timeline.js";

const CYAN = 0x6fe3ff;
const ICE = 0xe6fbff;
const VIOLET = 0x9b6bd6;

let beamTex: Texture | undefined;
/** A soft vertical band: clear at both sides, white in the middle (stretched into the pillar of light). */
function beamTexture(): Texture {
  if (beamTex) return beamTex;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 4;
  const g = c.getContext("2d")!;
  const r = g.createLinearGradient(0, 0, 64, 0);
  r.addColorStop(0, "rgba(255,255,255,0)");
  r.addColorStop(0.3, "rgba(255,255,255,0.35)");
  r.addColorStop(0.5, "rgba(255,255,255,1)");
  r.addColorStop(0.7, "rgba(255,255,255,0.35)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 4);
  beamTex = Texture.from(c);
  return beamTex;
}

/** The motes that rise up the pillar: where across it, when, how fast. */
const MOTES = (() => {
  const rnd = seq(6151);
  return Array.from({ length: 30 }, () => ({ x: (rnd() - 0.5) * 1.6, born: PURGE.purge + rnd() * 1.1, life: 0.7 + rnd() * 0.8, speed: 2.5 + rnd() * 4.5, len: 0.05 + rnd() * 0.14 }));
})();

/** The cage's wall particles: which wall, where along it, how they flow, flicker, fly in and are flung up. */
const WALL = (() => {
  const r = seq(9071);
  return Array.from({ length: 6 * 36 }, (_, i) => ({
    wall: i % 6,
    a: r(),
    flow: (r() < 0.5 ? -1 : 1) * (0.12 + r() * 0.3),
    depth: r(),
    size: 0.6 + r(),
    ph: r() * 6.283,
    fq: 6 + r() * 14,
    delay: r() * 0.28,
    scatter: (r() - 0.5) * 3.4,
    far: 1.4 + r() * 3.2,
    side: r() - 0.5,
    fling: 0.6 + r() * 1.4,
  }));
})();

/** The cage's radius (tile radii): waiting, closing in, crushing to a point. */
function cage(t: number): number {
  if (t < PURGE.squeeze[0]) return 1.55;
  if (t < PURGE.crush[0]) return 1.55 - 0.47 * easeInOut(span(t, PURGE.squeeze));
  return 1.08 - 0.96 * span(t, PURGE.crush) ** 2;
}
/** The tile's size as the cage closes (the same share of the cage once it touches). */
function tileScale(t: number): number {
  if (t < PURGE.squeeze[0]) return 1;
  if (t < PURGE.crush[0]) return 1 - 0.14 * easeInOut(span(t, PURGE.squeeze));
  return 0.86 * (1 - 0.94 * span(t, PURGE.crush) ** 2);
}
/** Half the width of a pointy-top hex of radius r at height dy from its middle. */
function hexHalf(r: number, dy: number): number {
  const a = Math.abs(dy);
  if (a > r) return 0;
  return a <= r / 2 ? (Math.sqrt(3) / 2) * r : (r - a) * Math.sqrt(3);
}

/** Alpha Purge as a Field step (and its still picture for reduced motion and Instant). */
export function alphaPurgeStep(env: KillEnv, k: KillTarget): Step {
  return closeupStep(env, k, {
    times: { total: PURGE.total, zoomIn: PURGE.zoomIn, back: PURGE.back, breakAt: PURGE.purge, wreckIn: PURGE.wreckIn, label: PURGE.label, count: PURGE.count, stillAt: PURGE.count + 0.5 },
    title: `${k.name.toUpperCase()} PURGED`,
    accent: CYAN,
    ink: ICE,
    inkLine: 0x0c3446,
    build: (back, front) => {
      const under = new Graphics();
      const light = new Graphics();
      light.blendMode = "add";
      back.addChild(under, light);
      const tex = env.badge(k.unitId);
      const glyph = tex ? new Sprite({ texture: tex, anchor: 0.5 }) : undefined;
      if (glyph) {
        glyph.blendMode = "add";
        back.addChild(glyph);
      }
      // The pillar: a wide cold glow, a pale body, a white core; its foot's flare; the flat streak's glow.
      const beams = [CYAN, ICE, 0xffffff].map((tint) => {
        const s = new Sprite({ texture: beamTexture(), anchor: { x: 0.5, y: 1 } });
        s.blendMode = "add";
        s.tint = tint;
        s.visible = false;
        front.addChild(s);
        return s;
      });
      const foot = glowSprite(front, ICE);
      const streak = glowSprite(front, CYAN);
      const top = new Graphics();
      top.blendMode = "add";
      front.addChild(top);
      const nodes = Array.from({ length: 6 }, () => glowSprite(front, CYAN));
      const pm = motes(front, 420);
      return { under, light, glyph, beams, foot, streak, top, nodes, pm };
    },
    shake: (t, Rs) => {
      const u = span(t, [PURGE.purge, PURGE.purge + 0.35]);
      const amp = u > 0 && u < 1 ? Rs * 0.06 * (1 - u) ** 2 : 0;
      return [amp * 0.3 * Math.sin(u * 37), amp * Math.sin(u * 44)];
    },
    dark: (t) => 1 - 0.25 * Math.max(0, 1 - Math.abs(t - PURGE.purge - 0.1) / 0.5),
    tile: (t) => ({ scale: tileScale(t), alpha: 1 - 0.3 * span(t, PURGE.squeeze) }),
    sounds: (crossed) => {
      if (crossed(PURGE.lock)) playTargetLock();
      if (crossed(PURGE.purge)) playPurgeBeam();
    },
    draw: (f, b) => {
      const { t, still, fade, Sx, Sy, Rs, broke } = f;
      const under = b.under.clear();
      const light = b.light.clear();
      const top = b.top.clear();

      // The unit glows inside the closing cage: violet, then white as it is crushed.
      if (!still && !broke) {
        const ts = tileScale(t);
        const inG = span(t, [PURGE.squeeze[0], PURGE.squeeze[0] + 0.3]);
        const white = span(t, PURGE.crush);
        if (inG > 0) light.poly(flat(hexCorners(Sx, Sy, Rs * ts))).fill({ color: white > 0.3 ? ICE : VIOLET, alpha: 0.28 * inG + 0.5 * white });
        if (b.glyph) {
          b.glyph.visible = inG > 0;
          b.glyph.position.set(Sx, Sy);
          const H = Rs * 1.1 * ts;
          b.glyph.height = H;
          b.glyph.width = H * (b.glyph.texture.width / Math.max(1, b.glyph.texture.height));
          b.glyph.alpha = 0.5 * inG + 0.5 * white;
        }
        if (white > 0) light.circle(Sx, Sy, Rs * (0.05 + 0.12 * white)).fill({ color: 0xffffff, alpha: 0.6 + 0.4 * white });
      } else if (b.glyph) b.glyph.visible = false;

      // The cage: six walls of energy, each a swarm of particles that streams in from outside, settles along
      // the wall and flows to and fro on it; they lock, close in, crush, and at the purge are flung up the light.
      const pm = b.pm;
      pm.begin();
      const rc = Rs * cage(t);
      const lockF = !still && t >= PURGE.lock ? Math.max(0, 1 - (t - PURGE.lock) / 0.3) : 0;
      const hot = span(t, PURGE.crush);
      const agit = span(t, PURGE.squeeze) * (1 - hot);
      const cs = hexCorners(Sx, Sy, rc);
      const csAtPurge = hexCorners(Sx, Sy, Rs * cage(PURGE.purge));
      const th = Math.max(3, rc * 0.13);
      /** Where wall particle p sits on its wall at time `at` (corners `cc`, wall thickness `w`). */
      const onWall = (p: (typeof WALL)[number], cc: [number, number][], w: number, at: number): [number, number] => {
        const a = cc[p.wall]!;
        const c = cc[(p.wall + 1) % 6]!;
        const f = (((p.a + p.flow * at) % 1) + 1) % 1;
        const mx = (a[0] + c[0]) / 2 - Sx;
        const my = (a[1] + c[1]) / 2 - Sy;
        const ml = Math.hypot(mx, my) || 1;
        const jig = Rs * 0.03 * agit * Math.sin(p.fq * at + p.ph);
        const d = -p.depth * w + jig;
        return [a[0] + (c[0] - a[0]) * f + (mx / ml) * d, a[1] + (c[1] - a[1]) * f + (my / ml) * d];
      };
      if (!still && !broke) {
        for (const [i, p] of WALL.entries()) {
          const u = span(t, [PURGE.panelsIn[0] + p.delay, PURGE.panelsIn[1] - 0.25 + p.delay]);
          if (u <= 0) continue;
          const [tx, ty] = onWall(p, cs, th, t);
          // In from outside along the wall's outward normal, swirling a little sideways.
          const a = cs[p.wall]!;
          const c = cs[(p.wall + 1) % 6]!;
          const mx = (a[0] + c[0]) / 2 - Sx;
          const my = (a[1] + c[1]) / 2 - Sy;
          const ml = Math.hypot(mx, my) || 1;
          const e = easeOut(u);
          const off = (1 - e) * Rs * p.far;
          const sw = Math.sin(Math.PI * e) * Rs * 0.9 * p.side + (1 - e) * Rs * p.scatter;
          const x = tx + (mx / ml) * off - (my / ml) * sw;
          const y = ty + (my / ml) * off + (mx / ml) * sw;
          const flick = 0.5 + 0.5 * Math.sin(p.fq * t + p.ph);
          const al = Math.min(1, u * 2.5) * (0.45 + 0.45 * flick + 0.6 * lockF + 0.3 * hot);
          const tint = hot > 0.4 || lockF > 0.5 ? (i % 2 ? 0xffffff : ICE) : i % 3 === 0 ? 0xffffff : i % 3 === 1 ? ICE : CYAN;
          // Streaks while flying in, points once on the wall.
          const moving = 1 - e;
          pm.dot(x, y, Math.max(2, Rs * 0.07 * p.size * (1 + 0.5 * lockF + 0.4 * hot)), tint, al, 1 + 3 * moving, Math.atan2(my, mx));
        }
        // A faint plane of light along each wall once its particles have gathered.
        const formed = span(t, [PURGE.panelsIn[1] - 0.25, PURGE.lock]);
        if (formed > 0) {
          for (let i = 0; i < 6; i++) {
            const a = cs[i]!;
            const c = cs[(i + 1) % 6]!;
            const mx = (a[0] + c[0]) / 2 - Sx;
            const my = (a[1] + c[1]) / 2 - Sy;
            const ml = Math.hypot(mx, my) || 1;
            const ix = (-mx / ml) * th * 0.5;
            const iy = (-my / ml) * th * 0.5;
            top.moveTo(a[0] + ix, a[1] + iy).lineTo(c[0] + ix, c[1] + iy).stroke({ width: th * 1.4, color: CYAN, alpha: (0.06 + 0.12 * lockF + 0.12 * hot) * formed });
          }
        }
        // The corner nodes: a glow and particles circling it, from the lock on.
        b.nodes.forEach((n, i) => {
          const [x, y] = cs[i]!;
          n.visible = t >= PURGE.lock;
          if (!n.visible) return;
          n.position.set(x, y);
          n.width = n.height = Math.max(10, rc * (0.32 + 0.3 * lockF));
          n.alpha = 0.45 + 0.5 * lockF + 0.3 * hot;
          for (let j = 0; j < 3; j++) {
            const ang = t * 7 + j * 2.09 + i;
            const rr = Math.max(3, rc * 0.09);
            pm.dot(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, Math.max(2, Rs * 0.05), j ? ICE : 0xffffff, 0.9);
          }
        });
        // The lock: a ring of particles flashes out from the cage, sparks fly from its corners.
        if (lockF > 0) {
          const ringR = rc * (1 + 0.3 * (1 - lockF));
          const ring = hexCorners(Sx, Sy, ringR);
          for (let j = 0; j < 48; j++) {
            const e0 = ring[Math.floor(j / 8)]!;
            const e1 = ring[(Math.floor(j / 8) + 1) % 6]!;
            const f2 = (j % 8) / 8;
            pm.dot(e0[0] + (e1[0] - e0[0]) * f2, e0[1] + (e1[1] - e0[1]) * f2, Math.max(2, Rs * 0.06), j % 2 ? 0xffffff : ICE, 0.9 * lockF);
          }
          const age = t - PURGE.lock;
          for (const [ci, [x, y]] of cs.entries()) {
            for (let j = 0; j < 6; j++) {
              const ang = Math.atan2(y - Sy, x - Sx) + (j - 2.5) * 0.35;
              const d = Rs * (0.1 + 1.6 * age) * (0.7 + 0.1 * ((ci + j) % 4));
              pm.dot(x + Math.cos(ang) * d, y + Math.sin(ang) * d, Math.max(2, Rs * 0.045), j % 2 ? CYAN : 0xffffff, lockF, 2.5, ang);
            }
          }
        }
        // Arcs of cold light from the corners into the unit, new every 0.07 s; each strikes with sparks.
        if (t >= PURGE.squeeze[0]) {
          const tick = Math.floor(t / 0.07);
          const rnd = seq(tick * 131 + 7);
          const ts = tileScale(t);
          for (let j = 0; j < 3; j++) {
            const ci = Math.floor(rnd() * 6);
            const [x1, y1] = cs[ci]!;
            const ang = rnd() * Math.PI * 2;
            const x2 = Sx + Math.cos(ang) * Rs * ts * 0.6;
            const y2 = Sy + Math.sin(ang) * Rs * ts * 0.6;
            const pts = bolt(x1, y1, x2, y2, tick * 17 + j, 0.22, 6);
            strokePath(top, pts, Math.max(4, Rs * 0.06), CYAN, 0.3);
            strokePath(top, pts, 1.4, 0xffffff, 0.9);
            const age = t - tick * 0.07;
            for (let m = 0; m < 4; m++) {
              const a2 = rnd() * Math.PI * 2;
              const d = Rs * (0.03 + 0.9 * age) * (0.5 + rnd());
              pm.dot(x2 + Math.cos(a2) * d, y2 + Math.sin(a2) * d, Math.max(1.5, Rs * 0.04), m % 2 ? 0xffffff : CYAN, 1 - age / 0.07, 2, a2);
            }
          }
        }
      } else {
        for (const n of b.nodes) n.visible = false;
      }
      // The purge: the walls' particles are flung up the pillar of light and fade.
      if (!still && broke) {
        const age = t - PURGE.purge;
        if (age < 0.8) {
          for (const [i, p] of WALL.entries()) {
            const [x0, y0] = onWall(p, csAtPurge, Math.max(3, Rs * cage(PURGE.purge) * 0.13), PURGE.purge);
            const up = Rs * p.fling * (3 * age + 5 * age * age);
            const x = x0 + p.side * Rs * 0.9 * age;
            const y = y0 - up;
            const al = (1 - age / 0.8) ** 1.5;
            pm.dot(x, y, Math.max(2, Rs * 0.06 * p.size), i % 2 ? 0xffffff : ICE, al, 1 + 4 * Math.min(1, age * 4), -Math.PI / 2 + p.side * 0.3);
          }
        }
      }

      // The purge: the pillar of light, its foot, the flat streak, the sector's outline flashing.
      const bu = still ? 1 : span(t, PURGE.beam);
      const on = !still && broke && bu < 1;
      const rise = span(t, [PURGE.purge, PURGE.purge + 0.12]);
      const width = on ? Rs * 0.8 * Math.min(1, (t - PURGE.purge) / 0.06) * (1 - span(t, [PURGE.purge + 0.15, PURGE.beam[1]])) ** 1.4 : 0;
      b.beams.forEach((s, i) => {
        s.visible = width > 0.5;
        if (!s.visible) return;
        s.position.set(Sx, Sy + Rs * 0.15);
        s.height = (Sy + Rs * 0.15 + 40) * easeOut(rise);
        s.width = width * [3.2, 1.5, 0.55][i]!;
        s.alpha = [0.55, 0.8, 1][i]!;
      });
      const fl = on ? span(t, [PURGE.purge, PURGE.purge + 0.5]) : 1;
      b.foot.visible = fl < 1;
      b.foot.position.set(Sx, Sy);
      b.foot.width = Rs * (1.5 + 2.5 * easeOut(fl));
      b.foot.height = Rs * (0.9 + 1.0 * easeOut(fl));
      b.foot.alpha = (1 - fl) ** 1.3;
      const st = on ? span(t, [PURGE.purge, PURGE.purge + 0.45]) : 1;
      b.streak.visible = st < 1;
      b.streak.position.set(Sx, Sy);
      b.streak.width = Rs * (2 + 9 * easeOut(st));
      b.streak.height = Rs * 0.28 * (1 - st);
      b.streak.alpha = 0.9 * (1 - st);
      if (st < 1) top.moveTo(Sx - Rs * 5.5 * easeOut(st), Sy).lineTo(Sx + Rs * 5.5 * easeOut(st), Sy).stroke({ width: 2.2 * (1 - st) + 0.6, color: 0xffffff, alpha: 0.9 * (1 - st) });
      // The empty sector glows with the light left behind until the Wreck forms again.
      const left = !still && broke ? 1 - span(t, [PURGE.purge + 0.1, PURGE.wreckIn[0] + 0.25]) : 0;
      if (left > 0.01) {
        under.poly(flat(hexCorners(Sx, Sy, Rs))).fill({ color: 0x123a4c, alpha: 0.9 * left });
        light.poly(flat(hexCorners(Sx, Sy, Rs))).fill({ color: CYAN, alpha: 0.3 * left });
      }
      const ho = on ? span(t, [PURGE.purge, PURGE.purge + 0.4]) : 1;
      if (ho < 1) {
        const ring = hexCorners(Sx, Sy, Rs * (1 + 0.4 * easeOut(ho)));
        top.poly(flat(ring)).stroke({ width: 1 + 2.5 * (1 - ho), color: ho < 0.3 ? 0xffffff : CYAN, alpha: 0.6 * (1 - ho) });
        // The outline sheds particles as it spreads.
        for (let j = 0; j < 60; j++) {
          const e0 = ring[Math.floor(j / 10)]!;
          const e1 = ring[(Math.floor(j / 10) + 1) % 6]!;
          const f2 = ((j % 10) + 0.5 * ((j * 7) % 3)) / 10;
          const ox = (e0[0] + (e1[0] - e0[0]) * f2 - Sx) * (1 + 0.25 * ho * ((j * 13) % 5) / 5);
          const oy = (e0[1] + (e1[1] - e0[1]) * f2 - Sy) * (1 + 0.25 * ho * ((j * 13) % 5) / 5);
          pm.dot(Sx + ox, Sy + oy, Math.max(2, Rs * 0.06), j % 3 ? ICE : 0xffffff, 1 - ho);
        }
      }

      // Motes rise up the pillar (in the still picture, a few hang over the Wreck): particles, drawn long.
      for (const [i, m] of MOTES.entries()) {
        const age = still ? 0.25 + (i % 5) * 0.12 : t - m.born;
        if ((still && i > 9) || age < 0 || age > m.life) continue;
        const u = age / m.life;
        const x = Sx + m.x * Rs * 0.45 + Math.sin(age * 5 + i) * Rs * 0.05;
        const y = Sy - Rs * (0.2 + m.speed * age * (still ? 0.5 : 1));
        const a = Math.sin(Math.PI * u) * fade * (still ? 0.8 : 1);
        pm.dot(x, y, Math.max(2, Rs * 0.06), i % 3 ? ICE : CYAN, a, 1 + m.len * 25, -Math.PI / 2);
      }
      pm.end();

      // The Wreck forms again under a scan line, its edge glowing cold for a while.
      const wi = still ? 1 : span(t, PURGE.wreckIn);
      if (!still && wi > 0 && wi < 1) {
        const dy = -Rs + 2 * Rs * easeInOut(wi);
        const hw = hexHalf(Rs, dy);
        if (hw > 0) {
          light.moveTo(Sx - hw, Sy + dy).lineTo(Sx + hw, Sy + dy).stroke({ width: Math.max(5, Rs * 0.1), color: CYAN, alpha: 0.45 });
          light.moveTo(Sx - hw, Sy + dy).lineTo(Sx + hw, Sy + dy).stroke({ width: 1.8, color: 0xffffff, alpha: 0.95 });
        }
      }
      const rim = still ? 0.6 * fade : wi > 0 ? Math.min(1, wi * 2) * (1 - span(t, [PURGE.wreckIn[1], PURGE.back[0] + 0.3])) : 0;
      if (rim > 0.01) {
        under.poly(flat(hexCorners(Sx, Sy, Rs))).stroke({ width: Math.max(5, Rs * 0.12), color: CYAN, alpha: 0.28 * rim });
        light.poly(flat(hexCorners(Sx, Sy, Rs))).stroke({ width: 1.6, color: ICE, alpha: 0.8 * rim });
      }
    },
  });
}
