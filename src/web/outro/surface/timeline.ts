/**
 * Surface Terraform (designer 2026-11-19): when things happen, in seconds of film at Normal speed.
 * Kept apart from the drawing so the sound hooks, the captions and the tests read the same numbers.
 * The film goes on from Terraformer 2.0: the pylons have come down and now stand on the ground.
 *
 *   Act 1  0.0 -  3.0  the barren valley; the three spires open their radiator wings and fire their beams
 *   Act 2  3.0 -  6.5  where the beams pierce the storm a clear-sky vortex spirals open; rain, mist, sunlight
 *   Act 3  6.5 - 10.0  water fills the dry canyon beds, green and glowing life spreads from the spires; flocks
 *   Act 4 10.0 -       a slow panoramic drift over the living valley; the Debrief slides in
 * After FILM_SECONDS the picture keeps drifting slowly under the Debrief card.
 */

export const FILM_SECONDS = 12.5;
/** When each act begins. */
export const ACT_AT = [0, 3.0, 6.5, 10.0] as const;
export const ACT_NAMES = ["Spire ignition", "Atmospheric cleansing", "Biosphere bloom", "Living world"] as const;

/** The three spires near the camera (the valley shows three of the pylons; designer 2026-11-19). */
export const SPIRES = 3;
/**
 * The other pylons (one for every mission won, as in 2.0, less the three spires) stand far off
 * beyond the horizon and show as thin beams (designer 2026-11-19, I17). They fire one by one after
 * the spires, from FAR_AT, at most FAR_STEP apart, all within Act 1.
 */
export const FAR_AT = 2.2;
export const FAR_STEP = 0.18;
export const farCount = (pylons: number): number => Math.max(0, Math.round(pylons) - SPIRES);
/** When each far beam fires (n of them). */
export function farTimes(n: number): number[] {
  const step = n > 1 ? Math.min(FAR_STEP, (ACT_AT[1] - 0.2 - FAR_AT) / (n - 1)) : 0;
  return Array.from({ length: n }, (_, k) => FAR_AT + k * step);
}
/** When each spire's radiator wings start to flare open (the order: the great one, the near one, the far one). */
export const FLARE_AT = [0.85, 1.2, 1.5] as const;
/** How long the wings take to open, s. */
export const FLARE = 0.8;
/** After its wings start to open, a spire fires its beam this much later (sound hook: one per spire). */
export const FIRE_DELAY = 0.55;
/** A beam takes this long to climb from the spire to the cloud deck. */
export const CLIMB = 0.5;
/** The clear-sky vortex starts to turn and open (sound hook), and is wide open by VORTEX_WIDE. */
export const VORTEX_AT = 3.15;
export const VORTEX_WIDE = 10.5;
/** Sunlight breaks through onto the ridges (about when the opening reaches the sun). */
export const SUN_AT = 5.0;
/** Condensation rain: begins, is at its heaviest, ends. */
export const RAIN = [3.7, 4.9, 8.0] as const;
/** Water starts to flow from the spires' feet (sound hook); every bed and pool is full by WATER_FULL. */
export const WATER_AT = 6.6;
export const WATER_FULL = 9.4;
/** The green tide starts at the spires' feet and has covered the whole valley by BLOOM_FULL. */
export const BLOOM_AT = 6.75;
export const BLOOM_FULL = 9.9;
/** The flocks of sky creatures glide in. */
export const FLOCKS_AT = 7.3;
/** The living world: the camera settles into its drift (sound hook: the last chord), then the Debrief card. */
export const RESOLVE_AT = 10.0;
export const DEBRIEF_AT = 10.6;
/** The moment shown as one still picture with reduced motion or the Instant speed. */
export const STILL_AT = 13.5;

/** Which act is playing at film time t: 1 to 4. */
export function actAt(t: number): 1 | 2 | 3 | 4 {
  return t >= ACT_AT[3] ? 4 : t >= ACT_AT[2] ? 3 : t >= ACT_AT[1] ? 2 : 1;
}

/** When each spire fires its beam. */
export function fireTimes(): number[] {
  return FLARE_AT.map((a) => a + FIRE_DELAY);
}

/** How many spires have fired their beams by film time t. */
export function firedBy(t: number): number {
  return fireTimes().filter((x) => t >= x).length;
}
