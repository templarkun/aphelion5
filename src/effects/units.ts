/**
 * Unit effects built so far. Stage 3: the Energy Gyros (their Drain and
 * Destroyed effects only give energy) and M_01. Stage 4 (early, for the
 * Overload tests and the fixed board): S_01, S_12, F_04, F_13, P_05, O_01,
 * O_03 and V1_M02_U2. Every other unit is stage 5.
 */

import { ask, log } from "../engine/effect.js";
import { adjacentUnits, canBeChosen, describe, isWreck, sectorKeys, sectorOf, tile, unitType, units } from "../engine/field.js";
import { isOpenSector, move, openNeighbours, requestOverload, reveal, teleport } from "../engine/moves.js";
import type { TileId } from "../engine/state.js";
import { boost, damageFlagship, dealHit, destroy, gainEnergy, placeAlert, repairFlagship } from "../engine/tokens.js";
import type { EnergyColour } from "../data/units.js";
import { chooseDarkSector, chooseSector } from "./helpers.js";
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

// ---------------------------------------------------------------------------
// Built early, in stage 4: the cards the Overload tests (batches 1 and 4) and
// the fixed text-play board use. Every other unit is still stage 5.
// ---------------------------------------------------------------------------

/** S_01 - Deal 1 damage to your Flagship. */
registerUnit("S_01", { activate: (c) => damageFlagship(c, 1, "S_01") });

/** S_12 - If at least one Bot is adjacent, destroy one of them and deal 2 damage to your Flagship. */
registerUnit("S_12", {
  activate: function* (c, self) {
    const bots = adjacentUnits(c.state, sectorOf(c.state, self)!).filter((u) => canBeChosen(c, u) && unitType(c, u) === "Bot");
    if (bots.length === 0) {
      log(c, "S_12: no adjacent Bot, nothing happens", "S_12");
      return;
    }
    const a = yield* ask(c, { kind: "units", prompt: "S_12: destroy which adjacent Bot?", rule: "S_12", options: bots, min: 1, max: 1 });
    destroy(c, (a.value as TileId[])[0]!, "S_12");
    yield* damageFlagship(c, 2, "S_12");
  },
});

/** F_04 - [1] Reveal one unit. [2] You may deal 2 damage to it. */
registerUnit("F_04", {
  activate: function* (c) {
    const k = yield* chooseDarkSector(c, "F_04: Reveal which Dark sector?", "F_04");
    if (k === undefined) return;
    const u = yield* reveal(c, k, "F_04");
    // A Flare or Wreck cannot be damaged: nothing to ask (11.1 rule 5).
    if (!canBeChosen(c, u)) return;
    const a = yield* ask(c, { kind: "yesno", prompt: `F_04: deal 2 damage to ${describe(c, u)}?`, rule: "F_04" });
    if (a.value === true) yield* dealHit(c, u, 2, "F_04");
  },
});

/** F_13 - Activate all Mecha (11.1 rule 6: each gets an Alert token). */
registerUnit("F_13", {
  activate: function* (c) {
    for (const u of units(c.state)) if (unitType(c, u) === "Mecha" && !isWreck(c, u)) placeAlert(c, u, "F_13");
  },
});

/** P_05 - [1] Start an Overload. [2] If there is at least one Sentinel on the Field, remove 1 damage from your Flagship. */
registerUnit("P_05", {
  activate: function* (c) {
    requestOverload(c, "P_05");
    if (units(c.state).some((u) => unitType(c, u) === "Sentinel")) yield* repairFlagship(c, 1, "P_05");
    else log(c, "P_05: no Sentinel on the Field", "P_05");
  },
});

/** O_01 (Alpha, Campaign board) - Destroyed: Boost one adjacent non-Mecha unit. */
registerUnit("O_01", {
  destroyed: function* (c, self) {
    const options = adjacentUnits(c.state, sectorOf(c.state, self)!).filter((u) => canBeChosen(c, u) && unitType(c, u) !== "Mecha");
    if (options.length === 0) {
      log(c, "O_01: no adjacent non-Mecha unit can be Boosted", "O_01");
      return;
    }
    const a = yield* ask(c, { kind: "units", prompt: "O_01: Boost which adjacent non-Mecha unit?", rule: "O_01", options, min: 1, max: 1 });
    yield* boost(c, a.value as TileId[], "O_01");
  },
});

/** O_03 (Gamma, Campaign board) - At Overload: If adjacent to an Alpha unit, deal 1 damage to your Flagship. */
registerUnit("O_03", {
  atOverload: function* (c, self) {
    const alpha = adjacentUnits(c.state, sectorOf(c.state, self)!).some((u) => tile(c.state, u).unitId === "O_01");
    if (alpha) yield* damageFlagship(c, 1, "O_03");
    else log(c, "O_03: no adjacent Alpha unit", "O_03");
  },
});

/** V1_M02_U2 (M_02 upgrade) - [Overload] Command: Teleport to any Dark sector. (A Cleared sector may be used: glossary "Dark sector".) */
registerAbility("V1_M02_U2", function* (c, self) {
  const to = yield* chooseSector(c, "V1_M02_U2: teleport to which Dark sector?", "V1_M02_U2", sectorKeys(c.state).filter((k) => isOpenSector(c, k)));
  if (to !== undefined) teleport(c, self!, to, "V1_M02_U2");
});
