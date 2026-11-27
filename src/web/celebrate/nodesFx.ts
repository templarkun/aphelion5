/**
 * Two more Salvage milestones for the fifth Power Node (designer 2026-11-27: "additional 2 salvage mission
 * celebration for "5th power node""), in the pool with Grid Online (salvageFx.ts), one picked at random per
 * mission (I19). Drawn on the Field in the close-up every kill shares (closeup.ts). Screen only: nothing here
 * is a rule.
 *
 * Fusion Ignition (`salvageFusion`, about 4.8 s):
 * 1. Zoom in on the sector the Power Node left; three confinement rings of particles (Yellow, Red, Blue)
 *    gather round it one by one (playFusionRing) and spin up, tilting like a gyroscope, tighter and faster.
 * 2. Plasma filaments pinch in from the rings to the core; it brightens.
 * 3. Ignition (playFusionIgnite): a white flash, the rings are blown away, a small sun burns over the sector
 *    with a corona of particles looping along its rim and rays streaming off it. Four stars light round it
 *    (the four Power Nodes already taken); the fifth flies out of the sun to close the ring (playFusionStar),
 *    streams of particles run round the pentagon; "POWER NODES · 4 / 5" turns to "5 / 5".
 * 4. The sun sinks into the sector, the zoom eases back.
 *
 * Charge Cascade (`salvageCascade`, about 4.9 s):
 * 1. Zoom in (a little less, room above); five charge cells open in an arc over the node; four light one
 *    by one (playCascadeCell), the fifth stays empty, pulsing.
 * 2. The node's energy streams in and condenses into a turning crystal of the three colours over the tile;
 *    it rises on a trail into the fifth cell.
 * 3. The fifth cell locks (playCascadeLock); the cells flare one by one, arcs leaping from cell to cell.
 * 4. They discharge into the sector (playCascadeDischarge): five bolts down, a flash, a pulse of particles
 *    runs out over the whole Field and every sector's edge flickers as it passes; the zoom eases back.
 *
 * Energy is drawn with particles (designer 2026-11-20). The same for every Company (I25).
 */

import { Graphics, type Sprite } from "pixi.js";
import type { Step } from "../anim.js";
import { easeInOut, easeOut } from "../anim.js";
import { playCascadeCell, playCascadeDischarge, playCascadeLock, playFusionIgnite, playFusionRing, playFusionStar } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, bolt, closeupStep, flat, glowSprite, hexCorners, motes, seq, strokePath } from "./closeup.js";
import { CASCADE, FUSION, span } from "./timeline.js";

/** The energy colours (Yellow, Red, Blue), a little lighter for light. */
const ENERGY = [0xffd54a, 0xff5a4a, 0x4aa8ff] as const;
const WHITE = 0xffffff;
const GOLD = 0xffd54a;
const SUN = [0xffffff, 0xfff1b8, 0xffc24a, 0xff8a2a] as const;

// ---------------------------------------------------------------------------------------------------------
// Fusion Ignition

/** Each ring: its plane's tilt and turn, how fast it turns over, its particles. */
const RINGS = [0, 1, 2].map((i) => {
  const r = seq(611 + i * 97);
  return {
    tilt0: 0.9 + i * 0.75,
    tiltSpeed: (i % 2 ? -1 : 1) * (0.9 + i * 0.35),
    turn: (i * Math.PI) / 3 + 0.3,
    parts: Array.from({ length: 96 }, (_, j) => ({ th: (j / 96) * Math.PI * 2 + r() * 0.05, j: (r() - 0.5) * 0.07, size: 0.045 + r() * 0.05, knot: j % 23 === 0 })),
  };
});
const FILAMENT = (() => {
  const r = seq(7741);
  return Array.from({ length: 90 }, (_, i) => ({ a: r() * Math.PI * 2, off: r(), c: i % 3, swirl: 0.8 + r() * 1.2, size: 0.035 + r() * 0.05 }));
})();
const LOOPS = (() => {
  const r = seq(2287);
  return Array.from({ length: 9 }, (_, i) => ({ phi: (i / 9) * Math.PI * 2 + r() * 0.4, half: 0.25 + r() * 0.2, lift: 0.45 + r() * 0.45, speed: 0.35 + r() * 0.4, sway: r() * 6 }));
})();
const RAYS = (() => {
  const r = seq(5113);
  return Array.from({ length: 80 }, () => ({ a: r() * Math.PI * 2, off: r(), speed: 0.7 + r() * 0.9, size: 0.03 + r() * 0.05 }));
})();
const BLAST = (() => {
  const r = seq(9061);
  return Array.from({ length: 110 }, (_, i) => ({ a: r() * Math.PI * 2, far: 1.5 + r() * 3, c: i % 3, size: 0.04 + r() * 0.06 }));
})();
const EDGE = (() => {
  const r = seq(3307);
  return Array.from({ length: 60 }, () => ({ off: r(), side: (r() - 0.5) * 0.1, speed: 0.5 + r() * 0.5, size: 0.03 + r() * 0.04 }));
})();

/** The pentagon of stars: star i (0-4) round (Sx, Sy); the fifth is the node itself. */
export function fusionStar(i: number, Sx: number, Sy: number, Rs: number, wide: boolean): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
  const r = Rs * 1.6;
  return [Sx + Math.cos(a) * r, Sy + Math.sin(a) * r * (wide ? 1 : 0.8)];
}

/** How far ring i has turned round (radians) at time t: it spins up (closed form, never summed by frame). */
export function ringPhase(i: number, t: number): number {
  const t0 = FUSION.ringAt[i]!;
  const u = Math.max(0, t - t0);
  return u * (2.2 + i * 0.3) + u * u * 2.4;
}

/** Fusion Ignition as a Field step (and its still picture). */
export function fusionStep(env: KillEnv, k: KillTarget): Step {
  const F = FUSION;
  return closeupStep(env, k, {
    times: { total: F.total, zoomIn: F.zoomIn, back: F.back, breakAt: F.ignite, wreckIn: F.wreckIn, label: F.label, count: F.count, stillAt: F.count + 0.4 },
    size: 0.16,
    hole: 1.9,
    title: "POWER NODES",
    accent: GOLD,
    ink: 0xfff4c8,
    inkLine: 0x5a3c00,
    build: (back, front) => {
      const light = new Graphics();
      light.blendMode = "add";
      back.addChild(light);
      const core = glowSprite(back, 0xfff0b0);
      const halo = glowSprite(back, 0xff9a3a);
      const sun = glowSprite(back, 0xfff6d8);
      const pm = motes(front, 1000);
      const flash = glowSprite(front, WHITE);
      const stars = Array.from({ length: 5 }, () => glowSprite(front, 0xfff1b8));
      return { light, core, halo, sun, pm, flash, stars };
    },
    shake: (t, Rs) => {
      const u = span(t, [F.ignite, F.ignite + 0.35]);
      const a = u > 0 && u < 1 ? Rs * 0.06 * (1 - u) ** 2 : 0;
      const p = span(t, F.pinch) * (t < F.ignite ? 1 : 0);
      const b = Rs * 0.008 * p;
      return [a * Math.sin(u * 52) + b * Math.sin(t * 90), a * Math.cos(u * 41) + b * Math.cos(t * 77)];
    },
    tile: (t) => ({ scale: 1 - 0.1 * span(t, F.pinch), alpha: 1 - 0.3 * span(t, F.pinch) }),
    sounds: (crossed) => {
      F.ringAt.forEach((at, i) => {
        if (crossed(at)) playFusionRing(i);
      });
      if (crossed(F.ignite)) playFusionIgnite();
      if (crossed(F.count)) playFusionStar();
    },
    draw: (f, b) => {
      const { t, still, Sx, Sy, Rs, wide } = f;
      const light = b.light.clear();
      b.pm.begin();
      const lit = still || t >= F.ignite;

      // Act 1: the rings. Before ignition they tighten; after it they are blown outwards and fade.
      const blown = still ? 1 : span(t, [F.ignite, F.ignite + 0.55]);
      if (blown < 1) {
        const tight = span(t, [F.ringAt[0], F.pinch[1]]);
        RINGS.forEach((ring, i) => {
          const inA = easeOut(span(t, [F.ringAt[i]!, F.ringAt[i]! + 0.35]));
          if (inA <= 0) return;
          const rr = Rs * (1.5 - 0.42 * tight) * (1 + 2.2 * easeOut(blown)) * (0.7 + 0.3 * inA);
          const al = inA * (1 - blown);
          const tilt = ring.tilt0 + ring.tiltSpeed * t;
          const ca = Math.cos(tilt);
          const sa = Math.sin(tilt);
          const cb = Math.cos(ring.turn);
          const sb = Math.sin(ring.turn);
          const ph = ringPhase(i, t);
          for (const p of ring.parts) {
            const th = p.th + ph;
            const c = Math.cos(th);
            const s = Math.sin(th);
            const x = c * cb - s * ca * sb;
            const y = c * sb + s * ca * cb;
            const z = s * sa;
            const rj = rr * (1 + p.j);
            const near = 0.55 + 0.45 * z;
            // Along the ring's way of travel, so the particles streak as it spins.
            const dir = Math.atan2(-s * sb + c * ca * cb, -s * cb - c * ca * sb);
            b.pm.dot(Sx + x * rj, Sy + y * rj * 0.92, Rs * (p.knot ? p.size * 3.2 : p.size * 2) * (0.7 + 0.5 * near), p.knot ? WHITE : ENERGY[i]!, al * near, 1 + 2 * tight, dir);
          }
        });
      }

      // Act 2: filaments pinch in, the core brightens.
      const pin = still ? 0 : span(t, F.pinch);
      if (!lit && pin > 0) {
        for (const p of FILAMENT) {
          const u = (t * 1.9 + p.off) % 1;
          const d = Rs * 1.15 * (1 - u) * (1 - 0.3 * pin);
          const a = p.a + u * p.swirl;
          b.pm.dot(Sx + Math.cos(a) * d, Sy + Math.sin(a) * d * 0.92, Rs * p.size * 2 * (0.6 + u), u > 0.85 ? WHITE : ENERGY[p.c]!, pin * Math.sin(Math.PI * u), 3, a + Math.PI);
        }
      }
      const coreUp = still ? 0 : span(t, [F.ringAt[1], F.ignite]);
      b.core.visible = !lit && coreUp > 0;
      b.core.position.set(Sx, Sy);
      b.core.width = b.core.height = Rs * (0.35 + 1.1 * coreUp ** 2) * (1 + 0.06 * Math.sin(t * 40));
      b.core.alpha = 0.95 * coreUp;

      // Act 3: the flash and the blast of particles.
      const fl = still ? 1 : span(t, [F.ignite, F.ignite + 0.4]);
      b.flash.visible = fl < 1;
      b.flash.position.set(Sx, Sy);
      b.flash.width = b.flash.height = Rs * (1.4 + 4.5 * easeOut(fl));
      b.flash.alpha = (1 - fl) ** 1.6;
      if (lit && !still) {
        const r1 = span(t, [F.ignite, F.ignite + 0.9]);
        if (r1 < 1) {
          for (const p of BLAST) {
            const d = Rs * (0.4 + p.far * easeOut(r1));
            b.pm.dot(Sx + Math.cos(p.a) * d, Sy + Math.sin(p.a) * d * 0.92, Rs * p.size * 2, r1 < 0.3 ? WHITE : ENERGY[p.c]!, 1 - r1, 3, p.a);
          }
          const rr = Rs * (0.5 + 3.4 * easeOut(r1));
          for (let i = 0; i < 64; i++) {
            const a = (i / 64) * Math.PI * 2;
            b.pm.dot(Sx + Math.cos(a) * rr, Sy + Math.sin(a) * rr * 0.92, Rs * 0.09, 0xfff1b8, 0.8 * (1 - r1), 2.5, a + Math.PI / 2);
          }
        }
      }

      // The sun: it swells in, burns, and sinks into the sector at the end.
      const sunIn = still ? 1 : easeOut(span(t, [F.ignite, F.ignite + 0.35]));
      const sunOut = still ? 0 : span(t, [F.sun[1] - 0.5, F.sun[1]]);
      const sunA = sunIn * (1 - sunOut);
      const rS = Rs * 0.42 * (0.6 + 0.4 * sunIn) * (1 - 0.6 * sunOut);
      b.sun.visible = b.halo.visible = lit && sunA > 0.01;
      if (b.sun.visible) {
        const pulse = 1 + 0.05 * Math.sin(t * 13) + 0.03 * Math.sin(t * 29);
        b.sun.position.set(Sx, Sy);
        b.sun.width = b.sun.height = rS * 2.6 * pulse;
        b.sun.alpha = sunA;
        b.halo.position.set(Sx, Sy);
        b.halo.width = b.halo.height = rS * 6 * pulse;
        b.halo.alpha = 0.55 * sunA;
        // The limb: a rim of particles shimmering.
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * Math.PI * 2 + t * 0.6;
          const rr = rS * (1 + 0.06 * Math.sin(a * 5 + t * 9));
          b.pm.dot(Sx + Math.cos(a) * rr, Sy + Math.sin(a) * rr, Rs * 0.07, SUN[1], 0.7 * sunA, 2, a + Math.PI / 2);
        }
        // The corona: loops of particles rising off the rim and falling back to it.
        for (const L of LOOPS) {
          const lift = L.lift * (1 + 0.25 * Math.sin(t * 2 + L.sway));
          for (let j = 0; j < 14; j++) {
            const s = (j / 14 + t * L.speed) % 1;
            const ang = L.phi + L.half * (2 * s - 1) + 0.15 * Math.sin(t * 0.8 + L.sway);
            const rad = rS * (1 + lift * Math.sin(Math.PI * s));
            const hot = Math.sin(Math.PI * s);
            b.pm.dot(Sx + Math.cos(ang) * rad, Sy + Math.sin(ang) * rad, Rs * (0.05 + 0.04 * hot), hot > 0.7 ? SUN[2] : SUN[3], 0.85 * sunA, 2.2, ang + Math.PI / 2);
          }
        }
        // Rays streaming off it.
        if (!still)
          for (const p of RAYS) {
            const u = (t * p.speed + p.off) % 1;
            const d = rS * (1.1 + 2.6 * u);
            b.pm.dot(Sx + Math.cos(p.a) * d, Sy + Math.sin(p.a) * d, Rs * p.size * 2, u < 0.3 ? SUN[1] : SUN[2], sunA * (1 - u) * 0.8, 3, p.a);
          }
      }

      // The stars: four light round it, the fifth flies out of the sun.
      const fifthU = still ? 1 : span(t, F.fifth);
      const closed = still || t >= F.count;
      const fade = still ? 1 : 1 - span(t, [F.back[0] - 0.3, F.back[0] + 0.3]);
      const pts = Array.from({ length: 5 }, (_, i) => fusionStar(i, Sx, Sy, Rs, wide));
      for (let i = 0; i < 5; i++) {
        const sp = b.stars[i]!;
        const born = i < 4 ? F.stars[0] + i * 0.15 : F.fifth[0];
        let u = still ? 1 : easeOut(span(t, [born, born + 0.25]));
        let [x, y] = pts[i]!;
        if (i === 4) {
          // The fifth flies along a curve out of the sun, a trail behind it.
          const e = easeInOut(fifthU);
          const mx = (Sx + x) / 2 - (y - Sy) * 0.35;
          const my = (Sy + y) / 2 + (x - Sx) * 0.35;
          const at = (v: number): [number, number] => [(1 - v) * (1 - v) * Sx + 2 * (1 - v) * v * mx + v * v * x, (1 - v) * (1 - v) * Sy + 2 * (1 - v) * v * my + v * v * y];
          [x, y] = at(e);
          u = fifthU > 0 ? 1 : 0;
          if (!still && fifthU > 0 && fifthU < 1)
            for (let j = 1; j <= 18; j++) {
              const v = Math.max(0, e - j * 0.025);
              const [tx, ty] = at(v);
              b.pm.dot(tx, ty, Rs * 0.1 * (1 - j / 20), j < 4 ? WHITE : GOLD, (1 - j / 19) * 0.9);
            }
        }
        sp.visible = u > 0.01 && fade > 0.01;
        if (!sp.visible) continue;
        const tw = 1 + 0.12 * Math.sin(t * 7 + i * 1.7);
        const pop = i === 4 && closed && !still ? 1 + 1.2 * (1 - span(t, [F.count, F.count + 0.35])) : 1;
        sp.position.set(x, y);
        sp.width = sp.height = Rs * 0.55 * u * tw * pop;
        sp.alpha = 0.95 * u * fade;
        // A cross of light through each star.
        const L = Rs * 0.34 * u * tw * pop;
        b.pm.dot(x, y, L * 0.3, WHITE, u * fade, 7, 0);
        b.pm.dot(x, y, L * 0.3, WHITE, u * fade, 7, Math.PI / 2);
        b.pm.dot(x, y, L * 0.22, GOLD, 0.6 * u * fade, 5, Math.PI / 4);
        b.pm.dot(x, y, L * 0.22, GOLD, 0.6 * u * fade, 5, -Math.PI / 4);
      }
      // The pentagon closes: its edges flash, streams of particles run round it.
      if (closed && fade > 0.01) {
        const fl2 = still ? 1 : span(t, [F.count, F.count + 0.45]);
        for (let i = 0; i < 5; i++) {
          const [x1, y1] = pts[i]!;
          const [x2, y2] = pts[(i + 1) % 5]!;
          light
            .moveTo(x1, y1)
            .lineTo(x2, y2)
            .stroke({ width: Math.max(1, Rs * (0.03 + 0.06 * (1 - fl2))), color: fl2 < 1 ? WHITE : GOLD, alpha: (0.35 + 0.5 * (1 - fl2)) * fade });
          if (!still)
            for (const p of EDGE) {
              const u = (t * p.speed + p.off) % 1;
              const nx = -(y2 - y1);
              const ny = x2 - x1;
              const s = Math.sin(u * 20 + p.off * 8) * p.side;
              b.pm.dot(x1 + (x2 - x1) * u + nx * s, y1 + (y2 - y1) * u + ny * s, Rs * p.size * 2, ENERGY[(i + Math.floor(p.off * 3)) % 3]!, 0.85 * fade, 3, Math.atan2(y2 - y1, x2 - x1));
            }
        }
        if (!still && fl2 < 1) light.circle(Sx, Sy, Rs * (1.6 + 1.6 * easeOut(fl2))).stroke({ width: Math.max(1, Rs * 0.07 * (1 - fl2)), color: GOLD, alpha: 0.8 * (1 - fl2) });
      }
      b.pm.end();
    },
  });
}

// ---------------------------------------------------------------------------------------------------------
// Charge Cascade

/** Charge cell i (0-4) over the node: an arc from upper left to upper right; the fifth is the last. */
export function cascadeCell(i: number, Sx: number, Sy: number, Rs: number): [number, number] {
  const a = (-150 + i * 30) * (Math.PI / 180);
  return [Sx + Math.cos(a) * Rs * 2.3, Sy + Math.sin(a) * Rs * 2.3];
}
/** When cell i (0-3) lights; the fifth when it locks. */
export const cellLit = (i: number) => (i < 4 ? CASCADE.cells[0] + 0.3 + i * 0.13 : CASCADE.lock);
/** When cell i flares in the cascade. */
export const cellFlare = (i: number) => CASCADE.cascade[0] + 0.05 + i * 0.11;

const INFLOW = (() => {
  const r = seq(4409);
  return Array.from({ length: 170 }, (_, i) => ({ a: r() * Math.PI * 2, far: 1.2 + r() * 1.6, d: r() * 0.45, c: i % 3, size: 0.03 + r() * 0.05, swirl: (r() - 0.5) * 2.2 }));
})();
const CELLDOTS = (() => {
  const r = seq(6007);
  return Array.from({ length: 22 }, () => ({ off: r(), size: 0.025 + r() * 0.03 }));
})();
const PULSE = (() => {
  const r = seq(1999);
  return Array.from({ length: 140 }, (_, i) => ({ a: (i / 140) * Math.PI * 2 + r() * 0.04, j: (r() - 0.5) * 0.08, c: i % 3, size: 0.04 + r() * 0.05 }));
})();

/** The point at u (0-1) round a hexagon's outline. */
function onHex(pts: [number, number][], u: number): [number, number] {
  const s = (((u % 1) + 1) % 1) * 6;
  const i = Math.floor(s);
  const f = s - i;
  const a = pts[i]!;
  const c = pts[(i + 1) % 6]!;
  return [a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f];
}

/** The crystal's place: over the tile while it forms, then along a curve up into the fifth cell. */
function crystalAt(t: number, Sx: number, Sy: number, Rs: number): [number, number] {
  const [x5, y5] = cascadeCell(4, Sx, Sy, Rs);
  const v = easeInOut(span(t, CASCADE.rise));
  const mx = Sx + Rs * 0.2;
  const my = y5 + Rs * 0.1;
  const y0 = Sy - Rs * 0.05;
  return [(1 - v) * (1 - v) * Sx + 2 * (1 - v) * v * mx + v * v * x5, (1 - v) * (1 - v) * y0 + 2 * (1 - v) * v * my + v * v * y5];
}

/** Charge Cascade as a Field step (and its still picture). */
export function cascadeStep(env: KillEnv, k: KillTarget): Step {
  const C = CASCADE;
  return closeupStep(env, k, {
    times: { total: C.total, zoomIn: C.zoomIn, back: C.back, breakAt: C.rise[0], wreckIn: C.wreckIn, label: C.label, count: C.count, stillAt: C.count + 0.5 },
    size: 0.15,
    hole: 1.5,
    focus: (wide) => (wide ? [0.4, 0.62] : [0.5, 0.56]),
    title: "POWER NODES",
    accent: GOLD,
    ink: 0xfff4c8,
    inkLine: 0x5a3c00,
    build: (back, front) => {
      const plates = new Graphics();
      back.addChild(plates);
      const light = new Graphics();
      light.blendMode = "add";
      back.addChild(light);
      const glows: Sprite[] = Array.from({ length: 5 }, () => glowSprite(back, GOLD));
      const crystal = new Graphics();
      crystal.blendMode = "add";
      front.addChild(crystal);
      const pm = motes(front, 1000);
      const core = glowSprite(front, 0xfff4d0);
      const flash = glowSprite(front, WHITE);
      return { plates, light, glows, crystal, pm, core, flash };
    },
    shake: (t, Rs) => {
      const u = span(t, [C.dump, C.dump + 0.4]);
      const a = u > 0 && u < 1 ? Rs * 0.055 * (1 - u) ** 2 : 0;
      const l = span(t, [C.lock, C.lock + 0.2]);
      const c = l > 0 && l < 1 ? Rs * 0.015 * (1 - l) : 0;
      return [a * Math.sin(u * 47) + c * Math.sin(t * 80), a * Math.cos(u * 39) + c * Math.cos(t * 70)];
    },
    tile: (t) => ({ scale: 1 + 0.06 * span(t, C.condense), alpha: 1 - 0.25 * span(t, C.condense) }),
    sounds: (crossed) => {
      for (let i = 0; i < 4; i++) if (crossed(cellLit(i))) playCascadeCell(i);
      if (crossed(C.lock)) playCascadeLock();
      if (crossed(C.dump)) playCascadeDischarge();
    },
    draw: (f, b) => {
      const { t, still, Sx, Sy, Rs } = f;
      const light = b.light.clear();
      const plates = b.plates.clear();
      const crystal = b.crystal.clear();
      b.pm.begin();
      const rc = Rs * 0.5;
      const cells = Array.from({ length: 5 }, (_, i) => cascadeCell(i, Sx, Sy, Rs));
      const gone = still ? 0 : span(t, [C.dump, C.dump + 0.45]);
      const out = 1 - gone;
      const frame = Math.floor(t * 24);

      // The cells: open, light, flare; they empty into the sector at the discharge.
      for (let i = 0; i < 5; i++) {
        const [x, y] = cells[i]!;
        const open = still ? 1 : easeOut(span(t, [C.cells[0] + i * 0.08, C.cells[0] + i * 0.08 + 0.3]));
        const g = b.glows[i]!;
        if (open <= 0 || out <= 0) {
          g.visible = false;
          continue;
        }
        const r = rc * (0.6 + 0.4 * open);
        const hex = hexCorners(x, y, r);
        const lit = still || t >= cellLit(i);
        const litU = still ? 1 : span(t, [cellLit(i), cellLit(i) + 0.25]);
        const fu = still ? 1 : span(t, [cellFlare(i), cellFlare(i) + 0.3]);
        const flare = fu > 0 && fu < 1 ? 1 - fu : 0;
        const a = open * out;
        // The empty fifth: a slow pulse.
        const empty = !lit ? 0.35 + 0.35 * Math.sin(t * 9) ** 2 : 1;
        // A dark plate under each cell, so it reads as its own thing over the Field.
        plates.poly(flat(hexCorners(x, y, r * 1.08))).fill({ color: 0x07060f, alpha: 0.82 * a });
        light.poly(flat(hex)).stroke({ width: Math.max(1, Rs * 0.025), color: lit ? (flare > 0 ? WHITE : GOLD) : 0x9fb4c8, alpha: a * (lit ? 0.9 : empty) });
        if (lit) light.poly(flat(hexCorners(x, y, r * 0.8))).fill({ color: i === 4 ? 0xfff0b0 : ENERGY[i % 3]!, alpha: a * (0.18 + 0.3 * flare + 0.25 * (1 - litU)) });
        // Particles running round each cell's edge.
        for (const p of CELLDOTS) {
          const [px, py] = onHex(hex, p.off + t * (lit ? 0.5 : 0.15) * (i % 2 ? -1 : 1));
          b.pm.dot(px, py, Rs * p.size * 2 * (1 + flare), lit ? (i === 4 ? WHITE : ENERGY[i % 3]!) : 0x9fb4c8, a * (lit ? 0.9 : empty * 0.6));
        }
        g.visible = lit;
        g.tint = i === 4 ? 0xfff0b0 : ENERGY[i % 3]!;
        g.position.set(x, y);
        g.width = g.height = r * (2.4 + 2.5 * flare + 1.5 * (1 - litU));
        g.alpha = a * (0.55 + 0.45 * flare);
        if (flare > 0 && !still) light.circle(x, y, r * (1 + 1.8 * easeOut(fu))).stroke({ width: Math.max(1, Rs * 0.04 * flare), color: WHITE, alpha: 0.8 * flare });
      }
      // Arcs between the cells as they flare.
      if (!still)
        for (let i = 0; i < 4; i++) {
          const u = span(t, [cellFlare(i), cellFlare(i) + 0.28]);
          if (u <= 0 || u >= 1 || out <= 0) continue;
          const [x1, y1] = cells[i]!;
          const [x2, y2] = cells[i + 1]!;
          const pts = bolt(x1, y1, x2, y2, 900 + i * 31 + frame, 0.22, 8);
          strokePath(light, pts, Math.max(1, Rs * 0.03), WHITE, 0.9 * (1 - u));
          strokePath(light, pts, Math.max(2, Rs * 0.09), GOLD, 0.3 * (1 - u));
          for (let j = 1; j < pts.length - 1; j++) b.pm.dot(pts[j]![0], pts[j]![1], Rs * 0.08, WHITE, 1 - u);
        }

      // Act 2: energy condenses into the crystal; it rises into the fifth cell.
      const cond = still ? 0 : span(t, C.condense);
      if (!still && t > C.condense[0] - 0.1 && t < C.rise[0] + 0.1) {
        for (const p of INFLOW) {
          const u = span(t, [C.condense[0] + p.d * (C.condense[1] - C.condense[0] - 0.35), C.condense[0] + p.d * (C.condense[1] - C.condense[0] - 0.35) + 0.4]);
          if (u <= 0 || u >= 1) continue;
          const e = easeInOut(u);
          const a = p.a + p.swirl * e;
          const d = Rs * p.far * (1 - e);
          b.pm.dot(Sx + Math.cos(a) * d, Sy - Rs * 0.05 + Math.sin(a) * d, Rs * p.size * 2, ENERGY[p.c]!, Math.sin(Math.PI * u), 3, a + Math.PI);
        }
      }
      const rising = still ? false : t >= C.rise[0] && t < C.lock;
      const formed = !still && t >= C.condense[0] && t < C.lock;
      if (formed) {
        const [cx, cy] = crystalAt(t, Sx, Sy, Rs);
        const size = Rs * (0.08 + 0.2 * easeOut(cond)) * (rising ? 1 - 0.2 * span(t, C.rise) : 1);
        const spin = t * 2.6;
        // Six facets in the three colours, turning; a white heart.
        for (let i = 0; i < 6; i++) {
          const a1 = spin + (i * Math.PI) / 3;
          const a2 = a1 + Math.PI / 3;
          crystal.poly([cx, cy, cx + Math.cos(a1) * size, cy + Math.sin(a1) * size * 1.25, cx + Math.cos(a2) * size, cy + Math.sin(a2) * size * 1.25]).fill({ color: ENERGY[i % 3]!, alpha: 0.55 });
        }
        crystal.poly(flat(Array.from({ length: 6 }, (_, i) => [cx + Math.cos(spin + (i * Math.PI) / 3) * size, cy + Math.sin(spin + (i * Math.PI) / 3) * size * 1.25] as [number, number]))).stroke({ width: Math.max(1, Rs * 0.02), color: WHITE, alpha: 0.85 });
        b.core.visible = true;
        b.core.position.set(cx, cy);
        b.core.width = b.core.height = size * 4.2;
        b.core.alpha = 0.9;
        // Its trail as it rises.
        if (rising)
          for (let j = 1; j <= 22; j++) {
            const [tx, ty] = crystalAt(t - j * 0.018, Sx, Sy, Rs);
            b.pm.dot(tx + Math.sin(j * 1.7 + t * 20) * Rs * 0.03, ty, Rs * 0.09 * (1 - j / 24), ENERGY[j % 3]!, 0.9 * (1 - j / 23), 2, -Math.PI / 2);
          }
      } else b.core.visible = false;

      // Act 4: the discharge: five bolts down into the sector, a flash, a pulse over the whole Field.
      if (!still && t >= C.dump) {
        const u = span(t, [C.dump, C.dump + 0.35]);
        if (u < 1)
          for (let i = 0; i < 5; i++) {
            const [x, y] = cells[i]!;
            const pts = bolt(x, y, Sx, Sy, 1300 + i * 17 + frame, 0.16, 9);
            strokePath(light, pts, Math.max(1.5, Rs * 0.04), WHITE, 1 - u);
            strokePath(light, pts, Math.max(3, Rs * 0.12), i === 4 ? GOLD : ENERGY[i % 3]!, 0.35 * (1 - u));
            for (let j = 1; j < pts.length; j++) b.pm.dot(pts[j]![0], pts[j]![1], Rs * 0.09, WHITE, 1 - u);
          }
        const fl = span(t, [C.dump + 0.1, C.dump + 0.55]);
        b.flash.visible = fl > 0 && fl < 1;
        b.flash.position.set(Sx, Sy);
        b.flash.width = b.flash.height = Rs * (1.5 + 3.5 * easeOut(fl));
        b.flash.alpha = (1 - fl) ** 1.5;
        // The pulse: a ring of particles out over the Field; each sector's edge flickers as it passes.
        const pu = span(t, C.pulse);
        if (pu > 0 && pu < 1) {
          const far = Math.max(Math.hypot(Sx, Sy), Math.hypot(f.w - Sx, Sy), Math.hypot(Sx, f.h - Sy), Math.hypot(f.w - Sx, f.h - Sy)) + Rs;
          const rr = Rs * 0.8 + (far - Rs * 0.8) * easeOut(pu);
          for (const p of PULSE) {
            const rj = rr * (1 + p.j);
            b.pm.dot(Sx + Math.cos(p.a) * rj, Sy + Math.sin(p.a) * rj, Rs * p.size * 2.4, ENERGY[p.c]!, 0.9 * (1 - pu), 3, p.a + Math.PI / 2);
          }
          for (const [, x0, y0] of env.centres?.() ?? []) {
            const x = Sx + (x0 - f.cx) * f.z;
            const y = Sy + (y0 - f.cy) * f.z;
            const d = Math.hypot(x - Sx, y - Sy);
            const hit = 1 - Math.min(1, Math.abs(d - rr) / (Rs * 0.9));
            if (hit > 0.02) light.poly(flat(hexCorners(x, y, Rs * 0.98))).stroke({ width: Math.max(1, Rs * 0.04), color: GOLD, alpha: 0.75 * hit * (1 - pu) });
          }
        }
      } else b.flash.visible = false;

      // The still picture: five lit cells over the sector, a ring of gold round it.
      if (still) light.poly(flat(hexCorners(Sx, Sy, Rs * 1.02))).stroke({ width: 3, color: GOLD, alpha: 0.7 });
      b.pm.end();
    },
  });
}
