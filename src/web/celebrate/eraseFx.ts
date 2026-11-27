/**
 * Alpha Erased, the fourth kill for Alpha (designer 2026-11-27: "Make 2 animations for Alpha unit
 * elimination"), drawn on the Field (PixiJS) in the close-up every kill shares (closeup.ts). About 4.6 s,
 * as the other Alpha kills, a different act: the unit is taken apart, not blown apart.
 *
 * 1. Project (0-0.85 s): the zoom; corner brackets close in and a grid of points is projected over the
 *    tile from its middle outwards; they lock (playTargetLock).
 * 2. Scan (0.85-1.82 s): a bar of light sweeps the tile left to right (playEraseScan); behind it the
 *    unit is turned into a lattice of particles holding its shape and its glyph as a see-through ghost;
 *    the tile itself is gone once the bar has passed; the lattice holds and trembles.
 * 3. Unravel (1.82-3.7 s): the particles peel off from the left (playEraseUnravel), each pulled away on a
 *    wind that curls (streams that twist and thin out), blue, then ice, then gone; the Wreck shows again
 *    (4.8) under a fading afterimage of the grid; "ALPHA ERASED · 5 / 6" to "6 / 6".
 * 4. Back (3.7-4.6 s): the zoom eases back.
 *
 * Energy is drawn with particles (designer 2026-11-20). The same for every Company (I25). Screen only:
 * nothing here is a rule.
 */

import { Graphics, Sprite } from "pixi.js";
import type { Step } from "../anim.js";
import { easeInOut, easeOut } from "../anim.js";
import { playEraseScan, playEraseUnravel, playTargetLock } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, closeupStep, glowSprite, hexCorners, motes, seq } from "./closeup.js";
import { ERASE, span } from "./timeline.js";

const BLUE = 0x5b8cff;
const ICE = 0xdfeaff;
const LILAC = 0xb69cff;

/** Is (x, y) inside a pointy-top hex of radius r round (0, 0)? */
function inHex(x: number, y: number, r: number): boolean {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  return ax <= (Math.sqrt(3) / 2) * r && ay <= r - ax / Math.sqrt(3);
}
/** Half the height of a pointy-top hex of radius r at a distance dx across from its middle. */
export function hexHalfHeight(r: number, dx: number): number {
  const a = Math.abs(dx);
  const half = (Math.sqrt(3) / 2) * r;
  return a > half ? 0 : r - a / Math.sqrt(3);
}

/** The lattice (tile radii): points on a triangular grid inside the hex, each with when it leaves and how. */
export const LATTICE = (() => {
  const r = seq(6029);
  const s = 0.085;
  const out: { x: number; y: number; leave: number; v: number; up: number; curl: number; ph: number; life: number; size: number; hue: number }[] = [];
  for (let row = -14; row <= 14; row++)
    for (let col = -14; col <= 14; col++) {
      const x = (col + (row % 2 ? 0.5 : 0)) * s;
      const y = row * s * 0.866;
      if (!inHex(x, y, 0.94)) continue;
      // Left first; a ragged front.
      const xs = (x + 0.82) / 1.64;
      out.push({
        x,
        y,
        leave: ERASE.unravel[0] + 0.55 * xs + (r() - 0.5) * 0.1,
        v: 0.6 + r() * 1.1,
        up: (r() - 0.6) * 1.2,
        curl: 2.5 + r() * 3,
        ph: r() * 6.283,
        life: 0.8 + r() * 0.45,
        size: 0.75 + r() * 0.6,
        hue: r(),
      });
    }
  return out;
})();
/** Where the scan bar is (tile radii across the tile, -1.05 to 1.05) at time t. */
export function barAt(t: number): number {
  return -1.05 + 2.1 * easeInOut(span(t, ERASE.scan));
}
/** Where lattice point p is (tile radii from the middle) at time t, and how bright (0 = gone). */
export function latticeAt(p: (typeof LATTICE)[number], t: number): { x: number; y: number; a: number; moving: number; dir: number } {
  if (barAt(t) < p.x) return { x: p.x, y: p.y, a: 0, moving: 0, dir: 0 };
  const age = t - p.leave;
  if (age <= 0) {
    // Holding: a tremble that grows until it goes.
    const tr = 0.012 * span(t, ERASE.hold) * Math.sin(t * 47 + p.ph);
    return { x: p.x + tr, y: p.y - tr * 0.7, a: 1, moving: 0, dir: 0 };
  }
  if (age > p.life) return { x: p.x, y: p.y, a: 0, moving: 0, dir: 0 };
  // Away on the wind to the right, rising or sinking a little, curling.
  const run = p.v * (0.9 * age + 2.6 * age * age);
  const curl = 0.22 * age * Math.sin(p.curl * age * 2 + p.ph + p.y * 4);
  const x = p.x + run;
  const y = p.y + p.up * age * 0.8 + curl;
  const vx = p.v * (0.9 + 5.2 * age);
  const vy = p.up * 0.8 + 0.22 * Math.sin(p.curl * age * 2 + p.ph + p.y * 4) + 0.44 * p.curl * age * Math.cos(p.curl * age * 2 + p.ph + p.y * 4);
  return { x, y, a: (1 - age / p.life) ** 1.3, moving: Math.min(1, age * 4), dir: Math.atan2(vy, vx) };
}

/** Alpha Erased as a Field step (and its still picture for reduced motion and Instant). */
export function alphaEraseStep(env: KillEnv, k: KillTarget): Step {
  return closeupStep(env, k, {
    times: { total: ERASE.total, zoomIn: ERASE.zoomIn, back: ERASE.back, breakAt: ERASE.hold[0], wreckIn: ERASE.wreckIn, label: ERASE.label, count: ERASE.count, stillAt: ERASE.count + 0.5 },
    title: `${k.name.toUpperCase()} ERASED`,
    accent: BLUE,
    ink: ICE,
    inkLine: 0x0f1f4a,
    build: (back, front) => {
      const lines = new Graphics();
      lines.blendMode = "add";
      back.addChild(lines);
      const tex = env.badge(k.unitId);
      const glyph = tex ? new Sprite({ texture: tex, anchor: 0.5 }) : undefined;
      const mask = new Graphics();
      if (glyph) {
        glyph.blendMode = "add";
        glyph.tint = LILAC;
        glyph.mask = mask;
        back.addChild(glyph, mask);
      }
      const bar = glowSprite(front, BLUE);
      const barCore = glowSprite(front, ICE);
      const pm = motes(front, 1100);
      return { lines, glyph, mask, bar, barCore, pm };
    },
    shake: (t, Rs) => {
      const a = t - ERASE.hold[0];
      if (a < 0 || a > ERASE.hold[1] - ERASE.hold[0] + 0.1) return [0, 0];
      const amp = Rs * 0.012 * Math.min(1, a / 0.15);
      return [amp * Math.sin(a * 90), amp * Math.cos(a * 77)];
    },
    dark: (t) => 1 + 0.08 * span(t, ERASE.scan) * (1 - span(t, ERASE.unravel)),
    tile: (t) => {
      // Gone where the bar has passed: the tile fades as the bar crosses it, a little behind.
      const u = span(t, [ERASE.scan[0] + 0.15, ERASE.scan[1]]);
      return { scale: 1, alpha: 1 - easeInOut(u) };
    },
    sounds: (crossed) => {
      if (crossed(ERASE.lock)) playTargetLock();
      if (crossed(ERASE.scan[0])) playEraseScan();
      if (crossed(ERASE.unravel[0])) playEraseUnravel();
    },
    draw: (f, b) => {
      const { t, still, fade, Sx, Sy, Rs } = f;
      const lines = b.lines.clear();
      const mask = b.mask.clear();
      const pm = b.pm;
      pm.begin();
      const dotR = Math.max(1.6, Rs * 0.05);

      // The brackets: four corners closing in, locking with a flash.
      const gu = still ? 1 : span(t, ERASE.grid);
      const lockF = !still && t >= ERASE.lock ? Math.max(0, 1 - (t - ERASE.lock) / 0.35) : 0;
      const bracketsOff = still ? 1 : span(t, [ERASE.unravel[0], ERASE.unravel[0] + 0.5]);
      if (gu > 0 && bracketsOff < 1) {
        const bs = Rs * (1.7 - 0.5 * easeOut(gu));
        const arm = Rs * 0.32;
        const al = Math.min(1, gu * 2) * (1 - bracketsOff) * (still ? 0.6 * fade : 1);
        for (const [sx, sy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ] as const) {
          const cx = Sx + sx * bs;
          const cy = Sy + sy * bs * 0.9;
          for (let m = 0; m <= 6; m++) {
            const d = (m / 6) * arm;
            pm.dot(cx - sx * d, cy, Math.max(2, Rs * 0.05), m === 0 ? 0xffffff : BLUE, al);
            if (m) pm.dot(cx, cy - sy * d, Math.max(2, Rs * 0.05), BLUE, al);
          }
          if (lockF > 0) pm.dot(cx, cy, Rs * 0.25 * lockF, ICE, lockF);
        }
      }

      // The projected grid: points over the tile, from the middle outwards; faint ahead of the bar.
      const bx = still ? 1.05 : barAt(t);
      const unravelled = still ? 1 : span(t, ERASE.unravel);
      if (gu > 0 && !still) {
        for (const p of LATTICE) {
          if (p.x <= bx) continue;
          const d = Math.hypot(p.x, p.y);
          const show = span(gu, [d * 0.7, d * 0.7 + 0.3]);
          if (show <= 0) continue;
          pm.dot(Sx + p.x * Rs, Sy + p.y * Rs, dotR * 0.7, BLUE, 0.35 * show + 0.5 * lockF);
        }
      }

      // The scan bar: a tall glow and a column of particles as high as the hex where it stands.
      const scanning = !still && t >= ERASE.scan[0] && t < ERASE.scan[1] + 0.1;
      b.bar.visible = b.barCore.visible = scanning;
      if (scanning) {
        const hh = Math.max(0.3, hexHalfHeight(1, bx)) * Rs;
        const out = 1 - span(t, [ERASE.scan[1] - 0.05, ERASE.scan[1] + 0.1]);
        const x = Sx + bx * Rs;
        b.bar.position.set(x, Sy);
        b.bar.width = Rs * 0.45;
        b.bar.height = hh * 2.6;
        b.bar.alpha = 0.6 * out;
        b.barCore.position.set(x, Sy);
        b.barCore.width = Rs * 0.1;
        b.barCore.height = hh * 2.3;
        b.barCore.alpha = 0.95 * out;
        const n = 26;
        for (let j = 0; j <= n; j++) {
          const y = Sy - hh * 1.08 + (2.16 * hh * j) / n;
          const fl = 0.6 + 0.4 * Math.sin(t * 60 + j * 1.7);
          pm.dot(x, y, Math.max(2, Rs * 0.06), j % 2 ? 0xffffff : ICE, out * fl, 1.8, Math.PI / 2);
        }
        // Sparks thrown back off the bar.
        const tick = Math.floor(t / 0.04);
        const rnd = seq(tick * 97 + 3);
        for (let j = 0; j < 10; j++) {
          const y = Sy + (rnd() - 0.5) * 2 * hh;
          const age = t - tick * 0.04 + rnd() * 0.08;
          pm.dot(x - Rs * (0.05 + 1.6 * age), y + (rnd() - 0.5) * Rs * 0.2, Math.max(1.6, Rs * 0.035), LILAC, out * (1 - age / 0.12), 3, Math.PI);
        }
      }

      // The lattice: behind the bar, the unit as particles; it holds, trembles, and unravels on the wind.
      if (!still) {
        for (const p of LATTICE) {
          const at = latticeAt(p, t);
          if (at.a <= 0.01) continue;
          const hot = p.x > bx - 0.15 ? 1 - (bx - p.x) / 0.15 : 0;
          const tint = at.moving > 0 ? (at.moving > 0.6 ? (p.hue < 0.5 ? ICE : BLUE) : LILAC) : hot > 0 ? 0xffffff : p.hue < 0.3 ? ICE : p.hue < 0.75 ? LILAC : BLUE;
          const size = dotR * p.size * (1 + 0.6 * hot) * (1 - 0.4 * at.moving);
          pm.dot(Sx + at.x * Rs, Sy + at.y * Rs, size, tint, at.a * (0.65 + 0.35 * hot), 1 + 4 * at.moving, at.dir);
        }
      } else {
        // The still picture: the afterimage of the grid over the Wreck, a few streams leaving to the right.
        for (const [i, p] of LATTICE.entries()) {
          if (i % 3) continue;
          pm.dot(Sx + p.x * Rs, Sy + p.y * Rs, dotR * 0.6, BLUE, 0.25 * fade);
        }
        for (const [i, p] of LATTICE.entries()) {
          if (i % 9) continue;
          const at = latticeAt(p, p.leave + 0.35);
          pm.dot(Sx + at.x * Rs, Sy + at.y * Rs, dotR * p.size * 0.8, ICE, 0.6 * fade, 4, at.dir);
        }
      }

      // The ghost of the glyph, shown only where the bar has passed; it fades as the lattice unravels.
      if (b.glyph) {
        const gs = !still && t >= ERASE.scan[0] ? 1 - unravelled : 0;
        b.glyph.visible = gs > 0.01;
        if (b.glyph.visible) {
          b.glyph.position.set(Sx + Math.sin(t * 31) * Rs * 0.01 * span(t, ERASE.hold), Sy);
          const H = Rs * 1.05;
          b.glyph.height = H;
          b.glyph.width = H * (b.glyph.texture.width / Math.max(1, b.glyph.texture.height));
          b.glyph.alpha = 0.55 * gs * (0.85 + 0.15 * Math.sin(t * 23));
          mask.rect(Sx - Rs * 1.2, Sy - Rs * 1.2, Math.max(0, (bx + 1.2) * Rs - Rs * 1.6 * unravelled), Rs * 2.4).fill({ color: 0xffffff });
        }
      }

      // The tile's outline as particles of light, traced behind the bar, fading as it unravels; an
      // afterimage over the Wreck.
      const traced = still ? 1 : span(t, ERASE.scan);
      const rim = still ? 0.35 * fade : traced * (1 - 0.75 * unravelled) * (1 - span(t, [ERASE.back[0], ERASE.back[0] + 0.4]));
      if (rim > 0.01) {
        const cs = hexCorners(Sx, Sy, Rs * 0.98);
        for (let i = 0; i < 6; i++) {
          const a = cs[i]!;
          const c = cs[(i + 1) % 6]!;
          for (let m = 0; m < 12; m++) {
            const x = a[0] + ((c[0] - a[0]) * m) / 12;
            const y = a[1] + ((c[1] - a[1]) * m) / 12;
            if ((x - Sx) / Rs > bx) continue;
            pm.dot(x, y, Math.max(2, Rs * 0.045), m % 3 ? BLUE : ICE, rim * 0.9);
          }
        }
        lines.poly(cs.flat()).stroke({ width: Math.max(3, Rs * 0.08), color: BLUE, alpha: 0.15 * rim });
      }
      pm.end();
    },
  });
}
