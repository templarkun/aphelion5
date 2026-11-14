/**
 * Mission Preparation on its own screen, in the briefing's look (designer 2026-11-14, round 2):
 * the Threat (7.2 step 3), the Module draw (step 6) and the Allied Drop's Ally and Mecha (step 9,
 * 7.3) are each asked here before the Field is shown. Every screen only answers the engine's own
 * question with one of its options; no rule lives here.
 */

import { useState } from "react";
import { Check, Handshake, Package, ShieldAlert } from "lucide-react";
import type { GameData } from "../../data/index.js";
import type { Question } from "../../engine/questions.js";
import type { GameState } from "../../engine/state.js";
import { moduleDef } from "../../engine/modules.js";
import { sortedModules } from "../App.js";
import { ModuleCard } from "../Modules.js";
import { planInfo, type PlanInfo, type Slot } from "../modulePlan.js";
import { AmbientLayer, FxLayer, ambientKick } from "./fx.js";
import { hoverHook, ms, Readout, tapSpark } from "./hud.js";
import { isThreatQuestion } from "./launch.js";
import { missionLabel } from "./missionText.js";
import { burstFrom, ring, sparkEdges } from "./particles.js";
import { playConfirm, playOpenInfo, playSelect } from "./soundHooks.js";
import { ThreatScreen } from "./ThreatScreen.js";
import { SKY } from "./types.js";
import { UnitCard } from "./UnitCard.js";
import { levelOf } from "./unitFacts.js";
import { UnitTile } from "./UnitTile.js";

export const MODULE_PROMPT = "Draw a Module: keep one.";
const ALLY_PROMPT = "Allied Drop: choose your Ally";
const ALLY_MECHA = /^Allied Drop - Level (\d+): choose a Mecha/;

type OptionQ = Question & { kind: "option" };

export type PrepKind = "threat" | "module" | "ally" | "allyMecha";

/** Is this question one of the Mission Preparation screens? */
export function prepKind(q: Question | undefined): PrepKind | undefined {
  if (!q) return undefined;
  if (isThreatQuestion(q)) return "threat";
  if (q.kind !== "option") return undefined;
  if (q.prompt === MODULE_PROMPT) return "module";
  if (q.prompt.startsWith(ALLY_PROMPT)) return "ally";
  if (ALLY_MECHA.test(q.prompt)) return "allyMecha";
  return undefined;
}

type Props = { data: GameData; state: GameState; q: Question; onAnswer: (kind: "several" | "option", value: string | string[]) => void };

export function MissionPrep({ data, state, q, onAnswer }: Props) {
  const kind = prepKind(q)!;
  const [acc, setAcc] = useState(SKY);
  const camp = data.campaigns.find((c) => c.prefix === state.campaign);
  const m = camp?.missionById.get(state.mission ?? "");
  const drop = m?.event.type === "allied_drop";
  // The steps of this mission's preparation that get a screen.
  const steps: [PrepKind[], string, typeof Package][] = [
    [["threat"], "Threat", ShieldAlert],
    [["module"], "Module", Package],
    ...(drop ? ([[["ally", "allyMecha"], "Allied Drop", Handshake]] as [PrepKind[], string, typeof Package][]) : []),
  ];
  const at = steps.findIndex((x) => x[0].includes(kind));
  const ribbon = (
    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1" aria-label="Mission Preparation steps">
      <span className="bf-label mr-1">{m ? missionLabel(m) : "Mission"} · preparation</span>
      {steps.map(([, name, Icon], i) => (
        <span key={name} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-extrabold uppercase tracking-wider ${i === at ? "bg-acc text-indigo-950" : i < at ? "bg-white/20 text-white" : "bg-white/5 text-sky-200/70"}`} data-prep-step={i === at ? "now" : i < at ? "done" : "next"}>
          {i < at ? <Check size={13} /> : <Icon size={13} />} {name}
        </span>
      ))}
    </div>
  );
  return (
    <div className="brief bf-ingame flex flex-col" style={{ "--acc": acc } as React.CSSProperties} data-prep={kind} onPointerOver={hoverHook} onPointerDown={tapSpark}>
      <AmbientLayer rgb={acc} />
      <FxLayer />
      {kind === "threat" && isThreatQuestion(q) ? (
        <ThreatScreen key={`${state.mission}`} data={data} state={state} q={q} setAcc={setAcc} steps={ribbon} onAnswer={(cols) => onAnswer("several", cols)} />
      ) : kind === "module" ? (
        <ModulePick key={q.prompt} data={data} state={state} q={q as OptionQ} steps={ribbon} setAcc={setAcc} onAnswer={(id) => onAnswer("option", id)} />
      ) : (
        <AllyPick key={q.prompt} data={data} state={state} q={q as OptionQ} steps={ribbon} setAcc={setAcc} mecha={kind === "allyMecha"} onAnswer={(id) => onAnswer("option", id)} />
      )}
    </div>
  );
}

/** The frame every preparation screen shares: a scrolling body and a footer with the confirm button. */
function Frame(p: { children: React.ReactNode; status: React.ReactNode; button: React.ReactNode; data?: Record<string, string> }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col" {...p.data}>
      <div className="bf-scroll relative z-10 flex-1 px-3 py-3 sm:px-6 sm:py-4">
        <div className="bf-step-in mx-auto max-w-[1320px]">{p.children}</div>
      </div>
      <footer className="relative z-10 flex items-center gap-3 border-t border-white/20 bg-indigo-950/40 px-3 py-2.5 sm:px-5">
        <div className="min-w-0 flex-1 text-[14px] text-sky-100">{p.status}</div>
        {p.button}
      </footer>
    </div>
  );
}

function Head({ title, help }: { title: string; help: string }) {
  return (
    <header className="mb-3">
      <h2 className="bf-glow text-xl font-extrabold uppercase tracking-[0.08em] text-white sm:text-3xl">{title}</h2>
      <p className="mt-0.5 max-w-2xl text-[15px] text-sky-100">{help}</p>
    </header>
  );
}

/** Send the answer after a short lock-in flash. */
function useSend(onAnswer: (id: string) => void, acc: string) {
  const [sent, setSent] = useState(false);
  const send = (id: string) => {
    if (sent) return;
    setSent(true);
    playConfirm();
    ambientKick(1);
    ring(innerWidth / 2, innerHeight / 2, acc, 1100, 0.4, 36);
    setTimeout(() => onAnswer(id), ms(240));
  };
  return [sent, send] as const;
}

const MOD_RGB: Record<string, string> = { Yellow: "253 224 71", Red: "251 113 133", Blue: "125 211 252" };

/** A Module card exactly as in the Modules panel: the drawn one has no energy on it yet. */
function slotsOf(data: GameData, id: number): PlanInfo {
  const d = data.modules.byId.get(id)!;
  const cost = d.cost === "X" ? 0 : Number(d.cost);
  const slots: Slot[] = Array.from({ length: cost }, () => ({ colour: d.colour, part: "cost", fill: "empty" }));
  return { cost, heat: 0, slots };
}

function ModulePick({ data, state, q, steps, setAcc, onAnswer }: { data: GameData; state: GameState; q: OptionQ; steps: React.ReactNode; setAcc: (x: string) => void; onAnswer: (id: string) => void }) {
  const c = { data, state };
  const [pick, setPick] = useState<string | undefined>();
  const [sent, send] = useSend(onAnswer, SKY);
  const chosen = pick !== undefined ? moduleDef(c, Number(pick)) : undefined;
  const select = (id: string, el: Element) => {
    if (sent) return;
    playSelect();
    const col = moduleDef(c, Number(id)).colour;
    sparkEdges(el, MOD_RGB[col]!);
    setPick(id);
    setAcc(MOD_RGB[col]!);
  };
  const own = sortedModules(c, state.player.modules);
  return (
    <Frame
      data={{ "data-module-pick": String(q.options.length) }}
      status={chosen ? <span>Keep <b className="text-white">{chosen.name}</b></span> : <span className="font-semibold text-amber-200">Tap the Module to keep</span>}
      button={
        <button type="button" className="bf-btn bf-primary" disabled={pick === undefined || sent} onClick={() => pick !== undefined && send(pick)} data-action="prep">
          <Check size={18} /> Keep this Module
        </button>
      }
    >
      {steps}
      <Head title="Draw a Module" help={`The top ${q.options.length} of the Module deck. Keep one; the others go to the bottom of the deck in random order.`} />
      <div className="bf-game-skin grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3" role="radiogroup" aria-label="Modules drawn">
        {q.options.map((o, i) => {
          const id = Number(o.id);
          const d = moduleDef(c, id);
          const on = pick === o.id;
          return (
            <div key={o.id} className={`bf-rise bf-modslot ${on ? "on" : ""}`} style={{ "--i": i * 2, "--m": MOD_RGB[d.colour] } as React.CSSProperties} role="radio" aria-checked={on} data-prep-pick={o.id} onClick={(e) => select(o.id, e.currentTarget)}>
              <ModuleCard def={d} id={id} ready info={slotsOf(data, id)} can selected={on} dim={pick !== undefined && !on} extraClass="" />
              <div className="mt-1 flex flex-wrap gap-x-3 px-1 text-[13px] text-sky-100">
                <span>
                  Cost <b className="text-white">{d.cost}</b> {d.colour}
                </span>
                <span>{d.background === "red" ? "Overload Module" : "Command phase"}</span>
                {d.extraPayment && <span>Extra: {d.extraPayment}</span>}
              </div>
            </div>
          );
        })}
      </div>
      {own.length > 0 && (
        <section className="bf-panel mt-4 p-3" aria-label="Your Modules">
          <div className="bf-label mb-1">Your Modules · {own.length}</div>
          <div className="bf-game-skin grid grid-cols-[minmax(0,1fr)] gap-x-3 sm:grid-cols-2 lg:grid-cols-4">
            {own.map((x) => (
              <ModuleCard key={x.id} def={moduleDef(c, x.id)} id={x.id} ready={x.ready} info={planInfo(c, x.id)} can={false} selected={false} dim={false} extraClass="" />
            ))}
          </div>
        </section>
      )}
    </Frame>
  );
}

function AllyPick({ data, state, q, steps, setAcc, mecha, onAnswer }: { data: GameData; state: GameState; q: OptionQ; steps: React.ReactNode; setAcc: (x: string) => void; mecha: boolean; onAnswer: (id: string) => void }) {
  const [pick, setPick] = useState<string | undefined>();
  const [open, setOpen] = useState<{ id: string; co?: string | undefined } | undefined>();
  const [sent, send] = useSend(onAnswer, "251 191 36");
  const camp = data.campaigns.find((x) => x.prefix === state.campaign);
  const drops = camp?.missions.filter((x) => x.event.type === "allied_drop") ?? [];
  const lvl = Number(ALLY_MECHA.exec(q.prompt)?.[1] ?? 0);
  const ally = mecha && state.sheet.ally ? data.companies.byId.get(state.sheet.ally) : undefined;
  const select = (id: string, el: Element) => {
    if (sent) return;
    playSelect();
    sparkEdges(el, "251 191 36");
    setPick(id);
    setAcc("251 191 36");
  };
  const label = mecha ? (pick ? `Drop ${pick}` : undefined) : pick ? `Ally ${data.companies.byId.get(pick)?.name ?? pick}` : undefined;
  return (
    <Frame
      data={{ "data-ally-pick": mecha ? "mecha" : "company" }}
      status={label ? <b className="text-white">{label}</b> : <span className="font-semibold text-amber-200">{mecha ? "Tap the Mecha to drop" : "Tap the Company to call"}</span>}
      button={
        <button type="button" className="bf-btn bf-primary" disabled={pick === undefined || sent} onClick={() => pick !== undefined && send(pick)} data-action="prep">
          <Check size={18} /> {mecha ? "Drop this Mecha" : "Choose this Ally"}
        </button>
      }
    >
      {steps}
      {mecha ? (
        <Head title={`Allied Drop · Level ${lvl}`} help={`${ally ? `${ally.name} sends` : "Your Ally sends"} one Mecha of Level ${lvl} or lower. After this you place it on a Dark sector of the Field.`} />
      ) : (
        <Head title="Choose your Ally" help={`For the whole Campaign. At each Allied Drop it sends you one of its Mecha${drops.length ? ` (${drops.map((x) => `${missionLabel(x)}: Level ${x.event.type === "allied_drop" ? x.event.level : ""}`).join(" · ")})` : ""}.`} />
      )}
      {mecha ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Mecha to drop">
          {q.options.map((o, i) => {
            const u = data.units.byId.get(o.id);
            if (!u) return null;
            const ab = /^(Command|Passive|Expend):\s*(.*)$/s.exec(u.text.ability ?? "");
            const on = pick === o.id;
            return (
              <button key={o.id} type="button" role="radio" aria-checked={on} data-prep-pick={o.id} className={`bf-panel bf-rise flex min-w-0 items-start gap-3 !p-3 text-left ${on ? "bf-sel" : ""}`} style={{ "--i": i } as React.CSSProperties} onClick={(e) => select(o.id, e.currentTarget)}>
                <span className="shrink-0">
                  <UnitTile unit={u} level={levelOf(u)} size={96} />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-xl font-extrabold tracking-wide text-white">{u.id}</span>
                  <span className="text-[14px] text-sky-100">
                    Level <b className="text-white">{levelOf(u)}</b>
                  </span>
                  <span className="text-[15px] leading-snug text-white">
                    <b className="text-orange-200">{ab ? ab[1] : "Ability"}.</b> {ab ? ab[2] : u.text.ability ?? "No ability."}
                  </span>
                  <span
                    role="link"
                    tabIndex={0}
                    className="text-[13px] font-semibold text-acc underline"
                    onClick={(e) => (e.stopPropagation(), playOpenInfo(), setOpen({ id: o.id }))}
                  >
                    Read its card
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2" role="radiogroup" aria-label="Companies to call">
          {q.options.map((o, i) => {
            const co = data.companies.byId.get(o.id);
            if (!co) return null;
            const on = pick === o.id;
            return (
              <button key={o.id} type="button" role="radio" aria-checked={on} data-prep-pick={o.id} className={`bf-panel bf-rise flex min-w-0 flex-col gap-2 !p-3 text-left ${on ? "bf-sel" : ""}`} style={{ "--i": i } as React.CSSProperties} onClick={(e) => select(o.id, e.currentTarget)}>
                <span className="flex items-center justify-between">
                  <span className="bf-label">Company {co.id}</span>
                  <Handshake size={18} className="text-acc" />
                </span>
                <span className="text-xl font-extrabold uppercase tracking-wide text-white">{co.name}</span>
                <Readout label="Its Mecha · what an Allied Drop can bring">
                  <span className="mt-1 flex flex-wrap gap-1">
                    {co.startingMecha.map((x) => {
                      const u = data.units.byId.get(x.id);
                      if (!u) return null;
                      return (
                        <span
                          key={x.id}
                          role="link"
                          tabIndex={0}
                          className="bf-unit !p-0.5"
                          data-unit={x.id}
                          onClick={(e) => (e.stopPropagation(), playOpenInfo(), burstFrom(e.currentTarget, { rgb: "253 186 116", count: 10, speed: 120 }), setOpen({ id: x.id, co: co.id }))}
                          aria-label={`Mecha ${x.id}: open its card`}
                        >
                          <UnitTile unit={u} level={levelOf(u)} size={60} />
                          <b className="!text-[12px]">{x.id}</b>
                        </span>
                      );
                    })}
                  </span>
                </Readout>
                <Readout label="Company trait">
                  <span className="font-normal">{co.trait ?? "None"}</span>
                </Readout>
              </button>
            );
          })}
        </div>
      )}
      {open && (
        <UnitCard
          data={data}
          id={open.id}
          company={mecha ? ally : open.co ? data.companies.byId.get(open.co) : undefined}
          list={mecha ? q.options.map((o) => o.id) : open.co ? data.companies.byId.get(open.co)?.startingMecha.map((x) => x.id) : undefined}
          onPick={(id) => setOpen({ ...open, id })}
          onClose={() => setOpen(undefined)}
        />
      )}
    </Frame>
  );
}
