/**
 * Style "intro1": the background of the menu screens. Stars in three depths, drifting cosmic
 * dust, small telemetry motes and soft light streaks; all lean a little with the pointer and rush
 * for a moment when the step changes. Looks only.
 */

import type { AmbientPainter } from "../types.js";

interface Star {
  x: number;
  y: number;
  z: number;
  r: number;
  tw: number;
  hue: string;
}
interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
  kind: number;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export function createAmbient(): AmbientPainter {
  const hues = ["255 255 255", "186 230 253", "253 230 138", "221 214 254"];
  const W = {
    stars: Array.from({ length: 150 }, (): Star => ({ x: Math.random(), y: Math.random(), z: Math.random() < 0.6 ? 0.25 : Math.random() < 0.7 ? 0.55 : 1, r: rnd(0.4, 1.5), tw: rnd(0, 6.28), hue: hues[Math.floor(Math.random() * hues.length)]! })),
    dust: Array.from({ length: 46 }, (): Mote => ({ x: Math.random(), y: Math.random(), vx: rnd(-0.006, -0.02), vy: rnd(-0.004, 0.004), ph: rnd(0, 6.28), kind: rnd(18, 70) })),
    motes: Array.from({ length: 16 }, (): Mote => ({ x: Math.random(), y: Math.random(), vx: rnd(-0.004, 0.004), vy: rnd(-0.012, -0.004), ph: rnd(0, 6.28), kind: Math.floor(rnd(0, 3)) })),
    streaks: Array.from({ length: 4 }, (): Mote => ({ x: Math.random(), y: Math.random(), vx: rnd(0.02, 0.05), vy: 0, ph: rnd(0, 6.28), kind: rnd(0.18, 0.4) })),
    scroll: 0,
  };
  return (g, w, h, dt, t, env) => {
    const { still, rush, acc } = env;
    W.scroll += dt * (0.004 + rush * 0.9);
    g.clearRect(0, 0, w, h);
    const wrap = (v: number) => ((v % 1) + 1) % 1;
    g.globalCompositeOperation = "lighter";
    // Cosmic dust: big, soft, barely there.
    for (const d of W.dust) {
      if (!still) {
        d.x = wrap(d.x + (d.vx - rush * 0.5) * dt);
        d.y = wrap(d.y + d.vy * dt);
      }
      const x = wrap(d.x - env.mx * 0.03) * (w + 160) - 80;
      const y = wrap(d.y - env.my * 0.03) * (h + 160) - 80;
      const a = 0.05 + 0.035 * Math.sin(t * 0.4 + d.ph);
      const grd = g.createRadialGradient(x, y, 0, x, y, d.kind);
      grd.addColorStop(0, `rgb(${d.ph > 3.4 ? acc : "165 180 252"} / ${a.toFixed(3)})`);
      grd.addColorStop(1, "rgb(0 0 0 / 0)");
      g.fillStyle = grd;
      g.fillRect(x - d.kind, y - d.kind, d.kind * 2, d.kind * 2);
    }
    // Stars, three depths: the near ones move most with the pointer.
    for (const s of W.stars) {
      const x = wrap(s.x - W.scroll * s.z - env.mx * 0.02 * s.z) * w;
      const y = wrap(s.y - env.my * 0.02 * s.z) * h;
      const a = (0.35 + 0.65 * s.z) * (0.65 + 0.35 * Math.sin(t * (0.8 + s.z) + s.tw));
      g.fillStyle = `rgb(${s.hue} / ${a.toFixed(3)})`;
      const r = s.r * (0.6 + s.z * 0.7);
      if (Math.abs(rush) > 0.05) g.fillRect(x, y - r / 2, r + Math.abs(rush) * 60 * s.z, r);
      else {
        g.beginPath();
        g.arc(x, y, r, 0, 6.283);
        g.fill();
      }
    }
    // Soft light streaks, slanting, slow.
    for (const s of W.streaks) {
      if (!still) s.x = wrap(s.x + (s.vx + Math.abs(rush) * 0.8) * dt);
      const len = s.kind * w;
      const x = s.x * (w + len * 2) - len - env.mx * 40;
      const y = s.y * h - env.my * 30 + Math.sin(t * 0.2 + s.ph) * 20;
      const grd = g.createLinearGradient(x, y, x + len, y - len * 0.12);
      grd.addColorStop(0, "rgb(0 0 0 / 0)");
      grd.addColorStop(0.5, `rgb(${acc} / 0.1)`);
      grd.addColorStop(1, "rgb(0 0 0 / 0)");
      g.strokeStyle = grd;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len, y - len * 0.12);
      g.stroke();
    }
    // Telemetry motes: tiny crosses, squares and brackets that rise and blink.
    g.lineWidth = 1;
    for (const m of W.motes) {
      if (!still) {
        m.x = wrap(m.x + (m.vx - rush * 0.3) * dt);
        m.y = wrap(m.y + m.vy * dt);
      }
      const x = Math.round(wrap(m.x - env.mx * 0.05) * w) + 0.5;
      const y = Math.round(wrap(m.y - env.my * 0.05) * h) + 0.5;
      const a = 0.16 + 0.22 * Math.max(0, Math.sin(t * 0.9 + m.ph));
      g.strokeStyle = `rgb(${acc} / ${a.toFixed(3)})`;
      g.beginPath();
      if (m.kind === 0) {
        g.moveTo(x - 4, y);
        g.lineTo(x + 4, y);
        g.moveTo(x, y - 4);
        g.lineTo(x, y + 4);
      } else if (m.kind === 1) g.rect(x - 2.5, y - 2.5, 5, 5);
      else {
        g.moveTo(x - 5, y - 4);
        g.lineTo(x - 7, y - 4);
        g.lineTo(x - 7, y + 4);
        g.lineTo(x - 5, y + 4);
        g.moveTo(x + 5, y - 4);
        g.lineTo(x + 7, y - 4);
        g.lineTo(x + 7, y + 4);
        g.lineTo(x + 5, y + 4);
      }
      g.stroke();
    }
    g.globalCompositeOperation = "source-over";
  };
}
