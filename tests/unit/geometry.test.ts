/**
 * Stage 1 geometry tests: tests/batch1.txt section GEOMETRY (T_GEO_01..08),
 * plus the M1 neighbour and row table in the batch 2 FORMAT SPEC.
 *
 * T_GEO_03..08 are full scenarios (Boost, destroy, Jump...). Stage 1 checks
 * their geometry - which sectors are Targeted, on a line of fire, in a
 * straight line, or on a Jump path. The token and unit results in their
 * "then" lines are checked again when stages 2 and 5 run those scenarios
 * end to end.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { type CampaignDatabase, missionForMapName, missionMap } from "../../src/data/campaign.js";
import { loadGameData, readRepoFile } from "../../src/data/nodeLoad.js";
import { type Scenario, parseScenarios } from "../../src/data/scenarios.js";
import type { UnitDatabase } from "../../src/data/units.js";
import { FieldMap } from "../../src/geometry/fieldMap.js";
import {
  type Coord,
  type Side,
  SIDES,
  arrowSides,
  coord as c,
  opposite,
  rotateSide,
  show,
  turnClockwise,
} from "../../src/geometry/hex.js";

let campaign: CampaignDatabase;
let units: UnitDatabase;
let batch1: Map<string, Scenario>;

beforeAll(() => {
  const d = loadGameData();
  campaign = d.campaigns[0]!;
  units = d.units;
  batch1 = new Map(parseScenarios(readRepoFile("tests", "batch1.txt"), "batch1.txt").map((s) => [s.id, s]));
});

/** The map a scenario names, e.g. "M2X" -> C1_M2X. */
function mapOf(id: string): FieldMap {
  const s = batch1.get(id);
  if (!s?.map) throw new Error(`${id} not found in batch1.txt or has no map`);
  return missionMap(missionForMapName(campaign, s.map));
}

const shown = (cs: readonly (Coord | undefined)[]) => cs.map((x) => (x ? show(x) : "none"));
const sorted = (cs: readonly Coord[]) => shown(cs).sort();

function arrowsOf(unitId: string): Side[] {
  const u = units.byId.get(unitId);
  if (!u) throw new Error(`unit ${unitId} missing`);
  return u.arrows;
}

describe("Core Rules 3.8 basics", () => {
  it("side numbering and opposites", () => {
    expect(opposite(1)).toBe(4);
    expect(opposite(2)).toBe(5);
    expect(opposite(3)).toBe(6);
    expect(opposite(6)).toBe(3);
  });

  it("facing: arrow on side s points to ((s - 1 + f) mod 6) + 1", () => {
    expect(rotateSide(1, 0)).toBe(1);
    expect(rotateSide(6, 1)).toBe(1);
    expect(rotateSide(4, 5)).toBe(3);
    for (const s of SIDES) expect(rotateSide(s, 0)).toBe(s);
  });

  it("turning clockwise adds 1 to f, and 6 becomes 0", () => {
    expect(turnClockwise(5)).toBe(0);
    expect(turnClockwise(0, 6)).toBe(0);
    expect(turnClockwise(4, 3)).toBe(1);
  });

  it("Mission 2x example: the rising diagonal r = 2 crosses the gap at (0,2)", () => {
    const m = missionMap(missionForMapName(campaign, "M2X"));
    expect(m.has(c(0, 2))).toBe(false);
    expect(shown(m.row(c(1, 2), "rising").sectors)).toEqual(["(-1,2)", "(1,2)"]);
    expect(m.areAdjacent(c(1, 2), c(-1, 2))).toBe(false);
  });
});

describe("tests/batch1.txt - GEOMETRY", () => {
  it("every geometry scenario is present in batch1.txt", () => {
    const ids = [...batch1.values()].filter((s) => s.section === "GEOMETRY").map((s) => s.id);
    expect(ids).toEqual(["T_GEO_01", "T_GEO_02", "T_GEO_03", "T_GEO_04", "T_GEO_05", "T_GEO_06", "T_GEO_07", "T_GEO_08"]);
  });

  it("T_GEO_01 neighbours of a central and an edge sector", () => {
    const m = mapOf("T_GEO_01");
    const n0 = m.neighboursBySide(c(0, 0));
    expect(shown(SIDES.map((s) => n0[s]))).toEqual(["(0,-1)", "(1,-1)", "(1,0)", "(0,1)", "(-1,1)", "(-1,0)"]);
    const n2 = m.neighboursBySide(c(0, 2));
    expect(shown(SIDES.map((s) => n2[s]))).toEqual(["(0,1)", "(1,1)", "none", "none", "none", "(-1,2)"]);
  });

  it("T_GEO_02 the three rows through (0,0)", () => {
    const m = mapOf("T_GEO_02");
    expect(shown(m.row(c(0, 0), "horizontal").sectors)).toEqual(["(0,-1)", "(0,0)", "(0,1)", "(0,2)"]);
    expect(shown(m.row(c(0, 0), "rising").sectors)).toEqual(["(-1,0)", "(0,0)", "(1,0)"]);
    expect(shown(m.row(c(0, 0), "falling").sectors)).toEqual(["(-1,1)", "(0,0)", "(1,-1)"]);
    expect(m.rowsThrough(c(0, 0))).toHaveLength(3);
  });

  it("T_GEO_03 facing rotates Targeted sectors (F_09 at f=1)", () => {
    const m = mapOf("T_GEO_03");
    expect(arrowsOf("F_09")).toEqual([1, 2, 3, 4]);
    const a = m.arrows(c(0, 0), arrowsOf("F_09"), 1);
    expect(a.map((x) => x.side)).toEqual([2, 3, 4, 5]);
    expect(shown(a.map((x) => x.targeted))).toEqual(["(1,-1)", "(1,0)", "(0,1)", "(-1,1)"]);
    // Not Targeted: (0,-1) and (-1,0).
    const targeted = new Set(shown(a.map((x) => x.targeted)));
    expect(targeted.has("(0,-1)")).toBe(false);
    expect(targeted.has("(-1,0)")).toBe(false);
  });

  it("T_GEO_04 turning clockwise, then lines of fire (S_16)", () => {
    const m = mapOf("T_GEO_04");
    expect(arrowsOf("S_16")).toEqual([1, 4]);
    const f = turnClockwise(0, 2); // 2 Sentinels on the Field
    expect(f).toBe(2);
    const a = m.arrows(c(0, 0), arrowsOf("S_16"), f);
    expect(a.map((x) => x.side)).toEqual([3, 6]);
    expect(shown(a[0]!.lineOfFire)).toEqual(["(1,0)"]);
    expect(shown(a[1]!.lineOfFire)).toEqual(["(-1,0)"]);
    // (0,1) is on neither line.
    expect(a.some((x) => x.lineOfFire.some((p) => p.q === 0 && p.r === 1))).toBe(false);
  });

  it("T_GEO_05 a line of fire continues across a gap (M_02 at f=5, Mission 2x)", () => {
    const m = mapOf("T_GEO_05");
    expect(arrowsOf("M_02")).toEqual([1, 3]);
    const a = m.arrows(c(1, 2), arrowsOf("M_02"), 5);
    expect(a.map((x) => x.side)).toEqual([6, 2]);
    expect(m.has(c(0, 2))).toBe(false); // the gap
    expect(shown(a[0]!.lineOfFire)).toEqual(["(-1,2)"]);
    expect(m.has(c(2, 1))).toBe(false);
    expect(a[1]!.lineOfFire).toEqual([]);
  });

  it("T_GEO_06 a gap next to an arrow means nothing is Targeted (F_23, Mission 2x)", () => {
    const m = mapOf("T_GEO_06");
    expect(arrowsOf("F_23")).toEqual([1, 2, 4, 5]);
    const a = m.arrows(c(0, 1), arrowsOf("F_23"), 0);
    expect(a.map((x) => x.side)).toEqual([1, 2, 4, 5]);
    expect(shown(a.map((x) => x.targeted))).toEqual(["(0,0)", "(1,0)", "none", "(-1,2)"]);
  });

  it("T_GEO_07 M_05 Jump path: right from (0,-1) passes (0,0), (0,1) and lands on (0,2)", () => {
    const m = mapOf("T_GEO_07");
    const ray = m.ray(c(0, -1), 4);
    expect(ray.map((x) => [show(x.at), x.onMap])).toEqual([
      ["(0,0)", true],
      ["(0,1)", true],
      ["(0,2)", true],
    ]);
    // If (0,2) held a unit too, the next step (0,3) is off the map: no landing sector.
    expect(m.has(c(0, 3))).toBe(false);
  });

  it("T_GEO_08 M_04 ranged Attack: (0,2) is in a straight line from (0,-1)", () => {
    const m = mapOf("T_GEO_08");
    expect(m.inStraightLine(c(0, -1), c(0, 2))).toBe(true);
    expect(shown(m.straightLines(c(0, -1))[4])).toEqual(["(0,0)", "(0,1)", "(0,2)"]);
    // A sector that is not on any of the six lines.
    expect(m.inStraightLine(c(0, -1), c(1, 1))).toBe(false);
  });
});

describe("tests/batch2.txt FORMAT SPEC - Mission 1 neighbours and rows", () => {
  // The table as printed in batch 2, item 3.
  const table: [Coord, Coord[]][] = [
    [c(1, -1), [c(1, 0), c(0, 0), c(0, -1)]],
    [c(1, 0), [c(1, -1), c(1, 1), c(0, 1), c(0, 0)]],
    [c(1, 1), [c(1, 0), c(0, 2), c(0, 1)]],
    [c(0, -1), [c(1, -1), c(0, 0), c(-1, 0)]],
    [c(0, 0), [c(0, -1), c(1, -1), c(1, 0), c(0, 1), c(-1, 1), c(-1, 0)]],
    [c(0, 1), [c(0, 0), c(1, 0), c(1, 1), c(0, 2), c(-1, 2), c(-1, 1)]],
    [c(0, 2), [c(0, 1), c(1, 1), c(-1, 2)]],
    [c(-1, 0), [c(0, -1), c(0, 0), c(-1, 1)]],
    [c(-1, 1), [c(-1, 0), c(0, 0), c(0, 1), c(-1, 2)]],
    [c(-1, 2), [c(-1, 1), c(0, 1), c(0, 2)]],
  ];

  it("covers every Mission 1 sector", () => {
    const m = missionMap(missionForMapName(campaign, "M1"));
    expect(sorted(table.map(([p]) => p))).toEqual(sorted(m.sectors));
  });

  for (const [p, ns] of table) {
    it(`neighbours of ${show(p)}`, () => {
      const m = missionMap(missionForMapName(campaign, "M1"));
      expect(sorted(m.adjacent(p))).toEqual(sorted(ns));
      for (const n of ns) expect(m.areAdjacent(n, p)).toBe(true);
    });
  }

  it("horizontal rows q = 1, 0, -1", () => {
    const m = missionMap(missionForMapName(campaign, "M1"));
    const rows = m.allRows("horizontal").map((r) => [r.value, shown(r.sectors)]);
    expect(rows).toEqual([
      [-1, ["(-1,0)", "(-1,1)", "(-1,2)"]],
      [0, ["(0,-1)", "(0,0)", "(0,1)", "(0,2)"]],
      [1, ["(1,-1)", "(1,0)", "(1,1)"]],
    ]);
  });
});

describe("general geometry properties on every Campaign 1 map", () => {
  it("adjacency is symmetric, and a sector is never its own neighbour", () => {
    for (const mission of campaign.missions) {
      const m = missionMap(mission);
      for (const p of m.sectors) {
        for (const n of m.adjacent(p)) {
          expect(m.areAdjacent(n, p)).toBe(true);
          expect(show(n)).not.toBe(show(p));
        }
      }
    }
  });

  it("every sector lies on exactly three rows, each containing it", () => {
    for (const mission of campaign.missions) {
      const m = missionMap(mission);
      for (const p of m.sectors) {
        const rows = m.rowsThrough(p);
        expect(rows.map((r) => r.kind)).toEqual(["horizontal", "rising", "falling"]);
        for (const r of rows) expect(shown(r.sectors)).toContain(show(p));
      }
    }
  });

  it("a line of fire never includes its own sector and only holds map sectors", () => {
    for (const mission of campaign.missions) {
      const m = missionMap(mission);
      for (const p of m.sectors) {
        for (const s of SIDES) {
          const line = m.lineOfFire(p, s);
          expect(shown(line)).not.toContain(show(p));
          for (const x of line) expect(m.has(x)).toBe(true);
          // Lines run along the row of their side.
          const row = m.row(p, s === 1 || s === 4 ? "horizontal" : s === 3 || s === 6 ? "rising" : "falling");
          for (const x of line) expect(shown(row.sectors)).toContain(show(x));
        }
      }
    }
  });

  it("both lines of fire through a row's sides add up to the row minus the sector", () => {
    for (const mission of campaign.missions) {
      const m = missionMap(mission);
      for (const p of m.sectors) {
        for (const [kind, [a, b]] of [
          ["horizontal", [1, 4]],
          ["rising", [3, 6]],
          ["falling", [2, 5]],
        ] as const) {
          const both = [...m.lineOfFire(p, a), ...m.lineOfFire(p, b)];
          expect(sorted(both)).toEqual(sorted(m.row(p, kind).sectors.filter((x) => show(x) !== show(p))));
        }
      }
    }
  });

  it("arrowSides keeps printed order and rotates all arrows together", () => {
    expect(arrowSides([1, 4], 2)).toEqual([3, 6]);
    expect(arrowSides([1, 2, 4, 5], 3)).toEqual([4, 5, 1, 2]);
  });

  it("a map that lists a sector twice is refused", () => {
    expect(() => new FieldMap([c(0, 0), c(0, 0)])).toThrow(/twice/);
  });
});
