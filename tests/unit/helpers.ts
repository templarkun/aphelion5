/** Test helpers: load data and scenarios once, run effects with scripted answers. */

import { expect } from "vitest";
import type { GameData } from "../../src/data/index.js";
import { loadGameData, readRepoFile } from "../../src/data/nodeLoad.js";
import { type Scenario, parseScenarios } from "../../src/data/scenarios.js";
import { type Effect, type RunCtx, runEffect } from "../../src/engine/effect.js";
import { type Ctx, sectorOf, strength, tile, unitAt } from "../../src/engine/field.js";
import { checkInvariants } from "../../src/engine/invariants.js";
import type { Answer, Question } from "../../src/engine/questions.js";
import { scenarioState } from "../../src/engine/scenario.js";
import type { GameState, TileId } from "../../src/engine/state.js";

let cached: GameData | undefined;
export function data(): GameData {
  return (cached ??= loadGameData());
}

let scenarios: Map<string, Scenario> | undefined;
export function scenario(id: string): Scenario {
  scenarios ??= new Map(
    ["batch1.txt", "batch2.txt", "batch3.txt", "batch4.txt", "batch5.txt"].flatMap((f) => parseScenarios(readRepoFile("tests", f), f)).map((s) => [s.id, s]),
  );
  const s = scenarios.get(id);
  if (!s) throw new Error(`scenario ${id} not found`);
  return s;
}

export function allScenarios(): Scenario[] {
  scenario("T_GEO_01");
  return [...scenarios!.values()];
}

/** The board of a batch scenario, exactly as its "given" line says. */
export function given(id: string, extra = ""): GameState {
  const s = scenario(id);
  if (!s.map || s.given === undefined) throw new Error(`${id} has no map or given`);
  return scenarioState(data(), s.map, s.given, 1, extra);
}

export function ctx(state: GameState): Ctx {
  return { state, data: data() };
}

/** The unit in sector "q,r". */
export function at(state: GameState, k: string): TileId {
  const u = unitAt(state, k);
  if (u === undefined) throw new Error(`no unit in (${k})`);
  return u;
}

/** Tokens of the unit in a sector as the batches write them: "[D1]", "[S1][BAR]", "" for none. */
export function tokensAt(state: GameState, k: string): string {
  const t = tile(state, at(state, k)).tokens;
  const parts: string[] = [];
  if (t.damage) parts.push(`[D${t.damage}]`);
  if (t.shield) parts.push(`[S${t.shield}]`);
  if (t.bioShield) parts.push(`[BS${t.bioShield}]`);
  if (t.barrier) parts.push("[BAR]");
  if (t.wreck) parts.push("[WR]");
  if (t.alert) parts.push("[AL]");
  if (t.tick) parts.push(`[TICK${t.tick > 1 ? t.tick : ""}]`);
  if (t.mortar) parts.push(`[MORTAR${t.mortar > 1 ? t.mortar : ""}]`);
  if (t.feedback) parts.push(`[FB${t.feedback > 1 ? t.feedback : ""}]`);
  return parts.join("");
}

export function strengthAt(state: GameState, k: string): number | undefined {
  return strength(ctx(state), at(state, k));
}

export function where(state: GameState, id: TileId): string {
  const k = sectorOf(state, id);
  if (k !== undefined) return `(${k})`;
  for (const [name, pile] of Object.entries(state.piles)) if (pile.includes(id)) return name;
  return "nowhere";
}

/**
 * Run an effect with scripted answers. Fails the test if the effect asks a
 * question the script does not answer, or if an invariant breaks.
 * Returns the final state and the questions that were asked.
 */
export function play(state: GameState, fn: (c: RunCtx) => Effect<unknown>, answers: Answer[] = []): { state: GameState; asked: Question[] } {
  const asked: Question[] = [];
  for (let n = 0; n <= answers.length; n++) {
    const r = runEffect(data(), state, fn as (c: RunCtx) => Effect, answers.slice(0, n));
    if (r.status === "illegal") throw new Error(`answer ${n} rejected: ${r.reason}`);
    if (r.status === "question") {
      asked.push(r.question);
      if (n === answers.length) throw new Error(`unanswered question: ${r.question.prompt} (${JSON.stringify(r.question)})`);
      continue;
    }
    expect(r.used, "every scripted answer should be used").toBe(answers.length);
    expect(checkInvariants(ctx(r.state))).toEqual([]);
    return { state: r.state, asked };
  }
  throw new Error("unreachable");
}

/** Answer builders. */
export const A = {
  units: (...value: TileId[]): Answer => ({ kind: "units", value }),
  sectors: (...value: string[]): Answer => ({ kind: "sectors", value }),
  order: (value: string): Answer => ({ kind: "order", value }),
  option: (value: string): Answer => ({ kind: "option", value }),
  amount: (value: number): Answer => ({ kind: "amount", value }),
  split: (value: Record<string, number>): Answer => ({ kind: "split", value }),
  yes: (): Answer => ({ kind: "yesno", value: true }),
  no: (): Answer => ({ kind: "yesno", value: false }),
};

/** Give the player Modules: [id, ready, stored energy]. */
export function withModules(state: GameState, mods: [number, boolean, Partial<Record<"Yellow" | "Red" | "Blue", number>>?][], deck: number[] = []): GameState {
  for (const [id, ready, energy] of mods) {
    const e = { Yellow: 0, Red: 0, Blue: 0, ...energy };
    state.player.modules.push({ id, ready, energy: e });
    for (const k of ["Yellow", "Red", "Blue"] as const) state.supply.energy[k] -= e[k];
  }
  state.decks.modules = [...deck];
  return state;
}

/** Ids of a question's options. */
export function optionIds(q: Question | undefined): string[] {
  if (!q) throw new Error("no question");
  if (q.kind === "option" || q.kind === "order") return q.options.map((o) => o.id);
  if (q.kind === "units" || q.kind === "sectors") return [...q.options];
  throw new Error(`question ${q.kind} has no options`);
}
