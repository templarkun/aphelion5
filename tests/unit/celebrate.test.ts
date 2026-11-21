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
  expect(WIN_PIECES.map((p) => [p.id, p.for])).toEqual([["missionComplete", ["Alpha", "Beta", "Gamma"]]]);
  for (const p of KILL_PIECES) {
    expect(KILL_STEPS[p.id]).toBeTypeOf("function");
    expect(KILL_TIMES[p.id]).toBeDefined();
  }
  const alphas = new Set<string>();
  for (let seed = 1; seed < 40; seed++) alphas.add(pickPiece(KILL_PIECES, "Alpha", seed, "C1_M1", "kill")!.id);
  expect([...alphas].sort()).toEqual(["alphaDown", "alphaPurge"]);
  expect(pickPiece(KILL_PIECES, "Beta", 7, "C1_M3", "kill")?.id).toBe("betaBreach");
  expect(pickPiece(WIN_PIECES, "Beta", 7, "C1_M3", "win")?.id).toBe("missionComplete");
  const gammas = new Set<string>();
  for (let seed = 1; seed < 40; seed++) gammas.add(pickPiece(KILL_PIECES, "Gamma", seed, "C1_M7", "kill")!.id);
  expect([...gammas].sort()).toEqual(["gammaArray", "gammaHorizon", "gammaShatter"]);
  expect(pickPiece(WIN_PIECES, "Gamma", 7, "C1_M7", "win")?.id).toBe("missionComplete");
  expect(pickPiece(KILL_PIECES, "Salvage", 7, "C1_M2", "kill")).toBeUndefined();
  // System options: a button for each kill, the win and each kill with the win, for Alpha, Beta and Gamma.
  expect(CELEBRATION_PREVIEWS.map((w) => `${w.omega} ${w.kind} ${w.piece ?? ""}`.trim())).toEqual([
    "Alpha kill alphaDown",
    "Alpha kill alphaPurge",
    "Alpha win",
    "Alpha both alphaDown",
    "Alpha both alphaPurge",
    "Beta kill betaBreach",
    "Beta win",
    "Beta both betaBreach",
    "Gamma kill gammaHorizon",
    "Gamma kill gammaArray",
    "Gamma kill gammaShatter",
    "Gamma win",
    "Gamma both gammaHorizon",
    "Gamma both gammaArray",
    "Gamma both gammaShatter",
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
  expect(w.piece.id).toBe("missionComplete");
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
  expect(j.piece.id).toBe("missionComplete");
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
  const j = winShowOf(data(), b.start, b.wonJoined, PREVIEW_SEED, "gammaHorizon")!;
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
