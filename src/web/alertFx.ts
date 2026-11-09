/**
 * A ready Alert on a unit (designer 2026-11-09), drawn every frame on top of the tile instead of
 * the word "ALERT". Two looks to try (a screen trial on the setup list, `settings.alertBeacon`):
 *
 * - "token" (default): a yellow-black warning triangle with "!" at the tile's upper right
 *   corner, popping in when the Alert is placed, and the tile's rim pulsing amber-red.
 * - "beacon": a small warning light at the same corner whose beam turns round, and radar rings
 *   going out from the unit every few seconds.
 *
 * `now` is 0 with reduced motion: everything is drawn still. `born` is when the Alert was first
 * seen (for the pop-in), `alpha` / `scale` follow the tile's animation.
 */

import type { Graphics } from "pixi.js";

export type AlertLook = "token" | "beacon";

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

export function drawAlert(g: Graphics, look: AlertLook, cx: number, cy: number, size: number, now: number, born: number, alpha: number, scale: number, wreck: boolean): void {
  if (alpha <= 0.01) return;
  const S = size * scale;
  // The upper right corner, mirroring the Level badge.
  const ax = cx + S * 0.6;
  const ay = cy - S * 0.37;
  if (look === "token") {
    // B: the rim pulses amber-red (1.6 s).
    const k = now ? 0.5 - 0.5 * Math.cos(((now % 1600) / 1600) * Math.PI * 2) : 0.6;
    g.poly(hex(cx, cy, S * 0.9)).stroke({ width: 2 + 4 * k, color: 0xff5a1f, alpha: (0.25 + 0.5 * k) * alpha });
    g.poly(hex(cx, cy, S * 0.86)).stroke({ width: 1.5, color: 0xffc04a, alpha: (0.4 + 0.5 * k) * alpha });
    // A: the token, popping in over 0.4 s.
    const t = now ? Math.min(1, (now - born) / 400) : 1;
    const r = S * 0.15 * (t < 1 ? Math.max(0, easeBack(t)) : 1);
    if (r <= 0.5) return;
    const tri = (rr: number, dy = 0) => [ax, ay - rr + dy, ax + rr * 0.95, ay + rr * 0.72 + dy, ax - rr * 0.95, ay + rr * 0.72 + dy];
    g.poly(tri(r * 1.18, r * 0.12)).fill({ color: 0x000000, alpha: 0.4 * alpha });
    g.poly(tri(r * 1.12)).fill({ color: 0x15161a, alpha });
    g.poly(tri(r * 0.86)).fill({ color: wreck ? 0xb08a1a : 0xffd21f, alpha });
    // The "!".
    g.roundRect(ax - r * 0.1, ay - r * 0.42, r * 0.2, r * 0.66, r * 0.08).fill({ color: 0x15161a, alpha });
    g.circle(ax, ay + r * 0.44, r * 0.11).fill({ color: 0x15161a, alpha });
    return;
  }
  // D: radar rings out from the unit, one every 2.4 s (two in flight).
  if (now) {
    for (const off of [0, 1200]) {
      const u = ((now + off) % 2400) / 2400;
      g.circle(cx, cy, S * (0.25 + 0.85 * u)).stroke({ width: 2.5 * (1 - u) + 0.5, color: 0xff6a2a, alpha: 0.7 * (1 - u) * alpha });
    }
  } else g.circle(cx, cy, S * 0.8).stroke({ width: 1.5, color: 0xff6a2a, alpha: 0.5 * alpha });
  // C: a beacon light whose beam turns round (1.4 s a turn).
  const r = S * 0.11;
  const a = now ? ((now % 1400) / 1400) * Math.PI * 2 : -Math.PI / 4;
  const len = S * 0.42;
  const spread = 0.38;
  g.moveTo(ax, ay)
    .lineTo(ax + Math.cos(a - spread) * len, ay + Math.sin(a - spread) * len)
    .lineTo(ax + Math.cos(a + spread) * len, ay + Math.sin(a + spread) * len)
    .closePath()
    .fill({ color: 0xffb04a, alpha: 0.32 * alpha });
  g.moveTo(ax, ay)
    .lineTo(ax + Math.cos(a - spread * 0.4) * len * 0.8, ay + Math.sin(a - spread * 0.4) * len * 0.8)
    .lineTo(ax + Math.cos(a + spread * 0.4) * len * 0.8, ay + Math.sin(a + spread * 0.4) * len * 0.8)
    .closePath()
    .fill({ color: 0xfff0c0, alpha: 0.4 * alpha });
  // The light: a base, a dome that flares when the beam faces the viewer (pointing down).
  const facing = now ? 0.5 + 0.5 * Math.sin(a) : 0.6;
  g.roundRect(ax - r * 1.15, ay + r * 0.35, r * 2.3, r * 0.6, r * 0.2).fill({ color: 0x15161a, alpha }).stroke({ width: 1, color: 0x9aa3b2, alpha: 0.8 * alpha });
  g.circle(ax, ay, r * (1.6 + 0.6 * facing)).fill({ color: 0xff7a2a, alpha: (0.15 + 0.3 * facing) * alpha });
  g.moveTo(ax - r, ay + r * 0.38).arc(ax, ay + r * 0.38, r, Math.PI, 0).closePath().fill({ color: wreck ? 0x9a3a1a : 0xff4a1a, alpha }).stroke({ width: 1, color: 0x3a0a03, alpha });
  g.circle(ax, ay - r * 0.1, r * 0.35).fill({ color: 0xfff3d0, alpha: (0.6 + 0.4 * facing) * alpha });
}
