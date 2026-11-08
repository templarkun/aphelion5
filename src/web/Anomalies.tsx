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

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  // Pressing a bubble shows the card's full text (designer 2026-11-08).
  const [open, setOpen] = useState<{ id: string; x: number; y: number } | undefined>();
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest(".anomaly-card") && !t?.closest(`[data-anomaly="${open.id}"]`)) setOpen(undefined);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(undefined);
    document.addEventListener("pointerdown", off, true);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", () => setOpen(undefined), { capture: true, once: true });
    return () => {
      document.removeEventListener("pointerdown", off, true);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
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
            <div key={id} role="listitem" data-anomaly={id} className={`anomaly ${o ? "met" : claim ? "unmet" : ""} ${open?.id === id ? "open" : ""}`} style={{ animationDelay: `${i * 60}ms` }}>
              <button
                className="anomaly-text"
                aria-expanded={open?.id === id}
                aria-label={`Anomaly ${id}: ${a.text} Press for the full card.`}
                onClick={(e) => {
                  if (open?.id === id) return setOpen(undefined);
                  const r = (e.currentTarget.closest(".anomaly") ?? e.currentTarget).getBoundingClientRect();
                  setOpen({ id, x: r.left + r.width / 2, y: r.bottom + 8 });
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

/** The full text of one Anomaly card, below its bubble, kept on screen. */
function AnomalyCard({ id, text, at, met, onClose }: { id: string; text: string; at: { x: number; y: number }; met: boolean | undefined; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Its left edge: centred under the bubble, kept on screen (the pop-in animation owns its transform).
  const [left, setLeft] = useState<number | undefined>();
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth ?? 0;
    setLeft(Math.max(8, Math.min(window.innerWidth - 8 - w, at.x - w / 2)));
  }, [at.x]);
  return createPortal(
    <div ref={ref} className="anomaly-card" role="dialog" aria-label={`Anomaly ${id}`} style={{ left: left ?? 0, top: at.y, visibility: left === undefined ? "hidden" : undefined }}>
      <div className="anomaly-card-head">
        <b>Anomaly {id}</b>
        <button className="mini" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <p className="anomaly-card-glyphs">{longForm(text)}</p>
      <p className="small">{text}</p>
      {met !== undefined && <p className={met ? "met-line" : "small"}>{met ? "Met now: you can claim it." : "Not met now."}</p>}
    </div>,
    document.body,
  );
}
