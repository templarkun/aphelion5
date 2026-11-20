/**
 * While a mission celebration plays (designer 2026-11-20): taps anywhere are caught (nothing in the
 * game is pressed by mistake), "Tap twice to skip" at the foot, and two taps (or two presses of
 * Escape, Enter or Space) within 1 s skip it, as the intro and the outros (outro/SkipHint.tsx).
 * Around the kill the screen outside the Field darkens a little too.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SkipHint, useTwoTapSkip } from "../outro/SkipHint.js";

export function CelebrationSkip({ onSkip, dimAround }: { onSkip: () => void; dimAround?: boolean }) {
  const { tap, armed, hintOn } = useTwoTapSkip(true, onSkip);
  // The Field on the page, for the darkening round it.
  const [box, setBox] = useState<DOMRect | undefined>();
  useEffect(() => {
    if (!dimAround) return setBox(undefined);
    const read = () => setBox(document.querySelector(".field")?.getBoundingClientRect());
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [dimAround]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      {box && <div className="cb-spot" style={{ left: box.left, top: box.top, width: box.width, height: box.height }} />}
      <div
        className="cb-catch"
        data-celebration="1"
        onPointerDown={(e) => {
          e.preventDefault();
          tap();
        }}
      >
        <SkipHint armed={armed} hintOn={hintOn} />
      </div>
    </>,
    document.body,
  );
}
