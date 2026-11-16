/** Small shared pieces of the briefing: lock animation, pips, section heads, readouts. */

import type { ReactNode } from "react";
import { isStill, speedFactor } from "../motion.js";
import { burst } from "./particles.js";
import { playHover } from "./soundHooks.js";
import { briefStyle } from "./styles/index.js";

/** Animation length in ms at the player's speed setting; 0 with reduced motion or Instant. */
export function ms(n: number): number {
  const f = speedFactor();
  return isStill() || f === 0 ? 0 : n / f;
}

/** Rating pips (difficulty). */
export function Pips({ n, of = 5, label }: { n: number; of?: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`${label}: ${n} of ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className={`block h-2.5 w-4 rounded-sm ${i < n ? "bg-acc shadow-[0_0_8px_rgb(var(--acc)/0.9)]" : "bg-white/20"}`} />
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
        <h2 className="bf-glow text-2xl font-extrabold uppercase tracking-[0.08em] text-white sm:text-3xl">{title}</h2>
        <p className="mt-0.5 max-w-2xl text-[15px] text-sky-100">{help}</p>
      </div>
      {right}
    </header>
  );
}

/** A label with its value, for spec readouts. */
export function Readout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-white/10 px-3 py-2">
      <div className="bf-label">{label}</div>
      <div className="text-[15px] font-semibold text-white">{children}</div>
    </div>
  );
}

/** The pointer came onto a button: the hover sound hook, once per button. */
export function hoverHook(e: React.PointerEvent): void {
  const b = (e.target as Element).closest?.("button");
  if (b && !b.contains(e.relatedTarget as Node | null)) playHover();
}

/** A press on any button: a few sparks under the finger. */
export function tapSpark(e: React.PointerEvent): void {
  if ((e.target as Element).closest?.("button:not(:disabled)")) burst(e.clientX, e.clientY, briefStyle().tap);
}
