/**
 * Strength, Shield and Damage drawn as pieces on a unit (designer 2026-11-09), instead of the
 * words "Strength N", "S2", "D1".
 *
 * - Strength (3.3): one amber power cell per point of Strength, up to 4; more than 4: one
 *   reactor core with the number inside (sci-fi look, designer 2026-11-09).
 * - Shield tokens (6.2): small cyan hexagonal deflectors with a crest of light, up to 4; more: one big
 *   deflector with corner brackets and the number. Bio-shields (6.3) are the same in green with
 *   a helix.
 * - Level (3.3, designer 2026-11-09): a small dark hexagon badge with the number at the tile's
 *   upper left corner, and 1 to 5 bright notches along its upper left edge (`addLevel`).
 * - Damage tokens (6.1): small red spiked bursts with a dark crack, up to 4; more: one big burst
 *   with a dark ring and the number.
 * Shields and Damage never sit on a unit together (3.3), so they share one row.
 * Placeholder looks; the designer's art can replace them later.
 */

import { type Container, Graphics, Text } from "pixi.js";
import type { Tokens } from "../engine/state.js";

const GOLD = { fill: 0xf2b630, rim: 0x6b4a05, light: 0xfff0b8 };
const SHIELD = { fill: 0x2aa8ff, rim: 0x0b2a4a, light: 0xcff4ff, glow: 0x6fe0ff };
const BIO = { fill: 0x39d97a, rim: 0x0a3a20, light: 0xd2f7dc, glow: 0x7dffaa };
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

/** A pointy-top hexagon's corners round (x, y). */
const hexPts = (x: number, y: number, r: number) => {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts.push(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  return pts;
};

/** A tall cell with chamfered corners (a power cell), centre (x, y). */
const cellPts = (x: number, y: number, w: number, h: number) => {
  const c = w * 0.38;
  return [x - w / 2 + c, y - h / 2, x + w / 2 - c, y - h / 2, x + w / 2, y - h / 2 + c, x + w / 2, y + h / 2 - c, x + w / 2 - c, y + h / 2, x - w / 2 + c, y + h / 2, x - w / 2, y + h / 2 - c, x - w / 2, y - h / 2 + c];
};

/**
 * One Strength pip, sci-fi (designer 2026-11-09): a glowing amber power cell in a dark casing.
 * `big`: a reactor core, a ring of lit segments round a dark centre (the number goes inside).
 */
function drawStrength(g: Graphics, x: number, y: number, r: number, big: boolean): void {
  if (big) {
    g.circle(x, y, r * 1.32).fill({ color: GOLD.fill, alpha: 0.18 });
    g.circle(x, y, r * 1.18).fill({ color: 0x101216, alpha: 0.92 }).stroke({ width: Math.max(1, r * 0.1), color: 0x6b5a2a });
    // Twelve lit segments round the core.
    for (let i = 0; i < 12; i++) {
      const a0 = (i * Math.PI) / 6 - Math.PI / 2 + 0.07;
      const a1 = a0 + Math.PI / 6 - 0.14;
      g.moveTo(x + Math.cos(a0) * r * 0.98, y + Math.sin(a0) * r * 0.98).arc(x, y, r * 0.98, a0, a1).stroke({ width: r * 0.24, color: i % 3 === 0 ? GOLD.light : GOLD.fill });
    }
    g.circle(x, y, r * 0.72).fill({ color: 0x231a05 }).stroke({ width: 1, color: GOLD.fill, alpha: 0.8 });
    return;
  }
  const w = r * 1.12;
  const h = r * 2.0;
  g.poly(cellPts(x, y, w * 1.3, h * 1.16)).fill({ color: 0x101216, alpha: 0.9 }).stroke({ width: 1, color: 0x8a96a8, alpha: 0.7 });
  g.poly(cellPts(x, y, w * 1.05, h * 0.98)).fill({ color: GOLD.fill, alpha: 0.28 });
  g.poly(cellPts(x, y, w * 0.78, h * 0.8)).fill({ color: GOLD.fill });
  // The glowing core line and two casing bands.
  g.rect(x - w * 0.11, y - h * 0.32, w * 0.22, h * 0.64).fill({ color: 0xfffbe6 });
  g.rect(x - w * 0.52, y - h * 0.08, w * 1.04, Math.max(1, h * 0.06)).fill({ color: 0x101216, alpha: 0.85 });
}

/** One Shield token, sci-fi: a hexagonal deflector with a crest (Bio-shield: green with a helix). */
function drawShield(g: Graphics, x: number, y: number, r: number, bio: boolean, big: boolean): void {
  const c = bio ? BIO : SHIELD;
  disc(g, x, y, r * (big ? 1.42 : 1.3));
  if (big) {
    // Corner brackets round the big one.
    const R = r * 1.28;
    const pts = hexPts(x, y, R);
    for (let i = 0; i < 6; i++) {
      const px = pts[i * 2]!;
      const py = pts[i * 2 + 1]!;
      for (const j of [i - 1, i + 1]) {
        const k = (j + 6) % 6;
        const qx = pts[k * 2]!;
        const qy = pts[k * 2 + 1]!;
        g.moveTo(px, py).lineTo(px + (qx - px) * 0.25, py + (qy - py) * 0.25).stroke({ width: Math.max(1.2, r * 0.14), color: c.light });
      }
    }
  }
  g.poly(hexPts(x, y, r * 1.08)).fill({ color: c.fill, alpha: 0.35 });
  g.poly(hexPts(x, y, r)).fill({ color: c.rim, alpha: 0.85 }).stroke({ width: Math.max(1.2, r * 0.16), color: c.glow });
  g.poly(hexPts(x, y, r * 0.72)).stroke({ width: Math.max(0.8, r * 0.07), color: c.glow, alpha: 0.55 });
  if (big) return; // the number goes on it
  const w = Math.max(1, r * 0.17);
  if (bio) {
    // A short double helix.
    const top = y - r * 0.5;
    const len = r;
    for (const ph of [0, Math.PI]) {
      g.moveTo(x + Math.sin(ph) * r * 0.3, top);
      for (let i = 1; i <= 8; i++) g.lineTo(x + Math.sin(ph + (i / 8) * Math.PI * 2) * r * 0.3, top + (len * i) / 8);
      g.stroke({ width: w, color: 0xffffff });
    }
    for (const f of [0.25, 0.75]) g.moveTo(x - r * 0.3, top + len * f).lineTo(x + r * 0.3, top + len * f).stroke({ width: w * 0.6, color: c.light });
  } else {
    // A crest of light: a small shield outline with a bright core line.
    const crest = (k: number) => [x - r * 0.44 * k, y - r * 0.42 * k, x + r * 0.44 * k, y - r * 0.42 * k, x + r * 0.44 * k, y + r * 0.06 * k, x, y + r * 0.5 * k, x - r * 0.44 * k, y + r * 0.06 * k];
    g.poly(crest(1)).fill({ color: c.fill, alpha: 0.45 }).stroke({ width: w, color: 0xffffff, join: "round" });
    g.moveTo(x, y - r * 0.26).lineTo(x, y + r * 0.3).stroke({ width: w * 0.9, color: c.light });
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
      const r = size * 0.11;
      const gap = r * 1.75;
      for (let i = 0; i < strength; i++) drawStrength(g, cx + (i - (strength - 1) / 2) * gap, y, r, false);
    } else {
      const r = size * 0.13;
      drawStrength(g, cx, y, r, true);
      number(node, strength, cx, y, r * 1.0, GOLD.light);
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

/**
 * Level (3.3), designer 2026-11-09 (variants A + C): a small dark hexagon badge with the number at
 * the tile's upper left corner, and one bright notch per Level (up to 5; Omega's big Levels: the
 * badge only) along the upper left edge towards the top corner, like rank stripes.
 */
export function addLevel(node: Container, level: number | undefined, cx: number, cy: number, size: number): void {
  if (level === undefined) return;
  const g = new Graphics();
  g.eventMode = "none";
  g.label = "unit-level";
  node.addChild(g);
  // The tile's upper left corner (150°) and top corner (90°), on the tile's rim (0.9).
  const lx = cx - Math.cos(Math.PI / 6) * size * 0.9;
  const ly = cy - Math.sin(Math.PI / 6) * size * 0.9;
  const tx = cx;
  const ty = cy - size * 0.9;
  if (level <= 5) {
    const ex = tx - lx;
    const ey = ty - ly;
    const len = Math.hypot(ex, ey);
    // Inward normal of that edge.
    const nx = -ey / len;
    const ny = ex / len;
    const depth = size * 0.1;
    for (let i = 0; i < level; i++) {
      const f = 0.36 + i * 0.075;
      const x = lx + ex * f;
      const y = ly + ey * f;
      g.moveTo(x, y).lineTo(x + nx * depth, y + ny * depth).stroke({ width: Math.max(3, size * 0.045), color: 0x101216, alpha: 0.85 });
      g.moveTo(x, y).lineTo(x + nx * depth, y + ny * depth).stroke({ width: Math.max(1.5, size * 0.022), color: 0xfff1c2 });
    }
  }
  const bx = cx - size * 0.6;
  const by = cy - size * 0.37;
  const r = size * 0.13;
  g.poly(hexPts(bx, by, r * 1.12)).fill({ color: 0x000000, alpha: 0.3 });
  g.poly(hexPts(bx, by, r)).fill({ color: 0x15161a }).stroke({ width: Math.max(1, size * 0.018), color: 0xfff1c2, alpha: 0.9 });
  number(node, level, bx, by + r * 0.04, r * (level > 9 ? 0.95 : 1.2), 0xfff1c2);
}
