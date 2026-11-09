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
