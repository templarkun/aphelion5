/**
 * When the celebrations play (designer 2026-11-20; pieces.ts). Read from the game and its events
 * only; nothing here changes the game.
 *
 * - The kill: the `destroyed` event that brings the named Omega units destroyed this mission (those
 *   in the Trophy pile and those still on the Field as Wrecks, 4.8) to the objective's number (8.2).
 * - The win: the `won` event (the objective met, 8.2). The board is shown as it was at that moment
 *   (before Mission End collects the Field), worked out again from the answer that won.
 */

import type { GameData } from "../../data/index.js";
import { type GameEvent, newEvents } from "../../engine/events.js";
import type { Answer } from "../../engine/questions.js";
import type { Game } from "../../engine/save.js";
import { type SessionView, answerSession } from "../../engine/session.js";
import type { GameState, TileId } from "../../engine/state.js";
import { KILL_PIECES, type Piece, WIN_PIECES, pickPiece } from "./pieces.js";

export type Objective = { type: "salvage" } | { type: "eliminate"; target: string; count: number };

/** The objective of the mission under way (8.2). */
export function objectiveOf(data: GameData, s: GameState): Objective | undefined {
  const m = data.campaigns.find((c) => c.prefix === s.campaign)?.missionById.get(s.mission);
  return m?.objective;
}

/** "Alpha" for O_01 (the unit list's role "Alpha unit"). */
export function omegaName(data: GameData, unitId: string): string {
  return (data.units.byId.get(unitId)?.role ?? unitId).replace(/ unit$/i, "");
}

/** Units of `target` destroyed this mission: in the Trophy pile, or still on the Field as Wrecks. */
export function countedSoFar(s: GameState, target: string): number {
  let n = s.piles.trophy.filter((t) => s.tiles[t]?.unitId === target).length;
  for (const stack of Object.values(s.field)) for (const t of stack) if (s.tiles[t]?.unitId === target && s.tiles[t]?.tokens.wreck) n++;
  return n;
}

/** The index (in `events`) of the destroyed event that reaches the Eliminate objective's number; -1 if none. */
export function decidingKill(data: GameData, before: GameState | undefined, events: readonly GameEvent[]): number {
  if (!before) return -1;
  const o = objectiveOf(data, before);
  if (!o || o.type !== "eliminate") return -1;
  let n = countedSoFar(before, o.target);
  if (n >= o.count) return -1;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.kind !== "destroyed" || e.unitId !== o.target) continue;
    if (++n === o.count) return i;
  }
  return -1;
}

export interface KillInfo {
  /** The deciding event's index in the answer's events. */
  index: number;
  piece: Piece;
  /** "Alpha". */
  name: string;
  /** The objective's number (6): the count goes from count − 1 to count. */
  count: number;
}

/** The kill piece of these events, if they hold the deciding kill and a piece exists for its Omega type (`force`: that piece, the previews). */
export function killOf(data: GameData, before: GameState | undefined, events: readonly GameEvent[], seed: number, force?: string): KillInfo | undefined {
  const index = decidingKill(data, before, events);
  if (index < 0 || !before) return undefined;
  const o = objectiveOf(data, before);
  if (!o || o.type !== "eliminate") return undefined;
  const name = omegaName(data, o.target);
  const piece = pickPiece(KILL_PIECES, name, seed, before.mission, "kill", force);
  return piece ? { index, piece, name, count: o.count } : undefined;
}

export interface WinShow {
  piece: Piece;
  /** The board when the mission was won (8.2), before Mission End's steps. */
  state: GameState;
  /** The board before the winning answer (its Trophies fly to the Mission bar first). */
  before: GameState;
  target: string;
  /** "Alpha". */
  name: string;
  count: number;
  /** How many of them are in the Trophy pile (the count, except after the Developer tool). */
  have: number;
  /** The sector the deciding Omega unit left (the wave starts there); none: the middle of the Field. */
  from?: string | undefined;
  /** Won by the Developer tool. */
  dev: boolean;
  /** The same answer also made the deciding kill: the kill plays first, then this. */
  joined: boolean;
  /** That kill's piece (its pull-out is when the Trophy flies). */
  kill?: string | undefined;
  /** The objective's Trophies that came in with this answer (they fly in before the piece). */
  fresh: number;
  /** Any Trophies at all came in with this answer (Power Nodes too). */
  flights: boolean;
}

/** The board at the moment the mission was won: the answers played again, stopping at Mission End. */
export function wonStateOf(data: GameData, prev: Game, answers: readonly Answer[]): GameState | undefined {
  if (prev.view.status !== "question") return undefined;
  let v: SessionView = { ...prev.view, session: { ...prev.view.session, stopAt: ["missionEnd"] } };
  try {
    for (const a of answers) {
      const r = answerSession(data, v, a);
      if (r.status === "stopped") return r.phase === "missionEnd" ? r.state : undefined;
      if (r.status !== "question") return undefined;
      v = r;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** The win piece for a board won from `before` (the Developer tool, or the objective). `forceKill`: the kill piece played with it (the previews). */
export function winShowOf(data: GameData, before: GameState, won: GameState, seed: number, forceKill?: string): WinShow | undefined {
  const o = objectiveOf(data, before);
  if (!o || o.type !== "eliminate") return undefined;
  const name = omegaName(data, o.target);
  const piece = pickPiece(WIN_PIECES, name, seed, before.mission, "win");
  if (!piece) return undefined;
  const ev = newEvents(before.events, won.events);
  const dev = ev.some((e) => e.kind === "won" && e.dev === true);
  // The deciding unit: the objective's number-th of its type in the Trophy pile; where it was destroyed.
  const mine = won.piles.trophy.filter((t) => won.tiles[t]?.unitId === o.target);
  const decider: TileId | undefined = dev ? undefined : mine[o.count - 1];
  let from: string | undefined;
  if (decider !== undefined) {
    const all = won.events ?? [];
    for (let j = all.length - 1; j >= 0; j--) {
      const e = all[j]!;
      if (e.kind === "destroyed" && e.tile === decider) {
        from = e.sector;
        break;
      }
    }
  }
  const joined = decidingKill(data, before, ev) >= 0;
  const had = new Set(before.piles.trophy);
  const freshAll = won.piles.trophy.filter((t) => !had.has(t));
  return {
    piece,
    state: won,
    before,
    target: o.target,
    name,
    count: o.count,
    have: Math.min(o.count, mine.length),
    from,
    dev,
    joined,
    kill: joined ? killOf(data, before, ev, seed, forceKill)?.piece.id : undefined,
    fresh: freshAll.filter((t) => won.tiles[t]?.unitId === o.target).length,
    flights: freshAll.length > 0,
  };
}

/** The win of the answer(s) that turned `prev` into `next`, if they won the mission and a piece exists for it. */
export function winOf(data: GameData, prev: Game, next: Game): WinShow | undefined {
  if (next.answers.length <= prev.answers.length || next.start !== prev.start) return undefined;
  const ev = newEvents(prev.view.state.events, next.view.state.events);
  if (!ev.some((e) => e.kind === "won")) return undefined;
  const before = prev.view.state;
  if (!objectiveOf(data, before)) return undefined;
  const won = wonStateOf(data, prev, next.answers.slice(prev.answers.length)) ?? (next.view.state.phase === "missionEnd" ? next.view.state : undefined);
  if (!won) return undefined;
  return winShowOf(data, before, won, next.start.seed);
}
