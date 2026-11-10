/**
 * End the Overload (9.2), designer 2026-11-09 / 2026-11-10: a round, see-through button like a
 * small sun, with the coronal waves effect round it (coronalFx.ts; designer 2026-11-10, swapped
 * with the Field edge's plasma wave). Pressed, it bursts into sparks and a shock ring, then the
 * Overload ends.
 */

import { useEffect, useRef, useState } from "react";
import { isStill, noFlying } from "./motion.js";
import { CORONAL_REACH, drawCoronalWaves } from "./coronalFx.js";

const SPARKS = 26;

/** The coronal waves round the button (coronalFx.ts), on a canvas big enough to hold all of them. */
function useCorona(canvas: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let size = 0;
    let start = 0;
    const draw = (ms: number) => {
      start ||= ms;
      const box = cv.parentElement?.getBoundingClientRect();
      const d = box?.width ?? 100;
      const px = Math.round(d * CORONAL_REACH * (window.devicePixelRatio || 1));
      if (px !== size) {
        size = px;
        cv.width = cv.height = px;
      }
      const k = px / (d * CORONAL_REACH);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, px, px);
      // The walls: the canvas, and the Field's edge (nothing spills over the Bays below it).
      const walls = { left: 0, top: 0, right: px, bottom: px };
      const field = cv.parentElement?.parentElement?.getBoundingClientRect();
      const cr = cv.getBoundingClientRect();
      if (field && cr.width > 0) {
        const f = px / cr.width;
        walls.left = Math.max(0, (field.left - cr.left) * f);
        walls.top = Math.max(0, (field.top - cr.top) * f);
        walls.right = Math.min(px, (field.right - cr.left) * f);
        walls.bottom = Math.min(px, (field.bottom - cr.top) * f);
      }
      const fade = Math.min(1, (ms - start) / 900);
      drawCoronalWaves(ctx, px / 2, (d / 2) * k, ms / 1000, isStill() ? 1 : fade, walls);
      if (!isStill()) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [canvas]);
}

export function EndOverload(p: { onEnd: () => void }) {
  const [burst, setBurst] = useState(false);
  const still = noFlying();
  const plasma = useRef<HTMLCanvasElement>(null);
  useCorona(plasma);
  return (
    <button
      className={`end-overload ${burst ? "bursting" : ""}`}
      title="No Alert tokens remain (9.2)"
      disabled={burst}
      onClick={() => {
        if (still) return p.onEnd();
        setBurst(true);
        window.setTimeout(p.onEnd, 380);
      }}
    >
      <canvas ref={plasma} className="eo-plasma" aria-hidden="true" style={{ width: `${CORONAL_REACH * 100}%`, height: `${CORONAL_REACH * 100}%` }} />
      <span className="eo-core" aria-hidden="true" />
      <span className="eo-label">
        End the
        <br />
        Overload
      </span>
      {burst && (
        <span className="eo-burst" aria-hidden="true">
          <b className="ring" />
          {Array.from({ length: SPARKS }, (_, i) => {
            const a = (i / SPARKS) * Math.PI * 2;
            const d = 60 + ((i * 29) % 50);
            return <i key={i} style={{ "--tx": `${Math.cos(a) * d}px`, "--ty": `${Math.sin(a) * d * 0.7}px` } as React.CSSProperties} />;
          })}
        </span>
      )}
    </button>
  );
}
