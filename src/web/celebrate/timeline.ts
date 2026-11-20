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

/** Mission Complete, the win: about 5 s (after the Trophies that came in with the answer have flown to the Mission bar). */
export const WIN = {
  total: 5.0,
  /** Act 1, Trophy: the Field dims a little; the Mission bar's cells flare one after another. */
  dim: [0, 0.5] as const,
  cellsAt: 0.1,
  cellStep: 0.09,
  /** The last cell bursts this long after its flare. */
  burstAfter: 0.14,
  /** Act 2, wave: a ring in the Company's colour from the sector the unit left (playWinShockwave). */
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
