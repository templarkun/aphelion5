/**
 * Moving tiles (Core Rules glossary: Move, Swap, Teleport, Bury; unit file
 * E9 "very bottom of its sector"), Reveal (8.5) and looking at face-down
 * tiles. Tokens travel with their tile; facing is kept except on Reveal
 * (3.7). Wrecks never move (4.8). After a top tile leaves, the sector is
 * checked (3.4) and Sleepers may wake (4.4).
 */

import { ENERGY_COLOURS, type EnergyColour } from "../data/units.js";
import { fromKey, isFacing, key } from "../geometry/hex.js";
import { type Effect, type RunCtx, ask, log } from "./effect.js";
import { type Ctx, describe, fieldMap, isUnit, isWreck, sectorOf, sectorState, stack, tile, topTileId, unitDef, unitType } from "./field.js";
import type { SectorKey, TileId } from "./state.js";
import { afterTopTileLeaves, checkSleepers, placeAlert, placeBarrier, returnTokens } from "./tokens.js";
import { powerNodeChoice } from "./heat.js";

/** Dark or Cleared: where Move, Teleport and Place may go (glossary "Dark sector"). */
export function isOpenSector(c: Ctx, k: SectorKey): boolean {
  const st = sectorState(c.state, k);
  return st === "dark" || st === "cleared";
}

/** Adjacent Dark or Cleared sectors of a unit. */
export function openNeighbours(c: Ctx, id: TileId): SectorKey[] {
  const k = sectorOf(c.state, id)!;
  return fieldMap(c.state)
    .adjacent(fromKey(k))
    .map(key)
    .filter((n) => isOpenSector(c, n));
}

function mustBeMovable(c: Ctx, id: TileId, what: string): SectorKey {
  if (!isUnit(c.state, id)) throw new Error(`${what}: ${id} is not a unit`);
  if (isWreck(c, id)) throw new Error(`${what}: a Wreck cannot be moved (4.8)`);
  return sectorOf(c.state, id)!;
}

function lift(c: Ctx, id: TileId): SectorKey {
  const k = sectorOf(c.state, id)!;
  const st = stack(c.state, k);
  st.splice(st.indexOf(id), 1);
  return k;
}

/** Move: the unit goes to an adjacent Dark or Cleared sector, with its tokens, on top of that stack. */
export function move(c: Ctx, id: TileId, to: SectorKey, rule = "glossary"): void {
  const from = mustBeMovable(c, id, "Move");
  if (!fieldMap(c.state).areAdjacent(fromKey(from), fromKey(to))) throw new Error(`Move: (${to}) is not adjacent to (${from})`);
  if (!isOpenSector(c, to)) throw new Error(`Move: (${to}) is not Dark or Cleared`);
  lift(c, id);
  stack(c.state, to).push(id);
  log(c, `${tile(c.state, id).unitId} moves from (${from}) to (${to})`, rule);
  afterTopTileLeaves(c, from);
}

/** Teleport: pick the unit up and put it, with its tokens, onto any Dark or Cleared sector. */
export function teleport(c: Ctx, id: TileId, to: SectorKey, rule = "glossary"): void {
  const from = mustBeMovable(c, id, "Teleport");
  if (!isOpenSector(c, to)) throw new Error(`Teleport: (${to}) is not Dark or Cleared`);
  lift(c, id);
  stack(c.state, to).push(id);
  log(c, `${tile(c.state, id).unitId} teleports from (${from}) to (${to})`, rule);
  afterTopTileLeaves(c, from);
}

/** Swap: two units exchange sectors, each with its tokens. */
export function swap(c: Ctx, a: TileId, b: TileId, rule = "glossary"): void {
  const ka = mustBeMovable(c, a, "Swap");
  const kb = mustBeMovable(c, b, "Swap");
  if (ka === kb) throw new Error("Swap: same sector");
  const sa = stack(c.state, ka);
  const sb = stack(c.state, kb);
  sa[sa.length - 1] = b;
  sb[sb.length - 1] = a;
  log(c, `${tile(c.state, a).unitId} and ${tile(c.state, b).unitId} swap: (${ka}) <-> (${kb})`, rule);
}

/**
 * Bury: remove all the unit's tokens (Alerts too, cancelling them), then swap
 * it with the tile directly beneath, keeping both faces. Nothing beneath:
 * nothing happens. Then check the new top tile (3.4).
 */
export function bury(c: Ctx, id: TileId, rule = "glossary"): boolean {
  const k = mustBeMovable(c, id, "Bury");
  const st = stack(c.state, k);
  if (st.length < 2) {
    log(c, `${describe(c, id)} has nothing beneath it: Bury does nothing`, rule);
    return false;
  }
  returnTokens(c, id);
  const i = st.length - 1;
  [st[i - 1], st[i]] = [st[i]!, st[i - 1]!];
  log(c, `${tile(c.state, id).unitId} is buried in (${k})`, rule);
  afterTopTileLeaves(c, k);
  return true;
}

/** Put a unit face up at the very bottom of its own sector, keeping its facing (E9, 8.8 step 5). */
export function putAtBottom(c: Ctx, id: TileId, rule = "8.8"): void {
  const k = mustBeMovable(c, id, "Put at the bottom");
  const st = stack(c.state, k);
  st.splice(st.indexOf(id), 1);
  st.unshift(id);
  log(c, `${tile(c.state, id).unitId} goes to the bottom of (${k})`, rule);
  if (st.length > 1) afterTopTileLeaves(c, k);
}

/** Record that the player has looked at face-down tiles. */
export function markSeen(c: Ctx, ids: readonly TileId[]): void {
  for (const id of ids) if (!c.state.seen.includes(id)) c.state.seen.push(id);
  c.state.hiddenInfo += 1;
}

/** The top n tiles of a sector, top first. */
export function topTiles(c: Ctx, k: SectorKey, n: number): TileId[] {
  return [...stack(c.state, k)].reverse().slice(0, n);
}

// ---------------------------------------------------------------------------
// Reveal (8.5) and Flares firing (4.6)
// ---------------------------------------------------------------------------

/** Ready Modules (5.3), excluding one being run (8.6: it is not ready while it resolves). */
export function readyModules(c: Ctx): number[] {
  return c.state.player.modules.filter((m) => m.ready).map((m) => m.id);
}

/**
 * Place energy from the Supply on ready Modules, split as you like (4.6, 5.3).
 * No ready Module: it stays in the Supply.
 */
export function* placeEnergyOnModules(c: RunCtx, amounts: Record<EnergyColour, number>, rule = "4.6"): Effect {
  const ready = readyModules(c);
  for (const col of ENERGY_COLOURS) {
    const n = Math.min(amounts[col], c.state.supply.energy[col]);
    if (n === 0) continue;
    if (ready.length === 0) {
      log(c, `no ready Module: ${n} ${col} energy stays in the Supply`, "5.3");
      continue;
    }
    const a = yield* ask(c, {
      kind: "split",
      prompt: `Place ${n} ${col} energy on ready Modules.`,
      rule,
      total: n,
      buckets: ready.map((id) => ({ id: String(id), label: c.data.modules.byId.get(id)!.name, max: n })),
    });
    for (const [mid, x] of Object.entries(a.value as Record<string, number>)) {
      if (x === 0) continue;
      c.state.player.modules.find((m) => m.id === Number(mid))!.energy[col] += x;
      c.state.supply.energy[col] -= x;
      log(c, `${x} ${col} energy placed on ${c.data.modules.byId.get(Number(mid))!.name}`, rule);
    }
  }
}

/** "Start an Overload" (9.1): after the current effect, and never during an Overload or Overload End. */
export function requestOverload(c: Ctx, why: string): void {
  if (c.state.phase !== "command") {
    log(c, `${why}: an Overload cannot start now (Overloads never stack)`, "9.1");
    return;
  }
  if (!c.state.overloadPending) log(c, `${why}: an Overload will start when the current effect finishes`, "9.1");
  c.state.overloadPending = true;
}

/** A Flare fires when revealed (4.6). */
function* flareFires(c: RunCtx, id: TileId): Effect {
  const d = unitDef(c, id);
  // H4: a revealed Power Node may give 3 Heat instead of its energy.
  const heat = c.state.settings.heatModule && d.id === "F_01" ? yield* powerNodeChoice(c) : false;
  if (d.energyOnReveal && !heat) yield* placeEnergyOnModules(c, d.energyOnReveal, "4.6");
  if (c.state.phase === "command") requestOverload(c, `${d.id} is revealed`);
  else if (c.state.phase === "overload") placeAlert(c, id, "4.6");
}

/** Distinct facings worth asking about: none for a tile without arrows (it looks the same every way). */
function facingChoices(c: Ctx, id: TileId): number[] {
  return unitDef(c, id).arrows.length === 0 ? [0] : [0, 1, 2, 3, 4, 5];
}

/**
 * Reveal (8.5): flip the top tile of a Dark sector face up and choose its
 * facing. A Sentinel gets a Barrier at once (4.5); a Flare fires (4.6); with
 * no Dark sector left, Sleepers are alerted (4.4).
 */
export function* reveal(c: RunCtx, k: SectorKey, rule = "8.5"): Effect<TileId> {
  if (sectorState(c.state, k) !== "dark") throw new Error(`Reveal: (${k}) is not Dark`);
  const id = topTileId(c.state, k)!;
  const t = tile(c.state, id);
  t.faceUp = true;
  c.state.hiddenInfo += 1;
  const choices = facingChoices(c, id);
  let f = 0;
  if (choices.length > 1) {
    const a = yield* ask(c, {
      kind: "option",
      prompt: `${t.unitId} is revealed in (${k}). Choose its facing.`,
      rule: "3.7",
      options: choices.map((x) => ({ id: String(x), label: x === 0 ? "as printed" : `turned ${x} side${x === 1 ? "" : "s"} clockwise` })),
    });
    f = Number(a.value);
  }
  if (!isFacing(f)) throw new Error("bad facing");
  t.facing = f;
  log(c, `Reveal (${k}): ${t.unitId}${f ? ` facing ${f}` : ""}`, rule);
  const type = unitType(c, id);
  if (type === "Sentinel") placeBarrier(c, id, "4.5");
  if (type === "Flare") yield* flareFires(c, id);
  checkSleepers(c);
  return id;
}
