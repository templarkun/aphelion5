/**
 * Strength, Shield and Damage drawn as pieces on a unit (designer 2026-11-09), instead of the
 * words "Strength N", "S2", "D1".
 *
 * - Strength (3.3): one gold pip per point of Strength, up to 4; more than 4: one bigger,
 *   crowned pip with the number inside.
 * - Shield tokens (6.2): small blue kite shields with a white cross, up to 4; more: one big
 *   shield with a gold rim and the number. Bio-shields (6.3) are the same shield in green with a
 *   leaf vein.
 * - Damage tokens (6.1): small red spiked bursts with a dark crack, up to 4; more: one big burst
 *   with a dark ring and the number.
 * Shields and Damage never sit on a unit together (3.3), so they share one row.
 * Placeholder looks; the designer's art can replace them later.
 */

import { type Container, Graphics, Text } from "pixi.js";
import type { Tokens } from "../engine/state.js";

const GOLD = { fill: 0xf2b630, rim: 0x6b4a05, light: 0xfff0b8 };
const SHIELD = { fill: 0x3b8fe0, rim: 0x0f3563, light: 0xcfe6ff };
const BIO = { fill: 0x3fbf6a, rim: 0x0e4a24, light: 0xd2f7dc };
const DAMAGE = { fill: 0xd8352a, rim: 0x4d0d08, light: 0xffb3a8 };

const number = (node: Container, n: number, x: number, y: number, px: number, fill = 0x1d1d1f) => {
  const t = new Text({ text: String(n), style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(9, px), fill, fontWeight: "900" } });
  t.anchor.set(0.5);
  t.position.set(x, y);
  t.eventMode = "none";
  node.addChild(t);
};

/** A dark round token base, so the piece reads on any tile colour. */
function disc(g: Graphics, x: number, y: number, r: number): void {
  g.circle(x, y, r).fill({ color: 0x15161a, alpha: 0.88 }).stroke({ width: 1, color: 0xffffff, alpha: 0.55 });
}

/** One Strength pip: a faceted gold gem. `big` adds a crown ring of points round it. */
function drawStrength(g: Graphics, x: number, y: number, r: number, big: boolean): void {
  if (big) {
    const pts: number[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8 - Math.PI / 2;
      const rr = i % 2 ? r * 1.0 : r * 1.22;
      pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.poly(pts).fill({ color: 0xffe08a }).stroke({ width: 1, color: GOLD.rim });
  }
  const gem = (s: number) => [x, y - r * s, x + r * 0.92 * s, y - r * 0.2 * s, x + r * 0.58 * s, y + r * 0.85 * s, x - r * 0.58 * s, y + r * 0.85 * s, x - r * 0.92 * s, y - r * 0.2 * s];
  g.poly(gem(big ? 1.08 : 1.16)).fill({ color: 0x15161a, alpha: 0.75 });
  g.poly(gem(big ? 0.92 : 1)).fill({ color: GOLD.fill }).stroke({ width: Math.max(1, r * 0.14), color: GOLD.rim });
  if (!big) {
    // Facets: a lighter upper face.
    g.poly([x, y - r * 0.82, x + r * 0.62, y - r * 0.16, x, y + r * 0.1, x - r * 0.62, y - r * 0.16]).fill({ color: GOLD.light, alpha: 0.55 });
  }
}

const shieldPts = (x: number, y: number, r: number) => [
  x - r * 0.85, y - r * 0.8,
  x, y - r * 1.02,
  x + r * 0.85, y - r * 0.8,
  x + r * 0.8, y + r * 0.05,
  x, y + r * 1.05,
  x - r * 0.8, y + r * 0.05,
];

/** One Shield token: a kite shield with a cross (Bio-shield: green with a leaf vein). */
function drawShield(g: Graphics, x: number, y: number, r: number, bio: boolean, big: boolean): void {
  const c = bio ? BIO : SHIELD;
  disc(g, x, y, r * (big ? 1.42 : 1.3));
  g.poly(shieldPts(x + r * 0.1, y + r * 0.16, r)).fill({ color: 0x000000, alpha: 0.35 });
  if (big) g.poly(shieldPts(x, y, r * 1.14)).fill({ color: 0xf2c94c }).stroke({ width: 1, color: 0x6b4a05 });
  g.poly(shieldPts(x, y, r)).fill({ color: c.fill }).stroke({ width: Math.max(1, r * 0.14), color: c.rim });
  g.poly(shieldPts(x, y - r * 0.1, r * 0.66)).fill({ color: c.light, alpha: 0.25 });
  if (big) return; // the number goes on it
  const w = Math.max(1, r * 0.2);
  if (bio) {
    g.moveTo(x, y + r * 0.6).lineTo(x, y - r * 0.55).stroke({ width: w, color: 0xffffff });
    g.moveTo(x, y + r * 0.1).lineTo(x - r * 0.35, y - r * 0.2).stroke({ width: w * 0.8, color: 0xffffff });
    g.moveTo(x, y - r * 0.1).lineTo(x + r * 0.35, y - r * 0.4).stroke({ width: w * 0.8, color: 0xffffff });
  } else {
    g.moveTo(x, y - r * 0.6).lineTo(x, y + r * 0.62).stroke({ width: w, color: 0xffffff });
    g.moveTo(x - r * 0.45, y - r * 0.18).lineTo(x + r * 0.45, y - r * 0.18).stroke({ width: w, color: 0xffffff });
  }
}

const burstPts = (x: number, y: number, r: number, spikes: number) => {
  const pts: number[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i * Math.PI) / spikes - Math.PI / 2;
    const rr = i % 2 ? r * 0.62 : r;
    pts.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  return pts;
};

/** One Damage token: a red spiked burst with a crack through it. */
function drawDamage(g: Graphics, x: number, y: number, r: number, big: boolean): void {
  disc(g, x, y, r * (big ? 1.4 : 1.25));
  g.poly(burstPts(x + r * 0.1, y + r * 0.16, r, 7)).fill({ color: 0x000000, alpha: 0.35 });
  if (big) g.circle(x, y, r * 1.12).fill({ color: DAMAGE.rim }).stroke({ width: 1, color: 0xff8070 });
  g.poly(burstPts(x, y, r, big ? 9 : 7)).fill({ color: DAMAGE.fill }).stroke({ width: Math.max(1, r * 0.12), color: DAMAGE.rim });
  if (big) {
    g.circle(x, y, r * 0.58).fill({ color: 0xffffff });
    return;
  }
  g.circle(x, y - r * 0.1, r * 0.3).fill({ color: DAMAGE.light, alpha: 0.4 });
  g.moveTo(x - r * 0.18, y - r * 0.5)
    .lineTo(x + r * 0.08, y - r * 0.1)
    .lineTo(x - r * 0.1, y + r * 0.08)
    .lineTo(x + r * 0.16, y + r * 0.5)
    .stroke({ width: Math.max(1, r * 0.17), color: 0x2a0503 });
}

/**
 * The marks of one unit on its tile at (cx, cy): Strength pips (row at `strengthY`), then Shields
 * or Damage (row at `tokenY`). `strength` undefined (Flares, Wrecks): no pips.
 */
export function addUnitMarks(node: Container, strength: number | undefined, t: Tokens, cx: number, cy: number, size: number): void {
  const g = new Graphics();
  g.eventMode = "none";
  g.label = "unit-marks";
  node.addChild(g);

  if (strength !== undefined && strength > 0) {
    const y = cy - size * 0.01;
    if (strength <= 4) {
      const r = size * 0.115;
      const gap = r * 2.3;
      for (let i = 0; i < strength; i++) drawStrength(g, cx + (i - (strength - 1) / 2) * gap, y, r, false);
    } else {
      const r = size * 0.13;
      drawStrength(g, cx, y, r, true);
      number(node, strength, cx, y + r * 0.08, r * 1.05);
    }
  }

  // Shields (blue, then green Bio-shields) or Damage, on one row below the pips.
  const y = cy + size * 0.29;
  const items: { kind: "shield" | "bio" | "damage"; n: number }[] = [];
  if (t.shield) items.push({ kind: "shield", n: t.shield });
  if (t.bioShield) items.push({ kind: "bio", n: t.bioShield });
  if (t.damage) items.push({ kind: "damage", n: t.damage });
  const total = items.reduce((a, b) => a + b.n, 0);
  if (total === 0) return;
  const small = size * 0.105;
  const bigR = size * 0.125;
  // Up to four small tokens in all; more: one big token per kind with its number.
  const pieces = total <= 4 ? items.flatMap((it) => Array.from({ length: it.n }, () => ({ kind: it.kind, n: 1, big: false }))) : items.map((it) => ({ kind: it.kind, n: it.n, big: it.n > 1 }));
  const widths = pieces.map((p) => (p.big ? bigR * 3.1 : small * 2.75));
  let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
  pieces.forEach((p, i) => {
    const px = x + widths[i]! / 2;
    x += widths[i]!;
    const r = p.big ? bigR : small;
    if (p.kind === "damage") drawDamage(g, px, y, r, p.big);
    else drawShield(g, px, y, r, p.kind === "bio", p.big);
    if (p.big) number(node, p.n, px, y + (p.kind === "damage" ? 0 : r * 0.02), r * (p.kind === "damage" ? 0.85 : 1.05), p.kind === "damage" ? DAMAGE.rim : 0xffffff);
  });
}
