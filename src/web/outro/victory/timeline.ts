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
 * Star Chart: the Campaign written into the sky. Made longer and bigger (designer 2026-11-27: "not as
 * spectacular as every other campaign victory animation ... I want players to see a special treat"):
 * the longest of the victory films.
 *   Act 1  0.0 - 5.0   the dark; a comet of the Company's light runs the Campaign's road and one star
 *                      ignites where each mission was won, in the order played, its tag beside it;
 *                      one small companion per Threat column circles it
 *   Act 2  5.0 - 9.4   streams of light run from star to star and draw the constellation; then a star
 *                      chart (rings, degree ticks, the Campaign's name on the rim) unfolds round it
 *   Act 3  9.4 - 14.4  the stars pour their light into the middle and a new star is born there (a white
 *                      flash, rays, a shock ring); the camera flies far back through streaking stars
 *                      and tilts down onto a whole spiral galaxy turning in depth
 *   Act 4  14.4 -      a wave of the Company's light runs out from the new star across the galaxy, the
 *                      core answers with a flare, the arms keep the Company's colours; the Debrief
 */
export const CHART = {
  FILM_SECONDS: 21.0,
  ACT_AT: [0, 5.0, 9.4, 14.4] as const,
  ACT_NAMES: ["Campaign record", "Constellation", "Ascension", "Legacy"] as const,
  /** The comet comes in from the dark at COMET_AT, reaches the first star at IGNITE_AT and leaves COMET_OUT after the last. */
  COMET_AT: 0.3,
  COMET_OUT: 0.55,
  /** The first star ignites (sound hook, once per star); the last no later than IGNITE_END. */
  IGNITE_AT: 1.0,
  IGNITE_END: 4.4,
  /** A star's Threat companions appear one after another, this far apart, after it ignites. */
  COMPANION_STEP: 0.14,
  /** The links between the stars: the first leaves at LINK_AT (sound hook), the last arrives by LINK_END; each takes LINK_FLY. */
  LINK_AT: 5.1,
  LINK_END: 7.4,
  LINK_FLY: 0.6,
  /** The star chart unfolds round the constellation (sound hook) until CHART_FULL. */
  CHART_AT: 7.5,
  CHART_FULL: 8.9,
  /** The stars pour their light into the middle from GATHER_AT; the new star is born at NOVA_AT (sound hook). */
  GATHER_AT: 9.5,
  NOVA_AT: 10.4,
  /** The camera flies back (sound hook) from PULL_AT until PULL_END. */
  PULL_AT: 10.9,
  PULL_END: 14.2,
  /** The wave of the Company's light (sound hook) runs out from WAVE_AT to WAVE_END, WAVE_REACH galaxy radii from the new star. */
  WAVE_AT: 14.6,
  WAVE_END: 17.6,
  WAVE_REACH: 1.7,
  /** How far out from the galaxy's middle the constellation sits (galaxy radii). */
  CHART_RADIUS: 0.58,
  /** The last chord (sound hook: playVictoryResolve), then the Debrief card. */
  RESOLVE_AT: 17.4,
  DEBRIEF_AT: 18.0,
  /** The moment shown as one still picture with reduced motion or the Instant speed. */
  STILL_AT: 20.2,
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
/** How far the star chart has unfolded, 0..1. */
export function chartOpen(t: number): number {
  const u = Math.min(1, Math.max(0, (t - CHART.CHART_AT) / (CHART.CHART_FULL - CHART.CHART_AT)));
  return u * u * (3 - 2 * u);
}
/** How far the camera has flown back, 0 (close on the constellation) to 1 (the whole galaxy). */
export function pullBack(t: number): number {
  const u = Math.min(1, Math.max(0, (t - CHART.PULL_AT) / (CHART.PULL_END - CHART.PULL_AT)));
  return u * u * (3 - 2 * u);
}
/** How far the wave of light has run from the new star, in galaxy radii (0 before WAVE_AT, WAVE_REACH at WAVE_END), fast at first. */
export function waveRadius(t: number): number {
  const u = Math.min(1, Math.max(0, (t - CHART.WAVE_AT) / (CHART.WAVE_END - CHART.WAVE_AT)));
  return CHART.WAVE_REACH * (1 - (1 - u) * (1 - u));
}
/** When the wave reaches the galaxy's core and the core answers with its flare. */
export function coreFlareAt(): number {
  const u = 1 - Math.sqrt(1 - CHART.CHART_RADIUS / CHART.WAVE_REACH);
  return CHART.WAVE_AT + u * (CHART.WAVE_END - CHART.WAVE_AT);
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

/**
 * Where the comet is at film time t (constellation units), or undefined while it is not in the sky.
 * It comes in from the left, passes through each star exactly when that star ignites (a smooth
 * curve through them), and flies out to the right.
 */
export function cometAt(t: number, missions: number): { x: number; y: number } | undefined {
  const n = Math.max(1, missions);
  const p = starPlaces(n);
  const at = starTimes(n);
  const first = p[0]!;
  const last = p[n - 1]!;
  const pts = [{ x: first.x - 1.4, y: first.y + 0.55 }, ...p, { x: last.x + 1.4, y: last.y - 0.55 }];
  const times = [CHART.COMET_AT, ...at, at[n - 1]! + CHART.COMET_OUT];
  if (t < times[0]! || t > times[times.length - 1]!) return undefined;
  let k = 0;
  while (k < times.length - 2 && t > times[k + 1]!) k++;
  const span = times[k + 1]! - times[k]!;
  const u = span > 0 ? (t - times[k]!) / span : 1;
  // Catmull-Rom through the points (ends repeated).
  const p0 = pts[Math.max(0, k - 1)]!;
  const p1 = pts[k]!;
  const p2 = pts[k + 1]!;
  const p3 = pts[Math.min(pts.length - 1, k + 2)]!;
  const cr = (a: number, b: number, c: number, d: number): number =>
    0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  return { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) };
}
