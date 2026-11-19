// The outro at Game End (designer 2026-11-16; screen only): its timing, and the numbers of the
// Campaign Debrief, which are read from the finished game (Core Rules 10.3) and never worked out anew.
import { expect, test } from "vitest";
import { newRng } from "../../src/engine/rng.js";
import { playAnswer, startGame, type Game } from "../../src/engine/save.js";
import { emptyProfile } from "../../src/engine/state.js";
import { DEFAULT_OUTRO, OUTROS, outroFor } from "../../src/web/outro/index.js";
import { newEvents, type GameEvent } from "../../src/engine/events.js";
import { campaignStatsOf, overloadsOf, sampleStats } from "../../src/web/outro/stats.js";
import { ACT_AT, actAt, DEBRIEF_AT, DOORS_AT, DOORS_OPEN_AT, FILM_SECONDS, impactsBy, impactTimes, LAST_IMPACT, pylonCount, REENTRY_AT, releaseTimes, RESOLVE_AT, sitePlaces } from "../../src/web/outro/terraformer/timeline.js";
import { companyTheme, FALLBACK_THEME } from "../../src/web/outro/themes.js";
import * as T2 from "../../src/web/outro/terraformer2/timeline.js";
import * as TS from "../../src/web/outro/surface/timeline.js";
import { BLOOM_AT, BLOOM_FULL, WATER_AT, WATER_FULL } from "../../src/web/outro/surface/timeline.js";
import { bloomAt, poolAt, POOL_DEFS, SPIRE_PLACES, streamPaths, waterAt, waterReach } from "../../src/web/outro/surface/world.js";
import { createSky, vortexRadius } from "../../src/web/outro/surface/sky.js";
import { FAR_PLACES } from "../../src/web/outro/surface/world.js";
import * as TO from "../../src/web/outro/orbital/timeline.js";
import { facing, groundPoint, RP } from "../../src/web/outro/orbital/globe.js";
import * as sound from "../../src/web/briefing/soundHooks.js";
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
  // "Overloads" (I13, designer 2026-11-17): the Overloads of the whole Campaign; without the game's numbers, from the log.
  expect(st.overloads).toBe(s.log.filter((e) => e.text === "an Overload starts").length);
  const { stats: _counted, ...uncounted } = s;
  expect(overloadsOf({ ...uncounted, log: [...s.log, { text: "an Overload starts", rule: "9.1" }] })).toBe(st.overloads + 1);
  expect(st.expansions).toEqual(s.settings.heatModule ? ["Heat module"] : []);
});

/** A Developer-mode game with real play: in each mission some random actions, then the mission won by the Developer shortcut. Every event of every answer is kept. */
function playWithEvents(seed: number, actions: number): { game: Game; events: GameEvent[] } {
  const r = newRng(seed * 7 + 1);
  let g = startGame(data(), { seed, date: "2026-11-17", profile: emptyProfile(), developerMode: true, autoAnswer: true });
  const events: GameEvent[] = [];
  let done = 0;
  for (let n = 0; n < 4000 && g.view.status === "question"; n++) {
    const q = g.view.question;
    let a = randomAnswer(r, q);
    for (let k = 0; k < 40 && a.kind === "option" && a.value === "concede"; k++) a = randomAnswer(r, q);
    if (q.kind === "option" && q.options.some((o) => o.id === "devWin")) {
      if (done++ < actions) {
        for (let k = 0; k < 40 && a.kind === "option" && (a.value === "devWin" || a.value === "concede"); k++) a = randomAnswer(r, q);
        if (a.kind === "option" && (a.value === "devWin" || a.value === "concede")) a = { kind: "option", value: "devWin" };
      } else {
        a = { kind: "option", value: "devWin" };
        done = 0;
      }
    } else if (q.upgrade) a = q.kind === "yesno" ? { kind: "yesno", value: true } : { kind: "option", value: "done" };
    const before = g.view.state.events;
    const res = playAnswer(data(), g, a);
    if (res.result.status === "illegal" || res.result.status === "blocked") continue;
    g = res.game;
    events.push(...newEvents(before, g.view.state.events));
  }
  return { game: g, events };
}

test("the game counts its own numbers from its events: Overloads, Module runs, units destroyed, Alerts resolved, Gyros drained", () => {
  for (const seed of [11, 12]) {
    const { game, events } = playWithEvents(seed, 30);
    const s = game.view.state;
    expect(s.stats).toBeDefined();
    const st = s.stats!;
    const count = (f: (e: GameEvent) => boolean) => events.filter(f).length;
    expect(st.overloads).toBe(count((e) => e.kind === "overload" && e.how === "start"));
    expect(st.overloads).toBe(s.log.filter((e) => e.text === "an Overload starts").length);
    expect(st.drained).toBe(count((e) => e.kind === "activated" && e.how === "drain"));
    for (const type of ["Bot", "Sentinel", "Gyro", "Sleeper", "Omega", "Flare"]) {
      expect(st.destroyed[type] ?? 0).toBe(count((e) => e.kind === "destroyed" && e.type === type));
      expect(st.triggered[type] ?? 0).toBe(count((e) => e.kind === "activated" && e.how === "alert" && !e.wreck && e.type === type));
    }
    const runs = Object.values(st.moduleRuns).reduce((a, b) => a + b, 0);
    expect(runs).toBe(count((e) => e.kind === "used" && e.what === "module"));
    // Something really happened in these games.
    expect(runs + Object.values(st.destroyed).reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
    // The Debrief shows them: held Modules first with their runs, then Modules run but no longer held.
    const d = campaignStatsOf(data(), s);
    expect(d.overloads).toBe(st.overloads);
    expect(d.drained).toBe(st.drained);
    expect(d.destroyed.Bot).toBe(st.destroyed.Bot ?? 0);
    expect(d.triggered.Omega).toBe(st.triggered.Omega ?? 0);
    expect(d.triggered.Sentinel).toBe(st.triggered.Sentinel ?? 0);
    expect(d.triggered.Flare).toBe(st.triggered.Flare ?? 0);
    expect(d.triggered.Sleeper).toBe(st.triggered.Sleeper ?? 0);
    expect(d.modules.filter((m) => m.held).map((m) => m.id).sort((a, b) => a - b)).toEqual(s.player.modules.map((m) => m.id).sort((a, b) => a - b));
    for (const m of d.modules) expect(m.runs).toBe(st.moduleRuns[m.id] ?? 0);
    for (const m of d.modules.filter((x) => !x.held)) expect(m.runs).toBeGreaterThan(0);
    expect(d.modules.reduce((n, m) => n + m.runs, 0)).toBe(runs);
    const firstGone = d.modules.findIndex((m) => !m.held);
    if (firstGone >= 0) expect(d.modules.slice(firstGone).every((m) => !m.held)).toBe(true);
  }
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

test("every Company gets an outro (Terraformer 2.0 until the designer deals them out; Surface Terraform, Orbital Claim and 1.0 in System options) and colours", () => {
  expect(OUTROS.map((o) => o.id)).toEqual(["terraformer2", "surface", "orbital", "terraformer"]);
  expect(outroFor("V2", "surface").name).toBe("Surface Terraform");
  expect(outroFor("V1", "orbital").name).toBe("Orbital Claim");
  expect(DEFAULT_OUTRO).toBe("terraformer2");
  expect(outroFor("V1", "terraformer").id).toBe("terraformer");
  expect(outroFor("V1", "nonsense").id).toBe("terraformer2");
  for (const c of [...data().companies.companies.map((x) => x.id), "V9"]) {
    expect(outroFor(c).id).toBe("terraformer2");
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
  expect(st.expansions).toEqual(["Heat module"]);
  expect(st.score).toBe(st.threatLevelsConquered + 5 - 2);
  expect(st.scoreParts).toContain("Heat module (-2)");
});

test("Terraformer 2.0: slower and heavier than 1.0, in four acts; every pylon lowered, drifting 1.2 s, then braking, anchoring one by one", () => {
  // Deployment and descent (first pylon away to first anchor) 2.5 to 4 s longer than 1.0's (release to first hit).
  const longer = T2.FIRST_ANCHOR - T2.RELEASE_AT - (impactTimes(7)[0]! - releaseTimes(7)[0]!);
  expect(longer).toBeGreaterThanOrEqual(2.5);
  expect(longer).toBeLessThanOrEqual(4);
  expect(T2.DRIFT).toBe(1.2);
  expect([0, 4.1, 4.2, 8.9, 9.0, 12.1, 12.2, 30].map(T2.actAt)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  expect(T2.actAt(T2.DOORS_AT)).toBe(1);
  expect(T2.actAt(T2.ENTRY_AT)).toBe(2);
  expect(T2.actAt(T2.RESOLVE_AT)).toBe(4);
  expect(T2.DEBRIEF_AT).toBeGreaterThan(T2.RESOLVE_AT);
  expect(T2.DEBRIEF_AT).toBeLessThan(T2.FILM_SECONDS);
  for (const n of [1, 2, 5, 7, 9, 12]) {
    const rel = T2.releaseTimes(n);
    const ign = T2.ignitionTimes(n);
    const anc = T2.anchorTimes(n);
    for (let i = 0; i < n; i++) {
      expect(rel[i]!).toBeGreaterThan(T2.DOORS_AT);
      // Lowered, drifting, thrusters lit: all within the first act.
      expect(ign[i]! - rel[i]!).toBeCloseTo(T2.LOWER + T2.DRIFT, 9);
      expect(T2.actAt(ign[i]!)).toBe(1);
      expect(T2.actAt(anc[i]!)).toBe(3);
      // Each fires its beam before the dawn.
      expect(T2.actAt(anc[i]! + T2.BEAM_DELAY)).toBe(3);
      if (i) expect(anc[i]!).toBeGreaterThan(anc[i - 1]!);
    }
    expect(T2.anchorsBy(anc[0]! - 0.01, n)).toBe(0);
    expect(T2.anchorsBy(anc[n - 1]!, n)).toBe(n);
  }
});

test("Surface Terraform: 11 to 13 seconds in four acts; three spires fire in Act 1, the vortex opens in Act 2, water and life in Act 3", () => {
  expect(TS.FILM_SECONDS).toBeGreaterThanOrEqual(11);
  expect(TS.FILM_SECONDS).toBeLessThanOrEqual(13);
  expect([...TS.ACT_AT]).toEqual([0, 3.0, 6.5, 10.0]);
  expect([0, 2.9, 3.0, 6.4, 6.5, 9.9, 10.0, 30].map(TS.actAt)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  expect(TS.SPIRES).toBe(3);
  expect(SPIRE_PLACES.length).toBe(3);
  const fire = TS.fireTimes();
  expect(fire.length).toBe(3);
  for (const [i, f] of fire.entries()) {
    expect(TS.actAt(TS.FLARE_AT[i]!)).toBe(1);
    expect(TS.actAt(f)).toBe(1);
    // Each beam reaches the storm before the vortex opens.
    expect(f + TS.CLIMB).toBeLessThan(TS.VORTEX_AT);
    if (i) expect(f).toBeGreaterThan(fire[i - 1]!);
  }
  expect(TS.firedBy(fire[0]! - 0.01)).toBe(0);
  expect(TS.firedBy(fire[2]!)).toBe(3);
  expect(TS.actAt(TS.VORTEX_AT)).toBe(2);
  expect(TS.actAt(TS.SUN_AT)).toBe(2);
  expect(TS.actAt(TS.RAIN[1])).toBe(2);
  expect(TS.actAt(WATER_AT)).toBe(3);
  expect(TS.actAt(BLOOM_AT)).toBe(3);
  expect(TS.actAt(TS.FLOCKS_AT)).toBe(3);
  expect(WATER_FULL).toBeLessThan(TS.ACT_AT[3]);
  expect(BLOOM_FULL).toBeLessThanOrEqual(TS.ACT_AT[3]);
  expect(TS.actAt(TS.RESOLVE_AT)).toBe(4);
  expect(TS.DEBRIEF_AT).toBeGreaterThan(TS.RESOLVE_AT);
  expect(TS.DEBRIEF_AT).toBeLessThan(TS.FILM_SECONDS);
  expect(TS.STILL_AT).toBeGreaterThan(TS.FILM_SECONDS);
});

test("Surface Terraform: the sky opens over the great spire and the sun shows in Act 2; water and the green tide come from the spires' feet in Act 3, worked out from the time alone", () => {
  // The vortex only grows; the sun is hidden in the storm, then shows through the opening.
  for (let t = 0; t < 14; t += 0.25) expect(vortexRadius(t + 0.25)).toBeGreaterThanOrEqual(vortexRadius(t));
  const sky = createSky();
  expect(sky.sunShows(1)).toBeLessThan(0.05);
  expect(sky.sunShows(TS.VORTEX_AT)).toBeLessThan(0.05);
  expect(sky.sunShows(TS.ACT_AT[2])).toBeGreaterThan(0.9);
  expect(sky.coverOver(0, 1)).toBeGreaterThan(0.95);
  expect(sky.coverOver(0, TS.ACT_AT[2])).toBeLessThan(0.05);
  // The same moment always gives the same answer (nothing is counted from frame to frame).
  expect(sky.sunShows(5.123)).toBe(createSky().sunShows(5.123));
  // Each canyon bed fills from its spire's foot, all of them by WATER_FULL; each pool when its stream reaches it.
  const paths = streamPaths();
  expect(paths.length).toBeGreaterThanOrEqual(3);
  for (const [k, p] of paths.entries()) {
    const sp = SPIRE_PLACES[p.def.from]!;
    expect(Math.hypot(p.x[0]! - sp.X, p.z[0]! - sp.Z)).toBeLessThan(1e-9);
    expect(waterReach(k, WATER_AT - 0.01)).toBe(0);
    expect(waterReach(k, WATER_FULL)).toBeCloseTo(p.length, 6);
    for (const d of [0.2, 0.5, 0.9].map((x) => x * p.length)) expect(waterReach(k, waterAt(k, d))).toBeCloseTo(d, 6);
  }
  for (let i = 0; i < POOL_DEFS.length; i++) expect(TS.actAt(poolAt(i))).toBe(3);
  // The green tide: first at the spires' feet, everywhere in the valley by BLOOM_FULL.
  for (const s of SPIRE_PLACES) expect(bloomAt(s.X, s.Z)).toBeLessThan(BLOOM_AT + 1.2);
  for (const [X, Z] of [[0, 1], [-3, 2], [4, 6], [-8, 20], [10, 40], [0.3, 2.25]]) {
    const a = bloomAt(X!, Z!);
    expect(a).toBeGreaterThanOrEqual(BLOOM_AT);
    expect(a).toBeLessThanOrEqual(BLOOM_FULL + 0.06);
  }
});

test("Surface Terraform calls its own silent sound hooks", () => {
  for (const f of [sound.playSpireIgnition, sound.playAtmosphereClear, sound.playWaterFlow, sound.playVictoryResolve]) {
    expect(typeof f).toBe("function");
    expect(f()).toBeUndefined();
  }
});

test("Surface Terraform (I17): the pylons beyond the three spires stand far off as beams, one for every other mission won, all fired in Act 1", () => {
  expect(TS.farCount(7)).toBe(4);
  expect(TS.farCount(3)).toBe(0);
  expect(TS.farCount(1)).toBe(0);
  // 2.0 drops at most twelve pylons: nine far places are enough.
  expect(FAR_PLACES.length).toBeGreaterThanOrEqual(T2.pylonCount(99) - TS.SPIRES);
  for (const n of [1, 4, 9]) {
    const at = TS.farTimes(n);
    expect(at.length).toBe(n);
    for (const [i, x] of at.entries()) {
      // After the spires' own beams, before the storm opens.
      expect(x).toBeGreaterThan(TS.fireTimes()[2]!);
      expect(TS.actAt(x)).toBe(1);
      if (i) expect(x).toBeGreaterThan(at[i - 1]!);
    }
  }
  // Far beyond the valley's far mountains.
  for (const p of FAR_PLACES) expect(p.Z).toBeGreaterThan(40);
});

test("Orbital Claim: 10 to 12 seconds in four acts; the beacon fires in Act 1, the lock in Act 2, lattice and grid in Act 3", () => {
  expect(TO.FILM_SECONDS).toBeGreaterThanOrEqual(10);
  expect(TO.FILM_SECONDS).toBeLessThanOrEqual(12);
  expect([...TO.ACT_AT]).toEqual([0, 3.0, 6.5, 9.5]);
  expect([0, 2.9, 3.0, 6.4, 6.5, 9.4, 9.5, 30].map(TO.actAt)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  expect(TO.actAt(TO.BEAM_AT)).toBe(1);
  expect(TO.actAt(TO.BEAM_AT + TO.BEAM_CLIMB)).toBe(1);
  expect(TO.actAt(TO.ARRIVE_AT)).toBe(2);
  expect(TO.actAt(TO.LOCK_AT)).toBe(2);
  expect(TO.LOCK_AT).toBeGreaterThan(TO.ARRIVE_AT);
  expect(TO.actAt(TO.TETHER_FULL)).toBe(2);
  // Twelve relay satellites leave the tether point one after another and are all in the lattice within Act 3.
  expect(TO.SATS).toBe(12);
  expect(TO.actAt(TO.satLaunch(0))).toBe(3);
  expect(TO.actAt(TO.satSnap(TO.SATS - 1))).toBe(3);
  expect(TO.snappedBy(TO.satSnap(0) - 0.01)).toBe(0);
  expect(TO.snappedBy(TO.satSnap(TO.SATS - 1))).toBe(TO.SATS);
  // The grid sweeps out (sound hook) and claims the whole region in Act 3; only ever growing.
  expect(TO.actAt(TO.GRID_AT)).toBe(3);
  expect(TO.gridReach(TO.GRID_AT)).toBe(0);
  expect(TO.gridReach(TO.GRID_FULL)).toBe(1);
  for (let t = 0; t < 14; t += 0.1) expect(TO.gridReach(t + 0.1)).toBeGreaterThanOrEqual(TO.gridReach(t));
  expect(TO.GRID_FULL).toBeLessThan(TO.ACT_AT[3]);
  expect(TO.actAt(TO.SECURED_AT)).toBe(3);
  expect(TO.actAt(TO.RESOLVE_AT)).toBe(4);
  expect(TO.DEBRIEF_AT).toBeGreaterThan(TO.RESOLVE_AT);
  expect(TO.DEBRIEF_AT).toBeLessThan(TO.FILM_SECONDS);
  expect(TO.STILL_AT).toBeGreaterThan(TO.FILM_SECONDS);
});

test("Orbital Claim: the territory grid lies on the curve of the planet, and only its near side is drawn", () => {
  // A place of the grid's plane lands on the ground (radius RP from the planet's middle), the sector itself at the origin.
  expect(groundPoint(0, 0)).toEqual([0, 0, 0]);
  for (const [a, b] of [[10, 0], [-60, 40], [110, 110]]) {
    const p = groundPoint(a!, b!, 0);
    expect(Math.hypot(p[0], p[1] + RP, p[2])).toBeCloseTo(RP, 6);
    expect(p[1]).toBeLessThan(0);
    const q = groundPoint(a!, b!, 2);
    expect(Math.hypot(q[0], q[1] + RP, q[2])).toBeCloseTo(RP + 2, 6);
  }
  const cam = { pos: [0, 40, 30] as [number, number, number], r: [1, 0, 0] as [number, number, number], d: [0, -1, 0] as [number, number, number], f: [0, 0, -1] as [number, number, number], focal: 900, cx: 0, cy: 0, w: 1, h: 1 };
  expect(facing(cam, groundPoint(0, 0))).toBe(true);
  // The far side of the planet faces away.
  expect(facing(cam, [0, -2 * RP, 0])).toBe(false);
});

test("Orbital Claim calls its own silent sound hooks", () => {
  for (const f of [sound.playSkyBeamFire, sound.playOrbitalLock, sound.playGridSweep, sound.playVictoryResolve]) {
    expect(typeof f).toBe("function");
    expect(f()).toBeUndefined();
  }
});
