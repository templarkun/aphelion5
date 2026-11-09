/**
 * The Campaign (stage 7): Game setup (Core Rules 7.1), Mission Preparation
 * (7.2), Allied Drop (7.3), Mission End (10.1), Upgrades (10.2) and Game End
 * with scoring (10.3). The Heat module's setup and clean-up steps (H2, H3, H8)
 * are here too; its play rules are in heat.ts.
 *
 * Root effects, one per phase (the session driver starts them):
 *   setup -> "gameSetup", preparation -> "missionPreparation",
 *   missionEnd -> "missionEnd", gameEnd -> "gameEnd".
 */

import type { CampaignDatabase, MissionDef, ThreatColumn } from "../data/campaign.js";
import { THREAT_COLUMNS } from "../data/campaign.js";
import type { CompanyDef, UpgradeDef } from "../data/company.js";
import type { GameData } from "../data/index.js";
import { ENERGY_COLOURS } from "../data/units.js";
import { key } from "../geometry/hex.js";
import { ability } from "../effects/registry.js";
import { type Effect, type RunCtx, ask, log, registerRoot } from "./effect.js";
import { type Ctx, sectorKeys, stack, tile, unitDef } from "./field.js";
import { moduleDef } from "./modules.js";
import { isOpenSector } from "./moves.js";
import type { Option } from "./questions.js";
import { newRng, shuffle } from "./rng.js";
import { addTile } from "./scenario.js";
import { newMissionState } from "./scenario.js";
import { type GameState, type Profile, type SectorKey, type TileId, emptyProfile, noTokens } from "./state.js";
import { gainEnergy, printedIntegrity, returnTokens } from "./tokens.js";

export const camp = (c: Ctx): CampaignDatabase => c.data.campaigns.find((x) => x.prefix === c.state.campaign)!;
export const company = (c: Ctx): CompanyDef => c.data.companies.byId.get(c.state.player.company)!;
const mission = (c: Ctx): MissionDef => camp(c).missionById.get(c.state.mission)!;

// ---------------------------------------------------------------------------
// A new game
// ---------------------------------------------------------------------------

export interface NewGameOptions {
  seed: number;
  /** The date written into a high score field (the engine never reads the clock). */
  date: string;
  profile?: Profile;
  developerMode?: boolean;
  /** Games saved before 2026-11-08 replay with Mecha allowed to Attack Mecha (Core Rules as printed). */
  mechaAttacksMecha?: boolean;
  /** Games saved before format 6: a Power Node's energy-or-Heat choice is made at its Reveal (trial rule). */
  powerNodeAtReveal?: boolean;
  /** Games saved before format 7: the Flare energy trial rule is still a choice on the expansion list. */
  flareEnergyChoice?: boolean;
  /** Answer questions with one legal answer automatically (spec "Player choices"); fixed for the whole game. */
  autoAnswer?: boolean;
}

/** A game before setup: every tile of the game in the box (the Supply), awaiting the setup choices. */
export function newGame(data: GameData, o: NewGameOptions): GameState {
  const first = data.campaigns[0]!;
  const s = newMissionState(data, { campaign: first.prefix, mission: first.missions[0]!.id, company: data.companies.companies[0]!.id, seed: o.seed });
  s.phase = "setup";
  s.rng = newRng(o.seed);
  s.profile = structuredClone(o.profile ?? emptyProfile());
  s.run.date = o.date;
  s.settings.developerMode = o.developerMode ?? false;
  s.settings.autoAnswer = o.autoAnswer ?? true;
  if (o.mechaAttacksMecha) s.settings.mechaAttacksMecha = true;
  if (o.powerNodeAtReveal) s.settings.powerNodeAtReveal = true;
  if (o.flareEnergyChoice) s.settings.flareEnergyChoice = true;
  s.player.commandTokens = 0;
  // Every tile copy (unit file "copies"): Energy Gyros form the Energy deck, the rest wait in the box.
  for (const u of data.units.units) {
    for (let i = 0; i < u.copies; i++) {
      const id = addTile(s, u.id, false);
      (u.energyGyro ? s.piles.energyDeck : s.piles.supply).push(id);
    }
  }
  s.log.push({ text: `new game, seed ${o.seed}`, rule: "7.1" });
  return s;
}

/** Take one tile of a unit from the box; none left: undefined (6.7). */
function takeFromBox(c: Ctx, unitId: string): TileId | undefined {
  const i = c.state.piles.supply.findIndex((t) => c.state.tiles[t]!.unitId === unitId);
  if (i < 0) return undefined;
  const [t] = c.state.piles.supply.splice(i, 1);
  return t;
}

/** Take a tile for the mission deck: "G_00" = the top of the Energy deck, unseen (4.3). */
function takeForDeck(c: Ctx, unitId: string, rule: string): TileId | undefined {
  const t = unitId === c.data.units.energyDeckPlaceholder ? c.state.piles.energyDeck.shift() : takeFromBox(c, unitId);
  if (t === undefined) log(c, `no ${unitId} left: that entry adds nothing`, "6.7");
  else {
    tile(c.state, t).faceUp = false;
    tile(c.state, t).tokens = noTokens();
  }
  void rule;
  return t;
}

/** A Company sheet's marked slots (profile), and the upgrades they fill. */
export function filledFrom(co: CompanyDef, marks: Record<string, number>): string[] {
  return co.upgrades.filter((u) => (marks[u.id] ?? 0) >= u.cost && u.kind === "permanent_ability").map((u) => u.id);
}

// ---------------------------------------------------------------------------
// 7.1 Game setup
// ---------------------------------------------------------------------------

function* gameSetup(c: RunCtx): Effect {
  const s = c.state;
  // 1. Choose a Campaign. Always asked, even with only one (designer 2026-11-04).
  const camps = c.data.campaigns;
  const pick = yield* ask(c, { kind: "option", always: true, prompt: "Choose a Campaign.", rule: "7.1", options: camps.map((x) => ({ id: x.prefix, label: campaignName(x.prefix) })) });
  const cp = camps.find((x) => x.prefix === pick.value)!;
  s.campaign = cp.prefix;
  log(c, `Campaign ${cp.prefix}`, "7.1");
  // 2. Choose a Company.
  const cos = c.data.companies.companies;
  const a = yield* ask(c, { kind: "option", always: true, prompt: "Choose your Company.", rule: "7.1", options: cos.map((x) => ({ id: x.id, label: `${x.id}: ${x.name}` })) });
  const co = c.data.companies.byId.get(a.value as string)!;
  s.player.company = co.id;
  s.flagship = co.bays.map((b) => b.integrity);
  // 3. Fresh or Veteran: only if the sheet has marked slots.
  const marks = s.profile.sheets[co.id] ?? {};
  const marked = Object.values(marks).some((n) => n > 0);
  let fresh = true;
  if (marked) {
    const f = yield* ask(c, { kind: "option", prompt: `${co.name}'s sheet has upgrade marks from earlier games.`, rule: "7.1", options: [{ id: "veteran", label: "Veteran: keep all upgrade marks" }, { id: "fresh", label: "Fresh: erase every mark on this sheet" }] });
    fresh = f.value === "fresh";
  }
  s.run.freshness = fresh ? "fresh" : "veteran";
  if (fresh) s.profile.sheets[co.id] = {};
  s.sheet.marks = { ...(s.profile.sheets[co.id] ?? {}) };
  s.sheet.filled = filledFrom(co, s.sheet.marks);
  s.sheet.overhaulUsed = 0; // erase marked Overhaul slots in both cases
  log(c, `${fresh ? "Fresh" : "Veteran"} campaign with ${co.name}`, "7.1");
  // Expansion modules (spec "Scope": chosen at game setup): select any, all or none.
  // Designer 2026-11-09: the Flare energy rule is always on in this program (Core Rules unchanged);
  // games saved before still offer it on the list, so they replay as played.
  // Designer 2026-11-09: a screen-only trial (how a ready Alert is shown) on the same list; no rule change.
  const offered = s.settings.flareEnergyChoice ? [...EXPANSION_MODULES, TRIAL_FLARE_ENERGY] : [...EXPANSION_MODULES, TRIAL_ALERT_BEACON];
  const x = yield* ask(c, { kind: "several", always: true, prompt: "Choose the expansion modules to play with (any, all or none).", rule: "H1", options: offered, min: 0, max: offered.length });
  s.settings.heatModule = (x.value as string[]).includes("heat");
  if ((x.value as string[]).includes(TRIAL_ALERT_BEACON.id)) s.settings.alertBeacon = true;
  s.settings.trialFlareEnergy = s.settings.flareEnergyChoice ? (x.value as string[]).includes("trialFlareEnergy") : true;
  // 4. Starting energy.
  for (const col of ENERGY_COLOURS) {
    const n = Math.min(co.startingEnergy[col], s.supply.energy[col]);
    s.player.reserve[col] += n;
    s.supply.energy[col] -= n;
  }
  // 5. The mission deck: all 30 Bots plus your starting Mecha.
  const deck: TileId[] = [];
  for (const b of ["B_01", "B_02", "B_03"]) for (let i = 0; i < 10; i++) push(deck, takeForDeck(c, b, "7.1"));
  for (const m of co.startingMecha) for (let i = 0; i < m.count; i++) push(deck, takeForDeck(c, m.id, "7.1"));
  s.piles.missionDeck = deck;
  // 6. Shuffle the Energy deck.
  shuffle(s.rng, s.piles.energyDeck);
  // 7. Shuffle the Anomaly deck and take 3 cards.
  s.decks.anomalies = shuffle(s.rng, c.data.anomalies.anomalies.map((x) => x.id));
  s.player.anomalies = s.decks.anomalies.splice(0, 3);
  // 8. Starting Modules: the first two of each colour; the others to the bottom.
  const order = shuffle(s.rng, c.data.modules.modules.map((x) => x.id));
  const keep: number[] = [];
  const rest: number[] = [];
  for (const id of order) (keep.filter((k) => moduleDef(c, k).colour === moduleDef(c, id).colour).length < 2 ? keep : rest).push(id);
  s.player.modules = keep.map((id) => ({ id, ready: true, energy: { Yellow: 0, Red: 0, Blue: 0 } }));
  s.decks.modules = rest;
  s.hiddenInfo += 1;
  log(c, `starting Modules: ${keep.map((k) => moduleDef(c, k).name).join(", ")}`, "7.1");
  s.phase = "preparation";
}

/** Expansion modules offered at game setup. Only the Heat module (Expansion1) so far. */
export const EXPANSION_MODULES = [{ id: "heat", label: "Heat module (Expansion1)" }];
/** Designer 2026-11-07 (I2): offered on the list only in games saved before format 7; always on since 2026-11-09. */
const TRIAL_FLARE_ENERGY = { id: "trialFlareEnergy", label: "Trial rule: Flare energy waits on the Flare until its Alert is resolved" };

/** Designer 2026-11-09: a screen trial, the second look for a ready Alert (beacon light and radar ping). */
export const TRIAL_ALERT_BEACON = { id: "alertBeacon", label: "Trial look: a ready Alert shown as a beacon light and radar ping (off: an Alert token and a pulsing rim)" };

/** "C1" -> "Campaign 1". */
export function campaignName(prefix: string): string {
  const m = /^C(\d+)$/.exec(prefix);
  return m ? `Campaign ${m[1]}` : prefix;
}

function push(xs: TileId[], t: TileId | undefined): void {
  if (t !== undefined) xs.push(t);
}

// ---------------------------------------------------------------------------
// 7.2 Mission Preparation
// ---------------------------------------------------------------------------

/** Missions you may play now (7.2 step 1): the lowest number not completed, any route not skipped. */
export function nextMissions(c: Ctx): MissionDef[] {
  const done = new Set(c.state.run.completed.map((r) => r.mission));
  const left = camp(c).missions.filter((m) => !done.has(m.id) && !c.state.run.skipped.includes(m.id));
  const done2 = new Set(camp(c).missions.filter((m) => done.has(m.id)).map((m) => m.number));
  const open = left.filter((m) => !done2.has(m.number));
  if (open.length === 0) return [];
  const low = Math.min(...open.map((m) => m.number));
  return open.filter((m) => m.number === low);
}

const COLUMNS_LEVEL = ["", "Patrol", "Assault", "Siege", "Annihilation"];

function* missionPreparation(c: RunCtx): Effect {
  const s = c.state;
  // 1. Choose the mission.
  const ms = nextMissions(c);
  if (ms.length === 0) throw new Error("no mission left to play");
  let m = ms[0]!;
  if (ms.length > 1) {
    const a = yield* ask(c, { kind: "option", prompt: `Mission ${m.number}: choose a route. The other is skipped for this campaign.`, rule: "7.2", options: ms.map((x) => ({ id: x.id, label: `${x.id} (route ${x.route.split(" ")[0]})` })) });
    m = ms.find((x) => x.id === a.value)!;
  }
  for (const x of ms) if (x.id !== m.id) s.run.skipped.push(x.id);
  s.mission = m.id;
  s.map = m.map.map((p) => ({ q: p.q, r: p.r }));
  s.field = Object.fromEntries(m.map.map((p) => [key(p), [] as TileId[]]));
  log(c, `Mission ${m.number}: ${m.id}`, "7.2");
  // 2. Deploy.
  for (const t of m.deploymentShuffled) for (let i = 0; i < t.count; i++) push(s.piles.missionDeck, takeForDeck(c, t.id, "7.2"));
  const omegaSectors = new Set<string>();
  for (const id of m.omegaPlaced) {
    for (const p of m.omegaSectors) {
      const t = takeFromBox(c, id);
      if (t === undefined) {
        log(c, `no ${id} left to place on (${key(p)})`, "6.7");
        continue;
      }
      const ts = tile(s, t);
      ts.faceUp = true;
      ts.facing = 0; // Omega tiles have no arrows: no facing to choose
      s.field[key(p)]!.push(t);
      omegaSectors.add(key(p));
    }
  }
  // 3. Threat Level: how many columns, and which.
  const tc = yield* ask(c, {
    kind: "several",
    prompt: "Choose the Threat columns to play (1 Patrol, 2 Assault, 3 Siege, 4 Annihilation). Each one completed scores 1 point.",
    rule: "7.2",
    options: THREAT_COLUMNS.map((col) => ({ id: col, label: `${col}: ${m.threat[col].join(", ")}` })),
    min: 1,
    max: 4,
  });
  const cols = (tc.value as ThreatColumn[]).slice().sort();
  s.run.threat = cols;
  log(c, `Threat Level ${COLUMNS_LEVEL[cols.length]}: columns ${cols.join(", ")}`, "7.2");
  for (const col of cols) for (const id of m.threat[col]) push(s.piles.missionDeck, takeForDeck(c, id, "7.2"));
  // 4. Build the Field (done above, from the map). 5. Deal the mission deck.
  const deck = shuffle(s.rng, s.piles.missionDeck);
  s.piles.missionDeck = [];
  s.hiddenInfo += 1;
  const targets = sectorKeys(s).filter((k) => !omegaSectors.has(k));
  const each = Math.floor(deck.length / targets.length);
  const extra = deck.length - each * targets.length;
  // Extra tiles (computer version, designer 2026-11-04): (0,0) first, then (0,1),
  // if they can take tiles; the rest go to sectors chosen at random.
  const extras = extraTileSectors(s, targets, extra);
  for (const k of targets) {
    const n = each + (extras.includes(k) ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const t = deck.shift()!;
      tile(s, t).faceUp = false;
      s.field[k]!.push(t);
    }
  }
  log(c, `the mission deck is dealt: ${each} tiles to each sector${extra ? `, ${extra} extra` : ""}`, "7.2");
  // 6. Draw a Module: reveal the top 3, keep 1, the other 2 to the bottom.
  const top = s.decks.modules.splice(0, 3);
  if (top.length > 0) {
    const k = yield* ask(c, { kind: "option", prompt: "Draw a Module: keep one.", rule: "7.2", options: top.map((id) => ({ id: String(id), label: `${moduleDef(c, id).name} (${moduleDef(c, id).cost} ${moduleDef(c, id).colour}): ${moduleDef(c, id).effect}` })) });
    const kept = Number(k.value);
    s.player.modules.push({ id: kept, ready: true, energy: { Yellow: 0, Red: 0, Blue: 0 } });
    // Designer, 2026-11-04: the other two go to the bottom in random order (no choice).
    const rest = shuffle(s.rng, top.filter((x) => x !== kept));
    s.decks.modules.push(...rest);
    log(c, `keep ${moduleDef(c, kept).name}`, "7.2");
    s.hiddenInfo += 1;
  }
  // 7. Take 6 Command tokens.
  const ct = Math.min(6 - s.player.commandTokens, s.supply.command);
  s.player.commandTokens += ct;
  s.supply.command -= ct;
  // H2 (after step 7): take 10 Heat tokens.
  if (s.settings.heatModule) {
    const h = Math.min(10 - s.player.heat, s.supply.heat);
    s.player.heat += h;
    s.supply.heat -= h;
    log(c, `take ${h} Heat tokens`, "H2");
  }
  // 8. Draw 1 Anomaly card.
  const an = s.decks.anomalies.shift();
  if (an !== undefined) {
    s.player.anomalies.push(an);
    log(c, `draw Anomaly ${an}`, "7.2");
  }
  // 9. The mission event.
  const ev = m.event;
  if (ev.type === "allied_drop") yield* alliedDrop(c, ev.level);
  else if (ev.type === "gain_energy") yield* gainEnergy(c, ev.amount, undefined, "7.2");
  else if (ev.type === "take_module_top") {
    const id = s.decks.modules.shift();
    if (id !== undefined) {
      s.player.modules.push({ id, ready: true, energy: { Yellow: 0, Red: 0, Blue: 0 } });
      log(c, `take ${moduleDef(c, id).name} from the top of the Module deck`, "7.2");
    }
  }
  s.phase = "command";
  log(c, "the Command phase begins", "7.2");
}

/**
 * The sectors that get one extra tile when the deal is uneven (7.2 step 5).
 * The computer version does not ask: (0,0) and (0,1) first, when they are
 * among the sectors dealt to, then sectors chosen at random from the others.
 */
export function extraTileSectors(s: GameState, targets: SectorKey[], extra: number): SectorKey[] {
  const out = ["0,0", "0,1"].filter((k) => targets.includes(k)).slice(0, extra);
  if (out.length === extra) return out;
  const rest = shuffle(s.rng, targets.filter((k) => !out.includes(k)));
  return [...out, ...rest.slice(0, extra - out.length)];
}

// ---------------------------------------------------------------------------
// 7.3 Allied Drop
// ---------------------------------------------------------------------------

function* alliedDrop(c: RunCtx, lvl: number): Effect {
  const s = c.state;
  // 1. Choose your Ally at the first Allied Drop of the campaign.
  if (!s.sheet.ally) {
    const others = c.data.companies.companies.filter((x) => x.id !== s.player.company);
    const a = yield* ask(c, { kind: "option", always: true, prompt: "Allied Drop: choose your Ally for this campaign.", rule: "7.3", options: others.map((x) => ({ id: x.id, label: `${x.id}: ${x.name}` })) });
    s.sheet.ally = a.value as string;
    log(c, `your Ally: ${a.value}`, "7.3");
  }
  const ally = c.data.companies.byId.get(s.sheet.ally)!;
  // 2. Choose one Mecha your Ally lists, of that Level or lower, with a copy left in the Supply.
  const options: Option[] = ally.startingMecha
    .map((x) => c.data.units.byId.get(x.id)!)
    .filter((u) => typeof u.level === "number" && u.level <= lvl && s.piles.supply.some((t) => s.tiles[t]!.unitId === u.id))
    .map((u) => ({ id: u.id, label: `${u.id} (Level ${u.level}): ${u.text.ability ?? ""}` }));
  if (options.length === 0) {
    log(c, `Allied Drop: no Level ${lvl} or lower Mecha of ${ally.id} is left in the Supply`, "7.3");
    return;
  }
  const pick = (yield* ask(c, { kind: "option", prompt: `Allied Drop - Level ${lvl}: choose a Mecha.`, rule: "7.3", options })).value as string;
  const t = takeFromBox(c, pick)!;
  // 3. Place it face up on top of any Dark sector, facing any direction.
  const dark = sectorKeys(s).filter((k) => isOpenSector(c, k));
  const k = dark.length === 1 ? dark[0]! : ((yield* ask(c, { kind: "sectors", prompt: `Allied Drop: place ${pick} on which Dark sector?`, rule: "7.3", options: dark, min: 1, max: 1 })).value as string[])[0]!;
  const ts = tile(s, t);
  ts.faceUp = true;
  ts.tokens = noTokens();
  if (unitDef(c, t).arrows.length > 0) ts.facing = Number((yield* ask(c, { kind: "option", prompt: `${pick}: choose its facing.`, rule: "3.7", facing: { tile: t, start: 0 }, options: [0, 1, 2, 3, 4, 5].map((f) => ({ id: String(f), label: f === 0 ? "as printed" : `turned ${f} clockwise` })) })).value) as 0;
  s.field[k]!.push(t);
  log(c, `Allied Drop: ${pick} on (${k})`, "7.3");
}

// ---------------------------------------------------------------------------
// 10.2 Upgrades
// ---------------------------------------------------------------------------

const marked = (c: Ctx, id: string) => c.state.sheet.marks[id] ?? 0;
const isFull = (c: Ctx, u: UpgradeDef) => marked(c, u.id) >= u.cost;

/** Can a slot of this upgrade be marked now (10.2: locked, exclusive, fully filled)? */
export function canMark(c: Ctx, u: UpgradeDef): boolean {
  if (isFull(c, u)) return false;
  if (u.state === "locked") {
    const by = company(c).upgrades.find((x) => x.id === u.unlockedBy);
    if (!by || !isFull(c, by)) return false;
  }
  for (const x of u.exclusiveWith) if (marked(c, x) > 0) return false;
  return true;
}

function* spendUpgradePoints(c: RunCtx): Effect {
  const s = c.state;
  for (;;) {
    if (s.sheet.upgradePoints <= 0) break;
    const ups = company(c).upgrades.filter((u) => canMark(c, u));
    if (ups.length === 0) break;
    const a = yield* ask(c, {
      kind: "option",
      prompt: `Upgrade: you have ${s.sheet.upgradePoints} Upgrade point${s.sheet.upgradePoints === 1 ? "" : "s"}. Mark slots on which upgrade?`,
      rule: "10.2",
      options: [...ups.map((u) => ({ id: u.id, label: `${u.id} (${marked(c, u.id)}/${u.cost}): ${u.effect}` })), { id: "done", label: "Done (unspent points are lost)" }],
    });
    if (a.value === "done") {
      // Designer, 2026-11-04: warn that unspent points are lost, and ask the player to agree.
      const ok = yield* ask(c, { kind: "yesno", prompt: `You still have ${s.sheet.upgradePoints} Upgrade point${s.sheet.upgradePoints === 1 ? "" : "s"}. If you finish now, they are lost. Finish anyway?`, rule: "10.1" });
      if (ok.value === true) break;
      continue;
    }
    const u = ups.find((x) => x.id === a.value)!;
    const room = Math.min(u.cost - marked(c, u.id), s.sheet.upgradePoints);
    const n = room === 1 ? 1 : ((yield* ask(c, { kind: "amount", prompt: `${u.id}: mark how many slots?`, rule: "10.2", min: 1, max: room })).value as number);
    s.sheet.marks[u.id] = marked(c, u.id) + n;
    s.sheet.upgradePoints -= n;
    log(c, `${u.id}: ${marked(c, u.id)}/${u.cost} slots marked`, "10.2");
    if (isFull(c, u)) {
      if (u.kind === "requisition") {
        log(c, `${u.id} is fully filled: ${u.effect}`, "10.2");
        yield* ability(u.id)(c, undefined);
        if (u.repeatable) s.sheet.marks[u.id] = 0;
      } else {
        s.sheet.filled.push(u.id);
        log(c, `${u.id} is fully filled: you gain it`, "10.2");
      }
    }
  }
  if (s.sheet.upgradePoints > 0) log(c, `${s.sheet.upgradePoints} unspent Upgrade points are erased`, "10.1");
  s.sheet.upgradePoints = 0;
}

// ---------------------------------------------------------------------------
// 10.1 Mission End
// ---------------------------------------------------------------------------

function* missionEnd(c: RunCtx): Effect {
  const s = c.state;
  const co = company(c);
  // Company Trait at Mission End (V1: remove 1 damage from each Bay).
  if (co.trait && /^At Mission End: Remove 1 damage from each Bay/.test(co.trait)) {
    const printed = printedIntegrity(c);
    s.flagship = s.flagship.map((x, i) => Math.min(printed[i]!, x + 1));
    log(c, `Trait: ${co.trait}`, "5.1");
  }
  // 1. Power Node rewards.
  const nodes = s.piles.trophy.filter((t) => s.tiles[t]!.unitId === "F_01").length;
  s.sheet.upgradePoints += nodes;
  if (nodes) log(c, `${nodes} Power Node${nodes === 1 ? "" : "s"}: ${nodes} Upgrade point${nodes === 1 ? "" : "s"}`, "10.1");
  // 2. Upgrade.
  yield* spendUpgradePoints(c);
  // 3. Clear the Trophy pile.
  s.piles.supply.push(...s.piles.trophy.splice(0));
  // 4. Sort the Discard by border.
  const gyros: TileId[] = [];
  for (const t of s.piles.discard.splice(0)) {
    const d = c.data.units.byId.get(s.tiles[t]!.unitId!)!;
    s.tiles[t]!.faceUp = false;
    s.tiles[t]!.tokens = noTokens();
    if (d.type === "Bot" || d.type === "Mecha") s.piles.missionDeck.push(t);
    else if (d.energyGyro) gyros.push(t);
    else s.piles.supply.push(t);
  }
  // Energy Gyros to the bottom of the Energy deck, face down. Designer, 2026-11-04: in random order (no choice).
  s.piles.energyDeck.push(...shuffle(s.rng, gyros));
  // 5. Clear tokens. 6. Collect the Field.
  for (const k of sectorKeys(s)) {
    for (const t of stack(s, k)) {
      returnTokens(c, t);
      tile(s, t).faceUp = false;
      s.piles.missionDeck.push(t);
    }
    s.field[k] = [];
  }
  // 7. Return all Command tokens (H3: and all Heat tokens).
  s.supply.command += s.player.commandTokens;
  s.player.commandTokens = 0;
  if (s.settings.heatModule) {
    s.supply.heat += s.player.heat;
    s.player.heat = 0;
    log(c, "return all Heat tokens", "H3");
  }
  // 8. Reset Modules.
  for (const m of s.player.modules) {
    for (const col of ENERGY_COLOURS) {
      s.supply.energy[col] += m.energy[col];
      m.energy[col] = 0;
    }
    m.ready = true;
  }
  // 9. Continue.
  s.run.completed.push({ mission: s.mission, threat: [...s.run.threat] });
  s.profile.sheets[co.id] = { ...s.sheet.marks };
  const finalNumber = Math.max(...camp(c).missions.map((x) => x.number));
  if (mission(c).number === finalNumber) {
    s.outcome = { result: "won", reason: "you completed the final mission" };
    s.phase = "gameEnd";
    log(c, "the final mission is complete: Game End", "10.1");
  } else {
    s.phase = "preparation";
    log(c, "on to the next mission", "10.1");
  }
}

// ---------------------------------------------------------------------------
// 10.3 Game End and scoring
// ---------------------------------------------------------------------------

export function score(c: Ctx): { score: number; parts: string[] } {
  const s = c.state;
  const parts: string[] = [];
  let n = 0;
  for (const r of s.run.completed) {
    n += r.threat.length;
    parts.push(`${r.mission}: ${r.threat.length} Threat column${r.threat.length === 1 ? "" : "s"} (+${r.threat.length})`);
  }
  if (s.outcome?.result === "won") {
    n += 5;
    parts.push("the whole campaign completed (+5)");
  }
  if (s.settings.heatModule) {
    n -= 2;
    parts.push("Heat module (-2)");
  }
  return { score: n, parts };
}

function* gameEnd(c: RunCtx): Effect {
  const s = c.state;
  if (s.ending) return;
  const { score: n, parts } = score(c);
  s.ending = { score: n, parts };
  log(c, `Game End: score ${n} (${parts.join("; ") || "nothing completed"})`, "10.3");
  // High scores: the field matching Fresh or Veteran; equal or better writes it. Never in Developer mode.
  if (!s.settings.developerMode) {
    const hs = (s.profile.highScores[s.campaign] ??= {});
    const field = s.run.freshness;
    const cur = hs[field];
    if (cur === undefined || n >= cur.score) {
      hs[field] = { score: n, date: s.run.date };
      s.ending.highScore = field;
      log(c, `new ${field === "fresh" ? "" : "Veteran "}high score: ${n}`, "10.3");
    }
  }
  // Clean up (10.3): the sheet keeps its upgrade marks; Upgrade track, Overhaul slots and Ally are erased.
  s.profile.sheets[s.player.company] = { ...s.sheet.marks };
  s.sheet.upgradePoints = 0;
  s.sheet.overhaulUsed = 0;
  delete s.sheet.ally;
  yield* noop();
}

function* noop(): Effect {}

registerRoot("gameSetup", (c) => gameSetup(c));
registerRoot("missionPreparation", (c) => missionPreparation(c));
registerRoot("missionEnd", (c) => missionEnd(c));
registerRoot("gameEnd", (c) => gameEnd(c));

