/**
 * Signal Lost (designer 2026-11-24), a loss outro: the sector seen on the Flagship's holographic
 * tactical display. Hostile swarms (crimson particles) pour in from beyond the edge and the sectors
 * held in the Company's colour fall one by one, the outer ring first; the command link fails and the
 * display tears (slices shift, ghosting, static); the last beacon in the middle flares and goes dark,
 * and the display collapses to a line, then a point, like an old screen switched off. Then the dark,
 * a few embers and static. Generic: no Company outline, no Campaign map (a plain hexagonal sector of
 * 61 hexes); the Company lends only its colour. Everything is worked out from the film time alone.
 */

import type { CompanyTheme } from "../types.js";
import { displaySectors, fallTimes, glitchAt, hash01, heldAt, SIGNAL, uplinkAt } from "./timeline.js";
import { clamp01, EMBER, frameOf, glow, grain, HOSTILE, lerp, rgba, rgbOf, smooth, sprite, vignette, type FreeArea, type LossScene } from "./kit.js";

const SQ3 = Math.sqrt(3);
const T = SIGNAL;

export function createSignalScene({ theme }: { theme: CompanyTheme }): LossScene {
  const own = rgbOf(theme.primary);
  const own2 = rgbOf(theme.secondary);
  const sectors = displaySectors(T.RINGS);
  const falls = fallTimes(T.RINGS);
  // Map units: one hexagon's corner radius is 1. Pointy-top, as the Field (Core Rules 3.8: r+1 right, q+1 up-right).
  const centres = sectors.map((s) => ({ x: SQ3 * (s.r + s.q / 2), y: -1.5 * s.q }));
  const extent = SQ3 * T.RINGS + 1.2;
  let buffer: HTMLCanvasElement | undefined;

  // The hostile swarm: each mote flies in from beyond the edge to the sector it takes, arriving as it falls, then circles there.
  const MOTES = 340;
  const motes = Array.from({ length: MOTES }, (_, k) => {
    const target = Math.floor(hash01(k * 11 + 1) * sectors.length);
    const arrive = falls[target]! - 0.05 - hash01(k * 5 + 2) * 0.35;
    const travel = 1.1 + hash01(k * 3 + 7) * 1.3;
    const ang = Math.atan2(centres[target]!.y, centres[target]!.x) + (hash01(k * 13 + 5) - 0.5) * 1.6;
    return {
      target,
      arrive,
      start: arrive - travel,
      ang,
      far: extent * (1.35 + hash01(k * 17 + 9) * 0.5),
      bend: (hash01(k * 19 + 4) - 0.5) * 2.4,
      orbit: 0.25 + hash01(k * 23 + 8) * 0.55,
      spin: (hash01(k * 29 + 6) < 0.5 ? -1 : 1) * (1.2 + hash01(k) * 1.6),
      phase: hash01(k * 31 + 2) * Math.PI * 2,
      size: 0.6 + hash01(k * 37 + 3) * 0.9,
      rank: hash01(k * 41 + 1),
    };
  });

  /** A point of the map at film time t (map units -> picture points), and its depth scale. */
  function projector(cx: number, cy: number, s: number, t: number) {
    const zoom = lerp(1, 1.14, smooth(0, T.COLLAPSE_AT, t));
    const sc = (s * 0.43 * zoom) / extent;
    const a = -0.22 + t * 0.018;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const tilt = 0.98; // about 56 degrees back
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    return (x: number, y: number): [number, number, number] => {
      const X = x * ca - y * sa;
      const Y = x * sa + y * ca;
      const d = 1 / (1 + (Y * st) / (extent * 3.2));
      return [cx + X * sc * d, cy + Y * ct * sc * d, d];
    };
  }

  /** The display itself: grid, held and fallen sectors, the beacon, the swarm, sparks, telemetry. */
  function drawDisplay(g: CanvasRenderingContext2D, w: number, h: number, t: number, cx: number, cy: number, s: number, quality: number): void {
    g.fillStyle = "#010409";
    g.fillRect(0, 0, w, h);
    // The display's glass: a faint cold glow under the grid.
    const bed = g.createRadialGradient(cx, cy, 0, cx, cy, s * 0.6);
    bed.addColorStop(0, rgba(own, 0.1 * (1 - smooth(T.FIRST_FALL, T.LAST_AT, t) * 0.7)));
    bed.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = bed;
    g.fillRect(0, 0, w, h);
    const P = projector(cx, cy, s, t);
    const spOwn = sprite(own);
    const spHost = sprite(HOSTILE);
    const spEmber = sprite(EMBER);
    // Sectors, far to near.
    const order = sectors.map((_, i) => i).sort((a, b) => P(centres[a]!.x, centres[a]!.y)[1] - P(centres[b]!.x, centres[b]!.y)[1]);
    for (const i of order) {
      const c = centres[i]!;
      const f = falls[i]!;
      const fallen = t >= f;
      const flash = fallen ? 1 - clamp01((t - f) / 0.55) : 0;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const an = Math.PI / 6 + (k * Math.PI) / 3;
        const [x, y] = P(c.x + Math.cos(an) * 0.94, c.y + Math.sin(an) * 0.94);
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      if (!fallen) {
        const warn = smooth(f - 0.9, f, t);
        const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
        g.fillStyle = rgba(own, 0.06 + 0.04 * pulse);
        g.fill();
        g.strokeStyle = warn > 0 ? `rgba(${lerp(own[0], 255, warn)},${lerp(own[1], 90, warn)},${lerp(own[2], 80, warn)},${0.5 + 0.3 * warn * (0.5 + 0.5 * Math.sin(t * 22))})` : rgba(own, 0.5);
        g.lineWidth = 1.2;
        g.stroke();
      } else {
        const flick = 0.75 + 0.25 * Math.sin(t * 9 + i * 1.7);
        g.fillStyle = `rgba(${lerp(HOSTILE[0], 255, flash)},${lerp(HOSTILE[1], 230, flash)},${lerp(HOSTILE[2], 210, flash)},${0.1 * flick + flash * 0.55})`;
        g.fill();
        g.strokeStyle = rgba(HOSTILE, 0.35 + flash * 0.5);
        g.lineWidth = 1;
        g.stroke();
      }
    }
    g.save();
    g.globalCompositeOperation = "lighter";
    // Each held sector's light at its middle; it dies as the sector falls, with a spray of sparks.
    for (let i = 0; i < sectors.length; i++) {
      const c = centres[i]!;
      const f = falls[i]!;
      const [x, y, d] = P(c.x, c.y);
      const unit = s * 0.03 * d;
      if (sectors[i]!.ring === 0) continue;
      if (t < f) glow(g, spOwn, x, y, unit * (0.9 + 0.2 * Math.sin(t * 4 + i)), 0.6);
      else {
        const u = (t - f) / 0.75;
        if (u < 1) {
          for (let k = 0; k < 9; k++) {
            if (hash01(i * 97 + k) > 0.4 + quality * 0.6) continue;
            const an = hash01(i * 53 + k * 7) * Math.PI * 2;
            const r = (0.3 + hash01(i * 71 + k) * 0.9) * (1 - Math.pow(1 - u, 2.5));
            const [sx, sy] = P(c.x + Math.cos(an) * r, c.y + Math.sin(an) * r);
            glow(g, k % 3 ? spHost : spEmber, sx, sy, unit * 0.5 * (1 - u), (1 - u) * 0.9);
          }
          glow(g, spHost, x, y, unit * 3 * (1 - u * 0.6), (1 - u) * 0.7);
        }
      }
    }
    // The beacon in the middle: rings of the Company's light until the last moment; it flares white and dies.
    {
      const [x, y, d] = P(0, 0);
      const unit = s * 0.03 * d;
      if (t < T.LAST_AT) {
        const strain = smooth(T.GLITCH_AT, T.LAST_AT, t);
        for (let k = 0; k < 3; k++) {
          const ph = (t * 0.7 + k / 3) % 1;
          g.globalAlpha = (1 - ph) * 0.55 * (1 - strain * 0.5);
          g.strokeStyle = rgba(own, 1);
          g.lineWidth = 1.5;
          g.beginPath();
          g.ellipse(x, y, unit * (1 + ph * 6), unit * (1 + ph * 6) * Math.cos(0.98), 0, 0, Math.PI * 2);
          g.stroke();
        }
        const stutter = strain > 0.4 && hash01(Math.floor(t * 18) + 5) < strain * 0.35 ? 0.3 : 1;
        glow(g, spOwn, x, y, unit * 3.2, 0.9 * stutter);
        glow(g, sprite(own2), x, y, unit * 1.4, 0.8 * stutter);
      } else {
        const u = (t - T.LAST_AT) / 0.5;
        if (u < 1) {
          glow(g, sprite([255, 255, 255]), x, y, unit * (3 + u * 9), (1 - u) * 1);
          glow(g, spHost, x, y, unit * (5 + u * 12), (1 - u) * 0.7);
        }
      }
    }
    // The swarm.
    for (const m of motes) {
      if (m.rank > 0.35 + quality * 0.65 || t < m.start) continue;
      const c = centres[m.target]!;
      let x: number;
      let y: number;
      if (t < m.arrive) {
        const u = (t - m.start) / (m.arrive - m.start);
        const e = 1 - Math.pow(1 - u, 1.8);
        const sx = Math.cos(m.ang) * m.far;
        const sy = Math.sin(m.ang) * m.far;
        const px = -(c.y - sy);
        const py = c.x - sx;
        const len = Math.hypot(px, py) || 1;
        const bow = Math.sin(e * Math.PI) * m.bend;
        x = lerp(sx, c.x, e) + (px / len) * bow;
        y = lerp(sy, c.y, e) + (py / len) * bow;
      } else {
        const a = m.phase + (t - m.arrive) * m.spin;
        const r = m.orbit * (0.7 + 0.3 * Math.sin(t * 2 + m.phase));
        x = c.x + Math.cos(a) * r;
        y = c.y + Math.sin(a) * r * 0.8;
      }
      const [px, py, d] = P(x, y);
      const fl = 0.6 + 0.4 * Math.sin(t * 13 + m.phase * 3);
      glow(g, m.rank < 0.2 ? spEmber : spHost, px, py, s * 0.007 * m.size * d * (1 + fl * 0.4), 0.85 * fl);
    }
    g.restore();
    g.globalAlpha = 1;
    // Telemetry beside the grid, in the display's own type.
    const fs = Math.max(10, Math.min(13, s * 0.022));
    g.font = `600 ${fs}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    g.textBaseline = "top";
    const held = heldAt(t, T.RINGS);
    const link = uplinkAt(t);
    const lx = cx - s * 0.46;
    const ly = cy + s * 0.3;
    const ok = rgba(own, 0.85);
    const bad = rgba(HOSTILE, 0.95);
    g.fillStyle = rgba(own, 0.55);
    g.fillText("TACTICAL // SECTOR CONTROL", lx, ly);
    g.fillStyle = held > sectors.length / 3 ? ok : bad;
    g.fillText(`SECTORS HELD  ${String(held).padStart(2, "0")} / ${sectors.length}`, lx, ly + fs * 1.45);
    g.fillStyle = link > 40 ? ok : bad;
    g.fillText(`UPLINK        ${String(link).padStart(3, " ")}%`, lx, ly + fs * 2.9);
    const contacts = Math.round(motes.filter((m) => t >= m.start).length * 3.7);
    g.fillStyle = bad;
    g.fillText(`HOSTILE       ${contacts}`, lx, ly + fs * 4.35);
    // The display's corner marks.
    g.strokeStyle = rgba(own, 0.4);
    g.lineWidth = 1;
    const bx = s * 0.5;
    const by = s * 0.36;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      g.beginPath();
      g.moveTo(cx + sx * bx, cy + sy * by - sy * 18);
      g.lineTo(cx + sx * bx, cy + sy * by);
      g.lineTo(cx + sx * bx - sx * 18, cy + sy * by);
      g.stroke();
    }
  }

  return {
    draw(g, w, h, t, free, quality) {
      const k = smooth(T.DEBRIEF_AT - 0.2, T.DEBRIEF_AT + 0.7, t);
      const { cx, cy, s } = frameOf(w, h, free, k);
      const cv = g.canvas;
      const pw = cv.width;
      const ph = cv.height;
      const sx = pw / w;
      const sy = ph / h;
      if (!buffer) buffer = document.createElement("canvas");
      if (buffer.width !== pw || buffer.height !== ph) {
        buffer.width = pw;
        buffer.height = ph;
      }
      g.fillStyle = "#000";
      g.fillRect(0, 0, w, h);
      if (t < T.COLLAPSE_END) {
        const b = buffer.getContext("2d")!;
        b.setTransform(sx, 0, 0, sy, 0, 0);
        drawDisplay(b, w, h, t, cx, cy, s, quality);
        const gl = glitchAt(t);
        const frame = Math.floor(t * 14);
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        const c1 = smooth(T.COLLAPSE_AT, T.COLLAPSE_AT + 0.45, t);
        const c2 = smooth(T.COLLAPSE_AT + 0.45, T.COLLAPSE_END, t);
        const pcx = cx * sx;
        const pcy = cy * sy;
        if (c1 > 0) {
          // Switched off: squashed to a line, then to a point, white-hot as it goes.
          const dh = Math.max(1, ph * (1 - c1 * 0.995));
          const dw = Math.max(1, pw * (1 - c2 * 0.997));
          g.globalAlpha = 1 - c2 * 0.5;
          g.drawImage(buffer, 0, 0, pw, ph, pcx - dw / 2, pcy - dh / 2, dw, dh);
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = c1;
          const line = g.createLinearGradient(pcx - dw / 2, 0, pcx + dw / 2, 0);
          line.addColorStop(0, "rgba(255,255,255,0)");
          line.addColorStop(0.5, "rgba(255,255,255,1)");
          line.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = line;
          g.fillRect(pcx - dw / 2, pcy - 1.5 * sy, dw, 3 * sy);
        } else {
          // The tear: horizontal slices shifted sideways, more and wider as the link fails.
          const bands = 18;
          const bh = Math.ceil(ph / bands);
          for (let i = 0; i < bands; i++) {
            const hit = hash01(frame * 131 + i * 7) < gl * 0.55;
            const dx = hit ? (hash01(frame * 17 + i * 3) - 0.5) * pw * 0.09 * gl : 0;
            g.drawImage(buffer, 0, i * bh, pw, bh, dx, i * bh, pw, bh);
          }
          if (gl > 0) {
            // A ghost of the picture beside it (the colour split of a failing signal).
            g.globalCompositeOperation = "lighter";
            g.globalAlpha = 0.22 * gl;
            g.drawImage(buffer, 4 * sx * gl, 0);
            // Blackout frames now and then.
            if (hash01(frame * 7 + 1) < gl * 0.16) {
              g.globalCompositeOperation = "source-over";
              g.globalAlpha = 0.75;
              g.fillStyle = "#000";
              g.fillRect(0, 0, pw, ph);
            }
          }
        }
        g.restore();
        // Scan lines and static, stronger as the link fails.
        g.save();
        g.globalAlpha = 0.18 + gl * 0.12;
        g.fillStyle = "#000";
        for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
        g.restore();
        grain(g, w, h, t, 0.1 + gl * 0.45);
        if (gl > 0) {
          g.save();
          g.globalCompositeOperation = "lighter";
          for (let i = 0; i < 6; i++) {
            if (hash01(frame * 41 + i) > gl * 0.7) continue;
            g.globalAlpha = 0.25 * gl;
            g.fillStyle = "#cfe8ff";
            g.fillRect(0, hash01(frame * 23 + i * 5) * h, w, 1 + hash01(frame + i) * 2);
          }
          g.restore();
        }
      } else {
        // After: the afterglow of the point, then silence: a few embers rising in the dark, faint static.
        const u = (t - T.COLLAPSE_END) / 1.4;
        g.save();
        g.globalCompositeOperation = "lighter";
        if (u < 1) glow(g, sprite([255, 255, 255]), cx, cy, 6 + 10 * (1 - u), (1 - u) * 0.9);
        const spE = sprite(EMBER);
        const spH = sprite(HOSTILE);
        for (let i = 0; i < 70; i++) {
          if (hash01(i * 3 + 77) > 0.35 + quality * 0.65) continue;
          const life = 3 + hash01(i * 5) * 3;
          const age = (t - T.COLLAPSE_END + hash01(i * 7) * life) % life;
          const a = Math.sin((age / life) * Math.PI);
          const x = cx + (hash01(i * 11) - 0.5) * s * 0.9 + Math.sin(t * 0.7 + i) * 8;
          const y = cy + s * 0.32 - (age / life) * s * 0.55;
          glow(g, i % 3 ? spH : spE, x, y, 1.6 + hash01(i * 13) * 2.4, a * 0.55 * smooth(T.COLLAPSE_END, T.COLLAPSE_END + 0.8, t));
        }
        g.restore();
        // "NO SIGNAL", faint, flickering where the display was.
        const fl = hash01(Math.floor(t * 10)) < 0.12 ? 0.25 : 1;
        g.globalAlpha = 0.5 * fl * smooth(T.COLLAPSE_END + 0.2, T.COLLAPSE_END + 0.9, t);
        g.fillStyle = rgba(HOSTILE, 1);
        g.font = `700 ${Math.max(12, s * 0.035)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("NO SIGNAL", cx, cy);
        g.textAlign = "start";
        g.globalAlpha = 1;
        grain(g, w, h, t, 0.12);
      }
      vignette(g, w, h, 0.7);
    },
  };
}

export type { FreeArea };
