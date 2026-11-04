/**
 * Stage 3: the Command phase.
 * - tests/batch3.txt (DRAFT, written from Core Rules, awaiting the designer);
 * - Command phase scenarios from batch 1: T_UNIT_01, T_SHIP_02, T_OVL_03, T_MOD_03, T_MOD_04.
 */

import { describe, expect, it } from "vitest";
import { commandStep, legalActions, usableBayAbilities } from "../../src/engine/command.js";
import { runEffect } from "../../src/engine/effect.js";
import { tile } from "../../src/engine/field.js";
import { commandOptions } from "../../src/engine/mecha.js";
import type { Answer, Question } from "../../src/engine/questions.js";
import type { GameState } from "../../src/engine/state.js";
import { dealHit } from "../../src/engine/tokens.js";
import { A, at, ctx, data, given, optionIds, play, strengthAt, tokensAt, where, withModules } from "./helpers.js";

/** One Command phase step with scripted answers; must finish. */
const step = (s: GameState, answers: Answer[] = []) => play(s, (c) => commandStep(c), answers);

/** One Command phase step up to the first question the script does not answer. */
function pending(s: GameState, answers: Answer[] = []): { state: GameState; question: Question } {
  const r = runEffect(data(), s, (c) => commandStep(c), answers);
  if (r.status !== "question") throw new Error(`expected a question, got ${r.status}`);
  return { state: r.state, question: r.question };
}

const legal = (s: GameState) => legalActions(ctx(s));
const stackOf = (s: GameState, k: string) => [...s.field[k]!].reverse().map((id) => `${s.tiles[id]!.faceUp ? "" : "fd:"}${s.tiles[id]!.unitId ?? "?"}`);

describe("batch 3 - TAKING ACTIONS (8.1)", () => {
  it("T3_ACT_01 the action menu lists every action you can start, plus Concede", () => {
    const s = withModules(given("T3_ACT_01"), [[1, true]]);
    expect(legal(s)).toEqual(["commandMecha", "reveal", "runModule", "useBay", "drainGyro", "drainBioShield", "issueOrder", "overhaul"]);
    expect(usableBayAbilities(ctx(s)).map((b) => b.id)).toEqual(["V1_BAY1", "V1_BAY2", "V1_BAY3"]);
    expect(optionIds(pending(s).question)).toContain("concede");
  });

  it("T3_ACT_02 an action you cannot pay for is not legal", () => {
    const s = withModules(given("T3_ACT_02"), [[1, true]]);
    expect(legal(s)).not.toContain("runModule");
    expect(legal(s)).not.toContain("issueOrder");
    const s2 = withModules(given("T3_ACT_02"), [[1, true, { Yellow: 1 }]]);
    expect(legal(s2)).toContain("runModule");
  });

  it("T3_ACT_03 [Overload] Bays and Orders are not offered in the Command phase", () => {
    const s = given("T3_ACT_03");
    expect(s.flagship).toEqual([6, 5, 4, 3, 2]);
    expect(usableBayAbilities(ctx(s)).map((b) => b.bay)).toEqual([1, 2, 3, 4]);
    expect(legal(s)).not.toContain("issueOrder");
  });

  it("T3_ACT_04 a Bay at 0 Integrity cannot be used", () => {
    expect(usableBayAbilities(ctx(given("T3_ACT_04"))).map((b) => b.bay)).toEqual([2, 3]);
  });

  it("T3_ACT_05 an action that would do nothing is still legal", () => {
    const { state } = step(given("T3_ACT_05"), [A.option("useBay"), A.option("V1_BAY3")]);
    expect(state.flagship).toEqual([6, 6, 5]);
  });

  it("T3_ACT_06 no legal action is a loss", () => {
    const s = given("T3_ACT_06");
    expect(s.player.commandTokens).toBe(0);
    const { state } = step(s);
    expect(state.outcome).toEqual({ result: "lost", reason: "you have no legal action" });
    expect(state.phase).toBe("gameEnd");
  });

  it("T3_ACT_07 Crippled: Overhaul is the only action", () => {
    const { question } = pending(given("T3_ACT_07"));
    expect(optionIds(question)).toEqual(["overhaul", "concede"]);
  });

  it("T_SHIP_02 Crippled with no Overhaul slot = loss", () => {
    const { state } = step(given("T_SHIP_02", "Flagship 0/0/0"));
    expect(state.outcome?.result).toBe("lost");
  });

  it("T_OVL_03 Alerts first: only Resolve Alerts and Overhaul", () => {
    const s = withModules(given("T_OVL_03", "(0,1): fd"), [[1, true]]);
    expect(legal(s)).toEqual(["resolveAlerts", "overhaul"]);
  });
});

describe("batch 3 - OBJECTIVE (8.2)", () => {
  it("T3_OBJ_01 Eliminate met: Mission End, leftover Alerts cleared", () => {
    const { state } = step(given("T3_OBJ_01"));
    expect(state.phase).toBe("missionEnd");
    expect(tokensAt(state, "0,0")).toBe("[WR]");
    expect(state.player.reserve.Red).toBe(0);
  });

  it("T3_OBJ_02 Salvage needs 5 Power Nodes and 3 Cleared sectors", () => {
    expect(pending(given("T3_OBJ_02")).question.rule).toBe("8.1");
    const { state } = step(given("T3_OBJ_02", "(0,1): cleared"));
    expect(state.phase).toBe("missionEnd");
  });

  it("T3_OBJ_03 the objective is checked before the Flagship", () => {
    const { state } = step(given("T3_OBJ_03"));
    expect(state.phase).toBe("missionEnd");
    expect(state.outcome).toBeUndefined();
  });
});

describe("batch 3 - REVEAL (8.5)", () => {
  it("T3_REV_01 Reveal a Bot: no facing asked for a tile without arrows", () => {
    const { state, asked } = step(given("T3_REV_01"), [A.option("reveal")]);
    expect(asked).toHaveLength(1);
    expect(tile(state, at(state, "0,1")).unitId).toBe("B_02");
  });

  it("T3_REV_02 a revealed Sentinel gets a Barrier at once; none left = none", () => {
    const { state } = step(given("T3_REV_02"), [A.option("reveal")]);
    expect(tokensAt(state, "0,1")).toBe("[BAR]");
    expect(state.supply.barrier).toBe(9);
    const r2 = step(given("T3_REV_02", "Barrier supply 0"), [A.option("reveal")]);
    expect(tokensAt(r2.state, "0,1")).toBe("");
  });

  it("T3_REV_03 a unit with arrows: choose its facing", () => {
    const { state, asked } = step(given("T3_REV_03"), [A.option("reveal"), A.option("2")]);
    expect(asked[1]).toMatchObject({ kind: "option", rule: "3.7" });
    expect(tile(state, at(state, "0,0")).facing).toBe(2);
  });

  it("T3_REV_04 a Flare: energy on the ready Module, then the Overload starts", () => {
    const s = withModules(given("T3_REV_04"), [[1, true]]);
    const { state } = step(s, [A.option("reveal")]);
    expect(state.player.modules[0]!.energy).toEqual({ Yellow: 1, Red: 0, Blue: 0 });
    expect(state.phase).toBe("overload");
    expect(tokensAt(state, "0,1")).toBe("[AL]");
    expect(tokensAt(state, "1,0")).toBe("[BAR][AL]");
    expect(tokensAt(state, "0,0")).toBe(""); // B_03
  });

  it("T_MOD_03 Flare energy with no ready Module stays in the Supply; the Overload still starts", () => {
    const s = withModules(given("T_MOD_03"), [[1, false]]);
    const { state } = step(s, [A.option("reveal"), A.option("0")]); // F_09 has arrows: facing asked
    expect(state.supply.energy.Yellow).toBe(10);
    expect(state.phase).toBe("overload");
  });

  it("T3_REV_05 Power Node energy split among ready Modules", () => {
    const s = withModules(given("T3_REV_05"), [
      [1, true],
      [26, true],
    ]);
    // Q9: each colour only on a ready Module of that colour: one each, so no question; no Blue Module, so Blue stays in the Supply.
    const { state, asked } = step(s, [A.option("reveal")]);
    expect(asked).toHaveLength(1);
    expect(state.player.modules[0]!.energy).toEqual({ Yellow: 1, Red: 0, Blue: 0 });
    expect(state.player.modules[1]!.energy).toEqual({ Yellow: 0, Red: 1, Blue: 0 });
    expect(state.log.some((e) => /no ready Blue Module/.test(e.text))).toBe(true);
    expect(state.phase).toBe("overload");
  });

  it("T3_REV_06 revealing the last Dark sector wakes Sleepers", () => {
    const { state } = step(given("T3_REV_06"), [A.option("reveal")]);
    expect(tokensAt(state, "1,0")).toBe("[AL]");
    expect(legal(state)).toEqual(["resolveAlerts", "overhaul"]);
  });
});

describe("batch 3 - MECHA (4.2, 8.4)", () => {
  it("T3_MCH_01 Attack: one hit of the Mecha's Strength, then the Mecha is destroyed", () => {
    const s = given("T3_MCH_01");
    const m = at(s, "0,0");
    const { state } = step(s, [A.option("commandMecha"), A.option("attack"), A.units(at(s, "0,1"))]);
    expect(tokensAt(state, "0,1")).toBe("[D1]");
    expect(where(state, m)).toBe("discard");
    expect(stackOf(state, "0,0")).toEqual(["fd:?"]);
  });

  it("T3_MCH_02 Scrap: energy equal to Strength, in any mix; short Supply = what there is", () => {
    const s = given("T3_MCH_02");
    expect(strengthAt(s, "0,0")).toBe(4);
    const { state } = step(s, [A.option("commandMecha"), A.option("scrap"), A.split({ Yellow: 2, Red: 1, Blue: 1 })]);
    expect(state.player.reserve).toEqual({ Yellow: 2, Red: 1, Blue: 1 });
    expect(state.field["0,0"]).toEqual([]);
    const s2 = given("T3_MCH_02");
    s2.supply.energy = { Yellow: 0, Red: 1, Blue: 0 };
    const r2 = step(s2, [A.option("commandMecha"), A.option("scrap")]);
    expect(r2.state.player.reserve).toEqual({ Yellow: 0, Red: 1, Blue: 0 });
  });

  it("T3_MCH_03 no adjacent unit that can be chosen: no Attack", () => {
    const s = given("T3_MCH_03");
    expect(commandOptions(ctx(s), at(s, "0,2"), "command").map((o) => o.id)).toEqual(["scrap", "ability:M_01"]);
  });

  it("T3_MCH_04 [Overload] Mecha abilities are not offered in the Command phase", () => {
    const s = given("T3_MCH_04");
    expect(commandOptions(ctx(s), at(s, "0,0"), "command").map((o) => o.id)).toEqual(["attack", "scrap", "ability:M_02"]);
  });

  it("T3_MCH_05 an alerted Mecha must be Commanded, timing tags ignored", () => {
    const s = given("T3_MCH_05");
    expect(legal(s)).toEqual(["resolveAlerts", "overhaul"]);
    const { question } = pending(s, [A.option("resolveAlerts")]);
    expect(optionIds(question)).toEqual(["attack", "scrap", "ability:M_02", "ability:V1_M02_U2"]);
  });

  it("T_UNIT_01 M_01 moves onto the last Dark sector: Sleepers wake", () => {
    const s = given("T_UNIT_01");
    const { state } = step(s, [A.option("commandMecha"), A.option("ability:M_01")]);
    expect(state.field["1,1"]).toEqual([]);
    expect(stackOf(state, "0,2")).toEqual(["M_01", "fd:?"]);
    expect(tokensAt(state, "-1,0")).toBe("[AL]");
    expect(legal(state)).toEqual(["resolveAlerts", "overhaul"]);
  });
});

describe("batch 3 - BAYS (5.2, 8.7)", () => {
  it("T3_BAY_01 using a Bay costs 1 Integrity from that Bay", () => {
    const s = given("T3_BAY_01");
    const { state, asked } = step(s, [A.option("useBay"), A.option("V1_BAY1"), A.units(at(s, "0,1"))]);
    expect(state.flagship).toEqual([5, 6, 6]);
    expect(tokensAt(state, "0,1")).toBe("[D1]");
    expect(asked.some((q) => q.kind === "split")).toBe(false);
  });

  it("T3_BAY_02 V1 Bay 2 moves a unit onto an adjacent Dark or Cleared sector", () => {
    const s = given("T3_BAY_02");
    const b = at(s, "0,0");
    const { state, asked } = step(s, [A.option("useBay"), A.option("V1_BAY2"), A.units(b), A.sectors("0,1")]);
    expect(optionIds(asked[3]).sort()).toEqual(["0,1", "1,0"]);
    expect(stackOf(state, "0,1")).toEqual(["B_02", "fd:S_12", "fd:?"]);
    expect(tokensAt(state, "0,1")).toBe("[S1]");
    expect(stackOf(state, "0,0")).toEqual(["fd:B_01"]);
  });

  it("T3_BAY_03 V1 Bay 3 reorders the top tiles, then reveals", () => {
    const s = given("T3_BAY_03");
    const [b01, s12, g05] = [...s.field["0,1"]!].reverse();
    const { state, asked } = step(s, [A.option("useBay"), A.option("V1_BAY3"), A.option(`${s12}>${g05}>${b01}`)]);
    expect(optionIds(asked[2])).toHaveLength(6);
    expect(stackOf(state, "0,1")).toEqual(["S_12", "fd:G_05", "fd:B_01", "fd:?"]);
    expect(tokensAt(state, "0,1")).toBe("[BAR]");
    expect(state.seen).toEqual(expect.arrayContaining([b01, s12, g05]));
  });

  it("T3_BAY_04 a Bay's last Integrity still pays for its ability; then Overhaul is forced", () => {
    const s = given("T3_BAY_04");
    const asLooked = [...s.field["0,1"]!].reverse().join(">"); // put the 2 tiles back as they were
    const { state } = step(s, [A.option("useBay"), A.option(asLooked)]);
    expect(state.flagship).toEqual([0, 0, 0]);
    expect(tile(state, at(state, "0,1")).unitId).toBe("B_01");
    expect(optionIds(pending(state).question)).toEqual(["overhaul", "concede"]);
  });

  it("T3_BAY_05 V2 Bay 2 swaps two adjacent units, tokens and facings kept", () => {
    const s = given("T3_BAY_05");
    const [b, x] = [at(s, "0,0"), at(s, "0,1")];
    const { state } = step(s, [A.option("useBay"), A.option("V2_BAY2"), A.units(b), A.units(x)]);
    expect(stackOf(state, "0,0")).toEqual(["S_12", "fd:?"]);
    expect(tokensAt(state, "0,0")).toBe("[BAR]");
    expect(tile(state, at(state, "0,0")).facing).toBe(2);
    expect(tokensAt(state, "0,1")).toBe("[S1]");
  });

  it("T3_BAY_06 an upgraded Bay offers every ability it has (V2_P3: lift the fourth tile)", () => {
    const s = given("T3_BAY_06");
    const { state, asked } = step(s, [A.option("useBay"), A.option("V2_P3"), A.yes()]);
    expect(optionIds(asked[1])).toEqual(expect.arrayContaining(["V2_BAY3", "V2_P3"]));
    expect(stackOf(state, "0,1")).toEqual(["fd:S_01", "fd:B_01", "fd:B_02", "fd:B_03", "fd:?"]);
  });

  it("T_MOD_04 V2 Bay 1 with V2_P1: a choice of two abilities, either costs Bay 1 one Integrity", () => {
    const s = given("T_MOD_04");
    const bay1 = usableBayAbilities(ctx(s)).filter((b) => b.bay === 1);
    expect(bay1.map((b) => b.text)).toEqual(["Deal 1 damage to a Level 3 unit.", "Deal 1 damage to a Level 2 unit."]);
    const { state } = step(s, [A.option("useBay"), A.option("V2_P1")]);
    expect(state.flagship[0]).toBe(5);
    expect(tokensAt(state, "0,0")).toBe("[D1]"); // B_02, the only Level 2 unit
  });

  it("T3_BAY_07 V2 Bay 4 places a Tick on a Level 1 unit", () => {
    const { state } = step(given("T3_BAY_07"), [A.option("useBay"), A.option("V2_BAY4")]);
    expect(tokensAt(state, "0,0")).toBe("[TICK]");
    expect(state.supply.tick).toBe(9);
  });
});

describe("batch 3 - DRAIN (4.3, 6.3, 8.7)", () => {
  it("T3_DRN_01 drain an Energy Gyro", () => {
    const { state } = step(given("T3_DRN_01"), [A.option("drainGyro")]);
    expect(state.player.reserve.Yellow).toBe(1);
    expect(stackOf(state, "0,0")).toEqual(["fd:?"]);
    expect(state.piles.discard.some((id) => id.startsWith("G_01"))).toBe(true);
  });

  it("T3_DRN_02 drain a Bio-shield: Boost an adjacent non-Mecha unit", () => {
    const s = given("T3_DRN_02");
    const { state, asked } = step(s, [A.option("drainBioShield"), A.units(at(s, "1,0"))]);
    expect(optionIds(asked[1])).not.toContain(at(s, "0,1")); // M_01
    expect(tokensAt(state, "0,0")).toBe("");
    expect(tokensAt(state, "1,0")).toBe("[S1]");
    expect(state.supply.bioShield).toBe(10);
  });

  it("T3_DRN_03 drain a Bio-shield with nothing to Boost", () => {
    const { state } = step(given("T3_DRN_03"), [A.option("drainBioShield")]);
    expect(tokensAt(state, "0,2")).toBe("");
    expect(state.supply.bioShield).toBe(10);
  });
});

describe("batch 3 - ORDERS (5.6, 8.7)", () => {
  it("T3_ORD_01 Mission 1 Order: 1 damage to all units", () => {
    const s = given("T3_ORD_01");
    const b01 = at(s, "0,0");
    const { state } = step(s, [A.option("issueOrder")]);
    expect(state.player.commandTokens).toBe(2);
    expect(where(state, b01)).toBe("discard");
    expect(tokensAt(state, "1,0")).toBe("");
    expect(tokensAt(state, "1,1")).toBe("[WR][AL]");
    expect(tokensAt(state, "0,1")).toBe(""); // F_09 skipped
    for (const k of ["0,-1", "1,-1", "0,2", "-1,0", "-1,1", "-1,2"]) expect(tokensAt(state, k)).toBe("[D1]");
    expect(legal(state)).toEqual(["resolveAlerts", "overhaul"]);
  });

  it("T3_ORD_02 an Order can be issued again while you can pay", () => {
    const s = given("T3_ORD_02");
    const [x, y] = [at(s, "0,0"), at(s, "0,1")];
    const r1 = step(s, [A.option("issueOrder"), A.units(x)]);
    const r2 = step(r1.state, [A.option("issueOrder")]); // one Level 2 Bot left: chosen automatically
    expect(where(r2.state, x)).toBe("discard");
    expect(where(r2.state, y)).toBe("discard");
    expect(r2.state.supply.barrier).toBe(10);
    expect(r2.state.player.commandTokens).toBe(2);
    expect(legal(r2.state)).toContain("issueOrder");
  });
});

describe("batch 3 - OVERHAUL (8.8)", () => {
  it("T3_OVH_01 Overhaul, all five steps", () => {
    const s = withModules(
      given("T3_OVH_01"),
      [
        [1, true],
        [2, false],
      ],
      [3, 4],
    );
    const [s01, b02] = [at(s, "0,0"), at(s, "0,1")];
    const { state, asked } = step(s, [A.option("overhaul"), A.option("2"), A.units(s01, b02)]);
    expect(optionIds(asked[2])).not.toContain(at(s, "0,2")); // F_09
    expect(state.sheet.overhaulUsed).toBe(1);
    expect(state.flagship).toEqual([6, 6, 6]);
    expect(state.player.reserve).toEqual({ Yellow: 6, Red: 7, Blue: 6 });
    expect(state.player.modules.map((m) => [m.id, m.ready])).toEqual([
      [1, true],
      [3, true],
      [4, true],
    ]);
    expect(state.decks.modules).toEqual([2]);
    expect(tokensAt(state, "0,0")).toBe("");
    expect(stackOf(state, "0,1")).toEqual(["fd:B_01", "B_02"]);
    expect(tile(state, b02).tokens.damage).toBe(0);
    expect(tokensAt(state, "0,2")).toBe("[AL]");
  });

  it("T3_OVH_02 Overhaul is allowed while Alerts wait", () => {
    expect(legal(given("T3_OVH_02"))).toEqual(["resolveAlerts", "overhaul"]);
  });

  it("T3_OVH_03 no empty Overhaul slot: no Overhaul", () => {
    expect(legal(given("T3_OVH_03"))).not.toContain("overhaul");
  });
});

describe("batch 3 - RESOLVE ALERTS (8.3)", () => {
  it("T3_ALR_01 resolve Alerts until none are left, in your order", () => {
    const s = given("T3_ALR_01");
    const g08 = at(s, "0,1");
    const { state } = step(s, [A.option("resolveAlerts"), A.order(g08)]);
    expect(state.player.reserve).toEqual({ Yellow: 0, Red: 2, Blue: 2 });
    expect(state.field["0,1"]).toEqual([]);
    expect(stackOf(state, "0,0")).toEqual(["fd:?"]);
    expect(legal(state)).not.toContain("resolveAlerts");
  });

  it("T3_ALR_02 a Destroyed effect replaces the Drain of an alerted Gyro", () => {
    const s = given("T3_ALR_02");
    const r1 = play(s, (c) => dealHit(c, at(c.state, "0,0"), 1));
    expect(tokensAt(r1.state, "0,0")).toBe("[WR][AL]");
    const { state } = step(r1.state, [A.option("resolveAlerts"), A.order(at(s, "0,0"))]);
    expect(state.player.reserve.Red).toBe(2);
    expect(state.player.reserve.Blue).toBe(2);
  });
});

describe("batch 3 - GAME END (10.3)", () => {
  it("T3_END_01 Concede is a loss", () => {
    const { state } = step(given("T3_END_01"), [A.option("concede")]);
    expect(state.outcome?.result).toBe("conceded");
    expect(state.phase).toBe("gameEnd");
  });
});

describe("the screen's shortcuts (one click = the menu entry and its choices)", () => {
  it("every action of T3_ACT_01 has its shortcuts, on the right things", () => {
    const s = withModules(given("T3_ACT_01"), [[1, true]]);
    const q = pending(s).question;
    const sc = q.kind === "option" ? q.shortcuts ?? [] : [];
    const kinds = new Set(sc.map((o) => o.id.split(":")[0]));
    expect([...kinds]).toEqual(["mecha", "reveal", "module", "bay", "gyro", "bio", "order", "overhaul", "concede"]);
    for (const o of sc) expect(o.on).toBeDefined();
  });

  it("a shortcut gives the same result as the menu path", () => {
    const s = withModules(given("T3_ACT_01"), [[1, true]]);
    const q = pending(s).question;
    const sc = q.kind === "option" ? q.shortcuts ?? [] : [];
    const mech = sc.find((o) => o.id.startsWith("mecha:") && o.id.endsWith(":scrap"))!;
    const u = mech.id.split(":")[1]!;
    const which = pending(s, [A.option("commandMecha")]).question.prompt.startsWith("Command which") ? [A.option(u)] : [];
    const viaMenu = step(structuredClone(s), [A.option("commandMecha"), ...which, A.option("scrap"), A.split({ Yellow: 1, Red: 0, Blue: 0 })]).state;
    const viaShortcut = step(structuredClone(s), [A.option(mech.id), A.split({ Yellow: 1, Red: 0, Blue: 0 })]).state;
    expect(viaShortcut.player.reserve).toEqual(viaMenu.player.reserve);
    expect(viaShortcut.field).toEqual(viaMenu.field);
    const reveal = sc.find((o) => o.id.startsWith("reveal:"))!;
    const k = reveal.id.slice("reveal:".length);
    const r0 = runEffect(data(), structuredClone(s), (c) => commandStep(c), [A.option("reveal")]);
    const many = r0.status === "question" && r0.question.kind === "sectors";
    const a = runEffect(data(), structuredClone(s), (c) => commandStep(c), [A.option(reveal.id)]);
    const b = runEffect(data(), structuredClone(s), (c) => commandStep(c), [A.option("reveal"), ...(many ? [A.sectors(k)] : [])]);
    expect(a.status).toBe(b.status);
    if (a.status === "illegal" || b.status === "illegal") throw new Error("illegal");
    expect(JSON.stringify(a.state.field)).toBe(JSON.stringify(b.state.field));
    expect(a.state.log.at(-1)).toEqual(b.state.log.at(-1));
  });
});
