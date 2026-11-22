/** Round 30 (designer 2026-11-22): wilder Features animations. */
import { describe, expect, it } from "vitest";
import { FEATURE_ROWS, features } from "../../src/web/features.js";
import { END_BURST_MS, endBurstMs } from "../../src/web/endBurstFx.js";
import { pulsarNodes, swarmCount, swarmMote } from "../../src/web/overloadPartner.js";
import { setMotion } from "../../src/web/motion.js";

const ids = (k: string) => FEATURE_ROWS.find((r) => r.key === k)!.list.map((x) => x.id as string);

describe("round 30", () => {
  it("replaces the ready looks the designer named, and makes Inflow the default Overload edge", () => {
    for (const gone of ["comet", "fountain", "sparkle", "motes"]) expect(ids("readyUnit")).not.toContain(gone);
    expect(ids("readyUnit")).toEqual(expect.arrayContaining(["helix", "radar", "fieldlines", "constellation"]));
    for (const gone of ["embers", "rain"]) expect(ids("readySector")).not.toContain(gone);
    expect(ids("readySector")).toEqual(expect.arrayContaining(["warp", "nebula"]));
    expect(ids("readyUnit").length).toBe(15);
    expect(ids("readySector").length).toBe(15);
    expect(ids("overload")[0]).toBe("inflow");
    expect(ids("overload")).toEqual(expect.arrayContaining(["pulsar", "swarm"]));
    expect(features().overload).toBe("inflow");
  });

  it("gives every End the Overload look its own end, of different lengths, scaled by the speed setting", () => {
    expect(Object.keys(END_BURST_MS).sort()).toEqual([...ids("endButton")].sort());
    expect(new Set(Object.values(END_BURST_MS)).size).toBeGreaterThanOrEqual(6);
    for (const ms of Object.values(END_BURST_MS)) expect(ms).toBeGreaterThanOrEqual(800), expect(ms).toBeLessThanOrEqual(1600);
    setMotion({ speed: "slow" });
    expect(endBurstMs("sun")).toBe(2500);
    setMotion({ speed: "instant" });
    expect(endBurstMs("sun")).toBe(0);
    setMotion({ speed: "normal" });
    expect(endBurstMs("singularity")).toBe(1500);
  });

  it("keeps Pulsar's nodes and the swarm on the Field's edge band, worked out from the time alone", () => {
    const w = 900;
    const h = 600;
    const nodes = pulsarNodes(w, h, 1234);
    expect(nodes.length).toBeGreaterThanOrEqual(8);
    for (const n of nodes) {
      expect(n.charge).toBeGreaterThanOrEqual(0);
      expect(n.charge).toBeLessThanOrEqual(1);
      expect(Math.min(n.x, w - n.x, n.y, h - n.y)).toBeLessThan(8);
    }
    // Some node is firing at any moment (two charges run round the edge).
    expect(pulsarNodes(w, h, 5000).some((n) => n.fired >= 0)).toBe(true);
    const n = swarmCount(2 * (w + h));
    for (let i = 0; i < n; i++) {
      const m = swarmMote(i, 7777, w, h)!;
      expect(Math.min(m.x, w - m.x, m.y, h - m.y)).toBeLessThan(80);
      expect(swarmMote(i, 7777, w, h)).toEqual(m);
    }
  });
});
