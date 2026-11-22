/**
 * Round of 2026-11-20 (designer, screen only): the Allied Drop event and prompt, the features'
 * hexagon outlines. No rule changes.
 */
import { describe, expect, it } from "vitest";
import { loadGameData } from "../../src/data/nodeLoad.js";
import { newEvents } from "../../src/engine/events.js";
import { newRng } from "../../src/engine/rng.js";
import { playAnswer, startGame } from "../../src/engine/save.js";
import { emptyProfile } from "../../src/engine/state.js";
import { allyDropUnit } from "../../src/web/AllyDrop.js";
import { alongOutline, hexOutline } from "../../src/web/features.js";
import { randomAnswer } from "./campaignFuzz.js";

const data = loadGameData();

describe("Allied Drop (7.3): the Mecha shown, then dropped", () => {
  it("reads the Mecha from the question and emits one `dropped` event for its sector", () => {
    const r = newRng(8);
    let g = startGame(data, { seed: 1, date: "2026-11-20", profile: emptyProfile(), developerMode: false, autoAnswer: true });
    let found = false;
    for (let n = 0; n < 60 && g.view.status === "question"; n++) {
      const q = g.view.question;
      const id = allyDropUnit(q.prompt);
      if (id && q.kind === "sectors") {
        const before = g.view.state;
        const next = playAnswer(data, g, { kind: "sectors", value: [q.options[0]!] });
        // A Mecha with arrows asks its facing first; the drop is emitted once it is put on the Field.
        let after = next.game;
        if (after.view.status === "question" && after.view.question.facing) after = playAnswer(data, after, { kind: "option", value: "0" }).game;
        const drops = newEvents(before.events, after.view.state.events).filter((e) => e.kind === "dropped");
        expect(drops).toHaveLength(1);
        expect(drops[0]).toMatchObject({ unitId: id, sector: q.options[0] });
        const top = after.view.state.field[q.options[0]!]!.at(-1)!;
        expect(after.view.state.tiles[top]!.unitId).toBe(id);
        found = true;
        break;
      }
      g = playAnswer(data, g, randomAnswer(r, q)).game;
    }
    expect(found).toBe(true);
    expect(allyDropUnit("Allied Drop - Level 1: choose a Mecha.")).toBeUndefined();
    expect(allyDropUnit(undefined)).toBeUndefined();
  });
});

describe("Features: tile corners", () => {
  const radius = (pts: number[]) => pts.reduce((m, v, i) => (i % 2 ? m : Math.max(m, Math.hypot(v, pts[i + 1]!))), 0);
  it("Original is the sharp hexagon; rounder corners stay inside it and get rounder", () => {
    const sharp = hexOutline(0, 0, 100, "original");
    expect(sharp).toHaveLength(12);
    expect(radius(sharp)).toBeCloseTo(100, 5);
    let last = 100;
    for (const c of ["soft", "round", "pebble"] as const) {
      const pts = hexOutline(0, 0, 100, c);
      expect(pts.length).toBe(6 * 7 * 2);
      const r = radius(pts);
      expect(r).toBeLessThan(last);
      expect(r).toBeGreaterThan(80);
      last = r;
    }
    expect(hexOutline(0, 0, 100, "bevel")).toHaveLength(24);
  });
  it("a point along the outline goes all the way round", () => {
    const pts = hexOutline(10, 20, 50, "round");
    const a = alongOutline(pts, 0);
    const b = alongOutline(pts, 1);
    expect(a.x).toBeCloseTo(b.x, 5);
    expect(a.y).toBeCloseTo(b.y, 5);
    const half = alongOutline(pts, 0.5);
    expect(Math.hypot(half.x - a.x, half.y - a.y)).toBeGreaterThan(80);
  });
});
