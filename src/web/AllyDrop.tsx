/**
 * Allied Drop (7.3, designer 2026-11-20): while the game asks on which Dark sector the Ally's Mecha is
 * put ("Put here" bubbles on the sectors), the Mecha itself hangs in an empty corner of the Field, so the
 * player sees what is about to land. Once a sector is chosen the Field plays it falling there
 * (`dropStep` in eventFx.ts, the `dropped` event).
 */

import { useLayoutEffect, useState } from "react";
import type { GameData } from "../data/index.js";
import { UnitTile } from "./briefing/UnitTile.js";

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
  if (!unit || !place) return null;
  return (
    <div className="ally-drop" style={{ left: place.left, top: place.top }} data-ally-drop={unitId} aria-label={`Allied Drop: ${unitId}`}>
      <div className="ally-drop-label">Allied Drop</div>
      <div className="ally-drop-unit">
        <UnitTile unit={unit} size={place.size} />
      </div>
      <div className="ally-drop-sub">Choose where it lands</div>
    </div>
  );
}
