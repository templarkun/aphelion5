/**
 * The board seen in 3D (designer 2026-11-20: the Gamma kills change the perspective). The Field is a
 * flat board; here it is turned back about the line through the unit, by `theta` (0 = seen from above
 * as always, towards 90° = seen edge-on from the side), and drawn in perspective from a camera `D`
 * pixels away. Each sector's tile is moved, squashed and ordered (near in front) through its NodeLook,
 * so the board's own tiles are what tilts; a sector can also be lifted off the board, pulled in, turned
 * and tipped. The flat empty slots under the tiles are hidden meanwhile and drawn here in perspective.
 *
 * Everything is worked out from the time alone. Screen only: nothing here is a rule.
 */

import type { Graphics } from "pixi.js";
import type { Frame } from "./closeup.js";
import { hexCorners } from "./closeup.js";

/** A point (X, Y) on the board, in screen pixels from the unit at the zoom now, H above the board: where it shows, how big (p), how near. */
export function project(X: number, Y: number, H: number, theta: number, D: number): { x: number; y: number; p: number; near: number } {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const near = Y * s + H * c;
  const p = D / Math.max(D * 0.3, D - near);
  return { x: X * p, y: (Y * c - H * s) * p, p, near };
}

/** How a sector leaves the board: lifted H pixels, pulled a share in towards the unit, turned (radians), tipped (extra tilt, radians). */
export interface Lift {
  H?: number;
  inward?: number;
  turn?: number;
  tip?: number;
  /** Its own drawing order on top of where it stands (lifted sectors in front). */
  z?: number;
  /** Moved over the board by (x, y) pixels (before perspective). */
  shift?: readonly [number, number];
}

/** Where a sector shows on the screen now. */
export interface Placed {
  key: string;
  /** Its offset from the unit on the flat board (screen pixels at the zoom now). */
  X: number;
  Y: number;
  /** Its centre on the screen, its size (perspective), its squash (cos of its tilt; below 0 it shows its back). */
  sx: number;
  sy: number;
  p: number;
  sq: number;
  /** Where its empty slot on the board shows. */
  gx: number;
  gy: number;
  gp: number;
  lifted: boolean;
}

/** Hex distance between two sectors "q,r". */
export function hexDist(a: string, b: string): number {
  const [q1, r1] = a.split(",").map(Number) as [number, number];
  const [q2, r2] = b.split(",").map(Number) as [number, number];
  const dq = q1 - q2;
  const dr = r1 - r2;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/**
 * Tilt the board by theta (radians): every sector's tile moved, squashed and ordered. `lift` says how a
 * sector leaves the board. Returns where each sector shows (the unit's own included).
 */
export function tiltBoard(f: Frame, centres: readonly (readonly [string, number, number])[], theta: number, D: number, lift?: (key: string, X: number, Y: number) => Lift | undefined): Placed[] {
  const { Sx, Sy, z, cx, cy, look } = f;
  const out: Placed[] = [];
  for (const [key, x, y] of centres) {
    const X = (x - cx) * z;
    const Y = (y - cy) * z;
    const l = lift?.(key, X, Y);
    const k = 1 - (l?.inward ?? 0);
    const pr = project(X * k + (l?.shift?.[0] ?? 0), Y * k + (l?.shift?.[1] ?? 0), l?.H ?? 0, theta, D);
    const g = l ? project(X, Y, 0, theta, D) : pr;
    const sxp = Sx + pr.x;
    const syp = Sy + pr.y;
    let sq = Math.cos(theta + (l?.tip ?? 0));
    if (Math.abs(sq) < 0.02) sq = sq < 0 ? -0.02 : 0.02;
    const L = look(key);
    L.dx += (sxp - Sx) / z - (x - cx);
    L.dy += (syp - Sy) / z - (y - cy);
    L.scale *= pr.p * sq;
    L.scaleX *= 1 / sq;
    L.z = Math.round(pr.near) + (l?.z ?? 0);
    if (l?.turn) L.turn = (L.turn ?? 0) + l.turn;
    out.push({ key, X, Y, sx: sxp, sy: syp, p: pr.p, sq, gx: Sx + g.x, gy: Sy + g.y, gp: g.p, lifted: !!l && (l.H ?? 0) > 0.5 });
  }
  return out;
}

/** A flat hexagon lying on the tilted board at (gx, gy), radius r (before perspective), squashed by cos(theta). */
export function boardHex(gx: number, gy: number, r: number, p: number, theta: number): number[] {
  const c = Math.cos(theta);
  return hexCorners(0, 0, r * p).flatMap(([x, y]) => [gx + x, gy + y * c]);
}

/** The board's empty slots in perspective, under the tiles (the flat ones are hidden meanwhile). */
export function drawSlots(g: Graphics, placed: readonly Placed[], R: number, theta: number): void {
  for (const pl of placed) g.poly(boardHex(pl.gx, pl.gy, R, pl.gp, theta)).fill({ color: 0x15161a }).stroke({ width: 1, color: 0x2a2c31 });
}
