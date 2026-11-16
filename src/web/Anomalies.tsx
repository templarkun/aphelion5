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
import { type Anchor, PopCard, anchorOf } from "./PopCard.js";
import type { GameData } from "../data/index.js";
import { CLEARED_COLOUR, TYPE_COLOUR, unitFrameUrl } from "./glyphs.js";
import type { Option, Question } from "../engine/questions.js";

const WORD = /\b(Bots?|Mecha|Sentinels?|Gyros?|Sleepers?|Flares?|Cleared sectors?)\b/g;
const TYPE_OF: Record<string, string> = { Bot: "bot", Mecha: "mecha", Sentinel: "sentinel", Gyro: "gyro", Sleeper: "sleeper", Flare: "flare", "Cleared sector": "cleared" };
/** Sleepers are "Z" (designer 2026-11-16: "P" was their old name). */
const LETTER: Record<string, string> = { bot: "B", mecha: "M", sentinel: "S", gyro: "G", sleeper: "Z", flare: "F", omega: "O", cleared: "" };
const FIELD_TYPE: Record<string, string> = { bot: "Bot", mecha: "Mecha", sentinel: "Sentinel", gyro: "Gyro", sleeper: "Sleeper", flare: "Flare", omega: "Omega" };
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
/** Light tiles (Bots, Flares) take a dark letter. */
const DARK_LETTER = new Set(["bot", "flare"]);

/**
 * A placeholder glyph (designer 2026-11-16): a hexagon in the unit type's colour as on the Field
 * (white Bots, blue Sleepers ...), the Unit frame (art/glyphs/Unit.png) on it, then the type's
 * letter. A Cleared sector: the Field's Cleared sector colour, no frame.
 */
export function UnitGlyph({ type }: { type: string }) {
  const t = TYPE_OF[type] ?? type.toLowerCase();
  const colour = t === "cleared" ? CLEARED_COLOUR : TYPE_COLOUR[FIELD_TYPE[t] ?? ""];
  const frame = t === "cleared" ? undefined : unitFrameUrl();
  return (
    <span className={`ug t-${t} ${DARK_LETTER.has(t) ? "dark" : ""}`} title={type} aria-label={type} style={colour !== undefined ? ({ "--ug": hex(colour) } as React.CSSProperties) : undefined}>
      {frame && <img className="ug-frame" src={frame} alt="" draggable={false} />}
      <b>{LETTER[t] ?? type[0]}</b>
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
  // Pressing a bubble shows the card's full text (designer 2026-11-08).
  const [open, setOpen] = useState<{ id: string; x: number; y: number } | undefined>();
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
  return (
    <div className={`anomaly-strip ${claim ? "claiming" : ""}`}>
      <div ref={row} className={`anomaly-row ${short ? "short" : ""}`} role="list" aria-label="Your Anomaly cards">
        {cards.map((id, i) => {
          const a = data.anomalies.byId.get(id);
          if (!a) return null;
          const o = claimable.get(id);
          return (
            <div key={id} role="listitem" data-anomaly={id} className={`anomaly ${o ? "met" : claim ? "unmet" : ""} ${open?.id === id ? "open" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
              <button
                className="anomaly-text"
                aria-expanded={open?.id === id}
                aria-label={`Anomaly ${id}: ${a.text} Press for the full card.`}
                onClick={(e) => {
                  if (open?.id === id) return setOpen(undefined);
                  setOpen({ id, ...anchorOf(e.currentTarget.closest(".anomaly") ?? e.currentTarget) });
                }}
              >
                {short ? shortForm(a.terms, a.minimum) : longForm(a.text)}
              </button>
              {o && (
                <button className="claim" onClick={() => onAnswer(o.id)}>
                  Claim
                </button>
              )}
            </div>
          );
        })}
      </div>
      {open && data.anomalies.byId.get(open.id) && <AnomalyCard id={open.id} text={data.anomalies.byId.get(open.id)!.text} at={open} met={claim ? claimable.has(open.id) : undefined} onClose={() => setOpen(undefined)} />}
      {none && (
        <button className="decline" onClick={() => onAnswer(none.id)} title={none.label}>
          Decline all
        </button>
      )}
    </div>
  );
}

/** The full text of one Anomaly card, below its bubble (designer 2026-11-08: the text once, with its glyphs; no close button). */
function AnomalyCard({ id, text, at, met, onClose }: { id: string; text: string; at: Anchor; met: boolean | undefined; onClose: () => void }) {
  return (
    <PopCard at={at} label={`Anomaly ${id}`} className="anomaly-card" keepFor={`[data-anomaly="${id}"]`} onClose={onClose}>
      <b>Anomaly {id}</b>
      <p className="anomaly-card-glyphs">{longForm(text)}</p>
      {met !== undefined && <p className={`status ${met ? "met-line" : "small"}`}>{met ? "Met now: you can claim it." : "Not met now."}</p>}
    </PopCard>
  );
}
