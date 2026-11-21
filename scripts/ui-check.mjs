// Builds are served by "vite preview" and checked by ui-smoke.mjs; screenshots go to dist/ui-check/.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

mkdirSync("dist/ui-check", { recursive: true });
// A saved game that waits on a row question, for the row check in ui-smoke.mjs.
for (const what of ["rows", "energy", "drag", "drag2", "m03", "bay3", "bay3-V1", "pickdamage", "take", "anomaly", "overclock", "m01", "node", "fill", "nounits", "moddrag", "orderdrag", "flarechip", "reveal-Omega", "area", "flagship", "pickmany", "repair", "upgrade", "overloadstart", "crippled", "won", "devwin", "alert", "allieddrop", "seen", "route"]) {
  const find = spawn("npx", ["tsx", "scripts/find-save.ts", what, `dist/ui-check/${what === "rows" ? "row" : what}-save.json`], { stdio: "inherit" });
  if ((await new Promise((r) => find.on("exit", r))) !== 0) process.exit(1);
}
// The designer's save of 2026-11-21 (a unit with arrows just revealed): the Mecha to drag after it.
{
  const f = spawn("npx", ["tsx", "scripts/facing-plan.ts", "tests/fixtures/save-2026-11-21-facing-stuck.json", "dist/ui-check/facing-save.json.plan.json"], { stdio: "inherit" });
  if ((await new Promise((r) => f.on("exit", r))) !== 0) process.exit(1);
}
// The designer's save of 2026-11-21 (round 24): M_03 reaches O_01 by two equal ways.
{
  const f = spawn("npx", ["tsx", "scripts/m03-ways.ts", "tests/fixtures/save-2026-11-21-m03-ways.json", "dist/ui-check/m03ways-save.json.plan.json"], { stdio: "inherit" });
  if ((await new Promise((r) => f.on("exit", r))) !== 0) process.exit(1);
}
const server = spawn("npx", ["vite", "preview", "--port", "4174", "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
const run = spawn("node", ["scripts/ui-smoke.mjs", "http://localhost:4174", "dist/ui-check"], { stdio: "inherit" });
const code = await new Promise((r) => run.on("exit", r));
server.kill();
process.exit(code ?? 1);
