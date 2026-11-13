/**
 * What the briefing remembers in this browser: whether the long intro has been seen, the sound
 * switch, and the Threat plan of the game in progress. Storage can be blocked (private windows,
 * previews): every read and write is guarded and the screen works without it.
 */

import type { ThreatPlan } from "./types.js";

const INTRO = "aphelion5.intro";
const SOUND = "aphelion5.sound";
const PLAN = "aphelion5.threatPlan";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

/** "full" = the long boot sequence (first visit), "short" = the one-second handshake, "off" = none. */
export type IntroMode = "full" | "short" | "off";
export function introMode(): IntroMode {
  const v = read(INTRO);
  return v === "off" ? "off" : v === "seen" ? "short" : "full";
}
export function setIntroMode(m: IntroMode): void {
  write(INTRO, m === "full" ? null : m === "short" ? "seen" : "off");
}
/** After the long intro has played once, later visits get the short one. */
export function markIntroSeen(): void {
  if (introMode() === "full") write(INTRO, "seen");
}

export function soundOn(): boolean {
  return read(SOUND) === "on";
}
export function setSoundOn(on: boolean): void {
  write(SOUND, on ? "on" : null);
}

/** The Threat plan belongs to one game (its seed and date), so an old plan never leaks into a new game. */
export function savePlan(seed: number, date: string, plan: ThreatPlan): void {
  write(PLAN, JSON.stringify({ seed, date, plan }));
}
export function loadPlan(seed: number, date: string): ThreatPlan | undefined {
  try {
    const v = JSON.parse(read(PLAN) ?? "null") as { seed: number; date: string; plan: ThreatPlan } | null;
    return v && v.seed === seed && v.date === date ? v.plan : undefined;
  } catch {
    return undefined;
  }
}
