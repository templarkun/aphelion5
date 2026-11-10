/**
 * Animation settings (build step 5, spec "Timing"): speed and reduced motion, in the Menu.
 * Saved in this browser (motion.ts).
 */

import { useEffect, useState } from "react";
import { REDUCED, SPEEDS, motion, onMotion, setMotion } from "./motion.js";

export function MotionSettings() {
  const [m, setM] = useState(motion());
  useEffect(() => onMotion(() => setM(motion())), []);
  return (
    <div className="motion-set" onClick={(e) => e.stopPropagation()}>
      <span className="ms-title">Animation speed</span>
      <div className="ms-row" role="group" aria-label="Animation speed">
        {SPEEDS.map((x) => (
          <button key={x.id} aria-pressed={m.speed === x.id} data-speed={x.id} onClick={() => setMotion({ speed: x.id })}>
            {x.label}
          </button>
        ))}
      </div>
      <span className="ms-title">Reduced motion (short fades instead of shakes, flashes and flying pieces)</span>
      <div className="ms-row" role="group" aria-label="Reduced motion">
        {REDUCED.map((x) => (
          <button key={x.id} aria-pressed={m.reduced === x.id} data-reduced={x.id} onClick={() => setMotion({ reduced: x.id })}>
            {x.label}
          </button>
        ))}
      </div>
    </div>
  );
}
