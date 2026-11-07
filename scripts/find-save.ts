/**
 * Plays random legal answers (from seed 1 up) until the game asks a question
 * of the given kind, then writes that game as a save file, for the browser
 * check (scripts/ui-smoke.mjs pastes it in). Usage:
 *   tsx scripts/find-save.ts rows|energy <out.json>
 */
import { writeFileSync } from "node:fs";
import { loadGameData } from "../src/data/nodeLoad.js";
import type { Question } from "../src/engine/questions.js";
import { newRng } from "../src/engine/rng.js";
import { playAnswer, startGame, toSave } from "../src/engine/save.js";
import { emptyProfile } from "../src/engine/state.js";
import { randomAnswer } from "../tests/unit/campaignFuzz.js";

const WANTED: Record<string, (q: Question) => boolean> = {
  rows: (q) => q.rows !== undefined,
  // Energy on Modules with pop-ups (designer 2026-11-07).
  energy: (q) => q.energy !== undefined && q.kind === "option" && q.options.length >= 2,
};
const [what = "rows", out = "save.json"] = process.argv.slice(2);
const wanted = WANTED[what];
if (!wanted) throw new Error(`unknown question kind ${what}`);
const data = loadGameData();
for (let seed = 1; seed < 400; seed++) {
  const r = newRng(seed * 7 + 1);
  let g = startGame(data, { seed, date: "2026-11-07", profile: emptyProfile(), developerMode: false, autoAnswer: true });
  for (let n = 0; n < 400 && g.view.status === "question"; n++) {
    const q = g.view.question;
    if (wanted(q)) {
      writeFileSync(out, JSON.stringify(toSave(g, g.view.state.profile)));
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
