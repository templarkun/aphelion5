/**
 * The styles of the opening and the menu screens, and which one is chosen (designer 2026-11-14:
 * "intro1" is the first look, saved under that name; "intro2" the capital-ship look; the player
 * switches in System options > Style and decides which is better).
 *
 * To add a style: make a folder beside these with an index.ts (a BriefStyle: intro film,
 * background, lock animation, sparks) and a style.css (its colours as the --bf-* variables under
 * :root[data-bf-style="<id>"], plus any .bf-* rule it wants different); list it in STYLES below
 * and import its style.css in main.tsx. Nothing else changes: the screens keep their layout.
 *
 * The choice is kept in this browser ("aphelion5.style") and written on <html data-bf-style>,
 * which is what the style sheets hang on.
 */

import { useSyncExternalStore } from "react";
import { readPref, writePref } from "../prefs.js";
import { intro1 } from "./intro1/index.js";
import { intro2 } from "./intro2/index.js";
import type { BriefStyle } from "./types.js";

export type { AmbientEnv, AmbientPainter, BriefStyle, IntroFilm, IntroScene, ParticleShape } from "./types.js";

export const STYLES: BriefStyle[] = [intro1, intro2];
/** The style a player gets who has never chosen: the newest. */
export const DEFAULT_STYLE = "intro2";
const KEY = "aphelion5.style";

const byId = (id: string | null) => STYLES.find((s) => s.id === id);
let cur: BriefStyle = byId(readPref(KEY)) ?? byId(DEFAULT_STYLE)!;
const subs = new Set<() => void>();

function mark(): void {
  if (typeof document !== "undefined") document.documentElement.dataset.bfStyle = cur.id;
}
mark();

/** The chosen style. */
export function briefStyle(): BriefStyle {
  return cur;
}
export function setBriefStyle(id: string): void {
  const s = byId(id);
  if (!s || s === cur) return;
  cur = s;
  writePref(KEY, s.id);
  mark();
  for (const f of subs) f();
}
function subscribe(f: () => void): () => void {
  subs.add(f);
  return () => subs.delete(f);
}
/** The chosen style, for a screen: it draws again when the player switches. */
export function useBriefStyle(): BriefStyle {
  return useSyncExternalStore(subscribe, briefStyle, briefStyle);
}
