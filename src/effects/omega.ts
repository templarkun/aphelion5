/** Campaign 1 Omega units (Campaign board, Campaign1.txt): O_01 Alpha, O_02 Beta, O_03 Gamma. */

import { ask, log } from "../engine/effect.js";
import { canBeChosen, choosableUnits, sectorOf, tile, unitType } from "../engine/field.js";
import type { TileId } from "../engine/state.js";
import { boost, damageFlagship, destroy } from "../engine/tokens.js";
import { adjacentTo, chooseOneOf } from "./kit.js";
import { registerUnit } from "./registry.js";

/** O_01 Alpha - Destroyed: Boost one adjacent non-Mecha unit. */
registerUnit("O_01", {
  destroyed: function* (c, self) {
    const options = adjacentTo(c, sectorOf(c.state, self)!).filter((u) => canBeChosen(c, u) && unitType(c, u) !== "Mecha");
    if (options.length === 0) {
      log(c, "O_01: no adjacent non-Mecha unit can be Boosted", "O_01");
      return;
    }
    const a = yield* ask(c, { kind: "units", prompt: "O_01: Boost which adjacent non-Mecha unit?", rule: "O_01", options, min: 1, max: 1 });
    yield* boost(c, a.value as TileId[], "O_01");
  },
});

/** O_02 Beta - At Overload: Destroy one Alpha unit. Boost self once per point of the destroyed unit's Strength just before it was destroyed, plus one. */
registerUnit("O_02", {
  atOverload: function* (c, self) {
    const alphas = choosableUnits(c, (u) => tile(c.state, u).unitId === "O_01");
    // Designer, Q4: with no Alpha to destroy, nothing happens (it Boosts itself only when it destroys one).
    if (alphas.length === 0) return log(c, "O_02: no Alpha unit to destroy, nothing happens", "O_02");
    const a = yield* chooseOneOf(c, "O_02: destroy which Alpha unit?", "O_02", alphas);
    const info = destroy(c, a!, "O_02");
    const n = (info?.strength ?? 0) + 1;
    log(c, `O_02: Boost itself ${n} time${n === 1 ? "" : "s"}`, "O_02");
    // One Boost at a time: when Shields run out, each missing one damages the Flagship (6.2).
    for (let i = 0; i < n; i++) yield* boost(c, [self], "O_02");
  },
});

/** O_03 Gamma - At Overload: If adjacent to an Alpha unit, deal 1 damage to your Flagship. */
registerUnit("O_03", {
  atOverload: function* (c, self) {
    const alpha = adjacentTo(c, sectorOf(c.state, self)!).some((u) => tile(c.state, u).unitId === "O_01");
    if (alpha) yield* damageFlagship(c, 1, "O_03");
    else log(c, "O_03: no adjacent Alpha unit", "O_03");
  },
});
