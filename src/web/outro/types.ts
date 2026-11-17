/**
 * The outros (designer 2026-11-16): what the player sees at Game End (Core Rules 10.3) after the
 * last mission is won. There will be several, one planned per Company; which Company gets which
 * is the designer's choice (index.ts). Every outro takes the same four things, so they can be
 * swapped freely. Screen only: nothing here is a rule.
 */

import type { ReactElement } from "react";

/** A colour as the briefing writes its accent: "r g b" (0-255 each). */
export type Rgb = string;

/** The colours of the player's Company, used by its ship, its lights and what it builds. Looks only. */
export interface CompanyTheme {
  /** Company id ("V1"). */
  id: string;
  /** Main colour: energy grids, running lights, the accent of the Debrief card. */
  primary: Rgb;
  /** Second colour: dome lights, nodes, highlights. */
  secondary: Rgb;
  /** The soft light that hangs over what the Company has built. */
  glow: Rgb;
  /** The hull's plating. */
  hull: Rgb;
  /** Painted stripes and marks on the hull. */
  livery: Rgb;
}

/** One Module the player ended the Campaign with. */
export interface ModuleStat {
  id: number;
  name: string;
  colour: "Yellow" | "Red" | "Blue";
}

/** One mission the player completed (Core Rules 10.3: each of its Threat columns scores 1). */
export interface MissionStat {
  /** Mission id ("C1_M2X"). */
  id: string;
  /** "Mission 2X". */
  label: string;
  /** Short form for a small tag: "M2X". */
  tag: string;
  /** Its Threat columns ("A", "C"): their number is the Threat Level conquered. */
  threat: string[];
}

/** Everything the Campaign Debrief shows. All of it is read from the finished game (stats.ts). */
export interface CampaignStats {
  campaignName: string;
  /** A second line under the name (the sector designation), if any. */
  campaignNote?: string | undefined;
  vesselName: string;
  freshness: "fresh" | "veteran";
  modules: ModuleStat[];
  /** The missions completed, in the order played: one terraformer pylon each. */
  missions: MissionStat[];
  /** All Threat columns of the completed missions together (10.3: +1 point each). */
  threatLevelsConquered: number;
  /** See stats.ts `totalTurnsOf`: the Core Rules have no turns (open question I13). */
  totalTurns: number;
  /** The final score (10.3) and the lines that add up to it. */
  score: number;
  scoreParts: string[];
  /** Set when this score was written into a high score field. */
  highScore?: "fresh" | "veteran" | undefined;
}

/** What every outro is given. */
export interface OutroProps {
  companyTheme: CompanyTheme;
  /** The Company's ship: picks the hull's outline ("V1", "V2"; any other id gets a plain hull). */
  vesselId: string;
  campaignStats: CampaignStats;
  /** "RETURN TO COMMAND DECK" was pressed. */
  onComplete: () => void;
}

/** One outro in the list. */
export interface OutroDef {
  id: string;
  name: string;
  /** One line about it. */
  note: string;
  Component: (p: OutroProps) => ReactElement;
}
