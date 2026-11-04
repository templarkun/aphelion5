/**
 * Stage 6 card tests: every Module at least once (spec "Testing").
 * Light Modules run in the Command phase, red ones during an Overload.
 * The Module under test holds the stated energy; your Reserve holds all the
 * rest of its colour (so payment asks nothing unless the test says so).
 */

import { describe, expect, it } from "vitest";
import { commandStep } from "../../src/engine/command.js";
import { sectorState, tile } from "../../src/engine/field.js";
import { moduleCost, moduleDef } from "../../src/engine/modules.js";
import { overloadStep } from "../../src/engine/overload.js";
import type { Answer } from "../../src/engine/questions.js";
import { scenarioState } from "../../src/engine/scenario.js";
import type { GameState } from "../../src/engine/state.js";
import { A, at, ctx, data, play, tokensAt, withModules } from "./helpers.js";

type E = Partial<Record<"Yellow" | "Red" | "Blue", number>>;
interface Opts {
  stored?: E;
  /** Other Modules: [id, ready, energy]. */
  others?: [number, boolean, E?][];
}

const tested = new Set<number>();
const board = (given: string) => scenarioState(data(), "M1", "Every other sector cleared. " + given);

function setup(id: number, given: string, o: Opts = {}): GameState {
  const d = moduleDef(ctx(board("")), id);
  const s = board((d.background === "red" ? "Overload under way. " : "") + given);
  withModules(s, [[id, true, o.stored ?? {}], ...(o.others ?? []).map(([m, r, e]) => [m, r, e ?? {}] as [number, boolean, E])]);
  s.player.reserve[d.colour] = s.supply.energy[d.colour];
  s.supply.energy[d.colour] = 0;
  return s;
}

/** Run Module `id` as the action (it must be the only Module you can run now). */
function run(id: number, given: string, answers: Answer[] = [], o: Opts = {}): GameState {
  tested.add(id);
  const s = setup(id, given, o);
  const step = s.phase === "overload" ? overloadStep : commandStep;
  return play(s, (c) => step(c), [A.option("runModule"), ...answers]).state;
}

const m = (id: number, name: string, fn: () => void) => it(`${id} ${name}`, fn);
const gone = (s: GameState, k: string) => expect(sectorState(s, k)).not.toBe("occupied");
const u = (s: GameState, k: string) => at(s, k);
const pile = (s: GameState, p: keyof GameState["piles"]) => s.piles[p].map((t) => s.tiles[t]!.unitId);

describe("Yellow Modules", () => {
  m(2, "Ion Sweep: one unit, one Gyro, one Sleeper", () => {
    const g = "(0,1): B_01 > fd. (1,0): G_05 > fd. (1,1): P_12 > fd.";
    const s = run(2, g, [A.units(u(board(g), "0,1"))]);
    gone(s, "0,1");
    expect(tokensAt(s, "1,0")).toBe("[WR][AL]");
    expect(tokensAt(s, "1,1")).toBe("[D1]");
  });
  m(3, "Capacitor Lance: 3 damage; 1 Yellow less per other exhausted Module", () => {
    const s0 = setup(3, "", { others: [[1, false], [2, false]] });
    expect(moduleCost(ctx(s0), 3)).toBe(7);
    const s = run(3, "(0,1): B_03 > fd.", [], { others: [[1, false], [2, false]] });
    gone(s, "0,1");
    expect(s.player.reserve.Yellow).toBe(8);
  });
  m(4, "Tick Missile: 1 damage, a Tick if it survives", () => expect(tokensAt(run(4, "(0,1): B_02 > fd."), "0,1")).toBe("[D1][TICK]"));
  m(5, "Heavy Plasma Cannon: 4 damage, all energy on Modules returns", () => {
    const s = run(5, "(0,1): B_03[S1] > fd.", [], { others: [[26, true, { Red: 2 }]] });
    gone(s, "0,1");
    expect(s.player.modules[1]!.energy.Red).toBe(0);
    expect(s.supply.energy.Red).toBe(15);
  });
  m(6, "Accumulator Beam: X = Yellow on it before running", () => {
    const s = run(6, "(0,1): B_03 > fd.", [], { stored: { Yellow: 3 } });
    gone(s, "0,1");
    expect(s.player.modules[0]!.energy.Yellow).toBe(0);
  });
  m(7, "Cluster Mine: 1 damage, Ticks on adjacent Gyros and Sleepers", () => {
    const g = "(0,1): B_01 > fd. (0,2): G_05 > fd. (1,1): P_12 > fd.";
    const s = run(7, g, [A.units(u(board(g), "0,1"))]);
    gone(s, "0,1");
    expect(tokensAt(s, "0,2")).toBe("[TICK]");
    expect(tokensAt(s, "1,1")).toBe("[TICK]");
  });
  m(8, "Proton Torpedoes: 2 damage to two units, 1 energy per survivor", () => {
    const s = run(8, "(0,1): B_01 > fd. (1,0): B_03 > fd.", [A.split({ Red: 1, Blue: 0 })]);
    gone(s, "0,1");
    expect(tokensAt(s, "1,0")).toBe("[D2]");
    expect(s.player.reserve.Red).toBe(1);
  });
  m(9, "Ricochet Missiles: 2 damage; if it destroys, 1 to another unit", () => {
    const g = "(0,1): B_02 > fd. (1,0): B_01 > fd.";
    const s = run(9, g, [A.units(u(board(g), "0,1"))]);
    gone(s, "0,1");
    gone(s, "1,0");
  });
  m(10, "Twin Laser Turret: two adjacent units; pay 3 more for 2 each", () => {
    const s = run(10, "(0,1): B_02 > fd. (0,2): B_02 > fd.", [A.yes()]);
    gone(s, "0,1");
    gone(s, "0,2");
    expect(s.player.reserve.Yellow).toBe(9);
    const t = run(10, "(0,1): B_02 > fd. (0,2): B_02 > fd.", [A.no()]);
    expect(tokensAt(t, "0,1")).toBe("[D1]");
  });
  m(11, "Capacitor Demolisher: destroy two adjacent Bots", () => {
    const s = run(11, "(0,1): B_01 > fd. (0,2): B_03 > fd.");
    gone(s, "0,1");
    gone(s, "0,2");
  });
  m(12, "Tri-Lock Missiles: 1 damage to three units of a type", () => {
    const s = run(12, "(0,1): B_01 > fd. (1,0): B_01 > fd. (1,1): B_01 > fd.");
    for (const k of ["0,1", "1,0", "1,1"]) gone(s, k);
  });
  m(13, "Shrapnel Detonation: a Mecha and up to three adjacent units", () => {
    const g = "(0,0): M_02 > fd. (0,1): B_01 > fd. (1,0): B_01 > fd.";
    const b = board(g);
    const s = run(13, g, [A.units(u(b, "1,0"), u(b, "0,1"))]);
    expect(tokensAt(s, "0,0")).toBe("[D1]");
    gone(s, "0,1");
    gone(s, "1,0");
  });
  m(14, "Splitter Missiles: divide 3 damage", () => {
    const g = "(0,1): B_02 > fd. (1,0): B_01 > fd.";
    const b = board(g);
    const s = run(14, g, [A.split({ [u(b, "0,1")]: 2, [u(b, "1,0")]: 1 })]);
    gone(s, "0,1");
    gone(s, "1,0");
  });
  m(15, "Arc Cannon: two different Gyros", () => {
    const s = run(15, "(0,1): G_05 > fd. (1,0): G_07 > fd.", [A.option("gyros")]);
    expect(tokensAt(s, "0,1")).toBe("[WR][AL]");
    expect(tokensAt(s, "1,0")).toBe("[WR][AL]");
  });
  m(16, "Autoturret Sweep: one unit of each type", () => {
    const s = run(16, "(0,1): B_01 > fd. (1,0): M_01 > fd. (1,1): G_05 > fd. (0,2): P_12 > fd. (-1,0): S_01 > fd. (-1,2): O_01 > fd.");
    gone(s, "0,1");
    gone(s, "1,0");
    expect(tokensAt(s, "0,2")).toBe("[D1]");
    expect(tokensAt(s, "-1,2")).toBe("[D1]");
  });
  m(17, "Salvo Launcher: three mutually adjacent units; 1 Yellow less per Cleared sector", () => {
    const s = run(17, "(0,0): B_01 > fd. (0,1): B_01 > fd. (1,0): B_01 > fd.");
    for (const k of ["0,0", "0,1", "1,0"]) gone(s, k);
    expect(s.player.reserve.Yellow).toBe(15); // 7 Cleared sectors: cost 0
  });
  m(18, "Proton Cull: the type with the fewest units", () => {
    const s = run(18, "(0,1): B_01 > fd. (1,0): B_01 > fd. (1,1): G_05 > fd.");
    expect(tokensAt(s, "1,1")).toBe("[WR][AL]");
    expect(tokensAt(s, "0,1")).toBe("");
  });
  m(19, "Electron Flood: 1 damage to every Bot, energy on other Modules returns", () => {
    const s = run(19, "(0,1): B_01 > fd.", [], { others: [[26, true, { Red: 2 }]] });
    gone(s, "0,1");
    expect(s.player.modules[1]!.energy.Red).toBe(0);
  });
  m(20, "Graviton Rockets: every Sentinel", () => gone(run(20, "(0,1): S_01 > fd.", [A.option("sentinel")]), "0,1"));
  m(21, "Ground Zero: destroy a Mecha, 1 damage to every unit of its Level or lower", () => {
    const s = run(21, "(0,0): M_02 > fd. (0,1): B_02 > fd. (1,0): B_03 > fd. (1,1): O_01 > fd. (0,2): B_01 > fd.");
    gone(s, "0,0");
    expect(tokensAt(s, "0,1")).toBe("[D1]");
    expect(tokensAt(s, "1,0")).toBe("");
    expect(tokensAt(s, "1,1")).toBe("");
    gone(s, "0,2");
  });
  m(22, "Harmonic Collapse: destroy every Level 1 unit; 1 less per Dark sector", () => {
    const s = run(22, "(0,1): B_01 > fd. (1,0): M_01 > fd. (1,1): B_02 > fd. (0,2): fd.");
    gone(s, "0,1");
    gone(s, "1,0");
    expect(tokensAt(s, "1,1")).toBe("");
    expect(s.player.reserve.Yellow).toBe(9); // one Dark sector when paying: cost 7 - 1 = 6
  });
  m(23, "Harmonic Pulse: 1 damage to every Level 2 unit", () => {
    const s = run(23, "(0,1): B_02 > fd. (1,0): B_01 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[D1]");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  m(24, "Rocket Barrage: a horizontal row", () => {
    const s = run(24, "(0,1): B_01 > fd. (1,0): B_01 > fd.", [A.option("1")]);
    gone(s, "0,1");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  m(25, "Thin Line Barrage: the row with the fewest units", () => {
    const s = run(25, "(0,1): B_01 > fd. (0,2): B_01 > fd. (1,0): B_01 > fd.");
    gone(s, "1,0");
    expect(tokensAt(s, "0,1")).toBe("");
  });
  m(77, "Seismic Charge: units adjacent to a Cleared sector", () => gone(run(77, "(0,1): B_01 > fd.", [A.sectors("0,2")]), "0,1"));
});

describe("Red Modules", () => {
  m(27, "Counter-Battery Beam: X = Sentinels", () => {
    const g = "(0,1): S_01 > fd. (1,0): S_01 > fd. (1,1): B_03 > fd.";
    expect(tokensAt(run(27, g, [A.units(u(board(g), "1,1"))]), "1,1")).toBe("[D2]");
  });
  m(28, "Mirror Lattice Beam: X = adjacent Bots", () => {
    const g = "(0,0): B_03 > fd. (0,1): B_01 > fd. (1,0): B_01 > fd.";
    expect(tokensAt(run(28, g, [A.units(u(board(g), "0,0"))]), "0,0")).toBe("[D2]");
  });
  m(29, "Siphon Blast: 2 damage, Bio-shields on two adjacent non-Mecha units", () => {
    const g = "(0,0): B_01 > fd. (0,1): B_02 > fd. (1,0): G_05 > fd. (-1,0): M_01 > fd.";
    const s = run(29, g, [A.units(u(board(g), "0,0"))]);
    gone(s, "0,0");
    expect(tokensAt(s, "0,1")).toBe("[BS1]");
    expect(tokensAt(s, "1,0")).toBe("[BS1]");
    expect(tokensAt(s, "-1,0")).toBe("");
  });
  m(30, "Capacitor Strike: 2 Red less per other exhausted Module", () => {
    const s = run(30, "(0,1): B_02 > fd.", [], { others: [[2, false]] });
    gone(s, "0,1");
    expect(s.player.reserve.Red).toBe(11);
  });
  m(31, "Backlash Beam: X = units that gained a Shield or lost a Damage", () => {
    const g = "(0,0): B_03 > fd. (0,1): B_01[D1] > fd. (1,0): B_02 > fd.";
    const s = run(31, g, [A.units(u(board(g), "0,0"))]);
    expect(tokensAt(s, "0,0")).toBe("[D2]");
    expect(tokensAt(s, "0,1")).toBe("");
    expect(tokensAt(s, "1,0")).toBe("[S1]");
  });
  m(32, "Static Discharge: a unit and every Gyro adjacent to it", () => {
    const g = "(0,0): B_01 > fd. (0,1): G_05 > fd. (1,0): B_02 > fd.";
    const s = run(32, g, [A.units(u(board(g), "0,0"))]);
    gone(s, "0,0");
    expect(tokensAt(s, "0,1")).toBe("[WR][AL]");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  m(33, "Seeker Missile: 2 damage; if it survives, a Tick next to it", () => {
    const g = "(0,0): B_03 > fd. (0,1): B_01 > fd.";
    const s = run(33, g, [A.units(u(board(g), "0,0"))]);
    expect(tokensAt(s, "0,0")).toBe("[D2]");
    expect(tokensAt(s, "0,1")).toBe("[TICK]");
  });
  m(34, "Twin Pulse Beams: both destroyed, 1 damage to another unit", () => {
    const s = run(34, "(0,0): B_01 > fd. (0,1): B_01 > fd. (1,-1): B_02 > fd.", [A.option("1")]);
    gone(s, "0,0");
    gone(s, "0,1");
    expect(tokensAt(s, "1,-1")).toBe("[D1]");
  });
  m(35, "Tesla Overcharge: adjacent units of a different type", () => {
    const g = "(0,0): B_02 > fd. (0,1): B_01 > fd. (1,0): G_05 > fd.";
    const s = run(35, g, [A.units(u(board(g), "0,0"))]);
    expect(tokensAt(s, "0,0")).toBe("[D1]");
    expect(tokensAt(s, "1,0")).toBe("[WR][AL]");
    expect(tokensAt(s, "0,1")).toBe("");
  });
  m(36, "Triad Strike: exactly three of the chosen type", () => {
    const s = run(36, "(0,1): B_01 > fd. (1,0): B_01 > fd. (1,1): B_01 > fd.", [A.option("Bot")]);
    for (const k of ["0,1", "1,0", "1,1"]) gone(s, k);
  });
  m(37, "Cascade Phaser: Bot, then Gyro, then Sentinel while each is destroyed", () => {
    const s = run(37, "(0,1): B_01 > fd. (1,0): G_05 > fd. (1,1): S_01 > fd.");
    gone(s, "0,1");
    expect(tokensAt(s, "1,0")).toBe("[WR][AL]");
    gone(s, "1,1");
  });
  m(38, "Arc Discharge: if it survives, two other adjacent units", () => {
    const g = "(0,0): B_03 > fd. (0,1): B_01 > fd. (1,0): B_01 > fd.";
    const s = run(38, g, [A.units(u(board(g), "0,0"))]);
    gone(s, "0,1");
    gone(s, "1,0");
  });
  m(39, "Bunker Busters: the row with the most Level 3 units", () => {
    const s = run(39, "(0,1): B_03 > fd. (1,0): B_01 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[D1]");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  m(40, "Polarity Sweep: damage one row, Boost one row", () => {
    const s = run(40, "(0,1): B_01 > fd. (1,0): B_01 > fd.", [A.option("1"), A.option("2")]);
    gone(s, "0,1");
    expect(tokensAt(s, "1,0")).toBe("[S1]");
  });
  m(41, "Beacon Strike: every row with a Mecha", () => {
    const s = run(41, "(0,1): M_01 > fd. (0,2): B_01 > fd. (1,0): B_01 > fd.");
    gone(s, "0,1");
    gone(s, "0,2");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  m(42, "Harmonic Strike: every Level 3 unit", () => {
    const s = run(42, "(0,1): B_03 > fd. (1,0): B_02 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[D1]");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  m(43, "Harmonic Wave: Level 2 Bots and Mecha; pay 3 more for 2 each", () => {
    const s = run(43, "(0,1): B_02 > fd. (1,0): M_02 > fd.", [A.yes()]);
    gone(s, "0,1");
    gone(s, "1,0");
  });
  m(44, "Chain Reaction Beam: until a hit destroys nothing", () => {
    const g = "(0,0): B_01 > fd. (0,1): B_01 > fd. (0,2): B_03 > fd.";
    const s = run(44, g, [A.units(u(board(g), "0,0"))]);
    gone(s, "0,0");
    gone(s, "0,1");
    expect(tokensAt(s, "0,2")).toBe("[D1]");
  });
  m(45, "Thermal Detonator: every damaged unit; 1 Red less per Cleared sector", () => {
    const s = run(45, "(0,1): B_02[D1] > fd. (1,0): B_01 > fd.");
    gone(s, "0,1");
    expect(tokensAt(s, "1,0")).toBe("");
  });
  m(46, "Echo Ray: one hit, plus one per Sentinel", () => gone(run(46, "(0,1): B_02 > fd. (1,0): S_12 > fd."), "0,1"));
  m(47, "Lone Hunter Missiles: each type with exactly one unit", () => {
    const s = run(47, "(0,1): B_01 > fd. (1,0): G_05 > fd. (1,1): S_01 > fd. (0,2): S_01 > fd.");
    gone(s, "0,1");
    expect(tokensAt(s, "1,0")).toBe("[WR][AL]");
    expect(tokensAt(s, "1,1")).toBe("");
  });
  m(48, "Point-Defense Phaser: X = Red on it before running", () => {
    const s = run(48, "(0,1): S_01 > fd. (1,0): S_01 > fd.", [], { stored: { Red: 2 } });
    gone(s, "0,1");
    gone(s, "1,0");
  });
  m(49, "Drone Bomber: Ticks on two units of the same type", () => {
    const s = run(49, "(0,1): B_01 > fd. (1,0): B_01 > fd. (1,1): G_05 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[TICK]");
    expect(tokensAt(s, "1,0")).toBe("[TICK]");
  });
  m(50, "Phantom Recon: 2 damage to the last two revealed", () => {
    const s = run(50, "(0,1): fd:B_02 > fd. (1,0): fd:B_01 > fd.", [A.yes(), A.sectors("0,1"), A.yes()]);
    gone(s, "0,1");
    gone(s, "1,0");
  });
  m(78, "Signal Jammer: cancel one Sentinel's Alert", () => expect(tokensAt(run(78, "(0,1): S_01[AL] > fd.", [A.option("alert")]), "0,1")).toBe(""));
});

describe("Blue Modules", () => {
  m(51, "Satellite Ion Scan: if the last unit revealed is a Bot, destroy it", () => gone(run(51, "(0,1): fd:B_01 > fd.", [A.yes()]), "0,1"));
  m(52, "Tactical Scan: reveal the Bots among the tiles looked at", () => {
    const s = run(52, "(0,1): fd:B_01 > fd. (1,0): fd:G_05 > fd.", [A.sectors("0,1", "1,0")]);
    expect(pile(s, "discard")).toContain("B_01");
    expect(sectorState(s, "1,0")).toBe("dark");
    expect(s.seen).toContain(s.field["1,0"]!.at(-1));
  });
  m(53, "Pathfinder Array: reveal X, 2 damage to each Bot", () => {
    const s = run(53, "(0,1): fd:B_01 > fd. (1,0): fd:B_02 > fd.", [A.amount(2), A.sectors("0,1")]);
    expect(pile(s, "discard").sort()).toEqual(["B_01", "B_02"]);
    expect(s.player.reserve.Blue).toBe(10);
  });
  m(54, "Debris Sifter: look at the top X, discard a Bot", () => {
    const s = run(54, "(0,1): fd:B_01 > fd:G_05 > fd.", [A.amount(2)]);
    expect(pile(s, "discard")).toEqual(["B_01"]);
    expect(tile(s, s.field["0,1"]!.at(-1)!).unitId).toBe("G_05");
    expect(sectorState(s, "0,1")).toBe("dark");
  });
  m(55, "Minefield Layer: Ticks in a row with a Mecha; 2 less per Cleared sector", () => {
    const s = run(55, "(0,1): M_01 > fd. (0,2): B_01 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[TICK]");
    expect(tokensAt(s, "0,2")).toBe("[TICK]");
  });
  m(56, "Scatter Minelayer: 1 Flagship damage, Ticks on five types", () => {
    const s = run(56, "(0,1): B_01 > fd. (1,0): S_01 > fd. (1,1): G_05 > fd. (0,2): P_12 > fd. (-1,0): M_01 > fd.", [A.split({ bay1: 1, bay2: 0, bay3: 0 })]);
    expect(s.flagship).toEqual([5, 6, 6]);
    for (const k of ["0,1", "1,0", "1,1", "0,2", "-1,0"]) expect(tokensAt(s, k)).toBe("[TICK]");
  });
  m(57, "Graviton Mine: Ticks and Boosts on every Sentinel", () => expect(tokensAt(run(57, "(0,1): S_01 > fd.", [A.option("s")]), "0,1")).toBe("[S1][TICK]"));
  m(58, "Ion Mine: remove every Barrier from every Sentinel", () => expect(tokensAt(run(58, "(0,1): S_01[BAR] > fd.", [A.option("bar")]), "0,1")).toBe(""));
  m(59, "Trojan Patch: Tick, then remove 1 Damage", () => expect(tokensAt(run(59, "(0,1): B_02[D1] > fd."), "0,1")).toBe("[TICK]"));
  m(60, "Tiered Minefield: Ticks on Level 1, Boost Level 2", () => {
    const s = run(60, "(0,1): B_01 > fd. (1,0): B_02 > fd.");
    expect(tokensAt(s, "0,1")).toBe("[TICK]");
    expect(tokensAt(s, "1,0")).toBe("[S1]");
  });
  m(61, "Trap Line: Boost and Tick a row", () => expect(tokensAt(run(61, "(0,1): B_01 > fd.", [A.option("1")]), "0,1")).toBe("[S1][TICK]"));
  m(62, "Proton Trap: the type with the fewest units", () => {
    const s = run(62, "(0,1): B_01 > fd. (1,0): B_01 > fd. (1,1): G_05 > fd.");
    expect(tokensAt(s, "1,1")).toBe("[S1][TICK]");
  });
  m(63, "Harmonic Trap: every unit of the chosen unit's Level", () => {
    const g = "(0,1): B_02 > fd. (1,0): G_01 > fd. (1,1): B_01 > fd.";
    const s = run(63, g, [A.units(u(board(g), "0,1"))]);
    expect(tokensAt(s, "0,1")).toBe("[S1][TICK]");
    expect(tokensAt(s, "1,0")).toBe("[S1][TICK]");
    expect(tokensAt(s, "1,1")).toBe("");
  });
  m(64, "Power Relay: 1 energy on each of five other ready Modules", () => {
    const s = run(64, "", [], { others: [[26, true], [21, false], [1, true]] });
    expect(s.player.modules.map((x) => x.energy.Red + x.energy.Yellow)).toEqual([0, 1, 0, 1]);
  });
  m(65, "Salvage Siphon: energy per Bot on the chosen Module; other Modules lose theirs (Q6)", () => {
    const s = run(65, "(0,1): B_01 > fd.", [], { others: [[26, true], [21, false, { Yellow: 1 }]] });
    expect(s.player.modules[1]!.energy.Red).toBe(1);
    expect(s.player.modules[2]!.energy.Yellow).toBe(0);
  });
  m(66, "Deep Scan Probe: may put the top tile at the bottom", () => {
    const s = run(66, "(0,1): fd:B_01 > fd:G_05.", [A.yes()]);
    expect(tile(s, s.field["0,1"]![0]!).unitId).toBe("B_01");
    expect(sectorState(s, "0,1")).toBe("dark");
  });
  m(67, "Harvest Beacon: energy per Sentinel on another Module, then an Overload", () => {
    const s = run(67, "(0,1): S_01 > fd.", [], { others: [[26, true]] });
    expect(s.player.modules[1]!.energy.Red).toBe(1);
    expect(s.phase).toBe("overload");
  });
  m(68, "Tractor Beam: swap two units, ready another Module", () => {
    const g = "(0,1): B_01 > fd. (1,0): B_02 > fd.";
    const b = board(g);
    const s = run(68, g, [], { others: [[2, false]] });
    expect(at(s, "1,0")).toBe(u(b, "0,1"));
    expect(s.player.modules[1]!.ready).toBe(true);
  });
  m(69, "Strata Shifter: move the top tiles onto an adjacent Dark sector", () => {
    const s = run(69, "(0,1): fd:B_01 > fd:B_02 > fd. (0,2): fd.", [A.sectors("0,1"), A.amount(2)]);
    expect(s.field["0,2"]!.map((t) => s.tiles[t]!.unitId)).toEqual([null, "B_02", "B_01"]);
    expect(s.field["0,1"]).toHaveLength(1);
  });
  m(70, "Core Drill: bottom tile to the top, then Reveal it", () => {
    const s = run(70, "(0,1): fd:B_01 > fd:G_05 > fd:B_02.", [A.yes()]);
    expect(tile(s, at(s, "0,1")).unitId).toBe("B_02");
  });
  m(71, "Gravity Well: top tiles of up to five Dark sectors onto one, then repair 1", () => {
    const s0 = setup(71, "Flagship 6/6/5. (0,1): fd:B_01 > fd. (1,0): fd:B_02 > fd. (1,1): fd.");
    tested.add(71);
    const [b01, b02] = ["0,1", "1,0"].map((k) => s0.field[k]!.at(-1)!);
    const s = play(s0, (c) => commandStep(c), [A.option("runModule"), A.sectors("0,1", "1,0"), A.sectors("1,1"), A.option(b02!)]).state;
    expect(s.field["1,1"]!.slice(-2)).toEqual([b02, b01]);
    expect(s.flagship).toEqual([6, 6, 6]);
  });
  m(72, "Seismic Sonar: look at bottom tiles, then an Overload", () => {
    const s = run(72, "(0,1): B_01 > fd. (1,0): B_01 > fd.", [A.sectors("0,1")], { others: [[2, false]] });
    expect(s.phase).toBe("overload");
    expect(s.seen).toEqual(expect.arrayContaining([s.field["0,1"]![0], s.field["1,0"]![0]]));
  });
  m(73, "Damage Control: 1 damage off each of two Bays", () => expect(run(73, "Flagship 5/5/5.", [A.option("0,1")]).flagship).toEqual([6, 6, 5]));
  m(74, "Repair Field: 1 Damage off every unit and 1 off the Flagship", () => {
    const s = run(74, "Flagship 6/6/5. (0,1): B_02[D1] > fd.");
    expect(tokensAt(s, "0,1")).toBe("");
    expect(s.flagship).toEqual([6, 6, 6]);
  });
  m(75, "Quantum Reformation: repair per two Sentinels, then an Overload", () => {
    const s = run(75, "Flagship 6/6/5. (0,1): S_01 > fd. (1,0): S_01 > fd.");
    expect(s.flagship).toEqual([6, 6, 6]);
    expect(s.phase).toBe("overload");
  });
  m(76, "EMP Burst: every Damage, Barrier and Fuse token removed", () => {
    const s = run(76, "(0,1): B_02[D1][TICK] > fd. (1,0): S_01[BAR] > fd.");
    expect(tokensAt(s, "0,1")).toBe("");
    expect(tokensAt(s, "1,0")).toBe("");
    expect(s.supply.tick).toBe(10);
  });
});

describe("coverage", () => {
  it("every Module has a card test (1 and 26 are in cards.test.ts)", () => {
    const missing = data()
      .modules.modules.map((x) => x.id)
      .filter((id) => !tested.has(id) && id !== 1 && id !== 26);
    expect(missing).toEqual([]);
  });
});
