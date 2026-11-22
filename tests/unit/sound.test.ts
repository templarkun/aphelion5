// Sound (designer 2026-11-22, docs/audio-hooks.md): the uploaded files reach the game.
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SOUNDS, setVolume, volumes } from "../../src/web/sound.js";

const FIRST_20 = ["tap", "back", "popup", "move", "mecha-land", "reveal", "reveal-omega", "laser", "hit", "shield-block", "destroyed", "mecha-attack", "flagship-hit", "energy", "shield-up", "overload-start", "end-button", "overload-end", "ally-drop", "mission-complete"];

describe("sound", () => {
  it("every uploaded file has its small copy in art/audio (npm run build:audio)", () => {
    const up = readdirSync("art").filter((f) => /^(sfx|ambient|music)-.*\.(mp3|wav|ogg|m4a)$/.test(f)).map((f) => f.replace(/\.[a-z0-9]+$/, ""));
    const made = readdirSync("art/audio").filter((f) => f.endsWith(".mp3")).map((f) => f.replace(/\.mp3$/, ""));
    expect(made.sort()).toEqual(up.sort());
  });
  it("groups versions under one name and knows the first batch", () => {
    expect(SOUNDS["sfx-hit"]).toEqual(["sfx-hit", "sfx-hit-2", "sfx-hit-3", "sfx-hit-4"]);
    const missing = FIRST_20.filter((n) => !SOUNDS[`sfx-${n}`]);
    expect(missing).toEqual(["energy"]); // not uploaded yet: asked again in batch 2
  });
  it("keeps volumes between 0 and 1", () => {
    setVolume("music", 2);
    expect(volumes().music).toBe(1);
    setVolume("sfx", -1);
    expect(volumes().sfx).toBe(0);
  });
});
