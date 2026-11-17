/**
 * The outros, and which Company gets which (designer 2026-11-16: "one Outro for each upcoming
 * Company. I will later decide which company will have which outro").
 *
 * To add an outro: make its component beside these (it takes OutroProps, types.ts, and nothing
 * else), list it in OUTROS. To give it to a Company: write the Company's id and the outro's id
 * into OUTRO_OF_COMPANY. A Company with no entry gets DEFAULT_OUTRO. See README.md.
 */

import { TerraformerVictoryOutro } from "./TerraformerVictoryOutro.js";
import { TerraformerVictoryOutro2 } from "./TerraformerVictoryOutro2.0.js";
import type { OutroDef } from "./types.js";

export type { CampaignStats, CompanyTheme, MissionStat, ModuleStat, OutroDef, OutroProps } from "./types.js";

export const OUTROS: OutroDef[] = [
  {
    id: "terraformer2",
    name: "Terraformer 2.0",
    note: "Industrial terraforming: the pylons are lowered out of the bay, turn upright and come down on braking thrusters; they anchor, fire their beams, and the toxic storm clears in rings over ocean and green land; the sun rises.",
    Component: TerraformerVictoryOutro2,
  },
  {
    // Kept as it was for comparison (designer 2026-11-17: "leave this version in the menu for me to see").
    id: "terraformer",
    name: "Terraformer 1.0",
    note: "The Company claims the planet: pylons fall from the ship, their shock waves turn the dark ground into a lit sector, the sun rises.",
    Component: TerraformerVictoryOutro,
  },
];

/** The newest Terraformer plays after a won Campaign; 1.0 stays in System options to compare. */
export const DEFAULT_OUTRO = "terraformer2";

/** Company id -> outro id. THE DESIGNER'S CHOICE, still open: empty until they say. */
export const OUTRO_OF_COMPANY: Record<string, string> = {};

export function outroFor(companyId: string, outroId?: string): OutroDef {
  const byId = (id: string | undefined) => OUTROS.find((o) => o.id === id);
  return byId(outroId) ?? byId(OUTRO_OF_COMPANY[companyId]) ?? byId(DEFAULT_OUTRO) ?? OUTROS[0]!;
}
