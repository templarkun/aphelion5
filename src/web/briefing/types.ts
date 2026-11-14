/** The command briefing: what the player sets before the game starts, and the steps that set it. */

export type BriefStep = "campaign" | "vessel" | "modules";
export const BRIEF_STEPS: { id: BriefStep; label: string }[] = [
  { id: "campaign", label: "Campaign" },
  { id: "vessel", label: "Vessel" },
  { id: "modules", label: "Modules" },
];

/**
 * Everything the briefing compiles and hands to the game. The Threat Level is not here: it is
 * chosen at each Mission Preparation (Core Rules 7.2 step 3), on the Threat screen.
 */
export interface Loadout {
  /** Campaign prefix ("C1"). */
  campaign: string;
  /** Company id ("V1"). */
  company: string;
  /** Asked only when the Company's sheet has upgrade marks (Core Rules 7.1 step 3). */
  freshness: "fresh" | "veteran";
  /** Expansion module ids ("heat"). */
  expansions: string[];
  developerMode: boolean;
  seed: number;
}

/** The names the Core Rules give the Threat Levels (7.2 step 3). */
export const THREAT_NAMES = ["", "Patrol", "Assault", "Siege", "Annihilation"] as const;
/** Accent per Threat Level: sky blue, then amber, orange and crimson. 0 = none chosen yet. */
export const THREAT_RGB = ["125 211 252", "103 232 249", "252 211 77", "251 146 60", "251 113 133"] as const;
export const SKY = "125 211 252";
