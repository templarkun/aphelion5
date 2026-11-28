/**
 * When things happen in the celebrations, in seconds at Normal speed (designer 2026-11-20, the plan
 * agreed that day). The speed setting stretches them; reduced motion and Instant show a still picture
 * for STILL seconds instead. Every moving thing is worked out from the time alone.
 */

/** Alpha Down, the kill: about 4.5 s. */
export const KILL = {
  total: 4.5,
  /** Act 1, slow-down: the Field zooms in on the unit and the rest darkens; brackets close in. */
  zoomIn: [0, 0.8] as const,
  bracketsIn: [0.15, 0.72] as const,
  /** The brackets lock on (playTargetLock). */
  lock: 0.72,
  /** Act 2, break: violet light through cracks, the glyph flares and collapses into a core, then the burst. */
  cracks: [0.8, 1.35] as const,
  flare: [1.18, 1.5] as const,
  collapse: [1.42, 1.62] as const,
  /** The burst: shards, shock ring, sparks, a small shake (playOmegaBreak). */
  burst: 1.62,
  /** The Wreck shows again where the unit was (it stays on the Field, 4.8). */
  wreckIn: [1.85, 2.2] as const,
  /** Act 3, confirmed: smoke, and the label beside it. */
  label: [2.2, 2.45] as const,
  /** "5 / 6" becomes "6 / 6" (playKillConfirmed). */
  count: 2.75,
  /** Act 4, back: the zoom eases back to the whole Field. */
  back: [3.6, 4.5] as const,
};

/**
 * Alpha Purge, the second kill for Alpha (designer 2026-11-20, I21): about 4.5 s. A containment cage
 * closes round the unit, crushes it to a point and purges it in a pillar of light; the Wreck forms again.
 */
export const PURGE = {
  total: 4.5,
  /** Act 1, cage: the Field zooms in, the rest darkens; six wall panels fly in and lock round the tile. */
  zoomIn: [0, 0.8] as const,
  panelsIn: [0.1, 0.72] as const,
  /** The cage locks (playTargetLock). */
  lock: 0.72,
  /** Act 2, crush: the cage closes in with arcs of light, then crushes the unit to a point. */
  squeeze: [0.8, 1.35] as const,
  crush: [1.35, 1.62] as const,
  /** The pillar of light fires upwards (playPurgeBeam); the unit is gone. */
  purge: 1.62,
  beam: [1.62, 2.7] as const,
  /** Act 3, confirmed: the Wreck forms again under a scan line; the label beside it. */
  wreckIn: [1.95, 2.45] as const,
  label: [2.3, 2.55] as const,
  /** "5 / 6" becomes "6 / 6" (playKillConfirmed). */
  count: 2.85,
  /** Act 4, back: the zoom eases back. */
  back: [3.6, 4.5] as const,
};

/**
 * Rail Strike, the third kill for Alpha (designer 2026-11-27): about 4.5 s. A sight line from the edge of
 * the Field, accelerator coils light along it, a slug crosses in bullet time with a shock cone, strikes;
 * the unit is blown out through its far side in a cone of debris; the hole glows and cools to the Wreck.
 */
export const RAIL = {
  total: 4.5,
  /** Act 1, sight: the zoom; a sight line of particles reaches in from the edge, a reticle narrows and locks (playTargetLock). */
  zoomIn: [0, 0.8] as const,
  sight: [0.12, 0.6] as const,
  reticle: [0.2, 0.74] as const,
  lock: 0.74,
  /** Act 2, charge: rings of particles (the coils) light one after another along the line towards the unit (playRailCharge). */
  coils: [0.82, 1.3] as const,
  /** The slug crosses in bullet time (playRailFire), strikes at `impact` (playRailImpact). */
  fire: 1.32,
  impact: 1.8,
  /** Act 3, through: the cone of debris out of its far side, the shock ring, the shake; the hole glows and cools. */
  spray: [1.8, 2.7] as const,
  cool: [1.9, 3.3] as const,
  wreckIn: [2.05, 2.45] as const,
  label: [2.3, 2.55] as const,
  count: 2.85,
  /** Act 4, back. */
  back: [3.6, 4.5] as const,
};

/**
 * Alpha Erased, the fourth kill for Alpha (designer 2026-11-27): about 4.6 s. A scan grid projects onto the
 * unit and a scan bar sweeps it: behind the bar the unit is turned into a lattice of particles, which trembles
 * and then is unravelled by a wind into streams that curl away; the Wreck is left.
 */
export const ERASE = {
  total: 4.6,
  /** Act 1, project: the zoom; corner brackets and a grid of points over the tile, locking (playTargetLock). */
  zoomIn: [0, 0.8] as const,
  grid: [0.15, 0.7] as const,
  lock: 0.72,
  /** Act 2, scan: the bar sweeps left to right (playEraseScan); behind it, the tile becomes particles. */
  scan: [0.85, 1.6] as const,
  /** The tile is gone; its particles hold and tremble. */
  hold: [1.6, 1.82] as const,
  /** Act 3, unravel: the particles peel off from the left, streams curling away on the wind (playEraseUnravel). */
  unravel: [1.82, 3.0] as const,
  wreckIn: [2.15, 2.7] as const,
  label: [2.4, 2.65] as const,
  count: 2.95,
  /** Act 4, back. */
  back: [3.7, 4.6] as const,
};

/**
 * Burnout, the fifth kill for Alpha (designer 2026-11-28: "Create 2 additional animations for eliminating
 * the Alpha unit"): about 4.5 s. No weapon from outside: the unit is overloaded from within. Heat creeps in
 * from its corners as veins of particles, three surges throb through it, arcs leap from its corners to the
 * ground; its core blows out upwards in a fountain of molten sparks that fall back under gravity; smoke rises.
 */
export const BURNOUT = {
  total: 4.5,
  /** Act 1, heat: the zoom; veins of particles creep in from the corners to the glyph (playBurnoutHeat). */
  zoomIn: [0, 0.8] as const,
  veins: [0.3, 1.55] as const,
  /** Act 2, overload: three surges, each brighter (playBurnoutSurge(index)); arcs to the ground in between. */
  surges: [0.95, 1.3, 1.62] as const,
  arcs: [0.9, 1.98] as const,
  /** Act 3, blow-out (playBurnoutBlow): the core bursts upwards, sparks rise and fall; smoke; the Wreck. */
  blow: 1.95,
  fountain: [1.95, 3.5] as const,
  cool: [2.0, 3.6] as const,
  wreckIn: [2.2, 2.6] as const,
  label: [2.4, 2.65] as const,
  count: 2.95,
  /** Act 4, back. */
  back: [3.6, 4.5] as const,
};

/**
 * Tether Rip, the sixth kill for Alpha (designer 2026-11-28): about 4.6 s. Three harpoons shoot in from beyond
 * the Field's edge and bite into three corners of the tile; their tethers of particles pull taut and thrum, the
 * tile strains and cracks along three lines, and it is torn into three pieces yanked away along the tethers.
 */
export const TETHER = {
  total: 4.6,
  /** Act 1, hooks: the zoom; three harpoons fly in (one after another) and bite (playTetherHook(index)). */
  zoomIn: [0, 0.8] as const,
  shots: [0.2, 0.34, 0.48] as const,
  flight: 0.34,
  /** Act 2, strain: the tethers pull taut and thrum (playTetherStrain), cracks of light run from the middle. */
  taut: [1.0, 1.7] as const,
  cracks: [1.2, 1.92] as const,
  /** Act 3, rip (playTetherRip): three pieces yanked out along the tethers; sparks from the torn edges; the Wreck. */
  rip: 1.95,
  fling: [1.95, 3.0] as const,
  wreckIn: [2.2, 2.6] as const,
  label: [2.4, 2.65] as const,
  count: 2.95,
  /** Act 4, back. */
  back: [3.7, 4.6] as const,
};

/**
 * Beta Breach, the kill for Beta (designer 2026-11-20, more spectacular than Alpha's): about 6.2 s. The
 * Beta fights the lock, its core breaches and it detonates, knocking the units round it back.
 */
export const BREACH = {
  total: 6.2,
  /** Act 1, lock: the zoom (wider than for an Alpha, the sectors round it in view), a turning reticle closes in and locks (playTargetLock). */
  zoomIn: [0, 1.0] as const,
  reticle: [0.1, 0.95] as const,
  lock: 0.95,
  /** Act 2, surge: three surges (playBetaSurge), arcs to the sectors round it, cracks, small blasts; then the core sucks everything in. */
  surges: [1.25, 1.65, 2.0] as const,
  cracks: [1.3, 2.4] as const,
  blasts: [2.12, 2.3, 2.45] as const,
  implode: [2.55, 2.9] as const,
  /** Act 3, breach: white-out, fireball, two shock fronts off the screen, shards, the units round it knocked back, a heavy shake (playBetaDetonation). */
  detonate: 2.9,
  /** What lies beneath shows again under the smoke (a Beta leaves no Wreck). */
  wreckIn: [3.7, 4.3] as const,
  /** Act 4, confirmed: the label; "2 / 3" becomes "3 / 3" (playKillConfirmed). */
  label: [3.95, 4.25] as const,
  count: 4.55,
  /** Act 5, back. */
  back: [5.3, 6.2] as const,
};

/**
 * Barrage, the second kill for Beta (designer 2026-11-27: "Make 2 animations for Beta unit elimination ...
 * more spectacular than Alpha"): about 6.8 s. A kill box locks on the Beta and the sectors round it; a
 * barrage of shells walks in on it and breaks its shield; a lance of light from orbit ends it.
 */
export const BARRAGE = {
  total: 6.8,
  /** Act 1, kill box: the zoom (wider than Beta Breach); the box's edge drawn round the seven sectors, pins at the six, lock (playTargetLock). */
  zoomIn: [0, 1.0] as const,
  box: [0.15, 0.95] as const,
  lock: 0.98,
  /** Act 2, barrage: eight shells walk in on it (playBarrageShell, each), its shield of particles flickers, cracks and breaks. */
  shells: [1.25, 1.5, 1.72, 1.92, 2.1, 2.26, 2.4, 2.52] as const,
  fall: 0.22,
  shieldUp: 1.15,
  shieldBreak: 2.78,
  /** Act 3, lance: a target ring shrinks on it, the Field dims; the lance falls from orbit (playOrbitalLance) and strikes. */
  mark: [2.6, 3.1] as const,
  lance: [3.1, 3.3] as const,
  strike: 3.3,
  /** The firestorm ring, rising debris, a shock front off the screen; the units round it knocked back; the crater cools. */
  ring: [3.3, 4.1] as const,
  cool: [3.6, 5.8] as const,
  wreckIn: [4.2, 4.8] as const,
  /** Act 4, confirmed: the label; "2 / 3" becomes "3 / 3". */
  label: [4.4, 4.7] as const,
  count: 5.0,
  /** Act 5, back. */
  back: [5.9, 6.8] as const,
};

/**
 * Cryo Shatter, the third kill for Beta (designer 2026-11-27, as Barrage): about 6.6 s. Six cryo emitters
 * freeze the Beta solid, frost creeping over the sectors round it; a held silence and two cracks; it
 * shatters into ice, a frost wave and mist roll out over the Field, ice dust drifts down.
 */
export const CRYO = {
  total: 6.6,
  /** Act 1, emitters: the zoom; six emitters gather at the corners round it, cold beams, lock (playTargetLock). */
  zoomIn: [0, 1.0] as const,
  emitters: [0.2, 0.9] as const,
  lock: 0.98,
  /** Act 2, freeze: frost grows over the tile from its edges (playCryoFreeze), it struggles, slower and slower; frost on the sectors round it. */
  freeze: [1.05, 2.6] as const,
  /** Frozen: still; two cracks (playIceCrack, each). */
  cracks: [2.85, 3.05] as const,
  /** Act 3, shatter (playIceShatter): ice shards, a frost wave and mist off the screen, the units round it knocked back. */
  shatter: 3.25,
  dust: [3.4, 5.6] as const,
  wreckIn: [4.0, 4.6] as const,
  /** Act 4, confirmed: the label; "2 / 3" becomes "3 / 3". */
  label: [4.2, 4.5] as const,
  count: 4.8,
  /** Act 5, back. */
  back: [5.7, 6.6] as const,
};

/**
 * Event Horizon, the first kill for Gamma (designer 2026-11-20, I26: both plans built): about 8 s. The
 * camera tilts the Field into 3D; the Gamma collapses into a singularity that pulls the sectors round it
 * off the board; it snaps, a jet of light fires up and a shock wave flips the sectors; they fall back.
 */
export const HORIZON = {
  total: 8.0,
  /** Act 1, tilt: the zoom, and the board tilts back to a low angle; hexagonal brackets slam on (playTargetLock). */
  zoomIn: [0, 1.2] as const,
  tilt: [0.1, 1.3] as const,
  bracketsIn: [0.55, 1.15] as const,
  lock: 1.15,
  /** Act 2, gravity: a black sphere and its disc of particles (playGammaCollapse); the two rings of sectors round it lift off and are pulled in. */
  collapse: [1.3, 2.1] as const,
  lift1: [1.65, 2.6] as const,
  lift2: [2.05, 3.0] as const,
  /** The Gamma itself falls into the sphere. */
  swallow: [2.9, 3.85] as const,
  /** Act 3, snap: a point, a frozen moment, then the jet (playGammaJet) and the flat shock wave flipping the sectors. */
  snap: 3.85,
  jet: [4.1, 5.3] as const,
  wave: [4.15, 5.2] as const,
  /** Act 4, settle: the lifted sectors drop back one by one (playSectorLand); what lay beneath shows in a fading crater. */
  land: [4.7, 6.0] as const,
  wreckIn: [4.4, 5.0] as const,
  label: [5.3, 5.6] as const,
  /** "1 / 2" becomes "2 / 2" (playKillConfirmed). */
  count: 5.9,
  /** Act 5, back: the board turns flat again as the zoom eases back. */
  back: [6.6, 8.0] as const,
};

/**
 * Field Array, the second kill for Gamma (designer 2026-11-20, I26): about 8.2 s. The whole Field becomes
 * the weapon: every sector lights up, ring by ring, a lattice of beams closes on the Gamma and breaks its
 * shield; the camera turns to the side, the beams lift the Gamma out as a column and cut it into slices.
 */
export const ARRAY = {
  total: 8.2,
  /** Act 1, arming: the sectors' edges light from the Field's edge inwards (playArrayArm); the zoom closes in slowly through act 2. */
  zoomIn: [0.2, 3.5] as const,
  arm: [0.1, 1.5] as const,
  /** Act 2, lattice: beams of particles leap from ring to ring towards the Gamma; its shield's cells crack one by one; it breaks (playLatticeLock). */
  beams: [1.4, 2.7] as const,
  shield: [1.5, 3.45] as const,
  crack: [2.6, 3.4] as const,
  lock: 3.45,
  /** Act 3, cut: the camera turns to a side view; the Gamma rises out as a column; the beams cut it (playGammaCut); the slices slide apart. */
  side: [3.55, 4.3] as const,
  rise: [3.95, 4.6] as const,
  cut: 4.75,
  slide: [4.8, 5.5] as const,
  /** Act 4, fall: back to the view from above as the slices fall into the sector; it caves in to stars, then what lay beneath shows. */
  flat: [5.4, 6.2] as const,
  fall: [5.4, 6.1] as const,
  hole: [5.9, 6.7] as const,
  wreckIn: [6.3, 6.8] as const,
  label: [6.3, 6.6] as const,
  /** "1 / 2" becomes "2 / 2" (playKillConfirmed). */
  count: 6.85,
  /** Act 5, back. */
  back: [7.2, 8.2] as const,
};

/**
 * Dimensional Shatter, the third kill for Gamma (designer 2026-11-21): 8.0 s in four acts. The Gamma turns
 * into an unstable breach, shatters in slow motion and a shock wave cleans the whole Field.
 */
export const SHATTER = {
  total: 8.0,
  /** Act 1 (0-2.2), reactor criticality: a frozen moment on the killing blow (nothing moves), then the zoom, the tilt and a tremor that grows (playBossCoreCritical). */
  hitStop: [0, 0.2] as const,
  critical: 0.2,
  zoomIn: [0.2, 1.3] as const,
  tilt: [0.3, 1.8] as const,
  /** Crimson and white-hot fractures spread from the middle to the six edges, light rays leak out of them. */
  cracks: [0.35, 2.05] as const,
  /** Motes and loose debris of the sectors round it are pulled in; the core collapses into a tiny singularity. */
  pull: [0.4, 2.2] as const,
  core: [1.0, 2.2] as const,
  /** Act 2 (2.2-4.8), the shatter: the tile bursts upwards into shards (playSlowMoShatter) and time slows to bullet time. */
  shatter: 2.2,
  slow: [2.26, 2.75] as const,
  /** A dimensional rift tears open under the shards (playDimensionalRift) and pulses; arcs of plasma jump between the shards. */
  rift: [2.3, 4.55] as const,
  arcs: [2.45, 4.7] as const,
  /** The core implodes, pulling the light in. */
  implode: [4.5, 4.8] as const,
  /** Act 3 (4.8-6.6), shock wave: normal time snaps back with a blinding flash (playCataclysmShockwave), the shards are blasted away. */
  blast: 4.8,
  /** The searing inner ring, then the distortion wave; each sector's edge flares and turns from threat crimson to the cleared colour as the first reaches it. */
  wave1: [4.8, 6.0] as const,
  wave2: [4.95, 6.4] as const,
  wreckIn: [5.2, 5.9] as const,
  label: [5.5, 5.8] as const,
  /** "1 / 2" becomes "2 / 2" (playKillConfirmed). */
  count: 6.05,
  /** Act 4 (6.6-8.0), purified: the crater smoulders, embers rise, "TARGET NEUTRALIZED // SECTOR CLEAR" (playSectorPurified); the board turns flat and the zoom eases back. */
  purified: 6.6,
  telemetry: [6.6, 7.9] as const,
  back: [6.9, 8.0] as const,
  /** Reduced motion and Instant: 2 s, a flash of the plasma core and a liberation wave of light over the hexes (no shake, nothing flying). */
  still: 2.0,
};

/** Bullet time in Dimensional Shatter: the shards' speed against the clock at time t (1 = normal). */
export const SLOW_RATE = 0.035;
export function timeDilation(t: number): number {
  if (t < SHATTER.slow[0] || t >= SHATTER.blast) return 1;
  if (t >= SHATTER.slow[1]) return SLOW_RATE;
  const u = (t - SHATTER.slow[0]) / (SHATTER.slow[1] - SHATTER.slow[0]);
  return 1 - (1 - SLOW_RATE) * (3 * u * u - 2 * u * u * u);
}
/** The shards' own clock: seconds since the shatter, slowed by timeDilation (its integral, worked out exactly from t). */
export function shardTime(t: number): number {
  if (t <= SHATTER.shatter) return 0;
  const [a, b] = SHATTER.slow;
  const L = b - a;
  const tt = Math.min(t, SHATTER.blast);
  let s = Math.min(tt, a) - SHATTER.shatter;
  if (tt > a) {
    const u = Math.min(1, (tt - a) / L);
    s += L * (u - (1 - SLOW_RATE) * (u ** 3 - u ** 4 / 2));
  }
  if (tt > b) s += SLOW_RATE * (tt - b);
  if (t > SHATTER.blast) s += t - SHATTER.blast;
  return s;
}


/**
 * Salvage milestones (designer 2026-11-22; salvageFx.ts). Grid Online: the fifth Power Node reaches the
 * Trophy pile (8.2). About 4.6 s.
 */
export const NODES = {
  total: 4.6,
  /** Act 1: zoom in; energy of the three colours circles the Power Node. */
  zoomIn: [0, 0.8] as const,
  orbit: [0.1, 1.75] as const,
  /** Act 2: four streams pour in from the top of the Field (the four Power Nodes already taken). */
  link: [0.75, 1.6] as const,
  /** Act 3: the node ignites and goes up as a column of energy (playGridOnline). */
  ignite: 1.75,
  column: [1.75, 2.9] as const,
  wreckIn: [2.0, 2.4] as const,
  label: [2.2, 2.45] as const,
  count: 2.7,
  back: [3.7, 4.6] as const,
};

/** Sector Lock: the third Cleared sector, with 5 Power Nodes already taken (designer 2026-11-22). About 4.6 s. */
export const CLEARED = {
  total: 4.6,
  zoomIn: [0, 0.8] as const,
  /** Act 1: a scan ring of particles sweeps the empty sector. */
  scan: [0.2, 1.0] as const,
  /** Act 2: beams of particles leap to the other Cleared sectors (playClearedLink). */
  beams: [1.0, 1.7] as const,
  /** Act 3: lock; the sectors flash, a field fills between them, a ring goes out (playSectorLock). */
  lock: 1.75,
  field: [1.75, 3.4] as const,
  wreckIn: [1.0, 1.3] as const,
  label: [2.1, 2.35] as const,
  count: 2.6,
  back: [3.7, 4.6] as const,
};

/**
 * Fusion Ignition (designer 2026-11-27: two more for the fifth Power Node; nodesFx.ts). About 4.8 s.
 */
export const FUSION = {
  total: 4.8,
  zoomIn: [0, 0.8] as const,
  /** Act 1: three confinement rings (Yellow, Red, Blue) gather round the node one by one and spin up, tilting like a gyroscope. */
  rings: [0.15, 1.85] as const,
  ringAt: [0.15, 0.4, 0.65] as const,
  /** Act 2: plasma filaments pinch in from the rings to the core; it brightens. */
  pinch: [1.15, 1.85] as const,
  /** Act 3: ignition (playFusionIgnite): a small sun with a corona of looping particles. */
  ignite: 1.9,
  sun: [1.9, 3.7] as const,
  /** The four Power Nodes already taken show as stars round it; the fifth flies out of the sun to close the ring. */
  stars: [2.15, 2.75] as const,
  fifth: [2.75, 3.05] as const,
  wreckIn: [2.2, 2.6] as const,
  label: [2.3, 2.55] as const,
  count: 3.05,
  back: [3.85, 4.8] as const,
};

/** Charge Cascade (designer 2026-11-27; nodesFx.ts). About 4.9 s. */
export const CASCADE = {
  total: 4.9,
  zoomIn: [0, 0.8] as const,
  /** Act 1: five charge cells open in an arc over the node; four light up one by one (playCascadeCell), the fifth stays empty. */
  cells: [0.2, 1.0] as const,
  /** Act 2: the node's energy condenses into a crystal of the three colours over the tile. */
  condense: [0.95, 1.8] as const,
  /** It rises into the fifth cell (the tile is gone; what lies beneath shows). */
  rise: [1.8, 2.3] as const,
  /** Act 3: the fifth cell locks (playCascadeLock); the cells flare one by one, arcs leap between them. */
  lock: 2.3,
  cascade: [2.3, 2.95] as const,
  /** Act 4: they discharge into the sector (playCascadeDischarge): five bolts, a pulse over the Field. */
  dump: 3.1,
  pulse: [3.1, 4.0] as const,
  wreckIn: [1.85, 2.3] as const,
  label: [2.35, 2.6] as const,
  count: 2.45,
  back: [4.0, 4.9] as const,
};

/** Claim Markers (designer 2026-11-27: two more for the third Cleared sector; clearedFx.ts). About 4.8 s. */
export const CLAIM = {
  total: 4.8,
  zoomIn: [0, 0.8] as const,
  /** Act 1: a claim stake falls from above the page on a trail and strikes the sector (playClaimStake). */
  drop: [0.45, 1.1] as const,
  impact: 1.1,
  wreckIn: [1.1, 1.4] as const,
  /** It unfolds its three legs, its beacon blinks, a hologram of the claim builds over it. */
  unfold: [1.15, 1.5] as const,
  holo: [1.35, 2.0] as const,
  /** Act 2: arches of particles reach the other Cleared sectors; their markers wake (playClaimLink). */
  arcs: [2.0, 2.75] as const,
  /** Act 3: the three claims lock together (playClaimLock). */
  lock: 3.05,
  glow: [3.05, 3.9] as const,
  label: [2.6, 2.85] as const,
  count: 3.05,
  back: [3.9, 4.8] as const,
};

/** Terrain Survey (designer 2026-11-27; clearedFx.ts). About 4.8 s. */
export const SURVEY = {
  total: 4.8,
  zoomIn: [0, 0.8] as const,
  wreckIn: [0.2, 0.5] as const,
  /** Act 1: a ping from the sector (playSurveyPing); range rings and a grid. */
  ping: 0.6,
  /** Act 2: a radar sweep turns twice round the whole Field; each Cleared sector it passes answers. */
  sweep: [0.8, 3.0] as const,
  /** Contour lines bloom over each Cleared sector (the new one first, the others on the sweep's second pass). */
  contour: [1.0, 3.4] as const,
  /** Act 3: the survey is stamped (playSurveyLock): brackets snap round the three sectors. */
  lock: 3.05,
  label: [2.5, 2.75] as const,
  count: 3.05,
  back: [3.9, 4.8] as const,
};

/** Each kill's length and pull-out (the win waits for the pull-out when both come in one answer). */
export const KILL_TIMES: Record<string, { total: number; back: readonly [number, number] }> = {
  alphaDown: KILL,
  alphaPurge: PURGE,
  alphaRail: RAIL,
  alphaErase: ERASE,
  alphaBurnout: BURNOUT,
  alphaTether: TETHER,
  betaBreach: BREACH,
  betaBarrage: BARRAGE,
  betaCryo: CRYO,
  gammaHorizon: HORIZON,
  gammaArray: ARRAY,
  gammaShatter: SHATTER,
  salvageNodes: NODES,
  salvageCleared: CLEARED,
  salvageFusion: FUSION,
  salvageCascade: CASCADE,
  salvageClaim: CLAIM,
  salvageSurvey: SURVEY,
};

/** Mission Complete, the win: about 5 s (after the Trophies that came in with the answer have flown to the Mission bar). */
export const WIN = {
  total: 5.0,
  /** Act 1, Trophy: the Field dims a little; the Mission bar's cells flare one after another. */
  dim: [0, 0.5] as const,
  cellsAt: 0.1,
  cellStep: 0.09,
  /** The last cell bursts this long after its flare. */
  burstAfter: 0.14,
  /**
   * Act 2, energy sweep (designer 2026-11-20, I23: no ring; I24: no shine): a crackling front of energy
   * made of particles sweeps across the whole Field, away from the sector the unit left, tracing each
   * sector's edge as it passes; it comes in and goes out beyond the Field's edges, wake and all, so it
   * never stops on the Field (playWinSweep). The same colours for every Company (I25).
   */
  wave: [1.0, 2.2] as const,
  /** Act 3, banner: MISSION COMPLETE slams in (playMissionComplete), the line under it, the badges drop. */
  slam: [2.2, 2.45] as const,
  sub: [2.55, 2.8] as const,
  badgesAt: 2.8,
  badgeStep: 0.1,
  badgeFall: 0.3,
  /** Act 4, clear: sparks drift, everything fades, then the Upgrade sheet. */
  out: [4.4, 5.0] as const,
};

/**
 * Perimeter Sweep, the second win (designer 2026-11-21): 5.0 s of precision victory telemetry. The Mission
 * bar's cells charge like capacitors and the last bursts; a ring of energy sweeps out over the whole Field,
 * each sector's edge flashing and staying "secured"; the banner slams in, the line under it types in,
 * stamped metal badges drop; embers rise and it fades into the Upgrade sheet.
 */
export const SWEEP = {
  total: 5.0,
  /** Act 1 (0-1.0): the Field dims by about 35%; the cells ignite left to right (onTrophyCellIgnite), the last overcharges and bursts (onMissionBarBurst). */
  dim: [0, 0.45] as const,
  dimTo: 0.35,
  cellsAt: 0.12,
  /** The cells' cascade fits in this long, whatever their number (at most 0.11 s apart). */
  cellsIn: 0.62,
  cellStep: 0.11,
  burstAfter: 0.16,
  /** Act 2 (1.0-2.2): the ring sweeps out from the sector the unit left (onVictoryWave), right off the Field by the end. */
  wave: [1.0, 2.2] as const,
  /** Act 3 (2.2-3.8): MISSION COMPLETE slams in with a micro-bounce (onVictoryBannerSlam); the line types in; the badges stamp down 0.1 s apart (onBadgeDrop). */
  slam: [2.2, 2.42] as const,
  sub: [2.5, 2.95] as const,
  badgesAt: 2.95,
  badgeStep: 0.1,
  badgeFall: 0.16,
  /** Act 4 (3.8-5.0): embers drift up; the overlay cross-fades out (onUpgradeSheetOpen) into the Upgrade sheet. */
  embers: 3.8,
  out: [4.2, 5.0] as const,
};

/**
 * Sector Flip, the third win (designer 2026-11-21): 5.2 s. The Mission bar locks in; one by one in a wave
 * across the Field every sector (a heavy plate) lifts, turns a full 360° and slams back down; the Debrief
 * card with the readout; motes drift and it fades into the Upgrade sheet.
 */
export const FLIP = {
  total: 5.2,
  /** Act 1 (0-1.0): the Field dims; the cells light in sequence, the last one pulses with a ring and locks (onAltWinTrophyLock). */
  dim: [0, 0.5] as const,
  dimTo: 0.3,
  cellsAt: 0.1,
  cellsIn: 0.6,
  cellStep: 0.1,
  lockAfter: 0.12,
  /** Act 2 (1.0-3.1): the sectors flip in a wave, column by column, at most 0.16 s apart. */
  flips: [1.0, 3.1] as const,
  maxStep: 0.16,
  /** One sector's flip, seconds from its start: lift (onSectorLift), the turn, the drop and the slam (onSectorSlam). */
  lift: [0, 0.16] as const,
  turn: [0.1, 0.56] as const,
  drop: [0.58, 0.7] as const,
  slamAt: 0.7,
  /** All of one sector's flip, its rim flash and its dust (0.7 s up and down, 0.3 s of after-effects). */
  one: 1.0,
  /** Act 3 (3.1-4.2): the Debrief card enters with the readout and the badges (onAltWinDebrief). */
  card: [3.1, 3.5] as const,
  sub: [3.35, 3.65] as const,
  badgesAt: 3.6,
  badgeStep: 0.06,
  badgeFall: 0.22,
  /** Act 4 (4.2-5.2): motes drift; the overlay cross-fades out (onUpgradeSheetOpen). */
  out: [4.4, 5.2] as const,
};

/**
 * Chain Surge, the fourth win (designer 2026-11-27: "create 2 new mission complete celebrations. Be creative
 * and put more effort"): 5.4 s. Current runs along the Mission bar and a bolt drops from its last cell into
 * the Field; lightning leaps sector to sector until the whole Field is one glowing network; light runs back
 * along it to where it began and a bolt climbs to the Mission bar; the banner; the network crumbles to motes.
 */
export const SURGE = {
  total: 5.4,
  /** Act 1 (0-1.0): the Field dims; an arc runs cell to cell along the Mission bar, lighting each; the last drops a bolt into the Field (onSurgeStrike). */
  dim: [0, 0.45] as const,
  dimTo: 0.42,
  cellsAt: 0.15,
  cellsIn: 0.5,
  cellStep: 0.1,
  /** The bolt from the last cell to the first sector strikes at drop[1]. */
  drop: [0.78, 0.9] as const,
  /** Act 2 (1.0-2.9): the surge leaps sector to sector (onSurgeLeap per hop); every sector lit by spread[1]. */
  spread: [0.9, 2.75] as const,
  /** One hop at most this long (fewer hops: slower, more weight to each). */
  maxHop: 0.2,
  /** How long a leap's arc burns before it settles into a glowing link. */
  arc: 0.32,
  /** Act 3 (2.9-3.9): light runs back along every link to where it began (the pulse), then a bolt climbs to the Mission bar (onSurgeUplink) and the bar turns gold. */
  pulse: [2.85, 3.35] as const,
  uplink: [3.3, 3.45] as const,
  slam: [3.45, 3.68] as const,
  sub: [3.75, 4.0] as const,
  badgesAt: 3.95,
  badgeStep: 0.08,
  badgeFall: 0.26,
  /** Act 4 (3.9-5.4): the network crumbles to motes that drift up; the cross-fade. */
  crumble: 3.9,
  out: [4.6, 5.4] as const,
};

/**
 * Beacon Spiral, the fifth win (designer 2026-11-27): 5.6 s. The Mission bar's cells lock like targets and
 * markers appear on every sector; beams of light fall from orbit onto the sectors one after another in a
 * spiral from the edge of the Field to its middle, each pressing its tile down and leaving it lit; every
 * sector pours its light into the middle and one pillar of light fires up off the screen; the banner.
 */
export const BEACON = {
  total: 5.6,
  /** Act 1 (0-1.0): the Field dims; the cells lock (brackets close on them); a targeting marker on every sector, outside in. */
  dim: [0, 0.5] as const,
  dimTo: 0.5,
  cellsAt: 0.1,
  cellsIn: 0.5,
  cellStep: 0.1,
  marks: [0.35, 0.95] as const,
  /** Act 2 (1.0-3.0): the beams fall, the edge of the Field first, spiralling in (onBeaconStrike per beam). */
  strikes: [1.0, 2.8] as const,
  /** One beam: it falls this long, then burns and narrows away over `burn`. */
  fall: 0.09,
  burn: 0.55,
  /** Act 3 (3.0-4.0): every sector's light streams into the middle (gather), the pillar fires up (onBeaconPillar) and the bar turns gold; the banner. */
  gather: [2.9, 3.35] as const,
  pillar: 3.35,
  slam: [3.5, 3.72] as const,
  sub: [3.8, 4.05] as const,
  badgesAt: 4.0,
  badgeStep: 0.08,
  badgeFall: 0.26,
  /** Act 4 (4.0-5.6): the pillar thins and goes, motes rise; the cross-fade. */
  fade: 4.0,
  out: [4.8, 5.6] as const,
};

/**
 * Resonance, a win (designer 2026-11-27, "be ambitious"; resonanceFx.ts): the Field turns into a
 * surface of light that ripples, echoes off its edges, then rings as one and locks.
 */
export const RESONANCE = {
  total: 5.8,
  /** Act 1 (0-1.0): the Field dims; each cell of the Mission bar charges; the last lets a drop of light fall into the sector the unit left (onResonanceDrop). */
  dim: [0, 0.45] as const,
  dimTo: 0.4,
  cellsAt: 0.15,
  cellsIn: 0.45,
  cellStep: 0.1,
  drop: [0.65, 1.0] as const,
  /** Act 2 (1.0-3.0): the splash (onResonanceSplash); ripples run out and echo off the Field's edges; a second, answering drop at the far side (echoAt). */
  splash: 1.0,
  echoAt: 1.65,
  /** How long a ripple takes to cross the farthest stretch of the Field (s). */
  cross: 1.05,
  /** Ripples per second, and how fast one dies (s). */
  freq: 2.4,
  decay: 0.75,
  /** The ripples calm before the Field rings as one. */
  calm: [2.55, 3.0] as const,
  /** Act 3 (3.0-4.4): every tile rises and falls together, louder each beat (onResonancePulse), then locks flat in a flash (onResonanceLock) and the bar turns gold. */
  ring: [3.0, 3.7] as const,
  beats: 4,
  lock: 3.7,
  slam: [3.78, 4.0] as const,
  sub: [4.08, 4.32] as const,
  badgesAt: 4.28,
  badgeStep: 0.08,
  badgeFall: 0.26,
  /** Act 4 (4.4-5.8): the lattice of light fades; motes lift off the still surface. */
  fade: 4.4,
  out: [5.0, 5.8] as const,
};

/**
 * Murmuration, a win (designer 2026-11-27, "be ambitious"; murmurationFx.ts): a swarm of hundreds of
 * drones of light pours out of the Mission bar, swoops over every sector, forms an emblem round the
 * banner, then bursts.
 */
export const MURMUR = {
  total: 6.0,
  /** Act 1 (0-1.1): the Field dims; streams of drones pour from each cell of the Mission bar into the sector the unit left (onSwarmRelease). */
  dim: [0, 0.45] as const,
  dimTo: 0.45,
  cellsAt: 0.1,
  cellsIn: 0.45,
  cellStep: 0.1,
  gather: 1.1,
  /** Act 2 (1.1-3.2): the swarm swoops sector to sector over the whole Field, claiming each it passes (onSwarmClaim). */
  route: [1.1, 3.15] as const,
  /** How far behind the swarm's head a drone may trail (s): the flock's tail. */
  lag: 0.24,
  /** Act 3 (3.2-4.6): the drones form an emblem round the middle (onSwarmForm), it flares and the bar turns gold; the banner. */
  form: [3.15, 3.7] as const,
  flare: 3.72,
  slam: [3.78, 4.0] as const,
  sub: [4.08, 4.32] as const,
  badgesAt: 4.28,
  badgeStep: 0.08,
  badgeFall: 0.26,
  /** Act 4 (4.6-6.0): the emblem bursts, the drones streak off the Field (onSwarmBurst); the cross-fade. */
  burst: 4.6,
  out: [5.2, 6.0] as const,
};

/**
 * Singularity, a win (designer 2026-11-27, "be ambitious"; singularityFx.ts): the Mission bar feeds a
 * point of light in the Field's middle that becomes a black well; the whole board is drawn in, turning,
 * then it goes nova and every tile is flung back to its place.
 */
export const SINGULAR = {
  total: 6.0,
  /** Act 1 (0-1.2): the Field dims; each cell sends a thread of light into the Field's middle (onSingularityFeed); the core forms, its disc spins up. */
  dim: [0, 0.45] as const,
  dimTo: 0.45,
  cellsAt: 0.12,
  cellsIn: 0.45,
  cellStep: 0.1,
  feed: 0.55,
  core: [0.5, 1.2] as const,
  /** Act 2 (1.2-3.0): the pull (onSingularityPull): the tiles slide in and turn round the well, the far ones last; streaks of light are torn off them into the disc. */
  pull: [1.2, 2.95] as const,
  /** How much of the way to the middle a tile goes, and how far it turns (radians), at most. */
  squeeze: 0.62,
  turn: 0.85,
  /** Act 3 (3.0-4.6): the nova (onSingularityNova): a flash, the tiles flung back past their places and settling, a shock ring off the Field, the bar turns gold; the banner. */
  nova: 3.0,
  slam: [3.4, 3.62] as const,
  sub: [3.7, 3.94] as const,
  badgesAt: 3.9,
  badgeStep: 0.08,
  badgeFall: 0.26,
  /** Act 4 (4.6-6.0): a halo stays round the banner; embers drift outwards; the cross-fade. */
  embers: 4.6,
  out: [5.2, 6.0] as const,
};

/**
 * Armillary, a win (designer 2026-11-27, "be ambitious"; armillaryFx.ts): three great rings of particles
 * are drawn round the Field like an armillary sphere, spin through the board lighting every sector they
 * cross, then fall into one plane and lock as a triple halo round the banner.
 */
export const ARMILLARY = {
  total: 5.8,
  /** Act 1 (0-1.1): the Field dims; three orbs leave the Mission bar and each draws a ring as it runs round (onArmillaryLaunch). */
  dim: [0, 0.45] as const,
  dimTo: 0.42,
  launch: [0.1, 0.2, 0.3] as const,
  draw: 0.45,
  /** Act 2 (1.1-3.1): the rings spin through the Field in three tilts (onArmillarySpin); every sector a ring's near side crosses lights and lifts. */
  spin: [1.1, 3.1] as const,
  /** Act 3 (3.1-4.5): the rings fall into one plane and nest round the middle; they lock in a flash (onArmillaryLock) and the bar turns gold; the banner. */
  align: [3.1, 3.7] as const,
  lock: 3.7,
  slam: [3.78, 4.0] as const,
  sub: [4.08, 4.32] as const,
  badgesAt: 4.28,
  badgeStep: 0.08,
  badgeFall: 0.26,
  /** Act 4 (4.5-5.8): the halo widens and breaks into motes; the cross-fade. */
  release: 4.5,
  out: [5.0, 5.8] as const,
};

/**
 * Aurora, a win (designer 2026-11-28, "be ambitious"; auroraFx.ts): the Field falls into night; three
 * curtains of aurora light fold down across it, each sector glowing and swaying as one passes; the rays
 * turn to meet in a crown over the banner.
 */
export const AURORA = {
  total: 6.0,
  /** Act 1 (0-1.0): the Field falls into night, stars come out, the cells shimmer and the first curtain unfurls from the Mission bar (onAuroraRise). */
  dim: [0, 0.6] as const,
  dimTo: 0.55,
  cellsAt: 0.1,
  cellsIn: 0.4,
  cellStep: 0.08,
  rise: [0.4, 1.0] as const,
  /** Act 2 (1.0-3.3): the three curtains fold down across the Field, one after another (onAuroraCurtain). */
  curtains: [0.45, 0.85, 1.25] as const,
  /** How long a curtain takes from the top of the Field to the bottom (s). */
  cross: 2.1,
  /** Act 3 (3.3-4.6): the curtains gather into one band, their rays turn to meet in a crown over the middle; it flares (onAuroraCrown) and the bar turns gold; the banner. */
  gather: [3.1, 3.65] as const,
  crown: 3.7,
  slam: [3.78, 4.0] as const,
  sub: [4.08, 4.32] as const,
  badgesAt: 4.28,
  badgeStep: 0.08,
  badgeFall: 0.26,
  /** Act 4 (4.6-6.0): the light climbs away off the top of the Field; the stars fade; the cross-fade. */
  fade: 4.6,
  out: [5.2, 6.0] as const,
};

/**
 * Circuit Trace, a win (designer 2026-11-28, "be ambitious"; circuitFx.ts): a pulse from the Mission bar
 * runs into the gutters between the sectors and spreads along every edge like a circuit board; each sector
 * powers up as its six edges close; the whole board pulses and locks gold.
 */
export const CIRCUIT = {
  total: 5.6,
  /** Act 1 (0-0.9): the Field dims; the cells light one by one; a pulse drops from the bar into the nearest corner of the board (onCircuitEntry). */
  dim: [0, 0.45] as const,
  dimTo: 0.5,
  cellsAt: 0.1,
  cellsIn: 0.4,
  cellStep: 0.09,
  drop: [0.55, 0.9] as const,
  /** Act 2 (0.9-3.2): the traces run along every edge, forking at each corner (the farthest corner at run[1]); each sector powers up as its last edge closes (onCircuitPower). */
  run: [0.9, 2.75] as const,
  /** Act 3 (3.2-4.4): packets race round the whole circuit; it locks gold (onCircuitLock) and the bar turns gold; the banner. */
  surge: [2.95, 3.55] as const,
  lock: 3.6,
  slam: [3.72, 3.94] as const,
  sub: [4.02, 4.26] as const,
  badgesAt: 4.22,
  badgeStep: 0.08,
  badgeFall: 0.26,
  /** Act 4 (4.4-5.6): the traces cool from the edge of the Field inwards; sparks; the cross-fade. */
  cool: 4.4,
  out: [4.9, 5.6] as const,
};

/** The still picture of either piece (reduced motion, Instant), seconds. */
export const STILL = 1.5;

/** Trophy flight before the win: the chip's own timing (flyers.ts trophyFlights: 0.25 s wait, 0.9 s flight, 0.16 s apart). */
export const FLY = { wait: 0.25, flight: 0.9, apart: 0.16 };

/** 0..1 through [a, b]. */
export const span = (t: number, [a, b]: readonly [number, number]) => Math.min(1, Math.max(0, (t - a) / (b - a)));
