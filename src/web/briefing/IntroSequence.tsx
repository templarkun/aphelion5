/**
 * The two intros, over the page when the game opens (designer 2026-11-14).
 * First visit: a 10-second approach from deep space to the planet (introScene.ts), the brackets
 * lock on, the mark and the name come up, and the view dives into the Campaign screen.
 * Later visits: a 1.5-second fly-by. Two taps within 1 second skip the long one (the first tap
 * shows the hint and a 1-second bar). Reduced motion: one still picture, briefly.
 */

import { useEffect, useRef, useState } from "react";
import { isStill } from "../motion.js";
import { createScene, FULL_SECONDS, LOCK_AT, SHORT_SECONDS, TITLE_AT } from "./introScene.js";
import { markIntroSeen } from "./prefs.js";
import { playEngineHum, playFlyBy, playOrbitLock, stopEngineHum } from "./soundHooks.js";

const SKIP_WINDOW = 1000;
const LEAVE_MS = 420;

/** The mark: an orbit with its far point (the aphelion) lit, and the numeral. */
export function Logo({ size = 120, draw = false }: { size?: number; draw?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="-60 -60 120 120" fill="none" stroke="rgb(var(--acc))" className={draw ? "bf-draw" : ""} aria-hidden="true">
      <ellipse rx="54" ry="22" transform="rotate(-24)" strokeWidth="1.6" pathLength={1} />
      <ellipse rx="54" ry="22" transform="rotate(24)" strokeWidth="0.6" opacity="0.5" pathLength={1} style={{ "--d": 250 } as React.CSSProperties} />
      <polygon points="0,-30 26,-15 26,15 0,30 -26,15 -26,-15" strokeWidth="2" pathLength={1} style={{ "--d": 450 } as React.CSSProperties} />
      <circle cx="-49.3" cy="21.9" r="3.4" fill="rgb(251 191 36)" stroke="none" className="bf-pulse" />
      <text y="10" textAnchor="middle" fontSize="28" fontWeight="800" fill="rgb(var(--acc))" stroke="none" fontFamily="ui-monospace, Menlo, Consolas, monospace">
        5
      </text>
    </svg>
  );
}

export function IntroSequence({ mode, onDone }: { mode: "full" | "short"; onDone: () => void }) {
  const still = isStill();
  const long = mode === "full" && !still;
  const cv = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [armed, setArmed] = useState(0); // counts first taps: each one restarts the 1-second bar
  const armedAt = useRef(0);
  const done = useRef(false);

  function finish(): void {
    if (done.current) return;
    done.current = true;
    if (mode === "full") markIntroSeen();
    stopEngineHum();
    setLeaving(true);
    setTimeout(onDone, still ? 0 : LEAVE_MS);
  }

  useEffect(() => {
    const canvas = cv.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g) return void finish();
    const scene = createScene();
    const total = long ? FULL_SECONDS : SHORT_SECONDS;
    let raf = 0;
    let start = 0;
    let locked = false;
    if (long) playEngineHum();
    else playFlyBy();
    const frame = (now: number) => {
      start ||= now;
      // Reduced motion: the locked planet, still.
      const t = still ? 8.8 : (now - start) / 1000;
      const r = canvas.getBoundingClientRect();
      const k = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width * k));
      const h = Math.max(1, Math.round(r.height * k));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      g.setTransform(k, 0, 0, k, 0, 0);
      scene.draw(g, r.width, r.height, Math.min(t, total), still ? "full" : long ? "full" : "short");
      if (long && !locked && t >= LOCK_AT) {
        locked = true;
        playOrbitLock();
      }
      if (long && t >= TITLE_AT) setTitle(true);
      if (still) return;
      if (t >= total - LEAVE_MS / 1000) finish();
      if (t < total + 0.5) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const stillEnd = still ? setTimeout(finish, 700) : undefined;
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(stillEnd);
      stopEngineHum();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Two taps (or key presses) within 1 second skip the long intro; the short one needs no skip. */
  function tap(): void {
    if (!long || done.current) return;
    const now = Date.now();
    if (now - armedAt.current <= SKIP_WINDOW) return finish();
    armedAt.current = now;
    setArmed((n) => n + 1);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => (e.key === "Escape" || e.key === "Enter" || e.key === " ") && tap();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const [, tickHint] = useState(0);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => tickHint((n) => n + 1), SKIP_WINDOW + 30);
    return () => clearTimeout(t);
  }, [armed]);
  const hintOn = armed > 0 && Date.now() - armedAt.current <= SKIP_WINDOW;

  return (
    <div
      className={`bf-intro ${leaving ? "bf-leave" : ""}`}
      data-intro={long ? "full" : "short"}
      onPointerDown={tap}
      role={long ? "button" : "status"}
      aria-label={long ? "Intro. Tap twice to skip." : "Aphelion 5"}
      tabIndex={long ? 0 : undefined}
    >
      <canvas ref={cv} className="absolute inset-0 h-full w-full" />
      {long && title && (
        <div className="bf-title-in pointer-events-none absolute inset-x-0 bottom-[12%] flex flex-col items-center px-4 text-center">
          <Logo size={84} draw />
          <div className="bf-glow mt-2 text-3xl font-extrabold tracking-[0.34em] text-white sm:text-5xl" style={{ paddingLeft: "0.34em" }}>
            APHELION 5
          </div>
          <div className="mt-2 text-[12px] font-semibold tracking-[0.4em] text-amber-200 sm:text-sm">ORBIT REACHED · COMMAND DECK OPENING</div>
        </div>
      )}
      {!long && (
        <div className="bf-title-in pointer-events-none absolute inset-x-0 bottom-[14%] flex flex-col items-center px-4 text-center" style={{ animationDuration: "0.35s" }}>
          <Logo size={64} />
          <div className="bf-glow mt-1 text-xl font-extrabold tracking-[0.3em] text-white sm:text-3xl" style={{ paddingLeft: "0.3em" }}>
            APHELION 5
          </div>
          <div className="mt-1 text-[12px] font-semibold tracking-[0.3em] text-amber-200">WELCOME BACK, COMMANDER</div>
        </div>
      )}
      {long && (
        <div className="absolute inset-x-0 bottom-4 text-center text-[11px] font-semibold tracking-[0.3em]" data-skip={hintOn ? "armed" : "idle"}>
          {hintOn ? (
            <div className="mx-auto w-56">
              <div className="text-amber-200">TAP AGAIN TO SKIP</div>
              <div className="mt-1 h-[3px] rounded bg-white/20">
                <div key={armed} className="bf-skipbar h-full rounded bg-amber-300" />
              </div>
            </div>
          ) : (
            <div className="text-sky-100/70">TAP TWICE TO SKIP</div>
          )}
        </div>
      )}
    </div>
  );
}
