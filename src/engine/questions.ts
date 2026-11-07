/**
 * The choice interface (spec "Player choices"). Whenever a rule needs a
 * choice, the engine stops and asks ONE question carrying the complete set
 * of legal answers (or, for splits and amounts, the exact limits).
 * The same format serves the UI, the test harness and automatic players.
 */

import type { SectorKey, TileId } from "./state.js";

interface Base {
  /** Plain-words prompt for the player. */
  prompt: string;
  /** Rule section that asks, e.g. "6.3". */
  rule: string;
  /** Always ask, even when only one answer is legal (choices the designer wants shown, e.g. the Campaign). */
  always?: boolean;
  /**
   * What the option ids (or split buckets) name, so the screen can let the
   * player click those things: "modules" = ids are Module numbers, "bays" =
   * "bay1".."bayN", "units" = tile ids, "reserve" = energy colours of your
   * Reserve. Ids that name nothing stay buttons.
   */
  pick?: "modules" | "bays" | "units" | "reserve";
  /**
   * Action menus only (8.1, 9.2): every action spelled out to its target in
   * one answer ("this Mecha: Attack", "Reveal this sector", "run this
   * Module"). Answering with a shortcut id is the same as the menu entry
   * followed by the choices it names.
   */
  shortcuts?: Option[];
  /**
   * A facing question (3.7): option ids are facings "0".."5" for this tile.
   * The screen shows rotate buttons on the unit instead of a list; `start` is
   * the facing it shows first.
   */
  facing?: { tile: TileId; start: number };
  /**
   * A row question: `rows[i]` holds the sectors of option i. The screen lets
   * the player click a row on the Field and confirm it in a pop-up.
   */
  rows?: SectorKey[][];
  /**
   * An energy question (5.3): option id -> the colour of the one energy that
   * answer places. Module ids put it on that Module; "supply:<colour>" sends
   * it back to the Supply. The screen shows a pop-up by each Module.
   */
  energy?: Record<string, "Yellow" | "Red" | "Blue">;
}

/** A thing on the screen an option belongs to. */
export type Target =
  | { kind: "unit"; id: TileId }
  | { kind: "sector"; key: SectorKey }
  | { kind: "module"; id: number }
  | { kind: "bay"; bay: number; ability: string }
  | { kind: "order"; id: string }
  /** Buttons of the game itself (Overhaul, Concede, End the Overload, Heat Wave). */
  | { kind: "game" };

export interface Option {
  id: string;
  label: string;
  on?: Target;
}

export type Question =
  /** Choose between `min` and `max` different units. */
  | (Base & { kind: "units"; options: TileId[]; min: number; max: number })
  /** Choose between `min` and `max` different sectors. */
  | (Base & { kind: "sectors"; options: SectorKey[]; min: number; max: number })
  /** Pick one listed option ("Choose one:", ties, a Level, a row...). */
  | (Base & { kind: "option"; options: Option[] })
  /** Pick between `min` and `max` different listed options (Threat columns). */
  | (Base & { kind: "several"; options: Option[]; min: number; max: number })
  /** Pick which waiting item goes next (simultaneous triggers, Fuse tokens). */
  | (Base & { kind: "order"; options: Option[] })
  /** A whole number within limits. */
  | (Base & { kind: "amount"; min: number; max: number })
  /** Split `total` into buckets, each from 0 to its max. */
  | (Base & { kind: "split"; total: number; buckets: (Option & { max: number })[] })
  | (Base & { kind: "yesno" });

export type Answer =
  | { kind: "units"; value: TileId[] }
  | { kind: "sectors"; value: SectorKey[] }
  | { kind: "option"; value: string }
  | { kind: "order"; value: string }
  | { kind: "several"; value: string[] }
  | { kind: "amount"; value: number }
  | { kind: "split"; value: Record<string, number> }
  | { kind: "yesno"; value: boolean };

/** Why an answer is not legal, or undefined if it is. */
export function invalidReason(q: Question, a: Answer): string | undefined {
  if (q.kind !== a.kind) return `expected a ${q.kind} answer, got ${a.kind}`;
  switch (q.kind) {
    case "units":
    case "sectors": {
      const v = a.value as string[];
      if (new Set(v).size !== v.length) return "the same choice is listed twice";
      if (v.length < q.min || v.length > q.max) return `choose ${q.min === q.max ? q.min : `${q.min} to ${q.max}`}, got ${v.length}`;
      const bad = v.find((x) => !(q.options as string[]).includes(x));
      return bad === undefined ? undefined : `${bad} is not a legal choice`;
    }
    case "option":
    case "order":
      return q.options.some((o) => o.id === a.value) || (q.shortcuts ?? []).some((o) => o.id === a.value) ? undefined : `${String(a.value)} is not a legal choice`;
    case "several": {
      const v = a.value as string[];
      if (new Set(v).size !== v.length) return "the same choice is listed twice";
      if (v.length < q.min || v.length > q.max) return `choose ${q.min === q.max ? q.min : `${q.min} to ${q.max}`}, got ${v.length}`;
      const bad = v.find((x) => !q.options.some((o) => o.id === x));
      return bad === undefined ? undefined : `${bad} is not a legal choice`;
    }
    case "amount": {
      const n = a.value as number;
      return Number.isInteger(n) && n >= q.min && n <= q.max ? undefined : `choose a whole number from ${q.min} to ${q.max}`;
    }
    case "split": {
      const v = a.value as Record<string, number>;
      let sum = 0;
      for (const [id, n] of Object.entries(v)) {
        const b = q.buckets.find((x) => x.id === id);
        if (!b) return `${id} is not a legal choice`;
        if (!Number.isInteger(n) || n < 0 || n > b.max) return `${b.label}: from 0 to ${b.max}`;
        sum += n;
      }
      return sum === q.total ? undefined : `the split must add up to ${q.total}, got ${sum}`;
    }
    case "yesno":
      return typeof a.value === "boolean" ? undefined : "answer yes or no";
  }
}

function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** How many legal answers there are (capped; only "0, 1 or more" matters). */
export function legalAnswerCount(q: Question): number {
  switch (q.kind) {
    case "units":
    case "sectors":
    case "several": {
      let n = 0;
      for (let k = q.min; k <= Math.min(q.max, q.options.length); k++) n += binom(q.options.length, k);
      return n;
    }
    case "option":
    case "order":
      return q.options.length;
    case "amount":
      return Math.max(0, q.max - q.min + 1);
    case "split": {
      // Count splits, capped at 2.
      let ways = new Map<number, number>([[0, 1]]);
      for (const b of q.buckets) {
        const next = new Map<number, number>();
        for (const [s, w] of ways) {
          for (let x = 0; x <= b.max && s + x <= q.total; x++) next.set(s + x, Math.min(2, (next.get(s + x) ?? 0) + w));
        }
        ways = next;
      }
      return ways.get(q.total) ?? 0;
    }
    case "yesno":
      return 2;
  }
}

/** The answer when there is exactly one legal answer; otherwise undefined. */
export function onlyAnswer(q: Question): Answer | undefined {
  if (q.always || legalAnswerCount(q) !== 1) return undefined;
  switch (q.kind) {
    case "units":
    case "sectors": {
      // Exactly one legal set: either nothing allowed (min = max = 0) or all options must be taken.
      const value = q.min === 0 && q.max === 0 ? [] : [...q.options];
      return q.kind === "units" ? { kind: "units", value } : { kind: "sectors", value };
    }
    case "several":
      return { kind: "several", value: q.min === 0 && q.max === 0 ? [] : q.options.map((o) => o.id) };
    case "option":
      return { kind: "option", value: q.options[0]!.id };
    case "order":
      return { kind: "order", value: q.options[0]!.id };
    case "amount":
      return { kind: "amount", value: q.min };
    case "split": {
      // The only split: fill each bucket greedily (it is forced).
      const value: Record<string, number> = {};
      let left = q.total;
      for (const b of q.buckets) {
        const x = Math.min(b.max, left);
        value[b.id] = x;
        left -= x;
      }
      return { kind: "split", value };
    }
    case "yesno":
      return undefined;
  }
}
