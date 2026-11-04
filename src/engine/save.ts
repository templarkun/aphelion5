/**
 * Saving, loading and undo (spec "Saving" and "Randomness, log and undo").
 *
 * A game is its start (seed, date, profile, Developer mode) plus the list
 * of answers the player gave. Loading replays the answers, so a save can
 * never drift from the rules. The profile (every Company sheet's upgrade
 * marks and the high scores) outlives games and is saved beside them.
 *
 * Undo replays with one answer fewer. It may not go back past the most
 * recent new hidden information (a Reveal, a look at face-down tiles, a
 * draw, a shuffle), except in Developer mode.
 */

import type { GameData } from "../data/index.js";
import { newGame } from "./campaign.js";
import type { Answer } from "./questions.js";
import { type AnswerResult, type SessionView, answerSession, startSession } from "./session.js";
import { type GameState, type Profile, emptyProfile } from "./state.js";

export const SAVE_FORMAT = 1;

export interface GameStart {
  seed: number;
  date: string;
  developerMode: boolean;
  /** Fixed for the whole game, so replays ask the same questions (default on). */
  autoAnswer?: boolean;
  /** The profile as it was when the game started. */
  profile: Profile;
}

export interface SaveFile {
  formatVersion: number;
  /** The profile now (updated at Game End). */
  profile: Profile;
  /** The game in progress, if any (one at a time in version 1). */
  game?: { start: GameStart; answers: Answer[] };
  settings: { autoAnswer: boolean };
}

export interface Game {
  start: GameStart;
  answers: Answer[];
  view: SessionView;
}

function initial(data: GameData, start: GameStart): GameState {
  return newGame(data, { seed: start.seed, date: start.date, profile: start.profile, developerMode: start.developerMode, autoAnswer: start.autoAnswer ?? true });
}

export function startGame(data: GameData, start: GameStart): Game {
  return { start, answers: [], view: startSession(data, initial(data, start)) };
}

/** Replay a list of answers from the start. Throws if one is refused (a save that no longer fits the rules). */
export function replayGame(data: GameData, start: GameStart, answers: readonly Answer[]): Game {
  let v = startSession(data, initial(data, start));
  for (const [i, a] of answers.entries()) {
    const r = answerSession(data, v, a);
    if (r.status === "illegal" || r.status === "blocked") throw new Error(`saved answer ${i + 1} was refused: ${r.reason}`);
    v = r;
  }
  return { start, answers: [...answers], view: v };
}

/** Answer the current question. A refused answer leaves the game as it was. */
export function playAnswer(data: GameData, g: Game, a: Answer): { game: Game; result: AnswerResult } {
  const r = answerSession(data, g.view, a);
  if (r.status === "illegal" || r.status === "blocked") return { game: g, result: r };
  return { game: { start: g.start, answers: [...g.answers, a], view: r }, result: r };
}

/** Can the last answer be undone (no new hidden information since the answer before it)? */
export function canUndo(data: GameData, g: Game): boolean {
  if (g.answers.length === 0) return false;
  if (g.start.developerMode) return true;
  const before = replayGame(data, g.start, g.answers.slice(0, -1));
  return before.view.state.hiddenInfo === g.view.state.hiddenInfo;
}

export function undo(data: GameData, g: Game): Game | undefined {
  if (!canUndo(data, g)) return undefined;
  return replayGame(data, g.start, g.answers.slice(0, -1));
}

/** The save file for a game (and the profile as it stands). Game End clears the game in progress. */
export function toSave(g: Game | undefined, profile: Profile, autoAnswer = true): SaveFile {
  const f: SaveFile = { formatVersion: SAVE_FORMAT, profile, settings: { autoAnswer } };
  const ended = g?.view.status === "stopped" && g.view.state.ending !== undefined;
  if (g && !ended) f.game = { start: g.start, answers: g.answers };
  return f;
}

/** Read a save file (upgrading older formats when there are any). */
export function readSave(text: string): SaveFile {
  const f = JSON.parse(text) as Partial<SaveFile>;
  if (typeof f.formatVersion !== "number") throw new Error("not an Aphelion 5 save file");
  if (f.formatVersion > SAVE_FORMAT) throw new Error(`save format ${f.formatVersion} is newer than this program (${SAVE_FORMAT})`);
  const out: SaveFile = { formatVersion: SAVE_FORMAT, profile: f.profile ?? emptyProfile(), settings: f.settings ?? { autoAnswer: true } };
  if (f.game) out.game = f.game;
  return out;
}

/** The profile after a game: Game End writes the sheet marks and high scores into the game's state. */
export function profileAfter(g: Game): Profile {
  return g.view.state.profile;
}
