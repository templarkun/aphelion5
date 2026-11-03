/**
 * Module effects (Modules.txt; Core Rules 5.3, 8.6). Text conventions 1-9 of
 * the Module file apply: targets are different units (1); "adjacent to it"
 * after damage is measured from that unit's sector (2); counts are taken when
 * the effect starts (3); bonus damage is part of the same hit (4); cost
 * reductions never count the Module being run (5).
 *
 * Yellow: 1-25, 77. Red: 26-50, 78. Blue: 51-76 (blueModules.ts).
 */

import type { UnitType } from "../data/units.js";
import { ENERGY_COLOURS, type EnergyColour } from "../data/units.js";
import { type Effect, type RunCtx, ask, log } from "../engine/effect.js";
import { type Ctx, canBeChosen, choosableUnits, darkSectors, describe, fieldMap, level, sectorKeys, sectorOf, sectorState, tile, unitType } from "../engine/field.js";
import { moduleDef } from "../engine/modules.js";
import { reveal } from "../engine/moves.js";
import type { SectorKey, TileId } from "../engine/state.js";
import { type HitResult, cancelAlert, dealHit, destroy, gainEnergy, placeBioShield, placeFuse } from "../engine/tokens.js";
import { fromKey } from "../geometry/hex.js";
import { chooseUnit } from "./helpers.js";
import { adjacentTo, best, boostEach, chooseOneOf, chooseRow, chooseUnits, countType, hitEach, horizontalRows, ofType, unitsIn } from "./kit.js";
import { type ModuleEffects, type ModuleRun, registerModule } from "./registry.js";

export const mod = (id: number, fx: ModuleEffects) => registerModule(id, fx);
const M = (id: number) => `Module ${id}`;
const is = (c: Ctx, ...types: string[]) => (u: TileId) => types.includes(unitType(c, u));
const destroyedIn = (r: HitResult) => r.kind === "damaged" && r.destroyed !== undefined;

/** Your other exhausted Modules (convention 5: never the one being run). */
export const otherExhausted = (c: Ctx, id: number) => c.state.player.modules.filter((m) => m.id !== id && !m.ready).length;
export const cleared = (c: Ctx) => sectorKeys(c.state).filter((k) => sectorState(c.state, k) === "cleared").length;
export const dark = (c: Ctx) => darkSectors(c.state).length;
const printed = (c: Ctx, id: number) => moduleDef(c, id).cost as number;

/** Units adjacent to the sector a unit is (or was) in. */
const adjSector = (c: Ctx, k: SectorKey) => adjacentTo(c, k).filter((u) => canBeChosen(c, u));

/** Every pair of choosable units in adjacent sectors. */
export function adjacentPairs(c: Ctx, f: (u: TileId) => boolean = () => true): [TileId, TileId][] {
  const us = choosableUnits(c, f);
  const out: [TileId, TileId][] = [];
  for (let i = 0; i < us.length; i++)
    for (let j = i + 1; j < us.length; j++) if (fieldMap(c.state).areAdjacent(fromKey(sectorOf(c.state, us[i]!)!), fromKey(sectorOf(c.state, us[j]!)!))) out.push([us[i]!, us[j]!]);
  return out;
}

function* choosePair(c: RunCtx, prompt: string, rule: string, pairs: TileId[][]): Effect<TileId[] | undefined> {
  if (pairs.length === 0) {
    log(c, `${prompt} - none, skipped`, rule);
    return undefined;
  }
  if (pairs.length === 1) return pairs[0];
  const a = yield* ask(c, { kind: "option", prompt, rule, options: pairs.map((p, i) => ({ id: String(i), label: p.map((u) => describe(c, u)).join(" + ") })) });
  return pairs[Number(a.value)];
}

/** An optional extra payment of exactly `n` more energy (8.6 step 3): yes or no, when you can pay it. */
export function* payExactly(c: RunCtx, run: ModuleRun, n: number, what: string): Effect<boolean> {
  const d = moduleDef(c, run.id);
  const m = c.state.player.modules.find((x) => x.id === run.id)!;
  const col = d.colour;
  if (m.energy[col] + c.state.player.reserve[col] < n) {
    log(c, `${d.name}: not enough ${col} energy for the extra payment`, "8.6");
    return false;
  }
  const a = yield* ask(c, { kind: "yesno", prompt: `${d.name}: pay ${n} more ${col} energy to ${what}?`, rule: "8.6" });
  if (a.value !== true) return false;
  yield* spend(c, run.id, col, n);
  return true;
}

/** Spend `n` energy of a colour for this Module: what is on it and your Reserve, as you choose. */
function* spend(c: RunCtx, id: number, col: EnergyColour, n: number): Effect {
  const m = c.state.player.modules.find((x) => x.id === id)!;
  const reserve = c.state.player.reserve[col];
  const lo = Math.max(0, n - reserve);
  const hi = Math.min(n, m.energy[col]);
  const fromModule = hi > lo ? ((yield* ask(c, { kind: "amount", prompt: `How much of it from the ${m.energy[col]} ${col} on this Module?`, rule: "8.6", min: lo, max: hi })).value as number) : lo;
  m.energy[col] -= fromModule;
  c.state.player.reserve[col] -= n - fromModule;
  c.state.supply.energy[col] += n;
  log(c, `extra payment: ${n} ${col} (${fromModule} from the Module, ${n - fromModule} from the Reserve)`, "8.6");
}

/** An extra payment of 1 to `max` more energy (Charged Beam). Returns the amount paid (0 = skipped). */
function* payUpTo(c: RunCtx, run: ModuleRun, max: number, what: string): Effect<number> {
  const d = moduleDef(c, run.id);
  const m = c.state.player.modules.find((x) => x.id === run.id)!;
  const most = Math.min(max, m.energy[d.colour] + c.state.player.reserve[d.colour]);
  if (most === 0) {
    log(c, `no ${d.colour} energy left for the extra payment`, "8.6");
    return 0;
  }
  const n = (yield* ask(c, { kind: "amount", prompt: `Pay how much more ${d.colour} energy (0 to ${most}) ${what}?`, rule: "8.6", min: 0, max: most })).value as number;
  if (n > 0) yield* spend(c, run.id, d.colour, n);
  return n;
}

/** Return all energy on some Modules to the Supply. */
export function returnEnergy(c: Ctx, ids: number[], rule: string): void {
  for (const id of ids) {
    const m = c.state.player.modules.find((x) => x.id === id)!;
    const n = ENERGY_COLOURS.reduce((a, k) => a + m.energy[k], 0);
    for (const k of ENERGY_COLOURS) {
      c.state.supply.energy[k] += m.energy[k];
      m.energy[k] = 0;
    }
    if (n) log(c, `${n} energy on ${moduleDef(c, id).name} returns to the Supply`, rule);
  }
}

/** Choose a unit type among those present (optionally filtered). */
function* chooseType(c: RunCtx, prompt: string, rule: string, types: UnitType[]): Effect<UnitType | undefined> {
  if (types.length === 0) return undefined;
  if (types.length === 1) return types[0];
  return (yield* ask(c, { kind: "option", prompt, rule, options: types.map((t) => ({ id: t, label: t })) })).value as UnitType;
}

const ALL_TYPES: UnitType[] = ["Bot", "Mecha", "Gyro", "Sleeper", "Sentinel", "Flare", "Omega"];
/** Types on the Field (Flares ignored where the text says so). */
export const presentTypes = (c: Ctx, withFlares = false) => ALL_TYPES.filter((t) => (withFlares || t !== "Flare") && countType(c, t) > 0);

/** The type with the fewest units on the Field (ignore Flares and types with no units); ties: you choose. */
export function* fewestType(c: RunCtx, rule: string): Effect<UnitType | undefined> {
  const types = presentTypes(c);
  if (types.length === 0) return undefined;
  const low = Math.min(...types.map((t) => countType(c, t)));
  return yield* chooseType(c, `${rule}: types tied with the fewest units. Choose one.`, rule, types.filter((t) => countType(c, t) === low));
}

// ===========================================================================
// YELLOW (light background: Command phase)
// ===========================================================================

/** 1 Demolition Blast - [1] Deal 2 damage to one unit. [2] Destroy one Bot. */
mod(1, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Demolition Blast: deal 2 damage to which unit?", M(1));
    if (u !== undefined) yield* dealHit(c, u, 2, M(1));
    const b = yield* chooseUnit(c, "Demolition Blast: destroy which Bot?", M(1), is(c, "Bot"));
    if (b !== undefined) destroy(c, b, M(1));
  },
});

/** 2 Ion Sweep - 1 damage to one unit, 1 to one Gyro and 1 to one Sleeper (different units, convention 1). */
mod(2, {
  run: function* (c) {
    const used: TileId[] = [];
    for (const [what, f] of [
      ["unit", () => true],
      ["Gyro", is(c, "Gyro")],
      ["Sleeper", is(c, "Sleeper")],
    ] as const) {
      const u = yield* chooseOneOf(c, `Ion Sweep: 1 damage to which ${what}?`, M(2), choosableUnits(c, (x) => f(x) && !used.includes(x)));
      if (u === undefined) continue;
      used.push(u);
      yield* dealHit(c, u, 1, M(2));
    }
  },
});

/** 3 Capacitor Lance - 3 damage to one unit. Cost 9, 1 less per other exhausted Module. */
mod(3, {
  cost: (c, _x) => printed(c, 3) - otherExhausted(c, 3),
  run: function* (c) {
    const u = yield* chooseUnit(c, "Capacitor Lance: 3 damage to which unit?", M(3));
    if (u !== undefined) yield* dealHit(c, u, 3, M(3));
  },
});

/** 4 Tick Missile - [1] 1 damage to one unit. [2] If it survives, place a Tick on it. */
mod(4, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Tick Missile: 1 damage to which unit?", M(4));
    if (u === undefined) return;
    yield* dealHit(c, u, 1, M(4));
    if (canBeChosen(c, u)) placeFuse(c, u, "tick", M(4));
  },
});

/** 5 Heavy Plasma Cannon - [1] 4 damage to one unit. [2] Return all energy on all your Modules to the Supply. */
mod(5, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Heavy Plasma Cannon: 4 damage to which unit?", M(5));
    if (u !== undefined) yield* dealHit(c, u, 4, M(5));
    returnEnergy(c, c.state.player.modules.map((m) => m.id), M(5));
  },
});

/** 6 Accumulator Beam - X damage to one unit, X = the Yellow on this Module before you ran it (maximum 5). X = 0 does nothing (Q1). */
mod(6, {
  run: function* (c, run) {
    const x = Math.min(5, run.storedBefore.Yellow ?? 0);
    const u = yield* chooseUnit(c, `Accumulator Beam: ${x} damage to which unit?`, M(6));
    if (u !== undefined) yield* dealHit(c, u, x, M(6));
  },
});

/** 7 Cluster Mine - [1] 1 damage to one unit. [2] A Tick on every Gyro and every Sleeper adjacent to it. */
mod(7, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Cluster Mine: 1 damage to which unit?", M(7));
    if (u === undefined) return;
    const k = sectorOf(c.state, u)!;
    yield* dealHit(c, u, 1, M(7));
    for (const x of adjSector(c, k).filter(is(c, "Gyro", "Sleeper"))) placeFuse(c, x, "tick", M(7));
  },
});

/** 8 Proton Torpedoes - [1] 2 damage to each of two units. [2] Gain 1 energy for each of them that was not destroyed. */
mod(8, {
  run: function* (c) {
    const us = yield* chooseUnits(c, "Proton Torpedoes: 2 damage to which two units?", M(8), choosableUnits(c), 2);
    const r = yield* hitEach(c, us, 2, M(8));
    yield* gainEnergy(c, r.filter((x) => !destroyedIn(x)).length, undefined, M(8));
  },
});

/** 9 Ricochet Missiles - [1] 2 damage to one unit. [2] If this destroys it, 1 damage to another unit. */
mod(9, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Ricochet Missiles: 2 damage to which unit?", M(9));
    if (u === undefined) return;
    if (!destroyedIn(yield* dealHit(c, u, 2, M(9)))) return;
    const v = yield* chooseUnit(c, "Ricochet Missiles: 1 damage to which other unit?", M(9), (x) => x !== u);
    if (v !== undefined) yield* dealHit(c, v, 1, M(9));
  },
});

/** 10 Twin Laser Turret - two units adjacent to each other, 1 damage each. Extra: pay 3 more Yellow, 2 each instead. */
mod(10, {
  run: function* (c, run) {
    const p = yield* choosePair(c, "Twin Laser Turret: choose two units adjacent to each other.", M(10), adjacentPairs(c));
    if (!p) return;
    const n = (yield* payExactly(c, run, 3, "deal 2 damage to each instead")) ? 2 : 1;
    yield* hitEach(c, p, n, M(10));
  },
});

/** 11 Capacitor Demolisher - Destroy two Bots adjacent to each other. Cost 9, 1 less per other exhausted Module. */
mod(11, {
  cost: (c) => printed(c, 11) - otherExhausted(c, 11),
  run: function* (c) {
    const p = yield* choosePair(c, "Capacitor Demolisher: destroy which two adjacent Bots?", M(11), adjacentPairs(c, is(c, "Bot")));
    if (p) for (const u of p) destroy(c, u, M(11));
  },
});

/** 12 Tri-Lock Missiles - [1] Choose a unit type. [2] 1 damage to each of three units of that type. */
mod(12, {
  run: function* (c) {
    const t = yield* chooseType(c, "Tri-Lock Missiles: choose a unit type.", M(12), presentTypes(c).filter((x) => choosableUnits(c, is(c, x)).length > 0));
    if (!t) return;
    yield* hitEach(c, yield* chooseUnits(c, `Tri-Lock Missiles: which three ${t} units?`, M(12), choosableUnits(c, is(c, t)), 3), 1, M(12));
  },
});

/** 13 Shrapnel Detonation - [1] Choose a Mecha. [2] 1 damage to it and to each of up to three other units adjacent to it. */
mod(13, {
  run: function* (c) {
    const m = yield* chooseUnit(c, "Shrapnel Detonation: choose a Mecha.", M(13), is(c, "Mecha"));
    if (m === undefined) return;
    const options = adjSector(c, sectorOf(c.state, m)!);
    const others = options.length === 0 ? [] : ((yield* ask(c, { kind: "units", prompt: "Shrapnel Detonation: up to three other adjacent units.", rule: M(13), options, min: 0, max: Math.min(3, options.length) })).value as TileId[]);
    yield* hitEach(c, [m, ...others], 1, M(13));
  },
});

/** 14 Splitter Missiles - Divide 3 damage among any number of units; each takes its share as one hit. */
mod(14, {
  run: function* (c) {
    const us = choosableUnits(c);
    if (us.length === 0) return log(c, "Splitter Missiles: no unit", M(14));
    const a = yield* ask(c, { kind: "split", prompt: "Splitter Missiles: divide 3 damage among units.", rule: M(14), total: 3, buckets: us.map((u) => ({ id: u, label: describe(c, u), max: 3 })) });
    for (const [u, n] of Object.entries(a.value as Record<string, number>)) if (n > 0) yield* dealHit(c, u, n, M(14));
  },
});

/** 15 Arc Cannon - Choose one: 1 damage to one unit, or 1 damage to each of two different Gyros. */
mod(15, {
  run: function* (c) {
    const a = yield* ask(c, { kind: "option", prompt: "Arc Cannon: choose one.", rule: M(15), options: [{ id: "one", label: "1 damage to one unit" }, { id: "gyros", label: "1 damage to each of two different Gyros" }] });
    if (a.value === "one") {
      const u = yield* chooseUnit(c, "Arc Cannon: which unit?", M(15));
      if (u !== undefined) yield* dealHit(c, u, 1, M(15));
    } else yield* hitEach(c, yield* chooseUnits(c, "Arc Cannon: which two Gyros?", M(15), choosableUnits(c, is(c, "Gyro")), 2), 1, M(15));
  },
});

/** 16 Autoturret Sweep - 1 damage to one unit of each type: Bot, Mecha, Gyro, Sleeper, Sentinel, Omega. */
mod(16, {
  run: function* (c) {
    for (const t of ["Bot", "Mecha", "Gyro", "Sleeper", "Sentinel", "Omega"]) {
      const u = yield* chooseOneOf(c, `Autoturret Sweep: which ${t}?`, M(16), choosableUnits(c, is(c, t)));
      if (u !== undefined) yield* dealHit(c, u, 1, M(16));
    }
  },
});

/** Every three choosable units that are all adjacent to each other. */
function triangles(c: Ctx): TileId[][] {
  const pairs = adjacentPairs(c);
  const adj = (a: TileId, b: TileId) => pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const us = choosableUnits(c);
  const out: TileId[][] = [];
  for (let i = 0; i < us.length; i++)
    for (let j = i + 1; j < us.length; j++)
      for (let k = j + 1; k < us.length; k++) if (adj(us[i]!, us[j]!) && adj(us[j]!, us[k]!) && adj(us[i]!, us[k]!)) out.push([us[i]!, us[j]!, us[k]!]);
  return out;
}

/** 17 Salvo Launcher - three units all adjacent to each other, 1 damage each. Cost 5, 1 less per Cleared sector. */
mod(17, {
  cost: (c) => printed(c, 17) - cleared(c),
  run: function* (c) {
    const t = yield* choosePair(c, "Salvo Launcher: choose three units all adjacent to each other.", M(17), triangles(c));
    if (t) yield* hitEach(c, t, 1, M(17));
  },
});

/** 18 Proton Cull - [1] The type with the fewest units (ignore Flares and absent types). [2] 1 damage to every unit of it. */
mod(18, {
  run: function* (c) {
    const t = yield* fewestType(c, M(18));
    if (t) yield* hitEach(c, ofType(c, t), 1, M(18));
  },
});

/** 19 Electron Flood - [1] 1 damage to every Bot. [2] Return all energy on your other Modules to the Supply. */
mod(19, {
  run: function* (c, run) {
    yield* hitEach(c, ofType(c, "Bot"), 1, M(19));
    returnEnergy(c, c.state.player.modules.map((m) => m.id).filter((m) => m !== run.id), M(19));
  },
});

/** 20 Graviton Rockets - Choose one: 2 damage to every Gyro, or 1 damage to every Sentinel. */
mod(20, {
  run: function* (c) {
    const a = yield* ask(c, { kind: "option", prompt: "Graviton Rockets: choose one.", rule: M(20), options: [{ id: "gyro", label: "2 damage to every Gyro" }, { id: "sentinel", label: "1 damage to every Sentinel" }] });
    if (a.value === "gyro") yield* hitEach(c, ofType(c, "Gyro"), 2, M(20));
    else yield* hitEach(c, ofType(c, "Sentinel"), 1, M(20));
  },
});

/** 21 Ground Zero - [1] Destroy one Mecha. [2] 1 damage to every unit whose Level is equal to or lower than that Mecha's Level. */
mod(21, {
  run: function* (c) {
    const m = yield* chooseUnit(c, "Ground Zero: destroy which Mecha?", M(21), is(c, "Mecha"));
    if (m === undefined) return;
    const l = level(c, m)!;
    destroy(c, m, M(21));
    yield* hitEach(c, choosableUnits(c, (u) => (level(c, u) ?? Infinity) <= l), 1, M(21));
  },
});

/** 22 Harmonic Collapse - Destroy every Level 1 unit. Cost 7, 1 less per Dark sector. */
mod(22, {
  cost: (c) => printed(c, 22) - dark(c),
  run: function* (c) {
    for (const u of choosableUnits(c, (x) => level(c, x) === 1)) destroy(c, u, M(22));
  },
});

/** 23 Harmonic Pulse - 1 damage to every Level 2 unit. */
mod(23, {
  run: function* (c) {
    yield* hitEach(c, choosableUnits(c, (u) => level(c, u) === 2), 1, M(23));
  },
});

/** 24 Rocket Barrage - [1] Choose a horizontal row. [2] 1 damage to every unit in it. */
mod(24, {
  run: function* (c) {
    const r = yield* chooseRow(c, "Rocket Barrage: choose a horizontal row.", M(24), horizontalRows(c));
    yield* hitEach(c, unitsIn(c, r!.sectors), 1, M(24));
  },
});

/** 25 Thin Line Barrage - [1] The horizontal row with the fewest units (at least one). [2] 1 damage to every unit in it. Cost 4, 1 less per Dark sector. */
mod(25, {
  cost: (c) => printed(c, 25) - dark(c),
  run: function* (c) {
    const rows = horizontalRows(c).filter((r) => unitsIn(c, r.sectors).length > 0);
    const r = yield* chooseRow(c, "Thin Line Barrage: choose the row with the fewest units.", M(25), best(rows, (x) => unitsIn(c, x.sectors).length, true));
    if (r) yield* hitEach(c, unitsIn(c, r.sectors), 1, M(25));
  },
});

/** 77 Seismic Charge - [1] Choose a Cleared sector. [2] 1 damage to every unit adjacent to it. */
mod(77, {
  run: function* (c) {
    const cs = sectorKeys(c.state).filter((k) => sectorState(c.state, k) === "cleared");
    if (cs.length === 0) return log(c, "Seismic Charge: no Cleared sector", M(77));
    const k = cs.length === 1 ? cs[0]! : ((yield* ask(c, { kind: "sectors", prompt: "Seismic Charge: choose a Cleared sector.", rule: M(77), options: cs, min: 1, max: 1 })).value as string[])[0]!;
    yield* hitEach(c, adjSector(c, k), 1, M(77));
  },
});

// ===========================================================================
// RED (red background: Overload)
// ===========================================================================

/** 26 Charged Beam - 2 damage to one unit. Extra: pay 1 to 3 more Red, that much more damage (one hit, convention 4). */
mod(26, {
  run: function* (c, run) {
    const u = yield* chooseUnit(c, "Charged Beam: deal 2 damage to which unit?", M(26));
    if (u === undefined) return;
    const more = yield* payUpTo(c, run, 3, "to deal that much more damage");
    yield* dealHit(c, u, 2 + more, M(26));
  },
});

/** 27 Counter-Battery Beam - X damage to one unit, X = Sentinels on the Field. */
mod(27, {
  run: function* (c) {
    const x = countType(c, "Sentinel");
    const u = yield* chooseUnit(c, `Counter-Battery Beam: ${x} damage to which unit?`, M(27));
    if (u !== undefined) yield* dealHit(c, u, x, M(27));
  },
});

/** 28 Mirror Lattice Beam - [1] Choose one unit. [2] X damage to it, X = Bots adjacent to it. */
mod(28, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Mirror Lattice Beam: choose a unit.", M(28));
    if (u === undefined) return;
    yield* dealHit(c, u, adjacentTo(c, sectorOf(c.state, u)!).filter(is(c, "Bot")).length, M(28));
  },
});

/** 29 Siphon Blast - [1] 2 damage to one unit. [2] A Bio-shield on each of two different non-Mecha units adjacent to it. */
mod(29, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Siphon Blast: 2 damage to which unit?", M(29));
    if (u === undefined) return;
    const k = sectorOf(c.state, u)!;
    yield* dealHit(c, u, 2, M(29));
    for (const x of yield* chooseUnits(c, "Siphon Blast: a Bio-shield on which two adjacent non-Mecha units?", M(29), adjSector(c, k).filter((x) => unitType(c, x) !== "Mecha"), 2)) placeBioShield(c, x);
  },
});

/** 30 Capacitor Strike - 2 damage to one unit. Cost 6, 2 less per other exhausted Module. */
mod(30, {
  cost: (c) => printed(c, 30) - 2 * otherExhausted(c, 30),
  run: function* (c) {
    const u = yield* chooseUnit(c, "Capacitor Strike: 2 damage to which unit?", M(30));
    if (u !== undefined) yield* dealHit(c, u, 2, M(30));
  },
});

/** 31 Backlash Beam - [1] Choose one unit. [2] Boost every unit adjacent to it. [3] X damage to the chosen unit, X = units that gained a Shield or lost a Damage token this way. */
mod(31, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Backlash Beam: choose a unit.", M(31));
    if (u === undefined) return;
    const near = adjSector(c, sectorOf(c.state, u)!);
    const before = new Map(near.map((x) => [x, { ...tile(c.state, x).tokens }]));
    yield* boostEach(c, near, M(31));
    const x = near.filter((v) => tile(c.state, v).tokens.shield > before.get(v)!.shield || tile(c.state, v).tokens.damage < before.get(v)!.damage).length;
    yield* dealHit(c, u, x, M(31));
  },
});

/** 32 Static Discharge - 1 damage to one unit and to every Gyro adjacent to it. */
mod(32, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Static Discharge: 1 damage to which unit?", M(32));
    if (u === undefined) return;
    const k = sectorOf(c.state, u)!;
    const gyros = adjSector(c, k).filter(is(c, "Gyro"));
    yield* hitEach(c, [u, ...gyros], 1, M(32));
  },
});

/** 33 Seeker Missile - [1] 2 damage to one unit. [2] If it survives, a Tick on one unit adjacent to it. */
mod(33, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Seeker Missile: 2 damage to which unit?", M(33));
    if (u === undefined) return;
    yield* dealHit(c, u, 2, M(33));
    if (!canBeChosen(c, u)) return;
    const v = yield* chooseOneOf(c, "Seeker Missile: a Tick on which adjacent unit?", M(33), adjSector(c, sectorOf(c.state, u)!));
    if (v !== undefined) placeFuse(c, v, "tick", M(33));
  },
});

/** 34 Twin Pulse Beams - [1] Two units adjacent to each other. [2] 1 damage each. [3] If both are destroyed, 1 damage to another unit. */
mod(34, {
  run: function* (c) {
    const p = yield* choosePair(c, "Twin Pulse Beams: choose two units adjacent to each other.", M(34), adjacentPairs(c));
    if (!p) return;
    const r = yield* hitEach(c, p, 1, M(34));
    if (r.filter(destroyedIn).length < 2) return;
    const v = yield* chooseUnit(c, "Twin Pulse Beams: 1 damage to which other unit?", M(34), (x) => !p.includes(x));
    if (v !== undefined) yield* dealHit(c, v, 1, M(34));
  },
});

/** 35 Tesla Overcharge - [1] 1 damage to one unit. [2] 1 damage to every adjacent unit of a different type from it. */
mod(35, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Tesla Overcharge: 1 damage to which unit?", M(35));
    if (u === undefined) return;
    const k = sectorOf(c.state, u)!;
    const type = unitType(c, u);
    yield* dealHit(c, u, 1, M(35));
    yield* hitEach(c, adjSector(c, k).filter((x) => unitType(c, x) !== type), 1, M(35));
  },
});

/** 36 Triad Strike - [1] Choose a unit type. [2] If exactly three units of that type are on the Field, 1 damage to each. */
mod(36, {
  run: function* (c) {
    const t = yield* chooseType(c, "Triad Strike: choose a unit type.", M(36), ALL_TYPES.filter((x) => x !== "Flare"));
    if (t && countType(c, t) === 3) yield* hitEach(c, ofType(c, t), 1, M(36));
    else log(c, `Triad Strike: not exactly three ${t}`, M(36));
  },
});

/** 37 Cascade Phaser - [1] 2 damage to one Bot. [2] If this destroys it, 2 damage to one Gyro. [3] If this destroys it, 1 damage to one Sentinel. */
mod(37, {
  run: function* (c) {
    for (const [t, n] of [
      ["Bot", 2],
      ["Gyro", 2],
      ["Sentinel", 1],
    ] as const) {
      const u = yield* chooseUnit(c, `Cascade Phaser: ${n} damage to which ${t}?`, M(37), is(c, t));
      if (u === undefined) return;
      if (!destroyedIn(yield* dealHit(c, u, n, M(37)))) return;
    }
  },
});

/** 38 Arc Discharge - [1] 1 damage to one unit. [2] If it survives, 1 damage to each of two other units adjacent to it. */
mod(38, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Arc Discharge: 1 damage to which unit?", M(38));
    if (u === undefined) return;
    yield* dealHit(c, u, 1, M(38));
    if (!canBeChosen(c, u)) return;
    yield* hitEach(c, yield* chooseUnits(c, "Arc Discharge: which two other adjacent units?", M(38), adjSector(c, sectorOf(c.state, u)!), 2), 1, M(38));
  },
});

/** 39 Bunker Busters - [1] The horizontal row with the most Level 3 units (at least one). [2] 1 damage to every unit in it. */
mod(39, {
  run: function* (c) {
    const l3 = (r: { sectors: { q: number; r: number }[] }) => unitsIn(c, r.sectors).filter((u) => level(c, u) === 3).length;
    const r = yield* chooseRow(c, "Bunker Busters: choose the row with the most Level 3 units.", M(39), best(horizontalRows(c).filter((x) => l3(x) > 0), l3));
    if (r) yield* hitEach(c, unitsIn(c, r.sectors), 1, M(39));
  },
});

/** 40 Polarity Sweep - [1] A horizontal row: 1 damage to every unit in it. [2] A horizontal row (the same or another): Boost every unit in it. */
mod(40, {
  run: function* (c) {
    const a = yield* chooseRow(c, "Polarity Sweep: a horizontal row to damage.", M(40), horizontalRows(c));
    yield* hitEach(c, unitsIn(c, a!.sectors), 1, M(40));
    const b = yield* chooseRow(c, "Polarity Sweep: a horizontal row to Boost (the same or another).", M(40), horizontalRows(c));
    yield* boostEach(c, unitsIn(c, b!.sectors), M(40));
  },
});

/** 41 Beacon Strike - 1 damage to every unit in each horizontal row that contains at least one Mecha. */
mod(41, {
  run: function* (c) {
    const rows = horizontalRows(c).filter((r) => unitsIn(c, r.sectors).some(is(c, "Mecha")));
    yield* hitEach(c, rows.flatMap((r) => unitsIn(c, r.sectors)), 1, M(41));
  },
});

/** 42 Harmonic Strike - 1 damage to every Level 3 unit. */
mod(42, {
  run: function* (c) {
    yield* hitEach(c, choosableUnits(c, (u) => level(c, u) === 3), 1, M(42));
  },
});

/** 43 Harmonic Wave - 1 damage to every Level 2 Bot and Level 2 Mecha. Extra: pay 3 more Red, 2 each instead. */
mod(43, {
  run: function* (c, run) {
    const targets = choosableUnits(c, (u) => level(c, u) === 2 && is(c, "Bot", "Mecha")(u));
    const n = (yield* payExactly(c, run, 3, "deal 2 damage to each instead")) ? 2 : 1;
    yield* hitEach(c, targets, n, M(43));
  },
});

/** 44 Chain Reaction Beam - [1] 1 damage to one unit. [2] Each time this destroys a unit, 1 damage to one unit adjacent to it. [3] Stop when a hit destroys nothing. */
mod(44, {
  run: function* (c) {
    let u = yield* chooseUnit(c, "Chain Reaction Beam: 1 damage to which unit?", M(44));
    while (u !== undefined) {
      const k = sectorOf(c.state, u)!;
      if (!destroyedIn(yield* dealHit(c, u, 1, M(44)))) return;
      u = yield* chooseOneOf(c, `Chain Reaction Beam: it destroyed a unit; 1 damage to which unit adjacent to (${k})?`, M(44), adjSector(c, k));
    }
  },
});

/** 45 Thermal Detonator - 1 damage to every damaged unit. Cost 5, 1 less per Cleared sector. */
mod(45, {
  cost: (c) => printed(c, 45) - cleared(c),
  run: function* (c) {
    yield* hitEach(c, choosableUnits(c, (u) => tile(c.state, u).tokens.damage > 0), 1, M(45));
  },
});

/** 46 Echo Ray - [1] 1 damage to one Bot. [2] Repeat once for each Sentinel (counted at the start); each repeat a separate hit, same Bot or another. */
mod(46, {
  run: function* (c) {
    const n = 1 + countType(c, "Sentinel");
    for (let i = 0; i < n; i++) {
      const b = yield* chooseUnit(c, `Echo Ray: 1 damage to which Bot (${i + 1} of ${n})?`, M(46), is(c, "Bot"));
      if (b === undefined) return;
      yield* dealHit(c, b, 1, M(46));
    }
  },
});

/** 47 Lone Hunter Missiles - For each unit type with exactly one unit on the Field, 1 damage to that unit. */
mod(47, {
  run: function* (c) {
    yield* hitEach(
      c,
      ALL_TYPES.map((t) => ofType(c, t)).filter((us) => us.length === 1).map((us) => us[0]!),
      1,
      M(47),
    );
  },
});

/** 48 Point-Defense Phaser - 1 damage to each of X different Sentinels, X = the Red on this Module before you ran it. */
mod(48, {
  run: function* (c, run) {
    const x = run.storedBefore.Red ?? 0;
    yield* hitEach(c, yield* chooseUnits(c, `Point-Defense Phaser: 1 damage to which ${x} Sentinels?`, M(48), choosableUnits(c, is(c, "Sentinel")), x), 1, M(48));
  },
});

/** 49 Drone Bomber - A Tick on each of two units of the same type. */
mod(49, {
  run: function* (c) {
    const types = presentTypes(c).filter((t) => choosableUnits(c, is(c, t)).length >= 2);
    const any = types.length > 0 ? types : presentTypes(c).filter((t) => choosableUnits(c, is(c, t)).length > 0);
    const t = yield* chooseType(c, "Drone Bomber: choose a unit type.", M(49), any);
    if (!t) return;
    for (const u of yield* chooseUnits(c, `Drone Bomber: a Tick on which two ${t} units?`, M(49), choosableUnits(c, is(c, t)), 2)) placeFuse(c, u, "tick", M(49));
  },
});

/** Reveal units one at a time, as many as you like (asked before each). */
export function* revealAsMany(c: RunCtx, rule: string): Effect<TileId[]> {
  const out: TileId[] = [];
  for (;;) {
    const ds = darkSectors(c.state);
    if (ds.length === 0) break;
    const a = yield* ask(c, { kind: "yesno", prompt: `${rule}: Reveal ${out.length ? "another" : "a"} unit? (${out.length} so far)`, rule });
    if (a.value !== true) break;
    const k = ds.length === 1 ? ds[0]! : ((yield* ask(c, { kind: "sectors", prompt: `${rule}: Reveal which Dark sector?`, rule, options: ds, min: 1, max: 1 })).value as string[])[0]!;
    out.push(yield* reveal(c, k, rule));
  }
  return out;
}

/** 50 Phantom Recon - [1] Reveal units one at a time, as many as you like. [2] When you stop, 2 damage to each of the last two units you revealed. */
mod(50, {
  run: function* (c) {
    const r = yield* revealAsMany(c, M(50));
    yield* hitEach(c, r.slice(-2), 2, M(50));
  },
});

/** 78 Signal Jammer - Choose one: remove the Alert from one Sentinel (its effect is cancelled), or remove every Barrier from every unit. */
mod(78, {
  run: function* (c) {
    const a = yield* ask(c, { kind: "option", prompt: "Signal Jammer: choose one.", rule: M(78), options: [{ id: "alert", label: "Remove the Alert token from one Sentinel" }, { id: "barriers", label: "Remove every Barrier from every unit" }] });
    if (a.value === "alert") {
      const s = yield* chooseUnit(c, "Signal Jammer: remove the Alert from which Sentinel?", M(78), (u) => unitType(c, u) === "Sentinel" && tile(c.state, u).tokens.alert);
      if (s !== undefined) cancelAlert(c, s, M(78));
      return;
    }
    for (const u of choosableUnits(c, (x) => tile(c.state, x).tokens.barrier)) {
      tile(c.state, u).tokens.barrier = false;
      c.state.supply.barrier += 1;
      log(c, `Signal Jammer: ${describe(c, u)} loses its Barrier`, M(78));
    }
  },
});

