/**
 * Typed reader for data/unit_list_structured.txt (the unit database).
 * Numbers and text come from the file; nothing about a card is written here.
 */

import { type Side, isSide } from "../geometry/hex.js";
import { type Fields, type RawFile, parseRecordFile, splitList, withDefaults } from "./records.js";

export const UNIT_TYPES = ["Bot", "Mecha", "Omega", "Sentinel", "Flare", "Sleeper", "Gyro"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export const ENERGY_COLOURS = ["Yellow", "Red", "Blue"] as const;
export type EnergyColour = (typeof ENERGY_COLOURS)[number];
export type EnergyAmounts = Record<EnergyColour, number>;

export type MechaAbilityKind = "command" | "expend" | "passive";

/** Level: a printed number, "none" (Flares), or "per_campaign" (Omega units; Campaign board value). */
export type UnitLevel = number | "none" | "per_campaign";

export interface UnitDef {
  id: string;
  type: UnitType;
  level: UnitLevel;
  copies: number;
  /** Printed arrow sides, facing 0. Empty if none. */
  arrows: Side[];
  /** Flares: energy placed on ready Modules when revealed. */
  energyOnReveal?: EnergyAmounts;
  /** Mecha only. */
  abilityKind?: MechaAbilityKind;
  /** Developer-only balance number; never shown to players. */
  devPrice?: number | "per_campaign";
  /** Effect texts, verbatim. Behaviour is implemented by hand per card (spec "Effects"). */
  text: {
    activate?: string;
    ability?: string;
    drain?: string;
    destroyed?: string;
  };
  /** Gyros: member of the Energy deck (G_01..G_09). */
  energyGyro?: boolean;
  /** Omega: Alpha / Beta / Gamma unit. */
  role?: string;
  /** Every field after defaults, verbatim, for anything not typed above. */
  fields: Fields;
}

export interface UnitDatabase {
  units: UnitDef[];
  byId: ReadonlyMap<string, UnitDef>;
  /** Default copies stated in GLOBAL FACTS. */
  defaultCopies: number;
  /** Placeholder id for "top tile of the Energy deck". Not a unit. */
  energyDeckPlaceholder: string;
}

const SECTION_TYPE: Record<string, UnitType> = {
  BOT: "Bot",
  MECHA: "Mecha",
  OMEGA: "Omega",
  SENTINEL: "Sentinel",
  FLARE: "Flare",
  SLEEPER: "Sleeper",
  GYRO: "Gyro",
};

/** "1 Yellow, 1 Red, 1 Blue (split ...)" -> amounts. */
export function parseEnergy(text: string, where: string): EnergyAmounts {
  const out: EnergyAmounts = { Yellow: 0, Red: 0, Blue: 0 };
  const body = text.replace(/\(.*\)/, "");
  for (const part of splitList(body)) {
    const m = /^(\d+) (Yellow|Red|Blue)$/.exec(part);
    if (!m) throw new Error(`${where}: cannot read energy "${part}"`);
    out[m[2] as EnergyColour] += Number(m[1]);
  }
  return out;
}

function firstWord(v: string): string {
  return v.split(/\s/)[0] ?? "";
}

function parseLevel(v: string, where: string): UnitLevel {
  const w = firstWord(v);
  if (w === "none" || w === "per_campaign") return w;
  const n = Number(w);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${where}: bad level "${v}"`);
  return n;
}

function parseInteger(v: string, where: string): number {
  const n = Number(firstWord(v));
  if (!Number.isInteger(n) || n < 0) throw new Error(`${where}: expected a whole number, got "${v}"`);
  return n;
}

function parseGlobalDefaultCopies(file: RawFile): number {
  const m = /default_copies:\s*(\d+)/.exec(file.preamble);
  if (!m) throw new Error("unit file: GLOBAL FACTS default_copies not found");
  return Number(m[1]);
}

export function parseUnits(text: string, fileName = "unit_list_structured.txt"): UnitDatabase {
  const file = parseRecordFile(text, fileName);
  if (!file.hasEndMarker) throw new Error(`${fileName}: missing END OF FILE marker`);
  const defaultCopies = parseGlobalDefaultCopies(file);
  const units: UnitDef[] = [];

  for (const section of file.sections) {
    const type = SECTION_TYPE[section.name];
    if (!type) throw new Error(`${fileName}: unknown section "${section.name}"`);
    for (const rec of section.records) {
      const f = withDefaults(file, rec);
      const where = `${fileName}:${rec.line} ${rec.id}`;
      if (f.type !== undefined && f.type !== type) throw new Error(`${where}: type "${f.type}" in section ${section.name}`);
      if (f.level === undefined) throw new Error(`${where}: no level`);

      const arrows: Side[] = [];
      if (f.arrows !== undefined) {
        for (const a of splitList(f.arrows)) {
          const n = Number(a);
          if (!isSide(n)) throw new Error(`${where}: bad arrow side "${a}"`);
          if (arrows.includes(n)) throw new Error(`${where}: arrow side ${n} repeats`);
          arrows.push(n);
        }
      }

      const u: UnitDef = {
        id: rec.id,
        type,
        level: parseLevel(f.level, where),
        copies: f.copies !== undefined ? parseInteger(f.copies, where) : defaultCopies,
        arrows,
        text: {},
        fields: f,
      };
      if (f.energy_on_reveal !== undefined) u.energyOnReveal = parseEnergy(f.energy_on_reveal, where);
      if (f.ability_kind !== undefined) {
        const k = f.ability_kind;
        if (k !== "command" && k !== "expend" && k !== "passive") throw new Error(`${where}: bad ability_kind "${k}"`);
        u.abilityKind = k;
      }
      if (f.dev_price !== undefined) {
        const w = firstWord(f.dev_price);
        const n = Number(w);
        if (w === "per_campaign") u.devPrice = w;
        else if (Number.isFinite(n)) u.devPrice = n;
        else throw new Error(`${where}: bad dev_price "${f.dev_price}"`);
      }
      // Effect texts belong to the record itself, not to section defaults
      // (section "activate" is a description of when it resolves, not an effect).
      for (const k of ["activate", "ability", "drain", "destroyed"] as const) {
        const v = rec.fields[k];
        if (v !== undefined) u.text[k] = v;
      }
      if (f.energy_gyro !== undefined) u.energyGyro = f.energy_gyro === "true";
      if (f.role !== undefined) u.role = f.role;
      units.push(u);
    }
  }

  const byId = new Map<string, UnitDef>();
  for (const u of units) {
    if (byId.has(u.id)) throw new Error(`${fileName}: unit ${u.id} listed twice`);
    byId.set(u.id, u);
  }
  return { units, byId, defaultCopies, energyDeckPlaceholder: "G_00" };
}
