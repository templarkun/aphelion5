/**
 * Orbital Claim (designer 2026-11-19): when things happen, in seconds of film at Normal speed.
 * Kept apart from the drawing so the sound hooks, the captions and the tests read the same numbers.
 * The Company claims the sector it has won: no terraforming, a corporate-military annexation.
 *
 *   Act 1  0.0 -  3.0  low orbit over the night side; from the liberated sector a beacon beam climbs into space
 *   Act 2  3.0 -  6.5  the camera rises along the beam; the Flagship glides in above it; its clamps lock on
 *   Act 3  6.5 -  9.5  relay satellites snap into a lattice; a hexagonal grid sweeps out over the region
 *   Act 4  9.5 -       a slow orbital drift, the Flagship standing guard; the Debrief slides in
 * After FILM_SECONDS the picture keeps drifting slowly under the Debrief card.
 */

export const FILM_SECONDS = 11.5;
/** When each act begins. */
export const ACT_AT = [0, 3.0, 6.5, 9.5] as const;
export const ACT_NAMES = ["Extraction beacon", "Geostationary lock", "Territory annexation", "Geostationary vigil"] as const;

/** The beacon fires from the sector (sound hook) and takes BEAM_CLIMB to pierce the air into space. */
export const BEAM_AT = 0.7;
export const BEAM_CLIMB = 1.0;
/** Rings of ionised dust rising round the beam: the first, one every RING_EVERY. */
export const RING_FROM = 1.0;
export const RING_EVERY = 0.42;
/** The Flagship glides in from ARRIVE_FROM and comes to rest over the beacon at ARRIVE_AT. */
export const ARRIVE_FROM = 2.6;
export const ARRIVE_AT = 5.4;
/** Its belly clamps lock on the beam with a flash (sound hook); the tether is at full strength by TETHER_FULL. */
export const LOCK_AT = 5.65;
export const TETHER_FULL = 6.3;
/** The relay satellites: how many, when the first leaves the tether point, how far apart, how long each flies. */
export const SATS = 12;
export const SATS_AT = 6.6;
export const SAT_STEP = 0.075;
export const SAT_FLY = 0.85;
/** The lattice between them lights up. */
export const LATTICE_AT = 7.45;
/** The hexagonal territory grid sweeps out over the ground (sound hook) and covers the region by GRID_FULL. */
export const GRID_AT = 7.6;
export const GRID_FULL = 9.4;
/** "ASSET SECURED" locks in by the tether. */
export const SECURED_AT = 8.9;
/** The vigil: the camera settles into its drift (sound hook: the last chord), then the Debrief card. */
export const RESOLVE_AT = 9.5;
export const DEBRIEF_AT = 10.1;
/** The moment shown as one still picture with reduced motion or the Instant speed. */
export const STILL_AT = 12.6;

/** Which act is playing at film time t: 1 to 4. */
export function actAt(t: number): 1 | 2 | 3 | 4 {
  return t >= ACT_AT[3] ? 4 : t >= ACT_AT[2] ? 3 : t >= ACT_AT[1] ? 2 : 1;
}

/** When satellite k leaves the tether point, and when it snaps into its place in the lattice. */
export function satLaunch(k: number): number {
  return SATS_AT + k * SAT_STEP;
}
export function satSnap(k: number): number {
  return satLaunch(k) + SAT_FLY;
}
/** How many satellites have snapped into the lattice by film time t. */
export function snappedBy(t: number): number {
  let n = 0;
  for (let k = 0; k < SATS; k++) if (t >= satSnap(k)) n++;
  return n;
}
/** How much of the region the grid has claimed by film time t, 0..1 (of its radius). */
export function gridReach(t: number): number {
  const u = Math.min(1, Math.max(0, (t - GRID_AT) / (GRID_FULL - GRID_AT)));
  // Fast off the tether, slowing as it nears the edge of the region.
  return 1 - Math.pow(1 - u, 2.2);
}
