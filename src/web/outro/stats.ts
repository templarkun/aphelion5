/**
 * The numbers of the Campaign Debrief, read from the finished game. Nothing is worked out anew:
 * the score and its lines are the engine's own (Core Rules 10.3, `state.ending`), the missions and
 * their Threat columns are `state.run.completed`, the Modules are the ones the player holds, and
 * the counts (Overloads, Module runs, units destroyed, Omega, Sentinels, Flares and Sleepers triggered, Gyros
 * drained) are the game's own numbers, `state.stats` (engine events.ts `GameStats`).
 */

import type { GameData } from "../../data/index.js";
import type { GameState } from "../../engine/state.js";
import { CAMPAIGN_LORE, FALLBACK_LORE } from "../briefing/content.js";
import { missionLabel } from "../briefing/missionText.js";
import { EXPANSION_MODULES } from "../../engine/campaign.js";
import { DESTROYED_TYPES, type CampaignStats, type DestroyedType, type MissionStat, type ModuleStat } from "./types.js";

const COLOUR_ORDER = { Yellow: 0, Red: 1, Blue: 2 } as const;

/**
 * "Overloads" on the Debrief card (I13, designer 2026-11-17: the Core Rules have no turns; the
 * Overloads of the whole Campaign are counted, under that name). From the game's numbers
 * (engine events.ts `GameStats`); a state without them counts the log's "an Overload starts" (9.1).
 */
export function overloadsOf(state: GameState): number {
  return state.stats?.overloads ?? state.log.filter((e) => e.rule === "9.1" && e.text === "an Overload starts").length;
}

/** The expansion modules played with, as the Debrief names them. */
export function expansionsOf(state: GameState): string[] {
  return EXPANSION_MODULES.filter((x) => x.id === "heat" && state.settings.heatModule).map((x) => x.label.replace(/\s*\(.*\)$/, ""));
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
  const runs = state.stats?.moduleRuns ?? {};
  const held = new Set(state.player.modules.map((m) => m.id));
  const ids = [...held, ...Object.keys(runs).map(Number).filter((id) => !held.has(id) && (runs[id] ?? 0) > 0)];
  const modules: ModuleStat[] = ids
    .map((id) => {
      const d = data.modules.byId.get(id);
      return { id, name: d?.name ?? `Module ${id}`, colour: d?.colour ?? "Yellow", runs: runs[id] ?? 0, held: held.has(id) };
    })
    .sort(moduleOrder);
  const st = state.stats;
  return {
    campaignName: lore.title || (n ? `Campaign ${n}` : state.campaign),
    campaignNote: lore.sector || undefined,
    vesselName: data.companies.byId.get(state.player.company)?.name ?? state.player.company,
    freshness: state.run.freshness,
    expansions: expansionsOf(state),
    modules,
    missions,
    threatLevelsConquered: missions.reduce((sum, m) => sum + m.threat.length, 0),
    overloads: overloadsOf(state),
    destroyed: Object.fromEntries(DESTROYED_TYPES.map((k) => [k, st?.destroyed[k] ?? 0])) as Record<DestroyedType, number>,
    triggered: { Omega: st?.triggered.Omega ?? 0, Sentinel: st?.triggered.Sentinel ?? 0, Flare: st?.triggered.Flare ?? 0, Sleeper: st?.triggered.Sleeper ?? 0 },
    drained: st?.drained ?? 0,
    score: state.ending?.score ?? 0,
    scoreParts: state.ending?.parts ?? [],
    highScore: state.ending?.highScore,
  };
}

/** Held Modules first, then the others; by colour (Yellow, Red, Blue), then by number. */
function moduleOrder(a: ModuleStat, b: ModuleStat): number {
  return Number(b.held) - Number(a.held) || COLOUR_ORDER[a.colour] - COLOUR_ORDER[b.colour] || a.id - b.id;
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
    .filter((_, i) => i % 9 === 0 || i === 40)
    .map((d, i) => ({ id: d.id, name: d.name, colour: d.colour, runs: [6, 3, 11, 0, 4, 8, 2, 5, 1, 7][i % 10]!, held: d.id !== data.modules.modules[40]?.id }))
    .sort(moduleOrder);
  const threat = missions.reduce((sum, m) => sum + m.threat.length, 0);
  return {
    campaignName: lore.title || camp.prefix,
    campaignNote: lore.sector || undefined,
    vesselName: data.companies.byId.get(company)?.name ?? company,
    freshness: "fresh",
    expansions: ["Heat module"],
    modules,
    missions,
    threatLevelsConquered: threat,
    overloads: 31,
    destroyed: { Omega: 2, Bot: 57, Sentinel: 23, Gyro: 9, Sleeper: 6 },
    triggered: { Omega: 9, Sentinel: 21, Flare: 34, Sleeper: 5 },
    drained: 14,
    // As the engine scores it (campaign.ts): playing with the Heat module costs 2.
    score: threat + 5 - 2,
    scoreParts: [...missions.map((m) => `${m.id}: ${m.threat.length} Threat column${m.threat.length === 1 ? "" : "s"} (+${m.threat.length})`), "the whole campaign completed (+5)", "Heat module (-2)"],
    highScore: "fresh",
  };
}
