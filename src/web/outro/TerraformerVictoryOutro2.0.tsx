/**
 * Terraformer 2.0 (designer 2026-11-17): a copy of the Terraformer outro (TerraformerVictoryOutro.tsx,
 * kept as it was, "1.0") with a new film: industrial terraforming, not a bombardment. Shown at
 * Game End (Core Rules 10.3) when the last mission is won. Screen only, no rule.
 *
 * A film of about 15 seconds on one canvas (terraformer2/scene.ts) in four acts: the bay doors
 * open, the pylons (one for every mission won) are lowered out, drift free while they turn
 * upright and light their braking thrusters; they come down slowly over the storm; one by one
 * they anchor and fire their beams, and the toxic clouds clear in rings over ocean and green
 * land; the camera pulls back as the sun rises. Over it, small captions, "Tap twice to skip" at the foot, and at
 * the end the Campaign Debrief card (Debrief.tsx, shared with 1.0), at the side (from below on a
 * phone), leaving the cleared sector in view.
 *
 * The animation speed setting stretches or shortens the film; with reduced motion or the
 * Instant speed there is no film: one still picture of its end, and the Debrief at once.
 * Silent: the sound hooks (briefing/soundHooks.ts) are called at the right moments.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { isStill, speedFactor } from "../motion.js";
import { playBayDoorsOpen, playConfirm, playHover, playReentryStreak, playRetroThrust, playTerraformShockwave, playVictoryResolve } from "../briefing/soundHooks.js";
import { createTerraformer2Scene, type FreeArea } from "./terraformer2/scene.js";
import { ACT_NAMES, actAt, anchorsBy, anchorTimes, BEAM_DELAY, DEBRIEF_AT, DOORS_AT, ENTRY_AT, FILM_SECONDS, ignitionTimes, pylonCount, RESOLVE_AT, STILL_AT } from "./terraformer2/timeline.js";
import { SkipHint, useTwoTapSkip } from "./SkipHint.js";
import { Debrief } from "./Debrief.js";
import type { OutroProps } from "./types.js";

export type TerraformerVictoryOutro2Props = OutroProps;

/** The canvas is never drawn with more points than this (a 4K screen is drawn a little softer, and stays smooth). */
const MAX_PIXELS = 3.2e6;
/** On a slow machine the picture is drawn with fewer points, down to this share of its width and height. */
const MIN_QUALITY = 0.45;
/** Time a frame may spend making the planet's pictures during the first act, ms. */
const PREPARE_BUDGET = 3;
/** How long the white veil of a skip lasts, ms. */
const SKIP_VEIL = 420;

interface Cue {
  at: number;
  /** Still played when the film is skipped (the last chord). */
  keep?: boolean;
  play: () => void;
}

export function TerraformerVictoryOutro2({ companyTheme, vesselId, campaignStats, onComplete }: TerraformerVictoryOutro2Props): ReactElement {
  const stats = campaignStats;
  const n = pylonCount(stats.missions.length);
  // The speed and motion settings as they were when the outro began.
  const still = useRef(isStill() || speedFactor() === 0).current;
  const speed = useRef(speedFactor() || 1).current;
  const [phase, setPhase] = useState<"film" | "debrief">(still ? "debrief" : "film");
  const [act, setAct] = useState<1 | 2 | 3 | 4>(still ? 4 : 1);
  const [hits, setHits] = useState(still ? n : 0);
  // The acts shown so far, in order ("1234" once the film has run through): for the browser check.
  const [acts, setActs] = useState("");
  const [veil, setVeil] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const card = useRef<HTMLElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const clock = useRef({ start: 0, jump: 0, skipped: false });
  const left = useRef(false);
  const scene = useMemo(() => createTerraformer2Scene({ theme: companyTheme, vesselId, tags: stats.missions.map((m) => m.tag) }), [companyTheme, vesselId, stats.missions]);

  useEffect(() => {
    const cv = canvas.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return void setPhase("debrief");
    const cues: Cue[] = [
      { at: DOORS_AT, play: playBayDoorsOpen },
      ...ignitionTimes(n).map((at, i): Cue => ({ at, play: () => playRetroThrust(i, n) })),
      { at: ENTRY_AT, play: playReentryStreak },
      ...anchorTimes(n).map((at, i): Cue => ({ at: at + BEAM_DELAY, play: () => playTerraformShockwave(i, n) })),
      { at: RESOLVE_AT, keep: true, play: playVictoryResolve },
    ].sort((a, b) => a.at - b.at);
    let next = 0;
    let raf = 0;
    let frame = 0;
    let free: FreeArea | undefined;
    let shownAct = 0;
    let shownHits = -1;
    let debrief = still;
    let lastKey = "";
    // The picture is drawn smaller (and stretched) on a machine that cannot keep up: smooth before sharp.
    let quality = 1;
    let lastNow = 0;
    let slow = 0;
    let counted = 0;

    /** The part of the picture the Debrief card leaves open (it stands at the side, or along the foot). */
    const measure = (w: number, h: number): void => {
      const el = card.current;
      if (!el) return void (free = undefined);
      free = el.offsetWidth < w * 0.7 ? { x: 0, y: 0, w: Math.max(1, el.offsetLeft), h } : { x: 0, y: 0, w, h: Math.max(1, el.offsetTop) };
    };

    const draw = (now: number): void => {
      clock.current.start ||= now;
      const t = still ? STILL_AT : ((now - clock.current.start) / 1000) * speed + clock.current.jump;
      const r = cv.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      if (w >= 2 && h >= 2) {
        if (lastNow && !still) {
          // Every half second or so: were most frames late (under about 40 a second)? Then draw a quarter fewer points.
          counted++;
          if (now - lastNow > 25) slow++;
          if (counted >= 30) {
            if (slow > 20 && quality > MIN_QUALITY) quality = Math.max(MIN_QUALITY, quality * 0.78);
            counted = slow = 0;
          }
        }
        lastNow = now;
        const k = Math.min(2, window.devicePixelRatio || 1, Math.sqrt(MAX_PIXELS / (w * h))) * quality;
        const pw = Math.max(1, Math.round(w * k));
        const ph = Math.max(1, Math.round(h * k));
        const key = `${pw}x${ph}`;
        // A still picture is drawn once, and again only when the window changes.
        if (!still || key !== lastKey) {
          if (cv.width !== pw || cv.height !== ph) {
            cv.width = pw;
            cv.height = ph;
          }
          if (frame % 20 === 0 || key !== lastKey) measure(w, h);
          lastKey = key;
          g.setTransform(pw / w, 0, 0, ph / h, 0, 0);
          try {
            scene.prepare(still ? Infinity : PREPARE_BUDGET);
            scene.draw(g, w, h, t, free);
          } catch (e) {
            // A film that cannot be drawn must never keep the player from the Debrief.
            console.error(e);
            setPhase("debrief");
            return;
          }
        }
      }
      frame++;
      while (next < cues.length && cues[next]!.at <= t) {
        const c = cues[next++]!;
        if (!still && (!clock.current.skipped || c.keep)) c.play();
      }
      const a = actAt(t);
      if (a !== shownAct) {
        setAct((shownAct = a));
        setActs((seen) => seen + a);
      }
      const hit = anchorsBy(t, n);
      if (hit !== shownHits) setHits((shownHits = hit));
      if (!debrief && t >= DEBRIEF_AT) {
        debrief = true;
        setPhase("debrief");
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    if (still) playVictoryResolve();
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Jump to the end of the film (all pylons anchored, the sun up) behind a short white veil. */
  function skip(): void {
    if (phase !== "film" || clock.current.skipped) return;
    const now = performance.now();
    const t = ((now - (clock.current.start || now)) / 1000) * speed + clock.current.jump;
    clock.current.skipped = true;
    clock.current.jump += Math.max(0, FILM_SECONDS - t);
    playConfirm();
    setVeil((v) => v + 1);
    setPhase("debrief");
  }
  const twoTaps = useTwoTapSkip(phase === "film" && !still, skip);
  // Once the Debrief is in, its button takes the keyboard.
  useEffect(() => {
    if (phase !== "debrief") return;
    const t = setTimeout(() => back.current?.focus({ preventScroll: true }), still ? 0 : 900);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const mission = stats.missions[Math.min(hits, stats.missions.length) - 1];
  const sub =
    act === 1
      ? `Bay doors open · ${n} atmospheric processor${n === 1 ? "" : "s"}`
      : act === 2
        ? `Braking thrusters · ${n} pylon${n === 1 ? "" : "s"} descending`
        : act === 3
          ? hits > 0
            ? `Pylon ${hits} of ${n} anchored${mission ? ` · ${mission.label}` : ""}`
            : "Anchor lock"
          : `${stats.campaignName} · atmosphere seeded`;

  return (
    <div
      className={`ou ${phase === "debrief" ? "ou-end" : ""} ${still ? "ou-still" : ""}`}
      data-outro="terraformer2"
      data-act={act}
      data-acts={acts}
      data-phase={phase}
      data-hits={hits}
      role="dialog"
      onPointerDown={twoTaps.tap}
      aria-label={`${stats.campaignName} complete`}
      style={{ "--acc": companyTheme.primary, "--acc2": companyTheme.secondary } as CSSProperties}
    >
      <canvas ref={canvas} className="ou-canvas" aria-hidden="true" />
      <div className="ou-shade" aria-hidden="true" />
      {veil > 0 && <div key={veil} className="ou-veil" style={{ animationDuration: `${SKIP_VEIL}ms` }} aria-hidden="true" />}

      <div className="ou-hud" aria-live="polite">
        <div className="ou-kicker">{stats.vesselName}</div>
        <div className="ou-act" key={act}>
          {ACT_NAMES[act - 1]}
        </div>
        <div className="ou-sub" key={sub}>
          {sub}
        </div>
        <div className="ou-ticks" role="img" aria-label={`Act ${act} of 4`}>
          {[1, 2, 3, 4].map((i) => (
            <i key={i} className={i < act ? "done" : i === act ? "on" : ""} />
          ))}
        </div>
      </div>

      {phase === "film" && <SkipHint armed={twoTaps.armed} hintOn={twoTaps.hintOn} />}

      <Debrief cardRef={card} stats={stats} shown={phase === "debrief"} still={still} back={back} onBack={() => {
        if (left.current) return;
        left.current = true;
        playConfirm();
        onComplete();
      }} />
    </div>
  );
}
