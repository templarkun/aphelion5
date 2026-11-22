/**
 * Exposure (Core Rules 9.3 step 2: at Overload End every unit alone on its sector plate takes 1 damage),
 * made plain to see (designer 2026-11-22, round 28; screen only, no rule). Played once, right after End
 * the Overload is pressed, before the hits themselves; the look is a Feature (features.ts `exposure`):
 *
 * - strike: (round 29, designer: "more prolonged, continuous") a steady stream of energy pours from the End
 *   the Overload button into each unit for about 2 s; each unit charges up, brighter and brighter, then bursts.
 * - drain: (round 29, the same) energy is drawn out of each unit in steady curling streams for about 2 s, the
 *   units dimming as they empty and the button swelling as it fills, then it flares.
 * - chain: one bolt of lightning leaps from the button to the nearest unit, then on to the next, crackling.
 * - nova: a ring of energy particles rolls out from the button over the Field; each unit flares as it passes.
 * - surge: thin threads of energy run from the button to each unit's sector plate; the plate's edge flares
 *   and sparks rise from it into the unit (it is the plate that hurts them).
 *
 * Drawn on one page-wide 2D canvas (the button is a page element, the Field a canvas) that exists only
 * while the step plays (about 1-2.6 s), at most 1.5 device pixels per CSS pixel, additive light, a few
 * hundred dots at most: cheap on a tablet's battery.
 */

import type { Step } from "./anim.js";
import type { Exposure } from "./features.js";

export interface Pt {
  x: number;
  y: number;
}
export interface ExpTarget extends Pt {
  /** The tile's radius in CSS px. */
  size: number;
}

/** Where End the Overload was last seen on the page (EndOverload.tsx writes it): its centre and radius. */
export const endOverloadAt: { x: number; y: number; r: number } = { x: NaN, y: NaN, r: 0 };

const ENERGY = { hot: "255,122,42", core: "255,236,200", violet: "176,124,255" };

const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeIn = (t: number) => t * t;
const easeOut = (t: number) => 1 - (1 - t) ** 2;

/** How long each look plays, in ms at Normal speed, for n units. */
export function exposureMs(look: Exposure, n: number): number {
  if (look === "chain") return Math.min(1900, 420 + 260 * n);
  return { strike: 2400, drain: 2600, nova: 1250, surge: 1350 }[look];
}

/** Units in the order the chain reaches them: nearest to the button first, then nearest to the last. */
export function chainOrder(from: Pt, ts: Pt[]): number[] {
  const left = ts.map((_, i) => i);
  const out: number[] = [];
  let at = from;
  while (left.length) {
    let best = 0;
    for (let k = 1; k < left.length; k++) if (Math.hypot(ts[left[k]!]!.x - at.x, ts[left[k]!]!.y - at.y) < Math.hypot(ts[left[best]!]!.x - at.x, ts[left[best]!]!.y - at.y)) best = k;
    const i = left.splice(best, 1)[0]!;
    out.push(i);
    at = ts[i]!;
  }
  return out;
}

/**
 * The step. `from()` and `to()` are read when it starts (the Field's layout as it is then). `onImpact(i)`
 * is called once as the energy reaches unit i (a small flash on the Field, optional).
 */
export function exposureStep(look: Exposure, from: () => (Pt & { r: number }) | undefined, to: () => ExpTarget[], n: number): Step {
  let cv: HTMLCanvasElement | undefined;
  let ctx: CanvasRenderingContext2D | null = null;
  let a: Pt & { r: number } = { x: 0, y: 0, r: 30 };
  let ts: ExpTarget[] = [];
  let order: number[] = [];
  let k = 1;
  const dot = (x: number, y: number, r: number, rgb: string, alpha: number) => {
    if (!ctx || alpha <= 0.01 || r <= 0) return;
    ctx.fillStyle = `rgba(${rgb},${Math.min(1, alpha)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const line = (pts: Pt[], w: number, rgb: string, alpha: number) => {
    if (!ctx || alpha <= 0.01 || pts.length < 2) return;
    ctx.strokeStyle = `rgba(${rgb},${Math.min(1, alpha)})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const hex = (c: ExpTarget, r: number, w: number, rgb: string, alpha: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 6; i++) {
      const ang = (Math.PI / 3) * i - Math.PI / 2;
      pts.push({ x: c.x + r * Math.cos(ang), y: c.y + r * Math.sin(ang) });
    }
    line(pts, w, rgb, alpha);
  };
  /** A burst at a unit: flash, ring and sparks, r in 0..1. */
  const burst = (c: ExpTarget, r: number, seed: number) => {
    if (r <= 0 || r >= 1) return;
    dot(c.x, c.y, c.size * (0.5 + 0.6 * r), ENERGY.hot, 0.3 * (1 - r) ** 2);
    dot(c.x, c.y, c.size * (0.3 + 0.4 * r), ENERGY.core, 0.6 * (1 - r) ** 2);
    if (ctx) {
      ctx.strokeStyle = `rgba(${ENERGY.hot},${0.8 * (1 - r)})`;
      ctx.lineWidth = 3 * (1 - r) + 0.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.size * (0.3 + 0.8 * r), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let j = 0; j < 24; j++) {
      const ang = rnd(seed + j) * Math.PI * 2;
      const d = c.size * (0.15 + 1.1 * easeOut(r) * (0.4 + 0.6 * rnd(seed + j + 50)));
      dot(c.x + Math.cos(ang) * d, c.y + Math.sin(ang) * d - c.size * 0.25 * r, 2.4 * (1 - r) + 0.5, j % 3 ? ENERGY.hot : ENERGY.core, 1 - r);
    }
  };
  /** A wavy path from p to q (bulging to one side by `bend`), as points. */
  const curve = (p: Pt, q: Pt, bend: number, steps = 16): Pt[] => {
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const b = Math.sin(Math.PI * t) * bend * L;
      return { x: p.x + dx * t + nx * b, y: p.y + dy * t + ny * b };
    });
  };
  const along = (pts: Pt[], t: number): Pt => {
    const f = clamp01(t) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(f));
    const q = f - i;
    return { x: pts[i]!.x + (pts[i + 1]!.x - pts[i]!.x) * q, y: pts[i]!.y + (pts[i + 1]!.y - pts[i]!.y) * q };
  };
  const jagged = (p: Pt, q: Pt, seed: number, amp: number, steps = 10): Pt[] => {
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const j = i === 0 || i === steps ? 0 : (rnd(seed + i * 7) - 0.5) * amp * Math.min(L, 160);
      return { x: p.x + dx * t + nx * j, y: p.y + dy * t + ny * j };
    });
  };

  return {
    ms: exposureMs(look, n),
    start: () => {
      ts = to();
      const f = from();
      if (!ts.length) return;
      a = f ?? { x: window.innerWidth - 60, y: window.innerHeight - 60, r: 30 };
      order = chainOrder(a, ts);
      k = Math.min(1.5, window.devicePixelRatio || 1);
      cv = document.createElement("canvas");
      cv.className = "exposure-fx";
      cv.setAttribute("aria-hidden", "true");
      cv.width = Math.round(window.innerWidth * k);
      cv.height = Math.round(window.innerHeight * k);
      cv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:40";
      document.body.appendChild(cv);
      ctx = cv.getContext("2d");
    },
    frame: (p) => {
      if (!ctx || !cv) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // The button gathers itself at the start (and, for Drain, flares as the energy arrives).
      const gather = look === "drain" ? 0 : look === "strike" ? 0.6 * (1 - clamp01((p - 0.78) / 0.15)) : clamp01(1 - p / 0.3);
      dot(a.x, a.y, a.r * (0.6 + 0.5 * gather), ENERGY.hot, 0.25 * gather);
      dot(a.x, a.y, a.r * 0.35 * (0.5 + gather), ENERGY.core, 0.35 * gather);

      if (look === "strike" || look === "drain") {
        // A steady stream along a gently waving path: motes ride it one after another (each at its own
        // place on the path, moving on with time), thick in the middle of the play and thinning at its ends.
        const into = look === "strike";
        const flow = into ? clamp01(p / 0.12) * (1 - clamp01((p - 0.78) / 0.08)) : clamp01(p / 0.1) * (1 - clamp01((p - 0.82) / 0.08));
        ts.forEach((t, i) => {
          const sway = Math.sin(p * 9 + i * 1.7) * 0.06;
          const path = into ? curve(a, t, (rnd(i + 3) - 0.5) * 0.35 + sway, 22) : curve(t, a, (rnd(i + 5) - 0.5) * 0.45 + sway, 22);
          const L = Math.hypot(t.x - a.x, t.y - a.y);
          const laps = Math.max(2.2, (2600 / Math.max(120, L)) * 1.1);
          // The beam's faint core under the motes.
          if (flow > 0.05) {
            line(path, 6, ENERGY.hot, 0.07 * flow);
            line(path, 1.2, ENERGY.core, 0.22 * flow * (0.75 + 0.25 * Math.sin(p * 40 + i)));
          }
          const N = 46;
          for (let j = 0; j < N; j++) {
            const u = (p * laps + j / N + rnd(i * 70 + j) * 0.02) % 1;
            // A mote only shows if it set off while the stream ran (so the stream fills and empties in order).
            const born = p - u / laps;
            if (born < 0 || born > 0.86 || flow <= 0) continue;
            const at = along(path, into ? easeIn(u) * 0.6 + u * 0.4 : u);
            const curl = Math.sin(u * Math.PI) * t.size * 0.18;
            const ang = rnd(i * 70 + j + 3) * Math.PI * 2 + u * 7;
            const x = at.x + Math.cos(ang) * curl;
            const y = at.y + Math.sin(ang) * curl;
            const tint = j % 5 === 0 ? ENERGY.violet : ENERGY.hot;
            dot(x, y, 4.5 - 2 * u + 1, tint, 0.16);
            dot(x, y, 1.4 + 1.4 * (1 - Math.abs(u - 0.5) * 2), j % 5 === 0 ? ENERGY.violet : ENERGY.core, 0.9);
          }
          // The unit: Strike charges it up (brighter and brighter, sparks drawn in); Drain empties it.
          const fill = into ? clamp01((p - 0.1) / 0.72) : 1 - clamp01((p - 0.1) / 0.76);
          const pulse = 0.8 + 0.2 * Math.sin(p * 60 + i * 2);
          dot(t.x, t.y, t.size * (0.45 + 0.35 * fill), ENERGY.hot, (into ? 0.28 : 0.22) * fill * pulse);
          dot(t.x, t.y, t.size * (0.2 + 0.2 * fill), ENERGY.core, 0.35 * fill * pulse);
          hex(t, t.size * 0.92, 1.4, ENERGY.core, 0.55 * fill * pulse);
          for (let j = 0; j < 12; j++) {
            const sp = (p * (into ? 2.4 : 1.6) + rnd(i * 30 + j)) % 1;
            const ang = rnd(i * 30 + j + 11) * Math.PI * 2;
            const d = t.size * (into ? 1.05 - 0.75 * sp : 0.35 + 0.8 * sp);
            dot(t.x + Math.cos(ang) * d, t.y + Math.sin(ang) * d, 1.4, j % 3 ? ENERGY.hot : ENERGY.core, 0.8 * fill * Math.sin(Math.PI * sp));
          }
          if (into) burst(t, (p - 0.84 - 0.02 * (i % 3)) / 0.16, i * 31);
        });
        if (!into) {
          // The button swells as it fills, then flares.
          const full = clamp01((p - 0.1) / 0.75);
          dot(a.x, a.y, a.r * (0.7 + 0.6 * full), ENERGY.hot, 0.22 * full);
          dot(a.x, a.y, a.r * (0.35 + 0.35 * full), ENERGY.core, 0.3 * full);
          const fl = clamp01((p - 0.86) / 0.14);
          if (fl > 0 && ctx) {
            ctx.strokeStyle = `rgba(${ENERGY.core},${0.8 * (1 - fl)})`;
            ctx.lineWidth = 3.5 * (1 - fl) + 0.5;
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.r * (0.8 + 1.6 * fl), 0, Math.PI * 2);
            ctx.stroke();
            for (let j = 0; j < 30; j++) {
              const ang = rnd(j + 700) * Math.PI * 2;
              const d = a.r * (0.6 + 2.2 * easeOut(fl) * (0.4 + 0.6 * rnd(j + 760)));
              dot(a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, 2 * (1 - fl) + 0.5, j % 3 ? ENERGY.hot : ENERGY.core, 1 - fl);
            }
          }
        }
      } else if (look === "chain") {
        const hops = order.length;
        const per = 1 / (hops + 0.6);
        let prev: Pt = a;
        order.forEach((i, h) => {
          const t = ts[i]!;
          const q = (p - h * per) / per;
          if (q > 0) {
            const flick = Math.floor(p * 40);
            const reach = clamp01(q / 0.4);
            const life = 1 - clamp01((q - 0.4) / 1.4);
            const pts = jagged(prev, t, i * 97 + flick, 0.28);
            const n2 = Math.max(2, Math.ceil(pts.length * reach));
            line(pts.slice(0, n2), 7, ENERGY.violet, 0.25 * life);
            line(pts.slice(0, n2), 1.8, ENERGY.core, 0.95 * life);
            if (reach >= 1) burst(t, (q - 0.4) / 1.2, i * 13);
          }
          prev = t;
        });
      } else if (look === "nova") {
        const far = Math.max(...ts.map((t) => Math.hypot(t.x - a.x, t.y - a.y) + t.size));
        const R = a.r + far * easeOut(clamp01(p / 0.8));
        const fade = 1 - clamp01((p - 0.7) / 0.3);
        const motes = 140;
        for (let j = 0; j < motes; j++) {
          const ang = (j / motes) * Math.PI * 2 + rnd(j) * 0.05;
          const d = R - rnd(j + 300) * 22 * (0.4 + p);
          dot(a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, 1 + 1.4 * rnd(j + 600), j % 5 ? ENERGY.hot : ENERGY.violet, 0.75 * fade * (0.5 + 0.5 * rnd(j + 900)));
        }
        if (ctx) {
          ctx.strokeStyle = `rgba(${ENERGY.core},${0.35 * fade})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(a.x, a.y, Math.max(0, R), 0, Math.PI * 2);
          ctx.stroke();
        }
        const speed = far / 0.8;
        ts.forEach((t, i) => {
          const at = (Math.hypot(t.x - a.x, t.y - a.y) - a.r) / speed;
          burst(t, (p - at) / 0.3, i * 17);
        });
      } else {
        // Plate surge: threads, then each plate's rim flares and sparks climb into the unit.
        ts.forEach((t, i) => {
          const q = clamp01(p / 0.42);
          const path = curve(a, t, (rnd(i + 7) - 0.5) * 0.25);
          if (q < 1) {
            const end = Math.max(2, Math.ceil(path.length * easeOut(q)));
            line(path.slice(0, end), 4, ENERGY.hot, 0.25);
            line(path.slice(0, end), 1.1, ENERGY.core, 0.85);
          }
          const r = clamp01((p - 0.38) / 0.62);
          if (r > 0) {
            const g = Math.sin(Math.PI * r);
            hex(t, t.size * 0.9, 6, ENERGY.hot, 0.35 * g);
            hex(t, t.size * 0.9, 1.6, ENERGY.core, 0.9 * g);
            for (let j = 0; j < 22; j++) {
              const u = rnd(i * 40 + j);
              const side = Math.floor(u * 6);
              const f = u * 6 - side;
              const a0 = (Math.PI / 3) * side - Math.PI / 2;
              const a1 = a0 + Math.PI / 3;
              const ex = t.x + t.size * 0.9 * (Math.cos(a0) + (Math.cos(a1) - Math.cos(a0)) * f);
              const ey = t.y + t.size * 0.9 * (Math.sin(a0) + (Math.sin(a1) - Math.sin(a0)) * f);
              const s0 = 0.4 * rnd(i * 40 + j + 9);
              const s = clamp01((r - s0) / 0.6);
              if (s <= 0 || s >= 1) continue;
              const x = ex + (t.x - ex) * 0.55 * easeOut(s);
              const y = ey + (t.y - ey) * 0.55 * easeOut(s) - t.size * 0.25 * s;
              dot(x, y, 1.8 * (1 - s) + 0.5, j % 3 ? ENERGY.hot : ENERGY.core, 0.9 * (1 - s));
            }
          }
        });
      }
    },
    end: () => {
      cv?.remove();
      cv = undefined;
      ctx = null;
    },
  };
}
