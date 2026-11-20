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

/** Each kill's length and pull-out (the win waits for the pull-out when both come in one answer). */
export const KILL_TIMES: Record<string, { total: number; back: readonly [number, number] }> = {
  alphaDown: KILL,
  alphaPurge: PURGE,
  betaBreach: BREACH,
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
   * Act 2, shine (designer 2026-11-20, I23: no ring): a broad band of light in the Company's colour sweeps
   * across the whole Field, away from the sector the unit left, lighting each sector as it passes; it
   * comes in and goes out beyond the Field's edges, so it never stops on the Field (playWinSweep).
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
