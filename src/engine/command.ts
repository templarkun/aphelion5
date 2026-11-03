/**
 * The Command phase (Core Rules 8.1-8.8) and the start of an Overload (9.1).
 *
 * One root effect, "commandStep", does the checks before an action and then
 * one action. The session (session.ts) starts the next step, so each action
 * begins from a fresh checkpoint.
 */

import "../effects/index.js";
import { ability, unitEffect } from "../effects/registry.js";
import { ENERGY_COLOURS } from "../data/units.js";
import { type Effect, type RunCtx, ask, asEffect, log, registerRoot } from "./effect.js";
import { alertedUnits, chooseAlert, discardUnit, resolveAlert } from "./alerts.js";
import { type Ctx, adjacentUnits, canBeChosen, darkSectors, describe, isWreck, sectorKeys, sectorOf, sectorState, tile, unitDef, unitType, units } from "./field.js";
import { commandMecha, commandOptions } from "./mecha.js";
import { canRunModule, moduleDef, runModule } from "./modules.js";
import { putAtBottom, reveal } from "./moves.js";
import type { Option } from "./questions.js";
import type { TileId } from "./state.js";
import { boost, isCrippled, printedIntegrity, returnTokens } from "./tokens.js";

// ---------------------------------------------------------------------------
// Bays (5.2, 8.7)
// ---------------------------------------------------------------------------

export interface BayAbility {
  /** Bay id ("V1_BAY1") for the printed ability, upgrade id for an upgrade. */
  id: string;
  bay: number;
  text: string;
  overload: boolean;
}

/** Every ability of every Bay: printed first, then filled upgrades (10.2). */
export function bayAbilities(c: Ctx): BayAbility[] {
  const co = c.data.companies.byId.get(c.state.player.company)!;
  const out: BayAbility[] = [];
  for (const b of co.bays) {
    out.push({ id: b.id, bay: b.number, text: b.ability, overload: b.ability.startsWith("[Overload]") });
    for (const u of co.upgrades) {
      if (u.part !== "FLAGSHIP_UPGRADES" || !c.state.sheet.filled.includes(u.id)) continue;
      if (!u.appliesTo.includes(`flagship_bay_${b.number}`)) continue;
      const q = /^Bay \d+ gains: "(.*)"$/.exec(u.effect);
      const text = q ? q[1]! : u.effect;
      out.push({ id: u.id, bay: b.number, text, overload: text.startsWith("[Overload]") });
    }
  }
  return out;
}

/** Bay abilities you can use now: Bay at 1+ Integrity, timing tag matches the phase. */
export function usableBayAbilities(c: Ctx): BayAbility[] {
  const inOverload = c.state.phase === "overload";
  return bayAbilities(c).filter((a) => c.state.flagship[a.bay - 1]! >= 1 && a.overload === inOverload);
}

/** Use a Bay (8.7): deal 1 damage to that Bay, then resolve the ability. */
export function* useBay(c: RunCtx, a: BayAbility): Effect {
  c.state.flagship[a.bay - 1]! -= 1;
  log(c, `use Bay ${a.bay} (Integrity ${c.state.flagship[a.bay - 1]}): ${a.text}`, "8.7");
  if (isCrippled(c)) log(c, "Flagship is Crippled", "5.2");
  yield* ability(a.id)(c, undefined);
}

// ---------------------------------------------------------------------------
// Orders (5.6, 8.7)
// ---------------------------------------------------------------------------

export interface OrderOption {
  id: string;
  tokens: number;
  overloadOnly: boolean;
  effect: string;
}

/** The Campaign board's Orders and this mission's Order (5.6). */
export function orders(c: Ctx): OrderOption[] {
  const camp = c.data.campaigns.find((x) => x.prefix === c.state.campaign)!;
  const m = camp.missionById.get(c.state.mission)!;
  return [...camp.orders, ...(m.order ? [m.order] : [])];
}

export function usableOrders(c: Ctx): OrderOption[] {
  const inOverload = c.state.phase === "overload";
  return orders(c).filter((o) => o.overloadOnly === inOverload && c.state.player.commandTokens >= o.tokens);
}

export function* issueOrder(c: RunCtx, o: OrderOption): Effect {
  c.state.player.commandTokens -= o.tokens;
  c.state.supply.command += o.tokens;
  log(c, `issue an Order (${o.tokens} Command token${o.tokens === 1 ? "" : "s"}): ${o.effect}`, "5.6");
  yield* ability(o.id)(c, undefined);
}

// ---------------------------------------------------------------------------
// Drains (4.3, 6.3, 8.7)
// ---------------------------------------------------------------------------

export function drainableGyros(c: Ctx): TileId[] {
  return units(c.state).filter((u) => unitType(c, u) === "Gyro" && !isWreck(c, u));
}

export function bioShieldCarriers(c: Ctx): TileId[] {
  return units(c.state).filter((u) => tile(c.state, u).tokens.bioShield > 0);
}

/** Drain a Gyro (4.3): its Drain effect, then discard it. */
export function* drainGyro(c: RunCtx, id: TileId): Effect {
  log(c, `drain ${describe(c, id)}`, "4.3");
  yield* unitEffect(unitDef(c, id).id, "drain")(c, id);
  discardUnit(c, id, "4.3");
}

/** Drain a Bio-shield (6.3): remove it (no Destroyed effect: no damage removed it), then Boost one adjacent non-Mecha unit. */
export function* drainBioShield(c: RunCtx, id: TileId): Effect {
  const t = tile(c.state, id).tokens;
  t.bioShield -= 1;
  c.state.supply.bioShield += 1;
  log(c, `drain the Bio-shield on ${describe(c, id)}`, "6.3");
  const options = adjacentUnits(c.state, sectorOf(c.state, id)!).filter((u) => canBeChosen(c, u) && unitType(c, u) !== "Mecha");
  if (options.length === 0) {
    log(c, "no adjacent non-Mecha unit to Boost", "6.3");
    return;
  }
  const a = yield* ask(c, { kind: "units", prompt: "Boost one adjacent non-Mecha unit.", rule: "6.3", options, min: 1, max: 1 });
  yield* boost(c, a.value as TileId[], "6.3");
}

// ---------------------------------------------------------------------------
// Overhaul (8.8)
// ---------------------------------------------------------------------------

export function hasOverhaulSlot(c: Ctx): boolean {
  const co = c.data.companies.byId.get(c.state.player.company)!;
  return c.state.sheet.overhaulUsed < co.overhaulSlots;
}

export function* overhaul(c: RunCtx): Effect {
  const co = c.data.companies.byId.get(c.state.player.company)!;
  // 1. Mark one empty slot.
  c.state.sheet.overhaulUsed += 1;
  log(c, `Overhaul (slot ${c.state.sheet.overhaulUsed} of ${co.overhaulSlots})`, "8.8");
  // 2. Remove all damage from the Flagship.
  c.state.flagship = printedIntegrity(c);
  // 3. Refill each colour up to the starting amount (never reduce it).
  for (const col of ENERGY_COLOURS) {
    const want = co.startingEnergy[col] - c.state.player.reserve[col];
    const take = Math.max(0, Math.min(want, c.state.supply.energy[col]));
    c.state.player.reserve[col] += take;
    c.state.supply.energy[col] -= take;
  }
  // 4. One of your Modules to the bottom of the Module deck; take the top two (ready).
  const mods = c.state.player.modules;
  if (mods.length > 0) {
    let out = mods[0]!.id;
    if (mods.length > 1) {
      const a = yield* ask(c, {
        kind: "option",
        prompt: "Overhaul: put one of your Modules on the bottom of the Module deck.",
        rule: "8.8",
        options: mods.map((m) => ({ id: String(m.id), label: moduleDef(c, m.id).name })),
      });
      out = Number(a.value);
    }
    const i = mods.findIndex((m) => m.id === out);
    const [gone] = mods.splice(i, 1);
    for (const col of ENERGY_COLOURS) c.state.supply.energy[col] += gone!.energy[col];
    c.state.decks.modules.push(out);
    log(c, `${moduleDef(c, out).name} goes to the bottom of the Module deck`, "8.8");
  }
  for (let n = 0; n < 2 && c.state.decks.modules.length > 0; n++) {
    const id = c.state.decks.modules.shift()!;
    mods.push({ id, ready: true, energy: { Yellow: 0, Red: 0, Blue: 0 } });
    log(c, `take ${moduleDef(c, id).name}`, "8.8");
  }
  c.state.hiddenInfo += 1;
  // 5. Up to 2 units (not Flares or Wrecks): remove all their tokens and put each at the bottom of its sector.
  const options = units(c.state).filter((u) => canBeChosen(c, u));
  if (options.length > 0) {
    const a = yield* ask(c, { kind: "units", prompt: "Overhaul: choose up to 2 units to put at the bottom of their sectors.", rule: "8.8", options, min: 0, max: Math.min(2, options.length) });
    for (const u of a.value as TileId[]) {
      returnTokens(c, u);
      putAtBottom(c, u, "8.8");
    }
  }
}

// ---------------------------------------------------------------------------
// Objective, losing, Overload start
// ---------------------------------------------------------------------------

/** Is the mission objective met (8.2)? */
export function objectiveMet(c: Ctx): boolean {
  const camp = c.data.campaigns.find((x) => x.prefix === c.state.campaign)!;
  const m = camp.missionById.get(c.state.mission)!;
  const trophy = c.state.piles.trophy.map((id) => c.state.tiles[id]!.unitId);
  if (m.objective.type === "salvage") {
    const nodes = trophy.filter((u) => u === "F_01").length;
    const cleared = sectorKeys(c.state).filter((k) => sectorState(c.state, k) === "cleared").length;
    return nodes >= 5 && cleared >= 3;
  }
  const target = m.objective.target;
  return trophy.filter((u) => u === target).length >= m.objective.count;
}

export function lose(c: Ctx, reason: string, rule: string): void {
  c.state.outcome = { result: "lost", reason };
  c.state.phase = "gameEnd";
  log(c, `you lose: ${reason}`, rule);
}

/** Mission won (8.2): leftover Alert tokens are simply cleared; Mission End follows (stage 7). */
function missionWon(c: Ctx): void {
  for (const u of alertedUnits(c)) tile(c.state, u).tokens.alert = false;
  c.state.phase = "missionEnd";
  log(c, "the mission objective is met: Mission End", "8.2");
}

/** Units with an "At Overload:" trigger (4.2, 9.1). */
function hasAtOverload(c: Ctx, id: TileId): boolean {
  const d = unitDef(c, id);
  if (d.type === "Omega") {
    const camp = c.data.campaigns.find((x) => x.prefix === c.state.campaign)!;
    return camp.omega.find((o) => o.id === d.id)?.atOverload !== undefined;
  }
  return (d.text.ability ?? "").startsWith("At Overload:");
}

/** Start an Overload (9.1): alert every Flare, Sentinel and At Overload unit. */
export function startOverload(c: Ctx): void {
  c.state.overloadPending = false;
  c.state.phase = "overload";
  log(c, "an Overload starts", "9.1");
  for (const u of units(c.state)) {
    const type = unitType(c, u);
    if (type === "Flare" || type === "Sentinel" || hasAtOverload(c, u)) {
      if (!tile(c.state, u).tokens.alert && !isWreck(c, u)) {
        tile(c.state, u).tokens.alert = true;
        log(c, `${describe(c, u)} gets an Alert token`, "9.1");
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The action menu (8.1)
// ---------------------------------------------------------------------------

export type ActionId = "resolveAlerts" | "commandMecha" | "reveal" | "runModule" | "useBay" | "drainGyro" | "drainBioShield" | "issueOrder" | "overhaul";

const ACTION_LABEL: Record<ActionId | "concede", string> = {
  resolveAlerts: "Resolve Alerts",
  commandMecha: "Command a Mecha",
  reveal: "Reveal",
  runModule: "Run a Module",
  useBay: "Use a Bay",
  drainGyro: "Drain a Gyro",
  drainBioShield: "Drain a Bio-shield",
  issueOrder: "Issue an Order",
  overhaul: "Overhaul",
  concede: "Concede",
};

export function mechaUnits(c: Ctx): TileId[] {
  return units(c.state).filter((u) => unitType(c, u) === "Mecha" && commandOptions(c, u, "command").length > 0);
}

/** Every Command phase action you can start now (8.1), in rulebook order. */
export function legalActions(c: Ctx): ActionId[] {
  const out: ActionId[] = [];
  const alerts = alertedUnits(c).length > 0;
  if (alerts) out.push("resolveAlerts");
  if (!alerts) {
    if (mechaUnits(c).length > 0) out.push("commandMecha");
    if (darkSectors(c.state).length > 0) out.push("reveal");
    if (c.state.player.modules.some((m) => canRunModule(c, m.id))) out.push("runModule");
    if (usableBayAbilities(c).length > 0) out.push("useBay");
    if (drainableGyros(c).length > 0) out.push("drainGyro");
    if (bioShieldCarriers(c).length > 0) out.push("drainBioShield");
    if (usableOrders(c).length > 0) out.push("issueOrder");
  }
  if (hasOverhaulSlot(c)) out.push("overhaul");
  return out;
}

function* chooseOne<T>(c: RunCtx, prompt: string, rule: string, items: T[], label: (x: T) => Option): Effect<T> {
  if (items.length === 1) return items[0]!;
  const opts = items.map(label);
  const a = yield* ask(c, { kind: "option", prompt, rule, options: opts });
  return items[opts.findIndex((o) => o.id === a.value)]!;
}

function* doAction(c: RunCtx, action: ActionId): Effect {
  switch (action) {
    case "resolveAlerts":
      // One at a time, in your order, until none are left; an Overload begins as soon as an effect starts one (8.3).
      for (;;) {
        const u = yield* chooseAlert(c);
        if (u === undefined) return;
        yield* resolveAlert(c, u);
        if (c.state.overloadPending) return;
      }
    case "commandMecha": {
      const m = yield* chooseOne(c, "Command which Mecha?", "8.4", mechaUnits(c), (u) => ({ id: u, label: describe(c, u) }));
      yield* commandMecha(c, m, "command");
      return;
    }
    case "reveal": {
      const dark = darkSectors(c.state);
      const a = dark.length === 1 ? dark : ((yield* ask(c, { kind: "sectors", prompt: "Reveal which Dark sector?", rule: "8.5", options: dark, min: 1, max: 1 })).value as string[]);
      yield* reveal(c, a[0]!);
      return;
    }
    case "runModule": {
      const ids = c.state.player.modules.filter((m) => canRunModule(c, m.id)).map((m) => m.id);
      const id = yield* chooseOne(c, "Run which Module?", "8.6", ids, (x) => ({ id: String(x), label: moduleDef(c, x).name }));
      yield* runModule(c, id);
      return;
    }
    case "useBay": {
      const a = yield* chooseOne(c, "Use which Bay ability?", "8.7", usableBayAbilities(c), (x) => ({ id: x.id, label: `Bay ${x.bay}: ${x.text}` }));
      yield* useBay(c, a);
      return;
    }
    case "drainGyro": {
      const g = yield* chooseOne(c, "Drain which Gyro?", "8.7", drainableGyros(c), (u) => ({ id: u, label: describe(c, u) }));
      yield* drainGyro(c, g);
      return;
    }
    case "drainBioShield": {
      const u = yield* chooseOne(c, "Drain the Bio-shield on which unit?", "8.7", bioShieldCarriers(c), (x) => ({ id: x, label: describe(c, x) }));
      yield* drainBioShield(c, u);
      return;
    }
    case "issueOrder": {
      const o = yield* chooseOne(c, "Issue which Order?", "8.7", usableOrders(c), (x) => ({ id: x.id, label: `${x.tokens} Command token${x.tokens === 1 ? "" : "s"}: ${x.effect}` }));
      yield* issueOrder(c, o);
      return;
    }
    case "overhaul":
      yield* overhaul(c);
      return;
  }
}

/** Checks before an action (8.1), then one action. */
export function* commandStep(c: RunCtx): Effect {
  if (c.state.phase !== "command") throw new Error(`commandStep in phase ${c.state.phase}`);
  // 1. Objective.
  if (objectiveMet(c)) {
    missionWon(c);
    return;
  }
  // 2. Flagship.
  let legal: ActionId[];
  if (isCrippled(c)) {
    if (!hasOverhaulSlot(c)) {
      lose(c, "your Flagship is Crippled and you have no empty Overhaul slot", "5.2");
      return;
    }
    legal = ["overhaul"];
  } else {
    legal = legalActions(c);
    if (legal.length === 0) {
      lose(c, "you have no legal action", "8.1");
      return;
    }
  }
  const options: Option[] = [...legal, "concede" as const].map((id) => ({ id, label: ACTION_LABEL[id] }));
  const a = yield* ask(c, { kind: "option", prompt: isCrippled(c) ? "Your Flagship is Crippled: you must Overhaul." : "Choose an action.", rule: "8.1", options });
  if (a.value === "concede") {
    c.state.outcome = { result: "conceded", reason: "you conceded" };
    c.state.phase = "gameEnd";
    log(c, "you concede: the game ends as a loss", "10.3");
    return;
  }
  yield* asEffect(c, doAction(c, a.value as ActionId));
  // An Overload starts once the current effect has finished (9.1).
  if (c.state.overloadPending && c.state.phase === "command") startOverload(c);
}

registerRoot("commandStep", (c) => commandStep(c));

