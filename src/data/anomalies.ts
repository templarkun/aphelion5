/** Typed reader for "data/Anomaly list.txt". Requirements are checked at Overload End step 3 (Core Rules 9.3). */

import { parseRecordFile } from "./records.js";

/** What an Anomaly counts (file KEY DEFINITIONS, "terms"). */
export const ANOMALY_TERMS = ["Bot", "Mecha", "Sentinel", "Gyro", "Sleeper", "Flare", "non-Bot unit", "Cleared sector"] as const;
export type AnomalyTerm = (typeof ANOMALY_TERMS)[number];

export interface AnomalyDef {
  /** Two-digit number as printed, e.g. "01". */
  id: string;
  /** Counts of all terms are added together. */
  terms: AnomalyTerm[];
  minimum: number;
  text: string;
}

export interface AnomalyDatabase {
  anomalies: AnomalyDef[];
  byId: ReadonlyMap<string, AnomalyDef>;
}

export function parseAnomalies(text: string, fileName = "Anomaly list.txt"): AnomalyDatabase {
  const file = parseRecordFile(text, fileName);
  if (!file.hasEndMarker) throw new Error(`${fileName}: missing END OF FILE marker`);
  const anomalies: AnomalyDef[] = [];
  for (const s of file.sections) {
    if (s.name !== "ANOMALIES") throw new Error(`${fileName}: unknown section "${s.name}"`);
    for (const r of s.records) {
      const where = `${fileName}:${r.line} Anomaly ${r.id}`;
      if (!/^\d{2}$/.test(r.id)) throw new Error(`${where}: id must be two digits`);
      const f = r.fields;
      if (f.terms === undefined || f.minimum === undefined || f.text === undefined) throw new Error(`${where}: terms, minimum and text are required`);
      const terms = f.terms.split(",").map((t) => t.trim());
      for (const t of terms) if (!(ANOMALY_TERMS as readonly string[]).includes(t)) throw new Error(`${where}: unknown term "${t}"`);
      if (new Set(terms).size !== terms.length) throw new Error(`${where}: a term repeats`);
      const minimum = Number(f.minimum);
      if (!Number.isInteger(minimum) || minimum < 1) throw new Error(`${where}: bad minimum "${f.minimum}"`);
      anomalies.push({ id: r.id, terms: terms as AnomalyTerm[], minimum, text: f.text });
    }
  }
  const byId = new Map<string, AnomalyDef>();
  for (const a of anomalies) {
    if (byId.has(a.id)) throw new Error(`${fileName}: Anomaly ${a.id} listed twice`);
    byId.set(a.id, a);
  }
  return { anomalies, byId };
}
