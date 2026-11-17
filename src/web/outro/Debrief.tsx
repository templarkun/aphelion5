/**
 * The Campaign Debrief card of the outros: the final score (Core Rules 10.3) with the lines that
 * add up to it, the vessel, the expansion played with, the Threat Level of every mission won, the
 * game's own counts (Overloads, units destroyed, Omega, Sentinels, Flares and Sleepers triggered, Gyros drained),
 * the Modules with how often each ran, and the way back. Shared by every outro, so they all
 * show the same numbers. It is on the page from the start (out of sight), so the film knows
 * which part of the picture it will leave open. Screen only.
 */

import { useEffect, useState, type CSSProperties, type Ref } from "react";
import { playHover } from "../briefing/soundHooks.js";
import { THREAT_NAMES, THREAT_RGB } from "../briefing/types.js";
import { TYPE_COLOUR } from "../glyphs.js";
import { DESTROYED_TYPES, type CampaignStats } from "./types.js";

const ENERGY_CLASS = { Yellow: "y", Red: "r", Blue: "b" } as const;
const PLURAL: Record<string, string> = { Omega: "Omega", Bot: "Bots", Sentinel: "Sentinels", Gyro: "Gyros", Sleeper: "Sleepers", Flare: "Flares" };
/** A unit type's colour on the Field, "r g b". */
const typeRgb = (type: string) => {
  const c = TYPE_COLOUR[type] ?? 0xcccccc;
  return `${(c >> 16) & 255} ${(c >> 8) & 255} ${c & 255}`;
};
const s = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The number runs up to the score when the card comes in. */
function useCountUp(to: number, on: boolean, still: boolean): number {
  const [v, setV] = useState(still ? to : 0);
  useEffect(() => {
    if (!on || still) return void setV(on || still ? to : 0);
    let raf = 0;
    const t0 = performance.now() + 450;
    const step = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / 900));
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [on, to, still]);
  return v;
}

/** Small counters side by side: a number over its name, a dot in the unit type's colour. */
function Counts({ items }: { items: { key: string; label: string; n: number; rgb: string }[] }) {
  return (
    <ul className="ou-counts">
      {items.map((x) => (
        <li key={x.key} data-count={x.key} style={{ "--c": x.rgb } as CSSProperties} className={x.n ? "" : "zero"}>
          <b>{x.n}</b>
          <span>{x.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function Debrief({ cardRef, stats, shown, still, back, onBack }: { cardRef: Ref<HTMLElement>; stats: CampaignStats; shown: boolean; still: boolean; back: Ref<HTMLButtonElement>; onBack: () => void }) {
  const score = useCountUp(stats.score, shown, still);
  // The engine's score lines: the missions go into the Threat row, the rest is listed under the score.
  const ids = new Set(stats.missions.map((m) => m.id));
  const extra = stats.scoreParts
    .filter((p) => !ids.has(p.split(":")[0]!))
    .map((p) => {
      const m = /^(.*?)\s*\(([+-]\d+)\)$/.exec(p);
      const text = m ? m[1]! : p;
      return { text: text.charAt(0).toUpperCase() + text.slice(1), value: m ? m[2]!.replace("-", "−") : "" };
    });
  const held = stats.modules.filter((m) => m.held);
  const colours = (["Yellow", "Red", "Blue"] as const).map((c) => ({ c, n: held.filter((m) => m.colour === c).length })).filter((x) => x.n > 0);
  const destroyed = DESTROYED_TYPES.reduce((n, k) => n + stats.destroyed[k], 0);
  const runs = stats.modules.reduce((n, m) => n + m.runs, 0);
  return (
    <aside ref={cardRef} className={`ou-card ${shown ? "in" : ""}`} data-debrief={shown ? "1" : "0"} aria-hidden={!shown} aria-label="Campaign debrief">
      <div className="ou-card-body">
        <header className="ou-head">
          <div className="ou-label">Campaign debrief</div>
          <h2 className="ou-title">{stats.campaignName}</h2>
          <div className="ou-note">{[stats.campaignNote, "Campaign complete"].filter(Boolean).join(" · ")}</div>
        </header>

        <section className="ou-score" aria-label={`Final score ${stats.score}`}>
          <div className="ou-score-n" data-score={stats.score}>
            {score}
          </div>
          <div className="ou-score-side">
            <div className="ou-label">Final score</div>
            {stats.highScore && <div className="ou-high">New {stats.highScore === "veteran" ? "Veteran ★ " : ""}high score</div>}
          </div>
        </section>
        <ul className="ou-parts">
          <li>
            <span>
              {s(stats.threatLevelsConquered, "Threat column")} in {s(stats.missions.length, "mission")}
            </span>
            <b>+{stats.threatLevelsConquered}</b>
          </li>
          {extra.map((p, i) => (
            <li key={i}>
              <span>{p.text}</span>
              <b>{p.value}</b>
            </li>
          ))}
        </ul>

        <dl className="ou-rows">
          <div className="ou-row" data-row="vessel">
            <dt>Vessel</dt>
            <dd>
              <b>{stats.vesselName}</b>
              <small>{stats.freshness === "veteran" ? "Veteran campaign" : "Fresh campaign"}</small>
            </dd>
          </div>
          <div className="ou-row" data-row="expansion">
            <dt>Expansion</dt>
            <dd>
              <b>{stats.expansions.length ? stats.expansions.join(", ") : "None"}</b>
            </dd>
          </div>
          <div className="ou-row" data-row="threat">
            <dt>Threat Levels conquered</dt>
            <dd>
              <b>{stats.threatLevelsConquered}</b>
              <ul className="ou-missions">
                {stats.missions.map((m) => {
                  const lv = Math.min(4, m.threat.length);
                  return (
                    <li key={m.id} style={{ "--c": THREAT_RGB[lv] } as CSSProperties} title={`${m.label}: ${THREAT_NAMES[lv] || "no Threat"}${m.threat.length ? `, column${m.threat.length === 1 ? "" : "s"} ${m.threat.join(" + ")}` : ""}`}>
                      <span className="ou-tag">{m.tag}</span>
                      <span className="ou-pips" role="img" aria-label={`Threat Level ${lv}${THREAT_NAMES[lv] ? `, ${THREAT_NAMES[lv]}` : ""}`}>
                        {[1, 2, 3, 4].map((i) => (
                          <i key={i} className={i <= lv ? "on" : ""} />
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </dd>
          </div>
          <div className="ou-row" data-row="overloads">
            <dt>Overloads</dt>
            <dd>
              <b>{stats.overloads}</b>
            </dd>
          </div>
          <div className="ou-row" data-row="destroyed">
            <dt>Units destroyed</dt>
            <dd>
              <b>{destroyed}</b>
              <Counts items={DESTROYED_TYPES.map((k) => ({ key: k, label: PLURAL[k]!, n: stats.destroyed[k], rgb: typeRgb(k) }))} />
            </dd>
          </div>
          <div className="ou-row" data-row="triggered">
            <dt>Triggered and drained</dt>
            <dd>
              <Counts
                items={[
                  { key: "Omega", label: "Omega triggered", n: stats.triggered.Omega, rgb: typeRgb("Omega") },
                  { key: "Sentinel", label: "Sentinels triggered", n: stats.triggered.Sentinel, rgb: typeRgb("Sentinel") },
                  { key: "Flare", label: "Flares triggered", n: stats.triggered.Flare, rgb: typeRgb("Flare") },
                  { key: "Sleeper", label: "Sleepers triggered", n: stats.triggered.Sleeper, rgb: typeRgb("Sleeper") },
                  { key: "Gyro", label: "Gyros drained", n: stats.drained, rgb: typeRgb("Gyro") },
                ]}
              />
            </dd>
          </div>
          <div className="ou-row" data-row="modules">
            <dt>Modules</dt>
            <dd>
              <b>{held.length}</b>
              <small>
                {colours.map((x) => (
                  <span key={x.c} className={`ou-energy ${ENERGY_CLASS[x.c]}`}>
                    {x.n} {x.c}
                  </span>
                ))}
                <span>{s(runs, "run")} in all</span>
              </small>
              <ul className="ou-mods">
                {stats.modules.map((m) => (
                  <li key={m.id} data-module={m.id} data-runs={m.runs} className={`ou-mod ${ENERGY_CLASS[m.colour]} ${m.held ? "" : "gone"}`} title={`${m.name}: run ${s(m.runs, "time")}${m.held ? "" : " (no longer held)"}`}>
                    <span>{m.name}</span>
                    <b>×{m.runs}</b>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        </dl>
      </div>
      <footer className="ou-foot">
        <button ref={back} type="button" className="bf-btn bf-primary ou-return" data-action="outro-return" tabIndex={shown ? 0 : -1} onPointerEnter={playHover} onClick={onBack}>
          Return to Command Deck
        </button>
      </footer>
    </aside>
  );
}
