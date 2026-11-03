/**
 * Module effects built so far (the rest are stage 6). Built early, in
 * stage 4, for the Overload tests and the fixed text-play board:
 * Demolition Blast (1, Yellow, light) and Charged Beam (26, Red, red).
 */

import { type RunCtx, ask, log } from "../engine/effect.js";
import { unitType } from "../engine/field.js";
import { dealHit, destroy } from "../engine/tokens.js";
import type { EnergyColour } from "../data/units.js";
import { chooseUnit } from "./helpers.js";
import { registerModule } from "./registry.js";

/**
 * An extra payment (8.6 step 3): pay up to `max` more energy of the Module's
 * colour, from what is left on the Module and from your Reserve. Returns the
 * amount paid (0 = you skip that part).
 */
function* extraPayment(c: RunCtx, moduleId: number, colour: EnergyColour, max: number, what: string) {
  const m = c.state.player.modules.find((x) => x.id === moduleId)!;
  const onModule = m.energy[colour];
  const reserve = c.state.player.reserve[colour];
  const most = Math.min(max, onModule + reserve);
  if (most === 0) {
    log(c, `no ${colour} energy left for the extra payment`, "8.6");
    return 0;
  }
  const a = yield* ask(c, { kind: "amount", prompt: `Pay how much more ${colour} energy (0 to ${most}) ${what}?`, rule: "8.6", min: 0, max: most });
  const n = a.value as number;
  if (n === 0) return 0;
  // Where it comes from: energy on this Module first or the Reserve, as you choose.
  const lo = Math.max(0, n - reserve);
  const hi = Math.min(n, onModule);
  let fromModule = lo;
  if (hi > lo) fromModule = (yield* ask(c, { kind: "amount", prompt: `How much of it from the ${onModule} ${colour} on this Module?`, rule: "8.6", min: lo, max: hi })).value as number;
  m.energy[colour] -= fromModule;
  c.state.player.reserve[colour] -= n - fromModule;
  c.state.supply.energy[colour] += n;
  log(c, `extra payment: ${n} ${colour} (${fromModule} from the Module, ${n - fromModule} from the Reserve)`, "8.6");
  return n;
}

/** 1 Demolition Blast - [1] Deal 2 damage to one unit. [2] Destroy one Bot. */
registerModule(1, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Demolition Blast: deal 2 damage to which unit?", "Module 1");
    if (u !== undefined) yield* dealHit(c, u, 2, "Module 1");
    const b = yield* chooseUnit(c, "Demolition Blast: destroy which Bot?", "Module 1", (x) => unitType(c, x) === "Bot");
    if (b !== undefined) destroy(c, b, "Module 1");
  },
});

/** 26 Charged Beam - Deal 2 damage to one unit. Extra payment: pay 1 to 3 more Red energy: deal that much more damage (one hit, Module convention 4). */
registerModule(26, {
  run: function* (c, m) {
    const u = yield* chooseUnit(c, "Charged Beam: deal 2 damage to which unit?", "Module 26");
    if (u === undefined) return;
    const more = yield* extraPayment(c, m.id, "Red", 3, "to deal that much more damage");
    yield* dealHit(c, u, 2 + more, "Module 26");
  },
});
