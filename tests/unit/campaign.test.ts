/** Stage 7: tests/batch7.txt (DRAFT, awaiting the designer) and batch 1 T_HEAT_01. */

import { describe, expect, it } from "vitest";
import { canMark, company, extraTileSectors, newGame, nextMissions, score } from "../../src/engine/campaign.js";
import { commandStep, legalActions } from "../../src/engine/command.js";
import { startRoot, replay } from "../../src/engine/effect.js";
import { sectorKeys } from "../../src/engine/field.js";
import { meltdown } from "../../src/engine/heat.js";
import { mechaAbilities } from "../../src/engine/mecha.js";
import { overloadEnd, overloadMenu } from "../../src/engine/overload.js";
import type { Answer, Question } from "../../src/engine/questions.js";
import { canUndo, playAnswer, readSave, replayGame, startGame, toSave, undo, upgradeSlots } from "../../src/engine/save.js";
import { addTile } from "../../src/engine/scenario.js";
import { type SessionView, answerSession, startSession } from "../../src/engine/session.js";
import { type GameState, type Phase, type Profile, emptyProfile } from "../../src/engine/state.js";
import { newRng } from "../../src/engine/rng.js";
import { A, at, ctx, data, given, play, tokensAt, withModules } from "./helpers.js";
import { randomAnswer, randomCampaign } from "./campaignFuzz.js";

type Step = Answer | ((q: Question, s: GameState) => Answer);

/** A neutral answer: the first options, the least amounts, "no". */
function plain(q: Question): Answer {
  switch (q.kind) {
    case "units":
      return { kind: "units", value: q.options.slice(0, q.min) };
    case "sectors":
      return { kind: "sectors", value: q.options.slice(0, q.min) };
    case "several":
      return { kind: "several", value: q.options.slice(0, q.min).map((o) => o.id) };
    case "option":
      return { kind: "option", value: q.options[0]!.id };
    case "order":
      return { kind: "order", value: q.options[0]!.id };
    case "amount":
      return { kind: "amount", value: q.min };
    case "yesno":
      return { kind: "yesno", value: false };
    case "split": {
      const value: Record<string, number> = {};
      let left = q.total;
      for (const b of q.buckets) {
        value[b.id] = Math.min(b.max, left);
        left -= value[b.id]!;
      }
      return { kind: "split", value };
    }
  }
}

/** Play a session: scripted steps first, then plain answers, until a stop phase. */
function go(state: GameState, steps: Step[], stopAt: Phase[] = ["command"]): SessionView {
  let v = startSession(data(), state, { stopAt });
  for (const st of steps) {
    if (v.status !== "question") throw new Error(`no question for step ${JSON.stringify(st)}`);
    const a = typeof st === "function" ? st(v.question, v.state) : st;
    const r = answerSession(data(), v, a);
    if (r.status === "illegal" || r.status === "blocked") throw new Error(`${r.status}: ${r.reason} (${v.question.prompt})`);
    v = r;
  }
  for (let n = 0; v.status === "question" && n < 200; n++) {
    const r = answerSession(data(), v, plain(v.question));
    if (r.status === "illegal" || r.status === "blocked") throw new Error(`${r.status}: ${r.reason}`);
    v = r;
  }
  return v;
}

const fresh = (profile: Profile = emptyProfile(), seed = 7) => newGame(data(), { seed, date: "2026-11-04", profile });
// Campaign (always asked), Company, expansion modules (none, or the Heat module).
const setupV1 = (heat = false): Step[] => [A.option("C1"), A.option("V1"), heat ? several("heat") : several()];
const onField = (s: GameState) => sectorKeys(s).reduce((n, k) => n + s.field[k]!.length, 0);
const first = (q: Question): Answer => plain(q);
const several = (...ids: string[]): Answer => ({ kind: "several", value: ids });

describe("batch 7 - GAME SETUP (7.1)", () => {
  it("T7_SET_01 a new game: Fresh with an unmarked sheet, starting resources", () => {
    const v = go(fresh(), setupV1(), ["preparation"]);
    const s = v.state;
    expect(s.run.freshness).toBe("fresh");
    expect(s.player.reserve).toEqual({ Yellow: 6, Red: 6, Blue: 6 });
    expect(s.piles.missionDeck).toHaveLength(30 + 27);
    expect(s.piles.energyDeck).toHaveLength(42);
    expect(s.player.anomalies).toHaveLength(3);
    expect(s.player.modules).toHaveLength(6);
    for (const col of ["Yellow", "Red", "Blue"]) expect(s.player.modules.filter((m) => data().modules.byId.get(m.id)!.colour === col)).toHaveLength(2);
    expect(s.decks.modules).toHaveLength(72);
    expect(s.phase).toBe("preparation");
  });

  it("the Flare energy trial rule is always on in new games, off the expansion list (designer 2026-11-09)", () => {
    const s = go(fresh(), setupV1(), ["preparation"]).state;
    expect(s.settings.trialFlareEnergy).toBe(true);
    const old = go(newGame(data(), { seed: 7, date: "2026-11-04", flareEnergyChoice: true }), setupV1(), ["preparation"]).state;
    expect(old.settings.trialFlareEnergy).toBe(false);
  });

  it("T7_SET_02 Veteran keeps the marks; Fresh erases only this Company's marks", () => {
    const profile: Profile = { sheets: { V1: { V1_M02_U1: 2, V1_M04_U2: 3 }, V2: { V2_P1: 2 } }, highScores: {} };
    const vet = go(fresh(profile), [A.option("C1"), A.option("V1"), A.option("veteran"), several()], ["preparation"]).state;
    expect(vet.sheet.filled).toEqual(["V1_M02_U1"]);
    expect(vet.sheet.marks.V1_M04_U2).toBe(3);
    expect(vet.sheet.overhaulUsed).toBe(0);
    const fr = go(fresh(profile), [A.option("C1"), A.option("V1"), A.option("fresh"), several()], ["preparation"]).state;
    expect(fr.sheet.filled).toEqual([]);
    expect(fr.profile.sheets.V1).toEqual({});
    expect(fr.profile.sheets.V2).toEqual({ V2_P1: 2 });
  });
});

describe("batch 7 - MISSION PREPARATION (7.2) and ALLIED DROP (7.3)", () => {
  it("T7_PRP_01 Mission 1: Threat columns, dealing, a Module, an Allied Drop", () => {
    const v = go(fresh(), [...setupV1(), several("A", "C")]);
    const s = v.state;
    expect(s.phase).toBe("command");
    expect(s.run.threat).toEqual(["A", "C"]);
    expect(onField(s)).toBe(90 + 1); // 90 dealt + the Allied M_05
    expect(sectorKeys(s).filter((k) => s.field[k]!.length === 10)).toHaveLength(1);
    expect(s.player.modules).toHaveLength(7);
    expect(s.decks.modules).toHaveLength(71);
    expect(s.player.commandTokens).toBe(6);
    expect(s.player.anomalies).toHaveLength(4);
    expect(s.sheet.ally).toBe("V2");
    const allied = sectorKeys(s).map((k) => s.field[k]!.at(-1)!).filter((t) => s.tiles[t]!.faceUp);
    expect(allied.map((t) => s.tiles[t]!.unitId)).toEqual(["M_05"]);
  });

  it("T7_PRP_02 uneven dealing: extra tiles go to (0,0), (0,1), then to random sectors", () => {
    const prompts: string[] = [];
    const v = go(fresh(), [...setupV1(), several("A"), (q) => (prompts.push(q.prompt), plain(q))]);
    expect(prompts.join(" ")).not.toMatch(/extra tile/);
    const s = v.state;
    const dealt = (k: string) => s.field[k]!.filter((t) => !s.tiles[t]!.faceUp).length;
    expect(dealt("0,0")).toBe(9);
    expect(dealt("0,1")).toBe(9);
    expect(sectorKeys(s).filter((k) => dealt(k) === 9)).toHaveLength(6);
    expect(sectorKeys(s).filter((k) => dealt(k) === 8)).toHaveLength(sectorKeys(s).length - 6);
    expect(onField(s)).toBe(86 + 1);
  });

  it("T_SET_01 (batch 1, changed) M3: 84 tiles on 9 sectors: (0,0), (0,1) and one random sector get a 10th", () => {
    const s = fresh();
    const targets = ["0,0", "1,0", "0,1", "1,1", "-1,1", "-1,2", "1,-1", "-1,0", "0,2"];
    const ex = extraTileSectors(s, targets, 84 - 9 * 9);
    expect(ex.slice(0, 2)).toEqual(["0,0", "0,1"]);
    expect(ex).toHaveLength(3);
    expect(new Set(ex).size).toBe(3);
    expect(targets).toContain(ex[2]);
    // An Omega on (0,0): it gets no dealt tiles, so (0,1) comes first.
    expect(extraTileSectors(fresh(), targets.filter((k) => k !== "0,0"), 2)[0]).toBe("0,1");
  });

  it("T7_PRP_02b the random extra sectors follow the seed", () => {
    const pick = (seed: number) => {
      const s = go(fresh(emptyProfile(), seed), [...setupV1(), several("A")]).state;
      return sectorKeys(s).filter((k) => s.field[k]!.filter((t) => !s.tiles[t]!.faceUp).length === 9);
    };
    expect(pick(7)).toEqual(pick(7));
    const seen = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((n) => pick(n).join(" ")));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("T7_PRP_03 a tile with no copy left adds nothing", () => {
    const s0 = fresh();
    const s12 = s0.piles.supply.filter((t) => s0.tiles[t]!.unitId === "S_12");
    s0.piles.supply = s0.piles.supply.filter((t) => !s12.includes(t));
    s0.piles.discard.push(...s12); // in use elsewhere
    const v = go(s0, [...setupV1(), several("A", "C"), first]);
    expect(onField(v.state)).toBe(57 + 25 + 4 + 1);
    expect(v.state.log.some((e) => /no S_12 left/.test(e.text))).toBe(true);
    expect(v.state.run.threat).toEqual(["A", "C"]);
  });

  it("T7_PRP_04 Mission 2 offers both routes; the other is skipped", () => {
    const s = go(fresh(), setupV1(), ["preparation"]).state;
    s.run.completed = [{ mission: "C1_M1", threat: ["A"] }];
    expect(nextMissions(ctx(s)).map((m) => m.id)).toEqual(["C1_M2X", "C1_M2Y"]);
    const v = go(s, [A.option("C1_M2Y")]);
    expect(v.state.mission).toBe("C1_M2Y");
    expect(v.state.run.skipped).toEqual(["C1_M2X"]);
    v.state.run.completed.push({ mission: "C1_M2Y", threat: ["A"] });
    expect(nextMissions(ctx(v.state)).map((m) => m.id)).toEqual(["C1_M3"]);
  });

  it("T7_PRP_05 Omega units placed by the mission card hold no dealt tiles", () => {
    const s = go(fresh(), setupV1(), ["preparation"]).state;
    s.run.completed = [{ mission: "C1_M1", threat: ["A"] }, { mission: "C1_M2X", threat: ["A"] }];
    s.sheet.ally = "V2";
    const v = go(s, []);
    for (const k of ["0,-1", "1,2", "-1,3"]) {
      expect(v.state.field[k]!.map((t) => v.state.tiles[t]!.unitId)[0]).toBe("O_02");
      expect(v.state.field[k]!.filter((t) => v.state.tiles[t]!.unitId !== "M_05")).toHaveLength(1);
    }
  });

  it("T7_ALD_01 a Mecha your Company does not list uses the Ally's sheet", () => {
    const profile: Profile = { sheets: { V2: { V2_M1: 4, V2_M1A: 5 } }, highScores: {} };
    const s = go(fresh(profile), setupV1(), ["preparation"]).state;
    s.run.completed = [{ mission: "C1_M1", threat: ["A"] }, { mission: "C1_M2X", threat: ["A"] }];
    s.sheet.ally = "V2";
    let offered: string[] = [];
    const v = go(s, [several("A"), first, (q) => ((offered = q.kind === "option" ? q.options.map((o) => o.id) : []), A.option("M_07"))]);
    expect(offered).toEqual(["M_05", "M_03", "M_07"]);
    const m07 = sectorKeys(v.state).map((k) => v.state.field[k]!.at(-1)!).find((t) => v.state.tiles[t]!.unitId === "M_07" && v.state.tiles[t]!.faceUp)!;
    expect(mechaAbilities(ctx(v.state), m07).map((a) => a.id)).toContain("V2_M1A");
  });
});

describe("batch 7 - MISSION END (10.1) and UPGRADES (10.2)", () => {
  /** One answer per Upgrade point (Upgrade sheet, 2026-11-09). */
  const times = (id: string, n: number) => Array.from({ length: n }, () => A.option(id));
  function ending(id: string, extra = ""): GameState {
    const s = given(id, extra);
    s.phase = "missionEnd";
    return s;
  }
  /** Run the "missionEnd" root with scripted answers. */
  function runEnd(s: GameState, answers: Answer[]): GameState {
    const r = replay(data(), { ...startRoot(s, "missionEnd"), answers });
    if (r.status !== "done") throw new Error(`Mission End did not finish: ${r.status === "question" ? r.question.prompt : r.reason}`);
    return r.state;
  }

  it("T7_END_01 Mission End sorts every pile", () => {
    const s = withModules(ending("T7_END_01"), [[26, false, { Red: 2 }]]);
    for (const u of ["B_01", "M_01", "G_05", "S_12", "F_04"]) s.piles.discard.push(addTile(s, u, true));
    expect(s.flagship).toEqual([4, 6, 5]);
    const after = runEnd(s, [A.option("done"), A.yes()]);
    expect(after.flagship).toEqual([5, 6, 6]);
    expect(after.sheet.upgradePoints).toBe(0);
    expect(after.piles.trophy).toEqual([]);
    expect(after.piles.discard).toEqual([]);
    const ids = (p: string[]) => p.map((t) => after.tiles[t]!.unitId);
    expect(ids(after.piles.missionDeck)).toEqual(expect.arrayContaining(["B_01", "M_01", "B_02", "S_01"]));
    expect(ids(after.piles.energyDeck).at(-1)).toBe("G_05");
    expect(ids(after.piles.supply)).toEqual(expect.arrayContaining(["S_12", "F_04", "F_01", "O_01"]));
    expect(sectorKeys(after).every((k) => after.field[k]!.length === 0)).toBe(true);
    expect(after.supply.barrier).toBe(10);
    expect(after.player.commandTokens).toBe(0);
    expect(after.player.modules[0]).toMatchObject({ ready: true, energy: { Red: 0 } });
    expect(after.run.completed).toEqual([{ mission: "C1_M1", threat: [] }]);
    expect(after.phase).toBe("preparation");
  });

  it("T7_UPG_02 Done with points left: a warning you must agree to", () => {
    const s = ending("T7_UPG_02");
    const r = replay(data(), { ...startRoot(s, "missionEnd"), answers: [A.option("done")] });
    expect(r.status === "question" && r.question).toMatchObject({ kind: "yesno", prompt: expect.stringMatching(/2 Upgrade points.*lost/) });
    // No: back to the upgrade menu; then mark 2 slots and nothing is lost.
    const after = runEnd(s, [A.option("done"), A.no(), A.option("V1_M02_U1"), A.option("V1_M02_U1")]);
    expect(after.sheet.filled).toContain("V1_M02_U1");
    expect(after.sheet.upgradePoints).toBe(0);
  });

  it("T7_UPG_03 one point per answer; old saves' slot counts become answers", () => {
    const s = ending("T7_UPG_01");
    const r = replay(data(), { ...startRoot(s, "missionEnd"), answers: [A.option("V1_M04_U2")] });
    const q = r.status === "question" ? r.question : undefined;
    expect(q).toMatchObject({ kind: "option", upgrade: true, prompt: expect.stringMatching(/8 Upgrade points/) });
    // An old save answered "V1_M04_U2", then "mark how many slots? 5".
    const parts: Answer[] = [A.amount(5)];
    upgradeSlots(q, A.amount(5), [A.option("V1_M04_U2")], parts);
    expect(parts).toEqual(times("V1_M04_U2", 4));
  });

  it("T7_UPG_01 partial marks, locked, exclusive, Requisitions", () => {
    const s = ending("T7_UPG_01");
    const after = runEnd(s, [...times("V1_M04_U2", 5), ...times("V1_M04_U2A", 3), A.option("V1_T1")]);
    expect(after.sheet.marks).toMatchObject({ V1_M04_U2: 5, V1_M04_U2A: 3, V1_T1: 1 });
    expect(after.sheet.filled).toContain("V1_M04_U2");
    const c = ctx(after);
    const u2b = company(c).upgrades.find((u) => u.id === "V1_M04_U2B")!;
    expect(canMark(c, u2b)).toBe(false);
    expect(after.profile.sheets.V1).toMatchObject({ V1_T1: 1 });
    // Locked before its unlocker is filled.
    expect(canMark(ctx(ending("T7_UPG_01")), u2b)).toBe(false);
    // Variant: a Repeatable Requisition fully filled.
    const v = runEnd(ending("T7_UPG_01", "Trophy pile: 10 F_01"), [...times("V1_M04_U2", 5), ...times("V1_T1", 2), A.option("done"), A.yes()]);
    expect(v.player.reserve.Yellow).toBe(1);
    expect(v.sheet.marks.V1_T1).toBe(0);
  });
});

describe("batch 7 - GAME END AND SCORING (10.3)", () => {
  const completed = [
    { mission: "C1_M1", threat: ["A", "C"] },
    { mission: "C1_M2Y", threat: ["A"] },
    { mission: "C1_M3", threat: ["A", "B", "C", "D"] },
    { mission: "C1_M4X", threat: ["B"] },
    { mission: "C1_M5", threat: ["A"] },
    { mission: "C1_M6", threat: ["A"] },
    { mission: "C1_M7", threat: ["A", "B"] },
  ];
  it("T7_SCO_01 score: Threat columns, +5 for the campaign, Heat -2", () => {
    const s = given("T7_SCO_01");
    s.settings.heatModule = true;
    s.run.completed = completed;
    s.outcome = { result: "won", reason: "" };
    expect(score(ctx(s)).score).toBe(15);
    s.run.completed = completed.slice(0, 3);
    s.outcome = { result: "lost", reason: "" };
    expect(score(ctx(s)).score).toBe(5);
  });

  it("T7_SCO_02 high score fields; equal writes; never in Developer mode", () => {
    const end = (freshness: "fresh" | "veteran", completedN: number, dev = false) => {
      const s = given("T7_SCO_02");
      s.profile.highScores.C1 = { fresh: { score: 10, date: "2026-01-01" } };
      s.run = { freshness, completed: completed.slice(0, completedN), skipped: [], threat: [], date: "2026-11-04" };
      s.settings.developerMode = dev;
      s.sheet.marks = { V1_M02_U1: 2 };
      s.sheet.ally = "V2";
      s.sheet.overhaulUsed = 1;
      s.outcome = { result: "lost", reason: "" };
      s.phase = "gameEnd";
      const r = replay(data(), startRoot(s, "gameEnd"));
      if (r.status !== "done") throw new Error("gameEnd asked something");
      return r.state;
    };
    const a = end("fresh", 4); // 2 + 1 + 4 + 1 = 8
    expect(a.ending!.score).toBe(8);
    expect(a.profile.highScores.C1!.fresh!.score).toBe(10);
    const b = end("fresh", 5); // 9
    expect(b.profile.highScores.C1!.fresh).toEqual({ score: 10, date: "2026-01-01" });
    const eq = end("fresh", 6); // 10: equal writes the new date
    expect(eq.profile.highScores.C1!.fresh).toEqual({ score: 10, date: "2026-11-04" });
    expect(eq.ending!.highScore).toBe("fresh");
    const vet = end("veteran", 1);
    expect(vet.profile.highScores.C1!.veteran).toEqual({ score: 2, date: "2026-11-04" });
    const dev = end("fresh", 7, true);
    expect(dev.profile.highScores.C1!.fresh!.date).toBe("2026-01-01");
    expect(dev.profile.sheets.V1).toEqual({ V1_M02_U1: 2 });
    expect(dev.sheet.ally).toBeUndefined();
    expect(dev.sheet.overhaulUsed).toBe(0);
  });
});

describe("batch 7 - SAVING AND UNDO", () => {
  it("T7_SAV_01 a saved game replays to the same state", () => {
    const start = { seed: 7, date: "2026-11-04", developerMode: false, profile: emptyProfile() };
    let g = startGame(data(), start);
    const r = newRng(99);
    for (let i = 0; i < 40 && g.view.status === "question"; i++) {
      let a = randomAnswer(r, g.view.question);
      for (let k = 0; k < 30 && a.kind === "option" && a.value === "concede"; k++) a = randomAnswer(r, g.view.question);
      const res = playAnswer(data(), g, a);
      g = res.game;
    }
    const file = readSave(JSON.stringify(toSave(g, emptyProfile())));
    const back = replayGame(data(), file.game!.start, file.game!.answers);
    expect(back.view.state).toEqual(g.view.state);
    expect(back.view.status === "question" && g.view.status === "question" && back.view.question).toEqual(g.view.status === "question" ? g.view.question : undefined);
  });

  it("T7_SAV_02 undo stops at new hidden information", () => {
    const start = { seed: 7, date: "2026-11-04", developerMode: false, profile: emptyProfile() };
    // Setup and Mission 1 preparation with plain answers.
    let g = startGame(data(), start);
    for (let i = 0; i < 50 && g.view.status === "question" && g.view.state.phase !== "command"; i++) g = playAnswer(data(), g, plain(g.view.question)).game;
    for (let i = 0; i < 50 && g.view.status === "question" && g.view.state.phase !== "command"; i++) g = playAnswer(data(), g, plain(g.view.question)).game;
    expect(g.view.state.phase).toBe("command");
    const bay = playAnswer(data(), g, A.option("useBay")).game;
    expect(canUndo(data(), bay)).toBe(true);
    expect(undo(data(), bay)!.answers).toEqual(g.answers);
    const rev = playAnswer(data(), g, A.option("reveal")).game;
    const rev2 = rev.view.status === "question" && rev.view.question.kind === "sectors" ? playAnswer(data(), rev, plain(rev.view.question)).game : rev;
    expect(canUndo(data(), rev2)).toBe(false);
    expect(canUndo(data(), { ...rev2, start: { ...start, developerMode: true } })).toBe(true);
  });
});

describe("batch 7 - HEAT MODULE", () => {
  const heat = (id: string, n: number) => {
    const s = given(id);
    s.settings.heatModule = true;
    s.player.heat = n;
    s.supply.heat = 10 - n;
    return s;
  };

  it("T7_HEAT_01 take 10 Heat at Mission Preparation; return it at Mission End", () => {
    const v = go(fresh(), [...setupV1(true), several("A")]);
    expect(v.state.player.heat).toBe(10);
    const s = v.state;
    s.phase = "missionEnd";
    const r = replay(data(), startRoot(s, "missionEnd"));
    expect(r.status).toBe("done");
    if (r.status === "done") {
      expect(r.state.player.heat).toBe(0);
      expect(r.state.supply.heat).toBe(10);
    }
  });

  it("T7_HEAT_02 a revealed Power Node: 3 Heat instead of its energy", () => {
    const s = withModules(heat("T7_HEAT_02", 8), [[26, true]]);
    const after = play(s, (c) => commandStep(c), [A.option("reveal"), A.option("heat")]).state;
    expect(after.player.heat).toBe(10);
    expect(after.player.modules[0]!.energy).toEqual({ Yellow: 0, Red: 0, Blue: 0 });
    expect(after.phase).toBe("overload");
  });

  it("T7_HEAT_03 Heat Wave: pay 1 Heat, 1 damage to a Bot; not with Alerts or in an Overload", () => {
    const s = heat("T7_HEAT_03", 2);
    expect(legalActions(ctx(s))).toContain("heatWave");
    const after = play(s, (c) => commandStep(c), [A.option("heatWave")]).state;
    expect(after.player.heat).toBe(1);
    expect(tokensAt(after, "0,1")).toBe("");
    const al = heat("T7_HEAT_03", 2);
    al.tiles[at(al, "0,1")]!.tokens.alert = true;
    expect(legalActions(ctx(al))).not.toContain("heatWave");
    const ov = heat("T7_HEAT_03", 2);
    ov.phase = "overload";
    expect(overloadMenu(ctx(ov)).map((o) => o.id)).not.toContain("heatWave");
  });

  it("T7_HEAT_04 Overclock: 2 extra energy for 1 Heat, 1 Yellow for 1 more", () => {
    const s = withModules(heat("T7_HEAT_04", 5), [[1, true, { Yellow: 1 }]]);
    s.player.reserve.Yellow = 6;
    s.supply.energy.Yellow = 3;
    const after = play(s, (c) => commandStep(c), [A.option("runModule"), A.yes(), A.yes()]).state; // stored energy is used first, no question
    expect(after.player.heat).toBe(7);
    expect(after.player.reserve.Yellow).toBe(1);
    expect(after.supply.energy.Yellow).toBe(9);
  });

  it("T7_HEAT_05 Meltdown: 1 Heat is paid to avoid it, without a question (designer 2026-11-08); with no Heat it happens", () => {
    const r = play(heat("T7_HEAT_05", 1), (c) => overloadEnd(c));
    expect(r.asked.some((q) => q.rule === "H7")).toBe(false);
    expect(r.state.player.heat).toBe(0);
    expect(r.state.flagship).toEqual([6, 6, 6]);
    expect(r.state.events?.some((e) => e.kind === "heat" && e.rule === "H7")).toBe(true);
    const not = play(heat("T7_HEAT_05", 0), (c) => overloadEnd(c), [A.split({ bay1: 2, bay2: 0, bay3: 0 })]).state;
    expect(not.player.heat).toBe(1);
    expect(not.flagship).toEqual([4, 6, 6]);
    expect(not.events?.some((e) => e.kind === "meltdown" && e.bots === 1)).toBe(true);
  });

  it("T_HEAT_01 (batch 1) Meltdown when you cannot pay", () => {
    const s = given("T_HEAT_01");
    s.settings.heatModule = true;
    const after = play(s, (c) => meltdown(c), [A.split({ bay1: 3, bay2: 0, bay3: 0 })]).state;
    expect(after.field["0,0"]).toEqual([]);
    expect(tokensAt(after, "0,1")).toBe("");
    expect(after.player.heat).toBe(2);
    expect(after.flagship).toEqual([3, 6, 6]);
  });
});

describe("random play-throughs of whole campaigns", () => {
  it("never crash, refuse a legal answer, break an invariant or get stuck", () => {
    const endings = new Map<string, number>();
    let missions = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const r = randomCampaign(data(), seed);
      endings.set(r.ending, (endings.get(r.ending) ?? 0) + 1);
      missions += r.missions;
      expect(r.state.ending).toBeDefined();
    }
    expect(endings.get("won") ?? 0).toBeGreaterThan(2);
    expect(missions).toBeGreaterThan(30);
  }, 120000);
});


describe("saves made with the one-day Alert trial look (2026-11-09)", () => {
  it("replay with the dropped list entry ignored", () => {
    let g = startGame(data(), { seed: 5, date: "2026-11-09", profile: emptyProfile(), developerMode: false, autoAnswer: true });
    const answers: Answer[] = [];
    for (let n = 0; n < 12 && g.view.status === "question"; n++) {
      const q = g.view.question;
      const a: Answer = q.kind === "several" && /expansion/.test(q.prompt) ? { kind: "several", value: ["heat"] } : randomAnswer(newRng(n + 1), q);
      g = playAnswer(data(), g, a).game;
      answers.push(a.kind === "several" && /expansion/.test(q.prompt) ? { kind: "several", value: ["heat", "alertBeacon"] } : a);
    }
    expect(answers.some((a) => a.kind === "several" && a.value.includes("alertBeacon"))).toBe(true);
    const back = replayGame(data(), g.start, answers);
    expect(back.view.state.settings.heatModule).toBe(true);
    expect(back.answers.length).toBe(g.answers.length);
  });
});

describe("Developer tool: win the mission to try the Upgrade sheet (2026-11-09)", () => {
  function toMenu(dev: boolean) {
    let g = startGame(data(), { seed: 3, date: "2026-11-09", profile: emptyProfile(), developerMode: dev, autoAnswer: true });
    const r = newRng(9);
    for (let n = 0; n < 60 && g.view.status === "question" && !/^Choose an action/.test(g.view.question.prompt); n++) g = playAnswer(data(), g, randomAnswer(r, g.view.question)).game;
    return g;
  }
  it("is offered only in Developer mode, and gives 12 points at Mission End", () => {
    const plain = toMenu(false);
    expect(plain.view.status === "question" && plain.view.question.kind === "option" && plain.view.question.options.some((o) => o.id === "devWin")).toBe(false);
    const g = playAnswer(data(), toMenu(true), A.option("devWin")).game;
    expect(g.view.status === "question" && g.view.question).toMatchObject({ upgrade: true, prompt: expect.stringMatching(/12 Upgrade points/) });
    expect(replayGame(data(), g.start, g.answers).view.state.sheet.upgradePoints).toBe(12);
  });
});
