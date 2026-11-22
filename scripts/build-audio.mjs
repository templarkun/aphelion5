// Makes the game's sound files from the designer's uploads (designer 2026-11-22, docs/audio-hooks.md).
// `npm run build:audio` reads art/sfx-*.mp3 (and later art/ambient-*.mp3, art/music-*.mp3), and
// writes small copies to art/audio/: one channel, 44.1 kHz, silence cut from both ends, a short fade
// at the end; 96 kbps for effects, 128 kbps for ambient and music. The game packs art/audio/ into
// the one HTML file, so smaller files open faster on a phone. Needs ffmpeg (on the build machine).
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";

const SRC = "art";
const OUT = "art/audio";
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith(".mp3")) rmSync(`${OUT}/${f}`);
const files = readdirSync(SRC).filter((f) => /^(sfx|ambient|music)-[a-z0-9-]+\.(mp3|wav|ogg|m4a)$/.test(f));
let bytes = 0;
for (const f of files) {
  const name = f.replace(/\.[a-z0-9]+$/, "");
  const sfx = name.startsWith("sfx-");
  // Effects: cut silence at the start (so they line up with their animation) and at the end.
  const trim = "silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.005";
  const filters = sfx ? [trim, "areverse", trim, "areverse"] : [];
  const out = `${OUT}/${name}.mp3`;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", `${SRC}/${f}`, ...(filters.length ? ["-af", filters.join(",")] : []), "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", sfx ? "96k" : "128k", "-map_metadata", "-1", "-id3v2_version", "0", out]);
  bytes += readdirSync(OUT).includes(`${name}.mp3`) ? Number(execFileSync("stat", ["-c", "%s", out]).toString()) : 0;
}
console.log(`${files.length} sounds -> ${OUT} (${(bytes / 1024).toFixed(0)} kB)`);
