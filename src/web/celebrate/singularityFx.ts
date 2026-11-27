/**
 * Singularity, a mission win (designer 2026-11-27: "create 2 more ... be ambitious"; times in timeline.ts
 * SINGULAR): the Mission bar feeds a point of light in the Field's middle that collapses into a black well;
 * the whole board is drawn in, turning round it; then it goes nova and flings every tile back to its place.
 *
 * 1. (0-1.2 s) The Field dims. Each cell of the Mission bar sends a thread of particles down into the
 *    Field's middle; a point of white light gathers there, collapses into a black core with a bright
 *    photon ring, and a tilted disc of particles spins up round it (its far side bent over the top of
 *    the core, as light round a black hole is).
 * 2. (1.2-3.0 s) The pull: every tile slides in and turns round the well, the near ones first and
 *    fastest, the far ones last; streaks of light are torn off each tile and spiral into the disc; the
 *    board trembles more and more.
 * 3. (3.0-4.6 s) Nova: a flash, the disc is blown out as a ring of particles that runs off the Field,
 *    rays, every tile flung out past its place and settling back like a spring; each sector's edge
 *    flares as the ring reaches it; a gold halo is left round the middle, the bar turns gold; the banner.
 * 4. (4.6-6.0 s) Embers drift outwards; everything fades.
 *
 * Every particle's place and every tile's place are worked out from the time alone, never stepped frame by
 * frame. A slow machine draws fewer particles (`q`), never slower. The same colours for every Company.
 * Screen only: no rule here.
 */

import { easeOut } from "../anim.js";
import { SINGULAR as S_, span } from "./timeline.js";
import { type Geo, hexPts, puff, rgba, seq } from "./winKit.js";

const CYAN = "92 214 255";
const ICE = "190 240 255";
const WHITE = "255 255 255";
const VIOLET = "170 128 255";
const GOLD = "255 206 120";
const EMBER = "255 150 80";

/** When cell i of n starts feeding the core (s). */
export function feedCellAt(i: number, n: number): number {
  const step = n > 1 ? Math.min(S_.cellStep, S_.cellsIn / (n - 1)) : 0;
  return S_.cellsAt + i * step;
}

/**
 * How far in a tile is (0 at its place, `squeeze` at the most; below 0 = flung out past its place) at
 * time t, for a tile at share `u` (0 middle, 1 farthest) of the Field's reach. The near ones start first.
 */
export function wellPull(u: number, t: number): number {
  if (t < S_.nova) {
    const st = S_.pull[0] + 0.5 * u;
    const p = span(t, [st, S_.pull[1]]);
    return S_.squeeze * p ** 1.7;
  }
  const a = t - S_.nova;
  if (a > 1.3) return 0;
  // A spring: out past its place, back, a little out again, at rest.
  return S_.squeeze * Math.exp(-a / 0.19) * Math.cos(a * 15);
}

/** Where a tile at (x, y) is drawn at time t (Field pixels, round the middle cx, cy), and its scale. */
export function wellPlace(cx: number, cy: number, x: number, y: number, reach: number, t: number): [number, number, number] {
  const dx = x - cx;
  const dy = y - cy;
  const u = Math.min(1, Math.hypot(dx, dy) / (reach || 1));
  const k = wellPull(u, t);
  const th = S_.turn * (k / S_.squeeze) * (0.55 + 0.45 * (1 - u));
  const c = Math.cos(th);
  const s = Math.sin(th);
  const f = 1 - k;
  return [cx + (dx * c - dy * s) * f, cy + (dx * s + dy * c) * f, 1 - 0.75 * k];
}

/** The tile's look: pulled in, turned and shrunk, trembling; flung out and settling after the nova. */
export function singularityLook(cx: number, cy: number, x: number, y: number, reach: number, t: number, tile: number): { dx: number; dy: number; scale: number } | undefined {
  if (t < S_.pull[0] || t > S_.nova + 1.3) return undefined;
  const [px, py, scale] = wellPlace(cx, cy, x, y, reach, t);
  const tr = t < S_.nova ? tile * 0.025 * span(t, [S_.pull[0] + 0.6, S_.nova]) ** 2 : 0;
  return { dx: px - x + tr * Math.sin(t * 61 + x), dy: py - y + tr * Math.cos(t * 57 + y), scale };
}

/** The core's radius at time t, in tiles (0 before it forms and after the nova). */
export function coreSize(t: number): number {
  if (t < S_.core[0] || t >= S_.nova) return 0;
  return 0.1 + 0.2 * easeOut(span(t, S_.core)) + 0.13 * span(t, S_.pull);
}

// The disc, the streaks and the embers, fixed once (each with a rank: a slow machine draws only those below its quality).
const DISC = (() => {
  const r = seq(7307);
  return Array.from({ length: 360 }, (_, i) => ({ rho: r() ** 0.8, ph: r() * Math.PI * 2, tw: r() * 6.3, out: 0.7 + r() * 0.9, rank: i / 360 }));
})();
const TORN = (() => {
  const r = seq(1931);
  return Array.from({ length: 6 }, () => ({ ph: r(), ox: (r() - 0.5) * 0.8, oy: (r() - 0.5) * 0.8, sp: 0.7 + r() * 0.6 }));
})();
const SPARKS = (() => {
  const r = seq(5113);
  return Array.from({ length: 220 }, (_, i) => ({ a: r() * Math.PI * 2, v: 0.5 + r() * 1.6, size: 0.6 + r() * 1.4, gold: r() < 0.4, born: r() * 0.15, rank: i / 220 }));
})();
const EMBERS = (() => {
  const r = seq(8821);
  return Array.from({ length: 80 }, (_, i) => ({ a: r() * Math.PI * 2, r0: 0.15 + r() * 0.3, born: S_.embers - 0.3 + r() * 0.9, life: 0.9 + r() * 0.7, v: 0.3 + r() * 0.5, gold: r() < 0.6, rank: i / 80 }));
})();

/**
 * One frame of Singularity, drawn on MissionWin's page-wide canvas. `all` is how much of it shows (1 until
 * the cross-fade); `still`: the reduced-motion picture (the board back in place, the halo round the middle).
 */
export function paintSingularity(g: CanvasRenderingContext2D, geo: Geo, t: number, still: boolean, all: number, q: number): void {
  const { fx, fy, fw, fh, tile } = geo;
  const n = geo.cells.length;
  const cx = fx + fw / 2;
  const cy = fy + fh / 2;
  const reach = Math.max(tile, ...geo.sectors.map(([, x, y]) => Math.hypot(x - fw / 2, y - fh / 2)));
  const R = tile * 0.46;

  // The cells: each lights as it feeds the core; gold from the nova.
  g.save();
  g.globalCompositeOperation = "lighter";
  geo.cells.forEach((c, i) => {
    const age = still ? 9 : t - feedCellAt(i, n);
    if (age < 0) return;
    const x = c.left + c.width / 2;
    const y = c.top + c.height / 2;
    const s = Math.max(c.width, c.height);
    const k = Math.exp(-age / 0.18);
    const gold = still || t >= S_.nova;
    const fl = !still && t >= S_.nova ? Math.exp(-(t - S_.nova) / 0.22) : 0;
    const grd = g.createRadialGradient(x, y, 0, x, y, s * (1.3 + 1.2 * (k + fl)));
    grd.addColorStop(0, rgba(WHITE, (0.3 + 0.7 * (k + fl)) * all));
    grd.addColorStop(0.35, rgba(gold ? GOLD : CYAN, (0.3 + 0.3 * k) * all));
    grd.addColorStop(1, rgba(CYAN, 0));
    g.fillStyle = grd;
    g.fillRect(x - s * 3, y - s * 3, s * 6, s * 6);
    // Its thread: particles flowing down a curve into the middle until the pull begins.
    if (!still && t < S_.pull[0] + 0.4) {
      const fade = 1 - span(t, [S_.pull[0], S_.pull[0] + 0.4]);
      const m = Math.round(22 * q);
      const bend = (i / Math.max(1, n - 1) - 0.5) * tile * 2.2;
      for (let j = 0; j < m; j++) {
        const w = (age * 1.5 + j / m) % 1;
        if (age * 1.5 < w) continue;
        const mx = (x + cx) / 2 + bend;
        const my = (y + cy) / 2;
        const px = (1 - w) ** 2 * x + 2 * (1 - w) * w * mx + w * w * cx;
        const py = (1 - w) ** 2 * y + 2 * (1 - w) * w * my + w * w * cy;
        puff(g, j % 4 === 0 ? WHITE : ICE, px, py, tile * 0.035, Math.sin(Math.PI * w) * 0.9 * fade * all);
      }
    }
  });
  g.restore();

  g.save();
  g.beginPath();
  g.rect(fx, fy, fw, fh);
  g.clip();

  const cs = coreSize(still ? 0 : t) * tile;
  const novaAge = still ? -1 : t - S_.nova;
  // The disc: particles orbit on a tilted ellipse, the inner ones fastest; blown outwards at the nova.
  const discOn = !still && t >= S_.core[0] && novaAge < 1.2;
  const discAlpha = discOn ? Math.min(1, (t - S_.core[0]) / 0.5) : 0;
  const discPt = (d: (typeof DISC)[number]): [number, number, number, number] => {
    const base = Math.max(novaAge >= 0 ? coreSize(S_.nova - 1e-3) * tile : cs, tile * 0.3);
    const rho = base * (1.4 + 2.2 * d.rho) * (novaAge >= 0 ? 1 + novaAge * d.out * 9 : 1);
    const w = 3.2 / Math.sqrt(0.3 + d.rho);
    const ang = d.ph + (novaAge >= 0 ? S_.nova : t) * w;
    return [Math.cos(ang) * rho, Math.sin(ang) * rho * 0.34, Math.sin(ang), rho];
  };
  const discCol = (d: (typeof DISC)[number]) => (d.rho < 0.25 ? WHITE : d.rho < 0.55 ? GOLD : d.rho < 0.8 ? EMBER : VIOLET);
  g.globalCompositeOperation = "lighter";
  if (discOn) {
    const fade = novaAge >= 0 ? 1 - span(novaAge, [0.2, 1.2]) : 1;
    // The far side first, and its light bent over the top of the core (and faintly under it).
    for (const d of DISC) {
      if (d.rank > q) continue;
      const [x, y, side, rho] = discPt(d);
      if (side > 0) continue;
      const a = discAlpha * fade * (0.55 + 0.45 * Math.sin(t * 9 + d.tw)) * all;
      puff(g, discCol(d), cx + x, cy + y, tile * 0.03, a * 0.8);
      if (novaAge < 0 && cs > 0) {
        const lr = cs * 1.15 + (rho - cs * 1.4) * 0.45;
        const la = Math.atan2(y, x);
        puff(g, discCol(d), cx + Math.cos(la) * lr, cy + Math.sin(la) * lr * 1.05, tile * 0.026, a * 0.6);
        puff(g, discCol(d), cx + Math.cos(la) * lr * 0.9, cy - Math.sin(la) * lr * 0.95, tile * 0.02, a * 0.2);
      }
    }
  }
  // The streaks torn off the tiles into the disc during the pull.
  if (!still && t > S_.pull[0] + 0.3 && t < S_.nova) {
    const on = span(t, [S_.pull[0] + 0.3, S_.pull[0] + 0.9]);
    g.lineCap = "round";
    g.lineWidth = Math.max(0.8, tile * 0.012);
    const per = Math.max(1, Math.round(TORN.length * q));
    for (const [, sx, sy] of geo.sectors) {
      const [px, py] = wellPlace(fw / 2, fh / 2, sx, sy, reach, t);
      for (let j = 0; j < per; j++) {
        const s = TORN[j]!;
        const w = (t * s.sp + s.ph) % 1;
        const at = (v: number): [number, number] => {
          const ox = px - fw / 2 + s.ox * tile;
          const oy = py - fh / 2 + s.oy * tile;
          const f = (1 - v) ** 1.6;
          const th = v * 2.4;
          const c = Math.cos(th);
          const sn = Math.sin(th);
          return [cx + (ox * c - oy * sn) * f, cy + (ox * sn + oy * c) * f * (1 - 0.5 * v)];
        };
        const [ax, ay] = at(Math.max(0, w - 0.07));
        const [bx, by] = at(w);
        const a = Math.sin(Math.PI * w) * on * all;
        g.strokeStyle = rgba(j % 3 === 0 ? WHITE : CYAN, 0.45 * a);
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.stroke();
        puff(g, ICE, bx, by, tile * 0.025, a);
      }
    }
  }
  // The core: black, with a bright photon ring and a lensing glow.
  if (cs > 0) {
    const grd = g.createRadialGradient(cx, cy, cs * 0.9, cx, cy, cs * 3);
    grd.addColorStop(0, rgba(ICE, 0.35 * all));
    grd.addColorStop(0.3, rgba(VIOLET, 0.12 * all));
    grd.addColorStop(1, rgba(VIOLET, 0));
    g.fillStyle = grd;
    g.fillRect(cx - cs * 3, cy - cs * 3, cs * 6, cs * 6);
    g.globalCompositeOperation = "source-over";
    g.fillStyle = rgba("0 0 0", 0.94 * all);
    g.beginPath();
    g.arc(cx, cy, cs, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "lighter";
    const m = Math.round(64 * q);
    for (let j = 0; j < m; j++) {
      const a = (j / m) * Math.PI * 2 + t * 2.5;
      const fl = 0.6 + 0.4 * Math.sin(t * 14 + j * 2.7);
      puff(g, j % 5 === 0 ? GOLD : WHITE, cx + Math.cos(a) * cs * 1.06, cy + Math.sin(a) * cs * 1.06, tile * 0.03, fl * all);
    }
  } else if (!still && t >= S_.feed && t < S_.core[0] + 0.1) {
    puff(g, WHITE, cx, cy, tile * 0.3 * span(t, [S_.feed, S_.core[0] + 0.1]), 0.8 * all);
  }
  // The near side of the disc, over the core.
  if (discOn) {
    const fade = novaAge >= 0 ? 1 - span(novaAge, [0.2, 1.2]) : 1;
    for (const d of DISC) {
      if (d.rank > q) continue;
      const [x, y, side] = discPt(d);
      if (side <= 0) continue;
      const a = discAlpha * fade * (0.6 + 0.4 * Math.sin(t * 9 + d.tw)) * all;
      puff(g, discCol(d), cx + x, cy + y, tile * 0.034, a);
    }
  }

  // The nova: a flash, rays, a shock ring off the Field, sparks; each sector's edge flares as the ring reaches it.
  const shockV = Math.hypot(fw, fh) / 0.9;
  if (novaAge >= 0 && novaAge < 1.6) {
    const k = Math.exp(-novaAge / 0.12);
    const big = Math.hypot(fw, fh);
    if (k > 0.01) {
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, big * 0.7);
      grd.addColorStop(0, rgba(WHITE, 0.95 * k * all));
      grd.addColorStop(0.25, rgba(ICE, 0.45 * k * all));
      grd.addColorStop(1, rgba(CYAN, 0));
      g.fillStyle = grd;
      g.fillRect(fx, fy, fw, fh);
    }
    // Rays.
    const rays = 26;
    g.lineCap = "round";
    for (let j = 0; j < rays; j++) {
      const a = (j / rays) * Math.PI * 2 + 0.13 * Math.sin(j * 7.1);
      const len = big * (0.25 + 0.5 * easeOut(Math.min(1, novaAge / 0.5))) * (0.6 + 0.4 * Math.sin(j * 3.3));
      const fade = Math.exp(-novaAge / 0.3);
      if (fade < 0.02) continue;
      const grd = g.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      grd.addColorStop(0, rgba(WHITE, 0.6 * fade * all));
      grd.addColorStop(1, rgba(ICE, 0));
      g.strokeStyle = grd;
      g.lineWidth = tile * (0.03 + 0.04 * (j % 3 === 0 ? 1 : 0));
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
      g.stroke();
    }
    // The shock ring: particles on a wobbling front, thickest at the front.
    const rr = shockV * novaAge;
    const m = Math.round(150 * q);
    const ringA = (1 - span(novaAge, [0.6, 1.3])) * all;
    for (let j = 0; j < m; j++) {
      const a = (j / m) * Math.PI * 2;
      const wob = 1 + 0.03 * Math.sin(a * 7 + novaAge * 5) + 0.02 * Math.sin(a * 13 - novaAge * 9);
      for (let b = 0; b < 3; b++) {
        const r = rr * wob - b * tile * 0.12;
        if (r <= 0) continue;
        puff(g, b === 0 ? WHITE : b === 1 ? ICE : CYAN, cx + Math.cos(a) * r, cy + Math.sin(a) * r, tile * (0.05 - b * 0.012), ringA * (1 - b * 0.3));
      }
    }
    // Sparks flung out with the tiles.
    for (const s of SPARKS) {
      if (s.rank > q) continue;
      const age = novaAge - s.born;
      if (age < 0 || age > 1.1) continue;
      const d = tile * s.v * (age * 9 - age * age * 3);
      puff(g, s.gold ? GOLD : ICE, cx + Math.cos(s.a) * d, cy + Math.sin(s.a) * d, tile * 0.022 * s.size, (1 - age / 1.1) * all);
    }
  }
  // Each sector's edge flares as the shock reaches it, and keeps a faint gold glow.
  for (const [, sx, sy] of geo.sectors) {
    const age = still ? 9 : novaAge - Math.hypot(sx - fw / 2, sy - fh / 2) / shockV;
    if (age < 0) continue;
    const k = Math.exp(-age / 0.2);
    const keep = still ? 0.5 : 0.5 * (1 - span(t, [S_.embers, S_.out[0]]));
    const pts = hexPts(fx + sx, fy + sy, R * 0.96);
    pts.forEach(([px, py], j) => {
      const [qx, qy] = pts[(j + 1) % 6]!;
      puff(g, k > 0.3 ? WHITE : GOLD, px, py, R * 0.08, (0.9 * k + keep) * all);
      puff(g, ICE, (px + qx) / 2, (py + qy) / 2, R * 0.06, 0.8 * k * all);
    });
  }

  // The halo left round the middle (behind the banner).
  const hOn = still ? 1 : easeOut(span(t, [S_.nova + 0.25, S_.nova + 0.8]));
  if (hOn > 0) {
    const Rh = Math.min(fw, fh) * 0.34 * (0.85 + 0.15 * hOn);
    const m = Math.round(110 * q);
    const lastA = (still ? 1 : 1 - span(t, [S_.embers + 0.2, S_.out[1]])) * hOn * all;
    for (let j = 0; j < m; j++) {
      const a = (j / m) * Math.PI * 2 + (still ? 0 : t * 0.35);
      const fl = 0.6 + 0.4 * Math.sin((still ? 0 : t) * 7 + j * 1.9);
      puff(g, j % 3 === 0 ? WHITE : GOLD, cx + Math.cos(a) * Rh, cy + Math.sin(a) * Rh * 0.42, tile * 0.03, fl * lastA);
    }
    puff(g, GOLD, cx, cy, Rh * 0.9, 0.08 * lastA);
  }
  // Embers drifting outwards.
  if (!still) {
    for (const e of EMBERS) {
      if (e.rank > q) continue;
      const age = t - e.born;
      if (age < 0 || age > e.life) continue;
      const u = age / e.life;
      const d = Math.min(fw, fh) * (e.r0 + e.v * u * 0.6);
      puff(g, e.gold ? GOLD : EMBER, cx + Math.cos(e.a + u * 0.4) * d, cy + Math.sin(e.a + u * 0.4) * d * 0.8 - tile * u * 0.4, tile * 0.025, Math.sin(Math.PI * u) * 0.9 * all);
    }
  }
  g.restore();
}
