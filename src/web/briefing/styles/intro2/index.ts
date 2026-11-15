/**
 * Style "intro2" (designer 2026-11-14): the capital ship.
 * Intro: the Company's ship seen from behind and above its starboard quarter, its drives
 * lighting, the huge curved horizon of the planet at sunrise beyond it; the lock closes on the
 * point of insertion and the ship burns away.
 * Menu: deep space after the same picture: the planet's lit edge along the foot of the screen,
 * exhaust dust drifting back across it, dark glass plates with cut corners, ion-cyan accent,
 * armour doors closing on a confirmed choice, sparks as slivers and plasma.
 * Its colours and shapes are in style.css beside this file.
 */

import type { BriefStyle } from "../types.js";
import { createAmbient } from "./ambient.js";
import { Lock } from "./Lock.js";
import { createScene, FULL_SECONDS, LOCK_AT, SHORT_SECONDS, TITLE_AT } from "./scene.js";

export const intro2: BriefStyle = {
  id: "intro2",
  name: "intro2",
  note: "Capital ship: the sunrise horizon, dark glass plates, cut corners.",
  acc: "110 231 255",
  intro: {
    fullSeconds: FULL_SECONDS,
    shortSeconds: SHORT_SECONDS,
    lockAt: LOCK_AT,
    titleAt: TITLE_AT,
    stillAt: 8.8,
    create: createScene,
    lines: { full: "ORBIT REACHED · COMMAND DECK OPENING", short: "WELCOME BACK, COMMANDER" },
  },
  ambient: createAmbient,
  Lock,
  // Squares become slivers of light, soft motes become plasma that swells as it cools.
  shape: (asked) => (asked === "spark" ? "shard" : asked === "mote" ? "plasma" : asked),
  tap: { count: 6, speed: 150, life: 0.4, rgb: "190 244 255", size: 2.2, shape: "shard" },
};
