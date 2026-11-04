/**
 * Where save files live (spec "Saving"). The engine only knows the SaveFile
 * format; a store reads and writes it. Version 1 of the web app will use
 * IndexedDB with file export and import (stage 8); the terminal build uses a
 * file on disk; tests use memory.
 */

import { type SaveFile, readSave } from "../engine/save.js";

export interface SaveStore {
  load(): SaveFile | undefined;
  save(f: SaveFile): void;
}

export class MemoryStore implements SaveStore {
  private text: string | undefined;
  load(): SaveFile | undefined {
    return this.text === undefined ? undefined : readSave(this.text);
  }
  save(f: SaveFile): void {
    this.text = JSON.stringify(f);
  }
}
