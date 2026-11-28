// The mission celebrations (designer 2026-11-20; screen only): which piece plays (I19), when the kill
// plays (the destroyed event that reaches the Eliminate objective's number, 8.2), when the win plays
// (the engine's display event "won") and the board it shows, the animation player's two-tap steps; the
// second Alpha kill (I21), the Beta kill and Mission Complete for Beta (I22), the win's energy sweep (I23, I24); the same for every Company (I25);
// the two Gamma kills on a tilted board (I26) and Mission Complete for Gamma (I27); the third Gamma kill,
// Dimensional Shatter (designer 2026-11-21): bullet time, the breakage, the shake, all from the time alone.
import { expect, test } from "vitest";
import { newEvents, type GameEvent } from "../../src/engine/events.js";
import { newRng } from "../../src/engine/rng.js";
import { playAnswer, startGame, type Game } from "../../src/engine/save.js";
import { emptyProfile } from "../../src/engine/state.js";
import { Player, type Step } from "../../src/web/anim.js";
import { countedSoFar, decidingKill, killOf, objectiveOf, omegaName, winOf, winShowOf, wonStateOf } from "../../src/web/celebrate/detect.js";
import { KILL_PIECES, pickPiece, SALVAGE_PIECES, WIN_PIECES, type Piece } from "../../src/web/celebrate/pieces.js";
import { boardJolt, flipLook, flipPose, flipStarts } from "../../src/web/celebrate/flipFx.js";
import { burstAt, cellAt, farthest, recoil, ringArrival, ringAt, ringShare } from "../../src/web/celebrate/sweepFx.js";
import { ARMILLARY, AURORA, BARRAGE, BEACON, CIRCUIT, CRYO, ERASE, FLIP, MURMUR, RAIL, RESONANCE, SINGULAR, SURGE, SWEEP } from "../../src/web/celebrate/timeline.js";
import { leapGrow, packetSpan, surgeCellAt, surgeLook, surgeTree } from "../../src/web/celebrate/chainSurgeFx.js";
import { beaconLook, beaconMiddle, spiralOrder } from "../../src/web/celebrate/beaconFx.js";
import { beatTimes, latticeOf, resonanceCellAt, resonanceLook, rippleAt, ringAt as resRingAt, ripplesOf } from "../../src/web/celebrate/resonanceFx.js";
import { auroraLook, auroraTouch, crownAt, curtainEdge, descent } from "../../src/web/celebrate/auroraFx.js";
import { circuitLook, circuitOf, edgeDone, litAt } from "../../src/web/celebrate/circuitFx.js";
import { coreSize, feedCellAt, singularityLook, wellPlace, wellPull } from "../../src/web/celebrate/singularityFx.js";
import { armillaryLook, armillaryPlan, armillaryTouch, ringAngles, ringDrawn, ringFrame } from "../../src/web/celebrate/armillaryFx.js";
import { flightOf, headAt, murmurLook, pace, swarmCellAt } from "../../src/web/celebrate/murmurationFx.js";
import { slugDistance, slugPasses } from "../../src/web/celebrate/railFx.js";
import { shellSpot } from "../../src/web/celebrate/barrageFx.js";
import { FROST_LINES, struggle } from "../../src/web/celebrate/cryoFx.js";
import { barAt, hexHalfHeight, LATTICE, latticeAt } from "../../src/web/celebrate/eraseFx.js";

const WIN_IDS = ["missionComplete", "perimeterSweep", "sectorFlip", "chainSurge", "beaconSpiral", "resonance", "murmuration", "singularity", "armillary", "aurora", "circuitTrace"];
import { KILL_STEPS } from "../../src/web/celebrate/kills.js";
import { betaFlows, crackTree } from "../../src/web/celebrate/cracksFx.js";
import { CELEBRATION_PREVIEWS, PREVIEW_SEED, previewBoards } from "../../src/web/celebrate/previewBoards.js";
import { arrival, shineAt, shinePath, sweep } from "../../src/web/celebrate/shine.js";
import { ARRAY, BREACH, HORIZON, KILL, KILL_TIMES, PURGE, SHATTER, SLOW_RATE, STILL, WIN, shardTime, timeDilation } from "../../src/web/celebrate/timeline.js";
import { breakage, flights, shakeOffset, shardAt, shardCount } from "../../src/web/celebrate/shatterFx.js";
import { hexDist, project, tiltBoard } from "../../src/web/celebrate/tilt.js";
import type { Frame } from "../../src/web/celebrate/closeup.js";
import type { NodeLook } from "../../src/web/anim.js";
import * as sound from "../../src/web/briefing/soundHooks.js";
import { randomAnswer } from "./campaignFuzz.js";
import { data } from "./helpers.js";

/** A Developer-mode game played at random up to its first Command phase action menu of Mission 1. */
function toFirstAction(seed: number): Game {
  const r = newRng(seed * 7 + 3);
  let g = startGame(data(), { seed, date: "2026-11-20", profile: emptyProfile(), developerMode: true, autoAnswer: true });
  for (let n = 0; n < 200 && g.view.status === "question"; n++) {
    const q = g.view.question;
    if (q.kind === "option" && q.options.some((o) => o.id === "devWin")) return g;
    let a = randomAnswer(r, q);
    for (let k = 0; k < 30 && a.kind === "option" && a.value === "concede"; k++) a = randomAnswer(r, q);
    const res = playAnswer(data(), g, a);
    expect(res.result.status === "illegal" || res.result.status === "blocked").toBe(false);
    g = res.game;
  }
  throw new Error("no action menu");
}

test("I19: one piece per mission, picked from the game's seed and the mission, the same again on reload", () => {
  const two: Piece[] = [
    { id: "a", name: "A", for: ["Alpha"] },
    { id: "b", name: "B", for: ["Alpha"] },
    { id: "c", name: "C", for: ["Beta"] },
  ];
  // The same game and mission: always the same piece.
  for (let seed = 1; seed < 20; seed++) expect(pickPiece(two, "Alpha", seed, "C1_M1", "win")).toEqual(pickPiece(two, "Alpha", seed, "C1_M1", "win"));
  // Over many games both Alpha pieces come up, never the Beta one; nothing for a type with none.
  const got = new Set<string>();
  for (let seed = 1; seed < 60; seed++) got.add(pickPiece(two, "Alpha", seed, "C1_M1", "kill")!.id);
  expect([...got].sort()).toEqual(["a", "b"]);
  expect(pickPiece(two, "Gamma", 1, "C1_M1", "kill")).toBeUndefined();
  // A preview may ask for one piece; only if it fits.
  expect(pickPiece(two, "Alpha", 1, "C1_M1", "kill", "b")?.id).toBe("b");
  expect(pickPiece(two, "Alpha", 1, "C1_M1", "kill", "c")?.id).not.toBe("c");
  // Today: two kills for Alpha (Alpha Down, Alpha Purge, I21), one for Beta (Beta Breach), three for Gamma (Event
  // Horizon, Field Array, I26; Dimensional Shatter, 2026-11-21); Mission Complete for Alpha, Beta (I22) and Gamma missions (I27); nothing for
  // Salvage yet. Every kill piece has its step and times.
  expect(KILL_PIECES.map((p) => [p.id, p.for])).toEqual([
    ["alphaDown", ["Alpha"]],
    ["alphaPurge", ["Alpha"]],
    ["alphaRail", ["Alpha"]],
    ["alphaErase", ["Alpha"]],
    ["betaBreach", ["Beta"]],
    ["betaBarrage", ["Beta"]],
    ["betaCryo", ["Beta"]],
    ["gammaHorizon", ["Gamma"]],
    ["gammaArray", ["Gamma"]],
    ["gammaShatter", ["Gamma"]],
  ]);
  // Every win for every mission won (designer 2026-11-21): Eliminate Alpha, Beta, Gamma, and Salvage.
  const every = ["Alpha", "Beta", "Gamma", "Salvage"];
  expect(WIN_PIECES.map((p) => [p.id, p.for])).toEqual([
    ["missionComplete", every],
    ["perimeterSweep", every],
    ["sectorFlip", every],
    ["chainSurge", every],
    ["beaconSpiral", every],
    ["resonance", every],
    ["murmuration", every],
    ["singularity", every],
    ["armillary", every],
    ["aurora", every],
    ["circuitTrace", every],
  ]);
  for (const p of KILL_PIECES) {
    expect(KILL_STEPS[p.id]).toBeTypeOf("function");
    expect(KILL_TIMES[p.id]).toBeDefined();
  }
  const alphas = new Set<string>();
  for (let seed = 1; seed < 80; seed++) alphas.add(pickPiece(KILL_PIECES, "Alpha", seed, "C1_M1", "kill")!.id);
  expect([...alphas].sort()).toEqual(["alphaDown", "alphaErase", "alphaPurge", "alphaRail"]);
  const betas = new Set<string>();
  for (let seed = 1; seed < 60; seed++) betas.add(pickPiece(KILL_PIECES, "Beta", seed, "C1_M3", "kill")!.id);
  expect([...betas].sort()).toEqual(["betaBarrage", "betaBreach", "betaCryo"]);
  expect(WIN_IDS).toContain(pickPiece(WIN_PIECES, "Beta", 7, "C1_M3", "win")?.id);
  const gammas = new Set<string>();
  for (let seed = 1; seed < 40; seed++) gammas.add(pickPiece(KILL_PIECES, "Gamma", seed, "C1_M7", "kill")!.id);
  expect([...gammas].sort()).toEqual(["gammaArray", "gammaHorizon", "gammaShatter"]);
  expect(WIN_IDS).toContain(pickPiece(WIN_PIECES, "Gamma", 7, "C1_M7", "win")?.id);
  expect(pickPiece(KILL_PIECES, "Salvage", 7, "C1_M2", "kill")).toBeUndefined();
  // System options: a button for each kill, each win, and each kill with Mission Complete, for Alpha, Beta, Gamma; each win for Salvage.
  expect(CELEBRATION_PREVIEWS.map((w) => `${w.omega} ${w.kind} ${w.piece ?? ""} ${w.win ?? ""}`.replace(/ +/g, " ").trim())).toEqual([
    "Alpha kill alphaDown",
    "Alpha kill alphaPurge",
    "Alpha kill alphaRail",
    "Alpha kill alphaErase",
    "Alpha win missionComplete",
    "Alpha win perimeterSweep",
    "Alpha win sectorFlip",
    "Alpha win chainSurge",
    "Alpha win beaconSpiral",
    "Alpha win resonance",
    "Alpha win murmuration",
    "Alpha win singularity",
    "Alpha win armillary",
    "Alpha win aurora",
    "Alpha win circuitTrace",
    "Alpha both alphaDown missionComplete",
    "Alpha both alphaPurge missionComplete",
    "Alpha both alphaRail missionComplete",
    "Alpha both alphaErase missionComplete",
    "Beta kill betaBreach",
    "Beta kill betaBarrage",
    "Beta kill betaCryo",
    "Beta win missionComplete",
    "Beta win perimeterSweep",
    "Beta win sectorFlip",
    "Beta win chainSurge",
    "Beta win beaconSpiral",
    "Beta win resonance",
    "Beta win murmuration",
    "Beta win singularity",
    "Beta win armillary",
    "Beta win aurora",
    "Beta win circuitTrace",
    "Beta both betaBreach missionComplete",
    "Beta both betaBarrage missionComplete",
    "Beta both betaCryo missionComplete",
    "Gamma kill gammaHorizon",
    "Gamma kill gammaArray",
    "Gamma kill gammaShatter",
    "Gamma win missionComplete",
    "Gamma win perimeterSweep",
    "Gamma win sectorFlip",
    "Gamma win chainSurge",
    "Gamma win beaconSpiral",
    "Gamma win resonance",
    "Gamma win murmuration",
    "Gamma win singularity",
    "Gamma win armillary",
    "Gamma win aurora",
    "Gamma win circuitTrace",
    "Gamma both gammaHorizon missionComplete",
    "Gamma both gammaArray missionComplete",
    "Gamma both gammaShatter missionComplete",
    "Salvage win missionComplete",
    "Salvage win perimeterSweep",
    "Salvage win sectorFlip",
    "Salvage win chainSurge",
    "Salvage win beaconSpiral",
    "Salvage win resonance",
    "Salvage win murmuration",
    "Salvage win singularity",
    "Salvage win armillary",
    "Salvage win aurora",
    "Salvage win circuitTrace",
    "Salvage kill salvageNodes",
    "Salvage kill salvageCleared",
    "Salvage kill salvageFusion",
    "Salvage kill salvageCascade",
    "Salvage kill salvageClaim",
    "Salvage kill salvageSurvey",
    "Salvage both salvageNodes missionComplete",
    "Salvage both salvageFusion missionComplete",
    "Salvage both salvageCascade missionComplete",
    "Salvage both salvageCleared missionComplete",
    "Salvage both salvageClaim missionComplete",
    "Salvage both salvageSurvey missionComplete",
  ]);
});

test("the engine reports the win (8.2) as a display event, also for the Developer tool", () => {
  const g = toFirstAction(3);
  const before = g.view.state;
  expect(objectiveOf(data(), before)).toEqual({ type: "eliminate", target: "O_01", count: 6 });
  expect(omegaName(data(), "O_01")).toBe("Alpha");
  const res = playAnswer(data(), g, { kind: "option", value: "devWin" });
  const ev = newEvents(before.events, res.game.view.state.events);
  expect(ev.filter((e) => e.kind === "won")).toEqual([expect.objectContaining({ kind: "won", dev: true })]);
  // The win of that answer: the board as it was won (before Mission End collects the Field), from the middle.
  const w = winOf(data(), g, res.game)!;
  expect(WIN_IDS).toContain(w.piece.id);
  expect(w.sub).toBe("Alpha eliminated · 0 / 6");
  expect(w.badges).toEqual(Array.from({ length: 6 }, () => ({ unit: "O_01", filled: false })));
  expect(w.dev).toBe(true);
  expect(w.from).toBeUndefined();
  expect(w.joined).toBe(false);
  expect(w.state.phase).toBe("missionEnd");
  expect(w.state.field).toEqual(before.field);
  expect(w.count).toBe(6);
  expect(w.have).toBe(0);
  expect(w.name).toBe("Alpha");
  // An answer that does not win: none.
  const q = g.view.status === "question" ? g.view.question : undefined;
  const other = (q?.kind === "option" ? q.options : []).find((o) => o.id !== "devWin" && o.id !== "concede");
  if (other) {
    const r2 = playAnswer(data(), g, { kind: "option", value: other.id });
    if (r2.result.status !== "illegal" && r2.result.status !== "blocked") expect(winOf(data(), g, r2.game)).toBeUndefined();
  }
  // Played again, stopping at Mission End: the same board.
  expect(wonStateOf(data(), g, [{ kind: "option", value: "devWin" }])?.field).toEqual(before.field);
});

test("the kill: the destroyed event that reaches the objective's number (Wrecks on the Field count, 4.8)", () => {
  const b = previewBoards(data(), "V1")!;
  expect(b).toBeDefined();
  // Five Alphas in the Trophy pile; the sixth destroyed (a Wreck) is the deciding one.
  expect(countedSoFar(b.start, "O_01")).toBe(5);
  const ev = newEvents(b.start.events, b.kill.events);
  expect(decidingKill(data(), b.start, ev)).toBe(ev.findIndex((e) => e.kind === "destroyed"));
  expect(killOf(data(), b.start, ev, PREVIEW_SEED)).toEqual(expect.objectContaining({ name: "Alpha", count: 6 }));
  expect(killOf(data(), b.start, ev, PREVIEW_SEED, "alphaPurge")?.piece.id).toBe("alphaPurge");
  expect(killOf(data(), b.start, ev, PREVIEW_SEED, "betaBreach")?.piece.id).not.toBe("betaBreach");
  // Once counted (its Wreck on the Field), a later Alpha destroyed is not the deciding one.
  expect(countedSoFar(b.kill, "O_01")).toBe(6);
  const again = [{ ...ev.find((e) => e.kind === "destroyed")!, seq: 99999 }] as GameEvent[];
  expect(decidingKill(data(), b.kill, again)).toBe(-1);
  // Two Alphas destroyed by one blow from 4: the second is the deciding one.
  const four = structuredClone(b.start);
  four.piles.trophy = four.piles.trophy.slice(1);
  const d = ev.find((e) => e.kind === "destroyed")!;
  const pair = [{ ...d, tile: "x1", seq: 1 }, { kind: "hit", tile: "x2", unitId: "O_01", type: "Omega", sector: "0,0", amount: 1, damage: 1, shields: 0, seq: 2 }, { ...d, tile: "x2", seq: 3 }] as GameEvent[];
  expect(decidingKill(data(), four, pair)).toBe(2);
  // Other units destroyed do not count; nor anything in a Salvage mission.
  expect(decidingKill(data(), b.start, [{ ...d, unitId: "B_02", type: "Bot" }] as GameEvent[])).toBe(-1);
  const salvage = structuredClone(b.start);
  salvage.mission = "C1_M2X";
  expect(objectiveOf(data(), salvage)).toEqual({ type: "salvage" });
  expect(decidingKill(data(), salvage, ev)).toBe(-1);
});

test("the win: from the sector the deciding Alpha left; both in one answer are joined", () => {
  const b = previewBoards(data(), "V2")!;
  const w = winShowOf(data(), b.kill, b.won, PREVIEW_SEED)!;
  expect(w.from).toBe("0,1");
  expect(w.have).toBe(6);
  expect(w.fresh).toBe(1);
  expect(w.flights).toBe(true);
  expect(w.joined).toBe(false);
  expect(w.dev).toBe(false);
  const j = winShowOf(data(), b.start, b.wonJoined, PREVIEW_SEED, "alphaPurge")!;
  expect(j.joined).toBe(true);
  expect(j.from).toBe("0,1");
  // Joined: the kill played with it (its pull-out is when the Trophy flies).
  expect(j.kill).toBe("alphaPurge");
  expect(w.kill).toBeUndefined();
});

test("Beta (Mission 3, Eliminate 3 Betas): the third Beta destroyed is the deciding kill (Beta Breach); Mission Complete follows (I22)", () => {
  const b = previewBoards(data(), "V1", "Beta")!;
  expect(b).toBeDefined();
  expect(objectiveOf(data(), b.start)).toEqual({ type: "eliminate", target: "O_02", count: 3 });
  expect(omegaName(data(), "O_02")).toBe("Beta");
  expect(countedSoFar(b.start, "O_02")).toBe(2);
  // A Beta has no Destroyed effect: no Wreck; it goes straight to the Trophy pile.
  const ev = newEvents(b.start.events, b.wonJoined.events);
  const d = ev.findIndex((e) => e.kind === "destroyed");
  expect(ev[d]).toEqual(expect.objectContaining({ unitId: "O_02", wreck: false }));
  const bk = killOf(data(), b.start, ev, PREVIEW_SEED)!;
  expect(bk).toEqual(expect.objectContaining({ index: d, name: "Beta", count: 3 }));
  expect(["betaBreach", "betaBarrage", "betaCryo"]).toContain(bk.piece.id);
  const j = winShowOf(data(), b.start, b.wonJoined, PREVIEW_SEED)!;
  expect(WIN_IDS).toContain(j.piece.id);
  expect([j.name, j.target, j.count, j.have, j.from, j.joined, j.kill, j.fresh]).toEqual(["Beta", "O_02", 3, 3, "0,1", true, bk.piece.id, 1]);
  // The win alone (after the kill): from the same sector, nothing left to fly in.
  const w = winShowOf(data(), b.kill, b.won, PREVIEW_SEED)!;
  expect([w.from, w.joined, w.flights]).toEqual(["0,1", false, false]);
});

test("Gamma (Mission 7, Eliminate 2 Gammas): the second Gamma destroyed is the deciding kill; Mission Complete follows (I27)", () => {
  const b = previewBoards(data(), "V2", "Gamma")!;
  expect(b).toBeDefined();
  expect(objectiveOf(data(), b.start)).toEqual({ type: "eliminate", target: "O_03", count: 2 });
  expect(omegaName(data(), "O_03")).toBe("Gamma");
  expect(countedSoFar(b.start, "O_03")).toBe(1);
  // A Gamma has no Destroyed effect: no Wreck; it goes straight to the Trophy pile.
  const ev = newEvents(b.start.events, b.wonJoined.events);
  const d = ev.findIndex((e) => e.kind === "destroyed");
  expect(ev[d]).toEqual(expect.objectContaining({ unitId: "O_03", wreck: false }));
  const k = killOf(data(), b.start, ev, PREVIEW_SEED)!;
  expect([k.index, k.name, k.count]).toEqual([d, "Gamma", 2]);
  expect(["gammaHorizon", "gammaArray", "gammaShatter"]).toContain(k.piece.id);
  expect(killOf(data(), b.start, ev, PREVIEW_SEED, "gammaArray")?.piece.id).toBe("gammaArray");
  const j = winShowOf(data(), b.start, b.wonJoined, PREVIEW_SEED, "gammaHorizon", "missionComplete")!;
  expect(j.piece.id).toBe("missionComplete");
  expect([j.name, j.target, j.count, j.have, j.from, j.joined, j.kill]).toEqual(["Gamma", "O_03", 2, 2, "0,1", true, "gammaHorizon"]);
});

test("the Gamma kills' tilted board (I26): the camera turns, near sectors in front, the unit stays put", () => {
  // Seen from above (0) nothing moves; tilted, a point lifted off the board rises on the screen and comes nearer.
  expect(project(30, 40, 0, 0, 1000)).toEqual({ x: 30, y: 40, p: 1, near: 0 });
  const up = project(0, 0, 50, Math.PI / 3, 1000);
  expect(up.y).toBeLessThan(0);
  expect(up.p).toBeGreaterThan(1);
  // A board of three sectors in a column: the unit in the middle, one far (above), one near (below).
  const looks = new Map<string, NodeLook>();
  const look = (k: string) => {
    let v = looks.get(k);
    if (!v) looks.set(k, (v = { dx: 0, dy: 0, scale: 1, scaleX: 1, alpha: 1, rot: 0 }));
    return v;
  };
  const f = { t: 0, still: false, fade: 1, Sx: 500, Sy: 400, Rs: 60, R: 30, z: 2, Z: 2, q: 1, w: 1000, h: 800, wide: true, broke: false, look, cx: 100, cy: 100 } as Frame;
  const centres = [
    ["0,0", 100, 100],
    ["1,0", 100, 55],
    ["-1,0", 100, 145],
  ] as const;
  const placed = tiltBoard(f, centres, Math.PI / 3, 600);
  const at = (k: string) => placed.find((p) => p.key === k)!;
  expect([at("0,0").sx, at("0,0").sy]).toEqual([500, 400]);
  expect(looks.get("0,0")!.dx).toBe(0);
  // Squashed by the tilt, the far one smaller and behind, the near one bigger and in front.
  expect(at("1,0").sq).toBeCloseTo(0.5);
  expect(at("1,0").p).toBeLessThan(1);
  expect(at("-1,0").p).toBeGreaterThan(1);
  expect(looks.get("-1,0")!.z!).toBeGreaterThan(looks.get("1,0")!.z!);
  expect(at("1,0").sy).toBeGreaterThan(400 - 90);
  // Lifted and pulled in: higher on the screen, flagged as off the board.
  looks.clear();
  const lifted = tiltBoard(f, centres, Math.PI / 3, 600, (k) => (k === "1,0" ? { H: 40, inward: 0.2 } : undefined));
  expect(lifted.find((p) => p.key === "1,0")!.sy).toBeLessThan(at("1,0").sy);
  expect(lifted.find((p) => p.key === "1,0")!.lifted).toBe(true);
  expect(hexDist("0,1", "-1,0")).toBe(2);
  expect(hexDist("0,1", "1,1")).toBe(1);
});

test("the celebrations' timing (the plan agreed 2026-11-20)", () => {
  // The kill: four acts in about 4.5 s; the burst in act 2, the count in act 3.
  expect(KILL.total).toBe(4.5);
  expect(KILL.zoomIn).toEqual([0, 0.8]);
  expect(KILL.lock).toBeLessThan(KILL.cracks[0]);
  expect(KILL.burst).toBeGreaterThan(KILL.collapse[0]);
  expect(KILL.burst).toBeLessThan(2.2);
  expect(KILL.count).toBeGreaterThan(2.2);
  expect(KILL.count).toBeLessThan(KILL.back[0]);
  expect(KILL.back).toEqual([3.6, 4.5]);
  // The win: about 5 s; the wave in act 2, the banner in act 3, the badges dropping 0.1 s apart before act 4.
  expect(WIN.total).toBe(5);
  expect(WIN.wave).toEqual([1.0, 2.2]);
  expect(WIN.slam[0]).toBe(2.2);
  expect(WIN.badgeStep).toBe(0.1);
  expect(WIN.badgesAt + 5 * WIN.badgeStep + WIN.badgeFall).toBeLessThanOrEqual(3.8);
  expect(WIN.out[1]).toBe(WIN.total);
  expect(STILL).toBe(1.5);
  // Alpha Purge (I21): as long as Alpha Down, in four acts; the cage locks, crushes, then the pillar of light.
  expect(PURGE.total).toBe(KILL.total);
  expect(PURGE.lock).toBeLessThan(PURGE.squeeze[0]);
  expect(PURGE.crush[1]).toBe(PURGE.purge);
  expect(PURGE.wreckIn[0]).toBeGreaterThan(PURGE.purge);
  expect(PURGE.count).toBeLessThan(PURGE.back[0]);
  expect(PURGE.back[1]).toBe(PURGE.total);
  // Beta Breach: longer than either Alpha kill, three surges and three blasts before the breach, then the count.
  expect(BREACH.total).toBeGreaterThan(KILL.total + 1);
  expect(BREACH.surges).toHaveLength(3);
  expect(BREACH.blasts).toHaveLength(3);
  expect(BREACH.lock).toBeLessThan(BREACH.surges[0]);
  expect(Math.max(...BREACH.surges, ...BREACH.blasts)).toBeLessThan(BREACH.implode[0]);
  expect(BREACH.implode[1]).toBe(BREACH.detonate);
  expect(BREACH.count).toBeGreaterThan(BREACH.detonate);
  expect(BREACH.count).toBeLessThan(BREACH.back[0]);
  expect(BREACH.back[1]).toBe(BREACH.total);
  // The Gamma kills (I26): longer than Beta's; Event Horizon tilts, pulls, snaps, then the jet and the wave, the
  // landings, the count; Field Array arms, closes the lattice, breaks the shield, turns to the side, cuts, falls.
  for (const G of [HORIZON, ARRAY]) {
    expect(G.total).toBeGreaterThan(BREACH.total + 1);
    expect(G.count).toBeLessThan(G.back[0]);
  }
  expect(HORIZON.lock).toBeLessThan(HORIZON.collapse[0]);
  expect(HORIZON.lift1[0]).toBeLessThan(HORIZON.lift2[0]);
  expect(HORIZON.swallow[1]).toBe(HORIZON.snap);
  expect(HORIZON.jet[0]).toBeGreaterThan(HORIZON.snap);
  expect(HORIZON.wave[0]).toBeGreaterThanOrEqual(HORIZON.jet[0]);
  expect(HORIZON.land[0]).toBeGreaterThan(HORIZON.wave[0]);
  expect(HORIZON.count).toBeGreaterThan(HORIZON.land[0]);
  expect(ARRAY.arm[1]).toBeLessThanOrEqual(ARRAY.beams[0] + 0.1);
  expect(ARRAY.crack[1]).toBeLessThan(ARRAY.lock);
  expect(ARRAY.lock).toBeLessThan(ARRAY.side[0]);
  expect(ARRAY.rise[1]).toBeLessThan(ARRAY.cut);
  expect(ARRAY.cut).toBeLessThan(ARRAY.slide[0]);
  expect(ARRAY.fall[1]).toBeLessThanOrEqual(ARRAY.flat[1]);
  expect(ARRAY.count).toBeGreaterThan(ARRAY.fall[1]);
  for (const [id, t] of Object.entries(KILL_TIMES)) expect(t.back[1], id).toBe(t.total);
  // Silent sound hooks, ready for audio files.
  for (const f of [sound.playTargetLock, sound.playOmegaBreak, sound.playKillConfirmed, sound.playPurgeBeam, sound.playBetaSurge, sound.playBetaDetonation, sound.playGammaCollapse, sound.playGammaJet, sound.playSectorLand, sound.playArrayArm, sound.playLatticeLock, sound.playGammaCut, sound.playBossCoreCritical, sound.playDimensionalRift, sound.playSlowMoShatter, sound.playCataclysmShockwave, sound.playSectorPurified, sound.playTrophyLand, sound.playWinSweep, sound.playMissionComplete]) expect(typeof f).toBe("function");
});

test("Dimensional Shatter (designer 2026-11-21): four acts in 8 s; bullet time, the shards and the shake worked out from the time alone", () => {
  // The acts: criticality (0-2.2, a frozen 0.2 s first), the shatter in slow motion (2.2-4.8), the shock wave (4.8-6.6), purified (6.6-8).
  expect(SHATTER.total).toBe(8);
  expect(SHATTER.hitStop).toEqual([0, 0.2]);
  expect([SHATTER.shatter, SHATTER.blast, SHATTER.purified]).toEqual([2.2, 4.8, 6.6]);
  expect(SHATTER.zoomIn[0]).toBe(SHATTER.hitStop[1]);
  expect(SHATTER.cracks[1]).toBeLessThanOrEqual(SHATTER.shatter);
  expect(SHATTER.rift[0]).toBeGreaterThan(SHATTER.shatter);
  expect(SHATTER.implode[1]).toBe(SHATTER.blast);
  expect(SHATTER.wave1[0]).toBe(SHATTER.blast);
  expect(SHATTER.wave2[0]).toBeGreaterThan(SHATTER.wave1[0]);
  expect(SHATTER.count).toBeLessThan(SHATTER.purified);
  expect(SHATTER.back).toEqual([6.9, 8]);
  expect(SHATTER.still).toBe(2);
  expect(KILL_TIMES.gammaShatter).toBe(SHATTER);
  // Bullet time: normal speed at the burst, almost stopped while the shards hang, normal again at the shock wave.
  expect(timeDilation(2.21)).toBe(1);
  expect(timeDilation(3.5)).toBe(SLOW_RATE);
  expect(timeDilation(SHATTER.blast)).toBe(1);
  // The shards' clock is the exact sum of that speed: no frame-by-frame adding up, the same at any frame rate.
  expect(shardTime(SHATTER.shatter)).toBe(0);
  let sum = 0;
  const dt = 0.0005;
  for (let t = SHATTER.shatter; t < 6 - 1e-9; t += dt) sum += timeDilation(t + dt / 2) * dt;
  expect(Math.abs(shardTime(6) - sum)).toBeLessThan(1e-3);
  for (let t = 2.2; t < 7; t += 0.05) expect(shardTime(t + 0.05)).toBeGreaterThanOrEqual(shardTime(t));
  expect(shardTime(5.3) - shardTime(4.8)).toBeCloseTo(0.5, 6);
  // 28-36 shards (fewer on a slow machine), cut the same way every time; together they are the whole tile.
  expect([shardCount(1), shardCount(0.45), shardCount(0.1)]).toEqual([36, 28, 28]);
  for (const n of [28, 32, 36]) {
    const b = breakage(n);
    expect(b.cells).toHaveLength(n);
    let area = 0;
    for (const c of b.cells) {
      let a = 0;
      c.pts.forEach(([x0, y0], i) => {
        const [x1, y1] = c.pts[(i + 1) % c.pts.length]!;
        a += x0 * y1 - x1 * y0;
        // Every corner inside the tile (unit radius, pointy top).
        const [x, y] = [x0 + c.cx, y0 + c.cy];
        for (let k = 0; k < 6; k++) expect(x * Math.cos((k * Math.PI) / 3) + y * Math.sin((k * Math.PI) / 3)).toBeLessThan(0.8661);
      });
      area += Math.abs(a / 2);
      expect(c.near.length).toBeGreaterThan(0);
    }
    expect(area).toBeCloseTo((3 * Math.sqrt(3)) / 2, 2);
    // The fractures of act 1 are the edges between the shards.
    expect(b.cracks).toHaveLength(b.pairs.length);
  }
  expect(breakage(32)).toEqual(breakage(32));
  // The shards fly up and out fast, then hang near the top while time is slowed.
  const b = breakage(32);
  const fl = flights(b);
  fl.forEach((f, i) => {
    const c = b.cells[i]!;
    const at = (t: number) => shardAt(f, c, Math.min(shardTime(t), shardTime(SHATTER.blast)));
    expect(at(2.3).h).toBeGreaterThan(0);
    expect(Math.abs(at(4.4).h - at(3.2).h)).toBeLessThan(Math.abs(at(2.3).h - at(2.2).h) + 0.1);
    expect(at(2.2)).toEqual(at(2.2));
  });
  // The shake: the killing blow held still for 0.2 s, a tremor that grows towards the shatter, a jolt at the shock wave, none at the end.
  expect(shakeOffset(0.05)).toEqual(shakeOffset(0.15));
  const peak = (a: number, b2: number) => {
    let m = 0;
    for (let t = a; t < b2; t += 0.01) m = Math.max(m, Math.hypot(...shakeOffset(t)));
    return m;
  };
  expect(peak(1.8, 2.2)).toBeGreaterThan(peak(0.25, 0.6) * 3);
  expect(peak(4.8, 5.0)).toBeGreaterThan(peak(3.0, 4.4) * 3);
  expect(peak(6.6, 8)).toBeLessThan(0.002);
  expect(shakeOffset(5.0)).toEqual(shakeOffset(5.0));
});

test("the win's energy sweep (I23, I24): it sweeps right across the Field, starting and ending beyond its edges, never standing still on it", () => {
  for (const [w, h, from] of [
    [1100, 700, [300, 420]],
    [390, 600, [195, 200]],
    [800, 800, undefined],
  ] as const) {
    const tile = Math.min(w, h) / 6;
    const p = shinePath(w, h, tile, from);
    expect(Math.hypot(p.ux, p.uy)).toBeCloseTo(1, 6);
    const corners = [0, p.ux * w, p.uy * h, p.ux * w + p.uy * h];
    // At its start the front and all ahead of it is before the Field; at its end the front and its whole wake are past it.
    expect(shineAt(p, WIN.wave[0]) + p.band).toBeLessThanOrEqual(Math.min(...corners) + 1e-6);
    expect(shineAt(p, WIN.wave[1]) - p.wake).toBeGreaterThanOrEqual(Math.max(...corners) - 1e-6);
    expect(p.wake).toBeGreaterThan(p.band);
    // Always moving: its speed is never below a third of the average, at the ends too.
    const avg = (p.s1 - p.s0) / (WIN.wave[1] - WIN.wave[0]);
    for (let i = 0; i < 20; i++) {
      const t = WIN.wave[0] + ((WIN.wave[1] - WIN.wave[0]) * i) / 20;
      expect((shineAt(p, t + 0.01) - shineAt(p, t)) / 0.01).toBeGreaterThan(avg / 3);
    }
    // Away from the sector the unit left: that sector is lit before the far side of the Field.
    if (from) expect(arrival(p, from[0], from[1])).toBeLessThan(arrival(p, w - from[0], h - from[1]));
  }
  expect(sweep(0)).toBe(0);
  expect(sweep(1)).toBeCloseTo(1, 9);
});

test("I25: the celebrations are the same for every Company: the same pieces, picked at random alike", () => {
  // The same made-up Field flown by each Company's vessel: for every seed the same kill and win.
  const v1 = previewBoards(data(), "V1")!;
  const v2 = previewBoards(data(), "V2")!;
  expect(v1.start.player.company).not.toBe(v2.start.player.company);
  const e1 = newEvents(v1.start.events, v1.wonJoined.events);
  const e2 = newEvents(v2.start.events, v2.wonJoined.events);
  const kills = new Set<string>();
  for (let seed = 1; seed < 80; seed++) {
    const k1 = killOf(data(), v1.start, e1, seed)?.piece.id;
    expect(k1).toBeDefined();
    expect(killOf(data(), v2.start, e2, seed)?.piece.id).toBe(k1);
    expect(winShowOf(data(), v2.start, v2.wonJoined, seed)?.piece.id).toBe(winShowOf(data(), v1.start, v1.wonJoined, seed)?.piece.id);
    kills.add(k1!);
  }
  // Either Alpha kill comes up for either Company.
  expect([...kills].sort()).toEqual(["alphaDown", "alphaErase", "alphaPurge", "alphaRail"]);
});

test("the cracks (designer 2026-11-20): tapered, branching, inside the tile, the same every time", () => {
  const shape = { n: 6, origin: [0.1, -0.06], reach: [0.75, 0.9], step: [0.06, 0.11], wander: 0.75, width: 0.05, fork: 0.22 } as const;
  const a = crackTree(9137, shape);
  expect(crackTree(9137, shape)).toEqual(a);
  expect(a.filter((c) => c.depth === 0).length).toBe(6);
  expect(a.some((c) => c.depth > 0)).toBe(true);
  for (const c of a) {
    for (const [x, y] of c.pts) expect(Math.hypot(x, y)).toBeLessThanOrEqual(0.93 + 1e-9);
    // Wide where it starts, sharp at its tip; branches start once their main crack has grown that far.
    expect(c.w[0]!).toBeGreaterThan(c.w[c.w.length - 1]!);
    expect(c.at).toBeGreaterThanOrEqual(0);
    expect(c.at).toBeLessThan(1);
  }
});

test("Beta's molten streams (designer 2026-11-20 round 5): they flow out, split, creep as time goes on, stay inside the tile", () => {
  expect(betaFlows(0, 1.3)).toEqual([]);
  const half = betaFlows(0.5, 1.8);
  expect(betaFlows(0.5, 1.8)).toEqual(half);
  const full = betaFlows(1, 2.4);
  expect(full.filter((f) => f.depth === 0).length).toBe(7);
  expect(full.filter((f) => f.depth === 1).length).toBeGreaterThan(half.filter((f) => f.depth === 1).length);
  for (const f of full) {
    expect(f.len).toBeGreaterThan(0.99);
    for (const [x, y] of f.pts) expect(Math.hypot(x, y)).toBeLessThanOrEqual(0.9 + 1e-9);
    expect(f.w[0]!).toBeGreaterThan(f.w[f.w.length - 1]!);
  }
  // Not fixed: the same streams, fully grown, have crept to other ways a moment later.
  const later = betaFlows(1, 2.9);
  const moved = Math.max(...full.map((f, i) => Math.max(...f.pts.map(([x, y], k) => Math.hypot(x - later[i]!.pts[k]![0], y - later[i]!.pts[k]![1])))));
  expect(moved).toBeGreaterThan(0.02);
});

test("the Field's player: one tap finishes animations up to a celebration, which only two taps (skip) end", () => {
  const log: string[] = [];
  const step = (name: string, extra: Partial<Step> = {}): Step => ({ ms: 1000, start: () => log.push(`start ${name}`), frame: () => {}, end: () => log.push(`end ${name}`), ...extra });
  const p = new Player();
  const look = () => ({ dx: 0, dy: 0, scale: 1, scaleX: 1, alpha: 1, rot: 0 });
  p.add([step("hit"), step("kill", { twoTap: true }), step("after")]);
  p.tick(0, look);
  expect(p.tap()).toBe(true); // the hit ends; the kill starts with the next frame
  p.tick(10, look);
  expect(p.celebrating).toBe(true);
  expect(p.tap()).toBe(false); // one tap: the kill goes on
  expect(p.celebrating).toBe(true);
  p.skip(); // two taps
  expect(p.busy).toBe(false);
  expect(log).toEqual(["start hit", "end hit", "start kill", "end kill", "end after"]);
  // Reduced motion: the celebration's still picture plays (a set time, not stretched by the speed).
  const q = new Player();
  q.reduced = true;
  const still = step("still", { twoTap: true, fixed: true, ms: 1500 });
  q.add([step("hit"), step("kill", { twoTap: true, still })]);
  q.tick(0, look);
  expect(q.celebrating).toBe(true);
  q.speed = 0.5;
  q.tick(1400, look);
  expect(q.busy).toBe(true);
  q.tick(1600, look);
  expect(q.busy).toBe(false);
  // Instant: steps end at once, but the still picture is kept.
  const i = new Player();
  i.speed = 0;
  i.add([step("kill2", { twoTap: true, still: step("still2", { twoTap: true, fixed: true, ms: 1500 }) })]);
  expect(i.busy).toBe(true);
});

test("every mission won has a win (designer 2026-11-21): one of three, at random per mission, the same on reload; Salvage too", () => {
  for (const what of ["Alpha", "Beta", "Gamma", "Salvage"]) {
    const got = new Set<string>();
    for (let seed = 1; seed < 120; seed++) got.add(pickPiece(WIN_PIECES, what, seed, "C1_M2X", "win")!.id);
    expect([...got].sort()).toEqual([...WIN_IDS].sort());
  }
  // The Salvage board (Mission 2: 5 Power Nodes, 3 Cleared sectors, 8.2): the fifth Power Node comes in, the mission is won.
  const b = previewBoards(data(), "V1", "Salvage")!;
  expect(b).toBeDefined();
  expect(objectiveOf(data(), b.start)).toEqual({ type: "salvage" });
  for (const id of WIN_IDS) {
    const w = winShowOf(data(), b.start, b.won, PREVIEW_SEED, undefined, id)!;
    expect(w.piece.id).toBe(id);
    expect([w.kind, w.name, w.target, w.count, w.have, w.from, w.joined, w.fresh, w.flights]).toEqual(["salvage", "Salvage", "F_01", 5, 5, "0,1", false, 1, true]);
    expect(w.sub).toBe("Power Nodes 5 / 5 · Cleared 3 / 3");
    expect(w.kicker).toBe("Salvage secured");
    expect(w.badges).toEqual([...Array.from({ length: 5 }, () => ({ unit: "F_01", filled: true })), ...Array.from({ length: 3 }, () => ({ cleared: true, filled: true }))]);
  }
  // Eliminate: the readout from the objective.
  const a = previewBoards(data(), "V1")!;
  const w = winShowOf(data(), a.kill, a.won, PREVIEW_SEED, undefined, "sectorFlip")!;
  expect([w.kind, w.sub, w.kicker, w.badges.length]).toEqual(["eliminate", "Alpha eliminated · 6 / 6", "Omega targets cleared", 6]);
});

test("Perimeter Sweep: the cells ignite within act 1, the ring sweeps right off the Field, worked out from the time alone", () => {
  expect(SWEEP.total).toBe(5.0);
  for (const n of [1, 3, 6, 8]) {
    expect(cellAt(0, n)).toBeCloseTo(SWEEP.cellsAt);
    for (let i = 1; i < n; i++) expect(cellAt(i, n) - cellAt(i - 1, n)).toBeLessThanOrEqual(SWEEP.cellStep + 1e-9);
    expect(burstAt(n)).toBeLessThan(SWEEP.wave[0]);
  }
  // The ring: from nothing to beyond the farthest corner; never standing still.
  const geo = { fw: 900, fh: 600, ox: 200, oy: 300, tile: 90 };
  const reach = farthest(geo.fw, geo.fh, geo.ox, geo.oy) + geo.tile * 1.5;
  expect(ringAt(SWEEP.wave[0], reach)).toBe(0);
  expect(ringAt(SWEEP.wave[1], reach)).toBeCloseTo(reach);
  for (let p = 0; p < 1; p += 0.05) expect(ringShare(p + 0.05) - ringShare(p)).toBeGreaterThan(0.02);
  // A point is reached when the ring's radius gets to it, nearer ones first.
  for (const d of [0, 100, 400, 700]) expect(ringAt(ringArrival(d, reach), reach)).toBeCloseTo(d, 0);
  expect(ringArrival(100, reach)).toBeLessThan(ringArrival(500, reach));
  // The units recoil away from where the wave starts, and settle.
  const at = ringArrival(Math.hypot(500 - 200, 300 - 300), reach);
  expect(recoil(geo, 500, 300, at - 0.01)).toBeUndefined();
  const r = recoil(geo, 500, 300, at + 0.03)!;
  expect(r.dx).toBeGreaterThan(0);
  expect(Math.abs(r.dy)).toBeLessThan(1e-9);
  expect(recoil(geo, 500, 300, at + 0.6)).toBeUndefined();
  expect(recoil(geo, 500, 300, at + 0.03)).toEqual(r);
});

test("Sector Flip: a wave of lifts, full 360° turns and slams, all down before the card; the jolt 1-2 px", () => {
  expect(FLIP.total).toBe(5.2);
  // One sector: lifts, turns all the way round, back right side up, slams.
  expect(flipPose(0)).toEqual({ lift: 0, turn: 0, slam: -1 });
  expect(flipPose(0.3).lift).toBe(1);
  expect(Math.cos(flipPose((FLIP.turn[0] + FLIP.turn[1]) / 2).turn)).toBeLessThan(-0.99);
  expect(flipPose(FLIP.turn[1]).turn).toBeCloseTo(2 * Math.PI);
  expect(flipPose(FLIP.slamAt).lift).toBe(0);
  expect(flipPose(FLIP.slamAt + 0.1).slam).toBeCloseTo(0.1);
  // Its tile: hidden while its underside shows, in front while up, back in place after.
  const mid = flipLook(10 + (FLIP.turn[0] + FLIP.turn[1]) / 2, 10, 80, 0);
  expect([mid.alpha, mid.z]).toEqual([0, 500]);
  expect(mid.dy).toBeLessThan(-80 * 0.15);
  expect(flipLook(10 + 0.12, 10, 80, 0).alpha).toBe(1);
  expect(flipLook(12, 10, 80, 0)).toEqual({ dx: 0, dy: 0 });
  // A Field of hexes: the wave goes column by column, at most 0.16 s apart, every slam by the end of act 2.
  const sectors: [string, number, number][] = [];
  for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) if (Math.abs(q + r) <= 3) sectors.push([`${q},${r}`, 400 + 69 * (r + q / 2), 300 + 60 * q]);
  const st = flipStarts(sectors, 80);
  expect(st.size).toBe(sectors.length);
  const times = [...st.values()].sort((a, b) => a - b);
  expect(times[0]! - FLIP.flips[0]).toBeLessThan(0.05);
  expect(times.at(-1)! + FLIP.slamAt).toBeLessThanOrEqual(FLIP.flips[1] + 1e-9);
  const cols = [...new Set(times.map((t) => t.toFixed(2)))];
  expect(cols.length).toBeGreaterThan(5);
  // Left to right; from a sector on the right, right to left.
  const left = sectors.reduce((a, b) => (b[1] < a[1] ? b : a));
  const right = sectors.reduce((a, b) => (b[1] > a[1] ? b : a));
  expect(st.get(left[0])!).toBeLessThan(st.get(right[0])!);
  const back = flipStarts(sectors, 80, [right[1], right[2]]);
  expect(back.get(right[0])!).toBeLessThan(back.get(left[0])!);
  // The board's jolt: never more than about 2 px, and gone a moment after the last slam.
  let most = 0;
  for (let t = 0; t < FLIP.total; t += 0.004) most = Math.max(most, Math.abs(boardJolt(t, st.values(), 80)));
  expect(most).toBeGreaterThan(0.5);
  expect(most).toBeLessThanOrEqual(2.5);
  expect(boardJolt(FLIP.flips[1] + 0.3, st.values(), 80)).toBe(0);
});

/** A Field of hexes like Mission 1's (radius 3), with a hole in it and one sector cut off. */
function hexField(): [string, number, number][] {
  const out: [string, number, number][] = [];
  for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++) if (Math.abs(q + r) <= 3 && `${q},${r}` !== "1,0") out.push([`${q},${r}`, 400 + 69 * (r + q / 2), 300 + 60 * q]);
  out.push(["far", 400 + 69 * 6, 300]);
  return out;
}

test("Chain Surge (designer 2026-11-27): the bar's arc, then the surge leaps through every sector from where the unit left, then home", () => {
  expect(SURGE.total).toBe(5.4);
  for (const n of [1, 3, 6, 8]) expect(surgeCellAt(Math.max(0, n - 1), n)).toBeLessThan(SURGE.drop[0]);
  const sectors = hexField();
  const tile = 80;
  const [, ox, oy] = sectors.find(([k]) => k === "2,-1")!;
  const leaps = surgeTree(sectors, tile, ox, oy);
  // Every sector once; the first is where the unit left, struck as the bolt from the bar lands.
  expect(leaps.map((l) => l.key).sort()).toEqual(sectors.map(([k]) => k).sort());
  expect(leaps[0]).toMatchObject({ key: "2,-1", from: undefined, depth: 0, at: SURGE.spread[0] });
  expect(SURGE.drop[1]).toBe(SURGE.spread[0]);
  const by = new Map(leaps.map((l) => [l.key, l]));
  const pos = new Map(sectors.map(([k, x, y]) => [k, [x, y]]));
  for (const l of leaps.slice(1)) {
    const p = by.get(l.from!)!;
    // A leap comes from a sector struck before it, one step nearer the start, and lands within act 2.
    expect(p.depth).toBe(l.depth - 1);
    expect(p.at).toBeLessThan(l.at - leapGrow(l.depth) + 1e-9);
    expect(l.at).toBeLessThanOrEqual(SURGE.spread[1]);
    // Neighbours, except the one cut off (struck from the nearest lit sector).
    const [x0, y0] = pos.get(l.from!)!;
    const [x1, y1] = pos.get(l.key)!;
    if (l.key !== "far") expect(Math.hypot(x1! - x0!, y1! - y0!)).toBeLessThan(tile);
  }
  expect(by.get("far")!.from).toBe("0,3");
  // Through the hole: the sector across it is reached round it.
  expect(by.get("0,0")!.depth).toBe(2);
  // The packets run home, the deepest first, and the last arrives as the uplink fires.
  const deepest = Math.max(...leaps.map((l) => l.depth));
  expect(packetSpan(deepest, deepest)[0]).toBeCloseTo(SURGE.pulse[0]);
  expect(packetSpan(1, deepest)[1]).toBeCloseTo(SURGE.pulse[1]);
  expect(SURGE.uplink[0]).toBeLessThan(SURGE.pulse[1]);
  expect(SURGE.uplink[1]).toBeLessThanOrEqual(SURGE.slam[0]);
  // A struck tile jumps up and settles; nothing before it is struck; the same answer every time.
  expect(surgeLook(-0.01, tile)).toBeUndefined();
  expect(surgeLook(0, tile)!.scale).toBeGreaterThan(1.05);
  expect(surgeLook(0, tile)!.dy).toBeLessThan(0);
  expect(surgeLook(0.6, tile)).toBeUndefined();
  expect(surgeTree(sectors, tile, ox, oy)).toEqual(leaps);
  // After the Developer tool (no sector): from the middle.
  expect(surgeTree(sectors, tile, 400, 300)[0]!.key).toBe("0,0");
});

test("Beacon Spiral (designer 2026-11-27): markers then beams, the edge of the Field first, spiralling in; the pillar after the last", () => {
  expect(BEACON.total).toBe(5.6);
  const sectors = hexField().filter(([k]) => k !== "far");
  const tile = 80;
  const order = spiralOrder(sectors, tile);
  expect(order.map((s) => s.key).sort()).toEqual(sectors.map(([k]) => k).sort());
  expect(order[0]!.at).toBeCloseTo(BEACON.strikes[0]);
  expect(order.at(-1)!.at).toBeCloseTo(BEACON.strikes[1]);
  // Evenly apart; each marker opens before its beam, all within act 1.
  for (let i = 1; i < order.length; i++) expect(order[i]!.at - order[i - 1]!.at).toBeCloseTo((BEACON.strikes[1] - BEACON.strikes[0]) / (order.length - 1));
  for (const s of order) {
    expect(s.mark).toBeGreaterThanOrEqual(BEACON.marks[0]);
    expect(s.mark).toBeLessThanOrEqual(BEACON.marks[1]);
    expect(s.mark).toBeLessThan(s.at);
  }
  // Outside in: the outer ring all before the inner one, the middle last.
  const [mx, my] = beaconMiddle(sectors);
  const ring = (k: string) => {
    const [, x, y] = sectors.find(([s]) => s === k)!;
    return Math.round(Math.hypot(x - mx, y - my) / (tile * 0.866));
  };
  const rings = order.map((s) => ring(s.key));
  for (let i = 1; i < rings.length; i++) expect(rings[i]!).toBeLessThanOrEqual(rings[i - 1]!);
  expect(rings.at(-1)).toBe(0);
  expect(BEACON.strikes[1] + BEACON.fall).toBeLessThan(BEACON.gather[0] + 0.2);
  expect(BEACON.pillar).toBeLessThan(BEACON.slam[0]);
  // A struck tile is pressed down, then bounces back above its size; untouched until its beam.
  expect(beaconLook(-0.1, 1, tile)).toBeUndefined();
  expect(beaconLook(0, 1.5, tile)!.scale).toBeLessThan(0.95);
  const peak = Math.max(...Array.from({ length: 40 }, (_, i) => beaconLook(i * 0.01, 1.5, tile)!.scale));
  expect(peak).toBeGreaterThan(1.01);
  expect(beaconLook(0.8, 2, tile)).toBeUndefined();
  // The pillar's flash lifts every tile a little.
  expect(beaconLook(-5, BEACON.pillar + 0.02, tile)!.scale).toBeGreaterThan(1.01);
});

test("Salvage milestones (designer 2026-11-22): Grid Online at the fifth Power Node, Sector Lock at the third Cleared sector with five taken", async () => {
  const { salvageMarkOf } = await import("../../src/web/celebrate/detect.js");
  // The fifth Power Node, with three sectors already Cleared.
  const n = previewBoards(data(), "V1", "Salvage", "salvageNodes")!;
  const a = salvageMarkOf(data(), n.start, n.kill, PREVIEW_SEED)!;
  const NODE_IDS = ["salvageCascade", "salvageFusion", "salvageNodes"];
  expect([a.kind, NODE_IDS.includes(a.piece.id), a.sector]).toEqual(["nodes", true, "0,1"]);
  expect(salvageMarkOf(data(), n.kill, n.won, PREVIEW_SEED)).toBeUndefined();
  // ...and with fewer than three Cleared: still Grid Online.
  const few = structuredClone(n.start);
  const after = structuredClone(n.kill);
  for (const k of Object.keys(few.field).filter((k) => few.field[k]!.length === 0).slice(0, 2)) {
    few.field[k] = ["x" + k];
    after.field[k] = ["x" + k];
    few.tiles["x" + k] = after.tiles["x" + k] = structuredClone(Object.values(few.tiles)[0]!);
  }
  expect(salvageMarkOf(data(), few, after, PREVIEW_SEED)?.kind).toBe("nodes");
  // The third Cleared sector with five Power Nodes taken.
  const c = previewBoards(data(), "V1", "Salvage", "salvageCleared")!;
  const b = salvageMarkOf(data(), c.start, c.kill, PREVIEW_SEED)!;
  const CLEARED_IDS = ["salvageClaim", "salvageCleared", "salvageSurvey"];
  expect([b.kind, CLEARED_IDS.includes(b.piece.id), b.sector, b.others.length]).toEqual(["cleared", true, "0,1", 2]);
  // Four Power Nodes only: no Sector Lock.
  const four = structuredClone(c.start);
  const four2 = structuredClone(c.kill);
  four.piles.trophy.pop();
  four2.piles.trophy.pop();
  expect(salvageMarkOf(data(), four, four2, PREVIEW_SEED)).toBeUndefined();
  // Not on Eliminate missions; the win in the same answer waits for the piece.
  const e = previewBoards(data(), "V1")!;
  expect(salvageMarkOf(data(), e.start, e.won, PREVIEW_SEED)).toBeUndefined();
  expect(CLEARED_IDS).toContain(winShowOf(data(), c.start, c.won, PREVIEW_SEED)!.kill);
  expect(NODE_IDS).toContain(winShowOf(data(), n.start, n.won, PREVIEW_SEED)!.kill);
  expect(KILL_STEPS.salvageNodes).toBeDefined();
  expect(KILL_TIMES.salvageCleared!.total).toBeGreaterThan(4);
  expect(CELEBRATION_PREVIEWS.filter((w) => w.omega === "Salvage" && w.piece).length).toBe(12);
});

test("two more for the fifth Power Node (designer 2026-11-27): Fusion Ignition and Charge Cascade, in the pool with Grid Online", async () => {
  const { salvageMarkOf } = await import("../../src/web/celebrate/detect.js");
  const { fusionStar, ringPhase, cascadeCell, cellLit, cellFlare } = await import("../../src/web/celebrate/nodesFx.js");
  const { FUSION, CASCADE } = await import("../../src/web/celebrate/timeline.js");
  // One of three at random per mission (I19), the same on reload; the Cleared moment is not theirs.
  const picked = new Set<string>();
  for (let seed = 1; seed < 60; seed++) {
    const p = pickPiece(SALVAGE_PIECES, "Power Nodes", seed, "C1_M2X", "kill")!;
    expect(pickPiece(SALVAGE_PIECES, "Power Nodes", seed, "C1_M2X", "kill")!.id).toBe(p.id);
    picked.add(p.id);
  }
  expect([...picked].sort()).toEqual(["salvageCascade", "salvageFusion", "salvageNodes"]);
  expect(SALVAGE_PIECES.filter((p) => p.for.includes("Cleared")).map((p) => p.id)).not.toContain("salvageFusion");
  // Each plays on the preview's board of the fifth Power Node, and the win waits for it.
  for (const id of ["salvageFusion", "salvageCascade"]) {
    const b = previewBoards(data(), "V1", "Salvage", id)!;
    const m = salvageMarkOf(data(), b.start, b.kill, PREVIEW_SEED, id)!;
    expect([m.kind, m.piece.id]).toEqual(["nodes", id]);
    expect(KILL_STEPS[id]).toBeDefined();
    expect(KILL_TIMES[id]!.total).toBeGreaterThan(4.5);
    expect(winShowOf(data(), b.start, b.won, PREVIEW_SEED, id)!.kill).toBe(id);
  }
  // Fusion: the rings spin up (faster and faster), ignition after they all gather, the fifth star last.
  for (let i = 0; i < 3; i++) {
    const d1 = ringPhase(i, FUSION.ringAt[i]! + 0.5) - ringPhase(i, FUSION.ringAt[i]! + 0.4);
    const d2 = ringPhase(i, FUSION.ignite) - ringPhase(i, FUSION.ignite - 0.1);
    expect(d2).toBeGreaterThan(d1);
    expect(ringPhase(i, FUSION.ringAt[i]! - 0.1)).toBe(0);
  }
  expect(FUSION.ringAt[2]).toBeLessThan(FUSION.pinch[0]);
  expect(FUSION.fifth[1]).toBe(FUSION.count);
  // Five stars round the sector, evenly, clear of the label to its right (wide) and below (narrow).
  const stars = [0, 1, 2, 3, 4].map((i) => fusionStar(i, 500, 400, 100, true));
  for (const [x, y] of stars) expect(Math.hypot(x - 500, y - 400)).toBeCloseTo(160, 0);
  for (const [x, y] of stars) expect(x > 500 + 132 && Math.abs(y - 400) < 40).toBe(false);
  for (const [, y] of [0, 1, 2, 3, 4].map((i) => fusionStar(i, 200, 300, 60, false))) expect(y).toBeLessThan(300 + 60 * 1.3);
  // Cascade: five cells in an arc over the sector, left to right; four light before the fifth locks, then the cascade runs 1 to 5.
  const cells = [0, 1, 2, 3, 4].map((i) => cascadeCell(i, 500, 400, 100));
  for (let i = 0; i < 5; i++) {
    expect(cells[i]![1]).toBeLessThan(400 - 110);
    if (i) expect(cells[i]![0]).toBeGreaterThan(cells[i - 1]![0]);
    if (i) expect(cellFlare(i)).toBeGreaterThan(cellFlare(i - 1));
  }
  for (let i = 0; i < 4; i++) expect(cellLit(i)).toBeLessThan(CASCADE.condense[0] + 0.1);
  expect(cellLit(4)).toBe(CASCADE.lock);
  expect(CASCADE.rise[1]).toBe(CASCADE.lock);
  expect(cellFlare(4) + 0.3).toBeLessThan(CASCADE.dump);
});

// A Field of hexes for the two wins below.
function hexField2(): [string, number, number][] {
  const out: [string, number, number][] = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2) out.push([`${q},${r}`, 400 + 69 * (r + q / 2), 300 + 60 * q]);
  return out;
}

test("Resonance (designer 2026-11-27): two drops ripple the Field with echoes, it calms, rings as one and locks; worked out from the time alone", () => {
  expect(RESONANCE.total).toBe(5.8);
  for (const n of [1, 4, 8]) expect(resonanceCellAt(n - 1, n)).toBeLessThanOrEqual(RESONANCE.cellsAt + RESONANCE.cellsIn + 1e-9);
  const sectors = hexField2();
  const rp = ripplesOf(sectors, 80, 400, 300);
  // Two drops, each with four echoes off the board's edges, weaker.
  expect(rp.sources.length).toBe(10);
  expect(rp.first).toEqual([400, 300]);
  expect(rp.sources[0]!.amp).toBe(1);
  expect(rp.sources[1]!.amp).toBeLessThan(1);
  expect(rp.sources[5]!.t0).toBe(RESONANCE.echoAt);
  // Still before the first ripple comes, moving after it, still again once calm.
  const [fx, fy] = rp.second;
  expect(rippleAt(rp, fx, fy, RESONANCE.splash + 0.01)).toBe(0);
  let moved = 0;
  for (let t = RESONANCE.splash; t < RESONANCE.calm[0]; t += 0.03) moved = Math.max(moved, Math.abs(rippleAt(rp, 400, 300, t)));
  expect(moved).toBeGreaterThan(0.2);
  expect(rippleAt(rp, 400, 300, RESONANCE.calm[1] + 0.01)).toBe(0);
  // The same answer each time (no clock of its own).
  expect(rippleAt(rp, 450, 320, 1.4)).toBe(rippleAt(rp, 450, 320, 1.4));
  // The ring: nothing before or after, its beats inside it, louder each beat.
  expect(resRingAt(RESONANCE.ring[0])).toBe(0);
  expect(resRingAt(RESONANCE.ring[1])).toBe(0);
  const beats = beatTimes();
  expect(beats.length).toBe(RESONANCE.beats);
  for (const b of beats) expect(b > RESONANCE.ring[0] && b < RESONANCE.ring[1]).toBe(true);
  expect(Math.abs(resRingAt(beats.at(-1)!))).toBeGreaterThan(Math.abs(resRingAt(beats[0]!)));
  // A tile rides the surface: up on a crest; nothing to do before the drop or after the lock's snap.
  expect(resonanceLook(rp, 400, 300, 0.5)).toBeUndefined();
  expect(resonanceLook(rp, 400, 300, RESONANCE.lock + 1)).toBeUndefined();
  const crest = beats.map((b) => [b, resRingAt(b)] as const).find(([, h]) => h > 0)!;
  expect(resonanceLook(rp, 400, 300, crest[0])!.dy).toBeLessThan(0);
  // The lattice joins neighbours only, each pair once.
  const lat = latticeOf(sectors, 80);
  expect(lat.length).toBe(42);
  for (const [ax, ay, bx, by] of lat) expect(Math.hypot(bx - ax, by - ay)).toBeLessThan(80 * 1.2);
});

test("Murmuration (designer 2026-11-27): a swarm flies once through every sector from where the unit left, then forms the emblem", () => {
  expect(MURMUR.total).toBe(6.0);
  for (const n of [1, 4, 8]) expect(swarmCellAt(n - 1, n)).toBeLessThanOrEqual(MURMUR.cellsAt + MURMUR.cellsIn + 1e-9);
  expect(pace(0)).toBe(0);
  expect(pace(1)).toBeCloseTo(1);
  for (let u = 0; u < 1; u += 0.05) expect(pace(u + 0.05) - pace(u)).toBeGreaterThan(0.02);
  const sectors = hexField2();
  const f = flightOf(sectors, 470, 300);
  // Every sector once, the first nearest where the unit left; reached one after another inside the route.
  expect(f.stops.length).toBe(sectors.length);
  expect(new Set(f.stops.map((s) => s[0])).size).toBe(sectors.length);
  expect(f.stops[0]![0]).toBe("0,1");
  expect(f.at[0]).toBeCloseTo(MURMUR.route[0]);
  expect(f.at.at(-1)!).toBeCloseTo(MURMUR.route[1]);
  for (let i = 1; i < f.at.length; i++) expect(f.at[i]!).toBeGreaterThan(f.at[i - 1]!);
  // The head passes over each sector when it claims it.
  for (let i = 0; i < f.stops.length; i++) {
    const [x, y] = headAt(f, f.at[i]!);
    expect(Math.hypot(x - f.stops[i]![1], y - f.stops[i]![2])).toBeLessThan(1);
  }
  // A claimed tile is pushed, then settles.
  expect(murmurLook(f, 3, f.at[3]! - 0.1, 80)).toBeUndefined();
  expect(murmurLook(f, 3, f.at[3]! + 0.02, 80)!.scale).toBeGreaterThan(1);
  expect(murmurLook(f, 3, MURMUR.out[1], 80)).toBeUndefined();
});

test("Rail Strike (designer 2026-11-27): the slug crosses in bullet time and strikes on time; the coils flare as it passes", () => {
  expect(RAIL.total).toBe(4.5);
  expect(KILL_TIMES.alphaRail).toBe(RAIL);
  const far = 14;
  expect(slugDistance(RAIL.fire, far)).toBeCloseTo(far);
  expect(slugDistance(RAIL.impact, far)).toBeCloseTo(0);
  // Slowing as it nears: the last half of the time covers less than the first.
  const mid = (RAIL.fire + RAIL.impact) / 2;
  expect(far - slugDistance(mid, far)).toBeGreaterThan(slugDistance(mid, far));
  for (const d of [1, 4, 9]) expect(slugDistance(slugPasses(d, far), far)).toBeCloseTo(d, 5);
  expect(slugPasses(9, far)).toBeLessThan(slugPasses(2, far));
  expect(RAIL.lock < RAIL.coils[0] && RAIL.coils[1] <= RAIL.fire && RAIL.impact < RAIL.wreckIn[0] && RAIL.count < RAIL.back[0]).toBe(true);
});

test("Alpha Erased (designer 2026-11-27): the bar sweeps the tile, the lattice holds its shape, then unravels from the left", () => {
  expect(ERASE.total).toBe(4.6);
  expect(KILL_TIMES.alphaErase).toBe(ERASE);
  expect(hexHalfHeight(1, 0)).toBe(1);
  expect(hexHalfHeight(1, 2)).toBe(0);
  expect(barAt(ERASE.scan[0])).toBeCloseTo(-1.05);
  expect(barAt(ERASE.scan[1])).toBeCloseTo(1.05);
  expect(LATTICE.length).toBeGreaterThan(300);
  // Ahead of the bar: nothing; behind it: in place; during the unravel: away to the right; after: gone.
  const p = LATTICE.reduce((a, b) => (b.x > a.x ? b : a));
  expect(latticeAt(p, ERASE.scan[0] + 0.05).a).toBe(0);
  const held = latticeAt(p, ERASE.hold[0]);
  expect(held.a).toBe(1);
  expect(held.x).toBeCloseTo(p.x, 1);
  const away = latticeAt(p, p.leave + 0.3);
  expect(away.x).toBeGreaterThan(p.x);
  expect(latticeAt(p, p.leave + p.life + 0.01).a).toBe(0);
  // Left goes first, and every point is gone before the zoom eases back.
  const left = LATTICE.reduce((a, b) => (b.x < a.x ? b : a));
  expect(left.leave).toBeLessThan(p.leave);
  for (const q of LATTICE) expect(q.leave + q.life).toBeLessThan(ERASE.back[0]);
  expect(Math.min(...LATTICE.map((q) => q.leave))).toBeGreaterThanOrEqual(ERASE.hold[1] - 0.07);
});

test("the two Beta kills (designer 2026-11-27): longer than any Alpha kill and Beta Breach's equal or more; Barrage walks in, Cryo freezes still", () => {
  const alphaLongest = Math.max(...["alphaDown", "alphaPurge", "alphaRail", "alphaErase"].map((id) => KILL_TIMES[id]!.total));
  for (const id of ["betaBarrage", "betaCryo"]) {
    expect(KILL_TIMES[id]!.total).toBeGreaterThan(alphaLongest + 1.5);
    expect(KILL_TIMES[id]!.total).toBeGreaterThanOrEqual(KILL_TIMES.betaBreach!.total);
  }
  // Barrage: the shells come one after another, each landing nearer the Beta; the shield breaks before the lance strikes.
  for (let i = 1; i < BARRAGE.shells.length; i++) {
    expect(BARRAGE.shells[i]!).toBeGreaterThan(BARRAGE.shells[i - 1]!);
    expect(shellSpot(i).r).toBeLessThan(shellSpot(i - 1).r);
  }
  expect(shellSpot(BARRAGE.shells.length - 1).r).toBeGreaterThan(1);
  expect(BARRAGE.shells.at(-1)! < BARRAGE.shieldBreak && BARRAGE.shieldBreak < BARRAGE.strike && BARRAGE.lance[1] === BARRAGE.strike).toBe(true);
  expect(BARRAGE.strike < BARRAGE.wreckIn[0] && BARRAGE.count < BARRAGE.back[0]).toBe(true);
  // Cryo: it struggles while freezing, weaker as it goes, and is still once frozen; the cracks come in the silence before the shatter.
  let early = 0;
  let late = 0;
  const mid = (CRYO.freeze[0] + CRYO.freeze[1]) / 2;
  for (let t = CRYO.freeze[0]; t < CRYO.freeze[1]; t += 0.01) {
    if (t < mid) early = Math.max(early, struggle(t));
    else late = Math.max(late, struggle(t));
  }
  expect(early).toBeGreaterThan(late);
  expect(struggle(CRYO.freeze[1] + 0.01)).toBe(0);
  expect(CRYO.freeze[1] < CRYO.cracks[0] && CRYO.cracks[1] < CRYO.shatter).toBe(true);
  // The frost grows from the edges, staying inside the tile.
  expect(FROST_LINES.length).toBeGreaterThan(18);
  for (const fl of FROST_LINES) for (const [x, y] of fl.pts) expect(Math.hypot(x, y)).toBeLessThan(1.05);
});

test("two more for the third Cleared sector (designer 2026-11-27): Claim Markers and Terrain Survey, in the pool with Sector Lock", async () => {
  const { salvageMarkOf } = await import("../../src/web/celebrate/detect.js");
  const { claimArrive, passTimes, sweepAngle } = await import("../../src/web/celebrate/clearedFx.js");
  const { CLAIM, SURVEY } = await import("../../src/web/celebrate/timeline.js");
  const picked = new Set<string>();
  for (let seed = 1; seed < 60; seed++) picked.add(pickPiece(SALVAGE_PIECES, "Cleared", seed, "C1_M2X", "kill")!.id);
  expect([...picked].sort()).toEqual(["salvageClaim", "salvageCleared", "salvageSurvey"]);
  for (const id of ["salvageClaim", "salvageSurvey"]) {
    expect(SALVAGE_PIECES.find((p) => p.id === id)!.for).toEqual(["Cleared"]);
    const b = previewBoards(data(), "V1", "Salvage", id)!;
    const m = salvageMarkOf(data(), b.start, b.kill, PREVIEW_SEED, id)!;
    expect([m.kind, m.piece.id, m.others.length]).toEqual(["cleared", id, 2]);
    expect(KILL_STEPS[id]).toBeDefined();
    expect(KILL_TIMES[id]!.total).toBeGreaterThan(4.5);
    expect(winShowOf(data(), b.start, b.won, PREVIEW_SEED, id)!.kill).toBe(id);
  }
  // Claim: the stake lands, the hologram builds, the arches reach both others before the lock, the count with the lock.
  expect(CLAIM.drop[1]).toBe(CLAIM.impact);
  expect(CLAIM.holo[1]).toBeLessThanOrEqual(CLAIM.arcs[0]);
  expect(claimArrive(1)).toBeGreaterThan(claimArrive(0));
  expect(claimArrive(1) + 0.3).toBeLessThan(CLAIM.lock);
  expect(CLAIM.count).toBe(CLAIM.lock);
  // Survey: the sweep turns twice; any direction is passed twice, both before the stamp.
  expect(sweepAngle(SURVEY.sweep[0])).toBeCloseTo(-Math.PI / 2);
  expect(sweepAngle(SURVEY.sweep[1]) - sweepAngle(SURVEY.sweep[0])).toBeCloseTo(4 * Math.PI);
  for (const phi of [-3, -1.5, 0, 1, 2.5, 3.1]) {
    const [a, c] = passTimes(phi);
    expect(c).toBeGreaterThan(a);
    expect(c).toBeLessThanOrEqual(SURVEY.lock);
    for (const at of [a, c]) {
      const th = sweepAngle(at);
      expect(Math.abs(Math.atan2(Math.sin(th - phi), Math.cos(th - phi)))).toBeLessThan(1e-6);
    }
  }
});

test("Singularity (designer 2026-11-27): the board falls into a well round the middle, turning, and is flung back at the nova; worked out from the time alone", () => {
  expect(SINGULAR.total).toBe(6.0);
  for (const n of [1, 4, 8]) expect(feedCellAt(n - 1, n)).toBeLessThanOrEqual(SINGULAR.cellsAt + SINGULAR.cellsIn + 1e-9);
  // Nothing moves before the pull; the near tiles go first; at the nova every tile is in as far as it goes.
  expect(wellPull(0.5, SINGULAR.pull[0] - 0.01)).toBe(0);
  expect(wellPull(0, SINGULAR.pull[0] + 0.4)).toBeGreaterThan(wellPull(1, SINGULAR.pull[0] + 0.4));
  for (const u of [0, 0.5, 1]) expect(wellPull(u, SINGULAR.nova - 1e-6)).toBeCloseTo(SINGULAR.squeeze, 4);
  // After the nova: flung out past its place (below 0), then at rest.
  let least = 1;
  for (let t = SINGULAR.nova; t < SINGULAR.nova + 0.5; t += 0.01) least = Math.min(least, wellPull(0.5, t));
  expect(least).toBeLessThan(-0.1);
  expect(Math.abs(wellPull(0.5, SINGULAR.nova + 1.29))).toBeLessThan(0.01);
  expect(singularityLook(400, 300, 600, 300, 300, SINGULAR.nova + 1.4, 80)).toBeUndefined();
  expect(singularityLook(400, 300, 600, 300, 300, 0.5, 80)).toBeUndefined();
  // Pulled in: nearer the middle, turned, smaller.
  const [px, py, sc] = wellPlace(400, 300, 600, 300, 300, SINGULAR.nova - 0.01);
  expect(Math.hypot(px - 400, py - 300)).toBeLessThan(200 * 0.5);
  expect(Math.abs(py - 300)).toBeGreaterThan(5);
  expect(sc).toBeLessThan(0.6);
  // The core forms, grows, and is gone at the nova.
  expect(coreSize(SINGULAR.core[0] - 0.01)).toBe(0);
  expect(coreSize(SINGULAR.nova - 0.01)).toBeGreaterThan(coreSize(SINGULAR.core[1]));
  expect(coreSize(SINGULAR.nova)).toBe(0);
  expect(sound.onSingularityNova).toBeTypeOf("function");
});

test("Armillary (designer 2026-11-27): three rings drawn, tumbling through the Field lighting sectors, locked in one plane; worked out from the time alone", () => {
  expect(ARMILLARY.total).toBe(5.8);
  for (let i = 0; i < 3; i++) {
    expect(ringDrawn(i, ARMILLARY.launch[i]!)).toBe(0);
    expect(ringDrawn(i, ARMILLARY.spin[0])).toBe(1);
  }
  // Tumbling: the tilts change; locked: all three in the same plane, nested.
  expect(ringAngles(0, 1.5)).not.toEqual(ringAngles(0, 2.0));
  const lock = [0, 1, 2].map((i) => ringFrame(i, ARMILLARY.lock + 0.2, 800, 600));
  for (const f of lock) {
    expect(Math.hypot(...f.u)).toBeCloseTo(1, 6);
    expect(Math.hypot(...f.v)).toBeCloseTo(1, 6);
    const n0 = [lock[0]!.u[1] * lock[0]!.v[2] - lock[0]!.u[2] * lock[0]!.v[1], lock[0]!.u[2] * lock[0]!.v[0] - lock[0]!.u[0] * lock[0]!.v[2], lock[0]!.u[0] * lock[0]!.v[1] - lock[0]!.u[1] * lock[0]!.v[0]];
    const n = [f.u[1] * f.v[2] - f.u[2] * f.v[1], f.u[2] * f.v[0] - f.u[0] * f.v[2], f.u[0] * f.v[1] - f.u[1] * f.v[0]];
    expect(Math.abs(n0[0]! * n[0]! + n0[1]! * n[1]! + n0[2]! * n[2]!)).toBeCloseTo(1, 6);
  }
  expect(lock[0]!.r).toBeGreaterThan(lock[1]!.r);
  expect(lock[1]!.r).toBeGreaterThan(lock[2]!.r);
  // The rings cross the board: on a hex board most sectors are touched, and each tile lifts as one passes.
  const sectors: [string, number, number][] = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2) sectors.push([`${q},${r}`, 400 + 70 * (r + q / 2), 300 - 60 * q]);
  const first = armillaryPlan(sectors, 800, 600, 70);
  expect(first.size).toBeGreaterThan(sectors.length / 2);
  for (const at of first.values()) expect(at >= ARMILLARY.spin[0] - 0.3 && at <= ARMILLARY.align[1]).toBe(true);
  const [k, x, y] = sectors.find(([key]) => first.has(key))!;
  expect(armillaryTouch(800, 600, 70, x, y, first.get(k)!)).toBeGreaterThan(0.45);
  expect(armillaryLook(800, 600, x, y, first.get(k)!, 70)!.dy).toBeLessThan(0);
  expect(armillaryTouch(800, 600, 70, x, y, ARMILLARY.lock + 0.1)).toBe(0);
  expect(armillaryLook(800, 600, x, y, 0.5, 70)).toBeUndefined();
  expect(armillaryLook(800, 600, x, y, ARMILLARY.lock + 0.8, 70)).toBeUndefined();
  expect(sound.onArmillaryLock).toBeTypeOf("function");
});

/** A small hex board (Field pixels, pointy-topped, touching), as the Field lays sectors out. */
function hexBoard(d = 70): [string, number, number][] {
  const out: [string, number, number][] = [];
  for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2) out.push([`${q},${r}`, 400 + d * (r + q / 2), 300 - d * (Math.sqrt(3) / 2) * q]);
  return out;
}

test("Aurora (designer 2026-11-28): three curtains fold down the Field, gather into one band and meet in a crown; worked out from the time alone", () => {
  expect(AURORA.total).toBe(6.0);
  // Each curtain starts above the Field and comes down; the first lowest.
  for (let k = 0; k < 3; k++) {
    expect(descent(k, AURORA.curtains[k]!)).toBe(0);
    expect(curtainEdge(k, 400, AURORA.curtains[k]!, 800, 600)).toBeLessThan(0);
  }
  expect(curtainEdge(0, 400, AURORA.gather[0], 800, 600)).toBeGreaterThan(curtainEdge(2, 400, AURORA.gather[0], 800, 600));
  // Gathered: one band across the middle.
  for (let k = 0; k < 3; k++) {
    const y = curtainEdge(k, 400, AURORA.gather[1], 800, 600);
    expect(Math.abs(y - 0.56 * 600)).toBeLessThan(600 * 0.12);
  }
  // Climbed away off the top at the end.
  expect(curtainEdge(1, 400, AURORA.out[1], 800, 600)).toBeLessThan(0);
  expect(crownAt(800, 600)[1]).toBeLessThan(0.56 * 600);
  // A sector under a lower edge glows and sways; nothing at the start.
  const t = AURORA.curtains[0]! + 1.0;
  const y = curtainEdge(0, 400, t, 800, 600);
  expect(auroraTouch(800, 600, 70, 400, y, t)).toBeGreaterThan(0.9);
  expect(auroraLook(800, 600, 400, y, t, 70)).toBeDefined();
  expect(auroraLook(800, 600, 400, 300, 0.2, 70)).toBeUndefined();
  expect(sound.onAuroraCrown).toBeTypeOf("function");
});

test("Circuit Trace (designer 2026-11-28): the traces run along every sector edge from one corner, each sector powers up as its last edge closes", () => {
  expect(CIRCUIT.total).toBe(5.6);
  const board = hexBoard();
  const c = circuitOf(board, 800, 70);
  // Neighbouring sectors share their corners and edges: 19 hexes have 54 corners and 72 edges.
  expect(c.verts.length).toBe(54);
  expect(c.edges.filter((e) => !e.jump).length).toBe(72);
  expect(c.edges.some((e) => e.jump)).toBe(false);
  // The entry is lit first, the farthest corner at the end of the run.
  expect(c.at[c.entry]).toBe(CIRCUIT.run[0]);
  expect(Math.max(...c.at)).toBeCloseTo(CIRCUIT.run[1], 6);
  expect(c.verts[c.entry]![1]).toBe(Math.min(...c.verts.map((v) => v[1])));
  // An edge is lit from whichever end comes first, and done when the traces meet.
  c.edges.forEach((e, i) => {
    expect(litAt(c, i, 0)).toBeCloseTo(Math.min(c.at[e.a]!, c.at[e.b]! + e.len / c.speed), 6);
    expect(edgeDone(c, i)).toBeLessThanOrEqual(Math.max(c.at[e.a]!, c.at[e.b]!) + 1e-9);
    expect(litAt(c, i, e.len / 2)).toBeLessThanOrEqual(edgeDone(c, i) + 1e-9);
  });
  // Every sector closes during the run, and its tile jolts then.
  for (const s of c.sectors) {
    expect(s.closes > CIRCUIT.run[0] && s.closes <= CIRCUIT.run[1] + 1e-9).toBe(true);
    expect(circuitLook(s.closes, s.closes + 0.02, 70)!.dy).toBeLessThan(0);
    expect(circuitLook(s.closes, s.closes - 0.1, 70)).toBeUndefined();
  }
  // Two parts that do not touch are joined by a jump.
  const apart = circuitOf([["a", 100, 100], ["b", 170, 100], ["c", 600, 100]], 800, 70);
  expect(apart.edges.filter((e) => e.jump).length).toBe(1);
  expect(apart.at.every((x) => Number.isFinite(x))).toBe(true);
  expect(sound.onCircuitLock).toBeTypeOf("function");
});
