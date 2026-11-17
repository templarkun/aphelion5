/**
 * Skipping an outro's film the way the long intro is skipped (designer 2026-11-17): two taps
 * anywhere (or two presses of Escape, Enter or Space) within 1 second. The foot of the screen
 * says "Tap twice to skip"; after the first tap it says "Tap again to skip" over a bar that
 * runs out in that second. Screen only.
 */

import { useEffect, useRef, useState } from "react";

/** Two taps within this many ms skip (as the intro, `IntroSequence.tsx`). */
const SKIP_WINDOW = 1000;

/** `tap` goes on the outro's pointer-down; `armed` counts first taps (0 none yet); `hintOn` while a second tap would skip. */
export function useTwoTapSkip(on: boolean, skip: () => void): { tap: () => void; armed: number; hintOn: boolean } {
  const armedAt = useRef(-Infinity);
  const [armed, setArmed] = useState(0);
  const [, tick] = useState(0);
  function tap(): void {
    if (!on) return;
    const now = Date.now();
    if (now - armedAt.current <= SKIP_WINDOW) {
      armedAt.current = -Infinity;
      return skip();
    }
    armedAt.current = now;
    setArmed((n) => n + 1);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" || ((e.key === "Enter" || e.key === " ") && document.activeElement?.tagName !== "BUTTON")) tap();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  // Back to "Tap twice" once the second is over.
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => tick((n) => n + 1), SKIP_WINDOW + 30);
    return () => clearTimeout(t);
  }, [armed]);
  return { tap, armed, hintOn: armed > 0 && Date.now() - armedAt.current <= SKIP_WINDOW };
}

/** The words at the foot of the film. */
export function SkipHint({ armed, hintOn }: { armed: number; hintOn: boolean }) {
  return (
    <div className="ou-skip" data-action="outro-skip" data-skip={hintOn ? "armed" : "idle"} aria-hidden="true">
      {hintOn ? (
        <>
          <span className="ou-skip-again">Tap again to skip</span>
          <span className="ou-skip-track">
            <span key={armed} className="ou-skip-bar" />
          </span>
        </>
      ) : (
        <span>Tap twice to skip</span>
      )}
    </div>
  );
}
