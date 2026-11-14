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
import { LockOverlay, hoverHook, ms, tapSpark } from "./hud.js";
import { Logo } from "./IntroSequence.js";
import { burst, burstFrom, ring } from "./particles.js";
import { type IntroMode, introMode, setIntroMode } from "./prefs.js";
import { playBack, playConfirm, playLaunch, playTransition } from "./soundHooks.js";
import { BRIEF_STEPS, type BriefStep, type Loadout, SKY } from "./types.js";
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
}

/** Confirm animations are short (designer 2026-11-14). */
const STEP_OUT = 120;
const LOCK_MS = 430;
const LAUNCH_MS = 850;

export function Briefing(p: BriefingProps) {
  const { data } = p;
  const [step, setStep] = useState<BriefStep>("campaign");
  const [reached, setReached] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [lock, setLock] = useState<{ title: string; sub: string } | undefined>();
  const [launching, setLaunching] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [intro, setIntro] = useState<IntroMode>(introMode);

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
  /** A confirmed choice: the holographic lock snaps shut on it, then the next step comes in. */
  function lockIn(title: string, sub: string, to: BriefStep): void {
    playConfirm();
    ring(innerWidth / 2, innerHeight / 2, SKY, 900, 0.4, 40);
    burst(innerWidth / 2, innerHeight / 2, { count: 40, speed: 520, life: 0.5, rgb: "255 255 255", shape: "streak", size: 3 });
    setLock({ title, sub });
    later(() => {
      setLock(undefined);
      go(to);
    }, LOCK_MS);
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
      later(() => p.onLaunch(loadout), LAUNCH_MS);
    }
  }

  const action = step === "campaign" ? { label: "Confirm campaign", Icon: Check } : step === "vessel" ? { label: "Confirm vessel", Icon: Check } : { label: "Launch command sequence", Icon: Rocket };
  const modsText = expansions.length ? expansions.map((x) => EXPANSION_INFO[x]?.name ?? x).join(", ") : "none";

  return (
    <main className="brief flex flex-col" style={{ "--acc": SKY } as React.CSSProperties} data-step={step} data-busy={busy ? "1" : "0"} onPointerOver={hoverHook} onPointerDown={tapSpark}>
      <AmbientLayer rgb={SKY} />
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

      {lock && <LockOverlay title={lock.title} sub={lock.sub} />}
      {launching && <LaunchOverlay lines={[["Campaign", loreOf(campaign).title], ["Vessel", co.name], ["Modules", modsText]]} />}

      {drawer && (
        <div className="absolute inset-0 z-[55] flex justify-end bg-indigo-950/60" onClick={() => setDrawer(false)}>
          <aside className="bf-scroll bf-step-in h-full w-[min(92vw,400px)] border-l-2 border-white/40 bg-[#27358f] p-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="System options">
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
              <div className="bf-label mt-2">Intro</div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-sky-300"
                  checked={intro !== "off"}
                  onChange={(e) => {
                    const m: IntroMode = e.target.checked ? "short" : "off";
                    setIntroMode(m);
                    setIntro(m);
                  }}
                />
                Play the intro when the game opens
              </label>
              <button type="button" className="bf-btn" onClick={() => (setDrawer(false), p.onReplayIntro())}>
                Replay the full intro
              </button>
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
      <div className="w-[min(92vw,480px)] rounded-2xl border-2 border-white/60 bg-[#27358f]/95 p-5">
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
