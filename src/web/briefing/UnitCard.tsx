/**
 * A unit's information card: its tile, big, and everything printed on it in words. Opens over the
 * screen when a unit is tapped (Campaign file, Vessel Bay, Threat screen); a tap outside, the
 * cross or Esc closes it; the arrows step through the list it was opened from.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { CampaignDatabase } from "../../data/campaign.js";
import type { CompanyDef } from "../../data/company.js";
import type { GameData } from "../../data/index.js";
import { UnitText } from "../UnitGlyph.js";
import { playBack, playSelect } from "./soundHooks.js";
import { unitFacts } from "./unitFacts.js";
import { typeHex, UnitTile } from "./UnitTile.js";

const SIDE_WORD: Record<number, string> = { 1: "left", 2: "upper left", 3: "upper right", 4: "right", 5: "lower right", 6: "lower left" };

export function UnitCard(p: { data: GameData; id: string; campaign?: CampaignDatabase | undefined; company?: CompanyDef | undefined; count?: number | undefined; list?: string[] | undefined; onPick?: ((id: string) => void) | undefined; onClose: () => void }) {
  const f = unitFacts(p.data, p.id, p.campaign, p.company);
  const i = p.list?.indexOf(p.id) ?? -1;
  const step = (d: number) => {
    if (!p.list || !p.onPick || i < 0) return;
    playSelect();
    p.onPick(p.list[(i + d + p.list.length) % p.list.length]!);
  };
  const close = () => (playBack(), p.onClose());
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  if (!f) return null;
  const u = f.unit;
  const col = typeHex(u.type);
  const many = (p.list?.length ?? 0) > 1 && p.onPick;
  // On the page itself, not inside the step: a step that slides in would hold the card in its own box.
  return createPortal(
    <div className="bf-veil" onClick={close} data-unit-card={u.id}>
      <div className="bf-card bf-pop" role="dialog" aria-label={`${f.title} ${u.id}`} onClick={(e) => e.stopPropagation()} style={{ "--type": col } as React.CSSProperties}>
        <button type="button" className="bf-x" aria-label="Close" onClick={close}>
          <X size={20} />
        </button>
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            <UnitTile unit={u} level={f.level} size={120} />
          </div>
          <div className="min-w-0">
            <div className="bf-type" style={{ background: col }}>
              {f.title}
            </div>
            <div className="mt-1 text-2xl font-extrabold tracking-wide text-white">{u.id}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[14px] text-sky-100">
              {f.level !== undefined && (
                <span>
                  Level <b className="text-white">{f.level}</b>
                </span>
              )}
              {p.count !== undefined ? (
                <span>
                  Starts with <b className="text-white">{p.count}</b>
                </span>
              ) : (
                <span>
                  Tiles in the box <b className="text-white">{u.copies}</b>
                </span>
              )}
              {u.arrows.length > 0 && (
                <span>
                  Arrows <b className="text-white">{u.arrows.map((s) => SIDE_WORD[s]).join(", ")}</b>
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="bf-scroll mt-4 flex max-h-[46vh] flex-col gap-2.5 pr-1">
          {f.lines.length === 0 && <p className="text-[15px] text-sky-100">No effects.</p>}
          {f.lines.map(([k, v], n) => (
            <p key={n} className="bf-line text-[15px] leading-snug text-slate-50">
              <b>{k}</b>
              <span>
                <UnitText text={v} />
              </span>
            </p>
          ))}
          {f.where.length > 0 && (
            <div className="mt-1 border-t border-white/15 pt-2.5">
              <div className="bf-label">In this Campaign</div>
              <ul className="m-0 mt-1 flex list-none flex-wrap gap-1.5 p-0 text-[13px] text-sky-50">
                {f.where.map((w) => (
                  <li key={w} className="rounded-full bg-white/10 px-2.5 py-0.5">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {many && (
          <div className="mt-3 flex items-center justify-between">
            <button type="button" className="bf-btn !min-h-[40px] !px-3" onClick={() => step(-1)} aria-label="Previous unit">
              <ChevronLeft size={18} />
            </button>
            <span className="text-[13px] text-sky-200">
              {i + 1} / {p.list!.length}
            </span>
            <button type="button" className="bf-btn !min-h-[40px] !px-3" onClick={() => step(1)} aria-label="Next unit">
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
