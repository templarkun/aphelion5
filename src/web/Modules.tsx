/**
 * Modules and Heat on the screen (designer 2026-11-08).
 *
 * A Module card: name, energy bar, effect text. The bar is a row of slots,
 * one per energy its cost needs, filled left to right by the energy on it.
 * Tap a Module you can run: it is selected (the fire outline of the Bays),
 * its bar fills from the Reserve, and pop-ups beside it offer Overclock
 * ("−2 energy +1 Heat"), X (− +) and its extra payment. Tap it again to run
 * it. Nothing is paid before that (modulePlan.ts).
 *
 * The Heat bar sits in the top bar after the Reserve: long (one cell per
 * Heat token, 10 at most, H1) when there is room, else a bubble like the
 * Reserve's.
 */

import { useLayoutEffect, useState } from "react";
import { type Anchor, PopCard, anchorOf } from "./PopCard.js";
import type { ModuleDef } from "../data/modules.js";
import type { PlanInfo, Slot } from "./modulePlan.js";

export const HEAT_MAX = 10;

/** The energy bar: empty slots that fill left to right. */
export function EnergyBar({ slots, x }: { slots: Slot[]; x?: boolean }) {
  return (
    <span className="ebar" role="img" aria-label={`${slots.filter((s) => s.fill !== "empty").length} of ${slots.length} energy`}>
      {slots.map((s, i) => (
        <i key={i} className={`slot ${s.colour.toLowerCase()} ${s.fill} part-${s.part}`} style={{ animationDelay: `${i * 40}ms` }} />
      ))}
      {x && <b className="ebar-x">X</b>}
      {slots.length === 0 && !x && <span className="ebar-free">free</span>}
    </span>
  );
}

export function ModuleCard(p: {
  def: ModuleDef;
  id: number;
  ready: boolean;
  info: PlanInfo;
  can: boolean;
  selected: boolean;
  dim: boolean;
  extraClass: string;
  onClick?: (() => void) | undefined;
  children?: React.ReactNode;
}) {
  const d = p.def;
  const Tag = p.can ? "button" : "div";
  return (
    <Tag
      data-module={p.id}
      className={`module rim-${d.colour.toLowerCase()} ${d.background === "red" ? "bg-overload" : ""} ${p.ready ? "" : "exhausted"} ${p.can ? "can" : ""} ${p.selected ? "selected" : ""} ${p.dim ? "dim" : ""} ${p.extraClass}`}
      title={`${d.name}: cost ${d.cost} ${d.colour} · ${d.background === "red" ? "Overload" : "Command phase"}${p.ready ? "" : " · exhausted"}${p.extraClass.includes("x-zero") ? " · cannot be run: its X would be 0 (put energy on it first)" : ""}. ${d.effect}${d.extraPayment ? ` Extra: ${d.extraPayment}` : ""}`}
      onClick={p.onClick}
    >
      <span className="module-inner">
        <b className="module-name">{d.name}</b>
        <EnergyBar slots={p.info.slots} x={d.cost === "X"} />
        <span className="module-text">{d.effect}</span>
        {p.children}
      </span>
    </Tag>
  );
}

export interface ModPop {
  key: string;
  /** "take" pop-ups pay something (outward arrow); "step" is a − + stepper. */
  kind: "take" | "step";
  colour: "Yellow" | "Red" | "Blue" | "Heat";
  label: string;
  onClick?: () => void;
  value?: number;
  min?: number;
  max?: number;
  onStep?: (d: 1 | -1) => void;
}

/** Pop-ups beside a selected Module: left of it, or above it when there is no room (phone). */
export function ModulePops({ id, pops }: { id: number; pops: ModPop[] }) {
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | undefined>();
  const W = 172;
  useLayoutEffect(() => {
    const place = () => {
      const el = document.querySelector(`[data-module="${id}"]`);
      if (!el) return setPos(undefined);
      const r = el.getBoundingClientRect();
      const above = r.left < W + 24;
      setPos(above ? { x: Math.max(8, r.right - W - 8), y: r.top - 6, above } : { x: r.left - W - 14, y: r.top + r.height / 2, above });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [id, pops.length]);
  if (!pos || pops.length === 0) return null;
  return (
    <div className={`mod-pops ${pos.above ? "above" : "left"}`} style={{ left: pos.x, top: pos.y, width: W }}>
      {pops.map((p, i) =>
        p.kind === "take" ? (
          <button key={p.key} className={`energy-pop take mod-pop ${p.colour.toLowerCase()}`} style={{ animationDelay: `${i * 60}ms, ${i * 60 + 300}ms` }} onClick={p.onClick}>
            <span className="out-arrow" aria-hidden>
              ←
            </span>
            <span>{p.label}</span>
          </button>
        ) : (
          <div key={p.key} className={`energy-pop mod-pop step ${p.colour.toLowerCase()}`} style={{ animationDelay: `${i * 60}ms, ${i * 60 + 300}ms` }}>
            <button className="mini" disabled={(p.value ?? 0) <= (p.min ?? 0)} onClick={() => p.onStep?.(-1)} aria-label={`Less (${p.label})`}>
              −
            </button>
            <span>
              {p.label} <b>{p.value}</b>
            </span>
            <button className="mini" disabled={(p.value ?? 0) >= (p.max ?? 0)} onClick={() => p.onStep?.(1)} aria-label={`More (${p.label})`}>
              +
            </button>
          </div>
        ),
      )}
    </div>
  );
}

/** Heat (H1): a long bar with a cell per token, or a short bubble; `gain` shows Heat a selected Module would add. Pressing it explains the Heat module. */
export function HeatBar({ heat, gain, short }: { heat: number; gain: number; short: boolean }) {
  const [open, setOpen] = useState<Anchor | undefined>();
  const add = Math.max(0, Math.min(gain, HEAT_MAX - heat));
  const label = `Heat ${heat} of ${HEAT_MAX}${gain ? ` (+${gain} if you run the selected Module)` : ""}`;
  const toggle = (e: React.MouseEvent<HTMLElement>) => setOpen(open ? undefined : anchorOf(e.currentTarget));
  return (
    <>
      {short ? (
        <button className={`heat-bubble ${add ? "gain" : ""}`} data-heat role="meter" aria-valuenow={heat} aria-valuemax={HEAT_MAX} aria-label={`${label}. Press to see how Heat works.`} title={label} onClick={toggle}>
          <Flame />
          <b>{heat}</b>
          {add > 0 && <small>+{add}</small>}
        </button>
      ) : (
        <button className="heat-long" data-heat role="meter" aria-valuenow={heat} aria-valuemax={HEAT_MAX} aria-label={`${label}. Press to see how Heat works.`} title={label} onClick={toggle}>
          <Flame />
          <span className="heat-cells">
            {Array.from({ length: HEAT_MAX }, (_, i) => (
              <i key={i} className={i < heat ? "on" : i < heat + add ? "gain" : ""} />
            ))}
          </span>
          <b>{heat}</b>
        </button>
      )}
      {open && (
        <PopCard at={open} label="The Heat module" className="heat-card" keepFor="[data-heat]" onClose={() => setOpen(undefined)}>
          <b>
            <Flame /> Heat module
          </b>
          <p>
            You start every mission with <b>10 Heat</b>, the most you can hold. Heat is not energy: it never pays a Module.
          </p>
          <ul>
            <li>
              <b>Heat Wave:</b> pay 1 Heat to deal 1 damage to one Bot (Command phase, no Alerts on the Field; in a Bot&apos;s pop-up).
            </li>
            <li>
              <b>Overclock:</b> when you run a Module, pay 2 more energy of its colour for +1 Heat, then 1 more Yellow for +1 more.
            </li>
            <li>
              <b>Power Node:</b> gain 3 Heat instead of its energy.
            </li>
            <li>
              <b>Meltdown</b> (each Overload End): you pay 1 Heat. With none left, every Bot takes 1 damage, you gain 1 Heat per Bot hit, and your Flagship takes that many + 1 damage.
            </li>
          </ul>
          <p className="small">Heat goes back at Mission End. Playing with it: −2 to your final score.</p>
        </PopCard>
      )}
    </>
  );
}

export function Flame() {
  return (
    <svg className="flame" viewBox="0 0 16 20" aria-hidden>
      <path d="M8 1c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 1.5 1 2 2.5 2 4 1-2 2-5 2-8z" />
    </svg>
  );
}
