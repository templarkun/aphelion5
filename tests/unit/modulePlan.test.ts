/** Module selection on the screen (designer 2026-11-08): the plan of a Module chosen but not run yet. */

import { describe, expect, it } from "vitest";
import { commandStep } from "../../src/engine/command.js";
import { runEffect } from "../../src/engine/effect.js";
import { moduleDef } from "../../src/engine/modules.js";
import type { Answer, Question } from "../../src/engine/questions.js";
import type { GameState } from "../../src/engine/state.js";
import { hasModuleEffect, moduleEffect } from "../../src/effects/registry.js";
import { type ModPlan, planAnswer, planInfo } from "../../src/web/modulePlan.js";
import { A, ctx, data, given, withModules } from "./helpers.js";

function board(id: string, mod: number, reserve: number, heat = false, others: number[] = []): GameState {
  const s = withModules(given(id), [[mod, true, {}], ...others.map((m) => [m, false, {}] as [number, boolean, {}])]);
  const col = moduleDef(ctx(s), mod).colour;
  s.supply.energy[col] += s.player.reserve[col] - reserve;
  s.player.reserve[col] = reserve;
  s.settings.heatModule = heat;
  return s;
}
const ask = (s: GameState, answers: Answer[]): Question => {
  const r = runEffect(data(), s, (c) => commandStep(c), answers);
  if (r.status !== "question") throw new Error(`no question: ${r.status}`);
  return r.question;
};
const plan = (id: number, p: Partial<ModPlan> = {}): ModPlan => ({ id, oc: 0, extra: 0, ...p });

describe("Module selection plan", () => {
  it("every Module with an extra payment says so to the screen", () => {
    for (const m of data().modules.byId.values()) {
      if (!hasModuleEffect(m.id)) continue;
      expect([m.id, !!moduleEffect(m.id).extra]).toEqual([m.id, m.extraPayment !== undefined]);
    }
  });

  it("the bar: cost slots, filled from the Reserve only while selected; the extra payment adds slots", () => {
    const s = board("T6_PAY_04", 10, 6);
    const idle = planInfo(ctx(s), 10);
    expect(idle.slots.map((x) => x.fill)).toEqual(["empty", "empty", "empty"]);
    const sel = planInfo(ctx(s), 10, plan(10));
    expect(sel.slots.map((x) => x.fill)).toEqual(["reserve", "reserve", "reserve"]);
    expect(sel.extra?.max).toBe(3);
    expect(planInfo(ctx(s), 10, plan(10, { extra: 3 })).slots).toHaveLength(6);
    // 5 energy: no extra payment offered.
    expect(planInfo(ctx(board("T6_PAY_04", 10, 5)), 10, plan(10)).extra).toBeUndefined();
  });

  it("X: the range you can pay, and the plan answers the X question", () => {
    const s = board("T6_PAY_02", 53, 4, false, [2]);
    expect(planInfo(ctx(s), 53, plan(53)).xRange).toEqual([0, 2]);
    const q = ask(s, [A.option("runModule")]);
    expect(planAnswer(q, plan(53, { x: 2 }))).toEqual({ kind: "amount", value: 2 });
  });

  it("Overclock (H6): offered when you can pay it; the plan answers both questions", () => {
    const s = board("T6_PAY_04", 10, 6, true);
    expect(planInfo(ctx(s), 10, plan(10)).ocNext).toBe("two");
    expect(planInfo(ctx(s), 10, plan(10, { oc: 1 })).ocNext).toBe("yellow");
    const p = plan(10, { oc: 2 });
    const q1 = ask(s, [A.option("runModule")]);
    expect(planAnswer(q1, p)).toEqual({ kind: "yesno", value: true });
    const q2 = ask(s, [A.option("runModule"), A.yes()]);
    expect(planAnswer(q2, p)).toEqual({ kind: "yesno", value: true });
    expect(planAnswer(q2, plan(10, { oc: 1 }))).toEqual({ kind: "yesno", value: false });
  });

  it("the extra payment question is answered by the plan", () => {
    const s = board("T6_PAY_04", 10, 6);
    const q = ask(s, [A.option("runModule")]);
    expect(q.kind).toBe("yesno");
    expect(planAnswer(q, plan(10, { extra: 3 }))).toEqual({ kind: "yesno", value: true });
    expect(planAnswer(q, plan(10))).toEqual({ kind: "yesno", value: false });
  });
});
