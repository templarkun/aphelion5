/**
 * Stage 2: the engine core - pure steps, replay, the choice interface,
 * the seeded generator, the board notation, and the invariants.
 */

import { describe, expect, it } from "vitest";
import { type RunCtx, answer, registerRoot, replay, startRoot } from "../../src/engine/effect.js";
import { checkInvariants } from "../../src/engine/invariants.js";
import { type Question, invalidReason, legalAnswerCount, onlyAnswer } from "../../src/engine/questions.js";
import { newRng, nextInt, shuffle } from "../../src/engine/rng.js";
import { parseGiven, parseTileSpec, scenarioState } from "../../src/engine/scenario.js";
import { damageFlagship, dealHit } from "../../src/engine/tokens.js";
import { A, allScenarios, at, ctx, data, given, tokensAt } from "./helpers.js";

registerRoot("test:shipHit", function* (c: RunCtx, args) {
  const { n } = args as { n: number };
  yield* damageFlagship(c, n);
  yield* damageFlagship(c, n);
});

describe("engine step: (state, answer) -> (state, question)", () => {
  it("asks, accepts a legal answer, and finishes", () => {
    const s0 = given("T_TOK_01");
    const e0 = startRoot(s0, "test:shipHit", { n: 2 });
    const r0 = replay(data(), e0);
    expect(r0.status).toBe("question");
    const r1 = answer(data(), r0.engine, A.split({ bay1: 2 }));
    expect(r1.status).toBe("question");
    if (r1.status !== "question") throw new Error();
    expect(r1.state.flagship).toEqual([4, 6, 6]);
    const r2 = answer(data(), r1.engine, A.split({ bay2: 1, bay3: 1 }));
    expect(r2.status).toBe("done");
    if (r2.status !== "done") throw new Error();
    expect(r2.state.flagship).toEqual([4, 5, 5]);
  });

  it("never changes the checkpoint it was given (pure)", () => {
    const s0 = given("T_TOK_01");
    const frozen = JSON.stringify(s0);
    const e0 = startRoot(s0, "test:shipHit", { n: 1 });
    const r = answer(data(), replay(data(), e0).engine, A.split({ bay1: 1 }));
    expect(r.status).toBe("question");
    expect(JSON.stringify(s0)).toBe(frozen);
  });

  it("same checkpoint + same answers = same state (replay)", () => {
    const s0 = given("T_TOK_01");
    const e = { ...startRoot(s0, "test:shipHit", { n: 3 }), answers: [A.split({ bay1: 3 }), A.split({ bay1: 1, bay2: 2 })] };
    const a = replay(data(), e);
    const b = replay(data(), structuredClone(e));
    expect(a.status).toBe("done");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("an illegal answer is refused and the engine stays where it was", () => {
    const s0 = given("T_TOK_01");
    const e0 = replay(data(), startRoot(s0, "test:shipHit", { n: 2 })).engine;
    const bad = answer(data(), e0, A.split({ bay1: 1 })); // adds up to 1, not 2
    expect(bad.status).toBe("illegal");
    if (bad.status !== "illegal") throw new Error();
    expect(bad.reason).toMatch(/add up to 2/);
    expect(bad.engine).toEqual(e0);
    expect(answer(data(), e0, A.option("x")).status).toBe("illegal");
  });

  it("questions with exactly one legal answer are answered automatically, unless switched off", () => {
    const s0 = given("T_SHIP_01"); // Bays 1, 1, 0
    const on = replay(data(), startRoot(s0, "test:shipHit", { n: 2 }));
    expect(on.status).toBe("done"); // both splits are forced
    s0.settings.autoAnswer = false;
    const off = replay(data(), startRoot(s0, "test:shipHit", { n: 2 }));
    expect(off.status).toBe("question");
  });

  it("state survives a JSON round trip (it is plain data)", () => {
    const s0 = given("T_TOK_06");
    expect(JSON.parse(JSON.stringify(s0))).toEqual(s0);
  });
});

describe("questions", () => {
  const base = { prompt: "p", rule: "r" };
  it("count legal answers", () => {
    expect(legalAnswerCount({ ...base, kind: "units", options: ["a", "b", "c"], min: 1, max: 1 })).toBe(3);
    expect(legalAnswerCount({ ...base, kind: "units", options: ["a", "b", "c"], min: 0, max: 3 })).toBe(8);
    expect(legalAnswerCount({ ...base, kind: "split", total: 2, buckets: [{ id: "a", label: "a", max: 2 }, { id: "b", label: "b", max: 2 }] })).toBe(2);
    expect(legalAnswerCount({ ...base, kind: "split", total: 4, buckets: [{ id: "a", label: "a", max: 2 }, { id: "b", label: "b", max: 2 }] })).toBe(1);
    expect(legalAnswerCount({ ...base, kind: "yesno" })).toBe(2);
  });

  it("find the only answer when it is forced", () => {
    const q: Question = { ...base, kind: "split", total: 4, buckets: [{ id: "a", label: "a", max: 2 }, { id: "b", label: "b", max: 2 }] };
    expect(onlyAnswer(q)).toEqual({ kind: "split", value: { a: 2, b: 2 } });
    expect(onlyAnswer({ ...base, kind: "units", options: ["a"], min: 1, max: 1 })).toEqual({ kind: "units", value: ["a"] });
    expect(onlyAnswer({ ...base, kind: "units", options: ["a", "b"], min: 0, max: 0 })).toEqual({ kind: "units", value: [] });
    expect(onlyAnswer({ ...base, kind: "yesno" })).toBeUndefined();
  });

  it("explain why an answer is illegal", () => {
    const q: Question = { ...base, kind: "units", options: ["a", "b"], min: 1, max: 1 };
    expect(invalidReason(q, A.units("a"))).toBeUndefined();
    expect(invalidReason(q, A.units("c"))).toMatch(/not a legal choice/);
    expect(invalidReason(q, A.units("a", "b"))).toMatch(/choose 1/);
    expect(invalidReason(q, A.units("a", "a"))).toMatch(/twice/);
    expect(invalidReason(q, A.amount(1))).toMatch(/expected a units answer/);
  });
});

describe("the seeded generator", () => {
  it("is repeatable and changes with the seed", () => {
    const a = newRng(42);
    const b = newRng(42);
    const c = newRng(43);
    const xa = Array.from({ length: 5 }, () => nextInt(a, 100));
    expect(Array.from({ length: 5 }, () => nextInt(b, 100))).toEqual(xa);
    expect(Array.from({ length: 5 }, () => nextInt(c, 100))).not.toEqual(xa);
  });

  it("shuffles every item exactly once and survives JSON", () => {
    const st = newRng(7);
    const items = Array.from({ length: 84 }, (_, i) => i);
    const out = shuffle(JSON.parse(JSON.stringify(st)), [...items]);
    expect([...out].sort((x, y) => x - y)).toEqual(items);
    expect(out).not.toEqual(items);
    expect(shuffle(JSON.parse(JSON.stringify(st)), [...items])).toEqual(out);
  });

  it("is roughly uniform", () => {
    const st = newRng(1);
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6000; i++) counts[nextInt(st, 6)]! += 1;
    for (const n of counts) expect(n).toBeGreaterThan(850);
  });
});

describe("board notation (batch FORMAT SPEC item 4)", () => {
  it("reads tiles, tokens, facing and face-down contents", () => {
    expect(parseTileSpec("B_02[S1]")).toMatchObject({ unitId: "B_02", faceUp: true, tokens: { shield: 1 } });
    expect(parseTileSpec("F_09 f=1 [AL]")).toMatchObject({ unitId: "F_09", facing: 1, tokens: { alert: true } });
    expect(parseTileSpec("G_05 Wreck [WR][AL]")).toMatchObject({ tokens: { wreck: true, alert: true } });
    expect(parseTileSpec("S_05[AL][BAR]")).toMatchObject({ tokens: { alert: true, barrier: true } });
    expect(parseTileSpec("fd:B_02")).toMatchObject({ unitId: "B_02", faceUp: false });
    expect(parseTileSpec("fd")).toMatchObject({ unitId: null, faceUp: false });
    expect(() => parseTileSpec("B_02[XX1]")).toThrow(/unknown token/);
  });

  it("reads stacks top first, shared stacks, and state phrases", () => {
    const g = parseGiven("Overload under way. Shield supply 3. (0,0): S_12 [AL] > fd. (1,-1), (1,1): cleared. Flagship V1 Integrity Bay1 1, Bay2 1, Bay3 0.");
    expect(g.phase).toBe("overload");
    expect(g.shieldSupply).toBe(3);
    expect(g.flagship).toEqual([1, 1, 0]);
    expect(g.stacks.get("0,0")!.map((t) => t.unitId)).toEqual(["S_12", null]);
    expect(g.stacks.get("1,-1")).toEqual([]);
    expect(g.stacks.get("1,1")).toEqual([]);
  });

  it("fills unlisted sectors with a face-up B_03 over a face-down tile", () => {
    const s = given("T_TOK_01");
    expect(tokensAt(s, "0,0")).toBe("[S1]");
    const st = s.field["1,1"]!;
    expect(st.map((id) => [s.tiles[id]!.unitId, s.tiles[id]!.faceUp])).toEqual([
      [null, false],
      ["B_03", true],
    ]);
  });

  it("refuses a sector that is not on the map", () => {
    expect(() => scenarioState(data(), "M1", "(5,5): B_01.")).toThrow(/not on map/);
  });

  it("every board in batch 1 and batch 2 loads, and passes the invariants", () => {
    let loaded = 0;
    for (const sc of allScenarios()) {
      if (!sc.map || sc.given === undefined || /same as/.test(sc.given)) continue;
      const s = scenarioState(data(), sc.map, sc.given);
      expect(checkInvariants(ctx(s)), sc.id).toEqual([]);
      loaded++;
    }
    expect(loaded).toBeGreaterThan(60);
  });
});

describe("invariants", () => {
  it("catch a tile in two places, Shields with Damage, and tokens on a face-down tile", () => {
    const s = given("T_TOK_01");
    const b = at(s, "0,0");
    s.field["0,1"]!.push(b);
    s.tiles[b]!.tokens.damage = 1;
    const fd = s.field["1,1"]![0]!;
    s.tiles[fd]!.tokens.tick = 1;
    const p = checkInvariants(ctx(s));
    expect(p.some((x) => x.includes("two places"))).toBe(true);
    expect(p.some((x) => x.includes("both Shields and Damage"))).toBe(true);
    expect(p.some((x) => x.includes(`${fd} holds tokens but is not a unit`))).toBe(true);
  });

  it("catch more tokens than the game has", () => {
    const s = given("T_TOK_01");
    s.supply.shield = 10; // plus the one on B_02 = 11
    expect(checkInvariants(ctx(s))).toContain("11 shield tokens exist; the game has 10");
  });

  it("hold through a long run of hits on every unit", () => {
    const s0 = given("T_TOK_04", "(1,1): G_06[S1][BS1]. (-1,0): S_12[BAR][TICK]");
    const r = replay(data(), { checkpoint: s0, root: { name: "test:hitAll", args: null }, answers: [] });
    expect(["done", "question"]).toContain(r.status);
    if (r.status !== "illegal") expect(checkInvariants(ctx(r.state))).toEqual([]);
  });
});

registerRoot("test:hitAll", function* (c: RunCtx) {
  for (const k of Object.keys(c.state.field)) {
    const top = c.state.field[k]!.at(-1);
    if (top !== undefined && c.state.tiles[top]!.faceUp) yield* dealHit(c, top, 1);
  }
});
