/**
 * The Heat module (Expansion1.txt, H1-H8), when switched on at game setup.
 * H2/H3/H8 (Mission Preparation, Mission End, scoring) are in campaign.ts;
 * the rest act here and are called from the places they change.
 */

import { type Effect, type RunCtx, ask, asEffect, log } from "./effect.js";
import { type Ctx, choosableUnits, unitType } from "./field.js";
import { moduleDef } from "./modules.js";
import type { TileId } from "./state.js";
import { damageFlagship, dealHit } from "./tokens.js";
import { emit } from "./events.js";

export const heatOn = (c: Ctx) => c.state.settings.heatModule;

/** H1: gain Heat, never above 10 held; limited by the Supply (6.7). */
export function gainHeat(c: Ctx, n: number, rule: string): void {
  const p = c.state.player;
  const x = Math.max(0, Math.min(n, 10 - p.heat, c.state.supply.heat));
  p.heat += x;
  c.state.supply.heat -= x;
  log(c, `gain ${x} Heat${x < n ? ` (${n - x} lost)` : ""}; Heat ${p.heat}`, rule);
  if (x > 0) emit(c, { kind: "heat", amount: x, rule, gain: true });
}

export function payHeat(c: Ctx, n: number, rule: string): void {
  c.state.player.heat -= n;
  c.state.supply.heat += n;
  log(c, `pay ${n} Heat; Heat ${c.state.player.heat}`, rule);
  emit(c, { kind: "heat", amount: n, rule });
}

/** H4: a revealed Power Node: its 3 energy as usual, or 3 Heat instead. Returns true if Heat was chosen. */
export function* powerNodeChoice(c: RunCtx): Effect<boolean> {
  const a = yield* ask(c, { kind: "option", prompt: "Power Node revealed (Heat module): take its energy or 3 Heat?", rule: "H4", options: [{ id: "energy", label: "Place its 3 energy on your Modules" }, { id: "heat", label: "Gain 3 Heat tokens instead" }] });
  if (a.value !== "heat") return false;
  gainHeat(c, 3, "H4");
  return true;
}

/** H5 Heat Wave: pay 1 Heat, deal 1 damage to one Bot (one hit). */
export function* heatWave(c: RunCtx): Effect {
  payHeat(c, 1, "H5");
  const bots = choosableUnits(c, (u) => unitType(c, u) === "Bot");
  if (bots.length === 0) return log(c, "Heat Wave: no Bot to damage", "H5");
  const a = yield* ask(c, { kind: "units", prompt: "Heat Wave: deal 1 damage to which Bot?", rule: "H5", options: bots, min: 1, max: 1 });
  yield* dealHit(c, (a.value as TileId[])[0]!, 1, "H5");
}

/**
 * H6 Overclock, once per run of a Module (paid or free): pay 2 extra energy of
 * the Module's colour for 1 Heat; then, if you did, 1 extra Yellow for 1 more.
 * Energy stored on the Module pays any matching part. Discounts never apply.
 */
export function* overclock(c: RunCtx, moduleId: number): Effect {
  const d = moduleDef(c, moduleId);
  const m = c.state.player.modules.find((x) => x.id === moduleId)!;
  const avail = (col: "Yellow" | "Red" | "Blue") => c.state.player.reserve[col] + (col === d.colour ? m.energy[col] : 0);
  if (avail(d.colour) < 2) return;
  const a = yield* ask(c, { kind: "yesno", prompt: `Overclock ${d.name}: pay 2 more ${d.colour} energy to gain 1 Heat?`, rule: "H6" });
  if (a.value !== true) return;
  yield* payExtra(c, moduleId, d.colour, 2);
  gainHeat(c, 1, "H6");
  if (avail("Yellow") < 1) return;
  const b = yield* ask(c, { kind: "yesno", prompt: "Overclock: also pay 1 Yellow energy to gain 1 more Heat?", rule: "H6" });
  if (b.value !== true) return;
  yield* payExtra(c, moduleId, "Yellow", 1);
  gainHeat(c, 1, "H6");
}

function* payExtra(c: RunCtx, moduleId: number, col: "Yellow" | "Red" | "Blue", n: number): Effect {
  const d = moduleDef(c, moduleId);
  const m = c.state.player.modules.find((x) => x.id === moduleId)!;
  const onIt = col === d.colour ? m.energy[col] : 0;
  const reserve = c.state.player.reserve[col];
  const lo = Math.max(0, n - reserve);
  const hi = Math.min(n, onIt);
  const fromModule = Math.max(lo, hi); // what is on the Module first, no question
  m.energy[col] -= fromModule;
  c.state.player.reserve[col] -= n - fromModule;
  c.state.supply.energy[col] += n;
  log(c, `Overclock: pay ${n} ${col}`, "H6");
}

/**
 * H7 Meltdown (Overload End, after step 4): pay 1 Heat; if you can't:
 * (Computer version, designer 2026-11-08: a Heat token is always paid when you have one, no question.)
 * [1] 1 damage to every Bot (own hit each) [2] N = Bots hit [3] gain N Heat [4] N + 1 damage to your Flagship.
 */
export function* meltdown(c: RunCtx): Effect {
  if (c.state.player.heat >= 1) return payHeat(c, 1, "H7");
  log(c, "Meltdown: no Heat token left to prevent it", "H7");
  const bots = choosableUnits(c, (u) => unitType(c, u) === "Bot");
  emit(c, { kind: "meltdown", bots: bots.length });
  // Bio-shield effects from step [1] resolve as soon as step [1] has finished.
  yield* asEffect(
    c,
    (function* () {
      for (const b of bots) yield* dealHit(c, b, 1, "H7");
    })(),
  );
  const n = bots.length;
  gainHeat(c, n, "H7");
  yield* damageFlagship(c, n + 1, "H7");
}
