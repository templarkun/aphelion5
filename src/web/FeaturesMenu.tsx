/**
 * Features of the Field in the Menu (designer 2026-11-20 as "Trial looks (temporary)"; 2026-11-22 renamed
 * "Features", a permanent part of the game: later each is hidden and unlocked by an achievement).
 * The short list for switching during a game; the Command Deck's Features page shows them with
 * previews (`briefing/FeaturesPage.tsx`). See features.ts.
 */

import { useEffect, useState } from "react";
import { FEATURE_ROWS, onFeatures, setFeatures, features, type Features } from "./features.js";

const MENU_TITLE: Partial<Record<keyof Features, string>> = {
  depth: "Stack depth (how many tiles are in a sector)",
  readyUnit: "Ready to tap: units (animation)",
  readySector: "Ready to tap: Dark and Cleared sectors (animation)",
  names: "Unit names on the tiles",
  overload: "Overload: the Field's edge (animation)",
  next: "A sector's next tile, once you have looked at it",
  gyroEnergy: "Energy Gyros: the energy you gain by destroying one",
  exposure: "Overload End: Exposure damage (animation)",
  endButton: "Overload End: the button's look",
};

export function FeaturesMenu() {
  const [t, setT] = useState(features());
  useEffect(() => onFeatures(() => setT(features())), []);
  return (
    <details className="motion-set features-menu" onClick={(e) => e.stopPropagation()}>
      <summary>Features</summary>
      {FEATURE_ROWS.filter((r) => !r.unlock).map((r) => {
        const title = MENU_TITLE[r.key] ?? r.title;
        return (
          <div key={r.key} style={{ display: "contents" }}>
            <span className="ms-title">{title}</span>
            <div className="ms-row" role="group" aria-label={title}>
              {r.list.map((x) => (
                <button key={x.id} aria-pressed={t[r.key] === x.id} data-feature={`${r.key}:${x.id}`} title={x.note} onClick={() => setFeatures({ [r.key]: x.id } as Partial<Features>)}>
                  {x.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <span className="ms-title">With previews: Command Deck › Features</span>
    </details>
  );
}
