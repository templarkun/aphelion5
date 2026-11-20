/**
 * The units a Campaign brings, as tiles (designer 2026-11-14, round 2): the Omega units in their
 * own gold-rimmed place with their effects written out, then the rest. Bots and the Energy Gyros
 * (G_01-G_09) are left out: they are in every Campaign; F_01 too (round 3). "All" shows compact tiles (glyphs only on
 * a phone); a type filter opens each unit with its effects written out. A tap opens its card.
 */

import { useLayoutEffect, useRef, useState } from "react";
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
import { BRIEF_ZOOM, useWide } from "../wide.js";

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
  const rest = all.filter((u) => ORDER.includes(u.type) && !u.energyGyro && u.id !== "F_01").sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  const [filter, setFilter] = useState<UnitType | "all">("all");
  // Big PC screen (designer 2026-11-20): "All" and Omega tiles 150% of their size before (the screen's
  // 1.35 zoom times ~1.11), one type's tiles as big as the Vessel step's Mecha (96).
  const wide = useWide();
  const k = wide ? 1.5 / BRIEF_ZOOM : 1;
  const [open, setOpen] = useState<{ id: string; list: string[] } | undefined>();
  const shown = filter === "all" ? rest : rest.filter((u) => u.type === filter);
  const allBox = useRef<HTMLDivElement>(null);
  const [allWidth, setAllWidth] = useState(800);
  useLayoutEffect(() => {
    const el = allBox.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAllWidth(el.clientWidth));
    ro.observe(el);
    setAllWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [filter]);
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
        <div className="bf-vip mt-3 grid grid-cols-[minmax(0,1fr)] gap-1 p-1.5 sm:p-2 2xl:grid-cols-3" data-vip="omega">
          {omega.map((u) => {
            const o = campaign.omega.find((x) => x.id === u.id);
            return (
              <div key={u.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-indigo-950/30 px-1.5 py-1">
                <button type="button" className="bf-unit shrink-0 !p-0.5" data-unit={u.id} onClick={(e) => show(u, omega, e.currentTarget)} aria-label={`${o?.role ?? "Omega"} ${u.id}: open its card`}>
                  <UnitTile unit={u} level={levelOf(u, campaign)} size={Math.round(52 * k)} />
                </button>
                <div className="min-w-0">
                  <div className="text-[15px] font-extrabold uppercase tracking-wide text-amber-100">
                    {o?.role ?? "Omega"}
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
        // Compact: small tiles, no names; one row per unit type on every screen (designer 2026-11-16), the
        // tiles shrinking to fit the row (a very long row scrolls sideways); on a phone only the glyphs.
        <div key="all" ref={allBox} className="mt-2 flex flex-col gap-1" data-compact="1">
          {ORDER.map((t) => {
            const row = shown.filter((u) => u.type === t);
            if (!row.length) return null;
            const phone = allWidth < 640;
            const cell = Math.max(28, Math.min(phone ? 42 : Math.round(62 * k), Math.floor((allWidth - 8) / row.length) - 4));
            return (
              <div key={t} className="bf-scroll flex flex-nowrap gap-1" data-type-row={t} aria-label={PLURAL[t]}>
                {row.map((u, i) => (
                  <button key={u.id} type="button" className="bf-unit bf-rise shrink-0 !p-0.5 sm:!px-1 sm:!py-1" style={{ "--i": Math.min(i, 24) } as React.CSSProperties} data-unit={u.id} onClick={(e) => show(u, shown, e.currentTarget)} aria-label={`${u.type}: open its card`}>
                    {phone ? (
                      <img className="block object-contain" style={{ width: cell * 0.9, height: cell }} src={glyphBadgeUrl(u.id) ?? ""} alt="" draggable={false} />
                    ) : (
                      <UnitTile unit={u} level={levelOf(u, campaign)} size={Math.min(Math.round(52 * k), cell - 10)} />
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        // One type: every unit opened, its effects written out.
        <div key={filter} className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2 md:grid-cols-2" data-compact="0">
          {shown.map((u, i) => (
            <button key={u.id} type="button" className="bf-rise flex min-w-0 items-start gap-2.5 rounded-xl bg-white/10 p-2 text-left transition-colors hover:bg-white/20" style={{ "--i": Math.min(i, 24) } as React.CSSProperties} data-unit={u.id} onClick={(e) => show(u, shown, e.currentTarget)} aria-label={`${u.type}: open its card`}>
              <span className="shrink-0">
                <UnitTile unit={u} level={levelOf(u, campaign)} size={wide ? 96 : 60} />
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
