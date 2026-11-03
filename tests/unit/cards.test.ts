/**
 * Card tests for the cards built early in stage 4 (spec "Testing": every
 * card effect at least once, including its "do as much as you can" case).
 * S_01, S_12, F_04, F_13, P_05, O_01, O_03, V1_M02_U2, Modules 1 and 26.
 */

import { describe, expect, it } from "vitest";
import { overloadStep } from "../../src/engine/overload.js";
import { commandStep } from "../../src/engine/command.js";
import { scenarioState } from "../../src/engine/scenario.js";
import type { GameState } from "../../src/engine/state.js";
import { sectorState } from "../../src/engine/field.js";
import { A, at, data, play, tokensAt, withModules } from "./helpers.js";

const board = (given: string) => scenarioState(data(), "M1", given);
const ovl = (s: GameState, answers = [] as Parameters<typeof play>[2]) => play(s, (c) => overloadStep(c), answers);
const resolve = (s: GameState, k: string, answers: Parameters<typeof play>[2] = []) => ovl(s, [A.option(`alert:${at(s, k)}`), ...(answers ?? [])]);

describe("Sentinels", () => {
  it("S_01 deals 1 damage to your Flagship", () => {
    expect(resolve(board("Overload under way. (0,0): S_01[AL] > fd."), "0,0", [A.split({ bay3: 1 })]).state.flagship).toEqual([6, 6, 5]);
  });

  it("S_12 destroys an adjacent Bot and deals 2 damage; no adjacent Bot: nothing", () => {
    const s = board("Overload under way. (0,0): S_12[AL] > fd. (0,1): B_01 > fd.");
    const { state } = resolve(s, "0,0", [A.units(at(s, "0,1")), A.split({ bay1: 2 })]);
    expect(state.flagship).toEqual([4, 6, 6]);
    expect(sectorState(state, "0,1")).toBe("dark");
    const lone = board("Overload under way. Every other sector cleared. (0,0): S_12[AL] > fd. (0,1): G_05 > fd.");
    const r = resolve(lone, "0,0");
    expect(r.asked).toHaveLength(1); // only the action menu
    expect(r.state.flagship).toEqual([6, 6, 6]);
  });
});

describe("Flares", () => {
  it("F_04 reveals one unit and may deal it 2 damage (may = No)", () => {
    const s = board("Overload under way. (0,0): F_04[AL] > fd. (0,1): fd:B_02 > fd.");
    expect(tokensAt(resolve(s, "0,0", [A.no()]).state, "0,1")).toBe("");
  });

  it("F_04 with no Dark sector does nothing", () => {
    const s = board("Overload under way. (0,0): F_04[AL] > fd.");
    expect(resolve(s, "0,0").asked).toHaveLength(1); // only the action menu
  });

  it("F_13 activates every Mecha, not Wrecks or other units", () => {
    const s = board("Overload under way. (0,0): F_13[AL] > fd. (0,1): M_01 > fd. (1,0): M_02 > fd. (1,1): G_05 > fd.");
    const { state } = resolve(s, "0,0");
    expect(tokensAt(state, "0,1")).toBe("[AL]");
    expect(tokensAt(state, "1,0")).toBe("[AL]");
    expect(tokensAt(state, "1,1")).toBe("");
  });
});

describe("Sleepers", () => {
  it("P_05 in the Command phase starts an Overload; no Sentinel: no repair", () => {
    const s = board("Flagship 6/6/4. (0,0): P_05[AL] > fd.");
    const { state } = play(s, (c) => commandStep(c), [A.option("resolveAlerts")]);
    expect(state.phase).toBe("overload");
    expect(state.flagship).toEqual([6, 6, 4]);
  });
});

describe("Omega units (Campaign 1 board)", () => {
  it("O_01 Destroyed: Boost one adjacent non-Mecha unit, then to the Trophy pile", () => {
    const s = board("Overload under way. Every other sector cleared. (0,0): O_01 Wreck [WR][AL] > fd. (0,1): M_01 > fd. (1,0): B_01 > fd.");
    const o = at(s, "0,0");
    const { state, asked } = resolve(s, "0,0");
    expect(asked).toHaveLength(1); // the action menu; the only non-Mecha neighbour is auto-answered
    expect(tokensAt(state, "1,0")).toBe("[S1]");
    expect(tokensAt(state, "0,1")).toBe("");
    expect(state.piles.trophy).toContain(o);
  });

  it("O_03 At Overload: 1 damage to your Flagship only if adjacent to an Alpha", () => {
    const near = board("Overload under way. (0,0): O_03[AL] > fd. (0,1): O_01 > fd.");
    expect(resolve(near, "0,0", [A.split({ bay2: 1 })]).state.flagship).toEqual([6, 5, 6]);
    const far = board("Overload under way. (0,0): O_03[AL] > fd.");
    expect(resolve(far, "0,0").state.flagship).toEqual([6, 6, 6]);
  });
});

describe("Mecha upgrades", () => {
  it("V1_M02_U2 [Overload] Command: Teleport to any Dark or Cleared sector", () => {
    const s = board("Overload under way. V1_M02_U2 filled. (0,0): M_02 > fd. (0,2): fd. (-1,2): cleared.");
    const m = at(s, "0,0");
    const { state } = ovl(s, [A.option("commandMecha"), A.sectors("-1,2")]);
    expect(state.field["-1,2"]).toEqual([m]);
  });
});

describe("Modules", () => {
  it("Demolition Blast: 2 damage to one unit, then destroy one Bot", () => {
    const s = withModules(board("(0,0): O_01 > fd. (0,1): B_02 > fd."), [[1, true]]);
    s.player.reserve.Yellow = 3;
    s.supply.energy.Yellow = 7;
    const { state } = play(s, (c) => commandStep(c), [A.option("runModule"), A.units(at(s, "0,0")), A.units(at(s, "0,1"))]);
    expect(tokensAt(state, "0,0")).toBe("[D2]");
    expect(sectorState(state, "0,1")).toBe("dark");
    expect(state.player.modules[0]!.ready).toBe(false);
    expect(state.player.reserve.Yellow).toBe(0);
  });

  it("Charged Beam: extra payment of 1-3 Red adds to the same hit, paid from the Module and the Reserve", () => {
    const s = withModules(board("Overload under way. (0,0): O_01 > fd."), [[26, true, { Red: 2 }]]);
    s.player.reserve.Red = 4;
    s.supply.energy.Red = 4;
    // Cost 4: use 2 stored + 2 Reserve; then pay 2 more from the Reserve: one hit of 4 destroys the Strength 3 Alpha.
    const { state } = ovl(s, [A.option("runModule"), A.amount(2), A.units(at(s, "0,0")), A.amount(2)]);
    expect(tokensAt(state, "0,0")).toBe("[WR][AL]");
    expect(state.player.reserve.Red).toBe(0);
    expect(state.supply.energy.Red).toBe(10);
  });

  it("Charged Beam: the extra payment may be skipped, and may use energy left on the Module", () => {
    const s = withModules(board("Overload under way. (0,0): B_03[S2] > fd."), [[26, true, { Red: 3 }]]);
    s.player.reserve.Red = 3;
    s.supply.energy.Red = 4;
    // Pay the cost with 1 stored + 3 Reserve; 2 left on the Module; pay 1 extra from it.
    const { state } = ovl(s, [A.option("runModule"), A.amount(1), A.units(at(s, "0,0")), A.amount(1)]);
    expect(tokensAt(state, "0,0")).toBe("[D1]"); // 3 damage: 2 Shields, then 1 Damage
    expect(state.player.modules[0]!.energy.Red).toBe(0); // the last 1 returns to the Supply
    const skip = ovl(s, [A.option("runModule"), A.amount(1), A.units(at(s, "0,0")), A.amount(0)]).state;
    expect(tokensAt(skip, "0,0")).toBe("");
  });
});
