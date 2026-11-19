/**
 * Orbital Claim (designer 2026-11-19): a fourth victory outro, beside the Terraformer ones. No
 * terraforming: the Company claims the sector it has won, a corporate-military annexation. Shown
 * at Game End (Core Rules 10.3) when the last mission is won (when the designer chooses it; 2.0
 * stays the one after a won game until then). Screen only, no rule.
 *
 * A film of about 11.5 seconds on one canvas (orbital/scene.ts) in four acts: from low orbit over
 * the planet of the intro, a beacon beam in the Company's colour climbs from the liberated sector
 * into space; the camera rises along it as the Company's Flagship glides in above and its belly
 * clamps lock on the beam; relay satellites snap into a lattice and a hexagonal territory grid
 * sweeps over the region, "ASSET SECURED"; then a slow orbital drift over the claimed grid. Built
 * the same way as the Terraformer outros: the same props, the shared Debrief card (Debrief.tsx) and
 * "Tap twice to skip" (SkipHint.tsx), every moving thing worked out from the time alone, the speed
 * setting, one still picture with reduced motion or the Instant speed, and a softer picture on a
 * slow machine. Silent: the sound hooks (briefing/soundHooks.ts) are called at the right moments.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { isStill, speedFactor } from "../motion.js";
import { playConfirm, playGridSweep, playOrbitalLock, playSkyBeamFire, playVictoryResolve } from "../briefing/soundHooks.js";
import { createOrbitalScene, type FreeArea } from "./orbital/scene.js";
import { ACT_NAMES, actAt, BEAM_AT, BEAM_CLIMB, DEBRIEF_AT, FILM_SECONDS, GRID_AT, LOCK_AT, RESOLVE_AT, SATS, SECURED_AT, snappedBy, STILL_AT } from "./orbital/timeline.js";
import { SkipHint, useTwoTapSkip } from "./SkipHint.js";
import { Debrief } from "./Debrief.js";
import type { OutroProps } from "./types.js";

export type OrbitalClaimOutroProps = OutroProps;

/** The canvas is never drawn with more points than this (a 4K screen is drawn a little softer, and stays smooth). */
const MAX_PIXELS = 3.2e6;
/** On a slow machine the picture is drawn with fewer points, down to this share of its width and height. */
const MIN_QUALITY = 0.45;
/** Time a frame may spend making the ground picture during the first act, ms. */
const PREPARE_BUDGET = 4;
/** How long the white veil of a skip lasts, ms. */
const SKIP_VEIL = 420;

interface Cue {
  at: number;
  /** Still played when the film is skipped (the last chord). */
  keep?: boolean;
  play: () => void;
}

export function OrbitalClaimOutro({ companyTheme, vesselId, campaignStats, onComplete }: OrbitalClaimOutroProps): ReactElement {
  const stats = campaignStats;
  // The speed and motion settings as they were when the outro began.
  const still = useRef(isStill() || speedFactor() === 0).current;
  const speed = useRef(speedFactor() || 1).current;
  const [phase, setPhase] = useState<"film" | "debrief">(still ? "debrief" : "film");
  const [act, setAct] = useState<1 | 2 | 3 | 4>(still ? 4 : 1);
  // What has happened so far, for the captions and the browser check.
  const [beam, setBeam] = useState(still ? 2 : 0);
  const [locked, setLocked] = useState(still);
  const [sats, setSats] = useState(still ? SATS : 0);
  const [secured, setSecured] = useState(still);
  // The acts shown so far, in order ("1234" once the film has run through): for the browser check.
  const [acts, setActs] = useState("");
  const [veil, setVeil] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const card = useRef<HTMLElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const clock = useRef({ start: 0, jump: 0, skipped: false });
  const left = useRef(false);
  const scene = useMemo(() => createOrbitalScene({ theme: companyTheme, vesselId }), [companyTheme, vesselId]);

  useEffect(() => {
    const cv = canvas.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return void setPhase("debrief");
    const cues: Cue[] = [
      { at: BEAM_AT, play: playSkyBeamFire },
      { at: LOCK_AT, play: playOrbitalLock },
      { at: GRID_AT, play: playGridSweep },
      { at: RESOLVE_AT, keep: true, play: playVictoryResolve },
    ];
    let next = 0;
    let raf = 0;
    let frame = 0;
    let free: FreeArea | undefined;
    const shown = { act: 0, beam: -1, locked: false, sats: -1, secured: false };
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
            scene.draw(g, w, h, t, free, quality);
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
      if (a !== shown.act) {
        setAct((shown.act = a));
        setActs((seen) => seen + a);
      }
      const b = t >= BEAM_AT + BEAM_CLIMB ? 2 : t >= BEAM_AT ? 1 : 0;
      if (b !== shown.beam) setBeam((shown.beam = b));
      if (t >= LOCK_AT !== shown.locked) setLocked((shown.locked = t >= LOCK_AT));
      const n = snappedBy(t);
      if (n !== shown.sats) setSats((shown.sats = n));
      if (t >= SECURED_AT !== shown.secured) setSecured((shown.secured = t >= SECURED_AT));
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

  /** Jump to the end of the film (the region claimed, the Flagship on station) behind a short white veil. */
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

  const sub =
    act === 1
      ? beam < 2
        ? "Sector liberated · extraction beacon firing"
        : "Beacon through the atmosphere into orbit"
      : act === 2
        ? locked
          ? "Clamps locked · orbital tether live"
          : `${stats.vesselName} moving into position`
        : act === 3
          ? sats < SATS
            ? `Relay lattice deploying · ${sats} of ${SATS}`
            : secured
              ? "Asset secured · region claimed"
              : "Territory grid sweeping the region"
          : `${stats.campaignName} · claimed`;

  return (
    <div
      className={`ou ${phase === "debrief" ? "ou-end" : ""} ${still ? "ou-still" : ""}`}
      data-outro="orbital"
      data-act={act}
      data-acts={acts}
      data-phase={phase}
      data-locked={locked ? 1 : 0}
      data-sats={sats}
      data-secured={secured ? 1 : 0}
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
