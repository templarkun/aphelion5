/**
 * End the Overload (9.2), designer 2026-11-09 / 2026-11-10: a round, see-through button like a
 * small sun, with the coronal waves effect round it (coronalFx.ts; designer 2026-11-10, swapped
 * with the Field edge's plasma wave). Pressed, it bursts into sparks and a shock ring, then the
 * Overload ends.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isStill, noFlying } from "./motion.js";
import { CORONAL_REACH, drawCoronalWaves } from "./coronalFx.js";
import { endOverloadAt } from "./exposureFx.js";

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

/** Distance from a point to a pointy-top hexagon (centre cx, cy; corner radius r); 0 inside. */
function hexDistance(px: number, py: number, cx: number, cy: number, r: number): number {
  const pts = Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
  let inside = true;
  let best = Infinity;
  for (let k = 0; k < 6; k++) {
    const [ax, ay] = pts[k]!;
    const [bx, by] = pts[(k + 1) % 6]!;
    if ((bx - ax) * (py - ay) - (by - ay) * (px - ax) < 0) inside = false;
    const L = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / L));
    best = Math.min(best, Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay))));
  }
  return inside ? 0 : best;
}

/** The button's size before any shrinking (as the style sheet's --eo: phones 64 px, PCs bigger). */
function naturalSize(): number {
  const w = window.innerWidth;
  const vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
  if (w < 600) return 64;
  if (w >= 1280) return Math.max(110, Math.min(172, 15 * vmin));
  return Math.max(96, Math.min(150, 13 * vmin));
}

/**
 * Where the button goes (designer 2026-11-16: never over a sector): the free place nearest the
 * lower right corner of the Field where the whole round button misses every sector; if none at
 * its full size, it is made smaller (down to 56 px) until one is found. Worked out again whenever
 * the Field changes size.
 */
function usePlace(btn: React.RefObject<HTMLButtonElement | null>) {
  const [place, setPlace] = useState<{ x: number; y: number; d: number } | undefined>();
  useLayoutEffect(() => {
    let last = "";
    const work = () => {
      const b = btn.current;
      const field = document.querySelector<HTMLElement>(".field");
      const host = b?.offsetParent as HTMLElement | null;
      if (!b || !field || !host) return;
      const fr = field.getBoundingClientRect();
      const hr = host.getBoundingClientRect();
      const key = `${field.dataset.sectors}|${field.dataset.tile}|${fr.width}x${fr.height}|${hr.left - fr.left},${hr.top - fr.top}|${window.innerWidth}x${window.innerHeight}`;
      if (key === last) return;
      last = key;
      const sectors: [number, number][] = Object.values(JSON.parse(field.dataset.sectors ?? "{}"));
      const r = Number(field.dataset.tile ?? 0) / 2;
      // The size the style sheet gives it (the --eo size), before any shrinking.
      const full = naturalSize();
      const gap = 4;
      const fits = (x: number, y: number, d: number) => sectors.every(([sx, sy]) => hexDistance(x, y, sx, sy, r) >= d / 2 + gap);
      let found: { x: number; y: number; d: number } | undefined;
      for (let d = full; !found && d >= 56; d = d > 56 && d * 0.88 < 56 ? 56 : d * 0.88) {
        let best = Infinity;
        const m = d / 2 + 6;
        for (let y = fr.height - m; y >= m; y -= 4)
          for (let x = fr.width - m; x >= m; x -= 4) {
            const far = Math.hypot(fr.width - m - x, fr.height - m - y);
            if (far < best && fits(x, y, d)) {
              best = far;
              found = { x, y, d };
            }
          }
        if (d === 56) break;
      }
      found ??= { x: fr.width - 34, y: fr.height - 34, d: 56 };
      const next = { x: Math.round(found.x + fr.left - hr.left), y: Math.round(found.y + fr.top - hr.top), d: Math.round(found.d) };
      setPlace((old) => (old && old.x === next.x && old.y === next.y && old.d === next.d ? old : next));
    };
    work();
    const timer = window.setInterval(work, 500);
    window.addEventListener("resize", work);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", work);
    };
  }, [btn]);
  return place;
}

export function EndOverload(p: { onEnd: () => void }) {
  const [burst, setBurst] = useState(false);
  const still = noFlying();
  const plasma = useRef<HTMLCanvasElement>(null);
  const self = useRef<HTMLButtonElement>(null);
  useCorona(plasma);
  const place = usePlace(self);
  // Where the button is, for Exposure's look after it is pressed (exposureFx.ts; round 28).
  const remember = () => {
    const r = self.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return;
    endOverloadAt.x = r.left + r.width / 2;
    endOverloadAt.y = r.top + r.height / 2;
    endOverloadAt.r = r.width / 2;
  };
  useLayoutEffect(remember, [place]);
  return (
    <button
      ref={self}
      className={`end-overload ${burst ? "bursting" : ""} ${place ? "placed" : ""}`}
      style={place ? ({ left: place.x - place.d / 2, top: place.y - place.d / 2, width: place.d, height: place.d, fontSize: place.d < 80 ? 10 : undefined } as React.CSSProperties) : { visibility: "hidden" }}
      title="No Alert tokens remain (9.2)"
      disabled={burst}
      onClick={() => {
        remember();
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
