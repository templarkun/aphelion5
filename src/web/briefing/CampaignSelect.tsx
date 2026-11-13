/** Step 1: choose a Campaign. Cards on one side, the chosen Campaign's file and roadmap on the other. */

import { useState } from "react";
import { Lock, Radar, Trophy } from "lucide-react";
import type { GameData } from "../../data/index.js";
import type { Profile } from "../../engine/state.js";
import { CAMPAIGN_LORE, CAMPAIGN_SLOTS, FALLBACK_LORE } from "./content.js";
import { Pips, StepHead } from "./hud.js";
import { MissionTimeline } from "./MissionTimeline.js";
import { missionGroups } from "./missionText.js";
import { cue } from "./sfx.js";

export function loreOf(prefix: string) {
  const l = CAMPAIGN_LORE[prefix] ?? FALLBACK_LORE;
  const n = /^C(\d+)$/.exec(prefix)?.[1];
  return { ...l, title: l.title || (n ? `Campaign ${n}` : prefix) };
}

export function CampaignSelect({ data, profile, value, onChange }: { data: GameData; profile: Profile; value: string; onChange: (prefix: string) => void }) {
  const camps = data.campaigns;
  const cur = camps.find((c) => c.prefix === value) ?? camps[0]!;
  const [focus, setFocus] = useState(cur.missions[0]!.id);
  const lore = loreOf(cur.prefix);
  const hs = profile.highScores[cur.prefix];
  const locked = Math.max(0, CAMPAIGN_SLOTS - camps.length);
  return (
    <div>
      <StepHead code="STEP 01 // THEATRE OF OPERATIONS" title="Select Campaign" help="Choose where your Company is sent. The roadmap shows every mission of the Campaign." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="bf-scroll -mx-4 flex snap-x gap-2 px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-2 lg:content-start lg:overflow-visible lg:px-0" role="radiogroup" aria-label="Campaigns">
          {camps.map((c, i) => {
            const l = loreOf(c.prefix);
            const on = c.prefix === cur.prefix;
            return (
              <button
                key={c.prefix}
                type="button"
                role="radio"
                aria-checked={on}
                data-campaign={c.prefix}
                onClick={() => (cue("select"), onChange(c.prefix), setFocus(c.missions[0]!.id))}
                className={`bf-panel bf-rise min-w-[68%] snap-start !p-3 sm:min-w-[40%] lg:min-w-0 ${on ? "bf-sel" : "hover:border-acc/70"}`}
                style={{ "--i": i } as React.CSSProperties}
              >
                <div className="flex items-center justify-between">
                  <span className="bf-label">{l.sector}</span>
                  <Radar size={14} className={`text-acc ${on ? "bf-pulse" : "opacity-50"}`} />
                </div>
                <div className="mt-1 font-hud text-base font-bold uppercase tracking-widest text-slate-50">{l.title}</div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-300/80">{l.lore}</p>
                <div className="mt-2 flex items-center justify-between">
                  <Pips n={l.difficulty} label="Difficulty" />
                  <span className="bf-label">{missionGroups(c).length} missions</span>
                </div>
              </button>
            );
          })}
          {Array.from({ length: locked }, (_, i) => (
            <div key={i} className="bf-panel bf-static bf-rise min-w-[46%] snap-start p-3 opacity-60 sm:min-w-[30%] lg:min-w-0" style={{ "--i": camps.length + i } as React.CSSProperties} aria-label="Campaign not yet available">
              <div className="flex items-center justify-between">
                <span className="bf-label !text-slate-400">SECTOR A5-{String(camps.length + i + 1).padStart(2, "0")}</span>
                <Lock size={13} className="text-slate-500" />
              </div>
              <div className="mt-1 font-hud text-sm font-bold uppercase tracking-widest text-slate-500">Classified</div>
              <span className="bf-redact mt-2 w-11/12" />
              <span className="bf-redact mt-1.5 w-7/12" />
              <div className="bf-label mt-2 !text-slate-500">Awaiting clearance</div>
            </div>
          ))}
        </div>

        <section key={cur.prefix} className="bf-panel bf-step-in p-4" aria-label={`${lore.title} briefing`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="bf-label">{lore.sector} // BRIEFING FILE</div>
              <h3 className="bf-glow font-hud text-lg font-bold uppercase tracking-[0.14em] text-acc">{lore.title}</h3>
            </div>
            <div className="text-right">
              <div className="bf-label">Difficulty</div>
              <Pips n={lore.difficulty} label="Difficulty" />
            </div>
          </div>
          <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-slate-200/90">{lore.lore}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <Trophy size={13} className="text-amberhud" /> High score
            </span>
            <span>Fresh: {hs?.fresh ? `${hs.fresh.score} (${hs.fresh.date})` : "—"}</span>
            <span>Veteran ★: {hs?.veteran ? `${hs.veteran.score} (${hs.veteran.date})` : "—"}</span>
          </div>
          <div className="bf-label mb-2 mt-4">Tactical roadmap // tap a mission</div>
          <MissionTimeline campaign={cur} focus={focus} onFocus={setFocus} />
        </section>
      </div>
    </div>
  );
}
