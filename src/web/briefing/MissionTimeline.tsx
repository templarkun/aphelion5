/** The tactical roadmap of a Campaign: every mission in order, alternative routes as a fork. */

import { Crosshair, Flag, GitFork, Package } from "lucide-react";
import type { CampaignDatabase, MissionDef } from "../../data/campaign.js";
import { UnitGlyph } from "../UnitGlyph.js";
import { Readout } from "./hud.js";
import { eventText, missionGroups, missionLabel, objectiveShort, objectiveText, orderText } from "./missionText.js";
import { playSelect } from "./soundHooks.js";

export function MissionTimeline({ campaign, focus, onFocus }: { campaign: CampaignDatabase; focus: string; onFocus: (id: string) => void }) {
  const groups = missionGroups(campaign);
  const last = groups.length - 1;
  const m = campaign.missionById.get(focus) ?? campaign.missions[0]!;
  return (
    <div>
      <div className="bf-scroll -mx-1 px-1 pb-2">
        <ol className="m-0 flex min-w-max list-none items-center p-0" aria-label="Missions of this Campaign">
          {groups.map((g, gi) => (
            <li key={g[0]!.number} className="bf-rise flex items-center" style={{ "--i": gi + 2 } as React.CSSProperties}>
              {gi > 0 && <Link fork={g.length > 1 || groups[gi - 1]!.length > 1} />}
              <div className="flex flex-col gap-2">
                {g.map((x) => (
                  <Node key={x.id} m={x} on={x.id === m.id} final={gi === last} onPick={() => (playSelect(), onFocus(x.id))} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div key={m.id} className="bf-step-in mt-2 grid gap-x-5 gap-y-2 border-t border-white/20 pt-3 sm:grid-cols-2" data-mission-detail={m.id}>
        <div className="sm:col-span-2">
          <span className="text-base font-extrabold tracking-wider text-white">{missionLabel(m).toUpperCase()}</span>
                    {m.route !== "single" && (
            <span className="ml-2 inline-flex items-center gap-1 text-[13px] text-amber-200">
              <GitFork size={12} /> Alternative route: you choose one of the pair before that mission; the other is skipped.
            </span>
          )}
        </div>
        <Readout label="Objective">
          <span className="text-[14px] font-normal">{objectiveText(campaign, m)}</span>
        </Readout>
        <Readout label="Mission event">
          <span className="text-[14px] font-normal">{eventText(m)}</span>
        </Readout>
        <Readout label="Mission Order">
          <span className="text-[14px] font-normal">{orderText(m)}</span>
        </Readout>
        <Readout label="The Field">
          <span className="text-[14px] font-normal">
            {m.mapSectorCount} sectors
            {m.omegaPlaced.length > 0 && (
              <>
                {" · on the Field from the start: "}
                {m.omegaPlaced.map((id) => (
                  <UnitGlyph key={id} id={id} size={24} />
                ))}
                {` ×${m.omegaSectors.length}`}
              </>
            )}
          </span>
        </Readout>
      </div>
    </div>
  );
}

function Link({ fork }: { fork: boolean }) {
  return (
    <span className="relative block h-px w-5 bg-white/60 sm:w-7" aria-hidden="true">
      {fork && <span className="absolute -top-[5px] left-1/2 h-[11px] w-[11px] -translate-x-1/2 rotate-45 border-2 border-amber-300 bg-indigo-800" />}
    </span>
  );
}

function Node({ m, on, final, onPick }: { m: MissionDef; on: boolean; final: boolean; onPick: () => void }) {
  const Icon = final ? Flag : m.objective.type === "salvage" ? Package : Crosshair;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={on}
      data-mission={m.id}
      title={`${missionLabel(m)}: ${objectiveShort(m)}`}
      className={`bf-panel flex w-[78px] flex-col items-center gap-0.5 !px-1 !py-2 ${on ? "bf-sel" : ""}`}
    >
      <Icon size={18} className={final ? "text-amber-300" : "text-acc"} />
      <span className="text-lg font-extrabold leading-none text-white">
        {String(m.number).padStart(2, "0")}
        {m.route !== "single" && <span className="text-amber-300">{m.route.split(" ")[0]!.toUpperCase()}</span>}
      </span>
      <span className="text-[11px] font-bold uppercase text-sky-100">{objectiveShort(m)}</span>
    </button>
  );
}
