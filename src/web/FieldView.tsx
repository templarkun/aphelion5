/**
 * The Field (spec "Screen and controls"), drawn with PixiJS: pointy-top hex
 * sectors laid out by Core Rules 3.8 (r + 1 = right, q + 1 = up-right), each
 * showing its top tile, tokens as badges, stack height and arrows by facing.
 * Legal answers to the current question are lit and clickable.
 *
 * Interaction and animation (Program Spec section of that name):
 * - the engine's events of each answer play one at a time (anim.ts); a tap
 *   anywhere finishes them; Undo plays nothing backwards;
 * - a Mecha that can act is dragged onto a blue sector or unit (move) or a
 *   red unit (Attack); a tether ties it to where it came from; it snaps onto
 *   a target and floats back when dropped anywhere else. M_03 / M_06: drop
 *   on blue first (the Passive), then on red, in one gesture.
 *
 * Each sector is drawn into its own container, rebuilt on every draw; the
 * animations and the drag change those containers frame by frame on top of
 * the board as it now is, so a re-draw in the middle of either is harmless.
 */

// PixiJS without eval(): the published page (and app wrappers) may forbid it.
import { onResting, poke, startResting } from "./idle.js";
import "pixi.js/unsafe-eval";
import { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import type { GameData } from "../data/index.js";
import { type GameEvent, newEvents } from "../engine/events.js";
import { type Ctx, level, sectorKeys, sectorOf, sectorState, stack, strength, tile, topTileId, unitDef } from "../engine/field.js";
import type { Answer } from "../engine/questions.js";
import type { GameState, TileId } from "../engine/state.js";
import { arrowSides, fromKey } from "../geometry/hex.js";
import { type NodeLook, Player, type Step, easeInOut, easeOut, parallel } from "./anim.js";
import { type ShotLook, type Source, type Target, UNIT_SHOT, edgeOf, fireGlow, shotStep, weaponStep } from "./weapons.js";
import { endOverloadAt, exposureStep } from "./exposureFx.js";
import { gyroReward } from "./gyroEnergy.js";
import { BIG_REVEAL, chargeLook, drawOverloadRing, gyroBreak, gyroDrain, revealFxStep, sleeperActivate } from "./revealFx.js";
import { addLevel, addUnitMarks } from "./unitMarks.js";
import { BADGE_ASPECT, CLEARED_COLOUR, energyGlyphImage, glyphBadge, TYPE_COLOUR } from "./glyphs.js";
import { drawAlert, drawEnergyBorder, flareEnergySpots } from "./alertFx.js";
import { addFuseTokens, drawBarrier } from "./tokensFx.js";
import { dropStep, fizzleStep, landingDust, overhaulStep, overloadStep, tokenStep, turnStep, uncoverStep } from "./eventFx.js";
import { isStill, onMotion, speedFactor } from "./motion.js";
import { alongOutline, hexOutline, onFeatures, features } from "./features.js";
import { PlasmaWave } from "./plasmaFx.js";
import { EdgePartner } from "./overloadPartner.js";
import type { DragKind, DragPlan, DragTarget } from "./drag.js";
import { type SalvageMark, killOf, salvageMarkOf } from "./celebrate/detect.js";
import { SALVAGE_CLEARED, SALVAGE_NODES } from "../engine/command.js";
import { killStepFor } from "./celebrate/kills.js";
import { sfx } from "./sound.js";

export interface FieldProps {
  data: GameData;
  state: GameState;
  /** Sector keys or tile ids that are legal answers now. */
  choosable: { sectors: string[]; units: TileId[] };
  /** How a lit sector glows when tapping: blue-green for a move, red for an Attack (else amber). */
  tones?: Record<string, DragKind> | undefined;
  selected: string[];
  onPick: (id: string) => void;
  /** `held`: shown by a long tap (touch), not by the mouse resting on it. */
  onHover: (sector: string | undefined, held?: boolean) => void;
  showHidden: boolean;
  dark: boolean;
  /** A facing being chosen (3.7): rotate buttons on that unit, drawn at `facing`. */
  rotate?: { tile: TileId; facing: number; onTurn: (dir: 1 | -1) => void } | undefined;
  /** The drag plan of a unit that can be dragged now (a Mecha on the action menu). */
  dragFor?: ((tile: TileId) => DragPlan | undefined) | undefined;
  /** A piece dropped on a lit target: send these answers. */
  onDrop?: ((answers: Answer[]) => void) | undefined;
  /** A short message for the information strip (a drop that was not allowed). */
  onNote?: ((text: string, warn: boolean) => void) | undefined;
  /** Sectors a selected Module would affect (designer 2026-11-08): a violet overline. */
  affected?: string[] | undefined;
  /** A tap on nothing that can be chosen. */
  onMiss?: (() => void) | undefined;
  /** The game's seed: which kill celebration plays this mission (I19); none: no kill celebration. */
  seed?: number | undefined;
  /** That kill piece, whatever the seed picks (the previews in System options). */
  killPiece?: string | undefined;
  /** Changed (counted up): finish every animation now, celebrations too (two taps, designer 2026-11-20). */
  skipAll?: number | undefined;
  /** A kill celebration starts or ends (the screen shows "Tap twice to skip"). */
  onCelebrate?: ((on: boolean) => void) | undefined;
  /** The win celebration's shine makes the units shiver (offset in pixels for a sector now). */
  shake?: ((key: string, now: number) => { dx: number; dy: number; scale?: number; sy?: number; alpha?: number; z?: number } | undefined) | undefined;
}

// Round 29 (designer): the Yellow energy token a lighter, lemon yellow, apart from the Flare's gold (TYPE_COLOUR 0xf2c94c).
const ENERGY_HEX: Record<string, number> = { Yellow: 0xffec6e, Red: 0xe8402f, Blue: 0x2f74e8 };
const ENERGY_CSS: Record<string, string> = { Yellow: "var(--yellow)", Red: "var(--red)", Blue: "var(--blue)" };
const MOVE = 0x23c4a8;
const ATTACK = 0xff5a36;
const READY = 0xf2b84b;
/** What a selected Module would affect (designer 2026-11-08). */
const AFFECT = 0x9b6bff;

/** Screen angle of each side (1 left, then clockwise), in radians; y grows downwards. */
const SIDE_ANGLE: Record<number, number> = { 1: Math.PI, 2: (2 * Math.PI) / 3, 3: Math.PI / 3, 4: 0, 5: -Math.PI / 3, 6: (-2 * Math.PI) / 3 };

const badgeTextures = new Map<string, Texture>();
/** A unit's three-layer glyph badge (glyphs.ts) at the tile's upper right corner. */
function addGlyphBadge(node: Container, unitId: string | undefined, cx: number, cy: number, size: number): void {
  if (!unitId) return;
  let tex = badgeTextures.get(unitId);
  if (!tex) {
    const c = glyphBadge(unitId);
    if (!c) return;
    tex = Texture.from(c);
    badgeTextures.set(unitId, tex);
  }
  // A little over a third of the tile's height, tucked into the corner inside the tile's edge.
  const h = Math.max(18, size * 0.38);
  const sp = new Sprite({ texture: tex, anchor: 0.5 });
  sp.width = h * BADGE_ASPECT;
  sp.height = h;
  sp.position.set(cx + size * 0.6, cy - size * 0.33);
  sp.eventMode = "none";
  sp.label = "glyph-badge";
  node.addChild(sp);
}

/**
 * Feature (designer 2026-11-21, round 24): a sector's very next tile, once the player has looked
 * at it (the tile under a unit, or a Dark sector's top tile), drawn on the tile in the chosen way.
 */
function addNextTile(node: Container, unitId: string | undefined, cx: number, cy: number, size: number, dark: boolean): void {
  const look = features().next;
  if (!unitId) return;
  let tex = badgeTextures.get(unitId);
  if (!tex) {
    const c = glyphBadge(unitId);
    if (!c) return;
    tex = Texture.from(c);
    badgeTextures.set(unitId, tex);
  }
  const put = (h: number, x: number, y: number, alpha = 1) => {
    const sp = new Sprite({ texture: tex, anchor: 0.5 });
    sp.width = h * BADGE_ASPECT;
    sp.height = h;
    sp.position.set(x, y);
    sp.alpha = alpha;
    sp.eventMode = "none";
    sp.label = "next-tile";
    node.addChild(sp);
    return sp;
  };
  if (look === "corner") {
    // Mirrors the unit's own badge (upper right): lower left, a little smaller, with a small down mark.
    const h = Math.max(15, size * 0.3);
    const x = cx - size * 0.6;
    const y = cy + size * 0.3;
    const ring = new Graphics();
    ring.circle(x, y, h * 0.6).fill({ color: 0x0b0f17, alpha: 0.55 });
    ring.eventMode = "none";
    node.addChild(ring);
    put(h, x, y, 0.95);
    const m = new Graphics();
    m.poly([x - h * 0.16, y + h * 0.56, x + h * 0.16, y + h * 0.56, x, y + h * 0.74]).fill({ color: 0xffffff, alpha: 0.85 });
    m.eventMode = "none";
    node.addChild(m);
  } else if (look === "ghost") {
    // Behind the words: right after the tile's own plate.
    const sp = put(size * (dark ? 0.62 : 0.72), cx, cy + size * 0.06, dark ? 0.2 : 0.16);
    node.addChildAt(sp, Math.min(1, node.children.length - 1));
  } else if (look === "behind") {
    // Round 28: its glyph badge tucked just behind the unit's own badge (upper right), like a card under
    // a card; a Dark sector has no badge of its own, so it sits there by itself, a little dimmer.
    const h = Math.max(15, size * 0.32);
    const x = cx + size * (dark ? 0.6 : 0.47);
    const y = cy - size * (dark ? 0.33 : 0.2);
    const sp = put(h, x, y, dark ? 0.8 : 0.9);
    // Before the unit's own badge, so that one stays on top.
    const own = node.children.findIndex((ch) => ch.label === "glyph-badge");
    if (own >= 0) node.addChildAt(sp, own);
  } else {
    // A small dark chip at the tile's foot: the word "next" and the glyph.
    const h = Math.max(13, size * 0.22);
    const y = cy + size * (dark ? 0.6 : 0.72);
    const t = new Text({ text: "next", style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(8, h * 0.62), fill: 0xffffff, fontWeight: "700" } });
    const w = t.width + h * 1.55;
    const chip = new Graphics();
    chip.roundRect(cx - w / 2, y - h * 0.62, w, h * 1.24, h * 0.62).fill({ color: 0x0b0f17, alpha: 0.72 }).stroke({ width: 1, color: 0xffffff, alpha: 0.35 });
    chip.eventMode = "none";
    node.addChild(chip);
    t.anchor.set(0, 0.5);
    t.position.set(cx - w / 2 + h * 0.4, y);
    t.eventMode = "none";
    node.addChild(t);
    put(h * 1.05, cx + w / 2 - h * 0.6, y);
  }
}

/**
 * Feature (designer 2026-11-22, round 28): an Energy Gyro (G_01-G_09) shows the energy you gain by
 * destroying it, in the chosen way. Drawn once with the board (nothing on it moves).
 */
function addGyroEnergy(node: Container, n: number, colour: "Yellow" | "Red" | "Blue", cx: number, cy: number, size: number): void {
  const look = features().gyroEnergy;
  const col = ENERGY_HEX[colour] ?? 0x888888;
  const tex = energyTexture(colour);
  const g = new Graphics();
  g.eventMode = "none";
  g.label = "gyro-energy";
  node.addChild(g);
  const glyph = (x: number, y: number, h: number, alpha = 1) => {
    if (!tex) return;
    const sp = new Sprite({ texture: tex, anchor: 0.5, x, y });
    sp.scale.set(h / Math.max(tex.width, tex.height));
    sp.alpha = alpha;
    sp.eventMode = "none";
    node.addChild(sp);
  };
  const num = (text: string, x: number, y: number, fs: number, anchorX = 0.5, alpha = 1) => {
    const t = new Text({ text, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(9, fs), fill: 0xffffff, fontWeight: "800", stroke: { color: 0x0b0f17, width: Math.max(2, fs * 0.22) } } });
    t.anchor.set(anchorX, 0.5);
    t.position.set(x, y);
    t.alpha = alpha;
    t.eventMode = "none";
    node.addChild(t);
  };
  // Round 29: places along the tile's left edges (an inset outline), centred on the middle of the left side,
  // reaching up and down round the corners as there are more (never a second column).
  const along = (inset: number, n: number, gap: number): { x: number; y: number }[] => {
    const R = size * 0.9 - inset;
    const pts = hexOutline(cx, cy, R);
    let u0 = 0;
    let best = Infinity;
    for (let i = 0; i < 240; i++) {
      const q = alongOutline(pts, i / 240);
      const d = Math.hypot(q.x - (cx - R * 0.866), q.y - cy);
      if (d < best) (best = d), (u0 = i / 240);
    }
    let per = 0;
    for (let i = 0; i < pts.length; i += 2) per += Math.hypot(pts[(i + 2) % pts.length]! - pts[i]!, pts[(i + 3) % pts.length]! - pts[i + 1]!);
    const du = gap / Math.max(1, per);
    return Array.from({ length: n }, (_, i) => alongOutline(pts, u0 + (i - (n - 1) / 2) * du));
  };
  // The unit's glyph badge (upper right corner, glyphs.ts) and its size.
  const badge = { x: cx + size * 0.6, y: cy - size * 0.33, h: Math.max(18, size * 0.38) };
  const hexAt = (x: number, y: number, r: number): number[] => {
    const pts: number[] = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k - Math.PI / 2;
      pts.push(x + r * Math.cos(a), y + r * Math.sin(a));
    }
    return pts;
  };
  const light = shade(col, 1.45);
  if (look === "tokens") {
    // One token per energy, curving round the left edges (round 29: no second column past 4).
    const r = size * Math.min(0.085, 0.6 / Math.max(7, n));
    for (const q of along(r * 1.45, n, r * 2.3)) {
      g.circle(q.x, q.y, r * 1.18).fill({ color: 0x0b0f17, alpha: 0.5 });
      g.circle(q.x, q.y, r).fill({ color: col }).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
      glyph(q.x, q.y, r * 1.3);
    }
  } else if (look === "corner") {
    // The number and the energy glyph in the upper left corner.
    // Tucked between the tile's upper left edge and the Level badge, above the unit's name.
    const h = Math.max(12, size * 0.2);
    const x = cx - size * 0.38;
    const y = cy - size * 0.5;
    num(String(n), x, y, h * 0.95, 1);
    g.circle(x + h * 0.55, y, h * 0.48).fill({ color: col }).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
    glyph(x + h * 0.55, y, h * 0.62);
  } else if (look === "ring") {
    // One lit segment per energy round the unit's glyph badge (upper right).
    const R = badge.h * 0.68;
    const gapA = 0.18;
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + (i / n) * Math.PI * 2 + gapA / 2;
      const a1 = a0 + (Math.PI * 2) / n - gapA;
      g.moveTo(badge.x + Math.cos(a0) * R, badge.y + Math.sin(a0) * R).arc(badge.x, badge.y, R, a0, a1).stroke({ width: Math.max(2.5, size * 0.045), color: col, cap: "round" });
    }
    g.circle(badge.x, badge.y, R + size * 0.04).stroke({ width: 1, color: 0x0b0f17, alpha: 0.5 });
  } else if (look === "orbit") {
    // Token ring (round 29): small tokens set round the glyph badge like a crown, on the side facing the tile.
    const R = badge.h * 0.82;
    const r = Math.max(3.6, size * 0.06);
    const span = Math.min(Math.PI * 1.5, (r * 2.4 * Math.max(1, n - 1)) / R);
    const mid = -Math.PI * 0.62; // up and a little left: clear of the unit's name and the corner badges
    for (let i = 0; i < n; i++) {
      const a = mid + (n === 1 ? 0 : -span / 2 + (span * i) / (n - 1));
      const x = badge.x + Math.cos(a) * R;
      const y = badge.y + Math.sin(a) * R;
      g.circle(x, y, r * 1.22).fill({ color: 0x0b0f17, alpha: 0.55 });
      g.circle(x, y, r).fill({ color: col }).stroke({ width: 0.9, color: 0xffffff, alpha: 0.65 });
      glyph(x, y, r * 1.25);
    }
  } else if (look === "pips") {
    // Pip ring (round 29): a ring of pips round the glyph badge, one lit and glowing per energy.
    const slots = Math.max(6, n);
    const R = badge.h * 0.74;
    const r = Math.max(2.2, size * 0.034);
    for (let i = 0; i < slots; i++) {
      const a = -Math.PI / 2 + (i / slots) * Math.PI * 2;
      const x = badge.x + Math.cos(a) * R;
      const y = badge.y + Math.sin(a) * R;
      if (i < n) {
        g.circle(x, y, r * 2.3).fill({ color: col, alpha: 0.28 });
        g.circle(x, y, r).fill({ color: col }).stroke({ width: 0.8, color: 0xffffff, alpha: 0.8 });
        g.circle(x - r * 0.3, y - r * 0.3, r * 0.4).fill({ color: 0xffffff, alpha: 0.8 });
      } else g.circle(x, y, r * 0.8).fill({ color: 0x0b0f17, alpha: 0.6 }).stroke({ width: 0.8, color: col, alpha: 0.5 });
    }
  } else if (look === "honeycomb") {
    // Honeycomb (round 29): hexagonal cells packed together at the tile's left side (clear of the next-tile
    // badge in the lower left corner), from the middle out.
    const rc = Math.max(4.2, size * (n > 7 ? 0.06 : 0.074));
    const d = rc * Math.sqrt(3) * 1.06;
    const ox = cx - size * 0.52;
    const oy = cy + size * 0.04;
    const spots: { x: number; y: number }[] = [{ x: ox, y: oy }];
    // Ring 1 then ring 2 of a pointy-top hex grid, the cells nearest the tile's middle first.
    for (let ring = 1; spots.length < n && ring <= 2; ring++) {
      const ringSpots: { x: number; y: number }[] = [];
      for (let k = 0; k < 6 * ring; k++) {
        const side = Math.floor(k / ring);
        const f = (k % ring) / ring;
        const a0 = (Math.PI / 3) * side;
        const a1 = (Math.PI / 3) * (side + 1);
        ringSpots.push({ x: ox + ring * d * (Math.cos(a0) + (Math.cos(a1) - Math.cos(a0)) * f), y: oy + ring * d * (Math.sin(a0) + (Math.sin(a1) - Math.sin(a0)) * f) });
      }
      ringSpots.sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy));
      spots.push(...ringSpots);
    }
    spots.slice(0, n).forEach((q) => {
      g.poly(hexAt(q.x, q.y, rc)).fill({ color: col }).stroke({ width: 1, color: 0x0b0f17, alpha: 0.7 });
      g.poly(hexAt(q.x, q.y - rc * 0.12, rc * 0.52)).fill({ color: light, alpha: 0.55 });
    });
  } else if (look === "chain") {
    // Cell chain (round 29): hexagonal cells linked by a thread, curving round the left edges.
    const rc = Math.max(4, size * Math.min(0.068, 0.5 / Math.max(7, n)));
    const at = along(rc * 1.6, n, rc * 2.5);
    if (at.length > 1) g.poly(at.flatMap((q) => [q.x, q.y]), false).stroke({ width: Math.max(1.5, rc * 0.45), color: 0x0b0f17, alpha: 0.6 }).stroke({ width: Math.max(0.8, rc * 0.2), color: col, alpha: 0.9 });
    for (const q of at) {
      g.poly(hexAt(q.x, q.y, rc)).fill({ color: col }).stroke({ width: 1, color: 0x0b0f17, alpha: 0.7 });
      g.poly(hexAt(q.x, q.y - rc * 0.12, rc * 0.5)).fill({ color: light, alpha: 0.55 });
    }
  } else {
    // Bead string (round 29): a thin thread of the energy's colour along the left edges, a glowing bead per energy.
    const r = Math.max(2.6, size * Math.min(0.05, 0.4 / Math.max(7, n)));
    const at = along(r * 2.2, n + 2, r * 3.4);
    g.poly(at.flatMap((q) => [q.x, q.y]), false).stroke({ width: 2.2, color: 0x0b0f17, alpha: 0.45 }).stroke({ width: 1, color: col, alpha: 0.75 });
    for (const q of at.slice(1, -1)) {
      g.circle(q.x, q.y, r * 2.2).fill({ color: col, alpha: 0.25 });
      g.circle(q.x, q.y, r).fill({ color: col }).stroke({ width: 0.8, color: 0xffffff, alpha: 0.7 });
      g.circle(q.x - r * 0.3, q.y - r * 0.3, r * 0.38).fill({ color: 0xffffff, alpha: 0.85 });
    }
  }
}

const energyTextures = new Map<string, Texture>();
function energyTexture(col: "Yellow" | "Red" | "Blue"): Texture | undefined {
  const have = energyTextures.get(col);
  if (have) return have;
  const img = energyGlyphImage(col);
  if (!img) return undefined;
  const tex = Texture.from(img);
  energyTextures.set(col, tex);
  return tex;
}

/** A tile's hexagon; its corners follow the feature chosen in the Menu (features.ts). */
function hexPoints(cx: number, cy: number, size: number): number[] {
  return hexOutline(cx, cy, size);
}

/** A colour made darker (k < 1) or lighter (k > 1). */
function shade(c: number, k: number): number {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1))));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
}

/**
 * Feature (designer 2026-11-20): how deep a sector's stack is, seen at a glance. `layers` = the
 * tiles under the top one (a Dark sector: all its tiles). Drawn under the tile, so it moves with it.
 */
function addDepth(node: Container, cx: number, cy: number, size: number, layers: number, fill: number): void {
  const how = features().depth;
  if (how === "original" || layers <= 0) return;
  const g = new Graphics();
  g.eventMode = "none";
  const r = size * 0.9;
  const n = Math.min(layers, 12);
  if (how === "stack" || how === "stackFine") {
    // One tile edge under the other, deepest first ("fine": closer together, softer lines).
    const fine = how === "stackFine";
    const step = size * (fine ? 0.011 : 0.018);
    for (let i = n; i >= 1; i--) {
      const pts = hexPoints(cx, cy + i * step, r);
      g.poly(pts).fill({ color: shade(fill, (fine ? 0.7 : 0.62) - 0.02 * i) }).stroke({ width: fine ? 0.6 : 0.8, color: 0x000000, alpha: fine ? 0.35 : 0.55 });
    }
  } else if (how === "glass") {
    // Round 28: a thin line of cool light under the lower edges per tile, like stacked glass plates.
    const step = size * 0.016;
    const base = hexPoints(cx, cy, r);
    for (let i = n; i >= 1; i--) {
      const line: number[] = [];
      for (let j = 0; j < base.length; j += 2) if (base[j + 1]! > cy - r * 0.05) line.push(base[j]!, base[j + 1]! + i * step);
      if (line.length < 4) continue;
      g.poly(line, false).stroke({ width: 1.6, color: 0x0a0d14, alpha: 0.5 });
      g.poly(line, false).stroke({ width: 0.8, color: 0xbfe6ff, alpha: 0.55 - 0.03 * i });
    }
  } else {
    // "Hint": no solid edges, only a faint hairline under the tile's lower edges per tile.
    const step = size * 0.013;
    const base = hexPoints(cx, cy, r);
    for (let i = 1; i <= n; i++) {
      const line: number[] = [];
      for (let j = 0; j < base.length; j += 2) if (base[j + 1]! > cy + r * 0.2) line.push(base[j]!, base[j + 1]! + i * step);
      if (line.length >= 4) g.poly(line, false).stroke({ width: 0.7, color: shade(fill, 0.55), alpha: 0.75 - 0.04 * i });
    }
  }
  node.addChild(g);
}

/**
 * Notches (designer 2026-11-21, part of the game; was a feature to choose): one notch per tile under the top
 * one (a Dark sector: per tile), up to 12, along the tile's two lower edges from the bottom point out.
 */
function addDepthNotches(node: Container, cx: number, cy: number, size: number, layers: number, light: boolean): void {
  if (layers <= 0) return;
  const g = new Graphics();
  g.eventMode = "none";
  const n = Math.min(layers, 12);
  const r = size * 0.86;
  // Lower left corner -> bottom point -> lower right corner, notches spread along it from the bottom out.
  const L = { x: cx - r * Math.cos(Math.PI / 6), y: cy + r / 2 };
  const B = { x: cx, y: cy + r };
  const R = { x: cx + r * Math.cos(Math.PI / 6), y: cy + r / 2 };
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? L : R;
    const t = 0.1 + 0.135 * Math.floor(i / 2);
    const x = B.x + (side.x - B.x) * t;
    const y = B.y + (side.y - B.y) * t;
    g.circle(x, y, size * 0.035).fill({ color: light ? 0xffffff : 0x1d1d1f, alpha: 0.85 });
  }
  node.addChild(g);
}

/** A number in 0..1 that stays the same for the same (a, b, c): for sparks that differ per sector. */
function hash3(a: number, b: number, c: number): number {
  const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Units and sectors ready to be tapped. "Original" is the hairline amber edge that slowly brightens and
 * fades (designer 2026-11-08); the others are features to choose from in the Menu (2026-11-20, the
 * second set 2026-11-21). Everything is worked out from the time alone, so each sector keeps in step.
 */
function drawReady(g: Graphics, cx: number, cy: number, size: number, now: number, unit: boolean): void {
  const how = unit ? features().readyUnit : features().readySector;
  const r = size * 0.9;
  const edge = hexPoints(cx, cy, r);
  const seed = Math.round(cx * 7 + cy * 13);
  if (how === "original") {
    const k = breath(now, 2600);
    g.poly(hexPoints(cx, cy, size * 0.86)).stroke({ width: 1.5, color: 0xffe2a0, alpha: (0.35 + 0.6 * k) * 0.9 });
    g.poly(edge).stroke({ width: 1.5, color: READY, alpha: 0.35 + 0.6 * k });
    return;
  }
  if (how === "fill") {
    // The whole tile breathes a warm light, its edge with it.
    const k = breath(now, 2800);
    g.poly(edge).fill({ color: 0xffd27a, alpha: 0.05 + 0.2 * k });
    g.poly(edge).stroke({ width: 2, color: READY, alpha: 0.4 + 0.5 * k });
    return;
  }
  if (how === "embers") {
    // Tiny sparks leave the edge one after another, rise a little and fade.
    const k = breath(now, 3000);
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.3 + 0.3 * k });
    for (let i = 0; i < 12; i++) {
      const period = 1700 + hash3(seed, i, 1) * 900;
      const t0 = now / period + hash3(seed, i, 2);
      const cycle = Math.floor(t0);
      const t = t0 - cycle;
      const at = alongOutline(edge, hash3(seed, i, cycle));
      const ox = (at.x - cx) / r;
      const x = at.x + ox * size * 0.06 * t + Math.sin(t * 6 + i) * size * 0.015;
      const y = at.y - size * 0.32 * t;
      const a = Math.sin(Math.PI * Math.min(1, t * 1.4)) * (1 - t);
      g.circle(x, y, size * (0.009 + 0.008 * hash3(seed, i, 3)) * (1 - 0.5 * t)).fill({ color: t < 0.3 ? 0xfff1c9 : READY, alpha: 0.9 * a });
    }
    return;
  }
  if (how === "heartbeat") {
    // Two quick beats, then a rest.
    const t = (now % 1800) / 1800;
    const beat = (c: number, w: number) => Math.exp(-(((t - c) / w) ** 2));
    const k = Math.min(1, beat(0.08, 0.05) + 0.7 * beat(0.25, 0.05));
    g.poly(edge).fill({ color: 0xffd27a, alpha: 0.07 * k });
    g.poly(edge).stroke({ width: 1.3 + 1.4 * k, color: READY, alpha: 0.3 + 0.65 * k });
    g.poly(hexPoints(cx, cy, r * (1 + 0.05 * k))).stroke({ width: 1, color: 0xffe2a0, alpha: 0.35 * k });
    return;
  }
  if (how === "inner") {
    // A soft light just inside the edge, breathing in and out.
    const k = breath(now, 2800);
    for (let i = 0; i < 6; i++) g.poly(hexPoints(cx, cy, r * (0.985 - 0.028 * i))).stroke({ width: size * 0.03, color: 0xffd27a, alpha: (0.2 - 0.03 * i) * (0.3 + 0.7 * k) });
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.45 + 0.4 * k });
    return;
  }
  if (how === "sparkle") {
    // The edge made of points of light, each twinkling on its own beat.
    const k = breath(now, 3200);
    g.poly(edge).stroke({ width: 0.8, color: READY, alpha: 0.18 + 0.15 * k });
    const n = 42;
    for (let i = 0; i < n; i++) {
      const pt = alongOutline(edge, i / n);
      const w = Math.sin(now / (380 + 300 * hash3(seed, i, 6)) + hash3(seed, i, 7) * 6.28);
      const tw = Math.max(0, w) ** 3;
      g.circle(pt.x, pt.y, size * (0.007 + 0.014 * tw)).fill({ color: tw > 0.6 ? 0xfff6dd : READY, alpha: 0.25 + 0.7 * tw });
    }
    return;
  }
  if (how === "converge") {
    // Draw in: faint rings close in from the edge towards the middle, fading as they go.
    const k = breath(now, 2700);
    g.poly(edge).stroke({ width: 1.4, color: READY, alpha: 0.4 + 0.4 * k });
    for (let i = 0; i < 3; i++) {
      const t = ((now / 2700 + i / 3) % 1 + 1) % 1;
      g.poly(hexPoints(cx, cy, r * (1 - 0.55 * t))).stroke({ width: 1.2, color: 0xffd27a, alpha: 0.5 * Math.sin(Math.PI * t) * (1 - t) });
    }
    return;
  }
  if (how === "gather") {
    // Specks of light come in from a little way out and settle on the edge; the edge flares as they land.
    const P = 2400;
    const t = (now % P) / P;
    const flare = Math.exp(-(((t - 0.72) / 0.09) ** 2));
    g.poly(edge).stroke({ width: 1.2 + 1.2 * flare, color: READY, alpha: 0.3 + 0.6 * flare });
    for (let i = 0; i < 18; i++) {
      const at = alongOutline(edge, hash3(seed, i, 11));
      const ox = (at.x - cx) / r;
      const oy = (at.y - cy) / r;
      const st = 0.05 + 0.25 * hash3(seed, i, 12);
      const f = Math.max(0, Math.min(1, (t - st) / (0.7 - st)));
      if (f <= 0 || t > 0.78) continue;
      const d = size * 0.28 * (1 - f) ** 1.6;
      g.circle(at.x + ox * d, at.y + oy * d, size * 0.009).fill({ color: f > 0.8 ? 0xfff6dd : READY, alpha: 0.85 * Math.min(1, f * 3) });
    }
    return;
  }
  if (how === "aura") {
    // A slow swirl of fine particles in a band just outside the edge.
    const k = breath(now, 3000);
    g.poly(edge).stroke({ width: 1, color: READY, alpha: 0.35 + 0.25 * k });
    for (let i = 0; i < 40; i++) {
      const sp = 0.6 + 0.8 * hash3(seed, i, 13);
      const u = hash3(seed, i, 14) + (now / 14000) * sp * (i % 3 === 0 ? -1 : 1);
      const at = alongOutline(edge, u);
      const out = 1.03 + 0.09 * hash3(seed, i, 15) + 0.02 * Math.sin(now / 900 + i);
      const tw = 0.4 + 0.6 * Math.max(0, Math.sin(now / (500 + 200 * hash3(seed, i, 16)) + i));
      g.circle(cx + (at.x - cx) * out, cy + (at.y - cy) * out, size * (0.005 + 0.006 * hash3(seed, i, 17))).fill({ color: 0xffd27a, alpha: (0.25 + 0.5 * k) * tw });
    }
    return;
  }
  if (how === "current") {
    // Fine particles flow round the edge in one direction, thicker where the current runs strong.
    g.poly(edge).stroke({ width: 0.9, color: READY, alpha: 0.28 });
    for (let i = 0; i < 48; i++) {
      const sp = 0.8 + 0.5 * hash3(seed, i, 18);
      const u = hash3(seed, i, 19) + (now / 5200) * sp;
      const at = alongOutline(edge, u);
      const surge = 0.5 + 0.5 * Math.sin((u % 1) * Math.PI * 4 - now / 600);
      const wob = 1 + 0.025 * Math.sin(now / 300 + i * 1.7);
      g.circle(cx + (at.x - cx) * wob, cy + (at.y - cy) * wob, size * (0.005 + 0.007 * surge)).fill({ color: surge > 0.85 ? 0xfff1c9 : READY, alpha: 0.2 + 0.65 * surge });
    }
    return;
  }
  if (how === "arcs") {
    // Now and then a small spark of electricity jumps along part of the edge, crackling.
    const k = breath(now, 2800);
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.35 + 0.3 * k });
    for (let a = 0; a < 2; a++) {
      const P = 1300 + 300 * a;
      const n = Math.floor(now / P + hash3(seed, a, 20));
      const t = ((now / P + hash3(seed, a, 20)) % 1);
      if (t > 0.28) continue;
      const life = 1 - t / 0.28;
      const u0 = hash3(seed, a, n);
      const len = 0.06 + 0.08 * hash3(seed, a, n + 7);
      const steps = 9;
      const pts: number[] = [];
      for (let j = 0; j <= steps; j++) {
        const pt = alongOutline(edge, u0 + (len * j) / steps);
        const jit = j === 0 || j === steps ? 0 : (hash3(seed, j, n * 3 + Math.floor(now / 50)) - 0.5) * size * 0.1;
        pts.push(pt.x + ((pt.x - cx) / r) * jit, pt.y + ((pt.y - cy) / r) * jit);
      }
      g.poly(pts, false).stroke({ width: 2.4, color: READY, alpha: 0.35 * life });
      g.poly(pts, false).stroke({ width: 1, color: 0xfff6dd, alpha: 0.9 * life });
      for (let j = 0; j < 5; j++) {
        const pt = alongOutline(edge, u0 + len * hash3(seed, j, n + 9));
        const d = size * 0.12 * (1 - life);
        g.circle(pt.x + ((pt.x - cx) / r) * d, pt.y + ((pt.y - cy) / r) * d - d * 0.4, size * 0.008).fill({ color: 0xffe2a0, alpha: life });
      }
    }
    return;
  }
  if (how === "drift") {
    // Lit specks drift slowly over the plate, as dust in a beam of light.
    const k = breath(now, 3200);
    g.poly(edge).fill({ color: 0xffd27a, alpha: 0.04 + 0.05 * k });
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.35 + 0.35 * k });
    for (let i = 0; i < 16; i++) {
      const px = (hash3(seed, i, 21) - 0.5) * 1.3 + Math.sin(now / (2600 + 900 * hash3(seed, i, 22)) + i) * 0.12;
      const py = ((hash3(seed, i, 23) + now / (9000 + 5000 * hash3(seed, i, 24))) % 1) * 1.4 - 0.7;
      if (Math.abs(px) * 0.866 + Math.abs(py) * 0.5 > 0.72 || Math.abs(py) > 0.72) continue;
      const tw = 0.5 + 0.5 * Math.sin(now / 700 + i * 2.1);
      g.circle(cx + px * r, cy - py * r, size * (0.006 + 0.008 * hash3(seed, i, 25))).fill({ color: 0xfff1c9, alpha: 0.25 + 0.5 * tw });
    }
    return;
  }
  if (how === "tide") {
    // A broad wave of light rolls slowly round the edge.
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.3 });
    const head = (now % 4200) / 4200;
    const n = 60;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const d = Math.min(Math.abs(u - head), 1 - Math.abs(u - head));
      const k = Math.exp(-((d / 0.13) ** 2));
      if (k < 0.04) continue;
      const a = alongOutline(edge, u);
      const b = alongOutline(edge, u + 1 / n);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 1.5 + 2.5 * k, color: k > 0.7 ? 0xffe2a0 : READY, alpha: 0.85 * k });
    }
    return;
  }
  if (how === "core") {
    // A soft light breathes in the middle of the plate.
    const k = breath(now, 2900);
    for (let i = 6; i >= 1; i--) g.poly(hexPoints(cx, cy, r * (0.12 * i) * (0.85 + 0.15 * k))).fill({ color: 0xffd27a, alpha: (0.035 + 0.04 * k) });
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.35 + 0.4 * k });
    return;
  }
  // Round 28 (designer 2026-11-22): six more of each, kept light (a few dozen dots at most per tile).
  if (how === "scan") {
    // A thin line of light sweeps down the tile and fades at its foot; a few motes fall off it.
    const P = 2600;
    const t = (now % P) / P;
    g.poly(edge).stroke({ width: 1.1, color: READY, alpha: 0.32 });
    if (t < 0.8) {
      const q = t / 0.8;
      const y = cy - r + 2 * r * q;
      const hw = Math.abs(y - cy) < r * 0.5 ? r * 0.866 : r * 0.866 * (r - Math.abs(y - cy)) / (r * 0.5);
      const a = Math.sin(Math.PI * q);
      g.moveTo(cx - hw, y).lineTo(cx + hw, y).stroke({ width: size * 0.035, color: READY, alpha: 0.18 * a });
      g.moveTo(cx - hw, y).lineTo(cx + hw, y).stroke({ width: 1.2, color: 0xfff1c9, alpha: 0.85 * a });
      for (let i = 0; i < 6; i++) {
        const fx = (hash3(seed, i, 41) * 2 - 1) * hw * 0.9;
        const lag = 0.04 + 0.12 * hash3(seed, i, 42);
        const fy = y - size * lag;
        g.circle(cx + fx, fy, size * 0.008).fill({ color: 0xffe2a0, alpha: 0.6 * a * (1 - lag * 5) });
      }
    }
    return;
  }
  if (how === "brackets") {
    // Six corner marks breathe in and out together, as a target held in the sights.
    const k = breath(now, 2200);
    const pts = hexPoints(cx, cy, r * (1.05 + 0.05 * (1 - k)));
    const n = pts.length / 2;
    const step = Math.max(1, Math.floor(n / 6));
    g.poly(edge).stroke({ width: 0.8, color: READY, alpha: 0.2 + 0.15 * k });
    for (let i = 0; i < 6; i++) {
      const c = Math.floor((i * n) / 6 + step / 2) % n;
      const a = alongOutline(pts, c / n - 0.035);
      const m = alongOutline(pts, c / n);
      const b = alongOutline(pts, c / n + 0.035);
      g.moveTo(a.x, a.y).lineTo(m.x, m.y).lineTo(b.x, b.y).stroke({ width: 2, color: READY, alpha: 0.5 + 0.5 * k, cap: "round", join: "round" });
    }
    return;
  }
  if (how === "ripple") {
    // Now and then a ring of fine particles leaves the edge and fades outwards.
    const k = breath(now, 2400);
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.35 + 0.3 * k });
    const P = 2400;
    const t = ((now + hash3(seed, 0, 43) * P) % P) / P;
    if (t < 0.7) {
      const q = t / 0.7;
      const out = 1 + 0.22 * (1 - (1 - q) ** 2);
      for (let i = 0; i < 30; i++) {
        const at = alongOutline(edge, i / 30 + hash3(seed, i, 44) * 0.02);
        g.circle(cx + (at.x - cx) * out, cy + (at.y - cy) * out, size * 0.008 * (1 - 0.5 * q)).fill({ color: 0xffd27a, alpha: 0.8 * (1 - q) });
      }
    }
    return;
  }
  if (how === "gyroscope") {
    // Round 29: two rings of fine particles turn round the tile, tilted like a gyroscope's rings; the
    // part of each ring behind the tile is dimmer.
    g.poly(edge).stroke({ width: 1, color: READY, alpha: 0.3 });
    const rings = [
      { tilt: 0.32, turn: now / 2600, spin: 0.6 },
      { tilt: 0.32, turn: -now / 3400 + Math.PI / 2, spin: -0.9 },
    ];
    for (const [ri, ring] of rings.entries()) {
      const ca = Math.cos(ring.turn * 0.25 + ri * 1.2);
      const sa = Math.sin(ring.turn * 0.25 + ri * 1.2);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + now / 1000 * ring.spin;
        const ex = Math.cos(a) * r * 1.08;
        const ey = Math.sin(a) * r * 1.08 * ring.tilt;
        const x = cx + ex * ca - ey * sa;
        const y = cy + ex * sa + ey * ca;
        const front = Math.sin(a) > 0;
        const head = ((((a - now / 1000 * ring.spin * 2.2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
        const glow = Math.exp(-((Math.min(head, 1 - head) / 0.12) ** 2));
        g.circle(x, y, size * (0.006 + 0.012 * glow)).fill({ color: glow > 0.6 ? 0xfff6dd : READY, alpha: (front ? 0.75 : 0.25) * (0.35 + 0.65 * glow) });
      }
    }
    return;
  }
  if (how === "pond") {
    // Slow rings of light spread from the middle of the plate, as on still water.
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.4 });
    for (let i = 0; i < 3; i++) {
      const t = ((now / 3600 + i / 3) % 1 + 1) % 1;
      g.poly(hexPoints(cx, cy, r * (0.1 + 0.9 * t))).stroke({ width: 1.3, color: 0xffd27a, alpha: 0.45 * Math.sin(Math.PI * t) });
    }
    return;
  }
  if (how === "lattice") {
    // A faint grid of points on the plate; a wave of light passes over it from left to right.
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.38 });
    const head = ((now % 3200) / 3200) * 2.6 - 1.3;
    const st = r * 0.28;
    for (let iy = -3; iy <= 3; iy++)
      for (let ix = -3; ix <= 3; ix++) {
        const px = (ix + (iy % 2 ? 0.5 : 0)) * st;
        const py = iy * st * 0.866;
        if (Math.abs(px) * 0.866 + Math.abs(py) * 0.5 > r * 0.74 || Math.abs(py) > r * 0.74) continue;
        const k = Math.exp(-(((px / r - head) / 0.25) ** 2));
        g.circle(cx + px, cy + py, size * (0.009 + 0.012 * k)).fill({ color: k > 0.6 ? 0xfff1c9 : 0xffd27a, alpha: 0.12 + 0.75 * k });
      }
    return;
  }
  if (how === "vortex") {
    // Specks swirl slowly in towards the middle of the plate.
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.38 });
    for (let i = 0; i < 18; i++) {
      const P = 3000 + 1500 * hash3(seed, i, 48);
      const t = ((now / P + hash3(seed, i, 49)) % 1 + 1) % 1;
      const ang = hash3(seed, i, 50) * Math.PI * 2 + t * 2.6;
      const d = r * 0.72 * (1 - t);
      g.circle(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, size * (0.006 + 0.01 * (1 - t))).fill({ color: t > 0.8 ? 0xfff1c9 : 0xffd27a, alpha: 0.65 * Math.sin(Math.PI * t) });
    }
    return;
  }
  if (how === "beacon") {
    // A soft light in each corner in turn, as a slow beacon.
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.38 });
    const pts = hexPoints(cx, cy, r * 0.78);
    const n = pts.length / 2;
    const head = (now / 700) % 6;
    for (let i = 0; i < 6; i++) {
      const d = Math.min(Math.abs(head - i), 6 - Math.abs(head - i));
      const k = Math.exp(-((d / 0.7) ** 2));
      if (k < 0.05) continue;
      const at = alongOutline(pts, (Math.floor((i * n) / 6) + (n / 6) / 2) / n);
      for (let j = 3; j >= 1; j--) g.circle(at.x, at.y, size * 0.06 * j).fill({ color: 0xffd27a, alpha: 0.07 * k });
    }
    return;
  }
  if (how === "aurora") {
    // A soft curtain of light motes waves gently across the plate (particles, no drawn bands).
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.38 });
    for (let i = 0; i < 40; i++) {
      const fx = hash3(seed, i, 51) * 2 - 1;
      const px = fx * 0.72 * r;
      const wave = Math.sin(fx * 3 + now / 900) * r * 0.16 + Math.sin(fx * 7 - now / 1300) * r * 0.05;
      const py = wave + (hash3(seed, i, 52) - 0.6) * r * 0.42 + Math.sin(now / 600 + i) * r * 0.03;
      if (Math.abs(px) * 0.866 + Math.abs(py) * 0.5 > r * 0.74 || Math.abs(py) > r * 0.7) continue;
      const k = 0.5 + 0.5 * Math.sin(fx * 2 - now / 1600);
      const tw = 0.5 + 0.5 * Math.sin(now / (500 + 300 * hash3(seed, i, 53)) + i);
      g.circle(cx + px, cy + py, size * (0.007 + 0.009 * k)).fill({ color: k > 0.7 ? 0xfff1c9 : 0xffd27a, alpha: (0.15 + 0.45 * k) * tw });
    }
    return;
  }
  // Round 30 (designer 2026-11-22): Helix, Radar, Field lines, Constellation (units), Warp, Nebula (sectors).
  if (how === "helix") {
    // Two strands of particles twist round the edge, crossing over and under each other.
    g.poly(edge).stroke({ width: 0.9, color: READY, alpha: 0.22 });
    const n = 34;
    for (let strand = 0; strand < 2; strand++)
      for (let i = 0; i < n; i++) {
        const u = i / n;
        const ph = u * Math.PI * 2 * 5 + now / 520 + strand * Math.PI;
        const out = 1 + 0.075 * Math.sin(ph);
        const depth = Math.cos(ph);
        const at = alongOutline(edge, u + now / 24000);
        const x = cx + (at.x - cx) * out;
        const y = cy + (at.y - cy) * out;
        const front = depth > 0;
        g.circle(x, y, size * (front ? 0.011 + 0.006 * depth : 0.007)).fill({ color: front && depth > 0.7 ? 0xfff1c9 : READY, alpha: front ? 0.45 + 0.5 * depth : 0.18 });
      }
    return;
  }
  if (how === "radar") {
    // A beam sweeps round inside the tile; the edge lights where it passes and fades behind it.
    const a = ((now / 1700) % 1) * Math.PI * 2 - Math.PI / 2;
    g.poly(edge).stroke({ width: 0.9, color: READY, alpha: 0.2 });
    for (let k = 0; k < 7; k++) {
      const b = a - k * 0.07;
      g.moveTo(cx, cy).lineTo(cx + Math.cos(b) * r * 0.86, cy + Math.sin(b) * r * 0.86).stroke({ width: k ? 2.2 : 1.3, color: k ? READY : 0xfff1c9, alpha: k ? 0.16 * (1 - k / 7) : 0.75 });
    }
    const n = 36;
    for (let i = 0; i < n; i++) {
      const pt = alongOutline(edge, i / n);
      const th = Math.atan2(pt.y - cy, pt.x - cx);
      const behind = (((a - th) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const k = Math.exp(-behind / 1.1);
      g.circle(pt.x, pt.y, size * (0.007 + 0.014 * k)).fill({ color: k > 0.7 ? 0xfff6dd : READY, alpha: 0.12 + 0.8 * k });
    }
    // A blip inside, lit as the beam passes it.
    const bt = hash3(seed, Math.floor(now / 1700), 60) * Math.PI * 2;
    const bd = r * (0.3 + 0.35 * hash3(seed, Math.floor(now / 1700), 61));
    const behind = (((a - bt) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const kb = Math.exp(-behind / 1.6);
    g.circle(cx + Math.cos(bt) * bd, cy + Math.sin(bt) * bd, size * 0.04 * kb + 0.5).fill({ color: READY, alpha: 0.3 * kb });
    g.circle(cx + Math.cos(bt) * bd, cy + Math.sin(bt) * bd, size * 0.015).fill({ color: 0xfff6dd, alpha: 0.9 * kb });
    g.circle(cx, cy, size * 0.02).fill({ color: 0xfff1c9, alpha: 0.6 });
    return;
  }
  if (how === "fieldlines") {
    // Particles flow out of the top corner and curve down both sides into the bottom one, as round a magnet.
    g.poly(edge).stroke({ width: 0.9, color: READY, alpha: 0.22 });
    const top = { x: cx, y: cy - r };
    const bot = { x: cx, y: cy + r };
    const k = breath(now, 2400);
    g.circle(top.x, top.y, size * (0.05 + 0.02 * k)).fill({ color: READY, alpha: 0.22 });
    g.circle(bot.x, bot.y, size * (0.05 + 0.02 * (1 - k))).fill({ color: READY, alpha: 0.22 });
    for (let side = -1; side <= 1; side += 2)
      for (let lane = 0; lane < 3; lane++) {
        const bulge = r * (0.5 + 0.38 * lane);
        for (let j = 0; j < 4; j++) {
          const q = (((now / (2000 + 300 * lane) + j / 4 + lane * 0.13 + (side > 0 ? 0.5 : 0)) % 1) + 1) % 1;
          const x = cx + side * bulge * Math.sin(Math.PI * q);
          const y = top.y + (bot.y - top.y) * (0.5 - 0.5 * Math.cos(Math.PI * q));
          const f = Math.sin(Math.PI * q);
          g.circle(x, y, size * (0.007 + 0.009 * f)).fill({ color: f > 0.85 && lane === 0 ? 0xfff1c9 : READY, alpha: (0.25 + 0.6 * f) * (1 - lane * 0.22) });
        }
      }
    return;
  }
  if (how === "constellation") {
    // The six corners are stars joined by faint lines; two sparks run from star to star, each star flaring.
    const stars = [...Array(6).keys()].map((i) => {
      const ang = (Math.PI / 180) * (60 * i - 30);
      return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
    });
    for (let i = 0; i < 6; i++) {
      const a = stars[i]!;
      const b = stars[(i + 1) % 6]!;
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 0.8, color: READY, alpha: 0.22 });
    }
    g.moveTo(stars[0]!.x, stars[0]!.y).lineTo(stars[3]!.x, stars[3]!.y).stroke({ width: 0.6, color: READY, alpha: 0.1 });
    const flare = [0, 0, 0, 0, 0, 0];
    for (let s2 = 0; s2 < 2; s2++) {
      const pos = now / 520 + s2 * 3 + hash3(seed, s2, 62) * 6;
      const i = Math.floor(pos) % 6;
      const f = pos - Math.floor(pos);
      const a = stars[i]!;
      const b = stars[(i + 1) % 6]!;
      flare[(i + 1) % 6] = Math.max(flare[(i + 1) % 6]!, Math.exp(-(((1 - f) / 0.12) ** 2)));
      flare[i] = Math.max(flare[i]!, Math.exp(-((f / 0.2) ** 2)));
      for (let j = 5; j >= 0; j--) {
        const q = Math.max(0, f - j * 0.05);
        g.circle(a.x + (b.x - a.x) * q, a.y + (b.y - a.y) * q, size * (0.008 + 0.012 * (1 - j / 6))).fill({ color: j ? READY : 0xfff6dd, alpha: 0.85 * (1 - j / 6) });
      }
    }
    stars.forEach((p, i) => {
      const tw = 0.55 + 0.45 * Math.sin(now / (330 + 70 * i) + i * 2);
      g.circle(p.x, p.y, size * (0.03 + 0.07 * flare[i]!)).fill({ color: READY, alpha: 0.12 + 0.3 * flare[i]! });
      g.circle(p.x, p.y, size * (0.014 + 0.01 * flare[i]!)).fill({ color: 0xfff6dd, alpha: 0.45 + 0.5 * Math.max(tw * 0.6, flare[i]!) });
    });
    return;
  }
  if (how === "warp") {
    // Stars stream out from the middle of the plate towards its edge, faster as they go, as in a jump.
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.38 });
    g.circle(cx, cy, size * 0.08).fill({ color: 0xffd27a, alpha: 0.12 });
    for (let i = 0; i < 22; i++) {
      const P = 1300 + 900 * hash3(seed, i, 63);
      const t = ((now / P + hash3(seed, i, 64)) % 1 + 1) % 1;
      const ang = hash3(seed, i, 65) * Math.PI * 2;
      const d = r * 0.78 * t * t + r * 0.04;
      const d0 = d * (0.75 - 0.25 * t);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      g.moveTo(cx + ca * d0, cy + sa * d0).lineTo(cx + ca * d, cy + sa * d).stroke({ width: 0.8 + 1.2 * t, color: t > 0.6 ? 0xfff6dd : 0xffd27a, alpha: 0.75 * Math.sin(Math.PI * t) });
    }
    return;
  }
  if (how === "nebula") {
    // Soft clouds of glowing dust churn slowly inside the plate, a few stars twinkling in them.
    g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.38 });
    for (let i = 0; i < 5; i++) {
      const px = Math.sin(now / (3100 + 700 * i) + hash3(seed, i, 66) * 6) * r * 0.32;
      const py = Math.cos(now / (3700 + 500 * i) + hash3(seed, i, 67) * 6) * r * 0.3;
      const col = i % 3 === 2 ? 0xb07cff : i % 2 ? 0xff9a4a : 0xffd27a;
      const pr = r * (0.22 + 0.1 * Math.sin(now / 1900 + i));
      for (let j = 3; j >= 1; j--) g.circle(cx + px, cy + py, pr * (j / 3) + size * 0.03).fill({ color: col, alpha: 0.05 });
    }
    for (let i = 0; i < 7; i++) {
      const px = (hash3(seed, i, 68) - 0.5) * r * 1.1;
      const py = (hash3(seed, i, 69) - 0.5) * r * 1.0;
      const tw = Math.max(0, Math.sin(now / (420 + 160 * hash3(seed, i, 70)) + i * 2)) ** 2;
      g.circle(cx + px, cy + py, size * (0.006 + 0.01 * tw)).fill({ color: 0xfff6dd, alpha: 0.2 + 0.7 * tw });
    }
    return;
  }
  // Haze: fine particles seep out a short way from the whole edge and fade.
  const k = breath(now, 3000);
  g.poly(edge).stroke({ width: 1.2, color: READY, alpha: 0.35 + 0.35 * k });
  for (let i = 0; i < 30; i++) {
    const P = 1800 + 1200 * hash3(seed, i, 26);
    const t0 = now / P + hash3(seed, i, 27);
    const c = Math.floor(t0);
    const t = t0 - c;
    const at = alongOutline(edge, hash3(seed, i, c + 30));
    const d = size * 0.16 * t;
    g.circle(at.x + ((at.x - cx) / r) * d, at.y + ((at.y - cy) / r) * d, size * (0.006 + 0.01 * t)).fill({ color: 0xffd27a, alpha: 0.5 * Math.sin(Math.PI * t) });
  }
}

function badgeText(t: GameState["tiles"][string]["tokens"]): string[] {
  const out: string[] = [];
  if (t.wreck) out.push("WRECK");
  // A ready Alert: a token or a beacon drawn every frame (alertFx.ts, designer 2026-11-09).
  // Strength, Shields, Damage (unitMarks.ts), Barriers and Fuse tokens (tokensFx.ts) are drawn as pieces.
  return out;
}

const breath = (now: number, period: number) => 0.5 - 0.5 * Math.cos(((now % period) / period) * 2 * Math.PI);

interface DragState {
  plan: DragPlan;
  /** The Mecha's own sector (where a cancelled drag returns). */
  home: string;
  /** Where the tether is tied now (home, or the Passive's sector for M_03 / M_06). */
  anchor: string;
  stage: "drag" | "carry" | "settle" | "return";
  /** Piece position (canvas pixels), and where the pointer wants it. */
  x: number;
  y: number;
  wantX: number;
  wantY: number;
  tilt: number;
  touch: boolean;
  snap?: DragTarget | undefined;
  t0: number;
  /** Return: where it started floating back from. */
  fromX?: number;
  fromY?: number;
  /** Settle: the answers sent when it lands. */
  send?: Answer[];
}

/** Plays a sound as a step starts (sound.ts; designer 2026-11-22). */
function withSfx(st: Step, name: string, opts?: { delay?: number; volume?: number }): Step {
  const s0 = st.start;
  const play = () => sfx(name, opts);
  const before = st.sound;
  st.sound = before ? () => (before(), play()) : play;
  st.start = () => {
    play();
    s0?.();
  };
  return st;
}

export function FieldView(p: FieldProps) {
  const host = useRef<HTMLDivElement>(null);
  const app = useRef<Application | null>(null);
  const ready = useRef(false);
  const props = useRef(p);
  props.current = p;
  // Features chosen in the Menu (designer 2026-11-20): the board is drawn again at once.
  const [, bumpFeatures] = useState(0);
  useEffect(() => onFeatures(() => bumpFeatures((x) => x + 1)), []);
  const player = useRef(new Player());
  /** The empty slots under the sectors are hidden while a Gamma kill tilts the board (it draws its own). */
  const hideSlots = useRef(false);
  const slotsRef = useRef<Graphics | undefined>(undefined);
  const layers = useRef<{ under: Container; root: Container; aura: Graphics; edge: Graphics; glow: Graphics; fx: Container; drag: Container; tether: Graphics; piece: Container | undefined; hitText: Text | undefined; celebrate: Container } | undefined>(undefined);
  /** Each sector's container and centre, from the last draw. */
  const nodes = useRef(new Map<string, { node: Container; cx: number; cy: number; arrows?: Container }>());
  const geo = useRef({ size: 40 });
  /** Reduced motion: the Barrier field is drawn still. */
  const stillRef = useRef(false);
  const corona = useRef<PlasmaWave | undefined>(undefined);
  const partner = useRef<EdgePartner | undefined>(undefined);
  const lastState = useRef<GameState | undefined>(undefined);
  const drag = useRef<DragState | undefined>(undefined);
  const press = useRef<{ k: string | undefined; unit: TileId | undefined; x: number; y: number; touch: boolean; held: boolean } | undefined>(undefined);
  const holdTimer = useRef<number | undefined>(undefined);
  const hovered = useRef<string | undefined>(undefined);
  const drawn = useRef<{ state: GameState | undefined; sig: string }>({ state: undefined, sig: "" });
  /** A Mecha dropped on a move target already sits there: its move plays no glide. */
  const dropped = useRef<{ tile: TileId; to: string } | undefined>(undefined);
  /** When each ready Alert was first shown (its token pops in). */
  const alertBorn = useRef(new Map<string, number>());
  /**
   * Frame pacing (designer's report 2026-11-22: lag, and an iPad hot while nothing moves). The Field
   * used to draw itself 60 times a second all the time. Now: full speed while something moves (an
   * animation, a drag, an Overload, a celebration, a moment after any change or press); 30 a second
   * while only slow breathing glows show; 10 a second when nothing on it changes over time.
   */
  const wakeUntil = useRef(0);
  /** Something on the Field plays now (an animation, a drag, a celebration): the game must not rest (idle.ts). */
  const playing = useRef(false);
  const wake = () => {
    wakeUntil.current = performance.now() + 400;
    poke();
    const a = app.current;
    if (a && ready.current) {
      a.ticker.maxFPS = 0;
      if (!a.ticker.started) a.ticker.start();
    }
  };

  useEffect(() => {
    const a = new Application();
    app.current = a;
    let gone = false;
    // Animation settings (build step 5): speed and reduced motion, from the Menu.
    const applyMotion = () => {
      player.current.speed = speedFactor();
      player.current.reduced = isStill();
      stillRef.current = isStill();
    };
    applyMotion();
    const offMotion = onMotion(applyMotion);
    let offRest = () => {};
    const stopResting = startResting(() => playing.current);
    void a.init({ antialias: true, backgroundAlpha: 0, resizeTo: host.current!, autoDensity: true, resolution: window.devicePixelRatio || 1 }).then(() => {
      if (gone) return a.destroy(true);
      host.current!.appendChild(a.canvas);
      const root = new Container();
      root.sortableChildren = true;
      // Under the board, in screen pixels: a Gamma kill draws its tilted board's slots here (designer 2026-11-20).
      const under = new Container();
      under.eventMode = "none";
      const aura = new Graphics();
      aura.eventMode = "none";
      const edge = new Graphics();
      edge.eventMode = "none";
      const glow = new Graphics();
      glow.eventMode = "none";
      const fx = new Container();
      fx.eventMode = "none";
      const dl = new Container();
      dl.eventMode = "none";
      const tether = new Graphics();
      dl.addChild(tether);
      // Coronal waves round the edge during an Overload (designer 2026-11-10).
      // The plasma wave round the Field's edge during an Overload (plasmaFx.ts).
      const plasma = new PlasmaWave();
      corona.current = plasma;
      // Round 30: every Overload edge look but Inflow has its own second part instead (overloadPartner.ts).
      const partnerPart = new EdgePartner();
      partner.current = partnerPart;
      // The mission celebrations draw on top of everything, in screen pixels (designer 2026-11-20).
      const celebrate = new Container();
      celebrate.eventMode = "none";
      a.stage.addChild(under, root, aura, plasma.view, edge, partnerPart.view, glow, fx, dl, celebrate);
      layers.current = { under, root, aura, edge, glow, fx, drag: dl, tether, piece: undefined, hitText: undefined, celebrate };
      ready.current = true;
      draw();
      a.ticker.add(frame);
      // Resting (idle.ts): no touch for a while and nothing playing: draw the Field once more, then stop.
      offRest = onResting((r) => {
        if (!ready.current) return;
        if (r) {
          frame();
          a.render();
          a.ticker.stop();
        } else if (!a.ticker.started) {
          wakeUntil.current = performance.now() + 400;
          a.ticker.maxFPS = 0;
          a.ticker.start();
        }
      });
      new ResizeObserver(() => {
        wake();
        draw();
      }).observe(host.current!);
    });
    // A tap anywhere finishes the animations at once (spec "Timing": Skip); a celebration needs two (designer 2026-11-20).
    const skip = () => {
      wake();
      if (!player.current.busy) return;
      if (!player.current.tap()) return;
      // Put every tile back in place now, and render, before this same tap is matched to a tile.
      frame();
      if (ready.current) app.current?.render();
    };
    document.addEventListener("pointerdown", skip, true);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drag.current && (drag.current.stage === "drag" || drag.current.stage === "carry")) startReturn(false);
    };
    window.addEventListener("keydown", key);
    const move = (e: PointerEvent) => {
      if (drag.current) wake();
      onMove(e);
    };
    const up = (e: PointerEvent) => onUp(e);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      gone = true;
      offMotion();
      offRest();
      stopResting();
      document.removeEventListener("pointerdown", skip, true);
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      player.current.skip();
      if (ready.current) a.destroy(true, { children: true });
      ready.current = false;
    };
  }, []);

  // Two taps on a celebration: everything finishes now.
  const skipped = useRef(p.skipAll);
  useEffect(() => {
    if (p.skipAll === skipped.current) return;
    skipped.current = p.skipAll;
    player.current.skip();
    frame();
    if (ready.current) app.current?.render();
  }, [p.skipAll]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-draw only when what is shown changes: re-drawing in the middle of a tap lost the tap
  // (play-test 2026-11-08: the first tap on a touch screen only showed the hover text).
  useEffect(() => {
    const P = props.current;
    const sig = JSON.stringify([P.choosable, P.selected, P.tones, P.rotate && [P.rotate.tile, P.rotate.facing], P.dark, P.showHidden, features()]);
    if (P.state === drawn.current.state && sig === drawn.current.sig) return;
    drawn.current = { state: P.state, sig };
    draw();
  });

  // ---------------------------------------------------------------------------
  // Pointer (plain browser events, so nothing is lost when the board re-draws).
  // A press on a draggable unit becomes a drag after 8 px (spec "Touch details"); a short
  // press is a tap; on a touch screen, holding 0.5 s shows the card text instead.

  const local = (e: { clientX: number; clientY: number }) => {
    const r = host.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  /** The sector under a point of the Field, if any. */
  const sectorAt = (x: number, y: number): string | undefined => {
    let best: { k: string; d: number } | undefined;
    for (const [k, n] of nodes.current) {
      const d = Math.hypot(n.cx - x, n.cy - y);
      if (d < geo.current.size * 0.92 && (!best || d < best.d)) best = { k, d };
    }
    return best?.k;
  };
  /** The drag target under the pointer: the target sector it is over, else the nearest within one sector. */
  const targetAt = (d: DragState, x: number, y: number): DragTarget | undefined => {
    let best: { t: DragTarget; dist: number } | undefined;
    for (const t of d.plan.targets) {
      const c = centre(t.sector);
      const dist = Math.hypot(c.x - x, c.y - y);
      if (dist < geo.current.size * 1.05 && (!best || dist < best.dist)) best = { t, dist };
    }
    return best?.t;
  };

  function onDown(e: PointerEvent): void {
    wake();
    if (e.pointerType === "mouse") e.preventDefault(); // no text selection from presses on the Field
    const { x, y } = local(e);
    const d = drag.current;
    if (d && d.stage === "carry") {
      // Lifted after the Passive (M_06) or waiting for the sector to move through (M_03):
      // a tap on a lit target does it, anywhere else puts the Mecha back.
      const t = targetAt(d, x, y);
      if (t && sectorAt(x, y) === t.sector) {
        const n = nodes.current.get(t.sector)!;
        d.wantX = d.x = n.cx;
        d.wantY = d.y = n.cy;
        land(t);
      } else startReturn(sectorAt(x, y) !== d.home);
      press.current = undefined;
      return;
    }
    if (d) endDrag(); // a piece still floating back: finish it now (no piece is ever left behind)
    const k = sectorAt(x, y);
    const st = props.current.state;
    const unit = k !== undefined && sectorState(st, k) === "occupied" ? topTileId(st, k) : undefined;
    const touch = e.pointerType !== "mouse";
    press.current = { k, unit, x, y, touch, held: false };
    window.clearTimeout(holdTimer.current);
    if (touch && k !== undefined)
      holdTimer.current = window.setTimeout(() => {
        const pr = press.current;
        if (!pr || drag.current) return;
        pr.held = true;
        props.current.onHover(pr.k, true);
      }, 500);
  }

  function onMove(e: PointerEvent): void {
    if (!host.current) return;
    const { x, y } = local(e);
    const d = drag.current;
    if (d && (d.stage === "drag" || d.stage === "carry")) {
      d.wantX = x;
      d.wantY = y - (d.touch ? 40 : 0);
      if (d.stage === "drag") d.snap = targetAt(d, x, y);
      return;
    }
    const pr = press.current;
    if (!pr) {
      // Mouse hover: the card text of the sector under the pointer.
      if (e.pointerType === "mouse" && e.target instanceof Node && host.current.contains(e.target)) {
        const k = sectorAt(x, y);
        if (k !== hovered.current) {
          hovered.current = k;
          props.current.onHover(k);
        }
      } else if (hovered.current !== undefined) {
        hovered.current = undefined;
        props.current.onHover(undefined);
      }
      return;
    }
    if (pr.held || Math.hypot(x - pr.x, y - pr.y) < 8) return;
    window.clearTimeout(holdTimer.current);
    press.current = undefined;
    const P = props.current;
    if (pr.unit === undefined || !P.dragFor || !P.choosable.units.includes(pr.unit)) return;
    const plan = P.dragFor(pr.unit);
    if (!plan) return;
    player.current.skip();
    endDrag();
    const n = nodes.current.get(plan.from)!;
    drag.current = { plan, home: plan.from, anchor: plan.from, stage: "drag", x: n.cx, y: n.cy, wantX: x, wantY: y - (pr.touch ? 40 : 0), tilt: 0, touch: pr.touch, t0: performance.now() };
    makePiece(plan);
    hovered.current = undefined;
    P.onHover(undefined);
  }

  function onUp(e: PointerEvent): void {
    window.clearTimeout(holdTimer.current);
    const pr = press.current;
    press.current = undefined;
    const d = drag.current;
    if (d && d.stage === "drag") {
      // The drop counts where the pointer is now, however fast it moved.
      const { x, y } = local(e);
      const t = targetAt(d, x, y);
      // Put back where it was taken from: it just goes home, no message (designer 2026-11-21).
      if (!t) return startReturn(sectorAt(x, y) !== d.home);
      if (t.next) {
        const next = t.next();
        if (next && next.targets.length > 0) return carry(d, t.sector, next, t.kind === "attack");
      }
      d.snap = t;
      return land(t);
    }
    if (!pr || e.type === "pointercancel") return;
    if (pr.held) return props.current.onHover(undefined);
    // A tap.
    const { x, y } = local(e);
    if (Math.hypot(x - pr.x, y - pr.y) >= 8 || !(e.target instanceof Node) || !host.current?.contains(e.target)) return;
    const P = props.current;
    if (P.rotate) {
      const size = geo.current.size;
      const rot: { dir: number; x: number; y: number }[] = JSON.parse(host.current.dataset.rotate ?? "[]");
      const b = rot.find((r) => Math.hypot(r.x - x, r.y - y) < Math.max(22, size * 0.2));
      if (b) return P.rotate.onTurn(b.dir as 1 | -1);
    }
    const k = sectorAt(x, y);
    if (k === undefined) return P.onMiss?.();
    if (P.choosable.sectors.includes(k)) return P.onPick(k);
    const unit = sectorState(P.state, k) === "occupied" ? topTileId(P.state, k) : undefined;
    if (unit !== undefined && P.choosable.units.includes(unit)) return P.onPick(unit);
    P.onMiss?.();
  }

  /** Stay lifted over `at` with new targets (M_06 after its Swap; M_03 choosing where to move through). */
  function carry(d: DragState, at: string, next: DragPlan, choosingPath: boolean): void {
    const n = nodes.current.get(at)!;
    d.plan = { ...next, unitId: d.plan.unitId, hit: d.plan.hit, tile: d.plan.tile };
    d.anchor = choosingPath ? d.home : at;
    d.stage = "carry";
    d.snap = undefined;
    d.x = d.wantX = n.cx;
    d.y = d.wantY = n.cy - geo.current.size * 0.25;
    props.current.onNote?.(
      choosingPath
        ? `${d.plan.unitId}: tap the sector it moves to before this Attack (rule 4.2), or anywhere else to put it back.`
        : `${d.plan.unitId}: now tap a red unit to Attack it, or anywhere else to put it back (rule 4.2).`,
      false,
    );
  }

  function land(t: DragTarget): void {
    const d = drag.current!;
    d.stage = "settle";
    d.snap = t;
    d.send = t.answers;
    d.t0 = performance.now();
    if (t.kind === "move" && !t.next && !t.via) dropped.current = { tile: d.plan.tile, to: t.sector };
    else if (t.kind === "attack" && !t.via) dropped.current = { tile: d.plan.tile, to: t.sector };
  }

  function startReturn(explain: boolean): void {
    const d = drag.current;
    if (!d) return;
    d.stage = "return";
    d.fromX = d.x;
    d.fromY = d.y;
    d.snap = undefined;
    d.t0 = performance.now();
    if (explain)
      props.current.onNote?.(`${d.plan.unitId} cannot go there. Drop it on a blue-green sector to move it, or on a red unit to Attack it (rule 4.2).`, true);
  }

  function endDrag(): void {
    drag.current = undefined;
    const L = layers.current;
    if (!L) return;
    L.tether.clear();
    L.piece?.destroy({ children: true });
    L.piece = undefined;
    L.hitText?.destroy();
    L.hitText = undefined;
  }

  function makePiece(plan: DragPlan): void {
    const L = layers.current!;
    const size = geo.current.size;
    const c = new Container();
    const shadow = new Graphics().poly(hexPoints(6, 14, size * 0.9)).fill({ color: 0x000000, alpha: 0.22 });
    shadow.label = "shadow";
    const body = new Graphics().poly(hexPoints(0, 0, size * 0.9)).fill({ color: TYPE_COLOUR.Mecha! }).stroke({ width: 1.5, color: 0xffffff, alpha: 0.85 });
    const crack = new Graphics()
      .moveTo(-size * 0.35, -size * 0.5)
      .lineTo(-size * 0.05, -size * 0.1)
      .lineTo(-size * 0.2, size * 0.1)
      .lineTo(size * 0.25, size * 0.5)
      .stroke({ width: 2, color: 0x3a1a00, alpha: 0.8 });
    crack.label = "crack";
    crack.visible = false;
    const t = new Text({ text: plan.unitId, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(10, size * 0.28), fill: 0x1d1d1f, fontWeight: "700" } });
    t.anchor.set(0.5);
    t.y = -size * 0.1;
    c.addChild(shadow, body, crack, t);
    L.drag.addChild(c);
    L.piece = c;
  }

  // ---------------------------------------------------------------------------
  // Animation steps from engine events (spec "How things look when they happen").

  function ghost(type: string, unitId: string): Container {
    const size = geo.current.size;
    const c = new Container();
    c.addChild(new Graphics().poly(hexPoints(0, 0, size * 0.9)).fill({ color: TYPE_COLOUR[type] ?? 0xcccccc }).stroke({ width: 1.5, color: 0x77736b }));
    const t = new Text({ text: unitId, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(10, size * 0.28), fill: 0x1d1d1f, fontWeight: "700" } });
    t.anchor.set(0.5);
    t.y = -size * 0.1;
    c.addChild(t);
    // Its glyph badge, as on the tile (designer 2026-11-10).
    addGlyphBadge(c, unitId, 0, 0, size);
    return c;
  }
  const centre = (k: string) => {
    const n = nodes.current.get(k);
    return n ? { x: n.cx, y: n.cy } : { x: 0, y: 0 };
  };
  const typeOf = (unitId: string) => props.current.data.units.byId.get(unitId)?.type ?? "Bot";

  /** Fragments flying out from a point, in a unit's colour (shared by Attack and destroyed). */
  function fragments(colour: number): { b: Graphics; a: number; r: number; spin: number }[] {
    const size = geo.current.size;
    return Array.from({ length: 12 }, (_, i) => {
      const b = new Graphics().poly([0, -size * 0.16, size * 0.12, size * 0.1, -size * 0.12, size * 0.1]).fill({ color: i % 3 === 0 ? 0xfff1c4 : colour });
      return { b, a: (i / 12) * Math.PI * 2 + (i % 2) * 0.3, r: 0.7 + ((i * 37) % 10) / 20, spin: (i % 2 ? 1 : -1) * (2 + (i % 3)) };
    });
  }

  /** A Mecha Attack: it charges at the target and bursts there (dropped by hand: it bursts where it was dropped). */
  function burstStep(from: string, to: string, unitId: string, type: string, fromDrop: boolean, stays: boolean): Step {
    const fx = layers.current!.fx;
    const g = ghost(type, unitId);
    const bits = stays ? [] : fragments(TYPE_COLOUR[type] ?? 0xcccccc);
    return {
      ms: fromDrop ? 520 : 760,
      hides: stays ? [] : [from],
      start: () => {
        fx.addChild(g);
        for (const x of bits) fx.addChild(x.b);
      },
      frame: (p, look) => {
        const a = centre(from);
        const b = centre(to);
        const charge = fromDrop ? 1 : easeInOut(Math.min(1, p / 0.45));
        const burst = fromDrop ? Math.min(1, p / 0.9) : Math.max(0, (p - 0.45) / 0.55);
        const reach = fromDrop ? 1 : 0.62;
        const x = a.x + (b.x - a.x) * charge * reach;
        const y = a.y + (b.y - a.y) * charge * reach;
        g.position.set(x, y);
        g.scale.set(1 + 0.08 * Math.sin(Math.PI * Math.min(1, p / 0.45)) - (stays ? 0 : 0.45 * burst));
        g.alpha = stays ? 1 - burst * 0.6 : 1 - burst;
        for (const f of bits) {
          const d = geo.current.size * f.r * easeOut(burst);
          f.b.position.set(x + Math.cos(f.a) * d, y + Math.sin(f.a) * d);
          f.b.rotation = f.spin * burst;
          f.b.alpha = burst === 0 ? 0 : 1 - burst;
        }
        if (!stays) look(from).alpha = easeOut(burst);
        else look(from).alpha = 0;
      },
      end: () => {
        g.destroy({ children: true });
        for (const f of bits) f.b.destroy();
      },
    };
  }

  /**
   * Heat paid back to the Supply: a Heat chip leaves the Heat counter and sinks into the Field (H7:
   * slowly, with a word why). Heat gained: a "+N Heat" chip rises from the Field into the counter.
   * Designer 2026-11-10: below the top bar, so the bar never hides it.
   */
  function heatStep(amount: number, rule: string, gain = false): Step {
    let chip: HTMLDivElement | undefined;
    let a = { x: 0, y: 0 };
    return {
      ms: rule === "H7" && !gain ? 1600 : 900,
      start: () => {
        const el = document.querySelector<HTMLElement>("[data-heat]")?.getBoundingClientRect();
        const r = host.current?.getBoundingClientRect();
        a = el ? { x: el.left + el.width / 2, y: el.bottom + 4 } : { x: (r?.left ?? 0) + (r?.width ?? 0) / 2, y: (r?.top ?? 0) + 8 };
        chip = document.createElement("div");
        chip.className = `heat-fly ${gain ? "gain" : ""}`;
        chip.textContent = gain ? `+${amount} Heat (${rule})` : rule === "H7" ? `−${amount} Heat: Meltdown avoided (H7)` : `−${amount} Heat (${rule})`;
        document.body.appendChild(chip);
        // Kept on screen (a long H7 chip near the right edge).
        const half = chip.offsetWidth / 2 + 6;
        a.x = Math.max(half, Math.min(window.innerWidth - half, a.x));
      },
      frame: (p) => {
        if (!chip) return;
        const d = gain ? 70 * (1 - easeOut(p)) : 70 * easeOut(p);
        chip.style.transform = `translate(calc(${a.x}px - 50%), ${a.y + d}px) scale(${1 + 0.1 * Math.sin(Math.PI * Math.min(1, p * 3))})`;
        chip.style.opacity = String(p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1);
      },
      end: () => chip?.remove(),
    };
  }

  /** H7 Meltdown happens: a card over the Field says why and what follows. */
  function meltdownStep(bots: number): Step {
    let card: HTMLDivElement | undefined;
    return {
      ms: 3200,
      start: () => {
        card = document.createElement("div");
        card.className = "meltdown-card";
        card.innerHTML = `<b>Meltdown</b><span>No Heat token left to prevent it (H7).</span><span>1 damage to every Bot (${bots}), then you gain ${bots} Heat and your Flagship takes ${bots + 1} damage.</span>`;
        host.current?.appendChild(card);
      },
      frame: (p) => {
        if (!card) return;
        card.style.opacity = String(p < 0.1 ? p / 0.1 : p > 0.85 ? (1 - p) / 0.15 : 1);
        card.style.transform = `translate(-50%, -50%) scale(${0.92 + 0.08 * easeOut(Math.min(1, p * 5))})`;
      },
      end: () => card?.remove(),
    };
  }

  /** The board's layers zoomed together (the kill celebration): scale z, then moved by (x, y). */
  function zoomBoard(z: number, x: number, y: number): void {
    const L = layers.current;
    if (!L) return;
    for (const c of [L.root, L.aura, L.glow, L.fx]) {
      c.scale.set(z);
      c.position.set(x, y);
    }
  }
  function badgeTexture(unitId: string): Texture | undefined {
    let tex = badgeTextures.get(unitId);
    if (!tex) {
      const c = glyphBadge(unitId);
      if (!c) return undefined;
      tex = Texture.from(c);
      badgeTextures.set(unitId, tex);
    }
    return tex;
  }

  /** A Salvage milestone's piece on the Field, in the kills' close-up (celebrate/salvageFx.ts). */
  function salvageStep(mark: SalvageMark): Step {
    const L = layers.current!;
    let g: Container | undefined;
    if (mark.kind === "nodes") {
      g = ghost("Flare", "F_01");
      g.visible = false;
      L.fx.addChild(g);
    }
    const step = killStepFor(
      mark.piece.id,
      {
        layer: L.celebrate,
        under: L.under,
        zoom: zoomBoard,
        slots: (on) => {
          hideSlots.current = !on;
          const sl = slotsRef.current;
          if (sl && !sl.destroyed) sl.visible = on;
        },
        centres: () => [...nodes.current].map(([k, n]) => [k, n.cx, n.cy] as const),
        node: () => nodes.current.get(mark.sector),
        size: () => geo.current.size,
        field: () => ({ w: host.current?.clientWidth ?? 0, h: host.current?.clientHeight ?? 0 }),
        badge: badgeTexture,
        ghost: g,
        onPlay: (on) => props.current.onCelebrate?.(on),
      },
      { sector: mark.sector, unitId: "F_01", wreck: false, onBoard: false, name: mark.kind, count: mark.kind === "nodes" ? SALVAGE_NODES : SALVAGE_CLEARED, others: mark.others },
    );
    const end = step.end;
    return { ...step, end: () => (end(), g?.destroy({ children: true })) };
  }

  function stepsFor(events: GameEvent[], s: GameState, before?: GameState): Step[] {
    const fx = layers.current!.fx;
    const size = () => geo.current.size;
    const isTop = (k: string, id: TileId) => topTileId(s, k) === id && sectorState(s, k) === "occupied";
    const out: Step[] = [];
    /**
     * Units destroyed in these events are already gone from the board shown, so each stays drawn as a
     * stand-in from the first step until its own burst (designer 2026-11-09: no moment with no unit).
     * Not for units that appear or move in these events (their own steps show them).
     */
    const standIns = new Map<TileId, Container>();
    // The kill celebration (designer 2026-11-20): the destroyed event that reaches the Eliminate objective's number.
    const P0 = props.current;
    const kill = P0.seed !== undefined ? killOf(P0.data, before, events, P0.seed, P0.killPiece) : undefined;
    const killEvent = kill ? events[kill.index] : undefined;
    events.forEach((e, idx) => {
      // A Wreck that also left the Field in these events (both pieces in one answer) gets a stand-in too.
      if (e.kind !== "destroyed" || (e.wreck && e !== killEvent) || isTop(e.sector, e.tile) || standIns.has(e.tile)) return;
      const shown = events
        .slice(0, idx)
        .some((x) => ((x.kind === "revealed" || x.kind === "moved" || x.kind === "attack") && x.tile === e.tile) || (x.kind === "swapped" && (x.a === e.tile || x.b === e.tile)));
      if (shown) return;
      const g = ghost(e.type, e.unitId);
      const c = centre(e.sector);
      g.position.set(c.x, c.y);
      fx.addChild(g);
      standIns.set(e.tile, g);
    });
    const dropStandIn = (t: TileId) => {
      standIns.get(t)?.destroy({ children: true });
      standIns.delete(t);
    };
    function killStep(e: GameEvent & { kind: "destroyed" }): Step {
      const L = layers.current!;
      // Still on the board at the end of these events (a Wreck), or drawn as a stand-in.
      const onBoard = isTop(e.sector, e.tile);
      const ghost = onBoard ? undefined : (standIns.get(e.tile) ?? ghost0(e.type, e.unitId));
      standIns.delete(e.tile);
      return killStepFor(
        kill!.piece.id,
        {
          layer: L.celebrate,
          under: L.under,
          zoom: zoomBoard,
          slots: (on) => {
            hideSlots.current = !on;
            const sl = slotsRef.current;
            if (sl && !sl.destroyed) sl.visible = on;
          },
          centres: () => [...nodes.current].map(([k, n]) => [k, n.cx, n.cy] as const),
          node: () => nodes.current.get(e.sector),
          size: () => geo.current.size,
          field: () => ({ w: host.current?.clientWidth ?? 0, h: host.current?.clientHeight ?? 0 }),
          badge: badgeTexture,
          ghost,
          onPlay: (on) => props.current.onCelebrate?.(on),
        },
        { sector: e.sector, unitId: e.unitId, wreck: e.wreck, onBoard, name: kill!.name, count: kill!.count },
      );
    }
    function ghost0(type: string, unitId: string): Container {
      const g = ghost(type, unitId);
      g.visible = false;
      fx.addChild(g);
      return g;
    }

    /** The tile flips; Flares and Omega units charge up first; then each type's own burst (not Bots). */
    function revealSteps(e: GameEvent & { kind: "revealed" }): Step[] {
      const real = isTop(e.sector, e.tile);
      const back = new Graphics().poly(hexPoints(0, 0, size() * 0.9)).fill({ color: 0x4a6280 });
      const g = real ? undefined : ghost(e.type, e.unitId);
      const flash = new Graphics().poly(hexPoints(0, 0, size() * 0.9)).fill({ color: 0xffffff });
      const big = BIG_REVEAL.has(e.type);
      const charge = big ? new Graphics() : undefined;
      // Share of the step spent charging (big reveals only).
      const pre = big ? 0.45 : 0;
      const flip: Step = {
        ms: 450 / (1 - pre),
        hides: [e.sector],
        start: () => {
          fx.addChild(back);
          if (g) fx.addChild(g);
          fx.addChild(flash);
          if (charge) fx.addChild(charge);
        },
        frame: (p0, look) => {
          const c = centre(e.sector);
          if (p0 < pre) {
            const shake = chargeLook(charge!, e.type, c.x, c.y, size(), p0 / pre);
            back.position.set(c.x + shake, c.y);
            back.visible = true;
            back.scale.set(1);
            if (g) g.visible = false;
            else look(e.sector).alpha = 0;
            flash.alpha = 0;
            return;
          }
          charge?.clear();
          const p = (p0 - pre) / (1 - pre);
          const lift = 1 + 0.07 * Math.sin(Math.PI * p);
          for (const x of [back, flash, g]) x?.position.set(c.x, c.y);
          back.visible = p < 0.5;
          back.scale.set(Math.max(0.001, 1 - 2 * p) * lift, lift);
          const sx = p < 0.5 ? 0 : 2 * p - 1;
          if (g) {
            g.visible = p >= 0.5;
            g.scale.set(Math.max(0.001, sx) * lift, lift);
          } else {
            const L = look(e.sector);
            L.alpha = p < 0.5 ? 0 : 1;
            L.scaleX = Math.max(0.001, sx);
            L.scale = lift;
          }
          flash.alpha = p > 0.8 ? (1 - p) * 2.5 : 0;
        },
        end: () => {
          back.destroy();
          flash.destroy();
          charge?.destroy();
          g?.destroy({ children: true });
        },
      };
      const burst = revealFxStep(e.type, e.sector, { fx, centre, size, keys: () => [...nodes.current.keys()], host: () => host.current });
      withSfx(flip, e.type === "Omega" ? "reveal-omega" : "reveal");
      return burst ? [flip, burst] : [flip];
    }

    /** A hit lands: the tile shakes, a flash and the damage number (a Barrier: its field shatters). */
    function hitStep(e: GameEvent & { kind: "hit" }, quick = false): Step {
      return withSfx(hitLook(e, quick), e.stopped || (e.damage === 0 && e.shields > 0) ? "shield-block" : "hit");
    }
    function hitLook(e: GameEvent & { kind: "hit" }, quick: boolean): Step {
      const real = isTop(e.sector, e.tile);
      const kept = standIns.get(e.tile);
      const g = real ? undefined : (kept ?? ghost(e.type, e.unitId));
      const flash = new Graphics().poly(hexPoints(0, 0, size() * 0.9)).fill({ color: e.stopped ? 0x9fe3ff : 0xffffff });
      const label = e.stopped ? "Barrier" : `−${e.amount}`;
      const num = new Text({ text: label, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(14, size() * 0.42), fill: e.stopped ? 0x9fd3ff : 0xffffff, fontWeight: "800", stroke: { color: e.stopped ? 0x1d4e7a : 0x9b1c1c, width: 4 } } });
      num.anchor.set(0.5);
      const shards = e.stopped ? new Graphics() : undefined;
      return {
        ms: quick ? 380 : e.stopped ? 620 : 480,
        start: () => {
          if (g && !kept) fx.addChild(g);
          fx.addChild(flash, num);
          if (shards) fx.addChild(shards);
        },
        frame: (p, look) => {
          const c = centre(e.sector);
          const shake = Math.sin(p * 46) * (1 - p) * size() * 0.07;
          if (g) g.position.set(c.x + shake, c.y);
          else look(e.sector).dx = shake;
          flash.position.set(c.x + shake, c.y);
          flash.alpha = (1 - p) ** 2 * 0.75;
          num.position.set(c.x, c.y - size() * (0.15 + 0.55 * easeOut(p)));
          num.alpha = 1 - p ** 3;
          if (shards) {
            // The Barrier's force field flares up and breaks into pieces.
            shards.clear();
            const R = size() * (0.98 + 0.25 * easeOut(Math.min(1, p * 3)));
            shards.circle(c.x, c.y, R).stroke({ width: 4 * (1 - p) + 0.5, color: 0xbff0ff, alpha: Math.max(0, 1 - p * 2.2) });
            for (let i = 0; i < 12; i++) {
              const a = (i / 12) * Math.PI * 2 + 0.2;
              const d = R + size() * 0.9 * easeOut(p);
              const x = c.x + Math.cos(a) * d;
              const y = c.y + Math.sin(a) * d + p * p * size() * 0.4;
              const w = size() * 0.1;
              shards.poly([x, y - w, x + w * 0.7, y + w * 0.5, x - w * 0.7, y + w * 0.5]).fill({ color: 0x9fe3ff, alpha: 1 - p });
            }
          }
        },
        end: () => {
          flash.destroy();
          num.destroy();
          shards?.destroy();
          if (kept) {
            // Back in place for the steps that follow.
            const c = centre(e.sector);
            if (!kept.destroyed) kept.position.set(c.x, c.y);
          } else g?.destroy({ children: true });
        },
      };
    }

    /**
     * A unit acts (designer 2026-11-09): a Sleeper's rune circle and light column; a drained Gyro
     * spins up, its energy spirals in and shoots away, and (discarded) it fades out.
     */
    function activatedStep(e: GameEvent & { kind: "activated" }): Step | undefined {
      const drain = e.type === "Gyro" && e.how === "drain";
      if (e.type !== "Sleeper" && !drain) return undefined;
      const fxg = new Graphics();
      const real = isTop(e.sector, e.tile);
      const g = drain && !real ? ghost(e.type, e.unitId) : undefined;
      return {
        ms: drain ? 950 : 750,
        start: () => {
          if (g) fx.addChild(g);
          fx.addChild(fxg);
        },
        frame: (p, look) => {
          const c = centre(e.sector);
          fxg.clear();
          if (drain) {
            gyroDrain(fxg, c.x, c.y, size(), p);
            const spin = easeInOut(Math.min(1, p / 0.7)) * Math.PI * 2;
            if (g) {
              g.position.set(c.x, c.y);
              g.rotation = spin;
              g.scale.set(1 - 0.6 * Math.max(0, (p - 0.55) / 0.45));
              g.alpha = 1 - Math.max(0, (p - 0.6) / 0.4);
            } else look(e.sector).scale = 1 + 0.08 * Math.sin(Math.PI * p);
          } else {
            sleeperActivate(fxg, c.x, c.y, size(), p);
            look(e.sector).scale = 1 + 0.06 * Math.sin(Math.PI * Math.min(1, p * 2));
          }
        },
        end: () => {
          fxg.destroy();
          g?.destroy({ children: true });
        },
      };
    }

    /** A unit is destroyed: it cracks and bursts (a Wreck: dimmed and stamped). */
    function destroyStep(e: GameEvent & { kind: "destroyed" }): Step {
      return withSfx(destroyLook(e), "destroyed", e.wreck ? { volume: 0.6 } : {});
    }
    function destroyLook(e: GameEvent & { kind: "destroyed" }): Step {
      if (e.wreck) {
        const dim = new Graphics().poly(hexPoints(0, 0, size() * 0.9)).fill({ color: 0x1d1d1f });
        const stamp = new Text({ text: "WRECK", style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(12, size() * 0.3), fill: 0xffffff, fontWeight: "900", stroke: { color: 0x9b1c1c, width: 4 } } });
        stamp.anchor.set(0.5);
        const smoke = new Graphics();
        return {
          ms: 500,
          start: () => fx.addChild(dim, smoke, stamp),
          frame: (p) => {
            const c = centre(e.sector);
            dim.position.set(c.x, c.y);
            dim.alpha = Math.sin(Math.PI * p) * 0.55;
            stamp.position.set(c.x, c.y);
            stamp.scale.set(1.8 - 0.8 * easeOut(Math.min(1, p * 1.6)));
            stamp.alpha = Math.min(1, p * 2) * (1 - Math.max(0, p - 0.7) / 0.3);
            // Smoke wisps rise from it (build step 5).
            smoke.clear();
            for (let i = 0; i < 5; i++) {
              const q = Math.min(1, Math.max(0, p * 1.3 - i * 0.07));
              const x = c.x + (i - 2) * size() * 0.18 + Math.sin(q * 5 + i) * size() * 0.06;
              const y = c.y - size() * (0.1 + 0.9 * q);
              smoke.circle(x, y, size() * (0.08 + 0.12 * q)).fill({ color: 0x8a8a8a, alpha: 0.45 * Math.sin(Math.PI * q) });
            }
          },
          end: () => {
            dim.destroy();
            smoke.destroy();
            stamp.destroy();
          },
        };
      }
      const g = ghost(e.type, e.unitId);
      const bits = fragments(TYPE_COLOUR[e.type] ?? 0xcccccc);
      // A Gyro's rings break and fly apart (designer 2026-11-09).
      const rings = e.type === "Gyro" ? new Graphics() : undefined;
      return {
        ms: rings ? 900 : 700,
        hides: [e.sector],
        start: () => {
          dropStandIn(e.tile);
          fx.addChild(g);
          for (const x of bits) fx.addChild(x.b);
          if (rings) fx.addChild(rings);
        },
        frame: (p, look) => {
          const c = centre(e.sector);
          if (rings) {
            rings.clear();
            gyroBreak(rings, c.x, c.y, size(), Math.max(0, (p - 0.15) / 0.85));
          }
          const crack = Math.min(1, p / 0.25);
          const burst = Math.max(0, (p - 0.2) / 0.8);
          g.position.set(c.x + Math.sin(p * 60) * (1 - crack) * size() * 0.03, c.y);
          g.scale.set(1 + 0.05 * crack - 0.4 * burst);
          g.alpha = 1 - burst;
          for (const x of bits) {
            const d = size() * x.r * easeOut(burst);
            x.b.position.set(c.x + Math.cos(x.a) * d, c.y + Math.sin(x.a) * d);
            x.b.rotation = x.spin * burst;
            x.b.alpha = burst === 0 ? 0 : 1 - burst;
          }
          look(e.sector).alpha = easeOut(burst);
        },
        end: () => {
          dropStandIn(e.tile);
          g.destroy({ children: true });
          for (const x of bits) x.b.destroy();
          rings?.destroy();
        },
      };
    }
    /** Mecha whose destruction was already shown with their Attack (designer 2026-11-08: Mecha first, then the hit). */
    const attacked = new Set<TileId>();
    /** The Bay, Order or Module whose effect is playing (its hits, moves and looks start from it). */
    let src: Source | undefined;
    // Used in an earlier answer (a Bay asks for its target after it is used): the last "used" before these events.
    {
      const first = events[0]?.seq ?? Infinity;
      const prev = [...(s.events ?? [])].reverse().find((x) => x.seq < first && x.kind === "used");
      if (prev && prev.kind === "used") src = { what: prev.what, rule: prev.rule, bay: prev.bay, module: prev.module, colour: prev.colour };
    }
    const onPage = (k: string) => () => {
      const r = host.current?.getBoundingClientRect();
      if (!r || !nodes.current.has(k)) return undefined;
      const c0 = centre(k);
      return { x: r.left + c0.x, y: r.top + c0.y, size: size() };
    };
    const from = (rule: string | undefined) => (src && rule === src.rule ? src : undefined);
    const pagePt = (k: string | undefined) => (k ? onPage(k)() : undefined);
    /** Heat Wave's "−1 Heat" chip, played together with its ray. */
    let heatChip: Step | undefined;

    /** Where a unit is now (or was last seen in the events), by its id. */
    const whereIs = (unitId: string): string | undefined => {
      for (const k of sectorKeys(s)) {
        const t = topTileId(s, k);
        if (t && sectorState(s, k) === "occupied" && tile(s, t).unitId === unitId) return k;
      }
      const all = s.events ?? [];
      for (let j = all.length - 1; j >= 0; j--) {
        const x = all[j]!;
        if (!("unitId" in x) || x.unitId !== unitId) continue;
        if (x.kind === "moved") return x.to;
        if (x.kind === "attack") return x.from;
        if ("sector" in x) return x.sector;
      }
      return undefined;
    };
    /** The unit whose own effect a rule names (S_01, M_07, a Mecha upgrade V1_M03_U2 = M_03...). */
    const unitOfRule = (rule: string | undefined): { look: ShotLook; colour: string; sector: string } | undefined => {
      if (!rule) return undefined;
      const up = /^V\d_M(\d\d)_/.exec(rule);
      const id = up ? `M_${up[1]}` : /^[A-Z]_\d+$/.test(rule) ? rule : undefined;
      if (!id) return undefined;
      const type = props.current.data.units.byId.get(id)?.type;
      const sector = whereIs(id);
      const look = type ? UNIT_SHOT[type] : undefined;
      return look && sector ? { ...look, sector } : undefined;
    };
    /** The last Fuse token to go off up to event i (a Mortar's hit comes an answer later). */
    const lastFuse = (i: number) => {
      for (let j = i; j >= 0; j--) {
        const x = events[j]!;
        if (x.kind === "fuse") return x;
      }
      const first = events[0]?.seq ?? Infinity;
      const prev = [...(s.events ?? [])].reverse().find((x) => x.seq < first && x.kind === "fuse");
      return prev?.kind === "fuse" ? prev : undefined;
    };
    const heatBar = (t: Target) => edgeOf(document.querySelector("[data-heat]"), t);
    /** From high above the target: the shells of a bombing. */
    const sky = (k: number) => (t: Target) => ({ x: t.x + t.size * (0.6 + 0.3 * Math.sin(k * 2.3)), y: Math.max(-20, t.y - window.innerHeight * 0.55) });
    const BOMB: Record<string, string> = { bay: "#7af4ff", order: "#ffb347", Yellow: "#f2c230", Red: "#ff4d3d", Blue: "#3d8bff" };

    /** While shots fly, units they will destroy (already gone from the board) stay shown where they are. */
    function holding(step: Step, hits: (GameEvent & { kind: "hit" })[]): Step {
      const gone = hits.filter((h) => !isTop(h.sector, h.tile) && !standIns.has(h.tile));
      if (!gone.length) return step;
      const ghosts = gone.map((h) => ({ h, g: ghost(h.type, h.unitId) }));
      const hold: Step = {
        ms: step.ms,
        start: () => ghosts.forEach((x) => fx.addChild(x.g)),
        frame: () => ghosts.forEach((x) => x.g.position.set(centre(x.h.sector).x, centre(x.h.sector).y)),
        end: () => ghosts.forEach((x) => x.g.destroy({ children: true })),
      };
      return parallel([hold, step]);
    }

    /** The shot before a single hit, by what dealt it (designer 2026-11-09: each source its own look). */
    function oneShot(e: GameEvent & { kind: "hit" }): Step | undefined {
      const to = onPage(e.sector);
      const used = from(e.rule);
      if (used) return withSfx(weaponStep(used, "hit", to), "laser");
      if (e.rule === "H5") {
        const ray = shotStep("heat", "#ff7a2f", heatBar, to);
        const chip = heatChip;
        heatChip = undefined;
        return chip ? parallel([chip, ray]) : ray;
      }
      if (e.rule === "H7") return shotStep("bomb", "#ff6a2a", sky(0), to);
      if (e.rule === "6.6") {
        const f = lastFuse(events.indexOf(e));
        if (f?.fuse === "mortar") return shotStep("lob", "#ff4a3a", () => pagePt(f.sector), to);
        return shotStep("fuse", "#ff3b2f", (t) => t, to);
      }
      const u = unitOfRule(e.rule);
      if (u && u.sector !== e.sector) return shotStep(u.look, u.colour, () => pagePt(u.sector), to);
      return undefined;
    }

    /** One of the shots of an effect on "all" units: shells from above for Bays, Orders and Modules; a unit's own look from it. */
    function areaShot(e: GameEvent & { kind: "hit" }, k: number): Step | undefined {
      const to = onPage(e.sector);
      const used = from(e.rule);
      if (used) {
        const colour = BOMB[used.what === "module" ? (used.colour ?? "") : used.what] ?? "#ffffff";
        return withSfx(shotStep("bomb", used.rule === "V1_BAY1" ? "#ff5a5a" : colour, sky(k), to, k === 0 ? { onStart: () => fireGlow(used) } : {}), "laser");
      }
      if (e.rule === "H7") return shotStep("bomb", "#ff6a2a", sky(k), to);
      const u = unitOfRule(e.rule);
      if (u && u.sector !== e.sector) return shotStep(u.look, u.colour, () => pagePt(u.sector), to, { seed: k * 7 + 1 });
      return undefined;
    }

    /** Damage coming at your Flagship (5.2): a shot from its source to the Flagship panel, which shakes. */
    function flagshipShot(rule: string, i: number): Step {
      const panel = () => document.querySelector<HTMLElement>(".flagship");
      const to = (): Target | undefined => {
        const r = panel()?.getBoundingClientRect();
        return r && r.width > 0 ? { x: r.left + r.width / 2, y: r.top + r.height / 2, size: Math.max(20, Math.min(r.width, r.height) / 3) } : undefined;
      };
      const shake = () => {
        sfx("flagship-hit");
        const el = panel();
        if (!el) return;
        el.classList.remove("fx-shake");
        void el.offsetWidth;
        el.classList.add("fx-shake");
        window.setTimeout(() => el.classList.remove("fx-shake"), 600);
      };
      const f = rule === "6.6" ? lastFuse(i) : undefined;
      if (f) return shotStep("void", "#ff3b3b", () => pagePt(f.sector), to, { onHit: shake });
      if (rule === "H7") return shotStep("heat", "#ff7a2f", heatBar, to, { onHit: shake });
      const u = unitOfRule(rule);
      if (u) return shotStep(u.look, u.colour, () => pagePt(u.sector), to, { onHit: shake });
      return { ms: 300, start: shake, frame: () => {}, end: () => {} };
    }
    const env = { fx, centre, size, keys: () => [...nodes.current.keys()], host: () => host.current };
    /** A Mecha lands after moving (round 28): a small puff of dust that plays by itself. */
    const dust = (unitId: string, k: string) => {
      if (typeOf(unitId) === "Mecha") sfx("mecha-land");
      const a = app.current;
      if (!a || stillRef.current || speedFactor() === 0 || typeOf(unitId) !== "Mecha") return;
      landingDust(env, k, (f) => (a.ticker.add(f), () => a.ticker.remove(f)), speedFactor());
    };
    let sfxNext: string | undefined;
    for (let i = 0; i < events.length; i++) {
      if (sfxNext && out.length) withSfx(out[out.length - 1]!, sfxNext);
      sfxNext = undefined;
      const e = events[i]!;
      if (e.kind === "used") {
        const used: Source = { what: e.what, rule: e.rule, bay: e.bay, module: e.module, colour: e.colour };
        src = used;
        // The Bay, Order or Module glows as it fires.
        out.push({ ms: 160, start: () => fireGlow(used), frame: () => {}, end: () => {} });
        continue;
      }
      // Effects on "all" units (designer 2026-11-09): every target is shot at once, every hit lands
      // at once, then every unit destroyed bursts at once ("field bombing"), instead of one by one.
      if (e.kind === "hit") {
        const hits: (GameEvent & { kind: "hit" })[] = [];
        const gone: (GameEvent & { kind: "destroyed" })[] = [];
        const struck = new Set<TileId>();
        let j = i;
        for (; j < events.length; j++) {
          const n = events[j]!;
          if (n.kind === "hit" && n.rule === e.rule) {
            hits.push(n);
            struck.add(n.tile);
          } else if (n.kind === "destroyed" && struck.has(n.tile)) gone.push(n);
          else break;
        }
        // Exposure (9.3 step 2, designer 2026-11-22, round 28): energy between End the Overload and every
        // unit alone on its plate, in the look chosen (exposureFx.ts), then the hits as usual.
        if (e.rule === "9.3") {
          const look = features().exposure;
          out.push(
            holding(
              exposureStep(
                look,
                () => (Number.isFinite(endOverloadAt.x) ? endOverloadAt : undefined),
                () => hits.map((h) => onPage(h.sector)()).filter((t): t is Target => t !== undefined),
                hits.length,
              ),
              hits,
            ),
          );
        }
        if (hits.length >= 2) {
          i = j - 1;
          const shots = hits.map((h, k) => areaShot(h, k)).filter((x): x is Step => x !== undefined);
          if (shots.length) out.push(holding(parallel(shots, 40), hits));
          out.push(parallel(hits.map((h) => hitStep(h, true))));
          const bursts = gone.filter((d) => d !== killEvent && !(attacked.has(d.tile) && !d.wreck)).map((d) => destroyStep(d));
          if (bursts.length) out.push(parallel(bursts, 30));
          // The deciding kill gets its celebration after the others burst together.
          const decider = gone.find((d) => d === killEvent);
          if (decider) out.push(killStep(decider));
          continue;
        }
        // Weapon and aura looks (build step 3): the shot comes first.
        const shot = oneShot(e);
        if (shot) out.push(holding(shot, [e]));
      }
      if (e.kind === "activated") {
        const step = activatedStep(e);
        if (step) out.push(step);
        continue;
      }
      if (e.kind === "fuse" && e.fuse !== "tick") {
        // A Mortar or Feedback token blows on its unit (a Tick's blast plays with its hit).
        out.push(shotStep("fuse", "#ff3b2f", (t) => t, onPage(e.sector)));
        continue;
      }
      if (e.kind === "flagship") {
        out.push(flagshipShot(e.rule, i));
        continue;
      }
      // Build step 5: turns, tokens, uncovered tiles, Overload start and end, Overhaul.
      if (e.kind === "turned") {
        out.push(turnStep(e, isTop(e.sector, e.tile)));
        continue;
      }
      if (e.kind === "tokens") {
        // The same change by one effect on several units plays together, like the "all" hits.
        const group: (GameEvent & { kind: "tokens" })[] = [e];
        let j = i + 1;
        for (; j < events.length; j++) {
          const n = events[j]!;
          if (n.kind === "tokens" && n.rule === e.rule && n.change === e.change && n.boost === e.boost) group.push(n);
          else break;
        }
        i = j - 1;
        const steps = group.map((t) => tokenStep(t, env));
        if (e.change === "shield" || e.change === "bioShield" || e.change === "repair") withSfx(steps[0]!, "shield-up");
        out.push(steps.length > 1 ? parallel(steps, 40) : steps[0]!);
        continue;
      }
      if (e.kind === "uncovered") {
        out.push(uncoverStep(e, env));
        continue;
      }
      if (e.kind === "dropped") {
        out.push(withSfx(dropStep(e, env), "ally-drop"));
        continue;
      }
      if (e.kind === "overload") {
        const step = withSfx(overloadStep(e.how, env), e.how === "start" ? "overload-start" : "overload-end");
        if (e.how === "start") {
          // Then the Alert tokens drop on one by one.
          const end = step.end;
          step.end = () => {
            end();
            const t = performance.now();
            let n = 0;
            for (const [id, born] of alertBorn.current) if (born > t + 50000) alertBorn.current.set(id, t + 90 * n++);
          };
        }
        out.push(step);
        continue;
      }
      if (e.kind === "overhaul") {
        out.push(overhaulStep());
        continue;
      }
      if (e.kind === "fizzled") {
        out.push(fizzleStep(e, env));
        continue;
      }
      if ((e.kind === "moved" || e.kind === "swapped") && from(e.rule)) out.push(weaponStep(src!, "move", onPage(e.from)));
      if (e.kind === "looked" && from(e.rule)) {
        const k = e.tiles.find((t) => t.sector)?.sector;
        if (k) out.push(weaponStep(src!, "look", onPage(k)));
      }
      if (e.kind === "destroyed" && attacked.has(e.tile) && !e.wreck) continue;
      // A walk (M_01 moving several times in a row, designer 2026-11-08): one step along its path.
      if (e.kind === "moved" && e.how === "move") {
        const path = [e.from, e.to];
        let j = i + 1;
        for (; j < events.length; j++) {
          const n = events[j]!;
          if (n.kind !== "moved" || n.tile !== e.tile || n.how !== "move" || n.from !== path[path.length - 1]) break;
          path.push(n.to);
        }
        if (path.length > 2) {
          i = j - 1;
          const last = path[path.length - 1]!;
          const real = isTop(last, e.tile);
          const g = real ? undefined : ghost(typeOf(e.unitId), e.unitId);
          const legs = path.length - 1;
          sfxNext = "move";
          out.push({
            ms: 330 * legs,
            hides: real ? [last] : [],
            start: () => g && fx.addChild(g),
            frame: (p, look) => {
              const at = Math.min(legs - 1e-6, p * legs);
              const leg = Math.floor(at);
              const q = easeInOut(at - leg);
              const a2 = centre(path[leg]!);
              const b2 = centre(path[leg + 1]!);
              const end = centre(last);
              const x = a2.x + (b2.x - a2.x) * q;
              const y = a2.y + (b2.y - a2.y) * q;
              const lift = 1 + 0.08 * Math.sin(Math.PI * q);
              if (g) {
                g.position.set(x, y);
                g.scale.set(lift);
              } else {
                const L = look(last);
                L.dx = x - end.x;
                L.dy = y - end.y;
                L.scale = lift;
                L.z = 1000; // on top of every sector it passes (designer 2026-11-21)
              }
            },
            end: () => (g?.destroy({ children: true }), dust(e.unitId, last)),
          });
          continue;
        }
      }
      if (e.kind === "attack") {
        const now = sectorOf(s, e.tile);
        const stays = now !== undefined && isTop(now, e.tile); // a Mecha that becomes a Wreck stays
        if (!stays) attacked.add(e.tile);
        const dr = dropped.current;
        const fromDrop = dr !== undefined && dr.tile === e.tile && dr.to === e.to;
        if (fromDrop) dropped.current = undefined;
        out.push(withSfx(burstStep(e.from, e.to, e.unitId, "Mecha", fromDrop, stays), "mecha-attack"));
        continue;
      }
      if (e.kind === "heat") {
        // Heat Wave (designer 2026-11-09: the beam at once): its "−1 Heat" chip floats up while the ray flies.
        if (e.rule === "H5" && events.slice(i + 1).some((x) => x.kind === "hit" && x.rule === "H5")) {
          heatChip = heatStep(e.amount, e.rule);
          continue;
        }
        out.push(heatStep(e.amount, e.rule, e.gain));
        continue;
      }
      if (e.kind === "meltdown") {
        out.push(meltdownStep(e.bots));
        continue;
      }
      if (e.kind === "moved") {
        const real = isTop(e.to, e.tile);
        const dr = dropped.current;
        if (dr && dr.tile === e.tile && dr.to === e.to) {
          // Dropped there by hand: just a small settle.
          dropped.current = undefined;
          out.push({ ms: 180, start: () => dust(e.unitId, e.to), frame: (p, look) => real && (look(e.to).scale = 1 + 0.06 * Math.sin(Math.PI * p)), end: () => {} });
          continue;
        }
        const g = real ? undefined : ghost(typeOf(e.unitId), e.unitId);
        const a = centre(e.from);
        const b = centre(e.to);
        const sectors = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / (Math.sqrt(3) * size())));
        const tele = e.how === "teleport";
        if (!tele) sfxNext = "move";
        out.push({
          ms: tele ? 400 : 350 * sectors,
          hides: real ? [e.to] : [],
          start: () => g && fx.addChild(g),
          frame: (p, look) => {
            const q = easeInOut(p);
            const a2 = centre(e.from);
            const b2 = centre(e.to);
            const x = tele ? b2.x : a2.x + (b2.x - a2.x) * q;
            const y = tele ? b2.y : a2.y + (b2.y - a2.y) * q;
            const lift = tele ? 0.85 + 0.15 * q : 1 + 0.08 * Math.sin(Math.PI * p);
            if (g) {
              g.position.set(x, y);
              g.scale.set(lift);
              g.alpha = tele ? q : 1;
            } else {
              const L = look(e.to);
              L.dx = x - b2.x;
              L.dy = y - b2.y;
              L.scale = lift;
              L.z = 1000; // on top of every sector it passes (designer 2026-11-21)
              L.alpha = tele ? q : 1;
            }
          },
          end: () => (g?.destroy({ children: true }), tele || dust(e.unitId, e.to)),
        });
      } else if (e.kind === "swapped") {
        sfxNext = "move";
        out.push({
          ms: 500,
          hides: [e.from, e.to],
          frame: (p, look) => {
            const q = easeInOut(p);
            const a = centre(e.from);
            const b = centre(e.to);
            const arc = Math.sin(Math.PI * p) * size() * 0.35;
            // a is now in `to`: it travels from `from`, over; b travels back, under.
            const La = look(e.to);
            La.dx = (a.x - b.x) * (1 - q);
            La.dy = (a.y - b.y) * (1 - q) - arc;
            La.scale = 1 + 0.08 * Math.sin(Math.PI * p);
            const Lb = look(e.from);
            Lb.dx = (b.x - a.x) * (1 - q);
            Lb.dy = (b.y - a.y) * (1 - q) + arc;
            Lb.scale = 1 - 0.06 * Math.sin(Math.PI * p);
          },
          end: () => {},
        });
      } else if (e.kind === "revealed") {
        out.push(...revealSteps(e));
      } else if (e.kind === "hit") {
        out.push(hitStep(e));
      } else if (e.kind === "destroyed") {
        out.push(e === killEvent ? killStep(e) : destroyStep(e));
      } else if (e.kind === "energy") {
        // An energy token flies in an arc to its Module (0.4 s); by itself (one Module only): half speed (I1).
        let dot: HTMLDivElement | undefined;
        let a = { x: 0, y: 0 };
        let b = { x: 0, y: 0 };
        sfxNext = "energy";
        out.push({
          ms: e.auto ? 800 : 400,
          start: () => {
            const r = host.current?.getBoundingClientRect();
            const k = e.from !== undefined ? sectorOf(s, e.from) : undefined;
            const c = k ? centre(k) : { x: (r?.width ?? 0) / 2, y: (r?.height ?? 0) };
            a = { x: (r?.left ?? 0) + c.x, y: (r?.top ?? 0) + c.y };
            const m = document.querySelector<HTMLElement>(`[data-module="${e.module}"]`)?.getBoundingClientRect();
            b = m ? { x: m.left + 18, y: m.top + m.height / 2 } : a;
            dot = document.createElement("div");
            dot.className = "energy-fly";
            dot.style.setProperty("--pop", ENERGY_CSS[e.colour] ?? "#888");
            document.body.appendChild(dot);
          },
          frame: (p) => {
            if (!dot) return;
            const q = easeInOut(p);
            const lift = Math.min(160, Math.hypot(b.x - a.x, b.y - a.y) * 0.35);
            const x = a.x + (b.x - a.x) * q;
            const y = a.y + (b.y - a.y) * q - Math.sin(Math.PI * q) * lift;
            dot.style.transform = `translate(${x - 9}px, ${y - 9}px) scale(${1 + 0.35 * Math.sin(Math.PI * p)})`;
          },
          end: () => {
            dot?.remove();
            const m = document.querySelector<HTMLElement>(`[data-module="${e.module}"]`);
            if (m) {
              m.classList.remove("energy-arrive");
              void m.offsetWidth;
              m.classList.add("energy-arrive");
              m.style.setProperty("--arrive", ENERGY_CSS[e.colour] ?? "#888");
              window.setTimeout(() => m.classList.remove("energy-arrive"), 650);
            }
          },
        });
      }
    }
    if (sfxNext && out.length) withSfx(out[out.length - 1]!, sfxNext);
    // Any stand-in left (its burst not played): gone once everything has played or been skipped.
    if (standIns.size) out.push({ ms: 1, frame: () => {}, end: () => [...standIns.keys()].forEach(dropStandIn) });
    return out;
  }

  // ---------------------------------------------------------------------------
  // Every frame: animations, drag and glows on top of the board as it now is.

  function drawGlow(g: Graphics, cx: number, cy: number, kind: DragKind | "ready", now: number, strong: boolean, unit = true): void {
    const size = geo.current.size;
    if (kind === "ready") {
      drawReady(g, cx, cy, size, now, unit);
      return;
    }
    if (kind === "move") {
      // Calm: a slow breath (1.2 s in, 1.2 s out), chevrons pointing in.
      const k = strong ? 1 : breath(now, 2400);
      g.poly(hexPoints(cx, cy, size * 0.9)).fill({ color: MOVE, alpha: strong ? 0.38 : 0.08 + 0.14 * k });
      g.poly(hexPoints(cx, cy, size * 0.9)).stroke({ width: strong ? 2.5 : 1.5, color: MOVE, alpha: 0.55 + 0.45 * k });
      for (const ang of [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6]) {
        const r = size * (0.62 - 0.05 * k);
        const x = cx + Math.cos(ang) * r;
        const y = cy - Math.sin(ang) * r;
        const ix = -Math.cos(ang);
        const iy = Math.sin(ang);
        const w = size * 0.09;
        g.moveTo(x - iy * w - ix * w * 0.6, y + ix * w - iy * w * 0.6)
          .lineTo(x, y)
          .lineTo(x + iy * w - ix * w * 0.6, y - ix * w - iy * w * 0.6)
          .stroke({ width: 2, color: MOVE, alpha: 0.5 + 0.5 * k });
      }
      return;
    }
    // Attack: faster pulse (0.6 s), four corner brackets of a target sight.
    const k = strong ? 1 : breath(now, 600);
    if (strong) g.poly(hexPoints(cx, cy, size * 0.9)).fill({ color: ATTACK, alpha: 0.22 });
    g.poly(hexPoints(cx, cy, size * 0.9)).stroke({ width: strong ? 2.5 : 1.5, color: ATTACK, alpha: 0.5 + 0.5 * k });
    const h = size * 0.5 * (1 + 0.06 * k);
    const arm = size * 0.17;
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      const x = cx + sx * h;
      const y = cy + sy * h;
      g.moveTo(x - sx * arm, y).lineTo(x, y).lineTo(x, y - sy * arm).stroke({ width: 2.5, color: ATTACK, alpha: 0.6 + 0.4 * k });
    }
  }

  function frame(): void {
    const L = layers.current;
    if (!L || !ready.current) return;
    const now = performance.now();
    const looks = new Map<string, NodeLook>();
    const look = (k: string): NodeLook => {
      let v = looks.get(k);
      if (!v) looks.set(k, (v = { dx: 0, dy: 0, scale: 1, scaleX: 1, alpha: 1, rot: 0 }));
      return v;
    };
    for (const k of player.current.hidden()) look(k).alpha = 0;
    player.current.tick(now, look);
    // The win celebration's shock wave: the units shiver as it passes (designer 2026-11-20).
    const shake = props.current.shake;
    let shook = false;
    if (shake)
      for (const k of nodes.current.keys()) {
        const o = shake(k, now);
        if (!o) continue;
        shook = true;
        const v = look(k);
        v.dx += o.dx;
        v.dy += o.dy;
        // Sector Flip (designer 2026-11-21): a sector lifted (scale), turned (squashed top to bottom), hidden while its underside shows, in front.
        if (o.scale !== undefined) v.scale *= o.scale;
        if (o.sy !== undefined) {
          const c = Math.abs(o.sy) < 0.02 ? (o.sy < 0 ? -0.02 : 0.02) : o.sy;
          v.scale *= c;
          v.scaleX /= c;
        }
        if (o.alpha !== undefined) v.alpha *= o.alpha;
        if (o.z !== undefined) v.z = (v.z ?? 0) + o.z;
      }
    const d = drag.current;
    const size = geo.current.size;
    if (d) {
      const targets = new Set(d.plan.targets.map((t) => t.sector));
      for (const k of nodes.current.keys()) {
        if (k === d.home) look(k).alpha *= 0.28;
        else if (!targets.has(k)) look(k).alpha *= 0.7;
      }
    }
    for (const [k, n] of nodes.current) {
      const v = looks.get(k);
      n.node.position.set(n.cx + (v?.dx ?? 0), n.cy + (v?.dy ?? 0));
      n.node.scale.set((v?.scale ?? 1) * (v?.scaleX ?? 1), v?.scale ?? 1);
      n.node.alpha = v?.alpha ?? 1;
      n.node.rotation = v?.turn ?? 0;
      n.node.zIndex = v?.z ?? 0;
      if (n.arrows) n.arrows.rotation = v?.rot ?? 0;
    }
    host.current?.setAttribute("data-anim", player.current.busy ? "1" : "0");

    // An Overload: a plasma beam swirls round the Field (designer 2026-11-09, instead of a tinted page).
    L.edge.clear();
    if (props.current.state.phase === "overload" && host.current) drawOverloadRing(L.edge, host.current.clientWidth, host.current.clientHeight, stillRef.current ? 0 : now, features().overload);
    const olOn = props.current.state.phase === "overload" && !stillRef.current;
    const olLook = features().overload;
    corona.current?.update(host.current?.clientWidth ?? 0, host.current?.clientHeight ?? 0, now, olOn && olLook === "inflow");
    partner.current?.update(host.current?.clientWidth ?? 0, host.current?.clientHeight ?? 0, now, olOn && olLook !== "inflow", olLook);

    // Barriers: a force field round their unit, following the tile as it moves.
    const au = L.aura;
    au.clear();
    // Something on the Field that changes over time (a breathing glow, a pulsing Alert): see pace below.
    let ambient = false;
    const st = props.current.state;
    for (const [k, n] of nodes.current) {
      if (sectorState(st, k) !== "occupied") continue;
      const top = topTileId(st, k);
      if (!top || !tile(st, top).tokens.barrier) continue;
      const v = looks.get(k);
      ambient = true;
      drawBarrier(au, n.cx + (v?.dx ?? 0), n.cy + (v?.dy ?? 0), size, stillRef.current ? 0 : now, v?.alpha ?? 1, v?.scale ?? 1);
    }
    // Ready Alerts: a token at the bottom corner and a pulsing rim (alertFx.ts).
    const seenNow = new Set<string>();
    for (const [k, n] of nodes.current) {
      if (sectorState(st, k) !== "occupied") continue;
      const top = topTileId(st, k);
      if (!top) continue;
      const tk = tile(st, top).tokens;
      if (!tk.alert) continue;
      seenNow.add(top);
      if (!alertBorn.current.has(top)) alertBorn.current.set(top, player.current.busy ? now + 99999 : now);
      let born = alertBorn.current.get(top)!;
      if (born > now + 50000 && !player.current.busy) alertBorn.current.set(top, (born = now));
      if (born > now) continue; // placed by an animation still playing: shown when it ends
      const v = looks.get(k);
      ambient = true;
      drawAlert(au, n.cx + (v?.dx ?? 0), n.cy + (v?.dy ?? 0), size, stillRef.current ? 0 : now, born, v?.alpha ?? 1, v?.scale ?? 1, tk.wreck);
    }
    for (const id of alertBorn.current.keys()) if (!seenNow.has(id)) alertBorn.current.delete(id);
    // Energy waiting on a Flare: a border of energy sparks round each token (designer 2026-11-16).
    for (const [k, n] of nodes.current) {
      if (sectorState(st, k) !== "occupied") continue;
      const top = topTileId(st, k);
      const t = top ? tile(st, top) : undefined;
      if (!t?.energy) continue;
      const cols = (["Yellow", "Red", "Blue"] as const).flatMap((col) => Array.from({ length: t.energy![col] ?? 0 }, () => col));
      if (!cols.length) continue;
      const v = looks.get(k);
      const spots = flareEnergySpots(n.cx + (v?.dx ?? 0), n.cy + (v?.dy ?? 0), size * (v?.scale ?? 1), cols.length, t.tokens.wreck);
      ambient = true;
      cols.forEach((col, i) => drawEnergyBorder(au, spots.x[i]!, spots.y, spots.r, ENERGY_HEX[col] ?? 0x888888, stillRef.current ? 0 : now, i, v?.alpha ?? 1));
    }

    // Glows: the targets only show once the animations before them are done (spec "Timing").
    const g = L.glow;
    g.clear();
    const P = props.current;
    if (d) {
      for (const t of d.plan.targets) {
        const n = nodes.current.get(t.sector);
        if (n) drawGlow(g, n.cx, n.cy, t.kind, now, d.snap?.sector === t.sector);
      }
    } else if (!player.current.busy) {
      for (const [k, n] of nodes.current) {
        if (!n.node.label.startsWith("choice")) continue;
        ambient = true;
        drawGlow(g, n.cx, n.cy, P.tones?.[k] ?? "ready", now, false, sectorState(P.state, k) === "occupied");
      }
    }
    // A selected Module's targets: a violet rim just outside the hex with marks running round it.
    if (!d && !player.current.busy)
      for (const k of P.affected ?? []) {
        const n = nodes.current.get(k);
        if (!n) continue;
        ambient = true;
        const r = size * 0.97;
        const pts = hexPoints(n.cx, n.cy, r);
        g.poly(pts).stroke({ width: 2, color: AFFECT, alpha: 0.85 });
        const t = (now / 1800) % 1;
        for (let i = 0; i < 6; i++) {
          // A short bright mark sliding along each side.
          const ax = pts[i * 2]!;
          const ay = pts[i * 2 + 1]!;
          const bx = pts[((i + 1) % 6) * 2]!;
          const by = pts[((i + 1) % 6) * 2 + 1]!;
          const p0 = t;
          const p1 = Math.min(1, t + 0.28);
          g.moveTo(ax + (bx - ax) * p0, ay + (by - ay) * p0)
            .lineTo(ax + (bx - ax) * p1, ay + (by - ay) * p1)
            .stroke({ width: 4, color: 0xffffff, alpha: 0.75 });
        }
        g.poly(hexPoints(n.cx, n.cy, size * 0.9)).fill({ color: AFFECT, alpha: 0.1 + 0.08 * breath(now, 1800) });
      }
    if (d) dragFrame(d, now, size);

    // Frame pacing (see wakeUntil).
    const a = app.current;
    if (a) {
      const still = stillRef.current;
      const fast =
        now < wakeUntil.current ||
        player.current.busy ||
        !!d ||
        shook ||
        L.fx.children.length > 0 ||
        L.celebrate.children.length > 0 ||
        L.under.children.length > 0 ||
        (st.phase === "overload" && !still);
      playing.current = player.current.busy || !!d || shook || L.fx.children.length > 0 || L.celebrate.children.length > 0 || L.under.children.length > 0;
      const fps = fast ? 0 : ambient && !still ? 30 : 10;
      if (a.ticker.maxFPS !== fps) a.ticker.maxFPS = fps;
      host.current?.setAttribute("data-pace", String(fps));
    }
  }

  function dragFrame(d: DragState, now: number, size: number): void {
    const L = layers.current!;
    const piece = L.piece;
    if (!piece) return;
    const anchor = centre(d.anchor);
    if (d.stage === "drag" || d.stage === "carry") {
      // The piece follows the pointer exactly; over a target (anywhere on its sector) it sits on its centre.
      const snap = d.stage === "drag" ? d.snap : undefined;
      const tx = snap ? centre(snap.sector).x : d.wantX;
      const ty = snap ? centre(snap.sector).y : d.wantY;
      const vx = tx - d.x;
      d.x += (tx - d.x) * (snap ? 0.6 : 1);
      d.y += (ty - d.y) * (snap ? 0.6 : 1);
      d.tilt += (Math.max(-0.1, Math.min(0.1, vx * 0.004)) - d.tilt) * 0.3;
    } else if (d.stage === "settle") {
      const p = Math.min(1, (now - d.t0) / 150);
      const c = centre(d.snap!.sector);
      d.x += (c.x - d.x) * 0.5;
      d.y += (c.y - d.y) * 0.5;
      d.tilt *= 0.5;
      if (p >= 1) {
        const send = d.send!;
        endDrag();
        props.current.onDrop?.(send);
        return;
      }
    } else {
      // Return: float back along the tether in 0.5 s, slowing as it arrives, then a small shake.
      const t = (now - d.t0) / 500;
      const home = centre(d.home);
      const q = easeOut(Math.min(1, t));
      d.x = d.fromX! + (home.x - d.fromX!) * q;
      d.y = d.fromY! + (home.y - d.fromY!) * q;
      d.tilt = t > 1 ? Math.sin((t - 1) * 40) * 0.08 * Math.max(0, 1 - (t - 1) / 0.3) : 0;
      if (t >= 1.3) return endDrag();
    }
    const lifting = Math.min(1, (now - d.t0) / 120);
    const scale = d.stage === "settle" ? 1.1 - 0.1 * Math.min(1, (now - d.t0) / 150) : d.stage === "return" ? 1.1 - 0.1 * easeOut(Math.min(1, (now - d.t0) / 500)) : 1 + 0.1 * (d.stage === "drag" ? lifting : 1);
    piece.position.set(d.x, d.y);
    piece.scale.set(scale);
    piece.rotation = d.tilt;
    const shadow = piece.getChildByLabel("shadow");
    if (shadow) shadow.alpha = d.stage === "settle" ? 0.4 : 1;
    const attack = d.snap?.kind === "attack" && d.stage !== "return";
    const crack = piece.getChildByLabel("crack");
    if (crack) crack.visible = attack;

    // The "−3" the target will take.
    if (attack && d.plan.hit !== undefined) {
      if (!L.hitText) {
        L.hitText = new Text({ text: `−${d.plan.hit}`, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(14, size * 0.4), fill: 0xffffff, fontWeight: "800", stroke: { color: 0x9b1c1c, width: 4 } } });
        L.hitText.anchor.set(0.5);
        L.drag.addChild(L.hitText);
      }
      const c = centre(d.snap!.sector);
      L.hitText.position.set(c.x + size * 0.55, c.y - size * 0.95);
      L.hitText.visible = true;
    } else if (L.hitText) L.hitText.visible = false;

    // The tether: a soft curved line from where it came from, sparks flowing along it.
    const t = L.tether;
    t.clear();
    if (d.stage === "settle" && d.snap?.kind === "move") return;
    const fade = d.stage === "return" ? 1 - Math.min(1, (now - d.t0) / 500) : d.stage === "settle" ? 0.5 : 1;
    const dx = d.x - anchor.x;
    const dy = d.y - anchor.y;
    const len = Math.hypot(dx, dy);
    t.poly(hexPoints(anchor.x, anchor.y, size * 0.9)).stroke({ width: 1.5, color: 0xffffff, alpha: 0.55 * fade });
    if (len < size * 0.3) return;
    const cx = anchor.x + dx / 2 + (-dy / len) * len * 0.12;
    const cy = anchor.y + dy / 2 + (dx / len) * len * 0.12 + len * 0.08;
    const colour = TYPE_COLOUR.Mecha!;
    t.moveTo(anchor.x, anchor.y).quadraticCurveTo(cx, cy, d.x, d.y).stroke({ width: 9, color: colour, alpha: 0.12 * fade });
    t.moveTo(anchor.x, anchor.y).quadraticCurveTo(cx, cy, d.x, d.y).stroke({ width: 2.5, color: colour, alpha: 0.75 * fade });
    t.moveTo(anchor.x, anchor.y).quadraticCurveTo(cx, cy, d.x, d.y).stroke({ width: 1, color: 0xffffff, alpha: 0.7 * fade });
    for (let i = 0; i < 6; i++) {
      const u = (now / 900 + i / 6) % 1;
      const x = (1 - u) ** 2 * anchor.x + 2 * (1 - u) * u * cx + u * u * d.x;
      const y = (1 - u) ** 2 * anchor.y + 2 * (1 - u) * u * cy + u * u * d.y;
      t.circle(x, y, 2.2).fill({ color: 0xfff4d6, alpha: 0.9 * fade * Math.sin(Math.PI * u) });
    }
  }

  // ---------------------------------------------------------------------------
  // The board as it now is.

  function draw(): void {
    const a = app.current;
    const L = layers.current;
    if (!a || !ready.current || !host.current || !L) return;
    const { data, state, choosable, selected, onPick, onHover, showHidden, rotate } = props.current;
    wake();
    const c: Ctx = { data, state };
    L.root.removeChildren().forEach((x) => x.destroy({ children: true }));
    nodes.current = new Map();
    const keys = sectorKeys(state);
    if (keys.length === 0) return;
    const w = host.current.clientWidth;
    const h = host.current.clientHeight;
    const pos = keys.map((k) => {
      const { q, r } = fromKey(k);
      return { k, x: Math.sqrt(3) * (r + q / 2), y: -1.5 * q };
    });
    const minX = Math.min(...pos.map((p) => p.x)) - 1;
    const maxX = Math.max(...pos.map((p) => p.x)) + 1;
    const minY = Math.min(...pos.map((p) => p.y)) - 1.1;
    const maxY = Math.max(...pos.map((p) => p.y)) + 1.1;
    const size = Math.max(20, Math.min(w / (maxX - minX), h / (maxY - minY)) * 0.98);
    geo.current.size = size;
    const ox = (w - (maxX - minX) * size) / 2 - minX * size;
    const oy = (h - (maxY - minY) * size) / 2 - minY * size;
    // The Field is black in both themes (designer 2026-11-09).
    const ink = 0xe6e6e6;
    const plate = CLEARED_COLOUR;
    const back = 0x4a6280;
    const slots = new Graphics();
    slots.eventMode = "none";
    slots.zIndex = -1;
    slots.visible = !hideSlots.current;
    slotsRef.current = slots;
    L.root.addChild(slots);

    // Where the clickable sectors are, in CSS pixels of the Field (for the browser check and pop-ups).
    const hits: { k: string; id: string; x: number; y: number }[] = [];
    const rotHits: { dir: number; x: number; y: number }[] = [];
    for (const p of pos) {
      const cx = ox + p.x * size;
      const cy = oy + p.y * size;
      // An empty slot under every sector, seen while its tile is hidden by an animation.
      slots.poly(hexPoints(cx, cy, size * 0.9)).fill({ color: 0x15161a }).stroke({ width: 1, color: 0x2a2c31 });
      const node = new Container();
      node.pivot.set(cx, cy);
      node.position.set(cx, cy);
      L.root.addChild(node);
      nodes.current.set(p.k, { node, cx, cy });
      const st = sectorState(state, p.k);
      const top = topTileId(state, p.k);
      const g = new Graphics();
      const unit = st === "occupied" ? top : undefined;
      const fill = st === "cleared" ? plate : st === "dark" ? back : TYPE_COLOUR[unitDef(c, top!).type] ?? 0xcccccc;
      const isChoice = choosable.sectors.includes(p.k) || (unit !== undefined && choosable.units.includes(unit));
      if (isChoice) hits.push({ k: p.k, id: choosable.sectors.includes(p.k) ? p.k : unit!, x: Math.round(cx), y: Math.round(cy) });
      const isSel = selected.includes(p.k) || (unit !== undefined && selected.includes(unit));
      node.label = isChoice && !isSel ? `choice:${p.k}` : `sector:${p.k}`;
      const depthLayers = st === "dark" ? stack(state, p.k).length : st === "occupied" ? stack(state, p.k).length - 1 : 0;
      addDepth(node, cx, cy, size, depthLayers, fill);
      // Selected: a steady thin green rim.
      g.poly(hexPoints(cx, cy, size * 0.9)).fill({ color: fill }).stroke({ width: isSel ? 2.5 : 1.5, color: isSel ? 0x00d39e : 0x000000 });
      g.eventMode = "none";
      node.addChild(g);
      addDepthNotches(node, cx, cy, size, depthLayers, st === "dark");

      const label = (text: string, y: number, sz: number, color = 0x1d1d1f, bold = false, dx = 0) => {
        const t = new Text({ text, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(9, sz), fill: color, fontWeight: bold ? "700" : "400", align: "center" } });
        t.anchor.set(0.5);
        t.x = cx + dx;
        t.y = cy + y;
        t.eventMode = "none";
        node.addChild(t);
      };
      const height = stack(state, p.k).length;
      if (st === "cleared") label("Cleared", 0, size * 0.2, ink);
      else if (st === "dark") {
        const known = showHidden || state.seen.includes(top!);
        label(known ? `? ${tile(state, top!).unitId ?? "?"}` : "?", -size * 0.1, size * 0.3, 0xffffff, true);
        if (features().counts === "shown") label(`${height} tile${height === 1 ? "" : "s"}`, size * 0.3, size * 0.18, 0xdfe7f1);
        if (known) addNextTile(node, tile(state, top!).unitId ?? undefined, cx, cy, size, true);
      } else {
        const t = tile(state, unit!);
        const str = strength(c, unit!);
        // A little left of centre, clear of the glyph badge in the upper right corner.
        if (features().names === "shown") label(t.unitId ?? "?", -size * 0.28, size * 0.28, 0x1d1d1f, true, -size * 0.1);
        // Strength pips, Shield and Damage tokens as pieces (designer 2026-11-09, unitMarks.ts).
        addUnitMarks(node, str, t.tokens, cx, cy, size);
        // Level (3.3): a hexagon badge and notches at the upper left (designer 2026-11-09).
        let lv: number | undefined;
        try {
          lv = level(c, unit!);
        } catch {
          lv = undefined;
        }
        addLevel(node, lv, cx, cy, size);
        // The unit's glyph badge in the tile's upper right corner (designer 2026-11-10, glyphs.ts).
        addGlyphBadge(node, t.unitId ?? undefined, cx, cy, size);
        // Feature (round 28): the energy an Energy Gyro gives when destroyed (not on a Wreck).
        const reward = t.tokens.wreck ? undefined : gyroReward(unitDef(c, unit!));
        if (reward) addGyroEnergy(node, reward.n, reward.colour, cx, cy, size);
        const b = badgeText(t.tokens);
        const marked = t.tokens.shield + t.tokens.bioShield + t.tokens.damage > 0;
        if (b.length) label(b.join(" "), t.tokens.wreck ? size * 0.02 : marked ? size * 0.47 : size * 0.27, size * 0.16, 0x9b1c1c, true);
        addFuseTokens(node, t.tokens, cx, cy, size);
        // Above the Alert token's place at the bottom corner (designer 2026-11-09).
        if (features().counts === "shown") label(height > 1 ? `+${height - 1} beneath` : "alone", size * 0.5, size * 0.13);
        // Feature (round 24): the tile right under the unit, once looked at.
        const under = stack(state, p.k).at(-2);
        if (under && (showHidden || state.tiles[under]!.faceUp || state.seen.includes(under))) addNextTile(node, tile(state, under).unitId ?? undefined, cx, cy, size, false);
        // Trial rule (I2): the energy waiting on a Flare, as tokens on its tile (build step 3).
        const waiting = t.energy ? (["Yellow", "Red", "Blue"] as const).flatMap((col) => Array.from({ length: t.energy![col] ?? 0 }, () => col)) : [];
        if (waiting.length) {
          // Designer 2026-11-16: as big as Damage tokens; no white rim (a living energy border is drawn every frame, flareEnergyFx).
          const spots = flareEnergySpots(cx, cy, size, waiting.length, b.length > 0);
          const r = spots.r;
          const y0 = spots.y;
          const tok = new Graphics();
          const marks = new Container();
          waiting.forEach((col, i) => {
            const x0 = spots.x[i]!;
            tok.circle(x0, y0, r).fill({ color: ENERGY_HEX[col] ?? 0x888888 }).stroke({ width: 1, color: 0x000000, alpha: 0.35 });
            // The energy's glyph on the token (designer 2026-11-10).
            const g = energyTexture(col);
            if (g) {
              const sp = new Sprite({ texture: g, anchor: 0.5, x: x0, y: y0 });
              const k = (r * 1.25) / Math.max(g.width, g.height);
              sp.scale.set(k);
              marks.addChild(sp);
            }
          });
          tok.eventMode = "none";
          tok.label = "flare-energy";
          node.addChild(tok);
          marks.eventMode = "none";
          node.addChild(marks);
        }
        // Arrows on their sides, turned by the tile's facing (3.8).
        const turning = rotate?.tile === unit;
        const sides = arrowSides(unitDef(c, unit!).arrows, turning ? (rotate!.facing as typeof t.facing) : t.facing);
        // In their own layer, turned round the tile's centre when the unit turns (build step 5).
        const arrows = new Container();
        arrows.eventMode = "none";
        arrows.pivot.set(cx, cy);
        arrows.position.set(cx, cy);
        node.addChild(arrows);
        nodes.current.get(p.k)!.arrows = arrows;
        for (const s of sides) {
          const ang = SIDE_ANGLE[s]!;
          const ex = cx + Math.cos(ang) * size * 0.82;
          const ey = cy - Math.sin(ang) * size * 0.82;
          const bx = cx + Math.cos(ang) * size * 0.6;
          const by = cy - Math.sin(ang) * size * 0.6;
          const px = -Math.sin(ang) * size * 0.08;
          const py = -Math.cos(ang) * size * 0.08;
          const arr = new Graphics();
          arr.poly([ex, ey, bx + px, by + py, bx - px, by - py]).fill({ color: 0x1d1d1f });
          arr.eventMode = "none";
          arrows.addChild(arr);
        }
        if (turning) {
          // Two round buttons inside the hex: anticlockwise (left), clockwise (right).
          for (const [dir, dx, glyph] of [[-1, -0.47, "⟲"], [1, 0.47, "⟳"]] as const) {
            const bx = cx + dx * size;
            const by = cy + size * 0.29; // lower corners: arrows sit on the sides, never on corners
            const btn = new Graphics();
            btn.circle(bx, by, size * 0.15).fill({ color: 0xffffff }).stroke({ width: 2, color: READY });
            btn.eventMode = "none";
            node.addChild(btn);
            const tx = new Text({ text: glyph, style: { fontFamily: "system-ui, sans-serif", fontSize: Math.max(12, size * 0.26), fill: 0x1d1d1f, fontWeight: "700" } });
            tx.anchor.set(0.5);
            tx.x = bx;
            tx.y = by;
            tx.eventMode = "none";
            node.addChild(tx);
            rotHits.push({ dir, x: Math.round(bx), y: Math.round(by) });
          }
        }
      }
    }
    host.current.dataset.choosable = JSON.stringify(hits);
    host.current.dataset.sectors = JSON.stringify(Object.fromEntries([...nodes.current].map(([k, n]) => [k, [Math.round(n.cx), Math.round(n.cy)]])));
    host.current.dataset.rotate = JSON.stringify(rotHits);
    // The height of a whole tile on screen (pointy-top hex: two radii), for placing pop-ups.
    host.current.dataset.tile = String(Math.round(2 * size));

    // New engine events since the board last shown play now, in order (none after Undo).
    const before = lastState.current;
    lastState.current = state;
    if (before && before !== state) {
      const ev = newEvents(before.events, state.events);
      const steps = ev.length ? stepsFor(ev, state, before) : [];
      // Salvage milestones (designer 2026-11-22): after the answer's own steps.
      const P0 = props.current;
      const mark = P0.seed !== undefined ? salvageMarkOf(P0.data, before, state, P0.seed, P0.killPiece) : undefined;
      if (mark) steps.push(salvageStep(mark));
      if (steps.length) player.current.add(steps);
    }
    // Apply this frame's looks at once, so a hidden tile never flashes up before its animation.
    frame();
  }

  return <div ref={host} className="field" aria-label="The Field" onPointerDown={(e) => host.current && onDown(e.nativeEvent)} />;
}
