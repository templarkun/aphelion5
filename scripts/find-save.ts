/**
 * Plays random legal answers (from seed 1 up) until the game asks a question
 * of the given kind, then writes that game as a save file, for the browser
 * check (scripts/ui-smoke.mjs pastes it in). Usage:
 *   tsx scripts/find-save.ts rows|energy|bubbles|drag <out.json>
 */
import { writeFileSync } from "node:fs";
import { loadGameData } from "../src/data/nodeLoad.js";
import type { Question } from "../src/engine/questions.js";
import { newRng } from "../src/engine/rng.js";
import { playAnswer, startGame, toSave } from "../src/engine/save.js";
import { emptyProfile } from "../src/engine/state.js";
import { randomAnswer } from "../tests/unit/campaignFuzz.js";
import { mechaDragPlan } from "../src/web/drag.js";
import type { Game } from "../src/engine/save.js";

const data = loadGameData();
/** A Mecha that can be dragged both to a move target and to an Attack target. */
function dragPlanOf(g: Game) {
  const q = g.view.status === "question" ? g.view.question : undefined;
  for (const o of q?.shortcuts ?? []) {
    if (!o.id.startsWith("mecha:") || o.on?.kind !== "unit") continue;
    const plan = mechaDragPlan(data, g, g.view, o.on.id);
    if (plan && plan.targets.some((t) => t.kind === "move") && plan.targets.some((t) => t.kind === "attack")) return plan;
  }
  return undefined;
}
const WANTED: Record<string, (q: Question, g: Game) => boolean> = {
  // Dragging a Mecha (Program Spec "Interaction and animation"): blue and red targets.
  drag: (_q, g) => dragPlanOf(g) !== undefined,
  // M_03 (designer 2026-11-08): a red target reached only by moving first.
  m03: (q, g) =>
    (q.shortcuts ?? []).some((o) => o.id.startsWith("mecha:") && o.on?.kind === "unit" && (mechaDragPlan(data, g, g.view, o.on.id)?.targets.some((t) => t.via) ?? false)),
  // M_03 / M_06: the Passive first, then the Attack, in one drag.
  drag2: (q, g) =>
    (q.shortcuts ?? []).some((o) => o.id.startsWith("mecha:") && o.on?.kind === "unit" && (mechaDragPlan(data, g, g.view, o.on.id)?.targets.some((t) => t.next?.()) ?? false)),
  rows: (q) => q.rows !== undefined,
  // Energy taken off Modules (S_08, S_13): pop-ups with an outward arrow.
  take: (q) => q.takeEnergy !== undefined,
  // Overload End step 3: claim a met Anomaly card.
  anomaly: (q) => q.kind === "option" && q.options.some((o) => o.on?.kind === "anomaly"),
  // Bay 3 (look at the top tiles of a Dark sector) on the action menu.
  bay3: (q) => (q.shortcuts ?? []).some((o) => o.on?.kind === "bay" && /BAY3$/.test(o.on.ability)),
  // Energy on Modules with pop-ups (designer 2026-11-07).
  energy: (q) => q.energy !== undefined && q.kind === "option" && q.options.length >= 2,
  // A unit with three or more actions in its pop-up (bubbles, designer 2026-11-07).
  bubbles: (q) => {
    const per = new Map<string, number>();
    for (const o of q.shortcuts ?? []) if (o.on?.kind === "unit") per.set(o.on.id, (per.get(o.on.id) ?? 0) + 1);
    return [...per.values()].some((n) => n >= 3);
  },
};
const [what = "rows", out = "save.json"] = process.argv.slice(2);
const wanted = WANTED[what];
if (!wanted) throw new Error(`unknown question kind ${what}`);
for (let seed = 1; seed < 400; seed++) {
  const r = newRng(seed * 7 + 1);
  let g = startGame(data, { seed, date: "2026-11-07", profile: emptyProfile(), developerMode: false, autoAnswer: true });
  for (let n = 0; n < 400 && g.view.status === "question"; n++) {
    const q = g.view.question;
    if (wanted(q, g)) {
      writeFileSync(out, JSON.stringify(toSave(g, g.view.state.profile)));
      if (what.startsWith("drag") || what === "m03") {
        // Beside the save: the Mecha to drag and its targets (for the browser check).
        for (const o of q.shortcuts ?? []) {
          if (!o.id.startsWith("mecha:") || o.on?.kind !== "unit") continue;
          const plan = mechaDragPlan(data, g, g.view, o.on.id);
          if (!plan || !(what === "drag" ? plan === dragPlanOf(g) || dragPlanOf(g)?.tile === plan.tile : what === "m03" ? plan.targets.some((t) => t.via) : plan.targets.some((t) => t.next?.()))) continue;
          const targets = plan.targets.map((t) => ({ sector: t.sector, kind: t.kind, via: t.via, answers: t.answers, next: t.next?.()?.targets.map((x) => x.sector) }));
          writeFileSync(`${out}.plan.json`, JSON.stringify({ unitId: plan.unitId, from: plan.from, targets }));
          break;
        }
      }
      console.log(`${out}: seed ${seed}, after ${n} answers: ${q.prompt}`);
      process.exit(0);
    }
    let a = randomAnswer(r, q);
    for (let k = 0; k < 30 && a.kind === "option" && a.value === "concede"; k++) a = randomAnswer(r, q);
    const res = playAnswer(data, g, a);
    if (res.result.status === "illegal" || res.result.status === "blocked") break;
    g = res.game;
  }
}
throw new Error(`no game reached a ${what} question`);
