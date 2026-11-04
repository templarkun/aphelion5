/**
 * Gyro effects G_10-G_38 (the Energy Gyros G_01-G_09 are in units.ts).
 * Drain: a Command phase action, or an Alert from an effect that Drains it;
 * the Gyro is discarded afterwards. A Drain effect never affects that Gyro
 * itself (unit file, Gyro drain_self_rule). Destroyed: resolved from the
 * Wreck's Alert; "this unit" is the Wreck and its sector (E7).
 */

import { type Effect, type RunCtx, ask, log } from "../engine/effect.js";
import { canBeChosen, choosableUnits, describe, fieldMap, level, sectorOf, sectorState, tile, topTileId, unitType } from "../engine/field.js";
import { moduleDef, runModule } from "../engine/modules.js";
import { reveal, requestOverload } from "../engine/moves.js";
import type { TileId } from "../engine/state.js";
import { afterTopTileLeaves, damageFlagship, gainEnergy, loseEnergy, placeFuse, removeFromField, repairFlagship } from "../engine/tokens.js";
import { ENERGY_COLOURS } from "../data/units.js";
import { fromKey, key } from "../geometry/hex.js";
import {
  adjacentTo,
  boostEach,
  chooseRow,
  couldRunFree,
  countType,
  hitEach,
  horizontalRows,
  modulesWithEnergy,
  ofType,
  placeEnergySplit,
  placeOneEnergy,
  printedCost,
  readyIds,
  removeOneEnergy,
  revealSectors,
  revealUnits,
  rowsThrough,
  targetedUnits,
  unitsIn,
} from "./kit.js";
import { registerUnit } from "./registry.js";

type Fx = (c: RunCtx, self: TileId) => Effect;
const gyro = (id: string, drain: Fx, destroyed: Fx) => registerUnit(id, { drain, destroyed });
const here = (c: RunCtx, self: TileId) => sectorOf(c.state, self)!;
const is = (c: RunCtx, ...types: string[]) => (u: TileId) => types.includes(unitType(c, u));
const damaged = (c: RunCtx) => (u: TileId) => tile(c.state, u).tokens.damage > 0;
const notSelf = (self: TileId) => (u: TileId) => u !== self;

/** Choose a row through this unit, then the units in it. */
function* rowThrough(c: RunCtx, self: TileId, rule: string): Effect<TileId[]> {
  const row = yield* chooseRow(c, `${rule}: choose a row through this unit.`, rule, rowsThrough(c, self));
  return unitsIn(c, row!.sectors);
}

/** Choose one horizontal row (optionally with a condition), then the units in it. */
function* horizontalRow(c: RunCtx, rule: string, cond: (us: TileId[]) => boolean = () => true): Effect<TileId[] | undefined> {
  const rows = horizontalRows(c).filter((r) => cond(unitsIn(c, r.sectors)));
  const row = yield* chooseRow(c, `${rule}: choose a horizontal row.`, rule, rows);
  return row ? unitsIn(c, row.sectors) : undefined;
}

// G_10 - Drain: Boost all other non-Bot units on the Field. Destroyed: Deal 1 damage to all non-Bot units.
gyro(
  "G_10",
  (c, self) => boostEach(c, choosableUnits(c, (u) => u !== self && unitType(c, u) !== "Bot"), "G_10"),
  function* (c) {
    yield* hitEach(c, choosableUnits(c, (u) => unitType(c, u) !== "Bot"), 1, "G_10");
  },
);

/** G_11 - [1] Discard this Gyro (Wreck) now. [2] If its sector is now Dark, Reveal it. [3] <then> the unit now on top of that sector. */
function discardRevealThen(c: RunCtx, self: TileId, then: (u: TileId) => Effect): Effect {
  return (function* () {
    log(c, `G_11: ${describe(c, self)} is discarded now`, "G_11");
    const k = removeFromField(c, self, "discard");
    afterTopTileLeaves(c, k);
    if (sectorState(c.state, k) === "dark") yield* reveal(c, k, "G_11");
    const top = topTileId(c.state, k);
    if (top !== undefined && sectorState(c.state, k) === "occupied") yield* then(top);
    else log(c, `G_11: no unit on top of (${k})`, "G_11");
  })();
}
gyro(
  "G_11",
  (c, self) =>
    discardRevealThen(c, self, function* (u) {
      yield* boostEach(c, [u], "G_11");
      yield* boostEach(c, [u], "G_11");
    }),
  (c, self) =>
    discardRevealThen(c, self, function* (u) {
      yield* hitEach(c, [u], 2, "G_11");
    }),
);

// G_12 - Drain: 1 damage to your Flagship per Mecha. Destroyed: remove 1 damage from your Flagship per Sentinel.
gyro(
  "G_12",
  (c) => damageFlagship(c, countType(c, "Mecha"), "G_12"),
  (c) => repairFlagship(c, countType(c, "Sentinel"), "G_12"),
);

// G_13 - Drain: [1] Reveal up to four units. [2] 1 damage to each Sentinel just revealed. Destroyed: same, Sentinels and Bots.
const revealAndHit = (rule: string, types: string[]) =>
  function* (c: RunCtx) {
    const r = yield* revealUnits(c, 4, rule, true);
    yield* hitEach(c, r.filter(is(c, ...types)), 1, rule);
  };
gyro("G_13", revealAndHit("G_13", ["Sentinel"]), revealAndHit("G_13", ["Sentinel", "Bot"]));

// G_14 - Drain: Deal 2 damage to your Flagship. Destroyed: Start an Overload.
gyro(
  "G_14",
  (c) => damageFlagship(c, 2, "G_14"),
  function* (c) {
    requestOverload(c, "G_14");
  },
);

// G_15 - Drain: Remove 1 energy from every Module. Destroyed: Place 1 energy on every ready Module that has none.
gyro(
  "G_15",
  function* (c) {
    for (const m of modulesWithEnergy(c)) yield* removeOneEnergy(c, m, "G_15");
  },
  function* (c) {
    const empty = readyIds(c).filter((m) => ENERGY_COLOURS.every((k) => c.state.player.modules.find((x) => x.id === m)!.energy[k] === 0));
    for (const m of empty) yield* placeOneEnergy(c, m, "G_15");
  },
);

/** "... each of three different Modules ..." (as many as possible): choose which, then act on each. */
function* threeModules(c: RunCtx, rule: string, options: number[], act: (m: number) => Effect<unknown>): Effect {
  const k = Math.min(3, options.length);
  if (k === 0) {
    log(c, `${rule}: no Module to choose`, rule);
    return;
  }
  let pick = options;
  if (options.length > 3) {
    // Asked one at a time, so each answer is a short list.
    pick = [];
    for (let i = 0; i < 3; i++) {
      const left = options.filter((m) => !pick.includes(m));
      const a = yield* ask(c, { kind: "option", pick: "modules", prompt: `${rule}: choose Module ${i + 1} of 3.`, rule, options: left.map((m) => ({ id: String(m), label: moduleDef(c, m).name })) });
      pick.push(Number(a.value));
    }
  }
  for (const m of pick) yield* act(m);
}
const drain3 = (rule: string) => (c: RunCtx) => threeModules(c, rule, modulesWithEnergy(c), (m) => removeOneEnergy(c, m, rule));
const place3 = (rule: string) => (c: RunCtx) => threeModules(c, rule, readyIds(c), (m) => placeOneEnergy(c, m, rule));

// G_16, G_19 - Drain: remove 1 energy from each of three different Modules that have energy. Destroyed: place 1 energy on each of three different ready Modules.
gyro("G_16", drain3("G_16"), place3("G_16"));
gyro("G_19", drain3("G_19"), place3("G_19"));

/** Command tokens: never more than 6 held, limited by the Supply (5.6, 6.7). */
function changeCommandTokens(c: RunCtx, n: number, rule: string): void {
  const p = c.state.player;
  const s = c.state.supply;
  const d = n > 0 ? Math.min(n, s.command, 6 - p.commandTokens) : -Math.min(-n, p.commandTokens);
  p.commandTokens += d;
  s.command -= d;
  log(c, d >= 0 ? `gain ${d} Command token${d === 1 ? "" : "s"}` : `lose ${-d} Command token${d === -1 ? "" : "s"}`, rule);
}

// G_17 - Drain: Lose 3 energy. Destroyed: Gain 1 Command token.
gyro(
  "G_17",
  (c) => loseEnergy(c, 3, undefined, "G_17"),
  function* (c) {
    changeCommandTokens(c, 1, "G_17");
  },
);

// G_18 - Drain: Gain 1 energy. Destroyed: Remove 1 damage from your Flagship.
gyro(
  "G_18",
  (c) => gainEnergy(c, 1, undefined, "G_18"),
  (c) => repairFlagship(c, 1, "G_18"),
);

// G_20 - Drain: Lose 1 Command token. Destroyed: Gain 1 Command token.
gyro(
  "G_20",
  function* (c) {
    changeCommandTokens(c, -1, "G_20");
  },
  function* (c) {
    changeCommandTokens(c, 1, "G_20");
  },
);

// G_21 - Drain: 1 damage to every Targeted unit. Destroyed: 1 damage to all adjacent units.
gyro(
  "G_21",
  function* (c, self) {
    yield* hitEach(c, targetedUnits(c, self), 1, "G_21");
  },
  function* (c, self) {
    yield* hitEach(c, adjacentTo(c, here(c, self)), 1, "G_21");
  },
);

// G_22 - Drain: 1 damage to all other Level 1 units in a row through this unit. Destroyed: 2 damage to all Level 2 units in a row through this unit.
gyro(
  "G_22",
  function* (c, self) {
    yield* hitEach(c, (yield* rowThrough(c, self, "G_22")).filter((u) => u !== self && level(c, u) === 1), 1, "G_22");
  },
  function* (c, self) {
    yield* hitEach(c, (yield* rowThrough(c, self, "G_22")).filter((u) => level(c, u) === 2), 2, "G_22");
  },
);

// G_23 - Drain: 1 damage to every Targeted unit. Destroyed: 2 damage to every Targeted unit.
gyro(
  "G_23",
  function* (c, self) {
    yield* hitEach(c, targetedUnits(c, self), 1, "G_23");
  },
  function* (c, self) {
    yield* hitEach(c, targetedUnits(c, self), 2, "G_23");
  },
);

// G_24 - Drain: 1 damage to all Bots in a row through this unit. Destroyed: 1 damage to all Bots in one horizontal row of your choice.
gyro(
  "G_24",
  function* (c, self) {
    yield* hitEach(c, (yield* rowThrough(c, self, "G_24")).filter(is(c, "Bot")), 1, "G_24");
  },
  function* (c) {
    yield* hitEach(c, ((yield* horizontalRow(c, "G_24")) ?? []).filter(is(c, "Bot")), 1, "G_24");
  },
);

// G_25 - Drain: 1 damage to all other damaged units in a row through this unit. Destroyed: 2 damage to all damaged units in a row through this unit.
gyro(
  "G_25",
  function* (c, self) {
    yield* hitEach(c, (yield* rowThrough(c, self, "G_25")).filter((u) => u !== self && damaged(c)(u)), 1, "G_25");
  },
  function* (c, self) {
    yield* hitEach(c, (yield* rowThrough(c, self, "G_25")).filter(damaged(c)), 2, "G_25");
  },
);

// G_26 - Drain: Boost all other units in a row through this unit. Destroyed: 1 damage to all units in a row through this unit.
gyro(
  "G_26",
  function* (c, self) {
    yield* boostEach(c, (yield* rowThrough(c, self, "G_26")).filter(notSelf(self)), "G_26");
  },
  function* (c, self) {
    yield* hitEach(c, yield* rowThrough(c, self, "G_26"), 1, "G_26");
  },
);

// G_27 - Drain: Boost all other units in a row through this unit and place a Tick on each of them. Destroyed: a Tick on every unit in a row through this unit.
gyro(
  "G_27",
  function* (c, self) {
    const us = (yield* rowThrough(c, self, "G_27")).filter((u) => u !== self && canBeChosen(c, u));
    yield* boostEach(c, us, "G_27");
    for (const u of us) placeFuse(c, u, "tick", "G_27");
  },
  function* (c, self) {
    for (const u of yield* rowThrough(c, self, "G_27")) placeFuse(c, u, "tick", "G_27");
  },
);

// G_28 - Drain: a Tick on every Mecha. Destroyed: a Tick on every Sentinel.
gyro(
  "G_28",
  function* (c) {
    for (const u of choosableUnits(c, is(c, "Mecha"))) placeFuse(c, u, "tick", "G_28");
  },
  function* (c) {
    for (const u of choosableUnits(c, is(c, "Sentinel"))) placeFuse(c, u, "tick", "G_28");
  },
);

// G_29 - [1] Reveal all adjacent Dark sectors. [2] 1 damage to each Mecha (Drain) / Bot (Destroyed) just revealed.
const revealAdjacentAndHit = (type: string) =>
  function* (c: RunCtx, self: TileId) {
    const dark = fieldMap(c.state)
      .adjacent(fromKey(here(c, self)))
      .map(key)
      .filter((k) => sectorState(c.state, k) === "dark");
    const r = yield* revealSectors(c, dark, "G_29");
    yield* hitEach(c, r.filter(is(c, type)), 1, "G_29");
  };
gyro("G_29", revealAdjacentAndHit("Mecha"), revealAdjacentAndHit("Bot"));

// G_30 - Drain: [1] Reveal three units. [2] 2 damage to each unit just revealed. Destroyed: 2 damage to any number of them, your choice.
gyro(
  "G_30",
  function* (c) {
    yield* hitEach(c, yield* revealUnits(c, 3, "G_30"), 2, "G_30");
  },
  function* (c) {
    const r = (yield* revealUnits(c, 3, "G_30")).filter((u) => canBeChosen(c, u));
    if (r.length === 0) return;
    const a = yield* ask(c, { kind: "units", prompt: "G_30: deal 2 damage to which of the units just revealed?", rule: "G_30", options: r, min: 0, max: r.length });
    yield* hitEach(c, a.value as TileId[], 2, "G_30");
  },
);

// G_31 - Drain: 1 damage to all other units in one horizontal row of your choice that has at least one Mecha. Destroyed: 1 damage to all units in one horizontal row of your choice.
gyro(
  "G_31",
  function* (c, self) {
    const us = yield* horizontalRow(c, "G_31", (xs) => xs.some(is(c, "Mecha")));
    if (us) yield* hitEach(c, us.filter(notSelf(self)), 1, "G_31");
  },
  function* (c) {
    yield* hitEach(c, (yield* horizontalRow(c, "G_31")) ?? [], 1, "G_31");
  },
);

// G_32 - Drain: Remove the Barrier from every Sentinel. Destroyed: 1 damage to all Sentinels.
gyro(
  "G_32",
  function* (c) {
    for (const u of choosableUnits(c, (x) => unitType(c, x) === "Sentinel" && tile(c.state, x).tokens.barrier)) {
      tile(c.state, u).tokens.barrier = false;
      c.state.supply.barrier += 1;
      log(c, `G_32: ${describe(c, u)} loses its Barrier`, "G_32");
    }
  },
  function* (c) {
    yield* hitEach(c, ofType(c, "Sentinel"), 1, "G_32");
  },
);

// G_33 - Drain: 1 damage to all other damaged units in the horizontal row through this unit. Destroyed: 1 damage to all undamaged units in one horizontal row of your choice.
gyro(
  "G_33",
  function* (c, self) {
    const row = fieldMap(c.state).row(fromKey(here(c, self)), "horizontal");
    yield* hitEach(c, unitsIn(c, row.sectors).filter((u) => u !== self && damaged(c)(u)), 1, "G_33");
  },
  function* (c) {
    yield* hitEach(c, ((yield* horizontalRow(c, "G_33")) ?? []).filter((u) => !damaged(c)(u)), 1, "G_33");
  },
);

// G_34 - Drain: Lose 1 energy for each Bot. Destroyed: Place 1 energy on your ready Modules for each Bot, split as you choose.
gyro(
  "G_34",
  (c) => loseEnergy(c, countType(c, "Bot"), undefined, "G_34"),
  (c) => placeEnergySplit(c, countType(c, "Bot"), "G_34"),
);

// G_35 - Drain: Exhaust one ready Module and remove all energy from it. Destroyed: Make one exhausted Module ready.
gyro(
  "G_35",
  function* (c) {
    const ready = readyIds(c);
    if (ready.length === 0) return log(c, "G_35: no ready Module", "G_35");
    const id = ready.length === 1 ? ready[0]! : Number((yield* ask(c, { kind: "option", pick: "modules", prompt: "G_35: exhaust which ready Module?", rule: "G_35", options: ready.map((m) => ({ id: String(m), label: moduleDef(c, m).name })) })).value);
    const m = c.state.player.modules.find((x) => x.id === id)!;
    m.ready = false;
    for (const k of ENERGY_COLOURS) {
      c.state.supply.energy[k] += m.energy[k];
      m.energy[k] = 0;
    }
    log(c, `G_35: ${moduleDef(c, id).name} is exhausted and loses its energy`, "G_35");
  },
  function* (c) {
    const ex = c.state.player.modules.filter((m) => !m.ready).map((m) => m.id);
    if (ex.length === 0) return log(c, "G_35: no exhausted Module", "G_35");
    const id = ex.length === 1 ? ex[0]! : Number((yield* ask(c, { kind: "option", pick: "modules", prompt: "G_35: make which Module ready?", rule: "G_35", options: ex.map((m) => ({ id: String(m), label: moduleDef(c, m).name })) })).value);
    c.state.player.modules.find((x) => x.id === id)!.ready = true;
    log(c, `G_35: ${moduleDef(c, id).name} is ready`, "G_35");
  },
);

// G_36 - Drain: Reveal every Dark sector on the Field, one at a time. Destroyed: [1] Reveal any number of units. [2] Gain 1 energy for each Bot just revealed.
gyro(
  "G_36",
  function* (c) {
    yield* revealSectors(c, Object.keys(c.state.field), "G_36");
  },
  function* (c) {
    const r = yield* revealUnits(c, Number.MAX_SAFE_INTEGER, "G_36", true);
    yield* gainEnergy(c, r.filter(is(c, "Bot")).length, undefined, "G_36");
  },
);

// G_37 - Drain: 1 damage to all Level 3 units in one horizontal row of your choice. Destroyed: a Tick on every Level 3 unit in one horizontal row of your choice.
gyro(
  "G_37",
  function* (c, self) {
    yield* hitEach(c, ((yield* horizontalRow(c, "G_37")) ?? []).filter((u) => u !== self && level(c, u) === 3), 1, "G_37");
  },
  function* (c) {
    for (const u of ((yield* horizontalRow(c, "G_37")) ?? []).filter((x) => level(c, x) === 3)) placeFuse(c, u, "tick", "G_37");
  },
);

/** G_38 - Run one ready Module (Drain: that costs 3 or less) that you could run right now, without paying its cost. */
const runFree = (max: number) =>
  function* (c: RunCtx) {
    const ids = readyIds(c).filter((m) => couldRunFree(c, m) && printedCost(c, m) <= max);
    if (ids.length === 0) return log(c, "G_38: no Module you could run now", "G_38");
    const id = ids.length === 1 ? ids[0]! : Number((yield* ask(c, { kind: "option", pick: "modules", prompt: "G_38: run which Module without paying its cost?", rule: "G_38", options: ids.map((m) => ({ id: String(m), label: moduleDef(c, m).name })) })).value);
    yield* runModule(c, id, true);
  };
gyro("G_38", runFree(3), runFree(Number.MAX_SAFE_INTEGER));


