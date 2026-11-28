/**
 * Tether Rip, the sixth kill for Alpha (designer 2026-11-28: "Create 2 additional animations for eliminating
 * the Alpha unit"), drawn on the Field (PixiJS) in the close-up every kill shares (closeup.ts). About 4.6 s,
 * as the other Alpha kills, and a different act: the unit is caught and torn apart.
 *
 * 1. Hooks (0-1.0 s): the zoom; three harpoons shoot in one after another from beyond the Field's edge,
 *    each trailing a slack tether of particles, and bite into three corners of the tile (playTetherHook):
 *    a clamp ring, a spit of sparks, the tile jolts.
 * 2. Strain (1.0-1.95 s): the tethers pull taut and thrum (playTetherStrain), brightening from cyan to
 *    white; cracks of light run from the middle of the tile out to the three corners between the hooks;
 *    the tile trembles.
 * 3. Rip (1.95-3.0 s): it is torn into three pieces (playTetherRip), each yanked away along its tether,
 *    turning, and off the screen; sparks spray from the torn edges, a small ring, a hard shake; the tethers
 *    whip and fade; the Wreck shows again (4.8); "ALPHA TORN · 5 / 6" to "6 / 6".
 * 4. Back (3.7-4.6 s): the zoom eases back.
 *
 * Energy is drawn with particles (designer 2026-11-20). The same for every Company (I25). Less than any Beta
 * kill (one unit, no knock-back). Screen only: nothing here is a rule.
 */

import { Container, Graphics, Sprite } from "pixi.js";
import type { Step } from "../anim.js";
import { easeOut } from "../anim.js";
import { playTetherHook, playTetherRip, playTetherStrain } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, closeupStep, glowSprite, hexCorners, motes, seq } from "./closeup.js";
import { TETHER, span } from "./timeline.js";

const CYAN = 0x6fe3ff;
const ICE = 0xe6fbff;
const VIOLET = 0xb48cff;
const AMBER = 0xffc061;
/** The Omega tiles' colour (glyphs.ts TYPE_COLOUR), a little darker: the torn pieces. */
const PLATE = 0x8a5cc8;
const PLATE_EDGE = 0x5b3a8f;

/** The three corners hooked (of the six, as hexCorners counts them: 0 upper right, 2 bottom, 4 upper left). */
export const HOOKED = [0, 2, 4] as const;
/** Which way the hook at corner c pulls (radians, screen): straight out through that corner. */
export const pullAngle = (c: number) => (Math.PI / 180) * (60 * c - 30);
/** When harpoon i bites. */
export const hookAt = (i: number) => TETHER.shots[i]! + TETHER.flight;

/** How slack the tethers are (1 slack, 0 taut) at time t. */
export function slack(t: number): number {
  return 1 - easeOut(span(t, TETHER.taut));
}
/** How far piece i has been yanked out along its tether at time t (tile radii; 0 before the rip). */
export function pieceOut(i: number, t: number): number {
  const a = t - TETHER.rip;
  if (a <= 0) return 0;
  return 0.1 + (0.7 + 0.1 * i) * a + (6.5 + 0.8 * i) * a * a;
}

/** The pieces' turns once torn (radians per second squared). */
const SPIN = [2.2, -2.8, 2.5];
/** Sparks from the torn edges: on cut line c (0-2) at share u from the middle, flying off to one side. */
const SPRAY = (() => {
  const r = seq(6029);
  return Array.from({ length: 150 }, () => ({ c: Math.floor(r() * 3), u: 0.08 + r() * 0.9, side: r() < 0.5 ? -1 : 1, v: 2 + r() * 6, k: 2.5 + r() * 2.5, life: 0.35 + r() * 0.6, size: 0.03 + r() * 0.05 }));
})();
const easeIn = (p: number) => p * p;
const dragged = (v: number, k: number, age: number) => (v * (1 - Math.exp(-k * age))) / k;

/** Tether Rip as a Field step (and its still picture for reduced motion and Instant). */
export function alphaTetherStep(env: KillEnv, k: KillTarget): Step {
  return closeupStep(env, k, {
    times: { total: TETHER.total, zoomIn: TETHER.zoomIn, back: TETHER.back, breakAt: TETHER.rip, wreckIn: TETHER.wreckIn, label: TETHER.label, count: TETHER.count, stillAt: TETHER.count + 0.5 },
    title: `${k.name.toUpperCase()} TORN`,
    accent: CYAN,
    ink: ICE,
    inkLine: 0x0b2a3a,
    hole: 1.3,
    build: (back, front) => {
      const tex = env.badge(k.unitId);
      // The three pieces: a dark plate with a lit torn edge and its share of the glyph, each masked to its wedge.
      const pieces = HOOKED.map(() => {
        const c = new Container();
        c.visible = false;
        const plate = new Graphics();
        const mask = new Graphics();
        c.addChild(plate);
        let glyph: Sprite | undefined;
        if (tex) {
          glyph = new Sprite({ texture: tex, anchor: 0.5 });
          glyph.mask = mask;
          c.addChild(glyph, mask);
        }
        const edge = new Graphics();
        edge.blendMode = "add";
        c.addChild(edge);
        back.addChild(c);
        return { c, plate, mask, glyph, edge };
      });
      const lines = new Graphics();
      lines.blendMode = "add";
      front.addChild(lines);
      const flash = glowSprite(front, ICE);
      const scar = glowSprite(back, CYAN);
      const pm = motes(front, 1000);
      return { pieces, lines, flash, scar, pm };
    },
    shake: (t, Rs) => {
      let x = 0;
      let y = 0;
      // A jolt along each hook as it bites, a tremble while it strains, a hard shake at the rip.
      HOOKED.forEach((c, i) => {
        const a = t - hookAt(i);
        if (a < 0 || a > 0.3) return;
        const kick = Rs * 0.04 * Math.exp(-a / 0.06);
        x -= Math.cos(pullAngle(c)) * kick;
        y -= Math.sin(pullAngle(c)) * kick;
      });
      const strain = span(t, TETHER.taut) * (t < TETHER.rip ? 1 : 0);
      x += Rs * 0.012 * strain * Math.sin(t * 97);
      y += Rs * 0.012 * strain * Math.cos(t * 89);
      const a = t - TETHER.rip;
      if (a >= 0 && a < 0.5) {
        const amp = Rs * 0.08 * Math.exp(-a / 0.1);
        x += amp * Math.sin(a * 60);
        y += amp * Math.cos(a * 53);
      }
      return [x, y];
    },
    dark: (t) => 1 - 0.25 * Math.max(0, 1 - Math.abs(t - TETHER.rip - 0.04) / 0.3),
    tile: (t) => {
      // A small jolt as each hook bites; it swells a little under the strain.
      let s = 1;
      HOOKED.forEach((_, i) => {
        const a = t - hookAt(i);
        if (a >= 0 && a < 0.25) s += 0.03 * Math.exp(-a / 0.07);
      });
      return { scale: s + 0.035 * span(t, TETHER.cracks), alpha: 1 };
    },
    sounds: (crossed) => {
      HOOKED.forEach((_, i) => {
        if (crossed(hookAt(i))) playTetherHook(i);
      });
      if (crossed(TETHER.taut[0])) playTetherStrain();
      if (crossed(TETHER.rip)) playTetherRip();
    },
    draw: (f, b) => {
      const { t, still, fade, Sx, Sy, Rs, w, h, broke } = f;
      const lines = b.lines.clear();
      const pm = b.pm;
      pm.begin();
      const far = (Math.hypot(w, h) + Rs) / Rs;
      const cs = hexCorners(Sx, Sy, Rs);
      const sl = slack(t);
      const taut = 1 - sl;
      const age = t - TETHER.rip;
      const gone = still ? 1 : span(t, [TETHER.rip + 0.45, TETHER.fling[1]]);

      // The tethers and the harpoons.
      HOOKED.forEach((c, i) => {
        const ang = pullAngle(c);
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        const nx = -dy;
        const ny = dx;
        const launched = t - TETHER.shots[i]!;
        if (still || launched < 0 || gone >= 1) return;
        // Where the near end is: the harpoon's head in flight, then the corner, then out with its piece.
        const fu = Math.min(1, launched / TETHER.flight);
        const out = pieceOut(i, t);
        const [cx0, cy0] = cs[c]!;
        const nearD = fu < 1 ? 1 + (far - 1) * (1 - easeIn(fu)) : 1 + out;
        const hx = fu < 1 ? Sx + dx * Rs * nearD : cx0 + dx * Rs * out;
        const hy = fu < 1 ? Sy + dy * Rs * nearD : cy0 + dy * Rs * out;
        const len = Math.max(0.01, far - nearD);
        // Slack: a sag across the tether; once taut, a fast thrum; after the rip, a whip running out along it.
        const whip = age >= 0 ? Math.exp(-age / 0.25) : 0;
        const amp = Rs * (0.32 * sl * fu + 0.035 * taut * (age < 0 ? 1 : 0) * Math.sin(t * 95 + i) + 0.4 * whip);
        const al = (0.55 + 0.45 * taut) * (1 - gone);
        const step = 0.15;
        for (let d = 0; d < len; d += step) {
          const u = d / len;
          const env2 = Math.sin(Math.PI * Math.min(1, u * 1.15));
          const wave = age >= 0 ? Math.sin(u * 14 - age * 30) * env2 : Math.sin(Math.PI * u + i) * env2;
          const x = hx + dx * Rs * d + nx * amp * wave;
          const y = hy + dy * Rs * d + ny * amp * wave;
          const fl = 0.6 + 0.4 * Math.sin(d * 7 - t * 25 + i);
          const tint = taut > 0.6 || (fu < 1 && d < 0.6) ? ICE : i === 1 ? VIOLET : CYAN;
          pm.dot(x, y, Math.max(1.8, Rs * (0.05 + 0.025 * taut)), tint, al * fl, 2, ang);
        }
        // The harpoon's head: bright, drawn long, with three barbs.
        pm.dot(hx, hy, Rs * (fu < 1 ? 0.2 : 0.14), 0xffffff, 0.95 * (1 - gone), fu < 1 ? 3.2 : 1.6, ang);
        for (const s of [-1, 0, 1]) {
          const ba = ang + Math.PI + s * 0.55;
          for (let m = 1; m <= 3; m++) pm.dot(hx + Math.cos(ba) * Rs * 0.07 * m, hy + Math.sin(ba) * Rs * 0.07 * m, Math.max(1.6, Rs * 0.04), AMBER, 0.85 * (1 - gone), 1.6, ba);
        }
        // The bite: a clamp ring and a spit of sparks.
        const ba = t - hookAt(i);
        if (ba >= 0 && ba < 0.45) {
          const u = ba / 0.45;
          const rr = Rs * (0.12 + 0.45 * easeOut(u));
          for (let j = 0; j < 24; j++) {
            const a2 = (j / 24) * Math.PI * 2;
            pm.dot(cx0 + Math.cos(a2) * rr, cy0 + Math.sin(a2) * rr, Math.max(1.8, Rs * 0.045), u < 0.3 ? 0xffffff : CYAN, (1 - u) ** 1.3, 2, a2 + Math.PI / 2);
          }
          const rnd = seq(301 + i * 17);
          for (let j = 0; j < 16; j++) {
            const a2 = ang + Math.PI + (rnd() - 0.5) * 2.2;
            const d = Rs * dragged(2 + rnd() * 4, 4, ba);
            pm.dot(cx0 + Math.cos(a2) * d, cy0 + Math.sin(a2) * d, Math.max(1.6, Rs * 0.035), AMBER, 1 - u, 2.5, a2);
          }
        }
        // A steady clamp glow while it holds.
        if (ba >= 0 && age < 0) pm.dot(cx0, cy0, Rs * (0.22 + 0.08 * taut), CYAN, 0.35 + 0.35 * taut);
      });

      // The cracks: from the middle out to the three corners between the hooks, growing, flickering.
      const cu = still ? 0 : span(t, TETHER.cracks);
      if (!broke && cu > 0) {
        for (let j = 0; j < 3; j++) {
          const [ex, ey] = cs[(HOOKED[j]! + 1) % 6]!;
          const reach = easeOut(cu);
          const n = 16;
          let px = Sx;
          let py = Sy;
          for (let m = 1; m <= n * reach; m++) {
            const u = m / n;
            const jit = (Math.sin(m * 1.3 + j * 2 + Math.floor(t * 20) * 0.7) + 0.5 * Math.sin(m * 2.9 + j)) * Rs * 0.018;
            const x = Sx + (ex - Sx) * u + jit;
            const y = Sy + (ey - Sy) * u - jit;
            lines.moveTo(px, py).lineTo(x, y).stroke({ width: Math.max(1.2, Rs * 0.025), color: 0xffffff, alpha: 0.8 });
            pm.dot(x, y, Math.max(2, Rs * 0.07), m > n * reach - 2 ? 0xffffff : VIOLET, 0.75, 1.5, Math.atan2(ey - Sy, ex - Sx));
            px = x;
            py = y;
          }
        }
        pm.dot(Sx, Sy, Rs * (0.3 + 0.3 * cu), VIOLET, 0.3 + 0.4 * cu);
      }

      // The pieces, torn away along their tethers, turning, fading.
      b.pieces.forEach((p, i) => {
        const on = !still && age >= 0 && gone < 1;
        p.c.visible = on;
        if (!on) return;
        const c = HOOKED[i]!;
        const ang = pullAngle(c);
        const out = pieceOut(i, t);
        p.c.position.set(Sx + Math.cos(ang) * Rs * out, Sy + Math.sin(ang) * Rs * out);
        p.c.rotation = SPIN[i]! * age * age;
        p.c.alpha = 1 - gone;
        // The wedge round the origin: the middle, the corner before, the hooked one, the one after.
        const loc = hexCorners(0, 0, Rs);
        const wedge = [[0, 0], loc[(c + 5) % 6]!, loc[c]!, loc[(c + 1) % 6]!].flat();
        p.plate.clear().poly(wedge).fill({ color: PLATE, alpha: 1 }).stroke({ width: Math.max(1.5, Rs * 0.04), color: PLATE_EDGE, alpha: 1 });
        p.mask.clear().poly(wedge).fill({ color: 0xffffff });
        if (p.glyph) {
          const H = Rs * 0.7;
          p.glyph.height = H;
          p.glyph.width = H * (p.glyph.texture.width / Math.max(1, p.glyph.texture.height));
          p.glyph.alpha = 0.9;
        }
        // The torn edges (from the middle to the corners before and after) glow and cool.
        const hot = Math.exp(-age / 0.35);
        const [ax, ay] = loc[(c + 5) % 6]!;
        const [bx, by] = loc[(c + 1) % 6]!;
        p.edge.clear().moveTo(ax, ay).lineTo(0, 0).lineTo(bx, by).stroke({ width: Math.max(1.5, Rs * 0.035), color: hot > 0.5 ? 0xffffff : VIOLET, alpha: 0.25 + 0.65 * hot });
      });

      // The rip: a flash, a small ring, sparks off the torn edges.
      const fl = !still && age >= 0 ? span(t, [TETHER.rip, TETHER.rip + 0.28]) : 1;
      b.flash.visible = fl < 1;
      if (fl < 1) {
        b.flash.position.set(Sx, Sy);
        b.flash.width = b.flash.height = Rs * (2 + 3 * easeOut(fl));
        b.flash.alpha = (1 - fl) ** 1.5;
      }
      if (!still && age >= 0 && age < 0.5) {
        const u = age / 0.5;
        const rr = Rs * (0.4 + 2.4 * easeOut(u));
        for (let j = 0; j < 48; j++) {
          const a2 = (j / 48) * Math.PI * 2;
          pm.dot(Sx + Math.cos(a2) * rr, Sy + Math.sin(a2) * rr, Math.max(2, Rs * 0.05), u < 0.3 ? 0xffffff : CYAN, (1 - u) ** 1.4, 2.2, a2 + Math.PI / 2);
        }
      }
      if (!still && age >= 0) {
        for (const s of SPRAY) {
          if (age > s.life) continue;
          const [ex, ey] = cs[(HOOKED[s.c]! + 1) % 6]!;
          const x0 = Sx + (ex - Sx) * s.u;
          const y0 = Sy + (ey - Sy) * s.u;
          const la = Math.atan2(ey - Sy, ex - Sx) + (s.side * Math.PI) / 2;
          const d = Rs * dragged(s.v, s.k, age);
          const u = age / s.life;
          pm.dot(x0 + Math.cos(la) * d, y0 + Math.sin(la) * d, Math.max(1.6, Rs * s.size), u < 0.25 ? 0xffffff : u < 0.6 ? AMBER : VIOLET, (1 - u) ** 1.2, 1 + Math.min(4, s.v * Math.exp(-s.k * age) * 0.6), la);
        }
      }
      // The scar it leaves: a faint glow over the Wreck that fades (a little of it in the still picture).
      const sg = still ? 0.35 * fade : broke ? 1 - span(t, [TETHER.rip, TETHER.back[0]]) : 0;
      b.scar.visible = sg > 0.01;
      if (b.scar.visible) {
        b.scar.position.set(Sx, Sy);
        b.scar.width = b.scar.height = Rs * 1.6;
        b.scar.alpha = 0.4 * sg;
        for (let j = 0; j < 3; j++) {
          const [ex, ey] = cs[(HOOKED[j]! + 1) % 6]!;
          lines.moveTo(Sx, Sy).lineTo(ex, ey).stroke({ width: Math.max(1.5, Rs * 0.03), color: VIOLET, alpha: 0.5 * sg });
        }
      }
      pm.end();
    },
  });
}
