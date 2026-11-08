/**
 * A small card that pops up under something you pressed (an Anomaly, the
 * Mission bar, the Heat bar; designer 2026-11-08). Portalled to the page so
 * nothing clips it; centred under the thing and kept on screen. No close
 * button: a tap anywhere else, Escape or scrolling closes it.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface Anchor {
  x: number;
  y: number;
}

/** Where a card opens for the element pressed: centred under it. */
export function anchorOf(el: Element): Anchor {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.bottom + 8 };
}

export function PopCard(p: { at: Anchor; label: string; className?: string; keepFor?: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Its left edge: centred under the thing, kept on screen (the pop-in animation owns its transform).
  const [left, setLeft] = useState<number | undefined>();
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth ?? 0;
    setLeft(Math.max(8, Math.min(window.innerWidth - 8 - w, p.at.x - w / 2)));
  }, [p.at.x]);
  useEffect(() => {
    const off = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest(".pop-card") || (p.keepFor && t?.closest(p.keepFor))) return;
      p.onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && p.onClose();
    const scroll = (e: Event) => !(e.target instanceof Element && e.target.closest(".pop-card")) && p.onClose();
    document.addEventListener("pointerdown", off, true);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", off, true);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", scroll, true);
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div ref={ref} className={`pop-card ${p.className ?? ""}`} role="dialog" aria-label={p.label} style={{ left: left ?? 0, top: p.at.y, visibility: left === undefined ? "hidden" : undefined }}>
      {p.children}
    </div>,
    document.body,
  );
}
