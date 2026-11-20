// The mission celebrations (designer 2026-11-20; screen only): which piece plays (I19), when the kill
// plays (the destroyed event that reaches the Eliminate objective's number, 8.2), when the win plays
// (the engine's display event "won") and the board it shows, the animation player's two-tap steps; the
// second Alpha kill (I21), the Beta kill and Mission Complete for Beta (I22), the win's energy sweep (I23, I24); the same for every Company (I25).
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
import { BREACH, KILL, KILL_TIMES, PURGE, STILL, WIN } from "../../src/web/celebrate/timeline.js";
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
  // Today: two kills for Alpha (Alpha Down, Alpha Purge, I21), one for Beta (Beta Breach); Mission Complete for
  // Alpha and Beta missions (I22); nothing for Gamma or Salvage yet. Every kill piece has its step and times.
  expect(KILL_PIECES.map((p) => [p.id, p.for])).toEqual([
    ["alphaDown", ["Alpha"]],
    ["alphaPurge", ["Alpha"]],
    ["betaBreach", ["Beta"]],
  ]);
  expect(WIN_PIECES.map((p) => [p.id, p.for])).toEqual([["missionComplete", ["Alpha", "Beta"]]]);
  for (const p of KILL_PIECES) {
    expect(KILL_STEPS[p.id]).toBeTypeOf("function");
    expect(KILL_TIMES[p.id]).toBeDefined();
  }
  const alphas = new Set<string>();
  for (let seed = 1; seed < 40; seed++) alphas.add(pickPiece(KILL_PIECES, "Alpha", seed, "C1_M1", "kill")!.id);
  expect([...alphas].sort()).toEqual(["alphaDown", "alphaPurge"]);
  expect(pickPiece(KILL_PIECES, "Beta", 7, "C1_M3", "kill")?.id).toBe("betaBreach");
  expect(pickPiece(WIN_PIECES, "Beta", 7, "C1_M3", "win")?.id).toBe("missionComplete");
  expect(pickPiece(KILL_PIECES, "Gamma", 7, "C1_M7", "kill")).toBeUndefined();
  expect(pickPiece(WIN_PIECES, "Gamma", 7, "C1_M7", "win")).toBeUndefined();
  // System options: a button for each kill, the win and each kill with the win, for Alpha and Beta.
  expect(CELEBRATION_PREVIEWS.map((w) => `${w.omega} ${w.kind} ${w.piece ?? ""}`.trim())).toEqual([
    "Alpha kill alphaDown",
    "Alpha kill alphaPurge",
    "Alpha win",
    "Alpha both alphaDown",
    "Alpha both alphaPurge",
    "Beta kill betaBreach",
    "Beta win",
    "Beta both betaBreach",
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
  for (const [id, t] of Object.entries(KILL_TIMES)) expect(t.back[1], id).toBe(t.total);
  // Silent sound hooks, ready for audio files.
  for (const f of [sound.playTargetLock, sound.playOmegaBreak, sound.playKillConfirmed, sound.playPurgeBeam, sound.playBetaSurge, sound.playBetaDetonation, sound.playTrophyLand, sound.playWinSweep, sound.playMissionComplete]) expect(typeof f).toBe("function");
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
