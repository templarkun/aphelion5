/**
 * Browser saves (spec "Saving"): one record in IndexedDB holding the whole
 * save file (profile, game in progress, settings), written after every
 * answer; plus export and import as a file. If IndexedDB is not available
 * (private window, blocked storage), saving quietly falls back to memory.
 */

import { type SaveFile, readSave } from "../engine/save.js";

const DB = "aphelion5";
const STORE = "saves";
const KEY = "current";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let memory: string | undefined;

export async function loadSave(): Promise<SaveFile | undefined> {
  try {
    const db = await open();
    const text = await new Promise<string | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => reject(req.error);
    });
    return text === undefined ? undefined : readSave(text);
  } catch {
    return memory === undefined ? undefined : readSave(memory);
  }
}

export async function writeSave(f: SaveFile): Promise<void> {
  const text = JSON.stringify(f);
  memory = text;
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(text, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Memory only: the game goes on; export a file to keep it.
  }
}

/** Give the viewer a file to save. */
export function download(name: string, text: string, type = "application/json"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Let the viewer pick a save file; resolves with its parsed contents. */
export function pickFile(): Promise<SaveFile | undefined> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(undefined);
      try {
        resolve(readSave(await f.text()));
      } catch (e) {
        reject(e);
      }
    };
    input.click();
  });
}
