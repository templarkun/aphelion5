/**
 * The Salvage milestones (designer 2026-11-22), drawn on the Field in the close-up every kill shares
 * (closeup.ts). Screen only: nothing here is a rule.
 *
 * Grid Online (`salvageNodes`, about 4.6 s): the fifth Power Node reaches the Trophy pile (8.2), whether
 * or not the three Cleared sectors are there yet.
 * 1. Zoom in on the sector the Power Node left; energy of its three colours circles it.
 * 2. Four streams of particles pour in from the top of the Field (the four Power Nodes already taken).
 * 3. It ignites (playGridOnline) and goes up as a column of energy towards the Mission bar; a ring goes
 *    out; "POWER NODES · 4 / 5" turns to "5 / 5".
 * 4. The zoom eases back.
 *
 * Sector Lock (`salvageCleared`, about 4.6 s): the third Cleared sector, once 5 Power Nodes are taken.
 * 1. Zoom in (less far, so the others show) on the sector just cleared; a ring of particles scans it.
 * 2. Beams of particles leap from it to the other Cleared sectors (playClearedLink).
 * 3. They lock (playSectorLock): the sectors' edges flash, particles fill the space between them, a ring
 *    goes out; "CLEARED · 2 / 3" turns to "3 / 3".
 * 4. The zoom eases back.
 */

import { Graphics } from "pixi.js";
import type { Step } from "../anim.js";
import { easeOut } from "../anim.js";
import { playClearedLink, playGridOnline, playSectorLock } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, closeupStep, flat, glowSprite, hexCorners, motes, seq } from "./closeup.js";
import { CLEARED, NODES, span } from "./timeline.js";

/** The energy colours (Yellow, Red, Blue), a little lighter for light. */
const ENERGY = [0xffd54a, 0xff5a4a, 0x4aa8ff] as const;
const WHITE = 0xffffff;
/** Sector Lock's colour: a cold steel cyan. */
const LOCK = 0x7fe8ff;

const ORBIT = (() => {
  const r = seq(4127);
  return Array.from({ length: 150 }, (_, i) => ({ c: i % 3, a: r() * Math.PI * 2, r: 0.75 + r() * 0.7, speed: 1.5 + r() * 2.5, tilt: r() * Math.PI, size: 0.05 + r() * 0.07 }));
})();
const STREAM = (() => {
  const r = seq(8831);
  return Array.from({ length: 4 * 40 }, (_, i) => ({ s: i % 4, off: r(), wob: (r() - 0.5) * 0.5, size: 0.05 + r() * 0.06, c: Math.floor(r() * 3) }));
})();
const COLUMN = (() => {
  const r = seq(2203);
  return Array.from({ length: 120 }, () => ({ x: (r() - 0.5) * 0.9, born: NODES.ignite + r() * 0.9, speed: 3 + r() * 6, c: Math.floor(r() * 3), size: 0.05 + r() * 0.08 }));
})();
const BURST = (() => {
  const r = seq(551);
  return Array.from({ length: 70 }, () => ({ a: r() * Math.PI * 2, far: 1.6 + r() * 2.4, c: Math.floor(r() * 3), size: 0.04 + r() * 0.06 }));
})();

/** Grid Online as a Field step (and its still picture). */
export function gridOnlineStep(env: KillEnv, k: KillTarget): Step {
  return closeupStep(env, k, {
    times: { total: NODES.total, zoomIn: NODES.zoomIn, back: NODES.back, breakAt: NODES.ignite, wreckIn: NODES.wreckIn, label: NODES.label, count: NODES.count, stillAt: NODES.count + 0.4 },
    title: "POWER NODES",
    accent: 0xffd54a,
    ink: 0xfff4c8,
    inkLine: 0x5a3c00,
    build: (back) => {
      const light = new Graphics();
      light.blendMode = "add";
      back.addChild(light);
      const pm = motes(back, 520);
      const core = glowSprite(back, 0xfff0b0);
      const flash = glowSprite(back, WHITE);
      return { light, pm, core, flash };
    },
    shake: (t, Rs) => {
      const u = span(t, [NODES.ignite, NODES.ignite + 0.3]);
      const a = u > 0 && u < 1 ? Rs * 0.05 * (1 - u) ** 2 : 0;
      return [a * Math.sin(u * 50), a * Math.cos(u * 43)];
    },
    tile: (t) => ({ scale: 1 + 0.08 * span(t, [1.3, NODES.ignite]), alpha: 1 }),
    sounds: (crossed) => {
      if (crossed(NODES.ignite)) playGridOnline();
    },
    draw: (f, b) => {
      const { t, still, Sx, Sy, Rs, h } = f;
      const light = b.light.clear();
      b.pm.begin();
      const ignited = still || t >= NODES.ignite;
      // Act 1: three colours circle the node, tighter and faster as the links pour in.
      const orbIn = still ? 0 : span(t, [NODES.orbit[0], NODES.orbit[0] + 0.4]);
      const tight = span(t, NODES.link);
      if (!ignited && orbIn > 0) {
        for (const o of ORBIT) {
          const ang = o.a + t * o.speed * (1 + tight);
          const rr = Rs * o.r * (1 - 0.35 * tight);
          const x = Sx + Math.cos(ang) * rr;
          const y = Sy + Math.sin(ang) * rr * (0.45 + 0.5 * Math.abs(Math.cos(o.tilt)));
          b.pm.dot(x, y, Rs * o.size * 2, ENERGY[o.c]!, 0.9 * orbIn, 2.2, ang + Math.PI / 2);
        }
      }
      // Act 2: four streams from the top of the Field.
      if (!still && !ignited && t > NODES.link[0]) {
        for (const p of STREAM) {
          const sx = Sx + (p.s - 1.5) * Rs * 1.6;
          const u = ((t - NODES.link[0]) * 1.6 + p.off) % 1;
          const y = -Rs + (Sy + Rs) * u;
          const x = sx + (Sx - sx) * u * u + Math.sin(u * 9 + p.off * 6) * Rs * p.wob * (1 - u);
          const a = Math.min(1, (t - NODES.link[0]) * 4) * (1 - span(t, [NODES.link[1], NODES.ignite]) * 0.5);
          b.pm.dot(x, y, Rs * p.size * 2, ENERGY[p.c]!, a, 3, Math.PI / 2);
        }
      }
      // The core grows bright before it ignites.
      const coreUp = still ? 0 : span(t, [NODES.link[0], NODES.ignite]);
      b.core.visible = !ignited && coreUp > 0;
      b.core.position.set(Sx, Sy);
      b.core.width = b.core.height = Rs * (0.6 + 1.6 * coreUp);
      b.core.alpha = 0.85 * coreUp;
      // Act 3: flash, ring, burst, the column going up.
      const fl = still ? 1 : span(t, [NODES.ignite, NODES.ignite + 0.35]);
      b.flash.visible = fl < 1;
      b.flash.position.set(Sx, Sy);
      b.flash.width = b.flash.height = Rs * (1 + 3 * easeOut(fl));
      b.flash.alpha = (1 - fl) ** 1.5;
      if (ignited && !still) {
        const r1 = span(t, [NODES.ignite, NODES.ignite + 0.8]);
        if (r1 < 1) {
          light.circle(Sx, Sy, Rs * (0.6 + 3.2 * easeOut(r1))).stroke({ width: Math.max(1, Rs * 0.1 * (1 - r1)), color: 0xffd54a, alpha: 0.85 * (1 - r1) });
          for (const p of BURST) {
            const d = Rs * (0.5 + p.far * easeOut(r1));
            b.pm.dot(Sx + Math.cos(p.a) * d, Sy + Math.sin(p.a) * d, Rs * p.size * 2, ENERGY[p.c]!, 1 - r1, 2.5, p.a);
          }
        }
        for (const p of COLUMN) {
          const age = t - p.born;
          if (age < 0 || age > 1.2) continue;
          const y = Sy - Rs * p.speed * age * 1.3;
          if (y < -20) continue;
          b.pm.dot(Sx + p.x * Rs * (1 - age * 0.5), y, Rs * p.size * 2, ENERGY[p.c]!, 1 - age / 1.2, 4, Math.PI / 2);
        }
        // The column's core: a soft beam up to the top of the Field.
        const col = span(t, NODES.column);
        if (col < 1) {
          const a = Math.sin(Math.PI * Math.min(1, col * 1.3));
          light.rect(Sx - Rs * 0.18, -10, Rs * 0.36, Sy + 10).fill({ color: 0xfff0b0, alpha: 0.25 * a });
          light.rect(Sx - Rs * 0.05, -10, Rs * 0.1, Sy + 10).fill({ color: WHITE, alpha: 0.6 * a });
        }
      }
      // The still picture: the node's three colours as a ring of light, the column faint.
      if (still) {
        for (let i = 0; i < 3; i++) light.circle(Sx, Sy, Rs * (1.05 + 0.12 * i)).stroke({ width: 3, color: ENERGY[i]!, alpha: 0.7 });
        light.rect(Sx - Rs * 0.05, 0, Rs * 0.1, Sy).fill({ color: WHITE, alpha: 0.25 });
      }
      void h;
      b.pm.end();
    },
  });
}

/** The other Cleared sectors' screen centres now (the board is zoomed round the sector). */
export function othersOnScreen(env: KillEnv, k: KillTarget, f: { Sx: number; Sy: number; z: number; cx: number; cy: number }): [number, number][] {
  const all = env.centres?.() ?? [];
  const want = new Set(k.others ?? []);
  return all.filter(([key]) => want.has(key)).map(([, x, y]) => [f.Sx + (x - f.cx) * f.z, f.Sy + (y - f.cy) * f.z]);
}

const SCAN = (() => {
  const r = seq(7019);
  return Array.from({ length: 90 }, () => ({ a: r() * Math.PI * 2, j: (r() - 0.5) * 0.12, size: 0.04 + r() * 0.05 }));
})();
const BEAM = (() => {
  const r = seq(3313);
  return Array.from({ length: 70 }, () => ({ off: r(), side: (r() - 0.5) * 0.18, size: 0.04 + r() * 0.06, speed: 0.6 + r() * 0.8 }));
})();
const FILL = (() => {
  const r = seq(9901);
  return Array.from({ length: 160 }, () => ({ u: r(), v: r(), tw: r() * Math.PI * 2, size: 0.03 + r() * 0.05 }));
})();

/** Sector Lock as a Field step (and its still picture). */
export function sectorLockStep(env: KillEnv, k: KillTarget): Step {
  return closeupStep(env, k, {
    times: { total: CLEARED.total, zoomIn: CLEARED.zoomIn, back: CLEARED.back, breakAt: CLEARED.wreckIn[0], wreckIn: CLEARED.wreckIn, label: CLEARED.label, count: CLEARED.count, stillAt: CLEARED.count + 0.4 },
    title: "CLEARED",
    accent: LOCK,
    ink: 0xe8fbff,
    inkLine: 0x0b3442,
    size: 0.13,
    hole: 1.6,
    dark: () => 0.55,
    build: (back, front) => {
      const light = new Graphics();
      light.blendMode = "add";
      back.addChild(light);
      const pm = motes(front, 520);
      const flash = glowSprite(back, LOCK);
      return { light, pm, flash };
    },
    tile: () => ({ scale: 1, alpha: 1 }),
    sounds: (crossed) => {
      if (crossed(CLEARED.beams[0] + 0.5)) playClearedLink();
      if (crossed(CLEARED.lock)) playSectorLock();
    },
    draw: (f, b) => {
      const { t, still, Sx, Sy, Rs } = f;
      const light = b.light.clear();
      b.pm.begin();
      const others = othersOnScreen(env, k, f);
      const pts: [number, number][] = [[Sx, Sy], ...others];
      const locked = still || t >= CLEARED.lock;
      // Act 1: the scan ring crosses the empty sector.
      const sc = still ? 1 : span(t, CLEARED.scan);
      if (!still && sc > 0 && sc < 1) {
        const rr = Rs * (0.2 + 0.85 * sc);
        for (const p of SCAN) b.pm.dot(Sx + Math.cos(p.a) * rr * (1 + p.j), Sy + Math.sin(p.a) * rr * (1 + p.j), Rs * p.size * 2, LOCK, 0.9 * Math.sin(Math.PI * sc), 2, p.a + Math.PI / 2);
        light.poly(flat(hexCorners(Sx, Sy, Rs))).stroke({ width: 2, color: LOCK, alpha: 0.5 * sc });
      }
      // Act 2: beams leap to the others.
      const bi = still ? 1 : span(t, CLEARED.beams);
      for (const [ox, oy] of others) {
        if (bi <= 0) break;
        const dx = ox - Sx;
        const dy = oy - Sy;
        const L = Math.hypot(dx, dy) || 1;
        const nx = -dy / L;
        const ny = dx / L;
        const reach = easeOut(bi);
        const fade = locked && !still ? 1 - 0.6 * span(t, CLEARED.field) : 1;
        light
          .moveTo(Sx, Sy)
          .lineTo(Sx + dx * reach, Sy + dy * reach)
          .stroke({ width: Math.max(1, Rs * 0.05), color: LOCK, alpha: 0.35 * fade });
        if (!still)
          for (const p of BEAM) {
            const u = ((t * p.speed + p.off) % 1) * reach;
            const s = Math.sin(u * 30 + p.off * 9) * Rs * p.side;
            b.pm.dot(Sx + dx * u + nx * s, Sy + dy * u + ny * s, Rs * p.size * 2, u > 0.92 * reach ? WHITE : LOCK, 0.9 * fade, 3, Math.atan2(dy, dx));
          }
        // The far end lights its sector's edge as the beam arrives.
        if (bi >= 1) light.poly(flat(hexCorners(ox, oy, Rs))).stroke({ width: 2.5, color: LOCK, alpha: locked ? 0.85 : 0.5 });
      }
      // Act 3: lock: every Cleared sector's edge flashes, particles fill the space between them, a ring goes out.
      if (locked) {
        const fl = still ? 1 : span(t, [CLEARED.lock, CLEARED.lock + 0.4]);
        const glow = still ? 0.7 : 0.6 + 0.4 * (1 - fl);
        for (const [x, y] of pts) light.poly(flat(hexCorners(x, y, Rs))).stroke({ width: 3, color: fl < 1 ? WHITE : LOCK, alpha: glow });
        b.flash.visible = fl < 1;
        b.flash.position.set(Sx, Sy);
        b.flash.width = b.flash.height = Rs * (1.2 + 2.5 * easeOut(fl));
        b.flash.alpha = 0.9 * (1 - fl) ** 1.5;
        if (!still) {
          const r1 = span(t, [CLEARED.lock, CLEARED.lock + 0.9]);
          if (r1 < 1) light.circle(Sx, Sy, Rs * (1 + 3.5 * easeOut(r1))).stroke({ width: Math.max(1, Rs * 0.08 * (1 - r1)), color: LOCK, alpha: 0.8 * (1 - r1) });
        }
        // The field between them: a triangle (or a line, or the one sector) of drifting particles.
        const fi = still ? 0.6 : Math.sin(Math.PI * span(t, CLEARED.field));
        if (pts.length >= 3) {
          const [a, c, d] = pts as [[number, number], [number, number], [number, number]];
          light.poly(flat([a, c, d])).fill({ color: LOCK, alpha: 0.08 * fi });
          for (const p of FILL) {
            let u = p.u;
            let v = p.v;
            if (u + v > 1) (u = 1 - u), (v = 1 - v);
            const x = a[0] + (c[0] - a[0]) * u + (d[0] - a[0]) * v;
            const y = a[1] + (c[1] - a[1]) * u + (d[1] - a[1]) * v - (still ? 0 : (t - CLEARED.lock) * Rs * 0.15);
            b.pm.dot(x, y, Rs * p.size * 2, LOCK, fi * (0.5 + 0.5 * Math.sin(t * 6 + p.tw)));
          }
        }
      }
      b.pm.end();
    },
  });
}
