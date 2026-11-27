/**
 * Barrage, the second kill for Beta (designer 2026-11-27: "Make 2 animations for Beta unit elimination.
 * (Don't forget that Beta unit destruction should be more spectacular than Alpha unit destruction
 * animation)"), drawn on the Field (PixiJS) in the close-up every kill shares (closeup.ts). About 6.8 s,
 * longer and wider than any Alpha kill; the sectors round the Beta are part of it.
 *
 * 1. Kill box (0-1.0 s): the zoom, wider than for an Alpha; a kill box of particles draws itself round
 *    the Beta and the six sectors round it, a pin drops on each of the six; it locks (playTargetLock).
 * 2. Barrage (1.0-3.1 s): eight shells fall from above the page and walk in on the Beta in a tightening
 *    spiral (playBarrageShell): each a falling streak, a flash, a ring of particles, dust, the nearest
 *    unit jolted. The Beta's shield, a hex bubble of particles, flickers at every hit, cracks, and breaks
 *    into flying cells (playShieldBreak). A target ring shrinks onto it and the Field goes dim.
 * 3. Lance (3.1-4.2 s): a lance of light falls from orbit (playOrbitalLance) and strikes: a white-out, a
 *    ring of fire running out over the kill box, debris thrown up at the camera, a shock front off the
 *    screen, the units round it knocked back, a heavy shake. A Beta leaves no Wreck: a crater with
 *    radial scorch and a cooling rim, smoke; what lies beneath shows again.
 * 4. Confirmed (4.2-5.9 s): a bigger label: "BETA DESTROYED · 2 / 3" to "3 / 3".
 * 5. Back (5.9-6.8 s): the zoom eases back.
 *
 * Energy is drawn with particles (designer 2026-11-20). The same for every Company (I25). Screen only:
 * nothing here is a rule.
 */

import { Graphics, Sprite } from "pixi.js";
import type { Step } from "../anim.js";
import { easeInOut, easeOut } from "../anim.js";
import { playBarrageShell, playOrbitalLance, playShieldBreak, playTargetLock } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, around, closeupStep, flat, glowSprite, hexCorners, motes, puff, seq } from "./closeup.js";
import { BARRAGE, span } from "./timeline.js";

const RED = 0xff3b30;
const ORANGE = 0xff8a2a;
const GOLD = 0xffc46a;
const CREAM = 0xfff0d8;
const CYAN = 0x8fe9ff;
const ICE = 0xe6fbff;
const S = BARRAGE.strike;
/** Centre to centre of two sectors, in tile radii (the Field draws each hex at 0.9 of its size). */
const NB = Math.sqrt(3) / 0.9;

/** Where shell i lands (tile radii from the Beta, angle): a spiral walking in. */
export function shellSpot(i: number): { r: number; a: number } {
  const n = BARRAGE.shells.length;
  const u = i / (n - 1);
  return { r: 2.5 - 1.35 * u, a: -0.9 + i * 2.05 };
}

/** Debris thrown up at the camera by the lance: direction, speed, size, life. */
const DEBRIS = (() => {
  const r = seq(1601);
  return Array.from({ length: 150 }, () => ({ a: r() * 6.283, v: 1.5 + r() * 5, size: 0.04 + r() * 0.09, life: 0.6 + r() * 0.9, up: r(), hue: r() }));
})();
const CHUNKS = (() => {
  const r = seq(7717);
  return Array.from({ length: 18 }, () => ({ a: r() * 6.283, v: 1.6 + r() * 3.4, size: 0.1 + r() * 0.16, spin: (r() - 0.5) * 12, cam: r() < 0.35, shape: [r(), r(), r(), r()] }));
})();
const SCORCH = (() => {
  const r = seq(5009);
  return Array.from({ length: 22 }, () => ({ a: r() * 6.283, len: 0.9 + r() * 1.5, w: 0.04 + r() * 0.08 }));
})();
const SMOKE = 12;

/** Barrage as a Field step (and its still picture for reduced motion and Instant). */
export function betaBarrageStep(env: KillEnv, k: KillTarget): Step {
  const ring = around(k.sector);
  return closeupStep(env, k, {
    times: { total: BARRAGE.total, zoomIn: BARRAGE.zoomIn, back: BARRAGE.back, breakAt: S, wreckIn: BARRAGE.wreckIn, label: BARRAGE.label, count: BARRAGE.count, stillAt: BARRAGE.count + 0.4 },
    size: 0.12,
    hole: 3.1,
    title: `${k.name.toUpperCase()} DESTROYED`,
    accent: RED,
    ink: CREAM,
    inkLine: 0x4a0d08,
    labelScale: 1.25,
    build: (back, front) => {
      const smoke = Array.from({ length: SMOKE }, () => {
        const p = new Sprite({ texture: puff(), anchor: 0.5 });
        p.tint = 0x2a2422;
        p.visible = false;
        back.addChild(p);
        return p;
      });
      const under = new Graphics();
      const light = new Graphics();
      light.blendMode = "add";
      back.addChild(under, light);
      const flashes = BARRAGE.shells.map(() => glowSprite(front, GOLD));
      const fire = glowSprite(front, ORANGE);
      const core = glowSprite(front, 0xffffff);
      const lance = glowSprite(front, CYAN);
      const chunks = new Graphics();
      const top = new Graphics();
      top.blendMode = "add";
      const white = new Graphics();
      white.blendMode = "add";
      front.addChild(chunks, top, white);
      const pm = motes(front, 1500);
      return { smoke, under, light, flashes, fire, core, lance, chunks, top, white, pm };
    },
    shake: (t, Rs) => {
      let x = 0;
      let y = 0;
      BARRAGE.shells.forEach((at, i) => {
        const a = t - at;
        if (a < 0 || a > 0.3) return;
        const amp = Rs * (0.02 + 0.006 * i) * (1 - a / 0.3) ** 2;
        x += amp * Math.sin(a * 70 + i);
        y += amp * Math.cos(a * 61 + i);
      });
      const a = t - S;
      if (a >= 0 && a < 1.1) {
        const amp = Rs * 0.2 * (1 - a / 1.1) ** 2;
        x += amp * Math.sin(a * 64);
        y += amp * Math.cos(a * 57);
      }
      return [x, y];
    },
    dark: (t) => {
      const mark = 0.12 * span(t, BARRAGE.mark);
      const out = t >= S ? 1 - span(t, [S, S + 0.1]) * (1 - span(t, [S + 0.35, S + 1.0])) : 0;
      return Math.min(1.15, 1 + mark) * (1 - out);
    },
    tile: (t) => {
      // A jolt at every shell, more as they come closer.
      let s = 1;
      BARRAGE.shells.forEach((at, i) => {
        const a = t - at;
        if (a >= 0 && a < 0.2) s += 0.012 * (1 + i * 0.4) * Math.sin((a / 0.2) * Math.PI);
      });
      return { scale: s, alpha: 1 };
    },
    sounds: (crossed) => {
      if (crossed(BARRAGE.lock)) playTargetLock();
      BARRAGE.shells.forEach((at, i) => crossed(at) && playBarrageShell(i, BARRAGE.shells.length));
      if (crossed(BARRAGE.shieldBreak)) playShieldBreak();
      if (crossed(BARRAGE.lance[0])) playOrbitalLance();
    },
    draw: (f, b) => {
      const { t, still, fade, Sx, Sy, Rs, R, broke, w, h, look } = f;
      const under = b.under.clear();
      const light = b.light.clear();
      const chunks = b.chunks.clear();
      const top = b.top.clear();
      const white = b.white.clear();
      const pm = b.pm;
      pm.begin();
      const nbx = (n: { dx: number; dy: number }) => Sx + n.dx * Rs * NB;
      const nby = (n: { dx: number; dy: number }) => Sy + n.dy * Rs * NB;

      // Act 1: the kill box, its outline drawn as particles round the seven sectors; pins on the six.
      const bu = still ? 0 : span(t, BARRAGE.box);
      const boxOut = still ? 1 : span(t, [S, S + 0.2]);
      if (bu > 0 && boxOut < 1) {
        const lockF = t >= BARRAGE.lock ? Math.max(0, 1 - (t - BARRAGE.lock) / 0.35) : 0;
        // The outer edge of the seven: a big hex turned 30°, through the outer corners.
        const BR = Rs * (NB * 1.0 + 1.05);
        const cs = Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i;
          return [Sx + Math.cos(a) * BR, Sy + Math.sin(a) * BR] as [number, number];
        });
        const per = 34;
        const drawn = easeInOut(bu) * 6 * per;
        for (let j = 0; j < 6 * per; j++) {
          if (j > drawn) break;
          const e0 = cs[Math.floor(j / per)]!;
          const e1 = cs[(Math.floor(j / per) + 1) % 6]!;
          const u = (j % per) / per;
          const head = drawn - j < 6;
          const fl = 0.6 + 0.4 * Math.sin(t * 25 + j);
          pm.dot(e0[0] + (e1[0] - e0[0]) * u, e0[1] + (e1[1] - e0[1]) * u, Math.max(2, Rs * (0.05 + 0.04 * lockF)), head || lockF > 0.4 ? 0xffffff : RED, (0.55 + 0.35 * fl) * (1 - boxOut) * (1 - 0.3 * span(t, BARRAGE.mark)));
        }
        if (lockF > 0) top.poly(flat(cs)).stroke({ width: 1 + 3 * lockF, color: 0xffffff, alpha: 0.7 * lockF });
        // The pins: a red point dropping onto each sector round it, a ring when it lands.
        ring.forEach((n, i) => {
          const at = BARRAGE.box[0] + 0.25 + i * 0.08;
          const u = span(t, [at, at + 0.18]);
          if (u <= 0) return;
          const x = nbx(n);
          const y = nby(n) - Rs * 0.9 * (1 - u * u);
          pm.dot(x, y, Rs * 0.12, u < 1 ? 0xffffff : RED, (1 - boxOut) * 0.95);
          const land = t - (at + 0.18);
          if (land > 0 && land < 0.4) top.circle(x, nby(n), Rs * (0.15 + 0.6 * (land / 0.4))).stroke({ width: 2, color: RED, alpha: 1 - land / 0.4 });
        });
      }

      // Act 2: the shells. A streak falling from above the page; the impact: flash, particle ring, dust; the nearest unit jolts.
      if (!still) {
        BARRAGE.shells.forEach((at, i) => {
          const { r, a } = shellSpot(i);
          const x = Sx + Math.cos(a) * Rs * r;
          const y = Sy + Math.sin(a) * Rs * r;
          const fu = span(t, [at - BARRAGE.fall, at]);
          if (fu > 0 && fu < 1) {
            // Falling from straight above the page: the streak shortens as it nears.
            const hy = -40 + (y + 40) * fu * fu;
            for (let m = 0; m < 14; m++) {
              const yy = hy - m * Rs * 0.12 * (1.4 - fu);
              pm.dot(x + Math.sin(m) * 1.5, yy, Math.max(2, Rs * (0.07 - m * 0.003)), m < 2 ? 0xffffff : m < 6 ? GOLD : ORANGE, 1 - m / 14, 2.2, Math.PI / 2);
            }
          }
          const age = t - at;
          const fl = b.flashes[i]!;
          fl.visible = age >= 0 && age < 0.35;
          if (fl.visible) {
            const u = age / 0.35;
            fl.position.set(x, y);
            fl.width = fl.height = Rs * (0.7 + 1.6 * easeOut(u)) * (1 + 0.1 * i);
            fl.alpha = (1 - u) ** 1.5;
            fl.tint = u < 0.25 ? 0xffffff : GOLD;
          }
          if (age >= 0 && age < 0.7) {
            const u = age / 0.7;
            const n = 26;
            for (let j = 0; j < n; j++) {
              const aa = (j / n) * Math.PI * 2;
              const rr = Rs * (0.15 + 1.0 * easeOut(u)) * (1 + 0.08 * i);
              pm.dot(x + Math.cos(aa) * rr, y + Math.sin(aa) * rr, Math.max(2, Rs * 0.05), u < 0.3 ? 0xffffff : ORANGE, (1 - u) ** 1.3, 2.2, aa + Math.PI / 2);
            }
            // Sparks and grit thrown out.
            const rnd = seq(i * 97 + 11);
            for (let j = 0; j < 16; j++) {
              const aa = rnd() * 6.283;
              const d = Rs * (0.1 + (1.2 + rnd() * 1.4) * (1 - Math.exp(-age * 4)));
              pm.dot(x + Math.cos(aa) * d, y + Math.sin(aa) * d, Math.max(1.6, Rs * 0.04), rnd() < 0.5 ? GOLD : CREAM, 1 - u, 3, aa);
            }
          }
          // Embers left glowing where it landed, cooling.
          if (age >= 0 && age < 1.6) {
            const cu = age / 1.6;
            for (let j = 0; j < 7; j++) {
              const aa = j * 0.9 + i;
              const d = Rs * (0.08 + 0.05 * (j % 3));
              pm.dot(x + Math.cos(aa) * d, y + Math.sin(aa) * d, Math.max(1.6, Rs * 0.045), cu < 0.4 ? GOLD : ORANGE, (1 - cu) * (0.5 + 0.5 * Math.sin(t * 13 + j)));
            }
          }
          // The nearest unit round it is shoved away from the blast.
          if (age >= 0 && age < 0.45) {
            let best = ring[0]!;
            let bd = Infinity;
            for (const n of ring) {
              const d = Math.hypot(nbx(n) - x, nby(n) - y);
              if (d < bd) {
                bd = d;
                best = n;
              }
            }
            const L = look(best.key);
            const dx = nbx(best) - x;
            const dy = nby(best) - y;
            const dl = Math.hypot(dx, dy) || 1;
            const push = R * 0.09 * Math.exp(-age * 9) * Math.sin(age * 30);
            L.dx += (dx / dl) * push;
            L.dy += (dy / dl) * push;
          }
        });
      }

      // The Beta's shield: a hex bubble of particle cells; it flares at each hit, cracks, breaks into flying cells.
      if (!still && t >= BARRAGE.shieldUp) {
        const up = span(t, [BARRAGE.shieldUp, BARRAGE.shieldUp + 0.2]);
        const brk = t - BARRAGE.shieldBreak;
        let hit = 0;
        BARRAGE.shells.forEach((at) => {
          const a = t - at;
          if (a >= 0 && a < 0.25) hit = Math.max(hit, 1 - a / 0.25);
        });
        const shR = Rs * 1.2;
        const cells = 72;
        for (let j = 0; j < cells; j++) {
          const side = Math.floor(j / 12);
          const u = (j % 12) / 12 + 0.04;
          const cs = hexCorners(Sx, Sy, shR);
          const e0 = cs[side]!;
          const e1 = cs[(side + 1) % 6]!;
          let x = e0[0] + (e1[0] - e0[0]) * u;
          let y = e0[1] + (e1[1] - e0[1]) * u;
          // Cracked cells drop out as the shells come close.
          const lostAt = BARRAGE.shells[4]! + ((j * 37) % 11) * 0.05;
          if (brk < 0 && t > lostAt && (j * 13) % 5 === 0) continue;
          if (brk >= 0) {
            if (brk > 0.7) continue;
            const aa = Math.atan2(y - Sy, x - Sx) + ((j * 7) % 5 - 2) * 0.08;
            const d = Rs * (2.6 + ((j * 11) % 7) * 0.4) * (1 - Math.exp(-brk * 4)) * 0.6;
            x += Math.cos(aa) * d;
            y += Math.sin(aa) * d;
            pm.dot(x, y, Math.max(2, Rs * 0.07), j % 3 ? CYAN : 0xffffff, 1 - brk / 0.7, 2, aa);
            continue;
          }
          const fl = 0.5 + 0.5 * Math.sin(t * 30 + j * 1.3);
          pm.dot(x, y, Math.max(2, Rs * (0.055 + 0.03 * hit)), hit > 0.5 ? 0xffffff : j % 2 ? CYAN : ICE, up * (0.35 + 0.25 * fl + 0.5 * hit));
        }
        if (brk < 0) top.poly(flat(hexCorners(Sx, Sy, shR))).fill({ color: CYAN, alpha: (0.04 + 0.16 * hit) * up });
        if (brk >= 0 && brk < 0.3) top.poly(flat(hexCorners(Sx, Sy, shR * (1 + brk)))).stroke({ width: 3 * (1 - brk / 0.3), color: 0xffffff, alpha: 1 - brk / 0.3 });
      }

      // Act 3: the target ring shrinks onto it, red, then the lance falls from orbit.
      if (!still && t >= BARRAGE.mark[0] && t < S) {
        const u = span(t, BARRAGE.mark);
        const rr = Rs * (2.6 - 1.7 * easeInOut(u));
        const blink = 0.6 + 0.4 * Math.sin(t * 40);
        const n = 48;
        for (let j = 0; j < n; j++) {
          const aa = (j / n) * Math.PI * 2 - t * 2;
          pm.dot(Sx + Math.cos(aa) * rr, Sy + Math.sin(aa) * rr, Math.max(2, Rs * 0.06), u > 0.9 ? 0xffffff : RED, blink);
        }
        top.circle(Sx, Sy, rr).stroke({ width: 1.5, color: RED, alpha: 0.5 * blink });
      }
      const lu = still ? 1 : span(t, BARRAGE.lance);
      const lanceOn = !still && lu > 0 && t < S + 0.45;
      b.lance.visible = lanceOn;
      if (lanceOn) {
        // A column from above the page down to the Beta; it thickens as it lands and lingers a moment.
        const tail = span(t, [S, S + 0.45]);
        const bottom = -40 + (Sy + 40) * easeOut(lu);
        const wd = Rs * (0.35 + 0.5 * lu) * (1 - tail);
        b.lance.position.set(Sx, (bottom - 40) / 2);
        b.lance.width = wd * 3;
        b.lance.height = bottom + 80;
        b.lance.alpha = 0.7 * (1 - tail);
        top.rect(Sx - wd * 0.18, -40, wd * 0.36, bottom + 40).fill({ color: 0xffffff, alpha: 0.95 * (1 - tail) });
        for (let m = 0; m < 60; m++) {
          const y = bottom - ((m * 37 + t * 2400) % (bottom + 40));
          const side = ((m * 13) % 7) / 7 - 0.5;
          pm.dot(Sx + side * wd * 1.1, y, Math.max(2, Rs * 0.05), m % 3 ? CYAN : 0xffffff, 0.85 * (1 - tail), 3, Math.PI / 2);
        }
      }

      // The strike: white-out, fireball, firestorm ring over the kill box, shock front, debris, units knocked back.
      const age = t - S;
      const live = !still && broke;
      if (live && age < 0.5) white.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.95 * (1 - age / 0.5) ** 2 });
      const fb = (sp: Sprite, from: number, to: number, len: number, a: number) => {
        const u = live ? span(t, [S, S + len]) : 1;
        sp.visible = u < 1;
        if (!sp.visible) return;
        sp.position.set(Sx, Sy);
        sp.width = sp.height = Rs * (from + (to - from) * easeOut(u));
        sp.alpha = a * (1 - u) ** 1.2;
      };
      fb(b.core, 1, 3.4, 0.5, 1);
      fb(b.fire, 1.6, 6.5, 1.2, 0.9);
      if (live && age < 0.9) {
        // The ring of fire runs out over the kill box: a thick band of particles, white at its front.
        const u = span(t, BARRAGE.ring);
        const rr = Rs * (0.6 + 3.4 * easeOut(u));
        const n = 120;
        for (let j = 0; j < n; j++) {
          const aa = (j / n) * Math.PI * 2;
          for (let l = 0; l < 3; l++) {
            const r2 = rr - l * Rs * 0.18 * (1 - u * 0.5) + Math.sin(aa * 9 + t * 20 + l) * Rs * 0.05;
            pm.dot(Sx + Math.cos(aa) * r2, Sy + Math.sin(aa) * r2, Math.max(2, Rs * (0.09 - l * 0.02)), l === 0 ? (u < 0.4 ? 0xffffff : GOLD) : l === 1 ? ORANGE : RED, (1 - u) ** 1.1 * (1 - l * 0.25), 2.4, aa + Math.PI / 2);
          }
        }
        // The shock front, off the screen.
        const far = Math.hypot(Math.max(Sx, w - Sx), Math.max(Sy, h - Sy)) + 40;
        const v = age / 0.65;
        if (v < 1) top.circle(Sx, Sy, Rs * 0.8 + (far - Rs * 0.8) * v).stroke({ width: Math.max(1.5, Rs * 0.12 * (1 - v)), color: CREAM, alpha: 0.85 * (1 - v) });
      }
      if (live && age < 1.6) {
        for (const p of DEBRIS) {
          if (age > p.life) continue;
          const u = age / p.life;
          // Up at the camera: out from the middle and growing.
          const d = Rs * (0.2 + p.v * (1 - Math.exp(-age * 2.5)) * 0.7);
          const grow = 1 + 3 * p.up * u;
          const tint = u < 0.25 ? 0xffffff : u < 0.5 ? GOLD : p.hue < 0.5 ? ORANGE : RED;
          pm.dot(Sx + Math.cos(p.a) * d, Sy + Math.sin(p.a) * d, Math.max(2, Rs * p.size * grow), tint, (1 - u) ** 1.3, 1 + 3 * (1 - u), p.a);
        }
        for (const c of CHUNKS) {
          const u = age / 1.6;
          const d = Rs * (0.3 + c.v * easeOut(Math.min(1, age / 1.2)));
          const grow = c.cam ? 1 + 4 * u * u : 1;
          const x = Sx + Math.cos(c.a) * d;
          const y = Sy + Math.sin(c.a) * d;
          const rot = c.spin * u;
          const s = Rs * c.size * grow;
          const pts = c.shape.map((v, i) => {
            const aa = rot + (i / 4) * Math.PI * 2 + v * 0.8;
            return [x + Math.cos(aa) * s * (0.5 + v), y + Math.sin(aa) * s * (0.5 + v)] as [number, number];
          });
          const al = (1 - u) ** (c.cam ? 2.2 : 1.2);
          chunks.poly(flat(pts)).fill({ color: 0x2a1f1c, alpha: al }).stroke({ width: c.cam ? 2.4 : 1.3, color: u < 0.4 ? GOLD : ORANGE, alpha: al });
        }
      }
      if (live && age < 1.5) {
        for (const n of ring) {
          const a = Math.max(0, age - 0.05);
          const push = R * 0.38 * Math.exp(-a * 4) * Math.sin(a * 15);
          const L = look(n.key);
          L.dx += n.dx * push;
          L.dy += n.dy * push;
          L.scale *= 1 - 0.07 * Math.exp(-a * 5);
        }
      }

      // The crater: dark, radial scorch, a rim cooling from white to red; embers; smoke.
      const cool = still ? 0.6 : span(t, BARRAGE.cool);
      const sc = still ? fade : broke ? Math.min(1, age / 0.3) * (1 - span(t, [BARRAGE.back[0], BARRAGE.back[1] - 0.2])) : 0;
      if (sc > 0.01) {
        for (const s of SCORCH) {
          const x2 = Sx + Math.cos(s.a) * Rs * s.len;
          const y2 = Sy + Math.sin(s.a) * Rs * s.len;
          under.moveTo(Sx, Sy).lineTo(x2, y2).stroke({ width: Rs * s.w, color: 0x0c0604, alpha: 0.45 * sc });
        }
        under.circle(Sx, Sy, Rs * 0.85).fill({ color: 0x0e0604, alpha: 0.7 * sc * (1 - 0.4 * cool) });
        const rimC = cool < 0.15 ? 0xffffff : cool < 0.4 ? GOLD : cool < 0.7 ? ORANGE : RED;
        const rimA = sc * (1 - 0.75 * cool);
        const n = 54;
        for (let j = 0; j < n; j++) {
          const aa = (j / n) * Math.PI * 2;
          const rr = Rs * (0.82 + 0.05 * Math.sin(aa * 7));
          const fl = still ? 0.8 : 0.6 + 0.4 * Math.sin(t * 11 + j * 2.3);
          pm.dot(Sx + Math.cos(aa) * rr, Sy + Math.sin(aa) * rr, Math.max(2, Rs * 0.06), rimC, rimA * fl);
        }
        light.circle(Sx, Sy, Rs * 0.84).stroke({ width: Math.max(4, Rs * 0.1), color: rimC, alpha: 0.3 * rimA });
      }
      b.smoke.forEach((sp, j) => {
        const born = S + 0.3 + j * 0.16;
        const a = still ? 0.4 + (j % 5) * 0.35 : t - born;
        if (!broke || a < 0 || a > 2.4 || (still && j > 5)) return void (sp.visible = false);
        const u = a / 2.4;
        const aa = j * 2.4;
        sp.visible = true;
        sp.position.set(Sx + Math.cos(aa) * Rs * (0.3 + 0.9 * u), Sy + Math.sin(aa) * Rs * (0.3 + 0.9 * u) - Rs * 0.8 * u);
        sp.width = sp.height = Rs * (1 + 1.8 * u);
        sp.alpha = 0.7 * Math.sin(Math.PI * Math.min(1, u * 1.2 + 0.08)) * fade * (still ? 1 : 1 - span(t, [BARRAGE.back[0] + 0.2, BARRAGE.back[1]]));
      });
      pm.end();
    },
  });
}
