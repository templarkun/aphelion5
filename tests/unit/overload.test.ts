/**
 * Stage 4: Overloads.
 * - tests/batch4.txt (DRAFT, written from Core Rules 9.1-9.3, awaiting the designer);
 * - Overload scenarios from batch 1: T_OVL_01, T_OVL_02, T_OVL_04, T_SHIP_01, T_TOK_06 step 5.
 */

import { describe, expect, it } from "vitest";
import { commandStep } from "../../src/engine/command.js";
import { runEffect } from "../../src/engine/effect.js";
import { alertedUnits } from "../../src/engine/alerts.js";
import { sectorState, tile, unitAt } from "../../src/engine/field.js";
import { checkInvariants } from "../../src/engine/invariants.js";
import { requestOverload } from "../../src/engine/moves.js";
import { metAnomalies, overloadEnd, overloadMenu, overloadStep } from "../../src/engine/overload.js";
import type { Answer, Question } from "../../src/engine/questions.js";
import { type SessionView, answerSession, startSession } from "../../src/engine/session.js";
import type { GameState } from "../../src/engine/state.js";
import { destroy } from "../../src/engine/tokens.js";
import { usableBayAbilities, usableOrders } from "../../src/engine/command.js";
import { A, at, ctx, data, given, optionIds, play, tokensAt, withModules } from "./helpers.js";

const ovl = (s: GameState, answers: Answer[] = []) => play(s, (c) => overloadStep(c), answers);
const oend = (s: GameState, answers: Answer[] = []) => play(s, (c) => overloadEnd(c), answers);
const cmd = (s: GameState, answers: Answer[] = []) => play(s, (c) => commandStep(c), answers);
const menu = (s: GameState) => overloadMenu(ctx(s)).map((o) => o.id);

function pendingCommand(s: GameState): Question {
  const r = runEffect(data(), s, (c) => commandStep(c), []);
  if (r.status !== "question") throw new Error(`expected a question, got ${r.status}`);
  return r.question;
}

/** Play through the session driver: answers in order, across steps and phases. */
function drive(s: GameState, answers: Answer[]): SessionView {
  let v = startSession(data(), s);
  for (const a of answers) {
    if (v.status !== "question") throw new Error(`no question left for answer ${JSON.stringify(a)}`);
    const r = answerSession(data(), v, a);
    if (r.status === "illegal" || r.status === "blocked") throw new Error(`${r.status}: ${r.reason} (question: ${v.question.prompt})`);
    v = r;
    expect(checkInvariants(ctx(v.state))).toEqual([]);
  }
  return v;
}

const red = (s: GameState, n: number) => {
  s.player.reserve.Red = n;
  s.supply.energy.Red = 10 - n;
  return s;
};

describe("batch 4 - STARTING AN OVERLOAD (9.1)", () => {
  it("T4_STA_01 a Flare revealed in the Command phase starts an Overload; who is alerted", () => {
    const s0 = withModules(given("T4_STA_01"), [[26, true]]);
    const { state } = cmd(s0, [A.option("reveal")]);
    expect(state.player.modules[0]!.energy).toEqual({ Yellow: 1, Red: 1, Blue: 1 });
    expect(state.phase).toBe("overload");
    expect(alertedUnits(ctx(state)).map((u) => tile(state, u).unitId).sort()).toEqual(["F_01", "F_04", "O_03", "S_01"]);
    for (const k of ["1,0", "1,-1", "-1,1", "0,-1"]) expect(tokensAt(state, k)).toBe("");
    const m = menu(state);
    expect(m.filter((x) => !x.startsWith("alert:"))).toEqual(["issueOrder", "concede"]);
    expect(m.filter((x) => x.startsWith("alert:"))).toHaveLength(4);
  });

  it("T4_STA_02 the Overload starts after the current effect; waiting Alerts carry into it", () => {
    const s0 = given("T4_STA_02");
    const p05 = at(s0, "0,0");
    const { state } = cmd(s0, [A.option("resolveAlerts"), A.order(p05)]);
    expect(state.flagship).toEqual([6, 6, 6]);
    expect(state.piles.discard).toContain(p05);
    expect(sectorState(state, "0,0")).toBe("dark");
    expect(state.phase).toBe("overload");
    expect(tokensAt(state, "1,0")).toBe("[AL]");
    expect(tokensAt(state, "0,1")).toBe("[WR][AL]");
    expect(state.player.reserve.Red).toBe(0); // the Wreck was not resolved in the Command phase
  });

  it("T4_STA_03 no new Overload during Overload End", () => {
    const s0 = given("T4_STA_03");
    expect(s0.phase).toBe("overloadEnd");
    const { state } = play(s0, function* (c) {
      requestOverload(c, "test effect");
      yield* overloadEnd(c);
    });
    expect(state.overloadPending).toBe(false);
    expect(state.phase).toBe("command");
    expect(state.log.some((e) => /Overloads never stack/.test(e.text))).toBe(true);
    // The next Command step starts no Overload.
    const after = cmd(state, [A.option("concede")]).state;
    expect(after.phase).toBe("gameEnd");
  });
});

describe("batch 4 - OVERLOAD ACTIONS (9.2)", () => {
  it("T4_ACT_01 the Overload action menu", () => {
    const s = withModules(given("T4_ACT_01"), [[26, true], [1, true]]);
    expect(s.flagship).toEqual([6, 5, 4, 3, 2]);
    expect(menu(s)).toEqual([`alert:${at(s, "0,0")}`, "runModule", "useBay", "issueOrder", "concede"]);
    expect(usableBayAbilities(ctx(s)).map((b) => b.id)).toEqual(["V2_BAY5"]);
    expect(usableOrders(ctx(s)).map((o) => o.id)).toEqual(["C1_ORDER_1", "C1_ORDER_2"]);
    // Running a Module offers only Charged Beam (one red Module: no question).
    const r = runEffect(data(), s, (c) => overloadStep(c), [A.option("runModule")]);
    expect(r.status).toBe("question");
    if (r.status === "question") expect(r.question.prompt).toMatch(/Charged Beam/);
  });

  it("T4_ACT_02 Command a Mecha during an Overload: [Overload] abilities only", () => {
    const s = given("T4_ACT_02");
    expect(menu(s)).toContain("commandMecha");
    const r = runEffect(data(), s, (c) => overloadStep(c), [A.option("commandMecha")]);
    // One Mecha, one legal option: both auto-answered, and one open sector: auto too.
    expect(r.status).toBe("done");
    const { state } = ovl(s, [A.option("commandMecha")]);
    expect(tile(state, unitAt(state, "1,0")!).unitId).toBe("M_02");
    expect(sectorState(state, "0,0")).toBe("dark");
    // With autoAnswer off, the only option offered is the [Overload] ability.
    const s2 = given("T4_ACT_02");
    s2.settings.autoAnswer = false;
    const r2 = runEffect(data(), s2, (c) => overloadStep(c), [A.option("commandMecha")]);
    expect(r2.status === "question" && optionIds(r2.question)).toEqual(["ability:V1_M02_U2"]);
  });

  it("T4_ACT_03 an alerted Mecha may Attack or Scrap during an Overload", () => {
    const s0 = given("T4_ACT_03");
    const f13 = at(s0, "0,0");
    const m01 = at(s0, "0,1");
    const b01 = at(s0, "1,0");
    const s1 = ovl(s0, [A.option(`alert:${f13}`)]).state;
    expect(tokensAt(s1, "0,1")).toBe("[AL]");
    const r = runEffect(data(), s1, (c) => overloadStep(c), [A.option(`alert:${m01}`)]);
    expect(r.status === "question" && optionIds(r.question)).toEqual(["attack", "scrap", "ability:M_01"]);
    const { state } = ovl(s1, [A.option(`alert:${m01}`), A.option("attack"), A.units(b01)]);
    expect(state.piles.discard).toEqual(expect.arrayContaining([b01, m01]));
    expect(sectorState(state, "0,1")).toBe("dark");
    expect(sectorState(state, "1,0")).toBe("dark");
    expect(unitAt(state, "0,0")).toBe(f13);
  });

  it("T4_ACT_04 effects may Reveal during an Overload; the new Sentinel is not alerted", () => {
    const s0 = given("T4_ACT_04");
    const { state } = ovl(s0, [A.option(`alert:${at(s0, "0,0")}`), A.yes()]);
    expect(tile(state, at(state, "0,1")).unitId).toBe("S_01");
    expect(tokensAt(state, "0,1")).toBe(""); // Barrier placed, then used up; no Alert
    expect(state.supply.barrier).toBe(10);
    expect(menu(state)).toContain("endOverload");
  });
});

describe("batch 4 - ALERTS DURING AN OVERLOAD (9.2)", () => {
  it("T4_ALR_01 a Flare revealed during an Overload is alerted at once and starts nothing", () => {
    const s0 = withModules(given("T4_ALR_01"), [[26, true]]);
    const { state } = ovl(s0, [A.option(`alert:${at(s0, "0,0")}`)]);
    expect(tokensAt(state, "0,1")).toBe("[AL]");
    expect(state.player.modules[0]!.energy).toEqual({ Yellow: 1, Red: 1, Blue: 1 });
    expect(state.phase).toBe("overload");
    expect(state.overloadPending).toBe(false);
    expect(menu(state)).not.toContain("endOverload");
    const s2 = ovl(state, [A.option(`alert:${at(state, "0,1")}`)]).state;
    expect(menu(s2)).toContain("endOverload");
  });

  it("T4_ALR_02 a unit that becomes a Wreck is alerted at once", () => {
    const s0 = red(withModules(given("T4_ALR_02"), [[26, true]]), 4);
    const g = at(s0, "0,0");
    const s1 = ovl(s0, [A.option("runModule"), A.units(g)]).state;
    expect(tokensAt(s1, "0,0")).toBe("[WR][AL]");
    expect(menu(s1)).not.toContain("endOverload");
    const s2 = ovl(s1, [A.option(`alert:${g}`)]).state;
    expect(s2.player.reserve.Red).toBe(2);
    expect(s2.piles.discard).toContain(g);
    expect(sectorState(s2, "0,0")).toBe("dark");
    expect(menu(s2)).toContain("endOverload");
  });

  it("T4_ALR_03 Sleepers are alerted when the last Dark sector disappears during an Overload", () => {
    const s0 = given("T4_ALR_03");
    const { state } = ovl(s0, [A.option(`alert:${at(s0, "0,0")}`), A.yes()]);
    expect(tokensAt(state, "1,0")).toBe("[AL]");
    expect(sectorState(state, "0,1")).toBe("cleared");
  });

  it("T4_ALR_04 an At Overload unit or Sentinel that appears later is not alerted", () => {
    const s0 = red(withModules(given("T4_ALR_04"), [[26, true]]), 7);
    const s1 = ovl(s0, [A.option("runModule"), A.units(at(s0, "0,0")), A.amount(0)]).state;
    expect(tile(s1, at(s1, "0,0")).unitId).toBe("O_03");
    const s2 = play(s1, function* (c) {
      destroy(c, at(s1, "0,1"));
    }).state;
    expect(tile(s2, at(s2, "0,1")).unitId).toBe("S_01");
    expect(tokensAt(s2, "0,0")).toBe("");
    expect(tokensAt(s2, "0,1")).toBe("");
    expect(menu(s2)).toContain("endOverload");
  });

  it("T4_ALR_05 an alerted unit destroyed before its Alert resolves: the Destroyed effect replaces it", () => {
    const s0 = red(withModules(given("T4_ALR_05"), [[26, true]]), 4);
    const g = at(s0, "0,0");
    const s1 = ovl(s0, [A.option("runModule"), A.units(g)]).state;
    expect(tokensAt(s1, "0,0")).toBe("[WR][AL]");
    expect(ovl(s1, [A.option(`alert:${g}`)]).state.player.reserve.Red).toBe(2);
  });
});

describe("batch 4 - ENDING THE OVERLOAD (9.2)", () => {
  it("T4_END_01 end only when no Alerts remain; you may still act first", () => {
    const s0 = red(withModules(given("T4_END_01"), [[26, true]]), 4);
    const s01 = at(s0, "0,0");
    expect(menu(s0)).toEqual([`alert:${s01}`, "runModule", "issueOrder", "concede"]);
    const s1 = ovl(s0, [A.option(`alert:${s01}`), A.split({ bay1: 1, bay2: 0, bay3: 0 })]).state;
    expect(s1.flagship).toEqual([5, 6, 6]);
    expect(menu(s1)).toEqual(["runModule", "issueOrder", "endOverload", "concede"]);
    const s2 = ovl(s1, [A.option("runModule"), A.units(at(s1, "0,1"))]).state;
    expect(sectorState(s2, "0,1")).toBe("dark");
    const s3 = ovl(s2, [A.option("endOverload")]).state;
    expect(s3.phase).toBe("overloadEnd");
    expect(oend(s3).state.phase).toBe("command");
  });
});

describe("batch 4 - OVERLOAD END (9.3)", () => {
  it("T4_OE_01 Fuse tokens go off one at a time, in your order", () => {
    const s0 = given("T4_OE_01");
    const b03 = at(s0, "0,0");
    const b01 = at(s0, "0,1");
    const { state } = oend(s0, [A.order(`${b03}:mortar`), A.units(b01), A.split({ bay2: 1 })]);
    expect(state.piles.discard).toContain(b01);
    expect(sectorState(state, "0,1")).toBe("dark");
    expect(state.flagship).toEqual([6, 5, 6]);
    expect(state.supply.mortar).toBe(10);
    expect(state.supply.feedback).toBe(10);
    expect(tokensAt(state, "0,0")).toBe("");
  });

  it("T4_OE_02 Exposure: 1 damage to every unit alone on its plate", () => {
    const s0 = given("T4_OE_02");
    const f01 = at(s0, "1,1");
    const m01 = at(s0, "1,-1");
    const { state } = oend(s0);
    expect(tokensAt(state, "0,0")).toBe("[D1]");
    expect(tokensAt(state, "0,1")).toBe("");
    expect(tokensAt(state, "1,0")).toBe(""); // Omega immune
    expect(tokensAt(state, "-1,0")).toBe("[WR][AL]");
    expect(tokensAt(state, "0,-1")).toBe(""); // Barrier used up
    expect(tokensAt(state, "-1,1")).toBe(""); // Shield used up
    expect(state.piles.discard).toContain(m01);
    expect(sectorState(state, "1,-1")).toBe("cleared");
    expect(tokensAt(state, "0,2")).toBe("");
    expect(state.piles.trophy).toContain(f01);
    expect(sectorState(state, "1,1")).toBe("cleared");
    expect(state.phase).toBe("command");
    expect(optionIds(pendingCommand(state))).toEqual(["resolveAlerts", "overhaul", "concede"]);
  });

  it("T4_OE_03 Anomaly: choose one met card, put it at the bottom, choose one reward", () => {
    const s0 = given("T4_OE_03");
    expect(s0.player.anomalies).toEqual(["14", "01"]);
    expect(metAnomalies(ctx(s0))).toEqual(["14", "01"]);
    const { state } = oend(s0, [A.option("01"), A.option("energy"), A.split({ Yellow: 0, Red: 6, Blue: 0 })]);
    expect(state.decks.anomalies).toEqual(["05", "01"]);
    expect(state.player.anomalies).toEqual(["14"]);
    expect(state.player.reserve).toEqual({ Yellow: 0, Red: 6, Blue: 0 });
    expect(state.flagship).toEqual([6, 6, 2]);
    expect(state.sheet.upgradePoints).toBe(0);
    // Variants.
    expect(oend(given("T4_OE_03"), [A.option("01"), A.option("repair")]).state.flagship).toEqual([6, 6, 5]);
    expect(oend(given("T4_OE_03"), [A.option("14"), A.option("upgrade")]).state.sheet.upgradePoints).toBe(6);
    const none = oend(given("T4_OE_03"), [A.option("none")]).state;
    expect(none.player.anomalies).toEqual(["14", "01"]);
    expect(none.decks.anomalies).toEqual(["05"]);
    expect(none.flagship).toEqual([6, 6, 2]);
    expect(none.player.reserve).toEqual({ Yellow: 0, Red: 0, Blue: 0 });
    // Even a single met card is a question: that card, or none.
    const r = runEffect(data(), given("T4_OE_03", "Anomaly card 14 in hand"), (c) => overloadEnd(c), []);
    expect(r.status === "question" && optionIds(r.question)).toEqual(["14", "none"]);
  });

  it("T4_OE_04 no Anomaly met: no reward", () => {
    const { state, asked } = oend(given("T4_OE_04"));
    expect(asked).toEqual([]);
    expect(state.player.anomalies).toEqual(["02"]);
  });

  it("T4_OE_05 Wrecks and Flares count for Anomalies at step 3", () => {
    const s0 = given("T4_OE_05");
    expect(metAnomalies(ctx(s0))).toEqual(["12", "04"]);
    const r = runEffect(data(), s0, (c) => overloadEnd(c), []);
    expect(r.status === "question" && optionIds(r.question)).toEqual(["12", "04", "none"]);
    expect(metAnomalies(ctx(given("T4_OE_05", "(1,-1): B_03 > fd")))).toEqual(["12"]);
  });

  it("T4_OE_06 Clear Flares: Power Nodes to the Trophy pile, other Flares to the Discard", () => {
    const s0 = given("T4_OE_06");
    const f01 = at(s0, "0,0");
    const f04a = at(s0, "0,1");
    const f04b = at(s0, "1,0");
    const { state } = oend(s0);
    expect(state.piles.trophy).toEqual([f01]);
    expect([...state.piles.discard].sort()).toEqual([f04a, f04b].sort());
    expect(sectorState(state, "0,0")).toBe("dark");
    expect(sectorState(state, "0,1")).toBe("cleared");
    expect(tile(state, at(state, "1,0")).unitId).toBe("B_02");
    expect(tokensAt(state, "1,0")).toBe("");
  });

  it("T4_OE_06 variant (open question Q3, answered): a Flare uncovered by step 4 is removed too", () => {
    const s0 = given("T4_OE_06", "(0,0): F_04 > F_01 > fd");
    const [top, below] = [...s0.field["0,0"]!].reverse();
    const { state } = oend(s0);
    expect(state.piles.discard).toContain(top);
    expect(state.piles.trophy).toContain(below);
    expect(sectorState(state, "0,0")).toBe("dark");
    expect(Object.keys(state.field).filter((k) => {
      const u = unitAt(state, k);
      return u !== undefined && state.tiles[u]!.unitId!.startsWith("F_");
    })).toEqual([]);
  });

  it("T4_OE_07 Alerts made at Overload End are resolved in the Command phase", () => {
    const s0 = given("T4_OE_07");
    const g = at(s0, "0,0");
    const s1 = oend(s0).state;
    expect(tokensAt(s1, "0,0")).toBe("[WR][AL]");
    expect(s1.phase).toBe("command");
    expect(optionIds(pendingCommand(s1))).toEqual(["resolveAlerts", "overhaul", "concede"]);
    const s2 = cmd(s1, [A.option("resolveAlerts")]).state;
    expect(s2.player.reserve.Blue).toBe(2);
    expect(s2.piles.discard).toContain(g);
    expect(sectorState(s2, "0,0")).toBe("cleared");
  });
});

describe("batch 4 - CRIPPLED DURING AN OVERLOAD (5.2)", () => {
  it("T4_CRP_01 play on, extra damage ignored, no Bays; Overhaul in the Command phase", () => {
    const s0 = given("T4_CRP_01");
    const [a, b] = [at(s0, "0,0"), at(s0, "0,1")];
    expect(menu(s0)).toContain("useBay");
    const s1 = ovl(s0, [A.option(`alert:${a}`)]).state;
    expect(s1.flagship).toEqual([0, 0, 0, 0, 0]);
    expect(menu(s1)).toEqual([`alert:${b}`, "issueOrder", "concede"]); // no useBay
    const s2 = ovl(s1, [A.option(`alert:${b}`)]).state;
    expect(s2.flagship).toEqual([0, 0, 0, 0, 0]);
    expect(s2.log.some((e) => /Crippled: 1 damage ignored/.test(e.text))).toBe(true);
    const s3 = oend(ovl(s2, [A.option("endOverload")]).state).state;
    expect(optionIds(pendingCommand(s3))).toEqual(["overhaul", "concede"]);
  });
});

describe("batch 4 - OBJECTIVE (8.2)", () => {
  it("T4_OBJ_01 the objective is not checked during an Overload or Overload End", () => {
    const s0 = given("T4_OBJ_01");
    const v = drive(s0, [A.option(`alert:${at(s0, "0,0")}`), A.split({ bay1: 1, bay2: 0, bay3: 0 }), A.option("endOverload")]);
    expect(v.status).toBe("stopped");
    expect(v.state.phase).toBe("missionEnd");
    expect(v.state.flagship).toEqual([5, 6, 6]);
  });
});

describe("batch 1 - Overload scenarios", () => {
  it("T_OVL_01 kill a Sentinel before it fires", () => {
    const s0 = red(withModules(given("T_OVL_01"), [[26, true]]), 4);
    const [s01, f04] = [at(s0, "0,0"), at(s0, "0,1")];
    const s1 = ovl(s0, [A.option("runModule"), A.units(s01)]).state;
    expect(s1.piles.discard).toContain(s01);
    expect(sectorState(s1, "0,0")).toBe("cleared");
    const s2 = ovl(s1, [A.option(`alert:${f04}`), A.yes()]).state; // the only Dark sector: no question
    expect(s2.flagship).toEqual([6, 6, 6]);
    expect(sectorState(s2, "1,0")).toBe("cleared");
    expect(s2.piles.discard.map((id) => s2.tiles[id]!.unitId)).toContain("B_02");
    expect(menu(s2)).toContain("endOverload");
  });

  it("T_OVL_02 Overloads never stack", () => {
    const s0 = given("T_OVL_02", "Flagship 6/6/4");
    const { state } = ovl(s0, [A.option(`alert:${at(s0, "0,0")}`)]);
    expect(state.overloadPending).toBe(false);
    expect(state.phase).toBe("overload");
    expect(state.flagship).toEqual([6, 6, 5]);
  });

  it("T_OVL_04 objective met mid-Overload: the Overload still finishes", () => {
    const s0 = red(withModules(given("T_OVL_04", "Trophy pile: 5 O_01"), [[26, true]]), 4);
    const [o01, s01, g05] = [at(s0, "0,0"), at(s0, "1,0"), at(s0, "0,1")];
    const v = drive(s0, [
      A.option("runModule"),
      A.units(o01),
      A.option(`alert:${o01}`),
      A.units(at(s0, "0,-1")), // O_01's Destroyed effect: Boost an adjacent B_03
      A.option(`alert:${s01}`),
      A.split({ bay1: 1, bay2: 0, bay3: 0 }),
      A.option("endOverload"),
    ]);
    expect(v.status).toBe("stopped");
    const s = v.state;
    expect(s.piles.trophy.filter((id) => s.tiles[id]!.unitId === "O_01")).toHaveLength(6);
    expect(s.flagship).toEqual([5, 6, 6]);
    expect(s.phase).toBe("missionEnd");
    expect(tile(s, g05).tokens).toMatchObject({ wreck: true, alert: false });
    expect(s.player.reserve.Red).toBe(0);
  });

  it("T_SHIP_01 Crippled during an Overload, rescued by an Anomaly", () => {
    const s0 = given("T_SHIP_01");
    const v = drive(s0, [A.option(`alert:${at(s0, "0,0")}`), A.units(at(s0, "0,1")), A.option("endOverload"), A.option("14"), A.option("repair"), A.split({ bay1: 1, bay2: 1, bay3: 1 })]);
    expect(v.status).toBe("question");
    if (v.status !== "question") return;
    expect(v.state.phase).toBe("command");
    expect(v.state.flagship).toEqual([1, 1, 1]);
    expect(v.state.decks.anomalies.at(-1)).toBe("14");
    expect(v.state.player.anomalies).toEqual([]);
    expect(optionIds(v.question)).not.toEqual(["overhaul", "concede"]);
    expect(v.state.sheet.overhaulUsed).toBe(0);
  });

  it("T_TOK_06 step 5: back in the Command phase, Resolve Alerts gives 2 Red", () => {
    const s0 = given("T_TOK_06");
    const g = at(s0, "0,0");
    const v = drive(s0, [A.order(`${g}:tick`), A.option("resolveAlerts")]);
    expect(v.state.player.reserve.Red).toBe(2);
    expect(v.state.piles.discard).toContain(g);
    expect(v.state.supply.mortar).toBe(10);
  });
});
