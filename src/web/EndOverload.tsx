/**
 * End the Overload (9.2), designer 2026-11-09 / 2026-11-10: a round, see-through button like a
 * small sun. Round it, a cosmic plasma wave: stellar wind and coronal mass ejections, billowing
 * wisps of semi-transparent golden-yellow and white energy that leave the rim, expand, warp and
 * fade; slow, smooth motion with no flicker (a 2D canvas, additive "lighter" blending, the shared
 * Perlin noise). Pressed, it bursts into sparks and a shock ring, then the Overload ends.
 */

import { useEffect, useRef, useState } from "react";
import { isStill, noFlying } from "./motion.js";
import { fbm3, noise3 } from "./noise.js";

const SPARKS = 26;
const WISPS = 34;
/** The canvas reaches this many button radii out from the centre. */
const REACH = 2.1;

function sprite(rgb: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `rgba(${rgb},0.9)`);
  g.addColorStop(0.35, `rgba(${rgb},0.45)`);
  g.addColorStop(0.7, `rgba(${rgb},0.12)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return c;
}

function usePlasma(canvas: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const gold = sprite("255,196,70");
    const white = sprite("255,250,235");
    const orange = sprite("255,120,30");
    const seeds = Array.from({ length: WISPS }, (_, i) => ({ a: (i / WISPS) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.3, life: 4.2 + ((i * 7) % 5) * 0.55, off: (i * 0.618) % 1, s: i * 1.37 }));
    let raf = 0;
    let size = 0;
    const draw = (ms: number) => {
      const box = cv.parentElement?.getBoundingClientRect();
      const d = box?.width ?? 100;
      const px = Math.round(d * REACH * (window.devicePixelRatio || 1));
      if (px !== size) {
        size = px;
        cv.width = cv.height = px;
      }
      const k = px / (d * REACH);
      const R = (d / 2) * k;
      const c = px / 2;
      const t = ms / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, px, px);
      // Kept inside the Field (nothing spills over the Bays below it).
      const field = cv.parentElement?.parentElement?.getBoundingClientRect();
      const cr = cv.getBoundingClientRect();
      ctx.save();
      if (field && cr.width > 0) {
        const f = px / cr.width;
        ctx.beginPath();
        ctx.rect((field.left - cr.left) * f, (field.top - cr.top) * f, field.width * f, field.height * f);
        ctx.clip();
      }
      ctx.globalCompositeOperation = "lighter";
      // A soft corona round the rim, breathing slowly.
      const br = 0.5 + 0.5 * Math.sin(t * 0.9);
      const halo = ctx.createRadialGradient(c, c, R * 0.85, c, c, R * (1.55 + 0.12 * br));
      halo.addColorStop(0, `rgba(255,214,120,${0.32 + 0.1 * br})`);
      halo.addColorStop(0.5, "rgba(255,140,40,0.12)");
      halo.addColorStop(1, "rgba(255,90,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, px, px);
      // Wisps: born on the rim, carried out by the stellar wind, turned by the noise field, stretched along their path.
      for (const w of seeds) {
        const u = ((t / w.life + w.off) % 1 + 1) % 1;
        const out = R * (0.92 + 0.95 * (1 - (1 - u) * (1 - u)));
        const bend = 0.55 * fbm3(Math.cos(w.a) * 1.3 + w.s, Math.sin(w.a) * 1.3, t * 0.12 + u * 0.8);
        const a = w.a + bend * u + 0.06 * t;
        const x = c + Math.cos(a) * out;
        const y = c + Math.sin(a) * out;
        const grow = R * (0.22 + 0.55 * u) * (1 + 0.2 * noise3(w.s, t * 0.2, 3.3));
        const alpha = Math.pow(Math.sin(Math.PI * u), 1.6);
        ctx.setTransform(1, 0, 0, 1, x, y);
        ctx.rotate(a + bend * 0.6);
        ctx.scale(1.5 + 1.1 * u, 0.85);
        ctx.globalAlpha = 0.48 * alpha;
        ctx.drawImage(u < 0.5 ? gold : orange, -grow, -grow, grow * 2, grow * 2);
        ctx.globalAlpha = 0.4 * alpha * (1 - u);
        ctx.drawImage(white, -grow * 0.55, -grow * 0.55, grow * 1.1, grow * 1.1);
      }
      ctx.restore();
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
  usePlasma(plasma);
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
      <canvas ref={plasma} className="eo-plasma" aria-hidden="true" style={{ width: `${REACH * 100}%`, height: `${REACH * 100}%` }} />
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
