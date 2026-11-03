/** Stage 5: tests/batch5.txt (DRAFT, written from the unit file, awaiting the designer). */

import { describe, expect, it } from "vitest";
import { commandStep } from "../../src/engine/command.js";
import { OpenQuestion, runEffect } from "../../src/engine/effect.js";
import { sectorState, tile, unitAt } from "../../src/engine/field.js";
import { overloadMenu, overloadStep } from "../../src/engine/overload.js";
import type { Answer } from "../../src/engine/questions.js";
import type { GameState } from "../../src/engine/state.js";
import { A, at, ctx, data, given, optionIds, play, tokensAt, withModules } from "./helpers.js";

const ovl = (s: GameState, answers: Answer[] = []) => play(s, (c) => overloadStep(c), answers);
const cmd = (s: GameState, answers: Answer[] = []) => play(s, (c) => commandStep(c), answers);
const resolve = (s: GameState, k: string, answers: Answer[] = []) => ovl(s, [A.option(`alert:${at(s, k)}`), ...answers]);
const idOf = (s: GameState, k: string) => tile(s, at(s, k)).unitId;
const inPile = (s: GameState, pile: keyof GameState["piles"], unitId: string) => s.piles[pile].filter((id) => s.tiles[id]!.unitId === unitId).length;

describe("batch 5 - SENTINELS", () => {
  it("T5_SEN_01 S_05 buries itself, reveals and Boosts a Bot", () => {
    const { state } = resolve(given("T5_SEN_01"), "0,0");
    expect(idOf(state, "0,0")).toBe("B_02");
    expect(tokensAt(state, "0,0")).toBe("[S1]");
    expect(state.tiles[state.field["0,0"]!.at(-2)!]!.unitId).toBe("S_05");
  });

  it("T5_SEN_02 S_16 turns once per Sentinel, Boosts the Bots in its lines of fire", () => {
    const { state } = resolve(given("T5_SEN_02"), "0,0");
    expect(tile(state, at(state, "0,0")).facing).toBe(2);
    expect(tokensAt(state, "-1,0")).toBe("[S1]");
    expect(tokensAt(state, "1,0")).toBe("");
    expect(tokensAt(state, "1,-1")).toBe("");
    expect(tokensAt(state, "0,1")).toBe("");
  });

  it("T5_SEN_03 S_20: no Mecha destroyed, 3 damage to your Flagship", () => {
    const s = given("T5_SEN_03");
    const row0 = "0"; // horizontal row q = 0 is the first row through (0,0)
    const r = runEffect(data(), s, (c) => overloadStep(c), [A.option(`alert:${at(s, "0,0")}`)]);
    expect(r.status === "question" && optionIds(r.question)).toEqual(["0", "1", "2"]);
    const { state } = resolve(s, "0,0", [A.option(row0), A.split({ bay1: 3, bay2: 0, bay3: 0 })]);
    expect(sectorState(state, "0,-1")).toBe("dark");
    expect(tokensAt(state, "0,1")).toBe("[D1]");
    expect(tokensAt(state, "0,2")).toBe("[D1]");
    expect(state.flagship).toEqual([3, 6, 6]);
    const v = given("T5_SEN_03", "(0,1): M_01 > fd");
    expect(resolve(v, "0,0", [A.option(row0)]).state.flagship).toEqual([6, 6, 6]);
  });

  it("T5_SEN_04 S_22's single hit on itself is cancelled by its Barrier", () => {
    const { state } = resolve(given("T5_SEN_04"), "0,0");
    expect(tokensAt(state, "0,0")).toBe("");
    expect(state.supply.barrier).toBe(10);
  });

  it("T5_SEN_05 S_25 teleports, may rotate, Boosts every Targeted unit", () => {
    const s = given("T5_SEN_05");
    const { state } = resolve(s, "0,0", [A.option("0")]); // (0,2) is the only Dark or Cleared sector
    expect(sectorState(state, "0,0")).toBe("dark");
    expect(idOf(state, "0,2")).toBe("S_25");
    expect(tokensAt(state, "0,1")).toBe("[S1]");
  });

  it("T5_SEN_06 S_27: 5 or more Shields, remove them all and 4 damage to your Flagship", () => {
    const { state } = resolve(given("T5_SEN_06"), "0,0", [A.split({ bay1: 4, bay2: 0, bay3: 0 })]);
    expect(tokensAt(state, "0,0")).toBe("");
    expect(state.flagship).toEqual([2, 6, 6]);
    expect(state.supply.shield).toBe(10);
    for (const k of ["0,-1", "1,-1", "1,0", "0,1", "-1,1", "-1,0", "0,2"]) expect(tokensAt(state, k)).toBe("[D1]");
  });

  it("T5_SEN_07 S_21 activates Sleepers and Gyros", () => {
    const s = given("T5_SEN_07");
    const s1 = resolve(s, "0,0").state;
    expect(tokensAt(s1, "0,1")).toBe("[AL]");
    expect(tokensAt(s1, "1,0")).toBe("[AL]");
    expect(overloadMenu(ctx(s1)).map((o) => o.id)).not.toContain("endOverload");
    const s2 = resolve(s1, "1,0").state;
    expect(s2.player.reserve.Red).toBe(1);
    expect(inPile(s2, "discard", "G_05")).toBe(1);
  });
});

describe("batch 5 - FLARES", () => {
  it("T5_FLR_01 F_02 reveals adjacent Sentinels, strips their Barrier and alerts them", () => {
    const { state } = resolve(given("T5_FLR_01"), "0,0", [A.sectors("0,1")]);
    expect(idOf(state, "0,1")).toBe("S_01");
    expect(tokensAt(state, "0,1")).toBe("[AL]");
    expect(state.supply.barrier).toBe(10);
    expect(idOf(state, "1,0")).toBe("B_02");
  });

  it("T5_FLR_02 F_06 checks which units are damaged first", () => {
    const { state } = resolve(given("T5_FLR_02"), "0,0", [A.option("1")]); // rows by q: -1, 0, 1
    expect(tokensAt(state, "0,-1")).toBe("");
    expect(tokensAt(state, "0,1")).toBe("[D1]");
    expect(tokensAt(state, "0,2")).toBe("[D1]");
  });

  it("T5_FLR_03 F_08 hits only the revealed units whose type appears twice", () => {
    const s = given("T5_FLR_03");
    const { state } = resolve(s, "0,0", [A.yes(), A.sectors("0,1"), A.yes(), A.sectors("1,0"), A.yes()]);
    expect(tokensAt(state, "0,1")).toBe("[D1]");
    expect(sectorState(state, "1,0")).toBe("dark");
    expect(tokensAt(state, "1,1")).toBe("");
    const one = resolve(s, "0,0", [A.yes(), A.sectors("0,1"), A.no()]).state;
    expect(tokensAt(one, "0,1")).toBe("");
  });

  it("T5_FLR_04 F_17 checks Strength first, then hits or Boosts", () => {
    const { state } = resolve(given("T5_FLR_04"), "0,0");
    expect(tokensAt(state, "0,1")).toBe("[S1]");
    expect(tokensAt(state, "1,0")).toBe("");
    for (const k of ["0,-1", "1,-1", "-1,0", "-1,1"]) expect(tokensAt(state, k)).toBe("[D1]");
  });

  it("T5_FLR_05 F_24 hits every unit tied for the highest Strength", () => {
    const { state } = resolve(given("T5_FLR_05"), "0,0");
    expect(tokensAt(state, "0,1")).toBe("[D1]");
    expect(tokensAt(state, "1,0")).toBe("");
    expect(tokensAt(state, "1,1")).toBe("");
  });

  it("T5_FLR_06 F_25: an X cost counts as its minimum", () => {
    const s = withModules(given("T5_FLR_06"), [[54, true], [26, true]]);
    const { state } = resolve(s, "0,0");
    expect(state.player.modules[0]!.energy).toEqual({ Yellow: 0, Red: 0, Blue: 3 });
  });
});

describe("batch 5 - SLEEPERS", () => {
  it("T5_SLP_01 P_07: most abundant type other than Bot and Flare; Wrecks count", () => {
    const { state } = resolve(given("T5_SLP_01"), "0,0");
    expect(tokensAt(state, "0,1")).toBe("[WR][AL]");
    expect(tokensAt(state, "1,0")).toBe("[WR][AL]");
    expect(tokensAt(state, "1,1")).toBe("");
  });

  it("T5_SLP_02 P_08: exactly one of a type takes 2, P_08 itself included", () => {
    const s = given("T5_SLP_02");
    const { state } = cmd(s, [A.option("resolveAlerts")]);
    expect(sectorState(state, "0,1")).toBe("dark");
    expect(inPile(state, "discard", "P_08")).toBe(1);
    expect(tokensAt(state, "1,0")).toBe("");
  });

  it("T5_SLP_03 P_15: one unit of each type, Omega included, P_15 itself as the Sleeper", () => {
    const { state } = cmd(given("T5_SLP_03"), [A.option("resolveAlerts")]);
    expect(tokensAt(state, "0,1")).toBe("[D1]");
    expect(tokensAt(state, "1,0")).toBe("[D1]");
    // G_05 became a Wreck; Resolve Alerts goes on until none is left, so its Wreck resolves too (2 Red).
    expect(inPile(state, "discard", "G_05")).toBe(1);
    expect(state.player.reserve.Red).toBe(2);
    expect(inPile(state, "discard", "P_15")).toBe(1);
  });

  it("T5_SLP_04 P_24 with no damaged Sentinel: open question Q5", () => {
    expect(() => cmd(given("T5_SLP_04"), [A.option("resolveAlerts")])).toThrow(OpenQuestion);
  });

  it("T5_SLP_05 P_25 flips token-free neighbours face down, Flares too", () => {
    const s = given("T5_SLP_05");
    const flipped = ["0,1", "1,0", "-1,0"].map((k) => at(s, k));
    const { state } = cmd(s, [A.option("resolveAlerts")]);
    for (const k of ["0,1", "1,0", "-1,0"]) expect(sectorState(state, k)).toBe("dark");
    expect(idOf(state, "-1,1")).toBe("B_03");
    for (const id of flipped) expect(state.seen).toContain(id);
  });

  it("T5_SLP_06 P_19 runs the cheapest Module you could run now, for free", () => {
    const s = withModules(given("T5_SLP_06"), [[1, true], [26, true]]);
    const { state } = cmd(s, [A.option("resolveAlerts"), A.units(at(s, "0,1"))]);
    expect(sectorState(state, "0,1")).toBe("dark");
    expect(state.player.modules[0]!.ready).toBe(false);
    expect(state.player.modules[1]!.ready).toBe(true);
    expect(state.player.reserve).toEqual({ Yellow: 0, Red: 0, Blue: 0 });
  });
});

describe("batch 5 - GYROS", () => {
  it("T5_GYR_01 a Gyro's Drain never affects that Gyro itself", () => {
    const { state } = cmd(given("T5_GYR_01"), [A.option("drainGyro")]);
    expect(tokensAt(state, "0,1")).toBe("[S1]");
    expect(tokensAt(state, "1,0")).toBe("");
    expect(inPile(state, "discard", "G_10")).toBe(1);
    expect(state.supply.shield).toBe(9); // one Boost only: G_10 was not Boosted
  });

  it("T5_GYR_02 G_11 Drain: discard now, reveal, Boost twice", () => {
    const { state } = cmd(given("T5_GYR_02"), [A.option("drainGyro")]);
    expect(idOf(state, "0,0")).toBe("B_01");
    expect(tokensAt(state, "0,0")).toBe("[S2]");
    expect(inPile(state, "discard", "G_11")).toBe(1);
  });

  it("T5_GYR_03 G_14 destroyed in the Command phase starts an Overload after its effect", () => {
    const { state } = cmd(given("T5_GYR_03"), [A.option("resolveAlerts")]);
    expect(state.phase).toBe("overload");
    expect(inPile(state, "discard", "G_14")).toBe(1);
    expect(tokensAt(state, "0,1")).toBe("[AL]");
  });

  it("T5_GYR_04 G_30 destroyed: damage any number of the revealed units", () => {
    const s = given("T5_GYR_04");
    const r = runEffect(data(), s, (c) => commandStep(c), [A.option("resolveAlerts"), A.sectors("0,1"), A.sectors("1,0")]);
    expect(r.status).toBe("question");
    if (r.status !== "question" || r.question.kind !== "units") throw new Error("expected the choice of units");
    const [b01, m01, b02] = r.question.options;
    const done = cmd(s, [A.option("resolveAlerts"), A.sectors("0,1"), A.sectors("1,0"), A.units(b01!, b02!)]).state;
    expect(sectorState(done, "0,1")).toBe("dark");
    expect(sectorState(done, "1,1")).toBe("dark");
    expect(idOf(done, "1,0")).toBe("M_01");
    expect(m01).toBe(at(done, "1,0"));
  });

  it("T5_GYR_05 G_36 Drain reveals every Dark sector; the Flare's Overload waits", () => {
    const { state } = cmd(given("T5_GYR_05"), [A.option("drainGyro"), A.sectors("0,1")]);
    expect(state.phase).toBe("overload");
    expect(tokensAt(state, "0,1")).toBe("[AL]");
    expect(tokensAt(state, "1,0")).toBe("[AL]");
    expect(sectorState(state, "0,0")).toBe("dark");
  });
});

describe("batch 5 - OMEGA UNITS", () => {
  it("T5_OMG_01 O_02 destroys an Alpha and Boosts itself Strength + 1 times", () => {
    const s = given("T5_OMG_01");
    expect(s.supply.shield).toBe(2);
    const { state } = resolve(s, "0,0", [A.split({ bay1: 1, bay2: 0, bay3: 0 })]);
    expect(tokensAt(state, "0,1")).toBe("[WR][AL]");
    expect(tokensAt(state, "0,0")).toBe("[S2]");
    expect(state.flagship).toEqual([5, 6, 6]);
  });

  it("T5_OMG_02 O_02 with no Alpha: open question Q4", () => {
    expect(() => resolve(given("T5_OMG_02"), "0,0")).toThrow(OpenQuestion);
  });
});

describe("batch 5 - MECHA", () => {
  it("T5_MCH_01 M_02 Expend hits all units in its lines of fire", () => {
    const s = given("T5_MCH_01");
    const { state } = cmd(s, [A.option("commandMecha"), A.option("ability:M_02")]);
    expect(tokensAt(state, "0,-1")).toBe("[D1]");
    expect(tokensAt(state, "1,0")).toBe("[D1]");
    expect(inPile(state, "discard", "M_02")).toBe(1);
  });

  it("T5_MCH_02 M_03 may Move before an Attack", () => {
    const s = given("T5_MCH_02");
    const r = runEffect(data(), s, (c) => commandStep(c), [A.option("commandMecha")]);
    expect(r.status === "question" && optionIds(r.question)).toEqual(["attack", "scrap"]);
    const { state } = cmd(s, [A.option("commandMecha"), A.option("attack")]);
    expect(sectorState(state, "0,2")).toBe("dark");
    expect(inPile(state, "discard", "M_03")).toBe(1);
  });

  it("T5_MCH_03 M_04 Attacks at any distance in a straight line", () => {
    const { state } = cmd(given("T5_MCH_03"), [A.option("commandMecha"), A.option("attack")]);
    expect(sectorState(state, "0,2")).toBe("dark");
    expect(inPile(state, "discard", "B_02")).toBe(1);
  });

  it("T5_MCH_04 M_05 Jumps over a line of units", () => {
    const s = given("T5_MCH_04");
    const m = at(s, "0,-1");
    const { state } = cmd(s, [A.option("commandMecha"), A.option("ability:M_05")]);
    expect(unitAt(state, "0,2")).toBe(m);
  });

  it("T5_MCH_05 M_06 may Swap with a token-free unit before an Attack", () => {
    const s = given("T5_MCH_05");
    const [b03, b02] = [at(s, "1,1"), at(s, "0,2")];
    const r = runEffect(data(), s, (c) => commandStep(c), [A.option("commandMecha"), A.option("attack")]);
    expect(r.status === "question" && optionIds(r.question).sort()).toEqual([`swap:${b02}`, `swap:${b03}`].sort());
    const { state } = cmd(s, [A.option("commandMecha"), A.option("attack"), A.option(`swap:${b03}`), A.units(b02)]);
    expect(unitAt(state, "0,-1")).toBe(b03);
    expect(inPile(state, "discard", "B_02")).toBe(1);
    expect(inPile(state, "discard", "M_06")).toBe(1);
  });

  it("T5_MCH_06 M_07's chain of hits", () => {
    const s = given("T5_MCH_06");
    const { state } = cmd(s, [A.option("commandMecha"), A.option("ability:M_07"), A.units(at(s, "0,2")), A.units(at(s, "1,1"))]);
    expect(sectorState(state, "0,1")).toBe("dark");
    expect(tokensAt(state, "0,2")).toBe("[D1]");
    expect(tokensAt(state, "1,1")).toBe("[D1]");
    expect(inPile(state, "discard", "M_07")).toBe(1);
  });

  it("T5_MCH_07 V1_M04_U2: Reveal the tile beneath what M_04 destroyed", () => {
    const { state } = cmd(given("T5_MCH_07"), [A.option("commandMecha"), A.option("attack"), A.yes()]);
    expect(idOf(state, "0,1")).toBe("B_02");
    expect(tokensAt(state, "0,1")).toBe("[D1]");
    const v = cmd(given("T5_MCH_07", "V1_M04_U2A filled"), [A.option("commandMecha"), A.option("attack"), A.yes()]).state;
    expect(sectorState(v, "0,1")).toBe("dark");
  });
});
