/**
 * Homecoming (designer 2026-11-27), a victory outro: the Flagship comes home after the won Campaign.
 * Deep space by the Company's home world (its night side lit with the Company's cities); a jump
 * flash and the Flagship drops out of its jump, stretched, then whole, with a ring of particles; escort
 * craft peel in from behind on both sides on trails of particles and form an honour guard; the
 * victory salute, one burst of light (particles in the Company's colours) per mission won, each on a
 * tracer from the Flagship; the station's ring lights up segment by segment; the Flagship slides onto
 * the docking arm and the clamps lock with a flash; the escorts peel away and the Debrief slides in.
 * Seen from the side, the ship a plain long hull in the Company's colours (no Company outline, so it
 * suits any Company). Everything is worked out from the film time alone (a skip, a still).
 */

import type { CampaignStats, CompanyTheme } from "../types.js";
import { clamp01, frameOf, glow, grain, lerp, rgba, rgbOf, smooth, sprite, vignette, type FreeArea, type LossScene } from "../loss/kit.js";
import { escortIn, escortSet, hash01, HOME, ringLit, saluteTimes, shipTravel } from "./timeline.js";

const T = HOME;
const TAU = Math.PI * 2;
type P2 = { x: number; y: number };

/** Where the Flagship's middle is (world units, the picture's short side = 1). */
const SHIP_FROM: P2 = { x: -0.44, y: 0.05 };
const SHIP_DOCK: P2 = { x: -0.05, y: 0.03 };
const SHIP_LEN = 0.27;
const HUB: P2 = { x: 0.44, y: -0.03 };
const ARM_TIP = SHIP_DOCK.x + SHIP_LEN / 2;

/** The Flagship's outline, side view, nose to the right (ship units: length 1). */
const HULL: [number, number][] = [
  [0.5, 0.0], [0.34, -0.045], [0.12, -0.075], [-0.04, -0.085], [-0.08, -0.15], [-0.2, -0.155], [-0.24, -0.09],
  [-0.42, -0.085], [-0.5, -0.055], [-0.5, 0.06], [-0.42, 0.095], [-0.1, 0.095], [0.16, 0.075], [0.36, 0.035],
];

export function createHomecomingScene({ theme, stats }: { theme: CompanyTheme; stats: CampaignStats }): LossScene {
  const own = rgbOf(theme.primary);
  const own2 = rgbOf(theme.secondary);
  const glowC = rgbOf(theme.glow);
  const hullC = rgbOf(theme.hull);
  const livery = rgbOf(theme.livery);
  const white: [number, number, number] = [255, 255, 255];
  const n = Math.max(1, stats.missions.length);
  const salutes = saluteTimes(n);
  const stars = Array.from({ length: 280 }, (_, k) => ({ x: hash01(k * 3 + 1), y: hash01(k * 5 + 2), b: 0.2 + hash01(k * 7 + 3) * 0.8, z: 0.2 + hash01(k * 11 + 4) * 0.8 }));
  const cities = Array.from({ length: 150 }, (_, k) => ({ a: -2.55 + hash01(k * 13 + 5) * 1.95, d: 0.004 + Math.pow(hash01(k * 17 + 6), 1.8) * 0.3, s: 0.6 + hash01(k * 19 + 7) * 1.4, on: hash01(k * 23 + 8) }));

  /** The Flagship's middle at film time t. */
  function ship(t: number): P2 {
    const k = shipTravel(t);
    const bob = Math.sin(t * 1.3) * 0.002;
    return { x: lerp(SHIP_FROM.x, SHIP_DOCK.x, k), y: lerp(SHIP_FROM.y, SHIP_DOCK.y, k) + bob };
  }

  /** Escort k's place in the honour guard, from the Flagship's middle: a chevron, above and below. */
  function slotOf(k: number): P2 & { side: number; near: number } {
    const side = k % 2 === 0 ? -1 : 1;
    const rank = Math.floor(k / 2);
    return { x: 0.02 - rank * 0.055, y: side * (0.1 + rank * 0.026), side, near: side > 0 ? 1 : 0.78 };
  }

  /** Escort k at film time t (world units), its size and how much of it shows; undefined before it peels in. */
  function escortAt(k: number, t: number): { x: number; y: number; size: number; a: number; heading: number } | undefined {
    if (t < escortIn(k)) return undefined;
    const slot = slotOf(k);
    const sp = ship(t);
    const end = { x: sp.x + slot.x, y: sp.y + slot.y };
    const size = 0.032 * slot.near;
    if (t < escortSet(k)) {
      const u = smooth(escortIn(k), escortSet(k), t);
      const start = { x: -0.95 - hash01(k * 31) * 0.25, y: slot.side * (0.42 + hash01(k * 37) * 0.2) };
      const c = { x: start.x + 0.55, y: end.y + slot.side * 0.2 };
      const x = (1 - u) * (1 - u) * start.x + 2 * (1 - u) * u * c.x + u * u * end.x;
      const y = (1 - u) * (1 - u) * start.y + 2 * (1 - u) * u * c.y + u * u * end.y;
      const dx = 2 * (1 - u) * (c.x - start.x) + 2 * u * (end.x - c.x);
      const dy = 2 * (1 - u) * (c.y - start.y) + 2 * u * (end.y - c.y);
      return { x, y, size, a: smooth(escortIn(k), escortIn(k) + 0.25, t), heading: Math.atan2(dy, dx) };
    }
    const peel = T.PEEL_AT + k * T.PEEL_STEP;
    const bob = Math.sin(t * 2.1 + k) * 0.004;
    if (t < peel) return { x: end.x, y: end.y + bob, size, a: 1, heading: 0 };
    const p = clamp01((t - peel) / 1.8);
    return { x: end.x + 0.9 * p * p, y: end.y + bob + slot.side * 0.35 * p * p, size: size * (1 - 0.6 * p), a: 1 - smooth(0.55, 1, p), heading: Math.atan2(slot.side * 0.35, 0.9) * Math.min(1, p * 4) };
  }

  return {
    draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, free: FreeArea | undefined, quality: number): void {
      const fr = frameOf(w, h, free, smooth(T.DEBRIEF_AT - 0.2, T.DEBRIEF_AT + 1.0, t));
      const zoom = lerp(1, 1.07, smooth(0, T.DOCK_AT, t)) + Math.max(0, t - T.DOCK_AT) * 0.004;
      const S = fr.s * 0.98 * zoom;
      const lookX = lerp(-0.1, 0.1, smooth(0, T.DOCK_AT + 0.6, t)) + Math.max(0, t - T.DOCK_AT) * 0.006;
      const X = (x: number) => fr.cx + (x - lookX) * S;
      const Y = (y: number) => fr.cy + y * S;
      const spOwn = sprite(own);
      const spOwn2 = sprite(own2);
      const spGlow = sprite(glowC);
      const spWhite = sprite(white);

      // Space.
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#02040b");
      bg.addColorStop(1, "#060a16");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "lighter";
      for (const st of stars) {
        const x = (((st.x * w - lookX * S * 0.15 * st.z) % w) + w) % w;
        const a = st.b * (0.55 + 0.45 * Math.sin(t * (1 + st.z) + st.x * 40));
        g.fillStyle = `rgba(210,225,255,${a * 0.7})`;
        g.fillRect(x, st.y * h, st.z * 1.4, st.z * 1.4);
      }
      g.globalCompositeOperation = "source-over";

      // The home world: its night side along the foot, the Company's cities, a thin rim of air lit by the sun.
      {
        const pc = { x: X(-0.15), y: Y(1.32) };
        const pr = 1.0 * S;
        const body = g.createRadialGradient(pc.x + pr * 0.35, pc.y - pr * 0.6, pr * 0.1, pc.x, pc.y, pr);
        body.addColorStop(0, "#1b2638");
        body.addColorStop(0.6, "#0a101b");
        body.addColorStop(1, "#05080e");
        g.fillStyle = body;
        g.beginPath();
        g.arc(pc.x, pc.y, pr, 0, TAU);
        g.fill();
        g.globalCompositeOperation = "lighter";
        const rim = g.createRadialGradient(pc.x, pc.y, pr * 0.97, pc.x, pc.y, pr * 1.06);
        rim.addColorStop(0, "rgba(0,0,0,0)");
        rim.addColorStop(0.45, rgba(glowC, 0.32));
        rim.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = rim;
        g.beginPath();
        g.arc(pc.x, pc.y, pr * 1.06, 0, TAU);
        g.fill();
        // The cities brighten with the salute.
        const fest = smooth(T.SALUTE_AT, T.RING_FULL, t);
        for (const c of cities) {
          if (c.on > 0.55 + 0.45 * fest) continue;
          const rr = pr * (1 - c.d);
          const x = pc.x + Math.cos(c.a) * rr;
          const y = pc.y + Math.sin(c.a) * rr;
          const fl = 0.75 + 0.25 * Math.sin(t * 3 + c.a * 90);
          glow(g, c.on < 0.5 ? spGlow : spOwn2, x, y, S * 0.006 * c.s, (0.35 + 0.4 * fest) * fl * (1 - c.d * 1.6));
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }

      // The station: ring, spokes, hub, docking arm.
      {
        const hx = X(HUB.x);
        const hy = Y(HUB.y);
        const rx = 0.3 * S;
        const ry = 0.1 * S;
        const turn = t * 0.12;
        // The ring: a thick band of plating, its upper face catching the sun, a soft glow of the Company's colour once lit.
        const lit0 = ringLit(t) / T.RING_SEGMENTS;
        if (lit0 > 0) {
          g.globalCompositeOperation = "lighter";
          g.lineWidth = S * 0.05;
          g.strokeStyle = rgba(own, 0.08 * lit0);
          g.beginPath();
          g.ellipse(hx, hy, rx, ry, -0.08, 0, TAU);
          g.stroke();
          g.globalCompositeOperation = "source-over";
        }
        g.lineWidth = Math.max(3, S * 0.02);
        g.strokeStyle = rgba([hullC[0] * 0.3, hullC[1] * 0.3, hullC[2] * 0.36], 1);
        g.beginPath();
        g.ellipse(hx, hy, rx, ry, -0.08, 0, TAU);
        g.stroke();
        g.lineWidth = Math.max(1, S * 0.006);
        g.strokeStyle = rgba([hullC[0] * 0.75, hullC[1] * 0.75, hullC[2] * 0.8], 0.9);
        g.beginPath();
        g.ellipse(hx, hy - S * 0.007, rx, ry, -0.08, 0, TAU);
        g.stroke();
        g.lineWidth = Math.max(1, S * 0.004);
        g.strokeStyle = rgba([hullC[0] * 0.6, hullC[1] * 0.6, hullC[2] * 0.65], 0.8);
        g.beginPath();
        g.ellipse(hx, hy - S * 0.004, rx, ry, -0.08, Math.PI, TAU);
        g.stroke();
        for (let i = 0; i < 4; i++) {
          const a = turn + (i * TAU) / 4;
          g.beginPath();
          g.moveTo(hx, hy);
          g.lineTo(hx + Math.cos(a) * rx * Math.cos(0.08) + Math.sin(a) * ry * Math.sin(0.08), hy + Math.sin(a) * ry - Math.cos(a) * rx * Math.sin(0.08));
          g.stroke();
        }
        const hub = g.createRadialGradient(hx - S * 0.01, hy - S * 0.015, 0, hx, hy, S * 0.05);
        hub.addColorStop(0, rgba([hullC[0] * 0.9, hullC[1] * 0.9, hullC[2] * 0.95], 1));
        hub.addColorStop(1, rgba([hullC[0] * 0.25, hullC[1] * 0.25, hullC[2] * 0.3], 1));
        g.fillStyle = hub;
        g.beginPath();
        g.arc(hx, hy, S * 0.045, 0, TAU);
        g.fill();
        // The docking arm, out to the berth.
        const ay = Y(SHIP_DOCK.y - 0.005);
        g.fillStyle = rgba([hullC[0] * 0.45, hullC[1] * 0.45, hullC[2] * 0.5], 1);
        g.fillRect(X(ARM_TIP), ay - S * 0.009, hx - X(ARM_TIP) - S * 0.03, S * 0.018);
        g.fillStyle = rgba([hullC[0] * 0.7, hullC[1] * 0.7, hullC[2] * 0.75], 1);
        g.fillRect(X(ARM_TIP) - S * 0.006, ay - S * 0.022, S * 0.016, S * 0.044);
        // The ring's lights: segment by segment in the Company's colour with the salute; dim amber before.
        g.globalCompositeOperation = "lighter";
        const lit = ringLit(t);
        for (let j = 0; j < T.RING_SEGMENTS; j++) {
          const a = turn + (j * TAU) / T.RING_SEGMENTS;
          const x = hx + Math.cos(a) * rx;
          const y = hy + Math.sin(a) * ry - Math.cos(a) * rx * 0.08;
          const front = Math.sin(a) > 0 ? 1 : 0.6;
          if (j < lit) {
            const age = t - (T.RING_AT + (j / T.RING_SEGMENTS) * (T.RING_FULL - T.RING_AT));
            const flare = 1 + 1.6 * Math.exp(-age * 4);
            glow(g, j % 2 ? spOwn : spOwn2, x, y, S * 0.016 * flare, 0.8 * front);
            glow(g, spWhite, x, y, S * 0.004, 0.9 * front);
          } else glow(g, sprite([255, 170, 80]), x, y, S * 0.006, 0.35 * front * (0.6 + 0.4 * Math.sin(t * 4 + j)));
        }
        // Hub beacon.
        glow(g, spOwn, hx, hy - S * 0.05, S * (0.012 + 0.006 * Math.sin(t * 5)), 0.9);
        // The clamps lock: a flash and a ring at the berth.
        if (t >= T.DOCK_AT) {
          const d = t - T.DOCK_AT;
          glow(g, spWhite, X(ARM_TIP), ay, S * (0.03 + 0.05 * Math.exp(-d * 3)), Math.exp(-d * 2.5));
          g.strokeStyle = rgba(own, 0.8 * Math.exp(-d * 2));
          g.lineWidth = Math.max(1, S * 0.003);
          g.beginPath();
          g.ellipse(X(ARM_TIP), ay, S * (0.02 + d * 0.12), S * (0.02 + d * 0.12) * 0.5, 0, 0, TAU);
          g.stroke();
          glow(g, spOwn, X(ARM_TIP), ay, S * 0.012, 0.7 + 0.3 * Math.sin(t * 6));
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }

      // Escorts behind the Flagship (the upper ones, farther away).
      const drawEscort = (k: number) => {
        const e = escortAt(k, t);
        if (!e || e.a <= 0) return;
        g.globalCompositeOperation = "lighter";
        // A trail of particles: where it was a moment ago.
        const trail = Math.round(12 * quality);
        for (let j = 1; j <= trail; j++) {
          const p = escortAt(k, t - j * 0.035);
          if (!p) break;
          glow(g, spOwn2, X(p.x - p.size * 0.5), Y(p.y), S * p.size * 0.22 * (1 - j / (trail + 1)), 0.4 * e.a * (1 - j / (trail + 1)));
        }
        glow(g, spOwn, X(e.x - e.size * 0.55 * Math.cos(e.heading)), Y(e.y - e.size * 0.55 * Math.sin(e.heading)), S * e.size * 0.35, 0.9 * e.a);
        g.globalCompositeOperation = "source-over";
        g.save();
        g.translate(X(e.x), Y(e.y));
        g.rotate(e.heading);
        const L = S * e.size;
        g.globalAlpha = e.a;
        g.fillStyle = rgba([hullC[0] * 0.8, hullC[1] * 0.8, hullC[2] * 0.85], 1);
        g.beginPath();
        g.moveTo(L * 0.6, 0);
        g.lineTo(-L * 0.45, -L * 0.28);
        g.lineTo(-L * 0.3, 0);
        g.lineTo(-L * 0.45, L * 0.28);
        g.closePath();
        g.fill();
        g.fillStyle = rgba(livery, 1);
        g.fillRect(-L * 0.2, -L * 0.04, L * 0.45, L * 0.08);
        g.restore();
        g.globalAlpha = 1;
      };
      for (let k = 0; k < T.ESCORTS; k += 2) drawEscort(k);

      // The Flagship.
      if (t >= T.ARRIVE_AT - 0.5) {
        const sp = ship(t);
        const sx = X(sp.x);
        const sy = Y(sp.y);
        const L = SHIP_LEN * S;
        // Before the jump ends: light gathering at the arrival point.
        if (t < T.ARRIVE_AT) {
          g.globalCompositeOperation = "lighter";
          const k = smooth(T.ARRIVE_AT - 0.5, T.ARRIVE_AT, t);
          glow(g, spOwn, sx, sy, L * 0.4 * k, 0.8 * k);
          glow(g, spWhite, sx, sy, L * 0.1 * k, k);
          g.globalCompositeOperation = "source-over";
        } else {
          const d = t - T.ARRIVE_AT;
          const stretch = 1 + 5 * (1 - smooth(0, 0.38, d));
          // The streak of the jump, shrinking into the ship.
          g.globalCompositeOperation = "lighter";
          if (d < 0.5) {
            const k = 1 - d / 0.5;
            const sg = g.createLinearGradient(sx - L * 4 * k, sy, sx, sy);
            sg.addColorStop(0, rgba(own, 0));
            sg.addColorStop(1, rgba(white, 0.9 * k));
            g.fillStyle = sg;
            g.fillRect(sx - L * 4 * k, sy - L * 0.02, L * 4 * k, L * 0.04);
          }
          glow(g, spWhite, sx, sy, L * (0.25 + 0.9 * Math.exp(-d * 5)), Math.exp(-d * 3.2));
          // A ring of particles thrown off by the arrival.
          if (d < 1.8) {
            const M = Math.round(110 * quality);
            const r = 1 - Math.exp(-d * 3.6);
            for (let j = 0; j < M; j++) {
              const a = (j / M) * TAU + hash01(j * 7) * 0.08;
              const rr = L * (0.2 + 1.6 * r * (0.75 + hash01(j * 11) * 0.5));
              glow(g, j % 3 ? spOwn : spWhite, sx + Math.cos(a) * rr, sy + Math.sin(a) * rr * 0.38, L * 0.018, 0.8 * (1 - d / 1.8));
            }
          }
          // Exhaust: particles streaming back off the drives, softer once it slows at the berth.
          const thrust = 0.35 + 0.65 * (1 - shipTravel(t)) * (t < T.DOCK_AT ? 1 : 0.3);
          const E = Math.round(46 * quality);
          for (let j = 0; j < E; j++) {
            const age = (t * 1.6 + hash01(j * 13)) % 1;
            const x = sx - L * 0.5 - age * L * (0.6 + 0.9 * thrust);
            const y = sy + (hash01(j * 17) - 0.5) * L * 0.08 * (1 + age * 1.5);
            glow(g, j % 2 ? spOwn : spOwn2, x, y, L * 0.03 * (1 - age * 0.5), 0.55 * thrust * (1 - age));
          }
          glow(g, spOwn, sx - L * 0.5, sy, L * 0.13 * (0.7 + 0.3 * thrust), 0.9);
          glow(g, spWhite, sx - L * 0.5, sy, L * 0.04, 0.9);
          g.globalCompositeOperation = "source-over";
          // The hull: a plain long ship, lit from above and the right.
          g.save();
          g.translate(sx, sy);
          g.scale(L * stretch, L);
          const hg = g.createLinearGradient(0, -0.15, 0, 0.1);
          hg.addColorStop(0, rgba([Math.min(255, hullC[0] * 1.15), Math.min(255, hullC[1] * 1.15), Math.min(255, hullC[2] * 1.2)], 1));
          hg.addColorStop(0.55, rgba([hullC[0] * 0.55, hullC[1] * 0.55, hullC[2] * 0.6], 1));
          hg.addColorStop(1, rgba([hullC[0] * 0.2, hullC[1] * 0.2, hullC[2] * 0.25], 1));
          g.fillStyle = hg;
          g.beginPath();
          HULL.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.closePath();
          g.fill();
          // Livery stripe and plating seams.
          g.fillStyle = rgba(livery, 0.95);
          g.beginPath();
          g.moveTo(0.38, 0.01);
          g.lineTo(-0.46, 0.015);
          g.lineTo(-0.46, 0.035);
          g.lineTo(0.3, 0.03);
          g.closePath();
          g.fill();
          g.strokeStyle = "rgba(0,0,0,0.35)";
          g.lineWidth = 0.004;
          for (const x of [-0.32, -0.12, 0.05, 0.22]) {
            g.beginPath();
            g.moveTo(x, -0.08);
            g.lineTo(x, 0.09);
            g.stroke();
          }
          g.restore();
          // Window rows and running lights.
          g.globalCompositeOperation = "lighter";
          for (let j = 0; j < 14; j++) {
            const x = sx + L * stretch * (-0.38 + j * 0.05);
            if (hash01(j * 29) < 0.25) continue;
            glow(g, sprite([255, 236, 200]), x, sy - L * 0.025, L * 0.008, 0.7);
          }
          const blink = (Math.sin(t * 6) > 0.6 ? 1 : 0.15);
          glow(g, spOwn, sx + L * stretch * 0.5, sy, L * 0.03, blink);
          glow(g, sprite([255, 80, 80]), sx - L * stretch * 0.14, sy - L * 0.155, L * 0.02, 1.15 - blink);
          g.globalCompositeOperation = "source-over";
        }
        g.globalAlpha = 1;
      }

      // Escorts in front (the lower ones, nearer).
      for (let k = 1; k < T.ESCORTS; k += 2) drawEscort(k);

      // The victory salute: a tracer from the Flagship's tower, then a burst of particles, one per mission won.
      g.globalCompositeOperation = "lighter";
      salutes.forEach((b, i) => {
        if (t < b - T.TRACER) return;
        const at = { x: lerp(-0.42, 0.42, (i + 0.5) / n) + (hash01(i * 41) - 0.5) * 0.08, y: -0.3 - hash01(i * 43) * 0.14 };
        const from = ship(b - T.TRACER);
        const c = i % 2 ? own2 : own;
        const sp = sprite(c);
        if (t < b) {
          const u = smooth(b - T.TRACER, b, t);
          const x = lerp(from.x, at.x, u);
          const y = lerp(from.y - 0.05, at.y, Math.sqrt(u));
          for (let j = 0; j < 8; j++) {
            const v = Math.max(0, u - j * 0.035);
            glow(g, sp, X(lerp(from.x, at.x, v)), Y(lerp(from.y - 0.05, at.y, Math.sqrt(v))), S * 0.006 * (1 - j / 9), 0.7 * (1 - j / 8));
          }
          glow(g, spWhite, X(x), Y(y), S * 0.008, 1);
          return;
        }
        const d = t - b;
        if (d > 2.4) return;
        glow(g, sp, X(at.x), Y(at.y), S * (0.05 + 0.08 * Math.exp(-d * 5)), 0.7 * Math.exp(-d * 3));
        glow(g, spWhite, X(at.x), Y(at.y), S * (0.012 + 0.025 * Math.exp(-d * 7)), Math.exp(-d * 4));
        const M = Math.round(120 * quality);
        const R = 0.16 + hash01(i * 47) * 0.05;
        const fade = Math.pow(clamp01(1 - d / 2.4), 1.3);
        const sp3 = sprite(i % 2 ? own : own2);
        for (let j = 0; j < M; j++) {
          const a = (j / M) * TAU + hash01(j * 53 + i) * 0.12;
          const sp2 = R * (0.45 + hash01(j * 59 + i * 3) * 0.7);
          // Each spark leaves a short streak behind it (where it was a moment ago).
          for (let q = 0; q < 3; q++) {
            const dq = Math.max(0, d - q * 0.05);
            const spread = 1 - Math.exp(-dq * 3.4);
            const x = at.x + Math.cos(a) * sp2 * spread;
            const y = at.y + Math.sin(a) * sp2 * spread + 0.035 * dq * dq;
            const tw = d > 1 ? 0.35 + 0.65 * (Math.sin(t * 31 + j * 7) > 0.2 ? 1 : 0.2) : 1;
            glow(g, q === 0 && j % 6 === 0 ? spWhite : j % 3 ? sp : sp3, X(x), Y(y), S * 0.006 * (1 - q * 0.25), fade * tw * (1 - q * 0.3));
          }
        }
        if (d < 0.6) {
          g.strokeStyle = rgba(c, 0.6 * (1 - d / 0.6));
          g.lineWidth = Math.max(1, S * 0.002);
          g.beginPath();
          g.arc(X(at.x), Y(at.y), S * R * 1.2 * (1 - Math.exp(-d * 6)), 0, TAU);
          g.stroke();
        }
      });
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";

      // A small berth readout once docked.
      if (t >= T.DOCK_AT) {
        const a = smooth(T.DOCK_AT, T.DOCK_AT + 0.5, t);
        g.globalAlpha = a * 0.85;
        g.fillStyle = rgba(own, 1);
        g.font = `600 ${Math.max(9, S * 0.016)}px system-ui, sans-serif`;
        g.textAlign = "left";
        g.fillText("BERTH 01 · CLAMPS LOCKED", X(ARM_TIP) + S * 0.02, Y(SHIP_DOCK.y) + S * 0.065);
        g.globalAlpha = 1;
      }

      vignette(g, w, h, 0.55);
      grain(g, w, h, t, 0.05);
    },
  };
}
