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
import { OrbitalClaimOutro } from "./OrbitalClaimOutro.js";
import { SignalLostOutro, WithdrawalOutro } from "./LossOutro.js";
import { HomecomingOutro, StarChartOutro } from "./VictoryFilmOutro.js";
import { pickLossOutro } from "./loss/timeline.js";
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
    note: "On the planet's surface after 2.0, seen as a recon feed: three brutalist spires fire ion plumes into an ochre dust storm, carve an eye in it, cold sunlight breaks through; water fills the dark canyons and the basalt turns wet and mineral-rich.",
    Component: SurfaceTerraformOutro,
  },
  {
    // Designer 2026-11-19: the fourth, a corporate-military claim from orbit. In System options only until the designer says.
    id: "orbital",
    name: "Orbital Claim",
    note: "The Company claims the sector from orbit: a beacon beam climbs from the liberated sector into space, the Flagship locks on it, relay satellites snap into a lattice and a hexagonal territory grid sweeps over the region.",
    Component: OrbitalClaimOutro,
  },
  {
    // Designer 2026-11-27: two more, generic for any Company. In System options only until the designer says.
    id: "homecoming",
    name: "Homecoming",
    note: "The Flagship drops out of its jump by the Company's home world; an honour guard of escorts forms round it, one salute burst per mission won lights the sky, the station's ring lights up and the clamps lock at the berth.",
    Component: HomecomingOutro,
  },
  {
    id: "starchart",
    name: "Star Chart",
    note: "The Campaign written into the sky: one star per mission won ignites, streams of light draw its constellation with a companion per Threat column; the camera pulls far back and a galaxy turns round it.",
    Component: StarChartOutro,
  },
  {
    // Kept as it was for comparison (designer 2026-11-17: "leave this version in the menu for me to see").
    id: "terraformer",
    name: "Terraformer 1.0",
    note: "The Company claims the planet: pylons fall from the ship, their shock waves turn the dark ground into a lit sector, the sun rises.",
    Component: TerraformerVictoryOutro,
  },
];

/** The first in the list, used only when nothing else fits (an empty pool). */
export const DEFAULT_OUTRO = "terraformer2";

/**
 * A won Campaign plays one of these, picked at random each time, for any Company (designer 2026-11-27:
 * "leave them as a random ending for any of the company. I will assign them in the very end of
 * development"). Terraformer 1.0 is left out: it is kept only to compare with 2.0 (System options).
 */
export const VICTORY_POOL = ["terraformer2", "surface", "orbital", "homecoming", "starchart"] as const;

/** Company id -> outro id. THE DESIGNER'S CHOICE, deferred to the end of development (2026-11-27): empty, so every Company gets one from VICTORY_POOL at random. */
export const OUTRO_OF_COMPANY: Record<string, string> = {};

/**
 * The loss outros (designer 2026-11-24): a lost or conceded game plays one of these, picked at random
 * each time (`lossOutroFor`). Generic: the same for every Company and every Campaign, for a loss and a
 * concede alike.
 */
export const LOSS_OUTROS: OutroDef[] = [
  {
    id: "signal",
    name: "Signal Lost",
    note: "The Flagship's tactical display: hostile swarms pour in and the sectors fall to crimson one by one; the command link fails, the display tears; the last beacon goes dark and the screen collapses to a point.",
    Component: SignalLostOutro,
    kind: "loss",
  },
  {
    id: "withdrawal",
    name: "Withdrawal",
    note: "High orbit over the lost planet: crimson veins spread over the night side, evacuation craft climb to the Flagship under fire, the jump drive gathers light and the ship is gone; debris drifts over the burning world.",
    Component: WithdrawalOutro,
    kind: "loss",
  },
];

/** One of VICTORY_POOL at random; `r` in 0..1 (Math.random by default). */
export function pickVictoryOutro(r: number = Math.random()): string {
  return VICTORY_POOL[Math.min(VICTORY_POOL.length - 1, Math.floor(Math.max(0, r) * VICTORY_POOL.length))]!;
}

/** A won Campaign: the outro named (System options), else the Company's own (none yet), else one of VICTORY_POOL at random. */
export function outroFor(companyId: string, outroId?: string, r?: number): OutroDef {
  const byId = (id: string | undefined) => OUTROS.find((o) => o.id === id);
  const any = LOSS_OUTROS.find((o) => o.id === outroId);
  return byId(outroId) ?? any ?? byId(OUTRO_OF_COMPANY[companyId]) ?? byId(pickVictoryOutro(r)) ?? byId(DEFAULT_OUTRO) ?? OUTROS[0]!;
}

/** A lost or conceded game: the loss outro named (System options), else one of the two at random; `r` in 0..1. */
export function lossOutroFor(outroId?: string, r?: number): OutroDef {
  return LOSS_OUTROS.find((o) => o.id === outroId) ?? LOSS_OUTROS.find((o) => o.id === pickLossOutro(r)) ?? LOSS_OUTROS[0]!;
}
