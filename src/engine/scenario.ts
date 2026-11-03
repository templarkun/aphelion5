/**
 * Building game states: a blank mission state, and the test batches' board
 * notation (spec Developer mode, "Load scenario"; batch 1 FORMAT SPEC item 4):
 *
 *   (q,r): TOP > next > ... > bottom
 *   "B_02[S1]" face-up B_02 with 1 Shield; [D1] Damage, [BS1] Bio-shield,
 *   [BAR] Barrier, [AL] Alert, [WR] Wreck marker, [TICK] [MORTAR] [FB] Fuses,
 *   "f=N" facing, "fd" face-down tile ("fd:B_01" when contents matter),
 *   "cleared" no tiles. Several sectors may share one stack: "(1,-1), (1,1): cleared".
 *   Sectors not listed: face-up B_03 with a tile beneath.
 *
 * Plus the phrases the batches use for the rest of the state: "Overload
 * under way", "Shield supply N", "Flagship V1 Integrity Bay1 1, Bay2 1, ...",
 * "every other sector cleared", "Every sector cleared except ...".
 */

import type { GameData } from "../data/index.js";
import { missionForMapName } from "../data/campaign.js";
import { ENERGY_COLOURS } from "../data/units.js";
import { type Facing, key } from "../geometry/hex.js";
import { newRng } from "./rng.js";
import { ENERGY_PER_COLOUR, LIMITED_TOKENS, TOKEN_LIMIT } from "./rules.js";
import { type GameState, type Phase, type TileId, type TileState, type Tokens, noTokens } from "./state.js";

export interface NewStateOptions {
  campaign?: string;
  mission: string;
  company?: string;
  seed?: number;
}

/** A mission state with an empty Field, full supplies and a full-strength Flagship. */
export function newMissionState(data: GameData, o: NewStateOptions): GameState {
  const campaignId = o.campaign ?? "C1";
  const camp = data.campaigns.find((c) => c.prefix === campaignId);
  if (!camp) throw new Error(`unknown campaign ${campaignId}`);
  const mission = camp.missionById.get(o.mission);
  if (!mission) throw new Error(`unknown mission ${o.mission}`);
  const companyId = o.company ?? "V1";
  const company = data.companies.byId.get(companyId);
  if (!company) throw new Error(`unknown Company ${companyId}`);
  const zero = () => Object.fromEntries(ENERGY_COLOURS.map((k) => [k, 0])) as Record<(typeof ENERGY_COLOURS)[number], number>;
  return {
    formatVersion: 1,
    rng: newRng(o.seed ?? 1),
    phase: "command",
    campaign: campaignId,
    mission: mission.id,
    map: mission.map.map((c) => ({ q: c.q, r: c.r })),
    field: Object.fromEntries(mission.map.map((c) => [key(c), [] as TileId[]])),
    tiles: {},
    piles: { missionDeck: [], energyDeck: [], discard: [], trophy: [], supply: [] },
    supply: {
      ...(Object.fromEntries(LIMITED_TOKENS.map((t) => [t, TOKEN_LIMIT[t]])) as Record<(typeof LIMITED_TOKENS)[number], number>),
      energy: Object.fromEntries(ENERGY_COLOURS.map((k) => [k, ENERGY_PER_COLOUR])) as Record<(typeof ENERGY_COLOURS)[number], number>,
      heat: data.expansion1.heatTokens,
    },
    player: { company: companyId, reserve: zero(), modules: [], anomalies: [], commandTokens: 0, heat: 0 },
    flagship: company.bays.map((b) => b.integrity),
    settings: { autoAnswer: true, heatModule: false },
    log: [],
  };
}

/** Make a new tile copy id for a unit ("B_01#1", "B_01#2", ...; "fd#1" for unknown contents). */
function newTileId(s: GameState, unitId: string | null): TileId {
  const base = unitId ?? "fd";
  for (let n = 1; ; n++) {
    const id = `${base}#${n}`;
    if (!s.tiles[id]) return id;
  }
}

export function addTile(s: GameState, unitId: string | null, faceUp: boolean, facing: Facing = 0, tokens: Tokens = noTokens()): TileId {
  const id = newTileId(s, unitId);
  const t: TileState = { id, unitId, faceUp, facing, tokens };
  s.tiles[id] = t;
  return id;
}

// ---------------------------------------------------------------------------
// Notation
// ---------------------------------------------------------------------------

export interface TileSpec {
  unitId: string | null;
  faceUp: boolean;
  facing: Facing;
  tokens: Tokens;
}

const TOKEN_CODES: Record<string, (t: Tokens, n: number) => void> = {
  D: (t, n) => (t.damage += n),
  S: (t, n) => (t.shield += n),
  BS: (t, n) => (t.bioShield += n),
  BAR: (t) => (t.barrier = true),
  AL: (t) => (t.alert = true),
  WR: (t) => (t.wreck = true),
  TICK: (t, n) => (t.tick += n),
  MORTAR: (t, n) => (t.mortar += n),
  FB: (t, n) => (t.feedback += n),
};

/** One stack element: "fd", "fd:B_02", "B_02[S1][BAR] f=2", "G_05 Wreck [WR][AL]". */
export function parseTileSpec(text: string): TileSpec {
  const src = text.trim();
  const fd = /^fd(?::([A-Z]_\d+))?$/.exec(src);
  if (fd) return { unitId: fd[1] ?? null, faceUp: false, facing: 0, tokens: noTokens() };
  const m = /^([A-Z]_\d+)(.*)$/.exec(src);
  if (!m) throw new Error(`cannot read tile "${src}"`);
  const tokens = noTokens();
  let facing: Facing = 0;
  let rest = m[2]!.replace(/\bWreck\b/, " ");
  rest = rest.replace(/f=(\d)/, (_x, f: string) => {
    const n = Number(f);
    if (n > 5) throw new Error(`facing ${n} in "${src}"`);
    facing = n as Facing;
    return " ";
  });
  rest = rest.replace(/\[([A-Z]+?)(\d*)\]/g, (_x, code: string, num: string) => {
    const fn = TOKEN_CODES[code];
    if (!fn) throw new Error(`unknown token [${code}${num}] in "${src}"`);
    fn(tokens, num === "" ? 1 : Number(num));
    return " ";
  });
  if (rest.trim() !== "") throw new Error(`cannot read "${rest.trim()}" in "${src}"`);
  return { unitId: m[1]!, faceUp: true, facing, tokens };
}

/** "B_01 > P_12 > fd" (top first) -> specs, top first. "cleared" -> []. */
export function parseStack(text: string): TileSpec[] {
  // "(0,-1), (0,0): B_03 each" = each listed sector holds that stack.
  const t = text.trim().replace(/\s+each$/, "");
  if (t === "cleared") return [];
  return t.split(">").map(parseTileSpec);
}

export interface ScenarioSetup {
  phase: Phase;
  /** Stacks by sector key, top first. */
  stacks: Map<string, TileSpec[]>;
  /** What unlisted sectors hold. */
  others: "default" | "cleared";
  shieldSupply?: number;
  flagship?: number[];
  company?: string;
}

const COORD = String.raw`\(\s*-?\d+\s*,\s*-?\d+\s*\)`;

/** Read a test's "given" text. Phrases it does not know are ignored (they are for the reader). */
export function parseGiven(given: string): ScenarioSetup {
  const flat = given.replace(/\s+/g, " ");
  const setup: ScenarioSetup = { phase: "command", stacks: new Map(), others: "default" };
  // State phrases are read first: some sit inside parentheses, "(Overload under way)".
  const text0 = flat;

  if (/Overload (under way|just started)/i.test(text0)) setup.phase = "overload";
  if (/Overload ending/i.test(text0)) setup.phase = "overloadEnd";
  const sh = /Shield supply (\d+)/i.exec(text0);
  if (sh) setup.shieldSupply = Number(sh[1]);
  const fl = /Flagship (V\d+) Integrity ((?:Bay\d+ \d+(?:, )?)+)/.exec(text0);
  if (fl) {
    setup.company = fl[1]!;
    setup.flagship = [...fl[2]!.matchAll(/Bay(\d+) (\d+)/g)].map((x) => Number(x[2]));
  }
  if (/every other sector (is )?cleared|Every sector cleared except/i.test(text0)) setup.others = "cleared";
  // Then drop parenthetical remarks that are not coordinates: "(Strength 3)", "(no Alert)".
  const text = flat
    .replace(new RegExp(String.raw`\((?!\s*-?\d+\s*,\s*-?\d+\s*\))[^()]*\)`, "g"), "")
    .replace(/Every sector cleared except/i, "");

  const re = new RegExp(String.raw`((?:${COORD}\s*(?:,|and)?\s*)+):\s*([^.]*)`, "g");
  for (const m of text.matchAll(re)) {
    const coords = [...m[1]!.matchAll(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g)].map((x) => `${Number(x[1])},${Number(x[2])}`);
    const specs = parseStack(m[2]!);
    for (const k of coords) {
      if (setup.stacks.has(k)) throw new Error(`(${k}) is given twice`);
      setup.stacks.set(k, specs);
    }
  }
  return setup;
}

/** Layer `extra` over `base`: its stacks replace the same sectors, its phrases win. */
export function mergeSetups(base: ScenarioSetup, extra: ScenarioSetup, extraText: string): ScenarioSetup {
  const out: ScenarioSetup = { ...base, stacks: new Map([...base.stacks, ...extra.stacks]) };
  if (/Overload/i.test(extraText)) out.phase = extra.phase;
  if (extra.others === "cleared") out.others = "cleared";
  if (extra.shieldSupply !== undefined) out.shieldSupply = extra.shieldSupply;
  if (extra.flagship !== undefined) out.flagship = extra.flagship;
  if (extra.company !== undefined) out.company = extra.company;
  return out;
}

/**
 * Build the state for a test: its map, its given stacks, and the batch
 * defaults. `extra` (same notation) is laid over `given`, for variants.
 */
export function scenarioState(data: GameData, mapName: string, given: string, seed = 1, extra = ""): GameState {
  const camp = data.campaigns[0]!;
  const mission = missionForMapName(camp, mapName);
  const setup = extra.trim() === "" ? parseGiven(given) : mergeSetups(parseGiven(given), parseGiven(extra), extra);
  const s = newMissionState(data, { campaign: camp.prefix, mission: mission.id, company: setup.company ?? "V1", seed });
  s.phase = setup.phase;
  for (const sector of Object.keys(s.field)) {
    const specs = setup.stacks.get(sector) ?? (setup.others === "default" ? [parseTileSpec("B_03"), parseTileSpec("fd")] : []);
    // Specs are top first; stacks are stored bottom first.
    for (const sp of [...specs].reverse()) s.field[sector]!.push(addTile(s, sp.unitId, sp.faceUp, sp.facing, { ...sp.tokens }));
  }
  for (const k of setup.stacks.keys()) if (!(k in s.field)) throw new Error(`(${k}) is not on map ${mapName}`);

  // Supply = component count minus what is on the board; "Shield supply N" overrides.
  for (const t of Object.values(s.tiles)) {
    s.supply.shield -= t.tokens.shield;
    s.supply.bioShield -= t.tokens.bioShield;
    s.supply.barrier -= t.tokens.barrier ? 1 : 0;
    s.supply.tick -= t.tokens.tick;
    s.supply.mortar -= t.tokens.mortar;
    s.supply.feedback -= t.tokens.feedback;
  }
  if (setup.shieldSupply !== undefined) s.supply.shield = setup.shieldSupply;
  if (setup.flagship) {
    if (setup.flagship.length !== s.flagship.length) throw new Error(`Flagship given with ${setup.flagship.length} Bays`);
    s.flagship = setup.flagship;
  }
  return s;
}
