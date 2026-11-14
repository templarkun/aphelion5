/**
 * What the briefing remembers in this browser: whether the long intro has been seen. Storage can
 * be blocked (private windows, previews): every read and write is guarded and the screen works
 * without it.
 */

const INTRO = "aphelion5.intro";

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

/** "full" = the long approach (first visit), "short" = the 1.5-second fly-by, "off" = none. */
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
