/**
 * TEMPORARY (designer 2026-11-20): the trial looks of the Field, in the Menu, so the designer can switch
 * between them while playing and pick the best. See trialLooks.ts.
 */

import { useEffect, useState } from "react";
import { CORNERS, COUNTS, DEPTHS, NAMES, READY_SECTORS, READY_UNITS, onTrialLooks, setTrialLooks, trialLooks, type TrialLooks } from "./trialLooks.js";

export function TrialLooksMenu() {
  const [t, setT] = useState(trialLooks());
  useEffect(() => onTrialLooks(() => setT(trialLooks())), []);
  const row = <K extends keyof TrialLooks>(key: K, title: string, list: { id: TrialLooks[K]; label: string; note: string }[]) => (
    <>
      <span className="ms-title">{title}</span>
      <div className="ms-row" role="group" aria-label={title}>
        {list.map((x) => (
          <button key={x.id} aria-pressed={t[key] === x.id} data-trial={`${key}:${x.id}`} title={x.note} onClick={() => setTrialLooks({ [key]: x.id } as Partial<TrialLooks>)}>
            {x.label}
          </button>
        ))}
      </div>
    </>
  );
  return (
    <details className="motion-set trial-looks" onClick={(e) => e.stopPropagation()}>
      <summary>Trial looks (temporary)</summary>
      {row("corners", "Tile corners", CORNERS)}
      {row("depth", "Stack depth (how many tiles are in a sector)", DEPTHS)}
      {row("readyUnit", "Ready to tap: units (animation)", READY_UNITS)}
      {row("readySector", "Ready to tap: Dark and Cleared sectors (animation)", READY_SECTORS)}
      {row("counts", "Tile-count words (+N beneath, N tiles)", COUNTS)}
      {row("names", "Unit names on the tiles", NAMES)}
    </details>
  );
}
