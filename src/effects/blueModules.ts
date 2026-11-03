/** Blue Modules 51-76 (light background: Command phase). Many look at or move face-down tiles. */

import { type Effect, OpenQuestion, type RunCtx, ask, log } from "../engine/effect.js";
import { type Ctx, choosableUnits, darkSectors, describe, fieldMap, level, sectorKeys, sectorState, stack, tile, topTileId, unitType } from "../engine/field.js";
import { moduleDef } from "../engine/modules.js";
import { markSeen, requestOverload, reveal, swap } from "../engine/moves.js";
import type { SectorKey, TileId } from "../engine/state.js";
import { afterTopTileLeaves, checkSleepers, damageFlagship, destroy, placeFuse, repairFlagship } from "../engine/tokens.js";
import { fromKey, key } from "../geometry/hex.js";
import { chooseUnit } from "./helpers.js";
import { boostEach, chooseOneOf, chooseRow, chooseUnits, countType, hitEach, horizontalRows, placeOneEnergy, readyIds, revealUnits, unitsIn } from "./kit.js";
import { cleared, fewestType, mod, otherExhausted, revealAsMany } from "./modules.js";

const M = (id: number) => `Module ${id}`;
const is = (c: Ctx, ...types: string[]) => (u: TileId) => types.includes(unitType(c, u));
const name = (c: Ctx, id: number) => moduleDef(c, id).name;
const printed = (c: Ctx, id: number) => moduleDef(c, id).cost as number;

function* chooseSectorFrom(c: RunCtx, prompt: string, rule: string, options: SectorKey[]): Effect<SectorKey | undefined> {
  if (options.length === 0) {
    log(c, `${prompt} - none, skipped`, rule);
    return undefined;
  }
  if (options.length === 1) return options[0];
  return ((yield* ask(c, { kind: "sectors", prompt, rule, options, min: 1, max: 1 })).value as string[])[0];
}

function* chooseModule(c: RunCtx, prompt: string, rule: string, ids: number[]): Effect<number | undefined> {
  if (ids.length === 0) {
    log(c, `${prompt} - no such Module`, rule);
    return undefined;
  }
  if (ids.length === 1) return ids[0];
  return Number((yield* ask(c, { kind: "option", prompt, rule, options: ids.map((m) => ({ id: String(m), label: name(c, m) })) })).value);
}

const names = (c: Ctx, ids: TileId[]) => ids.map((t) => tile(c.state, t).unitId).join(", ");

/** After tiles leave the top of a stack: the sector may be Dark, uncovered or Cleared (3.4). */
function topChanged(c: Ctx, k: SectorKey, before: TileId | undefined): void {
  if (topTileId(c.state, k) !== before) afterTopTileLeaves(c, k);
}

/** 51 Satellite Ion Scan - [1] Reveal units one at a time, as many as you like. [2] When you stop, if the last unit you revealed is a Bot, destroy it. */
mod(51, {
  run: function* (c) {
    const r = yield* revealAsMany(c, M(51));
    const last = r[r.length - 1];
    if (last !== undefined && unitType(c, last) === "Bot" && choosableUnits(c).includes(last)) destroy(c, last, M(51));
  },
});

/** 52 Tactical Scan - [1] Up to 4 Dark sectors: look at their top tiles. [2] Reveal every Bot among them, 1 damage to each. [3] The others go back face down. */
mod(52, {
  run: function* (c) {
    const ds = darkSectors(c.state);
    if (ds.length === 0) return log(c, "Tactical Scan: no Dark sector", M(52));
    const pick = (yield* ask(c, { kind: "sectors", prompt: "Tactical Scan: look at the top tiles of up to 4 Dark sectors.", rule: M(52), options: ds, min: 0, max: Math.min(4, ds.length) })).value as string[];
    const tops = pick.map((k) => topTileId(c.state, k)!);
    markSeen(c, tops);
    log(c, `Tactical Scan: you look at ${names(c, tops)}`, M(52));
    const bots: TileId[] = [];
    for (const k of pick) {
      const t = topTileId(c.state, k)!;
      if (c.data.units.byId.get(tile(c.state, t).unitId!)?.type === "Bot") bots.push(yield* reveal(c, k, M(52)));
    }
    yield* hitEach(c, bots, 1, M(52));
  },
});

/** 53 Pathfinder Array - [1] Reveal X units. [2] 2 damage to each Bot revealed this way. Cost 3 + X, 1 less in total per other exhausted Module. */
mod(53, {
  x: { min: 0 },
  cost: (c, x) => printed(c, 53) + x - otherExhausted(c, 53),
  run: function* (c, run) {
    const r = yield* revealUnits(c, run.x ?? 0, M(53));
    yield* hitEach(c, r.filter(is(c, "Bot")), 2, M(53));
  },
});

/** 54 Debris Sifter - [1] Look at the top X tiles of one Dark sector. [2] Discard one Bot among them, if there is one. [3] Put the rest back face down in the same order. X is at least 1. */
mod(54, {
  x: { min: 1 },
  cost: (_c, x) => x,
  run: function* (c, run) {
    const k = yield* chooseSectorFrom(c, "Debris Sifter: choose a Dark sector.", M(54), darkSectors(c.state));
    if (k === undefined) return;
    const st = stack(c.state, k);
    const top = [...st].reverse().slice(0, run.x ?? 1);
    markSeen(c, top);
    log(c, `Debris Sifter: you look at ${names(c, top)} (top first)`, M(54));
    const bots = top.filter((t) => c.data.units.byId.get(tile(c.state, t).unitId!)?.type === "Bot");
    if (bots.length === 0) return log(c, "Debris Sifter: no Bot among them", M(54));
    const b = bots.length === 1 ? bots[0]! : ((yield* ask(c, { kind: "option", prompt: "Debris Sifter: discard which Bot?", rule: M(54), options: bots.map((t) => ({ id: t, label: tile(c.state, t).unitId! })) })).value as TileId);
    const before = topTileId(c.state, k);
    st.splice(st.indexOf(b), 1);
    // Discarded face up, like every removed tile; it had no tokens (it was not a unit).
    tile(c.state, b).faceUp = true;
    c.state.piles.discard.push(b);
    log(c, `Debris Sifter: ${tile(c.state, b).unitId} is discarded`, M(54));
    // The rest stay face down, in the same order.
    for (const t of top) if (t !== b) tile(c.state, t).faceUp = false;
    topChanged(c, k, before);
  },
});

/** 55 Minefield Layer - [1] A horizontal row with at least one Mecha. [2] A Tick on every unit in it. Cost 7, 2 less per Cleared sector. */
mod(55, {
  cost: (c) => printed(c, 55) - 2 * cleared(c),
  run: function* (c) {
    const r = yield* chooseRow(c, "Minefield Layer: choose a horizontal row with a Mecha.", M(55), horizontalRows(c).filter((x) => unitsIn(c, x.sectors).some(is(c, "Mecha"))));
    if (r) for (const u of unitsIn(c, r.sectors)) placeFuse(c, u, "tick", M(55));
  },
});

/** 56 Scatter Minelayer - [1] 1 damage to your Flagship. [2] A Tick on one Bot, one Sentinel, one Gyro, one Sleeper and one Mecha. */
mod(56, {
  run: function* (c) {
    yield* damageFlagship(c, 1, M(56));
    for (const t of ["Bot", "Sentinel", "Gyro", "Sleeper", "Mecha"]) {
      const u = yield* chooseOneOf(c, `Scatter Minelayer: a Tick on which ${t}?`, M(56), choosableUnits(c, is(c, t)));
      if (u !== undefined) placeFuse(c, u, "tick", M(56));
    }
  },
});

/** 57 Graviton Mine - Choose one: a Tick on every Gyro and every Sleeper, or a Tick on every Sentinel and Boost each of them. */
mod(57, {
  run: function* (c) {
    const a = yield* ask(c, { kind: "option", prompt: "Graviton Mine: choose one.", rule: M(57), options: [{ id: "gs", label: "A Tick on every Gyro and every Sleeper" }, { id: "s", label: "A Tick on every Sentinel and Boost each of them" }] });
    if (a.value === "gs") {
      for (const u of choosableUnits(c, is(c, "Gyro", "Sleeper"))) placeFuse(c, u, "tick", M(57));
      return;
    }
    const ss = choosableUnits(c, is(c, "Sentinel"));
    for (const u of ss) placeFuse(c, u, "tick", M(57));
    yield* boostEach(c, ss, M(57));
  },
});

/** 58 Ion Mine - Choose one: a Tick on every Sentinel that has a Barrier, or remove every Barrier from every Sentinel. */
mod(58, {
  run: function* (c) {
    const a = yield* ask(c, { kind: "option", prompt: "Ion Mine: choose one.", rule: M(58), options: [{ id: "tick", label: "A Tick on every Sentinel that has a Barrier" }, { id: "bar", label: "Remove every Barrier from every Sentinel" }] });
    const ss = choosableUnits(c, (u) => unitType(c, u) === "Sentinel" && tile(c.state, u).tokens.barrier);
    for (const u of ss) {
      if (a.value === "tick") placeFuse(c, u, "tick", M(58));
      else {
        tile(c.state, u).tokens.barrier = false;
        c.state.supply.barrier += 1;
        log(c, `Ion Mine: ${describe(c, u)} loses its Barrier`, M(58));
      }
    }
  },
});

/** 59 Trojan Patch - [1] A Tick on every damaged Bot and every damaged Mecha. [2] Remove 1 Damage token from each of them. */
mod(59, {
  run: function* (c) {
    const us = choosableUnits(c, (u) => is(c, "Bot", "Mecha")(u) && tile(c.state, u).tokens.damage > 0);
    for (const u of us) placeFuse(c, u, "tick", M(59));
    for (const u of us) {
      tile(c.state, u).tokens.damage -= 1;
      log(c, `Trojan Patch: 1 Damage removed from ${describe(c, u)}`, M(59));
    }
  },
});

/** 60 Tiered Minefield - [1] A Tick on every Level 1 unit. [2] Boost every Level 2 unit. */
mod(60, {
  run: function* (c) {
    for (const u of choosableUnits(c, (x) => level(c, x) === 1)) placeFuse(c, u, "tick", M(60));
    yield* boostEach(c, choosableUnits(c, (x) => level(c, x) === 2), M(60));
  },
});

/** Boost each unit and place a Tick on each of them. */
function* boostAndTick(c: RunCtx, us: TileId[], rule: string): Effect {
  yield* boostEach(c, us, rule);
  for (const u of us) placeFuse(c, u, "tick", rule);
}

/** 61 Trap Line - [1] Choose a horizontal row. [2] Boost every unit in it and place a Tick on each of them. */
mod(61, {
  run: function* (c) {
    const r = yield* chooseRow(c, "Trap Line: choose a horizontal row.", M(61), horizontalRows(c));
    yield* boostAndTick(c, unitsIn(c, r!.sectors).filter((u) => choosableUnits(c).includes(u)), M(61));
  },
});

/** 62 Proton Trap - [1] The type with the fewest units (ignore Flares and absent types). [2] Boost every unit of it and place a Tick on each. */
mod(62, {
  run: function* (c) {
    const t = yield* fewestType(c, M(62));
    if (t) yield* boostAndTick(c, choosableUnits(c, is(c, t)), M(62));
  },
});

/** 63 Harmonic Trap - [1] Choose one unit. [2] Boost every unit with the same Level as it (including it) and place a Tick on each. */
mod(63, {
  run: function* (c) {
    const u = yield* chooseUnit(c, "Harmonic Trap: choose a unit.", M(63));
    if (u === undefined) return;
    const l = level(c, u);
    yield* boostAndTick(c, choosableUnits(c, (x) => level(c, x) === l), M(63));
  },
});

/** 64 Power Relay - 1 energy on each of five different ready Modules other than this one (as many as possible). */
mod(64, {
  run: function* (c, run) {
    let ids = readyIds(c).filter((m) => m !== run.id);
    if (ids.length > 5) {
      const pick: number[] = [];
      for (let i = 0; i < 5; i++) {
        const m = yield* chooseModule(c, `Power Relay: Module ${i + 1} of 5?`, M(64), ids.filter((x) => !pick.includes(x)));
        pick.push(m!);
      }
      ids = pick;
    }
    for (const m of ids) yield* placeOneEnergy(c, m, M(64));
  },
});

/**
 * 65 Salvage Siphon - [1] Choose one ready Module other than this one. [2] Place 1 energy on it for each Bot.
 * [3] Return all energy on your other Modules to the Supply. Open question Q6: "other" than which Module?
 */
mod(65, {
  run: function* () {
    throw new OpenQuestion("Q6", 'Salvage Siphon step [3] "Return all energy on your other Modules": other than Salvage Siphon (which also empties the Module just filled in [2]), or other than the Module chosen in [1]?');
  },
});

/** 66 Deep Scan Probe - [1] Choose one Dark sector and look at its top tile. [2] You may put it face down at the bottom of that sector. */
mod(66, {
  run: function* (c) {
    const k = yield* chooseSectorFrom(c, "Deep Scan Probe: choose a Dark sector.", M(66), darkSectors(c.state));
    if (k === undefined) return;
    const t = topTileId(c.state, k)!;
    markSeen(c, [t]);
    log(c, `Deep Scan Probe: the top tile of (${k}) is ${tile(c.state, t).unitId}`, M(66));
    if (stack(c.state, k).length === 1) return;
    const a = yield* ask(c, { kind: "yesno", prompt: `Deep Scan Probe: put ${tile(c.state, t).unitId} face down at the bottom of (${k})?`, rule: M(66) });
    if (a.value !== true) return;
    const st = stack(c.state, k);
    st.splice(st.indexOf(t), 1);
    st.unshift(t);
    log(c, `Deep Scan Probe: ${tile(c.state, t).unitId} goes to the bottom of (${k})`, M(66));
    afterTopTileLeaves(c, k);
  },
});

/** Place 1 energy per count on one ready Module other than this one. */
function* fillOne(c: RunCtx, self: number, n: number, rule: string): Effect {
  const m = yield* chooseModule(c, `${rule}: choose a ready Module other than this one.`, rule, readyIds(c).filter((x) => x !== self));
  if (m === undefined) return;
  for (let i = 0; i < n; i++) if (!(yield* placeOneEnergy(c, m, rule))) return;
}

/** 67 Harvest Beacon - [1] One ready Module other than this one. [2] 1 energy on it per Sentinel. [3] Start an Overload. */
mod(67, {
  run: function* (c, run) {
    yield* fillOne(c, run.id, countType(c, "Sentinel"), M(67));
    requestOverload(c, "Harvest Beacon");
  },
});

/** 68 Tractor Beam - [1] Swap two units. [2] Make one of your other exhausted Modules ready. */
mod(68, {
  run: function* (c, run) {
    const us = choosableUnits(c);
    if (us.length >= 2) {
      const a = (yield* ask(c, { kind: "units", prompt: "Tractor Beam: swap which two units?", rule: M(68), options: us, min: 2, max: 2 })).value as TileId[];
      swap(c, a[0]!, a[1]!, M(68));
    }
    const m = yield* chooseModule(c, "Tractor Beam: make which exhausted Module ready?", M(68), c.state.player.modules.filter((x) => !x.ready && x.id !== run.id).map((x) => x.id));
    if (m !== undefined) {
      c.state.player.modules.find((x) => x.id === m)!.ready = true;
      log(c, `Tractor Beam: ${name(c, m)} is ready`, M(68));
    }
  },
});

/** 69 Strata Shifter - [1] Take any number of tiles from the top of one Dark sector and look at them. [2] Place them on top of one adjacent Dark sector, same order, faces kept. */
mod(69, {
  run: function* (c) {
    const from = yield* chooseSectorFrom(c, "Strata Shifter: take tiles from which Dark sector?", M(69), darkSectors(c.state));
    if (from === undefined) return;
    const st = stack(c.state, from);
    const n = (yield* ask(c, { kind: "amount", prompt: `Strata Shifter: take how many tiles from the top of (${from})?`, rule: M(69), min: 0, max: st.length })).value as number;
    if (n === 0) return;
    const taken = st.slice(st.length - n); // bottom first
    markSeen(c, taken.filter((t) => !tile(c.state, t).faceUp));
    log(c, `Strata Shifter: you look at ${names(c, [...taken].reverse())} (top first)`, M(69));
    const targets = fieldMap(c.state)
      .adjacent(fromKey(from))
      .map(key)
      .filter((k) => sectorState(c.state, k) === "dark");
    const to = yield* chooseSectorFrom(c, "Strata Shifter: place them on which adjacent Dark sector?", M(69), targets);
    if (to === undefined) return log(c, "Strata Shifter: no adjacent Dark sector; the tiles stay", M(69));
    st.splice(st.length - n, n);
    stack(c.state, to).push(...taken);
    log(c, `Strata Shifter: ${n} tile${n === 1 ? "" : "s"} move from (${from}) to (${to})`, M(69));
    afterTopTileLeaves(c, from);
    checkSleepers(c);
  },
});

/** 70 Core Drill - [1] One Dark sector: look at all its tiles. [2] You may put its bottom tile face down on top of that sector, then Reveal it. */
mod(70, {
  run: function* (c) {
    const k = yield* chooseSectorFrom(c, "Core Drill: choose a Dark sector.", M(70), darkSectors(c.state));
    if (k === undefined) return;
    const st = stack(c.state, k);
    markSeen(c, st.filter((t) => !tile(c.state, t).faceUp));
    log(c, `Core Drill: (${k}) holds ${names(c, [...st].reverse())} (top first)`, M(70));
    const a = yield* ask(c, { kind: "yesno", prompt: `Core Drill: put the bottom tile (${tile(c.state, st[0]!).unitId}) face down on top, then Reveal it?`, rule: M(70) });
    if (a.value !== true) return;
    const b = st.shift()!;
    tile(c.state, b).faceUp = false;
    st.push(b);
    yield* reveal(c, k, M(70));
  },
});

/** 71 Gravity Well - [1] The top tile of each of up to five different Dark sectors: look at them. [2] Face down on top of one Dark sector, in any order. [3] Remove 1 damage from your Flagship. */
mod(71, {
  run: function* (c) {
    const ds = darkSectors(c.state);
    const pick = ds.length === 0 ? [] : ((yield* ask(c, { kind: "sectors", prompt: "Gravity Well: take the top tile of up to five Dark sectors.", rule: M(71), options: ds, min: 0, max: Math.min(5, ds.length) })).value as string[]);
    const taken: TileId[] = [];
    for (const k of pick) {
      const st = stack(c.state, k);
      taken.push(st.pop()!);
      afterTopTileLeaves(c, k);
    }
    if (taken.length > 0) {
      markSeen(c, taken);
      log(c, `Gravity Well: you take ${names(c, taken)}`, M(71));
      const to = yield* chooseSectorFrom(c, "Gravity Well: put them on top of which Dark sector?", M(71), darkSectors(c.state));
      if (to === undefined) throw new OpenQuestion("Q7", "Gravity Well took the top tile of every Dark sector and none is Dark any more. Where do the taken tiles go?");
      const target = to;
      // Order: choose the tile for each place, bottom first.
      let left = [...taken];
      while (left.length > 0) {
        const t = left.length === 1 ? left[0]! : ((yield* ask(c, { kind: "option", prompt: `Gravity Well: which tile goes next (from the bottom up) on (${target})?`, rule: M(71), options: left.map((x) => ({ id: x, label: tile(c.state, x).unitId! })) })).value as TileId);
        tile(c.state, t).faceUp = false;
        stack(c.state, target).push(t);
        left = left.filter((x) => x !== t);
      }
      checkSleepers(c);
    }
    yield* repairFlagship(c, 1, M(71));
  },
});

/** 72 Seismic Sonar - [1] Look at the bottom tile of one sector. [2] Repeat once per other exhausted Module, a different sector each time. [3] Start an Overload. */
mod(72, {
  run: function* (c, run) {
    const n = 1 + otherExhausted(c, run.id);
    const used: SectorKey[] = [];
    for (let i = 0; i < n; i++) {
      const options = sectorKeys(c.state).filter((k) => stack(c.state, k).length > 0 && !used.includes(k));
      const k = yield* chooseSectorFrom(c, `Seismic Sonar: look at the bottom tile of which sector (${i + 1} of ${n})?`, M(72), options);
      if (k === undefined) break;
      used.push(k);
      const b = stack(c.state, k)[0]!;
      if (!tile(c.state, b).faceUp) markSeen(c, [b]);
      log(c, `Seismic Sonar: the bottom tile of (${k}) is ${tile(c.state, b).unitId}`, M(72));
    }
    requestOverload(c, "Seismic Sonar");
  },
});

/** 73 Damage Control - Remove 1 damage from each of two different Bays of your Flagship. */
mod(73, {
  run: function* (c) {
    const co = c.data.companies.byId.get(c.state.player.company)!;
    const damaged = c.state.flagship.map((x, i) => (x < co.bays[i]!.integrity ? i : -1)).filter((i) => i >= 0);
    if (damaged.length === 0) return log(c, "Damage Control: no damaged Bay", M(73));
    const pick =
      damaged.length <= 2
        ? damaged
        : ((yield* ask(c, { kind: "option", prompt: "Damage Control: repair which two Bays?", rule: M(73), options: damaged.flatMap((a, i) => damaged.slice(i + 1).map((b) => ({ id: `${a},${b}`, label: `Bay ${a + 1} and Bay ${b + 1}` }))) })).value as string)
            .split(",")
            .map(Number);
    for (const i of pick) {
      c.state.flagship[i]! += 1;
      log(c, `Damage Control: Bay ${i + 1} repaired by 1`, M(73));
    }
  },
});

/** 74 Repair Field - [1] Remove 1 Damage token from every unit. [2] Remove 1 damage from your Flagship. */
mod(74, {
  run: function* (c) {
    for (const u of choosableUnits(c, (x) => tile(c.state, x).tokens.damage > 0)) {
      tile(c.state, u).tokens.damage -= 1;
      log(c, `Repair Field: 1 Damage removed from ${describe(c, u)}`, M(74));
    }
    yield* repairFlagship(c, 1, M(74));
  },
});

/** 75 Quantum Reformation - [1] Remove 1 damage from your Flagship for every two Sentinels (round down). [2] Start an Overload. */
mod(75, {
  run: function* (c) {
    yield* repairFlagship(c, Math.floor(countType(c, "Sentinel") / 2), M(75));
    requestOverload(c, "Quantum Reformation");
  },
});

/** 76 EMP Burst - Remove every Damage, Barrier and Fuse token from every unit. */
mod(76, {
  run: function* (c) {
    for (const u of choosableUnits(c)) {
      const t = tile(c.state, u).tokens;
      c.state.supply.barrier += t.barrier ? 1 : 0;
      c.state.supply.tick += t.tick;
      c.state.supply.mortar += t.mortar;
      c.state.supply.feedback += t.feedback;
      t.damage = 0;
      t.barrier = false;
      t.tick = 0;
      t.mortar = 0;
      t.feedback = 0;
    }
    log(c, "EMP Burst: every Damage, Barrier and Fuse token is removed", M(76));
  },
});

