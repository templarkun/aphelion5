/**
 * Two more Salvage milestones for the third Cleared sector (designer 2026-11-27: "additional 2 for "3rd
 * cleared sector""), in the pool with Sector Lock (salvageFx.ts), one picked at random per mission (I19).
 * Drawn on the Field in the close-up every kill shares (closeup.ts), zoomed less so the other Cleared
 * sectors show. Screen only: nothing here is a rule.
 *
 * Claim Markers (`salvageClaim`, about 4.8 s):
 * 1. A claim stake falls from above the page on a trail of particles and strikes the sector just cleared
 *    (playClaimStake): a flash, a ring of dust, a jolt; the sector shows. The stake unfolds three legs, its
 *    beacon blinks, a cone of light projects a turning hologram of the claim over it.
 * 2. Arches of particles reach from it to the other Cleared sectors; their markers wake as each arrives
 *    (playClaimLink).
 * 3. The three claims lock together (playClaimLock): the holograms flash, rings go out, streams run along
 *    the arches; "CLEARED · 2 / 3" turns to "3 / 3". The zoom eases back.
 *
 * Terrain Survey (`salvageSurvey`, about 4.8 s):
 * 1. A ping from the sector just cleared (playSurveyPing): range rings and a faint grid over the Field.
 * 2. A radar sweep of particles turns twice round the whole Field with a fading afterglow; each Cleared
 *    sector it passes answers with a blip (playSurveyBlip); contour lines bloom over the new sector, then
 *    over the others on the sweep's second pass.
 * 3. The survey is stamped (playSurveyLock): brackets snap round the three sectors, their edges flash;
 *    "CLEARED · 2 / 3" turns to "3 / 3". The zoom eases back.
 *
 * Energy is drawn with particles (designer 2026-11-20). The same for every Company (I25).
 */

import { Graphics } from "pixi.js";
import type { Step } from "../anim.js";
import { easeOut } from "../anim.js";
import { playClaimLink, playClaimLock, playClaimStake, playSurveyBlip, playSurveyLock, playSurveyPing } from "../briefing/soundHooks.js";
import { type KillEnv, type KillTarget, closeupStep, flat, glowSprite, hexCorners, motes, seq } from "./closeup.js";
import { othersOnScreen } from "./salvageFx.js";
import { CLAIM, SURVEY, span } from "./timeline.js";

const easeIn = (p: number) => p * p * p;
const WHITE = 0xffffff;
/** Claim Markers: a pale hologram blue, the beacon's warm orange. */
const HOLO = 0xa8dcff;
const BEACON = 0xffa040;
/** Terrain Survey: a soft phosphor. */
const PHOS = 0x8ff0c8;

// ---------------------------------------------------------------------------------------------------------
// Claim Markers

/** Where the hologram floats over a marker at (x, y). */
export const holoAt = (x: number, y: number, Rs: number, small = false): [number, number] => [x, y - Rs * (small ? 0.85 : 1.2)];
/** When the arch to the other Cleared sector i (0, 1) reaches it. */
export const claimArrive = (i: number) => CLAIM.arcs[0] + 0.4 + i * 0.25;

const TRAIL = (() => {
  const r = seq(5521);
  return Array.from({ length: 40 }, () => ({ j: (r() - 0.5) * 0.12, back: r(), size: 0.04 + r() * 0.05 }));
})();
const DUST = (() => {
  const r = seq(8123);
  return Array.from({ length: 120 }, () => ({ a: r() * Math.PI * 2, far: 0.6 + r() * 1.8, rise: r() * 0.5, size: 0.04 + r() * 0.07 }));
})();
const ARCH = (() => {
  const r = seq(2741);
  return Array.from({ length: 50 }, () => ({ off: r(), speed: 0.35 + r() * 0.5, side: (r() - 0.5) * 0.1, size: 0.03 + r() * 0.05 }));
})();

/** The arch from a to b, high over the board: its point at s (0-1). */
function archAt(a: [number, number], c: [number, number], top: number, s: number): [number, number] {
  const mx = (a[0] + c[0]) / 2;
  const my = Math.min(a[1], c[1]) - top;
  return [(1 - s) * (1 - s) * a[0] + 2 * (1 - s) * s * mx + s * s * c[0], (1 - s) * (1 - s) * a[1] + 2 * (1 - s) * s * my + s * s * c[1]];
}

/** A hologram disc: a turning hexagon of particles, an inner ring and three chevrons, seen at a slant. */
function hologram(pm: ReturnType<typeof motes>, g: Graphics, x: number, y: number, r: number, t: number, built: number, alpha: number, flash: number): void {
  if (alpha <= 0.01 || built <= 0) return;
  const k = 0.42;
  const spin = t * 0.9;
  const col = flash > 0 ? WHITE : HOLO;
  const corners = Array.from({ length: 6 }, (_, i) => spin + (i * Math.PI) / 3);
  // The hexagon's edge drawn on as it builds.
  const n = 48;
  for (let i = 0; i < n * built; i++) {
    const u = (i / n) * 6;
    const e = Math.floor(u);
    const f = u - e;
    const a1 = corners[e % 6]!;
    const a2 = corners[(e + 1) % 6]!;
    const px = (Math.cos(a1) * (1 - f) + Math.cos(a2) * f) * r;
    const py = (Math.sin(a1) * (1 - f) + Math.sin(a2) * f) * r * k;
    pm.dot(x + px, y + py, r * 0.13, col, alpha * (0.6 + 0.4 * Math.sin(t * 8 + i)));
  }
  // The inner ring turning the other way, and three chevrons.
  if (built > 0.5) {
    const b2 = (built - 0.5) * 2;
    for (let i = 0; i < 24; i++) {
      const a = -spin * 1.6 + (i / 24) * Math.PI * 2;
      if (i % 4 === 0) continue;
      pm.dot(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55 * k, r * 0.07, col, alpha * b2 * 0.8, 2, a + Math.PI / 2);
    }
    for (let c = 0; c < 3; c++) {
      const a = spin + (c * 2 * Math.PI) / 3;
      const cx = x + Math.cos(a) * r * 0.28;
      const cy = y + Math.sin(a) * r * 0.28 * k;
      g.moveTo(cx + Math.cos(a + 2.3) * r * 0.12, cy + Math.sin(a + 2.3) * r * 0.12 * k)
        .lineTo(cx + Math.cos(a) * r * 0.1, cy + Math.sin(a) * r * 0.1 * k)
        .lineTo(cx + Math.cos(a - 2.3) * r * 0.12, cy + Math.sin(a - 2.3) * r * 0.12 * k)
        .stroke({ width: Math.max(1, r * 0.04), color: col, alpha: alpha * b2 * 0.9 });
    }
  }
  g.ellipse(x, y, r * 1.05, r * 1.05 * k).fill({ color: HOLO, alpha: 0.08 * alpha * built + 0.25 * flash });
}

/** Claim Markers as a Field step (and its still picture). */
export function claimStep(env: KillEnv, k: KillTarget): Step {
  const C = CLAIM;
  return closeupStep(env, k, {
    times: { total: C.total, zoomIn: C.zoomIn, back: C.back, breakAt: C.impact, wreckIn: C.wreckIn, label: C.label, count: C.count, stillAt: C.count + 0.4 },
    title: "CLEARED",
    accent: HOLO,
    ink: 0xeef8ff,
    inkLine: 0x0b2c42,
    size: 0.13,
    hole: 1.6,
    focus: (wide) => (wide ? [0.42, 0.56] : [0.5, 0.45]),
    dark: () => 0.55,
    build: (back, front) => {
      const plain = new Graphics();
      back.addChild(plain);
      const light = new Graphics();
      light.blendMode = "add";
      back.addChild(light);
      const stake = new Graphics();
      front.addChild(stake);
      const holo = new Graphics();
      holo.blendMode = "add";
      front.addChild(holo);
      const pm = motes(front, 900);
      const flash = glowSprite(front, WHITE);
      const tip = glowSprite(front, BEACON);
      return { plain, light, stake, holo, pm, flash, tip };
    },
    shake: (t, Rs) => {
      const u = span(t, [C.impact, C.impact + 0.3]);
      const a = u > 0 && u < 1 ? Rs * 0.06 * (1 - u) ** 2 : 0;
      return [a * Math.sin(u * 37) * 0.4, a * Math.cos(u * 51)];
    },
    tile: () => ({ scale: 1, alpha: 1 }),
    sounds: (crossed) => {
      if (crossed(C.impact)) playClaimStake();
      for (let i = 0; i < 2; i++) if (crossed(claimArrive(i))) playClaimLink(i);
      if (crossed(C.lock)) playClaimLock();
    },
    draw: (f, b) => {
      const { t, still, Sx, Sy, Rs } = f;
      const light = b.light.clear();
      const stake = b.stake.clear();
      const holo = b.holo.clear();
      b.plain.clear();
      b.pm.begin();
      const landed = still || t >= C.impact;
      const fade = still ? 1 : 1 - span(t, [C.back[0] - 0.2, C.back[0] + 0.4]);
      const others = othersOnScreen(env, k, f);
      const locked = still || t >= C.lock;
      const lf = still ? 1 : span(t, [C.lock, C.lock + 0.45]);
      const lockFlash = locked && lf < 1 ? 1 - lf : 0;

      // The stake: falling, then standing in the sector with its legs out.
      const L = Rs * 1.3;
      const fall = still ? 1 : easeIn(span(t, C.drop));
      const top = -Rs * 0.5;
      const yTip = landed ? Sy + Rs * 0.08 : top + (Sy + Rs * 0.08 - top) * fall;
      const showStake = still || t >= C.drop[0];
      if (showStake && fade > 0.01) {
        const yTop = yTip - L * (landed ? 0.62 : 1);
        const w = Rs * 0.09;
        stake.poly([Sx, yTip, Sx + w, yTip - L * 0.18, Sx + w * 0.8, yTop, Sx - w * 0.8, yTop, Sx - w, yTip - L * 0.18]).fill({ color: 0x2a3140, alpha: fade }).stroke({ width: 1.5, color: 0x9fb8d0, alpha: 0.8 * fade });
        stake.rect(Sx - w * 0.9, yTop + L * 0.08, w * 1.8, L * 0.05).fill({ color: BEACON, alpha: 0.85 * fade });
        // The legs fold out after it lands.
        const leg = still ? 1 : easeOut(span(t, C.unfold));
        if (landed && leg > 0)
          for (const s of [-1, 0, 1]) {
            const a = Math.PI / 2 + s * (0.25 + 0.85 * leg);
            const fx = Sx + Math.cos(a) * Rs * 0.42 * leg * (s === 0 ? 0.3 : 1);
            const fy = yTip - L * 0.25 + Math.sin(a) * Rs * 0.3 * leg;
            stake.moveTo(Sx, yTip - L * 0.32).lineTo(fx, fy).stroke({ width: Math.max(1.5, Rs * 0.035), color: 0x5f6f85, alpha: fade });
            stake.circle(fx, fy, Rs * 0.025).fill({ color: 0x9fb8d0, alpha: fade });
          }
        // The beacon at its top (blinking once it has landed).
        const blink = landed ? (Math.sin(t * 12) > 0.2 ? 1 : 0.35) : 0.8;
        b.tip.visible = true;
        b.tip.position.set(Sx, yTop);
        b.tip.width = b.tip.height = Rs * 0.4 * blink;
        b.tip.alpha = fade * blink;
        // Its trail while it falls.
        if (!landed && !still)
          for (const p of TRAIL) {
            const yy = yTop - p.back * Rs * 2.2 * (0.4 + fall);
            b.pm.dot(Sx + p.j * Rs, yy, Rs * p.size * 2, p.back < 0.3 ? WHITE : BEACON, 0.9 * (1 - p.back), 4, Math.PI / 2);
          }
      } else b.tip.visible = false;

      // Impact: flash, a ring of dust, a shock ring.
      const im = still ? 1 : span(t, [C.impact, C.impact + 0.7]);
      b.flash.visible = landed && im < 0.6;
      b.flash.position.set(Sx, Sy);
      b.flash.width = b.flash.height = Rs * (0.8 + 2.4 * easeOut(im));
      b.flash.alpha = (1 - im / 0.6) ** 1.5;
      if (landed && !still && im < 1) {
        for (const p of DUST) {
          const d = Rs * (0.2 + p.far * easeOut(im));
          b.pm.dot(Sx + Math.cos(p.a) * d, Sy + Math.sin(p.a) * d * 0.55 - Rs * p.rise * im, Rs * p.size * 2, 0xc8b8a0, 0.6 * (1 - im), 1.5, p.a);
        }
        light.ellipse(Sx, Sy + Rs * 0.05, Rs * (0.3 + 2.2 * easeOut(im)), Rs * (0.15 + 1.1 * easeOut(im))).stroke({ width: Math.max(1, Rs * 0.05 * (1 - im)), color: WHITE, alpha: 0.7 * (1 - im) });
      }

      // The hologram over it: a cone of light up from the beacon, the disc building.
      const [hx, hy] = holoAt(Sx, Sy, Rs);
      const hb = still ? 1 : span(t, C.holo);
      if (hb > 0 && fade > 0.01) {
        const yTop = Sy + Rs * 0.08 - L * 0.62;
        holo.poly([Sx - Rs * 0.04, yTop, Sx + Rs * 0.04, yTop, hx + Rs * 0.8, hy, hx - Rs * 0.8, hy]).fill({ color: HOLO, alpha: 0.09 * hb * fade + 0.15 * lockFlash });
        hologram(b.pm, holo, hx, hy, Rs * 0.8, t, hb, fade, lockFlash);
      }

      // Arches to the other Cleared sectors; their markers wake as each arrives.
      others.forEach(([ox, oy], i) => {
        const [mx, my] = holoAt(ox, oy, Rs, true);
        const arrive = claimArrive(i);
        const reach = still ? 1 : span(t, [C.arcs[0] + i * 0.25, arrive]);
        if (reach > 0 && fade > 0.01) {
          const lift = Rs * 1.4 + Math.hypot(mx - hx, my - hy) * 0.15;
          // The arch itself: a faint line drawn on, then particles streaming along it.
          let prev = archAt([hx, hy], [mx, my], lift, 0);
          for (let s = 1; s <= 24; s++) {
            const v = (s / 24) * reach;
            const p = archAt([hx, hy], [mx, my], lift, v);
            light.moveTo(prev[0], prev[1]).lineTo(p[0], p[1]).stroke({ width: Math.max(1, Rs * 0.025), color: lockFlash > 0 ? WHITE : HOLO, alpha: (0.3 + 0.5 * lockFlash) * fade });
            prev = p;
          }
          const head = archAt([hx, hy], [mx, my], lift, reach);
          if (reach < 1 && !still) b.pm.dot(head[0], head[1], Rs * 0.2, WHITE, 1);
          if (!still)
            for (const p of ARCH) {
              const v = ((t * p.speed * (locked ? 1.8 : 1) + p.off) % 1) * reach;
              const [ax, ay] = archAt([hx, hy], [mx, my], lift, v);
              b.pm.dot(ax, ay + p.side * Rs, Rs * p.size * 2, v > 0.9 * reach ? WHITE : HOLO, 0.85 * fade, 2.5);
            }
        }
        // The other marker: a beacon and a small hologram once the arch reaches it.
        const woke = still ? 1 : span(t, [arrive, arrive + 0.4]);
        if (woke > 0 && fade > 0.01) {
          const blink = Math.sin(t * 12 + i * 2) > 0.2 ? 1 : 0.4;
          b.pm.dot(ox, oy - Rs * 0.08, Rs * 0.28 * blink, BEACON, fade);
          b.pm.dot(ox, oy - Rs * 0.08, Rs * 0.1, WHITE, fade);
          holo.moveTo(ox, oy - Rs * 0.08).lineTo(mx, my).stroke({ width: Math.max(1, Rs * 0.03), color: HOLO, alpha: 0.4 * woke * fade });
          hologram(b.pm, holo, mx, my, Rs * 0.55, t + i, woke, fade, lockFlash);
          if (!still && woke < 1) light.circle(ox, oy, Rs * (0.4 + 0.8 * easeOut(woke))).stroke({ width: Math.max(1, Rs * 0.04 * (1 - woke)), color: HOLO, alpha: 0.8 * (1 - woke) });
        }
      });

      // Lock: the three sectors' edges flash, rings go out from each.
      if (locked && fade > 0.01) {
        const pts: [number, number][] = [[Sx, Sy], ...others];
        for (const [x, y] of pts) {
          light.poly(flat(hexCorners(x, y, Rs))).stroke({ width: 2.5, color: lockFlash > 0 ? WHITE : HOLO, alpha: (still ? 0.6 : 0.5 + 0.5 * lockFlash) * fade });
          if (!still && lf < 1) light.circle(x, y, Rs * (1 + 1.4 * easeOut(lf))).stroke({ width: Math.max(1, Rs * 0.05 * (1 - lf)), color: HOLO, alpha: 0.75 * (1 - lf) });
        }
      }
      b.pm.end();
    },
  });
}

// ---------------------------------------------------------------------------------------------------------
// Terrain Survey

/** The sweep's angle at time t: from straight up, clockwise, twice round over SURVEY.sweep. */
export function sweepAngle(t: number): number {
  return -Math.PI / 2 + 4 * Math.PI * span(t, SURVEY.sweep);
}
/** The two times the sweep passes the angle phi. */
export function passTimes(phi: number): [number, number] {
  const u = ((((phi + Math.PI / 2) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (4 * Math.PI);
  const [a, c] = SURVEY.sweep;
  return [a + u * (c - a), a + (u + 0.5) * (c - a)];
}

const CONTOUR = (() => {
  const r = seq(3191);
  return Array.from({ length: 3 }, () => ({ p1: r() * 6, p2: r() * 6, a1: 0.08 + r() * 0.08, a2: 0.04 + r() * 0.05 }));
})();

/** Contour lines over one sector: four wavy loops, drawn as particles, growing from the inside out. */
function contours(pm: ReturnType<typeof motes>, x: number, y: number, Rs: number, grow: number, alpha: number, t: number, which: number): void {
  const c = CONTOUR[which % 3]!;
  for (let k = 0; k < 4; k++) {
    const g = Math.max(0, Math.min(1, grow * 4 - k));
    if (g <= 0) continue;
    const r0 = Rs * (0.22 + 0.19 * k) * (0.85 + 0.15 * easeOut(g));
    const n = 26 + k * 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r0 * (1 + c.a1 * Math.sin(3 * a + c.p1 + k * 0.6) + c.a2 * Math.sin(5 * a + c.p2 - k));
      pm.dot(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9, Rs * 0.075, k === 3 ? WHITE : PHOS, alpha * g * (0.7 + 0.3 * Math.sin(t * 3 - k + i * 0.3)));
    }
  }
}

/** Terrain Survey as a Field step (and its still picture). */
export function surveyStep(env: KillEnv, k: KillTarget): Step {
  const S = SURVEY;
  let blips: number[] = [];
  return closeupStep(env, k, {
    times: { total: S.total, zoomIn: S.zoomIn, back: S.back, breakAt: S.wreckIn[0], wreckIn: S.wreckIn, label: S.label, count: S.count, stillAt: S.count + 0.4 },
    title: "CLEARED",
    accent: PHOS,
    ink: 0xeafff5,
    inkLine: 0x0b3a2c,
    size: 0.12,
    hole: 1.6,
    dark: () => 0.6,
    build: (back) => {
      const grid = new Graphics();
      grid.blendMode = "add";
      back.addChild(grid);
      const light = new Graphics();
      light.blendMode = "add";
      back.addChild(light);
      const pm = motes(back, 1000);
      return { grid, light, pm };
    },
    tile: () => ({ scale: 1, alpha: 1 }),
    sounds: (crossed) => {
      if (crossed(S.ping)) playSurveyPing();
      blips.forEach((at, i) => {
        if (crossed(at)) playSurveyBlip(i % 2);
      });
      if (crossed(S.lock)) playSurveyLock();
    },
    draw: (f, b) => {
      const { t, still, Sx, Sy, Rs, w, h } = f;
      const grid = b.grid.clear();
      const light = b.light.clear();
      b.pm.begin();
      const fade = still ? 1 : 1 - span(t, [S.back[0] - 0.2, S.back[0] + 0.4]);
      const others = othersOnScreen(env, k, f);
      const far = Math.max(Math.hypot(Sx, Sy), Math.hypot(w - Sx, Sy), Math.hypot(Sx, h - Sy), Math.hypot(w - Sx, h - Sy));
      const times = others.map(([ox, oy]) => passTimes(Math.atan2(oy - Sy, ox - Sx)));
      blips = times.flat();

      // Range rings and a faint grid, from the ping.
      const pg = still ? 1 : span(t, [S.ping, S.ping + 0.8]);
      if (pg > 0 && fade > 0.01) {
        for (let i = 1; i * Rs * 1.5 < far; i++) {
          const rr = Rs * 1.5 * i;
          if (rr > far * easeOut(pg) + Rs) break;
          grid.circle(Sx, Sy, rr).stroke({ width: 1, color: PHOS, alpha: 0.16 * fade });
        }
        grid.moveTo(Sx - far, Sy).lineTo(Sx + far, Sy).stroke({ width: 1, color: PHOS, alpha: 0.12 * fade * pg });
        grid.moveTo(Sx, Sy - far).lineTo(Sx, Sy + far).stroke({ width: 1, color: PHOS, alpha: 0.12 * fade * pg });
        if (!still && pg < 1) {
          const rr = Rs * 0.4 + far * easeOut(pg);
          for (let i = 0; i < 90; i++) {
            const a = (i / 90) * Math.PI * 2;
            b.pm.dot(Sx + Math.cos(a) * rr, Sy + Math.sin(a) * rr, Rs * 0.08, i % 6 ? PHOS : WHITE, 0.85 * (1 - pg), 2.5, a + Math.PI / 2);
          }
        }
      }

      // The sweep: a line of particles out to the Field's far corner with an afterglow behind it.
      const sw = span(t, S.sweep);
      if (!still && sw > 0 && sw < 1) {
        const th = sweepAngle(t);
        const n = 30;
        // A soft wedge of afterglow behind the line.
        for (let j = 0; j < 8; j++) {
          const a1 = th - j * 0.09;
          const a2 = th - (j + 1) * 0.09;
          light.poly([Sx, Sy, Sx + Math.cos(a1) * far, Sy + Math.sin(a1) * far, Sx + Math.cos(a2) * far, Sy + Math.sin(a2) * far]).fill({ color: PHOS, alpha: 0.12 * (1 - j / 8) ** 2 * fade });
        }
        for (let j = 0; j < 16; j++) {
          const a = th - j * 0.045;
          const al = (j === 0 ? 1 : 0.7 * (1 - j / 16) ** 1.5) * fade;
          for (let i = 1; i <= n; i++) {
            const rr = (far * i) / n;
            b.pm.dot(Sx + Math.cos(a) * rr, Sy + Math.sin(a) * rr, Rs * (j === 0 ? 0.11 : 0.08), j === 0 && i % 5 === 0 ? WHITE : PHOS, al * (0.5 + 0.5 * Math.sin(i * 1.7 + j)), 2, a + Math.PI / 2);
          }
        }
        light.moveTo(Sx, Sy).lineTo(Sx + Math.cos(th) * far, Sy + Math.sin(th) * far).stroke({ width: Math.max(1, Rs * 0.02), color: WHITE, alpha: 0.6 * fade });
      }

      // Each other Cleared sector blips as the sweep passes; contours bloom on its second pass.
      others.forEach(([ox, oy], i) => {
        for (const [p, at] of times[i]!.entries()) {
          const u = still ? 1 : span(t, [at, at + 0.6]);
          if (u > 0 && u < 1) {
            light.circle(ox, oy, Rs * (0.3 + 1.1 * easeOut(u))).stroke({ width: Math.max(1, Rs * 0.05 * (1 - u)), color: p ? WHITE : PHOS, alpha: 0.85 * (1 - u) });
            light.poly(flat(hexCorners(ox, oy, Rs))).stroke({ width: 2, color: PHOS, alpha: 0.8 * (1 - u) });
            b.pm.dot(ox, oy, Rs * 0.5 * (1 - u), WHITE, 1 - u);
          }
        }
        const g = still ? 1 : span(t, [times[i]![1], times[i]![1] + 0.6]);
        contours(b.pm, ox, oy, Rs, g, fade, t, i + 1);
      });
      contours(b.pm, Sx, Sy, Rs, still ? 1 : span(t, [S.contour[0], S.contour[0] + 0.8]), fade, t, 0);

      // The stamp: brackets snap round the three sectors, their edges flash.
      const lk = still ? 1 : span(t, [S.lock, S.lock + 0.35]);
      if (lk > 0 && fade > 0.01) {
        const pts: [number, number][] = [[Sx, Sy], ...others];
        for (const [x, y] of pts) {
          const r = Rs * (1.25 + 0.6 * (1 - easeOut(lk)));
          const arm = Rs * 0.3;
          for (const [dx, dy] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ] as const) {
            const cx = x + dx * r * 0.8;
            const cy = y + dy * r * 0.8;
            light
              .moveTo(cx - dx * arm, cy)
              .lineTo(cx, cy)
              .lineTo(cx, cy - dy * arm)
              .stroke({ width: Math.max(1.5, Rs * 0.04), color: lk < 1 ? WHITE : PHOS, alpha: 0.9 * lk * fade });
          }
          light.poly(flat(hexCorners(x, y, Rs))).stroke({ width: 2.5, color: lk < 1 ? WHITE : PHOS, alpha: (0.4 + 0.5 * (1 - lk)) * lk * fade });
        }
      }
      b.pm.end();
    },
  });
}
