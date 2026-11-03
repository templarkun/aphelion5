/**
 * Stage 2: state and tokens.
 * - tests/batch1.txt section STRENGTH AND TOKENS (T_TOK_01..07);
 * - the token results of T_GEO_03..08 that stage 1 could not check;
 * - Core Rules 3.3, 4.8, 5.2, 5.4, 6.1-6.7 rules and examples.
 * Card effects themselves (F_09, S_16, Mecha Attack...) are stages 3-5; here
 * the building blocks are called the way those cards will call them.
 */

import { describe, expect, it } from "vitest";
import { fieldMap, tile, units } from "../../src/engine/field.js";
import { coord } from "../../src/geometry/hex.js";
import {
  boost,
  cancelAlert,
  damageFlagship,
  dealHit,
  destroy,
  gainEnergy,
  isCrippled,
  loseEnergy,
  placeAlert,
  placeBarrier,
  placeBioShield,
  placeFuse,
  repairFlagship,
  setOffFuses,
} from "../../src/engine/tokens.js";
import { A, at, ctx, given, play, strengthAt, tokensAt, where } from "./helpers.js";

describe("tests/batch1.txt - STRENGTH AND TOKENS", () => {
  it("T_TOK_01 damage removes Shields first", () => {
    const s0 = given("T_TOK_01");
    expect(strengthAt(s0, "0,0")).toBe(3);
    const supply0 = s0.supply.shield;
    const { state } = play(s0, (c) => dealHit(c, at(c.state, "0,0"), 2));
    expect(tokensAt(state, "0,0")).toBe("[D1]");
    expect(strengthAt(state, "0,0")).toBe(1);
    expect(state.supply.shield).toBe(supply0 + 1);
  });

  it("T_TOK_02 Boosting a damaged unit removes Damage", () => {
    const s0 = given("T_TOK_02");
    expect(s0.supply.shield).toBe(10);
    const { state } = play(s0, (c) => boost(c, [at(c.state, "0,0")]));
    expect(tokensAt(state, "0,0")).toBe("");
    expect(strengthAt(state, "0,0")).toBe(2);
    expect(state.supply.shield).toBe(10);
  });

  it("T_TOK_03 Boost with no Shield left damages the Flagship; Boost all skips the Flare", () => {
    const s0 = given("T_TOK_03");
    expect(s0.supply.shield).toBe(0);
    // First Boost: 1 Flagship damage (to Bay 1).
    const r1 = play(s0, (c) => boost(c, [at(c.state, "0,0")]), [A.split({ bay1: 1 })]);
    expect(tokensAt(r1.state, "0,0")).toBe("");
    expect(r1.state.flagship).toEqual([5, 6, 6]);
    // "Boost all": every unit but F_09 costs 1 damage. M1 default board: B_01 + 8 B_03 = 9.
    const all = units(r1.state);
    const r2 = play(r1.state, (c) => boost(c, units(c.state)), [A.split({ bay1: 3, bay2: 3, bay3: 3 })]);
    expect(all).toHaveLength(10);
    expect(r2.asked[0]).toMatchObject({ kind: "split", total: 9 });
    expect(r2.state.flagship).toEqual([2, 3, 3]);
    expect(tokensAt(r2.state, "0,1")).toBe("");
    expect(r2.state.log.some((l) => l.text.includes("F_09") && l.text.includes("cannot be Boosted"))).toBe(true);
  });

  it("T_TOK_04 Bio-shield Destroyed effect hits the same type", () => {
    const s0 = given("T_TOK_04");
    expect(strengthAt(s0, "0,0")).toBe(2);
    // Only one legal target (G_08), so it is answered automatically.
    const { state, asked } = play(s0, (c) => dealHit(c, at(c.state, "0,0"), 1));
    expect(asked).toEqual([]);
    expect(tokensAt(state, "0,0")).toBe("");
    expect(strengthAt(state, "0,0")).toBe(1);
    expect(tokensAt(state, "0,1")).toBe("[WR][AL]");
    expect(tile(state, at(state, "0,1")).unitId).toBe("G_08");
    expect(tokensAt(state, "1,0")).toBe(""); // B_01 is not a Gyro
  });

  it("T_TOK_05 Barrier cancels a Mecha Attack hit (the Attack itself is stage 3)", () => {
    const s0 = given("T_TOK_05");
    expect(strengthAt(s0, "0,0")).toBe(3); // M_04
    const { state } = play(s0, (c) => dealHit(c, at(c.state, "0,1"), 3));
    expect(tokensAt(state, "0,1")).toBe("");
    expect(state.supply.barrier).toBe(s0.supply.barrier + 1);
    // "Attacking always destroys the attacker" (6.4): Destroy ignores Barriers and Strength.
    const r2 = play(state, (c) => {
      destroy(c, at(c.state, "0,0"));
      return (function* () {})();
    });
    expect(r2.state.field["0,0"]).toEqual([]); // nothing beneath: Cleared
    expect(r2.state.piles.discard.some((id) => id.startsWith("M_04"))).toBe(true);
  });

  it("T_TOK_06 Fuse order - Tick first kills the Mortar", () => {
    const s0 = given("T_TOK_06");
    expect(s0.phase).toBe("overloadEnd");
    const g05 = at(s0, "0,0");
    const mortar0 = s0.supply.mortar;
    const { state, asked } = play(s0, (c) => setOffFuses(c), [A.order(`${g05}:tick`)]);
    expect(asked[0]!.kind).toBe("order");
    expect(tokensAt(state, "0,0")).toBe("[WR][AL]");
    expect(state.supply.mortar).toBe(mortar0 + 1); // returned without firing
    expect(tokensAt(state, "0,1")).toBe(""); // B_02 unchanged
    expect(state.log.some((l) => l.text.includes("Mortar") && l.text.includes("goes off"))).toBe(false);
  });

  it("T_TOK_07 Fuse order - Mortar first (target B_02), then Tick", () => {
    const s0 = given("T_TOK_06"); // T_TOK_07's given is "same as T_TOK_06"
    const g05 = at(s0, "0,0");
    const b02 = at(s0, "0,1");
    const { state, asked } = play(s0, (c) => setOffFuses(c), [A.order(`${g05}:mortar`), A.units(b02)]);
    expect(asked.map((q) => q.kind)).toEqual(["order", "units"]);
    expect(tokensAt(state, "0,1")).toBe("[D1]");
    expect(tokensAt(state, "0,0")).toBe("[WR][AL]");
  });
});

describe("tests/batch1.txt - GEOMETRY, token results", () => {
  /** Targeted units of a tile's printed arrows at its facing. */
  function targetedUnits(state: ReturnType<typeof given>, k: string, arrows: (1 | 2 | 3 | 4 | 5 | 6)[]): string[] {
    const t = tile(state, at(state, k));
    return fieldMap(state)
      .arrows(coord(...(k.split(",").map(Number) as [number, number])), arrows, t.facing)
      .flatMap((a) => (a.targeted ? [`${a.targeted.q},${a.targeted.r}`] : []))
      .filter((x) => state.field[x]!.length > 0 && tile(state, state.field[x]!.at(-1)!).faceUp);
  }

  it("T_GEO_03 F_09 Boosts every Targeted unit: 1 Shield each, supply 6", () => {
    const s0 = given("T_GEO_03");
    expect(s0.phase).toBe("overload");
    const targets = targetedUnits(s0, "0,0", [1, 2, 3, 4]);
    expect(targets.sort()).toEqual(["-1,1", "0,1", "1,-1", "1,0"]);
    const { state } = play(s0, (c) => boost(c, targets.map((k) => at(c.state, k))));
    for (const k of targets) expect(tokensAt(state, k)).toBe("[S1]");
    expect(tokensAt(state, "0,-1")).toBe("");
    expect(tokensAt(state, "-1,0")).toBe("");
    expect(state.supply.shield).toBe(6);
  });

  it("T_GEO_04 S_16 Boosts all Bots in its lines of fire", () => {
    const s0 = given("T_GEO_04");
    const lines = fieldMap(s0).arrows(coord(0, 0), [1, 4], 2).flatMap((a) => a.lineOfFire.map((p) => `${p.q},${p.r}`));
    const bots = lines.filter((k) => s0.field[k]!.length > 0).map((k) => at(s0, k)).filter((u) => tile(s0, u).unitId!.startsWith("B_"));
    const { state } = play(s0, (c) => boost(c, bots));
    expect(tokensAt(state, "1,0")).toBe("[S1]");
    expect(tokensAt(state, "-1,0")).toBe("[S1]");
    expect(tokensAt(state, "0,1")).toBe("");
  });

  it("T_GEO_05 M_02 Expend: 1 damage to all units in its lines of fire, then M_02 is destroyed", () => {
    const s0 = given("T_GEO_05");
    const lines = fieldMap(s0).arrows(coord(1, 2), [1, 3], 5).flatMap((a) => a.lineOfFire.map((p) => `${p.q},${p.r}`));
    expect(lines).toEqual(["-1,2"]);
    const b01 = at(s0, "-1,2");
    const m02 = at(s0, "1,2");
    const { state } = play(s0, function* (c) {
      for (const k of lines) yield* dealHit(c, at(c.state, k), 1);
      destroy(c, m02);
    });
    expect(where(state, b01)).toBe("discard");
    expect(where(state, m02)).toBe("discard");
    expect(tokensAt(state, "0,1")).toBe("");
  });

  it("T_GEO_06 F_23 deals 1 damage to every Targeted unit; the gap side hits nothing", () => {
    const s0 = given("T_GEO_06");
    const targets = targetedUnits(s0, "0,1", [1, 2, 4, 5]);
    expect(targets).toEqual(["0,0", "1,0", "-1,2"]);
    const ids = targets.map((k) => at(s0, k));
    const { state } = play(s0, function* (c) {
      for (const u of ids) yield* dealHit(c, u, 1);
    });
    for (const u of ids) expect(where(state, u)).toBe("discard");
  });

  it("T_GEO_08 M_04 (Strength 2) hits B_03 two sectors away: B_03[D2], Strength 1", () => {
    const s0 = given("T_GEO_08");
    expect(strengthAt(s0, "0,-1")).toBe(2);
    const { state } = play(s0, (c) => dealHit(c, at(c.state, "0,2"), 2));
    expect(tokensAt(state, "0,2")).toBe("[D2]");
    expect(strengthAt(state, "0,2")).toBe(1);
    expect(tokensAt(state, "0,0")).toBe("");
  });
});

describe("Core Rules 3.3 and 6.1-6.3: Strength, hits, Shields, Bio-shields", () => {
  it("a unit at Strength 0 is destroyed; one without a Destroyed effect goes to the Discard and the sector is checked (3.4)", () => {
    const s0 = given("T_TOK_01", "(0,1): B_01 > fd:P_12");
    const b = at(s0, "0,1");
    const { state } = play(s0, (c) => dealHit(c, b, 5));
    expect(where(state, b)).toBe("discard");
    expect(state.log.some((l) => l.text.includes("is Dark") && l.rule === "3.4")).toBe(true);
  });

  it("an uncovered tile is a unit but was not revealed (3.4)", () => {
    const s0 = given("T_UNIT_04");
    const { state } = play(s0, (c) => dealHit(c, at(c.state, "0,0"), 1));
    expect(tile(state, at(state, "0,0")).unitId).toBe("S_01");
    expect(tokensAt(state, "0,0")).toBe(""); // no Barrier, no Alert (4.5)
  });

  it("with Shields and Bio-shields, you choose which go first (6.3)", () => {
    const s0 = given("T_TOK_04", "(1,1): G_06[S1][BS1]");
    const g = at(s0, "1,1");
    const { state, asked } = play(s0, (c) => dealHit(c, g, 1), [A.amount(0)]);
    expect(asked[0]).toMatchObject({ kind: "amount", min: 0, max: 1, rule: "6.3" });
    expect(tokensAt(state, "1,1")).toBe("[BS1]");
    // Choosing the Bio-shield instead triggers its Destroyed effect: G_08 is the only adjacent Gyro.
    const r2 = play(s0, (c) => dealHit(c, g, 1), [A.amount(1)]);
    expect(tokensAt(r2.state, "1,1")).toBe("[S1]");
    expect(tokensAt(r2.state, "0,1")).toBe("[WR][AL]");
  });

  it("a Bio-shield's damage waits until the effect that removed it has finished (6.3)", () => {
    const s0 = given("T_TOK_04");
    const g05 = at(s0, "0,0");
    const g08 = at(s0, "0,1");
    let seenDuringEffect: string | undefined;
    const { state } = play(s0, function* (c) {
      yield* dealHit(c, g05, 1);
      seenDuringEffect = JSON.stringify(c.state.tiles[g08]!.tokens);
    });
    expect(JSON.parse(seenDuringEffect!).wreck).toBe(false);
    expect(tile(state, g08).tokens.wreck).toBe(true);
  });

  it("the Bio-shield's carrier may itself be destroyed; adjacency is from its sector (3.3, 6.3)", () => {
    const s0 = given("T_TOK_04", "(0,0): G_07[BS1] > fd");
    const { state } = play(s0, (c) => dealHit(c, at(c.state, "0,0"), 2));
    expect(tokensAt(state, "0,0")).toBe("[WR][AL]"); // G_07 destroyed, a Gyro: Wreck
    expect(tokensAt(state, "0,1")).toBe("[WR][AL]"); // G_08 took the Bio-shield's 1 damage
  });

  it("a Bio-shield placed on a damaged unit cancels one Damage and returns (6.3)", () => {
    const s0 = given("T_TOK_02");
    const { state } = play(s0, function* (c) {
      placeBioShield(c, at(c.state, "0,0"));
    });
    expect(tokensAt(state, "0,0")).toBe("");
    expect(state.supply.bioShield).toBe(10);
  });

  it("Flares and Wrecks cannot be damaged, destroyed or Boosted (4.6, 4.8, 6.2)", () => {
    const s0 = given("T_UNIT_07");
    const f = at(s0, "0,1");
    const w = at(s0, "1,1");
    const { state } = play(s0, function* (c) {
      yield* dealHit(c, f, 3);
      yield* dealHit(c, w, 3);
      expect(destroy(c, f)).toBeUndefined();
      expect(destroy(c, w)).toBeUndefined();
      yield* boost(c, [f, w]);
    });
    expect(tokensAt(state, "0,1")).toBe("");
    expect(tokensAt(state, "1,1")).toBe("[WR][AL]");
    expect(state.supply.shield).toBe(10);
    expect(state.flagship).toEqual([6, 6, 6]);
  });

  it("a hit of 0 is refused until the designer decides (open question Q1)", () => {
    const s0 = given("T_TOK_01");
    expect(() => play(s0, (c) => dealHit(c, at(c.state, "0,0"), 0))).toThrow(/amount must be 1 or more/);
  });
});

describe("Core Rules 6.2: Boost when Shields run short", () => {
  it("you choose which units get the Shields left; the rest damage the Flagship", () => {
    const s0 = given("T_TOK_03", "Shield supply 1. (1,0): B_02[D1]");
    const b01 = at(s0, "0,0");
    const b03 = at(s0, "1,1");
    const b02 = at(s0, "1,0");
    const { state, asked } = play(s0, (c) => boost(c, [b02, b01, b03]), [A.units(b01), A.split({ bay2: 1 })]);
    expect(asked[0]).toMatchObject({ kind: "units", min: 1, max: 1 });
    expect((asked[0] as { options: string[] }).options.sort()).toEqual([b01, b03].sort()); // the damaged B_02 needs no Shield
    expect(tokensAt(state, "1,0")).toBe("");
    expect(tokensAt(state, "0,0")).toBe("[S1]");
    expect(tokensAt(state, "1,1")).toBe("");
    expect(state.flagship).toEqual([6, 5, 6]);
  });
});

describe("Core Rules 4.8: Wrecks", () => {
  it("a unit with a Destroyed effect becomes a Wreck: tokens return, Alert and marker placed", () => {
    const s0 = given("T_TOK_06");
    const g = at(s0, "0,0");
    const before = { tick: s0.supply.tick, mortar: s0.supply.mortar };
    const { state } = play(s0, function* (c) {
      const info = destroy(c, g)!;
      expect(info).toMatchObject({ wreck: true, type: "Gyro", strength: 1, sector: "0,0" });
    });
    expect(tokensAt(state, "0,0")).toBe("[WR][AL]");
    expect(state.supply.tick).toBe(before.tick + 1);
    expect(state.supply.mortar).toBe(before.mortar + 1);
  });

  it("an Omega unit with a Destroyed effect (O_01, Campaign board) also becomes a Wreck", () => {
    const s0 = given("T_UNIT_07");
    const { state } = play(s0, function* (c) {
      destroy(c, at(c.state, "0,2"));
    });
    expect(tokensAt(state, "0,2")).toBe("[WR][AL]");
  });

  it("Omega Level comes from the Campaign board (3.2): O_01 is Level 3, O_02 Level 13", () => {
    const s0 = given("T_UNIT_06");
    expect(strengthAt(s0, "0,1")).toBe(4); // O_01[S1]
    expect(strengthAt(s0, "0,0")).toBe(13);
  });
});

describe("Core Rules 5.2: Flagship", () => {
  it("damage is split as you choose; extra damage once Crippled is ignored", () => {
    const s0 = given("T_SHIP_01");
    expect(s0.flagship).toEqual([1, 1, 0]);
    const { state, asked } = play(s0, (c) => damageFlagship(c, 3));
    expect(asked).toEqual([]); // 2 Integrity left, 3 damage: the split is forced
    expect(state.flagship).toEqual([0, 0, 0]);
    expect(isCrippled(ctx(state))).toBe(true);
    const r2 = play(state, (c) => damageFlagship(c, 2));
    expect(r2.state.flagship).toEqual([0, 0, 0]);
    expect(r2.state.log.at(-1)!.text).toMatch(/Crippled: 2 damage ignored/);
  });

  it("T_SHIP_01's rescue: removing 3 damage, split as chosen, never above printed values", () => {
    const s0 = given("T_SHIP_01");
    const { state, asked } = play(s0, (c) => repairFlagship(c, 3), [A.split({ bay1: 1, bay3: 2 })]);
    expect(asked[0]).toMatchObject({ kind: "split", total: 3 });
    expect(state.flagship).toEqual([2, 1, 2]);
    expect(isCrippled(ctx(state))).toBe(false);
    expect(() => play(s0, (c) => repairFlagship(c, 3), [A.split({ bay1: 6 })])).toThrow(/rejected/);
  });
});

describe("Core Rules 6.4-6.7: Barriers, Alerts, Fuses, running out", () => {
  it("one Barrier and one Alert per unit; none on Flares", () => {
    const s0 = given("T_TOK_05");
    const s12 = at(s0, "0,1");
    const { state } = play(s0, function* (c) {
      expect(placeBarrier(c, s12)).toBe(false); // already has one
      expect(placeAlert(c, s12)).toBe(true);
      expect(placeAlert(c, s12)).toBe(false);
      expect(cancelAlert(c, s12)).toBe(true);
    });
    expect(tokensAt(state, "0,1")).toBe("[BAR]");
    const s1 = given("T_UNIT_07");
    const r = play(s1, function* (c) {
      expect(placeBarrier(c, at(c.state, "0,1"))).toBe(false);
      expect(placeFuse(c, at(c.state, "0,1"), "tick")).toBe(false);
      expect(cancelAlert(c, at(c.state, "1,1"))).toBe(false); // a Wreck's Alert is never removed by an effect
    });
    expect(tokensAt(r.state, "1,1")).toBe("[WR][AL]");
  });

  it("no token left in the Supply: use what there is and ignore the rest (6.7)", () => {
    const s0 = given("T_TOK_01");
    s0.supply.tick = 0;
    const { state } = play(s0, function* (c) {
      expect(placeFuse(c, at(c.state, "0,0"), "tick")).toBe(false);
    });
    expect(tokensAt(state, "0,0")).toBe("[S1]");
  });

  it("a Mortar hits an adjacent unit you choose (never a Flare or Wreck); a Feedback damages the Flagship", () => {
    const s0 = given("T_UNIT_07", "(1,1): G_05[MORTAR][FB] > fd");
    const g = at(s0, "1,1");
    const { state, asked } = play(s0, (c) => setOffFuses(c), [A.order(`${g}:mortar`), A.units(at(s0, "1,0")), A.split({ bay1: 1 })]);
    expect((asked[1] as { options: string[] }).options.sort()).toEqual([at(s0, "1,0"), at(s0, "0,2")].sort()); // not F_09 in (0,1)
    expect(tokensAt(state, "1,0")).toBe("[D1]");
    expect(state.flagship).toEqual([5, 6, 6]);
  });
});

describe("Core Rules 5.4: energy", () => {
  it("gain with no colour named: you choose; lose more than you have: lose all", () => {
    const s0 = given("T_TOK_01");
    const { state } = play(s0, (c) => gainEnergy(c, 3), [A.split({ Yellow: 1, Blue: 2 })]);
    expect(state.player.reserve).toEqual({ Yellow: 1, Red: 0, Blue: 2 });
    expect(state.supply.energy).toEqual({ Yellow: 9, Red: 10, Blue: 8 });
    const r2 = play(state, (c) => loseEnergy(c, 5));
    expect(r2.state.player.reserve).toEqual({ Yellow: 0, Red: 0, Blue: 0 });
  });

  it("gain more than the Supply holds: take what there is (6.7)", () => {
    const s0 = given("T_TOK_01");
    s0.supply.energy.Red = 1;
    const { state } = play(s0, (c) => gainEnergy(c, 2, "Red"));
    expect(state.player.reserve.Red).toBe(1);
    expect(state.supply.energy.Red).toBe(0);
  });
});

describe("Sleepers and the top-tile check (3.4, 4.4)", () => {
  it("T_UNIT_02: an uncovered Sleeper with no Dark sector left is alerted at once", () => {
    const s0 = given("T_UNIT_02");
    const { state } = play(s0, (c) => dealHit(c, at(c.state, "0,0"), 1));
    expect(tile(state, at(state, "0,0")).unitId).toBe("P_12");
    expect(tokensAt(state, "0,0")).toBe("[AL]");
  });

  it("with a Dark sector left, an uncovered Sleeper is not alerted", () => {
    const s0 = given("T_UNIT_02", "(-1,2): fd");
    const { state } = play(s0, (c) => dealHit(c, at(c.state, "0,0"), 1));
    expect(tokensAt(state, "0,0")).toBe("");
  });
});
