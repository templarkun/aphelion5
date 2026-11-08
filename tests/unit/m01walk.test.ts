/**
 * M_01 walks (designer 2026-11-08): its Command "Move to an adjacent Dark sector" used several
 * times in a row (4.2: any number of Commands), played for the player by the screen. No rule change:
 * every step is an ordinary answer the engine checks.
 */
import { describe, expect, it } from "vitest";
import { sectorOf } from "../../src/engine/field.js";
import { newRng } from "../../src/engine/rng.js";
import { type Game, playAnswer, startGame } from "../../src/engine/save.js";
import { emptyProfile } from "../../src/engine/state.js";
import { SIDES, fromKey, key, neighbourCoord } from "../../src/geometry/hex.js";
import { m01Targets, m01Walks } from "../../src/web/drag.js";
import { randomAnswer } from "./campaignFuzz.js";
import { data } from "./helpers.js";

const neighbours = (k: string) => SIDES.map((sd) => key(neighbourCoord(fromKey(k), sd)));

/** The first game (seed 1 up) where an M_01 can walk through a Dark sector to Attack. */
function findWalk(): { g: Game; tile: string } {
  for (let seed = 1; seed < 200; seed++) {
    const r = newRng(seed * 7 + 1);
    let g = startGame(data(), { seed, date: "2026-11-07", profile: emptyProfile(), developerMode: false, autoAnswer: true });
    for (let n = 0; n < 400 && g.view.status === "question"; n++) {
      const q = g.view.question;
      if (g.view.state.phase === "command")
        for (const o of q.shortcuts ?? [])
          if (o.id.endsWith(":ability:M_01") && o.on?.kind === "unit" && m01Targets(data(), g, o.on.id, "attack").some((t) => t.via)) return { g, tile: o.on.id };
      let a = randomAnswer(r, q);
      for (let k = 0; k < 30 && a.kind === "option" && a.value === "concede"; k++) a = randomAnswer(r, q);
      const res = playAnswer(data(), g, a);
      if (res.result.status === "illegal" || res.result.status === "blocked") break;
      g = res.game;
    }
  }
  throw new Error("no M_01 walk found");
}

describe("M_01 walks", () => {
  const { g, tile } = findWalk();

  it("every walk is a chain of legal Moves, one sector at a time, ending where it says", () => {
    const walks = m01Walks(data(), g, tile);
    expect(walks.length).toBeGreaterThan(0);
    for (const w of walks) {
      let x = g;
      let at = sectorOf(x.view.state, tile)!;
      for (const a of w.answers) {
        const r = playAnswer(data(), x, a);
        expect(r.result.status).not.toBe("illegal");
        x = r.game;
        const now = sectorOf(x.view.state, tile)!;
        if (now !== at) expect(neighbours(at)).toContain(now);
        at = now;
      }
      expect(at).toBe(w.sector);
    }
  });

  it("an Attack through a Dark sector walks first, then Attacks a unit next to where it stopped", () => {
    const t = m01Targets(data(), g, tile, "attack").find((x) => x.via)!;
    let x = g;
    for (const a of t.answers.slice(0, -2)) x = playAnswer(data(), x, a).game;
    const stop = sectorOf(x.view.state, tile)!;
    expect(neighbours(stop)).toContain(t.sector);
    for (const a of t.answers.slice(-2)) {
      const r = playAnswer(data(), x, a);
      expect(r.result.status).not.toBe("illegal");
      x = r.game;
    }
    // M_01 is destroyed by its Attack (4.2).
    expect(sectorOf(x.view.state, tile)).toBeUndefined();
  });
});
