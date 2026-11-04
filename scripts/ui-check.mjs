// Builds are served by "vite preview" and checked by ui-smoke.mjs; screenshots go to dist/ui-check/.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

mkdirSync("dist/ui-check", { recursive: true });
const server = spawn("npx", ["vite", "preview", "--port", "4174", "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));
const run = spawn("node", ["scripts/ui-smoke.mjs", "http://localhost:4174", "dist/ui-check"], { stdio: "inherit" });
const code = await new Promise((r) => run.on("exit", r));
server.kill();
process.exit(code ?? 1);
