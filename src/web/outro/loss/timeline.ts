/**
 * The two loss outros (designer 2026-11-24): what a lost or conceded game shows at Game End (Core
 * Rules 10.3). Generic: the same for every Company and every Campaign (the Company only lends its
 * colours), the same for a loss and a concede (only a few caption words differ), one of the two picked
 * at random each time (`pickLossOutro`). When things happen, in seconds of film at Normal speed; kept
 * apart from the drawing so the sound hooks, the captions and the tests read the same numbers.
 * Screen only: nothing here is a rule.
 */

/**
 * Signal Lost: the sector seen on the Flagship's holographic tactical display.
 *   Act 1  0.0 - 2.8  hostile swarms pour in from the edge; the outer sectors fall to crimson one by one
 *   Act 2  2.8 - 5.6  the command link fails: the display tears, static, the uplink counts down
 *   Act 3  5.6 - 8.0  the last beacon in the middle goes dark; the display collapses to a line, then a point
 *   Act 4  8.0 -      silence: static embers in the dark; the Debrief slides in
 */
export const SIGNAL = {
  FILM_SECONDS: 10.4,
  ACT_AT: [0, 2.8, 5.6, 8.0] as const,
  ACT_NAMES: ["Perimeter collapse", "Command link failing", "Signal lost", "Silence"] as const,
  /** The hostile swarms start to pour in (sound hook). */
  BREACH_AT: 0.4,
  /** The first sector falls; the last (the beacon in the middle) at LAST_AT. */
  FIRST_FALL: 0.9,
  LAST_AT: 6.3,
  /** The display starts to tear (sound hook); it is at its worst by GLITCH_FULL. */
  GLITCH_AT: 2.9,
  GLITCH_FULL: 6.2,
  /** The display collapses to a line, then to a point (sound hook), gone by COLLAPSE_END. */
  COLLAPSE_AT: 6.8,
  COLLAPSE_END: 7.7,
  /** The last sombre chord (sound hook: mission-lost), then the Debrief card. */
  RESOLVE_AT: 8.0,
  DEBRIEF_AT: 8.6,
  /** The moment shown as one still picture with reduced motion or the Instant speed. */
  STILL_AT: 9.6,
  /** Rings of sectors on the display (the middle one is ring 0): 3 * R * (R + 1) + 1 sectors. */
  RINGS: 4,
} as const;

/**
 * Withdrawal: from high orbit over the lost planet.
 *   Act 1  0.0 - 3.0  the night side, crimson veins of the enemy spreading over it; the Company's lights go out
 *   Act 2  3.0 - 6.0  evacuation craft climb from the surface to the Flagship; hostile fire takes one
 *   Act 3  6.0 - 8.6  the jump drive gathers light at the prow; a flash and the Flagship is gone
 *   Act 4  8.6 -      the aftermath: the planet glows crimson, debris drifts by; the Debrief slides in
 */
export const WITHDRAW = {
  FILM_SECONDS: 11.0,
  ACT_AT: [0, 3.0, 6.0, 8.6] as const,
  ACT_NAMES: ["Sector overrun", "Evacuation", "Emergency jump", "Aftermath"] as const,
  /** A low rumble as the veins spread (sound hook). */
  OVERRUN_AT: 0.3,
  /** The veins reach the whole night side by VEINS_FULL. */
  VEINS_FULL: 7.5,
  /** The evacuation craft leave the ground (sound hook), one every CRAFT_STEP, each CRAFT_FLY long. */
  CRAFT_AT: 3.1,
  CRAFTS: 12,
  CRAFT_STEP: 0.16,
  CRAFT_FLY: 1.5,
  /** This craft (index) is hit on its way up and does not arrive. */
  CRAFT_LOST: 7,
  /** The jump drive starts to gather light (sound hook), then the jump's flash (sound hook). */
  CHARGE_AT: 6.1,
  JUMP_AT: 7.7,
  /** The last sombre chord (sound hook: mission-lost), then the Debrief card. */
  RESOLVE_AT: 8.6,
  DEBRIEF_AT: 9.2,
  /** The moment shown as one still picture with reduced motion or the Instant speed. */
  STILL_AT: 10.4,
} as const;

export type ActNo = 1 | 2 | 3 | 4;

/** Which act is playing at film time t: 1 to 4. */
export function actOf(at: readonly number[], t: number): ActNo {
  return t >= at[3]! ? 4 : t >= at[2]! ? 3 : t >= at[1]! ? 2 : 1;
}

/** The hexagonal sectors of Signal Lost's display, ring by ring (axial q, r; ring 0 is the middle). */
export function displaySectors(rings: number = SIGNAL.RINGS): { q: number; r: number; ring: number }[] {
  const out: { q: number; r: number; ring: number }[] = [];
  for (let q = -rings; q <= rings; q++)
    for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) out.push({ q, r, ring: Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) });
  return out;
}

/** A number from 0 to 1 for a whole number: the same every time (no randomness in the film). */
export function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * When each sector of the display falls to the enemy: the outer ring first, the middle last (at
 * LAST_AT, the last beacon). Within a ring, a little apart in a fixed scatter.
 */
export function fallTimes(rings: number = SIGNAL.RINGS): number[] {
  const span = SIGNAL.LAST_AT - 0.9 - SIGNAL.FIRST_FALL;
  return displaySectors(rings).map((s, i) => {
    if (s.ring === 0) return SIGNAL.LAST_AT;
    const band = (rings - s.ring) / rings; // 0 outer ... (rings - 1) / rings inner
    return SIGNAL.FIRST_FALL + band * span + hash01(i * 7 + 3) * (span / rings) * 0.9;
  });
}

/** How many sectors are still held at film time t. */
export function heldAt(t: number, rings: number = SIGNAL.RINGS): number {
  return fallTimes(rings).filter((f) => t < f).length;
}

/** The uplink in Signal Lost's telemetry, 100 to 0 (%): steady, then failing with the display, 0 when the last beacon goes. */
export function uplinkAt(t: number): number {
  if (t <= SIGNAL.GLITCH_AT) return 100 - Math.round(Math.max(0, t - SIGNAL.BREACH_AT) * 4);
  if (t >= SIGNAL.LAST_AT) return 0;
  const k = (t - SIGNAL.GLITCH_AT) / (SIGNAL.LAST_AT - SIGNAL.GLITCH_AT);
  const start = 100 - Math.round((SIGNAL.GLITCH_AT - SIGNAL.BREACH_AT) * 4);
  return Math.max(0, Math.round(start * (1 - k) * (1 - k * 0.3)));
}

/** How torn the display is at film time t, 0..1. */
export function glitchAt(t: number): number {
  if (t < SIGNAL.GLITCH_AT) return 0;
  return Math.min(1, (t - SIGNAL.GLITCH_AT) / (SIGNAL.GLITCH_FULL - SIGNAL.GLITCH_AT));
}

/** When craft k of Withdrawal leaves the ground, and when it reaches the Flagship (or is hit, the lost one, halfway). */
export function craftLaunch(k: number): number {
  return WITHDRAW.CRAFT_AT + k * WITHDRAW.CRAFT_STEP;
}
export function craftEnd(k: number): number {
  return craftLaunch(k) + (k === WITHDRAW.CRAFT_LOST ? WITHDRAW.CRAFT_FLY * 0.55 : WITHDRAW.CRAFT_FLY);
}
/** How many craft are aboard at film time t. */
export function aboardBy(t: number): number {
  let n = 0;
  for (let k = 0; k < WITHDRAW.CRAFTS; k++) if (k !== WITHDRAW.CRAFT_LOST && t >= craftEnd(k)) n++;
  return n;
}
/** How far the enemy's veins have spread over the night side at film time t, 0..1. */
export function veinReach(t: number): number {
  const u = Math.min(1, Math.max(0, (t - WITHDRAW.OVERRUN_AT) / (WITHDRAW.VEINS_FULL - WITHDRAW.OVERRUN_AT)));
  return 1 - Math.pow(1 - u, 1.6);
}

/** The two loss outros' ids. */
export const LOSS_IDS = ["signal", "withdrawal"] as const;
export type LossId = (typeof LOSS_IDS)[number];

/** One of the two at random (designer 2026-11-24: "will be chosen at random"); `r` in 0..1 (Math.random by default). */
export function pickLossOutro(r: number = Math.random()): LossId {
  return LOSS_IDS[Math.min(LOSS_IDS.length - 1, Math.floor(Math.max(0, r) * LOSS_IDS.length))]!;
}
