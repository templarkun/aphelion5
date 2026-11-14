/** Step 2: the Company and its Flagship. Its Mecha, big and readable, its Bays, trait and numbers. */

import { useEffect, useRef, useState } from "react";
import { Lock, Rocket, Star, Wrench } from "lucide-react";
import type { GameData } from "../../data/index.js";
import type { Profile } from "../../engine/state.js";
import { COMPANY_SLOTS } from "./content.js";
import { Readout, StepHead } from "./hud.js";
import { burstFrom, setEmitter, sparkEdges } from "./particles.js";
import { playOpenInfo, playSelect } from "./soundHooks.js";
import type { Loadout } from "./types.js";
import { UnitCard } from "./UnitCard.js";
import { levelOf } from "./unitFacts.js";
import { UnitTile } from "./UnitTile.js";
import { VesselSchematic } from "./VesselSchematic.js";

const ENERGY = [
  ["Yellow", "#fde047"],
  ["Red", "#fb7185"],
  ["Blue", "#7dd3fc"],
] as const;
const KIND: Record<string, string> = { command: "Command", expend: "Expend", passive: "Passive" };

/** Does this Company's sheet carry upgrade marks from earlier games (Core Rules 7.1 step 3)? */
export function hasMarks(profile: Profile, company: string): boolean {
  return Object.values(profile.sheets[company] ?? {}).some((n) => n > 0);
}

export function VesselSelect(p: { data: GameData; profile: Profile; value: string; onChange: (id: string) => void; freshness: Loadout["freshness"]; onFreshness: (f: Loadout["freshness"]) => void }) {
  const cos = p.data.companies.companies;
  const cur = cos.find((c) => c.id === p.value) ?? cos[0]!;
  const [bay, setBay] = useState<number | undefined>();
  const [open, setOpen] = useState<string | undefined>();
  const locked = Math.max(0, COMPANY_SLOTS - cos.length);
  const marked = hasMarks(p.profile, cur.id);
  // Thruster glow drifts down from the chosen Company's card.
  const sel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setEmitter("vessel", sel.current, "thruster", "125 211 252", 11);
    return () => setEmitter("vessel", null);
  }, [cur.id]);
  const mechaIds = cur.startingMecha.map((m) => m.id);
  return (
    <div>
      <StepHead code="Step 2 of 3" title="Select Company Vessel" help="One Company, its Flagship and its Mecha carry you through the whole Campaign." />
      <div className="bf-scroll -mx-4 flex snap-x gap-2.5 px-4 pb-3 pt-1 sm:mx-0 sm:px-1" role="radiogroup" aria-label="Companies">
        {cos.map((c, i) => {
          const on = c.id === cur.id;
          return (
            <button
              key={c.id}
              ref={on ? sel : undefined}
              type="button"
              role="radio"
              aria-checked={on}
              data-company={c.id}
              onClick={(e) => (playSelect(), sparkEdges(e.currentTarget, "125 211 252"), p.onChange(c.id), setBay(undefined))}
              className={`bf-panel bf-rise w-[240px] shrink-0 snap-start !p-3 ${on ? "bf-sel" : ""}`}
              style={{ "--i": i } as React.CSSProperties}
            >
              <div className="flex items-center justify-between">
                <span className="bf-label">Company {c.id}</span>
                <Rocket size={18} className={`text-acc ${on ? "" : "opacity-60"}`} />
              </div>
              <div className="mt-0.5 text-lg font-extrabold uppercase tracking-wide text-white">{c.name}</div>
              <div className="mt-0.5 text-[14px] text-sky-100">
                {c.bays.length} Bays · {c.startingMecha.reduce((n, m) => n + m.count, 0)} Mecha
                {hasMarks(p.profile, c.id) && <Star size={14} className="ml-1.5 inline text-amber-300" aria-label="has upgrade marks" />}
              </div>
            </button>
          );
        })}
        {Array.from({ length: locked }, (_, i) => (
          <div key={i} className="bf-panel bf-soon bf-rise w-[150px] shrink-0 snap-start p-3" style={{ "--i": cos.length + i } as React.CSSProperties} aria-label="Company not yet available">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wider">Company V{cos.length + i + 1}</span>
              <Lock size={15} />
            </div>
            <div className="mt-1 text-[15px] font-bold uppercase tracking-wider">Coming later</div>
          </div>
        ))}
      </div>

      <section key={cur.id} className="bf-step-in grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]" aria-label={`${cur.name}`}>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="bf-panel p-3 sm:p-4" data-mecha-bay={cur.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h3 className="text-lg font-extrabold uppercase tracking-wider text-white">Your Mecha</h3>
              <span className="text-[14px] text-sky-100">You start with these · tap one to read it</span>
            </div>
            <div className="mt-2 flex flex-wrap justify-around gap-x-2 gap-y-3">
              {cur.startingMecha.map((m, i) => {
                const u = p.data.units.byId.get(m.id);
                if (!u) return null;
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="bf-unit bf-rise !px-2"
                    style={{ "--i": i * 2 } as React.CSSProperties}
                    data-unit={m.id}
                    onClick={(e) => (playOpenInfo(), burstFrom(e.currentTarget, { rgb: "253 186 116", count: 12, speed: 130 }), setOpen(m.id))}
                    aria-label={`Mecha ${m.id}, ${m.count} to start: open its card`}
                  >
                    <UnitTile unit={u} level={levelOf(u)} size={108} count={m.count} />
                    <b className="!text-[16px]">{m.id}</b>
                    <span className="text-[13px] font-semibold text-orange-200">
                      {KIND[u.abilityKind ?? ""] ?? "Mecha"} · ×{m.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="bf-panel p-3 sm:p-4">
            <div className="bf-label">Company {cur.id} · Flagship</div>
            <h3 className="text-xl font-extrabold uppercase tracking-wide text-white">{cur.name}</h3>
            <div className="mt-2 overflow-hidden rounded-xl bg-indigo-950/40">
              <VesselSchematic company={cur} bay={bay} onBay={setBay} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Readout label="Integrity">{cur.totalIntegrity}</Readout>
              <Readout label="Bays">{cur.bays.length}</Readout>
              <Readout label="Overhauls">
                <span className="inline-flex items-center gap-1">
                  <Wrench size={14} className="text-acc" /> {cur.overhaulSlots}
                </span>
              </Readout>
              <Readout label="Upgrades">{cur.upgrades.length}</Readout>
            </div>
          </div>
        </div>

        <div className="bf-panel flex min-w-0 flex-col gap-3 p-3 sm:p-4">
          <Readout label="Company trait">
            <span className="font-normal">{cur.trait ?? "None"}</span>
          </Readout>
          <div>
            <div className="bf-label mb-1.5">Bays · their abilities</div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {cur.bays.map((b) => (
                <li key={b.id} onPointerEnter={() => setBay(b.number)} onPointerLeave={() => setBay(undefined)} className={`rounded-lg px-3 py-2 transition-colors ${bay === b.number ? "bg-acc/30" : "bg-white/10"}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-extrabold text-acc">BAY {b.number}</span>
                    <span className="flex gap-[3px]" role="img" aria-label={`Integrity ${b.integrity}`}>
                      {Array.from({ length: b.integrity }, (_, k) => (
                        <i key={k} className="block h-3 w-2 rounded-sm bg-emerald-300" />
                      ))}
                    </span>
                    <span className="text-[13px] text-sky-100">Integrity {b.integrity}</span>
                  </div>
                  <div className="text-[15px] text-white">{b.ability}</div>
                </li>
              ))}
            </ul>
          </div>
          <Readout label="Starting energy">
            <span className="flex flex-wrap gap-4">
              {ENERGY.map(([col, hex]) => (
                <span key={col} className="inline-flex items-center gap-1.5">
                  <i className="block h-3.5 w-3.5 rotate-45 rounded-[2px]" style={{ background: hex, boxShadow: `0 0 8px ${hex}` }} />
                  {cur.startingEnergy[col]} <span className="font-normal text-sky-100">{col}</span>
                </span>
              ))}
            </span>
          </Readout>
          {marked && (
            <div className="rounded-xl border-2 border-amber-300/70 bg-amber-300/10 p-3" role="radiogroup" aria-label="Upgrade marks from earlier games">
              <div className="text-[14px] font-bold text-amber-200">This sheet has upgrade marks from earlier games</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["veteran", "fresh"] as const).map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={p.freshness === f} data-freshness={f} onClick={() => (playSelect(), p.onFreshness(f))} className={`bf-panel !p-2.5 text-[14px] ${p.freshness === f ? "bf-sel" : ""}`}>
                    <b className="uppercase tracking-wider text-white">{f === "veteran" ? "Veteran ★" : "Fresh"}</b>
                    <span className="block text-sky-100">{f === "veteran" ? "Keep all upgrade marks" : "Erase every mark on this sheet"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {open && <UnitCard data={p.data} id={open} company={cur} count={cur.startingMecha.find((m) => m.id === open)?.count} list={mechaIds} onPick={setOpen} onClose={() => setOpen(undefined)} />}
    </div>
  );
}
