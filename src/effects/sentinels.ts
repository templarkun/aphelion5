/** Sentinel effects (S_01-S_27), resolved from their Alert token during an Overload. Texts: unit_list_structured.txt. */

import { type Effect, type RunCtx, ask, log } from "../engine/effect.js";
import { canBeChosen, choosableUnits, describe, fieldMap, level, sectorKeys, sectorOf, sectorState, strength, tile, unitType } from "../engine/field.js";
import { moduleDef } from "../engine/modules.js";
import { bury, isOpenSector, putAtBottom, reveal, teleport } from "../engine/moves.js";
import type { TileId } from "../engine/state.js";
import { damageFlagship, destroy, placeBarrier, placeBioShield, returnTokens } from "../engine/tokens.js";
import { ENERGY_COLOURS } from "../data/units.js";
import { fromKey, key } from "../geometry/hex.js";
import { chooseSector } from "./helpers.js";
import {
  activate,
  adjacentTo,
  best,
  boostEach,
  chooseOneOf,
  chooseRow,
  countType,
  destroyedBy,
  hitEach,
  horizontalRows,
  lineOfFireUnits,
  modulesWithEnergy,
  mostAbundantLevel,
  ofType,
  removeEnergyAny,
  revealUnits,
  rowsThrough,
  targetedUnits,
  turn,
  unitsIn,
} from "./kit.js";
import { registerUnit } from "./registry.js";

type Fx = (c: RunCtx, self: TileId) => Effect;
const sentinel = (id: string, activate: Fx) => registerUnit(id, { activate });
const here = (c: RunCtx, self: TileId) => sectorOf(c.state, self)!;
const isBot = (c: RunCtx) => (u: TileId) => unitType(c, u) === "Bot";
const chooseAdj = (c: RunCtx, self: TileId, f: (u: TileId) => boolean) => adjacentTo(c, here(c, self)).filter((u) => canBeChosen(c, u) && f(u));

/** S_01 - Deal 1 damage to your Flagship. */
sentinel("S_01", (c) => damageFlagship(c, 1, "S_01"));

/** S_02 - Remove 1 damage from each adjacent unit. */
sentinel("S_02", function* (c, self) {
  for (const u of chooseAdj(c, self, (x) => tile(c.state, x).tokens.damage > 0)) {
    tile(c.state, u).tokens.damage -= 1;
    log(c, `S_02: 1 Damage removed from ${describe(c, u)}`, "S_02");
  }
});

/** S_03 - If this unit's Strength is less than 3, Boost it. */
sentinel("S_03", function* (c, self) {
  if ((strength(c, self) ?? 99) < 3) yield* boostEach(c, [self], "S_03");
  else log(c, "S_03: Strength 3 or more, no Boost", "S_03");
});

/** S_04 - [1] Find the most abundant unit Level on the Field. [2] Boost all Bots of that Level. */
sentinel("S_04", function* (c) {
  const l = yield* mostAbundantLevel(c, "S_04");
  if (l === undefined) return;
  yield* boostEach(c, choosableUnits(c, (u) => isBot(c)(u) && level(c, u) === l), "S_04");
});

/** S_05 / S_11 - [1] Bury this unit. [2] If its sector is now Dark, Reveal it. If the revealed unit is a <type>, <then>. */
function buryAndReveal(id: string, type: "Bot" | "Mecha", then: (c: RunCtx, u: TileId) => Effect) {
  sentinel(id, function* (c, self) {
    const k = here(c, self);
    bury(c, self, id);
    if (sectorState(c.state, k) !== "dark") {
      log(c, `${id}: (${k}) is not Dark, nothing to reveal`, id);
      return;
    }
    const u = yield* reveal(c, k, id);
    if (unitType(c, u) === type) yield* then(c, u);
  });
}
buryAndReveal("S_05", "Bot", (c, u) => boostEach(c, [u], "S_05"));
buryAndReveal("S_11", "Mecha", function* (c, u) {
  yield* hitEach(c, [u], 2, "S_11");
});

/** S_06 - [1] Reveal one adjacent Dark sector. [2] Destroy one adjacent Mecha. */
sentinel("S_06", function* (c, self) {
  const k = here(c, self);
  const dark = sectorKeys(c.state).filter((x) => sectorState(c.state, x) === "dark" && adjacentKeys(c, k).includes(x));
  const to = yield* chooseSector(c, "S_06: Reveal which adjacent Dark sector?", "S_06", dark);
  if (to !== undefined) yield* reveal(c, to, "S_06");
  const m = yield* chooseOneOf(c, "S_06: destroy which adjacent Mecha?", "S_06", chooseAdj(c, self, (u) => unitType(c, u) === "Mecha"));
  if (m !== undefined) destroy(c, m, "S_06");
});

function adjacentKeys(c: RunCtx, k: string): string[] {
  return fieldMap(c.state).adjacent(fromKey(k)).map(key);
}

/** S_07 - [1] Choose a Mecha. [2] Remove all its tokens and put it at the very bottom of its sector. */
sentinel("S_07", function* (c) {
  const m = yield* chooseOneOf(c, "S_07: choose a Mecha.", "S_07", choosableUnits(c, (u) => unitType(c, u) === "Mecha"));
  if (m === undefined) return;
  returnTokens(c, m);
  putAtBottom(c, m, "S_07");
});

/** S_08 - Remove 1 energy from your Modules for each Bot on the Field that is not adjacent to this unit. You choose which energy. */
sentinel("S_08", function* (c, self) {
  const near = adjacentTo(c, here(c, self));
  const n = ofType(c, "Bot").filter((u) => !near.includes(u)).length;
  log(c, `S_08: ${n} Bot${n === 1 ? "" : "s"} not adjacent`, "S_08");
  yield* removeEnergyAny(c, n, "S_08");
});

/** S_09 - [1] Choose Level 1, Level 2 or Level 3. [2] Boost all Bots of the chosen Level. */
sentinel("S_09", function* (c) {
  const a = yield* ask(c, { kind: "option", prompt: "S_09: choose a Level.", rule: "S_09", options: [1, 2, 3].map((l) => ({ id: String(l), label: `Level ${l}` })) });
  yield* boostEach(c, choosableUnits(c, (u) => isBot(c)(u) && level(c, u) === Number(a.value)), "S_09");
});

/** S_10 - [1] Reveal two units. [2] Boost every Bot just revealed. */
sentinel("S_10", function* (c) {
  const r = yield* revealUnits(c, 2, "S_10");
  yield* boostEach(c, r.filter((u) => unitType(c, u) === "Bot"), "S_10");
});

/** S_12 - If at least one Bot is adjacent, destroy one of them and deal 2 damage to your Flagship. */
sentinel("S_12", function* (c, self) {
  const bots = chooseAdj(c, self, isBot(c));
  if (bots.length === 0) {
    log(c, "S_12: no adjacent Bot, nothing happens", "S_12");
    return;
  }
  const b = yield* chooseOneOf(c, "S_12: destroy which adjacent Bot?", "S_12", bots);
  destroy(c, b!, "S_12");
  yield* damageFlagship(c, 2, "S_12");
});

/** S_13 - Choose a Module with at least 1 energy on it. Remove all energy from that Module. */
sentinel("S_13", function* (c) {
  const mods = modulesWithEnergy(c);
  if (mods.length === 0) {
    log(c, "S_13: no Module has energy", "S_13");
    return;
  }
  const id = mods.length === 1 ? mods[0]! : Number((yield* ask(c, { kind: "option", pick: "modules", prompt: "S_13: remove all energy from which Module?", rule: "S_13", options: mods.map((m) => ({ id: String(m), label: moduleDef(c, m).name })) })).value);
  const m = c.state.player.modules.find((x) => x.id === id)!;
  for (const col of ENERGY_COLOURS) {
    c.state.supply.energy[col] += m.energy[col];
    m.energy[col] = 0;
  }
  log(c, `S_13: all energy removed from ${moduleDef(c, id).name}`, "S_13");
});

/** S_14 - [1] Choose the row through this unit that has the most Bots. [2] If it has at least one Bot, Boost all units in that row, including this unit. */
sentinel("S_14", function* (c, self) {
  const bots = (r: { sectors: { q: number; r: number }[] }) => unitsIn(c, r.sectors).filter((u) => unitType(c, u) === "Bot").length;
  const row = yield* chooseRow(c, "S_14: choose the row through this unit with the most Bots.", "S_14", best(rowsThrough(c, self), bots));
  if (!row || bots(row) === 0) {
    log(c, "S_14: no Bot in that row", "S_14");
    return;
  }
  yield* boostEach(c, unitsIn(c, row.sectors), "S_14");
});

/** S_15 - [1] Reveal two units. [2] For each Mecha just revealed, deal 1 damage to your Flagship. */
sentinel("S_15", function* (c) {
  const r = yield* revealUnits(c, 2, "S_15");
  yield* damageFlagship(c, r.filter((u) => unitType(c, u) === "Mecha").length, "S_15");
});

/** S_16 - [1] Turn this unit clockwise by one side for each Sentinel on the Field, including this unit. [2] Boost all Bots in its lines of fire. */
sentinel("S_16", function* (c, self) {
  turn(c, self, countType(c, "Sentinel"), "S_16");
  yield* boostEach(c, lineOfFireUnits(c, self).filter(isBot(c)), "S_16");
});

/** S_17 - Boost all adjacent Gyros. */
sentinel("S_17", (c, self) => boostEach(c, chooseAdj(c, self, (u) => unitType(c, u) === "Gyro"), "S_17"));

/** S_18 - [1] Choose a horizontal row with at least one Mecha in it. [2] Deal 1 damage to all Mecha and Gyros in that row. */
sentinel("S_18", function* (c) {
  const rows = horizontalRows(c).filter((r) => unitsIn(c, r.sectors).some((u) => unitType(c, u) === "Mecha"));
  const row = yield* chooseRow(c, "S_18: choose a horizontal row with a Mecha.", "S_18", rows);
  if (row) yield* hitEach(c, unitsIn(c, row.sectors).filter((u) => ["Mecha", "Gyro"].includes(unitType(c, u))), 1, "S_18");
});

/** S_19 - [1] Deal 1 damage to all Gyros. [2] Deal 1 damage to your Flagship for each Gyro destroyed this way. */
sentinel("S_19", function* (c) {
  const r = yield* hitEach(c, ofType(c, "Gyro"), 1, "S_19");
  yield* damageFlagship(c, destroyedBy(r), "S_19");
});

/** S_20 - [1] Deal 1 damage to all other units in a row through this unit. [2] If no Mecha was destroyed this way, deal 3 damage to your Flagship. */
sentinel("S_20", function* (c, self) {
  const row = yield* chooseRow(c, "S_20: choose a row through this unit.", "S_20", rowsThrough(c, self));
  const r = yield* hitEach(c, unitsIn(c, row!.sectors).filter((u) => u !== self), 1, "S_20");
  const mecha = r.filter((x) => x.kind === "damaged" && x.destroyed?.type === "Mecha").length;
  if (mecha === 0) yield* damageFlagship(c, 3, "S_20");
  else log(c, `S_20: ${mecha} Mecha destroyed, no Flagship damage`, "S_20");
});

/** S_21 - [1] Activate all Sleepers. [2] Drain all Gyros. (Both give Alert tokens, 11.1 rule 6.) */
sentinel("S_21", function* (c) {
  activate(c, ofType(c, "Sleeper"), "S_21");
  activate(c, ofType(c, "Gyro"), "S_21");
});

/** S_22 - Deal 1 damage to this unit for each Sentinel on the Field, including this unit. This is a single hit. */
sentinel("S_22", function* (c, self) {
  yield* hitEach(c, [self], countType(c, "Sentinel"), "S_22");
});

/** S_23 - Place a Barrier on one Sentinel that has none. It may be this unit. */
sentinel("S_23", function* (c) {
  const s = yield* chooseOneOf(c, "S_23: place a Barrier on which Sentinel?", "S_23", choosableUnits(c, (u) => unitType(c, u) === "Sentinel" && !tile(c.state, u).tokens.barrier));
  if (s !== undefined) placeBarrier(c, s, "S_23");
});

/** S_24 - [1] Destroy all Level 1 Bots. [2] Deal 1 damage to your Flagship for each Bot destroyed this way. */
sentinel("S_24", function* (c) {
  let n = 0;
  for (const u of choosableUnits(c, (x) => isBot(c)(x) && level(c, x) === 1)) if (destroy(c, u, "S_24")) n++;
  yield* damageFlagship(c, n, "S_24");
});

/** S_25 - [1] Teleport this unit to any Dark sector. You may rotate it. [2] Boost every Targeted unit. */
sentinel("S_25", function* (c, self) {
  const open = sectorKeys(c.state).filter((k) => isOpenSector(c, k));
  const to = yield* chooseSector(c, "S_25: Teleport this unit to which Dark sector?", "S_25", open);
  if (to !== undefined) teleport(c, self, to, "S_25");
  const a = yield* ask(c, {
    kind: "option",
    prompt: "S_25: you may rotate it. Choose its facing.",
    rule: "S_25",
    facing: { tile: self, start: tile(c.state, self).facing },
    options: [0, 1, 2, 3, 4, 5].map((f) => ({ id: String(f), label: f === tile(c.state, self).facing ? `${f} (keep)` : String(f) })),
  });
  tile(c.state, self).facing = Number(a.value) as 0;
  yield* boostEach(c, targetedUnits(c, self), "S_25");
});

/** S_26 - Place a Bio-shield on every adjacent Bot. */
sentinel("S_26", function* (c, self) {
  for (const u of chooseAdj(c, self, isBot(c))) placeBioShield(c, u);
});

/** S_27 - [1] Boost this unit once for each adjacent Bot. [2] If it now has 5 or more Shield and Bio-shield tokens combined, remove all of them (no Bio-shield effect) and deal 4 damage to your Flagship. [3] Deal 1 damage to all Bots. */
sentinel("S_27", function* (c, self) {
  const n = chooseAdj(c, self, isBot(c)).length;
  for (let i = 0; i < n; i++) yield* boostEach(c, [self], "S_27");
  const t = tile(c.state, self).tokens;
  if (t.shield + t.bioShield >= 5) {
    c.state.supply.shield += t.shield;
    c.state.supply.bioShield += t.bioShield;
    log(c, `S_27: ${t.shield + t.bioShield} Shield tokens removed`, "S_27");
    t.shield = 0;
    t.bioShield = 0;
    yield* damageFlagship(c, 4, "S_27");
  }
  yield* hitEach(c, ofType(c, "Bot"), 1, "S_27");
});

