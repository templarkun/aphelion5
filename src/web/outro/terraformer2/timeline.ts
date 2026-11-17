/**
 * Terraformer 2.0 (designer 2026-11-17): when things happen, in seconds of film at Normal speed.
 * Kept apart from the drawing so the sound hooks, the captions and the tests read the same numbers.
 * Slower and heavier than 1.0 (terraformer/timeline.ts): the pylons are lowered out of the bay,
 * drift free for 1.2 s while they turn upright, light their braking thrusters and come down on
 * them; they anchor gently, one after another.
 *
 *   Act 1  0.0 -  4.2  under the ship: bay doors, the pylons lowered, the drift, the thrusters light
 *   Act 2  4.2 -  9.0  controlled descent: the camera follows them down to the cloud deck
 *   Act 3  9.0 - 12.2  anchor lock: each pylon anchors, fires its beam; the clouds clear in rings
 *   Act 4 12.2 - 15.0  the camera pulls back, the sun rises, the Debrief slides in
 * After FILM_SECONDS the picture keeps drifting slowly under the Debrief card.
 */

export const FILM_SECONDS = 15;
/** When each act begins. */
export const ACT_AT = [0, 4.2, 9.0, 12.2] as const;
export const ACT_NAMES = ["Orbital deployment", "Controlled descent", "Anchor lock", "Orbital dawn"] as const;

/** The bay doors: when they start to move (sound hook) and when they stand open. */
export const DOORS_AT = 0.45;
export const DOORS_OPEN_AT = 1.8;
/** The first pylon is lowered out of the bay; the others follow one by one. */
export const RELEASE_AT = 1.75;
const RELEASE_STEP = 0.12;
/** A pylon is lowered on its cradle for LOWER s, then drifts free for DRIFT s (zero-G, turning upright). */
export const LOWER = 0.7;
export const DRIFT = 1.2;
/** The pylons reach the upper air: their wings open a little (sound hook). */
export const ENTRY_AT = 6.3;
/** The first pylon anchors; the others follow in a steady beat, the last by LAST_ANCHOR at the latest. */
export const FIRST_ANCHOR = 9.15;
export const ANCHOR_STEP = 0.42;
export const LAST_ANCHOR = 11.7;
/** After anchoring, a pylon fires its beam this much later; the clouds start to clear from it a little after. */
export const BEAM_DELAY = 0.35;
export const SEED_DELAY = 0.5;
/** The sun comes over the edge (sound hook), and the Debrief card slides in. */
export const RESOLVE_AT = 12.4;
export const DEBRIEF_AT = 13.2;
/** The moment shown as one still picture with reduced motion or the Instant speed. */
export const STILL_AT = 17.5;

/** Never fewer than one pylon, never more than twelve (a Campaign of more missions shares them). */
export const MAX_PYLONS = 12;
export const pylonCount = (missions: number) => Math.min(MAX_PYLONS, Math.max(1, Math.round(missions) || 7));

/** Which act is playing at film time t: 1 to 4. */
export function actAt(t: number): 1 | 2 | 3 | 4 {
  return t >= ACT_AT[3] ? 4 : t >= ACT_AT[2] ? 3 : t >= ACT_AT[1] ? 2 : 1;
}

/** When pylon k (0 = first) anchors. */
export function anchorTimes(n: number): number[] {
  const step = n > 1 ? Math.min(ANCHOR_STEP, (LAST_ANCHOR - FIRST_ANCHOR) / (n - 1)) : 0;
  return Array.from({ length: n }, (_, k) => FIRST_ANCHOR + k * step);
}
/** When pylon k starts down out of the bay: all are lowered, have drifted and lit their thrusters within Act 1. */
export function releaseTimes(n: number): number[] {
  const step = n > 1 ? Math.min(RELEASE_STEP, (ACT_AT[1] - 0.1 - LOWER - DRIFT - RELEASE_AT) / (n - 1)) : 0;
  return Array.from({ length: n }, (_, k) => RELEASE_AT + k * step);
}
/** When pylon k lights its braking thrusters (the end of its drift). */
export function ignitionTimes(n: number): number[] {
  return releaseTimes(n).map((r) => r + LOWER + DRIFT);
}

/** How many pylons have anchored by film time t. */
export function anchorsBy(t: number, n: number): number {
  return anchorTimes(n).filter((x) => t >= x).length;
}

export { sitePlaces, type SitePlace } from "../terraformer/timeline.js";
