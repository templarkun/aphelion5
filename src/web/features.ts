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
 * - endButton (designer 2026-11-22, round 29): the End the Overload button itself (endButtonFx.ts); round 30:
 *   each look has its own end animation when pressed (endBurstFx.ts).
 * - exposure (designer 2026-11-22, round 28): the look of Exposure (9.3 step 2: every unit alone on its sector
 *   plate takes 1 damage) after End the Overload is pressed: energy from the button to those units, or drawn
 *   out of them into it, and three more (exposureFx.ts).
 */

export type Corner = "original" | "soft" | "round" | "pebble" | "bevel";
export type Depth = "original" | "stack" | "stackFine" | "stackHint" | "glass";
export type ReadyUnit = "original" | "embers" | "heartbeat" | "gather" | "aura" | "current" | "arcs" | "scan" | "brackets" | "ripple" | "gyroscope" | "helix" | "radar" | "fieldlines" | "constellation";
export type ReadySector = "fill" | "inner" | "sparkle" | "converge" | "drift" | "tide" | "core" | "haze" | "pond" | "lattice" | "vortex" | "beacon" | "aurora" | "warp" | "nebula";
export type Ready = ReadyUnit | ReadySector;
export type Counts = "shown" | "hidden";
export type OverloadLook = "original" | "inflow" | "loops" | "tempest" | "torrent" | "breath" | "embers" | "rift" | "pulsar" | "swarm";
export type NextLook = "corner" | "ghost" | "chip" | "behind";
export type GyroEnergy = "tokens" | "corner" | "ring" | "orbit" | "pips" | "honeycomb" | "chain" | "string";
export type Exposure = "strike" | "drain" | "chain" | "nova" | "surge";
export type EndButton = "sun" | "reactor" | "singularity" | "orb" | "hazard" | "forge" | "gate";

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
  endButton: EndButton;
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

// Round 30 (designer 2026-11-22): Comet, Fountain, Glitter edge and Fireflies removed; Helix, Radar, Field
// lines and Constellation added.
export const READY_UNITS: { id: ReadyUnit; label: string; note: string }[] = [
  { id: "original", label: "Original", note: "hairline edge breathing" },
  { id: "embers", label: "Embers", note: "tiny sparks rise from the edge and fade" },
  { id: "heartbeat", label: "Heartbeat", note: "the edge beats twice, then rests" },
  { id: "gather", label: "Gather", note: "specks of light are drawn in to the edge, which flares" },
  { id: "aura", label: "Aura", note: "a slow swirl of fine particles just outside the edge" },
  { id: "current", label: "Current", note: "fine particles flow round the edge like a current" },
  { id: "arcs", label: "Arcs", note: "small sparks of electricity jump along the edge now and then" },
  { id: "scan", label: "Scan", note: "a thin line of light sweeps slowly down the tile, shedding a few motes" },
  { id: "brackets", label: "Lock-on", note: "six corner marks breathe in and out, like a target held" },
  { id: "ripple", label: "Ripple", note: "a ring of fine particles leaves the edge now and then and fades outwards" },
  { id: "gyroscope", label: "Gyroscope", note: "two rings of fine particles turn round the tile, tilted like a gyroscope" },
  { id: "helix", label: "Helix", note: "two strands of particles twist round the edge, crossing over and under each other" },
  { id: "radar", label: "Radar", note: "a beam sweeps round inside the tile; the edge lights where it passes and slowly fades" },
  { id: "fieldlines", label: "Field lines", note: "particles flow out of the top corner and curve down both sides into the bottom one, like a magnet's field" },
  { id: "constellation", label: "Constellation", note: "the six corners are stars joined by faint lines; sparks run from star to star" },
];

// Round 30 (designer 2026-11-22): Embers and Light rain removed; Warp and Nebula added.
export const READY_SECTORS: { id: ReadySector; label: string; note: string }[] = [
  { id: "fill", label: "Glow breath", note: "the whole plate glows in and out" },
  { id: "inner", label: "Inner glow", note: "a soft light breathes inside the edge" },
  { id: "sparkle", label: "Glitter edge", note: "the edge made of points of light that twinkle" },
  { id: "converge", label: "Draw in", note: "faint rings close in from the edge to the middle" },
  { id: "drift", label: "Dust in light", note: "lit specks drift slowly over the plate" },
  { id: "tide", label: "Tide", note: "a wave of light rolls slowly round the edge" },
  { id: "core", label: "Core", note: "a soft light breathes in the middle of the plate" },
  { id: "haze", label: "Haze", note: "fine particles seep out a little way from the edge" },
  { id: "pond", label: "Pond", note: "slow rings of light spread from the middle, as on still water" },
  { id: "lattice", label: "Lattice", note: "a faint grid of points on the plate, a wave of light passing over it" },
  { id: "vortex", label: "Vortex", note: "specks swirl slowly in towards the middle" },
  { id: "beacon", label: "Beacon", note: "a soft light in each corner in turn, as a slow beacon" },
  { id: "aurora", label: "Aurora", note: "a soft curtain of light waves gently across the plate" },
  { id: "warp", label: "Warp", note: "stars stream out from the middle of the plate towards the edge, as if flying through it" },
  { id: "nebula", label: "Nebula", note: "soft clouds of glowing dust churn slowly inside the plate, a few stars in them" },
];

export const COUNTS: { id: Counts; label: string; note: string }[] = [
  { id: "shown", label: "Shown", note: "“+N beneath” and “N tiles” on the tiles" },
  { id: "hidden", label: "Hidden", note: "no tile-count words on the tiles" },
];

export const NAMES: { id: Counts; label: string; note: string }[] = [
  { id: "shown", label: "Shown", note: "the unit's name (B_03 ...) on its tile" },
  { id: "hidden", label: "Hidden", note: "no unit names on the tiles" },
];

// Round 30 (designer 2026-11-22): Inflow first and the default, as it was. Every other look has its own second
// part instead of the plasma wave (overloadPartner.ts), made to work with it, some a third; two new looks.
export const OVERLOADS: { id: OverloadLook; label: string; note: string }[] = [
  { id: "inflow", label: "Inflow", note: "energy drifting in; streams of energy particles flow in from the edge (no racing beams)" },
  { id: "original", label: "Original", note: "plasma beams race round the edge, setting it alight behind them; where two beams cross, a flash" },
  { id: "loops", label: "Solar loops", note: "arches of plasma stand on a boiling edge, particles streaming along them; each snaps with a shock ring" },
  { id: "tempest", label: "Ion tempest", note: "glowing ion clouds drift along the edge; lightning leaps between them, lighting them up, and ion rain falls in" },
  { id: "torrent", label: "Plasma torrent", note: "a thick river of particles churns round the whole edge over a glowing riverbed; spray at the corners" },
  { id: "breath", label: "Shock breath", note: "the edge breathes in, drawing motes out of the Field, then blows a shock front of particles inwards" },
  { id: "embers", label: "Ember rise", note: "embers well up from a molten bottom edge on rising heat; now and then the bed flares and spits" },
  { id: "rift", label: "Void rift", note: "violet tears open along the edges; light bends round them and streaks of the Field are pulled in" },
  { id: "pulsar", label: "Pulsar", note: "bright nodes along the edge charge, linked by crackling threads, and fire rings of particles inwards" },
  { id: "swarm", label: "Plasma swarm", note: "a swarm of energy motes flocks round the edge, gathering and scattering, leaving glowing trails" },
];

export const NEXTS: { id: NextLook; label: string; note: string }[] = [
  { id: "corner", label: "Corner", note: "its glyph badge in the lower left corner of the tile" },
  { id: "ghost", label: "Ghost", note: "its glyph faint and large inside the tile" },
  { id: "chip", label: "Chip", note: "a small “next” chip with its glyph at the foot of the tile" },
  { id: "behind", label: "Behind", note: "its glyph badge tucked just behind the unit's own badge, like a card under a card" },
];

// Round 29 (designer 2026-11-22): Charge bar, Tag, Cells and Watermark removed; new looks after Tokens,
// Glyph ring and Cells. Tokens now curve round the tile's left edges (no second column).
export const GYRO_ENERGY: { id: GyroEnergy; label: string; note: string }[] = [
  { id: "tokens", label: "Tokens", note: "one energy token per energy, curving round the tile's left edges" },
  { id: "corner", label: "Corner", note: "the number and the energy glyph in the upper left corner" },
  { id: "ring", label: "Glyph ring", note: "one lit segment per energy round the unit's glyph badge" },
  { id: "orbit", label: "Token ring", note: "small energy tokens set over the unit's glyph badge like a crown" },
  { id: "pips", label: "Pip ring", note: "a ring of pips round the glyph badge, one lit and glowing per energy" },
  { id: "honeycomb", label: "Honeycomb", note: "hexagonal energy cells packed together at the tile's left side" },
  { id: "chain", label: "Cell chain", note: "hexagonal energy cells linked in a chain, curving round the left edges" },
  { id: "string", label: "Bead string", note: "a thin thread of the energy's colour along the left edges, one glowing bead per energy" },
];

export const EXPOSURES: { id: Exposure; label: string; note: string }[] = [
  { id: "strike", label: "Strike", note: "bolts of energy fly from End the Overload into each unit" },
  { id: "drain", label: "Drain", note: "energy is pulled out of each unit and streams into End the Overload" },
  { id: "chain", label: "Chain", note: "one bolt of lightning leaps from the button to the units, one after another" },
  { id: "nova", label: "Nova", note: "a ring of energy rolls out from the button over the Field; each unit flares as it passes" },
  { id: "surge", label: "Plate surge", note: "threads of energy run to each unit's sector plate, whose edge flares up into the unit" },
];

// Round 29 (designer 2026-11-22): a Feature for the End the Overload button itself (EndOverload.tsx,
// endButtonFx.ts): its shape, colour, and the effects inside and round it.
export const END_BUTTONS: { id: EndButton; label: string; note: string }[] = [
  { id: "sun", label: "Sun", note: "a round, see-through small sun with coronal waves round it (as before)" },
  { id: "reactor", label: "Reactor", note: "a cyan hexagon: rings of particles spin round a beating core; sparks jump from its corners" },
  { id: "singularity", label: "Singularity", note: "a black hole: a disc of glowing matter whirls round it; motes spiral in from afar" },
  { id: "orb", label: "Plasma orb", note: "a violet glass sphere: plasma threads wander inside; tendrils crackle out from it" },
  { id: "hazard", label: "Hazard", note: "an amber diamond: chevrons of light rise inside; a warning beacon sweeps round it" },
  { id: "forge", label: "Forge", note: "a molten square: churning heat inside; embers rise from it and drift away" },
  { id: "gate", label: "Star gate", note: "a ring with a swirling portal in it; marks light one by one round its rim" },
];

const KEY = "aphelion5.features";
/** Where the choices were kept while they were called "trial looks" (until 2026-11-22); read once. */
const OLD_KEY = "aphelion5.trialLooks";
// Designer 2026-11-21 (round 25): Pebble corners and the Corner next tile are the defaults; the
// tile-count words are hidden for good (their row left the Menu).
const DEFAULT: Features = { corners: "pebble", depth: "original", readyUnit: "original", readySector: "fill", counts: "hidden", names: "shown", overload: "inflow", next: "corner", gyroEnergy: "tokens", exposure: "strike", endButton: "sun" };
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
      endButton: END_BUTTONS.some((x) => x.id === v.endButton) ? v.endButton! : DEFAULT.endButton,
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
  { key: "endButton", title: "Overload End button", about: "The look of the End the Overload button: its shape, colour, and the effects inside and round it.", list: END_BUTTONS },
] as FeatureRow[];
