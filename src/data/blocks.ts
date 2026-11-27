/**
 * Effects made from blocks in the Campaign editor (designer 2026-11-18, C3): the steps in the card
 * text's own words. Shared by the editor (which writes them) and the game (which plays them in a
 * mission playtest, designer 2026-11-27; `src/effects/blocks.ts`). Data only, no rule.
 */

export type Colour = "Yellow" | "Red" | "Blue";

export type Verb = "damage" | "destroy" | "boost" | "place" | "swap" | "teleport" | "flagshipDamage" | "flagshipRepair" | "gainEnergy" | "loseEnergy" | "gainCommand" | "loseCommand";
export const TOKENS = ["Shield", "Bio-shield", "Barrier", "Tick", "Mortar", "Feedback"] as const;
export type Token = (typeof TOKENS)[number];

/** Which units: this unit, one, every, or N different ones. */
export type Count = "this" | "one" | "all" | 2 | 3 | 4 | 5;
export const KINDS = ["unit", "non-Mecha unit", "non-Bot unit", "Bot", "Mecha", "Sentinel", "Sleeper", "Gyro", "Omega unit", "Alpha unit", "Beta unit", "Gamma unit"] as const;
export type Kind = (typeof KINDS)[number];
export type Where = "" | "adjacent" | "rowThrough" | "rowChoice";
export type Condition = "" | "damaged" | "undamaged";

export interface Target {
  count: Count;
  kind: Kind;
  /** "other": not this unit. */
  other: boolean;
  /** Only units of this Level (0 = any). */
  level: number;
  state: Condition;
  where: Where;
}

export interface Step {
  verb: Verb;
  n: number;
  target: Target;
  token?: Token;
  colour?: Colour | "";
}

/** "If adjacent to a Gamma unit, ..." (Omega effects only). */
export interface When {
  adjacentTo: Kind | "";
}


export interface BlockEffect {
  steps: Step[];
  when?: When;
}
