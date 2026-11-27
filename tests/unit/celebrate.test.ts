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
import { KILL_PIECES, pickPiece, WIN_PIECES, type Piece } from "../../src/web/celebrate/pieces.js";
import { boardJolt, flipLook, flipPose, flipStarts } from "../../src/web/celebrate/flipFx.js";
import { burstAt, cellAt, farthest, recoil, ringArrival, ringAt, ringShare } from "../../src/web/celebrate/sweepFx.js";
import { BEACON, FLIP, SURGE, SWEEP } from "../../src/web/celebrate/timeline.js";
import { leapGrow, packetSpan, surgeCellAt, surgeLook, surgeTree } from "../../src/web/celebrate/chainSurgeFx.js";
import { beaconLook, beaconMiddle, spiralOrder } from "../../src/web/celebrate/beaconFx.js";

const WIN_IDS = ["missionComplete", "perimeterSweep", "sectorFlip", "chainSurge", "beaconSpiral"];
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
    ["betaBreach", ["Beta"]],
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
  ]);
  for (const p of KILL_PIECES) {
    expect(KILL_STEPS[p.id]).toBeTypeOf("function");
    expect(KILL_TIMES[p.id]).toBeDefined();
  }
  const alphas = new Set<string>();
  for (let seed = 1; seed < 40; seed++) alphas.add(pickPiece(KILL_PIECES, "Alpha", seed, "C1_M1", "kill")!.id);
  expect([...alphas].sort()).toEqual(["alphaDown", "alphaPurge"]);
  expect(pickPiece(KILL_PIECES, "Beta", 7, "C1_M3", "kill")?.id).toBe("betaBreach");
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
    "Alpha win missionComplete",
    "Alpha win perimeterSweep",
    "Alpha win sectorFlip",
    "Alpha win chainSurge",
    "Alpha win beaconSpiral",
    "Alpha both alphaDown missionComplete",
    "Alpha both alphaPurge missionComplete",
    "Beta kill betaBreach",
    "Beta win missionComplete",
    "Beta win perimeterSweep",
    "Beta win sectorFlip",
    "Beta win chainSurge",
    "Beta win beaconSpiral",
    "Beta both betaBreach missionComplete",
    "Gamma kill gammaHorizon",
    "Gamma kill gammaArray",
    "Gamma kill gammaShatter",
    "Gamma win missionComplete",
    "Gamma win perimeterSweep",
    "Gamma win sectorFlip",
    "Gamma win chainSurge",
    "Gamma win beaconSpiral",
    "Gamma both gammaHorizon missionComplete",
    "Gamma both gammaArray missionComplete",
    "Gamma both gammaShatter missionComplete",
    "Salvage win missionComplete",
    "Salvage win perimeterSweep",
    "Salvage win sectorFlip",
    "Salvage win chainSurge",
    "Salvage win beaconSpiral",
    "Salvage kill salvageNodes",
    "Salvage kill salvageCleared",
    "Salvage both salvageNodes missionComplete",
    "Salvage both salvageCleared missionComplete",
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
  expect(killOf(data(), b.start, ev, PREVIEW_SEED)).toEqual(expect.objectContaining({ index: d, name: "Beta", count: 3, piece: expect.objectContaining({ id: "betaBreach" }) }));
  const j = winShowOf(data(), b.start, b.wonJoined, PREVIEW_SEED)!;
  expect(WIN_IDS).toContain(j.piece.id);
  expect([j.name, j.target, j.count, j.have, j.from, j.joined, j.kill, j.fresh]).toEqual(["Beta", "O_02", 3, 3, "0,1", true, "betaBreach", 1]);
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
  for (let seed = 1; seed < 30; seed++) {
    const k1 = killOf(data(), v1.start, e1, seed)?.piece.id;
    expect(k1).toBeDefined();
    expect(killOf(data(), v2.start, e2, seed)?.piece.id).toBe(k1);
    expect(winShowOf(data(), v2.start, v2.wonJoined, seed)?.piece.id).toBe(winShowOf(data(), v1.start, v1.wonJoined, seed)?.piece.id);
    kills.add(k1!);
  }
  // Either Alpha kill comes up for either Company.
  expect([...kills].sort()).toEqual(["alphaDown", "alphaPurge"]);
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
    for (let seed = 1; seed < 60; seed++) got.add(pickPiece(WIN_PIECES, what, seed, "C1_M2X", "win")!.id);
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
  expect([a.kind, a.piece.id, a.sector]).toEqual(["nodes", "salvageNodes", "0,1"]);
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
  expect([b.kind, b.piece.id, b.sector, b.others.length]).toEqual(["cleared", "salvageCleared", "0,1", 2]);
  // Four Power Nodes only: no Sector Lock.
  const four = structuredClone(c.start);
  const four2 = structuredClone(c.kill);
  four.piles.trophy.pop();
  four2.piles.trophy.pop();
  expect(salvageMarkOf(data(), four, four2, PREVIEW_SEED)).toBeUndefined();
  // Not on Eliminate missions; the win in the same answer waits for the piece.
  const e = previewBoards(data(), "V1")!;
  expect(salvageMarkOf(data(), e.start, e.won, PREVIEW_SEED)).toBeUndefined();
  expect(winShowOf(data(), c.start, c.won, PREVIEW_SEED)!.kill).toBe("salvageCleared");
  expect(winShowOf(data(), n.start, n.won, PREVIEW_SEED)!.kill).toBe("salvageNodes");
  expect(KILL_STEPS.salvageNodes).toBeDefined();
  expect(KILL_TIMES.salvageCleared!.total).toBeGreaterThan(4);
  expect(CELEBRATION_PREVIEWS.filter((w) => w.omega === "Salvage" && w.piece).length).toBe(4);
});
