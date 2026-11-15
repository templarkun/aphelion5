/**
 * Style "intro2": the background of the menu screens, after the intro's picture. Deep space;
 * along the foot of the screen the planet's dark curve with its lit edge, the sunrise to the
 * right; soft blue-white exhaust dust drifting back (right to left) across the screen, and now
 * and then a thin ion trail. All of it leans a little with the pointer and rushes for a moment
 * when the step changes. The dust takes the accent colour (so it reddens with the Threat).
 * Looks only.
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
interface Puff {
  x: number;
  y: number;
  v: number;
  r: number;
  ph: number;
  near: number;
}
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const wrap = (v: number) => ((v % 1) + 1) % 1;

export function createAmbient(): AmbientPainter {
  const hues = ["255 255 255", "196 226 255", "255 232 190", "214 220 255"];
  const stars: Star[] = Array.from({ length: 170 }, () => ({ x: Math.random(), y: Math.random() * 0.9, z: Math.random() < 0.6 ? 0.25 : Math.random() < 0.7 ? 0.55 : 1, r: rnd(0.4, 1.4), tw: rnd(0, 6.28), hue: hues[Math.floor(Math.random() * hues.length)]! }));
  const dust: Puff[] = Array.from({ length: 34 }, () => {
    const near = Math.random();
    return { x: Math.random(), y: Math.random(), v: rnd(0.012, 0.03) * (0.5 + near), r: rnd(40, 130) * (0.5 + near), ph: rnd(0, 6.28), near };
  });
  const trails: Puff[] = Array.from({ length: 3 }, () => ({ x: Math.random(), y: rnd(0.1, 0.8), v: rnd(0.05, 0.09), r: rnd(0.16, 0.3), ph: rnd(0, 6.28), near: 1 }));
  let scroll = 0;

  return (g, w, h, dt, t, env) => {
    const { still, rush, acc } = env;
    scroll += dt * (0.003 + rush * 0.7);
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";

    // Stars, three depths.
    for (const s of stars) {
      const x = wrap(s.x - scroll * s.z - env.mx * 0.02 * s.z) * w;
      const y = wrap(s.y - env.my * 0.02 * s.z) * h;
      const a = (0.3 + 0.6 * s.z) * (0.65 + 0.35 * Math.sin(t * (0.8 + s.z) + s.tw));
      g.fillStyle = `rgb(${s.hue} / ${a.toFixed(3)})`;
      const r = s.r * (0.6 + s.z * 0.7);
      if (Math.abs(rush) > 0.05) g.fillRect(x, y - r / 2, r + Math.abs(rush) * 70 * s.z, r);
      else g.fillRect(x - r / 2, y - r / 2, r, r);
    }

    // The planet: a great dark curve along the foot of the screen, its edge lit, the sunrise to the right.
    const R = Math.max(w, h) * 2.4;
    const px = w * 0.4 - env.mx * 14;
    const top = h * 0.9 - env.my * 8 + Math.max(0, 700 - h) * 0.04;
    const py = top + R;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "rgb(2 5 11 / 0.92)";
    g.beginPath();
    g.arc(px, py, R, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "lighter";
    // The air: a thin bright line at the edge, a soft glow above it, a little light inside.
    const air = g.createRadialGradient(px, py, R - 46, px, py, R + 120);
    air.addColorStop(0, "rgb(40 90 150 / 0)");
    air.addColorStop(0.26, "rgb(70 130 200 / 0.16)");
    air.addColorStop(0.275, "rgb(190 235 255 / 0.5)");
    air.addColorStop(0.3, "rgb(80 150 230 / 0.2)");
    air.addColorStop(0.55, "rgb(40 90 190 / 0.07)");
    air.addColorStop(1, "rgb(30 60 160 / 0)");
    g.fillStyle = air;
    g.fillRect(0, top - 130, w, h - top + 130);
    // The sunrise: where the edge meets the right of the screen.
    const sx = w * 0.9 - env.mx * 14;
    const sy = py - Math.sqrt(Math.max(0, R * R - (sx - px) * (sx - px)));
    const breathe = 1 + 0.04 * Math.sin(t * 0.6);
    const sun = g.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * 0.5 * breathe);
    sun.addColorStop(0, "rgb(255 244 220 / 0.85)");
    sun.addColorStop(0.035, "rgb(255 200 130 / 0.5)");
    sun.addColorStop(0.16, "rgb(255 150 80 / 0.16)");
    sun.addColorStop(0.5, "rgb(255 130 70 / 0.04)");
    sun.addColorStop(1, "rgb(255 130 70 / 0)");
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    // A long streak of light through it, as a lens gives.
    const st = g.createLinearGradient(sx - w * 0.6, 0, sx + w * 0.2, 0);
    st.addColorStop(0, "rgb(255 200 140 / 0)");
    st.addColorStop(0.75, "rgb(255 226 190 / 0.35)");
    st.addColorStop(1, "rgb(255 200 140 / 0)");
    g.fillStyle = st;
    g.fillRect(sx - w * 0.6, sy - 1, w * 0.8, 2);

    // Exhaust dust: soft, slow, drifting back across the screen; the near ones bigger and faster.
    for (const d of dust) {
      if (!still) {
        d.x = wrap(d.x - (d.v + rush * 0.55 * (0.4 + d.near)) * dt);
        d.y = wrap(d.y + Math.sin(t * 0.3 + d.ph) * 0.004 * dt);
      }
      const x = wrap(d.x - env.mx * 0.04 * (0.4 + d.near)) * (w + 400) - 200;
      const y = wrap(d.y - env.my * 0.04 * (0.4 + d.near)) * (h + 200) - 100;
      const a = (0.05 + 0.04 * d.near) * (0.7 + 0.3 * Math.sin(t * 0.5 + d.ph));
      const grd = g.createRadialGradient(x, y, 0, x, y, d.r);
      grd.addColorStop(0, `rgb(${d.ph > 2.2 ? acc : "150 190 255"} / ${a.toFixed(3)})`);
      grd.addColorStop(0.5, `rgb(${d.ph > 2.2 ? acc : "120 150 255"} / ${(a * 0.4).toFixed(3)})`);
      grd.addColorStop(1, "rgb(0 0 0 / 0)");
      g.fillStyle = grd;
      g.fillRect(x - d.r, y - d.r, d.r * 2, d.r * 2);
    }
    // Ion trails: a thin bright thread with a hot head, crossing now and then.
    for (const s of trails) {
      if (!still) s.x = wrap(s.x - (s.v + Math.abs(rush) * 0.9) * dt);
      const len = s.r * w;
      const x = s.x * (w + len * 3) - len;
      const y = s.y * h - env.my * 24 + Math.sin(t * 0.2 + s.ph) * 14;
      const grd = g.createLinearGradient(x, y, x + len, y);
      grd.addColorStop(0, `rgb(255 255 255 / 0.5)`);
      grd.addColorStop(0.06, `rgb(${acc} / 0.3)`);
      grd.addColorStop(1, "rgb(0 0 0 / 0)");
      g.strokeStyle = grd;
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len, y + len * 0.03);
      g.stroke();
    }
    g.globalCompositeOperation = "source-over";
  };
}
