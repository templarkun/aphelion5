/**
 * Text-only play.
 *
 *   npm run play                  the Campaign: resumes your saved game, or starts a new one
 *   npm run play -- --new         start a new Campaign (the saved game in progress is dropped;
 *                                 your Company sheets and high scores are kept)
 *   npm run play -- --seed 42     the shuffle for a new game
 *   npm run play -- --fixed [N]   the stage 4 fixed board (Mission 1 only, not saved)
 *
 * The game saves itself after every answer to saves/aphelion5.json.
 * While playing, type the number of your answer. Other words:
 *   board  show the Field again    log   show the whole log
 *   undo   take back your last answer (not past new hidden information)
 *   help   these words             quit  stop (the game stays saved)
 */

import * as readline from "node:readline";
import { loadGameData } from "../src/data/nodeLoad.js";
import { fixedBoard } from "../src/engine/fixedBoard.js";
import { type Game, playAnswer, replayGame, startGame, toSave, undo } from "../src/engine/save.js";
import { startSession } from "../src/engine/session.js";
import { emptyProfile } from "../src/engine/state.js";
import { FileStore } from "../src/storage/fileStore.js";
import { parseAnswer, renderLog, renderQuestion, renderState } from "../src/cli/text.js";

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const valueOf = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};
const data = loadGameData();
const store = new FileStore("saves/aphelion5.json");
const fixed = flag("--fixed");
const saved = fixed ? undefined : store.load();
const profile = saved?.profile ?? emptyProfile();
const today = new Date().toISOString().slice(0, 10);

let game: Game;
if (fixed) {
  const seed = Number(valueOf("--fixed") ?? "1") || 1;
  const view = startSession(data, fixedBoard(data, seed));
  game = { start: { seed, date: today, developerMode: true, profile }, answers: [], view };
} else if (saved?.game && !flag("--new")) {
  game = replayGame(data, saved.game.start, saved.game.answers);
} else {
  const seed = Number(valueOf("--seed") ?? Math.floor(Math.random() * 1e9));
  game = startGame(data, { seed, date: today, developerMode: false, profile });
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
const say = (s: string) => process.stdout.write(s + "\n");
let logShown = 0;
const HELP = "Type the number of your answer. Other words: board, log, undo, help, quit.";

function persist(): void {
  if (fixed) return;
  const ended = game.view.status === "stopped";
  store.save(toSave(game, ended ? game.view.state.profile : profile));
}

function showNews(): void {
  const news = renderLog(game.view.state, logShown);
  if (news) say(news);
  logShown = game.view.state.log.length;
}

function prompt(full: boolean): void {
  const v = game.view;
  if (v.status === "stopped") {
    say(renderState(data, v.state));
    const e = v.state.ending;
    if (e) {
      say(`\nGame over (${v.state.outcome?.reason ?? ""}). Score ${e.score}:`);
      for (const p of e.parts) say(`  ${p}`);
      if (e.highScore) say(`  New ${e.highScore === "veteran" ? "Veteran " : ""}high score!`);
    } else say(`\nThe game stops here (phase ${v.phase}).`);
    rl.close();
    return;
  }
  const inField = !["setup", "preparation"].includes(v.state.phase) || v.state.map.length > 0;
  if (full && inField && v.state.phase !== "setup") say("\n" + renderState(data, v.state));
  say("\n" + renderQuestion(data, v.state, v.question));
  rl.setPrompt("> ");
  rl.prompt();
}

say(`Aphelion 5 - text build${fixed ? ", fixed board" : `, seed ${game.start.seed}`}. ${HELP}`);
showNews();
prompt(true);

rl.on("line", (line) => {
  if (game.view.status !== "question") return;
  const word = line.trim().toLowerCase();
  if (word === "quit" || word === "exit") return (persist(), rl.close());
  if (word === "help") return (say(HELP), prompt(false));
  if (word === "board") return prompt(true);
  if (word === "log") return (say(renderLog(game.view.state, 0)), prompt(false));
  if (word === "undo") {
    const g = undo(data, game);
    if (!g) return (say("Cannot undo: new hidden information appeared since (or nothing to undo)."), prompt(false));
    game = g;
    logShown = game.view.state.log.length;
    persist();
    return (say("Undone."), prompt(true));
  }
  if (game.view.status !== "question") return;
  const a = parseAnswer(game.view.question, line);
  if ("error" in a) return (say(`Sorry: ${a.error}.`), prompt(false));
  const phaseBefore = game.view.state.phase;
  const { game: g, result } = playAnswer(data, game, a);
  if (result.status === "illegal") return (say(`Not allowed: ${result.reason}.`), prompt(false));
  if (result.status === "blocked") return (say(`Not available: ${result.reason}. Choose something else.`), prompt(false));
  game = g;
  persist();
  showNews();
  const v = game.view;
  prompt(v.status !== "question" || v.state.phase !== phaseBefore || v.question.prompt.startsWith("Choose an action") || v.question.prompt.startsWith("Overload: choose"));
});
