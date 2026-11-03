/**
 * Reader for the "structured, machine-oriented" text files used by every
 * Aphelion 5 data file and test batch.
 *
 * Shared layout (see the FORMAT SPEC block at the top of each file):
 *   - "#" lines are comments.
 *   - "=== SECTION: <name> ===" starts a section. Text before the first section
 *     (FORMAT SPEC, conventions, key definitions) is documentation and is kept
 *     only as raw text.
 *   - "SECTION_DEFAULTS:" / "SUBSECTION_DEFAULTS (<range>):" open an indented
 *     block of "  key: value" lines.
 *   - A record is a block of "key: value" lines starting with "id:", ended by a
 *     blank line. A line that starts with whitespace continues the previous value.
 *   - "=== END OF FILE ===" ends the file.
 *
 * This module knows nothing about the game; it only turns text into ordered
 * key/value maps. Typed readers (units.ts, modules.ts, campaign.ts) sit on top.
 */

export type Fields = Record<string, string>;

export interface RawRecord {
  /** Value of the "id:" line. */
  id: string;
  /** Every key of the record, in file order (including "id"). */
  fields: Fields;
  /** Section the record sits in. */
  section: string;
  /** Subsection defaults label in force, e.g. "G_01..G_09", if any. */
  subsection?: string;
  /** 1-based line of the "id:" line, for error messages. */
  line: number;
}

export interface RawSection {
  name: string;
  defaults: Fields;
  /** Subsection defaults blocks, by label, in file order. */
  subsections: { label: string; defaults: Fields }[];
  /** Free text lines inside the section that are not records or comments. */
  notes: string[];
  records: RawRecord[];
}

export interface RawFile {
  /** Everything before the first section (format spec, conventions). */
  preamble: string;
  sections: RawSection[];
  hasEndMarker: boolean;
}

export class DataFormatError extends Error {
  constructor(file: string, line: number, message: string) {
    super(`${file}:${line}: ${message}`);
    this.name = "DataFormatError";
  }
}

const SECTION_RE = /^=== SECTION: (.+?) ===\s*$/;
const END_RE = /^=== END OF FILE ===\s*$/;
const RULE_RE = /^={5,}\s*$/; // "=====..." separator
const SUB_RE = /^SUBSECTION_DEFAULTS \((.+)\):\s*$/;
const KV_RE = /^([a-z][a-zA-Z0-9_ ]*?):\s?(.*)$/;
const INDENTED_KV_RE = /^ {2}([a-z][a-zA-Z0-9_ ]*?):\s?(.*)$/;

/** Parse one structured file. `file` is used only in error messages. */
export function parseRecordFile(text: string, file = "<text>"): RawFile {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const preamble: string[] = [];
  const sections: RawSection[] = [];
  let hasEndMarker = false;

  let section: RawSection | undefined;
  // What is currently open: a defaults block or a record.
  let defaultsTarget: Fields | undefined;
  let record: RawRecord | undefined;
  let lastKey: string | undefined;
  let subsection: string | undefined;

  const closeRecord = () => {
    if (record && section) section.records.push(record);
    record = undefined;
    lastKey = undefined;
  };
  const closeAll = () => {
    closeRecord();
    defaultsTarget = undefined;
    lastKey = undefined;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const n = i + 1;
    const line = raw.replace(/\s+$/, "");

    if (END_RE.test(line)) {
      closeAll();
      hasEndMarker = true;
      break;
    }
    const sm = SECTION_RE.exec(line);
    if (sm) {
      closeAll();
      section = { name: sm[1]!, defaults: {}, subsections: [], notes: [], records: [] };
      sections.push(section);
      subsection = undefined;
      continue;
    }
    if (!section) {
      preamble.push(raw);
      continue;
    }
    if (line.startsWith("#") || RULE_RE.test(line)) {
      // Comments end a defaults block but never split a record (records end on blank lines).
      if (!record) defaultsTarget = undefined;
      continue;
    }
    if (line === "") {
      closeAll();
      continue;
    }
    if (line === "SECTION_DEFAULTS:") {
      closeAll();
      defaultsTarget = section.defaults;
      continue;
    }
    const sub = SUB_RE.exec(line);
    if (sub) {
      closeAll();
      subsection = sub[1]!;
      const block = { label: subsection, defaults: {} as Fields };
      section.subsections.push(block);
      defaultsTarget = block.defaults;
      continue;
    }

    if (defaultsTarget) {
      const kv = INDENTED_KV_RE.exec(line);
      if (kv) {
        const key = kv[1]!;
        if (key in defaultsTarget) throw new DataFormatError(file, n, `default "${key}" repeats`);
        defaultsTarget[key] = kv[2]!.trim();
        lastKey = key;
        continue;
      }
      if (/^\s{3,}\S/.test(line) && lastKey) {
        defaultsTarget[lastKey] += " " + line.trim();
        continue;
      }
      throw new DataFormatError(file, n, `unexpected line in defaults block: ${line}`);
    }

    if (record) {
      if (/^\s/.test(line)) {
        if (!lastKey) throw new DataFormatError(file, n, "continuation line with no key");
        record.fields[lastKey] += " " + line.trim();
        continue;
      }
      const kv = KV_RE.exec(line);
      if (!kv) throw new DataFormatError(file, n, `unexpected line in record ${record.id}: ${line}`);
      const key = kv[1]!;
      if (key in record.fields) throw new DataFormatError(file, n, `key "${key}" repeats in ${record.id}`);
      record.fields[key] = kv[2]!.trim();
      lastKey = key;
      continue;
    }

    const kv = KV_RE.exec(line);
    if (kv && kv[1] === "id") {
      const id = kv[2]!.trim();
      record = { id, fields: { id }, section: section.name, line: n };
      if (subsection !== undefined) record.subsection = subsection;
      lastKey = "id";
      continue;
    }
    if (kv) throw new DataFormatError(file, n, `record does not start with "id:": ${line}`);
    section.notes.push(line.trim());
  }
  closeAll();
  return { preamble: preamble.join("\n"), sections, hasEndMarker };
}

/** A record's own fields layered over its section and subsection defaults. */
export function withDefaults(file: RawFile, rec: RawRecord): Fields {
  const section = file.sections.find((s) => s.name === rec.section);
  const sub = section?.subsections.find((s) => s.label === rec.subsection);
  return { ...(section?.defaults ?? {}), ...(sub?.defaults ?? {}), ...rec.fields };
}

/** Split "a, b, c" into trimmed, non-empty parts. */
export function splitList(value: string, sep = ","): string[] {
  return value
    .split(sep)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
