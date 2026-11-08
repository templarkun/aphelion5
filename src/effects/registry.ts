/**
 * Card effects, one hand-written function per card text (spec "Effects").
 * The engine looks effects up here by id. A card whose effect has not been
 * written yet raises NotBuiltYet, naming the build stage that adds it, so a
 * missing card is never silently skipped.
 */

import type { Effect, RunCtx } from "../engine/effect.js";
import type { Ctx } from "../engine/field.js";
import type { TileId } from "../engine/state.js";

export class NotBuiltYet extends Error {
  constructor(
    readonly card: string,
    readonly what: string,
    readonly stage: number,
  ) {
    super(`${card} ${what} is not built yet (build stage ${stage})`);
    this.name = "NotBuiltYet";
  }
}

/** A unit's effects. `self` is the unit (or its Wreck). */
export interface UnitEffects {
  /** Sentinel, Flare and Sleeper effect, when its Alert resolves. */
  activate?: (c: RunCtx, self: TileId) => Effect;
  /** Gyro Drain effect. */
  drain?: (c: RunCtx, self: TileId) => Effect;
  /** Destroyed effect, resolved from the Wreck's Alert (4.8). */
  destroyed?: (c: RunCtx, self: TileId) => Effect;
  /** Omega "At Overload:" effect. */
  atOverload?: (c: RunCtx, self: TileId) => Effect;
}

/** A Mecha ability, a Bay ability or an Order: what it does when used. */
export type Ability = (c: RunCtx, self: TileId | undefined) => Effect;

export interface ModuleRun {
  id: number;
  /** Energy on this Module before you ran it, by colour (Accumulator Beam, 8.6 example). */
  storedBefore: Record<string, number>;
  /** X chosen as you run it, for X costs. */
  x?: number;
}

export interface ModuleEffects {
  run: (c: RunCtx, m: ModuleRun) => Effect;
  /**
   * Cost after discounts (Module convention 5), for a chosen X when the
   * Module has one. Default: the printed cost. "Your other exhausted
   * Modules" never counts the Module being run.
   */
  cost?: (c: RunCtx, x: number) => number;
  /** An X chosen as you run it (cost_variable): its smallest value. */
  x?: { min: number };
  /** X is the energy of this colour on the Module before you ran it (Accumulator Beam, Point-Defense Phaser). */
  xFromStored?: "Yellow" | "Red" | "Blue";
  /** Its X would surely be 0 now, so it cannot be run (designer 2026-11-08, I8; Core Rules 5.3). */
  xZero?: (c: Ctx) => boolean;
  /**
   * Its extra payment (8.6 step 3), for the screen to offer before you run it:
   * exactly `n` more energy, or (`upTo`) 1 to `n` more.
   */
  extra?: { n: number; upTo?: boolean };
}

const unitFx = new Map<string, UnitEffects>();
const abilityFx = new Map<string, Ability>();
const moduleFx = new Map<number, ModuleEffects>();

export function registerUnit(id: string, fx: UnitEffects): void {
  unitFx.set(id, { ...unitFx.get(id), ...fx });
}

/** Mecha base abilities by unit id; upgrades, Bays and Orders by their own ids. */
export function registerAbility(id: string, fn: Ability): void {
  if (abilityFx.has(id)) throw new Error(`ability ${id} registered twice`);
  abilityFx.set(id, fn);
}

export function registerModule(id: number, fx: ModuleEffects): void {
  moduleFx.set(id, fx);
}

/** Stage that builds each kind of effect (spec "Build stages"). */
const STAGE = { unit: 5, module: 6, ability: 5 } as const;

export function unitEffect<K extends keyof UnitEffects>(unitId: string, kind: K): NonNullable<UnitEffects[K]> {
  const fn = unitFx.get(unitId)?.[kind];
  if (!fn) throw new NotBuiltYet(unitId, kind, STAGE.unit);
  return fn as NonNullable<UnitEffects[K]>;
}

export function ability(id: string): Ability {
  const fn = abilityFx.get(id);
  if (!fn) throw new NotBuiltYet(id, "ability", STAGE.ability);
  return fn;
}

export function hasAbility(id: string): boolean {
  return abilityFx.has(id);
}

export function moduleEffect(id: number): ModuleEffects {
  const fx = moduleFx.get(id);
  if (!fx) throw new NotBuiltYet(`Module ${id}`, "effect", STAGE.module);
  return fx;
}

export function hasModuleEffect(id: number): boolean {
  return moduleFx.has(id);
}
