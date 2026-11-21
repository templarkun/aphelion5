/**
 * Trial looks of the Field (designer 2026-11-20): TEMPORARY switches in the Menu, so the designer can
 * try several looks and pick one. Each has "Original" (the look before). Kept in this browser only;
 * no rule, no save. Once the designer has chosen, the winner becomes the look and this goes away.
 *
 * - corners: how round the hexagons of the units and sector plates are.
 * - depth: how the number of tiles in a sector shows by sight (a few vs many, not the exact number).
 *   The notches along the bottom edge are no longer a trial: they are always drawn (designer 2026-11-21).
 * - readyUnit / readySector: the animation of units, and of Dark / Cleared sectors, ready to be tapped
 *   (one row each since 2026-11-21).
 * - counts: the "+N beneath" / "alone" and "N tiles" words on the tiles shown or hidden.
 * - names: the unit's name (B_03, S_12 ...) on its tile shown or hidden.
 * - overload: the Overload's look round the Field's edge (designer 2026-11-21): Original (the plasma
 *   wave drifting in and the plasma beams racing round the edge), or Inflow (the plasma wave kept, the
 *   racing beams replaced by streams of energy particles flowing in from the edge).
 */

export type Corner = "original" | "soft" | "round" | "pebble" | "bevel";
export type Depth = "original" | "stack" | "stackFine" | "stackHint";
export type ReadyUnit = "original" | "embers" | "heartbeat" | "motes" | "sparkle" | "gather" | "aura" | "current" | "arcs";
export type ReadySector = "fill" | "embers" | "inner" | "sparkle" | "converge" | "drift" | "tide" | "core" | "haze";
export type Ready = ReadyUnit | ReadySector;
export type Counts = "shown" | "hidden";
export type OverloadLook = "original" | "inflow";

export interface TrialLooks {
  corners: Corner;
  depth: Depth;
  readyUnit: ReadyUnit;
  readySector: ReadySector;
  counts: Counts;
  names: Counts;
  overload: OverloadLook;
}

export const CORNERS: { id: Corner; label: string; note: string }[] = [
  { id: "original", label: "Original", note: "sharp points" },
  { id: "soft", label: "Soft", note: "corners just rounded" },
  { id: "round", label: "Rounded", note: "clearly rounded" },
  { id: "pebble", label: "Pebble", note: "very round" },
  { id: "bevel", label: "Bevelled", note: "corners cut flat" },
];

export const DEPTHS: { id: Depth; label: string; note: string }[] = [
  { id: "original", label: "Original", note: "flat (the notches only)" },
  { id: "stack", label: "Stack", note: "thin tile edges under it, one per tile" },
  { id: "stackFine", label: "Stack, fine", note: "the same, closer together and softer" },
  { id: "stackHint", label: "Stack, hint", note: "only faint hairlines under the lower edges" },
];

export const READY_UNITS: { id: ReadyUnit; label: string; note: string }[] = [
  { id: "original", label: "Original", note: "hairline edge breathing" },
  { id: "embers", label: "Embers", note: "tiny sparks rise from the edge and fade" },
  { id: "heartbeat", label: "Heartbeat", note: "the edge beats twice, then rests" },
  { id: "motes", label: "Fireflies", note: "a few motes of light drift slowly round the edge" },
  { id: "sparkle", label: "Glitter edge", note: "the edge made of points of light that twinkle" },
  { id: "gather", label: "Gather", note: "specks of light are drawn in to the edge, which flares" },
  { id: "aura", label: "Aura", note: "a slow swirl of fine particles just outside the edge" },
  { id: "current", label: "Current", note: "fine particles flow round the edge like a current" },
  { id: "arcs", label: "Arcs", note: "small sparks of electricity jump along the edge now and then" },
];

export const READY_SECTORS: { id: ReadySector; label: string; note: string }[] = [
  { id: "fill", label: "Glow breath", note: "the whole plate glows in and out" },
  { id: "embers", label: "Embers", note: "tiny sparks rise from the edge and fade" },
  { id: "inner", label: "Inner glow", note: "a soft light breathes inside the edge" },
  { id: "sparkle", label: "Glitter edge", note: "the edge made of points of light that twinkle" },
  { id: "converge", label: "Draw in", note: "faint rings close in from the edge to the middle" },
  { id: "drift", label: "Dust in light", note: "lit specks drift slowly over the plate" },
  { id: "tide", label: "Tide", note: "a wave of light rolls slowly round the edge" },
  { id: "core", label: "Core", note: "a soft light breathes in the middle of the plate" },
  { id: "haze", label: "Haze", note: "fine particles seep out a little way from the edge" },
];

export const COUNTS: { id: Counts; label: string; note: string }[] = [
  { id: "shown", label: "Shown", note: "“+N beneath” and “N tiles” on the tiles" },
  { id: "hidden", label: "Hidden", note: "no tile-count words on the tiles" },
];

export const NAMES: { id: Counts; label: string; note: string }[] = [
  { id: "shown", label: "Shown", note: "the unit's name (B_03 ...) on its tile" },
  { id: "hidden", label: "Hidden", note: "no unit names on the tiles" },
];

export const OVERLOADS: { id: OverloadLook; label: string; note: string }[] = [
  { id: "original", label: "Original", note: "energy drifting in, and plasma beams racing round the edge" },
  { id: "inflow", label: "Inflow", note: "energy drifting in; streams of energy particles flow in from the edge (no racing beams)" },
];

const KEY = "aphelion5.trialLooks";
const DEFAULT: TrialLooks = { corners: "original", depth: "original", readyUnit: "original", readySector: "fill", counts: "shown", names: "shown", overload: "original" };
const subs = new Set<() => void>();

function load(): TrialLooks {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw) as Partial<TrialLooks>;
    return {
      corners: CORNERS.some((x) => x.id === v.corners) ? v.corners! : DEFAULT.corners,
      depth: DEPTHS.some((x) => x.id === v.depth) ? v.depth! : DEFAULT.depth,
      readyUnit: READY_UNITS.some((x) => x.id === v.readyUnit) ? v.readyUnit! : DEFAULT.readyUnit,
      readySector: READY_SECTORS.some((x) => x.id === v.readySector) ? v.readySector! : DEFAULT.readySector,
      counts: COUNTS.some((x) => x.id === v.counts) ? v.counts! : DEFAULT.counts,
      names: NAMES.some((x) => x.id === v.names) ? v.names! : DEFAULT.names,
      overload: OVERLOADS.some((x) => x.id === v.overload) ? v.overload! : DEFAULT.overload,
    };
  } catch {
    return DEFAULT;
  }
}

let cur: TrialLooks = typeof window === "undefined" ? DEFAULT : load();

export function trialLooks(): TrialLooks {
  return cur;
}

export function setTrialLooks(t: Partial<TrialLooks>): void {
  cur = { ...cur, ...t };
  try {
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
  for (const f of subs) f();
}

export function onTrialLooks(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}

/** How far each corner is rounded (or cut), as a share of the hexagon's size. */
const CORNER_R: Record<Corner, number> = { original: 0, soft: 0.07, round: 0.15, pebble: 0.27, bevel: 0.12 };

/**
 * The points of a pointy-top hexagon of `size` (centre to corner) round (cx, cy), with the chosen
 * corners. Rounded corners are arcs of a few points; bevelled ones are cut by one straight edge.
 */
export function hexOutline(cx: number, cy: number, size: number, corners: Corner = cur.corners): number[] {
  const pts: number[] = [];
  const k = CORNER_R[corners];
  if (k === 0) {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      pts.push(cx + size * Math.cos(a), cy + size * Math.sin(a));
    }
    return pts;
  }
  // Each corner: the two points at distance d along its edges, joined by an arc (or a straight cut).
  const d = size * k;
  const steps = corners === "bevel" ? 1 : 6;
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const px = cx + size * Math.cos(a);
    const py = cy + size * Math.sin(a);
    const prev = (Math.PI / 180) * (60 * (i - 1) - 30);
    const next = (Math.PI / 180) * (60 * (i + 1) - 30);
    const ux = cx + size * Math.cos(prev) - px;
    const uy = cy + size * Math.sin(prev) - py;
    const vx = cx + size * Math.cos(next) - px;
    const vy = cy + size * Math.sin(next) - py;
    const ax = px + (ux / size) * d;
    const ay = py + (uy / size) * d;
    const bx = px + (vx / size) * d;
    const by = py + (vy / size) * d;
    // A quadratic curve from a to b with the corner as its control point.
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      if (steps === 1) {
        pts.push(t === 0 ? ax : bx, t === 0 ? ay : by);
        continue;
      }
      const m = 1 - t;
      pts.push(m * m * ax + 2 * m * t * px + t * t * bx, m * m * ay + 2 * m * t * py + t * t * by);
    }
  }
  return pts;
}

/** A point at share `u` (0..1) of the way round the outline of hexOutline's points. */
export function alongOutline(pts: number[], u: number): { x: number; y: number } {
  const n = pts.length / 2;
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const l = Math.hypot(pts[2 * j]! - pts[2 * i]!, pts[2 * j + 1]! - pts[2 * i + 1]!);
    lens.push(l);
    total += l;
  }
  let want = (((u % 1) + 1) % 1) * total;
  for (let i = 0; i < n; i++) {
    if (want <= lens[i]! || i === n - 1) {
      const j = (i + 1) % n;
      const f = lens[i]! ? Math.min(1, want / lens[i]!) : 0;
      return { x: pts[2 * i]! + (pts[2 * j]! - pts[2 * i]!) * f, y: pts[2 * i + 1]! + (pts[2 * j + 1]! - pts[2 * i + 1]!) * f };
    }
    want -= lens[i]!;
  }
  return { x: pts[0]!, y: pts[1]! };
}
