// Builds are served by "vite preview" and checked by ui-smoke.mjs; screenshots go to dist/ui-check/.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

mkdirSync("dist/ui-check", { recursive: true });
// A saved game that waits on a row question, for the row check in ui-smoke.mjs.
for (const what of ["rows", "energy", "drag", "drag2", "m03", "bay3", "take", "anomaly", "overclock", "m01", "node", "fill", "nounits", "moddrag", "orderdrag", "flarechip"]) {
  const find = spawn("npx", ["tsx", "scripts/find-save.ts", what, `dist/ui-check/${what === "rows" ? "row" : what}-save.json`], { stdio: "inherit" });
  if ((await new Promise((r) => find.on("exit", r))) !== 0) process.exit(1);
}
const server = spawn("npx", ["vite", "preview", "--port", "4174", "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
const run = spawn("node", ["scripts/ui-smoke.mjs", "http://localhost:4174", "dist/ui-check"], { stdio: "inherit" });
const code = await new Promise((r) => run.on("exit", r));
server.kill();
process.exit(code ?? 1);
