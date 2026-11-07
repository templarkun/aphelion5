/**
 * Resolving Alert tokens (Core Rules 6.5, 8.3, 9.2, 4.8, 11.1 rule 6).
 * Removing the token and carrying out the unit's effect.
 */

import { unitEffect } from "../effects/registry.js";
import { type Effect, type RunCtx, ask, asEffect, log } from "./effect.js";
import { type Ctx, describe, isUnit, isWreck, tile, unitDef, unitType, units } from "./field.js";
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

/** Resolve one unit's Alert token: remove it and carry out the effect (6.5). */
export function* resolveAlert(c: RunCtx, id: TileId): Effect {
  const t = tile(c.state, id).tokens;
  if (!t.alert) throw new Error(`${id} has no Alert token`);
  t.alert = false;
  const d = unitDef(c, id);
  log(c, `resolve ${describe(c, id)}`, "6.5");
  yield* asEffect(c, alertEffect(c, id, d.id));
}

function* alertEffect(c: RunCtx, id: TileId, unitId: string): Effect {
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
