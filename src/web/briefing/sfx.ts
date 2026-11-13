/**
 * Sound cues of the briefing: short synthesised tones (no sound files). Off until the player
 * switches sound on. Every cue also tells the visualiser bars to jump, sound or no sound.
 */

import { soundOn } from "./prefs.js";

export type Cue = "tick" | "select" | "plug" | "unplug" | "lock" | "launch" | "boot" | "glitch";

const subs = new Set<(c: Cue) => void>();
export function onCue(f: (c: Cue) => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}

let ac: AudioContext | undefined;
function ctx(): AudioContext | undefined {
  try {
    ac ??= new AudioContext();
    if (ac.state === "suspended") void ac.resume();
    return ac;
  } catch {
    return undefined;
  }
}

/** One tone: frequency glide, wave shape, length, loudness, start delay (seconds). */
function tone(a: AudioContext, f0: number, f1: number, type: OscillatorType, len: number, vol: number, at = 0): void {
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + len + 0.02);
}

const PLAY: Record<Cue, (a: AudioContext) => void> = {
  tick: (a) => tone(a, 1800, 1500, "square", 0.03, 0.025),
  select: (a) => tone(a, 660, 990, "triangle", 0.09, 0.07),
  plug: (a) => (tone(a, 220, 440, "sawtooth", 0.08, 0.05), tone(a, 880, 1320, "sine", 0.14, 0.06, 0.07)),
  unplug: (a) => tone(a, 520, 180, "sawtooth", 0.14, 0.05),
  lock: (a) => (tone(a, 300, 900, "sawtooth", 0.3, 0.05), tone(a, 1200, 1200, "sine", 0.35, 0.08, 0.32), tone(a, 1800, 1800, "sine", 0.3, 0.05, 0.4)),
  launch: (a) => (tone(a, 80, 900, "sawtooth", 1.3, 0.07), tone(a, 1320, 1760, "sine", 0.5, 0.08, 1.3)),
  boot: (a) => tone(a, 60, 240, "sine", 0.7, 0.09),
  glitch: (a) => (tone(a, 2400, 90, "square", 0.12, 0.04), tone(a, 140, 2000, "square", 0.1, 0.03, 0.12)),
};

export function cue(c: Cue): void {
  for (const f of subs) f(c);
  if (!soundOn()) return;
  const a = ctx();
  if (a) PLAY[c](a);
}
