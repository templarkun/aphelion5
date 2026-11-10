/**
 * End the Overload (9.2), designer 2026-11-09 / 2026-11-10: a round, see-through button like a
 * small sun, with energy tongues glowing out of its rim; pressed, it bursts into sparks and a
 * shock ring, then the Overload ends.
 */

import { useState } from "react";
import { noFlying } from "./motion.js";

const TONGUES = 14;
const SPARKS = 26;

export function EndOverload(p: { onEnd: () => void }) {
  const [burst, setBurst] = useState(false);
  const still = noFlying();
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
      <span className="eo-tongues" aria-hidden="true">
        {Array.from({ length: TONGUES }, (_, i) => (
          <i key={i} style={{ "--a": `${(360 / TONGUES) * i + ((i * 7) % 11)}deg`, "--d": `${-((i * 0.37) % 2.4)}s`, "--s": `${1.7 + ((i * 13) % 10) / 9}s`, "--h": `${0.75 + ((i * 5) % 7) / 12}` } as React.CSSProperties} />
        ))}
      </span>
      <span className="eo-core" aria-hidden="true" />
      <span className="eo-label">
        End the
        <br />
        Overload
      </span>
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
