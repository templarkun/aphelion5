/**
 * Random play-throughs (spec "Testing and acceptance"): random legal answers
 * from many boards. They must never crash, break an invariant or hang.
 * Cards whose effects are not built yet (NotBuiltYet) end a run early; that
 * is expected until stages 5 and 6.
 */

import { describe, expect, it } from "vitest";
import { commandStep } from "../../src/engine/command.js";
import { runEffect } from "../../src/engine/effect.js";
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

/** Play random Command phase steps; returns how the run ended. */
function randomRun(start: GameState, seed: number, maxSteps: number): string {
  const r = newRng(seed);
  let s = start;
  for (let n = 0; n < maxSteps; n++) {
    if (s.phase !== "command") return `phase ${s.phase}`;
    const answers: Answer[] = [];
    for (let guard = 0; ; guard++) {
      if (guard > 200) throw new Error("a single action asked over 200 questions");
      let res;
      try {
        res = runEffect(data(), s, (c) => commandStep(c), answers);
      } catch (e) {
        if (e instanceof NotBuiltYet) return "not built yet";
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
      if (a.kind === "option" && a.value === "concede" && nextInt(r, 20) > 0) a = randomAnswer(r, res.question);
      answers.push(a);
    }
  }
  return "steps done";
}

/** Contents for unknown face-down tiles: units of every type. */
const POOL = ["B_01", "B_02", "B_03", "M_01", "M_02", "G_01", "G_05", "G_08", "G_10", "S_01", "S_12", "F_01", "F_02", "F_09", "P_01", "P_12", "O_01"];

describe("random play-throughs of the Command phase", () => {
  it("never crash, refuse a legal answer, or break an invariant", () => {
    const boards = allScenarios().filter((sc) => sc.map && sc.given !== undefined && !/same as|Overload/.test(sc.given));
    const endings = new Map<string, number>();
    let runs = 0;
    for (const sc of boards) {
      for (let seed = 1; seed <= 4; seed++) {
        const s = withModules(scenarioState(data(), sc.map!, sc.given!, seed), [[1, true], [2, true]], [3, 4, 5, 6]);
        // Face-down tiles "of no stated contents" get real contents, so random Reveals work.
        const fill = newRng(seed);
        for (const t of Object.values(s.tiles)) if (t.unitId === null) t.unitId = POOL[nextInt(fill, POOL.length)]!;
        s.player.reserve = { Yellow: 5, Red: 5, Blue: 5 };
        s.supply.energy = { Yellow: 5, Red: 5, Blue: 5 };
        const end = randomRun(s, seed * 7919 + runs, 30);
        endings.set(end, (endings.get(end) ?? 0) + 1);
        runs++;
      }
    }
    expect(runs).toBeGreaterThan(200);
    // Some runs must get through all their steps or reach a real ending.
    expect((endings.get("steps done") ?? 0) + (endings.get("phase overload") ?? 0) + (endings.get("phase gameEnd") ?? 0)).toBeGreaterThan(20);
  });
});
