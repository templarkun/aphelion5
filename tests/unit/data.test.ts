/**
 * Stage 1 data tests: the spec's data checks, the parsers, and that the
 * generated JSON in src/data/generated/ matches the text files.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { runDataChecks } from "../../src/data/checks.js";
import { DATA_FILES, type GameData } from "../../src/data/index.js";
import { parseCompanies } from "../../src/data/company.js";
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

  it("every component file named in the spec is in data/", () => {
    for (const f of Object.values(DATA_FILES)) expect(existsSync(join(REPO_ROOT, "data", f)), f).toBe(true);
  });
});

describe("Company file", () => {
  it("reads both Companies", () => {
    const [v1, v2] = d.companies.companies;
    expect(d.companies.companies.map((c) => c.id)).toEqual(["V1", "V2"]);
    expect(v1!.name).toBe("Support Vessel Of Ko and Van");
    expect(v1!.trait).toBe("At Mission End: Remove 1 damage from each Bay of your Flagship.");
    expect(v2!.trait).toBeUndefined(); // "none"
    expect(v1!.startingEnergy).toEqual({ Yellow: 6, Red: 6, Blue: 6 });
    expect(v2!.startingEnergy).toEqual({ Yellow: 8, Red: 7, Blue: 5 });
    expect([v1!.overhaulSlots, v2!.overhaulSlots]).toEqual([1, 2]);
  });

  it("reads starting Mecha, Bays and Integrity", () => {
    const v1 = d.companies.byId.get("V1")!;
    const v2 = d.companies.byId.get("V2")!;
    expect(v1.startingMecha).toEqual([
      { id: "M_01", count: 10 },
      { id: "M_02", count: 5 },
      { id: "M_03", count: 6 },
      { id: "M_04", count: 6 },
    ]);
    // Flagship V1 at 6/6/6 is the test batches' default.
    expect(v1.bays.map((b) => b.integrity)).toEqual([6, 6, 6]);
    expect(v2.bays.map((b) => [b.number, b.integrity])).toEqual([
      [1, 6],
      [2, 5],
      [3, 4],
      [4, 3],
      [5, 2],
    ]);
    expect(v2.bays[4]!.ability).toBe("[Overload] Remove 1 damage from a unit.");
  });

  it("reads upgrades with their unlock links", () => {
    const v1 = d.companies.byId.get("V1")!;
    const v2 = d.companies.byId.get("V2")!;
    expect(v1.upgrades.filter((u) => u.part === "FLAGSHIP_UPGRADES")).toEqual([]); // "none"
    const u2 = v1.upgrades.find((u) => u.id === "V1_M04_U2")!;
    expect([u2.unlocks, u2.unlockMode, u2.cost]).toEqual([["V1_M04_U2A", "V1_M04_U2B"], "choose_one", 5]);
    const u2a = v1.upgrades.find((u) => u.id === "V1_M04_U2A")!;
    expect([u2a.state, u2a.unlockedBy, u2a.exclusiveWith]).toEqual(["locked", "V1_M04_U2", ["V1_M04_U2B"]]);
    const p1 = v2.upgrades.find((u) => u.id === "V2_P1")!; // used by batch 1 T_MOD_04
    expect([p1.appliesTo, p1.effect]).toEqual([["flagship_bay_1"], 'Bay 1 gains: "Deal 1 damage to a Level 2 unit."']);
    const t4 = v2.upgrades.find((u) => u.id === "V2_T4")!;
    expect([t4.kind, t4.repeatable, t4.cost]).toEqual(["requisition", true, 5]);
  });

  it("refuses a file with a broken part", () => {
    const text = readRepoFile("data", DATA_FILES.companies).replace("bay_count: 3", "bay_count: three");
    expect(() => parseCompanies(text)).toThrow(/bay_count/);
  });

  it("the checks catch a bad unlock link", () => {
    const broken: GameData = structuredClone(d);
    broken.units.byId = new Map(broken.units.units.map((u) => [u.id, u]));
    const u = broken.companies.companies[0]!.upgrades.find((x) => x.id === "V1_M03_U3")!;
    u.unlockedBy = "V1_M03_U9";
    const problems = runDataChecks(broken).flatMap((r) => r.problems);
    expect(problems).toContain("V1 V1_M03_U3: unlocked_by V1_M03_U9 does not exist in V1");
  });
});

describe("Anomaly file", () => {
  it("reads 17 Anomalies with their terms", () => {
    expect(d.anomalies.anomalies).toHaveLength(17);
    expect(d.anomalies.byId.get("14")).toEqual({ id: "14", terms: ["Cleared sector"], minimum: 4, text: "At least 4 Cleared sectors." });
    expect(d.anomalies.byId.get("06")!.terms).toEqual(["Bot", "Sentinel"]);
    expect(d.anomalies.byId.get("13")!.terms).toEqual(["non-Bot unit"]);
  });
});

describe("Expansion1 (Heat module)", () => {
  it("reads the rules H1..H8 and the Heat token count", () => {
    const x = d.expansion1;
    expect(x.name).toBe("Heat module");
    expect(x.heatTokens).toBe(10);
    expect(x.rules.map((r) => r.id)).toEqual(["H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8"]);
    expect(x.byId.get("H7")!.title).toBe("Meltdown (Overload End)");
    expect(x.byId.get("H8")!.text).toBe("Subtract 2 from your final score (Core Rules 10.3).");
  });
});
