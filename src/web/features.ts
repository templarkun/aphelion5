/**
 * Features of the Field (designer 2026-11-20, then called "trial looks"; renamed "Features" 2026-11-22):
 * switches in the Menu with several versions each. They are a permanent part of the game: later each
 * is hidden and given to players one by one as they unlock achievements (not built yet). Kept in this
 * browser only; no rule, no save.
 *
 * - corners: how round the hexagons of the units and sector plates are.
 * - depth: how the number of tiles in a sector shows by sight (a few vs many, not the exact number).
 *   The notches along the bottom edge are no longer a choice: they are always drawn (designer 2026-11-21).
 * - readyUnit / readySector: the animation of units, and of Dark / Cleared sectors, ready to be tapped
 *   (one row each since 2026-11-21).
 * - counts: the "+N beneath" / "alone" and "N tiles" words on the tiles; always hidden since round 25
 *   (designer 2026-11-21), no longer in the Menu.
 * - names: the unit's name (B_03, S_12 ...) on its tile shown or hidden.
 * - overload: the Overload's look round the Field's edge (designer 2026-11-21): Original (the plasma
 *   wave drifting in and the plasma beams racing round the edge), or Inflow (the plasma wave kept, the
 *   racing beams replaced by streams of energy particles flowing in from the edge).
 * - next: where a sector's very next tile shows once the player has looked at it (designer
 *   2026-11-21, round 24): the tile under a unit, or a Dark sector's top tile. Corner (its glyph badge in
 *   the lower left corner; the default since round 25, when Original and Peek were removed), Ghost (its glyph faint and large in
 *   the tile), Chip (a small "next" chip with its glyph where the tile-count words are), Behind (round 28: its glyph
 *   badge tucked just behind the unit's own badge, like a card under a card).
 * - gyroEnergy (designer 2026-11-22, round 28): how an Energy Gyro (G_01-G_09) shows the energy you gain by
 *   destroying it (its "destroyed" line in the unit list). Drawn once with the board (nothing moves).
 * - exposure (designer 2026-11-22, round 28): the look of Exposure (9.3 step 2: every unit alone on its sector
 *   plate takes 1 damage) after End the Overload is pressed: energy from the button to those units, or drawn
 *   out of them into it, and three more (exposureFx.ts).
 */

export type Corner = "original" | "soft" | "round" | "pebble" | "bevel";
export type Depth = "original" | "stack" | "stackFine" | "stackHint" | "glass";
export type ReadyUnit = "original" | "embers" | "heartbeat" | "motes" | "sparkle" | "gather" | "aura" | "current" | "arcs" | "comet" | "scan" | "brackets" | "ripple" | "corona" | "chase";
export type ReadySector = "fill" | "embers" | "inner" | "sparkle" | "converge" | "drift" | "tide" | "core" | "haze" | "pond" | "lattice" | "rain" | "vortex" | "beacon" | "aurora";
export type Ready = ReadyUnit | ReadySector;
export type Counts = "shown" | "hidden";
export type OverloadLook = "original" | "inflow" | "storm" | "pulse" | "veil";
export type NextLook = "corner" | "ghost" | "chip" | "behind";
export type GyroEnergy = "tokens" | "corner" | "bar" | "ring" | "tag" | "cells" | "watermark";
export type Exposure = "strike" | "drain" | "chain" | "nova" | "surge";

export interface Features {
  corners: Corner;
  depth: Depth;
  readyUnit: ReadyUnit;
  readySector: ReadySector;
  counts: Counts;
  names: Counts;
  overload: OverloadLook;
  next: NextLook;
  gyroEnergy: GyroEnergy;
  exposure: Exposure;
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
  { id: "glass", label: "Glass stack", note: "a thin line of cool light per tile, like stacked glass plates" },
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
  { id: "comet", label: "Comet", note: "one bright spark circles the edge with a tail of fading motes" },
  { id: "scan", label: "Scan", note: "a thin line of light sweeps slowly down the tile, shedding a few motes" },
  { id: "brackets", label: "Lock-on", note: "six corner marks breathe in and out, like a target held" },
  { id: "ripple", label: "Ripple", note: "a ring of fine particles leaves the edge now and then and fades outwards" },
  { id: "corona", label: "Corona", note: "short rays of light flicker round the edge like a small sun" },
  { id: "chase", label: "Chase", note: "the six corners light one after another round the tile" },
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
  { id: "pond", label: "Pond", note: "slow rings of light spread from the middle, as on still water" },
  { id: "lattice", label: "Lattice", note: "a faint grid of points on the plate, a wave of light passing over it" },
  { id: "rain", label: "Light rain", note: "fine motes fall slowly through the plate and fade" },
  { id: "vortex", label: "Vortex", note: "specks swirl slowly in towards the middle" },
  { id: "beacon", label: "Beacon", note: "a soft light in each corner in turn, as a slow beacon" },
  { id: "aurora", label: "Aurora", note: "a soft curtain of light waves gently across the plate" },
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
  { id: "storm", label: "Storm", note: "energy drifting in; arcs of lightning crawl along the edge and crackle out" },
  { id: "pulse", label: "Pulse", note: "energy drifting in; pulses of light run from the corners and burst where they meet" },
  { id: "veil", label: "Veil", note: "energy drifting in; a curtain of particles ripples along the edge, red to violet" },
];

export const NEXTS: { id: NextLook; label: string; note: string }[] = [
  { id: "corner", label: "Corner", note: "its glyph badge in the lower left corner of the tile" },
  { id: "ghost", label: "Ghost", note: "its glyph faint and large inside the tile" },
  { id: "chip", label: "Chip", note: "a small “next” chip with its glyph at the foot of the tile" },
  { id: "behind", label: "Behind", note: "its glyph badge tucked just behind the unit's own badge, like a card under a card" },
];

export const GYRO_ENERGY: { id: GyroEnergy; label: string; note: string }[] = [
  { id: "tokens", label: "Tokens", note: "one energy token per energy, along the tile's left edge" },
  { id: "corner", label: "Corner", note: "the number and the energy glyph in the upper left corner" },
  { id: "bar", label: "Charge bar", note: "a short bar of cells in the energy's colour inside the left edge" },
  { id: "ring", label: "Glyph ring", note: "one lit segment per energy round the unit's glyph badge" },
  { id: "tag", label: "Tag", note: "a small “+N” tag with the energy glyph under the Level badge" },
  { id: "cells", label: "Cells", note: "small hexagonal cells in the energy's colour along the upper left edge" },
  { id: "watermark", label: "Watermark", note: "the energy glyph faint and large in the tile, the number on it" },
];

export const EXPOSURES: { id: Exposure; label: string; note: string }[] = [
  { id: "strike", label: "Strike", note: "bolts of energy fly from End the Overload into each unit" },
  { id: "drain", label: "Drain", note: "energy is pulled out of each unit and streams into End the Overload" },
  { id: "chain", label: "Chain", note: "one bolt of lightning leaps from the button to the units, one after another" },
  { id: "nova", label: "Nova", note: "a ring of energy rolls out from the button over the Field; each unit flares as it passes" },
  { id: "surge", label: "Plate surge", note: "threads of energy run to each unit's sector plate, whose edge flares up into the unit" },
];

const KEY = "aphelion5.features";
/** Where the choices were kept while they were called "trial looks" (until 2026-11-22); read once. */
const OLD_KEY = "aphelion5.trialLooks";
// Designer 2026-11-21 (round 25): Pebble corners and the Corner next tile are the defaults; the
// tile-count words are hidden for good (their row left the Menu).
const DEFAULT: Features = { corners: "pebble", depth: "original", readyUnit: "original", readySector: "fill", counts: "hidden", names: "shown", overload: "original", next: "corner", gyroEnergy: "tokens", exposure: "strike" };
const subs = new Set<() => void>();

function load(): Features {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw) as Partial<Features>;
    return {
      corners: CORNERS.some((x) => x.id === v.corners) ? v.corners! : DEFAULT.corners,
      depth: DEPTHS.some((x) => x.id === v.depth) ? v.depth! : DEFAULT.depth,
      readyUnit: READY_UNITS.some((x) => x.id === v.readyUnit) ? v.readyUnit! : DEFAULT.readyUnit,
      readySector: READY_SECTORS.some((x) => x.id === v.readySector) ? v.readySector! : DEFAULT.readySector,
      counts: "hidden",
      names: NAMES.some((x) => x.id === v.names) ? v.names! : DEFAULT.names,
      overload: OVERLOADS.some((x) => x.id === v.overload) ? v.overload! : DEFAULT.overload,
      next: NEXTS.some((x) => x.id === v.next) ? v.next! : DEFAULT.next,
      gyroEnergy: GYRO_ENERGY.some((x) => x.id === v.gyroEnergy) ? v.gyroEnergy! : DEFAULT.gyroEnergy,
      exposure: EXPOSURES.some((x) => x.id === v.exposure) ? v.exposure! : DEFAULT.exposure,
    };
  } catch {
    return DEFAULT;
  }
}

let cur: Features = typeof window === "undefined" ? DEFAULT : load();

export function features(): Features {
  return cur;
}

export function setFeatures(t: Partial<Features>): void {
  cur = { ...cur, ...t };
  try {
    localStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
  for (const f of subs) f();
}

export function onFeatures(f: () => void): () => void {
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

/**
 * The Features in the order the Menu and the Features page show them (designer 2026-11-22). `unlock`
 * will name the achievement that gives a Feature to the player (later; none yet: every Feature is open).
 */
export interface FeatureRow<K extends keyof Features = keyof Features> {
  key: K;
  title: string;
  about: string;
  list: { id: Features[K]; label: string; note: string }[];
  unlock?: string;
}

export const FEATURE_ROWS: FeatureRow[] = [
  { key: "corners", title: "Tile corners", about: "How round the hexagons of units and sectors are.", list: CORNERS },
  { key: "depth", title: "Stack depth", about: "How deep a sector's stack looks: a few tiles or many, at a glance.", list: DEPTHS },
  { key: "readyUnit", title: "Ready to tap: units", about: "The animation on a unit you can use now.", list: READY_UNITS },
  { key: "readySector", title: "Ready to tap: sectors", about: "The animation on a Dark or Cleared sector you can use now.", list: READY_SECTORS },
  { key: "names", title: "Unit names", about: "The unit's name (B_03, S_12 ...) on its tile.", list: NAMES },
  { key: "overload", title: "Overload edge", about: "The energy round the Field's edge during an Overload.", list: OVERLOADS },
  { key: "next", title: "Next tile", about: "Where a sector's next tile shows once you have looked at it.", list: NEXTS },
  { key: "gyroEnergy", title: "Energy Gyro reward", about: "How an Energy Gyro shows the energy you gain by destroying it.", list: GYRO_ENERGY },
  { key: "exposure", title: "Overload End: Exposure", about: "When the Overload ends, every unit alone on its sector plate takes 1 damage (9.3). How that is shown.", list: EXPOSURES },
] as FeatureRow[];
