/**
 * Engine events (Program Spec "Interaction and animation" > "How it is built"):
 * each change on the board is reported as an event, for the animations.
 * Events change no rule; these tests only check what is reported.
 */
import { describe, expect, it } from "vitest";
import { commandStep } from "../../src/engine/command.js";
import { type GameEvent, newEvents } from "../../src/engine/events.js";
import { move, openNeighbours } from "../../src/engine/moves.js";
import { dealHit } from "../../src/engine/tokens.js";
import { topTileId } from "../../src/engine/field.js";
import { A, at, data, given, play, withModules } from "./helpers.js";

const kinds = (es: readonly GameEvent[] | undefined) => (es ?? []).map((e) => e.kind);

describe("engine events", () => {
  it("a hit reports the damage placed and the Shields removed", () => {
    const s0 = given("T_TOK_01");
    const id = at(s0, "0,0");
    const { state } = play(s0, (c) => dealHit(c, id, 2));
    expect(state.events).toEqual([{ seq: 1, kind: "hit", tile: id, unitId: "B_02", type: "Bot", sector: "0,0", amount: 2, damage: 1, shields: 1 }]);
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
    expect(state.events).toEqual([{ seq: 1, kind: "moved", tile: id, unitId: "B_02", from: "0,0", to, how: "move" }]);
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
    expect(kinds(state.events)).toEqual(["revealed", "energy", "energy", "energy"]);
    expect(state.events![0]).toMatchObject({ kind: "revealed", tile: flare, sector: "0,1", type: "Flare" });
    // Red goes to the one ready Red Module by itself; then Blue and Yellow in the player's order.
    expect(state.events!.slice(1)).toMatchObject([
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
});
