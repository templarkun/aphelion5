/** Round 28 (designer 2026-11-22): new Features, the Energy Gyro reward, Exposure's look. */
import { describe, expect, it } from "vitest";
import { gyroReward } from "../../src/web/gyroEnergy.js";
import { chainOrder, exposureMs } from "../../src/web/exposureFx.js";
import { FEATURE_ROWS, features } from "../../src/web/features.js";
import { data } from "./helpers.js";

describe("round 28", () => {
  it("reads the energy each Energy Gyro gives when destroyed, and nothing for other units", () => {
    const want: Record<string, string> = { G_01: "2 Yellow", G_02: "4 Yellow", G_03: "5 Yellow", G_04: "6 Yellow", G_05: "2 Red", G_06: "4 Red", G_07: "1 Blue", G_08: "2 Blue", G_09: "3 Blue" };
    for (const [id, w] of Object.entries(want)) {
      const r = gyroReward(data().units.byId.get(id));
      expect(`${r?.n} ${r?.colour}`).toBe(w);
    }
    expect(gyroReward(data().units.byId.get("G_10"))).toBeUndefined();
    expect(gyroReward(data().units.byId.get("B_01"))).toBeUndefined();
  });

  it("chain lightning visits every unit once, nearest first", () => {
    expect(chainOrder({ x: 0, y: 0 }, [{ x: 50, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 0 }])).toEqual([1, 2, 0]);
    expect(exposureMs("chain", 1)).toBeLessThan(exposureMs("chain", 4));
    expect(exposureMs("chain", 20)).toBeLessThanOrEqual(1900);
  });

  it("offers the new Features with unique choices and sensible defaults", () => {
    const keys = FEATURE_ROWS.map((r) => r.key);
    // Round 29: "Overload End button" added; Overload edge 8 looks, Energy Gyro reward 8.
    expect(keys).toEqual(["corners", "depth", "readyUnit", "readySector", "names", "overload", "next", "gyroEnergy", "exposure", "endButton"]);
    const n = Object.fromEntries(FEATURE_ROWS.map((r) => [r.key, r.list.length]));
    expect(n).toEqual({ corners: 5, depth: 5, readyUnit: 15, readySector: 15, names: 2, overload: 10, next: 4, gyroEnergy: 8, exposure: 5, endButton: 7 }); // CHANGED round 30: overload 10
    for (const r of FEATURE_ROWS) expect(new Set(r.list.map((x) => x.id)).size).toBe(r.list.length);
    expect(features().gyroEnergy).toBe("tokens");
    expect(features().exposure).toBe("strike");
  });
});
