/** Stage 6: tests/batch6.txt (DRAFT, written from Modules.txt, awaiting the designer). */

import { describe, expect, it } from "vitest";
import { commandStep, legalActions } from "../../src/engine/command.js";
import { runEffect } from "../../src/engine/effect.js";
import { sectorState, tile } from "../../src/engine/field.js";
import { moduleDef } from "../../src/engine/modules.js";
import { overloadStep } from "../../src/engine/overload.js";
import type { Answer } from "../../src/engine/questions.js";
import type { GameState } from "../../src/engine/state.js";
import { A, at, ctx, data, given, play, tokensAt, withModules } from "./helpers.js";

/** A batch 6 board with Modules: [id, ready, energy]. Reserve: `reserve` of each Module's colour, else all the rest of it. */
function board(id: string, mods: [number, boolean, Partial<Record<"Yellow" | "Red" | "Blue", number>>?][], reserve?: Partial<Record<"Yellow" | "Red" | "Blue", number>>): GameState {
  const s = withModules(given(id), mods.map(([m, r, e]) => [m, r, e ?? {}]));
  for (const [m] of mods) {
    const col = moduleDef(ctx(s), m).colour;
    const want = reserve?.[col] ?? s.supply.energy[col] + s.player.reserve[col];
    s.supply.energy[col] += s.player.reserve[col] - want;
    s.player.reserve[col] = want;
  }
  return s;
}
const act = (s: GameState, answers: Answer[]) => play(s, (c) => (s.phase === "overload" ? overloadStep(c) : commandStep(c)), answers).state;
const pile = (s: GameState, p: keyof GameState["piles"]) => s.piles[p].map((t) => s.tiles[t]!.unitId);

describe("batch 6 - PAYING", () => {
  it("T6_PAY_01 a cost reduction never counts the Module being run", () => {
    const s = board("T6_PAY_01", [[3, true], [1, false], [2, false]], { Yellow: 7 });
    expect(legalActions(ctx(s))).toContain("runModule");
    const after = act(s, [A.option("runModule"), A.units(at(s, "0,0"))]);
    expect(after.player.reserve.Yellow).toBe(0);
  });

  it("T6_PAY_02 Pathfinder Array: choose X; the reduction is on the total", () => {
    const s = board("T6_PAY_02", [[53, true], [2, false]], { Blue: 4 });
    const r = runEffect(data(), s, (c) => commandStep(c), [A.option("runModule")]);
    expect(r.status === "question" && r.question.kind === "amount" && [r.question.min, r.question.max]).toEqual([0, 2]);
    const after = act(s, [A.option("runModule"), A.amount(2), A.sectors("0,1")]);
    expect(after.player.reserve.Blue).toBe(0);
    expect(pile(after, "discard").sort()).toEqual(["B_01", "B_02"]);
  });

  it("T6_PAY_03 a free run of an X-cost Module uses X = 1", () => {
    const s = board("T6_PAY_03", [[54, true]]);
    const after = act(s, [A.option("resolveAlerts")]);
    expect(pile(after, "discard")).toEqual(expect.arrayContaining(["B_01", "G_38"]));
    expect(tile(after, after.field["0,1"]!.at(-1)!).unitId).toBe("B_02");
    expect(sectorState(after, "0,1")).toBe("dark");
  });

  it("T6_PAY_04 an extra payment is offered only when you can pay it", () => {
    const s = board("T6_PAY_04", [[10, true]], { Yellow: 5 });
    const a = act(s, [A.option("runModule")]);
    expect(tokensAt(a, "0,1")).toBe("[D1]");
    const s6 = board("T6_PAY_04", [[10, true]], { Yellow: 6 });
    const b = act(s6, [A.option("runModule"), A.yes()]);
    expect(sectorState(b, "0,1")).toBe("dark");
    expect(sectorState(b, "0,2")).toBe("dark");
  });

  it("T6_PAY_05 Accumulator Beam: the Yellow on it before running, at most 5", () => {
    const s = board("T6_PAY_05", [[6, true, { Yellow: 6 }]]);
    const after = act(s, [A.option("runModule"), A.amount(1)]);
    expect(sectorState(after, "0,1")).toBe("dark");
    expect(after.player.modules[0]!.energy.Yellow).toBe(0);
    expect(after.supply.energy.Yellow).toBe(6);
  });
});

describe("batch 6 - YELLOW", () => {
  it("T6_YEL_01 Capacitor Demolisher with no two adjacent Bots does nothing", () => {
    const after = act(board("T6_YEL_01", [[11, true]]), [A.option("runModule")]);
    expect(tokensAt(after, "0,1")).toBe("");
    expect(tokensAt(after, "1,-1")).toBe("");
    expect(after.player.modules[0]!.ready).toBe(false);
  });

  it("T6_YEL_02 Splitter Missiles: each share is its own hit", () => {
    const s = board("T6_YEL_02", [[14, true]]);
    const after = act(s, [A.option("runModule"), A.split({ [at(s, "0,1")]: 2, [at(s, "1,0")]: 1 })]);
    expect(tokensAt(after, "0,1")).toBe("");
    expect(sectorState(after, "1,0")).toBe("dark");
  });

  it("T6_YEL_03 Ground Zero with no Mecha does nothing", () => {
    expect(tokensAt(act(board("T6_YEL_03", [[21, true]]), [A.option("runModule")]), "0,1")).toBe("");
  });
});

describe("batch 6 - RED", () => {
  it("T6_RED_01 Backlash Beam counts only real Shields or removed Damage", () => {
    const s = board("T6_RED_01", [[31, true]]);
    const after = act(s, [A.option("runModule"), A.units(at(s, "0,0")), A.split({ bay1: 1, bay2: 0, bay3: 0 })]);
    expect(tokensAt(after, "0,1")).toBe("");
    expect(tokensAt(after, "1,0")).toBe("");
    expect(tokensAt(after, "0,0")).toBe("[D1]");
    expect(after.flagship).toEqual([5, 6, 6]);
  });

  it("T6_RED_02 Chain Reaction Beam follows the destroyed units", () => {
    const s = board("T6_RED_02", [[44, true]]);
    const after = act(s, [A.option("runModule"), A.units(at(s, "0,0"))]);
    expect(sectorState(after, "0,0")).toBe("dark");
    expect(sectorState(after, "0,1")).toBe("dark");
    expect(tokensAt(after, "0,2")).toBe("[D1]");
  });

  it("T6_RED_03 Echo Ray counts the Sentinels when it starts", () => {
    expect(sectorState(act(board("T6_RED_03", [[46, true]]), [A.option("runModule")]), "0,1")).toBe("dark");
  });

  it("T6_RED_04 Phantom Recon with one unit revealed", () => {
    expect(sectorState(act(board("T6_RED_04", [[50, true]]), [A.option("runModule"), A.yes()]), "0,1")).toBe("dark");
  });
});

describe("batch 6 - BLUE", () => {
  it("T6_BLU_01 Satellite Ion Scan reveals a Flare: energy at once, the Overload after", () => {
    const after = act(board("T6_BLU_01", [[51, true], [26, true]]), [A.option("runModule"), A.yes(), A.sectors("0,1"), A.yes()]);
    // Q9: F_04's Yellow cannot go on Charged Beam (Red): no ready Yellow Module, so it stays in the Supply.
    expect(after.player.modules[1]!.energy.Yellow).toBe(0);
    expect(after.log.some((e) => /no ready Yellow Module/.test(e.text))).toBe(true);
    expect(pile(after, "discard")).toContain("B_01");
    expect(after.phase).toBe("overload");
    expect(tokensAt(after, "0,1")).toBe("[AL]");
  });

  it("T6_BLU_02 Tactical Scan: other tiles stay face down and known", () => {
    const s = board("T6_BLU_02", [[52, true]]);
    const sTile = s.field["1,0"]!.at(-1)!;
    const after = act(s, [A.option("runModule"), A.sectors("0,1", "1,0")]);
    expect(pile(after, "discard")).toContain("B_01");
    expect(sectorState(after, "1,0")).toBe("dark");
    expect(after.seen).toContain(sTile);
  });

  it("T6_BLU_03 Strata Shifter: onto an adjacent Dark sector only", () => {
    const s = board("T6_BLU_03", [[69, true]]);
    const moved = s.field["0,1"]!.at(-1)!;
    const after = act(s, [A.option("runModule"), A.sectors("0,1"), A.amount(1)]);
    expect(after.field["1,1"]!.at(-1)).toBe(moved);
    expect(sectorState(after, "0,1")).toBe("dark");
    expect(after.field["0,2"]).toEqual([]);
  });

  it("T6_BLU_04 Core Drill: bottom tile on top face down, then revealed", () => {
    const after = act(board("T6_BLU_04", [[70, true]]), [A.option("runModule"), A.yes()]);
    expect(tile(after, at(after, "0,1")).unitId).toBe("S_01");
    expect(tokensAt(after, "0,1")).toBe("[BAR]");
  });

  it("T6_BLU_05 Salvage Siphon: the chosen Module keeps its energy (Q6)", () => {
    const s = board("T6_BLU_05", [[65, true], [26, true], [1, true, { Yellow: 2 }]]);
    s.player.reserve.Yellow = 0; // Demolition Blast cannot be run, so Salvage Siphon is the only choice
    s.supply.energy.Yellow = 8;
    s.player.reserve.Red = 0; // Red in the Supply, so it can be placed
    s.supply.energy.Red = 10;
    const after = act(s, [A.option("runModule"), A.option("26")]); // Q9: Red, the Module's colour, no colour question
    expect(after.player.modules[1]!.energy).toEqual({ Yellow: 0, Red: 2, Blue: 0 });
    expect(after.player.modules[2]!.energy.Yellow).toBe(0);
  });

  it("T6_BLU_06 Gravity Well: the tiles go in the order you choose", () => {
    const s = board("T6_BLU_06", [[71, true]]);
    const [b01, b02] = ["0,1", "1,0"].map((k) => s.field[k]!.at(-1)!);
    const after = act(s, [A.option("runModule"), A.sectors("0,1", "1,0"), A.sectors("1,1"), A.option(b02!)]);
    expect(after.field["1,1"]!.slice(-2)).toEqual([b02, b01]);
    expect(sectorState(after, "0,1")).toBe("dark");
    expect(after.flagship).toEqual([6, 6, 6]);
  });

  it("T6_BLU_07 Gravity Well may put the tiles on a Cleared sector (Q7)", () => {
    const s = board("T6_BLU_07", [[71, true]]);
    const t = s.field["0,1"]![0]!;
    const after = act(s, [A.option("runModule"), A.sectors("0,1"), A.sectors("0,2")]);
    expect(sectorState(after, "0,1")).toBe("cleared");
    expect(after.field["0,2"]).toEqual([t]);
    expect(sectorState(after, "0,2")).toBe("dark");
  });

  it("T6_BLU_08 Seismic Sonar: one look per other exhausted Module, then an Overload", () => {
    const s = board("T6_BLU_08", [[72, true], [2, false]]);
    const bottom = s.field["0,1"]![0]!;
    const after = act(s, [A.option("runModule"), A.sectors("0,1"), A.sectors("1,0")]);
    expect(after.seen).toContain(bottom);
    expect(after.phase).toBe("overload");
    expect(tokensAt(after, "0,0")).toBe("[AL]");
  });
});
