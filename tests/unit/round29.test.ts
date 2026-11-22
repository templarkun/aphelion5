/** Round 29 (designer 2026-11-22): Features changed, statistics after every mission, per Campaign. */
import { describe, expect, it } from "vitest";
import { newStats } from "../../src/engine/events.js";
import { emptyProfile, type GameRecord } from "../../src/engine/state.js";
import { exposureMs } from "../../src/web/exposureFx.js";
import { FEATURE_ROWS, features } from "../../src/web/features.js";
import { retireLive, UNFINISHED_AS } from "../../src/web/briefing/stats/live.js";
import { byCampaign, counted, totals } from "../../src/web/briefing/stats/records.js";

const rec = (p: Partial<GameRecord>): GameRecord => ({
  date: "2026-11-22",
  campaign: "C1",
  company: "V1",
  freshness: "fresh",
  result: "won",
  score: 12,
  missions: [{ mission: "C1_M1", threat: ["A"] }],
  heatModule: false,
  developer: false,
  stats: { ...newStats(), overloads: 3 },
  ...p,
});

describe("round 29", () => {
  it("has the new and replaced Feature choices, old ones gone", () => {
    const ids = (k: string) => FEATURE_ROWS.find((r) => r.key === k)!.list.map((x) => x.id as string);
    expect(ids("gyroEnergy")).toEqual(["tokens", "corner", "ring", "orbit", "pips", "honeycomb", "chain", "string"]);
    expect(ids("readyUnit")).not.toContain("corona");
    expect(ids("readyUnit")).not.toContain("chase");
    // CHANGED round 30: Comet and Fountain removed again; Inflow first; Pulsar and Plasma swarm added.
    expect(ids("readyUnit")).toEqual(expect.arrayContaining(["gyroscope"]));
    expect(ids("overload")).toEqual(["inflow", "original", "loops", "tempest", "torrent", "breath", "embers", "rift", "pulsar", "swarm"]);
    expect(ids("endButton")).toEqual(["sun", "reactor", "singularity", "orb", "hazard", "forge", "gate"]);
    expect(features().endButton).toBe("sun");
  });

  it("plays Strike and Drain as a long, steady stream (CHANGED round 30: about 1.8 s), the others as before", () => {
    expect(exposureMs("strike", 3)).toBe(1800);
    expect(exposureMs("drain", 3)).toBe(1800);
    expect(exposureMs("nova", 3)).toBe(1250);
  });

  it("counts the game under way, merges Lost and Conceded, and splits every number per Campaign", () => {
    const live = rec({ result: "playing", score: 2, missions: [{ mission: "C1_M1", threat: ["A", "B"] }], stats: { ...newStats(), overloads: 5 } });
    const p = { ...emptyProfile(), history: [rec({}), rec({ result: "lost", campaign: "C2" }), rec({ result: "conceded", score: 40 }), rec({ developer: true })], live: { key: "x#1", record: live } };
    const games = counted(p);
    expect(games.length).toBe(4);
    const t = totals(games);
    expect([t.games, t.won, t.lostConceded, t.playing, t.missions, t.overloads, t.best]).toEqual([4, 1, 2, 1, 4, 14, 40]);
    const per = byCampaign(games);
    expect(per.map((x) => [x.campaign, x.t.games, x.t.won, x.t.lostConceded])).toEqual([
      ["C1", 3, 1, 1],
      ["C2", 1, 0, 1],
    ]);
    // A game left for a new one counts as Lost / Conceded (I35, designer 2026-11-22).
    const after = retireLive(p);
    expect(after.live).toBeUndefined();
    expect(after.history!.at(-1)!.result).toBe(UNFINISHED_AS);
    expect(UNFINISHED_AS).toBe("conceded");
    expect(totals(counted(after)).lostConceded).toBe(3);
  });
});
