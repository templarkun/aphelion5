/**
 * The Terraformer outro: the target sector and what happens to it. Before: dark ground cut by
 * glowing rifts (the hostile planet). Each pylon that lands sends a shock wave out over the
 * curve of the globe; whatever a wave has passed is changed for good: the rifts go out, and in
 * their place come the Company's energy grid (a six-sided mesh), rings and spokes round every
 * pylon, lit conduits between the pylons with pulses running along them, domes, and thousands
 * of small lights, all in the Company's colours.
 *
 * Everything is placed once (the same every time) and each thing knows the moment the first
 * wave reaches it, so any moment of the film can be drawn by itself. Looks only.
 */

import { noise3 } from "../../noise.js";
import { clamp, cross, easeOut, rng, smooth, TAU, unit, type V3 } from "../../briefing/styles/intro2/math3.js";
import type { CompanyTheme } from "../types.js";
import { mixRgb, softSprite } from "./pylon.js";
import type { SitePlace } from "./timeline.js";
import { DEG, faces, place, see, type Cam } from "./view.js";

/** How fast a shock wave runs over the ground, degrees a second. */
export const WAVE_SPEED = 8.5;
/** How far a wave is seen before it has faded, degrees. */
const WAVE_REACH = 30;
/** The mesh reaches this far from a pylon, degrees. */
const GRID_REACH = 8.4;

export interface Site {
  lon: number;
  lat: number;
  /** When its pylon hits. */
  at: number;
  /** The place on the ground, and two directions along the ground there. */
  n: V3;
  e1: V3;
  e2: V3;
  tag: string;
}

export interface Sector {
  sites: Site[];
  /** The moment the first shock wave reaches lon, lat. */
  reachedAt(lon: number, lat: number): number;
  /** Everything on the ground (drawn inside the globe's shape). */
  ground(g: CanvasRenderingContext2D, c: Cam, t: number): void;
  /** How much of the sector is changed, 0..1. */
  progress(t: number): number;
}

const RING_STEPS = 72;

export function createSector(theme: CompanyTheme, places: SitePlace[], hits: number[], tags: string[]): Sector {
  const R = rng(1977 + places.length * 31);
  const sites: Site[] = places.map((p, i) => {
    const n = place(p.lon, p.lat);
    const e1 = unit(cross([0, 1, 0], n));
    const e2 = cross(n, e1);
    return { lon: p.lon, lat: p.lat, at: hits[i]!, n, e1, e2, tag: tags[i] ?? "" };
  });
  const nearest = (lon: number, lat: number) => {
    let best = Infinity;
    for (const s of sites) best = Math.min(best, Math.hypot(lon - s.lon, lat - s.lat));
    return best;
  };
  const reachedAt = (lon: number, lat: number) => {
    let best = Infinity;
    for (const s of sites) best = Math.min(best, s.at + Math.hypot(lon - s.lon, lat - s.lat) / WAVE_SPEED);
    return best;
  };
  const last = Math.max(...sites.map((s) => s.at));
  const first = Math.min(...sites.map((s) => s.at));

  // ---- Lines: [x0 y0 z0 x1 y1 z1] each, with the moment it lights up. kind 0 mesh, 1 rings and spokes, 2 conduits.
  const lw: number[] = [];
  const lat0: number[] = [];
  const lkind: number[] = [];
  const line = (lonA: number, latA: number, lonB: number, latB: number, kind: number) => {
    lw.push(...place(lonA, latA), ...place(lonB, latB));
    lat0.push(reachedAt((lonA + lonB) / 2, (latA + latB) / 2));
    lkind.push(kind);
  };
  // ---- Lights: a point each, with its moment, size, colour (0 main, 1 second, 2 warm white) and twinkle.
  const pw: number[] = [];
  const pat: number[] = [];
  const psize: number[] = [];
  const pcol: number[] = [];
  const pph: number[] = [];
  const light = (lon: number, la: number, size: number, col: number) => {
    pw.push(...place(lon, la));
    pat.push(reachedAt(lon, la) + 0.05 + R() * 0.5);
    psize.push(size);
    pcol.push(col);
    pph.push(R() * TAU);
  };

  // The mesh: a six-sided lattice, kept near the pylons, with gaps so it does not look stamped on.
  const S = 0.8;
  const seen = new Set<string>();
  const corners = new Map<string, [number, number]>();
  for (let j = -14; j <= 14; j++)
    for (let i = -16; i <= 16; i++) {
      const cx = S * Math.sqrt(3) * (i + (j & 1) / 2);
      const cy = S * 1.5 * j;
      for (let k = 0; k < 6; k++) {
        const a0 = ((60 * k + 30) * Math.PI) / 180;
        const a1 = ((60 * (k + 1) + 30) * Math.PI) / 180;
        const ax = cx + S * Math.cos(a0);
        const ay = cy + S * Math.sin(a0);
        const bx = cx + S * Math.cos(a1);
        const by = cy + S * Math.sin(a1);
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        const key = `${Math.round(mx * 40)}:${Math.round(my * 40)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const d = nearest(mx, my);
        const reach = GRID_REACH * (0.7 + 0.4 * (0.5 + 0.5 * noise3(mx * 0.3, my * 0.3, 3.3)));
        if (d > reach || noise3(mx * 0.85, my * 0.85, 9.1) > 0.38) continue;
        // Thinner towards its edge.
        if (d > reach * 0.6 && R() < (d / reach - 0.6) * 1.6) continue;
        line(ax, ay, bx, by, 0);
        corners.set(`${Math.round(ax * 40)}:${Math.round(ay * 40)}`, [ax, ay]);
        corners.set(`${Math.round(bx * 40)}:${Math.round(by * 40)}`, [bx, by]);
      }
    }
  for (const [x, y] of corners.values()) {
    const k = R();
    if (k < 0.42) light(x, y, 0.5 + R() * 0.8, k < 0.06 ? 2 : k < 0.14 ? 1 : 0);
  }
  // Rings and spokes round every pylon; a town of lights at its foot.
  const domes: { lon: number; lat: number; r: number; at: number }[] = [];
  for (const s of sites) {
    for (const rad of [1.15, 2.3, 3.7]) {
      const steps = rad < 2 ? 24 : 40;
      for (let i = 0; i < steps; i++) {
        // The outer rings are broken into arcs.
        if (rad > 2 && (i + Math.round(s.lon * 3)) % 10 === 0) continue;
        const a0 = (i / steps) * TAU;
        const a1 = ((i + 1) / steps) * TAU;
        line(s.lon + rad * Math.cos(a0), s.lat + rad * Math.sin(a0), s.lon + rad * Math.cos(a1), s.lat + rad * Math.sin(a1), 1);
      }
    }
    for (let k = 0; k < 6; k++) {
      const a = ((k * 60 + 15) * Math.PI) / 180;
      for (const [r0, r1] of [[1.15, 2.3], [2.3, 3.7]] as const) line(s.lon + r0 * Math.cos(a), s.lat + r0 * Math.sin(a), s.lon + r1 * Math.cos(a), s.lat + r1 * Math.sin(a), 1);
      const b = ((k * 60 + 45) * Math.PI) / 180;
      domes.push({ lon: s.lon + 2.3 * Math.cos(b), lat: s.lat + 2.3 * Math.sin(b), r: 0.3, at: 0 });
    }
    for (let i = 0; i < 54; i++) {
      // Thick near the pylon, thinning out.
      const rad = 0.25 + Math.abs(R() + R() + R() - 1.5) * 2.6;
      const a = R() * TAU;
      light(s.lon + rad * Math.cos(a), s.lat + rad * Math.sin(a), 0.6 + R() * 1.1, R() < 0.5 ? 2 : R() < 0.5 ? 1 : 0);
    }
    domes.push({ lon: s.lon, lat: s.lat, r: 0.95, at: s.at + 0.25 });
  }
  for (const d of domes) if (!d.at) d.at = reachedAt(d.lon, d.lat) + 0.2;
  // Conduits: every pylon joined to its nearest neighbours, each with a bend in it.
  const conduits: { a: V3; m: V3; b: V3; at: number; ph: number }[] = [];
  const joined = new Set<string>();
  sites.forEach((s, i) => {
    const near = sites
      .map((o, j) => ({ j, d: Math.hypot(o.lon - s.lon, o.lat - s.lat) }))
      .filter((o) => o.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 3);
    for (const { j } of near) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (joined.has(key)) continue;
      joined.add(key);
      const o = sites[j]!;
      // A bend: along the track first, then across.
      const bend = 0.5 + (R() - 0.5) * 0.5;
      const mlon = s.lon + (o.lon - s.lon) * bend + (o.lat - s.lat) * 0.12;
      const mlat = s.lat + (o.lat - s.lat) * bend - (o.lon - s.lon) * 0.12;
      const parts = 7;
      for (let k = 0; k < parts; k++) {
        line(s.lon + ((mlon - s.lon) * k) / parts, s.lat + ((mlat - s.lat) * k) / parts, s.lon + ((mlon - s.lon) * (k + 1)) / parts, s.lat + ((mlat - s.lat) * (k + 1)) / parts, 2);
        line(mlon + ((o.lon - mlon) * k) / parts, mlat + ((o.lat - mlat) * k) / parts, mlon + ((o.lon - mlon) * (k + 1)) / parts, mlat + ((o.lat - mlat) * (k + 1)) / parts, 2);
        if (k % 2 === 0) light(s.lon + ((mlon - s.lon) * (k + 0.5)) / parts, s.lat + ((mlat - s.lat) * (k + 0.5)) / parts, 0.9, 2);
        else light(mlon + ((o.lon - mlon) * (k + 0.5)) / parts, mlat + ((o.lat - mlat) * (k + 0.5)) / parts, 0.9, 2);
      }
      conduits.push({ a: s.n, m: place(mlon, mlat), b: o.n, at: Math.max(s.at, o.at) + 0.35, ph: R() });
    }
  });
  const LW = new Float32Array(lw);
  const LAT = new Float32Array(lat0);
  const LK = new Uint8Array(lkind);
  const nLines = LAT.length;
  const PW = new Float32Array(pw);
  const nLights = pat.length;

  // ---- The hostile ground: rifts (wandering cracks) and embers along them. Each dies when a wave reaches it.
  const rw: number[] = [];
  const rat: number[] = [];
  const ew: number[] = [];
  const eat: number[] = [];
  const eph: number[] = [];
  for (let k = 0; k < 13; k++) {
    let lon = (R() - 0.5) * 38;
    let la = (R() - 0.5) * 28;
    let head = R() * TAU;
    for (let i = 0; i < 30; i++) {
      head += (R() - 0.5) * 0.9;
      const nlon = lon + Math.cos(head) * 0.6;
      const nla = la + Math.sin(head) * 0.6;
      rw.push(...place(lon, la), ...place(nlon, nla));
      rat.push(reachedAt((lon + nlon) / 2, (la + nla) / 2));
      for (let e = 0; e < 2; e++) {
        const ex = lon + (nlon - lon) * R() + (R() - 0.5) * 0.5;
        const ey = la + (nla - la) * R() + (R() - 0.5) * 0.5;
        ew.push(...place(ex, ey));
        eat.push(reachedAt(ex, ey));
        eph.push(R() * TAU);
      }
      lon = nlon;
      la = nla;
    }
  }
  const RW = new Float32Array(rw);
  const EW = new Float32Array(ew);

  const glow = softSprite(theme.glow, 0, 128);
  const node = softSprite(theme.secondary, 0.9, 64);
  const pulse = softSprite(theme.primary, 1, 48);
  const wave = softSprite(mixRgb(theme.primary, "255 255 255", 0.4), 1, 128);
  const lightCols = [theme.primary, theme.secondary, "255 236 200"];
  const ringX = new Float32Array(RING_STEPS + 1);
  const ringY = new Float32Array(RING_STEPS + 1);

  /** A circle on the ground round a pylon, `deg` degrees wide, as points of the picture. False if part of it is over the edge. */
  function ring(c: Cam, s: Site, deg: number): boolean {
    const cr = Math.cos(deg * DEG);
    const sr = Math.sin(deg * DEG);
    let whole = true;
    for (let i = 0; i <= RING_STEPS; i++) {
      const a = (i / RING_STEPS) * TAU;
      const ca = Math.cos(a) * sr;
      const sa = Math.sin(a) * sr;
      const x = s.n[0] * cr + s.e1[0] * ca + s.e2[0] * sa;
      const y = s.n[1] * cr + s.e1[1] * ca + s.e2[1] * sa;
      const z = s.n[2] * cr + s.e1[2] * ca + s.e2[2] * sa;
      if (!faces(c, x, y, z) || !see(c, x, y, z)) {
        whole = false;
        ringX[i] = NaN;
        continue;
      }
      ringX[i] = c.sx;
      ringY[i] = c.sy;
    }
    return whole;
  }
  function traceRing(g: CanvasRenderingContext2D | Path2D): void {
    let pen = false;
    for (let i = 0; i <= RING_STEPS; i++) {
      if (Number.isNaN(ringX[i]!)) {
        pen = false;
        continue;
      }
      if (pen) g.lineTo(ringX[i]!, ringY[i]!);
      else g.moveTo(ringX[i]!, ringY[i]!);
      pen = true;
    }
  }

  const progress = (t: number) => smooth(first, last + 1.6, t);

  function ground(g: CanvasRenderingContext2D, c: Cam, t: number): void {
    g.save();
    g.lineCap = "round";
    g.globalCompositeOperation = "lighter";

    // The rifts, while they last: a dull red crack with a brighter thread, and embers that flicker.
    g.beginPath();
    let any = false;
    for (let i = 0; i < rat.length; i++) {
      if (t >= rat[i]! + 0.3) continue;
      const o = i * 6;
      if (!faces(c, RW[o]!, RW[o + 1]!, RW[o + 2]!) || !see(c, RW[o]!, RW[o + 1]!, RW[o + 2]!)) continue;
      const x0 = c.sx;
      const y0 = c.sy;
      if (!see(c, RW[o + 3]!, RW[o + 4]!, RW[o + 5]!)) continue;
      g.moveTo(x0, y0);
      g.lineTo(c.sx, c.sy);
      any = true;
    }
    if (any) {
      g.strokeStyle = "rgb(255 50 16 / 0.1)";
      g.lineWidth = 6;
      g.stroke();
      g.strokeStyle = "rgb(255 96 40 / 0.3)";
      g.lineWidth = 0.9;
      g.stroke();
    }
    for (let i = 0; i < eat.length; i++) {
      const left = eat[i]! - t;
      if (left < -0.3) continue;
      const o = i * 3;
      if (!faces(c, EW[o]!, EW[o + 1]!, EW[o + 2]!) || !see(c, EW[o]!, EW[o + 1]!, EW[o + 2]!)) continue;
      if (c.sx < -4 || c.sx > c.w + 4 || c.sy < -4 || c.sy > c.h + 4) continue;
      const r = clamp((c.focal * 0.0011) / c.sz, 0.5, 1.7);
      if (left < 0) {
        // The wave is on it: one white flash, then gone.
        g.fillStyle = `rgb(255 255 255 / ${(1 + left / 0.3).toFixed(3)})`;
        g.fillRect(c.sx - r * 1.6, c.sy - r * 1.6, r * 3.2, r * 3.2);
      } else {
        g.fillStyle = `rgb(255 ${(140 + 60 * Math.sin(eph[i]!)) | 0} 60 / ${(0.5 + 0.4 * Math.sin(t * 1.9 + eph[i]!)).toFixed(3)})`;
        g.fillRect(c.sx - r, c.sy - r * 0.7, r * 2, r * 1.4);
      }
    }

    // The changed ground: a soft light spreading with each wave, lying flat on the ground.
    for (const s of sites) {
      const age = t - s.at;
      if (age <= 0) continue;
      const deg = Math.min(GRID_REACH + 3, age * WAVE_SPEED * 1.1);
      if (!see(c, s.n[0], s.n[1], s.n[2])) continue;
      const x0 = c.sx;
      const y0 = c.sy;
      const cr = Math.cos(deg * DEG);
      const sr = Math.sin(deg * DEG);
      if (!see(c, s.n[0] * cr + s.e1[0] * sr, s.n[1] * cr + s.e1[1] * sr, s.n[2] * cr + s.e1[2] * sr)) continue;
      const ax = c.sx - x0;
      const ay = c.sy - y0;
      if (!see(c, s.n[0] * cr + s.e2[0] * sr, s.n[1] * cr + s.e2[1] * sr, s.n[2] * cr + s.e2[2] * sr)) continue;
      g.save();
      g.transform(ax, ay, c.sx - x0, c.sy - y0, x0, y0);
      g.globalAlpha = 0.5 * smooth(0, 1.2, age);
      g.drawImage(glow, -1, -1, 2, 2);
      g.restore();
    }
    const done = progress(t);
    if (done > 0.01 && see(c, 0, 0, 1)) {
      // One wide glow over the whole sector, lying flat on the ground.
      const x0 = c.sx;
      const y0 = c.sy;
      const e = place(15, 0);
      const n = place(0, 13);
      if (see(c, e[0], e[1], e[2])) {
        const ax = c.sx - x0;
        const ay = c.sy - y0;
        if (see(c, n[0], n[1], n[2])) {
          g.save();
          g.transform(ax, ay, c.sx - x0, c.sy - y0, x0, y0);
          g.globalAlpha = 0.5 * done * (0.94 + 0.06 * Math.sin(t * 1.3));
          g.drawImage(glow, -1, -1, 2, 2);
          g.restore();
        }
      }
    }

    // The Company's lines: those just reached flash white, the rest burn steadily.
    const settled = [new Path2D(), new Path2D(), new Path2D()];
    const fresh = new Path2D();
    let anyFresh = false;
    for (let i = 0; i < nLines; i++) {
      const age = t - LAT[i]!;
      if (age < 0) continue;
      const o = i * 6;
      if (!faces(c, LW[o]!, LW[o + 1]!, LW[o + 2]!) || !faces(c, LW[o + 3]!, LW[o + 4]!, LW[o + 5]!)) continue;
      if (!see(c, LW[o]!, LW[o + 1]!, LW[o + 2]!)) continue;
      const x0 = c.sx;
      const y0 = c.sy;
      if (!see(c, LW[o + 3]!, LW[o + 4]!, LW[o + 5]!)) continue;
      if (Math.max(x0, c.sx) < -20 || Math.min(x0, c.sx) > c.w + 20 || Math.max(y0, c.sy) < -20 || Math.min(y0, c.sy) > c.h + 20) continue;
      const p = settled[LK[i]!]!;
      p.moveTo(x0, y0);
      p.lineTo(c.sx, c.sy);
      if (age < 0.45) {
        fresh.moveTo(x0, y0);
        fresh.lineTo(c.sx, c.sy);
        anyFresh = true;
      }
    }
    // Finer when seen from far.
    const fine = clamp(c.focal / 1300, 0.7, 1.5) * clamp(0.5 / Math.hypot(c.pos[0], c.pos[1], c.pos[2] - 1), 0.75, 1.5);
    const shimmer = 0.88 + 0.12 * Math.sin(t * 2.1);
    for (const [k, rgb, core, halo] of [
      [0, theme.primary, 0.5, 0.12],
      [1, theme.secondary, 0.7, 0.15],
      [2, mixRgb(theme.secondary, "255 255 255", 0.45), 0.95, 0.24],
    ] as const) {
      g.strokeStyle = `rgb(${rgb} / ${(halo * shimmer).toFixed(3)})`;
      g.lineWidth = (k === 2 ? 7 : 4.2) * fine;
      g.stroke(settled[k]!);
      g.strokeStyle = `rgb(${rgb} / ${(core * shimmer).toFixed(3)})`;
      g.lineWidth = (k === 2 ? 1.9 : 1) * fine;
      g.stroke(settled[k]!);
    }
    if (anyFresh) {
      g.strokeStyle = "rgb(255 255 255 / 0.85)";
      g.lineWidth = 1.8 * fine;
      g.stroke(fresh);
    }

    // The small lights.
    for (let i = 0; i < nLights; i++) {
      const age = t - pat[i]!;
      if (age < 0) continue;
      const o = i * 3;
      if (!faces(c, PW[o]!, PW[o + 1]!, PW[o + 2]!) || !see(c, PW[o]!, PW[o + 1]!, PW[o + 2]!)) continue;
      if (c.sx < -4 || c.sx > c.w + 4 || c.sy < -4 || c.sy > c.h + 4) continue;
      const r = clamp((psize[i]! * c.focal * 0.0011) / c.sz, 0.55, 2.6);
      const on = Math.min(1, age / 0.25);
      const a = on * (0.62 + 0.38 * Math.sin(t * 2.6 + pph[i]!)) + (age < 0.3 ? 1 - age / 0.3 : 0);
      g.fillStyle = `rgb(${age < 0.2 ? "255 255 255" : lightCols[pcol[i]!]} / ${Math.min(1, a).toFixed(3)})`;
      g.fillRect(c.sx - r, c.sy - r, r * 2, r * 2);
    }

    // Pulses running along the conduits.
    for (const k of conduits) {
      if (t < k.at) continue;
      for (let q = 0; q < 2; q++) {
        const u = (((t - k.at) * 0.42 + k.ph + q * 0.5) % 1) * 2;
        const a = u < 1 ? k.a : k.m;
        const b = u < 1 ? k.m : k.b;
        const f = u < 1 ? u : u - 1;
        const p = unit([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
        if (!faces(c, p[0], p[1], p[2]) || !see(c, p[0], p[1], p[2])) continue;
        const r = clamp((c.focal * 0.006) / c.sz, 3, 11);
        g.globalAlpha = Math.min(1, (t - k.at) * 2);
        g.drawImage(pulse, c.sx - r, c.sy - r, r * 2, r * 2);
      }
    }
    g.globalAlpha = 1;

    // Domes: a ring of light on the ground and a soft bubble over it.
    for (const d of domes) {
      const age = t - d.at;
      if (age <= 0) continue;
      const p = place(d.lon, d.lat);
      if (!faces(c, p[0], p[1], p[2]) || !see(c, p[0], p[1], p[2])) continue;
      const grow = easeOut(clamp(age / 0.7));
      const r = ((c.focal * d.r * DEG) / c.sz) * grow;
      if (r < 0.8) continue;
      const x = c.sx;
      const y = c.sy;
      // The camera looks down at a slant: the ring is an oval, the bubble stands a little above it.
      const vd = unit([p[0] - c.pos[0], p[1] - c.pos[1], p[2] - c.pos[2]]);
      const flat = clamp(Math.abs(vd[0] * p[0] + vd[1] * p[1] + vd[2] * p[2]), 0.25, 1);
      g.globalAlpha = 0.5 * grow * (0.9 + 0.1 * Math.sin(t * 3 + d.lon));
      g.drawImage(node, x - r * 1.9, y - r * (0.9 + flat), r * 3.8, r * 1.9 * (0.5 + flat));
      g.globalAlpha = 1;
      g.strokeStyle = `rgb(${theme.secondary} / ${(0.85 * grow).toFixed(3)})`;
      g.lineWidth = clamp(r * 0.05, 0.8, 1.8);
      g.beginPath();
      g.ellipse(x, y, r, r * flat, 0, 0, TAU);
      g.stroke();
      if (r > 3) {
        g.strokeStyle = `rgb(${mixRgb(theme.secondary, "255 255 255", 0.5)} / ${(0.6 * grow).toFixed(3)})`;
        g.beginPath();
        g.ellipse(x, y, r, r * Math.max(flat, 0.85), 0, Math.PI, TAU);
        g.stroke();
      }
    }

    // The shock waves themselves: a bright front, a band of light behind it, a glow on the ground.
    for (const s of sites) {
      const age = t - s.at;
      if (age <= 0) continue;
      const deg = age * WAVE_SPEED;
      if (deg > WAVE_REACH) continue;
      const fade = Math.pow(1 - deg / WAVE_REACH, 1.6);
      const whole = ring(c, s, deg);
      if (whole && deg > 0.3) {
        // The band behind the front: three fills inside one another, brightest at the front.
        for (const [back, al] of [[0.93, 0.2], [0.82, 0.11], [0.62, 0.06]] as const) {
          const p = new Path2D();
          traceRing(p);
          p.closePath();
          const cr = Math.cos(deg * back * DEG);
          const sr = Math.sin(deg * back * DEG);
          for (let i = 0; i <= RING_STEPS; i++) {
            const a = (i / RING_STEPS) * TAU;
            const ca = Math.cos(a) * sr;
            const sa = Math.sin(a) * sr;
            see(c, s.n[0] * cr + s.e1[0] * ca + s.e2[0] * sa, s.n[1] * cr + s.e1[1] * ca + s.e2[1] * sa, s.n[2] * cr + s.e1[2] * ca + s.e2[2] * sa);
            if (i) p.lineTo(c.sx, c.sy);
            else p.moveTo(c.sx, c.sy);
          }
          p.closePath();
          g.fillStyle = `rgb(${theme.primary} / ${(al * fade).toFixed(3)})`;
          g.fill(p, "evenodd");
        }
      }
      g.beginPath();
      traceRing(g);
      for (const [wide, rgb, al] of [
        [26, theme.glow, 0.1],
        [11, theme.primary, 0.28],
        [4.5, mixRgb(theme.primary, "255 255 255", 0.5), 0.6],
        [1.6, "255 255 255", 1],
      ] as const) {
        g.strokeStyle = `rgb(${rgb} / ${(al * fade).toFixed(3)})`;
        g.lineWidth = wide * fine;
        g.stroke();
      }
      // A second, slower wave close to the ground.
      const slow = deg * 0.55;
      if (slow < 12 && ring(c, s, slow)) {
        g.beginPath();
        traceRing(g);
        g.strokeStyle = `rgb(${theme.secondary} / ${(0.45 * (1 - slow / 12)).toFixed(3)})`;
        g.lineWidth = 3 * fine;
        g.stroke();
      }
      // The hit itself, on the ground.
      if (age < 1.2 && see(c, s.n[0], s.n[1], s.n[2])) {
        const r = ((c.focal * 0.05) / c.sz) * (0.5 + 3 * easeOut(age / 1.2));
        g.globalAlpha = Math.exp(-age * 3.2);
        g.drawImage(wave, c.sx - r, c.sy - r * 0.6, r * 2, r * 1.2);
        g.globalAlpha = 1;
      }
    }
    g.restore();
  }

  return { sites, reachedAt, ground, progress };
}
