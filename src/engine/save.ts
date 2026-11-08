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
import { type AnswerResult, type SessionView, answerSession, startSession, view as sessionView } from "./session.js";
import { type GameState, type Profile, emptyProfile } from "./state.js";

/**
 * 2: setup asks the Campaign and an expansion list (2026-11-04).
 * 3: energy you place matches the Module's colour (Q9), M_03 / M_06 Attack in one question.
 * 4: no "how much of the energy on it" question; 15 energy of each colour.
 * 5: Meltdown (H7) pays a Heat token without asking; a Mecha never Attacks a Mecha (2026-11-08).
 * A game saved in an older format cannot be replayed (its answers no longer fit),
 * except format 4: it replays, an answer to the Meltdown question (no longer asked) is skipped.
 */
export const SAVE_FORMAT = 6;

export interface GameStart {
  seed: number;
  date: string;
  developerMode: boolean;
  /** Saved before 2026-11-08 (format 4): Mecha may Attack Mecha, as the Core Rules print it, ... */
  mechaAttacksMecha?: boolean;
  /** ... but only for the first this-many answers (those played before); after them a Mecha never Attacks a Mecha. */
  mechaAttacksMechaUntil?: number;
  /** Saved before format 6: with the trial rule, a Power Node asks energy or Heat when revealed (as it did then). */
  powerNodeAtReveal?: boolean;
  /** Fixed for the whole game, so replays ask the same questions (default on). */
  autoAnswer?: boolean;
  /** The profile as it was when the game started. */
  profile: Profile;
}

export interface SaveFile {
  formatVersion: number;
  /** Set when reading: something in the file could not be kept (shown to the player). */
  note?: string;
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
  return newGame(data, { seed: start.seed, date: start.date, profile: start.profile, developerMode: start.developerMode, autoAnswer: start.autoAnswer ?? true, mechaAttacksMecha: start.mechaAttacksMecha ?? false, powerNodeAtReveal: start.powerNodeAtReveal ?? false });
}

export function startGame(data: GameData, start: GameStart): Game {
  return { start, answers: [], view: startSession(data, initial(data, start)) };
}

/** Replay a list of answers from the start. Throws if one is refused (a save that no longer fits the rules). */
export function replayGame(data: GameData, start: GameStart, answers: readonly Answer[]): Game {
  let v = startSession(data, initial(data, start));
  const kept: Answer[] = [];
  let until: number | undefined;
  for (const [i, a] of answers.entries()) {
    // Saves from before 2026-11-07 answered energy on Modules with one split per colour;
    // energy is now placed one per answer (designer 2026-11-07): replay the split as those answers.
    const parts =
      v.status === "question" && v.question.energy && a.kind === "split"
        ? Object.entries(a.value).flatMap(([id, n]) => Array.from({ length: n }, (): Answer => ({ kind: "option", value: id })))
        : [a];
    // Format 4 saves answered "pay 1 Heat to avoid Meltdown?" (H7); it is no longer asked (2026-11-08).
    if (v.status === "question" && v.question.kind !== "yesno" && a.kind === "yesno") continue;
    for (const p of parts) {
      const r = answerSession(data, v, p);
      if (r.status === "illegal" || r.status === "blocked") throw new Error(`saved answer ${i + 1} was refused: ${r.reason}`);
      v = r;
      kept.push(p);
    }
    if (start.mechaAttacksMecha && i + 1 >= (start.mechaAttacksMechaUntil ?? Infinity)) {
      until ??= kept.length;
      v = newMechaRule(data, v);
    }
  }
  // An old game: from here on a Mecha never Attacks a Mecha (designer 2026-11-08).
  if (start.mechaAttacksMecha && answers.length >= (start.mechaAttacksMechaUntil ?? Infinity)) {
    until ??= kept.length;
    v = newMechaRule(data, v);
  }
  // Old answers replayed as several (energy splits): count the kept ones.
  const st = until !== undefined && until !== start.mechaAttacksMechaUntil ? { ...start, mechaAttacksMechaUntil: until } : start;
  return { start: st, answers: kept, view: v };
}

/** The same point of the game with the Mecha rule switched to "never a Mecha"; unchanged if the step under way needs the old rule. */
function newMechaRule(data: GameData, v: SessionView): SessionView {
  if (!v.state.settings.mechaAttacksMecha) return v;
  const off = (s: GameState): GameState => ({ ...s, settings: { ...s.settings, mechaAttacksMecha: false } });
  if (v.status !== "question") return { ...v, state: off(v.state) };
  const e = v.session.engine;
  try {
    return sessionView(data, { ...v.session, engine: { ...e, checkpoint: off(e.checkpoint) } });
  } catch {
    return v;
  }
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
  if (f.game && f.formatVersion < 4) out.note = "The game in progress was saved by an older version of the program and cannot be continued. Your Company sheets and high scores are kept.";
  else if (f.game) {
    // Games saved before 2026-11-08 keep the old Mecha rule for the answers already played, so they replay; then the new rule.
    const old = f.formatVersion === 4 || (f.game.start.mechaAttacksMecha && f.game.start.mechaAttacksMechaUntil === undefined);
    out.game = old ? { ...f.game, start: { ...f.game.start, mechaAttacksMecha: true, mechaAttacksMechaUntil: f.game.answers.length } } : f.game;
    // Format 5 or older: a Power Node's choice stays where it was asked then (at its Reveal).
    if (f.formatVersion < 6) out.game = { ...out.game, start: { ...out.game.start, powerNodeAtReveal: true } };
  }
  return out;
}

/** The profile after a game: Game End writes the sheet marks and high scores into the game's state. */
export function profileAfter(g: Game): Profile {
  return g.view.state.profile;
}
