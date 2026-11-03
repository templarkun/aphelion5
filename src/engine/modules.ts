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
export function moduleCost(c: RunCtx | Ctx, id: number): number {
  const d = moduleDef(c, id);
  if (hasModuleEffect(id)) {
    const fx = moduleEffect(id);
    if (fx.cost) return Math.max(0, fx.cost(c as RunCtx));
  }
  return d.cost === "X" ? 1 : d.cost;
}

/** Can you start running it now (8.1: you can pay its cost)? */
export function canRunModule(c: Ctx, id: number): boolean {
  const m = moduleState(c, id);
  const d = moduleDef(c, id);
  if (!m.ready) return false;
  const phase = c.state.phase;
  if (d.background === "light" && phase !== "command") return false;
  if (d.background === "red" && phase !== "overload") return false;
  return m.energy[d.colour] + c.state.player.reserve[d.colour] >= moduleCost(c, id);
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
    if (d.cost === "X") run.x = 1; // CLAUDE.md decision: a free X-cost Module uses X = 1 (Core Rules 5.3).
    log(c, `run ${d.name} without paying its cost`, "5.3");
  } else {
    const cost = moduleCost(c, id);
    // Step 1: use stored energy; step 2: pay the rest from the Reserve.
    const stored = m.energy[col];
    const min = Math.max(0, cost - c.state.player.reserve[col]);
    const max = Math.min(stored, cost);
    let fromModule = min;
    if (max > min) {
      const a = yield* ask(c, { kind: "amount", prompt: `${d.name} costs ${cost} ${col}. How much of the ${stored} ${col} on it do you use?`, rule: "8.6", min, max });
      fromModule = a.value as number;
    }
    const fromReserve = cost - fromModule;
    m.energy[col] -= fromModule;
    c.state.player.reserve[col] -= fromReserve;
    c.state.supply.energy[col] += cost;
    log(c, `run ${d.name}: pay ${cost} ${col} (${fromModule} from the Module, ${fromReserve} from the Reserve)`, "8.6");
  }
  yield* fx.run(c, run);
  // Steps 4-5: exhaust; energy still on it returns to the Supply.
  m.ready = false;
  for (const k of Object.keys(m.energy) as (keyof typeof m.energy)[]) {
    c.state.supply.energy[k] += m.energy[k];
    m.energy[k] = 0;
  }
}
