/**
 * The big PC screen (designer 2026-11-20): a window 1600 px wide or wider. Phones and iPads (an iPad Pro
 * sideways is about 1370 px) keep the sizes they had. The setup screens are drawn 1.35 times bigger there
 * (`BRIEF_ZOOM`, CSS `zoom` in briefing.css), the game's text and panels a little bigger (styles.css).
 */

import { useEffect, useState } from "react";

export const WIDE_PX = 1600;
export const WIDE_QUERY = `(min-width: ${WIDE_PX}px)`;
/** How much bigger the setup screens are drawn on the big PC screen. */
export const BRIEF_ZOOM = 1.35;

export const isWide = (): boolean => typeof window !== "undefined" && !!window.matchMedia?.(WIDE_QUERY).matches;

/** True while the window is a big PC screen; follows resizing. */
export function useWide(): boolean {
  const [wide, setWide] = useState(isWide);
  useEffect(() => {
    const m = window.matchMedia?.(WIDE_QUERY);
    if (!m) return;
    const f = () => setWide(m.matches);
    f();
    m.addEventListener?.("change", f);
    return () => m.removeEventListener?.("change", f);
  }, []);
  return wide;
}
