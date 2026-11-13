/**
 * The command briefing: the entry point before the game. Four steps (Campaign, Company vessel,
 * expansion modules, Threat Levels), then LAUNCH compiles the loadout and hands it to the parent.
 * This shell holds the state, the frame of the terminal and the transitions between steps.
 */

import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Lock, Play, Rocket, Settings, Volume2, VolumeX, X } from "lucide-react";
import type { GameData } from "../../data/index.js";
import type { Profile } from "../../engine/state.js";
import { CampaignSelect, loreOf } from "./CampaignSelect.js";
import { EXPANSION_INFO } from "./content.js";
import { ExpansionSelect } from "./ExpansionSelect.js";
import { LockOverlay, Visualizer, ms } from "./hud.js";
import { Logo } from "./IntroSequence.js";
import { type IntroMode, introMode, setIntroMode, setSoundOn, soundOn } from "./prefs.js";
import { cue } from "./sfx.js";
import { ThreatSetup, planDone, planPeak } from "./ThreatSetup.js";
import { BRIEF_STEPS, type BriefStep, CYAN, type Loadout, THREAT_RGB, type ThreatPlan } from "./types.js";
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

export function Briefing(p: BriefingProps) {
  const { data } = p;
  const [step, setStep] = useState<BriefStep>("campaign");
  const [reached, setReached] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [lock, setLock] = useState<{ title: string; sub: string } | undefined>();
  const [launching, setLaunching] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [sound, setSound] = useState(soundOn);
  const [intro, setIntro] = useState<IntroMode>(introMode);

  const [campaign, setCampaign] = useState(data.campaigns[0]!.prefix);
  const [company, setCompany] = useState(data.companies.companies[0]!.id);
  const [freshness, setFreshness] = useState<Loadout["freshness"]>("veteran");
  const [expansions, setExpansions] = useState<string[]>([]);
  const [plan, setPlan] = useState<ThreatPlan>({});
  const [dev, setDev] = useState(false);
  const [seed, setSeed] = useState("");

  const camp = data.campaigns.find((c) => c.prefix === campaign)!;
  const co = data.companies.byId.get(company)!;
  const idx = BRIEF_STEPS.findIndex((s) => s.id === step);
  const done = planDone(camp, plan);
  const ready = done === camp.missions.length;
  const busy = leaving || !!lock || launching;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (f: () => void, t: number) => void timers.current.push(setTimeout(f, ms(t)));

  function go(to: BriefStep): void {
    setLeaving(true);
    later(() => {
      setStep(to);
      setReached((r) => Math.max(r, BRIEF_STEPS.findIndex((s) => s.id === to)));
      setLeaving(false);
    }, 240);
  }
  /** A confirmed choice: the holographic lock closes on it, then the next step comes in. */
  function lockIn(title: string, sub: string, to: BriefStep): void {
    cue("lock");
    setLock({ title, sub });
    later(() => {
      setLock(undefined);
      go(to);
    }, 1150);
  }
  function confirm(): void {
    if (busy) return;
    if (step === "campaign") lockIn("CAMPAIGN LOCKED", loreOf(campaign).title.toUpperCase(), "vessel");
    else if (step === "vessel") lockIn("VESSEL LOCKED", co.name.toUpperCase(), "modules");
    else if (step === "modules") (cue("select"), go("threat"));
    else if (ready) {
      cue("launch");
      setLaunching(true);
      const loadout: Loadout = {
        campaign,
        company,
        freshness: hasMarks(p.profile, company) ? freshness : "fresh",
        expansions,
        threat: plan,
        developerMode: dev,
        seed: seed ? Number(seed) : Math.floor(Math.random() * 1e9),
      };
      later(() => p.onLaunch(loadout), 2100);
    }
  }

  const peak = planPeak(plan);
  const acc = step === "threat" && peak > 0 ? THREAT_RGB[peak]! : CYAN;
  const action =
    step === "campaign" ? { label: "Confirm campaign", Icon: Lock } : step === "vessel" ? { label: "Confirm vessel", Icon: Lock } : step === "modules" ? { label: "Continue", Icon: ChevronRight } : { label: "Launch command sequence", Icon: Rocket };
  const modsText = expansions.length ? expansions.map((x) => EXPANSION_INFO[x]?.name ?? x).join(", ") : "none";

  return (
    <main className="brief flex flex-col" style={{ "--acc": acc } as React.CSSProperties} data-step={step} data-busy={busy ? "1" : "0"}>
      <div className="bf-crt" />

      <header className="relative z-10 flex items-center gap-3 border-b border-acc/30 bg-black/40 px-3 py-2 sm:px-5">
        <Logo size={34} />
        <div className="min-w-0 flex-1">
          <h1 className="bf-glow truncate font-hud text-sm font-extrabold tracking-[0.28em] text-acc sm:text-base">APHELION 5</h1>
          <div className="bf-label hidden sm:block">Command briefing // CORP-SEC v4.2</div>
        </div>
        <span className="hidden sm:block">
          <Visualizer />
        </span>
        <button type="button" className="grid h-10 w-10 place-items-center text-acc" aria-label={sound ? "Sound on. Switch off" : "Sound off. Switch on"} aria-pressed={sound} onClick={() => (setSoundOn(!sound), setSound(!sound), !sound && cue("select"))}>
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} className="opacity-60" />}
        </button>
        {p.onContinue && (
          <button type="button" className="bf-btn !min-h-[38px] !px-3" style={{ "--acc": "251 191 36" } as React.CSSProperties} onClick={p.onContinue}>
            <Play size={14} /> <span className="hidden sm:inline">Resume session</span>
            <span className="sm:hidden">Resume</span>
          </button>
        )}
        <button type="button" className="grid h-10 w-10 place-items-center text-acc" aria-label="System options" aria-expanded={drawer} onClick={() => setDrawer(true)}>
          <Settings size={18} />
        </button>
      </header>

      <nav className="relative z-10 flex items-stretch border-b border-acc/20 bg-black/25 px-2 sm:px-5" aria-label="Briefing steps">
        {BRIEF_STEPS.map((s, i) => {
          const state = i === idx ? "now" : i <= reached ? "done" : "next";
          return (
            <button
              key={s.id}
              type="button"
              disabled={busy || i > reached || i === idx}
              aria-current={i === idx ? "step" : undefined}
              onClick={() => go(s.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-1 py-2 font-hud text-[10px] font-bold uppercase tracking-[0.14em] transition-colors sm:text-xs ${
                state === "now" ? "border-acc text-acc" : state === "done" ? "border-acc/30 text-slate-300 hover:text-acc" : "border-transparent text-slate-500"
              }`}
            >
              {i < idx || (state === "done" && i !== idx) ? <Check size={12} /> : <span className="opacity-70">0{i + 1}</span>}
              <span>{s.label}</span>
            </button>
          );
        })}
      </nav>

      {p.error && (
        <p className="relative z-10 border-b border-rose-500/50 bg-rose-950/60 px-4 py-2 text-sm text-rose-200" role="alert">
          {p.error}
        </p>
      )}

      <div key={step} className={`bf-scroll relative z-10 flex-1 px-4 py-4 sm:px-6 ${leaving ? "bf-step-out" : "bf-step-in"}`}>
        <div className="mx-auto max-w-[1280px]">
          {step === "campaign" && (
            <CampaignSelect
              data={data}
              profile={p.profile}
              value={campaign}
              onChange={(c) => {
                if (c !== campaign) setPlan({});
                setCampaign(c);
              }}
            />
          )}
          {step === "vessel" && <VesselSelect data={data} profile={p.profile} value={company} onChange={setCompany} freshness={freshness} onFreshness={setFreshness} />}
          {step === "modules" && <ExpansionSelect value={expansions} onChange={setExpansions} />}
          {step === "threat" && <ThreatSetup campaign={camp} plan={plan} onChange={setPlan} />}
        </div>
      </div>

      <footer className="relative z-10 flex items-center gap-3 border-t border-acc/30 bg-black/50 px-3 py-2.5 sm:px-5">
        <button type="button" className="bf-btn !px-3" disabled={busy || idx === 0} onClick={() => go(BRIEF_STEPS[idx - 1]!.id)} aria-label="Back one step">
          <ChevronLeft size={16} /> <span className="hidden sm:inline">Back</span>
        </button>
        <div className="hidden min-w-0 flex-1 items-center gap-x-4 font-hud text-[11px] uppercase tracking-wider text-slate-400 md:flex">
          <span className="truncate">
            Campaign <b className={reached >= 1 ? "text-acc" : "text-slate-200"}>{loreOf(campaign).title}</b>
          </span>
          {reached >= 1 && (
            <span className="truncate">
              Vessel <b className={reached >= 2 ? "text-acc" : "text-slate-200"}>{co.id}</b>
            </span>
          )}
          {reached >= 2 && (
            <span className="truncate">
              Modules <b className="text-acc">{modsText}</b>
            </span>
          )}
          {reached >= 3 && (
            <span className="truncate">
              Threat <b className="text-acc">{done}/{camp.missions.length}</b>
            </span>
          )}
        </div>
        <div className="flex-1 md:hidden" />
        {step === "threat" && !ready && <span className="font-hud text-[11px] uppercase tracking-wider text-amberhud">{camp.missions.length - done} to set</span>}
        <button type="button" className="bf-btn bf-primary" disabled={busy || (step === "threat" && !ready)} onClick={confirm} data-action={step}>
          <action.Icon size={16} /> {action.label}
        </button>
      </footer>

      {lock && <LockOverlay title={lock.title} sub={lock.sub} />}
      {launching && <LaunchOverlay lines={[["Campaign", loreOf(campaign).title], ["Vessel", `${co.id} ${co.name}`], ["Expansion bus", modsText], ["Threat plan", `${camp.missions.length} missions set`], ["Field link", "open"]]} />}

      {drawer && (
        <div className="absolute inset-0 z-[55] flex justify-end bg-black/60" onClick={() => setDrawer(false)}>
          <aside className="bf-scroll bf-step-in h-full w-[min(92vw,380px)] border-l border-acc/40 bg-metal-900/95 p-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="System options">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-hud text-sm font-bold uppercase tracking-[0.2em] text-acc">System options</h2>
              <button type="button" className="grid h-10 w-10 place-items-center text-acc" aria-label="Close" onClick={() => setDrawer(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-3 text-[13px] text-slate-200">
              <div className="bf-label">New game</div>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5 accent-cyan-400" checked={p.autoAnswer} onChange={(e) => p.setAutoAnswer(e.target.checked)} /> Answer automatically when only one answer is legal
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5 accent-cyan-400" checked={dev} onChange={(e) => setDev(e.target.checked)} /> Developer mode (unlimited undo, see hidden tiles, no high score)
              </label>
              <label className="flex items-center gap-2">
                Seed (optional)
                <input className="w-32 border border-acc/40 bg-black/40 px-2 py-1 font-hud text-slate-100" value={seed} inputMode="numeric" onChange={(e) => setSeed(e.target.value.replace(/\D/g, ""))} placeholder="random" />
              </label>
              <div className="bf-label mt-2">Saved games</div>
              {p.onContinue && (
                <button type="button" className="bf-btn" onClick={p.onContinue}>
                  <Play size={14} /> Resume session
                </button>
              )}
              <button type="button" className="bf-btn" onClick={() => (setDrawer(false), p.onImport())}>
                Import a save file…
              </button>
              <button type="button" className="bf-btn" onClick={() => (setDrawer(false), p.onPaste())}>
                Paste a save…
              </button>
              {p.onContinue && <p className="text-xs text-slate-400">Launching a new campaign replaces the game in progress.</p>}
              <div className="bf-label mt-2">Terminal</div>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-cyan-400"
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
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5 accent-cyan-400" checked={sound} onChange={(e) => (setSoundOn(e.target.checked), setSound(e.target.checked))} /> Sound cues
              </label>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

/** LAUNCH: the loadout is read back line by line while the bar fills, then the game takes over. */
function LaunchOverlay({ lines }: { lines: [string, string][] }) {
  const total = ms(2100);
  return (
    <div className="bf-lock" role="status" aria-live="polite" data-launching="1">
      <div className="w-[min(92vw,520px)] px-2">
        <div className="bf-glow text-center font-hud text-base font-extrabold uppercase tracking-[0.3em] text-acc sm:text-xl">Launch command sequence</div>
        <ul className="m-0 mt-4 list-none p-0 font-hud text-xs text-slate-200 sm:text-sm">
          {lines.map(([k, v], i) => (
            <li key={k} className="bf-rise flex items-center gap-2 border-b border-acc/15 py-1.5" style={{ "--i": i * 4 } as React.CSSProperties}>
              <Check size={14} className="shrink-0 text-emerald-300" />
              <span className="uppercase tracking-widest text-slate-400">{k}</span>
              <span className="min-w-0 flex-1 truncate text-right">{v}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 h-1.5 bg-acc/15">
          <div className="bf-launch-bar h-full bg-acc shadow-[0_0_14px_rgb(var(--acc))]" style={{ "--t": `${Math.max(total, 10)}ms` } as React.CSSProperties} />
        </div>
        <div className="bf-blink mt-2 text-center font-hud text-[10px] uppercase tracking-[0.3em] text-acc">Compiling loadout</div>
      </div>
      <div className="fl" style={{ animationDelay: `${Math.max(total - 350, 0)}ms` }} />
    </div>
  );
}
