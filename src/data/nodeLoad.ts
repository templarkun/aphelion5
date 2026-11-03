/** Node-only helpers (build script and tests): read the text files from disk. */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_FILES, type GameData, parseGameData } from "./index.js";

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function readRepoFile(...parts: string[]): string {
  return readFileSync(join(REPO_ROOT, ...parts), "utf8");
}

export function loadGameData(): GameData {
  return parseGameData({
    units: readRepoFile("data", DATA_FILES.units),
    modules: readRepoFile("data", DATA_FILES.modules),
    campaign1: readRepoFile("data", DATA_FILES.campaign1),
  });
}
