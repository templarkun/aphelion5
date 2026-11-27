/**
 * The Campaign editor's unit card (designer 2026-11-27): hovering a unit tile with the mouse, or
 * holding it 0.5 s on touch, shows the unit's card text in the game's bubble (`.info-bubble`, the
 * same words as `UnitDefInfo` in the Allied Drop). Omega units show the Level and effects this
 * Campaign gives them; G_00 says what it is. Screen only.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { GameData } from "../../../data/index.js";
import { UnitDefInfo } from "../../AllyDrop.js";
import { isWide } from "../../wide.js";
import { effectText, G00, OMEGA_ROLES, type Draft } from "./model.js";

function OmegaInfo({ d, id }: { d: Draft; id: string }) {
  const o = d.omega.find((x) => x.id === id);
  const lines: [string, string][] = [];
  if (o) {
    const dt = o.destroyed ? effectText(o.destroyed) : "";
    const ot = o.atOverload ? effectText(o.atOverload) : "";
    if (ot) lines.push(["At Overload", ot]);
    if (dt) lines.push(["Destroyed", dt]);
  }
  return (
    <span className="info-lines">
      <b>Omega. {OMEGA_ROLES[id] ?? id}. Level {o?.level ?? "?"}.</b>
      {lines.map(([k, v], i) => (
        <span key={i}>
          <b>{k}:</b> {v}
        </span>
      ))}
      {lines.length === 0 && <span>No effects written yet for this Campaign.</span>}
    </span>
  );
}

export function infoFor(data: GameData, d: Draft, id: string): ReactNode {
  if (id === G00) return <span className="info-lines"><b>G_00.</b><span>A tile from the top of the Energy deck (an Energy Gyro, G_01-G_09). Dev price 0.7 per tile.</span></span>;
  if (id.startsWith("O_")) return <OmegaInfo d={d} id={id} />;
  const u = data.units.byId.get(id);
  return u ? <UnitDefInfo unit={u} /> : undefined;
}

/** Wraps a tile: hover (mouse) or a 0.5 s hold (touch, pen) shows the card; a hold eats the click after it. */
export function WithInfo({ info, id, children }: { info: ReactNode; id: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const hold = useRef<number>();
  const held = useRef(false);
  const [at, setAt] = useState<DOMRect | undefined>();
  const show = () => ref.current && setAt(ref.current.getBoundingClientRect());
  const hide = () => (window.clearTimeout(hold.current), setAt(undefined));
  useEffect(() => {
    if (!at) return;
    const off = () => setAt(undefined);
    window.addEventListener("scroll", off, true);
    return () => window.removeEventListener("scroll", off, true);
  }, [at]);
  useEffect(() => () => window.clearTimeout(hold.current), []);
  if (!info) return <>{children}</>;

  let card: ReactNode = null;
  if (at) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(isWide() ? 406 : 280, vw - 16);
    const left = Math.max(8, Math.min(vw - w - 8, at.left + at.width / 2 - w / 2));
    const below = at.top < vh / 2;
    card = createPortal(
      <div className="info-bubble ed-info" style={{ position: "fixed", zIndex: 80, width: w, left, ...(below ? { top: at.bottom + 6 } : { bottom: vh - at.top + 6 }) }} data-editor-card={id}>
        {info}
      </div>,
      document.body,
    );
  }
  return (
    <span
      ref={ref}
      className="inline-flex"
      data-tile-info={id}
      onPointerEnter={(e) => e.pointerType === "mouse" && show()}
      onPointerLeave={(e) => e.pointerType === "mouse" && hide()}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        held.current = false;
        window.clearTimeout(hold.current);
        hold.current = window.setTimeout(() => ((held.current = true), show()), 500);
      }}
      onPointerUp={(e) => e.pointerType !== "mouse" && hide()}
      onPointerCancel={hide}
      onClickCapture={(e) => {
        if (held.current) {
          held.current = false;
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
      {card}
    </span>
  );
}
