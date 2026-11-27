/**
 * Two more victory outros (designer 2026-11-27: "create another 2 creative mission complete victory
 * animations"): what a won Campaign can show at Game End (Core Rules 10.3), beside Terraformer 1.0 /
 * 2.0, Surface Terraform and Orbital Claim. Both are in System options; 2.0 stays the one after a won
 * game until the designer says otherwise. When things happen, in seconds of film at Normal speed; kept
 * apart from the drawing so the sound hooks, the captions and the tests read the same numbers.
 * Screen only: nothing here is a rule.
 */

import { hash01 as hashOf } from "../loss/timeline.js";

export { hash01 } from "../loss/timeline.js";

/**
 * Homecoming: the Flagship comes home after the Campaign.
 *   Act 1  0.0 - 2.8  deep space by the Company's home world; a jump flash, the Flagship drops out of its jump
 *   Act 2  2.8 - 5.8  escort craft peel in from both sides and form an honour guard round it; the station ahead
 *   Act 3  5.8 - 8.6  the victory salute: one burst of light per mission won; the station's ring lights up
 *   Act 4  8.6 -      the Flagship slides onto the docking arm, the clamps lock; the escorts peel away; the Debrief
 */
export const HOME = {
  FILM_SECONDS: 11.6,
  ACT_AT: [0, 2.8, 5.8, 8.6] as const,
  ACT_NAMES: ["Jump return", "Honour guard", "Victory salute", "Home berth"] as const,
  /** The jump flash: the Flagship drops out of its jump (sound hook). */
  ARRIVE_AT: 0.6,
  /** The escort craft: how many, when the first peels in (sound hook), how far apart, how long each flies to its place. */
  ESCORTS: 14,
  ESCORT_AT: 2.9,
  ESCORT_STEP: 0.12,
  ESCORT_FLY: 1.3,
  /** The salute: the first burst, the last one no later than SALUTE_END (one per mission won). */
  SALUTE_AT: 6.0,
  SALUTE_END: 8.2,
  /** A burst's tracer climbs this long before it bursts. */
  TRACER: 0.4,
  /** The station's ring lights segment by segment between these. */
  RING_AT: 6.0,
  RING_FULL: 8.4,
  RING_SEGMENTS: 24,
  /** The Flagship's clamps lock on the docking arm (sound hook). */
  DOCK_AT: 8.9,
  /** The escorts peel away after the dock, one every PEEL_STEP. */
  PEEL_AT: 9.0,
  PEEL_STEP: 0.06,
  /** The last chord (sound hook: playVictoryResolve), then the Debrief card. */
  RESOLVE_AT: 9.0,
  DEBRIEF_AT: 9.6,
  /** The moment shown as one still picture with reduced motion or the Instant speed. */
  STILL_AT: 11.0,
} as const;

/**
 * Star Chart: the Campaign written into the sky.
 *   Act 1  0.0 - 3.2  the dark; one star ignites per mission won, in the order played, its tag beside it
 *   Act 2  3.2 - 6.0  streams of light run from star to star and draw the Campaign's constellation; one small star per Threat column
 *   Act 3  6.0 - 8.6  the constellation flares; the camera pulls far back and a whole galaxy appears round it
 *   Act 4  8.6 -      a slow turn of the galaxy, the new constellation marked on its arm; the Debrief
 */
export const CHART = {
  FILM_SECONDS: 11.2,
  ACT_AT: [0, 3.2, 6.0, 8.6] as const,
  ACT_NAMES: ["Campaign record", "Constellation", "Ascension", "Legacy"] as const,
  /** The first star ignites (sound hook, once per star); the last no later than IGNITE_END. */
  IGNITE_AT: 0.5,
  IGNITE_END: 2.9,
  /** A star's Threat companions appear one after another, this far apart, after it ignites. */
  COMPANION_STEP: 0.14,
  /** The links between the stars: the first leaves at LINK_AT (sound hook), the last arrives by LINK_END; each takes LINK_FLY. */
  LINK_AT: 3.3,
  LINK_END: 5.7,
  LINK_FLY: 0.6,
  /** The constellation flares (sound hook) and the camera pulls back until PULL_END. */
  ASCEND_AT: 6.1,
  PULL_END: 8.6,
  /** The last chord (sound hook: playVictoryResolve), then the Debrief card. */
  RESOLVE_AT: 8.6,
  DEBRIEF_AT: 9.2,
  /** The moment shown as one still picture with reduced motion or the Instant speed. */
  STILL_AT: 10.6,
} as const;

/** The two films' ids. */
export const VICTORY_IDS = ["homecoming", "starchart"] as const;
export type VictoryId = (typeof VICTORY_IDS)[number];

/** n moments evenly spread from a to b (one: a). */
function spread(n: number, a: number, b: number): number[] {
  const k = Math.max(1, n);
  return Array.from({ length: k }, (_, i) => (k === 1 ? a : a + ((b - a) * i) / (k - 1)));
}

// ---- Homecoming ----

/** When escort k peels in, and when it is in its place in the honour guard. */
export function escortIn(k: number): number {
  return HOME.ESCORT_AT + k * HOME.ESCORT_STEP;
}
export function escortSet(k: number): number {
  return escortIn(k) + HOME.ESCORT_FLY;
}
/** How many escorts are in formation at film time t. */
export function escortsFormed(t: number): number {
  let n = 0;
  for (let k = 0; k < HOME.ESCORTS; k++) if (t >= escortSet(k)) n++;
  return n;
}
/** When each salute burst bursts: one per mission won (at least one). */
export function saluteTimes(missions: number): number[] {
  return spread(missions, HOME.SALUTE_AT + HOME.TRACER, HOME.SALUTE_END);
}
/** How many salute bursts have burst by film time t. */
export function burstsBy(t: number, missions: number): number {
  return saluteTimes(missions).filter((b) => t >= b).length;
}
/** How many of the station's ring segments are lit at film time t. */
export function ringLit(t: number): number {
  const u = (t - HOME.RING_AT) / (HOME.RING_FULL - HOME.RING_AT);
  if (u < 0) return 0;
  return Math.min(HOME.RING_SEGMENTS, Math.floor(u * HOME.RING_SEGMENTS) + 1);
}
/** How far the Flagship has come from its jump point to the docking arm, 0..1, slowing to rest at the dock. */
export function shipTravel(t: number): number {
  const u = Math.min(1, Math.max(0, (t - HOME.ARRIVE_AT) / (HOME.DOCK_AT - HOME.ARRIVE_AT)));
  return 1 - Math.pow(1 - u, 2.4);
}

// ---- Star Chart ----

/** When the star of mission i ignites. */
export function starTimes(missions: number): number[] {
  return spread(missions, CHART.IGNITE_AT, CHART.IGNITE_END);
}
/** How many stars are lit at film time t. */
export function starsLit(t: number, missions: number): number {
  return starTimes(missions).filter((s) => t >= s).length;
}
/** When the link from star i to star i + 1 leaves (missions - 1 links); each arrives LINK_FLY later. */
export function linkTimes(missions: number): number[] {
  const n = Math.max(0, missions - 1);
  return n === 0 ? [] : spread(n, CHART.LINK_AT, CHART.LINK_END - CHART.LINK_FLY);
}
/** How many links have arrived at film time t. */
export function linksBy(t: number, missions: number): number {
  return linkTimes(missions).filter((l) => t >= l + CHART.LINK_FLY).length;
}
/** How far the camera has pulled back, 0 (close on the constellation) to 1 (the whole galaxy). */
export function pullBack(t: number): number {
  const u = Math.min(1, Math.max(0, (t - CHART.ASCEND_AT) / (CHART.PULL_END - CHART.ASCEND_AT)));
  return u * u * (3 - 2 * u);
}

/**
 * Where each mission's star stands in the constellation (units: the constellation fits in a circle
 * of radius 1): left to right in the order played, up and down in a fixed scatter, never two close.
 */
export function starPlaces(missions: number): { x: number; y: number }[] {
  const n = Math.max(1, missions);
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -0.85 + (1.7 * i) / (n - 1);
    let y = (hashOf(i * 7 + 11) - 0.5) * 1.1;
    // Keep each star apart from the one before: a zigzag if the scatter put them too close.
    const prev = out[i - 1];
    if (prev && Math.hypot(prev.x - x, prev.y - y) < 0.3) y = prev.y + (prev.y > 0 ? -0.38 : 0.38);
    out.push({ x, y: Math.max(-0.62, Math.min(0.62, y)) });
  }
  return out;
}
