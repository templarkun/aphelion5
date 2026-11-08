/**
 * Your Anomaly cards along the top of the Field (designer 2026-11-08), one
 * bubble each. Unit names are placeholder glyphs (B = Bot, F = Flare...), to
 * be replaced by the designer's images later (spec "Art").
 *
 * Long form when every bubble fits on one line ("At least 7 B and S
 * combined"); otherwise the short form ("7× B+S"); if even that does not
 * fit, the row scrolls sideways.
 *
 * At Overload End step 3 (9.3) the met cards grow a "Claim" button; one
 * "Decline all" button keeps them all.
 */

import { useLayoutEffect, useRef, useState } from "react";
import type { GameData } from "../data/index.js";
import type { Option, Question } from "../engine/questions.js";

const WORD = /\b(Bots?|Mecha|Sentinels?|Gyros?|Sleepers?|Flares?|Cleared sectors?)\b/g;
const TYPE_OF: Record<string, string> = { Bot: "bot", Mecha: "mecha", Sentinel: "sentinel", Gyro: "gyro", Sleeper: "sleeper", Flare: "flare", "Cleared sector": "cleared" };
const LETTER: Record<string, string> = { bot: "B", mecha: "M", sentinel: "S", gyro: "G", sleeper: "P", flare: "F", cleared: "" };

/** A placeholder glyph: a small hexagon with the type's letter (Cleared sector: an empty hexagon). */
export function UnitGlyph({ type }: { type: string }) {
  const t = TYPE_OF[type] ?? type.toLowerCase();
  return (
    <span className={`ug t-${t}`} title={type} aria-label={type}>
      {LETTER[t] ?? type[0]}
    </span>
  );
}

const single = (w: string) => w.replace(/s$/, "").replace(/^Cleared sector$/, "Cleared sector");

function longForm(text: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  const t = text.replace(/\.$/, "");
  for (const m of t.matchAll(WORD)) {
    out.push(t.slice(last, m.index));
    out.push(<UnitGlyph key={m.index} type={single(m[1]!)} />);
    last = m.index! + m[0].length;
  }
  out.push(t.slice(last));
  return out;
}

function shortForm(terms: readonly string[], min: number) {
  return (
    <>
      <b>{min}×</b>{" "}
      {terms.map((t, i) => (
        <span key={t} className="ug-term">
          {i > 0 && "+"}
          {t === "non-Bot unit" ? (
            <>
              <small>non-</small>
              <UnitGlyph type="Bot" />
            </>
          ) : (
            <UnitGlyph type={t} />
          )}
        </span>
      ))}
    </>
  );
}

export function AnomalyStrip({ data, cards, q, onAnswer }: { data: GameData; cards: string[]; q: Question | undefined; onAnswer: (id: string) => void }) {
  const row = useRef<HTMLDivElement>(null);
  const [short, setShort] = useState(false);
  const claim = q?.kind === "option" && q.options.some((o) => o.on?.kind === "anomaly") ? q : undefined;
  const claimable = new Map<string, Option>();
  for (const o of claim?.options ?? []) if (o.on?.kind === "anomaly") claimable.set(o.on.id, o);
  const none = claim?.options.find((o) => o.id === "none");
  // Long form if it fits on one line, else short (measured again when the width or the cards change).
  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    const fit = () => {
      setShort(false);
      requestAnimationFrame(() => {
        if (row.current) setShort(row.current.scrollWidth > row.current.clientWidth + 1);
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cards.join(","), claim !== undefined]);
  if (cards.length === 0) return null;
  return (
    <div className={`anomaly-strip ${claim ? "claiming" : ""}`}>
      <div ref={row} className={`anomaly-row ${short ? "short" : ""}`} role="list" aria-label="Your Anomaly cards">
        {cards.map((id, i) => {
          const a = data.anomalies.byId.get(id);
          if (!a) return null;
          const o = claimable.get(id);
          return (
            <div key={id} role="listitem" className={`anomaly ${o ? "met" : claim ? "unmet" : ""}`} title={`Anomaly ${id}: ${a.text}`} style={{ animationDelay: `${i * 60}ms` }}>
              <span className="anomaly-text">{short ? shortForm(a.terms, a.minimum) : longForm(a.text)}</span>
              {o && (
                <button className="claim" onClick={() => onAnswer(o.id)}>
                  Claim
                </button>
              )}
            </div>
          );
        })}
      </div>
      {none && (
        <button className="decline" onClick={() => onAnswer(none.id)} title={none.label}>
          Decline all
        </button>
      )}
    </div>
  );
}
