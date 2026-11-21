/**
 * Surface Terraform (designer 2026-11-19): a third victory outro, next to Terraformer 1.0 and 2.0,
 * and a direct continuation of 2.0: the pylons it dropped now stand on the planet's surface, and
 * the camera stands with them. Shown at Game End (Core Rules 10.3) when the last mission is won
 * (when the designer chooses it; 2.0 stays the one after a won game until then). Screen only, no rule.
 *
 * A film of about 12.5 seconds on one canvas (surface/scene.ts) in four acts, in a hard, gritty
 * look (designer 2026-11-21: Dune, Mass Effect, Homeworld; geological, not botanical): in an ochre
 * dust storm over a basalt valley three brutalist spires power up and fire wide ion plumes; the
 * plumes carve a turbulent eye in the storm and cold sunlight breaks through in shafts; water
 * fills the dark canyon beds and the basalt turns wet and mineral-rich, mist on the valley floor;
 * then a slow, heavy pan over the cold, clear frontier. Seen as a recon feed (thin visor lines,
 * live telemetry from surface/telemetry.ts). Built the same way as 2.0: the same props,
 * the shared Debrief card (Debrief.tsx) and "Tap twice to skip" (SkipHint.tsx), every moving thing
 * worked out from the time alone, the speed setting, one still picture with reduced motion or the
 * Instant speed, and a softer picture on a slow machine. Silent: the sound hooks
 * (briefing/soundHooks.ts) are called at the right moments.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { isStill, speedFactor } from "../motion.js";
import { clamp } from "../briefing/styles/intro2/math3.js";
import { playAtmosphereClear, playConfirm, playSpireIgnition, playVictoryResolve, playWaterFlow } from "../briefing/soundHooks.js";
import { createSurfaceScene, type FreeArea } from "./surface/scene.js";
import { readoutAt, type Readout } from "./surface/telemetry.js";
import { ACT_NAMES, actAt, DEBRIEF_AT, farCount, farTimes, FILM_SECONDS, fireTimes, firedBy, RESOLVE_AT, SPIRES, STILL_AT, VORTEX_AT, WATER_AT } from "./surface/timeline.js";
import { pylonCount } from "./terraformer2/timeline.js";
import { SkipHint, useTwoTapSkip } from "./SkipHint.js";
import { Debrief } from "./Debrief.js";
import type { OutroProps } from "./types.js";

export type SurfaceTerraformOutroProps = OutroProps;

/** The canvas is never drawn with more points than this (a 4K screen is drawn a little softer, and stays smooth). */
const MAX_PIXELS = 3.2e6;
/** On a slow machine the picture is drawn with fewer points, down to this share of its width and height. */
const MIN_QUALITY = 0.45;
/** Time a frame may spend painting the valley's living pictures during the first acts, ms. */
const PREPARE_BUDGET = 3;
/** How long the white veil of a skip lasts, ms. */
const SKIP_VEIL = 420;

interface Cue {
  at: number;
  /** Still played when the film is skipped (the last chord). */
  keep?: boolean;
  play: () => void;
}

export function SurfaceTerraformOutro({ companyTheme, vesselId, campaignStats, onComplete }: SurfaceTerraformOutroProps): ReactElement {
  const stats = campaignStats;
  // The speed and motion settings as they were when the outro began.
  const still = useRef(isStill() || speedFactor() === 0).current;
  const speed = useRef(speedFactor() || 1).current;
  const [phase, setPhase] = useState<"film" | "debrief">(still ? "debrief" : "film");
  const [act, setAct] = useState<1 | 2 | 3 | 4>(still ? 4 : 1);
  const [fired, setFired] = useState(still ? SPIRES : 0);
  // The other pylons 2.0 dropped (one per mission won), far off beyond the horizon (designer 2026-11-19, I17).
  const pylons = pylonCount(stats.missions.length);
  const far = farCount(pylons);
  const [farOn, setFarOn] = useState(still ? far : 0);
  // The acts shown so far, in order ("1234" once the film has run through): for the browser check.
  const [acts, setActs] = useState("");
  const [veil, setVeil] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const card = useRef<HTMLElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  // The recon feed's readouts and its horizon mark, written straight to the page each frame (no re-render).
  const tel = useRef<Partial<Record<keyof Readout, HTMLElement | null>>>({});
  const mark = useRef<HTMLDivElement>(null);
  const clock = useRef({ start: 0, jump: 0, skipped: false });
  const left = useRef(false);
  const scene = useMemo(() => createSurfaceScene({ theme: companyTheme, vesselId, pylons }), [companyTheme, vesselId, pylons]);

  useEffect(() => {
    const cv = canvas.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return void setPhase("debrief");
    const cues: Cue[] = [
      // One for each spire as it fires its beam.
      ...fireTimes().map((at): Cue => ({ at, play: playSpireIgnition })),
      { at: VORTEX_AT, play: playAtmosphereClear },
      { at: WATER_AT, play: playWaterFlow },
      { at: RESOLVE_AT, keep: true, play: playVictoryResolve },
    ].sort((a, b) => a.at - b.at);
    let next = 0;
    let raf = 0;
    let frame = 0;
    let free: FreeArea | undefined;
    let shownAct = 0;
    let shownFired = -1;
    let shownFar = -1;
    const farAt = farTimes(far);
    let debrief = still;
    let lastKey = "";
    const shown: Partial<Readout> = {};
    let shownHy = -1;
    /** The recon feed at film time t. */
    const feed = (t: number, h: number): void => {
      const r = readoutAt(t);
      for (const k of Object.keys(r) as (keyof Readout)[]) {
        if (shown[k] === r[k]) continue;
        shown[k] = r[k];
        const el = tel.current[k];
        if (el) {
          el.textContent = r[k];
          el.dataset.v = r[k];
        }
      }
      const hy = Math.round(clamp(scene.horizon(), h * 0.12, h * 0.88));
      if (hy !== shownHy && mark.current) mark.current.style.transform = `translateY(${(shownHy = hy)}px)`;
    };
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
            feed(t, h);
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
      const f = firedBy(t);
      if (f !== shownFired) setFired((shownFired = f));
      const ff = farAt.filter((x) => t >= x).length;
      if (ff !== shownFar) setFarOn((shownFar = ff));
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

  /** Jump to the end of the film (the valley alive, the sky clear) behind a short white veil. */
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
      ? fired < SPIRES
        ? `Radiator fins open · ${fired} of ${SPIRES} ion plumes firing`
        : farOn > 0
          ? `${SPIRES} terraformer spires online · ${farOn} more beyond the horizon`
          : `${SPIRES} terraformer spires online`
      : act === 2
        ? "The plumes carve an eye in the storm · sunlight breaks through"
        : act === 3
          ? "Water returns · the basalt turns wet and mineral-rich"
          : `${stats.campaignName} · a frontier made habitable`;

  return (
    <div
      className={`ou ${phase === "debrief" ? "ou-end" : ""} ${still ? "ou-still" : ""}`}
      data-outro="surface"
      data-act={act}
      data-acts={acts}
      data-phase={phase}
      data-spires={fired}
      data-far={farOn}
      role="dialog"
      onPointerDown={twoTaps.tap}
      aria-label={`${stats.campaignName} complete`}
      style={{ "--acc": companyTheme.primary, "--acc2": companyTheme.secondary } as CSSProperties}
    >
      <canvas ref={canvas} className="ou-canvas" aria-hidden="true" />
      <div className="ou-shade" aria-hidden="true" />
      <div className="ou-recon" aria-hidden="true">
        <i className="ou-rc tl" />
        <i className="ou-rc tr" />
        <i className="ou-rc bl" />
        <i className="ou-rc br" />
        <div className="ou-elev" />
        <div className="ou-elev-mark" ref={mark}>
          <span>HRZ · EL 0350 M</span>
        </div>
        <dl className="ou-tel">
          <div className="ou-tel-head">
            <span>Recon feed · drone 03</span>
            <span ref={(e) => void (tel.current.clock = e)}>T+00:00.00</span>
          </div>
          <div>
            <dt>Atmos O2</dt>
            <dd ref={(e) => void (tel.current.o2 = e)}>02.4%</dd>
          </div>
          <div>
            <dt>Particulate</dt>
            <dd ref={(e) => void (tel.current.particulate = e)} data-v="CRITICAL">CRITICAL</dd>
          </div>
          <div>
            <dt>Surface H2O</dt>
            <dd ref={(e) => void (tel.current.water = e)}>00.0%</dd>
          </div>
          <div>
            <dt>Sector biome</dt>
            <dd ref={(e) => void (tel.current.biome = e)}>DORMANT</dd>
          </div>
        </dl>
      </div>
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
