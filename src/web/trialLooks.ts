/**
 * Trial looks of the Field (designer 2026-11-20): TEMPORARY switches in the Menu, so the designer can
 * try several looks and pick one. Each has "Original" (the look before). Kept in this browser only;
 * no rule, no save. Once the designer has chosen, the winner becomes the look and this goes away.
 *
 * - corners: how round the hexagons of the units and sector plates are.
 * - depth: how the number of tiles in a sector shows by sight (a few vs many, not the exact number).
 * - ready: the animation of units and sectors ready to be tapped.
 */

export type Corner = "original" | "soft" | "round" | "pebble" | "bevel";
export type Depth = "original" | "stack" | "stackBold" | "slab" | "shadow" | "pips";
export type Ready = "original" | "fill" | "halo" | "runner" | "twin" | "corners" | "ripple";

export interface TrialLooks {
  corners: Corner;
  depth: Depth;
  ready: Ready;
}

export const CORNERS: { id: Corner; label: string; note: string }[] = [
  { id: "original", label: "Original", note: "sharp points" },
  { id: "soft", label: "Soft", note: "corners just rounded" },
  { id: "round", label: "Rounded", note: "clearly rounded" },
  { id: "pebble", label: "Pebble", note: "very round" },
  { id: "bevel", label: "Bevelled", note: "corners cut flat" },
];

export const DEPTHS: { id: Depth; label: string; note: string }[] = [
  { id: "original", label: "Original", note: "flat, the number only" },
  { id: "stack", label: "Stack", note: "thin tile edges under it, one per tile" },
  { id: "stackBold", label: "Stack, strong", note: "the same, thicker" },
  { id: "slab", label: "Thick slab", note: "a solid side that grows with the tiles" },
  { id: "shadow", label: "Shadow", note: "it floats higher with more tiles" },
  { id: "pips", label: "Notches", note: "one notch per tile along the bottom edge" },
];

export const READIES: { id: Ready; label: string; note: string }[] = [
  { id: "original", label: "Original", note: "hairline edge breathing" },
  { id: "fill", label: "Glow breath", note: "the whole tile glows in and out" },
  { id: "halo", label: "Halo", note: "a soft light round the outside" },
  { id: "runner", label: "Edge runner", note: "a spark runs round the edge" },
  { id: "twin", label: "Twin runners", note: "two sparks chase round the edge" },
  { id: "corners", label: "Corner wave", note: "the corners light one after another" },
  { id: "ripple", label: "Ripple", note: "rings drift outwards from the edge" },
];

const KEY = "aphelion5.trialLooks";
const DEFAULT: TrialLooks = { corners: "original", depth: "original", ready: "original" };
const subs = new Set<() => void>();

function load(): TrialLooks {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw) as Partial<TrialLooks>;
    return {
      corners: CORNERS.some((x) => x.id === v.corners) ? v.corners! : DEFAULT.corners,
      depth: DEPTHS.some((x) => x.id === v.depth) ? v.depth! : DEFAULT.depth,
      ready: READIES.some((x) => x.id === v.ready) ? v.ready! : DEFAULT.ready,
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
