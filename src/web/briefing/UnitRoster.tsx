/**
 * The units a Campaign brings, as tiles (designer 2026-11-14, round 2): the Omega units in their
 * own gold-rimmed place with their effects written out, then the rest. Bots and the Energy Gyros
 * (G_01-G_09) are left out: they are in every Campaign. "All" shows compact tiles (glyphs only on
 * a phone); a type filter opens each unit with its effects written out. A tap opens its card.
 */

import { useState } from "react";
import type { CampaignDatabase } from "../../data/campaign.js";
import type { GameData } from "../../data/index.js";
import type { UnitDef, UnitType } from "../../data/units.js";
import { glyphBadgeUrl } from "../glyphs.js";
import { UnitText } from "../UnitGlyph.js";
import { burstFrom } from "./particles.js";
import { playOpenInfo, playSelect } from "./soundHooks.js";
import { UnitCard } from "./UnitCard.js";
import { campaignUnits, levelOf, unitFacts } from "./unitFacts.js";
import { typeHex, UnitTile } from "./UnitTile.js";

const ORDER: UnitType[] = ["Sentinel", "Flare", "Sleeper", "Gyro"];
const PLURAL: Record<string, string> = { Sentinel: "Sentinels", Flare: "Flares", Sleeper: "Sleepers", Gyro: "Gyros" };

/** A unit's effects written out, one line each (from its card's texts). */
export function EffectLines({ data, id, campaign, small }: { data: GameData; id: string; campaign: CampaignDatabase; small?: boolean }) {
  const f = unitFacts(data, id, campaign);
  if (!f || f.lines.length === 0) return <p className="text-[13px] text-sky-100">No effects.</p>;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {f.lines.map(([k, v], n) => (
        <p key={n} className={`${small ? "text-[13px]" : "text-[14px]"} leading-snug text-slate-50`}>
          <b className="text-acc">{k}.</b> <UnitText text={v} />
        </p>
      ))}
    </div>
  );
}

export function UnitRoster({ data, campaign }: { data: GameData; campaign: CampaignDatabase }) {
  const all = campaignUnits(data, campaign);
  const omega = all.filter((u) => u.type === "Omega");
  const rest = all.filter((u) => ORDER.includes(u.type) && !u.energyGyro).sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  const [filter, setFilter] = useState<UnitType | "all">("all");
  const [open, setOpen] = useState<{ id: string; list: string[] } | undefined>();
  const shown = filter === "all" ? rest : rest.filter((u) => u.type === filter);
  const show = (u: UnitDef, list: UnitDef[], el: Element) => {
    playOpenInfo();
    burstFrom(el, { rgb: "255 255 255", count: 10, speed: 120 });
    setOpen({ id: u.id, list: list.map((x) => x.id) });
  };
  return (
    <section className="bf-panel p-3 sm:p-4" aria-label="Units of this Campaign" data-roster={omega.length + rest.length}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-lg font-extrabold uppercase tracking-wider text-white">Unit roster</h3>
        <span className="text-[14px] text-sky-100">
          {omega.length + rest.length} kinds of unit · tap one to read it
        </span>
      </div>

      {omega.length > 0 && (
        <div className="bf-vip mt-3 grid grid-cols-[minmax(0,1fr)] gap-2 p-2.5 sm:p-3 2xl:grid-cols-3" data-vip="omega">
          {omega.map((u) => {
            const o = campaign.omega.find((x) => x.id === u.id);
            return (
              <div key={u.id} className="flex min-w-0 items-start gap-2.5 rounded-xl bg-indigo-950/30 p-2">
                <button type="button" className="bf-unit shrink-0" data-unit={u.id} onClick={(e) => show(u, omega, e.currentTarget)} aria-label={`${o?.role ?? "Omega"} ${u.id}: open its card`}>
                  <UnitTile unit={u} level={levelOf(u, campaign)} size={64} />
                </button>
                <div className="min-w-0 pt-1">
                  <div className="text-[15px] font-extrabold uppercase tracking-wide text-amber-100">
                    {o?.role ?? "Omega"} <span className="text-[13px] font-semibold text-amber-200/80">{u.id}</span>
                  </div>
                  <EffectLines data={data} id={u.id} campaign={campaign} small />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bf-scroll -mx-1 mt-3 flex gap-2 px-1 pb-1" role="group" aria-label="Show one type of unit">
        <button type="button" className="bf-tab" aria-pressed={filter === "all"} data-filter="all" onClick={() => (playSelect(), setFilter("all"))}>
          All <span className="opacity-70">{rest.length}</span>
        </button>
        {ORDER.map((t) => {
          const n = rest.filter((u) => u.type === t).length;
          if (!n) return null;
          return (
            <button key={t} type="button" className="bf-tab" aria-pressed={filter === t} data-filter={t} onClick={() => (playSelect(), setFilter(t))}>
              <i style={{ background: typeHex(t) }} /> {PLURAL[t]} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {filter === "all" ? (
        // Compact: small tiles with their names; on a phone only the glyphs.
        <div key="all" className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1 sm:grid-cols-[repeat(auto-fill,minmax(62px,1fr))]" data-compact="1">
          {shown.map((u, i) => (
            <button key={u.id} type="button" className="bf-unit bf-rise !p-0.5 sm:!px-1 sm:!py-1" style={{ "--i": Math.min(i, 24) } as React.CSSProperties} data-unit={u.id} onClick={(e) => show(u, shown, e.currentTarget)} aria-label={`${u.type} ${u.id}: open its card`}>
              <span className="hidden sm:block">
                <UnitTile unit={u} level={levelOf(u, campaign)} size={52} />
              </span>
              <img className="block h-[42px] w-[38px] object-contain sm:hidden" src={glyphBadgeUrl(u.id) ?? ""} alt="" draggable={false} />
              <b className="hidden !text-[11px] sm:block">{u.id}</b>
            </button>
          ))}
        </div>
      ) : (
        // One type: every unit opened, its effects written out.
        <div key={filter} className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2" data-compact="0">
          {shown.map((u, i) => (
            <button key={u.id} type="button" className="bf-rise flex min-w-0 items-start gap-2.5 rounded-xl bg-white/10 p-2 text-left transition-colors hover:bg-white/20" style={{ "--i": Math.min(i, 24) } as React.CSSProperties} data-unit={u.id} onClick={(e) => show(u, shown, e.currentTarget)} aria-label={`${u.type} ${u.id}: open its card`}>
              <span className="flex shrink-0 flex-col items-center">
                <UnitTile unit={u} level={levelOf(u, campaign)} size={60} />
                <b className="text-[12px] text-white">{u.id}</b>
              </span>
              <EffectLines data={data} id={u.id} campaign={campaign} small />
            </button>
          ))}
        </div>
      )}

      {open && <UnitCard data={data} id={open.id} campaign={campaign} list={open.list} onPick={(id) => setOpen({ ...open, id })} onClose={() => setOpen(undefined)} />}
    </section>
  );
}
