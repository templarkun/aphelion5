/**
 * Alpha Purge, the second kill for Alpha (designer 2026-11-20, I21), drawn on the Field (PixiJS) in the
 * close-up every kill shares (closeup.ts). About 4.5 s, as Alpha Down, but a different act:
 *
 * 1. Cage (0-0.8 s): the Field zooms in on the unit and the rest darkens; six wall panels of a
 *    containment cage fly in from all sides and lock round the tile with a flash (playTargetLock).
 * 2. Crush (0.8-1.62 s): the cage closes in, arcs of cold light crackle from its corners into the unit,
 *    its glyph glows white; then the cage crushes it to a point.
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
import { type KillEnv, type KillTarget, bolt, closeupStep, flat, glowSprite, hexCorners, seq, strokePath } from "./closeup.js";
import { PURGE, span } from "./timeline.js";

const CYAN = 0x6fe3ff;
const ICE = 0xe6fbff;
const DEEP = 0x0b2433;
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
      const cageG = new Graphics();
      const top = new Graphics();
      top.blendMode = "add";
      front.addChild(cageG, top);
      return { under, light, glyph, beams, foot, streak, cageG, top };
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
      const cg = b.cageG.clear();
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

      // The cage: six panels fly in, lock, close in and crush; at the purge they go up in the light.
      const rc = Rs * cage(t);
      const ca = still ? 0 : broke ? Math.max(0, 1 - (t - PURGE.purge) / 0.1) : 1;
      if (ca > 0) {
        const lockF = t >= PURGE.lock ? Math.max(0, 1 - (t - PURGE.lock) / 0.3) : 0;
        const hot = span(t, PURGE.crush);
        const cs = hexCorners(Sx, Sy, rc);
        for (let i = 0; i < 6; i++) {
          const u = span(t, [PURGE.panelsIn[0] + i * 0.05, PURGE.panelsIn[1] - (5 - i) * 0.05]);
          if (u <= 0) continue;
          const a = cs[i]!;
          const c = cs[(i + 1) % 6]!;
          // In along the panel's outward normal.
          const mx = (a[0] + c[0]) / 2 - Sx;
          const my = (a[1] + c[1]) / 2 - Sy;
          const ml = Math.hypot(mx, my) || 1;
          const off = (1 - easeOut(u)) * Rs * 3.2;
          const ox = (mx / ml) * off;
          const oy = (my / ml) * off;
          const th = Math.max(3, rc * 0.13);
          const ix = (-mx / ml) * th;
          const iy = (-my / ml) * th;
          const p1: [number, number] = [a[0] + ox, a[1] + oy];
          const p2: [number, number] = [c[0] + ox, c[1] + oy];
          const al = Math.min(1, u * 3) * ca;
          cg.poly([p1[0], p1[1], p2[0], p2[1], p2[0] + ix, p2[1] + iy, p1[0] + ix, p1[1] + iy]).fill({ color: DEEP, alpha: 0.78 * al }).stroke({ width: 1.2, color: CYAN, alpha: 0.9 * al });
          // The panel's bright inner face, and a glow; white at the lock and as it crushes.
          top.moveTo(p1[0] + ix, p1[1] + iy).lineTo(p2[0] + ix, p2[1] + iy).stroke({ width: Math.max(4, th * 0.9), color: CYAN, alpha: (0.25 + 0.5 * lockF + 0.4 * hot) * al });
          top.moveTo(p1[0] + ix, p1[1] + iy).lineTo(p2[0] + ix, p2[1] + iy).stroke({ width: 1.6, color: lockF > 0 || hot > 0.4 ? 0xffffff : ICE, alpha: al });
          // A bright run along each panel while it closes in.
          const run = span(t, [PURGE.squeeze[0] + i * 0.03, PURGE.crush[1]]);
          if (run > 0 && run < 1) {
            const f2 = (run * 2.5) % 1;
            const rx = p1[0] + ix + (p2[0] - p1[0]) * f2;
            const ry = p1[1] + iy + (p2[1] - p1[1]) * f2;
            top.circle(rx, ry, Math.max(1.5, th * 0.35)).fill({ color: 0xffffff, alpha: 0.9 * al });
          }
        }
        // The corner nodes light up at the lock.
        if (t >= PURGE.lock) {
          for (const [x, y] of cs) {
            top.circle(x, y, Math.max(2.5, rc * 0.07)).fill({ color: 0xffffff, alpha: ca });
            top.circle(x, y, Math.max(5, rc * 0.16)).fill({ color: CYAN, alpha: (0.25 + 0.6 * lockF) * ca });
          }
        }
        if (lockF > 0) top.poly(flat(hexCorners(Sx, Sy, rc * (1 + 0.25 * (1 - lockF))))).stroke({ width: 2 + 4 * lockF, color: ICE, alpha: 0.8 * lockF });
        // Arcs of cold light from the corners into the unit, new every 0.07 s.
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
            strokePath(top, pts, Math.max(4, Rs * 0.06), CYAN, 0.35 * ca);
            strokePath(top, pts, 1.6, 0xffffff, 0.95 * ca);
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
      if (ho < 1) top.poly(flat(hexCorners(Sx, Sy, Rs * (1 + 0.4 * easeOut(ho))))).stroke({ width: 1.5 + 4 * (1 - ho), color: ho < 0.3 ? 0xffffff : CYAN, alpha: 0.9 * (1 - ho) });

      // Motes rise up the pillar (in the still picture, a few hang over the Wreck).
      for (const [i, m] of MOTES.entries()) {
        const age = still ? 0.25 + (i % 5) * 0.12 : t - m.born;
        if ((still && i > 9) || age < 0 || age > m.life) continue;
        const u = age / m.life;
        const x = Sx + m.x * Rs * 0.45 + Math.sin(age * 5 + i) * Rs * 0.05;
        const y = Sy - Rs * (0.2 + m.speed * age * (still ? 0.5 : 1));
        const a = Math.sin(Math.PI * u) * fade * (still ? 0.8 : 1);
        light.moveTo(x, y).lineTo(x, y + Rs * m.len).stroke({ width: 2, color: i % 3 ? ICE : CYAN, alpha: a });
      }

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
