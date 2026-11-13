/** Small shared pieces of the briefing's HUD: visualiser, lock animation, pips, section heads. */

import { useEffect, useState, type ReactNode } from "react";
import { isStill, speedFactor } from "../motion.js";
import { type Cue, onCue } from "./sfx.js";

/** Animation length in ms at the player's speed setting; 0 with reduced motion or Instant. */
export function ms(n: number): number {
  const f = speedFactor();
  return isStill() || f === 0 ? 0 : n / f;
}

const BAR_HEIGHTS = [0.5, 0.9, 0.35, 0.7, 1, 0.45, 0.8, 0.3, 0.65, 0.95, 0.4, 0.75];

/** Sound-cue visualiser: bars idle low and jump for a moment at every cue (with or without sound). */
export function Visualizer({ bars = 12 }: { bars?: number }) {
  const [hot, setHot] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = onCue((c: Cue) => {
      setHot(true);
      clearTimeout(t);
      t = setTimeout(() => setHot(false), c === "launch" ? 1600 : c === "lock" ? 800 : 320);
    });
    return () => (off(), clearTimeout(t));
  }, []);
  return (
    <span className={`bf-viz ${hot ? "bf-hot" : ""}`} aria-hidden="true">
      {BAR_HEIGHTS.slice(0, bars).map((h, i) => (
        <i key={i} style={{ "--i": i, "--h": hot ? Math.min(1, h + 0.25) : h * 0.45 } as React.CSSProperties} />
      ))}
    </span>
  );
}

/** The holographic lock: rings close on the centre, brackets snap, the word lands, one flash. */
export function LockOverlay({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="bf-lock" role="status" aria-live="polite">
      <svg viewBox="-100 -100 200 200" fill="none" stroke="rgb(var(--acc))">
        <g className="r1">
          <circle r="86" strokeWidth="0.8" strokeDasharray="34 9" />
          <circle r="92" strokeWidth="2.4" strokeDasharray="3 21" opacity="0.7" />
        </g>
        <g className="r2">
          <circle r="64" strokeWidth="1.4" strokeDasharray="70 14 6 14" />
          <path d="M-64 0h-10M64 0h10M0 -64v-10M0 64v10" strokeWidth="2" />
        </g>
        <g className="br" strokeWidth="2.6" strokeLinecap="square">
          <path d="M-52 -34v-18h18M52 -34v-18h-18M-52 34v18h18M52 34v18h-18" />
          <polygon points="0,-40 34.6,-20 34.6,20 0,40 -34.6,20 -34.6,-20" strokeWidth="1" fill="rgb(var(--acc) / 0.1)" />
        </g>
        <g className="tx" stroke="none" fill="rgb(var(--acc))" textAnchor="middle" fontFamily="ui-monospace, Menlo, Consolas, monospace">
          <rect x="-84" y="-15" width="168" height="34" fill="rgb(4 7 10 / 0.88)" stroke="rgb(var(--acc))" strokeWidth="0.6" />
          <text y="-1" fontSize="11" fontWeight="700" letterSpacing="2.5">
            {title}
          </text>
          <text y="11" fontSize="5.5" letterSpacing="1.2" opacity="0.85">
            {sub}
          </text>
        </g>
      </svg>
      <div className="fl" />
    </div>
  );
}

/** Rating pips (difficulty, Threat). */
export function Pips({ n, of = 5, label }: { n: number; of?: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`${label}: ${n} of ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={`block h-2 w-3 -skew-x-12 ${i < n ? "bg-acc shadow-[0_0_6px_rgb(var(--acc)/0.8)]" : "bg-slate-600/50"}`} />
      ))}
    </span>
  );
}

/** Heading of a step: small code line, big title, one line of help. */
export function StepHead({ code, title, help, right }: { code: string; title: string; help: string; right?: ReactNode }) {
  return (
    <header className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <div className="bf-label">{code}</div>
        <h2 className="bf-glow font-hud text-xl font-bold uppercase tracking-[0.12em] text-acc sm:text-2xl">{title}</h2>
        <p className="mt-0.5 max-w-2xl text-[13px] text-slate-300/90">{help}</p>
      </div>
      {right}
    </header>
  );
}

/** A label with its value, for spec readouts. */
export function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-l-2 border-acc/50 pl-2">
      <div className="bf-label">{label}</div>
      <div className="font-hud text-sm text-slate-100">{children}</div>
    </div>
  );
}
