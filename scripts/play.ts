/**
 * Text-only play (first playable build, stage 4): one fixed board.
 *
 *   npm run play            (seed 1)
 *   npm run play -- 42      (another shuffle)
 *
 * While playing, type the number of your answer. Other words:
 *   board  show the Field again      log  show the whole log
 *   help   these words               quit stop playing
 */

import * as readline from "node:readline";
import { loadGameData } from "../src/data/nodeLoad.js";
import { fixedBoard } from "../src/engine/fixedBoard.js";
import { type SessionView, answerSession, startSession } from "../src/engine/session.js";
import { parseAnswer, renderLog, renderQuestion, renderState } from "../src/cli/text.js";

const seed = Number(process.argv[2] ?? "1");
if (!Number.isInteger(seed)) throw new Error(`seed must be a whole number, got ${process.argv[2]}`);
const data = loadGameData();
let v: SessionView = startSession(data, fixedBoard(data, seed));
let logShown = 0;
const HELP = "Type the number of your answer. Other words: board, log, help, quit.";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
const say = (s: string) => process.stdout.write(s + "\n");

function showNews(): void {
  const news = renderLog(v.state, logShown);
  if (news) say(news);
  logShown = v.state.log.length;
}

function prompt(full: boolean): void {
  if (v.status === "stopped") {
    say(renderState(data, v.state));
    const end =
      v.state.outcome !== undefined
        ? `Game over: ${v.state.outcome.reason}.`
        : v.phase === "missionEnd"
          ? "The mission objective is met: you win the mission! (Mission End and the rest of the Campaign come in stage 7.)"
          : `The game stops here (phase ${v.phase} is built in a later stage).`;
    say(`\n${end}`);
    rl.close();
    return;
  }
  if (full) say("\n" + renderState(data, v.state));
  say("\n" + renderQuestion(data, v.state, v.question));
  rl.setPrompt("> ");
  rl.prompt();
}

say(`Aphelion 5 - text build, fixed board (seed ${seed}). ${HELP}`);
showNews();
prompt(true);

rl.on("line", (line) => {
  if (v.status !== "question") return;
  const word = line.trim().toLowerCase();
  if (word === "quit" || word === "exit") {
    rl.close();
    return;
  }
  if (word === "help") return (say(HELP), prompt(false));
  if (word === "board") return prompt(true);
  if (word === "log") return (say(renderLog(v.state, 0)), prompt(false));
  const a = parseAnswer(v.question, line);
  if ("error" in a) return (say(`Sorry: ${a.error}.`), prompt(false));
  const r = answerSession(data, v, a);
  if (r.status === "illegal") return (say(`Not allowed: ${r.reason}.`), prompt(false));
  if (r.status === "blocked") return (say(`Not available yet: ${r.reason}. Choose something else.`), prompt(false));
  const phaseBefore = v.state.phase;
  v = r;
  showNews();
  // Show the whole board when a step finishes or the phase changes; otherwise just the next question.
  prompt(v.status !== "question" || v.state.phase !== phaseBefore || v.question.prompt.startsWith("Choose an action") || v.question.prompt.startsWith("Overload: choose"));
});
