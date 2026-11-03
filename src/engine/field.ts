/**
 * Read-only questions about the Field: what is in a sector, which tiles are
 * units, Level and Strength. Core Rules 3.1-3.4, 4.6, 4.8.
 */

import type { GameData } from "../data/index.js";
import type { UnitDef, UnitType } from "../data/units.js";
import { FieldMap } from "../geometry/fieldMap.js";
import { type Coord, fromKey, key } from "../geometry/hex.js";
import type { GameState, SectorKey, TileId, TileState } from "./state.js";

/** Everything an effect reads or changes. `state` is the working copy for this step. */
export interface Ctx {
  state: GameState;
  data: GameData;
}

export type SectorState = "dark" | "occupied" | "cleared";

const mapCache = new WeakMap<Coord[], FieldMap>();

/** The Field's shape. */
export function fieldMap(s: GameState): FieldMap {
  let m = mapCache.get(s.map);
  if (!m) {
    m = new FieldMap(s.map);
    mapCache.set(s.map, m);
  }
  return m;
}

export function stack(s: GameState, k: SectorKey): TileId[] {
  const st = s.field[k];
  if (!st) throw new Error(`no sector ${k}`);
  return st;
}

export function topTileId(s: GameState, k: SectorKey): TileId | undefined {
  const st = stack(s, k);
  return st[st.length - 1];
}

export function tile(s: GameState, id: TileId): TileState {
  const t = s.tiles[id];
  if (!t) throw new Error(`no tile ${id}`);
  return t;
}

/** Dark, Occupied or Cleared (3.1). */
export function sectorState(s: GameState, k: SectorKey): SectorState {
  const top = topTileId(s, k);
  if (top === undefined) return "cleared";
  return tile(s, top).faceUp ? "occupied" : "dark";
}

export function sectorKeys(s: GameState): SectorKey[] {
  return s.map.map(key);
}

export function darkSectors(s: GameState): SectorKey[] {
  return sectorKeys(s).filter((k) => sectorState(s, k) === "dark");
}

/** The unit in a sector: its face-up top tile (3.2). */
export function unitAt(s: GameState, k: SectorKey): TileId | undefined {
  return sectorState(s, k) === "occupied" ? topTileId(s, k) : undefined;
}

/** Every unit on the Field, in map order. */
export function units(s: GameState): TileId[] {
  const out: TileId[] = [];
  for (const k of sectorKeys(s)) {
    const u = unitAt(s, k);
    if (u !== undefined) out.push(u);
  }
  return out;
}

/** The sector a tile is in, or undefined if it is not on the Field. */
export function sectorOf(s: GameState, id: TileId): SectorKey | undefined {
  for (const k of sectorKeys(s)) if (stack(s, k).includes(id)) return k;
  return undefined;
}

export function sectorCoord(k: SectorKey): Coord {
  return fromKey(k);
}

/** Is this tile a unit right now (face up on top of its sector)? */
export function isUnit(s: GameState, id: TileId): boolean {
  const k = sectorOf(s, id);
  return k !== undefined && unitAt(s, k) === id;
}

export function unitDef(c: Ctx, id: TileId): UnitDef {
  const t = tile(c.state, id);
  if (t.unitId === null) throw new Error(`tile ${id} has no known contents`);
  const d = c.data.units.byId.get(t.unitId);
  if (!d) throw new Error(`unit ${t.unitId} is not in the unit file`);
  return d;
}

export function unitType(c: Ctx, id: TileId): UnitType {
  return unitDef(c, id).type;
}

export function isFlare(c: Ctx, id: TileId): boolean {
  return unitType(c, id) === "Flare";
}

export function isWreck(c: Ctx, id: TileId): boolean {
  return tile(c.state, id).tokens.wreck;
}

/**
 * Level (3.3): printed shields; for Omega units the Campaign board value.
 * Flares have no Level (undefined).
 */
export function level(c: Ctx, id: TileId): number | undefined {
  const d = unitDef(c, id);
  if (d.level === "none") return undefined;
  if (d.level === "per_campaign") {
    const camp = c.data.campaigns.find((x) => x.prefix === c.state.campaign);
    const o = camp?.omega.find((x) => x.id === d.id);
    if (!o) throw new Error(`no Campaign board Level for ${d.id} in ${c.state.campaign}`);
    return o.level;
  }
  return d.level;
}

/**
 * Strength = Level + Shields + Bio-shields - Damage (3.3).
 * Flares and Wrecks have no Strength (undefined).
 */
export function strength(c: Ctx, id: TileId): number | undefined {
  if (isWreck(c, id)) return undefined;
  const l = level(c, id);
  if (l === undefined) return undefined;
  const t = tile(c.state, id).tokens;
  return l + t.shield + t.bioShield - t.damage;
}

/** Can an effect choose this unit? Never a Flare or a Wreck (4.6, 4.8). */
export function canBeChosen(c: Ctx, id: TileId): boolean {
  return isUnit(c.state, id) && !isFlare(c, id) && !isWreck(c, id);
}

/** Units an effect may choose, optionally filtered. */
export function choosableUnits(c: Ctx, filter: (id: TileId) => boolean = () => true): TileId[] {
  return units(c.state).filter((u) => canBeChosen(c, u) && filter(u));
}

/** Adjacent units of a sector (3.5). */
export function adjacentUnits(s: GameState, k: SectorKey): TileId[] {
  const out: TileId[] = [];
  for (const n of fieldMap(s).adjacent(fromKey(k))) {
    const u = unitAt(s, key(n));
    if (u !== undefined) out.push(u);
  }
  return out;
}

/** Destroyed effect text, from the unit file or (Omega) the Campaign board. */
export function destroyedEffect(c: Ctx, id: TileId): string | undefined {
  const d = unitDef(c, id);
  if (d.text.destroyed !== undefined) return d.text.destroyed;
  if (d.type === "Omega") {
    const camp = c.data.campaigns.find((x) => x.prefix === c.state.campaign);
    return camp?.omega.find((o) => o.id === d.id)?.destroyed;
  }
  return undefined;
}

/** Short name for the log: "B_02 in (0,1)". */
export function describe(c: Ctx, id: TileId): string {
  const t = tile(c.state, id);
  const k = sectorOf(c.state, id);
  const name = t.unitId ?? "a face-down tile";
  return k === undefined ? name : `${name} in (${k})`;
}
