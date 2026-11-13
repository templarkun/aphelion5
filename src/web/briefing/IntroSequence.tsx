/**
 * The two intros. First visit: a 10-second boot sequence (CRT power-on, security log, glitch,
 * logo). Later visits: a one-second handshake. Two taps within 2 seconds skip the long one
 * (the first tap shows the hint and a 2-second bar). Reduced motion always gets the short one.
 */

import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { isStill } from "../motion.js";
import { BOOT_LOG } from "./content.js";
import { markIntroSeen } from "./prefs.js";
import { cue } from "./sfx.js";

const LINE_MS = 430;
const LOG_START = 800;
const GLITCH_AT = LOG_START + BOOT_LOG.length * LINE_MS + 250;
const LOGO_AT = GLITCH_AT + 800;
const LONG_END = LOGO_AT + 3900; // about 10 s in all
const SHORT_END = 1250;
const SKIP_WINDOW = 2000;

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
  const long = mode === "full" && !isStill();
  const [lines, setLines] = useState(0);
  const [stage, setStage] = useState<"log" | "glitch" | "logo">("log");
  const [leaving, setLeaving] = useState(false);
  const [armed, setArmed] = useState(0); // counts first taps: each one restarts the 2-second bar
  const armedAt = useRef(0);
  const done = useRef(false);

  function finish(): void {
    if (done.current) return;
    done.current = true;
    if (mode === "full") markIntroSeen();
    setLeaving(true);
    setTimeout(onDone, isStill() ? 0 : 520);
  }

  useEffect(() => {
    const ts: ReturnType<typeof setTimeout>[] = [];
    if (!long) {
      ts.push(setTimeout(finish, SHORT_END));
      return () => ts.forEach(clearTimeout);
    }
    cue("boot");
    BOOT_LOG.forEach((l, i) =>
      ts.push(
        setTimeout(() => {
          setLines(i + 1);
          cue(l.startsWith("!") ? "glitch" : "tick");
        }, LOG_START + i * LINE_MS),
      ),
    );
    ts.push(setTimeout(() => (setStage("glitch"), cue("glitch")), GLITCH_AT));
    ts.push(setTimeout(() => (setStage("logo"), cue("lock")), LOGO_AT));
    ts.push(setTimeout(finish, LONG_END));
    return () => ts.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Two taps (or key presses) within 2 seconds skip the long intro; the short one needs no skip. */
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

  if (!long)
    return (
      <div className={`bf-intro grid place-items-center ${leaving ? "bf-leave" : ""}`} data-intro="short" role="status">
        <div className="bf-crt" />
        <div className="bf-poweron w-[min(92vw,560px)] px-4 text-center">
          <ShieldCheck className="mx-auto mb-3 text-cyan-300" size={34} strokeWidth={1.5} />
          <div className="bf-glow text-sm font-bold tracking-[0.2em] text-cyan-200 sm:text-lg">SESSION RESUMED // SYSTEM SECURE</div>
          <div className="mx-auto mt-4 h-[3px] w-full bg-cyan-900/60">
            <div className="bf-handshake h-full origin-left bg-cyan-300 shadow-[0_0_12px_rgb(34_211_238)]" />
          </div>
          <div className="mt-2 flex justify-between text-[10px] tracking-[0.2em] text-cyan-400/70">
            <span>CORP-SEC v4.2</span>
            <span>HANDSHAKE OK</span>
          </div>
        </div>
      </div>
    );

  return (
    <div className={`bf-intro ${leaving ? "bf-leave" : ""}`} data-intro="full" data-stage={stage} onPointerDown={tap} role="button" aria-label="Intro. Tap twice to skip." tabIndex={0}>
      <div className="bf-crt" />
      <div className="bf-poweron absolute inset-0">
        {stage !== "logo" && (
          <div className={`bf-glitch absolute inset-0 p-5 sm:p-10 ${stage === "glitch" ? "on" : ""}`}>
            <pre className="m-0 whitespace-pre-wrap text-[11px] leading-6 text-cyan-300/90 sm:text-sm sm:leading-7" style={{ fontFamily: "inherit" }}>
              {BOOT_LOG.slice(0, lines).map((l, i) => {
                const bad = l.startsWith("!");
                const text = bad ? l.slice(1) : l;
                return (
                  <span key={i} data-text={text} className={`block ${i === 0 ? "bf-glow mb-2 text-base font-bold tracking-[0.18em] text-cyan-100 sm:text-xl" : ""} ${bad ? "bf-glitch on text-amber-300" : ""}`}>
                    {i > 0 && <span className="text-cyan-600">&gt; </span>}
                    {text}
                  </span>
                );
              })}
              {stage === "log" && <span className="bf-blink">█</span>}
            </pre>
            {stage === "glitch" && [12, 37, 58, 81].map((top, i) => <div key={i} className="bf-tear" style={{ top: `${top}%`, height: `${4 + i * 3}%`, animationDelay: `${i * -90}ms` }} />)}
          </div>
        )}
        {stage === "logo" && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="mx-auto w-fit">
                <Logo size={150} draw />
              </div>
              <div className="bf-logo-in bf-glow mt-4 text-3xl font-extrabold tracking-[0.34em] text-cyan-100 sm:text-5xl" style={{ paddingLeft: "0.34em" }}>
                APHELION 5
              </div>
              <div className="bf-rise mt-3 text-[11px] tracking-[0.42em] text-amber-300/90 sm:text-sm" style={{ "--i": 14 } as React.CSSProperties}>
                COMMAND BRIEFING
              </div>
              <div className="bf-rise mt-6 text-[10px] tracking-[0.3em] text-cyan-500/80" style={{ "--i": 22 } as React.CSSProperties}>
                CORP-SEC PROTOCOL v4.2 // CLEARANCE GRANTED
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-5 z-[70] text-center text-[10px] tracking-[0.3em]" data-skip={hintOn ? "armed" : "idle"}>
        {hintOn ? (
          <div className="mx-auto w-56">
            <div className="text-amber-300">TAP AGAIN TO SKIP</div>
            <div className="mt-1 h-[2px] bg-amber-900/60">
              <div key={armed} className="bf-skipbar h-full bg-amber-300" />
            </div>
          </div>
        ) : (
          <div className="text-cyan-600/80">TAP TWICE TO SKIP</div>
        )}
      </div>
    </div>
  );
}
