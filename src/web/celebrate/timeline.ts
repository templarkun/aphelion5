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

/** Each kill's length and pull-out (the win waits for the pull-out when both come in one answer). */
export const KILL_TIMES: Record<string, { total: number; back: readonly [number, number] }> = {
  alphaDown: KILL,
  alphaPurge: PURGE,
  betaBreach: BREACH,
  gammaHorizon: HORIZON,
  gammaArray: ARRAY,
  gammaShatter: SHATTER,
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

/** The still picture of either piece (reduced motion, Instant), seconds. */
export const STILL = 1.5;

/** Trophy flight before the win: the chip's own timing (flyers.ts trophyFlights: 0.25 s wait, 0.9 s flight, 0.16 s apart). */
export const FLY = { wait: 0.25, flight: 0.9, apart: 0.16 };

/** 0..1 through [a, b]. */
export const span = (t: number, [a, b]: readonly [number, number]) => Math.min(1, Math.max(0, (t - a) / (b - a)));
