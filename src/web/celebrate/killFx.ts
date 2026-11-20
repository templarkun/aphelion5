/**
 * Alpha Down, a kill for Alpha (designer 2026-11-20; plan agreed that day), drawn on the Field (PixiJS)
 * in the close-up every kill shares (closeup.ts):
 *
 * 1. Slow-down (0-0.8 s): the Field zooms in on the unit and the rest darkens; the hit's sparks hang
 *    almost still; targeting brackets close in on the tile and lock.
 * 2. Break (0.8-2.2 s): violet light through cracks in the tile, the glyph flares and collapses into
 *    a bright core, then bursts into shards, a violet shock ring and sparks, with a small shake.
 * 3. Confirmed (2.2-3.6 s): the Wreck stays on the Field (4.8), smoking; a label beside it counts up
 *    from "ALPHA DOWN · 5 / 6" to "6 / 6".
 * 4. Back (3.6-4.5 s): the zoom eases back to the whole Field and the game goes on.
 *
 * Screen only: nothing here is a rule.
 */

import { Graphics, Sprite } from "pixi.js";
import type { Step } from "../anim.js";
import { easeOut } from "../anim.js";
import { playOmegaBreak, playTargetLock } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, closeupStep, flat, glowSprite, hexCorners, motes, puff, seq } from "./closeup.js";
import { fractureLight } from "./cracksFx.js";
import { KILL, span } from "./timeline.js";

export type { KillEnv, KillTarget } from "./closeup.js";

const VIOLET = 0x9b6bd6;
const LILAC = 0xc9a6ff;
const PALE = 0xf3e8ff;
const HOT = 0xff5a36;
const PUFFS = 12;

/** Shards: each sixth of the hex cut in two (tile radii; a point inside each, the direction it flies). */
const SHARDS = (() => {
  const rnd = seq(4421);
  const v = hexCorners(0, 0, 1);
  const out: { tri: [number, number][]; dir: number; speed: number; spin: number; shade: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const a = v[i]!;
    const b = v[(i + 1) % 6]!;
    const m: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const c: [number, number] = [(rnd() - 0.5) * 0.15, (rnd() - 0.5) * 0.15];
    for (const tri of [
      [c, a, m],
      [c, m, b],
    ] as [number, number][][]) {
      const gx = (tri[0]![0] + tri[1]![0] + tri[2]![0]) / 3;
      const gy = (tri[0]![1] + tri[1]![1] + tri[2]![1]) / 3;
      out.push({ tri: tri.map(([x, y]) => [x - gx, y - gy] as [number, number]).concat([[gx, gy]]), dir: Math.atan2(gy, gx), speed: 0.75 + rnd() * 0.6, spin: (rnd() - 0.5) * 7, shade: rnd() });
    }
  }
  return out;
})();

const SPARKS = (() => {
  const rnd = seq(771);
  return Array.from({ length: 30 }, () => ({ a: rnd() * Math.PI * 2, far: 1.7 + rnd() * 2.4, len: 0.12 + rnd() * 0.22, hue: rnd() }));
})();
const HANG = (() => {
  const rnd = seq(2603);
  return Array.from({ length: 16 }, () => ({ a: rnd() * Math.PI * 2, r: 1.0 + rnd() * 0.65, len: 0.07 + rnd() * 0.1, far: 2.2 + rnd() * 1.6 }));
})();

/** Alpha Down as a Field step (and its still picture for reduced motion and Instant). */
export function alphaDownStep(env: KillEnv, k: KillTarget): Step {
  return closeupStep(env, k, {
    times: { total: KILL.total, zoomIn: KILL.zoomIn, back: KILL.back, breakAt: KILL.burst, wreckIn: KILL.wreckIn, label: KILL.label, count: KILL.count, stillAt: KILL.count + 0.5 },
    title: `${k.name.toUpperCase()} DOWN`,
    accent: VIOLET,
    ink: PALE,
    inkLine: 0x2a1450,
    build: (back, front) => {
      const smoke = Array.from({ length: PUFFS }, () => {
        const p = new Sprite({ texture: puff(), anchor: 0.5 });
        p.tint = 0x4a4458;
        p.visible = false;
        back.addChild(p);
        return p;
      });
      const under = new Graphics();
      const light = new Graphics();
      light.blendMode = "add";
      back.addChild(under, light);
      const pm = motes(back, 300);
      // Soft glows: the core and the bloom of the burst (violet), the flash (white).
      const bloom = glowSprite(back, LILAC);
      const flash = glowSprite(back, 0xffffff);
      const tex = env.badge(k.unitId);
      const glyph = tex ? new Sprite({ texture: tex, anchor: 0.5 }) : undefined;
      const glow = tex ? new Sprite({ texture: tex, anchor: 0.5 }) : undefined;
      if (glow) glow.blendMode = "add";
      if (glyph) back.addChild(glyph);
      if (glow) back.addChild(glow);
      const over = new Graphics();
      front.addChild(over);
      return { smoke, under, light, pm, bloom, flash, glyph, glow, over };
    },
    shake: (t, Rs) => {
      const us = span(t, [KILL.burst, KILL.burst + 0.38]);
      const amp = us > 0 && us < 1 ? Rs * 0.07 * (1 - us) ** 2 : 0;
      return [amp * Math.sin(us * 55), amp * Math.cos(us * 47)];
    },
    tile: (t) => ({ scale: 1 - 0.85 * span(t, KILL.collapse) ** 2, alpha: 1 - 0.4 * span(t, KILL.collapse) }),
    sounds: (crossed) => {
      if (crossed(KILL.lock)) playTargetLock();
      if (crossed(KILL.burst)) playOmegaBreak();
    },
    draw: (f, b) => {
      const { t, still, fade, Sx, Sy, Rs, broke } = f;
      const under = b.under.clear();
      const light = b.light.clear();
      const over = b.over.clear();
      const burst = still ? 1 : span(t, [KILL.burst, KILL.burst + 0.9]);
      const cs = still ? 1 : t < KILL.burst ? 1 - 0.85 * span(t, KILL.collapse) ** 2 : 1;

      // Act 1: the hit's sparks hang almost still round the tile; at the burst they fly out.
      if (!still) {
        const show = span(t, [0, 0.25]);
        for (const s of HANG) {
          const out = broke ? easeOut(burst) : 0;
          const r = Rs * (s.r + 0.05 * Math.min(t, KILL.burst) + (s.far - s.r) * out);
          const a0 = show * (broke ? 1 - burst : 1);
          if (a0 <= 0.01) continue;
          const x = Sx + Math.cos(s.a) * r;
          const y = Sy + Math.sin(s.a) * r;
          const len = Rs * s.len * (broke ? 1 + 2 * (1 - burst) : 1);
          const x2 = x + Math.cos(s.a) * len;
          const y2 = y + Math.sin(s.a) * len;
          light.moveTo(x, y).lineTo(x2, y2).stroke({ width: 6, color: 0xff9a4a, alpha: 0.35 * a0 });
          light.moveTo(x, y).lineTo(x2, y2).stroke({ width: 2, color: 0xfff1c4, alpha: 0.95 * a0 });
        }
      }

      // Brackets close in and lock.
      if (!still && t < KILL.burst + 0.3) {
        const bi = easeOut(span(t, KILL.bracketsIn));
        const out = broke ? span(t, [KILL.burst, KILL.burst + 0.3]) : 0;
        const rb = Rs * (2.0 - 0.88 * bi + 1.2 * out);
        const al = span(t, [KILL.bracketsIn[0], KILL.bracketsIn[0] + 0.15]) * (1 - out);
        const flash = t >= KILL.lock ? Math.max(0, 1 - (t - KILL.lock) / 0.25) : 0;
        const arm = Rs * 0.32;
        for (const [sx, sy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ] as const) {
          const x = Sx + sx * rb * 0.82;
          const y = Sy + sy * rb * 0.82;
          over.moveTo(x - sx * arm, y).lineTo(x, y).lineTo(x, y - sy * arm).stroke({ width: 3, color: flash > 0 ? 0xffffff : HOT, alpha: al });
          light.moveTo(x - sx * arm, y).lineTo(x, y).lineTo(x, y - sy * arm).stroke({ width: 9, color: HOT, alpha: 0.25 * al + 0.4 * flash });
        }
        if (flash > 0) light.circle(Sx, Sy, Rs * (1.2 + 0.3 * (1 - flash))).stroke({ width: 2 + 3 * flash, color: 0xffb08a, alpha: 0.8 * flash });
      }

      // Act 2: violet light through fractures (cracksFx.ts), motes leaking out of them.
      b.pm.begin();
      if (!still && !broke) {
        const glowIn = span(t, [0.9, 1.45]);
        if (glowIn > 0) light.poly(flat(hexCorners(Sx, Sy, Rs * cs))).fill({ color: VIOLET, alpha: 0.22 * glowIn });
        fractureLight({ under, light, motes: b.pm, grow: span(t, KILL.cracks), t, x: Sx, y: Sy, r: Rs * cs, boost: span(t, KILL.flare) });
        // The core it collapses into.
        const core = span(t, [KILL.flare[0] + 0.1, KILL.burst]);
        if (core > 0) light.circle(Sx, Sy, Rs * (0.03 + 0.16 * core * core)).fill({ color: 0xffffff, alpha: 0.6 + 0.4 * core });
      }
      b.pm.end();
      // Soft light: the core's glow growing as the tile collapses, the burst's bloom and flash.
      {
        const core = !still && !broke ? span(t, [KILL.flare[0] + 0.1, KILL.burst]) : 0;
        const fb = !still && broke ? span(t, [KILL.burst, KILL.burst + 0.55]) : 1;
        const fl = !still && broke ? span(t, [KILL.burst, KILL.burst + 0.25]) : 1;
        b.bloom.visible = core > 0 || fb < 1;
        b.bloom.position.set(Sx, Sy);
        b.bloom.width = b.bloom.height = Rs * (core > 0 ? 0.8 + 1.4 * core : 2.2 + 2.6 * easeOut(fb));
        b.bloom.alpha = core > 0 ? 0.9 * core : 0.95 * (1 - fb);
        b.flash.visible = fl < 1;
        b.flash.position.set(Sx, Sy);
        b.flash.width = b.flash.height = Rs * (0.9 + 2.4 * easeOut(fl));
        b.flash.alpha = (1 - fl) ** 1.5;
      }

      // The glyph flares out of the tile, then collapses with it.
      if (b.glyph && b.glow) {
        const on = !still && !broke ? span(t, [KILL.flare[0], KILL.flare[0] + 0.12]) : 0;
        const grow = easeOut(span(t, KILL.flare));
        const shrink = span(t, KILL.collapse);
        const sc = (0.55 + 0.6 * grow) * (1 - 0.95 * shrink * shrink);
        const H = Rs * 1.15 * sc;
        for (const sp of [b.glyph, b.glow]) {
          sp.visible = on > 0;
          sp.position.set(Sx, Sy);
          sp.height = H;
          sp.width = H * (sp.texture.width / Math.max(1, sp.texture.height));
        }
        b.glyph.alpha = on;
        b.glow.alpha = on * (0.35 + 0.65 * shrink);
      }

      // The burst: flash, shards, two shock rings, sparks.
      if (!still && broke && burst < 1) {
        const r1 = span(t, [KILL.burst, KILL.burst + 0.7]);
        if (r1 < 1) light.circle(Sx, Sy, Rs * (0.5 + 3.4 * easeOut(r1))).stroke({ width: Math.max(1, Rs * 0.14 * (1 - r1)), color: LILAC, alpha: 0.9 * (1 - r1) });
        const r2 = span(t, [KILL.burst + 0.08, KILL.burst + 0.68]);
        if (r2 > 0 && r2 < 1) light.circle(Sx, Sy, Rs * (0.4 + 2.7 * easeOut(r2))).stroke({ width: Math.max(1, Rs * 0.05 * (1 - r2)), color: 0xffffff, alpha: 0.8 * (1 - r2) });
        const sh = span(t, [KILL.burst, KILL.burst + 0.85]);
        for (const s of SHARDS) {
          const d = Rs * (0.15 + 2.6 * s.speed * easeOut(sh));
          const ang = s.spin * sh;
          const cx = Sx + s.tri[3]![0] * Rs + Math.cos(s.dir) * d;
          const cy = Sy + s.tri[3]![1] * Rs + Math.sin(s.dir) * d + Rs * 0.6 * sh * sh;
          const k2 = Rs * 0.42;
          const pts = s.tri.slice(0, 3).map(([x, y]) => [cx + (x * Math.cos(ang) - y * Math.sin(ang)) * k2, cy + (x * Math.sin(ang) + y * Math.cos(ang)) * k2] as [number, number]);
          const a = 1 - sh ** 1.5;
          under.poly(flat(pts)).fill({ color: s.shade > 0.5 ? 0x7d52c4 : 0x5a3596, alpha: a }).stroke({ width: 1.2, color: LILAC, alpha: 0.85 * a });
        }
        const sp = span(t, [KILL.burst, KILL.burst + 0.75]);
        for (const s of SPARKS) {
          const r0 = Rs * (0.25 + (s.far - 0.25) * easeOut(sp));
          const len = Rs * s.len * (1 - sp);
          const col = s.hue < 0.4 ? 0xffffff : s.hue < 0.75 ? LILAC : 0xffc27a;
          light.moveTo(Sx + Math.cos(s.a) * r0, Sy + Math.sin(s.a) * r0).lineTo(Sx + Math.cos(s.a) * (r0 + len), Sy + Math.sin(s.a) * (r0 + len)).stroke({ width: 2.2, color: col, alpha: 1 - sp });
        }
      }

      // Act 3: smoke and embers rise from the Wreck.
      b.smoke.forEach((sp, j) => {
        const born = KILL.burst + 0.25 + j * 0.2;
        const age = still ? 0.3 + (j % 4) * 0.35 : t - born;
        if (!broke || age < 0 || age > 1.7 || (still && j > 3)) return void (sp.visible = false);
        const u = age / 1.7;
        const x = Sx + Rs * (Math.sin(j * 1.7 + age * 1.3) * 0.25 + ((j % 3) - 1) * 0.12);
        const y = Sy - Rs * (0.1 + 1.4 * u);
        sp.visible = true;
        sp.position.set(x, y);
        sp.width = sp.height = Rs * (0.45 + 0.9 * u);
        sp.alpha = 0.7 * Math.sin(Math.PI * Math.min(1, u * 1.4 + 0.08)) * fade * (still ? 1 : 1 - span(t, [KILL.back[0] + 0.3, KILL.back[1]]));
        if (j % 2 === 0) light.circle(x + Rs * 0.1, y + Rs * 0.05, Math.max(1.2, Rs * 0.022)).fill({ color: j % 4 === 0 ? 0xffa45c : LILAC, alpha: 0.9 * (1 - u) * sp.alpha });
      });
    },
  });
}
