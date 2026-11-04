/**
 * Running a Module (Core Rules 5.3, 8.6): use stored energy, pay the rest
 * from the Reserve, resolve, exhaust, clean up. The Module's own effect and
 * any discount come from the effect registry (stage 6).
 */

import type { ModuleDef } from "../data/modules.js";
import { type ModuleRun, hasModuleEffect, moduleEffect } from "../effects/registry.js";
import { type Effect, type RunCtx, ask, log } from "./effect.js";
import type { Ctx } from "./field.js";
import type { ModuleState } from "./state.js";
import { overclock } from "./heat.js";

export function moduleDef(c: Ctx, id: number): ModuleDef {
  const m = c.data.modules.byId.get(id);
  if (!m) throw new Error(`no Module ${id}`);
  return m;
}

export function moduleState(c: Ctx, id: number): ModuleState {
  const m = c.state.player.modules.find((x) => x.id === id);
  if (!m) throw new Error(`you do not have Module ${id}`);
  return m;
}

/**
 * Cost to pay now (8.6 step 2): the registry's discounted cost if the
 * effect is built, else the printed cost. An X cost counts as its minimum
 * for deciding whether you can start it (unit file E11).
 */
export function moduleCost(c: RunCtx | Ctx, id: number, x?: number): number {
  const d = moduleDef(c, id);
  if (hasModuleEffect(id)) {
    const fx = moduleEffect(id);
    const xx = x ?? fx.x?.min ?? 0;
    if (fx.cost) return Math.max(0, fx.cost(c as RunCtx, xx));
  }
  return d.cost === "X" ? Math.max(1, x ?? 1) : d.cost;
}

/** Energy you can spend on this Module now: stored on it (its colour) plus your Reserve (8.6 steps 1-2). */
export function payable(c: Ctx, id: number): number {
  const m = moduleState(c, id);
  const col = moduleDef(c, id).colour;
  return m.energy[col] + c.state.player.reserve[col];
}

/** Can you start running it now (8.1: you can pay its cost)? */
export function canRunModule(c: Ctx, id: number): boolean {
  const m = moduleState(c, id);
  const d = moduleDef(c, id);
  if (!m.ready) return false;
  const phase = c.state.phase;
  if (d.background === "light" && phase !== "command") return false;
  if (d.background === "red" && phase !== "overload") return false;
  return payable(c, id) >= moduleCost(c, id);
}

/** Run a Module (8.6). The caller has checked canRunModule. */
export function* runModule(c: RunCtx, id: number, free = false): Effect {
  const d = moduleDef(c, id);
  const fx = moduleEffect(id); // fails before anything is paid if the effect is not built yet
  const m = moduleState(c, id);
  const col = d.colour;
  const storedBefore = { ...m.energy };
  // The Module being run is not ready while it resolves (8.6).
  m.ready = false;
  const run: ModuleRun = { id, storedBefore };
  if (free) {
    if (d.cost === "X" || fx.x) run.x = 1; // CLAUDE.md decision: a free X-cost Module uses X = 1 (Core Rules 5.3).
    log(c, `run ${d.name} without paying its cost`, "5.3");
  } else {
    if (fx.x) {
      // Choose X as you run it: from its minimum up to what you can pay (cost_variable).
      let max = fx.x.min;
      while (moduleCost(c, id, max + 1) <= payable(c, id) && max < 50) max++;
      run.x = max === fx.x.min ? max : ((yield* ask(c, { kind: "amount", prompt: `${d.name}: choose X (${fx.x.min} to ${max}).`, rule: "8.6", min: fx.x.min, max })).value as number);
      log(c, `${d.name}: X = ${run.x}`, "8.6");
    }
    const cost = moduleCost(c, id, run.x);
    // Step 1: use stored energy; step 2: pay the rest from the Reserve.
    const stored = m.energy[col];
    const min = Math.max(0, cost - c.state.player.reserve[col]);
    // All the energy on it that the cost can use, no question (designer 2026-11-04): what is
    // left on a Module returns to the Supply when it is exhausted, so using it first never hurts.
    const fromModule = Math.max(min, Math.min(stored, cost));
    const fromReserve = cost - fromModule;
    m.energy[col] -= fromModule;
    c.state.player.reserve[col] -= fromReserve;
    c.state.supply.energy[col] += cost;
    log(c, `run ${d.name}: pay ${cost} ${col} (${fromModule} from the Module, ${fromReserve} from the Reserve)`, "8.6");
  }
  // H6 Overclock: once per run, paid or free.
  if (c.state.settings.heatModule) yield* overclock(c, id);
  yield* fx.run(c, run);
  // Steps 4-5: exhaust; energy still on it returns to the Supply.
  m.ready = false;
  for (const k of Object.keys(m.energy) as (keyof typeof m.energy)[]) {
    c.state.supply.energy[k] += m.energy[k];
    m.energy[k] = 0;
  }
}
