// The outro at Game End (designer 2026-11-16; screen only): its timing, and the numbers of the
// Campaign Debrief, which are read from the finished game (Core Rules 10.3) and never worked out anew.
import { expect, test } from "vitest";
import { newRng } from "../../src/engine/rng.js";
import { playAnswer, startGame, type Game } from "../../src/engine/save.js";
import { emptyProfile } from "../../src/engine/state.js";
import { DEFAULT_OUTRO, OUTROS, outroFor } from "../../src/web/outro/index.js";
import { campaignStatsOf, sampleStats, totalTurnsOf } from "../../src/web/outro/stats.js";
import { ACT_AT, actAt, DEBRIEF_AT, DOORS_AT, DOORS_OPEN_AT, FILM_SECONDS, impactsBy, impactTimes, LAST_IMPACT, pylonCount, REENTRY_AT, releaseTimes, RESOLVE_AT, sitePlaces } from "../../src/web/outro/terraformer/timeline.js";
import { companyTheme, FALLBACK_THEME } from "../../src/web/outro/themes.js";
import { hasOutro } from "../../src/web/outro/VictoryOutro.js";
import { randomAnswer } from "./campaignFuzz.js";
import { data } from "./helpers.js";

/** A Developer-mode game played to Game End: every mission won with the Developer shortcut, the rest answered at random. */
function playToEnd(seed: number, concedeAt?: number): Game {
  const r = newRng(seed * 13 + 5);
  let g = startGame(data(), { seed, date: "2026-11-16", profile: emptyProfile(), developerMode: true, autoAnswer: true });
  let wins = 0;
  for (let n = 0; n < 2000 && g.view.status === "question"; n++) {
    const q = g.view.question;
    let a = randomAnswer(r, q);
    if (q.kind === "option" && q.options.some((o) => o.id === "devWin")) {
      a = { kind: "option", value: wins === concedeAt ? "concede" : "devWin" };
      wins++;
    } else if (q.upgrade) a = q.kind === "yesno" ? { kind: "yesno", value: true } : { kind: "option", value: "done" };
    const res = playAnswer(data(), g, a);
    expect(res.result.status === "illegal" || res.result.status === "blocked").toBe(false);
    g = res.game;
  }
  return g;
}

test("the film is 10 to 12 seconds, in four acts, and every cue falls in its act", () => {
  expect(FILM_SECONDS).toBeGreaterThanOrEqual(10);
  expect(FILM_SECONDS).toBeLessThanOrEqual(12);
  expect([...ACT_AT]).toEqual([0, 2.5, 5.5, 8.5]);
  expect([0, 2.4, 2.5, 5.4, 5.5, 8.4, 8.5, 30].map(actAt)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  // Act 1: doors, then every pylon away. Act 2: re-entry. Act 3: every hit. Act 4: the sun, then the Debrief.
  expect(actAt(DOORS_AT)).toBe(1);
  expect(DOORS_OPEN_AT).toBeLessThan(ACT_AT[1]);
  expect(actAt(REENTRY_AT)).toBe(2);
  expect(actAt(RESOLVE_AT)).toBe(4);
  expect(DEBRIEF_AT).toBeGreaterThan(RESOLVE_AT);
  expect(DEBRIEF_AT).toBeLessThan(FILM_SECONDS);
});

test("one pylon per mission won: all leave the bay in Act 1 and hit one by one in Act 3", () => {
  for (const n of [1, 2, 5, 7, 9, 12]) {
    const hits = impactTimes(n);
    const rel = releaseTimes(n);
    expect(hits.length).toBe(n);
    expect(rel.length).toBe(n);
    for (let i = 0; i < n; i++) {
      expect(actAt(rel[i]!)).toBe(1);
      expect(rel[i]!).toBeGreaterThan(DOORS_AT);
      expect(actAt(hits[i]!)).toBe(3);
      expect(hits[i]!).toBeLessThanOrEqual(LAST_IMPACT + 1e-9);
      if (i) {
        expect(hits[i]!).toBeGreaterThan(hits[i - 1]!);
        expect(rel[i]!).toBeGreaterThan(rel[i - 1]!);
      }
    }
    expect(impactsBy(hits[0]! - 0.01, n)).toBe(0);
    expect(impactsBy(hits[n - 1]!, n)).toBe(n);
    // Each has its own place in the sector, on a wide screen and on a tall one.
    for (const tall of [false, true]) {
      const places = sitePlaces(n, tall);
      expect(places.length).toBe(n);
      expect(new Set(places.map((p) => `${p.lon.toFixed(3)}:${p.lat.toFixed(3)}`)).size).toBe(n);
      for (const p of places) expect(Math.hypot(p.lon, p.lat)).toBeLessThan(12);
    }
  }
  expect(pylonCount(7)).toBe(7);
  expect(pylonCount(0)).toBe(7);
  expect(pylonCount(40)).toBe(12);
});

test("the Debrief shows the finished game: the engine's score, every mission won with its Threat columns, the Modules held", () => {
  const g = playToEnd(3);
  const s = g.view.state;
  expect(s.outcome?.result).toBe("won");
  expect(s.ending).toBeDefined();
  expect(hasOutro(s)).toBe(true);
  const st = campaignStatsOf(data(), s);
  expect(st.campaignName).toBe("Campaign 1");
  expect(st.vesselName).toBe(data().companies.byId.get(s.player.company)!.name);
  expect(st.freshness).toBe(s.run.freshness);
  // Campaign 1 has seven mission numbers: seven missions won, in order, one of each alternative pair.
  expect(st.missions.map((m) => m.id)).toEqual(s.run.completed.map((r) => r.mission));
  expect(st.missions.length).toBe(7);
  expect(st.missions.map((m) => m.tag.replace(/[XY]$/, ""))).toEqual(["M1", "M2", "M3", "M4", "M5", "M6", "M7"]);
  expect(st.missions[0]!.label).toBe("Mission 1");
  for (const [i, m] of st.missions.entries()) expect(m.threat).toEqual([...s.run.completed[i]!.threat].sort());
  // 10.3: +1 for each Threat column of every mission completed, +5 for the whole Campaign, modifiers.
  expect(st.threatLevelsConquered).toBe(s.run.completed.reduce((n, r) => n + r.threat.length, 0));
  expect(st.score).toBe(s.ending!.score);
  expect(st.score).toBe(st.threatLevelsConquered + 5 - (s.settings.heatModule ? 2 : 0));
  expect(st.scoreParts).toEqual(s.ending!.parts);
  expect(st.highScore).toBeUndefined(); // Developer mode never writes a high score
  expect(st.modules.map((m) => m.id).sort((a, b) => a - b)).toEqual(s.player.modules.map((m) => m.id).sort((a, b) => a - b));
  for (const m of st.modules) expect(m.name).toBe(data().modules.byId.get(m.id)!.name);
  // "Total turns": the Overloads of the whole Campaign, until the designer says otherwise (I13).
  expect(st.totalTurns).toBe(s.log.filter((e) => e.text === "an Overload starts").length);
  expect(totalTurnsOf({ ...s, log: [...s.log, { text: "an Overload starts", rule: "9.1" }] })).toBe(st.totalTurns + 1);
});

test("a conceded or lost game has no outro: it keeps the plain Game over card", () => {
  const g = playToEnd(4, 2);
  const s = g.view.state;
  expect(s.outcome?.result).toBe("conceded");
  expect(s.ending).toBeDefined();
  expect(hasOutro(s)).toBe(false);
  // The numbers still read: two missions completed.
  expect(campaignStatsOf(data(), s).missions.length).toBe(2);
});

test("every Company gets an outro (the Terraformer until the designer deals them out) and colours", () => {
  expect(OUTROS.map((o) => o.id)).toContain(DEFAULT_OUTRO);
  for (const c of [...data().companies.companies.map((x) => x.id), "V9"]) {
    expect(outroFor(c).id).toBe("terraformer");
    const th = companyTheme(c);
    expect(th.id).toBe(c);
    for (const rgb of [th.primary, th.secondary, th.glow, th.hull, th.livery]) expect(rgb).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
  }
  expect(companyTheme("V9").primary).toBe(FALLBACK_THEME.primary);
  expect(companyTheme("V1").primary).not.toBe(companyTheme("V2").primary);
});

test("the preview's sample numbers add up like a real score", () => {
  const st = sampleStats(data(), "C1", "V2");
  expect(st.missions.length).toBe(7);
  expect(st.vesselName).toBe("Kew'n X2");
  expect(st.score).toBe(st.threatLevelsConquered + 5);
});
