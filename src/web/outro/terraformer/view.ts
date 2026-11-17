/**
 * The Terraformer outro: the camera, and the tracks things move along. The world is the planet:
 * a ball of radius 1 at the middle. Places on it are given in degrees along the ship's track
 * (lon) and across it (lat) from the middle of the target sector. Looks only.
 */

import { cross, unit, type V3 } from "../../briefing/styles/intro2/math3.js";

export const DEG = Math.PI / 180;

/** The point at lon, lat degrees, `rad` planet radii from the middle (1 = on the ground). */
export function place(lon: number, lat: number, rad = 1): V3 {
  const lo = lon * DEG;
  const la = lat * DEG;
  const c = Math.cos(la) * rad;
  return [Math.sin(lo) * c, Math.sin(la) * rad, Math.cos(lo) * c];
}

/**
 * A smooth track through keys [time, value, value ...]: passes through each key, eases between
 * them, and stands still before the first and after the last.
 */
export function track(keys: readonly (readonly number[])[]): (t: number) => number[] {
  const n = keys.length;
  const dims = keys[0]!.length - 1;
  // The slope at each key: from its neighbours.
  const slope = keys.map((k, i) => {
    const a = keys[Math.max(0, i - 1)]!;
    const b = keys[Math.min(n - 1, i + 1)]!;
    const dt = b[0]! - a[0]! || 1;
    return Array.from({ length: dims }, (_, d) => (i === 0 || i === n - 1 ? 0 : (b[d + 1]! - a[d + 1]!) / dt));
  });
  return (t) => {
    if (t <= keys[0]![0]!) return keys[0]!.slice(1);
    if (t >= keys[n - 1]![0]!) return keys[n - 1]!.slice(1);
    let i = 0;
    while (i < n - 2 && t > keys[i + 1]![0]!) i++;
    const a = keys[i]!;
    const b = keys[i + 1]!;
    const h = b[0]! - a[0]!;
    const s = (t - a[0]!) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    const out: number[] = [];
    for (let d = 0; d < dims; d++) out.push((2 * s3 - 3 * s2 + 1) * a[d + 1]! + (s3 - 2 * s2 + s) * h * slope[i]![d]! + (-2 * s3 + 3 * s2) * b[d + 1]! + (s3 - s2) * h * slope[i + 1]![d]!);
    return out;
  };
}

/** The camera, and the last point it was asked about (sx, sy in the picture; sz its depth). */
export interface Cam {
  pos: V3;
  /** Right, down and forward, in the world. */
  r: V3;
  d: V3;
  f: V3;
  focal: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  sx: number;
  sy: number;
  sz: number;
}

export function newCam(): Cam {
  return { pos: [0, 0, 2], r: [1, 0, 0], d: [0, -1, 0], f: [0, 0, -1], focal: 1000, cx: 0, cy: 0, w: 1, h: 1, sx: 0, sy: 0, sz: 0 };
}

/** Stand at `pos`, look at `target`, with `up` upwards in the picture, rolled by `roll` radians. */
export function aim(c: Cam, pos: V3, target: V3, up: V3, roll: number): void {
  const f = unit([target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]]);
  const r0 = unit(cross(f, up));
  const d0 = cross(f, r0);
  const cs = Math.cos(roll);
  const sn = Math.sin(roll);
  c.pos = pos;
  c.f = f;
  c.r = [r0[0] * cs + d0[0] * sn, r0[1] * cs + d0[1] * sn, r0[2] * cs + d0[2] * sn];
  c.d = [-r0[0] * sn + d0[0] * cs, -r0[1] * sn + d0[1] * cs, -r0[2] * sn + d0[2] * cs];
}

/** Where a point of the world is in the picture (c.sx, c.sy, depth c.sz). False when it is behind the eye. */
export function see(c: Cam, x: number, y: number, z: number): boolean {
  const qx = x - c.pos[0];
  const qy = y - c.pos[1];
  const qz = z - c.pos[2];
  const d = qx * c.f[0] + qy * c.f[1] + qz * c.f[2];
  c.sz = d;
  if (d < 1e-4) return false;
  c.sx = c.cx + (c.focal * (qx * c.r[0] + qy * c.r[1] + qz * c.r[2])) / d;
  c.sy = c.cy + (c.focal * (qx * c.d[0] + qy * c.d[1] + qz * c.d[2])) / d;
  return true;
}

/** Is a point of the ground on the side of the planet turned to the camera? */
export const faces = (c: Cam, x: number, y: number, z: number) => x * c.pos[0] + y * c.pos[1] + z * c.pos[2] > 1.0005;

/** A direction far away (a star, the sun) in the picture. False when it is behind the eye. */
export function seeFar(c: Cam, x: number, y: number, z: number): boolean {
  const d = x * c.f[0] + y * c.f[1] + z * c.f[2];
  c.sz = d;
  if (d < 0.12) return false;
  c.sx = c.cx + (c.focal * (x * c.r[0] + y * c.r[1] + z * c.r[2])) / d;
  c.sy = c.cy + (c.focal * (x * c.d[0] + y * c.d[1] + z * c.d[2])) / d;
  return true;
}
