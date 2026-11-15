/**
 * The two canvases of the briefing's particle effects.
 * AmbientLayer (behind the panels): the chosen style's background; it leans a little with the
 * pointer and rushes for a moment when the step changes (ambientKick). FxLayer (in front, never
 * takes a tap): bursts and emitters from particles.ts. Looks only. Reduced motion: one still
 * picture, no particles.
 */

import { useEffect, useRef } from "react";
import { isStill } from "../motion.js";
import { drawParticles, particles, stepEmitters, stepParticles } from "./particles.js";
import { type AmbientPainter, useBriefStyle } from "./styles/index.js";

let kick = 0;
/** The step changed: the dust and streaks rush sideways for a moment. dir: 1 forwards, -1 back. */
export function ambientKick(dir = 1): void {
  kick = dir * 1;
}

/** Fit a canvas to its box at the screen's pixel ratio (2 at most); returns the size in CSS px. */
function fit(cv: HTMLCanvasElement, g: CanvasRenderingContext2D): [number, number] {
  const r = cv.getBoundingClientRect();
  const k = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * k));
  const h = Math.max(1, Math.round(r.height * k));
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
  g.setTransform(k, 0, 0, k, 0, 0);
  return [r.width, r.height];
}

/** Run a draw function every frame while mounted (dt in seconds, capped). */
function useFrames(ref: React.RefObject<HTMLCanvasElement | null>, draw: (g: CanvasRenderingContext2D, w: number, h: number, dt: number, t: number) => void): void {
  useEffect(() => {
    const cv = ref.current;
    const g = cv?.getContext("2d");
    if (!cv || !g) return;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const [w, h] = fit(cv, g);
      draw(g, w, h, dt, t);
      // Reduced motion: a still picture, redrawn slowly (it follows resizes).
      raf = isStill() ? window.setTimeout(() => frame(performance.now()), 500) : requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(raf);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * The background of a menu screen, drawn by the chosen style (styles/<id>/ambient.ts). This
 * component gives the painter the accent, the eased pointer position and the rush of a step
 * change; a switch of style starts that style's painter.
 */
export function AmbientLayer({ rgb }: { rgb: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const style = useBriefStyle();
  const acc = useRef(rgb);
  acc.current = rgb;
  const world = useRef<{ id: string; paint: AmbientPainter; mx: number; my: number; tx: number; ty: number } | undefined>(undefined);
  if (!world.current) world.current = { id: style.id, paint: style.ambient(), mx: 0, my: 0, tx: 0, ty: 0 };
  if (world.current.id !== style.id) {
    world.current.id = style.id;
    world.current.paint = style.ambient();
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const w = world.current!;
      w.tx = e.clientX / innerWidth - 0.5;
      w.ty = e.clientY / innerHeight - 0.5;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  useFrames(ref, (g, w, h, dt, t) => {
    const W = world.current!;
    const still = isStill();
    W.mx += (W.tx - W.mx) * Math.min(1, dt * 3);
    W.my += (W.ty - W.my) * Math.min(1, dt * 3);
    kick *= Math.pow(0.02, dt);
    if (Math.abs(kick) < 0.002) kick = 0;
    W.paint(g, w, h, dt, t, { acc: acc.current, mx: W.mx, my: W.my, rush: still ? 0 : kick, still });
  });
  return <canvas ref={ref} className="bf-ambient" aria-hidden="true" />;
}

/** Bursts and emitters, above the page. One is enough for the whole screen. */
export function FxLayer() {
  const ref = useRef<HTMLCanvasElement>(null);
  useFrames(ref, (g, w, h, dt) => {
    stepEmitters(dt);
    stepParticles(dt);
    g.clearRect(0, 0, w, h);
    if (particles.length) drawParticles(g);
  });
  return <canvas ref={ref} className="bf-fx" aria-hidden="true" />;
}
