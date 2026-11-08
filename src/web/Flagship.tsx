/**
 * The Flagship's Bays and the Orders as buttons (designer 2026-11-08).
 *
 * Every Bay is a same-sized button (a placeholder picture until the
 * designer's art) with a health meter above it: Company V1 shows one pip per
 * Integrity point, Company V2 a notched bar with the numbers. A press selects
 * it: a pop-up shows its text (or "Activate"), and its outline spins in fire;
 * pressing it again fires it. A Bay or Order with a target can also be
 * dragged onto the target.
 *
 * Three layouts, by screen width:
 *   A  wide: a Flagship panel, Bays down the right, their text to the left; the pop-up says "Activate".
 *   B  medium: the panel holds only the Bays; the pop-up shows the text.
 *   C  narrow: the Bays sit along the bottom of the Field, left to right, the Orders from the right.
 * Orders work the same way. In A the button shows the tokens to pay; in B and C
 * a pill "1 : swap" (tokens : one word). A Command token meter sits above them.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Answer, Option, Question } from "../engine/questions.js";

export type Layout = "A" | "B" | "C";

export interface Ability {
  id: string;
  text: string;
  /** The answer that uses it now, when it can be used. */
  opt?: Option | undefined;
}

export interface BayView {
  n: number;
  cur: number;
  max: number;
  abilities: Ability[];
  /** A damage or repair split is being placed on the Bays: this Bay takes it. */
  split?: { count: number; onAdd: () => void; onSub: () => void } | undefined;
  dim?: boolean;
}

export interface OrderView {
  id: string;
  tokens: number;
  text: string;
  word: string;
  opt?: Option | undefined;
}

/** What a drag of an ability can be dropped on (worked out by the screen from the engine). */
export interface DropTarget {
  sector: string;
  answers: Answer[];
}

export interface DragApi {
  /** Targets for using this option by dragging; none: it cannot be dragged. */
  targets: (opt: Option) => DropTarget[];
  /** While a drag is on: its targets light up on the Field (undefined when it ends). */
  onTargets: (t: { list: DropTarget[]; attack: boolean } | undefined) => void;
  /** The sector under a screen point, if it is one of the targets. */
  sectorAt: (x: number, y: number, list: DropTarget[]) => DropTarget | undefined;
  onDrop: (answers: Answer[]) => void;
  onNote: (text: string) => void;
}

/** One word for what an Order does (designer 2026-11-08: "1 : swap"). */
export function orderWord(effect: string): string {
  const e = effect.replace(/^\[Overload\]\s*/, "");
  if (/^Deal \d+ damage/i.test(e)) return "damage";
  if (/Anomaly/i.test(e)) return "anomaly";
  if (/Tick/i.test(e)) return "tick";
  const w = /^[A-Za-z]+/.exec(e)?.[0] ?? "use";
  return w.toLowerCase();
}

const ATTACK = /damage|Destroy/i;

/** A placeholder picture for an ability (the designer's art replaces it later, spec "Art"). */
function Icon({ text }: { text: string }) {
  const k = /look/i.test(text) ? "eye" : /Swap/i.test(text) ? "swap" : /Tick/i.test(text) ? "tick" : /Remove \d+ damage|repair/i.test(text) ? "fix" : ATTACK.test(text) ? "hit" : /Move|Teleport/i.test(text) ? "move" : "star";
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
      {k === "hit" && (
        <g {...p}>
          <circle cx="16" cy="16" r="9" />
          <path d="M16 3v6M16 23v6M3 16h6M23 16h6" />
          <circle cx="16" cy="16" r="2" fill="currentColor" />
        </g>
      )}
      {k === "swap" && (
        <g {...p}>
          <path d="M6 11h18l-5-5M26 21H8l5 5" />
        </g>
      )}
      {k === "eye" && (
        <g {...p}>
          <path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8S3 16 3 16z" />
          <circle cx="16" cy="16" r="3.5" />
        </g>
      )}
      {k === "tick" && (
        <g {...p}>
          <circle cx="16" cy="17" r="10" />
          <path d="M16 11v6l4 3M13 3h6" />
        </g>
      )}
      {k === "fix" && (
        <g {...p}>
          <path d="M16 7v18M7 16h18" />
          <circle cx="16" cy="16" r="12" />
        </g>
      )}
      {k === "move" && (
        <g {...p}>
          <path d="M16 4l10 6v12l-10 6-10-6V10z" />
          <path d="M11 16h10l-4-4M21 16l-4 4" />
        </g>
      )}
      {k === "star" && (
        <g {...p}>
          <path d="M16 4l3.5 8 8.5.8-6.4 5.6 1.9 8.4L16 22.4 8.5 26.8l1.9-8.4L4 12.8l8.5-.8z" />
        </g>
      )}
    </svg>
  );
}

/** Company V1: one pip per Integrity point (filled = left). */
function PipMeter({ cur, max }: { cur: number; max: number }) {
  const tone = cur === 0 ? "dead" : cur / max <= 0.34 ? "low" : cur / max <= 0.67 ? "mid" : "ok";
  return (
    <div className={`hp pips ${tone}`} role="meter" aria-valuenow={cur} aria-valuemax={max} aria-label={`Integrity ${cur} of ${max}`} title={`Integrity ${cur} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={i < cur ? "on" : ""} />
      ))}
    </div>
  );
}

/** Company V2: a notched bar with the numbers on it. */
function BarMeter({ cur, max }: { cur: number; max: number }) {
  const tone = cur === 0 ? "dead" : cur / max <= 0.34 ? "low" : cur / max <= 0.67 ? "mid" : "ok";
  return (
    <div className={`hp bar ${tone}`} role="meter" aria-valuenow={cur} aria-valuemax={max} aria-label={`Integrity ${cur} of ${max}`} title={`Integrity ${cur} of ${max}`}>
      <span className="fill" style={{ width: `${(100 * cur) / max}%` }} />
      {Array.from({ length: max - 1 }, (_, i) => (
        <span key={i} className="notch" style={{ left: `${(100 * (i + 1)) / max}%` }} />
      ))}
      <b>
        {cur}/{max}
      </b>
    </div>
  );
}

/** Command tokens: a row of small diamonds, one per token. */
export function CommandMeter({ n }: { n: number }) {
  return (
    <div className="cmd-meter" role="meter" aria-valuenow={n} aria-label={`${n} Command tokens`} title={`${n} Command token${n === 1 ? "" : "s"}`}>
      <span className="cmd-gems">
        {n === 0 ? <i className="empty" /> : Array.from({ length: Math.min(n, 12) }, (_, i) => <i key={i} />)}
      </span>
      <b>{n}</b>
    </div>
  );
}

type Sel = { key: string; el: HTMLElement; items: { label: string; long: boolean; opt?: Option | undefined }[] };

export function FlagshipDock(p: {
  layout: Layout;
  company: string;
  bays: BayView[];
  orders: OrderView[];
  commandTokens: number;
  q: Question | undefined;
  inOverload: boolean;
  onUse: (opt: Option) => void;
  /** The usable options of the Bay or Order whose pop-up is open (none when closed): the screen outlines what they affect. */
  onSelect?: (opts: Option[]) => void;
  drag: DragApi;
  /** Extra things below the Bays (Overhaul...), in layouts A and B. */
  children?: React.ReactNode;
}) {
  const [sel, setSel] = useState<Sel | undefined>();
  useEffect(() => setSel(undefined), [p.q]);
  useEffect(() => p.onSelect?.(sel ? sel.items.flatMap((it) => (it.opt ? [it.opt] : [])) : []), [sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const Meter = p.company === "V2" ? BarMeter : PipMeter;
  const press = useAbilityPress(p.drag, (key, el, items, opts) => {
    // Pressing the selected one again fires it (when it has one thing to do).
    const usable = opts.filter((o): o is Option => o !== undefined);
    if (sel?.key === key && usable.length === 1) {
      setSel(undefined);
      return p.onUse(usable[0]!);
    }
    setSel(sel?.key === key ? undefined : { key, el, items });
  });
  // A press anywhere else closes the pop-up.
  useEffect(() => {
    if (!sel) return;
    const f = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.(".thing-btn, .thing-pop")) return;
      setSel(undefined);
    };
    window.addEventListener("pointerdown", f, true);
    return () => window.removeEventListener("pointerdown", f, true);
  }, [sel]);

  const bayItems = (b: BayView) => b.abilities.map((a) => ({ label: a.opt && p.layout === "A" && b.abilities.length === 1 ? "Activate" : a.text, long: !(a.opt && p.layout === "A" && b.abilities.length === 1), opt: a.opt }));
  const bays = p.bays.map((b) => {
    const key = `bay:${b.n}`;
    const can = b.abilities.some((a) => a.opt) || b.split !== undefined;
    const firstOpt = b.abilities.find((a) => a.opt)?.opt;
    return (
      <div key={key} className={`thing bay-thing ${b.cur === 0 ? "out" : ""} ${b.dim ? "dim" : ""}`}>
        {p.layout === "A" && (
          <div className="thing-text">
            {b.abilities.map((a) => (
              <p key={a.id} className={a.opt ? "" : "small"}>
                {a.text}
              </p>
            ))}
          </div>
        )}
        <div className="thing-col">
          <Meter cur={b.cur} max={b.max} />
          <button
            className={`thing-btn bay-btn ${can ? "can" : ""} ${sel?.key === key ? "selected" : ""}`}
            aria-label={`Bay ${b.n}: ${b.abilities.map((a) => a.text).join(" / ")}`}
            {...(b.split ? { onClick: b.split.onAdd } : press(key, bayItems(b), b.abilities.map((a) => a.opt), firstOpt, firstOpt ? b.abilities.find((a) => a.opt)!.text : ""))}
          >
            <span className="thing-inner">
              <Icon text={b.abilities[0]?.text ?? ""} />
              <small>Bay {b.n}</small>
            </span>
          </button>
          {b.split && (
            <span className="split-count">
              <b>+{b.split.count}</b>
              {b.split.count > 0 && (
                <button className="mini" onClick={b.split.onSub} aria-label="Take one back">
                  −
                </button>
              )}
            </span>
          )}
        </div>
      </div>
    );
  });
  const orders = p.orders.map((o) => {
    const key = `order:${o.id}`;
    const items = [{ label: o.opt && p.layout === "A" ? "Activate" : `${o.tokens} token${o.tokens === 1 ? "" : "s"}: ${o.text}`, long: !(o.opt && p.layout === "A"), opt: o.opt }];
    const btn = (
      <button
        className={`thing-btn order-btn ${p.layout === "A" ? "square" : "pill"} ${o.opt ? "can" : ""} ${sel?.key === key ? "selected" : ""}`}
        aria-label={`Order: ${o.tokens} Command token${o.tokens === 1 ? "" : "s"}: ${o.text}`}
        {...press(key, items, [o.opt], o.opt, o.text)}
      >
        <span className="thing-inner">
          {p.layout === "A" ? (
            <>
              <b className="order-cost">{o.tokens}</b>
              <small>token{o.tokens === 1 ? "" : "s"}</small>
            </>
          ) : (
            <span className="order-pill">
              <b>{o.tokens}</b>
              <i>:</i>
              <span>{o.word}</span>
            </span>
          )}
        </span>
      </button>
    );
    return (
      <div key={key} className={`thing order-thing ${o.opt ? "" : "off"}`}>
        {p.layout === "A" && (
          <div className="thing-text">
            <p className={o.opt ? "" : "small"}>{o.text}</p>
          </div>
        )}
        <div className="thing-col">{btn}</div>
      </div>
    );
  });
  const pop = sel && <ThingPopup sel={sel} layout={p.layout} onUse={(o) => (setSel(undefined), p.onUse(o))} />;
  if (p.layout === "C")
    return (
      <div className="field-dock">
        <div className="dock-bays">{bays}</div>
        <div className="dock-orders">
          <CommandMeter n={p.commandTokens} />
          <div className="dock-order-row">{orders}</div>
        </div>
        {pop}
      </div>
    );
  return (
    <div className={`flagship layout-${p.layout}`}>
      <div className="bays-col">{bays}</div>
      {p.children}
      {p.orders.length > 0 && (
        <>
          <h3 className="orders-head">Orders</h3>
          <CommandMeter n={p.commandTokens} />
          <div className="orders-col">{orders}</div>
        </>
      )}
      {pop}
    </div>
  );
}

/** The pop-up of a selected Bay or Order: its text, or "Activate". */
function ThingPopup({ sel, layout, onUse }: { sel: Sel; layout: Layout; onUse: (o: Option) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | undefined>();
  useLayoutEffect(() => {
    const place = () => {
      const r = sel.el.getBoundingClientRect();
      const w = ref.current?.offsetWidth ?? 200;
      const h = ref.current?.offsetHeight ?? 60;
      // C: above the button. A and B: to its right (over the Field).
      const left = layout === "C" ? r.left + r.width / 2 - w / 2 : r.right + 10;
      const top = layout === "C" ? r.top - h - 10 : r.top + r.height / 2 - h / 2;
      setPos({ left: Math.max(8, Math.min(left, window.innerWidth - w - 8)), top: Math.max(8, Math.min(top, window.innerHeight - h - 8)) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [sel, layout]);
  return (
    <div ref={ref} className={`thing-pop ${layout === "C" ? "above" : "right"}`} style={pos ?? { left: -9999, top: 0 }} role="menu">
      {sel.items.map((it, i) =>
        it.opt ? (
          <button key={i} role="menuitem" className={`bubble ${it.long ? "long" : "primary"}`} style={{ animationDelay: `${i * 45}ms` }} onClick={() => onUse(it.opt!)}>
            {it.label}
          </button>
        ) : (
          <div key={i} className="bubble info" style={{ animationDelay: `${i * 45}ms` }}>
            {it.label}
            <small>Not usable now</small>
          </div>
        ),
      )}
    </div>
  );
}

/**
 * Press, tap and drag on a Bay or Order button. A tap selects (or fires the selected one);
 * a drag of an ability that has a target lights its targets and drops on one.
 */
function useAbilityPress(api: DragApi, onTap: (key: string, el: HTMLElement, items: Sel["items"], opts: (Option | undefined)[]) => void) {
  const st = useRef<{ x: number; y: number; id: number; drag?: { list: DropTarget[]; ghost: HTMLElement } | undefined; dead?: boolean } | undefined>(undefined);
  return (key: string, items: Sel["items"], opts: (Option | undefined)[], dragOpt: Option | undefined, text: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      st.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      const s = st.current;
      if (!s || s.id !== e.pointerId || s.dead) return;
      if (!s.drag) {
        if (Math.hypot(e.clientX - s.x, e.clientY - s.y) < 8) return;
        const list = dragOpt ? api.targets(dragOpt) : [];
        if (list.length === 0) {
          s.dead = true; // nothing to drop on: it stays a press
          return;
        }
        const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
        ghost.classList.add("thing-ghost");
        ghost.classList.remove("can", "selected");
        document.body.appendChild(ghost);
        s.drag = { list, ghost };
        api.onTargets({ list, attack: ATTACK.test(text) });
      }
      const g = s.drag.ghost;
      g.style.transform = `translate(${e.clientX - g.offsetWidth / 2}px, ${e.clientY - g.offsetHeight / 2}px) scale(0.85)`;
      g.classList.toggle("over", api.sectorAt(e.clientX, e.clientY, s.drag.list) !== undefined);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      const s = st.current;
      st.current = undefined;
      if (!s || s.id !== e.pointerId) return;
      if (s.drag) {
        const hit = api.sectorAt(e.clientX, e.clientY, s.drag.list);
        s.drag.ghost.remove();
        api.onTargets(undefined);
        if (hit) api.onDrop(hit.answers);
        else api.onNote("Drop it on a lit sector to use it there.");
        return;
      }
      if (s.dead && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 24) return;
      onTap(key, e.currentTarget, items, opts);
    },
    onPointerCancel: () => {
      const s = st.current;
      st.current = undefined;
      if (s?.drag) {
        s.drag.ghost.remove();
        api.onTargets(undefined);
      }
    },
  });
}
