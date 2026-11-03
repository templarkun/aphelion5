/** Stage 4: the text-only interface and the fixed board. */

import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseAnswer, renderQuestion, renderState } from "../../src/cli/text.js";
import { fixedBoard, fixedDeck } from "../../src/engine/fixedBoard.js";
import { darkSectors } from "../../src/engine/field.js";
import { checkInvariants } from "../../src/engine/invariants.js";
import type { Question } from "../../src/engine/questions.js";
import { answerSession, startSession } from "../../src/engine/session.js";
import { ctx, data } from "./helpers.js";

describe("the fixed board", () => {
  it("deals Mission 1's deck (Threat column A) face down onto its 10 sectors, as evenly as possible", () => {
    const s = fixedBoard(data(), 7);
    const total = fixedDeck(data()).reduce((a, [, n]) => a + n, 0);
    expect(total).toBe(30 + 27 + 25 + 4); // Bots, V1 Mecha, Mission 1 Deployment, Threat column A
    const heights = Object.values(s.field).map((st) => st.length);
    expect(heights.reduce((a, b) => a + b, 0)).toBe(total);
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
    expect(darkSectors(s)).toHaveLength(10);
    expect(s.player.anomalies).toHaveLength(4);
    expect(s.player.reserve).toEqual({ Yellow: 6, Red: 6, Blue: 6 });
    expect(checkInvariants(ctx(s))).toEqual([]);
    // Same seed, same board.
    expect(fixedBoard(data(), 7)).toEqual(s);
  });
});

describe("text interface", () => {
  it("never shows a face-down tile's contents", () => {
    const s = fixedBoard(data(), 3);
    const text = renderState(data(), s).split("\n").slice(1).join("\n"); // line 1 is the objective, which names O_01
    for (const id of Object.keys(s.tiles)) if (!s.tiles[id]!.faceUp) expect(text).not.toContain(id);
    expect(text).not.toMatch(/O_01|S_12|F_04/);
  });

  it("reads typed answers for each kind of question", () => {
    const opt: Question = { kind: "option", prompt: "", rule: "", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] };
    expect(parseAnswer(opt, "2")).toEqual({ kind: "option", value: "b" });
    expect(parseAnswer(opt, "3")).toHaveProperty("error");
    const units: Question = { kind: "units", prompt: "", rule: "", options: ["x", "y", "z"], min: 0, max: 2 };
    expect(parseAnswer(units, "3 1")).toEqual({ kind: "units", value: ["z", "x"] });
    expect(parseAnswer(units, "")).toEqual({ kind: "units", value: [] });
    const split: Question = { kind: "split", prompt: "", rule: "", total: 2, buckets: [{ id: "bay1", label: "Bay 1", max: 2 }, { id: "bay2", label: "Bay 2", max: 2 }] };
    expect(parseAnswer(split, "1 1")).toEqual({ kind: "split", value: { bay1: 1, bay2: 1 } });
    expect(parseAnswer({ kind: "yesno", prompt: "", rule: "" }, "y")).toEqual({ kind: "yesno", value: true });
    expect(parseAnswer({ kind: "amount", prompt: "", rule: "", min: 0, max: 3 }, "2")).toEqual({ kind: "amount", value: 2 });
  });

  it("plays a Reveal through the session, with the question in plain words", () => {
    const v = startSession(data(), fixedBoard(data(), 1));
    if (v.status !== "question") throw new Error("expected a question");
    expect(renderQuestion(data(), v.state, v.question)).toMatch(/1\. Reveal/);
    const r = answerSession(data(), v, parseAnswer(v.question, "1") as never);
    expect(r.status).toBe("question");
  });

  it("the terminal program starts, shows the board and ends on Concede", () => {
    const out = execFileSync("npx", ["tsx", "scripts/play.ts", "5"], { input: "board\n6\n", encoding: "utf8", timeout: 60000 });
    expect(out).toMatch(/Objective: Eliminate 6 O_01/);
    expect(out).toMatch(/Game over: you conceded/);
  });
});
