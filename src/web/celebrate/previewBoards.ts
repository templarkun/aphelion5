/**
 * The made-up boards of the celebration previews (System options, designer 2026-11-20): Mission 1 dealt
 * as in a game, then units placed for the picture. Alpha (Mission 1, Eliminate 6 Alphas): five Alphas
 * already in the Trophy pile, the sixth on the Field. Beta (the same Field, called Mission 3, Eliminate
 * 3 Betas): two Betas in the Trophy pile, the third on the Field. Gamma (the same Field, called Mission 7,
 * Eliminate 2 Gammas): one Gamma in the Trophy pile, the second on the Field. A picture only: no game is
 * played or touched. Also used by the tests.
 */

import type { GameData } from "../../data/index.js";
import type { GameEvent, GameEventBody } from "../../engine/events.js";
import type { Answer, Question } from "../../engine/questions.js";
import { type Game, playAnswer, startGame } from "../../engine/save.js";
import { type GameState, type TileId, emptyProfile, noTokens } from "../../engine/state.js";
import { key } from "../../geometry/hex.js";
import { applyLoadout } from "../briefing/launch.js";

export const PREVIEW_SEED = 20261120;

export type PreviewKind = "kill" | "win" | "both";
/** What the made-up mission is: Eliminate an Omega type, or Salvage. */
export type PreviewOmega = "Alpha" | "Beta" | "Gamma" | "Salvage";
/** One preview button: what plays (the kill piece for "kill" and "both"; the win piece for "win" and "both"). */
export interface PreviewWhat {
  kind: PreviewKind;
  omega: PreviewOmega;
  piece?: string | undefined;
  win?: string | undefined;
  label: string;
}
/** The buttons in System options, in order. */
export const CELEBRATION_PREVIEWS: PreviewWhat[] = [
  { kind: "kill", omega: "Alpha", piece: "alphaDown", label: "Alpha Down" },
  { kind: "kill", omega: "Alpha", piece: "alphaPurge", label: "Alpha Purge" },
  { kind: "kill", omega: "Alpha", piece: "alphaRail", label: "Rail Strike" },
  { kind: "kill", omega: "Alpha", piece: "alphaErase", label: "Alpha Erased" },
  { kind: "win", omega: "Alpha", win: "missionComplete", label: "Mission Complete" },
  { kind: "win", omega: "Alpha", win: "perimeterSweep", label: "Perimeter Sweep" },
  { kind: "win", omega: "Alpha", win: "sectorFlip", label: "Sector Flip" },
  { kind: "win", omega: "Alpha", win: "chainSurge", label: "Chain Surge" },
  { kind: "win", omega: "Alpha", win: "beaconSpiral", label: "Beacon Spiral" },
  { kind: "win", omega: "Alpha", win: "resonance", label: "Resonance" },
  { kind: "win", omega: "Alpha", win: "murmuration", label: "Murmuration" },
  { kind: "both", omega: "Alpha", piece: "alphaDown", win: "missionComplete", label: "Alpha Down, then Mission Complete" },
  { kind: "both", omega: "Alpha", piece: "alphaPurge", win: "missionComplete", label: "Alpha Purge, then Mission Complete" },
  { kind: "both", omega: "Alpha", piece: "alphaRail", win: "missionComplete", label: "Rail Strike, then Mission Complete" },
  { kind: "both", omega: "Alpha", piece: "alphaErase", win: "missionComplete", label: "Alpha Erased, then Mission Complete" },
  { kind: "kill", omega: "Beta", piece: "betaBreach", label: "Beta Breach" },
  { kind: "kill", omega: "Beta", piece: "betaBarrage", label: "Barrage" },
  { kind: "kill", omega: "Beta", piece: "betaCryo", label: "Cryo Shatter" },
  { kind: "win", omega: "Beta", win: "missionComplete", label: "Mission Complete" },
  { kind: "win", omega: "Beta", win: "perimeterSweep", label: "Perimeter Sweep" },
  { kind: "win", omega: "Beta", win: "sectorFlip", label: "Sector Flip" },
  { kind: "win", omega: "Beta", win: "chainSurge", label: "Chain Surge" },
  { kind: "win", omega: "Beta", win: "beaconSpiral", label: "Beacon Spiral" },
  { kind: "win", omega: "Beta", win: "resonance", label: "Resonance" },
  { kind: "win", omega: "Beta", win: "murmuration", label: "Murmuration" },
  { kind: "both", omega: "Beta", piece: "betaBreach", win: "missionComplete", label: "Beta Breach, then Mission Complete" },
  { kind: "both", omega: "Beta", piece: "betaBarrage", win: "missionComplete", label: "Barrage, then Mission Complete" },
  { kind: "both", omega: "Beta", piece: "betaCryo", win: "missionComplete", label: "Cryo Shatter, then Mission Complete" },
  { kind: "kill", omega: "Gamma", piece: "gammaHorizon", label: "Event Horizon" },
  { kind: "kill", omega: "Gamma", piece: "gammaArray", label: "Field Array" },
  { kind: "kill", omega: "Gamma", piece: "gammaShatter", label: "Dimensional Shatter" },
  { kind: "win", omega: "Gamma", win: "missionComplete", label: "Mission Complete" },
  { kind: "win", omega: "Gamma", win: "perimeterSweep", label: "Perimeter Sweep" },
  { kind: "win", omega: "Gamma", win: "sectorFlip", label: "Sector Flip" },
  { kind: "win", omega: "Gamma", win: "chainSurge", label: "Chain Surge" },
  { kind: "win", omega: "Gamma", win: "beaconSpiral", label: "Beacon Spiral" },
  { kind: "win", omega: "Gamma", win: "resonance", label: "Resonance" },
  { kind: "win", omega: "Gamma", win: "murmuration", label: "Murmuration" },
  { kind: "both", omega: "Gamma", piece: "gammaHorizon", win: "missionComplete", label: "Event Horizon, then Mission Complete" },
  { kind: "both", omega: "Gamma", piece: "gammaArray", win: "missionComplete", label: "Field Array, then Mission Complete" },
  { kind: "both", omega: "Gamma", piece: "gammaShatter", win: "missionComplete", label: "Dimensional Shatter, then Mission Complete" },
  { kind: "win", omega: "Salvage", win: "missionComplete", label: "Mission Complete" },
  { kind: "win", omega: "Salvage", win: "perimeterSweep", label: "Perimeter Sweep" },
  { kind: "win", omega: "Salvage", win: "sectorFlip", label: "Sector Flip" },
  { kind: "win", omega: "Salvage", win: "chainSurge", label: "Chain Surge" },
  { kind: "win", omega: "Salvage", win: "beaconSpiral", label: "Beacon Spiral" },
  { kind: "win", omega: "Salvage", win: "resonance", label: "Resonance" },
  { kind: "win", omega: "Salvage", win: "murmuration", label: "Murmuration" },
  { kind: "kill", omega: "Salvage", piece: "salvageNodes", label: "Grid Online (5th Power Node)" },
  { kind: "kill", omega: "Salvage", piece: "salvageCleared", label: "Sector Lock (3rd Cleared sector)" },
  { kind: "both", omega: "Salvage", piece: "salvageNodes", win: "missionComplete", label: "Grid Online, then Mission Complete" },
  { kind: "both", omega: "Salvage", piece: "salvageCleared", win: "missionComplete", label: "Sector Lock, then Mission Complete" },
];
/** The mission the preview's board stands for. */
export const PREVIEW_MISSION: Record<PreviewOmega, { id: string; name: string }> = {
  Alpha: { id: "C1_M1", name: "Mission 1" },
  Beta: { id: "C1_M3", name: "Mission 3" },
  Gamma: { id: "C1_M7", name: "Mission 7" },
  Salvage: { id: "C1_M2X", name: "Mission 2" },
};

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
export function previewBoards(data: GameData, company: string, omega: PreviewOmega = "Alpha", piece?: string): PreviewBoards | undefined {
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
  if (omega === "Salvage") return salvageBoards(s, take, piece === "salvageCleared");
  // Alpha: five Alphas already destroyed this mission. Beta: two Betas. Gamma: one Gamma.
  // Betas and Gammas have no Destroyed effect: no Wreck (4.8).
  const beta = omega !== "Alpha";
  const target = omega === "Gamma" ? "O_03" : omega === "Beta" ? "O_02" : "O_01";
  s.mission = PREVIEW_MISSION[omega].id;
  for (let i = 0; i < (omega === "Gamma" ? 1 : beta ? 2 : 5); i++) {
    const t = take(target);
    if (t === undefined) return undefined;
    s.tiles[t] = { ...s.tiles[t]!, faceUp: true, tokens: noTokens() };
    s.piles.trophy.push(t);
  }
  const alpha = place(0, 1, target);
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
  // Already damaged, so the Mecha's 2 damage destroys it (Alpha Level 3, Beta Level 13, Gamma Level 25).
  s.tiles[alpha]!.tokens.damage = omega === "Gamma" ? 23 : beta ? 11 : 1;
  s.seen = [];
  const at = key({ q: 0, r: 1 });
  const nextSeq = (st: GameState) => (st.events?.at(-1)?.seq ?? 0) + 1;
  const withEvents = (st: GameState, bodies: GameEventBody[]): GameState => {
    let n = nextSeq(st);
    st.events = [...(st.events ?? []), ...bodies.map((b) => ({ ...b, seq: n++ }) as GameEvent)];
    return st;
  };
  const hit: GameEventBody = { kind: "hit", tile: alpha, unitId: target, type: "Omega", sector: at, amount: 2, damage: 2, shields: 0, rule: "M_07" };
  const destroyed: GameEventBody = { kind: "destroyed", tile: alpha, unitId: target, type: "Omega", sector: at, wreck: !beta };
  if (beta) {
    // A Beta or Gamma has no Destroyed effect: straight to the Trophy pile, no Wreck; the mission is won in the same answer.
    const gone = (base: GameState, bodies: GameEventBody[], won: boolean): GameState => {
      const w = withEvents(structuredClone(base), bodies);
      w.field[at] = w.field[at]!.filter((t) => t !== alpha);
      w.tiles[alpha]!.tokens = noTokens();
      w.piles.trophy.push(alpha);
      if (won) w.phase = "missionEnd";
      return w;
    };
    const kill = gone(s, [hit, destroyed], false);
    return { start: s, kill, won: withEvents({ ...structuredClone(kill), phase: "missionEnd" }, [{ kind: "won" }]), wonJoined: gone(s, [hit, destroyed, { kind: "won" }], true) };
  }
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

/**
 * Salvage (the same Field, called Mission 2; 8.2: 5 Power Nodes in the Trophy pile and 3 Cleared sectors).
 * Grid Online (and the wins): four Power Nodes already in the Trophy pile and three Cleared sectors; the
 * fifth on the Field, its Alert resolved, goes to the Trophy pile ("kill"), and the mission is won.
 * Sector Lock (`cleared`): five Power Nodes in the Trophy pile and two Cleared sectors; a Bot alone on
 * its sector is destroyed ("kill"), the sector is Cleared, and the mission is won. Mission 1 deals only
 * three Power Nodes, so the picture makes the others (copies of one, new tile ids): a picture only.
 */
function salvageBoards(s: GameState, take: (unitId: string) => TileId | undefined, cleared = false): PreviewBoards | undefined {
  s.mission = PREVIEW_MISSION.Salvage.id;
  const model = Object.entries(s.tiles).find(([, t]) => t.unitId === "F_01");
  if (!model) return undefined;
  let made = 0;
  const node = (): TileId => {
    const t = take("F_01");
    if (t !== undefined) return t;
    const id = `preview-node-${++made}`;
    s.tiles[id] = structuredClone(model[1]);
    return id;
  };
  for (let i = 0; i < (cleared ? 5 : 4); i++) {
    const t = node();
    s.tiles[t] = { ...s.tiles[t]!, faceUp: true, tokens: noTokens() };
    s.piles.trophy.push(t);
  }
  const at = key({ q: 0, r: 1 });
  if (!s.field[at]) return undefined;
  const last = cleared ? take("B_02") : node();
  if (last === undefined) return undefined;
  if (cleared) {
    s.piles.discard.push(...s.field[at]!);
    s.field[at] = [];
  }
  s.tiles[last] = { ...s.tiles[last]!, faceUp: true, facing: 0, tokens: { ...noTokens(), alert: !cleared } };
  s.field[at]!.push(last);
  for (const [q, r] of [[-1, 0], [1, 1], [0, -1], [1, -1], [-1, 2], [0, 0]] as const) {
    const k = key({ q, r });
    if (k === at || !s.field[k]) continue;
    if (Object.values(s.field).filter((st) => st.length === 0).length >= (cleared ? 2 : 3)) break;
    s.piles.discard.push(...s.field[k]!);
    s.field[k] = [];
  }
  s.seen = [];
  const n0 = (s.events?.at(-1)?.seq ?? 0) + 1;
  const gone: GameEvent = cleared
    ? ({ kind: "destroyed", tile: last, unitId: "B_02", type: "Bot", sector: at, wreck: false, seq: n0 } as GameEvent)
    : ({ kind: "activated", tile: last, unitId: "F_01", type: "Flare", sector: at, how: "alert", seq: n0 } as GameEvent);
  const kill = structuredClone(s);
  kill.events = [...(s.events ?? []), gone];
  kill.field[at] = kill.field[at]!.filter((t) => t !== last);
  kill.tiles[last]!.tokens = noTokens();
  (cleared ? kill.piles.discard : kill.piles.trophy).push(last);
  const won = structuredClone(kill);
  won.events = [...kill.events, { kind: "won", seq: n0 + 1 } as GameEvent];
  won.phase = "missionEnd";
  return { start: s, kill, won, wonJoined: won };
}
