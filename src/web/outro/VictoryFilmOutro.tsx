/**
 * Two more victory outros (designer 2026-11-27: "create another 2 creative mission complete victory
 * animations"), beside Terraformer 1.0 / 2.0, Surface Terraform and Orbital Claim; in System options
 * until the designer says which Company gets which (2.0 stays the one after a won game). **Homecoming**
 * (victory/homecoming.ts): the Flagship drops out of its jump by the Company's home world, an honour
 * guard of escorts forms, one salute burst per mission won, the station's ring lights up, the clamps
 * lock at the berth. **Star Chart** (victory/starchart.ts), the longest (about 21 s): a comet runs the
 * Campaign's road and one star per mission won ignites, streams of light draw the constellation, a star
 * chart unfolds round it; a new star is born in its middle, the camera flies back through the stars to a
 * 3D galaxy, and a wave of the Company's light crosses it. Built as the other outros: the same props (OutroProps), the shared
 * Debrief card, "Tap twice to skip", every moving thing worked out from the time alone, the speed
 * setting, one still picture with reduced motion or the Instant speed, fewer particles on a slow
 * machine. Generic: the Company lends its name and colours (no Company outline), so any Company can
 * have them. Sound hooks (briefing/soundHooks.ts) at the right moments. Screen only.
 *
 * **Sunforge** (victory/sunforge.ts; designer 2026-11-28: "spectacular ... Be ambitious"), the longest
 * (about 27 s) and the only one in five acts: the swarm seals the system's star in a shell of hexagonal
 * panels, one keystone per mission won closes the last gap, total eclipse, the shell ignites and fires
 * polar jets, and the Company's light spreads across the system. The page shows as many act marks as
 * the film has acts.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { isStill, speedFactor } from "../motion.js";
import {
  playConfirm,
  playConstellationLink,
  playDockingClamp,
  playEscortFlyby,
  playJumpArrival,
  playSaluteBurst,
  playStarChartAscend,
  playStarChartNova,
  playStarChartUnfold,
  playStarChartWave,
  playStarIgnite,
  playSunforgeEclipse,
  playSunforgeIgnite,
  playSunforgeJets,
  playSunforgeKeystone,
  playSunforgeLattice,
  playSunforgeRelay,
  playSunforgeShell,
  playSunforgeSwarm,
  playSunforgeThrum,
  playVictoryResolve,
} from "../briefing/soundHooks.js";
import { Debrief } from "./Debrief.js";
import { SkipHint, useTwoTapSkip } from "./SkipHint.js";
import type { CampaignStats, CompanyTheme, OutroProps } from "./types.js";
import type { FreeArea, LossScene } from "./loss/kit.js";
import { createHomecomingScene } from "./victory/homecoming.js";
import { createStarChartScene } from "./victory/starchart.js";
import { createSunforgeScene } from "./victory/sunforge.js";
import {
  actAt,
  burstsBy,
  CHART,
  coreFlareAt,
  waveRadius,
  escortsFormed,
  FORGE,
  FORGE_TILES,
  HOME,
  keysBy,
  keystoneCount,
  keystoneTimes,
  linksBy,
  linkTimes,
  panelCount,
  panelsBy,
  relaysBy,
  relayTimes,
  ringLit,
  saluteTimes,
  starsLit,
  starTimes,
  worldCount,
  latticeReach,
  igniteAt,
  type VictoryId,
} from "./victory/timeline.js";

/** The canvas is never drawn with more points than this. */
const MAX_PIXELS = 3.2e6;
/** On a slow machine the picture is drawn with fewer points (and fewer particles), down to this share. */
const MIN_QUALITY = 0.45;
/** How long the dark veil of a skip lasts, ms. */
const SKIP_VEIL = 420;

interface Cue {
  at: number;
  /** Still played when the film is skipped (the last chord). */
  keep?: boolean;
  play: () => void;
}

/** What one film is: its timing, its scene, its captions. */
interface VictoryFilm {
  id: VictoryId;
  FILM_SECONDS: number;
  ACT_AT: readonly number[];
  ACT_NAMES: readonly string[];
  DEBRIEF_AT: number;
  STILL_AT: number;
  cues: (stats: CampaignStats) => Cue[];
  scene: (theme: CompanyTheme, stats: CampaignStats) => LossScene;
  caption: (t: number, act: number, stats: CampaignStats) => string;
  /** Numbers on the page for the browser check. */
  marks: (t: number, stats: CampaignStats) => Record<string, number>;
}

const won = (s: CampaignStats) => Math.max(1, s.missions.length);

const FILMS: Record<VictoryId, VictoryFilm> = {
  homecoming: {
    id: "homecoming",
    ...HOME,
    cues: (s) => [
      { at: HOME.ARRIVE_AT, play: playJumpArrival },
      { at: HOME.ESCORT_AT, play: playEscortFlyby },
      ...saluteTimes(won(s)).map((at, i, all) => ({ at, play: () => playSaluteBurst(i, all.length) })),
      { at: HOME.DOCK_AT, play: playDockingClamp },
      { at: HOME.RESOLVE_AT, keep: true, play: playVictoryResolve },
    ],
    scene: (theme, stats) => createHomecomingScene({ theme, stats }),
    caption: (t, act, s) => {
      if (act === 1) return t < HOME.ARRIVE_AT ? "Jump drive spooling down" : "Jump complete · home system";
      if (act === 2) return escortsFormed(t) < HOME.ESCORTS ? `Honour guard forming · ${escortsFormed(t)} of ${HOME.ESCORTS}` : "Honour guard in formation";
      if (act === 3) return `Victory salute · ${burstsBy(t, won(s))} of ${won(s)} missions`;
      return t < HOME.DOCK_AT ? "Docking" : `${s.campaignName} · home`;
    },
    marks: (t, s) => ({ escorts: escortsFormed(t), bursts: burstsBy(t, won(s)), ring: ringLit(t), docked: t >= HOME.DOCK_AT ? 1 : 0 }),
  },
  starchart: {
    id: "starchart",
    ...CHART,
    cues: (s) => [
      ...starTimes(won(s)).map((at, i, all) => ({ at, play: () => playStarIgnite(i, all.length) })),
      ...(linkTimes(won(s)).length ? [{ at: CHART.LINK_AT, play: playConstellationLink }] : []),
      { at: CHART.CHART_AT, play: playStarChartUnfold },
      { at: CHART.NOVA_AT, play: playStarChartNova },
      { at: CHART.PULL_AT, play: playStarChartAscend },
      { at: CHART.WAVE_AT, play: playStarChartWave },
      { at: CHART.RESOLVE_AT, keep: true, play: playVictoryResolve },
    ],
    scene: (theme, stats) => createStarChartScene({ theme, stats }),
    caption: (t, act, s) => {
      if (act === 1) return t < CHART.IGNITE_AT ? "Tracing the Campaign's road" : `Campaign record · ${starsLit(t, won(s))} of ${won(s)} missions`;
      if (act === 2) {
        if (linksBy(t, won(s)) < linkTimes(won(s)).length) return "Charting the constellation";
        return t < CHART.CHART_AT + 0.6 ? `${s.threatLevelsConquered} Threat Levels conquered` : `${s.campaignName} · entered in the star chart`;
      }
      if (act === 3) {
        if (t < CHART.NOVA_AT) return "Every victory gathers its light";
        if (t < CHART.PULL_AT + 1.2) return "A new star is born";
        return "The Campaign joins the galaxy";
      }
      if (t < coreFlareAt()) return "Its light crosses the galaxy";
      return waveRadius(t) < CHART.WAVE_REACH ? "The core answers" : `${s.campaignName} · charted`;
    },
    marks: (t, s) => ({
      stars: starsLit(t, won(s)),
      links: linksBy(t, won(s)),
      chart: t >= CHART.CHART_FULL ? 1 : 0,
      nova: t >= CHART.NOVA_AT ? 1 : 0,
      ascended: t >= CHART.PULL_AT ? 1 : 0,
      wave: t >= CHART.WAVE_END ? 1 : 0,
    }),
  },
  sunforge: {
    id: "sunforge",
    ...FORGE,
    cues: (s) => [
      { at: FORGE.SWARM_AT, play: playSunforgeSwarm },
      { at: FORGE.PANEL_AT, play: playSunforgeShell },
      ...keystoneTimes(won(s)).map((at, i, all) => ({ at, play: () => playSunforgeKeystone(i, all.length) })),
      { at: FORGE.DARK_AT, play: playSunforgeEclipse },
      ...FORGE.THRUM.map((at, i) => ({ at, play: () => playSunforgeThrum(i) })),
      { at: FORGE.IGNITE_AT, play: playSunforgeIgnite },
      { at: FORGE.JETS_AT, play: playSunforgeJets },
      ...relayTimes(won(s)).map((at, i, all) => ({ at, play: () => playSunforgeRelay(i, all.length) })),
      { at: FORGE.LATTICE_AT, play: playSunforgeLattice },
      { at: FORGE.RESOLVE_AT, keep: true, play: playVictoryResolve },
    ],
    scene: (theme, stats) => createSunforgeScene({ theme, stats }),
    caption: (t, act, s) => {
      if (act === 1) return t < FORGE.SWARM_AT ? "Approaching the system's star" : "Construction swarm released";
      if (act === 2) return `Shell segments locked · ${panelsBy(t, won(s))} of ${panelCount(won(s))}`;
      if (act === 3) {
        if (t < FORGE.DARK_AT) return `Keystones · ${keysBy(t, won(s))} of ${keystoneCount(won(s))} missions`;
        return t < FORGE.THRUM[0] ? "Total eclipse" : "Core pressure rising";
      }
      if (act === 4) return t < FORGE.JETS_AT ? "Ignition" : "Sunforge online";
      return relaysBy(t, won(s)) < worldCount(won(s)) ? `Power relays · ${relaysBy(t, won(s))} of ${worldCount(won(s))} worlds` : `${s.campaignName} · the system is yours`;
    },
    marks: (t, s) => ({
      panels: panelsBy(t, won(s)) + keysBy(t, won(s)),
      tiles: FORGE_TILES,
      keys: keysBy(t, won(s)),
      dark: t >= FORGE.DARK_AT ? 1 : 0,
      ignited: t >= igniteAt(-1) ? 1 : 0,
      jets: t >= FORGE.JETS_AT ? 1 : 0,
      relays: relaysBy(t, won(s)),
      lattice: latticeReach(t) >= 1 ? 1 : 0,
    }),
  },
};

function VictoryFilmOutro({ film, companyTheme, campaignStats, onComplete }: OutroProps & { film: VictoryFilm }): ReactElement {
  const stats = campaignStats;
  const still = useRef(isStill() || speedFactor() === 0).current;
  const speed = useRef(speedFactor() || 1).current;
  const [phase, setPhase] = useState<"film" | "debrief">(still ? "debrief" : "film");
  const last = film.ACT_AT.length;
  const [act, setAct] = useState<number>(still ? last : 1);
  const [acts, setActs] = useState("");
  const [sub, setSub] = useState(() => film.caption(still ? film.STILL_AT : 0, still ? film.ACT_AT.length : 1, stats));
  const [marks, setMarks] = useState<Record<string, number>>(() => film.marks(still ? film.STILL_AT : 0, stats));
  const [veil, setVeil] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const card = useRef<HTMLElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const clock = useRef({ start: 0, jump: 0, skipped: false });
  const left = useRef(false);
  const scene = useMemo(() => film.scene(companyTheme, stats), [film, companyTheme, stats]);
  const cues = useMemo(() => film.cues(stats).sort((a, b) => a.at - b.at), [film, stats]);

  useEffect(() => {
    const cv = canvas.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return void setPhase("debrief");
    let next = 0;
    let raf = 0;
    let frame = 0;
    let free: FreeArea | undefined;
    let shownAct = 0;
    let shownSub = "";
    let shownMarks = "";
    let debrief = still;
    let lastKey = "";
    let quality = 1;
    let lastNow = 0;
    let slow = 0;
    let counted = 0;
    const measure = (w: number, h: number): void => {
      const el = card.current;
      if (!el) return void (free = undefined);
      free = el.offsetWidth < w * 0.7 ? { x: 0, y: 0, w: Math.max(1, el.offsetLeft), h } : { x: 0, y: 0, w, h: Math.max(1, el.offsetTop) };
    };
    const draw = (now: number): void => {
      clock.current.start ||= now;
      const t = still ? film.STILL_AT : ((now - clock.current.start) / 1000) * speed + clock.current.jump;
      const r = cv.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      if (w >= 2 && h >= 2) {
        if (lastNow && !still) {
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
        if (!still || key !== lastKey) {
          if (cv.width !== pw || cv.height !== ph) {
            cv.width = pw;
            cv.height = ph;
          }
          if (frame % 20 === 0 || key !== lastKey) measure(w, h);
          lastKey = key;
          g.setTransform(pw / w, 0, 0, ph / h, 0, 0);
          try {
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
      const a = actAt(film.ACT_AT, t);
      if (a !== shownAct) {
        setAct((shownAct = a));
        setActs((seen) => seen + a);
      }
      const s = film.caption(t, a, stats);
      if (s !== shownSub) setSub((shownSub = s));
      const m = film.marks(t, stats);
      const mk = JSON.stringify(m);
      if (mk !== shownMarks) {
        shownMarks = mk;
        setMarks(m);
      }
      if (!debrief && t >= film.DEBRIEF_AT) {
        debrief = true;
        setPhase("debrief");
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    if (still) playVictoryResolve();
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Jump to the end of the film behind a short white veil. */
  function skip(): void {
    if (phase !== "film" || clock.current.skipped) return;
    const now = performance.now();
    const t = ((now - (clock.current.start || now)) / 1000) * speed + clock.current.jump;
    clock.current.skipped = true;
    clock.current.jump += Math.max(0, film.FILM_SECONDS - t);
    playConfirm();
    setVeil((v) => v + 1);
    setPhase("debrief");
  }
  const twoTaps = useTwoTapSkip(phase === "film" && !still, skip);
  useEffect(() => {
    if (phase !== "debrief") return;
    const t = setTimeout(() => back.current?.focus({ preventScroll: true }), still ? 0 : 900);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = Object.fromEntries(Object.entries(marks).map(([k, v]) => [`data-${k}`, v]));
  return (
    <div
      className={`ou ou-film ${phase === "debrief" ? "ou-end" : ""} ${still ? "ou-still" : ""}`}
      data-outro={film.id}
      data-act={act}
      data-acts={acts}
      data-phase={phase}
      {...data}
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
          {film.ACT_NAMES[act - 1]}
        </div>
        <div className="ou-sub" key={sub}>
          {sub}
        </div>
        <div className="ou-ticks" role="img" aria-label={`Act ${act} of ${last}`}>
          {film.ACT_AT.map((_, k) => k + 1).map((i) => (
            <i key={i} className={i < act ? "done" : i === act ? "on" : ""} />
          ))}
        </div>
      </div>

      {phase === "film" && <SkipHint armed={twoTaps.armed} hintOn={twoTaps.hintOn} />}

      <Debrief
        cardRef={card}
        stats={stats}
        shown={phase === "debrief"}
        still={still}
        back={back}
        onBack={() => {
          if (left.current) return;
          left.current = true;
          playConfirm();
          onComplete();
        }}
      />
    </div>
  );
}

export function HomecomingOutro(p: OutroProps): ReactElement {
  return <VictoryFilmOutro {...p} film={FILMS.homecoming} />;
}
export function StarChartOutro(p: OutroProps): ReactElement {
  return <VictoryFilmOutro {...p} film={FILMS.starchart} />;
}
export function SunforgeOutro(p: OutroProps): ReactElement {
  return <VictoryFilmOutro {...p} film={FILMS.sunforge} />;
}
