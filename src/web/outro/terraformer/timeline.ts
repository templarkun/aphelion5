/**
 * The Terraformer outro: when things happen, in seconds of film at Normal speed. Kept apart from
 * the drawing so the sound hooks, the captions and the tests read the same numbers.
 *
 *   Act 1  0.0 -  2.5  high orbit: the bay doors open, the pylons let go
 *   Act 2  2.5 -  5.5  re-entry: the camera follows the pylons down
 *   Act 3  5.5 -  8.5  impact after impact; the shock waves change the ground
 *   Act 4  8.5 - 11.5  the camera pulls back, the sun rises, the Debrief slides in
 * After FILM_SECONDS the picture keeps drifting slowly under the Debrief card.
 */

export const FILM_SECONDS = 11.5;
/** When each act begins. */
export const ACT_AT = [0, 2.5, 5.5, 8.5] as const;
export const ACT_NAMES = ["Orbital deployment", "Atmospheric entry", "Planetary impact", "Orbital dawn"] as const;

/** The bay doors: when they start to move (sound hook) and when they stand open. */
export const DOORS_AT = 0.45;
export const DOORS_OPEN_AT = 1.7;
/** The first pylon lets go; the others follow one by one. */
export const RELEASE_AT = 1.35;
const RELEASE_STEP = 0.09;
/** The pylons meet the air (sound hook). */
export const REENTRY_AT = 2.6;
/** The first pylon hits; the others follow in a steady beat, the last by LAST_IMPACT at the latest. */
export const FIRST_IMPACT = 5.6;
export const IMPACT_STEP = 0.36;
export const LAST_IMPACT = 7.8;
/** The sun comes over the edge (sound hook), and the Debrief card slides in. */
export const RESOLVE_AT = 8.6;
export const DEBRIEF_AT = 9.3;
/** The moment shown as one still picture with reduced motion or the Instant speed. */
export const STILL_AT = 13;

/** Never fewer than one pylon, never more than twelve (a Campaign of more missions shares them). */
export const MAX_PYLONS = 12;
export const pylonCount = (missions: number) => Math.min(MAX_PYLONS, Math.max(1, Math.round(missions) || 7));

/** Which act is playing at film time t: 1 to 4. */
export function actAt(t: number): 1 | 2 | 3 | 4 {
  return t >= ACT_AT[3] ? 4 : t >= ACT_AT[2] ? 3 : t >= ACT_AT[1] ? 2 : 1;
}

/** When pylon k (0 = first) hits the ground. */
export function impactTimes(n: number): number[] {
  const step = n > 1 ? Math.min(IMPACT_STEP, (LAST_IMPACT - FIRST_IMPACT) / (n - 1)) : 0;
  return Array.from({ length: n }, (_, k) => FIRST_IMPACT + k * step);
}
/** When pylon k leaves the bay: all are away before Act 2. */
export function releaseTimes(n: number): number[] {
  const step = n > 1 ? Math.min(RELEASE_STEP, (ACT_AT[1] - 0.25 - RELEASE_AT) / (n - 1)) : 0;
  return Array.from({ length: n }, (_, k) => RELEASE_AT + k * step);
}

/** How many pylons have hit by film time t. */
export function impactsBy(t: number, n: number): number {
  return impactTimes(n).filter((x) => t >= x).length;
}

/** Where a pylon comes down: degrees along the ship's track and across it, from the middle of the sector. */
export interface SitePlace {
  lon: number;
  lat: number;
}

/**
 * The places of n pylons in the target sector, in the order they hit. Seven make a hexagon with
 * one in the middle (it lands last); other numbers make a sunflower. The hits jump from side to
 * side of the sector, so the shock waves meet in the middle. On a tall screen the sector is narrower.
 */
export function sitePlaces(n: number, tall: boolean): SitePlace[] {
  const across = tall ? 4.4 : 7.4;
  const along = tall ? 8.2 : 7.6;
  const raw: SitePlace[] = [];
  if (n === 7) {
    // Opposite corners in turn, the middle last.
    for (const k of [0, 3, 1, 4, 2, 5]) {
      const a = ((28 + k * 60) * Math.PI) / 180;
      const wob = 1 + 0.12 * Math.sin(k * 2.3 + 0.7);
      raw.push({ lon: Math.cos(a) * along * wob, lat: Math.sin(a) * across * wob });
    }
    raw.push({ lon: 0.3, lat: -0.2 });
    return raw;
  }
  for (let k = 0; k < n; k++) {
    const r = n === 1 ? 0 : Math.sqrt((k + 0.5) / n);
    const a = k * 2.39996;
    raw.push({ lon: Math.cos(a) * along * 1.1 * r, lat: Math.sin(a) * across * 1.1 * r });
  }
  // Farthest from the one before, so the beat crosses the sector; the innermost last.
  const inner = raw.shift()!;
  const out: SitePlace[] = [];
  let at: SitePlace = { lon: -along, lat: 0 };
  while (raw.length) {
    let best = 0;
    for (let i = 1; i < raw.length; i++) if (Math.hypot(raw[i]!.lon - at.lon, raw[i]!.lat - at.lat) > Math.hypot(raw[best]!.lon - at.lon, raw[best]!.lat - at.lat)) best = i;
    at = raw.splice(best, 1)[0]!;
    out.push(at);
  }
  out.push(inner);
  return out;
}
