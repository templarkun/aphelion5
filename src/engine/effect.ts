/**
 * Effects and the engine step (spec "Architecture": the engine is pure).
 *
 * An effect is a generator: it changes the working state and `yield`s a
 * Question whenever the player must choose; the answer comes back as the
 * value of the yield. Effects never read the clock or call Math.random.
 *
 * The engine step is a pure function. An EngineState is: a checkpoint
 * (the state when the current root effect started), the root effect's name
 * and arguments, and the answers given since. To answer, the engine replays
 * the root effect on a copy of the checkpoint, feeding it the answers, until
 * it asks a question nobody has answered yet. Same checkpoint + same answers
 * = same result, so saving, undo and tests need nothing else.
 */

import type { GameData } from "../data/index.js";
import type { Ctx } from "./field.js";
import { type Answer, type Question, invalidReason, onlyAnswer } from "./questions.js";
import type { GameState, LogEntry } from "./state.js";

export type Effect<T = void> = Generator<Question, T, Answer>;

/** Working context of a running effect. */
export interface RunCtx extends Ctx {
  /** Effects whose own triggers wait for the effect to finish (Core Rules 11.1, rule 3). */
  frames: Frame[];
}

/** Something to resolve as soon as the current effect has finished (e.g. a Bio-shield's Destroyed effect, 6.3). */
export interface Deferred {
  id: string;
  label: string;
  run: (c: RunCtx) => Effect;
}

interface Frame {
  after: Deferred[];
}

/** Ask the player. Auto-answers when exactly one answer is legal and autoAnswer is on. */
export function* ask(c: RunCtx, q: Question): Effect<Answer> {
  if (c.state.settings.autoAnswer) {
    const only = onlyAnswer(q);
    if (only) return only;
  }
  const a = yield q;
  const why = invalidReason(q, a);
  if (why) throw new IllegalAnswer(why, q, a);
  return a;
}

export class IllegalAnswer extends Error {
  constructor(
    reason: string,
    readonly question: Question,
    readonly answer: Answer,
  ) {
    super(`illegal answer: ${reason}`);
    this.name = "IllegalAnswer";
  }
}

export function log(c: Ctx, text: string, rule?: string): void {
  const e: LogEntry = { text };
  if (rule !== undefined) e.rule = rule;
  c.state.log.push(e);
}

/**
 * Run `body` as one effect: anything it defers runs when it has finished,
 * one at a time, in the order the player picks (11.1, rules 3 and 4).
 */
export function* asEffect<T>(c: RunCtx, body: Effect<T>): Effect<T> {
  const frame: Frame = { after: [] };
  c.frames.push(frame);
  let result: T;
  try {
    result = yield* body;
  } finally {
    c.frames.pop();
  }
  while (frame.after.length > 0) {
    let next = frame.after[0]!;
    if (frame.after.length > 1) {
      const a = yield* ask(c, {
        kind: "order",
        prompt: "Several effects wait to resolve. Which one first?",
        rule: "11.1",
        options: frame.after.map((d) => ({ id: d.id, label: d.label })),
      });
      next = frame.after.find((d) => d.id === (a.value as string))!;
    }
    frame.after.splice(frame.after.indexOf(next), 1);
    yield* asEffect(c, next.run(c));
  }
  return result;
}

/** Queue something to resolve when the innermost running effect finishes. */
export function defer(c: RunCtx, d: Deferred): void {
  const f = c.frames[c.frames.length - 1];
  if (!f) throw new Error("defer() outside an effect");
  // Ids must be unique within the frame so the order question is unambiguous.
  let id = d.id;
  for (let i = 2; f.after.some((x) => x.id === id); i++) id = `${d.id}#${i}`;
  f.after.push({ ...d, id });
}

// ---------------------------------------------------------------------------
// Root effects and the engine step
// ---------------------------------------------------------------------------

/** A root effect is named, so an EngineState stays plain data. */
export type RootEffect = (c: RunCtx, args: unknown) => Effect;

const roots = new Map<string, RootEffect>();

export function registerRoot(name: string, fn: RootEffect): void {
  if (roots.has(name)) throw new Error(`root effect ${name} registered twice`);
  roots.set(name, fn);
}

export interface EngineState {
  checkpoint: GameState;
  root: { name: string; args: unknown };
  answers: Answer[];
}

export type StepResult =
  | { status: "question"; state: GameState; question: Question; engine: EngineState }
  | { status: "done"; state: GameState; engine: EngineState }
  | { status: "illegal"; reason: string; engine: EngineState };

export function startRoot(checkpoint: GameState, name: string, args: unknown = null): EngineState {
  if (!roots.has(name)) throw new Error(`unknown root effect ${name}`);
  return { checkpoint, root: { name, args }, answers: [] };
}

export type RunResult =
  | { status: "question"; state: GameState; question: Question; used: number }
  | { status: "done"; state: GameState; used: number }
  | { status: "illegal"; reason: string; used: number };

/**
 * Run an effect on a copy of `checkpoint`, feeding it `answers` in order.
 * Stops at the first question with no answer left. `used` = answers consumed.
 */
export function runEffect(data: GameData, checkpoint: GameState, fn: (c: RunCtx) => Effect, answers: readonly Answer[]): RunResult {
  const c: RunCtx = { state: structuredClone(checkpoint), data, frames: [] };
  const gen = asEffect(c, fn(c));
  let i = 0;
  try {
    let r = gen.next();
    while (!r.done) {
      if (i === answers.length) return { status: "question", state: c.state, question: r.value, used: i };
      r = gen.next(answers[i++]!);
    }
  } catch (err) {
    if (err instanceof IllegalAnswer) return { status: "illegal", reason: err.message, used: i - 1 };
    throw err;
  }
  if (i !== answers.length) return { status: "illegal", reason: "more answers than questions", used: i };
  return { status: "done", state: c.state, used: i };
}

/** Run the root effect on a copy of the checkpoint with the given answers. */
export function replay(data: GameData, e: EngineState): StepResult {
  const fn = roots.get(e.root.name);
  if (!fn) throw new Error(`unknown root effect ${e.root.name}`);
  const r = runEffect(data, e.checkpoint, (c) => fn(c, e.root.args), e.answers);
  if (r.status === "illegal") return { status: "illegal", reason: r.reason, engine: { ...e, answers: e.answers.slice(0, r.used) } };
  return { ...r, engine: e };
}

/** The pure step: (engine state, answer) -> next question or done. */
export function answer(data: GameData, e: EngineState, a: Answer): StepResult {
  const next: EngineState = { ...e, answers: [...e.answers, a] };
  const r = replay(data, next);
  // An illegal answer leaves the engine where it was.
  return r.status === "illegal" ? { ...r, engine: e } : r;
}

/**
 * A rules gap the designer has not answered yet (docs/open-questions.md).
 * The program does not guess: the case stops with this error, naming the question.
 */
export class OpenQuestion extends Error {
  constructor(
    readonly question: string,
    detail: string,
  ) {
    super(`open question ${question}: ${detail}`);
    this.name = "OpenQuestion";
  }
}
