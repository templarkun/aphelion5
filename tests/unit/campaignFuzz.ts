/**
 * Random play-throughs of whole campaigns (spec "Testing": stage 7 is done
 * when these run clean). Random legal answers rarely win a mission, so after
 * `stepsPerMission` steps the harness declares the mission won (a Developer
 * mode "Edit state" stand-in), so later missions, Mission End and Game End
 * are reached too.
 */

import type { GameData } from "../../src/data/index.js";
import { missionWon } from "../../src/engine/command.js";
import { runEffect, startRoot, replay, type RunCtx, type Effect } from "../../src/engine/effect.js";
import { newGame } from "../../src/engine/campaign.js";
import { checkInvariants } from "../../src/engine/invariants.js";
import { overloadEnd, overloadStep } from "../../src/engine/overload.js";
import { commandStep } from "../../src/engine/command.js";
import type { Answer, Question } from "../../src/engine/questions.js";
import { newRng, nextInt, shuffle, type RngState } from "../../src/engine/rng.js";
import type { GameState, Phase } from "../../src/engine/state.js";
import { NotBuiltYet } from "../../src/effects/registry.js";
import { OpenQuestion } from "../../src/engine/effect.js";
import "../../src/engine/session.js";

export function randomAnswer(r: RngState, q: Question): Answer {
  switch (q.kind) {
    case "units":
    case "sectors": {
      const n = q.min + nextInt(r, Math.min(q.max, q.options.length) - q.min + 1);
      const value = shuffle(r, [...q.options]).slice(0, n);
      return q.kind === "units" ? { kind: "units", value } : { kind: "sectors", value };
    }
    case "several": {
      const n = q.min + nextInt(r, Math.min(q.max, q.options.length) - q.min + 1);
      return { kind: "several", value: shuffle(r, q.options.map((o) => o.id)).slice(0, n) };
    }
    case "option":
      return { kind: "option", value: q.options[nextInt(r, q.options.length)]!.id };
    case "order":
      return { kind: "order", value: q.options[nextInt(r, q.options.length)]!.id };
    case "amount":
      return { kind: "amount", value: q.min + nextInt(r, q.max - q.min + 1) };
    case "yesno":
      return { kind: "yesno", value: nextInt(r, 2) === 1 };
    case "split": {
      const value: Record<string, number> = Object.fromEntries(q.buckets.map((b) => [b.id, 0]));
      for (let left = q.total; left > 0; left--) {
        const open = q.buckets.filter((b) => value[b.id]! < b.max);
        value[open[nextInt(r, open.length)]!.id]! += 1;
      }
      return { kind: "split", value };
    }
  }
}

const ROOT: Record<Phase, string> = {
  setup: "gameSetup",
  preparation: "missionPreparation",
  command: "commandStep",
  overload: "overloadStep",
  overloadEnd: "overloadEnd",
  missionEnd: "missionEnd",
  gameEnd: "gameEnd",
};
void commandStep;
void overloadStep;
void overloadEnd;

export interface CampaignRunResult {
  ending: string;
  missions: number;
  state: GameState;
}

export function randomCampaign(data: GameData, seed: number, stepsPerMission = 40, maxSteps = 3000): CampaignRunResult {
  const r = newRng(seed);
  let s = newGame(data, { seed, date: "2026-11-04" });
  let inMission = 0;
  for (let n = 0; n < maxSteps; n++) {
    if (s.phase === "gameEnd" && s.ending) return { ending: s.outcome?.result ?? "?", missions: s.run.completed.length, state: s };
    if (s.phase === "command") {
      if (++inMission > stepsPerMission) {
        const c = { state: structuredClone(s), data };
        missionWon(c);
        // Also undo the damage random play did, so the campaign can go on.
        c.state.flagship = data.companies.byId.get(c.state.player.company)!.bays.map((b) => b.integrity);
        c.state.sheet.overhaulUsed = 0;
        s = c.state;
        inMission = 0;
        continue;
      }
    }
    const engine = startRoot(s, ROOT[s.phase]);
    const answers: Answer[] = [];
    for (let guard = 0; ; guard++) {
      if (guard > 500) throw new Error(`a single ${s.phase} step asked over 500 questions`);
      let res;
      try {
        res = replay(data, { ...engine, answers });
      } catch (e) {
        if (e instanceof NotBuiltYet || e instanceof OpenQuestion) throw new Error(`blocked in a campaign: ${(e as Error).message}`);
        throw e;
      }
      if (res.status === "illegal") throw new Error(`a random legal answer was refused: ${res.reason}`);
      if (res.status === "done") {
        const p = checkInvariants({ state: res.state, data });
        if (p.length) throw new Error(`invariant broken after ${s.phase}: ${p.join("; ")}`);
        s = res.state;
        break;
      }
      let a = randomAnswer(r, res.question);
      for (let k = 0; k < 30 && a.kind === "option" && a.value === "concede"; k++) a = randomAnswer(r, res.question);
      answers.push(a);
    }
  }
  return { ending: "steps done", missions: s.run.completed.length, state: s };
}

void runEffect;
export type { RunCtx, Effect };
