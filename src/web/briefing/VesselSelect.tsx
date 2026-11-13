/** Step 2: the Company / Flagship Vessel Bay. One Company, with its wireframe and its numbers. */

import { useState } from "react";
import { Lock, Rocket, Star, Wrench } from "lucide-react";
import type { CompanyDef } from "../../data/company.js";
import type { GameData } from "../../data/index.js";
import type { Profile } from "../../engine/state.js";
import { UnitGlyph } from "../UnitGlyph.js";
import { COMPANY_SLOTS } from "./content.js";
import { Readout, StepHead } from "./hud.js";
import { cue } from "./sfx.js";
import type { Loadout } from "./types.js";
import { VesselSchematic } from "./VesselSchematic.js";

const ENERGY = [
  ["Yellow", "#facc15"],
  ["Red", "#f43f5e"],
  ["Blue", "#38bdf8"],
] as const;

/** Does this Company's sheet carry upgrade marks from earlier games (Core Rules 7.1 step 3)? */
export function hasMarks(profile: Profile, company: string): boolean {
  return Object.values(profile.sheets[company] ?? {}).some((n) => n > 0);
}

export function VesselSelect(p: { data: GameData; profile: Profile; value: string; onChange: (id: string) => void; freshness: Loadout["freshness"]; onFreshness: (f: Loadout["freshness"]) => void }) {
  const cos = p.data.companies.companies;
  const cur = cos.find((c) => c.id === p.value) ?? cos[0]!;
  const [bay, setBay] = useState<number | undefined>();
  const locked = Math.max(0, COMPANY_SLOTS - cos.length);
  const marked = hasMarks(p.profile, cur.id);
  return (
    <div>
      <StepHead code="STEP 02 // FLAGSHIP VESSEL BAY" title="Select Company Vessel" help="One Company and its Flagship carry you through the whole Campaign." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,8fr)]">
        <div className="bf-scroll -mx-4 flex snap-x gap-2 px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" role="radiogroup" aria-label="Companies">
          {cos.map((c, i) => {
            const on = c.id === cur.id;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                data-company={c.id}
                onClick={() => (cue("select"), p.onChange(c.id), setBay(undefined))}
                className={`bf-panel bf-rise min-w-[62%] snap-start !p-3 sm:min-w-[36%] lg:min-w-0 ${on ? "bf-sel" : "hover:border-acc/70"}`}
                style={{ "--i": i } as React.CSSProperties}
              >
                <div className="flex items-center justify-between">
                  <span className="bf-label">Hull {c.id}</span>
                  <Rocket size={14} className={`text-acc ${on ? "" : "opacity-50"}`} />
                </div>
                <div className="mt-1 font-hud text-sm font-bold uppercase tracking-wider text-slate-50">{c.name}</div>
                <div className="mt-1 text-xs text-slate-300/80">
                  {c.bays.length} Bays · Integrity {c.totalIntegrity}
                  {hasMarks(p.profile, c.id) && <Star size={11} className="ml-1.5 inline text-amberhud" aria-label="has upgrade marks" />}
                </div>
              </button>
            );
          })}
          {Array.from({ length: locked }, (_, i) => (
            <div key={i} className="bf-panel bf-static bf-rise min-w-[44%] snap-start p-3 opacity-60 sm:min-w-[28%] lg:min-w-0" style={{ "--i": cos.length + i } as React.CSSProperties} aria-label="Company not yet available">
              <div className="flex items-center justify-between">
                <span className="bf-label !text-slate-400">Hull V{cos.length + i + 1}</span>
                <Lock size={13} className="text-slate-500" />
              </div>
              <div className="mt-1 font-hud text-sm font-bold uppercase tracking-wider text-slate-500">Dry dock</div>
              <div className="bf-label mt-1 !text-slate-500">Under construction</div>
            </div>
          ))}
        </div>

        <section key={cur.id} className="bf-panel bf-step-in p-3 sm:p-4" aria-label={`${cur.name} schematic`}>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
            <div>
              <div className="bf-label">Company {cur.id} // Flagship schematic</div>
              <h3 className="bf-glow font-hud text-lg font-bold uppercase tracking-[0.1em] text-acc">{cur.name}</h3>
              <div className="mt-2 border border-acc/25 bg-black/30">
                <VesselSchematic company={cur} bay={bay} onBay={setBay} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Readout label="Hull integrity">{cur.totalIntegrity}</Readout>
                <Readout label="Bays">{cur.bays.length}</Readout>
                <Readout label="Overhaul slots">
                  <span className="inline-flex items-center gap-1">
                    <Wrench size={12} className="text-acc" /> {cur.overhaulSlots}
                  </span>
                </Readout>
                <Readout label="Upgrades">{cur.upgrades.length}</Readout>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <Readout label="Company trait">
                <span className="font-sans text-[13px]">{cur.trait ?? "None"}</span>
              </Readout>
              <div>
                <div className="bf-label mb-1">Bay systems // unique abilities</div>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {cur.bays.map((b) => (
                    <li
                      key={b.id}
                      onPointerEnter={() => setBay(b.number)}
                      onPointerLeave={() => setBay(undefined)}
                      className={`border-l-2 py-1 pl-2 transition-colors ${bay === b.number ? "border-acc bg-acc/10" : "border-acc/30"}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-hud text-xs font-bold text-acc">BAY {b.number}</span>
                        <span className="flex gap-[2px]" role="img" aria-label={`Integrity ${b.integrity}`}>
                          {Array.from({ length: b.integrity }, (_, k) => (
                            <i key={k} className="block h-2 w-1.5 bg-emerald-400/90" />
                          ))}
                        </span>
                        <span className="font-hud text-[10px] text-slate-400">{b.integrity}</span>
                      </div>
                      <div className="text-[13px] text-slate-100">{b.ability}</div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Readout label="Starting energy">
                  <span className="flex flex-wrap gap-2">
                    {ENERGY.map(([col, hex]) => (
                      <span key={col} className="inline-flex items-center gap-1" title={col}>
                        <i className="block h-2.5 w-2.5 rotate-45" style={{ background: hex, boxShadow: `0 0 6px ${hex}` }} />
                        {cur.startingEnergy[col]}
                        <span className="sr-only">{col}</span>
                      </span>
                    ))}
                  </span>
                </Readout>
                <Readout label="Starting Mecha">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {cur.startingMecha.map((m) => (
                      <span key={m.id} className="inline-flex items-center gap-0.5 text-xs">
                        <UnitGlyph id={m.id} size={20} />×{m.count}
                      </span>
                    ))}
                  </span>
                </Readout>
              </div>
              {marked && (
                <div className="border border-amberhud/40 bg-amberhud/5 p-2" role="radiogroup" aria-label="Upgrade marks from earlier games">
                  <div className="bf-label !text-amberhud">This sheet has upgrade marks from earlier games</div>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {(["veteran", "fresh"] as const).map((f) => (
                      <button key={f} type="button" role="radio" aria-checked={p.freshness === f} data-freshness={f} onClick={() => (cue("tick"), p.onFreshness(f))} className={`bf-panel !p-2 text-xs ${p.freshness === f ? "bf-sel" : ""}`}>
                        <b className="font-hud uppercase tracking-wider text-slate-50">{f === "veteran" ? "Veteran ★" : "Fresh"}</b>
                        <span className="block text-slate-300">{f === "veteran" ? "Keep all upgrade marks" : "Erase every mark on this sheet"}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
