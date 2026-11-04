/** Flare effects (F_02-F_28), resolved from their Alert token during an Overload. F_01 (Power Node) has none. */

import { type Effect, type RunCtx, ask, log } from "../engine/effect.js";
import { canBeChosen, choosableUnits, describe, fieldMap, level, sectorOf, sectorState, strength, tile, unitType } from "../engine/field.js";
import { moduleDef, runModule } from "../engine/modules.js";
import { bury, reveal } from "../engine/moves.js";
import type { TileId } from "../engine/state.js";
import { boost, damageFlagship, dealHit, destroy, repairFlagship } from "../engine/tokens.js";
import { fromKey, key } from "../geometry/hex.js";
import { chooseDarkSector } from "./helpers.js";
import {
  activate,
  adjacentTo,
  boostEach,
  chooseOneOf,
  chooseRow,
  chooseUnits,
  countType,
  hitEach,
  horizontalRows,
  lineOfFireUnits,
  ofType,
  placeEnergyOn,
  printedCost,
  readyIds,
  revealSectors,
  revealUnits,
  targetedUnits,
  unitsIn,
} from "./kit.js";
import { registerUnit } from "./registry.js";

type Fx = (c: RunCtx, self: TileId) => Effect;
const flare = (id: string, activate: Fx) => registerUnit(id, { activate });
const here = (c: RunCtx, self: TileId) => sectorOf(c.state, self)!;
const adj = (c: RunCtx, self: TileId, f: (u: TileId) => boolean = () => true) => adjacentTo(c, here(c, self)).filter((u) => canBeChosen(c, u) && f(u));
const is = (c: RunCtx, ...types: string[]) => (u: TileId) => types.includes(unitType(c, u));

/** F_02 - [1] Reveal all adjacent Dark sectors. [2] Remove the Barrier from each Sentinel just revealed and give it an Alert token. */
flare("F_02", function* (c, self) {
  const dark = fieldMap(c.state)
    .adjacent(fromKey(here(c, self)))
    .map(key)
    .filter((k) => sectorState(c.state, k) === "dark");
  const r = yield* revealSectors(c, dark, "F_02");
  for (const u of r.filter(is(c, "Sentinel"))) {
    if (!canBeChosen(c, u)) continue;
    const t = tile(c.state, u).tokens;
    if (t.barrier) {
      t.barrier = false;
      c.state.supply.barrier += 1;
      log(c, `F_02: ${describe(c, u)} loses its Barrier`, "F_02");
    }
    if (!t.alert) {
      t.alert = true;
      log(c, `F_02: ${describe(c, u)} gets an Alert token`, "F_02");
    }
  }
});

/** F_03 - [1] Destroy one adjacent Bot. [2] Deal damage to your Flagship equal to that Bot's Strength just before it was destroyed. */
flare("F_03", function* (c, self) {
  const b = yield* chooseOneOf(c, "F_03: destroy which adjacent Bot?", "F_03", adj(c, self, is(c, "Bot")));
  if (b === undefined) return;
  const info = destroy(c, b, "F_03");
  yield* damageFlagship(c, info?.strength ?? 0, "F_03");
});

/** F_04 - [1] Reveal one unit. [2] You may deal 2 damage to it. */
flare("F_04", function* (c) {
  const k = yield* chooseDarkSector(c, "F_04: Reveal which Dark sector?", "F_04");
  if (k === undefined) return;
  const u = yield* reveal(c, k, "F_04");
  // A Flare or Wreck cannot be damaged: nothing to ask (11.1 rule 5; designer agreed, batch 4 T4_ALR_01).
  if (!canBeChosen(c, u)) return;
  const a = yield* ask(c, { kind: "yesno", prompt: `F_04: deal 2 damage to ${describe(c, u)}?`, rule: "F_04" });
  if (a.value === true) yield* dealHit(c, u, 2, "F_04");
});

/** F_05 - Boost all Level 1 units. */
flare("F_05", (c) => boostEach(c, choosableUnits(c, (u) => level(c, u) === 1), "F_05"));

/** F_06 - [1] Choose one horizontal row. [2] Remove 1 damage from every damaged unit in that row and deal 1 damage to every other unit in it. Check which units are damaged before doing either. */
flare("F_06", function* (c) {
  const row = yield* chooseRow(c, "F_06: choose a horizontal row.", "F_06", horizontalRows(c));
  const inRow = unitsIn(c, row!.sectors).filter((u) => canBeChosen(c, u));
  const damaged = inRow.filter((u) => tile(c.state, u).tokens.damage > 0);
  for (const u of damaged) {
    tile(c.state, u).tokens.damage -= 1;
    log(c, `F_06: 1 Damage removed from ${describe(c, u)}`, "F_06");
  }
  yield* hitEach(c, inRow.filter((u) => !damaged.includes(u)), 1, "F_06");
});

/** F_07 - [1] Remove 1 damage from your Flagship for each Gyro and each Sleeper on the Field. [2] Drain all Gyros and activate all Sleepers. */
flare("F_07", function* (c) {
  yield* repairFlagship(c, countType(c, "Gyro") + countType(c, "Sleeper"), "F_07");
  activate(c, ofType(c, "Gyro"), "F_07");
  activate(c, ofType(c, "Sleeper"), "F_07");
});

/** F_08 - [1] Reveal up to three units. [2] Deal 1 damage to each unit just revealed whose type appears at least twice among them. */
flare("F_08", function* (c) {
  const r = yield* revealUnits(c, 3, "F_08", true);
  const types = r.map((u) => unitType(c, u));
  yield* hitEach(c, r.filter((u) => types.filter((t) => t === unitType(c, u)).length >= 2), 1, "F_08");
});

/** F_09 - Boost every Targeted unit. */
flare("F_09", (c, self) => boostEach(c, targetedUnits(c, self), "F_09"));

/** F_10 - Bury one Sentinel. */
flare("F_10", function* (c) {
  const s = yield* chooseOneOf(c, "F_10: Bury which Sentinel?", "F_10", choosableUnits(c, is(c, "Sentinel")));
  if (s !== undefined) bury(c, s, "F_10");
});

/** F_11 - Deal 1 damage to all Gyros. */
flare("F_11", function* (c) {
  yield* hitEach(c, ofType(c, "Gyro"), 1, "F_11");
});

/** F_12 - Deal 1 damage to every unit in its line of fire. */
flare("F_12", function* (c, self) {
  yield* hitEach(c, lineOfFireUnits(c, self), 1, "F_12");
});

/** F_13 - Activate all Mecha. */
flare("F_13", function* (c) {
  activate(c, ofType(c, "Mecha"), "F_13");
});

/** F_14 - [1] If there are three or more Mecha on the Field, destroy one Mecha. [2] Then, if there are three or more Bots on the Field, destroy one Bot. */
flare("F_14", function* (c) {
  for (const type of ["Mecha", "Bot"] as const) {
    if (countType(c, type) < 3) {
      log(c, `F_14: fewer than three ${type === "Bot" ? "Bots" : "Mecha"}`, "F_14");
      continue;
    }
    const u = yield* chooseOneOf(c, `F_14: destroy which ${type}?`, "F_14", choosableUnits(c, is(c, type)));
    if (u !== undefined) destroy(c, u, "F_14");
  }
});

/** F_15 - [1] Destroy one adjacent Bot or Mecha. [2] If it was a Bot, deal 2 damage to your Flagship. If it was a Mecha, remove 2 damage from your Flagship. */
flare("F_15", function* (c, self) {
  const u = yield* chooseOneOf(c, "F_15: destroy which adjacent Bot or Mecha?", "F_15", adj(c, self, is(c, "Bot", "Mecha")));
  if (u === undefined) return;
  const type = unitType(c, u);
  destroy(c, u, "F_15");
  if (type === "Bot") yield* damageFlagship(c, 2, "F_15");
  else yield* repairFlagship(c, 2, "F_15");
});

/** F_16 - If there are exactly three Bots on the Field, deal 2 damage to your Flagship. */
flare("F_16", function* (c) {
  if (countType(c, "Bot") === 3) yield* damageFlagship(c, 2, "F_16");
  else log(c, "F_16: not exactly three Bots", "F_16");
});

/** F_17 - Check the Strength of every adjacent unit first. Then deal 1 damage to each one with Strength 2 or more, and Boost each one with Strength exactly 1. */
flare("F_17", function* (c, self) {
  const near = adj(c, self);
  const s = new Map(near.map((u) => [u, strength(c, u)!]));
  yield* hitEach(c, near.filter((u) => s.get(u)! >= 2), 1, "F_17");
  yield* boostEach(c, near.filter((u) => s.get(u) === 1), "F_17");
});

/** F_18 - You may run one ready red-background Module without paying its cost. */
flare("F_18", function* (c) {
  const ids = c.state.player.modules.filter((m) => m.ready && moduleDef(c, m.id).background === "red" && c.state.phase === "overload").map((m) => m.id);
  if (ids.length === 0) {
    log(c, "F_18: no ready red Module", "F_18");
    return;
  }
  const a = yield* ask(c, { kind: "option", pick: "modules", prompt: "F_18: you may run one ready red Module without paying its cost.", rule: "F_18", options: [...ids.map((m) => ({ id: String(m), label: moduleDef(c, m).name })), { id: "none", label: "Run none" }] });
  if (a.value !== "none") yield* runModule(c, Number(a.value), true);
});

/** F_19 - [1] Remove 1 Shield or Bio-shield token from each adjacent unit that has one (your choice which; no Bio-shield effect). [2] Then deal 1 damage to all adjacent units. */
flare("F_19", function* (c, self) {
  const near = adj(c, self);
  for (const u of near) {
    const t = tile(c.state, u).tokens;
    if (t.shield + t.bioShield === 0) continue;
    let bio = t.bioShield > 0 && t.shield === 0;
    if (t.shield > 0 && t.bioShield > 0) bio = (yield* ask(c, { kind: "option", prompt: `F_19: remove a Shield or a Bio-shield from ${describe(c, u)}?`, rule: "F_19", options: [{ id: "shield", label: "Shield" }, { id: "bio", label: "Bio-shield" }] })).value === "bio";
    if (bio) {
      t.bioShield -= 1;
      c.state.supply.bioShield += 1;
    } else {
      t.shield -= 1;
      c.state.supply.shield += 1;
    }
    log(c, `F_19: ${describe(c, u)} loses a ${bio ? "Bio-shield (no effect)" : "Shield"}`, "F_19");
  }
  yield* hitEach(c, near, 1, "F_19");
});

/** F_20 - [1] Reveal up to two units. [2] If you revealed two units with the same Level, deal 2 damage to each of them. */
flare("F_20", function* (c) {
  const r = yield* revealUnits(c, 2, "F_20", true);
  const [a, b] = r;
  if (r.length === 2 && level(c, a!) !== undefined && level(c, a!) === level(c, b!)) yield* hitEach(c, r, 2, "F_20");
  else log(c, "F_20: not two units with the same Level", "F_20");
});

/** F_21 - Destroy one adjacent Mecha and one adjacent Bot. */
flare("F_21", function* (c, self) {
  for (const type of ["Mecha", "Bot"]) {
    const u = yield* chooseOneOf(c, `F_21: destroy which adjacent ${type}?`, "F_21", adj(c, self, is(c, type)));
    if (u !== undefined) destroy(c, u, "F_21");
  }
});

/** F_22 - [1] Choose a horizontal row with at least one Mecha in it. [2] Deal 1 damage to all units in that row. */
flare("F_22", function* (c) {
  const rows = horizontalRows(c).filter((r) => unitsIn(c, r.sectors).some(is(c, "Mecha")));
  const row = yield* chooseRow(c, "F_22: choose a horizontal row with a Mecha.", "F_22", rows);
  if (row) yield* hitEach(c, unitsIn(c, row.sectors), 1, "F_22");
});

/** F_23 - Deal 1 damage to every Targeted unit. */
flare("F_23", function* (c, self) {
  yield* hitEach(c, targetedUnits(c, self), 1, "F_23");
});

/** F_24 - Deal 1 damage to all units with the highest Strength on the Field. */
flare("F_24", function* (c) {
  const all = choosableUnits(c);
  if (all.length === 0) return;
  const top = Math.max(...all.map((u) => strength(c, u)!));
  yield* hitEach(c, all.filter((u) => strength(c, u) === top), 1, "F_24");
});

/** F_25 - [1] Choose a ready Module with the lowest cost. [2] Place 3 energy of that Module's colour on it. */
flare("F_25", function* (c) {
  const ready = readyIds(c);
  if (ready.length === 0) {
    log(c, "F_25: no ready Module", "F_25");
    return;
  }
  const low = Math.min(...ready.map((m) => printedCost(c, m)));
  const ids = ready.filter((m) => printedCost(c, m) === low);
  const id = ids.length === 1 ? ids[0]! : Number((yield* ask(c, { kind: "option", pick: "modules", prompt: "F_25: choose a ready Module with the lowest cost.", rule: "F_25", options: ids.map((m) => ({ id: String(m), label: moduleDef(c, m).name })) })).value);
  yield* placeEnergyOn(c, id, 3, "F_25", moduleDef(c, id).colour);
});

/** F_26 - Boost three different Bots and three different Mecha. */
flare("F_26", function* (c) {
  const bots = yield* chooseUnits(c, "F_26: Boost which three Bots?", "F_26", choosableUnits(c, is(c, "Bot")), 3);
  const mecha = yield* chooseUnits(c, "F_26: Boost which three Mecha?", "F_26", choosableUnits(c, is(c, "Mecha")), 3);
  if (bots.length + mecha.length > 0) yield* boost(c, [...bots, ...mecha], "F_26");
});

/** F_27 - [1] Count 1 for each Bot on the Field, minus 1 for each Mecha. [2] If the total is above 0, you may place that much energy on one ready Module. */
flare("F_27", function* (c) {
  const n = countType(c, "Bot") - countType(c, "Mecha");
  const ready = readyIds(c);
  if (n <= 0 || ready.length === 0) {
    log(c, `F_27: total ${n}${ready.length === 0 ? ", no ready Module" : ""}`, "F_27");
    return;
  }
  const a = yield* ask(c, { kind: "option", pick: "modules", prompt: `F_27: you may place ${n} energy on one ready Module.`, rule: "F_27", options: [...ready.map((m) => ({ id: String(m), label: moduleDef(c, m).name })), { id: "none", label: "Place none" }] });
  if (a.value !== "none") yield* placeEnergyOn(c, Number(a.value), n, "F_27");
});

/** F_28 - Choose one horizontal row and Boost all units in it. */
flare("F_28", function* (c) {
  const row = yield* chooseRow(c, "F_28: choose a horizontal row.", "F_28", horizontalRows(c));
  yield* boostEach(c, unitsIn(c, row!.sectors), "F_28");
});

