/**
 * From the compiled loadout to the game: the setup questions the engine asks (Core Rules 7.1,
 * 7.2 step 3) are answered with what the player chose in the briefing. Nothing is decided here.
 */

import type { GameData } from "../../data/index.js";
import type { Answer, Question } from "../../engine/questions.js";
import { type Game, playAnswer } from "../../engine/save.js";
import type { GameState } from "../../engine/state.js";
import { loadPlan } from "./prefs.js";
import type { Loadout } from "./types.js";

export const THREAT_PROMPT = "Choose the Threat columns";

/** Is this answer on the question's list? */
function offers(q: Question, id: string): boolean {
  return (q.kind === "option" || q.kind === "several") && q.options.some((o) => o.id === id);
}

function answerFor(q: Question, s: GameState, l: Loadout): Answer | undefined {
  const has = (id: string) => offers(q, id);
  if (q.prompt === "Choose a Campaign." && has(l.campaign)) return { kind: "option", value: l.campaign };
  if (q.prompt === "Choose your Company." && has(l.company)) return { kind: "option", value: l.company };
  if (q.prompt.includes("sheet has upgrade marks") && has(l.freshness)) return { kind: "option", value: l.freshness };
  if (q.prompt.startsWith("Choose the expansion modules")) return { kind: "several", value: l.expansions.filter(has) };
  if (q.prompt.startsWith(THREAT_PROMPT) && s.phase === "preparation" && s.run.completed.length === 0) {
    const cols = l.threat[s.mission];
    if (cols?.length) return { kind: "several", value: cols };
  }
  return undefined;
}

/** Answer the setup questions from the loadout, up to the first one the briefing did not cover. */
export function applyLoadout(data: GameData, game: Game, l: Loadout): Game {
  let g = game;
  for (let i = 0; i < 12; i++) {
    const v = g.view;
    if (v.status !== "question") break;
    const a = answerFor(v.question, v.state, l);
    if (!a) break;
    const r = playAnswer(data, g, a);
    if (r.result.status === "illegal" || r.result.status === "blocked") break;
    g = r.game;
  }
  return g;
}

/** The Threat columns planned in the briefing for the mission now being prepared (pre-selected, the player confirms). */
export function plannedThreat(game: Game, q: Question | undefined): string[] {
  if (!q || !q.prompt.startsWith(THREAT_PROMPT)) return [];
  const plan = loadPlan(game.start.seed, game.start.date);
  const cols = plan?.[game.view.state.mission] ?? [];
  return cols.filter((c) => offers(q, c));
}
