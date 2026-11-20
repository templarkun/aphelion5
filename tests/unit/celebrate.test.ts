// The mission celebrations (designer 2026-11-20; screen only): which piece plays (I19), when the kill
// plays (the destroyed event that reaches the Eliminate objective's number, 8.2), when the win plays
// (the engine's display event "won") and the board it shows, the animation player's two-tap steps.
import { expect, test } from "vitest";
import { newEvents, type GameEvent } from "../../src/engine/events.js";
import { newRng } from "../../src/engine/rng.js";
import { playAnswer, startGame, type Game } from "../../src/engine/save.js";
import { emptyProfile } from "../../src/engine/state.js";
import { Player, type Step } from "../../src/web/anim.js";
import { countedSoFar, decidingKill, killOf, objectiveOf, omegaName, winOf, winShowOf, wonStateOf } from "../../src/web/celebrate/detect.js";
import { KILL_PIECES, pickPiece, WIN_PIECES, type Piece } from "../../src/web/celebrate/pieces.js";
import { PREVIEW_SEED, previewBoards } from "../../src/web/celebrate/previewBoards.js";
import { KILL, STILL, WIN } from "../../src/web/celebrate/timeline.js";
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
    { id: "a", name: "A", for: "Alpha" },
    { id: "b", name: "B", for: "Alpha" },
    { id: "c", name: "C", for: "Beta" },
  ];
  // The same game and mission: always the same piece.
  for (let seed = 1; seed < 20; seed++) expect(pickPiece(two, "Alpha", seed, "C1_M1", "win")).toEqual(pickPiece(two, "Alpha", seed, "C1_M1", "win"));
  // Over many games both Alpha pieces come up, never the Beta one; nothing for a type with none.
  const got = new Set<string>();
  for (let seed = 1; seed < 60; seed++) got.add(pickPiece(two, "Alpha", seed, "C1_M1", "kill")!.id);
  expect([...got].sort()).toEqual(["a", "b"]);
  expect(pickPiece(two, "Gamma", 1, "C1_M1", "kill")).toBeUndefined();
  // Today: one kill (Alpha Down) and one win (Mission Complete), for Alpha missions only.
  expect(KILL_PIECES.map((p) => [p.id, p.for])).toEqual([["alphaDown", "Alpha"]]);
  expect(WIN_PIECES.map((p) => [p.id, p.for])).toEqual([["missionComplete", "Alpha"]]);
  expect(pickPiece(KILL_PIECES, "Alpha", 7, "C1_M1", "kill")?.id).toBe("alphaDown");
  expect(pickPiece(WIN_PIECES, "Beta", 7, "C1_M3", "win")).toBeUndefined();
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
  expect(killOf(data(), b.start, ev, PREVIEW_SEED)).toEqual(expect.objectContaining({ name: "Alpha", count: 6, piece: expect.objectContaining({ id: "alphaDown" }) }));
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
  const j = winShowOf(data(), b.start, b.wonJoined, PREVIEW_SEED)!;
  expect(j.joined).toBe(true);
  expect(j.from).toBe("0,1");
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
  // Silent sound hooks, ready for audio files.
  for (const f of [sound.playTargetLock, sound.playOmegaBreak, sound.playKillConfirmed, sound.playTrophyLand, sound.playWinShockwave, sound.playMissionComplete]) expect(typeof f).toBe("function");
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
