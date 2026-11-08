/** Flagship Bay abilities and Bay upgrades, from company_vessels_structured.txt. */

import { type Effect, type RunCtx, ask, log } from "../engine/effect.js";
import { type Ctx, canBeChosen, choosableUnits, fieldMap, isUnit, level, sectorKeys, sectorOf, sectorState, tile, unitAt } from "../engine/field.js";
import { markSeen, move, openNeighbours, reveal, swap, topTiles } from "../engine/moves.js";
import { type SectorKey, type TileId, hasAnyToken } from "../engine/state.js";
import { cancelAlert, checkSleepers, dealHit, placeFuse, removeBarrier } from "../engine/tokens.js";
import { fromKey, key } from "../geometry/hex.js";
import { chooseDarkSector, chooseSector, chooseUnit } from "./helpers.js";
import { registerAbility } from "./registry.js";

const levelIs = (c: Ctx, n: number) => (u: TileId) => level(c, u) === n;

/** "Deal 1 damage to <a unit matching filter>." */
function damageOne(id: string, filter: (c: Ctx) => (u: TileId) => boolean, what: string) {
  registerAbility(id, function* (c) {
    const u = yield* chooseUnit(c, `${id}: deal 1 damage to ${what}.`, id, filter(c));
    if (u !== undefined) yield* dealHit(c, u, 1, id);
  });
}

/** "Move <a unit> to an adjacent Dark sector." Units with nowhere to go are not offered. */
function* moveOneToAdjacentDark(c: RunCtx, id: string): Effect {
  const u = yield* chooseUnit(c, `${id}: move which unit to an adjacent Dark sector?`, id, (x) => openNeighbours(c, x).length > 0);
  if (u === undefined) return;
  const to = yield* chooseSector(c, `${id}: move it where?`, id, openNeighbours(c, u));
  if (to !== undefined) move(c, u, to, id);
}

/** Swap two units; `adjacent` = they must be next to each other. */
function* swapTwo(c: RunCtx, id: string, adjacent: boolean): Effect {
  const adjOf = (u: TileId) =>
    fieldMap(c.state)
      .adjacent(fromKey(sectorOf(c.state, u)!))
      .map((n) => unitAt(c.state, key(n)))
      .filter((x): x is TileId => x !== undefined && choosableUnits(c).includes(x));
  const first = yield* chooseUnit(c, `${id}: swap which unit?`, id, (u) => (adjacent ? adjOf(u).length > 0 : choosableUnits(c).length > 1));
  if (first === undefined) return;
  const options = adjacent ? adjOf(first) : choosableUnits(c).filter((u) => u !== first);
  const a = yield* ask(c, { kind: "units", prompt: `${id}: swap it with which unit?`, rule: id, options, min: 1, max: 1 });
  swap(c, first, (a.value as TileId[])[0]!, id);
}

/** Every order of a list (the player puts looked-at tiles back in any order). */
function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

/**
 * V1 Bay 3 (designer 2026-11-08, a rules change): "one sector with no tokens": a Dark sector, or a
 * sector whose unit has no tokens (and can be chosen: not a Flare or a Wreck, 3.2). A Cleared sector
 * has no tiles to look at. Later, Dark sectors may carry tokens too (docs/next-sessions.md).
 */
export function sectorsWithNoTokens(c: Ctx): SectorKey[] {
  return sectorKeys(c.state).filter((k) => {
    const st = sectorState(c.state, k);
    if (st === "dark") return !hasAnyToken(tile(c.state, c.state.field[k]![c.state.field[k]!.length - 1]!).tokens);
    if (st !== "occupied") return false;
    const u = unitAt(c.state, k)!;
    return canBeChosen(c, u) && !hasAnyToken(tile(c.state, u).tokens);
  });
}

/** Look at the top n tiles of a Dark sector (fewer if the stack is shorter). Returns them top first. */
function* lookAtTop(c: RunCtx, id: string, n: number, anyNoTokens = false): Effect<{ sector: SectorKey; tiles: TileId[] } | undefined> {
  const k = anyNoTokens ? yield* chooseSector(c, `${id}: choose a sector with no tokens.`, id, sectorsWithNoTokens(c)) : yield* chooseDarkSector(c, `${id}: choose a Dark sector.`, id);
  if (k === undefined) return undefined;
  const tiles = topTiles(c, k, n);
  markSeen(c, tiles, true, id);
  log(c, `${id}: look at the top ${tiles.length} tile${tiles.length === 1 ? "" : "s"} of (${k}): ${tiles.map((t) => tile(c.state, t).unitId).join(", ")}`, id);
  return { sector: k, tiles };
}

/**
 * Put the looked-at tiles back in `order` (top first). They are the top of
 * the stack. A face-up tile put on top is uncovered, not revealed (3.4;
 * designer confirmed, open question Q2).
 */
function putBack(c: RunCtx, k: SectorKey, order: TileId[]): void {
  const st = c.state.field[k]!;
  const before = st[st.length - 1];
  st.splice(st.length - order.length, order.length, ...[...order].reverse());
  const top = st[st.length - 1]!;
  if (top !== before && tile(c.state, top).faceUp) {
    log(c, `${tile(c.state, top).unitId} is now on top of (${k}): uncovered, not revealed`, "3.4");
    checkSleepers(c);
  }
}

// ---- V1: Support Vessel Of Ko and Van ----

damageOne("V1_BAY1", () => () => true, "any unit");

registerAbility("V1_BAY2", (c) => moveOneToAdjacentDark(c, "V1_BAY2"));

/**
 * Choose one sector with no tokens. Look at its top 3 tiles and put them back in any order. Then reveal
 * that sector (designer 2026-11-08; before: "one Dark sector"). Its top tile is revealed only when it is
 * face down (8.5); a face-up tile put on top is uncovered, not revealed (Q2).
 */
registerAbility("V1_BAY3", function* (c) {
  const look = yield* lookAtTop(c, "V1_BAY3", 3, true);
  if (!look) return;
  const perms = permutations(look.tiles);
  let order = look.tiles;
  if (perms.length > 1) {
    const a = yield* ask(c, {
      kind: "option",
      prompt: "V1_BAY3: put them back in which order (top first)?",
      rule: "V1_BAY3",
      options: perms.map((p) => ({ id: p.join(">"), label: p.map((t) => tile(c.state, t).unitId).join(" > ") })),
    });
    order = (a.value as string).split(">");
  }
  putBack(c, look.sector, order);
  if (sectorState(c.state, look.sector) === "dark") yield* reveal(c, look.sector, "V1_BAY3");
  else log(c, `(${look.sector}) is not Dark: nothing to reveal`, "11.1");
});

// ---- V2: Kew'n X2 ----

damageOne("V2_BAY1", (c) => levelIs(c, 3), "a Level 3 unit");
damageOne("V2_P1", (c) => levelIs(c, 2), "a Level 2 unit");
damageOne("V2_P1A", (c) => levelIs(c, 1), "a Level 1 unit");

registerAbility("V2_BAY2", (c) => swapTwo(c, "V2_BAY2", true));
registerAbility("V2_P2", (c) => swapTwo(c, "V2_P2", false));
registerAbility("V2_P2A", (c) => moveOneToAdjacentDark(c, "V2_P2A"));

/** "Choose one Dark sector and look at its top 3 tiles." */
registerAbility("V2_BAY3", function* (c) {
  yield* lookAtTop(c, "V2_BAY3", 3);
});

/** "Look at its top N tiles. You may move the Nth tile to the top." (V2_P3: 4, V2_P3A: 5) */
function lookAndLift(id: string, n: number) {
  registerAbility(id, function* (c) {
    const look = yield* lookAtTop(c, id, n);
    if (!look || look.tiles.length < n) return; // no Nth tile: nothing to move
    const a = yield* ask(c, { kind: "yesno", prompt: `${id}: move the ${n === 4 ? "fourth" : "fifth"} tile (${tile(c.state, look.tiles[n - 1]!).unitId}) to the top?`, rule: id });
    if (a.value === true) putBack(c, look.sector, [look.tiles[n - 1]!, ...look.tiles.slice(0, n - 1)]);
  });
}
lookAndLift("V2_P3", 4);
lookAndLift("V2_P3A", 5);

function tickOn(id: string, filter: (c: Ctx) => (u: TileId) => boolean, what: string) {
  registerAbility(id, function* (c) {
    const u = yield* chooseUnit(c, `${id}: place a Tick on ${what}.`, id, filter(c));
    if (u !== undefined) placeFuse(c, u, "tick", id);
  });
}
tickOn("V2_BAY4", (c) => levelIs(c, 1), "a Level 1 unit");
tickOn("V2_P4", (c) => (u) => tile(c.state, u).tokens.damage > 0, "a damaged unit");
tickOn("V2_P4A", () => () => true, "a unit");

/** [Overload] Remove 1 damage from a unit. */
registerAbility("V2_BAY5", function* (c) {
  const u = yield* chooseUnit(c, "V2_BAY5: remove 1 damage from which unit?", "V2_BAY5", (x) => tile(c.state, x).tokens.damage > 0);
  if (u !== undefined) {
    tile(c.state, u).tokens.damage -= 1;
    log(c, `V2_BAY5: 1 Damage removed from ${tile(c.state, u).unitId}`, "V2_BAY5");
  }
});

/** [Overload] Remove a Barrier from a unit. */
registerAbility("V2_P5", function* (c) {
  const u = yield* chooseUnit(c, "V2_P5: remove the Barrier from which unit?", "V2_P5", (x) => tile(c.state, x).tokens.barrier);
  if (u !== undefined) removeBarrier(c, u, "V2_P5");
});

/** [Overload] Remove the Alert token from one Sentinel or one unit with an At Overload trigger (its effect is cancelled). */
registerAbility("V2_P5A", function* (c) {
  const camp = c.data.campaigns.find((x) => x.prefix === c.state.campaign)!;
  const atOverload = (u: TileId) => {
    const d = c.data.units.byId.get(tile(c.state, u).unitId!)!;
    if (d.type === "Omega") return camp.omega.find((o) => o.id === d.id)?.atOverload !== undefined;
    return (d.text.ability ?? "").startsWith("At Overload:");
  };
  const u = yield* chooseUnit(c, "V2_P5A: remove the Alert token from which unit?", "V2_P5A", (x) => tile(c.state, x).tokens.alert && (c.data.units.byId.get(tile(c.state, x).unitId!)!.type === "Sentinel" || atOverload(x)));
  if (u !== undefined && isUnit(c.state, u)) cancelAlert(c, u, "V2_P5A");
});
