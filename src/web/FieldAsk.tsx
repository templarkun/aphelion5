/**
 * Questions asked inside the Field (designer 2026-11-10): no question cards or banners while a
 * mission is on. Instead:
 *   - a big see-through bubble with a running outline (the look of "Your Flagship takes 2 damage")
 *     says what is asked; answers that are not things on the screen are bubbles inside it (Yes / No,
 *     "Choose one" options, an amount, energy colours);
 *   - things to press outside the Field (the Overhaul button, Modules) get a bubble beside them
 *     that points at them; pressing the bubble answers, as pressing the thing does.
 * The big bubble sits in the middle of the Field when the answer is outside the Field or inside the
 * bubble, and at the top when the answer is on the Field (so the board stays in sight). While you
 * press anywhere outside it, it turns almost transparent, like the old card.
 */

import { UnitText } from "./UnitGlyph.js";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type AskTone = "ask" | "alert" | "repair";

export function AskBubble(p: { tone?: AskTone; place?: "middle" | "top"; title: string; text?: string | undefined; from?: string | undefined; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [peek, setPeek] = useState(false);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setPeek(true);
    };
    const up = () => setPeek(false);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);
  return (
    <div ref={ref} className={`damage-bubble ask-bubble ${p.tone ?? "ask"} ${p.place ?? "middle"} ${peek ? "peek" : ""}`} role="status" aria-live="polite" data-ask={p.title}>
      <svg aria-hidden="true" width="100%" height="100%" preserveAspectRatio="none">
        <rect x="3" y="3" rx="28" pathLength={100} />
      </svg>
      <b>{p.title}</b>
      {p.text && <span>{p.text}</span>}
      {p.from && <span className="small">{p.from}</span>}
      {p.children}
    </div>
  );
}

/** A question's prompt as a title and a source line ("Overhaul: put one..." -> "Put one...", "Overhaul · rule 8.8"). */
export function askText(prompt: string, rule: string): { title: string; from: string } {
  const m = /^([^:]{2,30}): (.+)$/.exec(prompt);
  const head = m && !/ (is|are|do|does) /.test(m[1]!) ? m[1]! : undefined;
  const body = head ? m![2]! : prompt;
  const title = body.charAt(0).toUpperCase() + body.slice(1);
  const r = /^\d/.test(rule) ? `rule ${rule}` : rule;
  return { title, from: head && head !== rule ? `${head} · ${r}` : r };
}

export interface PointItem {
  key: string;
  /** The element pointed at. */
  selector: string;
  label: string;
  sub?: string | undefined;
  tone?: "alert" | "plain" | "repair";
  count?: number | undefined;
  disabled?: boolean | undefined;
  onPress: () => void;
}

interface Spot {
  key: string;
  x: number;
  y: number;
  side: "right" | "left" | "above" | "inside";
}

const W = 128;

/** Bubbles that point at things outside the Field (a button, Modules); a press answers. */
export function PointBubbles(p: { items: PointItem[] }) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const keys = p.items.map((i) => `${i.key}=${i.selector}`).join(",");
  useLayoutEffect(() => {
    const first = p.items[0] && document.querySelector(p.items[0].selector);
    const last = p.items.at(-1) && document.querySelector(p.items.at(-1)!.selector);
    last?.scrollIntoView({ block: "nearest" });
    first?.scrollIntoView({ block: "nearest" });
    const place = () => {
      const next: Spot[] = [];
      for (const it of p.items) {
        const el = [...document.querySelectorAll<HTMLElement>(it.selector)].find((e) => e.getBoundingClientRect().width > 0);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const box = el.closest(".panel")?.getBoundingClientRect();
        const y = r.top + r.height / 2;
        if (box && (y < box.top || y > box.bottom)) continue; // scrolled out of view
        const vw = window.innerWidth;
        // Along the bottom of the Field (phones): above it.
        if (el.closest(".field-dock")) next.push({ key: it.key, x: r.left + r.width / 2, y: r.top - 10, side: "above" });
        else if (r.right < vw / 3) next.push({ key: it.key, x: r.right + 10, y, side: "right" });
        else if (r.left > (vw * 2) / 3 || r.width > vw / 4) {
          // On the right (the Modules panel): to the left of it; no room there (phones): inside its right end.
          if (r.left < W + 24) next.push({ key: it.key, x: r.right - W - 10, y, side: "inside" });
          else next.push({ key: it.key, x: r.left - W - 14, y, side: "left" });
        } else next.push({ key: it.key, x: r.left + r.width / 2, y: r.top - 10, side: "above" });
      }
      setSpots((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    place();
    const timer = window.setInterval(place, 250);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [keys]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {spots.map((s, i) => {
        const it = p.items.find((x) => x.key === s.key)!;
        return (
          <button
            key={s.key}
            className={`point-bubble ${s.side} ${it.tone ?? "plain"} ${it.count ? "has" : ""}`}
            data-point={s.key}
            style={{ left: s.x, top: s.y, width: s.side === "left" || s.side === "inside" ? W : undefined, animationDelay: `${i * 50}ms, ${i * 50 + 450}ms` }}
            disabled={it.disabled}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              it.onPress();
            }}
          >
            <b>
              <UnitText text={it.label} />
            </b>
            {it.sub && (
              <span className="small">
                <UnitText text={it.sub} />
              </span>
            )}
            {it.count ? <span className="taken">{it.count}</span> : null}
          </button>
        );
      })}
    </>
  );
}
