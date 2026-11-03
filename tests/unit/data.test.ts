/**
 * Stage 1 data tests: the spec's data checks, the parsers, and that the
 * generated JSON in src/data/generated/ matches the text files.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { runDataChecks } from "../../src/data/checks.js";
import { type GameData, MISSING_DATA_FILES } from "../../src/data/index.js";
import { REPO_ROOT, loadGameData, readRepoFile } from "../../src/data/nodeLoad.js";
import { parseRecordFile } from "../../src/data/records.js";
import { parseScenarios } from "../../src/data/scenarios.js";
import { serialiseGameData } from "../../src/data/serialise.js";

let d: GameData;
beforeAll(() => {
  d = loadGameData();
});

describe("spec data checks", () => {
  it("all pass", () => {
    const failed = runDataChecks(d).filter((r) => r.problems.length > 0);
    expect(failed).toEqual([]);
  });

  it("include the four checks the spec names", () => {
    const names = runDataChecks(d).map((r) => r.name);
    expect(names).toContain("every map is connected");
    expect(names).toContain("Omega sectors are on their maps");
    expect(names).toContain("the Energy deck is 42 Energy Gyros");
    expect(names).toContain("there are 78 Modules, as the DISTRIBUTION line lists");
    expect(names).toContain("every id referenced exists");
  });

  it("catch a broken map, a stray Omega sector and an unknown id", () => {
    const broken: GameData = structuredClone(d);
    // Fix up the Maps lost by structuredClone (they are rebuilt from the arrays).
    broken.units.byId = new Map(broken.units.units.map((u) => [u.id, u]));
    const c = broken.campaigns[0]!;
    c.missionById = new Map(c.missions.map((m) => [m.id, m]));
    const m1 = c.missions[0]!;
    m1.map = [...m1.map, { q: 5, r: 5 }];
    m1.mapSectorCount = m1.map.length;
    m1.omegaSectors = [{ q: 9, r: 9 }];
    m1.omegaPlaced = ["O_02"];
    m1.threat.A = [...m1.threat.A, "S_99"];
    const problems = runDataChecks(broken).flatMap((r) => r.problems);
    expect(problems).toContain("C1_M1: map is not connected");
    expect(problems).toContain("C1_M1: Omega sector (9,9) is not on the map");
    expect(problems).toContain("C1_M1 threat_A: S_99 does not exist");
  });
});

describe("unit file", () => {
  it("reads every unit with its type", () => {
    const count = (t: string) => d.units.units.filter((u) => u.type === t).length;
    expect(d.units.units).toHaveLength(133);
    expect([count("Bot"), count("Mecha"), count("Omega"), count("Sentinel"), count("Flare"), count("Sleeper"), count("Gyro")]).toEqual([
      3, 7, 3, 27, 28, 27, 38,
    ]);
  });

  it("applies section defaults and record overrides", () => {
    expect(d.units.byId.get("B_01")!.copies).toBe(10); // section default
    expect(d.units.byId.get("S_01")!.copies).toBe(4);
    expect(d.units.byId.get("F_01")!.copies).toBe(10); // record wins
    expect(d.units.byId.get("O_02")!.copies).toBe(4);
    expect(d.units.byId.get("G_05")!.copies).toBe(9);
    expect(d.units.byId.get("G_05")!.energyGyro).toBe(true);
    expect(d.units.byId.get("G_10")!.energyGyro).toBe(false);
  });

  it("keeps Levels, arrows, energy and effect text", () => {
    const f01 = d.units.byId.get("F_01")!;
    expect(f01.level).toBe("none");
    expect(f01.energyOnReveal).toEqual({ Yellow: 1, Red: 1, Blue: 1 });
    expect(d.units.byId.get("F_12")!.energyOnReveal).toEqual({ Yellow: 0, Red: 1, Blue: 0 });
    expect(d.units.byId.get("O_01")!.level).toBe("per_campaign");
    expect(d.units.byId.get("S_25")!.level).toBe(5);
    expect(d.units.byId.get("F_23")!.arrows).toEqual([1, 2, 4, 5]);
    expect(d.units.byId.get("M_02")!.abilityKind).toBe("expend");
    expect(d.units.byId.get("G_01")!.text).toEqual({ drain: "Gain 1 Yellow energy.", destroyed: "Gain 2 Yellow energy." });
    // Section-level descriptions are not effect text.
    expect(d.units.byId.get("F_09")!.text.activate).toBe("Boost every Targeted unit.");
    expect(d.units.byId.get("B_01")!.text).toEqual({});
  });

  it("every unit with arrows uses legal side numbers", () => {
    for (const u of d.units.units) for (const s of u.arrows) expect(s >= 1 && s <= 6).toBe(true);
  });
});

describe("Module file", () => {
  it("reads 78 Modules with colour, background and cost", () => {
    expect(d.modules.modules).toHaveLength(78);
    const m6 = d.modules.byId.get(6)!;
    expect([m6.name, m6.colour, m6.background, m6.cost]).toEqual(["Accumulator Beam", "Yellow", "light", 1]);
    const m54 = d.modules.byId.get(54)!;
    expect([m54.name, m54.cost, m54.costVariable]).toEqual(["Debris Sifter", "X", "X is at least 1."]);
    expect(d.modules.byId.get(53)!.name).toBe("Pathfinder Array");
    expect(d.modules.byId.get(3)!.costReduction).toMatch(/other exhausted Modules/);
    for (const m of d.modules.modules) expect(m.background).toBe(m.colour === "Red" ? "red" : "light");
  });

  it("Module 56 inherits the Blue section's light background", () => {
    // Core Rules footnote E says ID 56 had no background colour; it now takes the section default.
    expect(d.modules.byId.get(56)!.background).toBe("light");
  });
});

describe("Campaign 1 file", () => {
  it("reads the Campaign board", () => {
    const c = d.campaigns[0]!;
    expect(c.prefix).toBe("C1");
    expect(c.omega.map((o) => [o.id, o.level])).toEqual([
      ["O_01", 3],
      ["O_02", 13],
      ["O_03", 25],
    ]);
    expect(c.orders.map((o) => [o.id, o.tokens, o.overloadOnly])).toEqual([
      ["C1_ORDER_1", 1, true],
      ["C1_ORDER_2", 1, true],
    ]);
  });

  it("reads all 9 missions with their routes", () => {
    const c = d.campaigns[0]!;
    expect(c.missions.map((m) => m.id)).toEqual(["C1_M1", "C1_M2X", "C1_M2Y", "C1_M3", "C1_M4X", "C1_M4Y", "C1_M5", "C1_M6", "C1_M7"]);
    expect(c.missionById.get("C1_M2X")!.alternativeTo).toBe("C1_M2Y");
    expect(c.missionById.get("C1_M4Y")!.alternativeTo).toBe("C1_M4X");
  });

  it("reads Mission 1 exactly", () => {
    const m = d.campaigns[0]!.missionById.get("C1_M1")!;
    expect(m.deploymentShuffled[0]).toEqual({ id: "O_01", count: 8 });
    expect(m.threat.A).toEqual(["S_12", "S_12", "F_08", "G_24"]);
    expect(m.objective).toEqual({ type: "eliminate", target: "O_01", count: 6 });
    expect(m.event).toEqual({ type: "allied_drop", level: 1 });
    expect(m.map).toHaveLength(10);
    expect(m.order).toEqual({ id: "C1_M1_ORDER", tokens: 4, overloadOnly: false, effect: "Deal 1 damage to all units." });
  });

  it("reads [Overload] mission Orders, missions with none, and Omega placement", () => {
    const c = d.campaigns[0]!;
    expect(c.missionById.get("C1_M4X")!.order).toEqual({ id: "C1_M4X_ORDER", tokens: 1, overloadOnly: true, effect: "Swap two units." });
    expect(c.missionById.get("C1_M2X")!.order).toBeUndefined();
    const m3 = c.missionById.get("C1_M3")!;
    expect(m3.omegaPlaced).toEqual(["O_02"]);
    expect(m3.omegaSectors).toEqual([
      { q: 0, r: -1 },
      { q: 1, r: 2 },
      { q: -1, r: 3 },
    ]);
  });

  it("Mission 4y now lists 11 different sectors (footnote E said (1,-1) was listed twice)", () => {
    const m = d.campaigns[0]!.missionById.get("C1_M4Y")!;
    expect(new Set(m.map.map((x) => `${x.q},${x.r}`)).size).toBe(11);
  });
});

describe("test batches", () => {
  it("batch 1 and batch 2 parse", () => {
    const b1 = parseScenarios(readRepoFile("tests", "batch1.txt"), "batch1.txt");
    const b2 = parseScenarios(readRepoFile("tests", "batch2.txt"), "batch2.txt");
    expect(b1.length).toBeGreaterThan(30);
    expect(b2.length).toBeGreaterThan(30);
    for (const s of [...b1, ...b2]) {
      expect(s.title).not.toBe("");
      if (s.map) expect(d.campaigns[0]!.missionById.has(`C1_${s.map}`)).toBe(true);
    }
  });
});

describe("record reader", () => {
  it("joins continuation lines and refuses repeated keys", () => {
    const f = parseRecordFile("=== SECTION: X ===\nid: A\nthen: one\n      two\n\n=== END OF FILE ===\n");
    expect(f.sections[0]!.records[0]!.fields.then).toBe("one two");
    expect(() => parseRecordFile("=== SECTION: X ===\nid: A\nx: 1\nx: 2\n")).toThrow(/repeats/);
  });
});

describe("generated data", () => {
  it("src/data/generated matches the text files (run npm run build:data after changing data/)", () => {
    for (const [name, value] of Object.entries(serialiseGameData(d))) {
      const path = join(REPO_ROOT, "src", "data", "generated", `${name}.json`);
      expect(existsSync(path), `${name}.json missing`).toBe(true);
      expect(readFileSync(path, "utf8")).toBe(JSON.stringify(value, null, 2) + "\n");
    }
  });

  it("the three files not yet copied in are still listed as missing", () => {
    for (const f of MISSING_DATA_FILES) expect(existsSync(join(REPO_ROOT, "data", f))).toBe(false);
  });
});
