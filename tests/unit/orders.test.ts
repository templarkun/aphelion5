/** Campaign 1's Orders (designer 2026-11-21) and games saved before them. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { commandStep, usableOrders } from "../../src/engine/command.js";
import { readSave, replayGame, toSave } from "../../src/engine/save.js";
import { runEffect } from "../../src/engine/effect.js";
import { A, ctx, data, given, play } from "./helpers.js";

describe("Campaign 1 Orders (designer 2026-11-21)", () => {
  it("C1_ORDER_1 deals 1 damage to one Gyro or one Sleeper, in the Command phase", () => {
    const s = given("T3_ORD_01");
    expect(usableOrders(ctx(s)).map((o) => o.id)).toContain("C1_ORDER_1");
    const r = play(s, (c) => commandStep(c), [A.option("issueOrder"), A.option("C1_ORDER_1")]);
    expect(r.state.player.commandTokens).toBe(5);
    // T3_ORD_01's board has one Gyro or Sleeper: chosen by itself, it takes 1 damage.
    expect(r.state.log.some((e) => /C1_ORDER_1|damage/.test(e.text))).toBe(true);
  });

  it("C1_ORDER_3 looks at the top 2 tiles of one sector, with no unit needed", () => {
    // T3_ACT_03 with every tile face down: only Dark sectors, no unit.
    const s = given("T3_ACT_03");
    for (const t of Object.values(s.tiles)) t.faceUp = false;
    expect(usableOrders(ctx(s)).map((o) => o.id)).toEqual(["C1_ORDER_3"]);
    const r = runEffect(data(), s, (c) => commandStep(c), [A.option("issueOrder")]);
    expect(r.status === "question" && r.question.prompt).toMatch(/C1_ORDER_3: choose a sector/);
    const k = r.status === "question" && r.question.kind === "sectors" ? r.question.options[0]! : "";
    const r2 = runEffect(data(), s, (c) => commandStep(c), [A.option("issueOrder"), A.sectors(k)]);
    if (r2.status === "illegal") throw new Error(r2.reason);
    expect(r2.state.log.some((e) => /C1_ORDER_3: look at the top \d tiles? of/.test(e.text))).toBe(true);
    expect(r2.state.player.commandTokens).toBe(5);
  });

  it("C1_ORDER_3 may choose a sector with a unit (round 24): its top 2 tiles, the unit's own first", () => {
    const s = given("T3_ACT_03");
    const r = runEffect(data(), s, (c) => commandStep(c), [A.option("issueOrder")]);
    if (r.status !== "question" || r.question.kind !== "sectors") throw new Error("no sector question");
    const occupied = r.question.options.find((k) => s.field[k]!.length > 1 && s.tiles[s.field[k]!.at(-1)!]!.faceUp);
    expect(occupied).toBeDefined();
    const r2 = runEffect(data(), s, (c) => commandStep(c), [A.option("issueOrder"), A.sectors(occupied!)]);
    if (r2.status === "illegal") throw new Error(r2.reason);
    const top = s.tiles[s.field[occupied!]!.at(-1)!]!.unitId!;
    expect(r2.state.log.some((e) => e.text.includes(`C1_ORDER_3: look at the top 2 tiles of (${occupied}): ${top}, `))).toBe(true);
  });

  it("a game saved in format 9 keeps C1_ORDER_3 on Dark sectors, so it replays the same", () => {
    const f = readSave(readFileSync("tests/fixtures/save-2026-11-21-m03-ways.json", "utf8"));
    expect(f.game!.start.darkLookOrder).toBe(true);
    expect(f.game!.start.oldCampaignOrders).toBeUndefined();
    const g = replayGame(data(), f.game!.start, f.game!.answers);
    expect(g.answers.length).toBe(f.game!.answers.length);
    expect(readSave(JSON.stringify(toSave(g, f.profile))).game!.start.darkLookOrder).toBe(true);
  });

  it("a game saved before (format 8) keeps the old Orders and replays to the same question", () => {
    const f = readSave(readFileSync("tests/fixtures/save-2026-11-21-facing-stuck.json", "utf8"));
    expect(f.game!.start.oldCampaignOrders).toBe(true);
    const g = replayGame(data(), f.game!.start, f.game!.answers);
    expect(g.answers.length).toBe(f.game!.answers.length);
    expect(g.view.status).toBe("question");
    if (g.view.status === "question") expect(g.view.question.facing?.tile).toBe("P_09#1");
    // Written again, it keeps the flag.
    expect(readSave(JSON.stringify(toSave(g, f.profile))).game!.start.oldCampaignOrders).toBe(true);
  });
});
