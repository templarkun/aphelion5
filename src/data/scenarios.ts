/**
 * Reader for the test scenario batches (tests/batch1.txt, tests/batch2.txt).
 * Records use the same layout as the data files; keys per the batch FORMAT SPEC.
 */

import { parseRecordFile } from "./records.js";

export interface Scenario {
  id: string;
  section: string;
  title: string;
  source?: string;
  /** Map name as written, e.g. "M1", "M2X". */
  map?: string;
  given?: string;
  when?: string;
  then?: string;
  rule?: string;
  assumption?: string;
  issue?: string;
  note?: string;
}

const KEYS = ["id", "title", "source", "map", "given", "when", "then", "rule", "assumption", "issue", "note"] as const;

export function parseScenarios(text: string, fileName = "<batch>"): Scenario[] {
  const file = parseRecordFile(text, fileName);
  const out: Scenario[] = [];
  for (const s of file.sections) {
    for (const r of s.records) {
      for (const k of Object.keys(r.fields)) {
        if (!(KEYS as readonly string[]).includes(k)) throw new Error(`${fileName}:${r.line} ${r.id}: unknown key "${k}"`);
      }
      const sc: Scenario = { id: r.id, section: s.name, title: r.fields.title ?? "" };
      for (const k of KEYS) {
        if (k === "id" || k === "title") continue;
        const v = r.fields[k];
        if (v !== undefined) sc[k] = v;
      }
      out.push(sc);
    }
  }
  return out;
}
