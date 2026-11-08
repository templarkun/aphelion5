/**
 * Placing energy on Modules one at a time, every colour offered at once
 * (designer 2026-11-07), and the trial rule "Flare energy waits on the
 * Flare until its Alert is resolved" (open question I2, a setup option).
 */
import { describe, expect, it } from "vitest";
import { commandStep } from "../../src/engine/command.js";
import { runEffect } from "../../src/engine/effect.js";
import { checkInvariants } from "../../src/engine/invariants.js";
import { overloadEnd, overloadStep } from "../../src/engine/overload.js";
import type { Answer, Question } from "../../src/engine/questions.js";
import type { GameState } from "../../src/engine/state.js";
import { A, at, ctx, data, given, play, withModules } from "./helpers.js";

const cmd = (s: GameState, answers: Answer[] = []) => play(s, (c) => commandStep(c), answers);
const ovl = (s: GameState, answers: Answer[] = []) => play(s, (c) => overloadStep(c), answers);
function asks(s: GameState, root: typeof commandStep, answers: Answer[]): Question {
  const r = runEffect(data(), s, (c) => root(c), answers);
  if (r.status !== "question") throw new Error(`expected a question, got ${r.status}`);
  return r.question;
}
const energyOf = (s: GameState, id: number) => s.player.modules.find((m) => m.id === id)!.energy;
/** T3_REV_05's board ((0,1): a face-down Power Node) with two Yellow, one Red and two Blue ready Modules. */
const board = () =>
  withModules(given("T3_REV_05"), [
    [1, true],
    [2, true],
    [26, true],
    [51, true],
    [52, true],
  ]);

describe("energy placed one at a time (5.3, designer 2026-11-07)", () => {
  it("a Power Node offers every Module that can take one of its energies in one question; one answer places one energy", () => {
    const s = board();
    const q = asks(s, commandStep, [A.option("reveal")]);
    // Red has one ready Module: it goes there by itself. Yellow and Blue are offered together.
    expect(q.kind === "option" && q.options.map((o) => o.id)).toEqual(["1", "2", "51", "52"]);
    expect(q.energy).toEqual({ "1": "Yellow", "2": "Yellow", "51": "Blue", "52": "Blue" });
    // Blue first, then Yellow: the player's order.
    const { state, asked } = cmd(s, [A.option("reveal"), A.option("52"), A.option("1")]);
    expect(asked).toHaveLength(3);
    expect(asked[2]!.kind === "option" && asked[2]!.options.map((o) => o.id)).toEqual(["1", "2"]);
    expect(energyOf(state, 1)).toEqual({ Yellow: 1, Red: 0, Blue: 0 });
    expect(energyOf(state, 26)).toEqual({ Yellow: 0, Red: 1, Blue: 0 });
    expect(energyOf(state, 52)).toEqual({ Yellow: 0, Red: 0, Blue: 1 });
    expect(state.phase).toBe("overload");
    expect(checkInvariants(ctx(state))).toEqual([]);
  });
});

describe("trial rule: Flare energy waits on the Flare (I2)", () => {
  const trial = () => {
    const s = board();
    s.settings.trialFlareEnergy = true;
    return s;
  };

  it("on Reveal the energy is taken from the Supply and waits on the Flare; nothing is placed yet", () => {
    const s = trial();
    const { state, asked } = cmd(s, [A.option("reveal")]);
    const node = at(state, "0,1");
    expect(asked).toHaveLength(1);
    expect(state.tiles[node]!.energy).toEqual({ Yellow: 1, Red: 1, Blue: 1 });
    expect(state.supply.energy).toEqual({ Yellow: 14, Red: 14, Blue: 14 });
    expect(energyOf(state, 26)).toEqual({ Yellow: 0, Red: 0, Blue: 0 });
    expect(state.phase).toBe("overload");
    expect(checkInvariants(ctx(state))).toEqual([]);
  });

  it("resolving the Flare's Alert places it at once: a Module of its colour, or back to the Supply", () => {
    const s0 = cmd(trial(), [A.option("reveal")]).state;
    const node = at(s0, "0,1");
    expect(s0.tiles[node]!.tokens.alert).toBe(true);
    const q = asks(s0, overloadStep, [A.option(`alert:${node}`)]);
    expect(q.kind === "option" && q.options.map((o) => o.id)).toEqual(["1", "2", "51", "52", "supply:Yellow", "supply:Blue"]);
    const { state } = ovl(s0, [A.option(`alert:${node}`), A.option("supply:Yellow"), A.option("51")]);
    expect(state.tiles[node]!.energy).toBeUndefined();
    expect(energyOf(state, 26)).toEqual({ Yellow: 0, Red: 1, Blue: 0 });
    expect(energyOf(state, 51)).toEqual({ Yellow: 0, Red: 0, Blue: 1 });
    expect(state.supply.energy).toEqual({ Yellow: 15, Red: 14, Blue: 14 });
    expect(checkInvariants(ctx(state))).toEqual([]);
  });

  it("with no ready Module of its colour at Reveal the energy still waits, and goes on a Module made ready since", () => {
    const s = withModules(given("T3_REV_05"), [[1, false]]);
    s.settings.trialFlareEnergy = true;
    const s0 = cmd(s, [A.option("reveal")]).state;
    const node = at(s0, "0,1");
    expect(s0.tiles[node]!.energy).toEqual({ Yellow: 1, Red: 1, Blue: 1 });
    s0.player.modules[0]!.ready = true;
    const { state } = ovl(s0, [A.option(`alert:${node}`)]);
    // One ready Yellow Module: it goes there by itself; no Red or Blue Module: back to the Supply.
    expect(energyOf(state, 1)).toEqual({ Yellow: 1, Red: 0, Blue: 0 });
    expect(state.supply.energy).toEqual({ Yellow: 14, Red: 15, Blue: 15 });
  });

  it("energy still on a Flare when Overload End clears it goes back to the Supply", () => {
    const s0 = cmd(trial(), [A.option("reveal")]).state;
    s0.tiles[at(s0, "0,1")]!.tokens.alert = false;
    s0.phase = "overloadEnd";
    const { state } = play(s0, (c) => overloadEnd(c), []);
    expect(state.supply.energy).toEqual({ Yellow: 15, Red: 15, Blue: 15 });
    expect(checkInvariants(ctx(state))).toEqual([]);
  });

  it("with the Heat module, a Power Node asks nothing at Reveal; its Alert offers its energy or 3 Heat on the unit (designer 2026-11-08)", () => {
    const s = trial();
    s.settings.heatModule = true;
    const { state: s0, asked } = cmd(s, [A.option("reveal")]);
    const node = at(s0, "0,1");
    expect(asked).toHaveLength(1);
    expect(s0.tiles[node]!.energy).toEqual({ Yellow: 1, Red: 1, Blue: 1 });
    const menu = asks(s0, overloadStep, []);
    const mine = (menu.shortcuts ?? []).filter((o) => o.on?.kind === "unit" && o.on.id === node);
    expect(mine.map((o) => o.id)).toEqual([`alert:${node}|energy`, `alert:${node}|heat`]);
    expect(mine[0]!.chips).toEqual(["Yellow", "Red", "Blue"]);
    const heat0 = s0.player.heat;
    const h = ovl(s0, [A.option(`alert:${node}|heat`)]).state;
    expect(h.player.heat).toBe(Math.min(10, heat0 + 3));
    expect(h.tiles[node]!.energy).toBeUndefined();
    expect(h.supply.energy).toEqual({ Yellow: 15, Red: 15, Blue: 15 });
    expect(checkInvariants(ctx(h))).toEqual([]);
    const e = ovl(s0, [A.option(`alert:${node}|energy`), A.option("supply:Yellow"), A.option("51")]).state;
    expect(e.player.heat).toBe(heat0);
    expect(energyOf(e, 26)).toEqual({ Yellow: 0, Red: 1, Blue: 0 });
  });

  it("off by default: the energy is placed at Reveal as the Core Rules say (4.6)", () => {
    expect(board().settings.trialFlareEnergy).toBeFalsy();
  });
});

describe("old saves (energy answered as splits) still load", () => {
  it("a save made before 2026-11-07 replays, its energy splits turned into one answer per energy", async () => {
    const { readFileSync } = await import("node:fs");
    const { readSave, replayGame } = await import("../../src/engine/save.js");
    const f = readSave(readFileSync("tests/fixtures/save-2026-11-07-energy-split.json", "utf8"));
    const g = replayGame(data(), f.game!.start, f.game!.answers);
    expect(g.answers.length).toBe(f.game!.answers.length);
    expect(g.answers.some((a) => a.kind === "split" && Object.keys(a.value).every((k) => /^\d+$/.test(k)))).toBe(false);
    expect(checkInvariants(ctx(g.view.state))).toEqual([]);
  });
});

describe("old saves keep the old Mecha rule only for the answers already played (designer 2026-11-08)", () => {
  it("after loading, a Mecha never Attacks a Mecha", async () => {
    const { readFileSync } = await import("node:fs");
    const { readSave, replayGame, toSave } = await import("../../src/engine/save.js");
    const f = readSave(readFileSync("tests/fixtures/save-2026-11-07-energy-split.json", "utf8"));
    expect(f.game!.start.mechaAttacksMechaUntil).toBe(f.game!.answers.length);
    const g = replayGame(data(), f.game!.start, f.game!.answers);
    expect(g.view.state.settings.mechaAttacksMecha).toBeFalsy();
    // Saved again and loaded: still replays, still the new rule.
    const again = readSave(JSON.stringify(toSave(g, g.view.state.profile)));
    const g2 = replayGame(data(), again.game!.start, again.game!.answers);
    expect(g2.answers.length).toBe(g.answers.length);
    expect(g2.view.state.settings.mechaAttacksMecha).toBeFalsy();
  });
});
