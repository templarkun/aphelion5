/**
 * Allied Drop (7.3, designer 2026-11-20): while the game asks on which Dark sector the Ally's Mecha is
 * put ("Put here" bubbles on the sectors), the Mecha itself hangs in an empty corner of the Field, so the
 * player sees what is about to land. Once a sector is chosen the Field plays it falling there
 * (`dropStep` in eventFx.ts, the `dropped` event).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GameData } from "../data/index.js";
import type { UnitDef } from "../data/units.js";
import { UnitTile } from "./briefing/UnitTile.js";
import { isWide } from "./wide.js";

/** The Mecha an Allied Drop question is about, from its prompt; undefined for any other question. */
export function allyDropUnit(prompt: string | undefined): string | undefined {
  return prompt ? /^Allied Drop: place (\S+) on which Dark sector\?/.exec(prompt)?.[1] : undefined;
}

export function AllyDrop({ data, unitId }: { data: GameData; unitId: string }) {
  const unit = data.units.byId.get(unitId);
  const [place, setPlace] = useState<{ left: number; top: number; size: number } | undefined>();
  useLayoutEffect(() => {
    const fit = () => {
      const field = document.querySelector<HTMLElement>(".field");
      if (!field) return;
      const w = field.clientWidth;
      const h = field.clientHeight;
      const tile = Number(field.dataset.tile ?? 80);
      const size = Math.max(56, Math.min(130, tile * 0.85));
      const box = { w: size + 28, h: size * 1.12 + 52 };
      const centres = Object.values(JSON.parse(field.dataset.sectors ?? "{}") as Record<string, [number, number]>);
      // The corner whose card stays furthest from every sector.
      const corners = [
        { left: 10, top: 10 },
        { left: w - box.w - 10, top: 10 },
        { left: 10, top: h - box.h - 10 },
        { left: w - box.w - 10, top: h - box.h - 10 },
      ];
      let best = corners[0]!;
      let room = -1;
      for (const c of corners) {
        const cx = c.left + box.w / 2;
        const cy = c.top + box.h / 2;
        const d = Math.min(...centres.map(([x, y]) => Math.hypot(x - cx, y - cy)));
        if (d > room) (room = d), (best = c);
      }
      setPlace({ ...best, size, left: best.left + field.offsetLeft, top: best.top + field.offsetTop });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [unitId]);
  // Round 29 (designer 2026-11-22): its card text as in the game, on mouse hover or a 0.5 s touch hold.
  const [info, setInfo] = useState(false);
  const hold = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hold.current), []);
  if (!unit || !place) return null;
  const field = document.querySelector<HTMLElement>(".field");
  const fw = field?.clientWidth ?? 400;
  const fh = field?.clientHeight ?? 400;
  const right = place.left - (field?.offsetLeft ?? 0) > fw / 2;
  const low = place.top - (field?.offsetTop ?? 0) > fh / 2;
  // Beside the box when there is room for the card there, else above or below it.
  const box = place.size + 28;
  const bw = Math.min(isWide() ? 406 : 280, fw - 20);
  const beside = fw - box - 20 >= bw + 8;
  const cardStyle: React.CSSProperties = beside
    ? { width: bw, [right ? "right" : "left"]: "calc(100% + 8px)", [low ? "bottom" : "top"]: 0 }
    : { width: bw, [right ? "right" : "left"]: 0, [low ? "bottom" : "top"]: "calc(100% + 8px)" };
  return (
    <div className="ally-drop" style={{ left: place.left, top: place.top }} data-ally-drop={unitId} aria-label={`Allied Drop: ${unitId}`}>
      <div className="ally-drop-label">Allied Drop</div>
      <div
        className="ally-drop-unit"
        data-ally-info={info ? "1" : "0"}
        onPointerEnter={(e) => e.pointerType === "mouse" && setInfo(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && setInfo(false)}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          window.clearTimeout(hold.current);
          hold.current = window.setTimeout(() => setInfo(true), 500);
        }}
        onPointerUp={(e) => e.pointerType !== "mouse" && (window.clearTimeout(hold.current), setInfo(false))}
        onPointerCancel={() => (window.clearTimeout(hold.current), setInfo(false))}
        onContextMenu={(e) => e.preventDefault()}
      >
        <UnitTile unit={unit} size={place.size} />
      </div>
      <div className="ally-drop-sub">Choose where it lands</div>
      {info && (
        <div className="info-bubble ally-info" style={cardStyle} data-ally-card={unitId}>
          <UnitDefInfo unit={unit} />
        </div>
      )}
    </div>
  );
}

/** A unit's card text from its card alone (not yet on the Field): as HoverInfo shows it in the game. */
export function UnitDefInfo({ unit }: { unit: UnitDef }) {
  const clean = (x: string) => x.replace(/\s*\[\d+\]\s*/g, " ").replace(/\s+/g, " ").trim();
  const head = [unit.type, typeof unit.level === "number" ? `Level ${unit.level}` : ""].filter(Boolean).join(". ") + ".";
  const lines: [string, string][] = [];
  if (unit.text.activate && unit.text.activate !== "none") lines.push(["Alert", unit.text.activate]);
  if (unit.text.ability) {
    const m = /^(Command|Passive|Expend|Overload|\[Overload\][^:]*):\s*(.*)$/s.exec(unit.text.ability);
    lines.push(m ? [m[1]!, m[2]!] : ["Ability", unit.text.ability]);
  }
  if (unit.text.drain) lines.push(["Drain", unit.text.drain]);
  if (unit.text.destroyed) lines.push(["Destroyed", unit.text.destroyed]);
  return (
    <span className="info-lines">
      <b>{head}</b>
      {lines.map(([k, v], i) => (
        <span key={i}>
          <b>{k}:</b> {clean(v)}
        </span>
      ))}
    </span>
  );
}
