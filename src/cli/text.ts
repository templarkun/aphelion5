/**
 * The text-only interface of the first playable build (stage 4): turns the
 * game state and the current question into plain text, and the player's
 * typed line into an answer. No rules here: the engine decides what is
 * legal, this file only shows it.
 *
 * Hidden information stays hidden (spec "Player choices"): a face-down tile
 * shows as "?", unless the player has looked at it ("known").
 */

import type { GameData } from "../data/index.js";
import { describe, level, sectorKeys, sectorState, stack, strength, tile, topTileId } from "../engine/field.js";
import { moduleDef } from "../engine/modules.js";
import { objectiveText } from "./objective.js";
import type { Answer, Question } from "../engine/questions.js";
import type { GameState, TileId, Tokens } from "../engine/state.js";
import { fromKey } from "../geometry/hex.js";

const ctx = (data: GameData, state: GameState) => ({ data, state });

export function tokenText(t: Tokens): string {
  const parts: string[] = [];
  if (t.wreck) parts.push("WRECK");
  if (t.alert) parts.push("ALERT");
  if (t.damage) parts.push(`D${t.damage}`);
  if (t.shield) parts.push(`S${t.shield}`);
  if (t.bioShield) parts.push(`BS${t.bioShield}`);
  if (t.barrier) parts.push("BAR");
  if (t.tick) parts.push(`TICK${t.tick > 1 ? t.tick : ""}`);
  if (t.mortar) parts.push(`MORTAR${t.mortar > 1 ? t.mortar : ""}`);
  if (t.feedback) parts.push(`FB${t.feedback > 1 ? t.feedback : ""}`);
  return parts.length ? `[${parts.join(" ")}]` : "";
}

/** What the player may see of one tile. */
function seenName(state: GameState, id: TileId): string {
  const t = tile(state, id);
  if (t.faceUp) return t.unitId ?? "?";
  return state.seen.includes(id) ? `?(${t.unitId})` : "?";
}

/** One sector in one line: state, top unit with Strength and tokens, stack height. */
export function sectorLine(data: GameData, state: GameState, k: string): string {
  const c = ctx(data, state);
  const st = stack(state, k);
  const s = sectorState(state, k);
  const where = `(${k})`.padEnd(8);
  if (s === "cleared") return `${where} Cleared`;
  const below = st.length - 1;
  const rest = below > 0 ? `, ${below} tile${below === 1 ? "" : "s"} beneath${st.slice(0, -1).some((x) => tile(state, x).faceUp || state.seen.includes(x)) ? ` (${[...st.slice(0, -1)].reverse().map((x) => seenName(state, x)).join(" > ")})` : ""}` : ", alone on its plate";
  if (s === "dark") return `${where} Dark: ${seenName(state, topTileId(state, k)!)}${rest}`;
  const u = topTileId(state, k)!;
  const str = strength(c, u);
  const lvl = level(c, u);
  const facing = tile(state, u).facing ? ` facing ${tile(state, u).facing}` : "";
  const stats = str !== undefined ? ` Strength ${str} (Level ${lvl})` : "";
  const tokens = tokenText(tile(state, u).tokens);
  return `${where} ${tile(state, u).unitId}${stats}${facing}${tokens ? ` ${tokens}` : ""}${rest}`;
}

/** The Field as a hex picture: horizontal rows (same q) top to bottom, shifted half a cell per q (Core Rules 3.8). */
export function fieldPicture(data: GameData, state: GameState): string {
  const keys = sectorKeys(state);
  const coords = keys.map((k) => ({ k, ...fromKey(k) }));
  const qs = [...new Set(coords.map((c) => c.q))].sort((a, b) => b - a);
  const xOf = (c: { q: number; r: number }) => 2 * c.r + c.q;
  const minX = Math.min(...coords.map(xOf));
  const cellW = 5;
  const lines: string[] = [];
  for (const q of qs) {
    const row = coords.filter((c) => c.q === q).sort((a, b) => a.r - b.r);
    let line = "";
    for (const c of row) {
      const col = (xOf(c) - minX) * cellW;
      const st = sectorState(state, c.k);
      const label =
        st === "cleared" ? "  .  " : st === "dark" ? `  ?${stack(state, c.k).length} ` : `${(tile(state, topTileId(state, c.k)!).unitId ?? "?").padEnd(4)}${tile(state, topTileId(state, c.k)!).tokens.alert ? "!" : " "}`;
      line = line.padEnd(col) + `[${label}]`;
    }
    lines.push(line);
  }
  void data;
  return lines.join("\n");
}

export function renderState(data: GameData, state: GameState): string {
  const c = ctx(data, state);
  const co = data.companies.byId.get(state.player.company)!;
  const phase = { command: "Command phase", overload: "OVERLOAD", overloadEnd: "Overload End", missionEnd: "Mission End", gameEnd: "Game End", setup: "Setup", preparation: "Mission Preparation" }[state.phase];
  const out: string[] = [];
  out.push(`=== ${state.mission} - ${phase} ===   Objective: ${objectiveText(c)}`);
  out.push(fieldPicture(data, state));
  out.push("  ([X ] = unit on top, ! = Alert, ?N = Dark sector with N tiles, . = Cleared)");
  for (const k of sectorKeys(state)) out.push("  " + sectorLine(data, state, k));
  const crippled = state.flagship.every((x) => x === 0) ? "  CRIPPLED" : "";
  out.push(`Flagship ${co.name}: ${state.flagship.map((x, i) => `Bay ${i + 1} ${x}/${co.bays[i]!.integrity}`).join(", ")}${crippled}. Overhaul slots used ${state.sheet.overhaulUsed}/${co.overhaulSlots}.`);
  const r = state.player.reserve;
  out.push(`Reserve: Yellow ${r.Yellow}, Red ${r.Red}, Blue ${r.Blue}. Command tokens ${state.player.commandTokens}. Upgrade points ${state.sheet.upgradePoints}.`);
  const mods = state.player.modules.map((m) => {
    const d = moduleDef(c, m.id);
    const e = Object.entries(m.energy).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`);
    return `${d.name} (${d.cost} ${d.colour}, ${d.background === "red" ? "Overload" : "Command phase"}, ${m.ready ? "ready" : "exhausted"}${e.length ? `, holds ${e.join(" ")}` : ""})`;
  });
  out.push(`Modules: ${mods.length ? mods.join("; ") : "none"}.`);
  const anomalies = state.player.anomalies.map((id) => `${id} "${data.anomalies.byId.get(id)!.text}"`);
  out.push(`Anomaly cards: ${anomalies.length ? anomalies.join("; ") : "none"}.`);
  const trophy = new Map<string, number>();
  for (const id of state.piles.trophy) trophy.set(tile(state, id).unitId!, (trophy.get(tile(state, id).unitId!) ?? 0) + 1);
  out.push(`Trophy pile: ${trophy.size ? [...trophy].map(([u, n]) => `${n} ${u}`).join(", ") : "empty"}. Discard: ${state.piles.discard.length} tiles.`);
  return out.join("\n");
}

/** The question in plain words with numbered answers, and how to type an answer. */
export function renderQuestion(data: GameData, state: GameState, q: Question): string {
  const c = ctx(data, state);
  const out = [`${q.prompt}  (rule ${q.rule})`];
  switch (q.kind) {
    case "option":
    case "order":
      q.options.forEach((o, i) => out.push(`  ${i + 1}. ${o.label}`));
      out.push("Type a number.");
      break;
    case "units":
      q.options.forEach((u, i) => out.push(`  ${i + 1}. ${describe(c, u)}${strength(c, u) !== undefined ? ` (Strength ${strength(c, u)})` : ""} ${tokenText(tile(state, u).tokens)}`.trimEnd()));
      out.push(chooseHint(q.min, q.max));
      break;
    case "sectors":
      q.options.forEach((k, i) => out.push(`  ${i + 1}. ${sectorLine(data, state, k).replace(/ +/g, " ")}`));
      out.push(chooseHint(q.min, q.max));
      break;
    case "amount":
      out.push(`Type a number from ${q.min} to ${q.max}.`);
      break;
    case "split":
      q.buckets.forEach((b, i) => out.push(`  ${i + 1}. ${b.label} (up to ${b.max})`));
      out.push(q.buckets.length === 1 ? `Type ${q.total}.` : `Type ${q.buckets.length} numbers adding up to ${q.total}, in this order (for example "${exampleSplit(q.total, q.buckets.map((b) => b.max))}").`);
      break;
    case "yesno":
      out.push("Type y or n.");
      break;
  }
  return out.join("\n");
}

function chooseHint(min: number, max: number): string {
  if (min === max) return min === 1 ? "Type a number." : `Type ${min} numbers separated by spaces.`;
  return `Type ${min} to ${max} numbers separated by spaces${min === 0 ? " (or just press Enter for none)" : ""}.`;
}

function exampleSplit(total: number, maxes: number[]): string {
  let left = total;
  return maxes
    .map((m) => {
      const x = Math.min(m, left);
      left -= x;
      return x;
    })
    .join(" ");
}

/** Read a typed line as an answer to `q`. Returns an error sentence instead if it cannot be read. */
export function parseAnswer(q: Question, line: string): Answer | { error: string } {
  const text = line.trim();
  const nums = text === "" ? [] : text.split(/[\s,]+/).map(Number);
  if (nums.some((n) => !Number.isInteger(n))) {
    if (q.kind !== "yesno") return { error: "please type whole numbers" };
  }
  const pick = <T>(list: readonly T[]): T[] | { error: string } => {
    const bad = nums.find((n) => n < 1 || n > list.length);
    if (bad !== undefined) return { error: `${bad} is not on the list (1 to ${list.length})` };
    return nums.map((n) => list[n - 1]!);
  };
  switch (q.kind) {
    case "option":
    case "order": {
      if (nums.length !== 1) return { error: "type one number" };
      const p = pick(q.options);
      return "error" in p ? p : { kind: q.kind, value: p[0]!.id };
    }
    case "units": {
      const p = pick(q.options);
      return "error" in p ? p : { kind: "units", value: p };
    }
    case "sectors": {
      const p = pick(q.options);
      return "error" in p ? p : { kind: "sectors", value: p };
    }
    case "amount":
      if (nums.length !== 1) return { error: "type one number" };
      return { kind: "amount", value: nums[0]! };
    case "split": {
      if (nums.length !== q.buckets.length) return { error: `type ${q.buckets.length} number${q.buckets.length === 1 ? "" : "s"}` };
      return { kind: "split", value: Object.fromEntries(q.buckets.map((b, i) => [b.id, nums[i]!])) };
    }
    case "yesno":
      if (/^y(es)?$/i.test(text)) return { kind: "yesno", value: true };
      if (/^no?$/i.test(text)) return { kind: "yesno", value: false };
      return { error: "type y or n" };
  }
}

/** The newest log lines, with rule references. */
export function renderLog(state: GameState, from: number): string {
  return state.log
    .slice(from)
    .map((e) => `  - ${e.text}${e.rule ? `  [${e.rule}]` : ""}`)
    .join("\n");
}
