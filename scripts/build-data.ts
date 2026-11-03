/**
 * Build step: parse every component file in data/ into typed JSON under
 * src/data/generated/, after running the data checks. Fails loudly (exit 1)
 * on any parse error or failed check.
 *
 *   npm run build:data
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runDataChecks } from "../src/data/checks.js";
import { serialiseGameData } from "../src/data/serialise.js";
import { REPO_ROOT, loadGameData } from "../src/data/nodeLoad.js";

const data = loadGameData();
const results = runDataChecks(data);
let failed = false;
for (const r of results) {
  const ok = r.problems.length === 0;
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${r.name}`);
  for (const p of r.problems) console.log(`       - ${p}`);
}
if (failed) {
  console.error("Data checks failed; generated files not written.");
  process.exit(1);
}

const outDir = join(REPO_ROOT, "src", "data", "generated");
mkdirSync(outDir, { recursive: true });
for (const [name, value] of Object.entries(serialiseGameData(data))) {
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(value, null, 2) + "\n");
  console.log(`wrote src/data/generated/${name}.json`);
}
