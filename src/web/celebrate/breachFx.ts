/**
 * Beta Breach, the kill for Beta (designer 2026-11-20: more spectacular than Alpha's), drawn on the
 * Field (PixiJS) in the close-up every kill shares (closeup.ts). About 6.2 s:
 *
 * 1. Lock (0-1.0 s): the Field zooms in, less than for an Alpha so the sectors round it stay in view; a
 *    turning reticle of two rings and four chevrons closes in and locks with a flash (playTargetLock).
 * 2. Surge (1.0-2.9 s): the Beta fights the lock: three surges (playBetaSurge), each a beat of the tile,
 *    arcs of light lashing out at the sectors round it and a harder shake; hot cracks spread over it,
 *    three small blasts break out on its edge; then its core sucks the light in.
 * 3. Breach (2.9-3.9 s): white-out; a fireball; two shock fronts race off the screen; big shards fly,
 *    some at the camera; the units round it are knocked back and spring home; a heavy shake; embers
 *    rain (playBetaDetonation). A Beta leaves no Wreck: the sector is left scorched and smoking, and
 *    what lies beneath shows again.
 * 4. Confirmed (3.9-5.3 s): a bigger label: "BETA DOWN · 2 / 3" to "3 / 3".
 * 5. Back (5.3-6.2 s): the zoom eases back.
 *
 * Screen only: nothing here is a rule.
 */

import { Graphics, Sprite } from "pixi.js";
import type { Step } from "../anim.js";
import { easeOut } from "../anim.js";
import { playBetaDetonation, playBetaSurge, playTargetLock } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, around, bolt, closeupStep, flat, glowSprite, hexCorners, motes, puff, seq, strokePath } from "./closeup.js";
import { moltenFissures } from "./cracksFx.js";
import { BREACH, span } from "./timeline.js";

const RED = 0xff4a2a;
const ORANGE = 0xff8a2a;
const GOLD = 0xffc46a;
const CREAM = 0xfff0d8;
const VIOLET = 0x9b6bd6;
const LILAC = 0xc9a6ff;
const D = BREACH.detonate;

/** Where the three small blasts break out on its edge (angle, tile radii). */
const BLASTS = [
  [0.6, 0.72],
  [2.75, 0.68],
  [4.55, 0.75],
] as const;

/** Big shards: a jagged four-sided piece each; some fly at the camera (they grow as they go). */
const SHARDS = (() => {
  const rnd = seq(3307);
  return Array.from({ length: 26 }, (_, i) => {
    const pts: [number, number][] = Array.from({ length: 4 }, (_, j) => {
      const a = (j / 4) * Math.PI * 2 + rnd() * 0.9;
      const r = 0.45 + rnd() * 0.55;
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
    return { pts, dir: rnd() * Math.PI * 2, speed: 2.2 + rnd() * 3.2, spin: (rnd() - 0.5) * 9, size: 0.22 + rnd() * 0.3, cam: i % 4 === 0, shade: rnd() };
  });
})();
const SPARKS = (() => {
  const rnd = seq(9071);
  return Array.from({ length: 56 }, () => ({ a: rnd() * Math.PI * 2, far: 2.4 + rnd() * 4.2, len: 0.15 + rnd() * 0.35, hue: rnd(), late: rnd() * 0.12 }));
})();
const EMBERS = (() => {
  const rnd = seq(4417);
  return Array.from({ length: 44 }, () => ({ vx: (rnd() - 0.5) * 6, vy: -(2.2 + rnd() * 4.2), life: 1.4 + rnd() * 1.4, size: 0.02 + rnd() * 0.03, flick: rnd() * 6 }));
})();
const INFALL = (() => {
  const rnd = seq(2213);
  return Array.from({ length: 42 }, () => ({ a: rnd() * Math.PI * 2, from: 2.2 + rnd() * 1.6, late: rnd() * 0.18, len: 0.25 + rnd() * 0.4, white: rnd() < 0.5 }));
})();
const SMOKE = 10;

/** The surge under way at t: which one (0-2) and how far through (0-1), or undefined. */
function surgeAt(t: number): { i: number; u: number } | undefined {
  for (let i = BREACH.surges.length - 1; i >= 0; i--) {
    const u = (t - BREACH.surges[i]!) / 0.34;
    if (u >= 0 && u < 1) return { i, u };
  }
  return undefined;
}
/** The tile's size: a beat at each surge, a little smaller as the core sucks in. */
function tileScale(t: number): number {
  const s = surgeAt(t);
  const beat = s ? 0.1 * Math.sin(Math.PI * Math.min(1, s.u * 2.2)) * (1 + 0.3 * s.i) : 0;
  return (1 + beat) * (1 - 0.18 * span(t, BREACH.implode) ** 2);
}

/** Beta Breach as a Field step (and its still picture for reduced motion and Instant). */
export function betaBreachStep(env: KillEnv, k: KillTarget): Step {
  const ring = around(k.sector);
  return closeupStep(env, k, {
    times: { total: BREACH.total, zoomIn: BREACH.zoomIn, back: BREACH.back, breakAt: D, wreckIn: BREACH.wreckIn, label: BREACH.label, count: BREACH.count, stillAt: BREACH.count + 0.4 },
    size: 0.15,
    hole: 2.4,
    title: `${k.name.toUpperCase()} DOWN`,
    accent: ORANGE,
    ink: CREAM,
    inkLine: 0x4a1800,
    labelScale: 1.2,
    build: (back, front) => {
      const smoke = Array.from({ length: SMOKE }, () => {
        const p = new Sprite({ texture: puff(), anchor: 0.5 });
        p.tint = 0x2c2530;
        p.visible = false;
        back.addChild(p);
        return p;
      });
      const under = new Graphics();
      const light = new Graphics();
      light.blendMode = "add";
      back.addChild(under, light);
      const pm = motes(back, 320);
      const surge = glowSprite(back, VIOLET);
      const tex = env.badge(k.unitId);
      const glyph = tex ? new Sprite({ texture: tex, anchor: 0.5 }) : undefined;
      if (glyph) {
        glyph.blendMode = "add";
        glyph.visible = false;
        back.addChild(glyph);
      }
      // The fireball: a violet rim, an orange body, a white core.
      const rim = glowSprite(front, VIOLET);
      const body = glowSprite(front, ORANGE);
      const core = glowSprite(front, 0xffffff);
      const blasts = BLASTS.map(() => glowSprite(front, GOLD));
      const shards = new Graphics();
      const top = new Graphics();
      top.blendMode = "add";
      const white = new Graphics();
      white.blendMode = "add";
      front.addChild(shards, top, white);
      return { smoke, under, light, pm, surge, glyph, rim, body, core, blasts, shards, top, white };
    },
    shake: (t, Rs) => {
      let x = 0;
      let y = 0;
      const s = surgeAt(t);
      if (s) {
        const a = Rs * (0.025 + 0.02 * s.i) * (1 - s.u) ** 2;
        x += a * Math.sin(s.u * 60);
        y += a * Math.cos(s.u * 47);
      }
      for (const at of BREACH.blasts) {
        const u = span(t, [at, at + 0.2]);
        if (u > 0 && u < 1) {
          x += Rs * 0.03 * (1 - u) * Math.sin(u * 50);
          y += Rs * 0.03 * (1 - u) * Math.cos(u * 41);
        }
      }
      const u = span(t, [D, D + 0.85]);
      if (u > 0 && u < 1) {
        const a = Rs * 0.17 * (1 - u) ** 2;
        x += a * Math.sin(u * 70);
        y += a * Math.cos(u * 61);
      }
      return [x, y];
    },
    dark: (t) => {
      const s = surgeAt(t);
      const flick = s ? 0.35 * (1 - s.u) : 0;
      const deep = 0.15 * span(t, BREACH.implode);
      const out = t >= D ? 1 - span(t, [D, D + 0.12]) * (1 - span(t, [D + 0.3, D + 1.0])) : 0;
      return Math.min(1.15, 1 - flick + deep) * (1 - out);
    },
    tile: (t) => ({ scale: tileScale(t), alpha: 1 }),
    sounds: (crossed) => {
      if (crossed(BREACH.lock)) playTargetLock();
      BREACH.surges.forEach((at, i) => crossed(at) && playBetaSurge(i));
      if (crossed(D)) playBetaDetonation();
    },
    draw: (f, b) => {
      const { t, still, fade, Sx, Sy, Rs, R, broke, w, h, look } = f;
      const under = b.under.clear();
      const light = b.light.clear();
      const shards = b.shards.clear();
      const top = b.top.clear();
      const white = b.white.clear();
      const ts = still ? 1 : tileScale(t);

      // Act 1: the reticle closes in, turning, and locks; it holds until the breach blows it away.
      if (!still && t < D + 0.3) {
        const u = easeOut(span(t, BREACH.reticle));
        const gone = span(t, [D, D + 0.3]);
        const rr = Rs * (3.1 - 1.3 * u + 3 * gone * gone);
        const al = Math.min(1, span(t, [BREACH.reticle[0], BREACH.reticle[0] + 0.2])) * (t >= BREACH.lock ? 0.75 : 1) * (1 - gone);
        const lockF = t >= BREACH.lock ? Math.max(0, 1 - (t - BREACH.lock) / 0.3) : 0;
        const col = lockF > 0 ? 0xffffff : RED;
        const a1 = t * 0.9;
        for (let i = 0; i < 24; i++) {
          const a = a1 + (i / 24) * Math.PI * 2;
          light.arc(Sx, Sy, rr, a, a + 0.14).stroke({ width: 7, color: RED, alpha: 0.2 * al });
          top.arc(Sx, Sy, rr, a, a + 0.14).stroke({ width: 2, color: col, alpha: al });
        }
        const a2 = -t * 1.6;
        for (let i = 0; i < 12; i++) {
          const a = a2 + (i / 12) * Math.PI * 2;
          top.arc(Sx, Sy, rr * 0.8, a, a + 0.32).stroke({ width: 3, color: lockF > 0 ? 0xffffff : ORANGE, alpha: 0.8 * al });
        }
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
          const r0 = rr * 1.1 + Rs * 0.06 * Math.sin(t * 9);
          const cx = Sx + Math.cos(a) * r0;
          const cy = Sy + Math.sin(a) * r0;
          const s = Rs * 0.16;
          const px = -Math.sin(a);
          const py = Math.cos(a);
          top.poly([cx - Math.cos(a) * s, cy - Math.sin(a) * s, cx + px * s * 0.8, cy + py * s * 0.8, cx - px * s * 0.8, cy - py * s * 0.8]).fill({ color: col, alpha: al });
        }
        if (lockF > 0) {
          light.circle(Sx, Sy, rr * (0.8 + 0.25 * (1 - lockF))).stroke({ width: 3 + 6 * lockF, color: 0xffd0b0, alpha: 0.85 * lockF });
          light.circle(Sx, Sy, Rs * 1.1).fill({ color: RED, alpha: 0.25 * lockF });
        }
      }

      // Act 2: surges: a violet throb, arcs lashing out at the sectors round it, the units there shivering.
      const s = still || broke ? undefined : surgeAt(t);
      b.surge.visible = !!s;
      if (s) {
        b.surge.position.set(Sx, Sy);
        b.surge.width = b.surge.height = Rs * (2 + 2.2 * easeOut(s.u) + 0.6 * s.i);
        b.surge.alpha = 0.9 * (1 - s.u);
        const tick = Math.floor(t / 0.05);
        for (let j = 0; j < 3 + s.i; j++) {
          const n = ring[(j * 2 + s.i) % ring.length]!;
          const reach = Rs * (1.55 + 0.35 * ((j + s.i) % 3));
          const pts = bolt(Sx + n.dx * Rs * 0.5, Sy + n.dy * Rs * 0.5, Sx + n.dx * reach, Sy + n.dy * reach, tick * 29 + j * 5 + s.i, 0.28, 7);
          const a = (1 - s.u) ** 0.7;
          strokePath(light, pts, Math.max(6, Rs * 0.1), s.i === 2 ? RED : VIOLET, 0.4 * a);
          strokePath(light, pts, 2, s.i === 2 ? CREAM : LILAC, a);
          const end = pts[pts.length - 1]!;
          light.circle(end[0], end[1], Rs * 0.09 * a).fill({ color: 0xffffff, alpha: a });
        }
        for (const n of ring) {
          const L = look(n.key);
          const A = R * 0.04 * (1 + s.i * 0.5) * (1 - s.u);
          L.dx += A * Math.sin(s.u * 70 + n.dx * 3);
          L.dy += A * 0.6 * Math.sin(s.u * 53 + n.dy * 3);
        }
      }
      // Molten fissures spread over it (cracksFx.ts), spitting embers; its hex glows; three small blasts break out on its edge.
      b.pm.begin();
      if (!still && !broke) {
        const heat = span(t, [BREACH.cracks[0], D]);
        if (heat > 0) light.poly(flat(hexCorners(Sx, Sy, Rs * ts))).fill({ color: heat > 0.7 ? GOLD : ORANGE, alpha: 0.08 + 0.3 * heat * heat });
        const sg = surgeAt(t);
        moltenFissures({ under, light, motes: b.pm, grow: span(t, BREACH.cracks), t, x: Sx, y: Sy, r: Rs * ts, heat, boost: sg ? 1 - sg.u : 0 });
        if (b.glyph) {
          const on = span(t, [BREACH.implode[0] - 0.2, BREACH.implode[1]]);
          b.glyph.visible = on > 0;
          b.glyph.position.set(Sx, Sy);
          const H = Rs * 1.1 * ts;
          b.glyph.height = H;
          b.glyph.width = H * (b.glyph.texture.width / Math.max(1, b.glyph.texture.height));
          b.glyph.alpha = on;
        }
      } else if (b.glyph) b.glyph.visible = false;
      b.pm.end();
      BREACH.blasts.forEach((at, i) => {
        const u = still ? 1 : span(t, [at, at + 0.3]);
        const sp = b.blasts[i]!;
        sp.visible = u > 0 && u < 1;
        if (!sp.visible) return;
        const [ang, r] = BLASTS[i]!;
        const x = Sx + Math.cos(ang) * Rs * r;
        const y = Sy + Math.sin(ang) * Rs * r;
        sp.position.set(x, y);
        sp.width = sp.height = Rs * (0.5 + 1.1 * easeOut(u));
        sp.alpha = (1 - u) ** 1.3;
        for (let j = 0; j < 9; j++) {
          const a = ang + (j - 4) * 0.32;
          const r0 = Rs * (0.1 + 1.1 * easeOut(u));
          light.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0).lineTo(x + Math.cos(a) * (r0 + Rs * 0.18 * (1 - u)), y + Math.sin(a) * (r0 + Rs * 0.18 * (1 - u))).stroke({ width: 2, color: j % 2 ? GOLD : 0xffffff, alpha: 1 - u });
        }
      });
      // The core sucks the light in.
      if (!still && !broke) {
        const im = span(t, BREACH.implode);
        if (im > 0) {
          for (const p of INFALL) {
            const u = Math.max(0, Math.min(1, (im - p.late) / (1 - p.late)));
            if (u <= 0 || u >= 1) continue;
            const r0 = Rs * p.from * (1 - u * u);
            const r1 = r0 + Rs * p.len * (1 - u);
            light.moveTo(Sx + Math.cos(p.a) * r0, Sy + Math.sin(p.a) * r0).lineTo(Sx + Math.cos(p.a) * r1, Sy + Math.sin(p.a) * r1).stroke({ width: 2, color: p.white ? 0xffffff : LILAC, alpha: Math.sin(Math.PI * u) });
          }
          light.circle(Sx, Sy, Rs * (0.06 + 0.2 * im * im)).fill({ color: 0xffffff, alpha: 0.5 + 0.5 * im });
        }
      }

      // Act 3: the breach.
      const age = t - D;
      const live = !still && broke;
      // White-out over the whole Field.
      if (live && age < 0.5) white.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.95 * (1 - age / 0.5) ** 2 });
      // The fireball: white core, orange body, violet rim; then it darkens into smoke.
      const fb = (sp: Sprite, from: number, to: number, len: number, a: number) => {
        const u = live ? span(t, [D, D + len]) : 1;
        sp.visible = u < 1;
        if (!sp.visible) return;
        sp.position.set(Sx, Sy - Rs * 0.4 * u);
        sp.width = sp.height = Rs * (from + (to - from) * easeOut(u));
        sp.alpha = a * (1 - u) ** 1.2;
      };
      fb(b.core, 0.8, 3, 0.45, 1);
      fb(b.body, 1.4, 5.2, 1.1, 0.95);
      fb(b.rim, 2, 6.5, 1.3, 0.8);
      // Two shock fronts that race off the screen (they never slow down on it).
      if (live) {
        const far = Math.hypot(Math.max(Sx, w - Sx), Math.max(Sy, h - Sy)) + 40;
        for (const [late, wd, col] of [
          [0, 0.2, ORANGE],
          [0.1, 0.07, 0xffffff],
        ] as const) {
          const u = (age - late) / 0.6;
          if (u < 0 || u > 1) continue;
          const r = Rs * 0.6 + (far - Rs * 0.6) * u;
          top.circle(Sx, Sy, r).stroke({ width: Math.max(1.5, Rs * wd * (1 - u * 0.6)), color: col, alpha: 0.85 * (1 - u) });
        }
      }
      // The units round it are knocked back and spring home.
      if (live && age < 1.4) {
        for (const n of ring) {
          const a = Math.max(0, age - 0.04);
          const push = R * 0.32 * Math.exp(-a * 4.2) * Math.sin(a * 16);
          const L = look(n.key);
          L.dx += n.dx * push;
          L.dy += n.dy * push;
          L.scale *= 1 - 0.06 * Math.exp(-a * 5);
        }
      }
      // Shards: some fly out over the Field, some at the camera.
      if (live && age < 1.1) {
        const u = age / 1.1;
        for (const sd of SHARDS) {
          const d = Rs * (0.2 + sd.speed * easeOut(u));
          const grow = sd.cam ? 1 + 4 * u * u : 1;
          const cx = Sx + Math.cos(sd.dir) * d;
          const cy = Sy + Math.sin(sd.dir) * d + (sd.cam ? 0 : Rs * 0.9 * u * u);
          const ang = sd.spin * u;
          const k2 = Rs * sd.size * grow;
          const pts = sd.pts.map(([x, y]) => [cx + (x * Math.cos(ang) - y * Math.sin(ang)) * k2, cy + (x * Math.sin(ang) + y * Math.cos(ang)) * k2] as [number, number]);
          const a = (1 - u) ** (sd.cam ? 2.2 : 1.2);
          shards.poly(flat(pts)).fill({ color: sd.shade > 0.5 ? 0x4a2a6a : 0x2e1a40, alpha: a }).stroke({ width: sd.cam ? 2.5 : 1.4, color: sd.shade > 0.3 ? ORANGE : GOLD, alpha: a });
        }
        for (const sp of SPARKS) {
          const v = Math.max(0, Math.min(1, (age - sp.late) / 0.8));
          if (v <= 0 || v >= 1) continue;
          const r0 = Rs * (0.3 + (sp.far - 0.3) * easeOut(v));
          const len = Rs * sp.len * (1 - v);
          const col = sp.hue < 0.35 ? 0xffffff : sp.hue < 0.7 ? GOLD : LILAC;
          top.moveTo(Sx + Math.cos(sp.a) * r0, Sy + Math.sin(sp.a) * r0).lineTo(Sx + Math.cos(sp.a) * (r0 + len), Sy + Math.sin(sp.a) * (r0 + len)).stroke({ width: 2.4, color: col, alpha: 1 - v });
        }
      }

      // The scorched sector: dark, its edge glowing and cooling; embers on it; smoke rising.
      const cool = still ? 0.35 : span(t, [D + 0.2, BREACH.back[0] + 0.3]);
      const sc = still ? fade : broke ? Math.min(1, age / 0.3) * (1 - span(t, [BREACH.back[0], BREACH.back[1] - 0.2])) : 0;
      if (sc > 0.01) {
        under.poly(flat(hexCorners(Sx, Sy, Rs))).fill({ color: 0x140806, alpha: 0.55 * sc * (1 - 0.6 * cool) });
        under.poly(flat(hexCorners(Sx, Sy, Rs))).stroke({ width: Math.max(5, Rs * 0.14), color: ORANGE, alpha: 0.4 * sc * (1 - cool) });
        light.poly(flat(hexCorners(Sx, Sy, Rs * 0.98))).stroke({ width: 1.8, color: GOLD, alpha: 0.9 * sc * (1 - 0.7 * cool) });
        for (let j = 0; j < 9; j++) {
          const rnd = seq(j * 71 + 3);
          const x = Sx + (rnd() - 0.5) * Rs * 1.3;
          const y = Sy + (rnd() - 0.5) * Rs * 1.1;
          const fl = 0.6 + 0.4 * Math.sin(t * 9 + j * 2.1);
          light.circle(x, y, Math.max(1.4, Rs * 0.03)).fill({ color: j % 3 ? ORANGE : GOLD, alpha: fl * sc * (1 - 0.8 * cool) });
        }
      }
      // Embers thrown up and falling back.
      if (live || still) {
        for (const [i, e] of EMBERS.entries()) {
          const a = still ? 0.4 + (i % 6) * 0.15 : age;
          if ((still && i > 14) || a < 0 || a > e.life) continue;
          const u = a / e.life;
          const x = Sx + e.vx * Rs * a * 0.6;
          const y = Sy + e.vy * Rs * a * 0.6 + 2.2 * Rs * a * a;
          const al = (1 - u) * (0.6 + 0.4 * Math.sin(a * 14 + e.flick)) * fade;
          light.circle(x, y, Math.max(1.3, Rs * e.size)).fill({ color: i % 3 ? ORANGE : GOLD, alpha: al });
        }
      }
      b.smoke.forEach((sp, j) => {
        const born = D + 0.35 + j * 0.2;
        const a = still ? 0.4 + (j % 5) * 0.35 : t - born;
        if (!broke || a < 0 || a > 2.2 || (still && j > 4)) return void (sp.visible = false);
        const u = a / 2.2;
        sp.visible = true;
        sp.position.set(Sx + Rs * (Math.sin(j * 1.9 + a * 1.1) * 0.35 + ((j % 3) - 1) * 0.2), Sy - Rs * (0.2 + 2.2 * u));
        sp.width = sp.height = Rs * (0.8 + 1.6 * u);
        sp.alpha = 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.3 + 0.08)) * fade * (still ? 1 : 1 - span(t, [BREACH.back[0] + 0.2, BREACH.back[1]]));
      });
    },
  });
}
