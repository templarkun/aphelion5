/**
 * The command briefing: the entry point before the game. Three steps (Campaign, Company vessel,
 * expansion modules), then LAUNCH compiles the loadout and hands it to the parent. The Threat
 * Level is chosen at each Mission Preparation, on the Threat screen (ThreatScreen.tsx).
 * This shell holds the state, the frame and the transitions between steps.
 */

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Play, Rocket, Settings, X } from "lucide-react";
import type { GameData } from "../../data/index.js";
import type { Profile } from "../../engine/state.js";
import { CampaignSelect, loreOf } from "./CampaignSelect.js";
import { EXPANSION_INFO } from "./content.js";
import { ExpansionSelect } from "./ExpansionSelect.js";
import { AmbientLayer, FxLayer, ambientKick } from "./fx.js";
import { runGate } from "./Gate.js";
import { hoverHook, ms, tapSpark } from "./hud.js";
import { Logo } from "./IntroSequence.js";
import { burst, burstFrom, ring } from "./particles.js";
import { readPref, setIntroMode } from "./prefs.js";
import { playBack, playConfirm, playLaunch, playSelect, playTransition } from "./soundHooks.js";
import { STYLES, setBriefStyle, useBriefStyle } from "./styles/index.js";
import { BRIEF_STEPS, type BriefStep, type Loadout } from "./types.js";
import { VesselSelect, hasMarks } from "./VesselSelect.js";

export interface BriefingProps {
  data: GameData;
  profile: Profile;
  /** A game is in progress: offer to go back to it. */
  onContinue?: (() => void) | undefined;
  autoAnswer: boolean;
  setAutoAnswer: (b: boolean) => void;
  error?: string | undefined;
  /** The whole loadout, compiled: the parent starts the game with it. */
  onLaunch: (l: Loadout) => void;
  onImport: () => void;
  onPaste: () => void;
  onReplayIntro: () => void;
  /** Look at the outro of the Company chosen in the briefing, with made-up numbers. */
  onPreviewOutro?: ((campaign: string, company: string) => void) | undefined;
}

/** Step changes (Back, the step tabs); a confirmed choice plays the logo gate (Gate.tsx, designer 2026-11-16). */
const STEP_OUT = 240;
/** The loadout read back before the gate closes over the briefing. */
const LAUNCH_MS = 1100;

export function Briefing(p: BriefingProps) {
  const { data } = p;
  const [step, setStep] = useState<BriefStep>("campaign");
  const [reached, setReached] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [lock, setLock] = useState<{ title: string; sub: string } | undefined>();
  const [launching, setLaunching] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [introOn, setIntroOn] = useState(() => readPref("aphelion5.intro") !== "off");
  // The chosen style (System options > Style): its accent, background, lock and sparks.
  const style = useBriefStyle();
  const acc = style.acc;

  const [campaign, setCampaign] = useState(data.campaigns[0]!.prefix);
  const [company, setCompany] = useState(data.companies.companies[0]!.id);
  const [freshness, setFreshness] = useState<Loadout["freshness"]>("veteran");
  const [expansions, setExpansions] = useState<string[]>([]);
  const [dev, setDev] = useState(false);
  const [seed, setSeed] = useState("");

  const co = data.companies.byId.get(company)!;
  const idx = BRIEF_STEPS.findIndex((s) => s.id === step);
  const busy = leaving || !!lock || launching;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (f: () => void, t: number) => void timers.current.push(setTimeout(f, ms(t)));

  function go(to: BriefStep): void {
    const dir = BRIEF_STEPS.findIndex((s) => s.id === to) >= idx ? 1 : -1;
    playTransition();
    ambientKick(dir);
    setLeaving(true);
    later(() => {
      setStep(to);
      setReached((r) => Math.max(r, BRIEF_STEPS.findIndex((s) => s.id === to)));
      setLeaving(false);
    }, STEP_OUT);
  }
  /** A confirmed choice: the logo gate closes on it, the next step is put in place behind the doors, they open. */
  function lockIn(title: string, sub: string, to: BriefStep): void {
    playConfirm();
    ring(innerWidth / 2, innerHeight / 2, acc, 900, 0.4, 40);
    burst(innerWidth / 2, innerHeight / 2, { count: 40, speed: 520, life: 0.5, rgb: "255 255 255", shape: "streak", size: 3 });
    setLock({ title, sub });
    runGate({
      title,
      sub,
      acc,
      onMid: () => {
        setStep(to);
        setReached((r) => Math.max(r, BRIEF_STEPS.findIndex((s) => s.id === to)));
        ambientKick(1);
      },
      onEnd: () => setLock(undefined),
    });
  }
  function confirm(el: Element): void {
    if (busy) return;
    if (step === "campaign") lockIn("CAMPAIGN LOCKED", loreOf(campaign).title.toUpperCase(), "vessel");
    else if (step === "vessel") lockIn("VESSEL LOCKED", co.name.toUpperCase(), "modules");
    else {
      playLaunch();
      burstFrom(el, { count: 60, speed: 480, life: 0.7, rgb: "253 230 138", shape: "streak", size: 3, angle: -Math.PI / 2, spread: 2.4 });
      ambientKick(1);
      setLaunching(true);
      const loadout: Loadout = {
        campaign,
        company,
        freshness: hasMarks(p.profile, company) ? freshness : "fresh",
        expansions,
        developerMode: dev,
        seed: seed ? Number(seed) : Math.floor(Math.random() * 1e9),
      };
      // The loadout is read back, then the gate closes over the briefing and opens on the game.
      later(() => runGate({ title: "LAUNCH", sub: loreOf(campaign).title, acc, onMid: () => p.onLaunch(loadout) }), LAUNCH_MS);
    }
  }

  const action = step === "campaign" ? { label: "Confirm campaign", Icon: Check } : step === "vessel" ? { label: "Confirm vessel", Icon: Check } : { label: "Launch command sequence", Icon: Rocket };
  const modsText = expansions.length ? expansions.map((x) => EXPANSION_INFO[x]?.name ?? x).join(", ") : "none";

  return (
    <main className="brief flex flex-col" style={{ "--acc": acc } as React.CSSProperties} data-style={style.id} data-step={step} data-busy={busy ? "1" : "0"} onPointerOver={hoverHook} onPointerDown={tapSpark}>
      <AmbientLayer rgb={acc} />
      <FxLayer />

      <header className="relative z-10 flex items-center gap-3 border-b border-white/20 bg-indigo-950/30 px-3 py-2 sm:px-5">
        <Logo size={40} />
        <div className="min-w-0 flex-1">
          <h1 className="bf-glow truncate text-base font-extrabold tracking-[0.26em] text-white sm:text-lg">APHELION 5</h1>
          <div className="hidden text-[12px] font-semibold uppercase tracking-[0.14em] text-sky-200 sm:block">Command deck</div>
        </div>
        {p.onContinue && (
          <button type="button" className="bf-btn !min-h-[42px] !px-4" style={{ "--acc": "252 211 77" } as React.CSSProperties} onClick={p.onContinue}>
            <Play size={16} /> <span className="hidden sm:inline">Resume game</span>
            <span className="sm:hidden">Resume</span>
          </button>
        )}
        <button type="button" className="grid h-11 w-11 place-items-center rounded-full text-white hover:bg-white/15" aria-label="System options" aria-expanded={drawer} onClick={() => setDrawer(true)}>
          <Settings size={22} />
        </button>
      </header>

      <nav className="relative z-10 flex items-stretch gap-1 border-b border-white/15 bg-indigo-950/20 px-2 sm:px-5" aria-label="Briefing steps">
        {BRIEF_STEPS.map((s, i) => {
          const state = i === idx ? "now" : i <= reached ? "done" : "next";
          return (
            <button
              key={s.id}
              type="button"
              disabled={busy || i > reached || i === idx}
              aria-current={i === idx ? "step" : undefined}
              onClick={() => go(s.id)}
              className={`flex flex-1 items-center justify-center gap-2 border-b-[3px] px-1 py-2.5 text-[13px] font-bold uppercase tracking-[0.1em] transition-colors sm:text-[15px] ${
                state === "now" ? "border-white text-white" : state === "done" ? "border-acc/60 text-sky-100 hover:text-white" : "border-transparent text-sky-200/70"
              }`}
            >
              {state === "done" ? <Check size={16} className="text-emerald-300" /> : <span className={`grid h-6 w-6 place-items-center rounded-full text-[13px] ${state === "now" ? "bg-white text-indigo-900" : "bg-white/20"}`}>{i + 1}</span>}
              <span>{s.label}</span>
            </button>
          );
        })}
      </nav>

      {p.error && (
        <p className="relative z-10 border-b border-rose-300 bg-rose-600/80 px-4 py-2 text-[15px] font-semibold text-white" role="alert">
          {p.error}
        </p>
      )}

      <div key={step} className={`bf-scroll relative z-10 flex-1 px-4 py-4 sm:px-6 ${leaving ? "bf-step-out" : "bf-step-in"}`}>
        <div className="mx-auto max-w-[1320px]">
          {step === "campaign" && <CampaignSelect data={data} profile={p.profile} value={campaign} onChange={setCampaign} />}
          {step === "vessel" && <VesselSelect data={data} profile={p.profile} value={company} onChange={setCompany} freshness={freshness} onFreshness={setFreshness} />}
          {step === "modules" && <ExpansionSelect value={expansions} onChange={setExpansions} />}
        </div>
      </div>

      <footer className="relative z-10 flex items-center gap-3 border-t border-white/20 bg-indigo-950/40 px-3 py-2.5 sm:px-5">
        <button type="button" className="bf-btn !px-4" disabled={busy || idx === 0} onClick={() => (playBack(), go(BRIEF_STEPS[idx - 1]!.id))} aria-label="Back one step">
          <ChevronLeft size={18} /> <span className="hidden sm:inline">Back</span>
        </button>
        <div className="hidden min-w-0 flex-1 items-center gap-x-5 text-[14px] text-sky-100 md:flex">
          <span className="truncate">
            Campaign <b className="text-white">{loreOf(campaign).title}</b>
          </span>
          {reached >= 1 && (
            <span className="truncate">
              Vessel <b className="text-white">{co.name}</b>
            </span>
          )}
          {reached >= 2 && (
            <span className="truncate">
              Modules <b className="text-white">{modsText}</b>
            </span>
          )}
        </div>
        <div className="flex-1 md:hidden" />
        <button type="button" className="bf-btn bf-primary" disabled={busy} onClick={(e) => confirm(e.currentTarget)} data-action={step}>
          <action.Icon size={18} /> {action.label} {step !== "modules" && <ChevronRight size={18} />}
        </button>
      </footer>

      {launching && <LaunchOverlay lines={[["Campaign", loreOf(campaign).title], ["Vessel", co.name], ["Modules", modsText]]} />}

      {drawer && (
        <div className="absolute inset-0 z-[55] flex justify-end bg-indigo-950/60" onClick={() => setDrawer(false)}>
          <aside className="bf-scroll bf-step-in bf-solid h-full w-[min(92vw,400px)] border-l-2 border-white/40 p-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="System options">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold uppercase tracking-[0.12em] text-white">System options</h2>
              <button type="button" className="grid h-11 w-11 place-items-center rounded-full text-white hover:bg-white/15" aria-label="Close" onClick={() => setDrawer(false)}>
                <X size={22} />
              </button>
            </div>
            <div className="flex flex-col gap-3 text-[15px] text-white">
              <div className="bf-label">New game</div>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-sky-300" checked={p.autoAnswer} onChange={(e) => p.setAutoAnswer(e.target.checked)} /> Answer automatically when only one answer is legal
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-sky-300" checked={dev} onChange={(e) => setDev(e.target.checked)} /> Developer mode (unlimited undo, see hidden tiles, no high score)
              </label>
              <label className="flex items-center gap-2">
                Seed (optional)
                <input className="w-32 rounded-md border border-white/50 bg-indigo-950/50 px-2 py-1.5 text-white" style={{ userSelect: "text" }} value={seed} inputMode="numeric" onChange={(e) => setSeed(e.target.value.replace(/\D/g, ""))} placeholder="random" />
              </label>
              <div className="bf-label mt-2">Saved games</div>
              {p.onContinue && (
                <button type="button" className="bf-btn" onClick={p.onContinue}>
                  <Play size={16} /> Resume game
                </button>
              )}
              <button type="button" className="bf-btn" onClick={() => (setDrawer(false), p.onImport())}>
                Import a save file…
              </button>
              <button type="button" className="bf-btn" onClick={() => (setDrawer(false), p.onPaste())}>
                Paste a save…
              </button>
              {p.onContinue && <p className="text-[14px] text-sky-100">Launching a new campaign replaces the game in progress.</p>}
              <div className="bf-label mt-2">Style · intro and menu look</div>
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Style">
                {STYLES.map((x) => (
                  <button
                    key={x.id}
                    type="button"
                    role="radio"
                    aria-checked={x.id === style.id}
                    data-style-pick={x.id}
                    className={`bf-panel !p-3 text-left ${x.id === style.id ? "bf-sel" : ""}`}
                    onClick={() => (playSelect(), setBriefStyle(x.id))}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <b className="text-[16px] font-extrabold tracking-wider text-white">{x.name}</b>
                      {x.id === style.id && <Check size={18} className="text-emerald-300" />}
                    </span>
                    <span className="mt-0.5 block text-[14px] leading-snug text-sky-100">{x.note}</span>
                  </button>
                ))}
              </div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-sky-300"
                  checked={introOn}
                  onChange={(e) => {
                    setIntroMode(e.target.checked ? "short" : "off");
                    setIntroOn(e.target.checked);
                  }}
                />
                Play the intro when the game opens
              </label>
              <button type="button" className="bf-btn" onClick={() => (setDrawer(false), p.onReplayIntro())}>
                Replay the full intro of {style.name}
              </button>
              {p.onPreviewOutro && (
                <>
                  <div className="bf-label mt-2">Outro · after the last mission is won</div>
                  <button type="button" className="bf-btn" data-action="outro-preview" onClick={() => (setDrawer(false), p.onPreviewOutro?.(campaign, company))}>
                    Play the outro ({co.name})
                  </button>
                  <p className="text-[14px] text-sky-100">A preview with sample numbers. It uses the Company chosen on the Vessel step.</p>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

/** LAUNCH: the loadout is read back while the bar fills (under a second), then the game takes over. */
function LaunchOverlay({ lines }: { lines: [string, string][] }) {
  const total = ms(LAUNCH_MS);
  return (
    <div className="bf-lock" role="status" aria-live="polite" data-launching="1">
      <div className="bf-launch bf-solid w-[min(92vw,480px)] rounded-2xl border-2 border-white/60 p-5">
        <div className="bf-glow text-center text-lg font-extrabold uppercase tracking-[0.22em] text-white sm:text-xl">Launch</div>
        <ul className="m-0 mt-3 list-none p-0 text-[15px] text-white">
          {lines.map(([k, v]) => (
            <li key={k} className="flex items-center gap-2 border-b border-white/15 py-1.5">
              <Check size={16} className="shrink-0 text-emerald-300" />
              <span className="font-semibold uppercase tracking-wider text-sky-200">{k}</span>
              <span className="min-w-0 flex-1 truncate text-right font-bold">{v}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="bf-launch-bar h-full rounded-full bg-acc shadow-[0_0_14px_rgb(var(--acc))]" style={{ "--t": `${Math.max(total, 10)}ms` } as React.CSSProperties} />
        </div>
      </div>
    </div>
  );
}
