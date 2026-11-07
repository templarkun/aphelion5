/**
 * Shared steps for unit effects (stage 5). Each one carries the conventions
 * of the unit file (E1-E14) so a card cannot forget them:
 * - E2: every named target is mandatory when a legal one exists;
 * - E3: "Reveal N" = N Reveals, one at a time, choosing a Dark sector each time;
 * - E4: counts are taken once, when the numbered step starts; Wrecks and
 *   Flares count as units of their type; Level and Strength counts ignore Flares;
 * - E6: one instruction = one hit per unit;
 * - E7/E8: "this unit", Targeted sectors and lines of fire.
 */

import type { UnitType } from "../data/units.js";
import { ENERGY_COLOURS, type EnergyColour } from "../data/units.js";
import { type Effect, type RunCtx, ask, log } from "../engine/effect.js";
import { type Ctx, canBeChosen, choosableUnits, darkSectors, describe, fieldMap, isWreck, level, sectorOf, strength, tile, unitAt, unitDef, unitType, units } from "../engine/field.js";
import { reveal } from "../engine/moves.js";
import type { Row } from "../geometry/fieldMap.js";
import { type Coord, type Facing, fromKey, key, turnClockwise } from "../geometry/hex.js";
import type { SectorKey, TileId } from "../engine/state.js";
import { type HitResult, boost, dealHit, placeAlert } from "../engine/tokens.js";
import { moduleDef } from "../engine/modules.js";

export const sectorCoordOf = (c: Ctx, u: TileId): Coord => fromKey(sectorOf(c.state, u)!);

/** Units of a type on the Field, Wrecks and Flares included (E4). */
export function ofType(c: Ctx, type: UnitType): TileId[] {
  return units(c.state).filter((u) => unitType(c, u) === type);
}

export function countType(c: Ctx, type: UnitType): number {
  return ofType(c, type).length;
}

/** Units in a list of sectors (map order of the list). */
export function unitsIn(c: Ctx, sectors: readonly Coord[]): TileId[] {
  return sectors.map((p) => unitAt(c.state, key(p))).filter((u): u is TileId => u !== undefined);
}

/** Units adjacent to a sector (3.5). */
export function adjacentTo(c: Ctx, k: SectorKey): TileId[] {
  return unitsIn(c, fieldMap(c.state).adjacent(fromKey(k)));
}

/** This unit's arrows at its facing: each arrow's Targeted sector and line of fire (3.6, 3.8, E8). */
function arrowsOf(c: Ctx, self: TileId) {
  return fieldMap(c.state).arrows(sectorCoordOf(c, self), unitDef(c, self).arrows, tile(c.state, self).facing);
}

/** Every Targeted unit (one per arrow, if its sector holds a unit). */
export function targetedUnits(c: Ctx, self: TileId): TileId[] {
  const out: TileId[] = [];
  for (const a of arrowsOf(c, self)) {
    const u = a.targeted ? unitAt(c.state, key(a.targeted)) : undefined;
    if (u !== undefined && !out.includes(u)) out.push(u);
  }
  return out;
}

/** Every unit in this unit's lines of fire. */
export function lineOfFireUnits(c: Ctx, self: TileId): TileId[] {
  const out: TileId[] = [];
  for (const a of arrowsOf(c, self)) for (const u of unitsIn(c, a.lineOfFire)) if (!out.includes(u)) out.push(u);
  return out;
}

/** E10: turn this unit clockwise by one side per count (6 = a full turn). */
export function turn(c: Ctx, self: TileId, n: number, rule: string): void {
  const t = tile(c.state, self);
  const before = t.facing;
  t.facing = turnClockwise(t.facing, ((n % 6) + 6) % 6) as Facing;
  log(c, `${describe(c, self)} turns clockwise by ${n} side${n === 1 ? "" : "s"} (facing ${before} -> ${t.facing})`, rule);
}

/** Deal `n` damage to each unit, one hit each (E6). Flares, Wrecks and units already gone are skipped silently. */
export function* hitEach(c: RunCtx, ids: readonly TileId[], n: number, rule: string): Effect<HitResult[]> {
  const out: HitResult[] = [];
  for (const u of ids) {
    if (!canBeChosen(c, u)) continue;
    out.push(yield* dealHit(c, u, n, rule));
  }
  return out;
}

export const destroyedBy = (rs: readonly HitResult[]) => rs.filter((r) => r.kind === "damaged" && r.destroyed !== undefined).length;

/** Boost each unit once; Flares and Wrecks are skipped (6.2). */
export function* boostEach(c: RunCtx, ids: readonly TileId[], rule: string): Effect {
  const targets = ids.filter((u) => canBeChosen(c, u));
  if (targets.length === 0) {
    log(c, `${rule}: no unit to Boost`, rule);
    return;
  }
  yield* boost(c, targets, rule);
}

/** Activate units (11.1 rule 6): each gets an Alert token. */
export function activate(c: Ctx, ids: readonly TileId[], rule: string): void {
  for (const u of ids) if (!isWreck(c, u)) placeAlert(c, u, rule);
}

/** Choose `n` different units (E2, Module convention 1), as many as possible. */
export function* chooseUnits(c: RunCtx, prompt: string, rule: string, options: TileId[], n: number): Effect<TileId[]> {
  const k = Math.min(n, options.length);
  if (k === 0) {
    log(c, `${prompt} - no legal unit, skipped`, rule);
    return [];
  }
  const a = yield* ask(c, { kind: "units", prompt, rule, options, min: k, max: k });
  return a.value as TileId[];
}

/** Choose one of several units or skip when none (mandatory when one exists, E2). */
export function* chooseOneOf(c: RunCtx, prompt: string, rule: string, options: TileId[]): Effect<TileId | undefined> {
  return (yield* chooseUnits(c, prompt, rule, options, 1))[0];
}

/** Choose one row from a list (ties and "of your choice", 11.1 rule 2). */
export function* chooseRow(c: RunCtx, prompt: string, rule: string, rows: Row[]): Effect<Row | undefined> {
  if (rows.length === 0) {
    log(c, `${prompt} - no such row, skipped`, rule);
    return undefined;
  }
  if (rows.length === 1) return rows[0];
  const a = yield* ask(c, { kind: "option", prompt, rule, options: rows.map((r, i) => ({ id: String(i), label: rowLabel(c, r) })), rows: rows.map((r) => r.sectors.map((p) => key(p))) });
  return rows[Number(a.value)];
}

const KIND_NAME = { horizontal: "horizontal row", rising: "rising diagonal (/)", falling: "falling diagonal (\\)" } as const;

export function rowLabel(c: Ctx, r: Row): string {
  const who = unitsIn(c, r.sectors).map((u) => tile(c.state, u).unitId);
  return `${KIND_NAME[r.kind]}: ${r.sectors.map((p) => `(${key(p)})`).join(" ")}${who.length ? ` - ${who.join(", ")}` : " - no units"}`;
}

/** The three rows through this unit ("a row through this unit", 3.6). */
export function rowsThrough(c: Ctx, self: TileId): Row[] {
  return fieldMap(c.state).rowsThrough(sectorCoordOf(c, self));
}

export function horizontalRows(c: Ctx): Row[] {
  return fieldMap(c.state).allRows("horizontal");
}

/** Keep only the rows where `score` is highest (or lowest). Ties: all of them. */
export function best(rows: Row[], score: (r: Row) => number, lowest = false): Row[] {
  if (rows.length === 0) return [];
  const s = rows.map(score);
  const target = lowest ? Math.min(...s) : Math.max(...s);
  return rows.filter((_, i) => s[i] === target);
}

/**
 * Reveal up to `n` units, one at a time (E3). `upTo`: the player may stop
 * early (asked before each Reveal). Returns the revealed units, in order.
 */
export function* revealUnits(c: RunCtx, n: number, rule: string, upTo = false): Effect<TileId[]> {
  const out: TileId[] = [];
  for (let i = 0; i < n; i++) {
    const dark = darkSectors(c.state);
    if (dark.length === 0) {
      if (i < n) log(c, `${rule}: no Dark sector left to Reveal`, "11.1");
      break;
    }
    if (upTo) {
      const go = yield* ask(c, { kind: "yesno", prompt: `${rule}: Reveal ${i === 0 ? "a" : "another"} unit? (${i} of up to ${n} so far)`, rule });
      if (go.value !== true) break;
    }
    const k = dark.length === 1 ? dark[0]! : ((yield* ask(c, { kind: "sectors", prompt: `${rule}: Reveal which Dark sector?`, rule, options: dark, min: 1, max: 1 })).value as string[])[0]!;
    out.push(yield* reveal(c, k, rule));
  }
  return out;
}

/** Reveal each of these sectors that is still Dark, one at a time, in the player's order. */
export function* revealSectors(c: RunCtx, sectors: SectorKey[], rule: string): Effect<TileId[]> {
  const out: TileId[] = [];
  let left = [...sectors];
  for (;;) {
    left = left.filter((k) => darkSectors(c.state).includes(k));
    if (left.length === 0) return out;
    const k = left.length === 1 ? left[0]! : ((yield* ask(c, { kind: "sectors", prompt: `${rule}: Reveal which sector next?`, rule, options: left, min: 1, max: 1 })).value as string[])[0]!;
    out.push(yield* reveal(c, k, rule));
    left = left.filter((x) => x !== k);
  }
}

/** The most abundant Level among units (Flares have none, E4). Ties: you choose (11.1 rule 2). */
export function* mostAbundantLevel(c: RunCtx, rule: string): Effect<number | undefined> {
  const counts = new Map<number, number>();
  for (const u of units(c.state)) {
    const l = level(c, u);
    if (l !== undefined) counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  if (counts.size === 0) return undefined;
  const top = Math.max(...counts.values());
  const levels = [...counts].filter(([, n]) => n === top).map(([l]) => l).sort((a, b) => a - b);
  if (levels.length === 1) return levels[0];
  const a = yield* ask(c, { kind: "option", prompt: `${rule}: Levels ${levels.join(", ")} are tied as the most abundant. Choose one.`, rule, options: levels.map((l) => ({ id: String(l), label: `Level ${l}` })) });
  return Number(a.value);
}

export function strengthOf(c: Ctx, u: TileId): number | undefined {
  return strength(c, u);
}

// ---------------------------------------------------------------------------
// Energy on Modules (5.3, E12)
// ---------------------------------------------------------------------------

/** Ready Modules (the Module being run is not ready, 8.6). */
export const readyIds = (c: Ctx) => c.state.player.modules.filter((m) => m.ready).map((m) => m.id);

/**
 * Place 1 energy from the Supply on one Module. With no colour given (the
 * card leaves the colour to you), it is the Module's own colour (5.3, Q9:
 * energy you choose to place matches the Module). A colour given by the card
 * is placed as it is. Returns false if the Supply has none of that colour.
 */
export function* placeOneEnergy(c: RunCtx, moduleId: number, rule: string, colour?: EnergyColour): Effect<boolean> {
  const s = c.state.supply.energy;
  const col = colour ?? moduleDef(c, moduleId).colour;
  if (s[col] === 0) {
    log(c, `no ${col} energy left in the Supply`, "6.7");
    return false;
  }
  s[col] -= 1;
  c.state.player.modules.find((m) => m.id === moduleId)!.energy[col] += 1;
  log(c, `1 ${col} energy placed on ${moduleDef(c, moduleId).name}`, rule);
  return true;
}

/** Place `n` energy on one ready Module (its own colour unless the card names one), limited by the Supply (6.7). */
export function* placeEnergyOn(c: RunCtx, moduleId: number, n: number, rule: string, colour?: EnergyColour): Effect {
  for (let i = 0; i < n; i++) if (!(yield* placeOneEnergy(c, moduleId, rule, colour))) return;
}

/** Place `n` energy on your ready Modules, split as you choose (each in its Module's colour, 5.3). */
export function* placeEnergySplit(c: RunCtx, n: number, rule: string): Effect {
  const ready = readyIds(c);
  if (ready.length === 0) {
    log(c, "no ready Module: the energy stays in the Supply", "5.3");
    return;
  }
  for (let i = 0; i < n; i++) {
    const id = ready.length === 1 ? ready[0]! : Number((yield* ask(c, { kind: "option", pick: "modules", prompt: `${rule}: place energy ${i + 1} of ${n} on which Module?`, rule, options: ready.map((m) => ({ id: String(m), label: moduleDef(c, m).name })) })).value);
    if (!(yield* placeOneEnergy(c, id, rule))) return;
  }
}

/** Remove 1 energy from one Module (your choice of colour) to the Supply. */
export function* removeOneEnergy(c: RunCtx, moduleId: number, rule: string): Effect<boolean> {
  const m = c.state.player.modules.find((x) => x.id === moduleId)!;
  const have = ENERGY_COLOURS.filter((k) => m.energy[k] > 0);
  if (have.length === 0) return false;
  const col = have.length === 1 ? have[0]! : ((yield* ask(c, { kind: "option", prompt: `${rule}: remove which colour from ${moduleDef(c, moduleId).name}?`, rule, options: have.map((k) => ({ id: k, label: k })) })).value as EnergyColour);
  m.energy[col] -= 1;
  c.state.supply.energy[col] += 1;
  log(c, `1 ${col} energy removed from ${moduleDef(c, moduleId).name}`, rule);
  return true;
}

const withEnergy = (c: Ctx) => c.state.player.modules.filter((m) => ENERGY_COLOURS.some((k) => m.energy[k] > 0)).map((m) => m.id);

/** Remove `n` energy from your Modules, your choice which; not enough = all of it (5.4). */
export function* removeEnergyAny(c: RunCtx, n: number, rule: string): Effect {
  for (let i = 0; i < n; i++) {
    const mods = withEnergy(c);
    if (mods.length === 0) {
      log(c, `${rule}: no energy left on your Modules`, rule);
      return;
    }
    const id = mods.length === 1 ? mods[0]! : Number((yield* ask(c, { kind: "option", pick: "modules", prompt: `${rule}: remove energy ${i + 1} of ${n} from which Module?`, rule, options: mods.map((m) => ({ id: String(m), label: moduleDef(c, m).name })) })).value);
    yield* removeOneEnergy(c, id, rule);
  }
}

export const modulesWithEnergy = withEnergy;

/** Printed cost for "lowest cost" comparisons: an X cost counts as its minimum (E11). */
export function printedCost(c: Ctx, id: number): number {
  const d = moduleDef(c, id);
  // E11: "An X cost counts as its minimum (Debris Sifter = 1, Pathfinder Array = 3)." Pathfinder's printed cost is 3.
  return d.cost === "X" ? 1 : d.cost;
}

export function typeOf(c: Ctx, u: TileId): UnitType {
  return unitType(c, u);
}

export { choosableUnits };

/**
 * "A Module you could run right now (light in the Command phase, red during
 * an Overload)", run without paying its cost: ready, and the background
 * matches the phase (5.3 free runs). Cost does not matter, since it is free.
 */
export function couldRunFree(c: Ctx, id: number): boolean {
  const m = c.state.player.modules.find((x) => x.id === id);
  if (!m || !m.ready) return false;
  const bg = moduleDef(c, id).background;
  return (bg === "light" && c.state.phase === "command") || (bg === "red" && c.state.phase === "overload");
}
