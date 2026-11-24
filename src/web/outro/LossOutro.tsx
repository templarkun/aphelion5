/**
 * The loss outros (designer 2026-11-24: "two loss / conceded outros, which work for any Company, any
 * Campaign, play for either a loss or a concede, and are chosen at random"): what a lost or conceded
 * game shows at Game End (Core Rules 10.3), in place of the plain "Game over" card. Two films:
 * **Signal Lost** (the tactical display failing, loss/signal.ts) and **Withdrawal** (the Flagship
 * jumps away from the lost planet, loss/withdrawal.ts); one of them at random each time
 * (`pickLossOutro`, loss/timeline.ts). Built the same way as the victory outros: the same props
 * (OutroProps), the shared Debrief card (Debrief.tsx, which reads "Campaign lost" or "Campaign
 * conceded"), "Tap twice to skip" (SkipHint.tsx), every moving thing worked out from the time alone,
 * the speed setting, one still picture with reduced motion or the Instant speed, and fewer particles
 * on a slow machine. Generic: the Company lends only its colours (a plain hull, no Company outline;
 * no Campaign map); a concede and a loss differ only in a few caption words. Silent but for the last
 * chord: the sound hooks (briefing/soundHooks.ts) are called at the right moments. Screen only.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { isStill, speedFactor } from "../motion.js";
import {
  playBeaconLost,
  playConfirm,
  playCraftLost,
  playDefeatResolve,
  playEvacLaunch,
  playHostileSurge,
  playJumpCharge,
  playJumpFlash,
  playScreenCollapse,
  playSectorOverrun,
  playSignalGlitch,
} from "../briefing/soundHooks.js";
import { Debrief } from "./Debrief.js";
import { SkipHint, useTwoTapSkip } from "./SkipHint.js";
import type { CampaignStats, CompanyTheme, OutroProps } from "./types.js";
import type { FreeArea, LossScene } from "./loss/kit.js";
import { createSignalScene } from "./loss/signal.js";
import { createWithdrawalScene } from "./loss/withdrawal.js";
import { aboardBy, actOf, craftEnd, glitchAt, heldAt, SIGNAL, uplinkAt, WITHDRAW, type ActNo, type LossId } from "./loss/timeline.js";

/** The canvas is never drawn with more points than this. */
const MAX_PIXELS = 3.2e6;
/** On a slow machine the picture is drawn with fewer points (and fewer particles), down to this share. */
const MIN_QUALITY = 0.45;
/** How long the dark veil of a skip lasts, ms. */
const SKIP_VEIL = 420;

/** The loss's own accent for captions and the Debrief card: a muted crimson, the same for every Company. */
export const LOSS_ACCENT = "236 92 80";

interface Cue {
  at: number;
  /** Still played when the film is skipped (the last chord). */
  keep?: boolean;
  play: () => void;
}

/** What one loss film is: its timing, its scene, its captions. */
interface LossFilm {
  id: LossId;
  FILM_SECONDS: number;
  ACT_AT: readonly number[];
  ACT_NAMES: readonly string[];
  DEBRIEF_AT: number;
  STILL_AT: number;
  cues: Cue[];
  scene: (theme: CompanyTheme) => LossScene;
  caption: (t: number, act: ActNo, stats: CampaignStats) => string;
  /** Numbers on the page for the browser check. */
  marks: (t: number) => Record<string, number>;
}

const conceded = (s: CampaignStats) => s.result === "conceded";
const ending = (s: CampaignStats) => `${s.campaignName} · ${conceded(s) ? "conceded" : "lost"}`;

const FILMS: Record<LossId, LossFilm> = {
  signal: {
    id: "signal",
    ...SIGNAL,
    cues: [
      { at: SIGNAL.BREACH_AT, play: playHostileSurge },
      { at: SIGNAL.GLITCH_AT, play: playSignalGlitch },
      { at: SIGNAL.LAST_AT, play: playBeaconLost },
      { at: SIGNAL.COLLAPSE_AT, play: playScreenCollapse },
      { at: SIGNAL.RESOLVE_AT, keep: true, play: playDefeatResolve },
    ],
    scene: (theme) => createSignalScene({ theme }),
    caption: (t, act, s) => {
      const n = 3 * SIGNAL.RINGS * (SIGNAL.RINGS + 1) + 1;
      if (act === 1) return conceded(s) ? "Withdrawal ordered · sectors abandoned" : "Hostile forces breaching the perimeter";
      // Round numbers, so the caption changes only a few times (the display itself counts each sector).
      if (act === 2) return `Uplink failing · ${Math.ceil(heldAt(t) / 5) * 5 >= n ? n : Math.ceil(heldAt(t) / 5) * 5} of ${n} sectors holding`;
      if (act === 3) return t < SIGNAL.LAST_AT ? "Last beacon holding" : "Last beacon dark · command link lost";
      return ending(s);
    },
    marks: (t) => ({ held: heldAt(t), uplink: uplinkAt(t), glitch: Math.round(glitchAt(t) * 100), off: t >= SIGNAL.COLLAPSE_END ? 1 : 0 }),
  },
  withdrawal: {
    id: "withdrawal",
    ...WITHDRAW,
    cues: [
      { at: WITHDRAW.OVERRUN_AT, play: playSectorOverrun },
      { at: WITHDRAW.CRAFT_AT, play: playEvacLaunch },
      { at: craftEnd(WITHDRAW.CRAFT_LOST), play: playCraftLost },
      { at: WITHDRAW.CHARGE_AT, play: playJumpCharge },
      { at: WITHDRAW.JUMP_AT, play: playJumpFlash },
      { at: WITHDRAW.RESOLVE_AT, keep: true, play: playDefeatResolve },
    ],
    scene: (theme) => createWithdrawalScene({ theme }),
    caption: (t, act, s) => {
      if (act === 1) return conceded(s) ? "Retreat ordered · the sector is abandoned" : "The sector is overrun";
      if (act === 2) return t < craftEnd(WITHDRAW.CRAFTS - 1) ? "Evacuation craft climbing to the Flagship" : `${aboardBy(t)} craft aboard · one lost`;
      if (act === 3) return t < WITHDRAW.JUMP_AT ? "Jump drive charging" : "Jump";
      return ending(s);
    },
    marks: (t) => ({ aboard: aboardBy(t), jumped: t >= WITHDRAW.JUMP_AT ? 1 : 0 }),
  },
};

function LossOutro({ film, companyTheme, campaignStats, onComplete }: OutroProps & { film: LossFilm }): ReactElement {
  const stats = campaignStats;
  const still = useRef(isStill() || speedFactor() === 0).current;
  const speed = useRef(speedFactor() || 1).current;
  const [phase, setPhase] = useState<"film" | "debrief">(still ? "debrief" : "film");
  const [act, setAct] = useState<ActNo>(still ? 4 : 1);
  const [acts, setActs] = useState("");
  const [sub, setSub] = useState(() => film.caption(still ? film.STILL_AT : 0, still ? 4 : 1, stats));
  const [marks, setMarks] = useState<Record<string, number>>(() => film.marks(still ? film.STILL_AT : 0));
  const [veil, setVeil] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const card = useRef<HTMLElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const clock = useRef({ start: 0, jump: 0, skipped: false });
  const left = useRef(false);
  const scene = useMemo(() => film.scene(companyTheme), [film, companyTheme]);

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
      while (next < film.cues.length && film.cues[next]!.at <= t) {
        const c = film.cues[next++]!;
        if (!still && (!clock.current.skipped || c.keep)) c.play();
      }
      const a = actOf(film.ACT_AT, t);
      if (a !== shownAct) {
        setAct((shownAct = a));
        setActs((seen) => seen + a);
      }
      const s = film.caption(t, a, stats);
      if (s !== shownSub) setSub((shownSub = s));
      const m = film.marks(t);
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
    if (still) playDefeatResolve();
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Jump to the end of the film behind a short dark veil. */
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
      className={`ou ou-loss ${phase === "debrief" ? "ou-end" : ""} ${still ? "ou-still" : ""}`}
      data-outro={film.id}
      data-loss={stats.result}
      data-act={act}
      data-acts={acts}
      data-phase={phase}
      {...data}
      role="dialog"
      onPointerDown={twoTaps.tap}
      aria-label={`${stats.campaignName} ${conceded(stats) ? "conceded" : "lost"}`}
      style={{ "--acc": LOSS_ACCENT, "--acc2": companyTheme.primary } as CSSProperties}
    >
      <canvas ref={canvas} className="ou-canvas" aria-hidden="true" />
      <div className="ou-shade" aria-hidden="true" />
      {veil > 0 && <div key={veil} className="ou-veil ou-veil-dark" style={{ animationDuration: `${SKIP_VEIL}ms` }} aria-hidden="true" />}

      <div className="ou-hud" aria-live="polite">
        <div className="ou-kicker">{stats.vesselName}</div>
        <div className="ou-act" key={act}>
          {film.ACT_NAMES[act - 1]}
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

export function SignalLostOutro(p: OutroProps): ReactElement {
  return <LossOutro {...p} film={FILMS.signal} />;
}
export function WithdrawalOutro(p: OutroProps): ReactElement {
  return <LossOutro {...p} film={FILMS.withdrawal} />;
}
