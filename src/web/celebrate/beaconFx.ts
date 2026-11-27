/**
 * Beacon Spiral, a mission win (designer 2026-11-27: "be creative and put more effort"; times in
 * timeline.ts BEACON): the Field is marked from orbit, one sector at a time, and answers with one beacon.
 *
 * 1. (0-1.0 s) The Field dims. Brackets close on the Mission bar's cells and lock them; a targeting
 *    marker (a turning broken ring and a dot) opens on every sector, the edge of the Field first.
 * 2. (1.0-2.9 s) Beams of falling particles come down from above the page, one per sector, in a spiral
 *    from the edge of the Field to its middle: each strike flashes the sector, sends a hex shock ring out,
 *    presses the tile down (it bounces back) and lifts motes; the beam narrows and burns out, and the
 *    sector stays lit with a gold rim.
 * 3. (2.9-4.0 s) Every lit sector streams its light into the middle of the Field, swirling in; there a
 *    pillar of light fires up off the top of the page with a ground ring, and the Mission bar turns gold;
 *    the standard banner slams in.
 * 4. (4.0-5.6 s) The pillar thins and goes, motes rise, everything cross-fades out.
 *
 * Every moving thing is worked out from the time alone. A slow machine draws fewer particles and no glow
 * passes (`q`), never slower. The same colours for every Company. Screen only: no rule here.
 */

import { easeOut } from "../anim.js";
import { BEACON, span } from "./timeline.js";
import { type Geo, hexPath, hexPts, puff, rgba, seq } from "./winKit.js";

const CYAN = "92 214 255";
const ICE = "190 240 255";
const WHITE = "255 255 255";
const GOLD = "255 206 120";
const VIOLET = "170 128 255";

/** One beam: its sector, the order it falls in, when it strikes (s). */
export interface Strike {
  key: string;
  index: number;
  at: number;
  /** When its targeting marker opens (s). */
  mark: number;
}

/** Where the beacon fires: the sector nearest the middle of the sectors (Field pixels). */
export function beaconMiddle(sectors: readonly (readonly [string, number, number])[]): [number, number] {
  if (sectors.length === 0) return [0, 0];
  const x = sectors.reduce((s, [, sx]) => s + sx, 0) / sectors.length;
  const y = sectors.reduce((s, [, , sy]) => s + sy, 0) / sectors.length;
  const best = sectors.reduce((a, b) => (Math.hypot(b[1] - x, b[2] - y) < Math.hypot(a[1] - x, a[2] - y) - 1e-6 ? b : a));
  return [best[1], best[2]];
}

/** When cell i of n locks (s). */
export function beaconCellAt(i: number, n: number): number {
  const step = n > 1 ? Math.min(BEACON.cellStep, BEACON.cellsIn / (n - 1)) : 0;
  return BEACON.cellsAt + i * step;
}

/**
 * The spiral: rings round the middle (a hex step apart), the outermost first; round each ring by angle,
 * clockwise from the top, each ring starting a little further on so the order winds in as one spiral.
 * The beams are evenly spread over strikes[0]..strikes[1]; the markers open in the same order over marks.
 */
export function spiralOrder(sectors: readonly (readonly [string, number, number])[], tile: number): Strike[] {
  const [mx, my] = beaconMiddle(sectors);
  const step = tile * 0.866;
  const ringOf = (x: number, y: number) => Math.round(Math.hypot(x - mx, y - my) / step);
  const outer = Math.max(0, ...sectors.map(([, x, y]) => ringOf(x, y)));
  const key = ([, x, y]: readonly [string, number, number]) => {
    const ring = ringOf(x, y);
    const twist = (outer - ring) * 0.9;
    const ang = (((Math.atan2(x - mx, -(y - my)) - twist) % (Math.PI * 2)) + Math.PI * 4) % (Math.PI * 2);
    return (outer - ring) * Math.PI * 2 + ang;
  };
  const list = [...sectors].sort((a, b) => key(a) - key(b) || a[0].localeCompare(b[0]));
  const N = list.length;
  return list.map(([k], i) => {
    const u = N > 1 ? i / (N - 1) : 0;
    return { key: k, index: i, at: BEACON.strikes[0] + u * (BEACON.strikes[1] - BEACON.strikes[0]), mark: BEACON.marks[0] + u * (BEACON.marks[1] - BEACON.marks[0]) };
  });
}

/** A struck sector's tile: pressed down by the beam (to about 0.91), then a bounce back up past its size; and a lift in the pillar's flash. */
export function beaconLook(age: number, t: number, tile: number): { dx: number; dy: number; scale: number } | undefined {
  const p = t - BEACON.pillar;
  const lift = p >= 0 && p < 0.5 ? 0.03 * Math.exp(-p / 0.12) : 0;
  if (!(age >= 0 && age < 0.7) && !lift) return undefined;
  const s = age >= 0 && age < 0.7 ? -0.09 * Math.exp(-age / 0.05) + 0.06 * Math.sin(age * 22) * Math.exp(-age / 0.16) : 0;
  return { dx: 0, dy: age >= 0 && age < 0.7 ? tile * 0.03 * Math.exp(-age / 0.06) : 0, scale: 1 + s + lift };
}

// Particles fixed once (each with a rank: a slow machine draws only those below its quality).
const FALL = (() => {
  const r = seq(6211);
  return Array.from({ length: 22 }, (_, i) => ({ off: (r() - 0.5) * 2, ph: r(), v: 2.2 + r() * 1.6, size: 0.5 + r() * 0.9, white: r() < 0.35, rank: i / 22 }));
})();
const LIFT = (() => {
  const r = seq(3301);
  return Array.from({ length: 10 }, (_, i) => ({ a: r() * Math.PI * 2, d: 0.2 + r() * 0.7, life: 0.6 + r() * 0.6, rise: 0.5 + r() * 0.8, size: 0.6 + r() * 0.8, gold: r() < 0.4, rank: i / 10 }));
})();
const STREAM = (() => {
  const r = seq(9157);
  return Array.from({ length: 7 }, (_, i) => ({ at: r() * 0.55, spin: 0.6 + r() * 0.9, size: 0.6 + r() * 0.8, white: r() < 0.3, rank: i / 7 }));
})();
const SHAFT = (() => {
  const r = seq(1213);
  return Array.from({ length: 90 }, (_, i) => ({ off: (r() - 0.5) * 2, ph: r(), v: 0.9 + r() * 1.4, size: 0.5 + r() * 1.2, gold: r() < 0.3, rank: i / 90 }));
})();
const RISE = (() => {
  const r = seq(7741);
  return Array.from({ length: 70 }, (_, i) => ({ x: r(), y: 0.25 + r() * 0.75, born: BEACON.fade - 0.2 + r() * 1.1, life: 0.9 + r() * 0.8, rise: 0.12 + r() * 0.24, size: 0.6 + r() * 1.2, wob: r() * 6, gold: r() < 0.4, rank: i / 70 }));
})();

/** Four corner brackets round a box, closed by c (0 = far out, 1 = on the box). */
function brackets(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number, rgb: string, a: number): void {
  const pad = (1 - easeOut(c)) * Math.max(w, h) * 1.2 + 2;
  const L = Math.max(4, Math.min(w, h) * 0.35);
  const x0 = x - pad;
  const y0 = y - pad;
  const x1 = x + w + pad;
  const y1 = y + h + pad;
  g.strokeStyle = rgba(rgb, a);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(x0, y0 + L);
  g.lineTo(x0, y0);
  g.lineTo(x0 + L, y0);
  g.moveTo(x1 - L, y0);
  g.lineTo(x1, y0);
  g.lineTo(x1, y0 + L);
  g.moveTo(x1, y1 - L);
  g.lineTo(x1, y1);
  g.lineTo(x1 - L, y1);
  g.moveTo(x0 + L, y1);
  g.lineTo(x0, y1);
  g.lineTo(x0, y1 - L);
  g.stroke();
}

/** A targeting marker: a broken ring turning, a dot, four short ticks; it tightens as the beam comes. */
function marker(g: CanvasRenderingContext2D, x: number, y: number, R: number, open: number, tight: number, t: number, i: number, a: number): void {
  if (a <= 0.01 || open <= 0) return;
  const r = R * (0.95 - 0.35 * tight) * (1.4 - 0.4 * easeOut(open));
  const turn = t * (1.6 + (i % 3) * 0.4) * (i % 2 ? 1 : -1);
  g.strokeStyle = rgba(CYAN, 0.5 * a * open);
  g.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    g.arc(x, y, r, turn + (k * Math.PI * 2) / 3, turn + (k * Math.PI * 2) / 3 + 1.4);
    g.stroke();
  }
  // Four ticks, as short rows of particles pointing in.
  for (let k = 0; k < 4; k++) {
    const an = (k * Math.PI) / 2 + turn * 0.25;
    for (let j = 0; j < 3; j++) {
      const d = r * (1.12 - j * 0.12 - 0.08 * tight);
      puff(g, ICE, x + Math.cos(an) * d, y + Math.sin(an) * d, R * 0.035, 0.7 * a * open);
    }
  }
  puff(g, tight > 0.5 ? WHITE : CYAN, x, y, R * (0.1 + 0.08 * tight), 0.9 * a * open);
}

/**
 * One frame of Beacon Spiral, drawn on MissionWin's page-wide canvas. `all` is how much of it shows (1
 * until the cross-fade); `still`: the reduced-motion picture (the bar locked, every sector lit, a thin
 * beacon in the middle).
 */
export function paintBeacon(g: CanvasRenderingContext2D, geo: Geo, t: number, still: boolean, all: number, q: number, strikes: Strike[]): void {
  const { fx, fy, fw, fh, tile } = geo;
  const R = tile * 0.46;
  const n = geo.cells.length;
  const at = new Map(geo.sectors.map(([k, x, y]) => [k, [fx + x, fy + y] as const]));
  const [mx0, my0] = beaconMiddle(geo.sectors);
  const mx = fx + mx0;
  const my = fy + my0;
  // The sectors' light stays until the gather has taken it.
  const keep = still ? 1 : 1 - 0.65 * span(t, [BEACON.gather[0], BEACON.pillar]) - 0.35 * span(t, [BEACON.fade, BEACON.out[0]]);

  g.save();
  g.globalCompositeOperation = "lighter";
  // Act 1: brackets close on each cell and lock it (a flash, then a steady glow).
  geo.cells.forEach((c, i) => {
    const t0 = beaconCellAt(i, n);
    const c01 = still ? 1 : span(t, [t0 - 0.25, t0]);
    if (c01 <= 0) return;
    const age = still ? 9 : t - t0;
    const gold = still || t >= BEACON.pillar;
    brackets(g, c.left, c.top, c.width, c.height, c01, gold ? GOLD : CYAN, (age < 0 ? 0.8 : 0.55) * all);
    if (age >= 0) {
      const x = c.left + c.width / 2;
      const y = c.top + c.height / 2;
      const s = Math.max(c.width, c.height);
      const k = Math.exp(-age / 0.12);
      const Rg = s * (1.3 + 1.5 * k);
      const grd = g.createRadialGradient(x, y, 0, x, y, Rg);
      grd.addColorStop(0, rgba(WHITE, (0.25 + 0.8 * k) * all));
      grd.addColorStop(0.3, rgba(gold ? GOLD : CYAN, (0.2 + 0.4 * k) * all));
      grd.addColorStop(1, rgba(CYAN, 0));
      g.fillStyle = grd;
      g.fillRect(x - Rg, y - Rg, 2 * Rg, 2 * Rg);
    }
  });
  g.restore();

  // The Field: markers, strikes, the lit sectors, the gather (clipped to it). The beams come from above
  // the page, so they are drawn unclipped afterwards.
  g.save();
  g.beginPath();
  g.rect(fx, fy, fw, fh);
  g.clip();
  g.globalCompositeOperation = "lighter";
  for (const s of strikes) {
    const p = at.get(s.key);
    if (!p) continue;
    const [x, y] = p;
    const age = still ? 9 : t - s.at;
    if (age < 0) {
      // The marker waits for its beam, tightening as it comes.
      const open = span(t, [s.mark, s.mark + 0.25]);
      const tight = span(t, [s.at - 0.35, s.at]);
      marker(g, x, y, R, open, tight, t, s.index, all);
      continue;
    }
    // The strike: a flash, a hex shock ring going out, motes lifting.
    const k = Math.exp(-age / 0.12);
    if (k > 0.02) {
      hexPath(g, x, y, R);
      g.fillStyle = rgba(ICE, 0.35 * k * all);
      g.fill();
      puff(g, WHITE, x, y, R * (0.6 + 0.7 * k), 0.85 * k * all);
    }
    if (age < 0.45) {
      // The shock: a hex ring of particles going out, with a faint line under it.
      const u = age / 0.45;
      const rr = R * (1 + 0.55 * easeOut(u));
      hexPath(g, x, y, rr, 0.92);
      g.strokeStyle = rgba(u < 0.25 ? WHITE : CYAN, 0.35 * (1 - u) * all);
      g.lineWidth = 1 + 1.5 * (1 - u);
      g.stroke();
      const pts = hexPts(x, y, rr, 0.92);
      const m = Math.round(30 * q);
      for (let j = 0; j < m; j++) {
        const f = (j + 0.5 * Math.sin(j * 7.1)) / m;
        const e = Math.floor(((f % 1) + 1) % 1 * 6);
        const w = ((((f % 1) + 1) % 1) * 6) - e;
        const [ax, ay] = pts[e]!;
        const [bx, by] = pts[(e + 1) % 6]!;
        const jit = Math.sin(j * 12.9 + s.index) * R * 0.05 * u;
        puff(g, j % 4 ? CYAN : WHITE, ax + (bx - ax) * w + jit, ay + (by - ay) * w - jit, R * (0.05 + 0.03 * (j % 3)), (1 - u) ** 1.3 * all);
      }
    }
    for (const m of LIFT) {
      if (m.rank > q || still) continue;
      const a2 = age - 0.03;
      if (a2 < 0 || a2 > m.life) continue;
      const u = a2 / m.life;
      const px = x + Math.cos(m.a + s.index) * R * m.d;
      const py = y + Math.sin(m.a + s.index) * R * m.d * 0.6 - m.rise * tile * u;
      puff(g, m.gold ? GOLD : ICE, px, py, R * 0.06 * m.size, Math.sin(Math.PI * u) * 0.9 * all);
    }
    // The sector stays lit: a soft inner light and a gold rim, breathing a little.
    const lit = Math.min(1, age / 0.3) * keep * all;
    const br = 0.85 + 0.15 * Math.sin(t * 3.2 + s.index * 0.7);
    hexPath(g, x, y, R * 0.93);
    g.fillStyle = rgba(CYAN, 0.08 * lit * br);
    g.fill();
    g.strokeStyle = rgba(GOLD, 0.6 * lit * br);
    g.lineWidth = 1.3;
    g.stroke();
  }
  // Act 3: the gather: each sector's light streams into the middle, swirling in.
  if (!still && t >= BEACON.gather[0] && t < BEACON.pillar + 0.15) {
    const dur = BEACON.pillar - BEACON.gather[0];
    strikes.forEach((s, i) => {
      const p = at.get(s.key);
      if (!p) return;
      for (const m of STREAM) {
        if (m.rank > q) continue;
        const u = span(t, [BEACON.gather[0] + m.at * dur * 0.6, BEACON.pillar]);
        if (u <= 0 || u >= 1) continue;
        const e = u * u;
        const dx = p[0] - mx;
        const dy = p[1] - my;
        const sw = e * m.spin * 1.4;
        const c = Math.cos(sw);
        const sn = Math.sin(sw);
        const x = mx + (dx * c - dy * sn) * (1 - e);
        const y = my + (dx * sn + dy * c) * (1 - e);
        puff(g, m.white ? WHITE : i % 4 ? CYAN : GOLD, x, y, tile * 0.04 * m.size * (0.6 + 0.6 * u), (0.5 + 0.5 * u) * all);
      }
    });
    // The core gathering in the middle.
    const f = span(t, BEACON.gather);
    puff(g, CYAN, mx, my, tile * (0.3 + 0.9 * f), 0.5 * f * all);
    puff(g, WHITE, mx, my, tile * 0.35 * f, 0.9 * f * all);
  }
  // The ground ring of the pillar.
  if (!still) {
    const age = t - BEACON.pillar;
    if (age >= 0 && age < 1.1) {
      const u = age / 1.1;
      const rr = Math.max(fw, fh) * 0.9 * easeOut(u);
      g.beginPath();
      g.ellipse(mx, my, rr, rr * 0.82, 0, 0, Math.PI * 2);
      g.strokeStyle = rgba(WHITE, 0.7 * (1 - u) * all);
      g.lineWidth = 1.5 + 3 * (1 - u);
      g.stroke();
      if (q > 0.6) {
        g.strokeStyle = rgba(CYAN, 0.2 * (1 - u) * all);
        g.lineWidth = tile * 0.35 * (1 - u);
        g.stroke();
      }
    }
  }
  g.restore();

  g.save();
  g.globalCompositeOperation = "lighter";
  // Act 2: the beams, from above the top of the page down to their sectors.
  if (!still) {
    for (const s of strikes) {
      const p = at.get(s.key);
      if (!p) continue;
      const [x, y] = p;
      const age = t - s.at;
      if (age < -BEACON.fall || age > BEACON.burn) continue;
      const head = age < 0 ? y * (1 + age / BEACON.fall) : y;
      const left = age < 0 ? 1 : (1 - age / BEACON.burn) ** 1.5;
      const w = tile * 0.2 * left + 1;
      const top = -10;
      // The column: a soft body and a white core.
      if (q > 0.6) {
        const body = g.createLinearGradient(x - w * 1.6, 0, x + w * 1.6, 0);
        body.addColorStop(0, rgba(CYAN, 0));
        body.addColorStop(0.5, rgba(CYAN, 0.28 * left * all));
        body.addColorStop(1, rgba(CYAN, 0));
        g.fillStyle = body;
        g.fillRect(x - w * 1.6, top, w * 3.2, head - top);
      }
      const core = g.createLinearGradient(x - w * 0.4, 0, x + w * 0.4, 0);
      core.addColorStop(0, rgba(WHITE, 0));
      core.addColorStop(0.5, rgba(WHITE, 0.9 * left * all));
      core.addColorStop(1, rgba(WHITE, 0));
      g.fillStyle = core;
      g.fillRect(x - w * 0.4, top, w * 0.8, head - top);
      // Particles falling down it: the beam is made of them.
      const L = head - top;
      for (const f of FALL) {
        if (f.rank > q) continue;
        const py = top + ((f.ph + t * f.v * (tile * 6 / Math.max(1, L))) % 1) * L;
        puff(g, f.white ? WHITE : CYAN, x + f.off * w * 0.9, py, tile * 0.03 * f.size + 0.5, 0.8 * left * all);
      }
      puff(g, WHITE, x, head, w * 2.4, 0.9 * left * all);
    }
  }
  // Act 3: the pillar, from the middle of the Field up off the top of the page.
  const pa = still ? 0 : t - BEACON.pillar;
  if (still || pa >= 0) {
    const grow = still ? 1 : easeOut(Math.min(1, pa / 0.12));
    const thin = still ? 0.25 : 1 - 0.85 * span(t, [BEACON.fade, BEACON.out[1]]);
    const flare = still ? 0 : Math.exp(-pa / 0.18);
    const w = tile * (0.42 * thin + 0.5 * flare);
    const top = my - (my + 20) * grow;
    if (q > 0.6) {
      const halo = g.createLinearGradient(mx - w * 3, 0, mx + w * 3, 0);
      halo.addColorStop(0, rgba(CYAN, 0));
      halo.addColorStop(0.5, rgba(CYAN, 0.3 * all * (thin + flare)));
      halo.addColorStop(1, rgba(CYAN, 0));
      g.fillStyle = halo;
      g.fillRect(mx - w * 3, top, w * 6, my - top);
    }
    const body = g.createLinearGradient(mx - w, 0, mx + w, 0);
    body.addColorStop(0, rgba(ICE, 0));
    body.addColorStop(0.35, rgba(ICE, 0.55 * all * thin));
    body.addColorStop(0.5, rgba(WHITE, Math.min(1, (0.85 + flare) * all * Math.max(thin, 0.4))));
    body.addColorStop(0.65, rgba(ICE, 0.55 * all * thin));
    body.addColorStop(1, rgba(ICE, 0));
    g.fillStyle = body;
    g.fillRect(mx - w, top, w * 2, my - top);
    // Its foot, and particles shooting up it.
    puff(g, WHITE, mx, my, tile * (0.5 + 1.4 * flare), (0.6 * thin + 0.4 * flare) * all);
    puff(g, CYAN, mx, my, tile * (1 + 1.6 * flare), 0.35 * all * (thin + flare));
    if (!still) {
      const L = Math.max(1, my - top);
      for (const s of SHAFT) {
        if (s.rank > q) continue;
        const u = (s.ph + pa * s.v * (tile * 9 / L)) % 1;
        const py = my - u * L;
        const px = mx + s.off * w * (1.2 + 0.8 * u);
        puff(g, s.gold ? GOLD : u > 0.5 ? WHITE : CYAN, px, py, tile * 0.03 * s.size + 0.6, (1 - u * 0.6) * thin * all);
      }
    }
  }
  // Act 4: motes rise over the Field.
  if (!still) {
    for (const e of RISE) {
      if (e.rank > q) continue;
      const age = t - e.born;
      if (age < 0 || age > e.life) continue;
      const u = age / e.life;
      const x = fx + fw * e.x + Math.sin(e.wob + age * 2.2) * tile * 0.12;
      const y = fy + fh * (e.y - e.rise * u);
      puff(g, e.gold ? GOLD : u > 0.5 ? VIOLET : ICE, x, y, tile * 0.03 * e.size, Math.sin(Math.PI * u) * 0.85 * all);
    }
  }
  g.restore();
}
