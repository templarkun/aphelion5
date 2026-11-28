/**
 * Burnout, the fifth kill for Alpha (designer 2026-11-28: "Create 2 additional animations for eliminating
 * the Alpha unit"), drawn on the Field (PixiJS) in the close-up every kill shares (closeup.ts). About 4.5 s,
 * as the other Alpha kills, and a different act: no weapon from outside, the unit is overloaded from within.
 *
 * 1. Heat (0-0.95 s): the zoom; veins of particles creep in from the tile's six corners towards its middle,
 *    red, then orange (playBurnoutHeat); the tile's edge starts to glow; a low tremble.
 * 2. Overload (0.95-1.95 s): three surges throb through it, each brighter (playBurnoutSurge): the veins flash
 *    white, the tile swells, a ring of heat runs out; arcs of particles leap from its corners to the ground
 *    round it, more and more, scorching where they land; the tremble grows.
 * 3. Blow-out (1.95-3.6 s): the core bursts upwards (playBurnoutBlow): a flash, a jet, then a fountain of
 *    molten sparks that rise and fall back under gravity, glowing white to amber to ember; a small ring of
 *    heat; smoke rises and leans; the Wreck shows again (4.8) with a glowing crater that cools;
 *    "ALPHA BURNOUT · 5 / 6" to "6 / 6".
 * 4. Back (3.6-4.5 s): the zoom eases back.
 *
 * Energy is drawn with particles (designer 2026-11-20). The same for every Company (I25). Less than any Beta
 * kill (one unit, no knock-back). Screen only: nothing here is a rule.
 */

import { Graphics, Sprite } from "pixi.js";
import type { Step } from "../anim.js";
import { easeOut } from "../anim.js";
import { playBurnoutBlow, playBurnoutHeat, playBurnoutSurge } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, bolt, closeupStep, glowSprite, hexCorners, motes, puff, seq } from "./closeup.js";
import { BURNOUT, span } from "./timeline.js";

const RED = 0xff2a1a;
const ORANGE = 0xff7a1a;
const AMBER = 0xffb347;
const HOTW = 0xfff1d6;
const EMBER = 0xd8400e;
const ARC = 0xbfe6ff;

/** How strong the surges are at time t (0 between them, up to 1, 1.25, 1.5 at their peaks). */
export function surgeAt(t: number): number {
  let s = 0;
  BURNOUT.surges.forEach((at, i) => {
    const a = t - at;
    if (a >= -0.05 && a < 0.4) s = Math.max(s, (1 + 0.25 * i) * (a < 0 ? 1 + a / 0.05 : Math.exp(-a / 0.11)));
  });
  return s;
}
/** How far the veins have crept in from the corners (0 at the corners, 1 at the middle). */
export function veinReach(t: number): number {
  return easeOut(span(t, BURNOUT.veins));
}

/** The veins: from each corner a crooked way in towards the middle (in tile radii, unit centred). */
const VEINS = (() => {
  const r = seq(4177);
  const out: { pts: [number, number][]; ph: number }[] = [];
  for (let c = 0; c < 6; c++) {
    for (let k = 0; k < 2; k++) {
      const a0 = (Math.PI / 180) * (60 * c - 30) + (k ? 0.32 : -0.06);
      const pts: [number, number][] = [];
      let wob = 0;
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const d = (k ? 0.86 : 0.96) * (1 - (i / n) * 0.9);
        wob += (r() - 0.5) * 0.32;
        wob *= 0.85;
        const a = a0 + wob * (1 - i / n);
        pts.push([Math.cos(a) * d, Math.sin(a) * d]);
      }
      out.push({ pts, ph: r() * 6.28 });
    }
  }
  return out;
})();

/** The fountain's sparks: launched upwards in a cone, falling back under gravity (tile radii, seconds). */
export const SPARKS = (() => {
  const r = seq(7741);
  return Array.from({ length: 260 }, (_, i) => {
    const late = i % 5 === 0;
    return {
      born: BURNOUT.blow + (late ? 0.05 + r() * 0.3 : r() * 0.12),
      a: -Math.PI / 2 + (r() - 0.5) * (late ? 0.7 : 1.5),
      v: (late ? 3 : 4.5) + r() * 5.5,
      life: 0.8 + r() * 0.45,
      size: 0.035 + r() * 0.06,
    };
  });
})();
/** Gravity on the sparks (tile radii per second squared, downwards on the screen) and their air drag. */
export const GRAVITY = 11;
const DRAG = 0.9;
/** Where a spark is `age` seconds after it is launched (tile radii from the unit's centre) and how fast it goes. */
export function sparkAt(p: { a: number; v: number }, age: number): { x: number; y: number; vx: number; vy: number } {
  // Launched at speed v along a, slowed by drag, pulled down (screen y grows downwards) by gravity:
  // v(t) = vt + (v0 - vt) e^(-Dt), with vt the falling speed it tends to (closed form, nothing adds up).
  const e = Math.exp(-DRAG * age);
  const vx0 = Math.cos(p.a) * p.v;
  const vy0 = Math.sin(p.a) * p.v;
  const vt = GRAVITY / DRAG;
  return { x: (vx0 * (1 - e)) / DRAG, y: -0.1 + vt * age + ((vy0 - vt) * (1 - e)) / DRAG, vx: vx0 * e, vy: vt + (vy0 - vt) * e };
}

/** Smoke puffs rising off the crater. */
const SMOKE = (() => {
  const r = seq(2213);
  return Array.from({ length: 12 }, () => ({ born: BURNOUT.blow + 0.05 + r() * 0.9, x: (r() - 0.5) * 0.6, v: 0.9 + r() * 0.8, lean: 0.2 + r() * 0.35, size: 0.55 + r() * 0.7, life: 1.3 + r() * 0.9 }));
})();
const EMBERS = (() => {
  const r = seq(613);
  return Array.from({ length: 24 }, () => ({ a: r() * 6.283, d: 0.08 + r() * 0.36, ph: r() * 6.28, fq: 3 + r() * 6 }));
})();

/** Burnout as a Field step (and its still picture for reduced motion and Instant). */
export function alphaBurnoutStep(env: KillEnv, k: KillTarget): Step {
  return closeupStep(env, k, {
    times: { total: BURNOUT.total, zoomIn: BURNOUT.zoomIn, back: BURNOUT.back, breakAt: BURNOUT.blow, wreckIn: BURNOUT.wreckIn, label: BURNOUT.label, count: BURNOUT.count, stillAt: BURNOUT.count + 0.5 },
    title: `${k.name.toUpperCase()} BURNOUT`,
    accent: ORANGE,
    ink: HOTW,
    inkLine: 0x4a1a06,
    hole: 1.3,
    build: (back, front) => {
      const smoke = SMOKE.map(() => {
        const p = new Sprite({ texture: puff(), anchor: 0.5 });
        p.tint = 0x3a3330;
        p.visible = false;
        back.addChild(p);
        return p;
      });
      const heat = glowSprite(back, RED);
      const crater = glowSprite(back, EMBER);
      const lines = new Graphics();
      lines.blendMode = "add";
      front.addChild(lines);
      const flash = glowSprite(front, HOTW);
      const pm = motes(front, 1000);
      return { smoke, heat, crater, lines, flash, pm };
    },
    shake: (t, Rs) => {
      // A tremble that grows through the overload, a kick at each surge, a jolt at the blow-out.
      const grow = span(t, [0.6, BURNOUT.blow]);
      const after = t - BURNOUT.blow;
      const amp = after < 0 ? Rs * (0.006 + 0.018 * grow + 0.02 * surgeAt(t)) : Rs * 0.09 * Math.exp(-after / 0.12);
      if (after > 0.6) return [0, 0];
      return [amp * Math.sin(t * 83), amp * Math.cos(t * 71) + (after >= 0 ? amp * 0.6 : 0)];
    },
    dark: (t) => 1 - 0.3 * Math.max(0, 1 - Math.abs(t - BURNOUT.blow - 0.04) / 0.35) - 0.08 * surgeAt(t),
    tile: (t) => ({ scale: 1 + 0.045 * surgeAt(t) + 0.02 * span(t, [1.7, BURNOUT.blow]), alpha: 1 }),
    sounds: (crossed) => {
      if (crossed(BURNOUT.veins[0])) playBurnoutHeat();
      BURNOUT.surges.forEach((at, i) => {
        if (crossed(at)) playBurnoutSurge(i);
      });
      if (crossed(BURNOUT.blow)) playBurnoutBlow();
    },
    draw: (f, b) => {
      const { t, still, fade, Sx, Sy, Rs, broke } = f;
      const lines = b.lines.clear();
      const pm = b.pm;
      pm.begin();
      const surge = still ? 0 : surgeAt(t);
      const heatU = still ? 0 : span(t, [BURNOUT.veins[0], BURNOUT.blow]);

      // Before the blow-out: the heat glow over the tile, its glowing edge, the veins creeping in.
      if (!broke) {
        b.heat.visible = true;
        b.heat.position.set(Sx, Sy);
        b.heat.width = b.heat.height = Rs * (1.6 + 0.6 * surge);
        b.heat.tint = surge > 0.6 ? AMBER : heatU > 0.6 ? ORANGE : RED;
        b.heat.alpha = 0.18 + 0.45 * heatU + 0.35 * surge;
        // The edge glows: dots along the outline, flickering, hotter with the heat.
        const cs = hexCorners(Sx, Sy, Rs * 0.98);
        const per = 9;
        for (let i = 0; i < 6; i++) {
          const [x1, y1] = cs[i]!;
          const [x2, y2] = cs[(i + 1) % 6]!;
          for (let j = 0; j < per; j++) {
            const u = j / per;
            const fl = 0.5 + 0.5 * Math.sin(t * 19 + i * 3 + j * 1.7);
            const a = (0.15 + 0.6 * heatU + 0.5 * surge) * (0.6 + 0.4 * fl);
            pm.dot(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, Math.max(2, Rs * 0.07), surge > 0.5 ? HOTW : heatU > 0.5 ? AMBER : RED, a, 1.8, Math.atan2(y2 - y1, x2 - x1));
          }
        }
        const reach = veinReach(t);
        for (const v of VEINS) {
          const n = v.pts.length - 1;
          const upTo = reach * n;
          for (let i = 0; i <= upTo; i++) {
            const [px, py] = v.pts[i]!;
            const tip = upTo - i < 2;
            const fl = 0.55 + 0.45 * Math.sin(t * 24 + i * 0.9 + v.ph);
            const hot = surge > 0.4 || tip;
            pm.dot(Sx + px * Rs, Sy + py * Rs, Math.max(1.8, Rs * (tip ? 0.08 : 0.05) * (1 + 0.5 * surge)), hot ? HOTW : i < n * 0.4 ? ORANGE : AMBER, (0.45 + 0.5 * fl) * (0.7 + 0.5 * surge));
          }
        }
        // Each surge throws a ring of heat out from the tile.
        BURNOUT.surges.forEach((at, i) => {
          const a = t - at;
          if (still || a < 0 || a > 0.45) return;
          const u = a / 0.45;
          const rr = Rs * (1.0 + 1.3 * easeOut(u));
          const m = 44;
          for (let j = 0; j < m; j++) {
            const ang = (j / m) * Math.PI * 2 + i;
            pm.dot(Sx + Math.cos(ang) * rr, Sy + Math.sin(ang) * rr, Math.max(2, Rs * 0.05), u < 0.3 ? HOTW : ORANGE, (1 - u) * (0.55 + 0.2 * i), 2, ang + Math.PI / 2);
          }
        });
        // The arcs: from the corners to the ground round the tile, jumping about, more as the overload grows.
        const au = span(t, BURNOUT.arcs);
        if (!still && au > 0) {
          const tick = Math.floor(t * 16);
          const live = 1 + Math.floor(au * 4 + surge * 2);
          const rnd = seq(911 + tick * 37);
          for (let j = 0; j < live; j++) {
            const c = Math.floor(rnd() * 6);
            const [x1, y1] = cs[c]!;
            const out = (Math.PI / 180) * (60 * c - 30) + (rnd() - 0.5) * 0.9;
            const d = Rs * (1.35 + rnd() * 0.9);
            const x2 = Sx + Math.cos(out) * d;
            const y2 = Sy + Math.sin(out) * d;
            const pts = bolt(x1, y1, x2, y2, tick * 13 + j, 0.22, 8);
            for (let s = 0; s < pts.length - 1; s++) {
              const [ax, ay] = pts[s]!;
              const [bx, by] = pts[s + 1]!;
              for (let m = 0; m < 3; m++) {
                const u = m / 3;
                pm.dot(ax + (bx - ax) * u, ay + (by - ay) * u, Math.max(1.6, Rs * 0.045), m === 0 ? 0xffffff : ARC, 0.85, 1.6, Math.atan2(by - ay, bx - ax));
              }
            }
            // A scorch where it lands.
            pm.dot(x2, y2, Rs * 0.22, AMBER, 0.55);
            pm.dot(x2, y2, Rs * 0.08, 0xffffff, 0.8);
          }
        }
      } else b.heat.visible = false;

      // The blow-out: a flash, a jet straight up, a small ring of heat.
      const age = t - BURNOUT.blow;
      const fl = !still && age >= 0 ? span(t, [BURNOUT.blow, BURNOUT.blow + 0.32]) : 1;
      b.flash.visible = fl < 1;
      if (fl < 1) {
        b.flash.position.set(Sx, Sy - Rs * 0.3 * easeOut(fl));
        b.flash.width = Rs * (2.2 + 2.5 * easeOut(fl));
        b.flash.height = Rs * (2.6 + 4 * easeOut(fl));
        b.flash.alpha = (1 - fl) ** 1.4;
        b.flash.tint = fl < 0.3 ? 0xffffff : AMBER;
      }
      if (!still && age >= 0 && age < 0.4) {
        const u = age / 0.4;
        for (let j = 0; j < 26; j++) {
          const y = Sy - Rs * (0.2 + j * 0.2 * (0.4 + 2.2 * easeOut(u)));
          pm.dot(Sx + Math.sin(j * 2.1 + t * 40) * Rs * 0.06, y, Math.max(2.5, Rs * (0.16 - j * 0.004)), j < 6 ? 0xffffff : AMBER, (1 - u) * (1 - j / 30), 2.5, Math.PI / 2);
        }
        const rr = Rs * (0.6 + 2.2 * easeOut(u));
        for (let j = 0; j < 50; j++) {
          const ang = (j / 50) * Math.PI * 2;
          pm.dot(Sx + Math.cos(ang) * rr, Sy + Math.sin(ang) * rr * 0.92, Math.max(2, Rs * 0.06), u < 0.3 ? HOTW : ORANGE, (1 - u) ** 1.3, 2.2, ang + Math.PI / 2);
        }
      }
      // The fountain: sparks rise and fall back, drawn long along the way they fly.
      if (!still && age >= 0) {
        for (const p of SPARKS) {
          const a = t - p.born;
          if (a < 0 || a > p.life) continue;
          const s = sparkAt(p, a);
          const u = a / p.life;
          const tint = u < 0.15 ? 0xffffff : u < 0.4 ? HOTW : u < 0.7 ? AMBER : EMBER;
          const sp = Math.hypot(s.vx, s.vy);
          pm.dot(Sx + s.x * Rs, Sy + s.y * Rs, Math.max(1.8, Rs * p.size), tint, (1 - u) ** 1.1, 1 + Math.min(5, sp * 0.45), Math.atan2(s.vy, s.vx));
        }
      }

      // The crater: white, then orange, then red as it cools; embers round it (a few hang in the still picture).
      const cu = still ? 0.75 : span(t, BURNOUT.cool);
      const glow = still ? 0.45 * fade : !broke ? 0 : 1 - cu;
      b.crater.visible = glow > 0.01;
      if (b.crater.visible) {
        b.crater.position.set(Sx, Sy);
        b.crater.width = b.crater.height = Rs * (1.0 + 0.6 * (1 - cu));
        b.crater.tint = cu < 0.15 ? 0xffffff : cu < 0.45 ? AMBER : EMBER;
        b.crater.alpha = 0.8 * glow;
        for (const [i, e] of EMBERS.entries()) {
          if (still && i > 10) break;
          const flick = 0.5 + 0.5 * Math.sin(e.fq * (still ? 0 : t) + e.ph);
          const d = Rs * e.d * (1 + 0.3 * cu);
          pm.dot(Sx + Math.cos(e.a) * d, Sy + Math.sin(e.a) * d, Math.max(2, Rs * 0.05), cu < 0.4 ? AMBER : EMBER, glow * (0.4 + 0.6 * flick));
        }
        lines.poly(hexCorners(Sx, Sy, Rs).flat()).stroke({ width: Math.max(2, Rs * 0.05), color: EMBER, alpha: 0.45 * glow });
      }
      // Smoke rising off it, leaning a little as it goes.
      b.smoke.forEach((sp, i) => {
        const p = SMOKE[i]!;
        const a2 = still ? 0.5 + i * 0.06 : t - p.born;
        if ((still && i > 5) || a2 < 0 || a2 > p.life) {
          sp.visible = false;
          return;
        }
        const u = a2 / p.life;
        sp.visible = true;
        sp.position.set(Sx + Rs * (p.x + p.lean * a2 * a2), Sy - Rs * (0.2 + p.v * a2));
        sp.width = sp.height = Rs * p.size * (0.6 + 1.3 * u);
        sp.alpha = 0.6 * Math.sin(Math.PI * u) * fade;
      });
      pm.end();
    },
  });
}
