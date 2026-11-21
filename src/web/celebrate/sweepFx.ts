/**
 * Perimeter Sweep, the second win (designer 2026-11-21; times in timeline.ts SWEEP): precision victory
 * telemetry over the Field and the Mission bar, drawn on MissionWin's canvas.
 *
 * 1. (0-1.0 s) The Field dims by about 35%. The Mission bar's cells charge like capacitors and ignite
 *    left to right; the last one overcharges and bursts in a starburst with spark trails.
 * 2. (1.0-2.2 s) A crisp ring of energy (a white core, a cyan body, particles riding it) sweeps out from
 *    the sector the unit left over the whole Field and off its edges, so it never stops on the Field. Each
 *    sector's edge flashes white, cyan and gold as it crosses, then stays as a thin "secured" border with
 *    tactical corner ticks; the units recoil a little, away from the wave.
 * 3. (2.2-3.8 s) MISSION COMPLETE slams in with a micro-bounce and a split-colour glint on its edges, the
 *    line under it types in, stamped metal badges drop one by one with a spark puff each.
 * 4. (3.8-5.0 s) Embers drift up over the dimmed Field while everything cross-fades into the Upgrade sheet.
 *
 * Every moving thing is worked out from the time alone. A slow machine draws fewer particles and no glow
 * passes (`q`), never slower. Screen only: no rule here.
 */

import { easeOut } from "../anim.js";
import { type Geo, hexPath, hexPts, puff, rgba, seq } from "./winKit.js";
import { SWEEP, span } from "./timeline.js";

const CYAN = "120 226 255";
const GOLD = "255 206 120";
const WHITE = "255 255 255";
const EMBER = "255 150 70";

/** When cell i of n ignites (s). */
export function cellAt(i: number, n: number, T: { cellsAt: number; cellsIn: number; cellStep: number } = SWEEP): number {
  const step = n > 1 ? Math.min(T.cellStep, T.cellsIn / (n - 1)) : 0;
  return T.cellsAt + i * step;
}
/** When the last of n cells bursts (s). */
export const burstAt = (n: number) => cellAt(Math.max(0, n - 1), Math.max(1, n)) + SWEEP.burstAfter;

/** The farthest any part of the Field lies from where the wave starts (pixels). */
export function farthest(w: number, h: number, ox: number, oy: number): number {
  return Math.max(Math.hypot(ox, oy), Math.hypot(w - ox, oy), Math.hypot(ox, h - oy), Math.hypot(w - ox, h - oy));
}

/** How far the ring has gone at p (0-1 through SWEEP.wave): fast out, easing a little, never still; at p = 1 it is a tile beyond the farthest corner. */
export function ringShare(p: number): number {
  const u = Math.max(0, Math.min(1, p));
  return 0.55 * u + 0.45 * (1 - (1 - u) ** 2);
}
/** The ring's radius at time t (pixels); `reach` = farthest(...) + a tile and a half. */
export const ringAt = (t: number, reach: number) => reach * ringShare(span(t, SWEEP.wave));
/** When the ring reaches a point d pixels from where it starts (s). */
export function ringArrival(d: number, reach: number): number {
  const target = Math.max(0, Math.min(1, d / reach));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 28; i++) {
    const m = (lo + hi) / 2;
    if (ringShare(m) < target) lo = m;
    else hi = m;
  }
  return SWEEP.wave[0] + ((lo + hi) / 2) * (SWEEP.wave[1] - SWEEP.wave[0]);
}
export const reachOf = (geo: Pick<Geo, "fw" | "fh" | "ox" | "oy" | "tile">) => farthest(geo.fw, geo.fh, geo.ox, geo.oy) + geo.tile * 1.5;

/** The units' recoil as the ring passes: a short push away from where it started, then settling. */
export function recoil(geo: Pick<Geo, "fw" | "fh" | "ox" | "oy" | "tile">, x: number, y: number, t: number): { dx: number; dy: number } | undefined {
  const d = Math.hypot(x - geo.ox, y - geo.oy);
  const age = t - ringArrival(d, reachOf(geo));
  if (!(age >= 0 && age < 0.55)) return undefined;
  const ux = d > 1 ? (x - geo.ox) / d : 0;
  const uy = d > 1 ? (y - geo.oy) / d : -1;
  const A = geo.tile * 0.055 * Math.exp(-age / 0.13) * Math.sin(Math.min(Math.PI, age * 22) + age * 30);
  return { dx: ux * A, dy: uy * A };
}

// Particles, fixed once (each with a rank: a slow machine draws only those below its quality).
const RIDERS = (() => {
  const r = seq(9311);
  return Array.from({ length: 220 }, (_, i) => ({ a: r() * Math.PI * 2, spin: (r() - 0.5) * 0.5, off: (r() - 0.5) * 2, size: 0.5 + r() * 1.1, fq: 9 + r() * 22, gold: r() < 0.22, rank: i / 220 }));
})();
const LEFT = (() => {
  const r = seq(7703);
  return Array.from({ length: 260 }, (_, i) => ({ a: r() * Math.PI * 2, at: r(), out: 0.15 + r() * 0.5, life: 0.4 + r() * 0.8, size: 0.4 + r() * 1.0, gold: r() < 0.3, rank: i / 260 }));
})();
const RAYS = (() => {
  const r = seq(4141);
  return Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + (r() - 0.5) * 0.2, len: 0.6 + r() * 0.9, w: 0.5 + r() * 0.8 }));
})();
const TRAILS = (() => {
  const r = seq(2718);
  return Array.from({ length: 40 }, (_, i) => ({ a: r() * Math.PI * 2, v: 1.2 + r() * 2.6, drop: 0.4 + r() * 1.4, life: 0.35 + r() * 0.5, gold: r() < 0.55, rank: i / 40 }));
})();
const EMBERS = (() => {
  const r = seq(6067);
  return Array.from({ length: 90 }, (_, i) => ({ x: r(), y: 0.35 + r() * 0.65, born: SWEEP.embers - 0.2 + r() * 1.0, life: 0.9 + r() * 0.8, rise: 0.12 + r() * 0.22, size: 0.6 + r() * 1.3, wob: r() * 6, hot: r() < 0.35, rank: i / 90 }));
})();
const STAMP = (() => {
  const r = seq(3389);
  return Array.from({ length: 12 }, () => ({ a: Math.PI * (1.05 + r() * 0.9), v: 0.5 + r() * 1.1, size: 0.5 + r() * 0.9, white: r() < 0.5 }));
})();

/** A sector's border as the ring crosses it: a flash (white to cyan to gold), then the settled "secured" line with corner ticks. */
function securedEdge(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, age: number, all: number, q: number): void {
  if (age < 0) return;
  const k = Math.exp(-age / 0.22);
  const settle = Math.min(1, age / 0.35);
  // The flash: a soft glow and a bright line, white turning cyan, then gold.
  if (k > 0.02) {
    hexPath(g, cx, cy, R);
    g.fillStyle = rgba(CYAN, 0.12 * k * all);
    g.fill();
    if (q > 0.6) {
      g.strokeStyle = rgba(CYAN, 0.25 * k * all);
      g.lineWidth = Math.max(4, R * 0.16);
      g.stroke();
    }
    g.strokeStyle = rgba(age < 0.08 ? WHITE : age < 0.2 ? CYAN : GOLD, 0.95 * k * all);
    g.lineWidth = 1.5 + 1.5 * k;
    g.stroke();
  }
  // Secured: a thin cool line and short ticks at each corner.
  const a = 0.5 * settle * all;
  hexPath(g, cx, cy, R * 0.94);
  g.strokeStyle = rgba(CYAN, a * 0.7);
  g.lineWidth = 1;
  g.stroke();
  const pts = hexPts(cx, cy, R * 0.94);
  g.strokeStyle = rgba(GOLD, a * 1.6);
  g.lineWidth = 1.4;
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const [px, py] = pts[(i + 5) % 6]!;
    const [nx, ny] = pts[(i + 1) % 6]!;
    const tick = 0.2;
    g.moveTo(x + (px - x) * tick, y + (py - y) * tick);
    g.lineTo(x, y);
    g.lineTo(x + (nx - x) * tick, y + (ny - y) * tick);
  });
  g.stroke();
}

/**
 * One frame of Perimeter Sweep. `all` is how much of it shows (1 until the cross-fade); `still`: the
 * reduced-motion picture (lit bar, secured borders; the banner is the page's).
 */
export function paintSweep(g: CanvasRenderingContext2D, geo: Geo, t: number, still: boolean, all: number, q: number, badges: DOMRect[]): void {
  const { fx, fy, fw, fh, tile } = geo;
  const R = tile * 0.46;
  const n = geo.cells.length;
  // The Field dims: its own tiles (MissionWin's onShake).

  g.save();
  g.globalCompositeOperation = "lighter";
  // Act 1: the cells charge and ignite, left to right; they stay lit.
  geo.cells.forEach((c, i) => {
    const at = cellAt(i, n);
    const charge = still ? 1 : span(t, [at - 0.1, at]);
    if (charge <= 0) return;
    const age = still ? 9 : t - at;
    // The capacitor charging, from the foot of the cell up.
    g.save();
    g.beginPath();
    g.rect(c.left, c.top, c.width, c.height);
    g.clip();
    const hy = c.bottom - c.height * charge;
    const bar = g.createLinearGradient(0, c.bottom, 0, hy);
    bar.addColorStop(0, rgba(GOLD, 0.55 * all));
    bar.addColorStop(1, rgba(WHITE, (age < 0 ? 0.9 : 0.35) * all));
    g.fillStyle = bar;
    g.fillRect(c.left, hy, c.width, c.bottom - hy);
    g.restore();
    const x = c.left + c.width / 2;
    const y = c.top + c.height / 2;
    const s = Math.max(c.width, c.height);
    if (age >= 0) {
      // The ignition: a hard flash, then a steady glow.
      const k = Math.exp(-age / 0.12);
      const glow = 0.28 + 0.9 * k;
      const Rg = s * (1.4 + 1.6 * k);
      const grd = g.createRadialGradient(x, y, 0, x, y, Rg);
      grd.addColorStop(0, rgba(WHITE, glow * all));
      grd.addColorStop(0.3, rgba(GOLD, 0.6 * glow * all));
      grd.addColorStop(1, rgba(GOLD, 0));
      g.fillStyle = grd;
      g.fillRect(x - Rg, y - Rg, 2 * Rg, 2 * Rg);
    }
  });
  // The last cell overcharges and bursts: a starburst of rays, a flare, spark trails.
  const last = geo.cells[n - 1];
  if (last && !still) {
    const at = burstAt(n);
    const age = t - at;
    if (age >= 0 && age < 1.0) {
      const x = last.left + last.width / 2;
      const y = last.top + last.height / 2;
      const s = Math.max(14, last.height * 1.4);
      const k = Math.exp(-age / 0.18);
      const flare = g.createRadialGradient(x, y, 0, x, y, s * 3.2);
      flare.addColorStop(0, rgba(WHITE, 0.95 * k * all));
      flare.addColorStop(0.25, rgba(GOLD, 0.5 * k * all));
      flare.addColorStop(1, rgba(GOLD, 0));
      g.fillStyle = flare;
      g.fillRect(x - s * 3.2, y - s * 3.2, s * 6.4, s * 6.4);
      for (const ray of RAYS) {
        const L = s * (1.2 + 3.2 * ray.len) * (0.55 + 0.45 * easeOut(Math.min(1, age / 0.12)));
        const ex = x + Math.cos(ray.a) * L;
        const ey = y + Math.sin(ray.a) * L;
        const grd = g.createLinearGradient(x, y, ex, ey);
        grd.addColorStop(0, rgba(WHITE, 0.9 * k * all));
        grd.addColorStop(1, rgba(GOLD, 0));
        g.strokeStyle = grd;
        g.lineWidth = 1 + 2.2 * ray.w * k;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(ex, ey);
        g.stroke();
      }
      // Spark trails: each a short bright streak along its path, falling a little.
      for (const sp of TRAILS) {
        if (sp.rank > q || age > sp.life) continue;
        const u = age / sp.life;
        const pos = (a: number) => {
          const d = s * sp.v * 3 * (1 - Math.exp(-a * 5));
          return [x + Math.cos(sp.a) * d, y + Math.sin(sp.a) * d + s * sp.drop * a * a * 6] as const;
        };
        const [px, py] = pos(Math.max(0, age - 0.05));
        const [qx, qy] = pos(age);
        g.strokeStyle = rgba(sp.gold ? GOLD : WHITE, (1 - u) * all);
        g.lineWidth = 1.3;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(qx, qy);
        g.stroke();
      }
    }
  }
  g.restore();

  // Act 2: the ring, clipped to the Field; the sectors it has crossed stay secured.
  g.save();
  g.beginPath();
  g.rect(fx, fy, fw, fh);
  g.clip();
  g.globalCompositeOperation = "lighter";
  const reach = reachOf(geo);
  const ox = fx + geo.ox;
  const oy = fy + geo.oy;
  for (const [, sx, sy] of geo.sectors) {
    const age = still ? 9 : t - ringArrival(Math.hypot(sx - geo.ox, sy - geo.oy), reach);
    securedEdge(g, fx + sx, fy + sy, R, age, all, q);
  }
  if (!still && t >= SWEEP.wave[0] && t <= SWEEP.wave[1]) {
    const r = ringAt(t, reach);
    const flick = 0.85 + 0.15 * Math.sin(t * 57) * Math.sin(t * 19);
    // Two faint echoes behind it, then its glow, body and white core.
    [
      [tile * 0.55, 0.12],
      [tile * 0.26, 0.24],
    ].forEach(([back, a]) => {
      if (r - back! <= 0) return;
      g.beginPath();
      g.arc(ox, oy, r - back!, 0, Math.PI * 2);
      g.strokeStyle = rgba(CYAN, a! * all);
      g.lineWidth = 1.2;
      g.stroke();
    });
    g.beginPath();
    g.arc(ox, oy, r, 0, Math.PI * 2);
    if (q > 0.6) {
      g.strokeStyle = rgba(CYAN, 0.13 * all * flick);
      g.lineWidth = tile * 0.22;
      g.stroke();
    }
    g.strokeStyle = rgba(CYAN, 0.55 * all * flick);
    g.lineWidth = Math.max(2, tile * 0.04);
    g.stroke();
    g.strokeStyle = rgba(WHITE, 0.95 * all * flick);
    g.lineWidth = 1.3;
    g.stroke();
    // Particles riding the ring: it is made of them.
    for (const [i, p] of RIDERS.entries()) {
      if (p.rank > q) continue;
      const a = p.a + p.spin * t;
      const rr = r + p.off * tile * 0.05;
      const s = tile * 0.05 * p.size * (0.7 + 0.3 * Math.sin(t * p.fq + i));
      puff(g, p.gold ? GOLD : i % 4 ? CYAN : WHITE, ox + Math.cos(a) * rr, oy + Math.sin(a) * rr, s, all * (0.55 + 0.45 * Math.sin(t * p.fq * 1.6 + i * 2)));
    }
  }
  // Motes the ring leaves behind: they drift outwards a little and fade.
  if (!still && t >= SWEEP.wave[0] && t <= SWEEP.wave[1] + 1.2) {
    const dur = SWEEP.wave[1] - SWEEP.wave[0];
    for (const p of LEFT) {
      if (p.rank > q) continue;
      const tb = SWEEP.wave[0] + p.at * dur;
      const age = t - tb;
      if (age < 0 || age > p.life) continue;
      const rr = ringAt(tb, reach) + tile * p.out * (1 - Math.exp(-age * 3));
      const u = age / p.life;
      puff(g, p.gold ? GOLD : CYAN, ox + Math.cos(p.a) * rr, oy + Math.sin(p.a) * rr, tile * 0.035 * p.size * (1 - 0.4 * u), (1 - u) ** 1.4 * all);
    }
  }
  g.restore();

  if (still) return;
  g.save();
  g.globalCompositeOperation = "lighter";
  // Act 3: a spark puff and a small flash as each stamped badge lands.
  badges.forEach((b, i) => {
    const at = SWEEP.badgesAt + i * SWEEP.badgeStep + SWEEP.badgeFall;
    const age = t - at;
    if (age < 0 || age > 0.45 || b.width < 1) return;
    const x = b.left + b.width / 2;
    const y = b.bottom - b.height * 0.12;
    const k = Math.exp(-age / 0.08);
    puff(g, WHITE, x, y, b.width * 0.7 * k + 1, 0.6 * k * all);
    for (const s of STAMP) {
      const d = b.width * s.v * (1 - Math.exp(-age * 9));
      puff(g, s.white ? WHITE : GOLD, x + Math.cos(s.a) * d, y + Math.sin(s.a) * d * 0.5 + b.width * 0.6 * age * age * 4, b.width * 0.07 * s.size, (1 - age / 0.45) * all);
    }
  });
  // Act 4: embers drift up over the Field.
  for (const e of EMBERS) {
    if (e.rank > q) continue;
    const age = t - e.born;
    if (age < 0 || age > e.life) continue;
    const u = age / e.life;
    const x = fx + fw * e.x + Math.sin(e.wob + age * 2.4) * tile * 0.12;
    const y = fy + fh * (e.y - e.rise * u);
    puff(g, e.hot ? GOLD : EMBER, x, y, tile * 0.03 * e.size, Math.sin(Math.PI * u) * all * 0.9);
  }
  g.restore();
}

/** The Mission bar's lit cells in the still picture are drawn by paintSweep; the time the bar turns gold. */
export const sweepWonAt = (n: number) => burstAt(n);
