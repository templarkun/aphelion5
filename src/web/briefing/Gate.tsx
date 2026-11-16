/**
 * The logo gate (designer 2026-11-16, "return the old transition"): the move from one setup screen to
 * the next. Two blast doors slam shut over the screen, the game's mark builds on the join (the
 * hexagon draws itself, its orbits spin, outer rings fly in and lock, brackets snap), a shock
 * wave and sparks go out, the word comes up; behind the closed doors the next screen is put in
 * place; then the mark flies at the viewer and the doors open on the new screen.
 *
 * It lives outside the screens (GateHost, mounted once by the App), so it can close over one screen
 * and open on another (the briefing over the game, one Mission Preparation over the next).
 * Every style uses it; the style gives its colours (accent, doors). Screen only, no rule.
 */

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ms } from "./hud.js";
import { playTransition } from "./soundHooks.js";
import { briefStyle } from "./styles/index.js";

/** The whole gate at Normal speed, ms. The doors are shut from 22% to 70%; the screen swaps at MID. */
export const GATE_MS = 2200;
const MID = 0.48;

interface Run {
  id: number;
  title: string;
  sub: string;
  acc: string;
  total: number;
  /** performance.now() when it ends. */
  end: number;
}
let cur: Run | undefined;
let next = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

/** Is a gate on screen (taps wait for it)? */
export function gateBusy(): boolean {
  return !!cur;
}

/** How long until the gate on screen has opened again, ms (0: none). */
export function gateLeft(): number {
  return cur ? Math.max(0, cur.end - performance.now()) : 0;
}

/**
 * Close the gate, call `onMid` behind the closed doors (put the next screen in place there), open
 * again, then `onEnd`. With reduced motion or Instant speed: both at once, no gate.
 */
export function runGate(o: { title: string; sub?: string; acc?: string; onMid: () => void; onEnd?: () => void }): void {
  const total = ms(GATE_MS);
  if (total <= 0) {
    o.onMid();
    o.onEnd?.();
    return;
  }
  playTransition();
  const run: Run = {
    id: next++,
    title: o.title,
    sub: o.sub ?? "",
    acc: o.acc ?? briefStyle().acc,
    total,
    end: performance.now() + total,
  };
  cur = run;
  emit();
  setTimeout(o.onMid, total * MID);
  setTimeout(() => {
    if (cur === run) cur = undefined;
    emit();
    o.onEnd?.();
  }, total);
}

const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f));
const read = () => cur;

/** Mounted once, at the top of the App: draws the gate whenever one runs. */
export function GateHost() {
  const g = useSyncExternalStore(subscribe, read, read);
  if (!g || typeof document === "undefined") return null;
  return createPortal(<Gate key={g.id} run={g} />, document.body);
}

/** Rays and sparks at fixed angles, so every gate looks the same. */
const RAYS = Array.from({ length: 14 }, (_, i) => (i * 360) / 14 + (i % 2 ? 7 : -4));
const SPARKS = Array.from({ length: 28 }, (_, i) => ({
  a: (i * 137.5) % 360,
  d: 26 + ((i * 53) % 34),
  s: 2 + (i % 3),
}));
const HEX = "0,-30 26,-15 26,15 0,30 -26,15 -26,-15";

function Gate({ run }: { run: Run }) {
  return (
    <div className="gate" data-gate={run.id} role="status" aria-live="polite" style={{ "--gt": `${run.total}ms`, "--acc": run.acc } as React.CSSProperties}>
      <div className="gt-shake">
        <div className="gt-door top">
          <i className="gt-lip" />
        </div>
        <div className="gt-door bot">
          <i className="gt-lip" />
        </div>
        <div className="gt-seam" />
        <div className="gt-wave" />
        <div className="gt-wave w2" />
        <div className="gt-rays">
          {RAYS.map((a, i) => (
            <i
              key={i}
              style={
                {
                  "--a": `${a}deg`,
                  "--l": `${34 + ((i * 29) % 30)}vmax`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className="gt-sparks">
          {SPARKS.map((p, i) => (
            <i
              key={i}
              style={
                {
                  "--a": `${p.a}deg`,
                  "--d": `${p.d}vmin`,
                  "--s": `${p.s}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className="gt-core">
          <svg viewBox="-100 -100 200 200" fill="none" stroke="rgb(var(--acc))" aria-hidden="true">
            <g className="gt-r1">
              <g className="gt-spin slow">
                <circle r="90" strokeWidth="1" strokeDasharray="34 9" />
                <circle r="96" strokeWidth="2.6" strokeDasharray="3 21" opacity="0.8" />
              </g>
            </g>
            <g className="gt-r2">
              <g className="gt-spin rev">
                <circle r="70" strokeWidth="1.6" strokeDasharray="70 14 6 14" />
                <path d="M-70 0h-11M70 0h11M0 -70v-11M0 70v11" strokeWidth="2.2" />
              </g>
            </g>
            <g className="gt-br" strokeWidth="3" strokeLinecap="square" stroke="#fff">
              <path d="M-56 -38v-18h18M56 -38v-18h-18M-56 38v18h18M56 38v18h-18" />
            </g>
            <g className="gt-orbits">
              <g className="gt-spin orbit">
                <g transform="rotate(-24)">
                  <ellipse rx="56" ry="22" strokeWidth="1.8" />
                  <circle className="gt-dot" cx="-56" cy="0" r="3.8" fill="rgb(251 191 36)" stroke="none" />
                </g>
              </g>
              <g className="gt-spin orbit rev">
                <ellipse rx="56" ry="22" transform="rotate(24)" strokeWidth="0.8" opacity="0.6" />
              </g>
            </g>
            <polygon className="gt-hex" points={HEX} strokeWidth="2.6" pathLength={1} fill="rgb(var(--acc) / 0.12)" />
            <text className="gt-five" y="10" textAnchor="middle" fontSize="28" fontWeight="800" fill="#fff" stroke="none">
              5
            </text>
          </svg>
          <div className="gt-word">
            <div className="t">{run.title}</div>
            {run.sub && <div className="s">{run.sub}</div>}
          </div>
        </div>
        <div className="gt-flash" />
      </div>
    </div>
  );
}
