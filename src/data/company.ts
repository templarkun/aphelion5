/**
 * Typed reader for data/company_vessels_structured.txt.
 *
 * Layout (file FORMAT SPEC): "=== COMPANY: <id> ===" blocks, each split into
 * "--- PART: <name> ---" parts. A part holds plain "key: value" fields,
 * "id:" records separated by blank lines, or both (FLAGSHIP), or "none".
 */

import { type Fields, DataFormatError, splitList } from "./records.js";

export interface BayDef {
  id: string;
  /** 1-based Bay number, from the id ("V1_BAY2" -> 2). */
  number: number;
  integrity: number;
  ability: string;
}

export type UpgradeKind = "permanent_ability" | "requisition";

export interface UpgradeDef {
  id: string;
  kind: UpgradeKind;
  /** Mecha unit ids, "all_mecha" or "flagship_bay_N". Requisitions have none. */
  appliesTo: string[];
  /** Slots to mark to fill it (Core Rules 10.2). */
  cost: number;
  state: "available" | "locked";
  unlocks: string[];
  unlockMode?: "all" | "choose_one";
  unlockedBy?: string;
  exclusiveWith: string[];
  repeatable: boolean;
  effect: string;
  note?: string;
  /** Which part it came from. */
  part: "FLAGSHIP_UPGRADES" | "MECHA_UPGRADES" | "REQUISITIONS";
  fields: Fields;
}

export interface CompanyDef {
  id: string;
  name: string;
  /** undefined when the file says "none". */
  trait?: string;
  startingEnergy: { Yellow: number; Red: number; Blue: number };
  startingEnergyDestination: string;
  overhaulSlots: number;
  startingMecha: { id: string; count: number }[];
  bayCount: number;
  totalIntegrity: number;
  bays: BayDef[];
  upgrades: UpgradeDef[];
}

export interface CompanyDatabase {
  companies: CompanyDef[];
  byId: ReadonlyMap<string, CompanyDef>;
}

interface Part {
  name: string;
  fields: Fields;
  records: { id: string; fields: Fields; line: number }[];
  notes: string[];
  none: boolean;
  line: number;
}

const COMPANY_RE = /^=== COMPANY: (\S+) ===\s*$/;
const PART_RE = /^--- PART: (\S+) ---\s*$/;
const END_RE = /^=== END OF FILE ===\s*$/;
const KV_RE = /^([a-z][a-zA-Z0-9_]*):\s?(.*)$/;

function splitCompanies(text: string, file: string): { id: string; parts: Part[]; line: number }[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: { id: string; parts: Part[]; line: number }[] = [];
  let company: { id: string; parts: Part[]; line: number } | undefined;
  let part: Part | undefined;
  let block: { fields: Fields; line: number; lastKey?: string } | undefined;
  let ended = false;

  const closeBlock = () => {
    if (block && part) {
      if ("id" in block.fields) {
        part.records.push({ id: block.fields.id!, fields: block.fields, line: block.line });
      } else {
        for (const [k, v] of Object.entries(block.fields)) {
          if (k in part.fields) throw new DataFormatError(file, block.line, `field "${k}" repeats in part ${part.name}`);
          part.fields[k] = v;
        }
      }
    }
    block = undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    const line = (lines[i] ?? "").replace(/\s+$/, "");
    if (END_RE.test(line)) {
      closeBlock();
      ended = true;
      break;
    }
    const cm = COMPANY_RE.exec(line);
    if (cm) {
      closeBlock();
      part = undefined;
      company = { id: cm[1]!, parts: [], line: n };
      out.push(company);
      continue;
    }
    if (!company) continue; // preamble
    const pm = PART_RE.exec(line);
    if (pm) {
      closeBlock();
      part = { name: pm[1]!, fields: {}, records: [], notes: [], none: false, line: n };
      company.parts.push(part);
      continue;
    }
    if (line.startsWith("#")) {
      closeBlock();
      continue;
    }
    if (line === "") {
      closeBlock();
      continue;
    }
    if (!part) throw new DataFormatError(file, n, `line outside any PART: ${line}`);
    if (line === "none" && !block) {
      part.none = true;
      continue;
    }
    if (/^\(.*\)$/.test(line) && !block) {
      part.notes.push(line);
      continue;
    }
    if (/^\s/.test(line)) {
      if (!block?.lastKey) throw new DataFormatError(file, n, "continuation line with no key");
      block.fields[block.lastKey] += " " + line.trim();
      continue;
    }
    const kv = KV_RE.exec(line);
    if (!kv) throw new DataFormatError(file, n, `unexpected line: ${line}`);
    const k = kv[1]!;
    if (k === "id" && block && "id" in block.fields) throw new DataFormatError(file, n, "two records with no blank line between");
    if (k === "id" && block) closeBlock(); // fields block followed directly by a record
    block ??= { fields: {}, line: n };
    if (k in block.fields) throw new DataFormatError(file, n, `key "${k}" repeats`);
    block.fields[k] = kv[2]!.trim();
    block.lastKey = k;
  }
  closeBlock();
  if (!ended) throw new Error(`${file}: missing END OF FILE marker`);
  return out;
}

function int(v: string | undefined, where: string): number {
  const n = Number(v);
  if (v === undefined || !Number.isInteger(n) || n < 0) throw new Error(`${where}: expected a whole number, got "${v}"`);
  return n;
}

function req(f: Fields, k: string, where: string): string {
  const v = f[k];
  if (v === undefined) throw new Error(`${where}: "${k}" missing`);
  return v;
}

const UPGRADE_PARTS = ["FLAGSHIP_UPGRADES", "MECHA_UPGRADES", "REQUISITIONS"] as const;
const KNOWN_PARTS = ["IDENTITY", "TRAIT", "STARTING_RESOURCES", "STARTING_MECHA", "FLAGSHIP", ...UPGRADE_PARTS];

export function parseCompanies(text: string, fileName = "company_vessels_structured.txt"): CompanyDatabase {
  const companies: CompanyDef[] = [];
  for (const raw of splitCompanies(text, fileName)) {
    const where = `${fileName} ${raw.id}`;
    const parts = new Map<string, Part>();
    for (const p of raw.parts) {
      if (!KNOWN_PARTS.includes(p.name)) throw new Error(`${where}: unknown part ${p.name}`);
      if (parts.has(p.name)) throw new Error(`${where}: part ${p.name} repeats`);
      parts.set(p.name, p);
    }
    const part = (name: string): Part => {
      const p = parts.get(name);
      if (!p) throw new Error(`${where}: part ${name} missing`);
      return p;
    };

    const identity = part("IDENTITY").fields;
    if (identity.company_id !== raw.id) throw new Error(`${where}: company_id "${identity.company_id}" does not match the header`);
    const traitText = req(part("TRAIT").fields, "trait", `${where} TRAIT`);
    const res = part("STARTING_RESOURCES").fields;
    const ship = part("FLAGSHIP");

    const bays: BayDef[] = ship.records.map((r) => {
      const m = new RegExp(`^${raw.id}_BAY(\\d+)$`).exec(r.id);
      if (!m) throw new Error(`${where}: Bay id "${r.id}" should look like ${raw.id}_BAY1`);
      return {
        id: r.id,
        number: Number(m[1]),
        integrity: int(r.fields.integrity, `${where} ${r.id} integrity`),
        ability: req(r.fields, "ability", `${where} ${r.id}`),
      };
    });

    const upgrades: UpgradeDef[] = [];
    for (const pn of UPGRADE_PARTS) {
      const p = part(pn);
      if (p.none && p.records.length > 0) throw new Error(`${where}: part ${pn} says none but has records`);
      for (const r of p.records) {
        const w = `${where} ${r.id}`;
        const f = r.fields;
        const kind = req(f, "kind", w);
        if (kind !== "permanent_ability" && kind !== "requisition") throw new Error(`${w}: bad kind "${kind}"`);
        const state = req(f, "state", w);
        if (state !== "available" && state !== "locked") throw new Error(`${w}: bad state "${state}"`);
        const u: UpgradeDef = {
          id: r.id,
          kind,
          appliesTo: f.applies_to !== undefined ? splitList(f.applies_to) : [],
          cost: int(f.cost, `${w} cost`),
          state,
          unlocks: f.unlocks !== undefined ? splitList(f.unlocks) : [],
          exclusiveWith: f.exclusive_with !== undefined ? splitList(f.exclusive_with) : [],
          repeatable: f.repeatable === "yes",
          effect: req(f, "effect", w),
          part: pn,
          fields: f,
        };
        if (f.repeatable !== undefined && f.repeatable !== "yes" && f.repeatable !== "no") throw new Error(`${w}: repeatable must be yes or no`);
        if (f.unlock_mode !== undefined) {
          if (f.unlock_mode !== "all" && f.unlock_mode !== "choose_one") throw new Error(`${w}: bad unlock_mode "${f.unlock_mode}"`);
          u.unlockMode = f.unlock_mode;
        }
        if (f.unlocked_by !== undefined) u.unlockedBy = f.unlocked_by;
        if (f.note !== undefined) u.note = f.note;
        upgrades.push(u);
      }
    }

    const c: CompanyDef = {
      id: raw.id,
      name: req(identity, "name", `${where} IDENTITY`),
      startingEnergy: {
        Yellow: int(res.starting_energy_yellow, `${where} starting_energy_yellow`),
        Red: int(res.starting_energy_red, `${where} starting_energy_red`),
        Blue: int(res.starting_energy_blue, `${where} starting_energy_blue`),
      },
      startingEnergyDestination: req(res, "starting_energy_destination", where),
      overhaulSlots: int(res.overhaul_slots, `${where} overhaul_slots`),
      startingMecha: part("STARTING_MECHA").records.map((r) => ({ id: r.id, count: int(r.fields.count, `${where} ${r.id} count`) })),
      bayCount: int(ship.fields.bay_count, `${where} bay_count`),
      totalIntegrity: int(ship.fields.total_integrity, `${where} total_integrity`),
      bays,
      upgrades,
    };
    if (traitText !== "none") c.trait = traitText;
    companies.push(c);
  }

  const byId = new Map<string, CompanyDef>();
  for (const c of companies) {
    if (byId.has(c.id)) throw new Error(`${fileName}: Company ${c.id} listed twice`);
    byId.set(c.id, c);
  }
  return { companies, byId };
}
