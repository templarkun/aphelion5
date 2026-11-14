// The command briefing's loadout answers the engine's setup questions (7.1); the Threat columns
// are asked at each Mission Preparation (7.2 step 3) and answered on the Threat screen.
import { expect, test } from "vitest";
import { playAnswer, startGame } from "../../src/engine/save.js";
import { emptyProfile } from "../../src/engine/state.js";
import { applyLoadout, isThreatQuestion } from "../../src/web/briefing/launch.js";
import type { Loadout } from "../../src/web/briefing/types.js";
import { campaignUnits, unitFacts } from "../../src/web/briefing/unitFacts.js";
import { data } from "./helpers.js";

const loadout = (over: Partial<Loadout> = {}): Loadout => ({ campaign: "C1", company: "V2", freshness: "fresh", expansions: ["heat"], developerMode: false, seed: 7, ...over });
const fresh = () => startGame(data(), { seed: 7, date: "2026-11-14", developerMode: false, autoAnswer: true, profile: emptyProfile() });

test("the loadout sets Campaign, Company and expansion modules; then the game asks Mission 1's Threat", () => {
  const g = applyLoadout(data(), fresh(), loadout());
  const s = g.view.state;
  expect(s.campaign).toBe("C1");
  expect(s.player.company).toBe("V2");
  expect(s.settings.heatModule).toBe(true);
  expect(g.answers.length).toBe(3);
  expect(g.view.status === "question" && isThreatQuestion(g.view.question)).toBe(true);
  expect(s.run.threat).toEqual([]);
});

test("the Threat answer is the engine's own: columns B and D give Level Assault, then the Module draw", () => {
  const g = applyLoadout(data(), fresh(), loadout({ expansions: [] }));
  expect(g.view.state.settings.heatModule).toBe(false);
  const r = playAnswer(data(), g, { kind: "several", value: ["B", "D"] });
  expect(r.game.view.state.run.threat).toEqual(["B", "D"]);
  expect(r.game.view.status === "question" && r.game.view.question.prompt).toBe("Draw a Module: keep one.");
});

test("the Campaign's unit roster: every Bot, the Energy Gyros, the Omega units, each mission's units; no Mecha", () => {
  const c = data().campaigns[0]!;
  const ids = campaignUnits(data(), c).map((u) => u.id);
  for (const id of ["B_01", "B_02", "B_03", "G_01", "G_09", "O_01", "O_02", "O_03", "S_12", "F_01", "P_15"]) expect(ids).toContain(id);
  expect(ids.some((id) => id.startsWith("M_"))).toBe(false);
  expect(ids).not.toContain("G_00");
  const o2 = unitFacts(data(), "O_02", c)!;
  expect(o2.title).toBe("Omega · Beta unit");
  expect(o2.level).toBe(13);
  expect(o2.lines.some(([k]) => k === "At Overload")).toBe(true);
  expect(unitFacts(data(), "S_12", c)!.where).toContain("Mission 1: Threat A, C");
});
