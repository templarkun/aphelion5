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
import { view as sessionView } from "../engine/session.js";

export type DragKind = "move" | "attack";

export interface DragTarget {
  /** The sector the piece is dropped on. */
  sector: string;
  kind: DragKind;
  /** The answers sent on a drop here, in order. */
  answers: Answer[];
  /** M_06: after this (blue) target, the Mecha stays lifted for its Attack. M_03 (with `via`): the sectors it may move to first. */
  next?: () => DragPlan | undefined;
  /** M_03 (designer 2026-11-08): a red target reached by moving first; the move plays before the Attack. */
  via?: boolean;
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
      // M_03 (designer 2026-11-08): every unit it can Attack, now or after its Passive move, is red at once.
      if (kind === "attack" && depth === 0 && q.options.some((o) => o.id.startsWith("move:"))) {
        const direct = new Set<string>();
        for (const o of q.options) {
          if (!o.id.startsWith("attack:") || o.on?.kind !== "unit") continue;
          const k = sectorOf(s, o.on.id);
          if (k) {
            direct.add(k);
            out.push({ sector: k, kind, answers: [...answers, { kind: "option", value: o.id }] });
          }
        }
        // Targets after each possible move, grouped by target: one way there goes at once; several: tap where to move.
        const ways = new Map<string, DragTarget[]>();
        for (const o of q.options) {
          if (!o.id.startsWith("move:") || o.on?.kind !== "sector") continue;
          const mv = o.on.key;
          for (const t of targetsAfter(data, game, tile, [...answers, { kind: "option", value: o.id }], "attack", 1)) {
            if (direct.has(t.sector)) continue;
            ways.set(t.sector, [...(ways.get(t.sector) ?? []), { ...t, sector: mv, kind: "move" }]);
          }
        }
        for (const [k, w] of ways) {
          if (w.length === 1) out.push({ sector: k, kind, answers: w[0]!.answers, via: true });
          else out.push({ sector: k, kind, answers: [], via: true, next: () => ({ tile, unitId: "", from: k, targets: w }) });
        }
        return out;
      }
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

/**
 * M_03's Attack question, answered by tapping (designer 2026-11-08): every unit it can
 * Attack now or after its move, with the answers from this question on.
 */
export function m03TapTargets(data: GameData, game: Game): DragTarget[] {
  const v = game.view;
  if (v.status !== "question" || v.question.kind !== "option" || !v.question.options.some((o) => o.id.startsWith("move:"))) return [];
  return targetsAfter(data, game, "", [], "attack", 0);
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

/**
 * Targets for dragging a Bay or an Order onto the Field (designer 2026-11-08): only when using it
 * asks next for one unit or one sector (and shows nothing hidden first). Dropping sends both answers.
 * One legal target (answered by itself): found with automatic answers off, and the drop sends only the first.
 */
export function abilityTargets(data: GameData, game: Game, first: Answer): { sector: string; answers: Answer[] }[] {
  const now = targetsOf(data, game, first, true);
  if (now.length) return now;
  const v = game.view;
  if (v.status !== "question" || !v.state.settings.autoAnswer) return [];
  const e = v.session.engine;
  let manual: Game;
  try {
    const off = { ...e.checkpoint, settings: { ...e.checkpoint.settings, autoAnswer: false } };
    manual = { ...game, view: sessionView(data, { ...v.session, engine: { ...e, checkpoint: off } }) };
  } catch {
    return [];
  }
  const one = targetsOf(data, manual, first, false);
  return one.length === 1 ? one : [];
}

function targetsOf(data: GameData, game: Game, first: Answer, both: boolean): { sector: string; answers: Answer[] }[] {
  const r = playAnswer(data, game, first);
  if (r.result.status === "illegal" || r.result.status === "blocked") return [];
  const v = r.game.view;
  if (v.status !== "question" || v.state.hiddenInfo !== game.view.state.hiddenInfo) return [];
  const q = v.question;
  const ans = (a: Answer): Answer[] => (both ? [first, a] : [first]);
  if (asSectors(q) && q.kind === "sectors") return q.options.map((k) => ({ sector: k, answers: ans({ kind: "sectors", value: [k] }) }));
  if (asUnits(q) && q.kind === "units")
    return q.options.flatMap((u) => {
      const k = sectorOf(v.state, u);
      return k ? [{ sector: k, answers: ans({ kind: "units", value: [u] }) }] : [];
    });
  return [];
}

/** What an action would affect: sectors on the Field and Modules (designer 2026-11-08). */
export interface Affects {
  sectors: string[];
  modules: number[];
}

/**
 * What running an action (a Module, a Bay, an Order) would affect, tried on a
 * copy of the game: the plan answers its own questions (`answerFor`); then the
 * first question it asks names its targets (units, sectors, rows, Modules), or,
 * with none, what changed (hits, moves, swaps, energy on Modules, Modules made
 * ready or exhausted). Nothing if it would show new hidden information.
 * `self`: the Module being run (its own payment is not an effect).
 */
export function actionAffects(data: GameData, game: Game, first: Answer, answerFor: (q: Question) => Answer | undefined, self?: number): Affects {
  const none: Affects = { sectors: [], modules: [] };
  const start = game.view;
  if (start.status !== "question") return none;
  const hidden = start.state.hiddenInfo;
  let r = playAnswer(data, game, first);
  if (r.result.status === "illegal" || r.result.status === "blocked") return none;
  let g = r.game;
  for (let i = 0; i < 8; i++) {
    const v = g.view;
    if (v.status !== "question" || v.state.hiddenInfo !== hidden) break;
    const a = answerFor(v.question);
    if (!a) break;
    r = playAnswer(data, g, a);
    if (r.result.status === "illegal" || r.result.status === "blocked") return none;
    g = r.game;
  }
  const v = g.view;
  if (v.state.hiddenInfo !== hidden) return none;
  const s = v.state;
  const out = new Set<string>();
  const mods = new Set<number>();
  const add = (k: string | undefined) => k && s.field[k] && out.add(k);
  const addM = (m: string | number) => {
    const n = Number(m);
    if (Number.isInteger(n) && n !== self && s.player.modules.some((x) => x.id === n)) mods.add(n);
  };
  if (v.status === "question" && !v.question.shortcuts) {
    const q = v.question;
    if (q.kind === "units") q.options.forEach((u) => add(sectorOf(s, u)));
    else if (q.kind === "sectors") q.options.forEach(add);
    else if (q.kind === "option" || q.kind === "order") {
      if (q.rows) q.rows.flat().forEach(add);
      for (const o of q.options) add(o.on?.kind === "unit" ? sectorOf(s, o.on.id) : o.on?.kind === "sector" ? o.on.key : undefined);
      if (q.pick === "modules" || q.energy || q.takeEnergy) for (const o of q.options) addM(o.id);
    } else if (q.kind === "split" && q.pick === "modules") q.buckets.forEach((b) => addM(b.id));
    if (out.size || mods.size) return { sectors: [...out], modules: [...mods] };
  }
  for (const e of newEvents(start.state.events, s.events)) {
    if (e.kind === "hit" || e.kind === "destroyed") add(e.sector);
    else if (e.kind === "moved") add(e.to);
    else if (e.kind === "swapped") (add(e.from), add(e.to));
  }
  // Modules whose energy or ready state changed (other than the one being run).
  for (const m of s.player.modules) {
    const b = start.state.player.modules.find((x) => x.id === m.id);
    if (!b || b.ready !== m.ready || b.energy.Yellow !== m.energy.Yellow || b.energy.Red !== m.energy.Red || b.energy.Blue !== m.energy.Blue) addM(m.id);
  }
  return { sectors: [...out], modules: [...mods] };
}
