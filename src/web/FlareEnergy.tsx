/**
 * Energy on a Flare, dragged onto a Module (Program Spec "Interaction and animation", build
 * step 3, designer 2026-11-08). While a Flare's energy waits to be placed (4.6; trial rule I2),
 * its tokens sit on its tile as chips. Drag one onto a lit Module of its colour to place it
 * there; dropped anywhere else it floats back. The pop-ups beside the Modules stay the tap twin.
 */

import { useLayoutEffect, useRef, useState } from "react";
import type { Question } from "../engine/questions.js";

type Colour = "Yellow" | "Red" | "Blue";

export function FlareEnergyChips(p: { q: Question & { kind: "option" }; sector: string | undefined; onPick: (id: string) => void; onNote: (text: string) => void }) {
  const [at, setAt] = useState<{ x: number; y: number; size: number } | undefined>();
  const chips: Colour[] = (["Yellow", "Red", "Blue"] as const).flatMap((col) => Array.from({ length: p.q.energyLeft?.[col] ?? 0 }, () => col));
  useLayoutEffect(() => {
    const place = () => {
      const field = document.querySelector<HTMLElement>(".field");
      const centres: Record<string, [number, number]> = JSON.parse(field?.dataset.sectors ?? "{}");
      const c0 = p.sector ? centres[p.sector] : undefined;
      if (!field || !c0) return setAt(undefined);
      const r = field.getBoundingClientRect();
      const next = { x: r.left + c0[0], y: r.top + c0[1], size: Number(field.dataset.tile ?? 80) };
      setAt((old) => (old && old.x === next.x && old.y === next.y && old.size === next.size ? old : next));
    };
    place();
    // The Field publishes its sector centres once drawn, and redraws on resizes: keep following it.
    const timer = window.setInterval(place, 250);
    window.addEventListener("scroll", place, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", place, true);
    };
  }, [p.sector, p.q]);
  if (!at || chips.length === 0) return null;
  const gap = 30;
  const left0 = at.x - ((chips.length - 1) * gap) / 2;
  return (
    <div className="flare-chips" aria-label="Energy waiting on the Flare: drag it onto a Module">
      {chips.map((col, i) => (
        <Chip key={`${p.q.prompt}:${i}`} colour={col} x={left0 + i * gap} y={at.y + at.size * 0.22} q={p.q} onPick={p.onPick} onNote={p.onNote} />
      ))}
    </div>
  );
}

/** The Module under a screen point that takes this colour of energy now. */
function moduleAt(q: Question & { kind: "option" }, colour: Colour, x: number, y: number): string | undefined {
  // Look past the dragged chip itself (it sits under the pointer).
  const el = document
    .elementsFromPoint(x, y)
    .find((e) => !e.classList.contains("flare-chip"))
    ?.closest<HTMLElement>("[data-module]");
  const id = el?.dataset.module;
  return id !== undefined && q.energy?.[id] === colour ? id : undefined;
}

function Chip(p: { colour: Colour; x: number; y: number; q: Question & { kind: "option" }; onPick: (id: string) => void; onNote: (text: string) => void }) {
  const st = useRef<{ x: number; y: number; id: number; moved: boolean } | undefined>(undefined);
  const [drag, setDrag] = useState<{ x: number; y: number; over: boolean } | undefined>();
  const [back, setBack] = useState(false);
  const pos = drag ?? { x: p.x, y: p.y };
  return (
    <span
      role="button"
      tabIndex={-1}
      className={`flare-chip glyph ${p.colour.toLowerCase()} ${drag ? "dragging" : ""} ${drag?.over ? "over" : ""} ${back ? "back" : ""}`}
      style={{ left: pos.x, top: pos.y }}
      aria-label={`${p.colour} energy: drag it onto a ${p.colour} Module`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        st.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
        e.currentTarget.setPointerCapture(e.pointerId);
        setBack(false);
      }}
      onPointerMove={(e) => {
        const s = st.current;
        if (!s || s.id !== e.pointerId) return;
        if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return;
        s.moved = true;
        document.body.classList.add(`energy-drag-${p.colour.toLowerCase()}`);
        setDrag({ x: e.clientX, y: e.clientY, over: moduleAt(p.q, p.colour, e.clientX, e.clientY) !== undefined });
      }}
      onPointerUp={(e) => {
        const s = st.current;
        st.current = undefined;
        document.body.classList.remove(`energy-drag-${p.colour.toLowerCase()}`);
        if (!s || s.id !== e.pointerId) return;
        setDrag(undefined);
        const id = s.moved ? moduleAt(p.q, p.colour, e.clientX, e.clientY) : undefined;
        if (id !== undefined) return p.onPick(id);
        setBack(true);
        p.onNote(`Drag it onto a lit ${p.colour} Module (or tap the pop-up beside one).`);
      }}
      onPointerCancel={() => {
        st.current = undefined;
        document.body.classList.remove(`energy-drag-${p.colour.toLowerCase()}`);
        setDrag(undefined);
      }}
    >
      {p.colour[0]}
    </span>
  );
}
