// The command briefing's loadout answers the engine's setup questions (7.1, 7.2 step 3); nothing else.
import { expect, test } from "vitest";
import { startGame } from "../../src/engine/save.js";
import { emptyProfile } from "../../src/engine/state.js";
import { applyLoadout } from "../../src/web/briefing/launch.js";
import type { Loadout } from "../../src/web/briefing/types.js";
import { data } from "./helpers.js";

const loadout = (over: Partial<Loadout> = {}): Loadout => ({ campaign: "C1", company: "V2", freshness: "fresh", expansions: ["heat"], threat: { C1_M1: ["B", "D"] }, developerMode: false, seed: 7, ...over });
const fresh = () => startGame(data(), { seed: 7, date: "2026-11-13", developerMode: false, autoAnswer: true, profile: emptyProfile() });

test("the loadout sets Campaign, Company, expansion modules and Mission 1's Threat columns", () => {
  const g = applyLoadout(data(), fresh(), loadout());
  const s = g.view.state;
  expect(s.campaign).toBe("C1");
  expect(s.player.company).toBe("V2");
  expect(s.settings.heatModule).toBe(true);
  expect(s.run.threat).toEqual(["B", "D"]);
  expect(g.view.status === "question" && g.view.question.prompt).toBe("Draw a Module: keep one.");
  expect(g.answers.length).toBe(4);
});

test("with no Threat plan for the mission the game asks as before", () => {
  const g = applyLoadout(data(), fresh(), loadout({ threat: {}, expansions: [] }));
  expect(g.view.state.settings.heatModule).toBe(false);
  expect(g.view.status === "question" && g.view.question.prompt.startsWith("Choose the Threat columns")).toBe(true);
});
