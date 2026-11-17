/**
 * The numbers of the Campaign Debrief, read from the finished game. Nothing is worked out anew:
 * the score and its lines are the engine's own (Core Rules 10.3, `state.ending`), the missions and
 * their Threat columns are `state.run.completed`, the Modules are the ones the player holds.
 */

import type { GameData } from "../../data/index.js";
import type { GameState } from "../../engine/state.js";
import { CAMPAIGN_LORE, FALLBACK_LORE } from "../briefing/content.js";
import { missionLabel } from "../briefing/missionText.js";
import type { CampaignStats, MissionStat, ModuleStat } from "./types.js";

const COLOUR_ORDER = { Yellow: 0, Red: 1, Blue: 2 } as const;

/**
 * "Total Turns" on the Debrief card. The Core Rules have no turns (a mission is one Command phase
 * broken by Overloads, 8 and 9), so what this counts is the designer's choice: open question I13.
 * UNTIL IT IS ANSWERED it counts the Overloads of the whole Campaign (each "an Overload starts",
 * 9.1, in the game's log). Change only this function when the answer comes.
 */
export function totalTurnsOf(state: GameState): number {
  return state.log.filter((e) => e.rule === "9.1" && e.text === "an Overload starts").length;
}

export function campaignStatsOf(data: GameData, state: GameState): CampaignStats {
  const camp = data.campaigns.find((c) => c.prefix === state.campaign);
  const lore = CAMPAIGN_LORE[state.campaign] ?? FALLBACK_LORE;
  const n = /^C(\d+)$/.exec(state.campaign)?.[1];
  const missions: MissionStat[] = state.run.completed.map((r) => {
    const m = camp?.missionById.get(r.mission);
    const label = m ? missionLabel(m) : r.mission;
    return { id: r.mission, label, tag: label.replace(/^Mission\s*/, "M"), threat: [...r.threat].sort() };
  });
  const modules: ModuleStat[] = state.player.modules
    .map((m) => {
      const d = data.modules.byId.get(m.id);
      return { id: m.id, name: d?.name ?? `Module ${m.id}`, colour: d?.colour ?? "Yellow" };
    })
    .sort((a, b) => COLOUR_ORDER[a.colour] - COLOUR_ORDER[b.colour] || a.id - b.id);
  return {
    campaignName: lore.title || (n ? `Campaign ${n}` : state.campaign),
    campaignNote: lore.sector || undefined,
    vesselName: data.companies.byId.get(state.player.company)?.name ?? state.player.company,
    freshness: state.run.freshness,
    modules,
    missions,
    threatLevelsConquered: missions.reduce((sum, m) => sum + m.threat.length, 0),
    totalTurns: totalTurnsOf(state),
    score: state.ending?.score ?? 0,
    scoreParts: state.ending?.parts ?? [],
    highScore: state.ending?.highScore,
  };
}

/**
 * Made-up numbers for looking at an outro without playing a Campaign (System options > "Play the
 * outro"): a won Campaign 1 with the Company chosen in the briefing. Never shown as a real result.
 */
export function sampleStats(data: GameData, campaign: string, company: string): CampaignStats {
  const camp = data.campaigns.find((c) => c.prefix === campaign) ?? data.campaigns[0]!;
  const lore = CAMPAIGN_LORE[camp.prefix] ?? FALLBACK_LORE;
  // One mission per number (the first route of each pair), Threat Levels 1-4 in turn.
  const seen = new Set<number>();
  const missions: MissionStat[] = [];
  for (const m of [...camp.missions].sort((a, b) => a.number - b.number)) {
    if (seen.has(m.number)) continue;
    seen.add(m.number);
    const label = missionLabel(m);
    missions.push({ id: m.id, label, tag: label.replace(/^Mission\s*/, "M"), threat: ["A", "B", "C", "D"].slice(0, 1 + (missions.length % 4)) });
  }
  const modules: ModuleStat[] = data.modules.modules
    .filter((_, i) => i % 9 === 0)
    .map((d) => ({ id: d.id, name: d.name, colour: d.colour }))
    .sort((a, b) => COLOUR_ORDER[a.colour] - COLOUR_ORDER[b.colour] || a.id - b.id);
  const threat = missions.reduce((sum, m) => sum + m.threat.length, 0);
  return {
    campaignName: lore.title || camp.prefix,
    campaignNote: lore.sector || undefined,
    vesselName: data.companies.byId.get(company)?.name ?? company,
    freshness: "fresh",
    modules,
    missions,
    threatLevelsConquered: threat,
    totalTurns: 31,
    score: threat + 5,
    scoreParts: [...missions.map((m) => `${m.id}: ${m.threat.length} Threat column${m.threat.length === 1 ? "" : "s"} (+${m.threat.length})`), "the whole campaign completed (+5)"],
    highScore: "fresh",
  };
}
