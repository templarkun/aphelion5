/** Typed reader for a Campaign file (data/Campaign1.txt). */

import type { Coord } from "../geometry/hex.js";
import { FieldMap } from "../geometry/fieldMap.js";
import { type Fields, parseRecordFile, splitList } from "./records.js";

export interface TileCount {
  id: string;
  count: number;
}

export interface OmegaDef {
  id: string;
  role: string;
  /** Campaign board value; counts as the unit's Level for every effect (Core Rules 3.2). */
  level: number;
  destroyed?: string;
  atOverload?: string;
  fields: Fields;
}

export interface OrderDef {
  id: string;
  tokens: number;
  overloadOnly: boolean;
  effect: string;
}

export type ThreatColumn = "A" | "B" | "C" | "D";
export const THREAT_COLUMNS: readonly ThreatColumn[] = ["A", "B", "C", "D"];

export type Objective =
  | { type: "salvage" }
  | { type: "eliminate"; target: string; count: number };

export type MissionEvent =
  | { type: "allied_drop"; level: number }
  | { type: "gain_energy"; amount: number }
  | { type: "take_module_top" }
  | { type: "none" };

export interface MissionDef {
  id: string;
  number: number;
  /** "single", or the letter of an alternative route ("x", "y"). */
  route: string;
  /** The other mission of an alternative pair, if any. */
  alternativeTo?: string;
  deploymentShuffled: TileCount[];
  omegaPlaced: string[];
  omegaSectors: Coord[];
  threat: Record<ThreatColumn, string[]>;
  objective: Objective;
  event: MissionEvent;
  mapSectorCount: number;
  /** Sectors in file order. */
  map: Coord[];
  /** Mission Order, or undefined for "none". */
  order?: OrderDef;
  fields: Fields;
}

export interface CampaignDatabase {
  /** "C1" for Campaign1.txt. */
  prefix: string;
  omega: OmegaDef[];
  orders: OrderDef[];
  missions: MissionDef[];
  missionById: ReadonlyMap<string, MissionDef>;
}

/** "O_01 x8, F_01 x3, G_00 x6" -> tile counts. */
export function parseTileCounts(text: string, where: string): TileCount[] {
  return splitList(text).map((part) => {
    const m = /^([A-Z]_\d+) x(\d+)$/.exec(part);
    if (!m) throw new Error(`${where}: cannot read tile count "${part}"`);
    return { id: m[1]!, count: Number(m[2]) };
  });
}

/** "S_12, S_12, F_08" -> ids, one per tile. */
export function parseTileList(text: string, where: string): string[] {
  return splitList(text).map((part) => {
    if (!/^[A-Z]_\d+$/.test(part)) throw new Error(`${where}: cannot read tile id "${part}"`);
    return part;
  });
}

/** "(0, 0), (1, -1)" -> coordinates in order. */
export function parseCoordList(text: string, where: string): Coord[] {
  const out: Coord[] = [];
  const rest = text.replace(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g, (_m, q: string, r: string) => {
    out.push({ q: Number(q), r: Number(r) });
    return "";
  });
  if (rest.replace(/[\s,]/g, "") !== "") throw new Error(`${where}: cannot read coordinates "${text}"`);
  return out;
}

/** "4 Command tokens: Deal 1 damage to all units." / "[Overload] 1 Command token: Swap two units." */
export function parseMissionOrder(id: string, text: string, where: string): OrderDef | undefined {
  if (text === "none") return undefined;
  const m = /^(\[Overload\] )?(\d+) Command tokens?: (.+)$/.exec(text);
  if (!m) throw new Error(`${where}: cannot read order "${text}"`);
  return { id, tokens: Number(m[2]), overloadOnly: m[1] !== undefined, effect: m[3]! };
}

function int(v: string | undefined, where: string, key: string): number {
  const n = Number(v);
  if (v === undefined || !Number.isInteger(n)) throw new Error(`${where}: "${key}" missing or not a whole number`);
  return n;
}

function req(f: Fields, key: string, where: string): string {
  const v = f[key];
  if (v === undefined) throw new Error(`${where}: "${key}" missing`);
  return v;
}

export function parseCampaign(text: string, fileName = "Campaign1.txt"): CampaignDatabase {
  const file = parseRecordFile(text, fileName);
  if (!file.hasEndMarker) throw new Error(`${fileName}: missing END OF FILE marker`);
  const omega: OmegaDef[] = [];
  const orders: OrderDef[] = [];
  const missions: MissionDef[] = [];
  let prefix: string | undefined;

  for (const section of file.sections) {
    for (const rec of section.records) {
      const f = { ...section.defaults, ...rec.fields };
      const where = `${fileName}:${rec.line} ${rec.id}`;
      switch (section.name) {
        case "OMEGA": {
          const o: OmegaDef = { id: rec.id, role: req(f, "role", where), level: int(f.level, where, "level"), fields: f };
          if (f.destroyed !== undefined) o.destroyed = f.destroyed;
          if (f.at_overload !== undefined) o.atOverload = f.at_overload;
          omega.push(o);
          break;
        }
        case "CAMPAIGN ORDERS": {
          const ov = req(f, "overload_only", where);
          if (ov !== "yes" && ov !== "no") throw new Error(`${where}: overload_only must be yes or no`);
          orders.push({ id: rec.id, tokens: int(f.tokens, where, "tokens"), overloadOnly: ov === "yes", effect: req(f, "effect", where) });
          break;
        }
        case "MISSIONS": {
          const pm = /^(C\d+)_M/.exec(rec.id);
          if (!pm) throw new Error(`${where}: mission id must look like C1_M1`);
          prefix ??= pm[1]!;
          missions.push(parseMission(rec.id, f, where));
          break;
        }
        default:
          throw new Error(`${fileName}: unknown section "${section.name}"`);
      }
    }
  }
  if (!prefix) throw new Error(`${fileName}: no missions`);
  const missionById = new Map<string, MissionDef>();
  for (const m of missions) {
    if (missionById.has(m.id)) throw new Error(`${fileName}: mission ${m.id} listed twice`);
    missionById.set(m.id, m);
  }
  return { prefix, omega, orders, missions, missionById };
}

function parseMission(id: string, f: Fields, where: string): MissionDef {
  const routeText = req(f, "route", where);
  const rm = /^(single|[a-z])(?: \(alternative to (\S+)\))?$/.exec(routeText);
  if (!rm) throw new Error(`${where}: cannot read route "${routeText}"`);

  const threat = {} as Record<ThreatColumn, string[]>;
  for (const c of THREAT_COLUMNS) threat[c] = parseTileList(req(f, `threat_${c}`, where), `${where} threat_${c}`);

  const ot = req(f, "objective_type", where);
  let objective: Objective;
  if (ot === "salvage") objective = { type: "salvage" };
  else if (ot === "eliminate")
    objective = { type: "eliminate", target: req(f, "objective_target", where), count: int(f.objective_count, where, "objective_count") };
  else throw new Error(`${where}: unknown objective_type "${ot}"`);

  const et = req(f, "event_type", where);
  let event: MissionEvent;
  if (et === "allied_drop") event = { type: "allied_drop", level: int(f.event_level, where, "event_level") };
  else if (et === "gain_energy") event = { type: "gain_energy", amount: int(f.event_amount, where, "event_amount") };
  else if (et === "take_module_top" || et === "none") event = { type: et };
  else throw new Error(`${where}: unknown event_type "${et}"`);

  const m: MissionDef = {
    id,
    number: int(f.number, where, "number"),
    route: rm[1]!,
    deploymentShuffled: parseTileCounts(req(f, "deployment_shuffled", where), `${where} deployment_shuffled`),
    omegaPlaced: f.omega_placed !== undefined ? parseTileList(f.omega_placed, `${where} omega_placed`) : [],
    omegaSectors: f.omega_sectors !== undefined ? parseCoordList(f.omega_sectors, `${where} omega_sectors`) : [],
    threat,
    objective,
    event,
    mapSectorCount: int(f.map_sector_count, where, "map_sector_count"),
    map: parseCoordList(req(f, "map", where), `${where} map`),
    fields: f,
  };
  if (rm[2] !== undefined) m.alternativeTo = rm[2];
  const order = parseMissionOrder(`${id}_ORDER`, req(f, "orders", where), where);
  if (order) m.order = order;
  return m;
}

/** The Field shape of a mission (throws if the map lists a sector twice). */
export function missionMap(m: MissionDef): FieldMap {
  return new FieldMap(m.map);
}

/** Test files name maps "M1", "M2X", ...; that is mission C1_M1, C1_M2X, ... */
export function missionForMapName(c: CampaignDatabase, name: string): MissionDef {
  const m = c.missionById.get(`${c.prefix}_${name}`);
  if (!m) throw new Error(`no mission for map "${name}"`);
  return m;
}
