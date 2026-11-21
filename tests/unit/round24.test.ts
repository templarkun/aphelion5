/** Round 24 (designer 2026-11-21): M_03's equal ways, the tiles looked at in a sector. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readSave, replayGame } from "../../src/engine/save.js";
import { mechaDragPlan } from "../../src/web/drag.js";
import { seenInSector } from "../../src/web/seen.js";
import { data } from "./helpers.js";

describe("round 24", () => {
  it("M_03 dropped on a unit it reaches by several ways that end the same: no 'which way' question", () => {
    const f = readSave(readFileSync("tests/fixtures/save-2026-11-21-m03-ways.json", "utf8"));
    const g = replayGame(data(), f.game!.start, f.game!.answers);
    const q = g.view.status === "question" && g.view.question.kind === "option" ? g.view.question : undefined;
    const o = q?.shortcuts?.find((x) => x.id.startsWith("mecha:M_03") && x.on?.kind === "unit");
    const plan = mechaDragPlan(data(), g, g.view, o!.on!.kind === "unit" ? o!.on!.id : "");
    const t = plan!.targets.find((x) => x.sector === "-1,2" && x.kind === "attack");
    expect(t?.next).toBeUndefined();
    expect(t?.answers.map((a) => a.value)).toEqual(["mecha:M_03#5:attack", "move:0,2"]);
  });

  it("lists the face-down tiles looked at in a sector, top first, '?' for the ones in between", () => {
    const f = readSave(readFileSync("tests/fixtures/save-2026-11-21-m03-ways.json", "utf8"));
    const s = structuredClone(replayGame(data(), f.game!.start, f.game!.answers).view.state);
    const k = Object.keys(s.field).find((x) => s.field[x]!.length >= 3 && s.tiles[s.field[x]!.at(-1)!]!.faceUp)!;
    const st = s.field[k]!;
    for (const t of st) if (t !== st.at(-1)) s.tiles[t]!.faceUp = false;
    expect(seenInSector(s, k)).toEqual([]);
    s.seen = [st.at(-3)!];
    const rows = seenInSector(s, k);
    expect(rows.map((r) => r.label)).toEqual(["1st beneath", "2nd beneath"]);
    expect(rows[0]!.unitId).toBeUndefined();
    expect(rows[1]!.unitId).toBe(s.tiles[st.at(-3)!]!.unitId);
    // A Dark sector counts from its top tile.
    s.tiles[st.at(-1)!]!.faceUp = false;
    s.seen = [st.at(-1)!];
    expect(seenInSector(s, k).map((r) => r.label)).toEqual(["Top"]);
  });
});
