/** Small 3D helpers of the intro2 film: vectors, a camera, fixed random numbers. Looks only. */

export type V3 = [number, number, number];

export const TAU = Math.PI * 2;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (t: number) => t * t * (3 - 2 * t);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export const smooth = (a: number, b: number, x: number) => ease(seg(x, a, b));

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const mix3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Small fixed random numbers: the film looks the same every time. */
export function rng(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/**
 * The camera. The world is the ship's own frame at rest: x forward (bow), y up, z to starboard.
 * Camera space: x to the right of the picture, y down, z into the picture.
 */
export interface Camera {
  /** Where it stands. */
  pos: V3;
  /** Its right, down and forward directions, in the world. */
  r: V3;
  d: V3;
  f: V3;
  /** Focal length in px, and where its axis meets the picture. */
  focal: number;
  cx: number;
  cy: number;
}

/**
 * A camera's directions from where it sits round the ship: az degrees round from straight astern
 * towards starboard, el degrees above the deck, rolled by roll degrees.
 */
export function cameraAxes(az: number, el: number, roll = 0): { r: V3; d: V3; f: V3; back: V3 } {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  const back: V3 = [-Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
  const f = mul(back, -1);
  const r0 = unit(cross(f, [0, 1, 0]));
  const d0 = mul(cross(r0, f), -1);
  const g = (roll * Math.PI) / 180;
  const r = add(mul(r0, Math.cos(g)), mul(d0, Math.sin(g)));
  const d = add(mul(r0, -Math.sin(g)), mul(d0, Math.cos(g)));
  return { r, d, f, back };
}

export const toCam = (c: Camera, p: V3): V3 => {
  const q = sub(p, c.pos);
  return [dot(q, c.r), dot(q, c.d), dot(q, c.f)];
};
/** A direction given in camera space, in the world. */
export const camToWorld = (c: { r: V3; d: V3; f: V3 }, v: V3): V3 => add(add(mul(c.r, v[0]), mul(c.d, v[1])), mul(c.f, v[2]));
