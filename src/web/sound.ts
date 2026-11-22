/**
 * Sound (designer 2026-11-22, docs/audio-hooks.md): the designer's files, made small by
 * `npm run build:audio` into art/audio/ and packed into the page. Three volumes, kept in this
 * browser (Menu and System options > Sound): effects, ambient, music; 0 = off.
 *
 * `sfx("hit")` plays art/audio/sfx-hit.mp3, or one of its versions (sfx-hit-2.mp3 ...) at random,
 * never the same one twice in a row when there are several. A name with no file plays nothing, so
 * a hook can be placed before its file arrives. Phones only allow sound after a tap: the player is
 * made and the files unpacked on the first tap or key (`unlock`). Nothing plays while the page is
 * hidden. Ambient and music: their volumes are kept; no files uploaded yet.
 */

export type Bus = "sfx" | "ambient" | "music";
export interface Volumes {
  sfx: number;
  ambient: number;
  music: number;
}

const KEY = "aphelion5.sound";
const DEFAULTS: Volumes = { sfx: 0.8, ambient: 0.6, music: 0.6 };
export const BUSES: { id: Bus; label: string }[] = [
  { id: "sfx", label: "Sound effects" },
  { id: "ambient", label: "Ambient sound" },
  { id: "music", label: "Music" },
];

/** The packed files by name ("sfx-hit-2"), as data URLs. */
const files: Record<string, string> = (() => {
  try {
    const g = import.meta.glob("../../art/audio/*.mp3", { eager: true, query: "?inline", import: "default" }) as Record<string, string>;
    return Object.fromEntries(Object.entries(g).map(([path, url]) => [path.replace(/^.*\//, "").replace(/\.mp3$/, ""), url]));
  } catch {
    return {};
  }
})();

/** Each sound's versions: "sfx-hit" -> ["sfx-hit", "sfx-hit-2", ...]. */
export const SOUNDS: Record<string, string[]> = {};
for (const n of Object.keys(files).sort()) {
  const base = n.replace(/-\d+$/, "");
  (SOUNDS[base] ??= []).push(n);
}

let vol: Volumes = load();
const subs = new Set<() => void>();

function load(): Volumes {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Volumes> | null;
    const ok = (x: unknown, d: number) => (typeof x === "number" && x >= 0 && x <= 1 ? x : d);
    return { sfx: ok(v?.sfx, DEFAULTS.sfx), ambient: ok(v?.ambient, DEFAULTS.ambient), music: ok(v?.music, DEFAULTS.music) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function volumes(): Volumes {
  return vol;
}
export function onVolumes(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}
export function setVolume(bus: Bus, v: number): void {
  vol = { ...vol, [bus]: Math.max(0, Math.min(1, v)) };
  try {
    localStorage.setItem(KEY, JSON.stringify(vol));
  } catch {
    /* kept for this visit only */
  }
  applyGains();
  for (const f of subs) f();
}

// ---- The player (Web Audio) ----

let ctx: AudioContext | undefined;
const gains: Partial<Record<Bus, GainNode>> = {};
const buffers = new Map<string, Promise<AudioBuffer | undefined>>();
const last = new Map<string, string>();
const lastAt = new Map<string, number>();
let decoded = 0;

/** Loudness from the slider: squared, so the slider's middle sounds like half. */
const level = (v: number) => v * v;

function applyGains(): void {
  if (!ctx) return;
  for (const b of BUSES) gains[b.id]?.gain.setTargetAtTime(level(vol[b.id]), ctx.currentTime, 0.02);
}

function bytesOf(dataUrl: string): ArrayBuffer {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const s = atob(b64);
  const a = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
  return a.buffer;
}

function buffer(name: string): Promise<AudioBuffer | undefined> {
  let p = buffers.get(name);
  if (!p) {
    const url = files[name];
    p = ctx && url
      ? ctx
          .decodeAudioData(bytesOf(url))
          .then((b) => (decoded++, b))
          .catch(() => undefined)
      : Promise.resolve(undefined);
    buffers.set(name, p);
  }
  return p;
}

/** Makes the player on the first tap or key (phones allow sound only then) and unpacks the files. */
export function unlock(): void {
  if (typeof window === "undefined") return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  if (!ctx) {
    try {
      ctx = new Ctor();
    } catch {
      return;
    }
    for (const b of BUSES) {
      const g = ctx.createGain();
      g.gain.value = level(vol[b.id]);
      g.connect(ctx.destination);
      gains[b.id] = g;
    }
    // Unpack every file now, a few at a time, so the first play of each is instant.
    const names = Object.keys(files);
    const next = () => {
      const n = names.shift();
      if (n) void buffer(n).then(next);
    };
    for (let i = 0; i < 4; i++) next();
  }
  if (ctx.state === "suspended" && !document.hidden) void ctx.resume();
}

if (typeof window !== "undefined") {
  for (const ev of ["pointerdown", "keydown", "touchend"]) window.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
}

/** How many of one sound may start at once (an Order hitting every unit: a few, not twenty). */
const MAX_TOGETHER = 3;
const together = new Map<string, number>();

/**
 * Plays one sound effect. `delay` in seconds from now; `volume` 0..1 on top of the slider.
 * The same sound again within 40 ms counts as the same moment (up to MAX_TOGETHER, a little quieter each).
 */
export function sfx(name: string, opts: { delay?: number; volume?: number } = {}): void {
  play("sfx", name, opts);
}

/** The last sounds asked for (the browser check reads it as `window.__soundLog`). */
const log: string[] = [];

function play(bus: Bus, name: string, opts: { delay?: number; volume?: number } = {}): void {
  log.push(name);
  if (log.length > 80) log.shift();
  const versions = SOUNDS[`${bus === "sfx" ? "sfx" : bus}-${name}`];
  if (!ctx || !versions || vol[bus] <= 0 || document.hidden) return;
  const now = performance.now();
  const key = name;
  const near = now - (lastAt.get(key) ?? -1e9) < 40;
  const n = near ? (together.get(key) ?? 0) + 1 : 0;
  if (n >= MAX_TOGETHER) return;
  together.set(key, n);
  lastAt.set(key, now);
  const pool = versions.length > 1 ? versions.filter((v) => v !== last.get(key)) : versions;
  const pick = pool[Math.floor(Math.random() * pool.length)]!;
  last.set(key, pick);
  const c = ctx;
  const when = c.currentTime + Math.max(0, opts.delay ?? 0);
  void buffer(pick).then((b) => {
    if (!b || !gains[bus]) return;
    const src = c.createBufferSource();
    src.buffer = b;
    const g = c.createGain();
    g.gain.value = (opts.volume ?? 1) * (n ? 0.7 : 1);
    src.connect(g).connect(gains[bus]!);
    src.start(Math.max(when, c.currentTime));
  });
}

/** Test hooks: the sounds the page knows, and the last ones asked for (the browser check reads them). */
if (typeof window !== "undefined") Object.assign(window, { __sounds: () => Object.keys(SOUNDS), __soundLog: log, __soundDecoded: () => decoded, __soundFiles: () => Object.keys(files).length });
