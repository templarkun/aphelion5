/**
 * End the Overload pressed (designer 2026-11-22, round 30: "every Overload end button should have its own
 * Overload end animation; create wild variants for every button style; time can be various too"). Until
 * round 29 every look played the same 0.38 s burst of CSS sparks. Now each look of the button (features.ts
 * `endButton`) ends in its own way, and the Overload ends as it finishes (then Exposure plays, 9.3):
 *
 * - sun (1.25 s), Supernova: the sun collapses, sucking its corona in, then blows: a white flash, a shock
 *   ring, a storm of embers cooling gold to red, tongues of plasma lashing out.
 * - reactor (1.0 s), Core vent: the rings spin up and close in, the rim flickers; a hexagonal shock front
 *   and six jets of coolant leap from the corners; ice-blue mist hangs and fades.
 * - singularity (1.5 s), Collapse: the disc whirls faster and falls in, motes spiral in from afar; the hole
 *   snaps shut in a flash and fires two twisting jets up and down; ripples of space run outwards.
 * - orb (0.95 s), Shatter: tendrils whip, cracks run over the glass; it bursts into tumbling shards with
 *   lightning leaping between them, a cloud of plasma spilling out.
 * - hazard (0.85 s), Lockdown release: the beacon spins up, blinking; the diamond folds in and four chevrons
 *   shoot out with trails; a ring of hazard stripes and a diamond shock front open outwards.
 * - forge (1.3 s), Hammer strike: the block squashes, then a white-hot flash; anvil sparks spray up and fall
 *   with weight, a molten splash ring runs out flat; the block cools red and embers drift up.
 * - gate (1.1 s), Jump: the marks race round the rim, the iris closes to a point, a beam fires up out of
 *   the screen; ripples and star glints are left behind.
 *
 * Drawn on one page-wide 2D canvas that exists only while it plays (at most 1.5 device pixels per CSS
 * pixel, additive light, a few hundred soft dots at most). The speed setting stretches or shortens it;
 * with reduced motion or Instant nothing plays (EndOverload.tsx ends at once).
 */

import type { EndButton } from "./features.js";
import { speedFactor } from "./motion.js";

type RGB = [number, number, number];

const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t * t;
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));

const COL = {
  white: [255, 255, 255] as RGB,
  cream: [255, 240, 205] as RGB,
  gold: [255, 214, 120] as RGB,
  amber: [255, 180, 50] as RGB,
  orange: [255, 120, 30] as RGB,
  red: [255, 55, 25] as RGB,
  cyan: [90, 220, 255] as RGB,
  ice: [205, 245, 255] as RGB,
  teal: [40, 170, 210] as RGB,
  violet: [165, 105, 255] as RGB,
  lilac: [232, 212, 255] as RGB,
  magenta: [255, 90, 220] as RGB,
};

const sprites = new Map<string, HTMLCanvasElement>();
function sprite(c: RGB): HTMLCanvasElement {
  const key = c.join(",");
  let s = sprites.get(key);
  if (s) return s;
  s = document.createElement("canvas");
  s.width = s.height = 64;
  const g = s.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${key},1)`);
  gr.addColorStop(0.35, `rgba(${key},0.55)`);
  gr.addColorStop(1, `rgba(${key},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  sprites.set(key, s);
  return s;
}

/** How long each look's end plays at Normal speed, in ms. */
export const END_BURST_MS: Record<EndButton, number> = { sun: 1250, reactor: 1000, singularity: 1500, orb: 950, hazard: 850, forge: 1300, gate: 1100 };

/** How long it plays now (the speed setting: Slow twice as long, Fast half). */
export function endBurstMs(look: EndButton): number {
  const f = speedFactor();
  return f > 0 ? Math.round(END_BURST_MS[look] / f) : 0;
}

/**
 * One frame of a look's end round a button centred at (x, y) with radius R (CSS px), p 0..1 through it.
 * The canvas is the page; `ctx` is already scaled to CSS px.
 */
export function drawEndBurst(ctx: CanvasRenderingContext2D, look: EndButton, x: number, y: number, R: number, p: number): void {
  const glow = (gx: number, gy: number, r: number, col: RGB, a: number) => {
    if (a <= 0.004 || r <= 0.3) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(sprite(col), gx - r, gy - r, r * 2, r * 2);
  };
  const ring = (rad: number, w: number, col: RGB, a: number, cx = x, cy = y, dash?: number[]) => {
    if (a <= 0.01 || rad <= 0) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.strokeStyle = `rgb(${col.join(",")})`;
    ctx.lineWidth = w;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  };
  const streak = (x0: number, y0: number, x1: number, y1: number, w: number, col: RGB, a: number) => {
    if (a <= 0.01) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.strokeStyle = `rgb(${col.join(",")})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (look === "sun") {
    // 1. Collapse (0-0.22): the sun shrinks and brightens, its corona sucked in.
    const col = seg(p, 0, 0.22);
    if (p < 0.24) {
      const r = R * (1 - 0.65 * easeIn(col));
      glow(x, y, r * 1.8, COL.orange, 0.5 + 0.3 * col);
      glow(x, y, r, COL.gold, 0.75 + 0.25 * col);
      glow(x, y, r * 0.5, COL.white, 0.6 + 0.4 * col);
      for (let i = 0; i < 46; i++) {
        const q = clamp01(col * 1.25 - rnd(i) * 0.25);
        const a = rnd(i + 9) * Math.PI * 2 + q * 2.4;
        const d = R * (2.4 - 2.1 * easeIn(q));
        glow(x + Math.cos(a) * d, y + Math.sin(a) * d, R * 0.06, i % 3 ? COL.amber : COL.cream, 0.8 * q);
      }
    }
    // 2. The blow (0.22-1).
    const b = seg(p, 0.22, 1);
    if (b > 0) {
      const flash = 1 - seg(b, 0, 0.35);
      glow(x, y, R * (1 + 7 * easeOut(seg(b, 0, 0.4))), COL.white, 0.7 * flash);
      glow(x, y, R * (1.5 + 4 * easeOut(b)), COL.orange, 0.35 * (1 - b));
      const shock = R * (0.4 + 9 * easeOut(b));
      ring(shock, 2 + 8 * (1 - b), COL.gold, 0.8 * (1 - b));
      ring(shock * 0.92, 10 * (1 - b) + 1, COL.red, 0.35 * (1 - b));
      // Embers, slowed by drag, cooling gold to red.
      for (let i = 0; i < 110; i++) {
        const a = rnd(i + 30) * Math.PI * 2;
        const v = R * (2 + 7 * rnd(i + 31));
        const d = R * 0.3 + v * (1 - Math.exp(-3.2 * b)) / (1 - Math.exp(-3.2));
        const d0 = R * 0.3 + v * (1 - Math.exp(-3.2 * Math.max(0, b - 0.05))) / (1 - Math.exp(-3.2));
        const age = b * (0.7 + 0.3 * rnd(i + 32));
        const c = age < 0.3 ? COL.cream : age < 0.6 ? COL.amber : COL.red;
        streak(x + Math.cos(a) * d0, y + Math.sin(a) * d0, x + Math.cos(a) * d, y + Math.sin(a) * d, 2.2 * (1 - age) + 0.6, c, 0.95 * (1 - age));
      }
      // Tongues of plasma lashing out, curling.
      for (let k = 0; k < 5; k++) {
        const a0 = rnd(k + 60) * Math.PI * 2;
        const len = R * (3 + 3 * rnd(k + 61)) * easeOut(seg(b, 0, 0.6));
        for (let j = 0; j < 16; j++) {
          const q = j / 15;
          const a = a0 + Math.sin(q * 3 + k) * 0.5 * q;
          const d = R * 0.6 + len * q;
          glow(x + Math.cos(a) * d, y + Math.sin(a) * d, R * (0.22 - 0.14 * q), q < 0.4 ? COL.gold : COL.orange, 0.45 * (1 - b) * (1 - q * 0.5));
        }
      }
    }
  } else if (look === "reactor") {
    const spin = seg(p, 0, 0.32);
    const hexPt = (r: number, i: number, rot = -Math.PI / 2) => [x + r * Math.cos(rot + (i / 6) * Math.PI * 2), y + r * Math.sin(rot + (i / 6) * Math.PI * 2)] as const;
    if (p < 0.36) {
      // Spin-up: rings faster and tighter, the rim flickering.
      const flick = Math.floor(p * 70) % 2 ? 1 : 0.4;
      ctx.globalAlpha = 0.8 * flick;
      ctx.strokeStyle = "rgb(150,235,255)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const [hx, hy] = hexPt(R * (1 - 0.1 * spin), i);
        if (i) ctx.lineTo(hx, hy);
        else ctx.moveTo(hx, hy);
      }
      ctx.stroke();
      for (let ring2 = 0; ring2 < 3; ring2++) {
        const rr = R * (0.55 + 0.1 * ring2) * (1 - 0.6 * easeIn(spin));
        const turn = ring2 * (Math.PI / 3);
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * Math.PI * 2 + p * (30 + 25 * spin) * (ring2 % 2 ? -1 : 1);
          const ex = Math.cos(a) * rr;
          const ey = Math.sin(a) * rr * 0.35;
          glow(x + ex * Math.cos(turn) - ey * Math.sin(turn), y + ex * Math.sin(turn) + ey * Math.cos(turn), R * 0.06, i % 5 ? COL.cyan : COL.white, 0.8);
        }
      }
      glow(x, y, R * (0.4 + 0.5 * spin), COL.cyan, 0.6 + 0.3 * spin);
      glow(x, y, R * (0.2 + 0.3 * spin), COL.white, 0.9);
    }
    const v = seg(p, 0.3, 1);
    if (v > 0) {
      glow(x, y, R * (1.2 + 5 * easeOut(seg(v, 0, 0.3))), COL.ice, 0.7 * (1 - seg(v, 0, 0.3)));
      // A hexagonal shock front of particles.
      const front = R * (0.8 + 7 * easeOut(v));
      for (let s = 0; s < 6; s++) {
        const [ax, ay] = hexPt(front, s, -Math.PI / 2 + v * 0.6);
        const [bx, by] = hexPt(front, s + 1, -Math.PI / 2 + v * 0.6);
        for (let j = 0; j < 12; j++) {
          const q = j / 12;
          glow(ax + (bx - ax) * q, ay + (by - ay) * q, R * 0.07 * (1 - v) + 1.5, j % 4 ? COL.cyan : COL.white, 0.85 * (1 - v));
        }
      }
      // Six jets of coolant from the corners.
      for (let s = 0; s < 6; s++) {
        const a = -Math.PI / 2 + (s / 6) * Math.PI * 2;
        for (let j = 0; j < 14; j++) {
          const q = clamp01(v * 1.6 - (j / 14) * 0.6);
          if (q <= 0 || q >= 1) continue;
          const d = R + R * 6 * easeOut(q);
          const wob = Math.sin(j * 2 + s) * R * 0.15 * q;
          glow(x + Math.cos(a) * d - Math.sin(a) * wob, y + Math.sin(a) * d + Math.cos(a) * wob, R * (0.05 + 0.12 * q), q < 0.4 ? COL.white : COL.ice, 0.75 * (1 - q));
        }
      }
      // Mist hanging, fading.
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + (rnd(i + 90) - 0.5) * 0.25;
        const d = R * (1 + 1.8 * easeOut(v)) * (0.8 + 0.4 * rnd(i + 91));
        glow(x + Math.cos(a) * d, y + Math.sin(a) * d, R * (0.5 + 0.6 * v), COL.teal, 0.1 * Math.sin(Math.PI * v) * (1 - v));
      }
      glow(x, y, R * 0.25 * (1 - v), COL.white, 0.9 * (1 - v));
    }
  } else if (look === "singularity") {
    const fall = seg(p, 0, 0.45);
    if (p < 0.47) {
      // Motes spiral in fast from afar; the disc whirls faster and shrinks.
      for (let i = 0; i < 70; i++) {
        const q = clamp01(fall * 1.3 - rnd(i) * 0.3);
        const a = rnd(i + 40) * Math.PI * 2 + q * 7;
        const d = R * (5 - 4.6 * easeIn(q));
        glow(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, R * 0.09, i % 4 ? COL.orange : COL.gold, 0.9 * Math.sin(Math.PI * q));
      }
      glow(x, y, R * (1.6 + 1.2 * fall), COL.orange, 0.18 + 0.25 * fall);
      const shrink = 1 - 0.75 * easeIn(fall);
      for (let i = 0; i < 130; i++) {
        const lane = rnd(i + 200);
        const rr = R * (0.62 + 0.75 * lane) * shrink;
        const a = rnd(i + 300) * Math.PI * 2 + p * (14 + 40 * fall) * (1.4 - lane);
        const hot = 1 - lane;
        glow(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.3, R * (0.05 + 0.05 * hot), hot > 0.6 ? COL.gold : COL.orange, 0.7 * (0.4 + 0.6 * hot));
      }
      ring(R * 2.6 * (1 - 0.8 * easeIn(fall)), 1.2, COL.cream, 0.35 * fall);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(x, y, R * 0.55 * shrink, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      ring(R * 0.5 * shrink, 2, COL.gold, 0.8);
    }
    const j = seg(p, 0.45, 1);
    if (j > 0) {
      glow(x, y, R * (0.5 + 4 * easeOut(seg(j, 0, 0.25))), COL.white, 0.9 * (1 - seg(j, 0, 0.3)));
      // Two jets up and down, twisting.
      for (const dir of [-1, 1]) {
        for (let i = 0; i < 40; i++) {
          const q = clamp01(j * 1.5 - (i / 40) * 0.5);
          if (q <= 0 || q >= 1) continue;
          const d = R * 0.3 + R * 9 * easeOut(q);
          const tw = Math.sin(i * 0.9 + j * 20) * R * 0.22 * q;
          glow(x + tw, y + dir * d, R * (0.06 + 0.12 * (1 - q)), i % 3 ? COL.lilac : COL.white, 0.85 * (1 - q));
        }
        glow(x, y + dir * R * 2.5 * easeOut(j), R * 1.2, COL.violet, 0.25 * (1 - j));
      }
      // Ripples of space.
      for (let k = 0; k < 3; k++) {
        const q = seg(j, k * 0.12, 0.7 + k * 0.1);
        ring(R * (0.6 + 8 * easeOut(q)), 1.5, k === 1 ? COL.lilac : COL.gold, 0.45 * Math.sin(Math.PI * q), x, y, [6, 7]);
      }
    }
  } else if (look === "orb") {
    const pre = seg(p, 0, 0.22);
    if (p < 0.24) {
      glow(x, y, R * 1.6, COL.violet, 0.4 + 0.3 * pre);
      glow(x, y, R, COL.magenta, 0.35);
      glow(x, y, R * 0.4, COL.white, 0.6 + 0.4 * pre);
      // Tendrils whipping out.
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * Math.PI * 2 + rnd(k) * 0.4;
        for (let i = 0; i < 14; i++) {
          const q = i / 13;
          const a = a0 + Math.sin(q * 6 + p * 60 + k) * 0.35 * q;
          const d = R * (0.9 + 1.4 * q * pre);
          glow(x + Math.cos(a) * d, y + Math.sin(a) * d, R * 0.05, q > 0.8 ? COL.white : COL.violet, 0.9 * (1 - q * 0.6));
        }
      }
      // Cracks running over the glass.
      ctx.globalAlpha = 0.9 * pre;
      ctx.strokeStyle = "rgb(245,235,255)";
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 6; k++) {
        let px = x + (rnd(k + 20) - 0.5) * R * 0.4;
        let py = y + (rnd(k + 21) - 0.5) * R * 0.4;
        ctx.beginPath();
        ctx.moveTo(px, py);
        const a = rnd(k + 22) * Math.PI * 2;
        for (let i = 1; i <= Math.ceil(6 * pre); i++) {
          px += Math.cos(a + (rnd(k * 9 + i) - 0.5) * 1.4) * R * 0.17;
          py += Math.sin(a + (rnd(k * 9 + i + 3) - 0.5) * 1.4) * R * 0.17;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    const s = seg(p, 0.2, 1);
    if (s > 0) {
      glow(x, y, R * (1 + 4 * easeOut(s)), COL.magenta, 0.45 * (1 - s));
      glow(x, y, R * (0.5 + 2 * easeOut(seg(s, 0, 0.3))), COL.white, 0.8 * (1 - seg(s, 0, 0.3)));
      // Tumbling shards.
      const pos: [number, number][] = [];
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + rnd(i + 40) * 0.3;
        const v = R * (2.5 + 4.5 * rnd(i + 41));
        const d = R * 0.6 + v * easeOut(s);
        const sx = x + Math.cos(a) * d;
        const sy = y + Math.sin(a) * d + R * 1.2 * s * s;
        pos.push([sx, sy]);
        const rot = rnd(i + 42) * 6 + s * (6 + 10 * rnd(i + 43));
        const sz = R * (0.12 + 0.16 * rnd(i + 44)) * (1 - 0.4 * s);
        ctx.globalAlpha = 0.85 * (1 - s);
        ctx.fillStyle = "rgba(150,90,255,0.6)";
        ctx.strokeStyle = "rgb(240,225,255)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const aa = rot + (k / 3) * Math.PI * 2 + (k === 1 ? 0.4 : 0);
          const rr = sz * (k === 2 ? 1.5 : 1);
          if (k) ctx.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr);
          else ctx.moveTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        glow(sx, sy, sz * 1.6, COL.violet, 0.35 * (1 - s));
      }
      // Lightning leaping between neighbouring shards, early on.
      if (s < 0.55) {
        const flick = Math.floor(p * 60);
        ctx.strokeStyle = "rgb(235,220,255)";
        for (let i = 0; i < 26; i += 2) {
          if (rnd(i + flick) < 0.45) continue;
          const [ax, ay] = pos[i]!;
          const [bx, by] = pos[(i + 1) % 26]!;
          ctx.globalAlpha = 0.9 * (1 - s / 0.55);
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          for (let k = 1; k < 5; k++) {
            const q = k / 5;
            ctx.lineTo(ax + (bx - ax) * q + (rnd(i * 7 + k + flick) - 0.5) * R * 0.3, ay + (by - ay) * q + (rnd(i * 7 + k + flick + 2) - 0.5) * R * 0.3);
          }
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
      }
    }
  } else if (look === "hazard") {
    const up = seg(p, 0, 0.28);
    if (p < 0.3) {
      const blink = Math.floor(p * 26) % 2 ? 1 : 0.3;
      const sweep = p * 32 * (0.5 + up);
      for (let i = 0; i < 40; i++) {
        const lag = i / 40;
        const a = sweep - lag * 1.6;
        const d = R * (1.1 + 1.2 * rnd(i + 120));
        glow(x + Math.cos(a) * d, y + Math.sin(a) * d, R * 0.08 * (1 - lag * 0.6), i % 4 ? COL.amber : COL.red, 0.8 * (1 - lag));
      }
      const r = R * (1.05 - 0.75 * easeIn(up));
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = blink > 0.5 ? "rgb(255,70,40)" : "rgb(255,214,120)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.stroke();
      glow(x, y, r, COL.amber, 0.5 * blink + 0.2);
    }
    const o = seg(p, 0.26, 1);
    if (o > 0) {
      glow(x, y, R * (0.6 + 3 * easeOut(seg(o, 0, 0.3))), COL.cream, 0.8 * (1 - seg(o, 0, 0.3)));
      // A diamond shock front.
      const f = R * (0.6 + 7 * easeOut(o));
      ctx.globalAlpha = 0.85 * (1 - o);
      ctx.strokeStyle = "rgb(255,196,60)";
      ctx.lineWidth = 2 + 6 * (1 - o);
      ctx.beginPath();
      ctx.moveTo(x, y - f);
      ctx.lineTo(x + f, y);
      ctx.lineTo(x, y + f);
      ctx.lineTo(x - f, y);
      ctx.closePath();
      ctx.stroke();
      // A ring of hazard stripes, turning as it opens.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(o * 2.2);
      ring(R * (1 + 4.5 * easeOut(o)), 7 * (1 - o) + 2, COL.amber, 0.75 * (1 - o), 0, 0, [R * 0.3, R * 0.3]);
      ctx.restore();
      // Four chevrons shooting out, trailing.
      for (let k = 0; k < 4; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 2;
        for (let tr = 0; tr < 5; tr++) {
          const q = clamp01(o - tr * 0.04);
          const d = R * (0.4 + 8 * easeOut(q));
          const cx2 = x + Math.cos(a) * d;
          const cy2 = y + Math.sin(a) * d;
          const w = R * 0.35;
          const back = R * 0.22;
          const al = (tr ? 0.35 : 1) * (1 - o) * (1 - tr / 5);
          ctx.globalAlpha = al;
          ctx.strokeStyle = tr ? "rgb(255,120,30)" : "rgb(255,240,205)";
          ctx.lineWidth = tr ? 3 : 3.5;
          ctx.beginPath();
          ctx.moveTo(cx2 - Math.cos(a) * back - Math.sin(a) * w, cy2 - Math.sin(a) * back + Math.cos(a) * w);
          ctx.lineTo(cx2, cy2);
          ctx.lineTo(cx2 - Math.cos(a) * back + Math.sin(a) * w, cy2 - Math.sin(a) * back - Math.cos(a) * w);
          ctx.stroke();
          if (!tr) glow(cx2, cy2, R * 0.25, COL.amber, 0.5 * (1 - o));
        }
      }
    }
  } else if (look === "forge") {
    const squash = seg(p, 0, 0.13);
    if (p < 0.15) {
      const sy = 1 - 0.35 * easeIn(squash);
      const sx = 1 + 0.2 * easeIn(squash);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "rgb(120,24,0)";
      ctx.strokeStyle = "rgb(255,190,110)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - R * 0.92 * sx, y + R * 0.92 - R * 1.84 * sy, R * 1.84 * sx, R * 1.84 * sy, R * 0.25);
      ctx.fill();
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      glow(x, y + R * 0.3, R * 0.9, COL.orange, 0.4 + 0.4 * squash);
    }
    const h = seg(p, 0.12, 1);
    if (h > 0) {
      const flash = 1 - seg(h, 0, 0.2);
      glow(x, y, R * (1 + 4 * easeOut(seg(h, 0, 0.25))), COL.white, 0.9 * flash);
      // The block, cooling from white-hot to red and gone.
      const cool = seg(h, 0.05, 0.7);
      glow(x, y, R * 0.9, cool < 0.3 ? COL.cream : cool < 0.6 ? COL.amber : COL.red, 0.7 * (1 - cool));
      // A molten splash ring running out flat.
      ctx.save();
      ctx.translate(x, y + R * 0.8);
      ctx.scale(1, 0.28);
      ring(R * (0.8 + 6 * easeOut(h)), 10 * (1 - h) + 1, COL.orange, 0.8 * (1 - h), 0, 0);
      ring(R * (0.7 + 5.4 * easeOut(h)), 3, COL.cream, 0.7 * (1 - h), 0, 0);
      ctx.restore();
      // Anvil sparks: sprayed up, falling with weight, drawn as short streaks along their way.
      const g = R * 14;
      for (let i = 0; i < 120; i++) {
        const a = -Math.PI / 2 + (rnd(i + 50) - 0.5) * 2.6;
        const v = R * (3 + 6 * rnd(i + 51));
        const life = 0.6 + 0.4 * rnd(i + 52);
        const t = h * 1.3;
        if (h > life) continue;
        const px = x + Math.cos(a) * v * t;
        const py = y + Math.sin(a) * v * t + 0.5 * g * t * t;
        const t0 = Math.max(0, t - 0.035);
        const qx = x + Math.cos(a) * v * t0;
        const qy = y + Math.sin(a) * v * t0 + 0.5 * g * t0 * t0;
        const age = h / life;
        streak(qx, qy, px, py, 2 * (1 - age) + 0.7, age < 0.3 ? COL.white : age < 0.6 ? COL.gold : COL.orange, 1 - age);
      }
      // Embers drifting up afterwards.
      for (let i = 0; i < 30; i++) {
        const q = seg(h, 0.2 + rnd(i + 80) * 0.3, 1);
        if (q <= 0) continue;
        const ex = x + (rnd(i + 81) - 0.5) * R * 2 + Math.sin(q * 5 + i) * R * 0.2;
        const ey = y - R * 0.3 - q * R * 3;
        glow(ex, ey, R * 0.05, i % 3 ? COL.orange : COL.gold, 0.85 * Math.sin(Math.PI * q));
      }
    }
  } else {
    // Star gate: the marks race round, the iris closes, a beam fires up; ripples are left behind.
    const race = seg(p, 0, 0.35);
    const close = seg(p, 0.3, 0.5);
    const rr = R * 0.88 * (1 - easeIn(close));
    if (p < 0.52) {
      for (let i = 0; i < 90; i++) {
        const q = (p * (4 + 8 * race) + rnd(i + 210)) % 1;
        const a = rnd(i + 230) * Math.PI * 2 + q * 6;
        const d = rr * 0.8 * (1 - q) ** 0.8;
        glow(x + Math.cos(a) * d, y + Math.sin(a) * d, R * (0.03 + 0.04 * (1 - q)), q > 0.8 ? COL.white : i % 3 ? COL.cyan : COL.violet, 0.8 * Math.sin(Math.PI * q));
      }
      ring(rr, Math.max(1, R * 0.18 * (1 - close)), COL.teal, 0.5);
      ring(rr * 1.1, 1.5, COL.ice, 0.8);
      const head = p * (30 + 60 * race);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 - Math.PI / 2 + close * 4;
        const d = (head - k + 900) % 9;
        const lit = race > 0.9 ? 1 : d < 1 ? 1 : Math.max(0.2, 1 - d / 3);
        glow(x + Math.cos(a) * rr, y + Math.sin(a) * rr, R * 0.13, d < 1 ? COL.amber : COL.cyan, 0.9 * lit);
      }
    }
    const f = seg(p, 0.48, 1);
    if (f > 0) {
      glow(x, y, R * (0.4 + 3 * easeOut(seg(f, 0, 0.25))), COL.white, 0.95 * (1 - seg(f, 0, 0.3)));
      // The beam up and out of the screen.
      const top = Math.min(-60, y - window.innerHeight);
      const beamA = 1 - seg(f, 0.2, 0.9);
      for (let i = 0; i < 40; i++) {
        const q = i / 39;
        const by = y + (top - y) * q * easeOut(seg(f, 0, 0.18));
        glow(x + Math.sin(q * 30 + f * 40) * R * 0.08, by, R * (0.32 - 0.12 * q), i % 4 ? COL.ice : COL.white, 0.55 * beamA);
      }
      streak(x, y, x, y + (top - y) * easeOut(seg(f, 0, 0.18)), R * 0.12, COL.white, 0.8 * beamA);
      // Ripples and star glints left behind.
      for (let k = 0; k < 3; k++) {
        const q = seg(f, k * 0.1, 0.75 + k * 0.08);
        ring(R * (0.3 + 6 * easeOut(q)), 2.5 * (1 - q) + 0.6, k % 2 ? COL.violet : COL.cyan, 0.7 * Math.sin(Math.PI * q));
      }
      for (let i = 0; i < 24; i++) {
        const a = rnd(i + 400) * Math.PI * 2;
        const d = R * (1 + 4 * rnd(i + 401));
        const tw = Math.max(0, Math.sin(f * 18 + i * 2));
        glow(x + Math.cos(a) * d, y + Math.sin(a) * d, R * 0.07 * tw + 0.5, COL.ice, 0.8 * tw * (1 - f));
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/**
 * Plays a look's end on its own page-wide canvas, then removes it. Returns how long it plays (ms): the
 * caller ends the Overload then. Nothing plays (0) with Instant.
 */
export function playEndBurst(look: EndButton, x: number, y: number, R: number): number {
  const ms = endBurstMs(look);
  if (!ms || typeof document === "undefined") return 0;
  const k = Math.min(1.5, window.devicePixelRatio || 1);
  const cv = document.createElement("canvas");
  cv.className = "end-burst-fx";
  cv.dataset.look = look;
  cv.setAttribute("aria-hidden", "true");
  cv.width = Math.round(window.innerWidth * k);
  cv.height = Math.round(window.innerHeight * k);
  cv.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:41";
  document.body.appendChild(cv);
  const ctx = cv.getContext("2d");
  if (!ctx) {
    cv.remove();
    return ms;
  }
  let start = 0;
  const frame = (now: number) => {
    start ||= now;
    const p = (now - start) / ms;
    if (p >= 1) return cv.remove();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawEndBurst(ctx, look, x, y, R, p);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // A hidden page gets no frames: the canvas goes anyway.
  window.setTimeout(() => cv.remove(), ms + 600);
  return ms;
}
