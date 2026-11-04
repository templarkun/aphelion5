/**
 * Fixed numbers from the Core Rules (not from component files).
 * Component counts: Core Rules 2, "Tokens and supply limits".
 */

export const LIMITED_TOKENS = ["shield", "bioShield", "barrier", "tick", "mortar", "feedback", "command"] as const;
export type LimitedToken = (typeof LIMITED_TOKENS)[number];

/** Core Rules 2: Shield, Bio-shield, Barrier, Tick, Mortar, Feedback 10 each; Command tokens 6. */
export const TOKEN_LIMIT: Readonly<Record<LimitedToken, number>> = {
  shield: 10,
  bioShield: 10,
  barrier: 10,
  tick: 10,
  mortar: 10,
  feedback: 10,
  command: 6,
};

/** Core Rules 2 and 5.3: 15 energy of each colour (designer 2026-11-04, master rev 139). */
export const ENERGY_PER_COLOUR = 15;

export const FUSE_KINDS = ["tick", "mortar", "feedback"] as const;
export type FuseKind = (typeof FUSE_KINDS)[number];

/** Core Rules 6.6. */
export const FUSE_NAME: Readonly<Record<FuseKind, string>> = { tick: "Tick", mortar: "Mortar", feedback: "Feedback" };
/** Tick deals 2 damage to its unit; Mortar 1 to an adjacent unit; Feedback 1 to the Flagship (6.6). */
export const TICK_DAMAGE = 2;
export const MORTAR_DAMAGE = 1;
export const FEEDBACK_DAMAGE = 1;
