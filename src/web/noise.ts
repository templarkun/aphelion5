/**
 * Smooth 3D gradient noise (Ken Perlin's improved noise), for slow organic motion in the looks
 * (coronal waves, the End the Overload plasma). Values about -1..1; no randomness from the game.
 */

const P = new Uint8Array(512);
{
  // A fixed shuffle (looks only), so every page draws the same field.
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = 1234567;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255]!;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function grad(h: number, x: number, y: number, z: number): number {
  const k = h & 15;
  const u = k < 8 ? x : y;
  const v = k < 4 ? y : k === 12 || k === 14 ? x : z;
  return ((k & 1) === 0 ? u : -u) + ((k & 2) === 0 ? v : -v);
}

export function noise3(x: number, y: number, z: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = P[X]! + Y;
  const AA = P[A]! + Z;
  const AB = P[A + 1]! + Z;
  const B = P[X + 1]! + Y;
  const BA = P[B]! + Z;
  const BB = P[B + 1]! + Z;
  return lerp(
    lerp(lerp(grad(P[AA]!, x, y, z), grad(P[BA]!, x - 1, y, z), u), lerp(grad(P[AB]!, x, y - 1, z), grad(P[BB]!, x - 1, y - 1, z), u), v),
    lerp(lerp(grad(P[AA + 1]!, x, y, z - 1), grad(P[BA + 1]!, x - 1, y, z - 1), u), lerp(grad(P[AB + 1]!, x, y - 1, z - 1), grad(P[BB + 1]!, x - 1, y - 1, z - 1), u), v),
    w,
  );
}

/** Two octaves: billowing rather than smooth. */
export function fbm3(x: number, y: number, z: number): number {
  return noise3(x, y, z) * 0.7 + noise3(x * 2.03 + 17.1, y * 2.03 + 3.7, z * 1.7) * 0.3;
}

/** Colour between a and b (0xRRGGBB), t 0..1. */
export function mixColour(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * k));
  const g = Math.round(((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * k));
  const bl = Math.round((a & 255) + (((b & 255) - (a & 255)) * k));
  return (r << 16) | (g << 8) | bl;
}

/** The solar palette (designer 2026-11-10): deep orange, amber, white-hot. t 0..1. */
export const SOLAR_ORANGE = 0xff4500;
export const SOLAR_AMBER = 0xffaa00;
export const SOLAR_WHITE = 0xffffff;
export function solar(t: number): number {
  return t < 0.5 ? mixColour(SOLAR_ORANGE, SOLAR_AMBER, t * 2) : mixColour(SOLAR_AMBER, SOLAR_WHITE, (t - 0.5) * 2);
}
