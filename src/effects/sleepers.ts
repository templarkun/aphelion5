/** Sleeper effects (P_01-P_27), resolved from their Alert token; the Sleeper is discarded afterwards (4.4). */

import type { UnitType } from "../data/units.js";
import { type Effect, type RunCtx, ask, log } from "../engine/effect.js";
import { canBeChosen, choosableUnits, describe, level, sectorOf, tile, unitType, units } from "../engine/field.js";
import { moduleDef, runModule } from "../engine/modules.js";
import { markSeen, putAtBottom, requestOverload } from "../engine/moves.js";
import type { TileId } from "../engine/state.js";
import { hasAnyToken } from "../engine/state.js";
import { damageFlagship, placeBarrier, placeFuse, removeDamage, repairFlagship, returnTokens } from "../engine/tokens.js";
import {
  adjacentTo,
  best,
  boostEach,
  chooseOneOf,
  chooseRow,
  chooseUnits,
  couldRunFree,
  countType,
  hitEach,
  horizontalRows,
  lineOfFireUnits,
  mostAbundantLevel,
  ofType,
  placeEnergySplit,
  printedCost,
  readyIds,
  removeEnergyAny,
  targetedUnits,
  turn,
  unitsIn,
} from "./kit.js";
import { registerUnit } from "./registry.js";

type Fx = (c: RunCtx, self: TileId) => Effect;
const sleeper = (id: string, activate: Fx) => registerUnit(id, { activate });
const here = (c: RunCtx, self: TileId) => sectorOf(c.state, self)!;
const adj = (c: RunCtx, self: TileId, f: (u: TileId) => boolean = () => true) => adjacentTo(c, here(c, self)).filter((u) => canBeChosen(c, u) && f(u));
const is = (c: RunCtx, ...types: string[]) => (u: TileId) => types.includes(unitType(c, u));

/** Every unit type, in rulebook order (4. Units). */
const TYPES: UnitType[] = ["Bot", "Mecha", "Gyro", "Sleeper", "Sentinel", "Flare", "Omega"];

/** P_01 - Deal 1 damage to every Targeted unit. */
sleeper("P_01", function* (c, self) {
  yield* hitEach(c, targetedUnits(c, self), 1, "P_01");
});

/** P_02 - Boost all adjacent units. */
sleeper("P_02", (c, self) => boostEach(c, adj(c, self), "P_02"));

/** P_03 - Deal 1 damage to one adjacent Level 1 unit, one adjacent Level 2 unit and one adjacent Level 3 unit. */
sleeper("P_03", function* (c, self) {
  for (const l of [1, 2, 3]) {
    const u = yield* chooseOneOf(c, `P_03: deal 1 damage to which adjacent Level ${l} unit?`, "P_03", adj(c, self, (x) => level(c, x) === l));
    if (u !== undefined) yield* hitEach(c, [u], 1, "P_03");
  }
});

/** P_04 - [1] Find the most abundant unit Level on the Field. [2] Deal 1 damage to all units of that Level. */
sleeper("P_04", function* (c) {
  const l = yield* mostAbundantLevel(c, "P_04");
  if (l !== undefined) yield* hitEach(c, choosableUnits(c, (u) => level(c, u) === l), 1, "P_04");
});

/** P_05 - [1] Start an Overload. [2] If there is at least one Sentinel on the Field, remove 1 damage from your Flagship. */
sleeper("P_05", function* (c) {
  requestOverload(c, "P_05");
  if (countType(c, "Sentinel") > 0) yield* repairFlagship(c, 1, "P_05");
  else log(c, "P_05: no Sentinel on the Field", "P_05");
});

/** P_06 - [1] Count 1 for each Bot, minus 1 for each Mecha. [2] Above 0: place that much energy on your ready Modules, split as you choose. Below 0: remove that much energy from your Modules, your choice which. */
sleeper("P_06", function* (c) {
  const n = countType(c, "Bot") - countType(c, "Mecha");
  log(c, `P_06: total ${n}`, "P_06");
  if (n > 0) yield* placeEnergySplit(c, n, "P_06");
  else if (n < 0) yield* removeEnergyAny(c, -n, "P_06");
});

/** P_07 - [1] Find the most abundant unit type on the Field, other than Bot and Flare. [2] Deal 1 damage to all units of that type. */
sleeper("P_07", function* (c) {
  const counts = TYPES.filter((t) => t !== "Bot" && t !== "Flare").map((t) => [t, countType(c, t)] as const).filter(([, n]) => n > 0);
  if (counts.length === 0) return;
  const top = Math.max(...counts.map(([, n]) => n));
  const tied = counts.filter(([, n]) => n === top).map(([t]) => t);
  const type = tied.length === 1 ? tied[0]! : ((yield* ask(c, { kind: "option", prompt: `P_07: ${tied.join(", ")} are tied as the most abundant type. Choose one.`, rule: "P_07", options: tied.map((t) => ({ id: t, label: t })) })).value as UnitType);
  yield* hitEach(c, ofType(c, type), 1, "P_07");
});

/** P_08 - [1] If there is exactly one Bot on the Field, deal 2 damage to it. [2] Do the same for each other unit type. */
sleeper("P_08", function* (c) {
  const bots = ofType(c, "Bot");
  if (bots.length === 1) yield* hitEach(c, bots, 2, "P_08");
  // Step 2: every other type, counted when the step starts (E4).
  const singles = TYPES.filter((t) => t !== "Bot")
    .map((t) => ofType(c, t))
    .filter((us) => us.length === 1)
    .map((us) => us[0]!);
  yield* hitEach(c, singles, 2, "P_08");
});

/** P_09 - Place a Tick on every Targeted unit. */
sleeper("P_09", function* (c, self) {
  for (const u of targetedUnits(c, self)) placeFuse(c, u, "tick", "P_09");
});

/** P_10 - If there is at least one Sentinel on the Field, start an Overload. */
sleeper("P_10", function* (c) {
  if (countType(c, "Sentinel") > 0) requestOverload(c, "P_10");
  else log(c, "P_10: no Sentinel on the Field", "P_10");
});

/** P_11 - [1] Deal 1 damage to all damaged units. [2] Deal 1 damage to your Flagship for each unit destroyed this way. */
sleeper("P_11", function* (c) {
  const r = yield* hitEach(c, choosableUnits(c, (u) => tile(c.state, u).tokens.damage > 0), 1, "P_11");
  yield* damageFlagship(c, r.filter((x) => x.kind === "damaged" && x.destroyed).length, "P_11");
});

/** P_12 - Remove 1 damage from every unit on the Field. */
sleeper("P_12", function* (c) {
  for (const u of choosableUnits(c, (x) => tile(c.state, x).tokens.damage > 0)) {
    removeDamage(c, u, "P_12");
    log(c, `P_12: 1 Damage removed from ${describe(c, u)}`, "P_12");
  }
});

/** P_13 - [1] Turn this unit clockwise by one side for each Bot on the Field. [2] Deal 1 damage to all units in its line of fire. */
sleeper("P_13", function* (c, self) {
  turn(c, self, countType(c, "Bot"), "P_13");
  yield* hitEach(c, lineOfFireUnits(c, self), 1, "P_13");
});

/** P_14 - Place a Tick on every adjacent non-Bot unit. */
sleeper("P_14", function* (c, self) {
  for (const u of adj(c, self, (x) => unitType(c, x) !== "Bot")) placeFuse(c, u, "tick", "P_14");
});

/** P_15 - [1] Deal 1 damage to one Bot. [2] Do the same for each other unit type on the Field. */
sleeper("P_15", function* (c) {
  const b = yield* chooseOneOf(c, "P_15: deal 1 damage to which Bot?", "P_15", choosableUnits(c, is(c, "Bot")));
  if (b !== undefined) yield* hitEach(c, [b], 1, "P_15");
  const present = TYPES.filter((t) => t !== "Bot" && countType(c, t) > 0);
  for (const t of present) {
    const u = yield* chooseOneOf(c, `P_15: deal 1 damage to which ${t}?`, "P_15", choosableUnits(c, is(c, t)));
    if (u !== undefined) yield* hitEach(c, [u], 1, "P_15");
  }
});

const botsIn = (c: RunCtx) => (r: { sectors: { q: number; r: number }[] }) => unitsIn(c, r.sectors).filter(is(c, "Bot")).length;

/** P_16 - [1] Choose a horizontal row with the fewest Bots. [2] Deal 1 damage to all units in that row. */
sleeper("P_16", function* (c) {
  const row = yield* chooseRow(c, "P_16: choose a horizontal row with the fewest Bots.", "P_16", best(horizontalRows(c), botsIn(c), true));
  yield* hitEach(c, unitsIn(c, row!.sectors), 1, "P_16");
});

/** P_17 - [1] Choose a horizontal row and Boost all units in it. [2] Choose a different horizontal row and deal 1 damage to all units in it. */
sleeper("P_17", function* (c) {
  const rows = horizontalRows(c);
  const a = yield* chooseRow(c, "P_17: choose a horizontal row to Boost.", "P_17", rows);
  yield* boostEach(c, unitsIn(c, a!.sectors), "P_17");
  const b = yield* chooseRow(c, "P_17: choose a different horizontal row to damage.", "P_17", rows.filter((r) => r.value !== a!.value));
  if (b) yield* hitEach(c, unitsIn(c, b.sectors), 1, "P_17");
});

/** P_18 - Three different horizontal rows: a Tick on every Gyro in the first, every Mecha in the second, every Sentinel in the third. */
sleeper("P_18", function* (c) {
  const used: number[] = [];
  for (const type of ["Gyro", "Mecha", "Sentinel"]) {
    const row = yield* chooseRow(c, `P_18: choose a${used.length ? " different" : ""} horizontal row for a Tick on every ${type}.`, "P_18", horizontalRows(c).filter((r) => !used.includes(r.value)));
    if (!row) return;
    used.push(row.value);
    for (const u of unitsIn(c, row.sectors).filter((x) => canBeChosen(c, x) && unitType(c, x) === type)) placeFuse(c, u, "tick", "P_18");
  }
});

/** P_19 - [1] Choose the lowest-cost ready Module you could run right now (light in the Command phase, red during an Overload). [2] Run it without paying its cost. */
sleeper("P_19", function* (c) {
  const ids = readyIds(c).filter((m) => couldRunFree(c, m));
  if (ids.length === 0) {
    log(c, "P_19: no ready Module you could run now", "P_19");
    return;
  }
  const low = Math.min(...ids.map((m) => printedCost(c, m)));
  const lowest = ids.filter((m) => printedCost(c, m) === low);
  const id = lowest.length === 1 ? lowest[0]! : Number((yield* ask(c, { kind: "option", pick: "modules", prompt: "P_19: choose the lowest-cost Module to run free.", rule: "P_19", options: lowest.map((m) => ({ id: String(m), label: moduleDef(c, m).name })) })).value);
  yield* runModule(c, id, true);
});

/** P_20 - [1] Turn this unit clockwise by one side for each Sentinel on the Field. [2] Boost all units in its line of fire. */
sleeper("P_20", function* (c, self) {
  turn(c, self, countType(c, "Sentinel"), "P_20");
  yield* boostEach(c, lineOfFireUnits(c, self), "P_20");
});

/** P_21 - If there are exactly three Bots on the Field, deal 1 damage to all Bots. */
sleeper("P_21", function* (c) {
  const bots = ofType(c, "Bot");
  if (bots.length === 3) yield* hitEach(c, bots, 1, "P_21");
  else log(c, "P_21: not exactly three Bots", "P_21");
});

/** P_22 - Deal 6 damage to your Flagship, minus 1 for each Bot on the Field (minimum 0). */
sleeper("P_22", (c) => damageFlagship(c, Math.max(0, 6 - countType(c, "Bot")), "P_22"));

/** P_23 - Boost five different non-Mecha units. */
sleeper("P_23", function* (c) {
  const us = yield* chooseUnits(c, "P_23: Boost which five non-Mecha units?", "P_23", choosableUnits(c, (u) => unitType(c, u) !== "Mecha"), 5);
  if (us.length > 0) yield* boostEach(c, us, "P_23");
});

/** P_24 - [1] Choose the Sentinel with the most Damage tokens. [2] Remove all its tokens and put it at the very bottom of its sector. */
sleeper("P_24", function* (c) {
  const ss = choosableUnits(c, is(c, "Sentinel"));
  if (ss.length === 0) {
    log(c, "P_24: no Sentinel", "P_24");
    return;
  }
  const most = Math.max(...ss.map((u) => tile(c.state, u).tokens.damage));
  // Designer, Q5: with no Damage on any Sentinel they are all tied at 0, and you choose one of them.
  const s = yield* chooseOneOf(c, "P_24: choose the Sentinel with the most Damage tokens.", "P_24", ss.filter((u) => tile(c.state, u).tokens.damage === most));
  returnTokens(c, s!);
  putAtBottom(c, s!, "P_24");
});

/** P_25 - Flip face down every adjacent unit that has no tokens. Each of those sectors becomes Dark. (Flares too, unit file rule 10.) */
sleeper("P_25", function* (c, self) {
  // Not "chosen", so Flares are flipped as well (CLAUDE.md decision); Wrecks always hold tokens.
  const flip = adjacentTo(c, here(c, self)).filter((u) => !hasAnyToken(tile(c.state, u).tokens));
  for (const u of flip) {
    tile(c.state, u).faceUp = false;
    log(c, `P_25: ${describe(c, u)} is flipped face down`, "P_25");
  }
  // The player saw these tiles: they are known face-down tiles.
  if (flip.length) markSeen(c, flip, false);
});

/** P_26 - Place a Barrier on every Sentinel that has none. */
sleeper("P_26", function* (c) {
  for (const u of choosableUnits(c, (x) => unitType(c, x) === "Sentinel" && !tile(c.state, x).tokens.barrier)) placeBarrier(c, u, "P_26");
});

/** P_27 - [1] Deal 1 damage to all Sentinels. [2] Deal 1 damage to your Flagship for each Sentinel that survived. */
sleeper("P_27", function* (c) {
  const ss = choosableUnits(c, is(c, "Sentinel"));
  yield* hitEach(c, ss, 1, "P_27");
  const alive = ss.filter((u) => units(c.state).includes(u)).length;
  yield* damageFlagship(c, alive, "P_27");
});

