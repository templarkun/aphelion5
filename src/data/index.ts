/**
 * All component data, parsed and cross-checked. Pure: takes file texts, so
 * it runs the same in Node (build, tests) and in the browser.
 */

import { type CampaignDatabase, parseCampaign } from "./campaign.js";
import { type ModuleDatabase, type ModuleDistribution, parseModuleDistribution, parseModules } from "./modules.js";
import { type UnitDatabase, parseUnits } from "./units.js";

/** Files in data/ that stage 1 reads, by name. */
export const DATA_FILES = {
  units: "unit_list_structured.txt",
  modules: "Modules.txt",
  campaign1: "Campaign1.txt",
} as const;

/**
 * Component files named by the spec that are not in the repo yet. Their
 * readers are written when the files arrive (see CLAUDE.md, Status).
 */
export const MISSING_DATA_FILES = ["company_vessels_structured.txt", "Anomaly list.txt", "Expansion1.txt"] as const;

export interface DataTexts {
  units: string;
  modules: string;
  campaign1: string;
}

export interface GameData {
  units: UnitDatabase;
  modules: ModuleDatabase;
  moduleDistribution: ModuleDistribution;
  campaigns: CampaignDatabase[];
}

export function parseGameData(t: DataTexts): GameData {
  return {
    units: parseUnits(t.units, DATA_FILES.units),
    modules: parseModules(t.modules, DATA_FILES.modules),
    moduleDistribution: parseModuleDistribution(t.modules),
    campaigns: [parseCampaign(t.campaign1, DATA_FILES.campaign1)],
  };
}

export * from "./units.js";
export * from "./modules.js";
export * from "./campaign.js";
