/**
 * All component data, parsed and cross-checked. Pure: takes file texts, so
 * it runs the same in Node (build, tests) and in the browser.
 */

import { type AnomalyDatabase, parseAnomalies } from "./anomalies.js";
import { type CampaignDatabase, parseCampaign } from "./campaign.js";
import { type CompanyDatabase, parseCompanies } from "./company.js";
import { type ExpansionDef, parseExpansion } from "./expansion.js";
import { type ModuleDatabase, type ModuleDistribution, parseModuleDistribution, parseModules } from "./modules.js";
import { type UnitDatabase, parseUnits } from "./units.js";

/** Every component file in data/, by name. */
export const DATA_FILES = {
  units: "unit_list_structured.txt",
  modules: "Modules.txt",
  companies: "company_vessels_structured.txt",
  campaign1: "Campaign1.txt",
  anomalies: "Anomaly list.txt",
  expansion1: "Expansion1.txt",
} as const;

export type DataTexts = Record<keyof typeof DATA_FILES, string>;

export interface GameData {
  units: UnitDatabase;
  modules: ModuleDatabase;
  moduleDistribution: ModuleDistribution;
  companies: CompanyDatabase;
  campaigns: CampaignDatabase[];
  anomalies: AnomalyDatabase;
  /** Heat module (optional rule set, switched on at game setup). */
  expansion1: ExpansionDef;
}

export function parseGameData(t: DataTexts): GameData {
  return {
    units: parseUnits(t.units, DATA_FILES.units),
    modules: parseModules(t.modules, DATA_FILES.modules),
    moduleDistribution: parseModuleDistribution(t.modules),
    companies: parseCompanies(t.companies, DATA_FILES.companies),
    campaigns: [parseCampaign(t.campaign1, DATA_FILES.campaign1)],
    anomalies: parseAnomalies(t.anomalies, DATA_FILES.anomalies),
    expansion1: parseExpansion(t.expansion1, DATA_FILES.expansion1),
  };
}

export * from "./units.js";
export * from "./modules.js";
export * from "./campaign.js";
export * from "./company.js";
export * from "./anomalies.js";
export * from "./expansion.js";
