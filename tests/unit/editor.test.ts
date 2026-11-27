// Statistics and achievements (finished games kept in the profile) and the Campaign editor's model
// (designer 2026-11-17/18; screen and data only, no rule).
import { expect, test } from "vitest";
import { parseCampaign, THREAT_COLUMNS } from "../../src/data/campaign.js";
import { newRng } from "../../src/engine/rng.js";
import { playAnswer, startGame, type Game } from "../../src/engine/save.js";
import { emptyProfile, type GameRecord } from "../../src/engine/state.js";
import { newStats } from "../../src/engine/events.js";
import { achievements, counted, totals } from "../../src/web/briefing/stats/records.js";
import {
  campaignFileText,
  campaignPrice,
  checks,
  copiesOf,
  draftFromCampaign,
  effectText,
  freeCopies,
  G00,
  newDraft,
  newStep,
  priceSum,
  rosterOf,
  threatRoster,
  type Step,
} from "../../src/web/briefing/editor/model.js";
import { randomAnswer } from "./campaignFuzz.js";
import { data } from "./helpers.js";

function playToEnd(seed: number, concedeAt?: number, developerMode = true): Game {
  const r = newRng(seed * 7 + 1);
  let g = startGame(data(), { seed, date: "2026-11-18", profile: emptyProfile(), developerMode, autoAnswer: true });
  let wins = 0;
  for (let n = 0; n < 3000 && g.view.status === "question"; n++) {
    const q = g.view.question;
    let a = randomAnswer(r, q);
    if (q.kind === "option" && q.options.some((o) => o.id === "devWin")) {
      a = { kind: "option", value: wins === concedeAt ? "concede" : "devWin" };
      wins++;
    } else if (q.upgrade) a = q.kind === "yesno" ? { kind: "yesno", value: true } : { kind: "option", value: "done" };
    g = playAnswer(data(), g, a).game;
  }
  return g;
}

test("Game End writes the finished game into the profile's history, won or conceded", () => {
  const won = playToEnd(3);
  const s = won.view.state;
  expect(s.ending).toBeDefined();
  expect(s.profile.history?.length).toBe(1);
  const rec = s.profile.history![0]!;
  expect(rec.result).toBe("won");
  expect(rec.score).toBe(s.ending!.score);
  expect(rec.missions).toEqual(s.run.completed);
  expect(rec.stats).toEqual(s.stats ?? newStats());
  expect(rec.developer).toBe(true);
  expect(rec.company).toBe(s.player.company);

  const gaveUp = playToEnd(4, 2);
  const r2 = gaveUp.view.state.profile.history!.at(-1)!;
  expect(r2.result).toBe("conceded");
  expect(r2.missions.length).toBe(2);
});

const rec = (p: Partial<GameRecord>): GameRecord => ({
  date: "2026-11-18",
  campaign: "C1",
  company: "V1",
  freshness: "fresh",
  result: "won",
  score: 20,
  missions: [{ mission: "C1_M1", threat: ["A", "B"] }],
  heatModule: false,
  developer: false,
  stats: { ...newStats(), overloads: 10, destroyed: { Bot: 60, Sentinel: 30 }, triggered: { Flare: 4 }, drained: 3, moduleRuns: { 1: 5, 26: 2 } },
  ...p,
});

test("totals add up every counted game; Developer-mode games are left out", () => {
  const p = { ...emptyProfile(), history: [rec({}), rec({ result: "lost", score: 31, company: "V2" }), rec({ developer: true, score: 99 })] };
  const games = counted(p);
  expect(games.length).toBe(2);
  const t = totals(games);
  expect([t.games, t.won, t.lost, t.conceded, t.best]).toEqual([2, 1, 1, 0, 31]);
  expect(t.destroyed.Bot).toBe(120);
  expect(t.moduleRuns[1]).toBe(10);
  expect(t.byCompany.V2).toEqual({ games: 1, won: 0 });
  const a = achievements(games);
  const by = (id: string) => a.find((x) => x.a.id === id)!;
  expect(by("first-win").earned).toBe(true);
  expect(by("bots-100").earned).toBe(true);
  expect(by("bots-100").on).toBe("2026-11-18");
  expect(by("sentinels-50").earned).toBe(true);
  expect(by("score-30").earned).toBe(true);
  expect(by("veteran-win").earned).toBe(false);
  expect(by("overloads-100").have).toBe(20);
});

test("effects made from blocks read as card text", () => {
  const s = (p: Partial<Step>, t: Partial<Step["target"]> = {}): Step => ({ ...newStep(), ...p, target: { ...newStep().target, ...t } });
  const blocks = (...steps: Step[]) => effectText({ mode: "blocks", steps });
  expect(blocks(s({ verb: "damage" }, { count: "all", kind: "Gyro" }))).toBe("Deal 1 damage to all Gyros.");
  expect(blocks(s({ verb: "boost" }, { count: "one", kind: "non-Mecha unit", where: "adjacent" }))).toBe("Boost one adjacent non-Mecha unit.");
  expect(blocks(s({ verb: "place", token: "Tick" }, { count: "all", kind: "Sentinel" }))).toBe("Place a Tick on every Sentinel.");
  expect(blocks(s({ verb: "destroy" }, { kind: "Bot", level: 2 }))).toBe("Destroy one Level 2 Bot.");
  expect(blocks(s({ verb: "damage", n: 2 }, { count: "all", other: true, state: "damaged", where: "rowThrough" }))).toBe("Deal 2 damage to all other damaged units in a row through this unit.");
  expect(blocks(s({ verb: "teleport" }, { kind: "Mecha" }), s({ verb: "gainEnergy", n: 2, colour: "Red" }))).toBe("[1] Teleport one Mecha to a Dark sector. [2] Gain 2 Red energy.");
  expect(effectText({ mode: "blocks", steps: [s({ verb: "flagshipDamage" })], when: { adjacentTo: "Alpha unit" } })).toBe("If adjacent to an Alpha unit, deal 1 damage to your Flagship.");
});

test("Campaign 1 goes through the editor and back unchanged, within the copies that exist", () => {
  const c1 = data().campaigns[0]!;
  const d = draftFromCampaign(c1);
  // C1: no mission uses more copies than exist; only the warning that it is Campaign 1.
  const errs = checks(data(), d).filter((p) => p.level === "error");
  expect(errs).toEqual([]);
  for (const m of d.missions) for (const id of Object.keys(m.deck)) expect(freeCopies(data(), m, id)).toBeGreaterThanOrEqual(0);
  const back = parseCampaign(campaignFileText(d), "editor output");
  expect(back.prefix).toBe(c1.prefix);
  expect(back.omega.map((o) => [o.id, o.role, o.level, o.destroyed, o.atOverload])).toEqual(c1.omega.map((o) => [o.id, o.role, o.level, o.destroyed, o.atOverload]));
  expect(back.orders).toEqual(c1.orders.map((o, i) => ({ ...o, id: `C1_ORDER_${i + 1}` })));
  for (const m of c1.missions) {
    const b = back.missionById.get(m.id)!;
    expect(b).toBeDefined();
    expect([b.number, b.route, b.alternativeTo, b.deploymentShuffled, b.omegaPlaced, b.omegaSectors, b.threat, b.objective, b.event, b.map, b.mapSectorCount === b.map.length]).toEqual([
      m.number,
      m.route,
      m.alternativeTo,
      m.deploymentShuffled,
      m.omegaPlaced,
      m.omegaSectors,
      m.threat,
      m.objective,
      m.event,
      m.map,
      true,
    ]);
    expect(b.order?.effect).toBe(m.order?.effect);
    expect(b.order?.tokens).toBe(m.order?.tokens);
  }
});

test("copies are limited per mission; G_00 shares the Energy deck with the Energy Gyros", () => {
  const d = newDraft();
  const m = d.missions[0]!;
  expect(copiesOf(data(), G00)).toBe(42);
  expect(copiesOf(data(), "S_01")).toBe(data().units.byId.get("S_01")!.copies);
  m.deck.S_01 = 3;
  m.threat.A = ["S_01"];
  expect(freeCopies(data(), m, "S_01")).toBe(data().units.byId.get("S_01")!.copies - 4);
  m.deck.G_01 = 2;
  m.deck[G00] = 10;
  expect(freeCopies(data(), m, G00)).toBe(30);
  m.deck.S_01 = 99;
  expect(checks(data(), d).some((p) => p.level === "error" && p.text.startsWith("S_01"))).toBe(true);
});

test("dev prices: per unit, summed per mission roster, per Threat column and for the Campaign", () => {
  const d = newDraft();
  d.omega[0]!.devPrice = 2;
  const m = d.missions[0]!;
  m.deck = { B_01: 2, S_12: 1, [G00]: 3 };
  m.omegaPlaced = ["O_01"];
  m.omegaSectors = [{ q: 1, r: 0 }];
  m.threat.B = ["S_12", "S_12"];
  const price = (id: string) => data().units.byId.get(id)!.devPrice as number;
  const roster = priceSum(data(), d, rosterOf(m));
  // G_00: 0.7 per tile (designer 2026-11-27, C6).
  expect(roster.sum).toBeCloseTo(2 * price("B_01") + price("S_12") + 2 + 3 * 0.7, 5);
  expect(roster.unpriced).toEqual({});
  expect(priceSum(data(), d, threatRoster(m, "B")).sum).toBeCloseTo(2 * price("S_12"), 5);
  expect(priceSum(data(), d, threatRoster(m, "A")).sum).toBe(0);
  // The Campaign: every mission roster, never the Threat columns.
  d.missions.push({ ...structuredClone(m), number: 2 });
  expect(campaignPrice(data(), d).sum).toBeCloseTo(2 * roster.sum, 5);
  // A route pair counts once, by its "X path" (C8, designer 2026-11-22).
  d.missions.push({ ...structuredClone(m), number: 3, route: "x" }, { ...structuredClone(m), number: 3, route: "y", deck: { B_01: 9 } });
  expect(campaignPrice(data(), d).sum).toBeCloseTo(3 * roster.sum, 5);
  for (const c of THREAT_COLUMNS) expect(rosterOf(m)[c]).toBeUndefined();
});

test("the new mission events are written and read back", () => {
  const d = newDraft("C7");
  const base = d.missions[0]!;
  base.deck = { S_01: 2 };
  const evs = [
    { type: "gain_energy", any: 1, energy: { Yellow: 2, Red: 0, Blue: 1 } },
    { type: "take_modules", amount: 2 },
    { type: "take_anomaly", amount: 1 },
    { type: "remove_damage", amount: 3 },
    { type: "allied_drop", level: 2 },
  ] as const;
  d.missions = evs.map((event, i) => ({ ...structuredClone(base), number: i + 1, event: structuredClone(event) as never }));
  const back = parseCampaign(campaignFileText(d), "editor output");
  expect(back.missions.map((m) => m.event)).toEqual([
    { type: "gain_energy", amount: 1, energy: { Yellow: 2, Blue: 1 } },
    { type: "take_modules", amount: 2 },
    { type: "take_anomaly", amount: 1 },
    { type: "remove_damage", amount: 3 },
    { type: "allied_drop", level: 2 },
  ]);
  expect(checks(data(), d).filter((p) => p.level === "todo").length).toBe(4);
});

test("Campaign 1's Omega dev prices (designer 2026-11-27, C7)", () => {
  const c1 = data().campaigns[0]!;
  expect(c1.omega.map((o) => [o.id, o.devPrice])).toEqual([["O_01", -3.3], ["O_02", -14], ["O_03", -26]]);
  const d = draftFromCampaign(c1);
  expect(d.omega.map((o) => o.devPrice)).toEqual([-3.3, -14, -26]);
  expect(checks(data(), d).some((p) => /has no dev price/.test(p.text))).toBe(false);
  const back = parseCampaign(campaignFileText(d), "editor output");
  expect(back.omega.map((o) => o.devPrice)).toEqual([-3.3, -14, -26]);
});
