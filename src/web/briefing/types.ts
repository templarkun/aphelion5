/** The command briefing: what the player sets before the game starts, and the steps that set it. */

import type { ThreatColumn } from "../../data/campaign.js";

export type BriefStep = "campaign" | "vessel" | "modules" | "threat";
export const BRIEF_STEPS: { id: BriefStep; label: string }[] = [
  { id: "campaign", label: "Campaign" },
  { id: "vessel", label: "Vessel" },
  { id: "modules", label: "Modules" },
  { id: "threat", label: "Threat" },
];

/** Threat columns chosen for each mission (Core Rules 7.2 step 3). The Threat Level is how many. */
export type ThreatPlan = Record<string, ThreatColumn[]>;

/** Everything the briefing compiles and hands to the game. */
export interface Loadout {
  /** Campaign prefix ("C1"). */
  campaign: string;
  /** Company id ("V1"). */
  company: string;
  /** Asked only when the Company's sheet has upgrade marks (Core Rules 7.1 step 3). */
  freshness: "fresh" | "veteran";
  /** Expansion module ids ("heat"). */
  expansions: string[];
  threat: ThreatPlan;
  developerMode: boolean;
  seed: number;
}

export type ThreatLevel = 1 | 2 | 3 | 4;
/** The names the Core Rules give the Threat Levels (7.2 step 3). */
export const THREAT_NAMES = ["", "Patrol", "Assault", "Siege", "Annihilation"] as const;
/** HUD accent per Threat Level: cool cyan, then warning amber, orange and crimson. 0 = not set. */
export const THREAT_RGB = ["148 163 184", "34 211 238", "250 204 21", "251 146 60", "244 63 94"] as const;
export const CYAN = "34 211 238";
