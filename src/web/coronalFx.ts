/**
 * Coronal waves effect (designer 2026-11-10; the name to use for it from now on), round the End the
 * Overload button (it was round the Field's edge in round 14; the two looks have swapped places):
 * the button is a small active sun, and glowing magnetic arcs (coronal loops) stand on its rim with
 * plasma streaming along them, over a glowing surface band, with soft wisps that billow outwards and
 * dissolve.
 *
 * - Soft particles drawn with additive blending ("lighter"), so where they overlap they glow
 *   white-hot and golden.
 * - Slow motion: each loop rises and sinks over 9-15 s, is pushed about by the shared 3D Perlin
 *   noise (billowing, stretching), and dissolves and forms again in place; no gravity, no flicker.
 * - Colours from deep solar orange #ff4500 through amber #ffaa00 to a white-hot core #ffffff.
 * - Nothing is cut off by a hard edge: a particle near a wall (the canvas, the Field's edge) shrinks
 *   and fades before it reaches it.
 * Screen only; nothing here touches the rules.
 */

import { fbm3, noise3, solar } from "./noise.js";

const SHADES = 8;
let sprites: HTMLCanvasElement[] | undefined;
/** Soft round glows in the solar colours, orange (0) to white (SHADES - 1). */
function shades(): HTMLCanvasElement[] {
  if (sprites) return sprites;
  sprites = Array.from({ length: SHADES }, (_, i) => {
    const col = solar(i / (SHADES - 1));
    const rgb = `${(col >> 16) & 255},${(col >> 8) & 255},${col & 255}`;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(${rgb},1)`);
    g.addColorStop(0.25, `rgba(${rgb},0.75)`);
    g.addColorStop(0.55, `rgba(${rgb},0.25)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return c;
  });
  return sprites;
}

const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const LOOPS = 8;
const SAMPLES = 22;
const BAND = 26;
const WISPS = 18;

/** How far the effect reaches, in button radii from the centre (the canvas is made this big). */
export const CORONAL_REACH = 2.7;

/** Walls in canvas pixels: nothing is drawn past them. */
export interface Walls {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * One frame of the coronal waves round a circle of radius R at (c, c) on a 2D canvas.
 * `t` in seconds; `fade` 0..1.
 */
export function drawCoronalWaves(ctx: CanvasRenderingContext2D, c: number, R: number, t: number, fade: number, walls: Walls): void {
  const sh = shades();
  const dot = (x: number, y: number, r: number, shade: number, a: number) => {
    // Shrink and fade near a wall, so nothing is cut off by a hard edge.
    const d = Math.min(x - walls.left, walls.right - x, y - walls.top, walls.bottom - y);
    if (d <= 1 || a <= 0.003) return;
    const k = Math.min(1, d / r);
    const rr = Math.min(r, d);
    ctx.globalAlpha = Math.min(1, a * k * k);
    ctx.drawImage(sh[Math.max(0, Math.min(SHADES - 1, Math.round(shade * (SHADES - 1))))]!, x - rr, y - rr, rr * 2, rr * 2);
  };
  ctx.globalCompositeOperation = "lighter";

  // The glowing surface: a band round the rim, slowly billowing.
  for (let k = 0; k < BAND; k++) {
    const a0 = (k / BAND) * Math.PI * 2;
    const n = fbm3(Math.cos(a0) * 1.5, Math.sin(a0) * 1.5, t * 0.15);
    const a = a0 + 0.05 * noise3(k * 0.7, t * 0.07, 2.2);
    const rad = R * (1.02 + 0.06 * n);
    dot(c + Math.cos(a) * rad, c + Math.sin(a) * rad, R * (0.3 + 0.08 * n), 0.15 + 0.3 * (0.5 + 0.5 * n), fade * (0.16 + 0.07 * n));
  }

  // Coronal loops standing on the rim, plasma streaming along them from foot to foot.
  for (let L = 0; L < LOOPS; L++) {
    const seed = L * 1.7 + 3;
    const cycle = 9 + 6 * rnd(L + 20);
    const ph = ((t / cycle + rnd(L + 30)) % 1 + 1) % 1;
    const life = Math.pow(0.5 - 0.5 * Math.cos(ph * Math.PI * 2), 1.4);
    const rise = 0.35 + 0.65 * life;
    const centre = ((L + 0.5) / LOOPS) * Math.PI * 2 + (rnd(L + 50) - 0.5) * 0.35;
    const half = 0.2 + 0.12 * rnd(L + 5);
    const height = R * (0.35 + 0.4 * rnd(L + 9));
    const flow = (7 + 6 * rnd(L + 40)) * (rnd(L + 60) < 0.5 ? 1 : -1);
    const a = fade * (0.25 + 0.75 * life);
    for (let j = 0; j < SAMPLES; j++) {
      const s = ((((j + 0.5) / SAMPLES + t / flow) % 1) + 1) % 1;
      const arch = Math.sin(Math.PI * s);
      const n1 = fbm3(s * 2.2 + seed, seed * 0.37, t * 0.12);
      const n2 = noise3(s * 3.1 - seed, t * 0.09, seed * 0.61);
      const ang = centre + (s - 0.5) * 2 * half * (1 + 0.18 * n2) + n1 * 0.05;
      const rad = R * 0.98 + height * rise * arch * (1 + 0.32 * n1);
      const x = c + Math.cos(ang) * rad;
      const y = c + Math.sin(ang) * rad;
      const heat = 0.55 + 0.27 * Math.abs(Math.cos(Math.PI * s * 2)) + 0.25 * arch;
      const breathe = 1 + 0.25 * noise3(seed + j * 0.4, t * 0.2, 5.3);
      dot(x, y, R * 0.2 * breathe * (0.7 + 0.5 * arch), 0, 0.09 * a);
      dot(x, y, R * 0.1 * breathe, 0.3 + 0.35 * heat, 0.2 * a);
      dot(x, y, R * 0.055 * (0.8 + 0.4 * heat), 0.65 + 0.35 * heat, 0.36 * a * (0.6 + 0.4 * heat));
    }
  }

  // Wisps that leave the rim, swell outwards and dissolve.
  for (let k = 0; k < WISPS; k++) {
    const life = 5 + 4 * rnd(k + 3);
    const u = ((t / life + rnd(k + 7)) % 1 + 1) % 1;
    const a0 = ((k + rnd(k)) / WISPS) * Math.PI * 2;
    const ang = a0 + 0.25 * fbm3(k * 3.1, u * 1.4, t * 0.08);
    const rad = R * (1.05 + 0.75 * (1 - Math.pow(1 - u, 2)));
    dot(c + Math.cos(ang) * rad, c + Math.sin(ang) * rad, R * (0.1 + 0.32 * u), u < 0.4 ? 0.75 - u : 0.5, fade * 0.16 * Math.pow(Math.sin(Math.PI * u), 1.5));
  }
  ctx.globalAlpha = 1;
}
