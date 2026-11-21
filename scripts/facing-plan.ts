// For the browser check (designer's save of 2026-11-21, a unit with arrows just revealed): the game once
// its facing is kept, and a Mecha that can be dragged there, with its targets. Writes <out>.plan.json.
import { readFileSync, writeFileSync } from "node:fs";
import { loadGameData } from "../src/data/nodeLoad.js";
import { playAnswer, readSave, replayGame } from "../src/engine/save.js";
import { mechaDragPlan } from "../src/web/drag.js";
const [, , file, out] = process.argv;
const data = loadGameData();
const f = readSave(readFileSync(file!, "utf8"));
const g = replayGame(data, f.game!.start, f.game!.answers);
const q = g.view.status === "question" ? g.view.question : undefined;
if (!q || q.kind !== "option" || !q.facing) throw new Error("the save does not stop at a facing question");
const a = playAnswer(data, g, { kind: "option", value: String(q.facing.start) }).game;
const aq = a.view.status === "question" && a.view.question.kind === "option" ? a.view.question : undefined;
for (const o of aq?.shortcuts ?? []) {
  if (!o.id.startsWith("mecha:") || o.on?.kind !== "unit") continue;
  const plan = mechaDragPlan(data, a, a.view, o.on.id);
  const t = plan?.targets.find((x) => x.kind === "move" && !x.next);
  if (!plan || !t) continue;
  writeFileSync(out!, JSON.stringify({ unitId: plan.unitId, tile: o.on.id, from: plan.from, to: t.sector, facingTile: q.facing.tile }));
  console.log(`${out}: ${plan.unitId} from (${plan.from}) to (${t.sector})`);
  process.exit(0);
}
throw new Error("no Mecha to drag");
