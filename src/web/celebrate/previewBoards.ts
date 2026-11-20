/**
 * The made-up Mission 1 boards of the celebration preview (System options, designer 2026-11-20): Mission 1
 * dealt as in a game, then units placed for the picture, five Alphas already in the Trophy pile, the sixth
 * on the Field. A picture only: no game is played or touched. Also used by the tests.
 */

import type { GameData } from "../../data/index.js";
import type { GameEvent, GameEventBody } from "../../engine/events.js";
import type { Answer, Question } from "../../engine/questions.js";
import { type Game, playAnswer, startGame } from "../../engine/save.js";
import { type GameState, type TileId, emptyProfile, noTokens } from "../../engine/state.js";
import { key } from "../../geometry/hex.js";
import { applyLoadout } from "../briefing/launch.js";

export const PREVIEW_SEED = 20261120;

/** A first legal answer, to reach the Command phase of Mission 1 (only for the preview's board). */
function firstAnswer(q: Question): Answer {
  switch (q.kind) {
    case "option":
      return { kind: "option", value: q.options[0]!.id };
    case "order":
      return { kind: "order", value: q.options[0]!.id };
    case "several":
      return { kind: "several", value: q.options.slice(0, q.min).map((o) => o.id) };
    case "units":
      return { kind: "units", value: q.options.slice(0, q.min) };
    case "sectors":
      return { kind: "sectors", value: q.options.slice(0, q.min) };
    case "amount":
      return { kind: "amount", value: q.min };
    case "yesno":
      return { kind: "yesno", value: true };
    case "split": {
      const value: Record<string, number> = Object.fromEntries(q.buckets.map((b) => [b.id, 0]));
      let left = q.total;
      for (const b of q.buckets) {
        const n = Math.min(b.max, left);
        value[b.id] = n;
        left -= n;
      }
      return { kind: "split", value };
    }
  }
}

export interface PreviewBoards {
  start: GameState;
  kill: GameState;
  won: GameState;
  /** The kill and the win in one answer. */
  wonJoined: GameState;
}

/** The made-up boards: Mission 1 dealt as in a game, then units placed for the picture. */
export function previewBoards(data: GameData, company: string): PreviewBoards | undefined {
  let g: Game = startGame(data, { seed: PREVIEW_SEED, date: "2026-11-20", profile: emptyProfile(), developerMode: false, autoAnswer: true });
  g = applyLoadout(data, g, { campaign: "C1", company, freshness: "fresh", expansions: [], developerMode: false, seed: PREVIEW_SEED });
  for (let i = 0; i < 80 && g.view.status === "question" && g.view.state.phase !== "command"; i++) {
    const r = playAnswer(data, g, firstAnswer(g.view.question));
    if (r.result.status === "illegal" || r.result.status === "blocked") return undefined;
    g = r.game;
  }
  if (g.view.state.phase !== "command") return undefined;
  const s = structuredClone(g.view.state);
  const used = new Set<TileId>();
  const take = (unitId: string): TileId | undefined => {
    const piles = [s.piles.missionDeck, s.piles.supply, s.piles.energyDeck, s.piles.discard];
    for (const p of piles) {
      const i = p.findIndex((t) => s.tiles[t]?.unitId === unitId && !used.has(t));
      if (i >= 0) return used.add(p[i]!), p.splice(i, 1)[0];
    }
    for (const st of Object.values(s.field)) {
      const i = st.findIndex((t) => s.tiles[t]?.unitId === unitId && !used.has(t));
      if (i >= 0) return used.add(st[i]!), st.splice(i, 1)[0];
    }
    return undefined;
  };
  const place = (q: number, r: number, unitId: string): TileId | undefined => {
    const t = take(unitId);
    const k = key({ q, r });
    if (t === undefined || !s.field[k]) return undefined;
    s.tiles[t] = { ...s.tiles[t]!, faceUp: true, facing: 0, tokens: noTokens() };
    s.field[k]!.push(t);
    return t;
  };
  // Five Alphas already destroyed this mission.
  for (let i = 0; i < 5; i++) {
    const t = take("O_01");
    if (t === undefined) return undefined;
    s.tiles[t] = { ...s.tiles[t]!, faceUp: true, tokens: noTokens() };
    s.piles.trophy.push(t);
  }
  const alpha = place(0, 1, "O_01");
  place(1, -1, "O_01");
  const mecha = place(-1, 0, "M_07");
  const sentinel = place(1, 1, "S_12");
  place(0, 0, "B_02");
  place(-1, 2, "G_20");
  // A Cleared sector.
  const cleared = key({ q: 0, r: -1 });
  if (s.field[cleared]) {
    s.piles.discard.push(...s.field[cleared]!.filter((t) => !used.has(t)));
    s.field[cleared] = [];
  }
  if (alpha === undefined || mecha === undefined || sentinel === undefined) return undefined;
  if (s.tiles[sentinel]) s.tiles[sentinel]!.tokens.shield = 1;
  s.seen = [];
  const at = key({ q: 0, r: 1 });
  const nextSeq = (st: GameState) => (st.events?.at(-1)?.seq ?? 0) + 1;
  const withEvents = (st: GameState, bodies: GameEventBody[]): GameState => {
    let n = nextSeq(st);
    st.events = [...(st.events ?? []), ...bodies.map((b) => ({ ...b, seq: n++ }) as GameEvent)];
    return st;
  };
  const hit: GameEventBody = { kind: "hit", tile: alpha, unitId: "O_01", type: "Omega", sector: at, amount: 2, damage: 2, shields: 0, rule: "M_07" };
  const destroyed: GameEventBody = { kind: "destroyed", tile: alpha, unitId: "O_01", type: "Omega", sector: at, wreck: true };
  const resolved: GameEventBody[] = [
    { kind: "activated", tile: alpha, unitId: "O_01", type: "Omega", sector: at, how: "alert", wreck: true },
    { kind: "tokens", tile: sentinel, unitId: "S_12", sector: key({ q: 1, r: 1 }), change: "shield", n: 1, boost: true, rule: "O_01" },
    { kind: "won" },
  ];
  // After the kill: a Wreck with its Alert (4.8).
  const kill = withEvents(structuredClone(s), [hit, destroyed]);
  kill.tiles[alpha]!.tokens = { ...noTokens(), wreck: true, alert: true };
  // After the Wreck resolves (Boost the Sentinel next to it): the sixth Alpha in the Trophy pile; the mission is won.
  const wonFrom = (base: GameState, bodies: GameEventBody[]): GameState => {
    const w = withEvents(structuredClone(base), bodies);
    w.field[at] = w.field[at]!.filter((t) => t !== alpha);
    w.tiles[alpha]!.tokens = noTokens();
    w.piles.trophy.push(alpha);
    w.tiles[sentinel]!.tokens.shield = 2;
    w.phase = "missionEnd";
    return w;
  };
  return { start: s, kill, won: wonFrom(kill, resolved), wonJoined: wonFrom(s, [hit, destroyed, ...resolved]) };
}
