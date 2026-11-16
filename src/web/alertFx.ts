/**
 * A ready Alert on a unit (designer 2026-11-09), drawn every frame on top of the tile instead of
 * the word "ALERT": a yellow-black warning triangle with "!" at the tile's bottom corner, popping
 * in when the Alert is placed, and the tile's rim pulsing amber-red.
 * (The beacon-and-radar look was tried for one round and dropped. The upper right corner, where
 * the token sat at first, is kept for the unit glyph in a future update.)
 *
 * `now` is 0 with reduced motion: everything is drawn still. `born` is when the Alert was first
 * seen (for the pop-in), `alpha` / `scale` follow the tile's animation.
 */

import type { Graphics } from "pixi.js";

const hex = (cx: number, cy: number, r: number) => {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return pts;
};

const easeBack = (t: number) => {
  const c = 2.2;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

export function drawAlert(g: Graphics, cx: number, cy: number, size: number, now: number, born: number, alpha: number, scale: number, wreck: boolean): void {
  if (alpha <= 0.01) return;
  const S = size * scale;
  // The rim pulses amber-red (1.6 s).
  const k = now ? 0.5 - 0.5 * Math.cos(((now % 1600) / 1600) * Math.PI * 2) : 0.6;
  g.poly(hex(cx, cy, S * 0.9)).stroke({ width: 2 + 4 * k, color: 0xff5a1f, alpha: (0.25 + 0.5 * k) * alpha });
  g.poly(hex(cx, cy, S * 0.86)).stroke({ width: 1.5, color: 0xffc04a, alpha: (0.4 + 0.5 * k) * alpha });
  // The token at the bottom corner, popping in over 0.4 s.
  const ax = cx;
  const ay = cy + S * 0.77;
  const t = now ? Math.min(1, (now - born) / 400) : 1;
  const r = S * 0.12 * (t < 1 ? Math.max(0, easeBack(t)) : 1);
  if (r <= 0.5) return;
  const tri = (rr: number, dy = 0) => [ax, ay - rr + dy, ax + rr * 0.95, ay + rr * 0.72 + dy, ax - rr * 0.95, ay + rr * 0.72 + dy];
  g.poly(tri(r * 1.18, r * 0.12)).fill({ color: 0x000000, alpha: 0.4 * alpha });
  g.poly(tri(r * 1.12)).fill({ color: 0x15161a, alpha });
  g.poly(tri(r * 0.86)).fill({ color: wreck ? 0xb08a1a : 0xffd21f, alpha });
  // The "!".
  g.roundRect(ax - r * 0.1, ay - r * 0.42, r * 0.2, r * 0.66, r * 0.08).fill({ color: 0x15161a, alpha });
  g.circle(ax, ay + r * 0.44, r * 0.11).fill({ color: 0x15161a, alpha });
}

/**
 * Energy waiting on a Flare (trial rule I2): where its tokens sit on the tile. Designer
 * 2026-11-16: as big as a Damage token (radius 0.13 of the tile's half height).
 */
export function flareEnergySpots(cx: number, cy: number, size: number, n: number, low: boolean): { x: number[]; y: number; r: number } {
  const r = size * 0.13;
  const gap = r * 2.5;
  const y = cy + size * (low ? 0.37 : 0.3);
  return { x: Array.from({ length: n }, (_, i) => cx + (i - (n - 1) / 2) * gap), y, r };
}

/**
 * A border of energy round one waiting energy token (designer 2026-11-16: not a white rim; it
 * makes the tokens pop): a breathing glow ring in the energy's colour and sparks running round it,
 * flaring and fading. `now` 0: drawn still.
 */
export function drawEnergyBorder(g: Graphics, x: number, y: number, r: number, colour: number, now: number, seed: number, alpha: number): void {
  if (alpha <= 0.01) return;
  const t = now / 1000;
  const breathe = now ? 0.5 + 0.5 * Math.sin(t * 3.1 + seed * 1.7) : 0.6;
  g.circle(x, y, r * 1.32).stroke({ width: r * (0.32 + 0.18 * breathe), color: colour, alpha: (0.22 + 0.2 * breathe) * alpha });
  g.circle(x, y, r * 1.1).stroke({ width: Math.max(1, r * 0.12), color: 0xffffff, alpha: (0.35 + 0.35 * breathe) * alpha });
  const n = 12;
  for (let i = 0; i < n; i++) {
    const dir = i % 2 ? 1 : -1;
    const a = (i / n) * Math.PI * 2 + dir * t * (1.4 + 0.3 * (i % 3)) + seed;
    const life = now ? (t * 0.9 + i * 0.37 + seed * 0.21) % 1 : 0.5;
    const d = r * (1.12 + 0.38 * life);
    const k = Math.sin(Math.PI * life);
    const px = x + Math.cos(a) * d;
    const py = y + Math.sin(a) * d;
    g.circle(px, py, r * (0.1 + 0.1 * k)).fill({ color: colour, alpha: 0.55 * k * alpha });
    g.circle(px, py, r * 0.06 * (0.5 + k)).fill({ color: 0xffffff, alpha: 0.9 * k * alpha });
  }
}
