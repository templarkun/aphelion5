// The Campaign editor's mission playtest (designer 2026-11-27): the draft played as a Campaign, one
// mission, block effects played by the general block program, text effects programmed or skipped,
// the editor's events played, nothing recorded.
import { expect, test } from "vitest";
import { newRng } from "../../src/engine/rng.js";
import { playAnswer, startGame, type Game } from "../../src/engine/save.js";
import { emptyProfile } from "../../src/engine/state.js";
import type { GameData } from "../../src/data/index.js";
import { draftFromCampaign, newStep, placeableUnits, type Draft, type Step } from "../../src/web/briefing/editor/model.js";
import { playtestOf } from "../../src/web/briefing/editor/playtest.js";
import { randomAnswer } from "./campaignFuzz.js";
import { data } from "./helpers.js";

function c1Draft(): Draft {
  return draftFromCampaign(data().campaigns[0]!);
}

function play(pd: GameData, mission: string, seed: number, points = 0, steps = 4000): Game {
  const r = newRng(seed * 13 + 5);
  let g = startGame(pd, { seed, date: "2026-11-27", profile: emptyProfile(), developerMode: true, autoAnswer: true, playtest: { mission, points } });
  for (let n = 0; n < steps && g.view.status === "question"; n++) {
    const q = g.view.question;
    let a = randomAnswer(r, q);
    for (let k = 0; k < 30 && a.kind === "option" && (a.value === "concede" || a.value === "devWin"); k++) a = randomAnswer(r, q);
    if (q.kind === "option" && q.options.some((o) => o.id === "devWin") && n > 1500) a = { kind: "option", value: "devWin" };
    const res = playAnswer(pd, g, a);
    if (res.result.status === "illegal" || res.result.status === "blocked") continue;
    g = res.game;
  }
  return g;
}

test("no Bots in the palette (designer 2026-11-27)", () => {
  expect(placeableUnits(data()).some((u) => u.type === "Bot")).toBe(false);
});

test("Campaign 1 through the editor: its text effects play as programmed, its chosen mission is the one played", () => {
  const d = c1Draft();
  const m = d.missions.find((x) => x.number === 3)!;
  const pt = playtestOf(data(), d, m);
  expect(pt.skipped).toEqual([]);
  expect(pt.programmed.length).toBeGreaterThan(3);
  expect(pt.campaign.play!.orders["C1_ORDER_1"]).toEqual({ kind: "programmed", id: "C1_ORDER_1" });
  expect(pt.campaign.play!.omega["O_02"]!.atOverload).toEqual({ kind: "programmed", id: "O_02" });
  const g = play(pt.data, pt.mission, 1);
  const s = g.view.state;
  expect(s.mission).toBe(pt.mission);
  expect(s.ending).toBeDefined();
  expect(s.run.completed.length).toBeLessThanOrEqual(1);
  // Nothing recorded: no history, no high score.
  expect(s.profile.history ?? []).toEqual([]);
  expect(s.profile.highScores).toEqual({});
});

test("a won playtest mission ends the game at once: no Upgrade sheet, no next mission", () => {
  const d = c1Draft();
  const pt = playtestOf(data(), d, d.missions[0]!);
  const g = play(pt.data, pt.mission, 2, 0, 6000);
  const s = g.view.state;
  if (s.outcome?.result === "won") {
    expect(s.run.completed.map((x) => x.mission)).toEqual([pt.mission]);
    expect(s.log.some((e) => /^Upgrade/.test(e.text))).toBe(false);
  }
  expect(s.phase === "gameEnd" || s.ending !== undefined).toBe(true);
});

test("text effects the game does not know are skipped and listed", () => {
  const d = c1Draft();
  d.orders.push({ tokens: 1, overloadOnly: false, effect: { mode: "text", text: "Summon a dragon." } });
  d.omega[0]!.destroyed = { mode: "text", text: "Something new happens." };
  const pt = playtestOf(data(), d, d.missions[0]!);
  expect(pt.skipped).toEqual([`Campaign Order ${d.orders.length}: Summon a dragon.`, "O_01 Destroyed: Something new happens."]);
  expect(pt.campaign.play!.orders[`C1_ORDER_${d.orders.length}`]!.kind).toBe("skip");
});

test("Upgrade points spent before the mission (designer 2026-11-27)", () => {
  const d = c1Draft();
  const pt = playtestOf(data(), d, d.missions[1]!);
  let g = startGame(pt.data, { seed: 3, date: "2026-11-27", profile: emptyProfile(), developerMode: true, autoAnswer: true, playtest: { mission: pt.mission, points: 3 } });
  let asked = 0;
  for (let n = 0; n < 40 && g.view.status === "question"; n++) {
    const q = g.view.question;
    if (q.upgrade && q.kind === "option") {
      asked++;
      g = playAnswer(pt.data, g, { kind: "option", value: q.options[0]!.id }).game;
      continue;
    }
    if (/Threat columns/.test(q.prompt)) break;
    g = playAnswer(pt.data, g, randomAnswer(newRng(n), q)).game;
  }
  expect(asked).toBe(3);
  expect(Object.values(g.view.state.sheet.marks).reduce((a, b) => a + b, 0)).toBe(3);
});

const every = (verb: Step["verb"], p: Partial<Step> = {}): Step => ({ ...newStep(verb), ...p });

test("every block plays in random games without breaking (Orders and Omega effects, the new events)", () => {
  const d = c1Draft();
  const T = (count: Step["target"]["count"], kind: Step["target"]["kind"] = "unit", where: Step["target"]["where"] = "") => ({ count, kind, other: false, level: 0, state: "" as const, where });
  d.orders = [
    { tokens: 1, overloadOnly: false, effect: { mode: "blocks", steps: [every("damage", { n: 2, target: T("one", "non-Mecha unit") }), every("gainCommand", { n: 1 })] } },
    { tokens: 1, overloadOnly: false, effect: { mode: "blocks", steps: [every("boost", { target: T(2, "Bot") }), every("place", { token: "Tick", target: T("one", "Sentinel") })] } },
    { tokens: 1, overloadOnly: true, effect: { mode: "blocks", steps: [every("swap", { target: T("one", "Mecha") }), every("teleport", { target: T("one", "Bot") })] } },
    { tokens: 2, overloadOnly: false, effect: { mode: "blocks", steps: [every("damage", { target: T("all", "Gyro", "rowChoice") }), every("gainEnergy", { n: 2, colour: "" })] } },
  ];
  d.omega[0]!.destroyed = { mode: "blocks", steps: [every("damage", { target: T("all", "unit", "adjacent") }), every("place", { token: "Shield", target: T("this") })] };
  d.omega[1]!.atOverload = { mode: "blocks", steps: [every("flagshipDamage", { n: 1 }), every("destroy", { target: T("one", "Alpha unit") })] };
  d.omega[2]!.atOverload = { mode: "blocks", when: { adjacentTo: "Alpha unit" }, steps: [every("loseEnergy", { n: 1, colour: "Red" }), every("boost", { target: T("all", "unit", "rowThrough") })] };
  for (const m of d.missions) m.event = { type: "take_anomaly", amount: 2 };
  d.missions[1]!.event = { type: "gain_energy", any: 1, energy: { Yellow: 1, Red: 0, Blue: 2 } };
  d.missions[2]!.event = { type: "take_modules", amount: 2 };
  d.missions[3]!.event = { type: "remove_damage", amount: 2 };
  let ran = 0;
  let answers = 0;
  for (const [i, m] of d.missions.entries()) {
    const pt = playtestOf(data(), d, m);
    expect(pt.skipped).toEqual([]);
    const g = play(pt.data, pt.mission, 10 + i, i % 3);
    expect(g.view.state.mission).toBe(pt.mission);
    ran += g.view.state.log.filter((e) => /^C1_ORDER_\d|^O_0\d/.test(e.rule ?? "")).length;
    answers += g.answers.length;
  }
  expect(ran).toBeGreaterThan(40);
  expect(answers).toBeGreaterThan(1000);
}, 60_000);

test("the new events: set colours and a choice, N Modules, N Anomaly cards", () => {
  const d = c1Draft();
  const m = d.missions[0]!;
  const run = (e: Draft["missions"][number]["event"]) => {
    m.event = e;
    const pt = playtestOf(data(), d, m);
    let g = startGame(pt.data, { seed: 5, date: "2026-11-27", profile: emptyProfile(), developerMode: true, autoAnswer: true, playtest: { mission: pt.mission, points: 0 } });
    let before: { mods: number; anomalies: number; Y: number; R: number; B: number } | undefined;
    for (let n = 0; n < 60 && g.view.status === "question"; n++) {
      const q = g.view.question;
      if (g.view.state.phase === "command") break;
      if (q.prompt.startsWith("Draw a Module")) {
        const s = g.view.state;
        before = { mods: s.player.modules.length + 1, anomalies: s.player.anomalies.length + 1, ...{ Y: s.player.reserve.Yellow, R: s.player.reserve.Red, B: s.player.reserve.Blue } };
      }
      g = playAnswer(pt.data, g, randomAnswer(newRng(n + 1), q)).game;
    }
    return { s: g.view.state, before: before! };
  };
  const a = run({ type: "take_anomaly", amount: 2 });
  expect(a.s.player.anomalies.length).toBe(a.before.anomalies + 2);
  const b = run({ type: "take_modules", amount: 2 });
  expect(b.s.player.modules.length).toBe(b.before.mods + 2);
  const e = run({ type: "gain_energy", any: 0, energy: { Yellow: 1, Red: 0, Blue: 2 } });
  expect(e.s.player.reserve.Yellow).toBe(e.before.Y + 1);
  expect(e.s.player.reserve.Blue).toBe(e.before.B + 2);
});
