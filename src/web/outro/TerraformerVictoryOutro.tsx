/**
 * The Terraformer outro (designer 2026-11-16): the Company claims the hostile planet for good.
 * Shown at Game End (Core Rules 10.3) when the last mission is won. Screen only, no rule.
 *
 * A film of about 11.5 seconds on one canvas (terraformer/scene.ts) in four acts: the bay doors
 * open under the Company's ship and the pylons let go (one for every mission won); they burn
 * down through the air; they hit one after another and their shock waves turn the dark ground
 * into a lit sector in the Company's colours; the camera pulls back as the sun rises. Over it,
 * small captions, a [SKIP] button, and at the end the Campaign Debrief card, which slides in
 * at the side (from below on a phone) and leaves the glowing sector in view.
 *
 * The animation speed setting stretches or shortens the film; with reduced motion or the
 * Instant speed there is no film: one still picture of its end, and the Debrief at once.
 * Silent: the sound hooks (briefing/soundHooks.ts) are called at the right moments.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { isStill, speedFactor } from "../motion.js";
import { playBayDoorsOpen, playConfirm, playHover, playReentryStreak, playTerraformShockwave, playVictoryResolve } from "../briefing/soundHooks.js";
import { THREAT_NAMES, THREAT_RGB } from "../briefing/types.js";
import { createTerraformerScene, type FreeArea } from "./terraformer/scene.js";
import { ACT_NAMES, actAt, DEBRIEF_AT, DOORS_AT, FILM_SECONDS, impactsBy, impactTimes, pylonCount, REENTRY_AT, RESOLVE_AT, STILL_AT } from "./terraformer/timeline.js";
import type { CampaignStats, OutroProps } from "./types.js";

export type TerraformerVictoryOutroProps = OutroProps;

/** The canvas is never drawn with more points than this (a 4K screen is drawn a little softer, and stays smooth). */
const MAX_PIXELS = 3.2e6;
/** On a slow machine the picture is drawn with fewer points, down to this share of its width and height. */
const MIN_QUALITY = 0.45;
/** How long the white veil of a skip lasts, ms. */
const SKIP_VEIL = 420;

interface Cue {
  at: number;
  /** Still played when the film is skipped (the last chord). */
  keep?: boolean;
  play: () => void;
}

export function TerraformerVictoryOutro({ companyTheme, vesselId, campaignStats, onComplete }: TerraformerVictoryOutroProps): ReactElement {
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
  const scene = useMemo(() => createTerraformerScene({ theme: companyTheme, vesselId, tags: stats.missions.map((m) => m.tag) }), [companyTheme, vesselId, stats.missions]);

  useEffect(() => {
    const cv = canvas.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return void setPhase("debrief");
    const cues: Cue[] = [
      { at: DOORS_AT, play: playBayDoorsOpen },
      { at: REENTRY_AT, play: playReentryStreak },
      ...impactTimes(n).map((at, i): Cue => ({ at, play: () => playTerraformShockwave(i, n) })),
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
      const hit = impactsBy(t, n);
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

  /** Jump to the end of the film (all pylons down, the sun up) behind a short white veil. */
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
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" || ((e.key === "Enter" || e.key === " ") && document.activeElement?.tagName !== "BUTTON")) skip();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  // Once the Debrief is in, its button takes the keyboard.
  useEffect(() => {
    if (phase !== "debrief") return;
    const t = setTimeout(() => back.current?.focus({ preventScroll: true }), still ? 0 : 900);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const mission = stats.missions[Math.min(hits, stats.missions.length) - 1];
  const sub =
    act === 1
      ? `Bay doors open · ${n} terraformer pylon${n === 1 ? "" : "s"}`
      : act === 2
        ? `${n} pylon${n === 1 ? "" : "s"} in the air`
        : act === 3
          ? hits > 0
            ? `Pylon ${hits} of ${n}${mission ? ` · ${mission.label}` : ""}`
            : "Brace for impact"
          : `${stats.campaignName} · sector claimed`;

  return (
    <div
      className={`ou ${phase === "debrief" ? "ou-end" : ""} ${still ? "ou-still" : ""}`}
      data-outro="terraformer"
      data-act={act}
      data-acts={acts}
      data-phase={phase}
      data-hits={hits}
      role="dialog"
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

      {phase === "film" && (
        <button type="button" className="ou-skip" data-action="outro-skip" onPointerEnter={playHover} onClick={skip}>
          Skip
        </button>
      )}

      <Debrief cardRef={card} stats={stats} shown={phase === "debrief"} still={still} back={back} onBack={() => {
        if (left.current) return;
        left.current = true;
        playConfirm();
        onComplete();
      }} />
    </div>
  );
}

const ENERGY_CLASS = { Yellow: "y", Red: "r", Blue: "b" } as const;

/** The number runs up to the score when the card comes in. */
function useCountUp(to: number, on: boolean, still: boolean): number {
  const [v, setV] = useState(still ? to : 0);
  useEffect(() => {
    if (!on || still) return void setV(on || still ? to : 0);
    let raf = 0;
    const t0 = performance.now() + 450;
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / 900));
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [on, to, still]);
  return v;
}

/**
 * The Campaign Debrief: the final score (Core Rules 10.3) with the lines that add up to it, the
 * vessel, the Modules held, the Threat Level of every mission won, the turns, and the way back.
 * It is on the page from the start (out of sight), so the film knows which part of the picture
 * it will leave open.
 */
function Debrief({ cardRef, stats, shown, still, back, onBack }: { cardRef: React.Ref<HTMLElement>; stats: CampaignStats; shown: boolean; still: boolean; back: React.Ref<HTMLButtonElement>; onBack: () => void }) {
  const score = useCountUp(stats.score, shown, still);
  // The engine's score lines: the missions go into the Threat row, the rest is listed under the score.
  const ids = new Set(stats.missions.map((m) => m.id));
  const extra = stats.scoreParts
    .filter((p) => !ids.has(p.split(":")[0]!))
    .map((p) => {
      const m = /^(.*?)\s*\(([+-]\d+)\)$/.exec(p);
      const text = m ? m[1]! : p;
      return { text: text.charAt(0).toUpperCase() + text.slice(1), value: m ? m[2]!.replace("-", "−") : "" };
    });
  const colours = (["Yellow", "Red", "Blue"] as const).map((c) => ({ c, n: stats.modules.filter((m) => m.colour === c).length })).filter((x) => x.n > 0);
  return (
    <aside ref={cardRef} className={`ou-card ${shown ? "in" : ""}`} data-debrief={shown ? "1" : "0"} aria-hidden={!shown} aria-label="Campaign debrief">
      <div className="ou-card-body">
        <header className="ou-head">
          <div className="ou-label">Campaign debrief</div>
          <h2 className="ou-title">{stats.campaignName}</h2>
          <div className="ou-note">{[stats.campaignNote, "Campaign complete"].filter(Boolean).join(" · ")}</div>
        </header>

        <section className="ou-score" aria-label={`Final score ${stats.score}`}>
          <div className="ou-score-n" data-score={stats.score}>
            {score}
          </div>
          <div className="ou-score-side">
            <div className="ou-label">Final score</div>
            {stats.highScore && <div className="ou-high">New {stats.highScore === "veteran" ? "Veteran ★ " : ""}high score</div>}
          </div>
        </section>
        <ul className="ou-parts">
          <li>
            <span>
              {stats.threatLevelsConquered} Threat column{stats.threatLevelsConquered === 1 ? "" : "s"} in {stats.missions.length} mission{stats.missions.length === 1 ? "" : "s"}
            </span>
            <b>+{stats.threatLevelsConquered}</b>
          </li>
          {extra.map((p, i) => (
            <li key={i}>
              <span>{p.text}</span>
              <b>{p.value}</b>
            </li>
          ))}
        </ul>

        <dl className="ou-rows">
          <div className="ou-row" data-row="vessel">
            <dt>Vessel</dt>
            <dd>
              <b>{stats.vesselName}</b>
              <small>{stats.freshness === "veteran" ? "Veteran campaign" : "Fresh campaign"}</small>
            </dd>
          </div>
          <div className="ou-row" data-row="threat">
            <dt>Threat Levels conquered</dt>
            <dd>
              <b>{stats.threatLevelsConquered}</b>
              <ul className="ou-missions">
                {stats.missions.map((m) => {
                  const lv = Math.min(4, m.threat.length);
                  return (
                    <li key={m.id} style={{ "--c": THREAT_RGB[lv] } as CSSProperties} title={`${m.label}: ${THREAT_NAMES[lv] || "no Threat"}${m.threat.length ? `, column${m.threat.length === 1 ? "" : "s"} ${m.threat.join(" + ")}` : ""}`}>
                      <span className="ou-tag">{m.tag}</span>
                      <span className="ou-pips" role="img" aria-label={`Threat Level ${lv}${THREAT_NAMES[lv] ? `, ${THREAT_NAMES[lv]}` : ""}`}>
                        {[1, 2, 3, 4].map((i) => (
                          <i key={i} className={i <= lv ? "on" : ""} />
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </dd>
          </div>
          <div className="ou-row" data-row="modules">
            <dt>Modules</dt>
            <dd>
              <b>{stats.modules.length}</b>
              <small>
                {colours.map((x) => (
                  <span key={x.c} className={`ou-energy ${ENERGY_CLASS[x.c]}`}>
                    {x.n} {x.c}
                  </span>
                ))}
              </small>
              <div className="ou-mods">
                {stats.modules.map((m) => (
                  <span key={m.id} className={`ou-mod ${ENERGY_CLASS[m.colour]}`}>
                    {m.name}
                  </span>
                ))}
              </div>
            </dd>
          </div>
          <div className="ou-row" data-row="turns">
            <dt>Total turns</dt>
            <dd>
              <b>{stats.totalTurns}</b>
            </dd>
          </div>
        </dl>
      </div>
      <footer className="ou-foot">
        <button ref={back} type="button" className="bf-btn bf-primary ou-return" data-action="outro-return" tabIndex={shown ? 0 : -1} onPointerEnter={playHover} onClick={onBack}>
          Return to Command Deck
        </button>
      </footer>
    </aside>
  );
}
