/**
 * The outros, and which Company gets which (designer 2026-11-16: "one Outro for each upcoming
 * Company. I will later decide which company will have which outro").
 *
 * To add an outro: make its component beside these (it takes OutroProps, types.ts, and nothing
 * else), list it in OUTROS. To give it to a Company: write the Company's id and the outro's id
 * into OUTRO_OF_COMPANY. A Company with no entry gets DEFAULT_OUTRO. See README.md.
 */

import { TerraformerVictoryOutro } from "./TerraformerVictoryOutro.js";
import type { OutroDef } from "./types.js";

export type { CampaignStats, CompanyTheme, MissionStat, ModuleStat, OutroDef, OutroProps } from "./types.js";

export const OUTROS: OutroDef[] = [
  {
    id: "terraformer",
    name: "Terraformer",
    note: "The Company claims the planet: pylons fall from the ship, their shock waves turn the dark ground into a lit sector, the sun rises.",
    Component: TerraformerVictoryOutro,
  },
];

export const DEFAULT_OUTRO = "terraformer";

/** Company id -> outro id. THE DESIGNER'S CHOICE, still open: empty until they say. */
export const OUTRO_OF_COMPANY: Record<string, string> = {};

export function outroFor(companyId: string): OutroDef {
  const byId = (id: string | undefined) => OUTROS.find((o) => o.id === id);
  return byId(OUTRO_OF_COMPANY[companyId]) ?? byId(DEFAULT_OUTRO) ?? OUTROS[0]!;
}
