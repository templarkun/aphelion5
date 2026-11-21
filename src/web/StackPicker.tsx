/**
 * Tiles taken in the hand and put back on a sector one by one (designer 2026-11-16, first for
 * V1 Bay 3, then for every effect like it). Screen only: the rules and the questions are unchanged.
 *
 * V1_BAY3 ("look at its top 3 tiles and put them back in any order, then reveal that sector"): the
 * three tiles rise out of the sector (the Field shows what is left there: the fourth tile, or a
 * Cleared sector), and stand in a row as units. Hover (mouse) or a long press (touch, 0.5 s) shows
 * a unit's card text. A tap puts that unit back on top of the sector (it flies there); the next tap
 * puts the next one on top of it, and so on; the last one goes by itself and is revealed. Only then
 * is the engine's one question ("put them back in which order, top first?") answered, with the
 * order the player built.
 *
 * Gravity Well (Module 71: "face down on top of one Dark or Cleared sector, in any order"): the
 * same row of the tiles taken; each tap answers the engine's "which tile goes next (from the
 * bottom up)?" question after the tile has flown onto the sector.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GameData } from "../data/index.js";
import type { Question } from "../engine/questions.js";
import type { GameState } from "../engine/state.js";
import { UnitTile } from "./briefing/UnitTile.js";
import { isStill, speedFactor } from "./motion.js";

export interface StackAsk {
  /** look: tiles only looked at (V2 Bay 3 ...): shown, then put back as they were. */
  kind: "bay3" | "gravity" | "look";
  /** The sector the tiles go back onto. */
  sector: string;
  /** The tiles in the hand, in the order shown (Bay 3: as they lay, top first). */
  tiles: string[];
  title: string;
  help: string;
}

/** The questions answered on the picker (V1_BAY3's order, Gravity Well's next tile). */
export function stackAskOf(q: Question | undefined, state: GameState): StackAsk | undefined {
  if (!q || q.kind !== "option") return undefined;
  if (/^V1_BAY3: put them back in which order/.test(q.prompt)) {
    const some = q.options[0]?.id.split(">") ?? [];
    const sector = Object.keys(state.field).find((k) => state.field[k]!.includes(some[0] ?? ""));
    if (!sector) return undefined;
    const st = state.field[sector]!;
    return {
      kind: "bay3",
      sector,
      tiles: st.slice(-some.length).reverse(),
      title: "Bay 3: put them back",
      help: `Tap the units one by one: each goes on top of (${sector}). The last one is revealed.`,
    };
  }
  const g = /^Gravity Well: which tile goes next \(from the bottom up\) on \(([^)]+)\)\?/.exec(q.prompt);
  if (g) {
    return {
      kind: "gravity",
      sector: g[1]!,
      tiles: q.options.map((o) => o.id),
      title: "Gravity Well: put them on the sector",
      help: `Tap the tiles one by one: each goes face down on top of (${g[1]}).`,
    };
  }
  return undefined;
}

/**
 * Tiles just looked at from the top of one sector (V2 Bay 3, V2_P3 / V2_P3A, any effect like
 * them; designer 2026-11-16): shown the same way, lifted out of the sector, then put back as they
 * were with one button. Only when they are still the top of that sector, in that order.
 */
export function lookAskOf(look: { tile: string; unitId: string; sector?: string | undefined; rule?: string | undefined }[] | undefined, state: GameState): StackAsk | undefined {
  if (!look || look.length < 2) return undefined;
  const sector = look[0]!.sector;
  if (!sector || look.some((t) => t.sector !== sector)) return undefined;
  const st = state.field[sector] ?? [];
  const top = st.slice(-look.length).reverse();
  if (top.join() !== look.map((t) => t.tile).join()) return undefined;
  const rule = look[0]!.rule;
  const name = !rule ? "" : /ORDER/.test(rule) ? "Order: " : `${rule.replace(/^V\d_/, "").replace("BAY", "Bay ")}: `;
  return { kind: "look", sector, tiles: top, title: `${name}you looked at the top ${look.length} tiles`, help: `Of (${sector}), top first. Hover or hold one to read it.` };
}

type Phase = "in" | "wait" | "fly" | "gone";

const FLY_MS = 520;
const LIFT_MS = 560;

export function StackPicker(p: {
  data: GameData;
  state: GameState;
  ask: StackAsk;
  q?: Question & { kind: "option" };
  onAnswer: (value: string) => void;
  /** Look: the tiles are back; the picker closes. */
  onClose?: () => void;
  /** Bay 3: the sector as the Field should show it meanwhile (the stack without the tiles in the hand, plus those put back). */
  onShow: (sector: string, stack: string[] | undefined) => void;
  /** A unit's card text (App's HoverInfo, for a tile in the hand). */
  info: (tile: string) => React.ReactNode;
}) {
  const { ask } = p;
  const base = useRef<string[]>([]);
  const [placed, setPlaced] = useState<string[]>([]);
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [peek, setPeek] = useState<string | undefined>();
  const [field, setField] = useState<{ x: number; y: number; tile: number; sector: [number, number] } | undefined>();
  const slots = useRef(new Map<string, HTMLElement>());
  const holdTimer = useRef<number | undefined>();
  const held = useRef(false);
  const busy = useRef(false);
  const still = isStill();
  const ms = (t: number) => (still ? 0 : t * speedFactor());

  // The Field's place on screen and the sector's centre (followed while the picker is up).
  useLayoutEffect(() => {
    const read = () => {
      const f = document.querySelector<HTMLElement>(".field");
      if (!f) return;
      const r = f.getBoundingClientRect();
      const sec: Record<string, [number, number]> = JSON.parse(f.dataset.sectors ?? "{}");
      const at = sec[ask.sector] ?? [r.width / 2, r.height / 2];
      const next = { x: r.left, y: r.top, tile: Number(f.dataset.tile ?? 80), sector: at };
      setField((o) => (o && JSON.stringify(o) === JSON.stringify(next) ? o : next));
    };
    read();
    const t = window.setInterval(read, 300);
    window.addEventListener("resize", read);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("resize", read);
    };
  }, [ask.sector]);

  // Bay 3 and looks: on opening, the tiles leave the sector (the Field shows what is beneath them).
  useEffect(() => {
    if (ask.kind === "gravity") return;
    const st = p.state.field[ask.sector] ?? [];
    base.current = st.slice(0, st.length - ask.tiles.length);
    p.onShow(ask.sector, base.current);
    return () => p.onShow(ask.sector, undefined);
  }, [ask.kind, ask.sector]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every tile rises in (from the sector) once.
  useEffect(() => {
    const fresh = ask.tiles.filter((t) => !phase[t]);
    if (!fresh.length) return;
    setPhase((o) => ({ ...o, ...Object.fromEntries(fresh.map((t) => [t, "in" as Phase])) }));
    const id = window.setTimeout(() => setPhase((o) => ({ ...o, ...Object.fromEntries(fresh.map((t) => [t, o[t] === "in" ? ("wait" as Phase) : o[t]!])) })), 30);
    return () => window.clearTimeout(id);
  }, [ask.tiles.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const left = ask.tiles.filter((t) => !placed.includes(t) && phase[t] !== "fly" && phase[t] !== "gone");

  /** One tile flies onto the sector; then (Bay 3) it is on top there, (Gravity Well) its answer goes. */
  const put = (t: string, then?: () => void) => {
    setPhase((o) => ({ ...o, [t]: "fly" }));
    window.setTimeout(() => {
      setPhase((o) => ({ ...o, [t]: "gone" }));
      setPlaced((o) => {
        const next = [...o, t];
        if (ask.kind !== "gravity") p.onShow(ask.sector, [...base.current, ...next]);
        return next;
      });
      then?.();
    }, ms(FLY_MS));
  };

  /** Look: all of them back as they were (the bottom one first, so the top one lands last). */
  const putAllBack = () => {
    if (busy.current) return;
    busy.current = true;
    setPeek(undefined);
    const order = [...ask.tiles].reverse();
    const step = (i: number) => {
      if (i >= order.length) return void window.setTimeout(() => p.onClose?.(), ms(80));
      put(order[i]!, () => step(i + 1));
    };
    step(0);
  };

  const press = (t: string) => {
    if (ask.kind === "look") {
      setPeek((x) => (x === t ? undefined : t));
      return;
    }
    if (busy.current || phase[t] !== "wait") return;
    if (held.current) {
      held.current = false;
      return;
    }
    setPeek(undefined);
    busy.current = true;
    const rest = left.filter((x) => x !== t);
    if (ask.kind === "gravity") {
      // The engine places the last one by itself: it flies too, then the answer goes.
      put(t, () => {
        if (rest.length === 1) put(rest[0]!, () => p.onAnswer(t));
        else {
          busy.current = false;
          p.onAnswer(t);
        }
      });
      return;
    }
    put(t, () => {
      if (rest.length === 1) {
        // The last one goes by itself, then the order (top first) is sent: the engine reveals it.
        put(rest[0]!, () => {
          const order = [...placed, t, rest[0]!].reverse();
          window.setTimeout(() => p.onAnswer(order.join(">")), ms(120));
        });
      } else busy.current = false;
    });
  };

  if (!field) return null;
  const size = Math.max(64, Math.min(116, field.tile * 0.95));
  const gap = 14;
  const n = ask.tiles.length;
  const rowW = n * size + (n - 1) * gap;
  const fieldEl = document.querySelector<HTMLElement>(".field");
  const fw = fieldEl?.clientWidth ?? 600;
  const fh = fieldEl?.clientHeight ?? 400;
  // The row stands on the half of the Field away from the sector, so the sector stays in sight.
  const headRoom = ask.kind === "look" ? 104 : 72;
  const rowY = field.sector[1] > fh / 2 ? Math.max(headRoom, fh * 0.2) : Math.max(headRoom, Math.min(fh - size * 1.25 - 20, fh * 0.62));
  const rowX = Math.max(8, Math.min(fw - rowW - 8, fw / 2 - rowW / 2));
  const sx = field.x + field.sector[0];
  const sy = field.y + field.sector[1];

  return (
    <div className="stack-picker" role="group" aria-label={ask.title} data-stack-picker={ask.kind}>
      {/* The Field dimmed, the sector the tiles go back to left clear. */}
      <div
        className="sp-dim"
        style={{
          left: field.x,
          top: field.y,
          width: fw,
          height: fh,
          background: `radial-gradient(circle at ${field.sector[0]}px ${field.sector[1]}px, transparent ${field.tile * 0.5}px, rgb(4 6 12 / 0.62) ${field.tile * 0.62}px)`,
        }}
      />
      <div className="sp-head" style={{ left: field.x + fw / 2, top: field.y + rowY - 4 }}>
        <b>{ask.title}</b>
        <span>{ask.help}</span>
        {ask.kind === "look" && (
          <button type="button" className="bubble primary sp-back" onClick={putAllBack} data-action="put-back">
            Put them back
          </button>
        )}
      </div>
      {ask.tiles.map((t, i) => {
        const ph = phase[t] ?? "in";
        if (ph === "gone") return null;
        const unitId = p.state.tiles[t]?.unitId ?? "";
        const u = p.data.units.byId.get(unitId);
        const slotX = field.x + rowX + i * (size + gap) + size / 2;
        const slotY = field.y + rowY + size / 2;
        const atSector = ph === "in" || ph === "fly";
        const shrink = field.tile / size;
        const style: React.CSSProperties = {
          left: atSector ? sx : slotX,
          top: atSector ? sy : slotY,
          width: size,
          transform: `translate(-50%, -50%) scale(${atSector ? shrink * 0.9 : 1})`,
          opacity: ph === "fly" ? 0.15 : ph === "in" && ask.kind === "gravity" ? 0 : 1,
          transitionDuration: ph === "fly" ? `${ms(FLY_MS)}ms` : `${ms(LIFT_MS)}ms`,
          transitionDelay: ph === "wait" ? `${ms(i * 90)}ms` : "0ms",
        };
        return (
          <button
            key={t}
            ref={(el) => void (el ? slots.current.set(t, el) : slots.current.delete(t))}
            type="button"
            className={`sp-tile ${ph}`}
            style={style}
            data-stack-tile={t}
            data-unit={unitId}
            aria-label={`${u?.type ?? "Unit"}: put it on top of (${ask.sector})`}
            onPointerEnter={(e) => e.pointerType === "mouse" && setPeek(t)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setPeek((x) => (x === t ? undefined : x))}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (e.pointerType === "mouse") return;
              held.current = false;
              window.clearTimeout(holdTimer.current);
              holdTimer.current = window.setTimeout(() => {
                held.current = true;
                setPeek(t);
              }, 500);
            }}
            onPointerUp={() => window.clearTimeout(holdTimer.current)}
            onPointerCancel={() => window.clearTimeout(holdTimer.current)}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              press(t);
            }}
          >
            {u ? <UnitTile unit={u} level={typeof u.level === "number" ? u.level : undefined} size={size} /> : <span className="sp-unknown">?</span>}
            {ask.kind !== "gravity" && ph === "wait" && <span className="sp-order">{i === 0 ? (ask.kind === "look" ? "on top" : "was on top") : `${ask.kind === "look" ? "" : "was "}${i + 1}${i === 1 ? "nd" : i === 2 ? "rd" : "th"}`}</span>}
          </button>
        );
      })}
      {peek && phase[peek] === "wait" && (
        <div className="info-bubble sp-info" style={{ left: Math.max(8, Math.min(window.innerWidth - 296, field.x + rowX + ask.tiles.indexOf(peek) * (size + gap) + size / 2 - 140)), top: field.y + rowY + size * 1.12 + 22 }}>
          {p.info(peek)}
        </div>
      )}
      {ask.kind === "bay3" && placed.length > 0 && <div className="sp-count" style={{ left: sx, top: sy - field.tile * 0.62 }}>{placed.length} back</div>}
    </div>
  );
}
