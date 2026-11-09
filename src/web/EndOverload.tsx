/**
 * End the Overload (9.2), designer 2026-11-09: a button in proportion with the Field, with embers
 * rising from it; pressed, it bursts into sparks and a shock ring, then the Overload ends.
 */

import { useState } from "react";

const EMBERS = 14;
const SPARKS = 26;

export function EndOverload(p: { onEnd: () => void }) {
  const [burst, setBurst] = useState(false);
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <button
      className={`end-overload ${burst ? "bursting" : ""}`}
      title="No Alert tokens remain (9.2)"
      disabled={burst}
      onClick={() => {
        if (still) return p.onEnd();
        setBurst(true);
        window.setTimeout(p.onEnd, 380);
      }}
    >
      <span className="eo-embers" aria-hidden="true">
        {Array.from({ length: EMBERS }, (_, i) => (
          <i key={i} style={{ "--x": `${(i * 37) % 100}%`, "--d": `${(i * 0.29) % 2.2}s`, "--s": `${1.6 + ((i * 13) % 10) / 10}s` } as React.CSSProperties} />
        ))}
      </span>
      <span className="eo-label">End the Overload</span>
      {burst && (
        <span className="eo-burst" aria-hidden="true">
          <b className="ring" />
          {Array.from({ length: SPARKS }, (_, i) => {
            const a = (i / SPARKS) * Math.PI * 2;
            const d = 60 + ((i * 29) % 50);
            return <i key={i} style={{ "--tx": `${Math.cos(a) * d}px`, "--ty": `${Math.sin(a) * d * 0.7}px` } as React.CSSProperties} />;
          })}
        </span>
      )}
    </button>
  );
}
