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
import { SurfaceTerraformOutro } from "./SurfaceTerraformOutro.js";
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
    // Designer 2026-11-19: the third, on the surface, going on from 2.0. In System options only until the designer says.
    id: "surface",
    name: "Surface Terraform",
    note: "On the planet's surface after 2.0: three spires fire their beams into the toxic storm, a clear-sky vortex opens it, water fills the dry canyons and green, glowing life spreads over the valley; flocks glide over it.",
    Component: SurfaceTerraformOutro,
  },
  {
    // Kept as it was for comparison (designer 2026-11-17: "leave this version in the menu for me to see").
    id: "terraformer",
    name: "Terraformer 1.0",
    note: "The Company claims the planet: pylons fall from the ship, their shock waves turn the dark ground into a lit sector, the sun rises.",
    Component: TerraformerVictoryOutro,
  },
];

/** Terraformer 2.0 plays after a won Campaign (designer 2026-11-19: "Keep 2.0 as the default after a won game until I say otherwise"); Surface Terraform and 1.0 are in System options. */
export const DEFAULT_OUTRO = "terraformer2";

/** Company id -> outro id. THE DESIGNER'S CHOICE, still open: empty until they say. */
export const OUTRO_OF_COMPANY: Record<string, string> = {};

export function outroFor(companyId: string, outroId?: string): OutroDef {
  const byId = (id: string | undefined) => OUTROS.find((o) => o.id === id);
  return byId(outroId) ?? byId(OUTRO_OF_COMPANY[companyId]) ?? byId(DEFAULT_OUTRO) ?? OUTROS[0]!;
}
