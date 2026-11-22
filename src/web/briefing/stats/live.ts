/**
 * The statistics of the game being played (designer 2026-11-22, round 29): "updated after every
 * mission, not just after the whole campaign". After each Mission End the screen writes the game's
 * record so far into `Profile.live` (result "playing"); the statistics page counts it with the
 * finished games. At Game End the engine's own record (10.3, campaign.ts) takes its place. A game left
 * for a new one is moved into the history (as Lost / Conceded, or with no result: `UNFINISHED_AS`).
 * Screen only: no rule reads any of it.
 */

import { newStats } from "../../../engine/events.js";
import type { Game } from "../../../engine/save.js";
import type { GameRecord, Profile } from "../../../engine/state.js";

/** How a game left unfinished for a new one counts (I35, the designer's choice). */
export const UNFINISHED_AS: GameRecord["result"] = "conceded";

export const liveKey = (g: Game): string => `${g.start.date}#${g.start.seed}`;

/** The game's record so far: its missions done, its numbers, the score of its Threat columns. */
export function liveRecord(g: Game): GameRecord {
  const s = g.view.state;
  const missions = structuredClone(s.run.completed);
  return {
    date: s.run.date,
    campaign: s.campaign,
    company: s.player.company,
    freshness: s.run.freshness,
    result: "playing",
    score: missions.reduce((n, m) => n + m.threat.length, 0) - (s.settings.heatModule ? 2 : 0),
    missions,
    heatModule: !!s.settings.heatModule,
    developer: !!s.settings.developerMode,
    stats: structuredClone(s.stats ?? newStats()),
  };
}

/**
 * The profile with this game's record brought up to date, when a mission has ended since it was last
 * written (the same profile otherwise). Nothing before the first Mission End, nothing once it has ended.
 */
export function withLive(p: Profile, g: Game): Profile {
  const s = g.view.state;
  if (s.ending !== undefined || !s.run || s.run.completed.length === 0) return p;
  const key = liveKey(g);
  if (p.live?.key === key && p.live.record.missions.length >= s.run.completed.length) return p;
  // A record of another game still here (left for this one): into the history first.
  const base = p.live && p.live.key !== key ? retireLive(p) : p;
  return { ...base, live: { key, record: liveRecord(g) } };
}

/** The game under way left for good (a new game started over it): its record joins the history. */
export function retireLive(p: Profile): Profile {
  if (!p.live) return p;
  const { live, ...rest } = p;
  return { ...rest, history: [...(p.history ?? []), { ...live.record, result: UNFINISHED_AS }] };
}

/** At Game End the engine wrote the finished record: the live one goes. */
export function dropLive(p: Profile): Profile {
  if (!p.live) return p;
  const { live: _drop, ...rest } = p;
  return rest;
}
