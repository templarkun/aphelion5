/**
 * Style "intro1" (designer 2026-11-14, saved under this name): a bright orbital command deck.
 * Intro: the approach to a ringed planet, the brackets lock on, the dive into the menu.
 * Menu: luminous blue space, clear glass panels, round buttons, sky-blue accent, holographic
 * rings on a confirmed choice, square sparks. Its colours are in style.css beside this file.
 */

import type { BriefStyle } from "../types.js";
import { createAmbient } from "./ambient.js";
import { Lock } from "./Lock.js";
import { createScene, FULL_SECONDS, LOCK_AT, SHORT_SECONDS, TITLE_AT } from "./scene.js";

export const intro1: BriefStyle = {
  id: "intro1",
  name: "intro1",
  note: "Bright command deck: the ringed planet, blue glass, round buttons.",
  acc: "125 211 252",
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
  shape: (asked) => asked,
  tap: { count: 7, speed: 110, life: 0.45, rgb: "255 255 255", size: 1.8, shape: "spark" },
};
