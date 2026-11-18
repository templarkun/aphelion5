/**
 * The statistics and achievements page's numbers (designer 2026-11-17; screen only, no rule).
 * Everything is read from the profile's finished games (`Profile.history`, written at Game End,
 * 10.3); nothing here is stored. Games played in Developer mode are listed but left out of the
 * totals and the achievements.
 */

import type { GameRecord, Profile } from "../../../engine/state.js";

export const UNIT_KINDS = ["Omega", "Bot", "Sentinel", "Gyro", "Sleeper", "Flare"] as const;

export interface Totals {
  games: number;
  won: number;
  lost: number;
  conceded: number;
  /** Missions completed and Threat columns conquered, all games. */
  missions: number;
  threatColumns: number;
  /** Best score, all games (undefined: none yet). */
  best?: number;
  overloads: number;
  destroyed: Record<string, number>;
  triggered: Record<string, number>;
  drained: number;
  moduleRuns: Record<number, number>;
  /** Games per Company id, and wins. */
  byCompany: Record<string, { games: number; won: number }>;
}

/** The finished games that count (not Developer mode), oldest first. */
export function counted(p: Profile): GameRecord[] {
  return (p.history ?? []).filter((g) => !g.developer);
}

export function totals(games: readonly GameRecord[]): Totals {
  const t: Totals = { games: 0, won: 0, lost: 0, conceded: 0, missions: 0, threatColumns: 0, overloads: 0, destroyed: {}, triggered: {}, drained: 0, moduleRuns: {}, byCompany: {} };
  const add = (into: Record<string | number, number>, from: Record<string | number, number>) => {
    for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
  };
  for (const g of games) {
    t.games++;
    t[g.result]++;
    t.missions += g.missions.length;
    t.threatColumns += g.missions.reduce((n, m) => n + m.threat.length, 0);
    t.best = Math.max(t.best ?? -Infinity, g.score);
    t.overloads += g.stats.overloads;
    t.drained += g.stats.drained;
    add(t.destroyed, g.stats.destroyed);
    add(t.triggered, g.stats.triggered);
    add(t.moduleRuns, g.stats.moduleRuns);
    const c = (t.byCompany[g.company] ??= { games: 0, won: 0 });
    c.games++;
    if (g.result === "won") c.won++;
  }
  return t;
}

export const sumOf = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------------------
// Achievements. PLACEHOLDERS (designer to give the real list, I16): each one is a test over the
// finished games, so a new one is one entry here and the page shows it.

export interface Achievement {
  id: string;
  name: string;
  text: string;
  /** How far along: `have` of `need` (earned when have >= need). */
  progress: (games: readonly GameRecord[], t: Totals) => number;
  need: number;
}

const most = (games: readonly GameRecord[], f: (g: GameRecord) => number) => games.reduce((n, g) => Math.max(n, f(g)), 0);
const count = (games: readonly GameRecord[], f: (g: GameRecord) => boolean) => games.filter(f).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-game", name: "First Deployment", text: "Finish a game.", need: 1, progress: (g) => g.length },
  { id: "first-win", name: "Campaign Complete", text: "Win a Campaign.", need: 1, progress: (g) => count(g, (x) => x.result === "won") },
  { id: "veteran-win", name: "Veteran Commander", text: "Win a Veteran Campaign.", need: 1, progress: (g) => count(g, (x) => x.result === "won" && x.freshness === "veteran") },
  { id: "heat-win", name: "Running Hot", text: "Win a Campaign with the Heat module.", need: 1, progress: (g) => count(g, (x) => x.result === "won" && x.heatModule) },
  { id: "all-threat", name: "Full Threat", text: "Complete a mission with all four Threat columns.", need: 1, progress: (g) => count(g, (x) => x.missions.some((m) => m.threat.length >= 4)) },
  { id: "score-30", name: "Top of the Board", text: "Score 30 or more in one game.", need: 30, progress: (g) => most(g, (x) => x.score) },
  { id: "bots-100", name: "Scrap Collector", text: "Destroy 100 Bots.", need: 100, progress: (_g, t) => t.destroyed.Bot ?? 0 },
  { id: "sentinels-50", name: "Sentinel Breaker", text: "Destroy 50 Sentinels.", need: 50, progress: (_g, t) => t.destroyed.Sentinel ?? 0 },
  { id: "omega-50", name: "Omega Hunter", text: "Destroy 50 Omega units.", need: 50, progress: (_g, t) => t.destroyed.Omega ?? 0 },
  { id: "gyros-50", name: "Power Tap", text: "Drain 50 Gyros.", need: 50, progress: (_g, t) => t.drained },
  { id: "overloads-100", name: "Overload Survivor", text: "Live through 100 Overloads.", need: 100, progress: (_g, t) => t.overloads },
  { id: "modules-200", name: "Chief Engineer", text: "Run Modules 200 times.", need: 200, progress: (_g, t) => sumOf(t.moduleRuns) },
];

export interface AchievementState {
  a: Achievement;
  have: number;
  earned: boolean;
  /** The date of the game that earned it. */
  on?: string;
}

/** Each achievement, how far along, and the game that earned it (the first game after which it was met). */
export function achievements(games: readonly GameRecord[]): AchievementState[] {
  const all = totals(games);
  return ACHIEVEMENTS.map((a) => {
    const have = a.progress(games, all);
    const out: AchievementState = { a, have: Math.min(have, a.need), earned: have >= a.need };
    if (out.earned) {
      for (let i = 1; i <= games.length; i++) {
        const part = games.slice(0, i);
        if (a.progress(part, totals(part)) >= a.need) {
          out.on = games[i - 1]!.date;
          break;
        }
      }
    }
    return out;
  });
}
