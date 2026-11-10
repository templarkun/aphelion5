/**
 * Engine events (Program Spec "Interaction and animation" > "How it is built"):
 * each change on the board is reported as an event, for the animations.
 * Events change no rule; these tests only check what is reported.
 */
import { describe, expect, it } from "vitest";
import { commandStep } from "../../src/engine/command.js";
import { type GameEvent, newEvents } from "../../src/engine/events.js";
import { move, openNeighbours } from "../../src/engine/moves.js";
import { boost, dealHit, placeBarrier, placeFuse, setOffFuses } from "../../src/engine/tokens.js";
import { startOverload } from "../../src/engine/command.js";
import { turn } from "../../src/effects/kit.js";
import { topTileId } from "../../src/engine/field.js";
import { A, at, data, given, play, withModules } from "./helpers.js";

const kinds = (es: readonly GameEvent[] | undefined) => (es ?? []).map((e) => e.kind);

describe("engine events", () => {
  it("a Feedback token going off reports it, then the damage coming at the Flagship (designer 2026-11-09, screen only)", () => {
    const s0 = given("T_TOK_01", "(0,0): B_02[FB]");
    const id = at(s0, "0,0");
    const { state } = play(s0, (c) => setOffFuses(c), [A.split({ bay1: 1 })]);
    expect(kinds(state.events)).toEqual(["fuse", "flagship"]);
    expect(state.events![0]).toMatchObject({ tile: id, sector: "0,0", fuse: "feedback" });
    expect(state.events![1]).toMatchObject({ amount: 1, rule: "6.6" });
  });

  it("a hit reports the damage placed and the Shields removed", () => {
    const s0 = given("T_TOK_01");
    const id = at(s0, "0,0");
    const { state } = play(s0, (c) => dealHit(c, id, 2));
    expect(state.events).toEqual([{ seq: 1, kind: "hit", tile: id, unitId: "B_02", type: "Bot", sector: "0,0", amount: 2, damage: 1, shields: 1, rule: "6.1" }]);
  });

  it("a Bay reports that it was used, and its hit names it as its rule (weapon looks, build step 3)", () => {
    const s0 = given("T3_BAY_01");
    const { state } = play(s0, (c) => commandStep(c), [A.option("useBay"), A.option("V1_BAY1"), A.units(at(s0, "0,1"))]);
    expect(kinds(state.events)).toEqual(["used", "hit"]);
    expect(state.events![0]).toMatchObject({ what: "bay", rule: "V1_BAY1", bay: 1 });
    expect(state.events![1]).toMatchObject({ rule: "V1_BAY1", sector: "0,1" });
  });

  it("a Module run reports its colour, and its hit names it", () => {
    const s0 = withModules(given("T6_PAY_05"), [[6, true, { Yellow: 2 }]]);
    const { state } = play(s0, (c) => commandStep(c), [A.option("runModule")]);
    const used = state.events!.find((e) => e.kind === "used");
    expect(used).toMatchObject({ what: "module", module: 6, colour: "Yellow", rule: "Module 6" });
    expect(state.events!.filter((e) => e.kind === "hit").every((e) => e.kind === "hit" && e.rule === "Module 6")).toBe(true);
  });

  it("a hit that brings Strength to 0 reports the hit, then the unit destroyed", () => {
    const s0 = given("T_TOK_01");
    const id = at(s0, "0,0");
    const { state } = play(s0, (c) => dealHit(c, id, 3));
    expect(kinds(state.events)).toEqual(["hit", "destroyed"]);
    expect(state.events![1]).toMatchObject({ tile: id, sector: "0,0", wreck: false });
  });

  it("a Move reports where from and where to", () => {
    const s0 = given("T_TOK_01");
    const id = at(s0, "0,0");
    // Clear (1,0) so there is somewhere to go.
    s0.piles.discard.push(...s0.field["1,0"]!);
    s0.field["1,0"] = [];
    const to = openNeighbours({ data: data(), state: s0 }, id)[0]!;
    expect(to).toBe("1,0");
    const { state } = play(s0, function* (c) {
      move(c, id, to);
    });
    expect(state.events).toEqual([{ seq: 1, kind: "moved", tile: id, unitId: "B_02", from: "0,0", to, how: "move", rule: "glossary" }]);
  });

  it("a Reveal of a Power Node reports the reveal, then each energy placed; one Module only: placed by itself", () => {
    const s = withModules(given("T3_REV_05"), [
      [1, true],
      [2, true],
      [26, true],
      [51, true],
      [52, true],
    ]);
    const { state } = play(s, (c) => commandStep(c), [A.option("reveal"), A.option("52"), A.option("1")]);
    const flare = topTileId(s, "0,1")!;
    // A Flare Reveal also starts an Overload (4.6, 9.1), reported last (step 5).
    expect(kinds(state.events)).toEqual(["revealed", "energy", "energy", "energy", "overload"]);
    expect(state.events![0]).toMatchObject({ kind: "revealed", tile: flare, sector: "0,1", type: "Flare" });
    // Red goes to the one ready Red Module by itself; then Blue and Yellow in the player's order.
    expect(state.events!.slice(1, 4)).toMatchObject([
      { colour: "Red", module: 26, from: flare, auto: true },
      { colour: "Blue", module: 52, from: flare, auto: false },
      { colour: "Yellow", module: 1, from: flare, auto: false },
    ]);
  });

  it("newEvents gives only events newer than the board before; none when going back (Undo)", () => {
    const s0 = given("T_TOK_01");
    const id = at(s0, "0,0");
    const a = play(s0, (c) => dealHit(c, id, 1)).state;
    const b = play(a, (c) => dealHit(c, id, 1)).state;
    expect(newEvents(a.events, b.events).map((e) => e.seq)).toEqual([2]);
    expect(newEvents(b.events, a.events)).toEqual([]);
    expect(newEvents(undefined, a.events)).toHaveLength(1);
  });

  it("a Boost reports a Shield gained, or a Damage token removed (step 5, screen only)", () => {
    const s0 = given("T_TOK_01");
    const id = at(s0, "0,0");
    const a = play(s0, (c) => boost(c, [id], "6.2")).state;
    expect(a.events).toEqual([{ seq: 1, kind: "tokens", tile: id, unitId: "B_02", sector: "0,0", change: "shield", n: 1, boost: true, rule: "6.2" }]);
    const hurt = play(s0, (c) => dealHit(c, id, 2)).state;
    const b = play(hurt, (c) => boost(c, [id], "6.2")).state;
    expect(newEvents(hurt.events, b.events)).toMatchObject([{ kind: "tokens", change: "repair", boost: true }]);
  });

  it("Barriers and Fuse tokens placed are reported", () => {
    const s0 = given("T_TOK_01");
    const id = at(s0, "0,0");
    const { state } = play(s0, function* (c) {
      placeBarrier(c, id, "4.5");
      placeFuse(c, id, "mortar", "X");
    });
    expect(state.events).toMatchObject([
      { kind: "tokens", change: "barrier", rule: "4.5" },
      { kind: "tokens", change: "mortar", rule: "X" },
    ]);
  });

  it("a turn reports the sides turned, clockwise", () => {
    const s0 = given("T_TOK_01");
    const id = at(s0, "0,0");
    const { state } = play(s0, function* (c) {
      turn(c, id, 2, "E10");
    });
    expect(state.events).toEqual([{ seq: 1, kind: "turned", tile: id, unitId: "B_02", sector: "0,0", by: 2, rule: "E10" }]);
  });

  it("an Overload start is reported before its Alert tokens", () => {
    const s0 = given("T_TOK_01");
    const { state } = play(s0, function* (c) {
      startOverload(c);
    });
    expect(kinds(state.events)[0]).toBe("overload");
    expect(state.events![0]).toMatchObject({ how: "start" });
  });
});
