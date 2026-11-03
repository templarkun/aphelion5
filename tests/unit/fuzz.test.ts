/**
 * Random play-throughs (spec "Testing and acceptance"): random legal answers
 * from many boards. They must never crash, break an invariant or hang.
 * Cards whose effects are not built yet (NotBuiltYet) end a run early; that
 * is expected until stages 5 and 6.
 */

import { describe, expect, it } from "vitest";
import { commandStep } from "../../src/engine/command.js";
import { type Effect, OpenQuestion, type RunCtx, runEffect } from "../../src/engine/effect.js";
import { fixedBoard } from "../../src/engine/fixedBoard.js";
import { overloadEnd, overloadStep } from "../../src/engine/overload.js";
import { NotBuiltYet } from "../../src/effects/registry.js";
import { checkInvariants } from "../../src/engine/invariants.js";
import type { Answer, Question } from "../../src/engine/questions.js";
import { newRng, nextInt, shuffle } from "../../src/engine/rng.js";
import type { RngState } from "../../src/engine/rng.js";
import { scenarioState } from "../../src/engine/scenario.js";
import type { GameState } from "../../src/engine/state.js";
import { allScenarios, ctx, data, withModules } from "./helpers.js";

/** A random legal answer to any question. */
export function randomAnswer(r: RngState, q: Question): Answer {
  switch (q.kind) {
    case "units":
    case "sectors": {
      const n = q.min + nextInt(r, Math.min(q.max, q.options.length) - q.min + 1);
      const value = shuffle(r, [...q.options]).slice(0, n);
      return q.kind === "units" ? { kind: "units", value } : { kind: "sectors", value };
    }
    case "option":
      return { kind: "option", value: q.options[nextInt(r, q.options.length)]!.id };
    case "order":
      return { kind: "order", value: q.options[nextInt(r, q.options.length)]!.id };
    case "amount":
      return { kind: "amount", value: q.min + nextInt(r, q.max - q.min + 1) };
    case "yesno":
      return { kind: "yesno", value: nextInt(r, 2) === 1 };
    case "split": {
      const value: Record<string, number> = Object.fromEntries(q.buckets.map((b) => [b.id, 0]));
      for (let left = q.total; left > 0; left--) {
        const open = q.buckets.filter((b) => value[b.id]! < b.max);
        value[open[nextInt(r, open.length)]!.id]! += 1;
      }
      return { kind: "split", value };
    }
  }
}

/** The root effect that plays each phase (as the session driver does). */
const ROOT: Partial<Record<GameState["phase"], (c: RunCtx) => Effect>> = {
  command: (c) => commandStep(c),
  overload: (c) => overloadStep(c),
  overloadEnd: (c) => overloadEnd(c),
};

export interface RunStats {
  overloads: number;
  overloadEnds: number;
}

/** Play random steps through the Command phase, Overloads and Overload End; returns how the run ended. */
export function randomRun(start: GameState, seed: number, maxSteps: number, stats: RunStats = { overloads: 0, overloadEnds: 0 }): string {
  const r = newRng(seed);
  let s = start;
  for (let n = 0; n < maxSteps; n++) {
    const root = ROOT[s.phase];
    if (!root) return `phase ${s.phase}`;
    const before = s.phase;
    const answers: Answer[] = [];
    for (let guard = 0; ; guard++) {
      if (guard > 300) throw new Error("a single step asked over 300 questions");
      let res;
      try {
        res = runEffect(data(), s, root, answers);
      } catch (e) {
        if (e instanceof NotBuiltYet) return "not built yet";
        if (e instanceof OpenQuestion) return "open question";
        throw e;
      }
      if (res.status === "illegal") throw new Error(`a random legal answer was refused: ${res.reason}`);
      if (res.status === "done") {
        const p = checkInvariants(ctx(res.state));
        if (p.length) throw new Error(`invariant broken: ${p.join("; ")}`);
        s = res.state;
        break;
      }
      // Concede rarely, so runs get somewhere.
      let a = randomAnswer(r, res.question);
      for (let k = 0; k < 20 && a.kind === "option" && a.value === "concede"; k++) a = randomAnswer(r, res.question);
      answers.push(a);
    }
    if (before !== "overload" && s.phase === "overload") stats.overloads++;
    if (before === "overloadEnd") stats.overloadEnds++;
  }
  return "steps done";
}

/** Contents for unknown face-down tiles: every unit in the unit file (stage 5: all built). */
const POOL = data().units.units.map((u) => u.id);

describe("random play-throughs of the Command phase and Overloads", () => {
  it("never crash, refuse a legal answer, or break an invariant", () => {
    const boards = allScenarios().filter((sc) => sc.map && sc.given !== undefined && !/same as/.test(sc.given));
    const stats: RunStats = { overloads: 0, overloadEnds: 0 };
    const endings = new Map<string, number>();
    let runs = 0;
    for (const sc of boards) {
      for (let seed = 1; seed <= 4; seed++) {
        // Two random Modules of each colour, the rest in the Module deck (7.1 step 8 style).
        const deck = shuffle(newRng(seed * 31 + runs), data().modules.modules.map((m) => m.id));
        const keep = (["Yellow", "Red", "Blue"] as const).flatMap((col) => deck.filter((id) => data().modules.byId.get(id)!.colour === col).slice(0, 2));
        const s = withModules(scenarioState(data(), sc.map!, sc.given!, seed), keep.map((id) => [id, true] as [number, boolean]), deck.filter((id) => !keep.includes(id)));
        // Face-down tiles "of no stated contents" get real contents, so random Reveals work.
        const fill = newRng(seed);
        for (const t of Object.values(s.tiles)) if (t.unitId === null) t.unitId = POOL[nextInt(fill, POOL.length)]!;
        s.player.reserve = { Yellow: 5, Red: 5, Blue: 5 };
        s.supply.energy = { Yellow: 5, Red: 5, Blue: 5 };
        const end = randomRun(s, seed * 7919 + runs, 30, stats);
        endings.set(end, (endings.get(end) ?? 0) + 1);
        runs++;
      }
    }
    expect(runs).toBeGreaterThan(200);
    // Some runs must get through all their steps or reach a real ending.
    expect((endings.get("steps done") ?? 0) + (endings.get("phase missionEnd") ?? 0) + (endings.get("phase gameEnd") ?? 0)).toBeGreaterThan(20);
    // The runs must really go through Overloads and Overload End.
    expect(stats.overloads).toBeGreaterThan(30);
    expect(stats.overloadEnds).toBeGreaterThan(20);
  }, 60000);
});

describe("random play-throughs of the fixed text-play board", () => {
  it("play whole missions with only built cards: never blocked, never broken", () => {
    const endings = new Map<string, number>();
    const stats: RunStats = { overloads: 0, overloadEnds: 0 };
    for (let seed = 1; seed <= 25; seed++) {
      const end = randomRun(fixedBoard(data(), seed), seed * 104729, 600, stats);
      endings.set(end, (endings.get(end) ?? 0) + 1);
    }
    expect(endings.get("not built yet") ?? 0).toBe(0);
    // Open questions Q6 and Q7 may stop a run; nothing else may.
    expect(stats.overloadEnds).toBeGreaterThan(25);
    // Every run reaches a real ending (won, lost or conceded) or plays all its steps.
    for (const k of endings.keys()) expect(["phase missionEnd", "phase gameEnd", "steps done", "open question"]).toContain(k);
  }, 60000);
});
