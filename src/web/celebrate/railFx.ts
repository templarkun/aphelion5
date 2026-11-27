/**
 * Rail Strike, the third kill for Alpha (designer 2026-11-27: "Make 2 animations for Alpha unit
 * elimination"), drawn on the Field (PixiJS) in the close-up every kill shares (closeup.ts). About 4.5 s,
 * as the other Alpha kills, a different act: one shot from far away.
 *
 * 1. Sight (0-0.8 s): the zoom; a sight line of red particles reaches in from beyond the edge of the
 *    Field to the unit, a reticle of particles narrows round the tile and locks (playTargetLock).
 * 2. Charge and fire (0.8-1.8 s): rings of particles (the accelerator coils) light one after another
 *    along the line, the far ones first (playRailCharge); the slug crosses in bullet time (playRailFire),
 *    a white-hot head with a cone of shocked air behind it and a trail; each coil flares as it passes.
 * 3. Through (1.8-3.6 s): it strikes (playRailImpact): a flash, the unit is blown out through its far
 *    side in a cone of debris (sparks and dark fragments), a shock ring, a hard shake along the shot;
 *    the hole glows white, then orange, then red as it cools; smoke drifts off along the shot; the Wreck
 *    shows again (4.8); "ALPHA TERMINATED · 5 / 6" to "6 / 6".
 * 4. Back (3.6-4.5 s): the zoom eases back.
 *
 * Energy is drawn with particles (designer 2026-11-20). The same for every Company (I25). Screen only:
 * nothing here is a rule.
 */

import { Graphics, Sprite } from "pixi.js";
import type { Step } from "../anim.js";
import { easeInOut, easeOut } from "../anim.js";
import { playRailCharge, playRailFire, playRailImpact, playTargetLock } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, closeupStep, glowSprite, hexCorners, motes, puff, seq } from "./closeup.js";
import { RAIL, span } from "./timeline.js";

const RED = 0xff3b30;
const AMBER = 0xffb347;
const HOTW = 0xfff4dc;
const CYAN = 0x8fe9ff;
const EMBER = 0xff6a1a;

/** The shot's way across the screen: in from the upper left, down a little to the right. */
const ANG = 0.3;
const DX = Math.cos(ANG);
const DY = Math.sin(ANG);
/** The coils: how many, how far apart (tile radii, from the unit outwards). */
const COILS = 7;
const coilDist = (i: number) => 1.75 + i * 1.05;
/** When coil i lights (the far ones first). */
const coilAt = (i: number) => RAIL.coils[0] + ((COILS - 1 - i) / (COILS - 1)) * (RAIL.coils[1] - RAIL.coils[0] - 0.08);

/** The slug's distance from the unit (tile radii) at time t: fast, then slowing as it nears (bullet time). */
export function slugDistance(t: number, far: number): number {
  const u = span(t, [RAIL.fire, RAIL.impact]);
  return far * (1 - u) ** 1.7;
}
/** When the slug passes distance d (tile radii) from the unit. */
export function slugPasses(d: number, far: number): number {
  const u = 1 - Math.max(0, Math.min(1, d / far)) ** (1 / 1.7);
  return RAIL.fire + u * (RAIL.impact - RAIL.fire);
}

/** Debris out of the far side: direction (round the shot), speed, drag, size, life; some are dark fragments. */
const DEBRIS = (() => {
  const r = seq(3307);
  return Array.from({ length: 170 }, (_, i) => {
    const wide = r() < 0.15;
    return {
      a: (r() - 0.5) * (wide ? 2.4 : 1.0) * (0.4 + r() * 0.6),
      v: (wide ? 2.5 : 4.5) + r() * 9,
      k: 2.2 + r() * 2.5,
      size: 0.04 + r() * 0.08,
      life: 0.45 + r() * 0.75,
      back: i % 11 === 0,
      ph: r() * 6.28,
    };
  });
})();
/** Dark fragments of the tile, tumbling out with the debris. */
const CHUNKS = (() => {
  const r = seq(8123);
  return Array.from({ length: 12 }, () => ({ a: (r() - 0.5) * 1.1, v: 3 + r() * 5, k: 2 + r() * 1.5, size: 0.08 + r() * 0.1, spin: (r() - 0.5) * 18, shape: [r(), r(), r()] }));
})();
/** Smoke puffs blown along the shot. */
const SMOKE = (() => {
  const r = seq(5813);
  return Array.from({ length: 10 }, () => ({ a: (r() - 0.5) * 0.9, v: 0.6 + r() * 1.4, born: RAIL.impact + 0.05 + r() * 0.5, size: 0.6 + r() * 0.8, life: 1.2 + r() * 0.9 }));
})();
const EMBERS = (() => {
  const r = seq(919);
  return Array.from({ length: 26 }, () => ({ a: r() * 6.283, d: 0.12 + r() * 0.3, ph: r() * 6.28, fq: 3 + r() * 6 }));
})();

/** Drag: how far something thrown at speed v with drag k has gone after `age` seconds. */
const dragged = (v: number, k: number, age: number) => (v * (1 - Math.exp(-k * age))) / k;

/** Rail Strike as a Field step (and its still picture for reduced motion and Instant). */
export function alphaRailStep(env: KillEnv, k: KillTarget): Step {
  return closeupStep(env, k, {
    times: { total: RAIL.total, zoomIn: RAIL.zoomIn, back: RAIL.back, breakAt: RAIL.impact, wreckIn: RAIL.wreckIn, label: RAIL.label, count: RAIL.count, stillAt: RAIL.count + 0.5 },
    title: `${k.name.toUpperCase()} TERMINATED`,
    accent: AMBER,
    ink: HOTW,
    inkLine: 0x4a2208,
    hole: 1.05,
    build: (back, front) => {
      const smoke = SMOKE.map(() => {
        const p = new Sprite({ texture: puff(), anchor: 0.5 });
        p.tint = 0x3d3734;
        p.visible = false;
        back.addChild(p);
        return p;
      });
      const hole = glowSprite(back, EMBER);
      const lines = new Graphics();
      lines.blendMode = "add";
      front.addChild(lines);
      const chunks = new Graphics();
      front.addChild(chunks);
      const flash = glowSprite(front, HOTW);
      const head = glowSprite(front, HOTW);
      const pm = motes(front, 900);
      return { smoke, hole, lines, chunks, flash, head, pm };
    },
    shake: (t, Rs) => {
      const a = t - RAIL.impact;
      if (a < 0 || a > 0.55) return [0, 0];
      // Hard along the shot first, then a ringing side to side.
      const kick = Rs * 0.16 * Math.exp(-a / 0.06);
      const ring = Rs * 0.05 * Math.exp(-a / 0.16) * Math.sin(a * 55);
      return [DX * kick - DY * ring, DY * kick + DX * ring];
    },
    dark: (t) => 1 - 0.35 * Math.max(0, 1 - Math.abs(t - RAIL.impact - 0.05) / 0.35),
    tile: (t) => {
      // A small shudder as the slug nears.
      const near = span(t, [RAIL.impact - 0.15, RAIL.impact]);
      return { scale: 1 + 0.03 * near, alpha: 1 };
    },
    sounds: (crossed) => {
      if (crossed(RAIL.lock)) playTargetLock();
      if (crossed(RAIL.coils[0])) playRailCharge();
      if (crossed(RAIL.fire)) playRailFire();
      if (crossed(RAIL.impact)) playRailImpact();
    },
    draw: (f, b) => {
      const { t, still, fade, Sx, Sy, Rs, w, h, broke } = f;
      const lines = b.lines.clear();
      const chunks = b.chunks.clear();
      const pm = b.pm;
      pm.begin();
      // Distance to beyond the screen's edge along the shot (tile radii).
      const far = Math.max(coilDist(COILS - 1) + 1.5, (Math.hypot(w, h) + Rs) / Rs);
      const at = (d: number): [number, number] => [Sx - DX * Rs * d, Sy - DY * Rs * d];
      const nx = -DY;
      const ny = DX;

      // The sight line: red particles from beyond the edge to the tile, flickering; gone once the slug flies.
      const su = still ? 0 : easeOut(span(t, RAIL.sight));
      const sightOff = still ? 1 : span(t, [RAIL.fire - 0.05, RAIL.fire + 0.15]);
      if (su > 0 && sightOff < 1) {
        const reach = far - (far - 1.05) * su;
        const step = 0.16;
        const tick = Math.floor(t * 30);
        for (let d = 1.05; d < far; d += step) {
          if (d < reach) continue;
          const [x, y] = at(d);
          const fl = 0.55 + 0.45 * Math.sin(d * 9 + tick * 1.7);
          pm.dot(x, y, Math.max(2, Rs * 0.06), d < reach + 0.4 ? 0xffffff : RED, (0.35 + 0.4 * fl) * (1 - sightOff), 2.2, ANG);
        }
        // The laser's dot on the tile.
        const [x, y] = at(1.0);
        if (reach <= 1.1) pm.dot(x, y, Rs * 0.22, RED, 0.8 * (1 - sightOff));
      }

      // The reticle: a ring of particles narrowing round the tile, four ticks; it flashes at the lock.
      if (!still && !broke) {
        const ru = span(t, RAIL.reticle);
        if (ru > 0) {
          const rr = Rs * (2.3 - 1.12 * easeInOut(ru));
          const lockF = t >= RAIL.lock ? Math.max(0, 1 - (t - RAIL.lock) / 0.35) : 0;
          const spin = t * 1.8 * (1 - ru) + 0.4;
          const n = 54;
          for (let j = 0; j < n; j++) {
            if (j % 9 === 0) continue; // gaps in the ring
            const a = spin + (j / n) * Math.PI * 2;
            pm.dot(Sx + Math.cos(a) * rr, Sy + Math.sin(a) * rr, Math.max(2, Rs * (0.055 + 0.03 * lockF)), lockF > 0.3 ? 0xffffff : RED, Math.min(1, ru * 2) * (0.6 + 0.4 * lockF));
          }
          for (let j = 0; j < 4; j++) {
            const a = -spin * 0.5 + j * (Math.PI / 2) + Math.PI / 4;
            for (let m = 0; m < 5; m++) {
              const d = rr * (1.05 + m * 0.05);
              pm.dot(Sx + Math.cos(a) * d, Sy + Math.sin(a) * d, Math.max(2, Rs * 0.05), m === 0 ? 0xffffff : AMBER, Math.min(1, ru * 2) * 0.9, 1.6, a);
            }
          }
          if (lockF > 0) lines.circle(Sx, Sy, rr * (1 + 0.25 * (1 - lockF))).stroke({ width: 1 + 2 * lockF, color: 0xffffff, alpha: 0.7 * lockF });
        }
      }

      // The coils: rings of particles across the line, seen at a slant; they light far to near, hum, and
      // flare as the slug passes, then fade.
      if (!still) {
        for (let i = 0; i < COILS; i++) {
          const on = t - coilAt(i);
          if (on < 0) continue;
          const pass = slugPasses(coilDist(i), far);
          const after = t - pass;
          if (after > 0.6) continue;
          const [cx, cy] = at(coilDist(i));
          const flare = after >= 0 ? Math.exp(-after / 0.08) : 0;
          const lit = Math.min(1, on / 0.08) * (after > 0 ? Math.max(0, 1 - after / 0.6) : 1);
          const R1 = Rs * (0.72 + 0.3 * flare);
          const R2 = Rs * (0.2 + 0.1 * flare);
          const m = 30;
          for (let j = 0; j < m; j++) {
            const a = (j / m) * Math.PI * 2 + t * 6 + i;
            const px = cx + nx * Math.cos(a) * R1 + DX * Math.sin(a) * R2;
            const py = cy + ny * Math.cos(a) * R1 + DY * Math.sin(a) * R2;
            const hum = 0.55 + 0.45 * Math.sin(t * 40 + j + i * 2);
            pm.dot(px, py, Math.max(2.5, Rs * (0.08 + 0.06 * flare)), flare > 0.3 || on < 0.06 ? 0xffffff : CYAN, lit * (0.6 + 0.4 * hum + flare));
          }
          // A spray of particles off the coil as the slug passes through.
          if (after >= 0 && after < 0.35) {
            for (let j = 0; j < 10; j++) {
              const a = (j / 10) * Math.PI * 2 + i;
              const d = Rs * (0.55 + 3.5 * after);
              pm.dot(cx + nx * Math.cos(a) * d + DX * Math.sin(a) * d * 0.3, cy + ny * Math.cos(a) * d + DY * Math.sin(a) * d * 0.3, Math.max(2, Rs * 0.045), CYAN, 1 - after / 0.35, 2, a);
            }
          }
        }
      }

      // The slug: a white-hot head, a cone of shocked air behind it, a trail that lingers as ionised smoke.
      const flying = !still && t >= RAIL.fire && t < RAIL.impact;
      b.head.visible = flying;
      if (flying) {
        const d = slugDistance(t, far);
        const [hx, hy] = at(d);
        b.head.position.set(hx, hy);
        b.head.width = Rs * 1.6;
        b.head.height = Rs * 0.5;
        b.head.rotation = ANG;
        b.head.alpha = 0.95;
        pm.dot(hx, hy, Rs * 0.2, 0xffffff, 1, 3.5, ANG);
        // The cone: two lines of particles opening backwards, brighter near the head.
        for (const side of [-1, 1]) {
          for (let j = 1; j <= 14; j++) {
            const back = j * 0.13;
            const spread = back * 0.42 * side;
            const px = hx - DX * Rs * back + nx * Rs * spread;
            const py = hy - DY * Rs * back + ny * Rs * spread;
            pm.dot(px, py, Math.max(2, Rs * 0.05), j < 4 ? 0xffffff : AMBER, 0.95 * (1 - j / 15), 2, ANG + side * 0.4);
          }
        }
      }
      // The trail behind it (and after the strike, the ionised trail fading and drifting apart).
      if (!still && t >= RAIL.fire) {
        const d = t < RAIL.impact ? slugDistance(t, far) : 0;
        const gone = span(t, [RAIL.impact, RAIL.impact + 1.4]);
        // The channel the slug burns through the air: a glow and a white core, thinning as it fades.
        const ch = 1 - span(t, [RAIL.impact, RAIL.impact + 0.5]);
        if (ch > 0) {
          const [x1, y1] = at(d);
          const [x2, y2] = at(far);
          lines.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: Math.max(4, Rs * 0.16) * ch, color: AMBER, alpha: 0.28 * ch });
          lines.moveTo(x1, y1).lineTo(x2, y2).stroke({ width: Math.max(1.5, Rs * 0.035) * ch, color: 0xffffff, alpha: 0.85 * ch });
        }
        for (let s = 0; s < 90; s++) {
          const dd = d + s * 0.18;
          if (dd > far) break;
          const passed = t - slugPasses(dd, far);
          if (passed < 0) continue;
          const [x, y] = at(dd);
          const drift = Rs * 0.25 * passed * Math.sin(s * 2.3);
          const hot = Math.exp(-passed / 0.12);
          const a = (0.25 + 0.75 * hot) * (1 - gone) * Math.max(0, 1 - passed / 1.6);
          pm.dot(x + nx * drift, y + ny * drift, Math.max(2, Rs * (0.08 - 0.03 * hot)), hot > 0.5 ? HOTW : s % 3 ? AMBER : CYAN, a, 2.5, ANG);
        }
      }

      // The strike: a flash, the shock ring, the spall back up the line, debris out of the far side.
      const age = t - RAIL.impact;
      const fl = !still && age >= 0 ? span(t, [RAIL.impact, RAIL.impact + 0.3]) : 1;
      b.flash.visible = fl < 1;
      if (fl < 1) {
        b.flash.position.set(Sx, Sy);
        b.flash.width = Rs * (2.5 + 6 * easeOut(fl));
        b.flash.height = Rs * (1.8 + 3 * easeOut(fl));
        b.flash.rotation = ANG;
        b.flash.alpha = (1 - fl) ** 1.5;
        b.flash.tint = fl < 0.3 ? 0xffffff : AMBER;
      }
      if (!still && age >= 0 && age < 0.6) {
        const u = age / 0.6;
        const rr = Rs * (0.4 + 3.4 * easeOut(u));
        const n = 60;
        for (let j = 0; j < n; j++) {
          const a = (j / n) * Math.PI * 2;
          // Stretched along the shot: the front of the ring runs ahead.
          const ahead = 1 + 0.45 * Math.max(0, Math.cos(a - ANG));
          pm.dot(Sx + Math.cos(a) * rr * ahead, Sy + Math.sin(a) * rr * ahead, Math.max(2, Rs * 0.06), u < 0.3 ? 0xffffff : AMBER, (1 - u) ** 1.4, 2.4, a + Math.PI / 2);
        }
        lines.circle(Sx, Sy, rr).stroke({ width: 2.5 * (1 - u) + 0.5, color: AMBER, alpha: 0.35 * (1 - u) });
      }
      if (!still && age >= 0) {
        for (const p of DEBRIS) {
          if (age > p.life) continue;
          const dir = p.back ? ANG + Math.PI + p.a * 0.8 : ANG + p.a;
          const dist = Rs * (0.2 + dragged(p.v * (p.back ? 0.4 : 1), p.k, age));
          const x = Sx + Math.cos(dir) * dist;
          const y = Sy + Math.sin(dir) * dist;
          const u = age / p.life;
          const speed = p.v * Math.exp(-p.k * age);
          const tint = u < 0.2 ? 0xffffff : u < 0.45 ? HOTW : u < 0.7 ? AMBER : EMBER;
          pm.dot(x, y, Math.max(2, Rs * p.size), tint, (1 - u) ** 1.2, 1 + Math.min(6, speed * 0.6), dir);
        }
        // Dark fragments of the tile, lit on one edge, tumbling and slowing.
        for (const c of CHUNKS) {
          if (age > 1.3) break;
          const dir = ANG + c.a;
          const dist = Rs * (0.3 + dragged(c.v, c.k, age));
          const x = Sx + Math.cos(dir) * dist;
          const y = Sy + Math.sin(dir) * dist;
          const rot = c.spin * (1 - Math.exp(-age * 1.5));
          const s = Rs * c.size;
          const pts = c.shape.map((v, i) => {
            const a = rot + (i / 3) * Math.PI * 2 + v;
            return [x + Math.cos(a) * s * (0.6 + v), y + Math.sin(a) * s * (0.6 + v)];
          });
          const al = Math.max(0, 1 - age / 1.3);
          chunks.poly(pts.flat()).fill({ color: 0x2a2530, alpha: al }).stroke({ width: 1.2, color: age < 0.4 ? AMBER : EMBER, alpha: al * 0.9 });
        }
      }

      // The hole: white, then orange, then red as it cools; embers round it (a few hang in the still picture).
      const cu = still ? 0.75 : span(t, RAIL.cool);
      const glow = still ? 0.45 * fade : !broke ? 0 : 1 - cu;
      b.hole.visible = glow > 0.01;
      if (b.hole.visible) {
        b.hole.position.set(Sx, Sy);
        b.hole.width = b.hole.height = Rs * (0.9 + 0.6 * (1 - cu));
        b.hole.tint = cu < 0.15 ? 0xffffff : cu < 0.45 ? AMBER : EMBER;
        b.hole.alpha = 0.85 * glow;
        for (const [i, e] of EMBERS.entries()) {
          if (still && i > 10) break;
          const flick = 0.5 + 0.5 * Math.sin(e.fq * (still ? 0 : t) + e.ph);
          const d = Rs * e.d * (1 + 0.3 * cu);
          pm.dot(Sx + Math.cos(e.a) * d, Sy + Math.sin(e.a) * d, Math.max(2, Rs * 0.05), cu < 0.4 ? AMBER : EMBER, glow * (0.4 + 0.6 * flick));
        }
      }
      // Smoke blown off along the shot.
      b.smoke.forEach((sp, i) => {
        const p = SMOKE[i]!;
        const a2 = still ? 0.6 + i * 0.05 : t - p.born;
        if ((still && i > 4) || a2 < 0 || a2 > p.life) {
          sp.visible = false;
          return;
        }
        const u = a2 / p.life;
        const dir = ANG + p.a;
        const dist = Rs * (0.3 + p.v * (still ? 0.4 : a2));
        sp.visible = true;
        sp.position.set(Sx + Math.cos(dir) * dist, Sy + Math.sin(dir) * dist);
        sp.width = sp.height = Rs * p.size * (0.6 + 1.2 * u);
        sp.alpha = 0.55 * Math.sin(Math.PI * u) * fade;
      });
      pm.end();
      // The tile's outline: scorched round the hole once it is through (it fades with the cooling).
      if (broke && glow > 0.05) lines.poly(hexCorners(Sx, Sy, Rs).flat()).stroke({ width: Math.max(2, Rs * 0.05), color: EMBER, alpha: 0.4 * glow });
    },
  });
}
