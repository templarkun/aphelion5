/**
 * The session driver: plays a game as a chain of root effects. Each root
 * runs one step from a fresh checkpoint; when it finishes, the driver starts
 * the right root for the phase the game is now in:
 *
 *   setup       -> "gameSetup"          (7.1)
 *   preparation -> "missionPreparation" (7.2, 7.3)
 *   command     -> "commandStep"        (8.1: checks, then one action)
 *   overload    -> "overloadStep"       (9.2: one Overload action, or end it)
 *   overloadEnd -> "overloadEnd"        (9.3: steps 1-5, back to the Command phase)
 *   missionEnd  -> "missionEnd"         (10.1, 10.2)
 *   gameEnd     -> "gameEnd"            (10.3: scoring, once)
 *
 * The session stops when Game End has been scored, or at a phase in
 * `stopAt` (tests use it to stop at Mission End).
 *
 * The session is plain data, so it can be saved: the current root (its
 * checkpoint and answers) plus the finished steps.
 */

import type { GameData } from "../data/index.js";
import { NotBuiltYet } from "../effects/registry.js";
import "./command.js";
import "./overload.js";
import "./campaign.js";
import { type EngineState, OpenQuestion, answer as engineAnswer, replay, startRoot } from "./effect.js";
import type { Answer, Question } from "./questions.js";
import type { GameState, Phase } from "./state.js";

/** Which root effect plays each phase; phases without one end the session (for now). */
const ROOT_FOR_PHASE: Record<Phase, string> = {
  setup: "gameSetup",
  preparation: "missionPreparation",
  command: "commandStep",
  overload: "overloadStep",
  overloadEnd: "overloadEnd",
  missionEnd: "missionEnd",
  gameEnd: "gameEnd",
};

export interface SessionOptions {
  /** Stop when the game reaches one of these phases (instead of playing it). */
  stopAt?: Phase[];
}

export interface Session {
  /** The step being played. */
  engine: EngineState;
  /** Finished steps since the session began. */
  steps: number;
  stopAt: Phase[];
}

export type SessionView =
  | { status: "question"; state: GameState; question: Question; session: Session }
  /** Game End has been scored, or a `stopAt` phase was reached. */
  | { status: "stopped"; state: GameState; phase: Phase; session: Session };

export type AnswerResult =
  | SessionView
  /** The answer is not legal; nothing changed. */
  | { status: "illegal"; reason: string; view: SessionView }
  /** The answer leads to a card not built yet, or to an open rules question; nothing changed. */
  | { status: "blocked"; reason: string; view: SessionView };

/** Start (or resume) a session from a state at the start of a step. */
export function startSession(data: GameData, state: GameState, o: SessionOptions = {}): SessionView {
  return advance(data, state, 0, o.stopAt ?? []);
}

/** Run roots until one asks a question or the game leaves the built phases. */
function advance(data: GameData, state: GameState, steps: number, stopAt: Phase[]): SessionView {
  let s = state;
  let n = steps;
  for (let guard = 0; ; guard++) {
    if (guard > 1000) throw new Error("the session made 1000 steps without asking anything");
    if ((s.phase === "gameEnd" && s.ending !== undefined) || stopAt.includes(s.phase)) {
      return { status: "stopped", state: s, phase: s.phase, session: { engine: startRootFor(s), steps: n, stopAt } };
    }
    const engine = startRoot(s, ROOT_FOR_PHASE[s.phase]);
    const r = replay(data, engine);
    if (r.status === "illegal") throw new Error(`a step with no answers was refused: ${r.reason}`);
    if (r.status === "question") return { status: "question", state: r.state, question: r.question, session: { engine: r.engine, steps: n, stopAt } };
    s = r.state;
    n++;
  }
}

/** A placeholder engine for a stopped session (nothing left to answer). */
function startRootFor(s: GameState): EngineState {
  return { checkpoint: s, root: { name: "commandStep", args: null }, answers: [] };
}

/** The current view of a session (replays its step). */
export function view(data: GameData, session: Session): SessionView {
  const r = replay(data, session.engine);
  if (r.status === "illegal") throw new Error(`a saved session no longer replays: ${r.reason}`);
  if (r.status === "question") return { status: "question", state: r.state, question: r.question, session };
  return advance(data, r.state, session.steps + 1, session.stopAt);
}

/** Answer the current question. Illegal or blocked answers change nothing. */
export function answerSession(data: GameData, current: SessionView, a: Answer): AnswerResult {
  if (current.status !== "question") return { status: "illegal", reason: "the game is not asking anything", view: current };
  let r;
  try {
    r = engineAnswer(data, current.session.engine, a);
  } catch (e) {
    if (e instanceof NotBuiltYet || e instanceof OpenQuestion) return { status: "blocked", reason: e.message, view: current };
    throw e;
  }
  if (r.status === "illegal") return { status: "illegal", reason: r.reason, view: current };
  if (r.status === "question") return { status: "question", state: r.state, question: r.question, session: { ...current.session, engine: r.engine } };
  try {
    return advance(data, r.state, current.session.steps + 1, current.session.stopAt);
  } catch (e) {
    // A step that blocks before its first question: stay where we were.
    if (e instanceof NotBuiltYet || e instanceof OpenQuestion) return { status: "blocked", reason: e.message, view: current };
    throw e;
  }
}
