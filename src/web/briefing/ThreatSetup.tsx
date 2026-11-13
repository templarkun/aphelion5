/**
 * Step 4: the Threat Level of every mission, 1 to 4 (Core Rules 7.2 step 3: Patrol, Assault,
 * Siege, Annihilation). The Level is how many Threat columns you play; the hazard nodes A-D show
 * which, and what each one adds to the mission deck. The accent runs from cyan to crimson.
 */

import { AlertTriangle, Flame, Shield, Skull, Swords } from "lucide-react";
import type { CampaignDatabase, MissionDef, ThreatColumn } from "../../data/campaign.js";
import { THREAT_COLUMNS } from "../../data/campaign.js";
import { UnitGlyph } from "../UnitGlyph.js";
import { StepHead } from "./hud.js";
import { missionLabel, objectiveShort } from "./missionText.js";
import { cue } from "./sfx.js";
import { THREAT_NAMES, THREAT_RGB, type ThreatLevel, type ThreatPlan } from "./types.js";

const LEVELS: ThreatLevel[] = [1, 2, 3, 4];
const ICON = [Shield, Shield, Swords, Flame, Skull];

/** Columns for a Level: keep what is chosen, drop from the end, or add the next free ones. */
function atLevel(cols: ThreatColumn[], n: number): ThreatColumn[] {
  const keep = cols.slice(0, n);
  for (const c of THREAT_COLUMNS) if (keep.length < n && !keep.includes(c)) keep.push(c);
  return keep.sort();
}

export function planDone(c: CampaignDatabase, plan: ThreatPlan): number {
  return c.missions.filter((m) => (plan[m.id]?.length ?? 0) > 0).length;
}

/** The highest Threat Level set so far (0 = none): the briefing's accent follows it. */
export function planPeak(plan: ThreatPlan): number {
  return Math.max(0, ...Object.values(plan).map((x) => x.length));
}

export function ThreatSetup({ campaign, plan, onChange }: { campaign: CampaignDatabase; plan: ThreatPlan; onChange: (p: ThreatPlan) => void }) {
  const done = planDone(campaign, plan);
  const total = campaign.missions.length;
  const set = (id: string, cols: ThreatColumn[]) => onChange({ ...plan, [id]: cols });
  return (
    <div>
      <StepHead
        code="STEP 04 // HAZARD CONFIGURATION"
        title="Mission Threat Levels"
        help="Set every mission from 1 to 4. Each Threat column adds its units to that mission's deck, and each one you complete scores 1 point."
        right={
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Set every mission to one Threat Level">
            <span className="bf-label">All missions</span>
            {LEVELS.map((n) => (
              <button
                key={n}
                type="button"
                data-all={n}
                onClick={() => (cue("select"), onChange(Object.fromEntries(campaign.missions.map((m) => [m.id, atLevel(plan[m.id] ?? [], n)]))))}
                className="bf-btn !min-h-[36px] !px-3"
                style={{ "--acc": THREAT_RGB[n] } as React.CSSProperties}
                title={THREAT_NAMES[n]}
              >
                {n}
              </button>
            ))}
          </div>
        }
      />
      <p className="mb-3 flex items-start gap-2 text-xs text-slate-300/90">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amberhud" />
        <span>
          Mission 1 starts with this plan at once. Before each later mission the game shows your plan again and you confirm or change it (Core Rules 7.2, step 3). Missions with a letter are alternative routes: you play one of each pair.
        </span>
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {campaign.missions.map((m, i) => (
          <MissionRow key={m.id} m={m} cols={plan[m.id] ?? []} onCols={(c) => set(m.id, c)} i={i} />
        ))}
      </ul>
      <div className="mt-3 font-hud text-xs tracking-widest text-slate-300" data-threat-done={`${done}/${total}`}>
        CONFIGURED <b className={done === total ? "text-emerald-300" : "text-amberhud"}>{done}</b> / {total}
      </div>
    </div>
  );
}

function MissionRow({ m, cols, onCols, i }: { m: MissionDef; cols: ThreatColumn[]; onCols: (c: ThreatColumn[]) => void; i: number }) {
  const level = cols.length;
  const Icon = ICON[level]!;
  const toggle = (c: ThreatColumn) => {
    if (cols.includes(c) && cols.length === 1) return; // at least one column (7.2 step 3)
    cue("tick");
    onCols(cols.includes(c) ? cols.filter((x) => x !== c) : [...cols, c].sort());
  };
  return (
    <li
      className={`bf-panel bf-rise grid items-center gap-x-4 gap-y-2 p-3 md:grid-cols-[150px_auto_minmax(0,1fr)_132px] ${level ? "bf-sel" : ""} ${level === 4 ? "bf-pulse-edge" : ""}`}
      style={{ "--acc": THREAT_RGB[level], "--i": i } as React.CSSProperties}
      data-threat-row={m.id}
      data-level={level}
    >
      <div className="flex items-center justify-between gap-2 md:block">
        <div className="font-hud text-sm font-bold uppercase tracking-widest text-slate-50">{missionLabel(m)}</div>
        <div className="bf-label">{objectiveShort(m)} · {m.mapSectorCount} sectors</div>
      </div>

      <div className="flex items-end gap-1.5" role="radiogroup" aria-label={`${missionLabel(m)} Threat Level`}>
        {LEVELS.map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={level === n}
            aria-label={`Threat Level ${n}: ${THREAT_NAMES[n]}`}
            data-level-btn={n}
            onClick={() => (cue(n === 4 ? "glitch" : "select"), onCols(atLevel(cols, n)))}
            className="group flex h-11 w-11 flex-col items-center justify-end gap-0.5"
            style={{ "--acc": THREAT_RGB[n] } as React.CSSProperties}
          >
            <span
              className={`block w-full border border-acc/70 transition-all duration-300 ${n <= level ? "bg-acc shadow-[0_0_10px_rgb(var(--acc)/0.7)]" : "bg-acc/10 group-hover:bg-acc/30"}`}
              style={{ height: 6 + n * 6 }}
            />
            <span className={`font-hud text-[11px] font-bold ${n <= level ? "text-acc" : "text-slate-400"}`}>{n}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${missionLabel(m)} Threat columns`}>
        {THREAT_COLUMNS.map((c) => {
          const on = cols.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              disabled={level === 0}
              data-col={c}
              onClick={() => toggle(c)}
              title={`Threat column ${c}: ${m.threat[c].join(", ")}`}
              className={`flex min-h-[36px] items-center gap-1 border !px-1.5 !py-1 transition-all duration-300 ${on ? "border-acc bg-acc/15" : "border-slate-500/40 opacity-55 hover:opacity-90"}`}
            >
              <span className={`grid h-5 w-5 place-items-center font-hud text-[11px] font-bold ${on ? "bg-acc text-black" : "bg-slate-600/60 text-slate-200"}`} style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }}>
                {c}
              </span>
              {m.threat[c].map((id, k) => (
                <UnitGlyph key={k} id={id} size={18} />
              ))}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 md:block md:text-right">
        <div className="inline-flex items-center gap-1.5 font-hud text-xs font-bold uppercase tracking-wider text-acc">
          <Icon size={14} /> {level ? THREAT_NAMES[level] : "Not set"}
        </div>
        <div className="font-hud text-[11px] text-slate-300">{level ? `up to +${level} point${level === 1 ? "" : "s"}` : "choose 1 to 4"}</div>
      </div>
    </li>
  );
}
