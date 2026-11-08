/**
 * Overloads (Core Rules 9.2 During an Overload, 9.3 Overload End) and
 * Anomaly cards (5.5). The start of an Overload (9.1) is in command.ts,
 * because it happens at the end of a Command phase action.
 *
 * Two root effects, alongside "commandStep":
 * - "overloadStep": one Overload action (9.2), or ending the Overload;
 * - "overloadEnd": Overload End steps 1-5 (9.3), then back to the Command phase.
 */

import type { AnomalyDef, AnomalyTerm } from "../data/anomalies.js";
import { type Effect, type RunCtx, ask, asEffect, log, registerRoot } from "./effect.js";
import { alertedUnits, resolveAlert } from "./alerts.js";
import {
  ACTION_LABEL,
  type OrderOption,
  type BayAbility,
  chooseOne,
  concede,
  issueOrder,
  mechaUnits,
  splitShortcut,
  usableBayAbilities,
  usableOrders,
  useBay,
} from "./command.js";
import { type Ctx, describe, isFlare, isWreck, sectorKeys, sectorState, stack, topTileId, unitDef, unitType, units } from "./field.js";
import { commandMecha, commandOptions } from "./mecha.js";
import { canRunModule, moduleDef, runModule } from "./modules.js";
import type { Option } from "./questions.js";
import type { TileId } from "./state.js";
import { afterTopTileLeaves, dealHit, gainEnergy, removeFromField, repairFlagship, setOffFuses } from "./tokens.js";
import { meltdown } from "./heat.js";

// ---------------------------------------------------------------------------
// During an Overload (9.2)
// ---------------------------------------------------------------------------

export type OverloadActionId = "runModule" | "commandMecha" | "useBay" | "issueOrder" | "endOverload";

/**
 * The Overload action menu (9.2), in rulebook order. Each Alert is its own
 * entry ("alert:<tile>"), so the player picks which one to resolve. Attack,
 * Scrap, Reveal, Drain and Overhaul are never actions here.
 */
export function overloadMenu(c: Ctx): Option[] {
  const out: Option[] = [];
  const alerts = alertedUnits(c);
  for (const u of alerts) out.push({ id: `alert:${u}`, label: `Resolve the Alert on ${describe(c, u)}${isWreck(c, u) ? " (Wreck)" : ""}` });
  if (c.state.player.modules.some((m) => canRunModule(c, m.id))) out.push({ id: "runModule", label: "Run a red Module" });
  if (mechaUnits(c, "overload").length > 0) out.push({ id: "commandMecha", label: "Command a Mecha ([Overload] ability)" });
  if (usableBayAbilities(c).length > 0) out.push({ id: "useBay", label: "Use a Bay ([Overload] ability)" });
  if (usableOrders(c).length > 0) out.push({ id: "issueOrder", label: "Issue an [Overload] Order" });
  // Ending the Overload: only once no Alert tokens remain (9.2).
  if (alerts.length === 0) out.push({ id: "endOverload", label: "End the Overload" });
  out.push({ id: "concede", label: ACTION_LABEL.concede });
  return out;
}

function* doOverloadAction(c: RunCtx, id: string): Effect {
  if (id.startsWith("alert:")) {
    yield* resolveAlert(c, id.slice("alert:".length));
    return;
  }
  switch (id as OverloadActionId) {
    case "runModule": {
      const ids = c.state.player.modules.filter((m) => canRunModule(c, m.id)).map((m) => m.id);
      const m = yield* chooseOne(c, "Run which red Module?", "9.2", ids, (x) => ({ id: String(x), label: moduleDef(c, x).name }));
      yield* runModule(c, m);
      return;
    }
    case "commandMecha": {
      const m = yield* chooseOne(c, "Command which Mecha?", "9.2", mechaUnits(c, "overload"), (u) => ({ id: u, label: describe(c, u) }));
      yield* commandMecha(c, m, "overload");
      return;
    }
    case "useBay": {
      const b = yield* chooseOne<BayAbility>(c, "Use which Bay ability?", "9.2", usableBayAbilities(c), (x) => ({ id: x.id, label: `Bay ${x.bay}: ${x.text}` }));
      yield* useBay(c, b);
      return;
    }
    case "issueOrder": {
      const o = yield* chooseOne<OrderOption>(c, "Issue which Order?", "9.2", usableOrders(c), (x) => ({
        id: x.id,
        label: `${x.tokens} Command token${x.tokens === 1 ? "" : "s"}: ${x.effect}`,
      }));
      yield* issueOrder(c, o);
      return;
    }
    case "endOverload":
      throw new Error("endOverload is handled by overloadStep");
  }
}

/**
 * One Overload action (9.2). The objective is not checked here (8.2), and a
 * Crippled Flagship does not stop play (5.2). There is always a legal
 * action: an Alert to resolve, or End the Overload.
 */
export function* overloadStep(c: RunCtx): Effect {
  if (c.state.phase !== "overload") throw new Error(`overloadStep in phase ${c.state.phase}`);
  const options = overloadMenu(c);
  const a = yield* ask(c, { kind: "option", prompt: "Overload: choose an action.", rule: "9.2", options, shortcuts: overloadShortcuts(c) });
  const id = a.value as string;
  if (id === "concede") {
    concede(c);
    return;
  }
  if (id === "endOverload") {
    c.state.phase = "overloadEnd";
    log(c, "you end the Overload: Overload End", "9.2");
    return;
  }
  yield* asEffect(c, options.some((o) => o.id === id) ? doOverloadAction(c, id) : doOverloadShortcut(c, id));
}

/** The Overload menu spelled out to its targets (9.2), for the screen; same checks as the menu. */
export function overloadShortcuts(c: Ctx): Option[] {
  const out: Option[] = [];
  const alerts = alertedUnits(c);
  for (const u of alerts) out.push({ id: `alert:${u}`, label: `Resolve the Alert${isWreck(c, u) ? " (Wreck)" : ""}`, on: { kind: "unit", id: u } });
  for (const m of c.state.player.modules) if (canRunModule(c, m.id)) out.push({ id: `module:${m.id}`, label: `Run ${moduleDef(c, m.id).name}`, on: { kind: "module", id: m.id } });
  for (const u of mechaUnits(c, "overload")) for (const o of commandOptions(c, u, "overload")) out.push({ id: `mecha:${u}:${o.id}`, label: o.label, on: { kind: "unit", id: u } });
  for (const b of usableBayAbilities(c)) out.push({ id: `bay:${b.id}`, label: `Bay ${b.bay}: ${b.text}`, on: { kind: "bay", bay: b.bay, ability: b.id } });
  for (const o of usableOrders(c)) out.push({ id: `order:${o.id}`, label: o.effect, on: { kind: "order", id: o.id } });
  if (alerts.length === 0) out.push({ id: "endOverload", label: "End the Overload", on: { kind: "game" } });
  out.push({ id: "concede", label: ACTION_LABEL.concede, on: { kind: "game" } });
  return out;
}

function* doOverloadShortcut(c: RunCtx, id: string): Effect {
  const [kind, x, choice] = splitShortcut(id);
  switch (kind) {
    case "module":
      yield* runModule(c, Number(x));
      return;
    case "mecha":
      yield* commandMecha(c, x, "overload", choice);
      return;
    case "bay":
      yield* useBay(c, usableBayAbilities(c).find((b) => b.id === x)!);
      return;
    case "order":
      yield* issueOrder(c, usableOrders(c).find((o) => o.id === x)!);
      return;
  }
  throw new Error(`unknown shortcut ${id}`);
}

// ---------------------------------------------------------------------------
// Anomaly cards (5.5, 9.3 step 3; "Anomaly list.txt")
// ---------------------------------------------------------------------------

const TYPE_TERMS = ["Bot", "Mecha", "Sentinel", "Gyro", "Sleeper", "Flare"] as const;

/** How many of one term are on the Field now. Wrecks and Flares count as units of their type. */
export function countTerm(c: Ctx, term: AnomalyTerm): number {
  if (term === "Cleared sector") return sectorKeys(c.state).filter((k) => sectorState(c.state, k) === "cleared").length;
  if (term === "non-Bot unit") return units(c.state).filter((u) => unitType(c, u) !== "Bot").length;
  if ((TYPE_TERMS as readonly string[]).includes(term)) return units(c.state).filter((u) => unitType(c, u) === term).length;
  throw new Error(`unknown Anomaly term ${term}`);
}

/** The total an Anomaly counts: all its terms added together. */
export function anomalyTotal(c: Ctx, a: AnomalyDef): number {
  return a.terms.reduce((n, t) => n + countTerm(c, t), 0);
}

export function anomalyDef(c: Ctx, id: string): AnomalyDef {
  const a = c.data.anomalies.byId.get(id);
  if (!a) throw new Error(`no Anomaly ${id}`);
  return a;
}

/** Your Anomaly cards whose requirement is met right now (5.5). */
export function metAnomalies(c: Ctx): string[] {
  return c.state.player.anomalies.filter((id) => {
    const a = anomalyDef(c, id);
    return anomalyTotal(c, a) >= a.minimum;
  });
}

export const ANOMALY_REWARDS: Option[] = [
  { id: "repair", label: "Remove 3 damage from your Flagship" },
  { id: "energy", label: "Take 6 energy in any mix of colours" },
  { id: "upgrade", label: "Gain 6 Upgrade points" },
];

/**
 * Overload End step 3: if any card is met, you may choose one (or none),
 * put it at the bottom of the deck and choose one reward. Using none was
 * the designer's decision of 2026-11-03 (Core Rules master rev 131).
 */
function* anomalyStep(c: RunCtx): Effect {
  const met = metAnomalies(c);
  if (met.length === 0) {
    log(c, "no Anomaly card is met", "9.3");
    return;
  }
  const a = yield* ask(c, {
    kind: "option",
    prompt: "Anomaly: choose one of your met cards, or none.",
    rule: "9.3",
    options: [...met.map((id) => ({ id, label: `Anomaly ${id}: ${anomalyDef(c, id).text}`, on: { kind: "anomaly" as const, id } })), { id: "none", label: "None: keep all your cards, no reward" }],
  });
  const card = a.value as string;
  if (card === "none") {
    log(c, "you use no Anomaly card", "9.3");
    return;
  }
  c.state.player.anomalies.splice(c.state.player.anomalies.indexOf(card), 1);
  c.state.decks.anomalies.push(card);
  log(c, `Anomaly ${card} is met: it goes to the bottom of the Anomaly deck`, "9.3");
  const r = yield* ask(c, { kind: "option", prompt: `Anomaly ${card}: choose your reward.`, rule: "9.3", options: ANOMALY_REWARDS });
  switch (r.value) {
    case "repair":
      yield* repairFlagship(c, 3, "9.3");
      return;
    case "energy":
      yield* gainEnergy(c, 6, undefined, "9.3");
      return;
    case "upgrade":
      c.state.sheet.upgradePoints += 6;
      log(c, `gain 6 Upgrade points (Upgrade track ${c.state.sheet.upgradePoints})`, "9.3");
      return;
  }
}

// ---------------------------------------------------------------------------
// Overload End (9.3)
// ---------------------------------------------------------------------------

/** Step 2: every unit alone on its sector plate takes 1 damage; Omega immune; Flares and Wrecks ignore it. */
function* exposure(c: RunCtx): Effect {
  const alone = units(c.state).filter((u) => {
    const k = sectorKeyOf(c, u);
    return stack(c.state, k).length === 1 && unitType(c, u) !== "Omega" && !isFlare(c, u) && !isWreck(c, u);
  });
  if (alone.length === 0) log(c, "Exposure: no unit stands alone on its plate", "9.3");
  for (const u of alone) {
    log(c, `Exposure: ${describe(c, u)} stands alone on its plate`, "9.3");
    yield* dealHit(c, u, 1, "9.3");
  }
}

function sectorKeyOf(c: Ctx, u: TileId): string {
  for (const k of sectorKeys(c.state)) if (topTileId(c.state, k) === u) return k;
  throw new Error(`${u} is not a unit`);
}

/** Power Nodes go to the Trophy pile; every other Flare to the Discard (4.6). */
function isPowerNode(c: Ctx, u: TileId): boolean {
  return (unitDef(c, u).fields["removal_exception"] ?? "").includes("Trophy");
}

/**
 * Step 4: remove every Flare unit. A Flare uncovered by this step is removed
 * too, so no Flare is left on the Field (designer, open question Q3).
 */
function clearFlares(c: Ctx): void {
  let flares = units(c.state).filter((u) => isFlare(c, u));
  if (flares.length === 0) log(c, "no Flare on the Field", "9.3");
  while (flares.length > 0) {
    for (const f of flares) {
      const pile = isPowerNode(c, f) ? "trophy" : "discard";
      log(c, `${describe(c, f)} goes to the ${pile === "trophy" ? "Trophy pile" : "Discard"}`, "9.3");
      const k = removeFromField(c, f, pile);
      afterTopTileLeaves(c, k);
    }
    flares = units(c.state).filter((u) => isFlare(c, u));
  }
}

/** Overload End, steps 1-5 (9.3). */
export function* overloadEnd(c: RunCtx): Effect {
  if (c.state.phase !== "overloadEnd") throw new Error(`overloadEnd in phase ${c.state.phase}`);
  log(c, "Overload End, step 1: Fuse tokens", "9.3");
  yield* setOffFuses(c);
  log(c, "Overload End, step 2: Exposure", "9.3");
  yield* asEffect(c, exposure(c));
  log(c, "Overload End, step 3: Anomaly", "9.3");
  yield* asEffect(c, anomalyStep(c));
  log(c, "Overload End, step 4: clear Flares", "9.3");
  clearFlares(c);
  // H7 Meltdown: after step 4, before step 5.
  if (c.state.settings.heatModule) yield* asEffect(c, meltdown(c));
  // Step 5: back to the Command phase. Alerts made during these steps are resolved there.
  c.state.phase = "command";
  log(c, "Overload End, step 5: return to the Command phase", "9.3");
}

registerRoot("overloadStep", (c) => overloadStep(c));
registerRoot("overloadEnd", (c) => overloadEnd(c));
