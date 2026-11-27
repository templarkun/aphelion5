/**
 * The Campaign editor's draft (designer 2026-11-18, Developer tools; `docs/campaign-editor.md`).
 * A draft is everything a Campaign file holds (data/Campaign1.txt's format), plus the effects
 * made from blocks. It is written out as a Campaign file for the Project (component data stays the
 * master) and as an editor file to go on with later. No rule is made here.
 *
 * Designer's answers: C1 copies are limited (a mission, its deck and all four Threat columns,
 * never uses more copies of a unit than exist); C2 every Campaign has exactly the three Omega units
 * O_01-O_03; C3 effects are made from blocks or written as text (text needs programming); C4 mission
 * events: gain energy (colour and amount), take Modules, take an Anomaly, Allied Drop, remove damage
 * from the Flagship; C5 no Campaign look. dev_price shown per unit and summed per mission roster,
 * per Threat column and for the whole Campaign (Threat columns not in it).
 */

import type { CampaignDatabase, MissionDef } from "../../../data/campaign.js";
import { THREAT_COLUMNS, type ThreatColumn } from "../../../data/campaign.js";
import type { GameData } from "../../../data/index.js";
import type { UnitDef } from "../../../data/units.js";
import type { Coord } from "../../../geometry/hex.js";
import { energyEventText } from "../missionText.js";
import { KINDS, TOKENS, type BlockEffect, type Condition, type Count, type Kind, type Step, type Target, type Token, type Verb, type When, type Where } from "../../../data/blocks.js";

export { KINDS, TOKENS };
export type { BlockEffect, Condition, Count, Kind, Step, Target, Token, Verb, When, Where };

export type { Colour } from "../../../data/blocks.js";
import type { Colour } from "../../../data/blocks.js";
export const COLOURS: readonly Colour[] = ["Yellow", "Red", "Blue"];
export const OMEGA_IDS = ["O_01", "O_02", "O_03"] as const;
export const OMEGA_ROLES: Record<string, string> = { O_01: "Alpha unit", O_02: "Beta unit", O_03: "Gamma unit" };
/** "A tile from the top of the Energy deck" (unit list GLOBAL FACTS). */
export const G00 = "G_00";

// ---------------------------------------------------------------------------
// Effects: blocks (C3, way 2) or text (way 3, needs programming).

export const VERBS: { id: Verb; label: string; target: boolean; n: boolean }[] = [
  { id: "damage", label: "Deal damage to", target: true, n: true },
  { id: "destroy", label: "Destroy", target: true, n: false },
  { id: "boost", label: "Boost", target: true, n: false },
  { id: "place", label: "Place a token on", target: true, n: false },
  { id: "swap", label: "Swap with another unit", target: true, n: false },
  { id: "teleport", label: "Teleport to a Dark sector", target: true, n: false },
  { id: "flagshipDamage", label: "Deal damage to your Flagship", target: false, n: true },
  { id: "flagshipRepair", label: "Remove damage from your Flagship", target: false, n: true },
  { id: "gainEnergy", label: "Gain energy", target: false, n: true },
  { id: "loseEnergy", label: "Lose energy", target: false, n: true },
  { id: "gainCommand", label: "Gain Command tokens", target: false, n: true },
  { id: "loseCommand", label: "Lose Command tokens", target: false, n: true },
];

export type EffectDraft = ({ mode: "blocks" } & BlockEffect) | { mode: "text"; text: string };

/** Where an effect is written: on an Omega unit (it has "this unit") or an Order (it does not). */
export type EffectPlace = "omega" | "order";

const NUM = ["zero", "one", "two", "three", "four", "five", "six"];
const plural = (k: Kind) => (k === "Mecha" ? "Mecha" : `${k}s`);
const a = (word: string) => (/^[AEIOU]/i.test(word) ? `an ${word}` : `a ${word}`);

export function newTarget(): Target {
  return { count: "one", kind: "unit", other: false, level: 0, state: "", where: "" };
}
export function newStep(verb: Verb = "damage"): Step {
  return { verb, n: 1, target: newTarget(), token: "Shield", colour: "" };
}

/** The units a step chooses, in the card text's words. */
export function targetText(t: Target, every = false): string {
  if (t.count === "this") return "this unit";
  const many = t.count !== "one" && !(every && t.count === "all");
  const words = [
    t.count === "one" ? "one" : t.count === "all" ? (every ? "every" : "all") : `${NUM[t.count]} different`,
    t.other ? "other" : "",
    t.where === "adjacent" ? "adjacent" : "",
    t.state,
    t.level ? `Level ${t.level}` : "",
    many ? plural(t.kind) : t.kind,
  ].filter(Boolean);
  const row = t.where === "rowThrough" ? " in a row through this unit" : t.where === "rowChoice" ? " in one horizontal row of your choice" : "";
  return words.join(" ") + row;
}

export function stepText(s: Step): string {
  const n = Math.max(1, s.n);
  const t = targetText(s.target);
  switch (s.verb) {
    case "damage":
      return `Deal ${n} damage to ${t}.`;
    case "destroy":
      return `Destroy ${t}.`;
    case "boost":
      return `Boost ${t}.`;
    case "place":
      return `Place ${a(s.token ?? "Shield")} on ${targetText(s.target, true)}.`;
    case "swap":
      return `Swap ${t} with another unit.`;
    case "teleport":
      return `Teleport ${t} to a Dark sector.`;
    case "flagshipDamage":
      return `Deal ${n} damage to your Flagship.`;
    case "flagshipRepair":
      return `Remove ${n} damage from your Flagship.`;
    case "gainEnergy":
      return `Gain ${n} ${s.colour ? `${s.colour} ` : ""}energy.`;
    case "loseEnergy":
      return `Lose ${n} ${s.colour ? `${s.colour} ` : ""}energy.`;
    case "gainCommand":
      return `Gain ${n} Command token${n === 1 ? "" : "s"}.`;
    case "loseCommand":
      return `Lose ${n} Command token${n === 1 ? "" : "s"}.`;
  }
}

/** The effect in card words: one step plain, several numbered "[1] ... [2] ..." (Campaign file format 4). */
export function effectText(e: EffectDraft): string {
  if (e.mode === "text") return e.text.trim();
  const steps = e.steps.map(stepText);
  let body = steps.length === 1 ? steps[0]! : steps.map((x, i) => `[${i + 1}] ${x}`).join(" ");
  if (e.when?.adjacentTo && body) body = `If adjacent to ${a(e.when.adjacentTo)}, ${body.charAt(0).toLowerCase()}${body.slice(1)}`;
  return body;
}

export const isEmpty = (e: EffectDraft | undefined) => !e || effectText(e) === "";

// ---------------------------------------------------------------------------
// The draft.

export interface OmegaDraft {
  id: (typeof OMEGA_IDS)[number];
  level: number;
  /** Developer-only balance number (unit list: per_campaign); undefined = not set. */
  devPrice?: number | undefined;
  destroyed?: EffectDraft | undefined;
  atOverload?: EffectDraft | undefined;
}

export interface OrderDraft {
  tokens: number;
  overloadOnly: boolean;
  effect: EffectDraft;
}

export type EventDraft =
  | { type: "none" }
  | { type: "allied_drop"; level: number }
  | { type: "gain_energy"; any: number; energy: Record<Colour, number> }
  | { type: "take_modules"; amount: number }
  | { type: "take_anomaly"; amount: number }
  | { type: "remove_damage"; amount: number };
export const EVENT_KINDS: { id: EventDraft["type"]; label: string }[] = [
  { id: "none", label: "None" },
  { id: "gain_energy", label: "Gain energy" },
  { id: "take_modules", label: "Take Modules" },
  { id: "take_anomaly", label: "Take an Anomaly card" },
  { id: "allied_drop", label: "Call for an Ally (Allied Drop)" },
  { id: "remove_damage", label: "Remove damage from your Flagship" },
];

export interface MissionDraft {
  number: number;
  /** "single", or an alternative route "x" / "y" (7.2 step 1). */
  route: "single" | "x" | "y";
  /** The shuffled deployment: unit id (or G_00) -> copies. */
  deck: Record<string, number>;
  /**
   * Omega units placed face up (7.2 step 2), as the Campaign file has them (its format, item 7):
   * one tile of each listed type on each listed sector.
   */
  omegaPlaced: string[];
  omegaSectors: Coord[];
  threat: Record<ThreatColumn, string[]>;
  objective: { type: "salvage" } | { type: "eliminate"; target: string; count: number };
  event: EventDraft;
  map: Coord[];
  order?: OrderDraft | undefined;
}

export interface Draft {
  kind: "aphelion5-campaign-draft";
  version: 1;
  /** "C2": the Campaign's id prefix (mission ids C2_M1 ...). */
  prefix: string;
  /** The units chosen for this Campaign (the palette). Omega units are always there. */
  palette: string[];
  omega: OmegaDraft[];
  orders: OrderDraft[];
  missions: MissionDraft[];
}

export const missionId = (d: Draft, m: MissionDraft) => `${d.prefix}_M${m.number}${m.route === "single" ? "" : m.route.toUpperCase()}`;
export const missionTag = (m: MissionDraft) => `M${m.number}${m.route === "single" ? "" : m.route.toUpperCase()}`;

export function newMission(number: number, route: MissionDraft["route"] = "single"): MissionDraft {
  return { number, route, deck: {}, omegaPlaced: [], omegaSectors: [], threat: { A: [], B: [], C: [], D: [] }, objective: { type: "salvage" }, event: { type: "none" }, map: [{ q: 0, r: 0 }] };
}

export function newDraft(prefix = "C2"): Draft {
  return {
    kind: "aphelion5-campaign-draft",
    version: 1,
    prefix,
    palette: [],
    omega: OMEGA_IDS.map((id) => ({ id, level: 1 })),
    orders: [],
    missions: [newMission(1)],
  };
}

// ---------------------------------------------------------------------------
// Copies (C1) and dev prices.

/**
 * Every unit that can go into a Campaign: not Mecha (they come with the Company), not the Omega
 * tiles (always there), not Bots (every mission's deck already holds all 30, 7.2 step 5;
 * designer 2026-11-27: no Bots in the palette).
 */
export function placeableUnits(data: GameData): UnitDef[] {
  return data.units.units.filter((u) => u.type !== "Mecha" && u.type !== "Omega" && u.type !== "Bot");
}

/** Copies a mission uses: its deck, its Omega units placed and all four Threat columns. */
export function usedInMission(m: MissionDraft): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (id: string, n = 1) => (out[id] = (out[id] ?? 0) + n);
  for (const [id, n] of Object.entries(m.deck)) if (n > 0) add(id, n);
  for (const id of m.omegaPlaced) add(id, m.omegaSectors.length);
  for (const c of THREAT_COLUMNS) for (const id of m.threat[c]) add(id);
  return out;
}

const energyGyros = (data: GameData) => data.units.units.filter((u) => u.energyGyro);

/**
 * How many copies of `id` exist in the box. G_00 takes a tile from the Energy deck, which is all the
 * copies of G_01-G_09 (42), so it shares them with any Energy Gyro the mission names itself.
 */
export function copiesOf(data: GameData, id: string): number {
  if (id === G00) return energyGyros(data).reduce((n, u) => n + u.copies, 0);
  return data.units.byId.get(id)?.copies ?? 0;
}

/** Copies of `id` still free in this mission (C1: the editor never goes past what exists). */
export function freeCopies(data: GameData, m: MissionDraft, id: string): number {
  const used = usedInMission(m);
  if (id === G00 || data.units.byId.get(id)?.energyGyro) {
    const pool = copiesOf(data, G00) - (used[G00] ?? 0) - energyGyros(data).reduce((n, u) => n + (used[u.id] ?? 0), 0);
    if (id === G00) return pool;
    return Math.min(pool, copiesOf(data, id) - (used[id] ?? 0));
  }
  return copiesOf(data, id) - (used[id] ?? 0);
}

/** G_00's dev price per tile (designer 2026-11-27, C6). */
export const G00_PRICE = 0.7;

/** A unit's dev price in this draft (Omega: the Campaign's own; G_00: 0.7 per tile, C6). */
export function priceOf(data: GameData, d: Draft, id: string): number | undefined {
  if (id === G00) return G00_PRICE;
  if (id.startsWith("O_")) return d.omega.find((o) => o.id === id)?.devPrice;
  const p = data.units.byId.get(id)?.devPrice;
  return typeof p === "number" ? p : undefined;
}

export interface PriceSum {
  sum: number;
  /** Tiles counted with no price (G_00, Omega with no price set): id -> copies. */
  unpriced: Record<string, number>;
}

export function priceSum(data: GameData, d: Draft, ids: Record<string, number>): PriceSum {
  const out: PriceSum = { sum: 0, unpriced: {} };
  for (const [id, n] of Object.entries(ids)) {
    if (n <= 0) continue;
    const p = priceOf(data, d, id);
    if (p === undefined) out.unpriced[id] = (out.unpriced[id] ?? 0) + n;
    else out.sum += p * n;
  }
  out.sum = Math.round(out.sum * 100) / 100;
  return out;
}

/** The mission roster: its deck and its Omega units placed (not the Threat columns). */
export function rosterOf(m: MissionDraft): Record<string, number> {
  const out: Record<string, number> = { ...m.deck };
  for (const id of m.omegaPlaced) out[id] = (out[id] ?? 0) + m.omegaSectors.length;
  return out;
}

export function threatRoster(m: MissionDraft, c: ThreatColumn): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of m.threat[c]) out[id] = (out[id] ?? 0) + 1;
  return out;
}

/**
 * The whole Campaign: every mission roster added up (Threat columns not counted). A route pair
 * (2x / 2y, 4x / 4y; 7.2 step 1) counts once, by its first mission, the "X path" (designer
 * 2026-11-22, C8): a "y" mission is left out when its number also has an "x" one.
 */
export function campaignPrice(data: GameData, d: Draft): PriceSum {
  const all: Record<string, number> = {};
  const counted = d.missions.filter((m) => m.route !== "y" || !d.missions.some((x) => x.number === m.number && x.route === "x"));
  for (const m of counted) for (const [id, n] of Object.entries(rosterOf(m))) all[id] = (all[id] ?? 0) + n;
  return priceSum(data, d, all);
}

// ---------------------------------------------------------------------------
// Map and deal.

export const sameCoord = (a: Coord, b: Coord) => a.q === b.q && a.r === b.r;

/** How the deck is dealt (7.2 step 5): onto every sector without an Omega unit. */
export function dealOf(m: MissionDraft): { tiles: number; sectors: number; each: number; extra: number } {
  const tiles = Object.values(m.deck).reduce((a, b) => a + b, 0);
  const sectors = m.map.filter((p) => !m.omegaSectors.some((o) => sameCoord(o, p))).length;
  return { tiles, sectors, each: sectors ? Math.floor(tiles / sectors) : 0, extra: sectors ? tiles % sectors : 0 };
}

// ---------------------------------------------------------------------------
// Checks.

export interface Problem {
  /** Mission tag, or "" for the Campaign. */
  where: string;
  level: "error" | "warn" | "todo";
  text: string;
}

export function checks(data: GameData, d: Draft): Problem[] {
  const out: Problem[] = [];
  if (!/^C\d+$/.test(d.prefix)) out.push({ where: "", level: "error", text: `The Campaign id must look like C2 (it is "${d.prefix}").` });
  if (data.campaigns.some((c) => c.prefix === d.prefix)) out.push({ where: "", level: "warn", text: `${d.prefix} is already a Campaign in the game: exporting would replace it.` });
  for (const o of d.omega) {
    if (!(o.level > 0)) out.push({ where: "", level: "error", text: `${o.id} (${OMEGA_ROLES[o.id]}) needs a Level.` });
    if (o.devPrice === undefined) out.push({ where: "", level: "warn", text: `${o.id} has no dev price: it counts as nothing in the price sums.` });
    for (const [k, e] of [["Destroyed", o.destroyed], ["At Overload", o.atOverload]] as const) if (e?.mode === "text" && e.text.trim()) out.push({ where: "", level: "todo", text: `${o.id} ${k}: written as text, needs programming.` });
  }
  d.orders.forEach((o, i) => {
    if (isEmpty(o.effect)) out.push({ where: "", level: "error", text: `Campaign Order ${i + 1} has no effect.` });
    else if (o.effect.mode === "text") out.push({ where: "", level: "todo", text: `Campaign Order ${i + 1}: written as text, needs programming.` });
  });
  const tags = new Set<string>();
  for (const m of d.missions) {
    const w = missionTag(m);
    if (tags.has(w)) out.push({ where: w, level: "error", text: `${w} is listed twice.` });
    tags.add(w);
    if (m.route !== "single") {
      const other = m.route === "x" ? "y" : "x";
      if (!d.missions.some((x) => x.number === m.number && x.route === other)) out.push({ where: w, level: "error", text: `An alternative route needs its partner: M${m.number}${other.toUpperCase()} is missing.` });
    } else if (d.missions.some((x) => x !== m && x.number === m.number)) out.push({ where: w, level: "error", text: `Mission ${m.number} is both a single mission and an alternative route.` });
    for (const [id, n] of Object.entries(usedInMission(m))) {
      if (id !== G00 && !data.units.byId.has(id)) out.push({ where: w, level: "error", text: `${id} is not in the unit list.` });
      else if (freeCopies(data, m, id) < 0) out.push({ where: w, level: "error", text: `${id}: ${n} used, only ${copiesOf(data, id)} exist${id === G00 ? " in the Energy deck" : ""}.` });
    }
    const deal = dealOf(m);
    if (deal.tiles === 0) out.push({ where: w, level: "error", text: "The deck is empty." });
    else if (deal.tiles < deal.sectors) out.push({ where: w, level: "warn", text: `${deal.sectors - deal.tiles} sector(s) get no tile when the deck is dealt (${deal.tiles} tiles, ${deal.sectors} sectors).` });
    if (!m.map.some((p) => p.q === 0 && p.r === 0)) out.push({ where: w, level: "error", text: "The map has no starting sector (0, 0)." });
    for (const o of m.omegaSectors) {
      if (!m.map.some((p) => sameCoord(p, o))) out.push({ where: w, level: "error", text: `The Omega sector (${o.q}, ${o.r}) is not on the map.` });
      if (o.q === 0 && o.r === 0) out.push({ where: w, level: "warn", text: "An Omega unit is placed on the starting sector (0, 0)." });
    }
    if (m.omegaSectors.length && !m.omegaPlaced.length) out.push({ where: w, level: "error", text: "Omega sectors are marked on the map, but no Omega unit is chosen to stand on them." });
    if (m.omegaPlaced.length && !m.omegaSectors.length) out.push({ where: w, level: "error", text: "Omega units are chosen to be placed, but no sector is marked for them." });
    if (m.objective.type === "eliminate") {
      const ob = m.objective;
      const have = (m.deck[ob.target] ?? 0) + (m.omegaPlaced.includes(ob.target) ? m.omegaSectors.length : 0);
      if (have < ob.count) out.push({ where: w, level: "warn", text: `Eliminate ${ob.count} ${ob.target}: the deck and the placed units hold only ${have} (more can come from Threat columns).` });
    }
    if (m.order) {
      if (isEmpty(m.order.effect)) out.push({ where: w, level: "error", text: "The mission Order has no effect." });
      else if (m.order.effect.mode === "text") out.push({ where: w, level: "todo", text: "The mission Order is written as text: needs programming." });
    }
    if (!eventPlayable(m.event))
      out.push({ where: w, level: "todo", text: `Mission event "${eventLabel(m.event)}": new kind, needs programming before the game can play it.` });
  }
  return out;
}

/** The event kinds the game already plays (Campaign 1's): the others need programming. */
export function eventPlayable(e: EventDraft): boolean {
  if (e.type === "none" || e.type === "allied_drop") return true;
  if (e.type === "take_modules") return e.amount === 1;
  if (e.type === "gain_energy") return COLOURS.every((c) => !e.energy[c]);
  return false;
}

export function eventLabel(e: EventDraft): string {
  switch (e.type) {
    case "none":
      return "None";
    case "allied_drop":
      return `Allied Drop, Level ${e.level}`;
    case "gain_energy":
      return `Gain ${energyEventText(e.any, e.energy)}`;
    case "take_modules":
      return `Take the top ${e.amount} Module${e.amount === 1 ? "" : "s"} of the Module deck`;
    case "take_anomaly":
      return `Take ${e.amount} Anomaly card${e.amount === 1 ? "" : "s"}`;
    case "remove_damage":
      return `Remove ${e.amount} damage from your Flagship`;
  }
}

// ---------------------------------------------------------------------------
// From a Campaign in the game (or a Campaign file): effects come in as text.

function textEffect(t: string | undefined): EffectDraft | undefined {
  return t ? { mode: "text", text: t } : undefined;
}

function missionFrom(m: MissionDef): MissionDraft {
  const deck: Record<string, number> = {};
  for (const t of m.deploymentShuffled) deck[t.id] = (deck[t.id] ?? 0) + t.count;
  const e = m.event;
  const event: EventDraft =
    e.type === "allied_drop"
      ? { type: "allied_drop", level: e.level }
      : e.type === "gain_energy"
        ? { type: "gain_energy", any: e.amount, energy: { Yellow: e.energy?.Yellow ?? 0, Red: e.energy?.Red ?? 0, Blue: e.energy?.Blue ?? 0 } }
        : e.type === "take_module_top"
          ? { type: "take_modules", amount: 1 }
          : e.type === "none"
            ? { type: "none" }
            : { type: e.type, amount: e.amount };
  const out: MissionDraft = {
    number: m.number,
    route: m.route === "x" || m.route === "y" ? m.route : "single",
    deck,
    omegaPlaced: [...m.omegaPlaced],
    omegaSectors: m.omegaSectors.map((p) => ({ ...p })),
    threat: { A: [...m.threat.A], B: [...m.threat.B], C: [...m.threat.C], D: [...m.threat.D] },
    objective: m.objective.type === "salvage" ? { type: "salvage" } : { ...m.objective },
    event,
    map: m.map.map((p) => ({ ...p })),
  };
  if (m.order) out.order = { tokens: m.order.tokens, overloadOnly: m.order.overloadOnly, effect: { mode: "text", text: m.order.effect } };
  return out;
}

export function draftFromCampaign(c: CampaignDatabase, prefix = c.prefix): Draft {
  const missions = c.missions.map(missionFrom);
  const palette = new Set<string>();
  for (const m of missions) for (const id of Object.keys(usedInMission(m))) if (id !== G00 && !id.startsWith("O_")) palette.add(id);
  return {
    kind: "aphelion5-campaign-draft",
    version: 1,
    prefix,
    palette: [...palette].sort(),
    omega: OMEGA_IDS.map((id) => {
      const o = c.omega.find((x) => x.id === id);
      return { id, level: o?.level ?? 1, devPrice: o?.devPrice, destroyed: textEffect(o?.destroyed), atOverload: textEffect(o?.atOverload) };
    }),
    orders: c.orders.map((o) => ({ tokens: o.tokens, overloadOnly: o.overloadOnly, effect: { mode: "text", text: o.effect } })),
    missions,
  };
}

/** An editor file (JSON) back into a draft; throws when it is not one. */
export function readDraft(text: string): Draft {
  const d = JSON.parse(text) as Draft;
  if (d?.kind !== "aphelion5-campaign-draft" || d.version !== 1 || !Array.isArray(d.missions)) throw new Error("not a Campaign editor file");
  return d;
}

// ---------------------------------------------------------------------------
// The Campaign file (data/Campaign1.txt's format), for the Project.

const coordText = (p: Coord) => `(${p.q}, ${p.r})`;
const orderLine = (o: OrderDraft) => `${o.overloadOnly ? "[Overload] " : ""}${o.tokens} Command token${o.tokens === 1 ? "" : "s"}: ${effectText(o.effect)}`;

export function campaignFileText(d: Draft): string {
  const n = /^C(\d+)$/.exec(d.prefix)?.[1] ?? d.prefix;
  const L: string[] = [];
  L.push(
    "################################################################################",
    `# APHELION 5 - CAMPAIGN ${n} DATABASE (structured, machine-oriented)`,
    "# Made with the Campaign editor. Format as Campaign1.txt (its FORMAT SPEC), with these additions:",
    "#   Omega records may give dev_price (developer-only balance number, not a game rule).",
    "#   event_type gain_energy: event_amount = energy of your choice; event_energy = set colours",
    "#     (\"1 Yellow, 2 Red\"); either may be absent.",
    "#   event_type take_modules (event_amount = Modules taken from the top of the Module deck),",
    "#     take_anomaly (event_amount = Anomaly cards taken), remove_damage (event_amount = damage",
    "#     removed from your Flagship).",
    "# Rules semantics live in \"Core Rules.txt\". Unit stats live in \"unit_list_structured.txt\".",
    "################################################################################",
    "",
    "KEY ORDER (MISSION):",
    "  id, number, route, deployment_shuffled, omega_placed, omega_sectors,",
    "  threat_A, threat_B, threat_C, threat_D, objective_type, objective_target,",
    "  objective_count, event_type, event_level, event_amount, event_energy, map_sector_count, map, orders",
    "",
    "################################################################################",
    "=== SECTION: OMEGA ===",
    "SECTION_DEFAULTS:",
    "  on destroy: remove to Trophy pile (after resolving its Destroyed effect, if any)",
    "",
  );
  for (const o of d.omega) {
    L.push(`id: ${o.id}`, `role: ${OMEGA_ROLES[o.id]}`, `level: ${o.level}`);
    if (o.devPrice !== undefined) L.push(`dev_price: ${o.devPrice}`);
    if (!isEmpty(o.destroyed)) L.push(`destroyed: ${effectText(o.destroyed!)}`);
    if (!isEmpty(o.atOverload)) L.push(`at_overload: ${effectText(o.atOverload!)}`);
    L.push("");
  }
  L.push("################################################################################", "=== SECTION: CAMPAIGN ORDERS ===", "(Available in every mission of this Campaign.)", "");
  d.orders.forEach((o, i) => {
    L.push(`id: ${d.prefix}_ORDER_${i + 1}`, `tokens: ${o.tokens}`, `overload_only: ${o.overloadOnly ? "yes" : "no"}`, `effect: ${effectText(o.effect)}`, "");
  });
  L.push("################################################################################", "=== SECTION: MISSIONS ===", "");
  const sorted = [...d.missions].sort((a, b) => a.number - b.number || a.route.localeCompare(b.route));
  for (const m of sorted) {
    const id = missionId(d, m);
    L.push(`id: ${id}`, `number: ${m.number}`);
    if (m.route === "single") L.push("route: single");
    else {
      const other = sorted.find((x) => x.number === m.number && x.route === (m.route === "x" ? "y" : "x"));
      L.push(`route: ${m.route}${other ? ` (alternative to ${missionId(d, other)})` : ""}`);
    }
    const deck = Object.entries(m.deck).filter(([, c]) => c > 0);
    L.push(`deployment_shuffled: ${deck.map(([u, c]) => `${u} x${c}`).join(", ")}`);
    if (m.omegaPlaced.length) L.push(`omega_placed: ${m.omegaPlaced.join(", ")}`);
    if (m.omegaSectors.length) L.push(`omega_sectors: ${m.omegaSectors.map(coordText).join(", ")}`);
    for (const c of THREAT_COLUMNS) L.push(`threat_${c}: ${m.threat[c].join(", ")}`);
    if (m.objective.type === "salvage") L.push("objective_type: salvage");
    else L.push("objective_type: eliminate", `objective_target: ${m.objective.target}`, `objective_count: ${m.objective.count}`);
    const e = m.event;
    switch (e.type) {
      case "none":
        L.push("event_type: none");
        break;
      case "allied_drop":
        L.push("event_type: allied_drop", `event_level: ${e.level}`);
        break;
      case "gain_energy": {
        L.push("event_type: gain_energy");
        const set = COLOURS.filter((c) => e.energy[c] > 0);
        if (e.any > 0 || set.length === 0) L.push(`event_amount: ${e.any}`);
        if (set.length) L.push(`event_energy: ${set.map((c) => `${e.energy[c]} ${c}`).join(", ")}`);
        break;
      }
      case "take_modules":
        if (e.amount === 1) L.push("event_type: take_module_top");
        else L.push("event_type: take_modules", `event_amount: ${e.amount}`);
        break;
      default:
        L.push(`event_type: ${e.type}`, `event_amount: ${e.amount}`);
    }
    L.push(`map_sector_count: ${m.map.length}`, `map: ${m.map.map(coordText).join(", ")}`, `orders: ${m.order && !isEmpty(m.order.effect) ? orderLine(m.order) : "none"}`, "");
  }
  L.push("=== END OF FILE ===", "");
  return L.join("\n");
}
