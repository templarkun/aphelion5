// For the browser check (designer's save of 2026-11-21, round 24): M_03 dragged onto a unit it reaches
// by several equal ways goes at once. Writes <out>.plan.json: the Mecha's tile, its sector, the target.
import { readFileSync, writeFileSync } from "node:fs";
import { loadGameData } from "../src/data/nodeLoad.js";
import { readSave, replayGame } from "../src/engine/save.js";
import { mechaDragPlan } from "../src/web/drag.js";
const [, , file, out] = process.argv;
const data = loadGameData();
const f = readSave(readFileSync(file!, "utf8"));
const g = replayGame(data, f.game!.start, f.game!.answers);
const q = g.view.status === "question" && g.view.question.kind === "option" ? g.view.question : undefined;
for (const o of q?.shortcuts ?? []) {
  if (!o.id.startsWith("mecha:M_03") || o.on?.kind !== "unit") continue;
  const plan = mechaDragPlan(data, g, g.view, o.on.id);
  // The target reached by more than one way (O_01 at (-1,2) in the designer's save).
  const t = plan?.targets.find((x) => x.kind === "attack" && x.via && !x.next && x.sector === "-1,2");
  if (!plan || !t) throw new Error("M_03 has no one-drop target at (-1,2)");
  writeFileSync(out!, JSON.stringify({ tile: o.on.id, from: plan.from, to: t.sector }));
  console.log(`${out}: M_03 from (${plan.from}) to (${t.sector})`);
  process.exit(0);
}
throw new Error("no M_03 to drag");
