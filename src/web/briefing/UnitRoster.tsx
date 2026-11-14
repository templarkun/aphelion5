/**
 * Every unit a Campaign can put on the Field, as tiles: the Omega units in their own gold-rimmed
 * place, then the rest, sorted by type with a filter per type. A tap on a unit opens its card.
 */

import { useState } from "react";
import { Crown } from "lucide-react";
import type { CampaignDatabase } from "../../data/campaign.js";
import type { GameData } from "../../data/index.js";
import type { UnitDef, UnitType } from "../../data/units.js";
import { burstFrom } from "./particles.js";
import { playOpenInfo, playSelect } from "./soundHooks.js";
import { UnitCard } from "./UnitCard.js";
import { campaignUnits, levelOf } from "./unitFacts.js";
import { typeHex, UnitTile } from "./UnitTile.js";

const ORDER: UnitType[] = ["Bot", "Sentinel", "Flare", "Sleeper", "Gyro"];
const PLURAL: Record<string, string> = { Bot: "Bots", Sentinel: "Sentinels", Flare: "Flares", Sleeper: "Sleepers", Gyro: "Gyros" };

export function UnitRoster({ data, campaign }: { data: GameData; campaign: CampaignDatabase }) {
  const all = campaignUnits(data, campaign);
  const omega = all.filter((u) => u.type === "Omega");
  const rest = all.filter((u) => u.type !== "Omega" && u.type !== "Mecha").sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  const [filter, setFilter] = useState<UnitType | "all">("all");
  const [open, setOpen] = useState<{ id: string; list: string[] } | undefined>();
  const shown = filter === "all" ? rest : rest.filter((u) => u.type === filter);
  const show = (u: UnitDef, list: UnitDef[], el: Element) => {
    playOpenInfo();
    burstFrom(el, { rgb: "255 255 255", count: 10, speed: 120 });
    setOpen({ id: u.id, list: list.map((x) => x.id) });
  };
  return (
    <section className="bf-panel p-3 sm:p-4" aria-label="Units of this Campaign" data-roster={all.length}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-lg font-extrabold uppercase tracking-wider text-white">Unit roster</h3>
        <span className="text-[14px] text-sky-100">
          {omega.length + rest.length} kinds of unit in this Campaign · tap one to read it
        </span>
      </div>

      {omega.length > 0 && (
        <div className="bf-vip mt-3 p-3" data-vip="omega">
          <div className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.14em] text-amber-200">
            <Crown size={18} /> Omega units · priority targets
          </div>
          <div className="mt-1 flex flex-wrap justify-around gap-2">
            {omega.map((u) => {
              const o = campaign.omega.find((x) => x.id === u.id);
              return (
                <button key={u.id} type="button" className="bf-unit" data-unit={u.id} onClick={(e) => show(u, omega, e.currentTarget)} aria-label={`${o?.role ?? "Omega"} ${u.id}: open its card`}>
                  <UnitTile unit={u} level={levelOf(u, campaign)} size={104} />
                  <b className="!text-[15px]">{o?.role ?? u.id}</b>
                  <span className="text-[13px] text-amber-100">{u.id}</span>
                </button>
              );
            })}
          </div>
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

      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(78px,1fr))] gap-x-1 gap-y-1 sm:grid-cols-[repeat(auto-fill,minmax(92px,1fr))]">
        {shown.map((u, i) => (
          <button key={u.id} type="button" className="bf-unit bf-rise" style={{ "--i": Math.min(i, 24) } as React.CSSProperties} data-unit={u.id} onClick={(e) => show(u, shown, e.currentTarget)} aria-label={`${u.type} ${u.id}: open its card`}>
            <UnitTile unit={u} level={levelOf(u, campaign)} size={72} />
            <b>{u.id}</b>
          </button>
        ))}
      </div>

      {open && <UnitCard data={data} id={open.id} campaign={campaign} list={open.list} onPick={(id) => setOpen({ ...open, id })} onClose={() => setOpen(undefined)} />}
    </section>
  );
}
