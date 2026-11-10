/**
 * Tokens drawn as physical pieces on the Field (designer 2026-11-09).
 *
 * - Fuse tokens (6.6) are red tokens, each its own shape with a glyph inside: Tick a round clamp
 *   charge with a clock face, Mortar a six-sided token with a mortar round, Feedback a diamond
 *   with a lightning bolt. More than one of a kind: a small number on it.
 * - A Barrier (6.4) is a force field round its unit: a shimmering bubble with particles
 *   circling in it, drawn every frame (still when reduced motion is on).
 * Placeholder looks; the designer's art can replace them later.
 */

import { type Container, Graphics, Text } from "pixi.js";
import type { Tokens } from "../engine/state.js";

export const FUSE_ORDER = ["tick", "mortar", "feedback"] as const;
type Fuse = (typeof FUSE_ORDER)[number];

const BODY: Record<Fuse, { fill: number; rim: number; light: number }> = {
  tick: { fill: 0xd63a2a, rim: 0x6e1a12, light: 0xff8a70 },
  mortar: { fill: 0xe0562a, rim: 0x74240e, light: 0xffa070 },
  feedback: { fill: 0xb8243f, rim: 0x5c0e1e, light: 0xff7a96 },
};

function shapePoints(kind: Fuse, x: number, y: number, r: number): number[] | undefined {
  if (kind === "mortar") {
    const pts: number[] = [];
    for (let i = 0; i < 6; i++) pts.push(x + r * Math.cos((i * Math.PI) / 3), y + r * Math.sin((i * Math.PI) / 3));
    return pts;
  }
  if (kind === "feedback") return [x, y - r * 1.08, x + r * 1.08, y, x, y + r * 1.08, x - r * 1.08, y];
  return undefined;
}

/** One Fuse token at (x, y), radius r. */
export function drawFuse(g: Graphics, kind: Fuse, x: number, y: number, r: number): void {
  const c = BODY[kind];
  const body = (dx: number, dy: number, rr: number) => {
    const pts = shapePoints(kind, x + dx, y + dy, rr);
    return pts ? g.poly(pts) : g.circle(x + dx, y + dy, rr);
  };
  // Shadow, body with a dark rim, a lighter bevel on the upper half.
  body(r * 0.12, r * 0.2, r).fill({ color: 0x000000, alpha: 0.35 });
  body(0, 0, r).fill({ color: c.fill }).stroke({ width: Math.max(1.2, r * 0.16), color: c.rim });
  body(0, -r * 0.12, r * 0.72).fill({ color: c.light, alpha: 0.28 });
  const w = Math.max(1.2, r * 0.14);
  const white = 0xfff4ee;
  if (kind === "tick") {
    // A clock face with two hands, clamped by four teeth.
    g.circle(x, y, r * 0.5).fill({ color: 0x5a120c, alpha: 0.6 }).stroke({ width: w, color: white });
    g.moveTo(x, y).lineTo(x, y - r * 0.38).stroke({ width: w, color: white });
    g.moveTo(x, y).lineTo(x + r * 0.28, y + r * 0.1).stroke({ width: w, color: white });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      g.moveTo(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62)
        .lineTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86)
        .stroke({ width: w * 1.3, color: white });
    }
  } else if (kind === "mortar") {
    // A mortar round pointing up: rounded nose, body, fins.
    const top = y - r * 0.62;
    g.poly([x - r * 0.24, y + r * 0.12, x - r * 0.24, top + r * 0.22, x, top, x + r * 0.24, top + r * 0.22, x + r * 0.24, y + r * 0.12]).fill({ color: white });
    g.rect(x - r * 0.1, y + r * 0.12, r * 0.2, r * 0.3).fill({ color: white });
    g.poly([x - r * 0.38, y + r * 0.62, x - r * 0.1, y + r * 0.32, x + r * 0.1, y + r * 0.32, x + r * 0.38, y + r * 0.62]).fill({ color: white });
    g.moveTo(x - r * 0.24, y - r * 0.12).lineTo(x + r * 0.24, y - r * 0.12).stroke({ width: Math.max(1, r * 0.08), color: c.fill });
  } else {
    // A lightning bolt.
    g.poly([x + r * 0.12, y - r * 0.68, x - r * 0.34, y + r * 0.08, x - r * 0.02, y + r * 0.08, x - r * 0.14, y + r * 0.68, x + r * 0.34, y - r * 0.1, x + r * 0.02, y - r * 0.1]).fill({ color: white });
  }
}

/** The Fuse tokens on a unit, in a row near the top of its tile. Adds the pieces to `node`. */
export function addFuseTokens(node: Container, t: Tokens, cx: number, cy: number, size: number): void {
  const kinds = FUSE_ORDER.filter((k) => t[k] > 0);
  if (kinds.length === 0) return;
  // Big enough to read the glyph (designer 2026-11-09).
  const r = size * 0.155;
  const gap = r * 2.25;
  // Below the Level badge in the top corner (designer 2026-11-09; lower for the bigger badge, 2026-11-10).
  const y = cy - size * 0.4;
  const g = new Graphics();
  g.eventMode = "none";
  g.label = "fuse-tokens";
  node.addChild(g);
  kinds.forEach((k, i) => {
    const x = cx + (i - (kinds.length - 1) / 2) * gap;
    drawFuse(g, k, x, y, r);
    if (t[k] > 1) {
      g.circle(x + r * 0.85, y - r * 0.75, r * 0.5).fill({ color: 0xffffff }).stroke({ width: 1, color: BODY[k].rim });
      const n = new Text({ text: String(t[k]), style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(8, r * 0.8), fill: 0x1d1d1f, fontWeight: "800" } });
      n.anchor.set(0.5);
      n.position.set(x + r * 0.85, y - r * 0.75);
      n.eventMode = "none";
      node.addChild(n);
    }
  });
}

const AURA = 0x8fdcff;

/** A Barrier's force field round a unit at (cx, cy). `now` in ms (0 = still). */
export function drawBarrier(g: Graphics, cx: number, cy: number, size: number, now: number, alpha: number, scale: number): void {
  if (alpha <= 0.01) return;
  const t = now / 1000;
  const R = size * 0.98 * scale;
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  g.circle(cx, cy, R).fill({ color: AURA, alpha: (0.07 + 0.05 * pulse) * alpha });
  g.circle(cx, cy, R).stroke({ width: 1.5, color: AURA, alpha: (0.45 + 0.25 * pulse) * alpha });
  // Brighter arcs sliding round the bubble.
  for (let k = 0; k < 3; k++) {
    const a0 = t * (0.9 + k * 0.35) * (k % 2 ? -1 : 1) + (k * 2 * Math.PI) / 3;
    g.moveTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R).arc(cx, cy, R, a0, a0 + 0.7).stroke({ width: 2.5, color: 0xe8f9ff, alpha: 0.55 * alpha });
  }
  // A faint hexagon lattice ring just inside the bubble.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + t * 0.15;
    const x = cx + Math.cos(a) * R * 0.86;
    const y = cy + Math.sin(a) * R * 0.86;
    const pts: number[] = [];
    for (let j = 0; j < 6; j++) pts.push(x + size * 0.06 * Math.cos((j * Math.PI) / 3 + a), y + size * 0.06 * Math.sin((j * Math.PI) / 3 + a));
    g.poly(pts).stroke({ width: 1, color: AURA, alpha: (0.18 + 0.2 * Math.sin(t * 3 + i)) * alpha });
  }
  // Particles circling inside the field.
  for (let i = 0; i < 14; i++) {
    const speed = 0.5 + ((i * 37) % 10) / 12;
    const a = t * speed * (i % 2 ? 1 : -1) + i * 2.1;
    const rr = R * (0.78 + 0.18 * Math.sin(t * 1.3 + i));
    g.circle(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.3 + (i % 3) * 0.5).fill({ color: i % 4 ? AURA : 0xffffff, alpha: (0.5 + 0.5 * Math.sin(t * 4 + i * 1.7)) * 0.9 * alpha });
  }
}
