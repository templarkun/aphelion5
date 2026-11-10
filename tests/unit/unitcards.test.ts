/**
 * Stage 5 card tests (spec "Testing": every card effect at least once).
 * Cards already covered by batch 5 (units.test.ts) or stage 4 (cards.test.ts)
 * are listed in COVERED_ELSEWHERE; the last test checks nothing is missed.
 */

import { describe, expect, it } from "vitest";
import { commandStep } from "../../src/engine/command.js";
import { runEffect } from "../../src/engine/effect.js";
import type { Answer } from "../../src/engine/questions.js";
import { sectorState, tile, unitAt } from "../../src/engine/field.js";
import { overloadStep } from "../../src/engine/overload.js";
import { scenarioState } from "../../src/engine/scenario.js";
import type { GameState } from "../../src/engine/state.js";
import { A, at, ctx, data, play, tokensAt, withModules } from "./helpers.js";

const tested = new Set<string>();
const card = (id: string, name: string, fn: () => void) =>
  it(`${id} ${name}`, () => {
    tested.add(id);
    fn();
  });

const OVL = "Overload under way. Every other sector cleared. ";
const CMD = "Every other sector cleared. ";
const board = (given: string) => scenarioState(data(), "M1", given);
/** Resolve the Alert in (0,0) during an Overload. */
const ovl = (given: string, answers: Answer[] = [], setup: (s: GameState) => void = () => {}) => {
  const s = board(OVL + given);
  setup(s);
  return play(s, (c) => overloadStep(c), [A.option(`alert:${at(s, "0,0")}`), ...answers]).state;
};
/** One Command phase action. */
const cmd = (given: string, answers: Answer[], setup: (s: GameState) => void = () => {}) => {
  const s = board(CMD + given);
  setup(s);
  return play(s, (c) => commandStep(c), answers).state;
};
const resolveAll = (given: string, answers: Answer[] = [], setup?: (s: GameState) => void) => cmd(given, [A.option("resolveAlerts"), ...answers], setup);
const drain = (given: string, answers: Answer[] = [], setup?: (s: GameState) => void) => cmd(given, [A.option("drainGyro"), ...answers], setup);
const idAt = (s: GameState, k: string) => tile(s, at(s, k)).unitId;
const gone = (s: GameState, k: string) => expect(sectorState(s, k)).not.toBe("occupied");
const mods = (...m: [number, Partial<Record<"Yellow" | "Red" | "Blue", number>>?][]) => (s: GameState) => void withModules(s, m.map(([id, e]) => [id, true, e ?? {}]));
const bay1 = (n: number) => A.split({ bay1: n, bay2: 0, bay3: 0 });

describe("Sentinels", () => {
  card("S_02", "removes 1 damage from each adjacent unit", () => {
    const s = ovl("(0,0): S_02[AL] > fd. (0,1): B_02[D1] > fd. (1,0): B_01 > fd.");
    expect(tokensAt(s, "0,1")).toBe("");
  });
  card("S_03", "Boosts itself if Strength < 3", () => {
    expect(tokensAt(ovl("(0,0): S_03[AL] > fd."), "0,0")).toBe("[S1]");
    expect(tokensAt(ovl("(0,0): S_03[AL][S2] > fd."), "0,0")).toBe("[S2]");
  });
  card("S_04", "Boosts the Bots of the most abundant Level", () => {
    const s = ovl("(0,0): S_04[AL] > fd. (0,1): B_01 > fd. (1,0): B_02 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[S1]");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  card("S_06", "reveals an adjacent Dark sector and destroys an adjacent Mecha", () => {
    const s = ovl("(0,0): S_06[AL] > fd. (0,1): fd:B_01 > fd. (1,0): M_01 > fd.");
    expect(idAt(s, "0,1")).toBe("B_01");
    expect(sectorState(s, "1,0")).toBe("dark");
  });
  card("S_07", "puts a Mecha at the very bottom of its sector, without tokens", () => {
    const s = ovl("(0,0): S_07[AL] > fd. (0,1): M_01[D1] > fd.");
    const bottom = s.tiles[s.field["0,1"]![0]!]!;
    expect(bottom.unitId).toBe("M_01");
    expect(bottom.tokens.damage).toBe(0);
    expect(sectorState(s, "0,1")).toBe("dark");
  });
  card("S_08", "removes energy for each Bot not adjacent", () => {
    const s = ovl("(0,0): S_08[AL] > fd. (0,2): B_01 > fd. (0,1): B_01 > fd.", [], mods([26, { Red: 2 }]));
    expect(s.player.modules[0]!.energy.Red).toBe(1);
  });
  card("S_09", "Boosts all Bots of the chosen Level", () => {
    const s = ovl("(0,0): S_09[AL] > fd. (0,1): B_02 > fd. (1,0): B_01 > fd.", [A.option("2")]);
    expect(tokensAt(s, "0,1")).toBe("[S1]");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  card("S_10", "reveals two units and Boosts the Bots among them", () => {
    const s = ovl("(0,0): S_10[AL] > fd. (0,1): fd:B_01 > fd. (1,0): fd:G_05 > fd.", [A.sectors("0,1")]);
    expect(tokensAt(s, "0,1")).toBe("[S1]");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  card("S_11", "buries itself; a revealed Mecha takes 2", () => {
    const s = ovl("(0,0): S_11[AL] > fd:M_01 > fd.");
    expect(s.piles.discard.map((id) => s.tiles[id]!.unitId)).toContain("M_01");
    expect(idAt(s, "0,0")).toBe("S_11"); // uncovered again
  });
  card("S_13", "removes all energy from one Module", () => {
    const s = ovl("(0,0): S_13[AL] > fd.", [A.option("26")], mods([26, { Red: 2 }], [1, { Yellow: 1 }]));
    expect(s.player.modules[0]!.energy.Red).toBe(0);
    expect(s.player.modules[1]!.energy.Yellow).toBe(1);
  });
  card("S_14", "Boosts the row through it with the most Bots, itself included", () => {
    const s = ovl("(0,0): S_14[AL] > fd. (0,1): B_01 > fd. (1,0): B_02 > fd. (-1,0): B_01 > fd.");
    expect(tokensAt(s, "0,0")).toBe("[S1]");
    expect(tokensAt(s, "1,0")).toBe("[S1]");
    expect(tokensAt(s, "-1,0")).toBe("[S1]");
    expect(tokensAt(s, "0,1")).toBe("");
  });
  card("S_15", "1 Flagship damage per Mecha just revealed", () => {
    const s = ovl("(0,0): S_15[AL] > fd. (0,1): fd:M_01 > fd. (1,0): fd:B_01 > fd.", [A.sectors("0,1"), bay1(1)]);
    expect(s.flagship).toEqual([5, 6, 6]);
  });
  card("S_17", "Boosts all adjacent Gyros", () => {
    const s = ovl("(0,0): S_17[AL] > fd. (0,1): G_05 > fd. (1,0): B_01 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[S1]");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  card("S_18", "1 damage to Mecha and Gyros in a horizontal row with a Mecha", () => {
    const s = ovl("(0,0): S_18[AL] > fd. (0,1): M_02 > fd. (0,2): G_01 > fd. (1,0): G_05 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[D1]");
    expect(tokensAt(s, "0,2")).toBe("[D1]");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  card("S_19", "1 damage to all Gyros, 1 Flagship damage per Gyro destroyed", () => {
    const s = ovl("(0,0): S_19[AL] > fd. (0,1): G_05 > fd. (1,0): G_01 > fd.", [bay1(1)]);
    expect(tokensAt(s, "0,1")).toBe("[WR][AL]");
    expect(tokensAt(s, "1,0")).toBe("[D1]");
    expect(s.flagship).toEqual([5, 6, 6]);
  });
  card("S_23", "places a Barrier on a Sentinel that has none", () => {
    const s = ovl("(0,0): S_23[AL] > fd. (0,1): S_01[BAR] > fd.");
    expect(tokensAt(s, "0,0")).toBe("[BAR]");
  });
  card("S_24", "destroys all Level 1 Bots, 1 Flagship damage each", () => {
    const s = ovl("(0,0): S_24[AL] > fd. (0,1): B_01 > fd. (1,0): B_01 > fd. (1,1): B_02 > fd.", [bay1(2)]);
    gone(s, "0,1");
    gone(s, "1,0");
    expect(idAt(s, "1,1")).toBe("B_02");
    expect(s.flagship).toEqual([4, 6, 6]);
  });
  card("S_26", "places a Bio-shield on every adjacent Bot", () => {
    const s = ovl("(0,0): S_26[AL] > fd. (0,1): B_01 > fd. (1,0): G_05 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[BS1]");
    expect(tokensAt(s, "1,0")).toBe("");
  });
});

describe("Flares", () => {
  card("F_03", "destroys an adjacent Bot; Flagship damage = its Strength before", () => {
    const s = ovl("(0,0): F_03[AL] > fd. (0,1): B_02[S1] > fd.", [bay1(3)]);
    gone(s, "0,1");
    expect(s.flagship).toEqual([3, 6, 6]);
  });
  card("F_05", "Boosts all Level 1 units", () => {
    const s = ovl("(0,0): F_05[AL] > fd. (0,1): B_01 > fd. (1,0): B_02 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[S1]");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  card("F_07", "repairs per Gyro and Sleeper, then drains and activates them", () => {
    const s = ovl("Flagship 6/6/4. (0,0): F_07[AL] > fd. (0,1): G_05 > fd. (1,0): P_12 > fd.");
    expect(s.flagship).toEqual([6, 6, 6]);
    expect(tokensAt(s, "0,1")).toBe("[AL]");
    expect(tokensAt(s, "1,0")).toBe("[AL]");
  });
  card("F_09", "Boosts every Targeted unit", () => {
    const s = ovl("(0,0): F_09[AL] > fd. (0,-1): B_01 > fd. (1,-1): B_01 > fd. (1,0): B_01 > fd. (0,1): B_01 > fd. (-1,0): B_01 > fd.");
    for (const k of ["0,-1", "1,-1", "1,0", "0,1"]) expect(tokensAt(s, k)).toBe("[S1]");
    expect(tokensAt(s, "-1,0")).toBe("");
  });
  card("F_10", "buries a Sentinel", () => {
    const s = ovl("(0,0): F_10[AL] > fd. (0,1): S_01 > fd.");
    expect(sectorState(s, "0,1")).toBe("dark");
  });
  card("F_11", "1 damage to all Gyros", () => {
    expect(tokensAt(ovl("(0,0): F_11[AL] > fd. (0,1): G_05 > fd."), "0,1")).toBe("[WR][AL]");
  });
  card("F_12", "1 damage to every unit in its line of fire", () => {
    const s = ovl("(0,0): F_12[AL] > fd. (0,-1): B_01 > fd. (0,1): B_01 > fd.");
    gone(s, "0,-1");
    expect(idAt(s, "0,1")).toBe("B_01");
  });
  card("F_14", "three or more Mecha: destroy one; fewer than three Bots: nothing", () => {
    const s0 = board(OVL + "(0,0): F_14[AL] > fd. (0,1): M_01 > fd. (1,0): M_01 > fd. (1,1): M_01 > fd. (-1,0): B_01 > fd.");
    const s = play(s0, (c) => overloadStep(c), [A.option(`alert:${at(s0, "0,0")}`), A.units(at(s0, "0,1"))]).state;
    gone(s, "0,1");
    expect(idAt(s, "-1,0")).toBe("B_01");
  });
  card("F_15", "destroys an adjacent Mecha: 2 repair", () => {
    const s = ovl("Flagship 6/6/4. (0,0): F_15[AL] > fd. (0,1): M_01 > fd.");
    gone(s, "0,1");
    expect(s.flagship).toEqual([6, 6, 6]);
  });
  card("F_16", "exactly three Bots: 2 Flagship damage", () => {
    const s = ovl("(0,0): F_16[AL] > fd. (0,1): B_01 > fd. (1,0): B_01 > fd. (1,1): B_01 > fd.", [bay1(2)]);
    expect(s.flagship).toEqual([4, 6, 6]);
  });
  card("F_18", "may run a ready red Module without paying", () => {
    const s = ovl("(0,0): F_18[AL] > fd. (0,1): B_01 > fd.", [A.option("26")], mods([26]));
    gone(s, "0,1");
    expect(s.player.modules[0]!.ready).toBe(false);
  });
  card("F_19", "removes a Shield token from each adjacent unit, then 1 damage to each", () => {
    const s = ovl("(0,0): F_19[AL] > fd. (0,1): B_02[S1] > fd. (1,0): B_01[BS1] > fd.");
    expect(tokensAt(s, "0,1")).toBe("[D1]");
    gone(s, "1,0");
  });
  card("F_20", "two revealed units of the same Level take 2 each", () => {
    const s = ovl("(0,0): F_20[AL] > fd. (0,1): fd:B_02 > fd. (1,0): fd:G_01 > fd.", [A.yes(), A.sectors("0,1"), A.yes()]);
    gone(s, "0,1");
    expect(tokensAt(s, "1,0")).toBe("[WR][AL]");
  });
  card("F_21", "destroys one adjacent Mecha and one adjacent Bot", () => {
    const s = ovl("(0,0): F_21[AL] > fd. (0,1): M_01 > fd. (1,0): B_01 > fd.");
    gone(s, "0,1");
    gone(s, "1,0");
  });
  card("F_22", "1 damage to all units in a horizontal row with a Mecha", () => {
    const s = ovl("(0,0): F_22[AL] > fd. (0,1): M_01 > fd. (0,2): B_01 > fd.");
    gone(s, "0,1");
    gone(s, "0,2");
  });
  card("F_23", "1 damage to every Targeted unit", () => {
    const s = ovl("(0,0): F_23[AL] > fd. (0,1): B_01 > fd. (-1,1): B_01 > fd. (1,0): B_01 > fd.");
    gone(s, "0,1");
    gone(s, "-1,1");
    expect(idAt(s, "1,0")).toBe("B_01");
  });
  card("F_26", "Boosts three Bots and three Mecha, as many as there are", () => {
    const s = ovl("(0,0): F_26[AL] > fd. (0,1): B_01 > fd. (1,0): M_01 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[S1]");
    expect(tokensAt(s, "1,0")).toBe("[S1]");
  });
  card("F_27", "Bots minus Mecha: may place that much energy on one Module", () => {
    const s = ovl("(0,0): F_27[AL] > fd. (0,1): B_01 > fd. (1,0): B_01 > fd. (1,1): B_01 > fd. (-1,0): M_01 > fd.", [A.option("26")], mods([26]));
    expect(s.player.modules[0]!.energy.Red).toBe(2);
  });
  card("F_28", "Boosts all units in a horizontal row", () => {
    expect(tokensAt(ovl("(0,0): F_28[AL] > fd. (0,1): B_01 > fd.", [A.option("1")]), "0,1")).toBe("[S1]");
  });
});

describe("Sleepers", () => {
  card("P_01", "1 damage to every Targeted unit", () => gone(resolveAll("(0,0): P_01[AL] > fd. (0,-1): B_01 > fd."), "0,-1"));
  card("P_02", "Boosts all adjacent units", () => expect(tokensAt(resolveAll("(0,0): P_02[AL] > fd. (0,1): B_01 > fd."), "0,1")).toBe("[S1]"));
  card("P_03", "1 damage to an adjacent Level 1, Level 2 and Level 3 unit", () => {
    const s = resolveAll("(0,0): P_03[AL] > fd. (0,1): B_01 > fd. (1,0): B_02 > fd. (1,-1): B_03 > fd.");
    gone(s, "0,1");
    expect(tokensAt(s, "1,0")).toBe("[D1]");
    expect(tokensAt(s, "1,-1")).toBe("[D1]");
  });
  card("P_04", "1 damage to all units of the most abundant Level", () => {
    const s = resolveAll("(0,0): P_04[AL] > fd. (0,1): B_01 > fd. (1,0): B_02 > fd.");
    gone(s, "0,1");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  card("P_06", "Bots minus Mecha above 0: place energy; below 0: remove energy", () => {
    expect(resolveAll("(0,0): P_06[AL] > fd. (0,1): B_01 > fd. (1,0): B_01 > fd.", [], mods([26])).player.modules[0]!.energy.Red).toBe(2);
    expect(resolveAll("(0,0): P_06[AL] > fd. (0,1): M_01 > fd. (1,0): M_01 > fd.", [], mods([26, { Red: 2 }])).player.modules[0]!.energy.Red).toBe(0);
  });
  card("P_09", "a Tick on every Targeted unit", () => expect(tokensAt(resolveAll("(0,0): P_09[AL] > fd. (0,-1): B_03 > fd."), "0,-1")).toBe("[TICK]"));
  card("P_10", "a Sentinel on the Field: start an Overload", () => expect(resolveAll("(0,0): P_10[AL] > fd. (0,1): S_01 > fd.").phase).toBe("overload"));
  card("P_11", "1 damage to all damaged units, 1 Flagship damage per unit destroyed", () => {
    const s = resolveAll("(0,0): P_11[AL] > fd. (0,1): B_02[D1] > fd.", [bay1(1)]);
    gone(s, "0,1");
    expect(s.flagship).toEqual([5, 6, 6]);
  });
  card("P_12", "removes 1 damage from every unit", () => expect(tokensAt(resolveAll("(0,0): P_12[AL] > fd. (0,1): B_02[D1] > fd."), "0,1")).toBe(""));
  card("P_13", "turns once per Bot, then 1 damage in its line of fire", () => {
    const s = resolveAll("(0,0): P_13[AL] > fd. (0,2): B_02 > fd. (1,-1): G_01 > fd.");
    expect(tokensAt(s, "1,-1")).toBe("[D1]");
  });
  card("P_14", "a Tick on every adjacent non-Bot unit", () => {
    const s = resolveAll("(0,0): P_14[AL] > fd. (0,1): M_01 > fd. (1,0): B_01 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[TICK]");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  card("P_16", "1 damage to all units in the horizontal row with the fewest Bots", () => {
    const s = resolveAll("(0,0): P_16[AL] > fd. (-1,0): B_01 > fd. (1,0): B_02 > fd. (0,1): M_01 > fd.");
    gone(s, "0,1");
    expect(idAt(s, "-1,0")).toBe("B_01");
  });
  card("P_17", "Boost one horizontal row, damage a different one", () => {
    const s = resolveAll("(0,0): P_17[AL] > fd. (0,1): B_01 > fd. (-1,0): B_02 > fd.", [A.option("1"), A.option("0")]);
    expect(tokensAt(s, "0,1")).toBe("[S1]");
    expect(tokensAt(s, "-1,0")).toBe("[D1]");
  });
  card("P_18", "Ticks on Gyros, Mecha and Sentinels in three different rows", () => {
    const s = resolveAll("(0,0): P_18[AL] > fd. (1,0): G_05 > fd. (0,1): M_01 > fd. (-1,0): S_01 > fd.", [A.option("2"), A.option("1")]);
    expect(tokensAt(s, "1,0")).toBe("[TICK]");
    expect(tokensAt(s, "0,1")).toBe("[TICK]");
    expect(tokensAt(s, "-1,0")).toBe("[TICK]");
  });
  card("P_20", "turns once per Sentinel, then Boosts its line of fire", () => expect(tokensAt(resolveAll("(0,0): P_20[AL] > fd. (0,-1): B_01 > fd."), "0,-1")).toBe("[S1]"));
  card("P_21", "exactly three Bots: 1 damage to all Bots", () => {
    const s = resolveAll("(0,0): P_21[AL] > fd. (0,1): B_02 > fd. (1,0): B_02 > fd. (1,1): B_02 > fd.");
    for (const k of ["0,1", "1,0", "1,1"]) expect(tokensAt(s, k)).toBe("[D1]");
  });
  card("P_22", "6 Flagship damage minus 1 per Bot", () => expect(resolveAll("(0,0): P_22[AL] > fd. (0,1): B_01 > fd. (1,0): B_01 > fd.", [bay1(4)]).flagship).toEqual([2, 6, 6]));
  card("P_23", "Boosts five different non-Mecha units, as many as there are", () => {
    const s = resolveAll("(0,0): P_23[AL] > fd. (0,1): B_01 > fd. (1,0): M_01 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[S1]");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  card("P_24", "the Sentinel with the most Damage goes to the bottom, without tokens", () => {
    const s = resolveAll("(0,0): P_24[AL] > fd. (0,1): S_01[D1] > fd. (1,0): S_12 > fd.");
    expect(s.tiles[s.field["0,1"]![0]!]!.unitId).toBe("S_01");
    expect(sectorState(s, "0,1")).toBe("dark");
  });
  card("P_26", "a Barrier on every Sentinel that has none", () => expect(tokensAt(resolveAll("(0,0): P_26[AL] > fd. (0,1): S_01 > fd."), "0,1")).toBe("[BAR]"));
  card("P_27", "1 damage to all Sentinels, 1 Flagship damage per survivor", () => {
    const s = resolveAll("(0,0): P_27[AL] > fd. (0,1): S_01 > fd. (1,0): S_12[BAR] > fd.", [bay1(1)]);
    gone(s, "0,1");
    expect(s.flagship).toEqual([5, 6, 6]);
  });
});

describe("Gyros", () => {
  const wreck = (id: string, rest: string, answers: Answer[] = [], setup?: (s: GameState) => void) => resolveAll(`(0,0): ${id} Wreck [WR][AL] > fd. ${rest}`, answers, setup);
  card("G_10", "Destroyed: 1 damage to all non-Bot units", () => {
    const s = wreck("G_10", "(0,1): M_01 > fd. (1,0): B_01 > fd.");
    gone(s, "0,1");
    expect(idAt(s, "1,0")).toBe("B_01");
  });
  card("G_11", "Destroyed: discard now, reveal, 2 damage to the new top unit", () => {
    const s = resolveAll("(0,0): G_11 Wreck [WR][AL] > fd:B_02 > fd.");
    gone(s, "0,0");
    expect(s.piles.discard.map((id) => s.tiles[id]!.unitId).sort()).toEqual(["B_02", "G_11"]);
  });
  card("G_12", "Drain: Flagship damage per Mecha. Destroyed: repair per Sentinel", () => {
    expect(drain("(0,0): G_12 > fd. (0,1): M_01 > fd.", [bay1(1)]).flagship).toEqual([5, 6, 6]);
    expect(wreck("G_12", "Flagship 6/6/5. (0,1): S_01 > fd.").flagship).toEqual([6, 6, 6]);
  });
  card("G_13", "reveal up to four; 1 damage to Sentinels (and Bots) just revealed", () => {
    expect(tokensAt(drain("(0,0): G_13 > fd. (0,1): fd:S_01 > fd.", [A.yes()]), "0,1")).toBe(""); // its Barrier took the hit
    gone(wreck("G_13", "(0,1): fd:B_01 > fd.", [A.yes()]), "0,1");
  });
  card("G_14", "Drain: 2 damage to your Flagship", () => expect(drain("(0,0): G_14 > fd.", [bay1(2)]).flagship).toEqual([4, 6, 6]));
  card("G_15", "Drain: 1 energy off every Module. Destroyed: 1 on every ready Module with none", () => {
    const s = drain("(0,0): G_15 > fd.", [], mods([26, { Red: 1 }], [1, { Yellow: 2 }]));
    expect(s.player.modules.map((m) => m.energy.Red + m.energy.Yellow)).toEqual([0, 1]);
    const d = wreck("G_15", "", [], mods([26], [1, { Yellow: 1 }]));
    expect(d.player.modules[0]!.energy.Red).toBe(1);
    expect(d.player.modules[1]!.energy.Yellow).toBe(1);
  });
  card("G_16", "three different Modules: remove / place 1 energy each", () => {
    expect(drain("(0,0): G_16 > fd.", [], mods([26, { Red: 1 }], [1, { Yellow: 1 }])).player.modules.every((m) => m.energy.Red + m.energy.Yellow === 0)).toBe(true);
    expect(wreck("G_16", "", [], mods([26], [1])).player.modules.map((m) => m.energy.Red + m.energy.Yellow)).toEqual([1, 1]);
  });
  card("G_18", "Drain: gain 1 energy. Destroyed: repair 1", () => {
    expect(drain("(0,0): G_18 > fd.", [A.split({ Yellow: 0, Red: 1, Blue: 0 })]).player.reserve.Red).toBe(1);
    expect(wreck("G_18", "Flagship 6/6/5.").flagship).toEqual([6, 6, 6]);
  });
  card("G_17", "Drain: lose 1 Command token. Destroyed: gain 1", () => {
    expect(drain("(0,0): G_17 > fd.").player.commandTokens).toBe(5);
    expect(wreck("G_17", "4 Command tokens.").player.commandTokens).toBe(5);
  });
  card("G_19", "Drain: Targeted units. Destroyed: all adjacent units", () => {
    gone(drain("(0,0): G_19 > fd. (0,-1): B_01 > fd."), "0,-1");
    gone(wreck("G_19", "(0,1): B_01 > fd."), "0,1");
  });
  card("G_20", "Level 1 units (Drain) / Level 2 units (Destroyed) in a row through it", () => {
    gone(drain("(0,0): G_20 > fd. (0,1): B_01 > fd.", [A.option("0")]), "0,1");
    gone(wreck("G_20", "(0,1): B_02 > fd.", [A.option("0")]), "0,1");
  });
  card("G_21", "Targeted units: 1 (Drain) / 2 (Destroyed)", () => {
    expect(tokensAt(drain("(0,0): G_21 > fd. (0,-1): B_02 > fd."), "0,-1")).toBe("[D1]");
    gone(wreck("G_21", "(0,-1): B_02 > fd."), "0,-1");
  });
  card("G_22", "Bots in a row through it / in a horizontal row of your choice", () => {
    gone(drain("(0,0): G_22 > fd. (0,1): B_01 > fd.", [A.option("0")]), "0,1");
    gone(wreck("G_22", "(0,1): B_01 > fd.", [A.option("1")]), "0,1");
  });
  card("G_23", "damaged units in a row through it", () => {
    gone(drain("(0,0): G_23 > fd. (0,1): B_02[D1] > fd.", [A.option("0")]), "0,1");
    gone(wreck("G_23", "(0,1): B_02[D1] > fd.", [A.option("0")]), "0,1");
  });
  card("G_24", "Drain: Boost the others in a row. Destroyed: 1 damage to the row", () => {
    expect(tokensAt(drain("(0,0): G_24 > fd. (0,1): B_01 > fd.", [A.option("0")]), "0,1")).toBe("[S1]");
    gone(wreck("G_24", "(0,1): B_01 > fd.", [A.option("0")]), "0,1");
  });
  card("G_25", "Drain: Boost and Tick the others in a row. Destroyed: Tick the row", () => {
    expect(tokensAt(drain("(0,0): G_25 > fd. (0,1): B_01 > fd.", [A.option("0")]), "0,1")).toBe("[S1][TICK]");
    expect(tokensAt(wreck("G_25", "(0,1): B_01 > fd.", [A.option("0")]), "0,1")).toBe("[TICK]");
  });
  card("G_26", "Ticks on every Mecha / every Sentinel", () => {
    expect(tokensAt(drain("(0,0): G_26 > fd. (0,1): M_01 > fd."), "0,1")).toBe("[TICK]");
    expect(tokensAt(wreck("G_26", "(0,1): S_01 > fd."), "0,1")).toBe("[TICK]");
  });
  card("G_27", "reveal adjacent Dark sectors; 1 damage to Mecha / Bots just revealed", () => {
    gone(drain("(0,0): G_27 > fd. (0,1): fd:M_01 > fd."), "0,1");
    gone(wreck("G_27", "(0,1): fd:B_01 > fd."), "0,1");
  });
  card("G_28", "Drain: reveal three, 2 damage to each (do as much as you can)", () => gone(drain("(0,0): G_28 > fd. (0,1): fd:B_02 > fd."), "0,1"));
  card("G_29", "horizontal row with a Mecha (Drain) / of your choice (Destroyed)", () => {
    gone(drain("(1,0): G_29 > fd. (0,1): M_01 > fd."), "0,1");
    gone(wreck("G_29", "(0,1): M_01 > fd.", [A.option("1")]), "0,1");
  });
  card("G_30", "Drain: every Sentinel loses its Barrier. Destroyed: 1 damage to all Sentinels", () => {
    expect(tokensAt(drain("(0,0): G_30 > fd. (0,1): S_01[BAR] > fd."), "0,1")).toBe("");
    gone(wreck("G_30", "(0,1): S_01 > fd."), "0,1");
  });
  card("G_31", "Drain: damaged others in its horizontal row. Destroyed: undamaged units in a row", () => {
    gone(drain("(0,0): G_31 > fd. (0,1): B_02[D1] > fd."), "0,1");
    const s = wreck("G_31", "(0,1): B_01 > fd. (0,-1): B_02[D1] > fd.", [A.option("1")]);
    gone(s, "0,1");
    expect(tokensAt(s, "0,-1")).toBe("[D1]");
  });
  card("G_32", "lose / place 1 energy per Bot", () => {
    expect(drain("Reserve Red 2. (0,0): G_32 > fd. (0,1): B_01 > fd. (1,0): B_01 > fd.").player.reserve.Red).toBe(0);
    // Q9: the energy is the Module's own colour (Red), no colour question.
    expect(wreck("G_32", "(0,1): B_01 > fd.", [], mods([26])).player.modules[0]!.energy.Red).toBe(1);
  });
  card("G_33", "Drain: exhaust a Module and empty it. Destroyed: make one ready", () => {
    const s = drain("(0,0): G_33 > fd.", [], mods([26, { Red: 1 }]));
    expect(s.player.modules[0]).toMatchObject({ ready: false, energy: { Red: 0 } });
    expect(wreck("G_33", "", [], (st) => void withModules(st, [[26, false]])).player.modules[0]!.ready).toBe(true);
  });
  card("G_34", "Destroyed: reveal any number; 1 energy per Bot just revealed", () => {
    const s = wreck("G_34", "(0,1): fd:B_01 > fd.", [A.yes(), A.split({ Yellow: 1, Red: 0, Blue: 0 })]);
    expect(s.player.reserve.Yellow).toBe(1);
  });
  card("G_35", "Level 3 units in a horizontal row: 1 damage / a Tick", () => {
    expect(tokensAt(drain("(0,0): G_35 > fd. (0,1): B_03 > fd.", [A.option("1")]), "0,1")).toBe("[D1]");
    expect(tokensAt(wreck("G_35", "(0,1): B_03 > fd.", [A.option("1")]), "0,1")).toBe("[TICK]");
  });
  card("G_36", "runs a Module you could run now, for free", () => {
    const s = wreck("G_36", "(0,1): B_01 > fd.", [], mods([1]));
    gone(s, "0,1");
    expect(s.player.modules[0]!.ready).toBe(false);
    const s2 = board(CMD + "(0,0): G_36 > fd. (0,1): B_01 > fd.");
    withModules(s2, [[1, true]]);
    const d = play(s2, (c) => commandStep(c), [A.option("drainGyro"), A.units(at(s2, "0,1"))]).state;
    gone(d, "0,1");
  });
});

describe("computer version: a Mecha never Attacks a Mecha (designer 2026-11-08)", () => {
  it("an adjacent Mecha is not an Attack target; a Bot is", async () => {
    const { attackTargets } = await import("../../src/engine/mecha.js");
    const s0 = board(CMD + "(0,0): M_01 > fd. (0,1): M_02 > fd. (1,0): B_01 > fd.");
    expect(attackTargets(ctx(s0), at(s0, "0,0"))).toEqual([at(s0, "1,0")]);
    // Games saved before the change replay with the Core Rules as printed.
    s0.settings.mechaAttacksMecha = true;
    expect(attackTargets(ctx(s0), at(s0, "0,0")).sort()).toEqual([at(s0, "0,1"), at(s0, "1,0")].sort());
  });
});

describe("Mecha upgrades", () => {
  card("V1_M01_U1", "M_01 may move on top of a Mecha with no tokens", () => {
    const s0 = board(CMD + "V1_M01_U1 filled. (0,0): M_01[D1] > fd. (0,1): M_01 > fd.");
    const m = at(s0, "0,0");
    const s = play(s0, (c) => commandStep(c), [A.option("commandMecha"), A.option(m), A.option("ability:M_01"), A.sectors("0,1")]).state;
    expect(unitAt(s, "0,1")).toBe(m);
    expect(sectorState(s, "0,0")).toBe("dark");
  });
  card("V1_M02_U1", "M_02 turns to face any direction", () => {
    const s0 = board(CMD + "V1_M02_U1 filled. (0,0): M_02 > fd.");
    const s = play(s0, (c) => commandStep(c), [A.option("commandMecha"), A.option("ability:V1_M02_U1"), A.option("3")]).state;
    expect(tile(s, at(s, "0,0")).facing).toBe(3);
  });
  card("V1_M03_U1", "M_03 may move through several Dark sectors before an Attack", () => {
    const s0 = board(CMD + "V1_M03_U1 filled. (0,-1): M_03 > fd. (0,0): fd. (0,1): fd. (0,2): B_01 > fd.");
    const s = play(s0, (c) => commandStep(c), [A.option("commandMecha"), A.option("attack"), A.option("move:0,1")]).state;
    gone(s, "0,2");
  });
  card("M_03", "one question: click a unit to Attack it, or a sector to Move there first", () => {
    const s0 = board(CMD + "(0,0): M_03 > fd. (0,1): B_01 > fd. (1,0): fd.");
    const r = runEffect(data(), s0, (c) => commandStep(c), [A.option("commandMecha"), A.option("attack")]);
    if (r.status !== "question" || r.question.kind !== "option") throw new Error("expected the Attack question");
    const b = at(s0, "0,1");
    expect(r.question.options.find((o) => o.id === `attack:${b}`)?.on).toEqual({ kind: "unit", id: b });
    expect(r.question.options.some((o) => o.id === "move:1,0" && o.on?.kind === "sector")).toBe(true);
    const s = play(s0, (c) => commandStep(c), [A.option("commandMecha"), A.option("attack"), A.option(`attack:${b}`)]).state;
    gone(s, "0,1");
  });
  card("V1_M03_U2", "[Overload] Expend: 1 damage to one adjacent unit; V1_M03_U3: and one other", () => {
    const g = "V1_M03_U2 filled. (0,0): M_03 > fd. (0,1): B_01 > fd. (1,0): B_01 > fd.";
    const s0 = board(OVL + g);
    const s = play(s0, (c) => overloadStep(c), [A.option("commandMecha"), A.units(at(s0, "0,1"))]).state;
    gone(s, "0,1");
    expect(idAt(s, "1,0")).toBe("B_01");
    const t0 = board(OVL + g + " V1_M03_U3 filled.");
    const t = play(t0, (c) => overloadStep(c), [A.option("commandMecha"), A.units(at(t0, "0,1"))]).state;
    gone(t, "1,0");
  });
  card("V1_M04_U1", "Expend: 2 damage to any single unit", () => {
    const s0 = board(CMD + "V1_M04_U1 filled. (0,0): M_04 > fd. (0,2): B_02 > fd.");
    const s = play(s0, (c) => commandStep(c), [A.option("commandMecha"), A.option("ability:V1_M04_U1")]).state;
    gone(s, "0,2");
  });
  card("V1_M04_U2B", "the revealed unit of any type takes the damage", () => {
    const s0 = board(CMD + "V1_M04_U2 filled. V1_M04_U2B filled. (0,0): M_04 > fd. (0,1): B_01 > fd:G_01 > fd.");
    const s = play(s0, (c) => commandStep(c), [A.option("commandMecha"), A.option("attack"), A.yes()]).state;
    expect(tokensAt(s, "0,1")).toBe("[D1]");
  });
  card("V2_M1", "Command: if this Mecha has no tokens, Bury it", () => {
    const s0 = board(CMD + "Company V2. V2_M1 filled. (0,0): M_05 > fd.");
    const s = play(s0, (c) => commandStep(c), [A.option("commandMecha"), A.option("ability:V2_M1")]).state;
    expect(sectorState(s, "0,0")).toBe("dark");
  });
  card("V2_M1A", "Command: Bury this Mecha", () => {
    const s0 = board(CMD + "Company V2. V2_M1A filled. (0,0): M_05[D1] > fd.");
    const s = play(s0, (c) => commandStep(c), [A.option("commandMecha"), A.option("ability:V2_M1A")]).state;
    expect(sectorState(s, "0,0")).toBe("dark");
  });
});

/** Cards whose tests live in units.test.ts (batch 5) or cards.test.ts (stage 4). */
const COVERED_ELSEWHERE = [
  "S_01", "S_05", "S_12", "S_16", "S_20", "S_21", "S_22", "S_25", "S_27",
  "F_02", "F_04", "F_06", "F_08", "F_13", "F_17", "F_24", "F_25",
  "P_05", "P_07", "P_08", "P_15", "P_19", "P_25",
  "G_10", "G_11", "G_14", "G_28", "G_34",
  "O_01", "O_02", "O_03",
  "M_01", "M_02", "M_03", "M_04", "M_05", "M_06", "M_07",
  "V1_M02_U2", "V1_M04_U2", "V1_M04_U2A", "V1_M03_U3",
];

describe("coverage", () => {
  it("every unit card with an effect, and every Mecha upgrade, has a card test", () => {
    const all: string[] = [];
    for (const u of data().units.units) {
      if (u.energyGyro || u.type === "Bot") continue;
      if (u.type === "Flare" && u.text.activate === "none") continue;
      all.push(u.id);
    }
    for (const co of data().companies.byId.values()) for (const up of co.upgrades) if (up.part === "MECHA_UPGRADES") all.push(up.id);
    const missing = all.filter((id) => !tested.has(id) && !COVERED_ELSEWHERE.includes(id));
    expect(missing).toEqual([]);
  });
});
