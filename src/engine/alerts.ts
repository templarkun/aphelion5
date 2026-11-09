/**
 * Resolving Alert tokens (Core Rules 6.5, 8.3, 9.2, 4.8, 11.1 rule 6).
 * Removing the token and carrying out the unit's effect.
 */

import { unitEffect } from "../effects/registry.js";
import { ENERGY_COLOURS } from "../data/units.js";
import { type Effect, type RunCtx, ask, asEffect, log } from "./effect.js";
import { gainHeat } from "./heat.js";
import type { Option } from "./questions.js";
import { type Ctx, describe, isUnit, isWreck, sectorOf, tile, unitDef, unitType, units } from "./field.js";
import { emit } from "./events.js";
import { commandMecha } from "./mecha.js";
import { placeWaitingFlareEnergy } from "./moves.js";
import type { TileId } from "./state.js";
import { afterTopTileLeaves, removeFromField, removeWreck } from "./tokens.js";

export function alertedUnits(c: Ctx): TileId[] {
  return units(c.state).filter((u) => tile(c.state, u).tokens.alert);
}

/** Discard a unit after its effect (Gyro after Drain 4.3, Sleeper after its effect 4.4). */
export function discardUnit(c: Ctx, id: TileId, rule: string): void {
  if (!isUnit(c.state, id)) return;
  log(c, `${describe(c, id)} is discarded`, rule);
  const k = removeFromField(c, id, "discard");
  afterTopTileLeaves(c, k);
}

/**
 * Trial rule (designer 2026-11-08): a Power Node's energy waits on it from its
 * Reveal; with the Heat module, energy or 3 Heat (H4) is chosen when its Alert
 * is resolved, not when it is revealed.
 */
export function powerNodeWaits(c: Ctx, id: TileId): boolean {
  const s = c.state.settings;
  return !!s.trialFlareEnergy && !s.powerNodeAtReveal && unitDef(c, id).id === "F_01" && !isWreck(c, id) && tile(c.state, id).energy !== undefined;
}

/** "alert:<tile>" or "alert:<tile>|energy" / "|heat" (a Power Node's choice made on the same tap). */
export function splitAlertId(rest: string): [TileId, "energy" | "heat" | undefined] {
  const i = rest.lastIndexOf("|");
  if (i < 0) return [rest, undefined];
  const ch = rest.slice(i + 1);
  return [rest.slice(0, i), ch === "heat" ? "heat" : "energy"];
}

/** The Alert entries of an action menu on the units (shortcuts): a waiting Power Node offers its energy and, with the Heat module, 3 Heat. */
export function alertShortcuts(c: Ctx): Option[] {
  const out: Option[] = [];
  for (const u of alertedUnits(c)) {
    if (powerNodeWaits(c, u)) {
      const e = tile(c.state, u).energy!;
      const chips = ENERGY_COLOURS.flatMap((col) => Array.from({ length: e[col] }, () => col));
      const what = chips.length ? chips.join(", ") : "nothing (the Supply was empty)";
      out.push({ id: c.state.settings.heatModule ? `alert:${u}|energy` : `alert:${u}`, label: `Gain ${what}`, on: { kind: "unit", id: u }, chips });
      if (c.state.settings.heatModule) out.push({ id: `alert:${u}|heat`, label: "Gain 3 Heat", on: { kind: "unit", id: u }, chips: ["Heat", "Heat", "Heat"] });
      continue;
    }
    out.push({ id: `alert:${u}`, label: `Resolve the Alert${isWreck(c, u) ? " (Wreck)" : ""}`, on: { kind: "unit", id: u } });
  }
  return out;
}

/** Resolve one unit's Alert token: remove it and carry out the effect (6.5). `choice`: a waiting Power Node's energy or Heat, if already chosen. */
export function* resolveAlert(c: RunCtx, id: TileId, choice?: "energy" | "heat"): Effect {
  const t = tile(c.state, id).tokens;
  if (!t.alert) throw new Error(`${id} has no Alert token`);
  t.alert = false;
  const d = unitDef(c, id);
  log(c, `resolve ${describe(c, id)}`, "6.5");
  const type = unitType(c, id);
  emit(c, { kind: "activated", tile: id, unitId: d.id, type, sector: sectorOf(c.state, id)!, how: type === "Gyro" && !isWreck(c, id) ? "drain" : "alert" });
  yield* asEffect(c, alertEffect(c, id, d.id, choice));
}

function* alertEffect(c: RunCtx, id: TileId, unitId: string, choice?: "energy" | "heat"): Effect {
  // A Wreck: its Destroyed effect, then it leaves (4.8).
  if (isWreck(c, id)) {
    yield* unitEffect(unitId, "destroyed")(c, id);
    if (isUnit(c.state, id)) removeWreck(c, id);
    return;
  }
  switch (unitType(c, id)) {
    case "Mecha":
      // An alerted Mecha must be Commanded, ignoring timing tags (4.2).
      yield* commandMecha(c, id, "alert");
      return;
    case "Gyro":
      // Activated to Drain (11.1 rule 6): Drain, then discard.
      yield* unitEffect(unitId, "drain")(c, id);
      discardUnit(c, id, "4.3");
      return;
    case "Sleeper":
      yield* unitEffect(unitId, "activate")(c, id);
      discardUnit(c, id, "4.4");
      return;
    case "Sentinel":
      yield* unitEffect(unitId, "activate")(c, id);
      return;
    case "Flare":
      // Trial rule with the Heat module: a Power Node gives its waiting energy or 3 Heat (H4).
      if (c.state.settings.heatModule && powerNodeWaits(c, id)) {
        const pick =
          choice ??
          ((yield* ask(c, {
            kind: "option",
            prompt: "Power Node: gain its energy or 3 Heat?",
            rule: "H4",
            options: [
              { id: "energy", label: "Gain its energy", on: { kind: "unit", id }, chips: ENERGY_COLOURS.flatMap((col) => Array.from({ length: tile(c.state, id).energy![col] }, () => col)) },
              { id: "heat", label: "Gain 3 Heat", on: { kind: "unit", id }, chips: ["Heat", "Heat", "Heat"] },
            ],
          })).value as string);
        if (pick === "heat") {
          const t = tile(c.state, id);
          for (const col of ENERGY_COLOURS) c.state.supply.energy[col] += t.energy![col];
          delete t.energy;
          log(c, `${describe(c, id)}: its energy goes back to the Supply`, "H4");
          gainHeat(c, 3, "H4");
          return;
        }
      }
      // A Power Node has no effect (4.6). Flares stay until Overload End.
      if (unitDef(c, id).text.activate !== "none") yield* unitEffect(unitId, "activate")(c, id);
      // Trial rule (I2): then its waiting energy is placed.
      yield* placeWaitingFlareEnergy(c, id);
      return;
    case "Omega":
      yield* unitEffect(unitId, "atOverload")(c, id);
      return;
    case "Bot":
      throw new Error(`${id}: a Bot has no effect to resolve`);
  }
}

/** Pick one alerted unit, in the player's order (8.3, 11.1 rule 4). */
export function* chooseAlert(c: RunCtx): Effect<TileId | undefined> {
  const list = alertedUnits(c);
  if (list.length === 0) return undefined;
  if (list.length === 1) return list[0]!;
  const a = yield* ask(c, {
    kind: "order",
    pick: "units",
    prompt: "Which Alert do you resolve next?",
    rule: "8.3",
    options: list.map((u) => ({ id: u, label: describe(c, u) })),
  });
  return a.value as TileId;
}
