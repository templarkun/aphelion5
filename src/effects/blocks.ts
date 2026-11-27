/**
 * Effects made from blocks in the Campaign editor, played in a mission playtest (designer
 * 2026-11-27): one general program for every block effect (`src/data/blocks.ts`), and the lookup
 * that decides, for a Campaign made in the editor, which program an Order or an Omega effect runs:
 * its blocks, an effect already programmed (the same words as one of Campaign 1's), or nothing
 * (written as text: "needs programming", skipped with a log line; designer 2026-11-27).
 *
 * The words of each step are the card words the editor writes (`stepText` in editor/model.ts);
 * the rules they call are the game's own building blocks (6.1 damage, 6.2 Boost, 6.3 Bio-shield,
 * 6.4 Barrier, 6.6 Fuse tokens, 5.2 Flagship, 5.4 energy, glossary Swap and Teleport).
 */

import type { BlockEffect, Kind, Step, Target } from "../data/blocks.js";
import type { PlayFx } from "../data/campaign.js";
import { type Effect, type RunCtx, log } from "../engine/effect.js";
import { type Ctx, canBeChosen, choosableUnits, isUnit, level, sectorKeys, sectorOf, tile, unitType } from "../engine/field.js";
import { isOpenSector, swap, teleport } from "../engine/moves.js";
import type { TileId } from "../engine/state.js";
import { boost, damageFlagship, dealHit, destroy, gainEnergy, loseEnergy, placeBarrier, placeBioShield, placeFuse, repairFlagship, tokenEvent } from "../engine/tokens.js";
import { chooseSector } from "./helpers.js";
import { adjacentTo, chooseOneOf, chooseRow, chooseUnits, horizontalRows, rowsThrough, unitsIn } from "./kit.js";
import { type Ability, ability, noUnitFits, unitEffect } from "./registry.js";

const OMEGA_OF: Partial<Record<Kind, string>> = { "Alpha unit": "O_01", "Beta unit": "O_02", "Gamma unit": "O_03" };

/** Does a unit fit a block's kind, Level and damage state (not where it stands)? */
export function fitsKind(c: Ctx, u: TileId, k: Kind): boolean {
  const type = unitType(c, u);
  switch (k) {
    case "unit":
      return true;
    case "non-Mecha unit":
      return type !== "Mecha";
    case "non-Bot unit":
      return type !== "Bot";
    case "Omega unit":
      return type === "Omega";
    case "Alpha unit":
    case "Beta unit":
    case "Gamma unit":
      return tile(c.state, u).unitId === OMEGA_OF[k];
    default:
      return type === k;
  }
}

function fits(c: Ctx, u: TileId, t: Target, self: TileId | undefined): boolean {
  if (t.other && u === self) return false;
  if (!fitsKind(c, u, t.kind)) return false;
  if (t.level && level(c, u) !== t.level) return false;
  const dmg = tile(c.state, u).tokens.damage;
  if (t.state === "damaged" && dmg === 0) return false;
  if (t.state === "undamaged" && dmg > 0) return false;
  return true;
}

const plural = (k: Kind) => (k === "Mecha" ? "Mecha" : `${k}s`);
const NUM = ["zero", "one", "two", "three", "four", "five"];

/** "Deal 2 damage to which Sentinel?" - the question's words, so the unit bubbles read the verb (UnitPicks `verbOf`). */
function prompt(s: Step, many: number): string {
  const which = many > 1 ? `which ${NUM[many] ?? many} ${plural(s.target.kind)}` : `which ${s.target.kind}`;
  switch (s.verb) {
    case "damage":
      return `Deal ${Math.max(1, s.n)} damage to ${which}?`;
    case "destroy":
      return `Destroy ${which}?`;
    case "boost":
      return `Boost ${which}?`;
    case "place":
      return `Place ${s.token === "Shield" ? "a Shield token" : `a ${s.token ?? "Shield"}`} on ${which}?`;
    case "swap":
      return `Swap ${which}?`;
    case "teleport":
      return `Teleport ${which} to a Dark sector?`;
    default:
      return `Choose ${which}.`;
  }
}

/** The units a step's target means now: asks for "one", "N different", and rows; "all" and "this" ask nothing. */
function* targets(c: RunCtx, s: Step, self: TileId | undefined, rule: string): Effect<TileId[]> {
  const t = s.target;
  if (t.count === "this") return self !== undefined && canBeChosen(c, self) ? [self] : [];
  let pool = choosableUnits(c, (u) => fits(c, u, t, self));
  if (t.where === "adjacent" || t.where === "rowThrough") {
    if (self === undefined || !isUnit(c.state, self)) {
      log(c, `${rule}: "${t.where === "adjacent" ? "adjacent" : "in a row through this unit"}" has no unit to count from`, rule);
      return [];
    }
  }
  if (t.where === "adjacent") {
    const around = new Set(adjacentTo(c, sectorOf(c.state, self!)!));
    pool = pool.filter((u) => around.has(u));
  } else if (t.where === "rowThrough" || t.where === "rowChoice") {
    const rows = t.where === "rowThrough" ? rowsThrough(c, self!) : horizontalRows(c);
    const row = yield* chooseRow(c, t.where === "rowThrough" ? `${rule}: choose a row through this unit.` : `${rule}: choose a horizontal row.`, rule, rows);
    if (!row) return [];
    const inRow = new Set(unitsIn(c, row.sectors));
    pool = pool.filter((u) => inRow.has(u));
  }
  if (t.count === "all") return pool;
  if (t.count === "one") {
    const u = yield* chooseOneOf(c, `${rule}: ${prompt(s, 1)}`, rule, pool);
    return u === undefined ? [] : [u];
  }
  return yield* chooseUnits(c, `${rule}: ${prompt(s, t.count)}`, rule, pool, t.count);
}

const colourOf = (s: Step) => (s.colour ? s.colour : undefined);

function* step(c: RunCtx, s: Step, self: TileId | undefined, rule: string): Effect {
  const n = Math.max(1, s.n);
  switch (s.verb) {
    case "flagshipDamage":
      return yield* damageFlagship(c, n, rule);
    case "flagshipRepair":
      return yield* repairFlagship(c, n, rule);
    case "gainEnergy":
      return yield* gainEnergy(c, n, colourOf(s), rule);
    case "loseEnergy":
      return yield* loseEnergy(c, n, colourOf(s), rule);
    case "gainCommand": {
      const x = Math.min(n, c.state.supply.command);
      c.state.supply.command -= x;
      c.state.player.commandTokens += x;
      return log(c, `gain ${x} Command token${x === 1 ? "" : "s"}`, rule);
    }
    case "loseCommand": {
      const x = Math.min(n, c.state.player.commandTokens);
      c.state.player.commandTokens -= x;
      c.state.supply.command += x;
      return log(c, `lose ${x} Command token${x === 1 ? "" : "s"}`, rule);
    }
    default:
      break;
  }
  const us = yield* targets(c, s, self, rule);
  if (us.length === 0) return log(c, `${rule}: no unit fits "${s.verb}", skipped`, rule);
  switch (s.verb) {
    case "damage":
      // One hit each, units counted when it starts (E4).
      for (const u of us) if (isUnit(c.state, u)) yield* dealHit(c, u, n, rule);
      return;
    case "destroy":
      for (const u of us) if (isUnit(c.state, u)) destroy(c, u, rule);
      return;
    case "boost":
      return yield* boost(c, us, rule);
    case "place":
      for (const u of us) placeToken(c, u, s.token ?? "Shield", rule);
      return;
    case "swap":
      for (const u of us) {
        const o = yield* chooseOneOf(c, `${rule}: Swap it with which unit?`, rule, choosableUnits(c, (x) => x !== u));
        if (o !== undefined) swap(c, u, o, rule);
      }
      return;
    case "teleport":
      for (const u of us) {
        const to = yield* chooseSector(c, `${rule}: Teleport it to which Dark sector?`, rule, sectorKeys(c.state).filter((k) => isOpenSector(c, k)));
        if (to !== undefined) teleport(c, u, to, rule);
      }
      return;
  }
}

/** "Place a Shield" (not a Boost: no Damage removed, no Flagship damage when none is left, 6.7). */
function placeToken(c: RunCtx, u: TileId, token: NonNullable<Step["token"]>, rule: string): void {
  if (!canBeChosen(c, u)) return;
  switch (token) {
    case "Shield":
      if (c.state.supply.shield === 0) return log(c, "no Shield token left", "6.7");
      tile(c.state, u).tokens.shield += 1;
      c.state.supply.shield -= 1;
      tokenEvent(c, u, "shield", rule);
      return log(c, `a Shield on ${tile(c.state, u).unitId}`, rule);
    case "Bio-shield":
      placeBioShield(c, u);
      return;
    case "Barrier":
      placeBarrier(c, u, rule);
      return;
    case "Tick":
      placeFuse(c, u, "tick", rule);
      return;
    case "Mortar":
      placeFuse(c, u, "mortar", rule);
      return;
    case "Feedback":
      placeFuse(c, u, "feedback", rule);
      return;
  }
}

/** Play an effect made from blocks; `self` is the Omega unit (an Order has none). */
export function* runBlocks(c: RunCtx, e: BlockEffect, self: TileId | undefined, rule: string): Effect {
  if (e.when?.adjacentTo) {
    const k = self !== undefined ? sectorOf(c.state, self) : undefined;
    const near = k !== undefined && adjacentTo(c, k).some((u) => fitsKind(c, u, e.when!.adjacentTo as Kind));
    if (!near) return log(c, `${rule}: not adjacent to a ${e.when.adjacentTo}`, rule);
  }
  for (const s of e.steps) yield* step(c, s, self, rule);
}

/** An Order made from blocks that targets units, with no unit that fits any of its targets (round 7, I9). */
export function blocksHaveNoUnit(c: Ctx, e: BlockEffect): boolean {
  const aimed = e.steps.filter((s) => !["flagshipDamage", "flagshipRepair", "gainEnergy", "loseEnergy", "gainCommand", "loseCommand"].includes(s.verb));
  if (aimed.length === 0 || aimed.length < e.steps.length) return false;
  return aimed.every((s) => choosableUnits(c, (u) => fits(c, u, s.target, undefined)).length === 0);
}

// ---------------------------------------------------------------------------
// Which program an Order or Omega effect runs.

const playOf = (c: Ctx) => c.data.campaigns.find((x) => x.prefix === c.state.campaign)?.play;

function skipped(id: string, text: string): Ability {
  return function* (c) {
    log(c, `${id}: "${text}" is written as text (needs programming): skipped in the playtest`, id);
  };
}

function fromPlay(fx: PlayFx, id: string, programmed: () => Ability): Ability {
  if (fx.kind === "blocks") return (c, self) => runBlocks(c, fx.effect, self, id);
  if (fx.kind === "skip") return skipped(id, fx.text);
  return programmed();
}

/** The Order's program: its blocks in a playtest Campaign, else the one registered under its id. */
export function orderAbility(c: Ctx, id: string): Ability {
  const fx = playOf(c)?.orders[id];
  return fx ? fromPlay(fx, id, () => ability(fx.kind === "programmed" ? fx.id : id)) : ability(id);
}

export function orderHasNoUnit(c: Ctx, id: string): boolean {
  const fx = playOf(c)?.orders[id];
  if (!fx) return noUnitFits(c, id);
  if (fx.kind === "blocks") return blocksHaveNoUnit(c, fx.effect);
  if (fx.kind === "programmed") return noUnitFits(c, fx.id);
  return false;
}

/** An Omega unit's Destroyed or At Overload program in this Campaign. */
export function omegaEffect(c: Ctx, unitId: string, kind: "destroyed" | "atOverload"): (c: RunCtx, self: TileId) => Effect {
  const play = playOf(c);
  if (!play) return unitEffect(unitId, kind);
  const fx = play.omega[unitId]?.[kind];
  if (!fx) return function* (cc) {
    log(cc, `${unitId}: no ${kind === "destroyed" ? "Destroyed" : "At Overload"} effect in this Campaign`, unitId);
  };
  if (fx.kind === "programmed") return unitEffect(fx.id, kind);
  return fromPlay(fx, unitId, () => ability(unitId));
}
