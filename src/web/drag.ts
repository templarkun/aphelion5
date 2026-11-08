/**
 * Drag targets for a Mecha (Program Spec "Interaction and animation",
 * "What can be dragged"): blue sectors or units to move it, red units to
 * Attack. The screen never decides what is legal: each of the Mecha's
 * actions on the action menu is tried on a copy of the game (the engine is
 * pure), and the question that follows gives the targets. Dropping on a
 * target sends exactly the answers a tap player would give.
 *
 * Nothing hidden is shown: an action is offered for dragging only if
 * trying it shows no new hidden information before its target is chosen.
 */

import type { GameData } from "../data/index.js";
import { newEvents } from "../engine/events.js";
import { sectorOf, strength } from "../engine/field.js";
import type { Answer, Question } from "../engine/questions.js";
import { type Game, playAnswer } from "../engine/save.js";

export type DragKind = "move" | "attack";

export interface DragTarget {
  /** The sector the piece is dropped on. */
  sector: string;
  kind: DragKind;
  /** The answers sent on a drop here, in order. */
  answers: Answer[];
  /** M_03 / M_06: after this (blue) target, the Mecha stays lifted for its Attack. */
  next?: () => DragPlan | undefined;
}

export interface DragPlan {
  tile: string;
  unitId: string;
  /** Where the piece starts (and its tether is tied). */
  from: string;
  /** The hit an Attack deals ("−3" on the target). */
  hit?: number | undefined;
  targets: DragTarget[];
}

const asUnits = (q: Question) => q.kind === "units" && q.min === 1 && q.max === 1;
const asSectors = (q: Question) => q.kind === "sectors" && q.min === 1 && q.max === 1;

/** Targets for the question that follows `answers` (one level), or from what happened when nothing was asked. */
function targetsAfter(data: GameData, game: Game, tile: string, answers: Answer[], kind: DragKind, depth: number): DragTarget[] {
  let g = game;
  for (const a of answers) {
    const r = playAnswer(data, g, a);
    if (r.result.status === "illegal" || r.result.status === "blocked") return [];
    g = r.game;
  }
  const before = game.view.state;
  const after = g.view.state;
  const s = g.view.state;
  if (g.view.status === "question" && after.hiddenInfo === before.hiddenInfo) {
    const q = g.view.question;
    if (asSectors(q) && q.kind === "sectors") return q.options.map((k) => ({ sector: k, kind, answers: [...answers, { kind: "sectors", value: [k] }] }));
    if (asUnits(q) && q.kind === "units")
      return q.options.flatMap((u) => {
        const k = sectorOf(s, u);
        return k ? [{ sector: k, kind, answers: [...answers, { kind: "units", value: [u] } as Answer] }] : [];
      });
    if (q.kind === "option" && !q.facing && q.options.some((o) => o.on)) {
      const out: DragTarget[] = [];
      for (const o of q.options) {
        if (!o.on) continue;
        const k = o.on.kind === "sector" ? o.on.key : o.on.kind === "unit" ? sectorOf(s, o.on.id) : undefined;
        if (!k) continue;
        const ans = [...answers, { kind: "option", value: o.id } as Answer];
        // M_03 / M_06 (designer 2026-11-04): "attack:<unit>" Attacks now; the others are the Passive first.
        if (kind === "attack" && !o.id.startsWith("attack:") && depth === 0) {
          out.push({
            sector: k,
            kind: "move",
            answers: ans,
            next: () => {
              const t = targetsAfter(data, game, tile, ans, "attack", 1);
              return t.length ? { tile, unitId: "", from: k, targets: t.filter((x) => x.kind === "attack") } : undefined;
            },
          });
        } else out.push({ sector: k, kind, answers: ans });
      }
      return out;
    }
  }
  // A choice with no place on the board (M_05 Jump: a direction): try each; where the Mecha lands is its target.
  if (g.view.status === "question" && after.hiddenInfo === before.hiddenInfo && kind === "move" && depth === 0) {
    const q = g.view.question;
    if (q.kind === "option" && !q.facing && !q.shortcuts && !q.options.some((o) => o.on))
      return q.options.flatMap((o) => targetsAfter(data, game, tile, [...answers, { kind: "option", value: o.id }], kind, 1).filter((t) => t.answers.length === answers.length + 1));
  }
  // Nothing asked (one legal target, answered by itself): read where it went from what happened.
  if (after.hiddenInfo !== before.hiddenInfo && g.view.status === "question") return [];
  const ev = newEvents(before.events, after.events);
  if (kind === "move") {
    const m = ev.find((e) => e.kind === "moved" && e.tile === tile);
    return m && m.kind === "moved" ? [{ sector: m.to, kind, answers }] : [];
  }
  const h = ev.find((e) => e.kind === "hit" && e.tile !== tile);
  return h && h.kind === "hit" ? [{ sector: h.sector, kind, answers }] : [];
}

/** The drag plan for a Mecha on the action menu, or undefined when it cannot be dragged now. */
export function mechaDragPlan(data: GameData, game: Game, view: Game["view"], tile: string): DragPlan | undefined {
  if (view.status !== "question" || view.question.kind !== "option" || !view.question.shortcuts) return undefined;
  // Only from the real board (not a facing still being turned).
  if (view !== game.view) return undefined;
  const prefix = `mecha:${tile}:`;
  const opts = view.question.shortcuts.filter((o) => o.id.startsWith(prefix) && !o.id.endsWith(":scrap"));
  if (opts.length === 0) return undefined;
  const from = sectorOf(view.state, tile);
  if (!from) return undefined;
  const targets: DragTarget[] = [];
  for (const o of opts) {
    const kind: DragKind = o.id.endsWith(":attack") ? "attack" : "move";
    for (const t of targetsAfter(data, game, tile, [{ kind: "option", value: o.id }], kind, 0)) {
      // One gesture per place: the first action that reaches it wins (Attack before abilities, as on the menu).
      if (t.sector !== from && !targets.some((x) => x.sector === t.sector)) targets.push(t);
    }
  }
  if (targets.length === 0) return undefined;
  const st = view.state.tiles[tile];
  return { tile, unitId: st?.unitId ?? "?", from, hit: strength({ data, state: view.state }, tile), targets };
}
