/** Step 1: choose a Campaign. Its cards along the top, then every unit it holds, its file and roadmap. */

import { useEffect, useRef, useState } from "react";
import { Lock, Radar, Trophy } from "lucide-react";
import type { GameData } from "../../data/index.js";
import type { Profile } from "../../engine/state.js";
import { CAMPAIGN_LORE, CAMPAIGN_SLOTS, FALLBACK_LORE } from "./content.js";
import { Pips, StepHead } from "./hud.js";
import { MissionTimeline } from "./MissionTimeline.js";
import { missionGroups } from "./missionText.js";
import { setEmitter, sparkEdges } from "./particles.js";
import { playSelect } from "./soundHooks.js";
import { UnitRoster } from "./UnitRoster.js";

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
  // Holographic sparks keep hopping off the chosen Campaign's card.
  const sel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setEmitter("campaign", sel.current, "grid", "125 211 252", 9);
    return () => setEmitter("campaign", null);
  }, [cur.prefix]);
  return (
    <div>
      <StepHead code="Step 1 of 3" title="Select Campaign" help="Choose where your Company is sent. Below: every unit you can meet there, and the road of missions." />
      <div className="bf-scroll -mx-4 flex snap-x gap-2.5 px-4 pb-2 pt-1 sm:mx-0 sm:px-1" role="radiogroup" aria-label="Campaigns">
        {camps.map((c, i) => {
          const l = loreOf(c.prefix);
          const on = c.prefix === cur.prefix;
          return (
            <button
              key={c.prefix}
              ref={on ? sel : undefined}
              type="button"
              role="radio"
              aria-checked={on}
              data-campaign={c.prefix}
              onClick={(e) => (playSelect(), sparkEdges(e.currentTarget, "125 211 252"), onChange(c.prefix), setFocus(c.missions[0]!.id))}
              className={`bf-panel bf-rise w-[250px] shrink-0 snap-start !p-3 ${on ? "bf-sel" : ""}`}
              style={{ "--i": i } as React.CSSProperties}
            >
              <div className="flex items-center justify-between">
                <span className="bf-label">{l.sector}</span>
                <Radar size={18} className={`text-acc ${on ? "bf-pulse" : "opacity-60"}`} />
              </div>
              <div className="mt-0.5 text-lg font-extrabold uppercase tracking-wider text-white">{l.title}</div>
              <div className="mt-1.5 flex items-center justify-between">
                <Pips n={l.difficulty} label="Difficulty" />
                <span className="text-[13px] font-semibold text-sky-100">{missionGroups(c).length} missions</span>
              </div>
            </button>
          );
        })}
        {Array.from({ length: locked }, (_, i) => (
          <div key={i} className="bf-panel bf-soon bf-rise w-[150px] shrink-0 snap-start p-3" style={{ "--i": camps.length + i } as React.CSSProperties} aria-label="Campaign not yet available">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold uppercase tracking-wider">Campaign {camps.length + i + 1}</span>
              <Lock size={15} />
            </div>
            <div className="mt-1 text-[15px] font-bold uppercase tracking-wider">Classified</div>
          </div>
        ))}
      </div>

      <div key={cur.prefix} className="bf-step-in mt-2 grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <UnitRoster data={data} campaign={cur} />
        <section className="bf-panel p-3 sm:p-4" aria-label={`${lore.title} briefing`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="bf-label">{lore.sector} · briefing file</div>
              <h3 className="text-xl font-extrabold uppercase tracking-wider text-white">{lore.title}</h3>
            </div>
            <div className="text-right">
              <div className="bf-label">Difficulty</div>
              <Pips n={lore.difficulty} label="Difficulty" />
            </div>
          </div>
          <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-slate-50">{lore.lore}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[14px] text-sky-50">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Trophy size={16} className="text-amber-300" /> High score
            </span>
            <span>Fresh: {hs?.fresh ? `${hs.fresh.score} (${hs.fresh.date})` : "—"}</span>
            <span>Veteran ★: {hs?.veteran ? `${hs.veteran.score} (${hs.veteran.date})` : "—"}</span>
          </div>
          <div className="bf-label mb-2 mt-4">Road of missions · tap one</div>
          <MissionTimeline campaign={cur} focus={focus} onFocus={setFocus} />
        </section>
      </div>
    </div>
  );
}
