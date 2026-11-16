/**
 * The tactical roadmap of a Campaign: every mission in order, alternative routes as a fork, each
 * button with its Field drawn small behind it (designer 2026-11-14, round 3). No mission is open at
 * first; a tap opens one, a tap on it again closes it. An open mission shows its file: objective,
 * event, Order, the Field (number and map) and every unit it adds (no Bots, no Energy Gyros).
 */

import { useLayoutEffect, useRef, useState } from "react";
import { Crosshair, Flag, GitFork, Package } from "lucide-react";
import type { CampaignDatabase, MissionDef, ThreatColumn } from "../../data/campaign.js";
import type { GameData } from "../../data/index.js";
import type { UnitDef } from "../../data/units.js";
import { Readout } from "./hud.js";
import { MissionMap } from "./MissionMap.js";
import { eventText, missionGroups, missionLabel, objectiveShort, objectiveText, orderText } from "./missionText.js";
import { playOpenInfo, playSelect } from "./soundHooks.js";
import { UnitCard } from "./UnitCard.js";
import { levelOf } from "./unitFacts.js";
import { UnitTile } from "./UnitTile.js";

export function MissionTimeline({ data, campaign, focus, onFocus }: { data: GameData; campaign: CampaignDatabase; focus: string | undefined; onFocus: (id: string | undefined) => void }) {
  const groups = missionGroups(campaign);
  const last = groups.length - 1;
  const m = focus ? campaign.missionById.get(focus) : undefined;
  return (
    <div>
      <div className="bf-scroll -mx-1 px-1 pb-2">
        <ol className="m-0 flex min-w-max list-none items-center p-0" aria-label="Missions of this Campaign">
          {groups.map((g, gi) => (
            <li key={g[0]!.number} className="bf-rise flex items-center" style={{ "--i": gi + 2 } as React.CSSProperties}>
              {gi > 0 && <Link fork={g.length > 1 || groups[gi - 1]!.length > 1} />}
              <div className="flex flex-col gap-2">
                {g.map((x) => (
                  <Node key={x.id} m={x} on={x.id === m?.id} final={gi === last} onPick={() => (playSelect(), onFocus(x.id === m?.id ? undefined : x.id))} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
      {m && <MissionFile key={m.id} data={data} campaign={campaign} m={m} />}
    </div>
  );
}

function MissionFile({ data, campaign, m }: { data: GameData; campaign: CampaignDatabase; m: MissionDef }) {
  return (
    <div className="bf-step-in mt-2 grid gap-x-5 gap-y-2 border-t border-white/20 pt-3 sm:grid-cols-2" data-mission-detail={m.id}>
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
        <span className="flex items-center gap-3">
          <MissionMap m={m} className="h-[64px] w-[96px] shrink-0" />
          <span className="text-[14px] font-normal">
            {m.mapSectorCount} sectors
            {m.omegaSectors.length > 0 && <span className="block text-[13px] text-amber-200">Gold: an Omega unit starts there</span>}
          </span>
        </span>
      </Readout>
      <MissionRoster data={data} campaign={campaign} m={m} />
    </div>
  );
}

/** Every unit this mission adds: Omega units on the Field, its deck, its Threat columns. Not the Bots or the Energy Gyros, which are in every mission. */
function MissionRoster({ data, campaign, m }: { data: GameData; campaign: CampaignDatabase; m: MissionDef }) {
  const [open, setOpen] = useState<{ id: string; list: string[] } | undefined>();
  const [threatOpen, setThreatOpen] = useState<ThreatColumn | undefined>();
  const box = useRef<HTMLElement>(null);
  const width = useWidth(box);
  const unit = (id: string): UnitDef | undefined => {
    const u = data.units.byId.get(id);
    return u && u.type !== "Bot" && !u.energyGyro ? u : undefined;
  };
  const top = [
    { label: "Starts on the Field", items: m.omegaPlaced.filter((id) => unit(id)).map((id) => ({ id, count: m.omegaSectors.length })) },
    { label: "Mission deck", items: m.deploymentShuffled.filter((x) => unit(x.id)) },
  ].filter((g) => g.items.length > 0);
  // Threats (designer 2026-11-16): never combined: every copy one by one, four tiles per Threat.
  const threats = (["A", "B", "C", "D"] as ThreatColumn[]).map((c) => ({ c, ids: m.threat[c].filter((id) => unit(id)) })).filter((t) => t.ids.length > 0);
  const all = [...new Set([...top.flatMap((g) => g.items.map((x) => x.id)), ...threats.flatMap((t) => t.ids)])];
  // Tiles as big as in the Campaign roster's "All" (52 px; 40 on a phone).
  const full = width >= 640 ? 52 : 40;
  // All four Threats on one row when they fit with tiles of at least 34 px; else four Threat buttons.
  const perThreat = Math.max(...threats.map((t) => t.ids.length), 1);
  const gap = 14;
  const fit = Math.floor((width - 24 - gap * (threats.length - 1)) / (threats.length * perThreat) - 6);
  const threatTile = Math.min(full, fit);
  const threatRow = threatTile >= 34;
  const tileBtn = (id: string, size: number, count?: number, key?: string) => {
    const u = unit(id)!;
    return (
      <button key={key ?? id} type="button" className="bf-unit shrink !p-0.5" style={{ minWidth: 0 }} data-unit={id} onClick={() => (playOpenInfo(), setOpen({ id, list: all }))} aria-label={`${u.type} ${id}${count ? `, ${count}` : ""}: open its card`}>
        <UnitTile unit={u} level={levelOf(u, campaign)} size={size} />
        {count !== undefined && count > 1 && <b className="!text-[11px] leading-none">×{count}</b>}
      </button>
    );
  };
  // The deck on a phone: one row, the tiles shrink to fit (designer 2026-11-16).
  const rowTile = (n: number) => Math.max(24, Math.min(full, Math.floor((width - 24) / Math.max(n, 1)) - 6));
  return (
    <section ref={box} className="rounded-lg bg-white/10 px-3 py-2 sm:col-span-2" aria-label={`Units of ${missionLabel(m)}`} data-mission-roster={m.id}>
      <div className="bf-label">Unit roster · tap one to read it</div>
      <div className="mt-1 flex flex-col gap-y-1">
        {top.map((g) => (
          <div key={g.label} className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 sm:flex-nowrap" data-roster-row={g.label}>
            <span className="w-full text-[12px] font-bold uppercase tracking-wider text-sky-100 sm:w-[92px] sm:shrink-0">{g.label}</span>
            <span className="flex min-w-0 flex-nowrap items-end gap-x-1 sm:flex-wrap">{g.items.map((x) => tileBtn(x.id, width < 640 ? rowTile(g.items.length) : full, x.count))}</span>
          </div>
        ))}
        {threats.length > 0 && threatRow && (
          <div className="flex min-w-0 flex-nowrap items-start" style={{ gap }} data-threat-row="1">
            {threats.map((t) => (
              <div key={t.c} className="min-w-0" data-threat-col={t.c}>
                <span className="block text-[12px] font-bold uppercase tracking-wider text-sky-100">Threat {t.c}</span>
                <span className="flex flex-nowrap items-end gap-x-0.5">{t.ids.map((id, k) => tileBtn(id, threatTile, undefined, `${id}:${k}`))}</span>
              </div>
            ))}
          </div>
        )}
        {threats.length > 0 && !threatRow && (
          <div data-threat-row="0">
            <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Threats">
              {threats.map((t) => (
                <button key={t.c} type="button" className="bf-tab justify-center !px-1" aria-pressed={threatOpen === t.c} data-threat-btn={t.c} onClick={() => (playSelect(), setThreatOpen(threatOpen === t.c ? undefined : t.c))}>
                  Threat {t.c}
                </button>
              ))}
            </div>
            {threatOpen && (
              <span key={threatOpen} className="bf-pop mt-1 flex flex-nowrap items-end justify-center gap-x-1" data-threat-col={threatOpen}>
                {threats.find((t) => t.c === threatOpen)!.ids.map((id, k) => tileBtn(id, rowTile(perThreat), undefined, `${id}:${k}`))}
              </span>
            )}
          </div>
        )}
      </div>
      {open && <UnitCard data={data} id={open.id} campaign={campaign} list={open.list} onPick={(id) => setOpen({ ...open, id })} onClose={() => setOpen(undefined)} />}
    </section>
  );
}

/** The width of an element, followed as it changes. */
function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  return w;
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
      className={`bf-panel relative flex w-[78px] flex-col items-center gap-0.5 overflow-hidden !px-1 !py-2 ${on ? "bf-sel" : ""}`}
    >
      <MissionMap m={m} className={`pointer-events-none absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] ${on ? "opacity-80" : "opacity-55"}`} fill="rgb(186 230 253 / 0.35)" stroke="rgb(224 242 254 / 0.7)" />
      <Icon size={18} className={`relative ${final ? "text-amber-300" : "text-acc"}`} />
      <span className="relative text-lg font-extrabold leading-none text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">
        {String(m.number).padStart(2, "0")}
        {m.route !== "single" && <span className="text-amber-300">{m.route.split(" ")[0]!.toUpperCase()}</span>}
      </span>
      <span className="relative text-[11px] font-bold uppercase text-sky-100 [text-shadow:0_1px_3px_rgb(0_0_0/0.8)]">{objectiveShort(m)}</span>
    </button>
  );
}
