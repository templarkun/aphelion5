/**
 * The shine of Mission Complete (designer 2026-11-20, I23: in place of the ring that stopped and faded):
 * where its band of light lies at each moment of WIN.wave. Pure, for MissionWin.tsx and the tests.
 */

import { WIN } from "./timeline.js";

export interface ShinePath {
  /** The way it sweeps (a unit vector, on the screen). */
  ux: number;
  uy: number;
  /** Half the band's width (pixels). */
  band: number;
  /** Where the band's middle starts and ends, along that way, from the Field's top left corner: the whole band beyond the Field's edges. */
  s0: number;
  s1: number;
}

/**
 * The shine over a Field w × h (pixels; `tile` a tile's height): away from the sector the unit left
 * (`from`, its centre in the Field's pixels), through the Field's middle; none, or the middle itself:
 * left to right, a little down.
 */
export function shinePath(w: number, h: number, tile: number, from?: readonly [number, number]): ShinePath {
  let vx = from ? w / 2 - from[0] : 0;
  let vy = from ? h / 2 - from[1] : 0;
  if (Math.hypot(vx, vy) < tile * 0.5) [vx, vy] = [1, 0.36];
  const d = Math.hypot(vx, vy);
  const ux = vx / d;
  const uy = vy / d;
  const band = Math.max(tile * 1.3, Math.min(w, h) * 0.2);
  const ends = [0, ux * w, uy * h, ux * w + uy * h];
  return { ux, uy, band, s0: Math.min(...ends) - band, s1: Math.max(...ends) + band };
}

/** How far along its path the band is at p (0-1 through WIN.wave): slower coming in and going out, never still. */
export function sweep(p: number): number {
  const q = Math.max(0, Math.min(1, p));
  return 0.35 * q + 0.65 * ((1 - Math.cos(Math.PI * q)) / 2);
}

/** The band's middle at time t (s), along its way. */
export function shineAt(path: ShinePath, t: number): number {
  return path.s0 + (path.s1 - path.s0) * sweep((t - WIN.wave[0]) / (WIN.wave[1] - WIN.wave[0]));
}

/** When the band's middle passes a point (x, y) of the Field (s). */
export function arrival(path: ShinePath, x: number, y: number): number {
  const e = Math.max(0, Math.min(1, (x * path.ux + y * path.uy - path.s0) / (path.s1 - path.s0)));
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (sweep(mid) < e) lo = mid;
    else hi = mid;
  }
  return WIN.wave[0] + (WIN.wave[1] - WIN.wave[0]) * lo;
}
