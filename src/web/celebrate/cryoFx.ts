/**
 * Cryo Shatter, the third kill for Beta (designer 2026-11-27: "Make 2 animations for Beta unit
 * elimination ... more spectacular than Alpha"), drawn on the Field (PixiJS) in the close-up every kill
 * shares (closeup.ts). About 6.6 s, longer and wider than any Alpha kill; cold where Beta Breach is fire.
 *
 * 1. Emitters (0-1.0 s): the zoom, wider than for an Alpha; six cryo emitters gather out of particles at
 *    the corners round the Beta, each throwing a cold beam of particles into it; lock (playTargetLock).
 * 2. Freeze (1.0-3.25 s): frost grows over the tile from its six edges inwards (branching frost lines,
 *    glinting tips), the tile turns to ice; the Beta struggles in pulses, slower and slower; frost creeps
 *    along the edges of the sectors round it; mist rolls off it (playCryoFreeze). Frozen: still; two
 *    cracks of light run across it (playIceCrack).
 * 3. Shatter (3.25-4.2 s): a cold flash; the ice bursts into shards tumbling outwards, some at the camera,
 *    and a spray of ice particles; a frost wave runs out over the Field and off the screen, leaving rims of
 *    frost on the sectors it passes; the units round it are knocked back; mist billows out; a heavy shake
 *    (playIceShatter). A Beta leaves no Wreck: the sector is left frosted, ice dust drifting down, and what
 *    lies beneath shows again.
 * 4. Confirmed (4.2-5.7 s): a bigger label: "BETA SHATTERED · 2 / 3" to "3 / 3".
 * 5. Back (5.7-6.6 s): the zoom eases back.
 *
 * Energy is drawn with particles (designer 2026-11-20). The same for every Company (I25). Screen only:
 * nothing here is a rule.
 */

import { Graphics, Sprite } from "pixi.js";
import type { Step } from "../anim.js";
import { easeInOut, easeOut } from "../anim.js";
import { playCryoFreeze, playIceCrack, playIceShatter, playTargetLock } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, around, bolt, closeupStep, flat, glowSprite, hexCorners, motes, puff, seq, strokePath } from "./closeup.js";
import { CRYO, span } from "./timeline.js";

const ICE = 0xbfe8ff;
const FROST = 0xe8f8ff;
const CYAN = 0x5fd4ff;
const DEEP = 0x2a6bb0;
const D = CRYO.shatter;
const NB = Math.sqrt(3) / 0.9;

/** Frost lines (tile radii): from a point on an edge inwards, each with branches; when each part grows. */
export const FROST_LINES = (() => {
  const r = seq(2741);
  const cs = hexCorners(0, 0, 0.96);
  const out: { pts: [number, number][]; from: number; to: number; w: number }[] = [];
  for (let e = 0; e < 6; e++) {
    const a = cs[e]!;
    const b = cs[(e + 1) % 6]!;
    for (let k = 0; k < 3; k++) {
      const f = 0.2 + 0.3 * k + (r() - 0.5) * 0.12;
      let x = a[0] + (b[0] - a[0]) * f;
      let y = a[1] + (b[1] - a[1]) * f;
      let ang = Math.atan2(-y, -x) + (r() - 0.5) * 0.6;
      const pts: [number, number][] = [[x, y]];
      const steps = 6 + Math.floor(r() * 3);
      const from = r() * 0.25;
      for (let s = 0; s < steps; s++) {
        ang += (r() - 0.5) * 0.7;
        const len = 0.07 + r() * 0.06;
        x += Math.cos(ang) * len;
        y += Math.sin(ang) * len;
        pts.push([x, y]);
        // A branch off this point now and then.
        if (r() < 0.45) {
          const side = r() < 0.5 ? -1 : 1;
          let bx = x;
          let by = y;
          let ba = ang + side * (0.7 + r() * 0.5);
          const bp: [number, number][] = [[bx, by]];
          for (let m = 0; m < 2 + Math.floor(r() * 2); m++) {
            ba += (r() - 0.5) * 0.5;
            bx += Math.cos(ba) * 0.06;
            by += Math.sin(ba) * 0.06;
            bp.push([bx, by]);
          }
          const at = from + (s / steps) * 0.6;
          out.push({ pts: bp, from: at, to: at + 0.25, w: 0.6 });
        }
      }
      out.push({ pts, from, to: from + 0.65, w: 1 });
    }
  }
  return out;
})();

/** Ice shards: jagged pieces from the tile, each flying out, slowing, tumbling; some at the camera. */
const SHARDS = (() => {
  const r = seq(8803);
  return Array.from({ length: 70 }, (_, i) => {
    const nv = 3 + (i % 2);
    const pts: [number, number][] = Array.from({ length: nv }, (_, j) => {
      const a = (j / nv) * Math.PI * 2 + r() * 0.8;
      const rr = 0.5 + r() * 0.6;
      return [Math.cos(a) * rr, Math.sin(a) * rr * (0.5 + r())];
    });
    return { pts, a: r() * 6.283, from: r() * 0.8, v: 1.5 + r() * 4.5, k: 1.5 + r() * 2, spin: (r() - 0.5) * 10, size: 0.08 + r() * 0.18, cam: i % 6 === 0, shade: r() };
  });
})();
const GLINT = (() => {
  const r = seq(3391);
  return Array.from({ length: 220 }, () => ({ a: r() * 6.283, v: 1 + r() * 6, k: 2 + r() * 3, life: 0.5 + r() * 1.1, size: 0.025 + r() * 0.05, tw: r() * 6.28 }));
})();
const DUST = (() => {
  const r = seq(661);
  return Array.from({ length: 70 }, () => ({ x: (r() - 0.5) * 5, y: (r() - 0.5) * 4, born: CRYO.dust[0] + r() * 1.2, life: 0.9 + r() * 1.0, drift: (r() - 0.5) * 0.6, size: 0.02 + r() * 0.035, tw: r() * 6.28 }));
})();
const MIST = 14;

/** How hard it struggles at time t (0 = still): pulses, each weaker and slower, frozen by the end of the freeze. */
export function struggle(t: number): number {
  const u = span(t, CRYO.freeze);
  if (u <= 0 || u >= 1) return 0;
  // The phase slows as it freezes (frequency falls from 3 to about 0.5 pulses a second).
  const ph = 2 * Math.PI * (3 * u - 1.25 * u * u) * ((CRYO.freeze[1] - CRYO.freeze[0]) / 1);
  return (1 - u) ** 1.5 * Math.max(0, Math.sin(ph));
}

/** Cryo Shatter as a Field step (and its still picture for reduced motion and Instant). */
export function betaCryoStep(env: KillEnv, k: KillTarget): Step {
  const ring = around(k.sector);
  return closeupStep(env, k, {
    times: { total: CRYO.total, zoomIn: CRYO.zoomIn, back: CRYO.back, breakAt: D, wreckIn: CRYO.wreckIn, label: CRYO.label, count: CRYO.count, stillAt: CRYO.count + 0.4 },
    size: 0.13,
    hole: 2.9,
    title: `${k.name.toUpperCase()} SHATTERED`,
    accent: CYAN,
    ink: FROST,
    inkLine: 0x0b2a4a,
    labelScale: 1.25,
    build: (back, front) => {
      const mist = Array.from({ length: MIST }, () => {
        const p = new Sprite({ texture: puff(), anchor: 0.5 });
        p.tint = 0x9fc8e8;
        p.visible = false;
        front.addChild(p);
        return p;
      });
      const under = new Graphics();
      const ice = new Graphics();
      const light = new Graphics();
      light.blendMode = "add";
      back.addChild(under, ice, light);
      const flash = glowSprite(front, FROST);
      const shards = new Graphics();
      const top = new Graphics();
      top.blendMode = "add";
      const white = new Graphics();
      white.blendMode = "add";
      front.addChild(shards, top, white);
      const nodes = Array.from({ length: 6 }, () => glowSprite(front, CYAN));
      const pm = motes(front, 1500);
      return { mist, under, ice, light, flash, shards, top, white, nodes, pm };
    },
    shake: (t, Rs) => {
      let x = 0;
      let y = 0;
      const s = struggle(t);
      x += Rs * 0.025 * s * Math.sin(t * 60);
      y += Rs * 0.02 * s * Math.cos(t * 53);
      for (const at of CRYO.cracks) {
        const a = t - at;
        if (a >= 0 && a < 0.15) x += Rs * 0.02 * (1 - a / 0.15) * Math.sin(a * 90);
      }
      const a = t - D;
      if (a >= 0 && a < 1.0) {
        const amp = Rs * 0.18 * (1 - a) ** 2;
        x += amp * Math.sin(a * 66);
        y += amp * Math.cos(a * 59);
      }
      return [x, y];
    },
    dark: (t) => {
      const hush = 0.12 * span(t, [CRYO.freeze[1], CRYO.cracks[1]]);
      const out = t >= D ? 1 - span(t, [D, D + 0.1]) * (1 - span(t, [D + 0.3, D + 0.9])) : 0;
      return Math.min(1.15, 1 + hush) * (1 - out);
    },
    tile: (t) => ({ scale: 1 + 0.035 * struggle(t), alpha: 1 }),
    sounds: (crossed) => {
      if (crossed(CRYO.lock)) playTargetLock();
      if (crossed(CRYO.freeze[0])) playCryoFreeze();
      CRYO.cracks.forEach((at, i) => crossed(at) && playIceCrack(i));
      if (crossed(D)) playIceShatter();
    },
    draw: (f, b) => {
      const { t, still, fade, Sx, Sy, Rs, R, broke, w, h, look } = f;
      const under = b.under.clear();
      const ice = b.ice.clear();
      const light = b.light.clear();
      const shards = b.shards.clear();
      const top = b.top.clear();
      const white = b.white.clear();
      const pm = b.pm;
      pm.begin();
      const nbx = (n: { dx: number; dy: number }) => Sx + n.dx * Rs * NB;
      const nby = (n: { dx: number; dy: number }) => Sy + n.dy * Rs * NB;

      // Act 1: six emitters gather out of particles at the corners round it (where three sectors meet),
      // each a turning ring of particles with a glow; cold beams of particles into the Beta.
      const eu = still ? 0 : span(t, CRYO.emitters);
      const eOut = still ? 1 : span(t, [D - 0.1, D + 0.15]);
      const lockF = !still && t >= CRYO.lock ? Math.max(0, 1 - (t - CRYO.lock) / 0.35) : 0;
      const em = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        const rr = Rs * NB * 1.16;
        return [Sx + Math.cos(a) * rr, Sy + Math.sin(a) * rr, a] as const;
      });
      b.nodes.forEach((n, i) => {
        const [x, y] = em[i]!;
        n.visible = eu > 0.3 && eOut < 1;
        if (!n.visible) return;
        n.position.set(x, y);
        n.width = n.height = Rs * (0.5 + 0.4 * lockF + 0.15 * Math.sin(t * 9 + i));
        n.alpha = (0.5 + 0.4 * lockF) * (1 - eOut);
      });
      if (eu > 0 && eOut < 1) {
        em.forEach(([x, y, a], i) => {
          // Gathering: particles spiral into the emitter's ring.
          for (let j = 0; j < 14; j++) {
            const g = Math.min(1, eu * 1.6 - j * 0.02);
            if (g <= 0) continue;
            const ang = t * 5 + (j / 14) * Math.PI * 2 + i;
            const rr = Rs * (0.22 + 1.4 * (1 - easeOut(g)));
            pm.dot(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, Math.max(2, Rs * (0.05 + 0.03 * lockF)), lockF > 0.4 || j % 3 === 0 ? 0xffffff : CYAN, g * (1 - eOut));
          }
          // The cold beam, once locked: particles streaming from the emitter into the tile.
          if (t >= CRYO.lock && t < D) {
            const beam = Math.min(1, (t - CRYO.lock) / 0.15) * (1 - span(t, [CRYO.freeze[1], CRYO.freeze[1] + 0.3]));
            if (beam > 0) {
              const tx = Sx + Math.cos(a) * Rs * 0.7;
              const ty = Sy + Math.sin(a) * Rs * 0.7;
              for (let m = 0; m < 16; m++) {
                const u = (m / 16 + t * 2.2 + i * 0.13) % 1;
                const wob = Math.sin(m * 3.1 + t * 13) * Rs * 0.05;
                const px = x + (tx - x) * u - Math.sin(a) * wob;
                const py = y + (ty - y) * u + Math.cos(a) * wob;
                pm.dot(px, py, Math.max(2, Rs * 0.055), m % 3 ? CYAN : FROST, beam * (0.5 + 0.5 * Math.sin(Math.PI * u)), 2.5, a + Math.PI);
              }
              strokePath(top, [
                [x, y],
                [tx, ty],
              ], Math.max(3, Rs * 0.08), DEEP, 0.25 * beam);
            }
          }
        });
      }

      // Act 2: the freeze. The tile turns to ice (a pale sheet growing in from the edges), frost lines grow
      // inwards with glinting tips; frost creeps along the sectors round it.
      const fz = still ? 1 : span(t, CRYO.freeze);
      if (!broke && fz > 0) {
        const cs = hexCorners(Sx, Sy, Rs * (1 + 0.035 * struggle(t)));
        ice.poly(flat(cs)).fill({ color: ICE, alpha: 0.12 + 0.68 * easeInOut(fz) });
        ice.poly(flat(hexCorners(Sx, Sy, Rs * (1 - 0.85 * easeOut(fz))))).fill({ color: DEEP, alpha: 0.12 * (1 - fz) });
        ice.poly(flat(cs)).stroke({ width: Math.max(2, Rs * 0.05), color: FROST, alpha: 0.7 * fz });
        for (const fl of FROST_LINES) {
          const u = span(fz, [fl.from, fl.to]);
          if (u <= 0) continue;
          const n = fl.pts.length;
          const upto = u * (n - 1);
          const pts: [number, number][] = [];
          for (let i = 0; i <= Math.floor(upto); i++) pts.push([Sx + fl.pts[i]![0] * Rs, Sy + fl.pts[i]![1] * Rs]);
          const fr = upto - Math.floor(upto);
          if (fr > 0 && Math.floor(upto) + 1 < n) {
            const a = fl.pts[Math.floor(upto)]!;
            const c = fl.pts[Math.floor(upto) + 1]!;
            pts.push([Sx + (a[0] + (c[0] - a[0]) * fr) * Rs, Sy + (a[1] + (c[1] - a[1]) * fr) * Rs]);
          }
          strokePath(ice, pts, Math.max(1.2, Rs * 0.025 * fl.w), FROST, 0.9);
          strokePath(light, pts, Math.max(3, Rs * 0.06 * fl.w), CYAN, 0.18);
          const tip = pts[pts.length - 1]!;
          if (u < 1) pm.dot(tip[0], tip[1], Math.max(2, Rs * 0.08), 0xffffff, 0.95);
        }
        // Glints on the ice.
        for (let j = 0; j < 22; j++) {
          const rnd = seq(j * 53 + 1);
          const x = Sx + (rnd() - 0.5) * Rs * 1.4;
          const y = Sy + (rnd() - 0.5) * Rs * 1.2;
          const tw = Math.max(0, Math.sin(t * (3 + rnd() * 4) + rnd() * 6));
          pm.dot(x, y, Math.max(2, Rs * 0.05), 0xffffff, fz * tw * 0.8);
        }
        // Frost creeping along the sectors round it: rims of particles on their near edges.
        for (const n of ring) {
          const cx = nbx(n);
          const cy = nby(n);
          const ncs = hexCorners(cx, cy, Rs);
          for (let e = 0; e < 6; e++) {
            const a = ncs[e]!;
            const c = ncs[(e + 1) % 6]!;
            const mx = (a[0] + c[0]) / 2;
            const my = (a[1] + c[1]) / 2;
            const near = Math.hypot(mx - Sx, my - Sy) / (Rs * NB);
            const reach = fz * 1.4 - (near - 0.5);
            if (reach <= 0) continue;
            for (let m = 0; m < 8; m++) {
              const u = m / 8;
              const tw = 0.6 + 0.4 * Math.sin(t * 7 + m + e * 3);
              pm.dot(a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u, Math.max(1.6, Rs * 0.045), m % 2 ? FROST : CYAN, Math.min(1, reach) * 0.7 * tw);
            }
          }
        }
        // The two cracks: bright lines of light across the frozen tile.
        CRYO.cracks.forEach((at, i) => {
          if (t < at) return;
          const a0 = i ? 2.2 : -0.5;
          const pts = bolt(Sx + Math.cos(a0) * Rs * 0.85, Sy + Math.sin(a0) * Rs * 0.85, Sx - Math.cos(a0 + 0.3) * Rs * 0.8, Sy - Math.sin(a0 + 0.3) * Rs * 0.8, 31 + i * 7, 0.16, 9);
          const fresh = Math.exp(-(t - at) / 0.1);
          strokePath(light, pts, Math.max(4, Rs * 0.1), CYAN, 0.4 + 0.5 * fresh);
          strokePath(light, pts, 1.8, 0xffffff, 1);
          if (fresh > 0.05) for (const [x, y] of pts) pm.dot(x, y, Rs * 0.1 * fresh, 0xffffff, fresh);
        });
      }

      // Act 3: the shatter.
      const age = t - D;
      const live = !still && broke;
      if (live && age < 0.4) white.rect(0, 0, w, h).fill({ color: 0xd8f0ff, alpha: 0.85 * (1 - age / 0.4) ** 2 });
      const fu = live ? span(t, [D, D + 0.6]) : 1;
      b.flash.visible = fu < 1;
      if (fu < 1) {
        b.flash.position.set(Sx, Sy);
        b.flash.width = b.flash.height = Rs * (1.5 + 5 * easeOut(fu));
        b.flash.alpha = (1 - fu) ** 1.4;
      }
      if (live && age < 1.6) {
        // The shards: pale ice with white edges and a light face, tumbling out and slowing; some at the camera.
        for (const sd of SHARDS) {
          const u = age / 1.6;
          const d = Rs * (sd.from * 0.8 + (sd.v * (1 - Math.exp(-sd.k * age))) / sd.k);
          const grow = sd.cam ? 1 + 5 * u * u : 1;
          const x = Sx + Math.cos(sd.a) * d;
          const y = Sy + Math.sin(sd.a) * d;
          const ang = sd.spin * (1 - Math.exp(-age * 1.5));
          const s = Rs * sd.size * grow;
          const pts = sd.pts.map(([px, py]) => [x + (px * Math.cos(ang) - py * Math.sin(ang)) * s, y + (px * Math.sin(ang) + py * Math.cos(ang)) * s] as [number, number]);
          const al = (1 - u) ** (sd.cam ? 2.4 : 1.1);
          // Each face catches the light as it turns.
          const lit = 0.5 + 0.5 * Math.cos(ang * 2 + sd.shade * 6);
          shards.poly(flat(pts)).fill({ color: lit > 0.7 ? FROST : ICE, alpha: al * (0.55 + 0.35 * lit) }).stroke({ width: sd.cam ? 2.2 : 1.2, color: 0xffffff, alpha: al });
          if (lit > 0.85) pm.dot(x, y, s * 1.2, 0xffffff, al * (lit - 0.85) * 6);
        }
        // Ice particles sprayed out, twinkling.
        for (const g of GLINT) {
          if (age > g.life) continue;
          const u = age / g.life;
          const d = Rs * (0.2 + (g.v * (1 - Math.exp(-g.k * age))) / g.k);
          const tw = 0.6 + 0.4 * Math.sin(age * 30 + g.tw);
          pm.dot(Sx + Math.cos(g.a) * d, Sy + Math.sin(g.a) * d, Math.max(1.6, Rs * g.size), u < 0.3 ? 0xffffff : g.tw < 3 ? FROST : CYAN, (1 - u) * tw, 1 + 3 * Math.exp(-g.k * age), g.a);
        }
      }
      // The frost wave: a ring of particles running out off the screen; behind it the sectors keep a frost rim.
      const far = Math.hypot(Math.max(Sx, w - Sx), Math.max(Sy, h - Sy)) + 40;
      if (live && age < 1.0) {
        const u = age / 1.0;
        const rr = Rs * 0.7 + (far - Rs * 0.7) * easeOut(u);
        const n = 140;
        for (let j = 0; j < n; j++) {
          const aa = (j / n) * Math.PI * 2;
          const jag = 1 + 0.03 * Math.sin(aa * 13 + j);
          pm.dot(Sx + Math.cos(aa) * rr * jag, Sy + Math.sin(aa) * rr * jag, Math.max(2, Rs * 0.07), j % 3 ? FROST : CYAN, 0.9 * (1 - u), 2.4, aa + Math.PI / 2);
        }
        top.circle(Sx, Sy, rr).stroke({ width: Math.max(2, Rs * 0.14 * (1 - u)), color: CYAN, alpha: 0.35 * (1 - u) });
      }
      // The frost left on the sectors round it once the wave has passed (fades slowly).
      const frostLeft = still ? 0.6 * fade : live ? Math.min(1, age / 0.25) * (1 - span(t, [CRYO.back[0] - 0.4, CRYO.back[1] - 0.2])) : 0;
      if (frostLeft > 0.01) {
        for (const n of ring) {
          const L = look(n.key);
          const cx = nbx(n) + L.dx;
          const cy = nby(n) + L.dy;
          const ncs = hexCorners(cx, cy, Rs * 0.98 * L.scale);
          light.poly(flat(ncs)).stroke({ width: Math.max(3, Rs * 0.07), color: CYAN, alpha: 0.25 * frostLeft });
          for (let e = 0; e < 6; e++) {
            const a = ncs[e]!;
            const c = ncs[(e + 1) % 6]!;
            for (let m = 0; m < 6; m++) {
              const u = (m + 0.5) / 6;
              const tw = still ? 0.8 : 0.55 + 0.45 * Math.sin(t * 6 + m * 2 + e);
              pm.dot(a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u, Math.max(1.6, Rs * 0.04), m % 2 ? FROST : ICE, frostLeft * tw * 0.75);
            }
          }
        }
        // The emptied sector: frosted over.
        under.poly(flat(hexCorners(Sx, Sy, Rs))).fill({ color: 0x0a1a2a, alpha: 0.55 * frostLeft });
        light.poly(flat(hexCorners(Sx, Sy, Rs * 0.97))).stroke({ width: 2, color: FROST, alpha: 0.8 * frostLeft });
        for (const fl of FROST_LINES) {
          if (fl.w < 1) continue;
          strokePath(light, fl.pts.map(([x, y]) => [Sx + x * Rs, Sy + y * Rs] as [number, number]), 1.2, ICE, 0.35 * frostLeft);
        }
      }
      // The units round it knocked back.
      if (live && age < 1.4) {
        for (const n of ring) {
          const a = Math.max(0, age - 0.04);
          const push = R * 0.34 * Math.exp(-a * 4.2) * Math.sin(a * 15);
          const L = look(n.key);
          L.dx += n.dx * push;
          L.dy += n.dy * push;
          L.scale *= 1 - 0.06 * Math.exp(-a * 5);
        }
      }
      // Ice dust drifting down, twinkling (a few hang in the still picture).
      if (live || still) {
        for (const [i, d] of DUST.entries()) {
          const a = still ? 0.4 + (i % 7) * 0.1 : t - d.born;
          if ((still && i > 24) || a < 0 || a > d.life) continue;
          const u = a / d.life;
          const x = Sx + d.x * Rs + d.drift * Rs * a;
          const y = Sy + d.y * Rs + Rs * 0.45 * a;
          const tw = still ? 0.8 : 0.5 + 0.5 * Math.sin(a * 12 + d.tw);
          pm.dot(x, y, Math.max(1.5, Rs * d.size), i % 3 ? FROST : 0xffffff, Math.sin(Math.PI * u) * tw * fade);
        }
      }
      // Mist: rolling off the ice while it freezes, then billowing out at the shatter.
      b.mist.forEach((sp, j) => {
        const ang = (j / MIST) * Math.PI * 2 + 0.3;
        let x = 0;
        let y = 0;
        let size = 0;
        let al = 0;
        if (!still && !broke && fz > 0.2) {
          const a = (t * 0.6 + j * 0.13) % 1;
          x = Sx + Math.cos(ang) * Rs * (0.8 + 0.5 * a);
          y = Sy + Math.sin(ang) * Rs * (0.8 + 0.5 * a) + Rs * 0.2 * a;
          size = Rs * (0.6 + 0.5 * a);
          al = 0.22 * Math.sin(Math.PI * a) * fz;
        } else if (live && age < 2.4) {
          const u = age / 2.4;
          const d = Rs * (0.6 + 4.2 * easeOut(Math.min(1, age / 1.4)));
          x = Sx + Math.cos(ang) * d;
          y = Sy + Math.sin(ang) * d;
          size = Rs * (1.2 + 2.2 * u);
          al = 0.4 * (1 - u) ** 1.3;
        } else if (still && j < 6) {
          x = Sx + Math.cos(ang) * Rs * 1.6;
          y = Sy + Math.sin(ang) * Rs * 1.6;
          size = Rs * 1.6;
          al = 0.18 * fade;
        }
        sp.visible = al > 0.01;
        if (!sp.visible) return;
        sp.position.set(x, y);
        sp.width = sp.height = size;
        sp.alpha = al;
      });
      pm.end();
    },
  });
}
