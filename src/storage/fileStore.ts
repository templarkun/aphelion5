/** A save file on disk (Node only: the terminal build). */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { type SaveFile, readSave } from "../engine/save.js";
import type { SaveStore } from "./store.js";

export class FileStore implements SaveStore {
  constructor(readonly path: string) {}
  load(): SaveFile | undefined {
    return existsSync(this.path) ? readSave(readFileSync(this.path, "utf8")) : undefined;
  }
  save(f: SaveFile): void {
    mkdirSync(dirname(this.path), { recursive: true });
    // Write then rename, so a crash never leaves half a file.
    writeFileSync(this.path + ".tmp", JSON.stringify(f, null, 1));
    renameSync(this.path + ".tmp", this.path);
  }
}
