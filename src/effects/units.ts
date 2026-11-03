/**
 * Unit effects built so far. Stage 3: the Energy Gyros (their Drain and
 * Destroyed effects only give energy) and M_01. Every other unit is stage 5.
 */

import { move, openNeighbours } from "../engine/moves.js";
import { gainEnergy } from "../engine/tokens.js";
import type { EnergyColour } from "../data/units.js";
import { chooseSector } from "./helpers.js";
import { registerAbility, registerUnit } from "./registry.js";

/** G_01..G_09, as printed in unit_list_structured.txt. */
const energyGyros: [string, EnergyColour, number, number][] = [
  // id, colour, Drain gain, Destroyed gain
  ["G_01", "Yellow", 1, 2], // Drain: Gain 1 Yellow energy. Destroyed: Gain 2 Yellow energy.
  ["G_02", "Yellow", 1, 4],
  ["G_03", "Yellow", 1, 5],
  ["G_04", "Yellow", 1, 6],
  ["G_05", "Red", 1, 2],
  ["G_06", "Red", 1, 4],
  ["G_07", "Blue", 1, 1],
  ["G_08", "Blue", 1, 2],
  ["G_09", "Blue", 1, 3],
];
for (const [id, colour, drain, destroyed] of energyGyros) {
  registerUnit(id, {
    drain: (c) => gainEnergy(c, drain, colour, "4.3"),
    destroyed: (c) => gainEnergy(c, destroyed, colour, "4.8"),
  });
}

/** M_01 - Command: Move to an adjacent Dark sector. (A Cleared sector may be used: glossary "Dark sector".) */
registerAbility("M_01", function* (c, self) {
  const to = yield* chooseSector(c, "M_01: move to which adjacent Dark sector?", "M_01", openNeighbours(c, self!));
  if (to !== undefined) move(c, self!, to, "M_01");
});
