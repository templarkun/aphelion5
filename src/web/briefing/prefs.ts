/**
 * What the briefing remembers in this browser: whether the long intro of each style has been
 * seen, and which style is chosen (styles/index.ts). Storage can be blocked (private windows,
 * previews): every read and write is guarded and the screen works without it.
 */

const INTRO = "aphelion5.intro";

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writePref(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}

/**
 * "aphelion5.intro": "off" = no intro at all; "seen" = the long intro of intro1 has played.
 * Every later style keeps its own mark ("aphelion5.intro.<style>" = "seen"), so the first time a
 * style is used its long intro plays once.
 */
const seenKey = (style: string) => (style === "intro1" ? INTRO : `${INTRO}.${style}`);

/** "full" = the long intro (first visit with this style), "short" = the 1.5-second one, "off" = none. */
export type IntroMode = "full" | "short" | "off";
export function introMode(style: string): IntroMode {
  if (readPref(INTRO) === "off") return "off";
  return readPref(seenKey(style)) === "seen" ? "short" : "full";
}
/** The switch in System options: off, or on again (short intros; a style never seen still plays its long one once). */
export function setIntroMode(m: IntroMode): void {
  writePref(INTRO, m === "full" ? null : m === "short" ? "seen" : "off");
}
/** After a style's long intro has played once, later visits get its short one. */
export function markIntroSeen(style: string): void {
  if (readPref(INTRO) === "off") return;
  writePref(seenKey(style), "seen");
}
