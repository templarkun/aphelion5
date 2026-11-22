/**
 * Reveal effects (designer 2026-11-09): every unit type but Bots has its own burst of particles
 * when it is revealed, played right after the tile flips. Omega units and Flares get the biggest:
 * a charge-up before the flip, a shake of the whole Field and a flash over it. Placeholder looks
 * drawn with PixiJS in the Field's effects layer; the designer's art can replace them later.
 */

import { noise3 } from "./noise.js";
import { type Container, Graphics } from "pixi.js";
import type { NodeLook, Step } from "./anim.js";

export interface FxEnv {
  fx: Container;
  centre: (k: string) => { x: number; y: number };
  size: () => number;
  keys: () => string[];
  /** The Field's element, for a flash over it. */
  host: () => HTMLElement | null;
}

/** Types whose reveal is the most impactful (a charge before the flip, a shake after). */
export const BIG_REVEAL = new Set(["Flare", "Omega"]);

const rnd = (n: number) => {
  const x = Math.sin(n * 91.7 + 17.3) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (p: number) => 1 - (1 - p) ** 3;

function hex(g: Graphics, cx: number, cy: number, r: number, rot = 0): Graphics {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30) + rot;
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  return g.poly(pts);
}

/** The charge before a big reveal: the dark tile trembles and a rim of its colour builds up. `p` 0..1. */
export function chargeLook(g: Graphics, type: string, cx: number, cy: number, size: number, p: number): number {
  const col = type === "Omega" ? 0xb07cff : 0xffd23f;
  g.clear();
  const k = 0.35 + 0.65 * p;
  hex(g, cx, cy, size * 0.9).fill({ color: col, alpha: 0.25 * p });
  for (let i = 0; i < 3; i++) hex(g, cx, cy, size * (0.92 + 0.09 * i + 0.05 * Math.sin(p * 40 + i))).stroke({ width: 5 - i * 1.5, color: col, alpha: k * (0.95 - i * 0.25) });
  // Motes drawn in towards the tile.
  for (let i = 0; i < 24; i++) {
    const ang = rnd(i) * Math.PI * 2;
    const u = (p * 1.6 + rnd(i + 30)) % 1;
    const d = size * (2.4 - 1.5 * u);
    g.circle(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, 2 + 2.5 * u).fill({ color: i % 4 ? col : 0xffffff, alpha: 0.9 * Math.min(1, p * 2) });
  }
  // How far the tile trembles (px).
  return Math.sin(p * 90) * size * 0.05 * k;
}

/** The burst after the flip; undefined for Bots. */
export function revealFxStep(type: string, sector: string, env: FxEnv): Step | undefined {
  const draw = DRAW[type];
  if (!draw) return undefined;
  const g = new Graphics();
  g.eventMode = "none";
  let flash: HTMLDivElement | undefined;
  const big = BIG_REVEAL.has(type);
  return {
    ms: type === "Omega" ? 1400 : type === "Flare" ? 1200 : 700,
    start: () => {
      env.fx.addChild(g);
      if (big) {
        flash = document.createElement("div");
        flash.className = `reveal-flash ${type.toLowerCase()}`;
        env.host()?.appendChild(flash);
      }
    },
    frame: (p, look) => {
      const c = env.centre(sector);
      g.clear();
      draw(g, c.x, c.y, env.size(), p, env, sector);
      if (big) {
        // The whole Field shakes, strongest first.
        const amp = env.size() * (type === "Omega" ? 0.12 : 0.09) * (1 - p) ** 2;
        for (const k of env.keys()) {
          const L: NodeLook = look(k);
          L.dx += Math.sin(p * 70 + k.length) * amp;
          L.dy += Math.cos(p * 63) * amp * 0.6;
        }
        if (flash) flash.style.opacity = String(type === "Flare" ? (p < 0.08 ? p / 0.08 : Math.max(0, 1 - (p - 0.08) / 0.5)) : Math.sin(Math.PI * clamp01(p / 0.8)) * 0.9);
      }
    },
    end: () => {
      g.destroy();
      flash?.remove();
    },
  };
}

type Draw = (g: Graphics, cx: number, cy: number, size: number, p: number, env: FxEnv, sector: string) => void;

const DRAW: Record<string, Draw> = {
  /** Sentinel: red chevrons lock on from all six sides, then its Barrier snaps up around it. */
  Sentinel: (g, cx, cy, size, p) => {
    const lock = easeOut(clamp01(p / 0.45));
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const d = size * (2 - 1.05 * lock);
      const x = cx + Math.cos(a) * d;
      const y = cy + Math.sin(a) * d;
      const w = size * 0.18;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      g.moveTo(x + (-uy * w) + ux * w, y + ux * w + uy * w)
        .lineTo(x, y)
        .lineTo(x + uy * w + ux * w, y - ux * w + uy * w)
        .stroke({ width: 3, color: 0xff4d4d, alpha: (1 - clamp01((p - 0.5) / 0.3)) * 0.95 });
    }
    const up = clamp01((p - 0.42) / 0.58);
    if (up > 0) {
      hex(g, cx, cy, size * (0.7 + 0.35 * easeOut(up))).stroke({ width: 4 * (1 - up) + 1, color: 0x9fe3ff, alpha: 1 - up * 0.6 });
      hex(g, cx, cy, size * (0.7 + 0.35 * easeOut(up))).fill({ color: 0x9fe3ff, alpha: 0.25 * (1 - up) });
      for (let i = 0; i < 10; i++) {
        const a = rnd(i) * Math.PI * 2;
        const d = size * (0.8 + 0.6 * up);
        g.circle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2).fill({ color: i % 2 ? 0xff6b6b : 0xffffff, alpha: 1 - up });
      }
    }
  },
  /** Sleeper: it wakes: slow blue ripples and motes drifting up like breath. */
  Sleeper: (g, cx, cy, size, p) => {
    for (let k = 0; k < 3; k++) {
      const r = clamp01(p * 1.3 - k * 0.18);
      if (r > 0 && r < 1) g.circle(cx, cy, size * (0.3 + 1.1 * easeOut(r))).stroke({ width: 3.5, color: 0x6fb0ff, alpha: 0.9 * (1 - r) });
    }
    for (let i = 0; i < 24; i++) {
      const u = clamp01(p * 1.2 - rnd(i) * 0.3);
      const x = cx + (rnd(i + 5) - 0.5) * size * 1.4 + Math.sin(p * 9 + i) * size * 0.08;
      const y = cy + size * 0.4 - u * size * 1.6;
      g.circle(x, y, 1.5 + rnd(i + 9) * 2.5).fill({ color: i % 3 ? 0x4f86d9 : 0xd8e8ff, alpha: Math.sin(Math.PI * u) * 0.9 });
    }
    // Two eyes open and close once.
    const eye = Math.sin(Math.PI * clamp01((p - 0.15) / 0.6));
    for (const s of [-1, 1]) g.ellipse(cx + s * size * 0.22, cy - size * 0.5, size * 0.09, size * 0.04 * eye + 0.5).fill({ color: 0xbfe0ff, alpha: eye });
  },
  /** Gyro: arcs spin up around it and fling green sparks off sideways. */
  Gyro: (g, cx, cy, size, p) => {
    const spin = p * 14;
    const r0 = size * (0.75 + 0.5 * easeOut(p));
    for (let k = 0; k < 3; k++) {
      const a0 = spin + (k * 2 * Math.PI) / 3;
      g.moveTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0).arc(cx, cy, r0, a0, a0 + 1.3).stroke({ width: 6, color: 0x5fd47a, alpha: 1 - p });
      g.moveTo(cx + Math.cos(-a0) * r0 * 0.8, cy + Math.sin(-a0) * r0 * 0.8).arc(cx, cy, r0 * 0.8, -a0, -a0 + 0.9).stroke({ width: 3, color: 0xcaffd6, alpha: 1 - p });
    }
    for (let i = 0; i < 26; i++) {
      const u = clamp01(p * 1.4 - rnd(i) * 0.4);
      if (u <= 0 || u >= 1) continue;
      const a = rnd(i + 2) * Math.PI * 2 + spin * 0.2;
      const d = r0 + u * size * 0.9;
      // Tangential: each spark curls along the spin.
      const x = cx + Math.cos(a + u * 0.8) * d;
      const y = cy + Math.sin(a + u * 0.8) * d;
      g.circle(x, y, 2.6).fill({ color: i % 2 ? 0x5fd47a : 0xffffff, alpha: 1 - u });
    }
  },
  /** Mecha: a scan line runs down the tile and sparks fly from its edges as it powers up. */
  Mecha: (g, cx, cy, size, p) => {
    const y = cy - size * 0.9 + size * 1.8 * clamp01(p / 0.6);
    const half = size * 0.8;
    if (p < 0.65) g.moveTo(cx - half, y).lineTo(cx + half, y).stroke({ width: 3, color: 0xffd08a, alpha: 0.9 });
    const on = clamp01((p - 0.5) / 0.5);
    if (on > 0) hex(g, cx, cy, size * (0.9 + 0.2 * on)).stroke({ width: 3 * (1 - on) + 0.5, color: 0xf0913a, alpha: 1 - on });
    for (let i = 0; i < 12; i++) {
      const u = clamp01((p - 0.45) * 2 - rnd(i) * 0.3);
      if (u <= 0 || u >= 1) continue;
      const a = rnd(i + 4) * Math.PI * 2;
      const d = size * (0.85 + 0.7 * u);
      g.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d)
        .lineTo(cx + Math.cos(a) * (d + size * 0.15), cy + Math.sin(a) * (d + size * 0.15) + u * 6)
        .stroke({ width: 2, color: 0xffc070, alpha: 1 - u });
    }
  },
  /** Flare: a blinding sunburst: rays spin out, two shock rings cross the Field, embers everywhere. */
  Flare: (g, cx, cy, size, p) => {
    const rays = 16;
    const out = easeOut(clamp01(p / 0.5));
    const fade = 1 - clamp01((p - 0.35) / 0.65);
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + p * 1.2;
      const l = size * (1 + 3.2 * out) * (i % 2 ? 0.7 : 1);
      const w = 0.07;
      g.poly([cx + Math.cos(a - w) * size * 0.5, cy + Math.sin(a - w) * size * 0.5, cx + Math.cos(a) * l, cy + Math.sin(a) * l, cx + Math.cos(a + w) * size * 0.5, cy + Math.sin(a + w) * size * 0.5]).fill({ color: i % 2 ? 0xffe27a : 0xfff6cf, alpha: 0.75 * fade });
    }
    g.circle(cx, cy, size * (0.8 + 0.5 * Math.sin(Math.PI * clamp01(p / 0.3)))).fill({ color: 0xfff3b0, alpha: 0.7 * (1 - clamp01(p / 0.5)) });
    for (const [lag, colr] of [
      [0, 0xffd23f],
      [0.15, 0xff8a2a],
    ] as const) {
      const r = clamp01((p - lag) / 0.75);
      if (r > 0 && r < 1) g.circle(cx, cy, size * (0.9 + 4.5 * easeOut(r))).stroke({ width: 8 * (1 - r) + 1, color: colr, alpha: 1 - r });
    }
    for (let i = 0; i < 40; i++) {
      const u = clamp01(p * 1.25 - rnd(i) * 0.25);
      if (u <= 0 || u >= 1) continue;
      const a = rnd(i + 11) * Math.PI * 2;
      const d = size * (0.6 + (2 + 2.5 * rnd(i + 3)) * easeOut(u));
      g.circle(cx + Math.cos(a) * d, cy + Math.sin(a) * d + u * u * size * 0.6, 1.5 + rnd(i + 7) * 2.5).fill({ color: i % 3 ? 0xffb02e : 0xfff0a0, alpha: 1 - u });
    }
  },
  /** Omega: a vortex sucks light in, then violet lightning leaps to every sector around and the Field quakes. */
  Omega: (g, cx, cy, size, p, env, sector) => {
    const suck = clamp01(p / 0.35);
    if (p < 0.4)
      for (let i = 0; i < 48; i++) {
        const u = (suck * 1.5 + rnd(i)) % 1;
        const a = rnd(i + 3) * Math.PI * 2 + u * 3;
        const d = size * 2.6 * (1 - u);
        g.circle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.5 + 3 * u).fill({ color: i % 3 ? 0xb07cff : 0xffffff, alpha: Math.min(1, 0.3 + u) * (1 - clamp01((p - 0.3) / 0.1)) });
      }
    g.circle(cx, cy, size * (0.3 + 0.6 * Math.sin(Math.PI * clamp01(p / 0.5)))).fill({ color: 0x1a0630, alpha: 0.7 * (1 - clamp01((p - 0.4) / 0.4)) });
    const zap = clamp01((p - 0.32) / 0.5);
    if (zap > 0 && zap < 1) {
      const flick = Math.floor(p * 30);
      const near = env
        .keys()
        .filter((k) => k !== sector)
        .map((k) => ({ k, c: env.centre(k) }))
        .filter((n) => Math.hypot(n.c.x - cx, n.c.y - cy) < size * 3.6);
      near.forEach((n, j) => {
        if ((flick + j) % 3 === 0) return;
        const dx = n.c.x - cx;
        const dy = n.c.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const pts: number[] = [cx, cy];
        for (let i = 1; i < 7; i++) {
          const t = i / 7;
          const w = (rnd(flick * 17 + j * 5 + i) - 0.5) * size * 0.7 * Math.sin(Math.PI * t);
          pts.push(cx + dx * t + nx * w, cy + dy * t + ny * w);
        }
        pts.push(n.c.x, n.c.y);
        const draw = (width: number, color: number, alpha: number) => {
          g.moveTo(pts[0]!, pts[1]!);
          for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i]!, pts[i + 1]!);
          g.stroke({ width, color, alpha });
        };
        draw(14, 0xb07cff, 0.35 * (1 - zap));
        draw(5, 0xc9a2ff, 0.8 * (1 - zap));
        draw(2, 0xffffff, 1 - zap);
        g.circle(n.c.x, n.c.y, size * 0.25 * (1 - zap)).fill({ color: 0xd9b8ff, alpha: 0.6 * (1 - zap) });
      });
    }
    for (const [lag, colr] of [
      [0.32, 0xb07cff],
      [0.45, 0x2a0a4a],
      [0.55, 0xe0c8ff],
    ] as const) {
      const r = clamp01((p - lag) / 0.45);
      if (r > 0 && r < 1) g.circle(cx, cy, size * (0.6 + 4.2 * easeOut(r))).stroke({ width: 9 * (1 - r) + 1, color: colr, alpha: 1 - r });
    }
  },
};

// ---------------------------------------------------------------------------
// Units acting (designer 2026-11-09): a Sleeper activating, a Gyro drained, a Gyro destroyed.

/** A Sleeper activates (wakes, or its Alert is resolved): a blue rune circle spins up and a column of light rises. */
export function sleeperActivate(g: Graphics, cx: number, cy: number, size: number, p: number): void {
  const grow = easeOut(clamp01(p / 0.35));
  const fade = 1 - clamp01((p - 0.6) / 0.4);
  const R = size * (0.6 + 0.45 * grow);
  for (const [r, dir, w] of [
    [R, 1, 3],
    [R * 0.78, -1, 2],
  ] as const) {
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2 + dir * p * 5;
      g.moveTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r)
        .arc(cx, cy, r, a0, a0 + 0.32)
        .stroke({ width: w, color: 0x7fb8ff, alpha: 0.9 * fade });
    }
  }
  // Six rune marks on the outer ring.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + p * 5;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    g.poly([x, y - size * 0.07, x + size * 0.05, y, x, y + size * 0.07, x - size * 0.05, y]).fill({ color: 0xdcecff, alpha: fade });
  }
  // A column of light rising from the tile.
  const col = clamp01((p - 0.2) / 0.5);
  if (col > 0) {
    const h = size * 2.2 * easeOut(col);
    g.rect(cx - size * 0.22, cy - h, size * 0.44, h).fill({ color: 0x9fd0ff, alpha: 0.28 * fade });
    g.rect(cx - size * 0.07, cy - h, size * 0.14, h).fill({ color: 0xffffff, alpha: 0.5 * fade });
  }
  for (let i = 0; i < 18; i++) {
    const u = clamp01(p * 1.3 - rnd(i + 40) * 0.3);
    if (u <= 0 || u >= 1) continue;
    const x = cx + (rnd(i + 8) - 0.5) * size * 0.9;
    const y = cy - u * size * 2;
    g.circle(x, y, 1.8 + rnd(i) * 2).fill({ color: i % 3 ? 0x6fb0ff : 0xffffff, alpha: 1 - u });
  }
}

/** A Gyro drained: green energy spirals in, then shoots up and away. */
export function gyroDrain(g: Graphics, cx: number, cy: number, size: number, p: number): void {
  const inP = clamp01(p / 0.6);
  for (let i = 0; i < 30; i++) {
    const u = (inP * 1.4 + rnd(i)) % 1;
    const a = rnd(i + 5) * Math.PI * 2 + u * 5;
    const d = size * 1.8 * (1 - u);
    g.circle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.5 + 2.5 * u).fill({ color: i % 3 ? 0x5fd47a : 0xeaffef, alpha: (p < 0.6 ? 1 : 0) * Math.min(1, u * 2) });
  }
  g.circle(cx, cy, size * (0.3 + 0.35 * inP)).fill({ color: 0x8dffb0, alpha: 0.35 * inP * (1 - clamp01((p - 0.6) / 0.2)) });
  const up = clamp01((p - 0.55) / 0.45);
  if (up > 0 && up < 1) {
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (rnd(i + 20) - 0.5) * 1.2;
      const d = size * (0.3 + 2.5 * easeOut(up)) * (0.6 + 0.4 * rnd(i + 3));
      g.circle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.5).fill({ color: i % 2 ? 0x5fd47a : 0xffffff, alpha: 1 - up });
    }
    g.circle(cx, cy, size * (0.5 + 1.2 * up)).stroke({ width: 3 * (1 - up) + 0.5, color: 0x8dffb0, alpha: 1 - up });
  }
}

/** A Gyro destroyed: its spinning rings break and fly apart, green sparks everywhere. */
export function gyroBreak(g: Graphics, cx: number, cy: number, size: number, p: number): void {
  const out = easeOut(clamp01(p / 0.8));
  for (let k = 0; k < 3; k++) {
    for (let piece = 0; piece < 3; piece++) {
      const a0 = (piece * 2 * Math.PI) / 3 + k * 0.7 + p * (3 + k) * (k % 2 ? -1 : 1);
      const dir = a0 + 0.5;
      const ox = Math.cos(dir) * size * 1.4 * out;
      const oy = Math.sin(dir) * size * 1.4 * out;
      const r = size * (0.45 + 0.18 * k);
      g.moveTo(cx + ox + Math.cos(a0) * r, cy + oy + Math.sin(a0) * r)
        .arc(cx + ox, cy + oy, r, a0, a0 + 1.4)
        .stroke({ width: 4 - k, color: k === 1 ? 0xcaffd6 : 0x5fd47a, alpha: 1 - out });
    }
  }
  for (let i = 0; i < 28; i++) {
    const u = clamp01(p * 1.3 - rnd(i) * 0.3);
    if (u <= 0 || u >= 1) continue;
    const a = rnd(i + 50) * Math.PI * 2;
    const d = size * (0.3 + 2 * easeOut(u)) * (0.5 + 0.5 * rnd(i + 2));
    g.circle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2.2).fill({ color: i % 2 ? 0x5fd47a : 0xffffff, alpha: 1 - u });
  }
  g.circle(cx, cy, size * 0.9 * Math.sin(Math.PI * clamp01(p / 0.4))).fill({ color: 0xb8ffcc, alpha: 0.4 * (1 - clamp01(p / 0.4)) });
}

/**
 * An Overload under way (designer 2026-11-09): beams of plasma race round the edge of the Field,
 * with sparks drifting in from it. `w`, `h`: the Field's size; `now` in ms (0 = still).
 */
export function drawOverloadRing(g: Graphics, w: number, h: number, now: number, look: "original" | "inflow" | MoreLook = "original"): void {
  if (look === "inflow") return drawOverloadInflow(g, w, h, now);
  if (look !== "original") return drawOverloadMore(g, w, h, now, look);
  const inset = 6;
  const W = w - 2 * inset;
  const H = h - 2 * inset;
  if (W <= 0 || H <= 0) return;
  const per = 2 * (W + H);
  /** A point on the edge at t (0..1, clockwise from the top left), pushed inwards by `d`. */
  const at = (t: number, d = 0): [number, number] => {
    let s = (((t % 1) + 1) % 1) * per;
    if (s < W) return [inset + s, inset + d];
    s -= W;
    if (s < H) return [inset + W - d, inset + s];
    s -= H;
    if (s < W) return [inset + W - s, inset + H - d];
    s -= W;
    return [inset + d, inset + H - s];
  };
  const pulse = 0.5 + 0.5 * Math.sin(now / 420);
  g.rect(inset, inset, W, H).stroke({ width: 14, color: 0xff3b1a, alpha: 0.08 + 0.06 * pulse });
  g.rect(inset, inset, W, H).stroke({ width: 2, color: 0xff7a3a, alpha: 0.35 + 0.2 * pulse });
  // Four beams: two of red plasma one way, two of violet energy the other way
  // (designer 2026-11-10: half as fast as before).
  const beams = [
    { t: now / 10400, col: 0xff5a1f, core: 0xffe0a0 },
    { t: now / 10400 + 0.5, col: 0xff5a1f, core: 0xffe0a0 },
    { t: -now / 14800 + 0.25, col: 0xb07cff, core: 0xf0e6ff },
    { t: -now / 14800 + 0.75, col: 0xb07cff, core: 0xf0e6ff },
  ];
  // Designer 2026-11-16: the beams twice as big (thickness, length, head) and half see-through.
  const S = 2;
  const A = 0.5;
  beams.forEach((b, k) => {
    const dir = k < 2 ? 1 : -1;
    const n = 40;
    const len = 0.11 * S;
    let prev = at(b.t, 2 * S);
    for (let i = 1; i <= n; i++) {
      const tt = b.t - dir * (len * i) / n;
      const wave = Math.sin(i * 0.56 + now / 90) * 3 * S * (i / n);
      const pt = at(tt, 2 * S + wave);
      const f = 1 - i / n;
      g.moveTo(prev[0], prev[1]).lineTo(pt[0], pt[1]).stroke({ width: (2 + 9 * f) * S, color: b.col, alpha: 0.25 * f * A });
      g.moveTo(prev[0], prev[1]).lineTo(pt[0], pt[1]).stroke({ width: (1 + 2.5 * f) * S, color: b.core, alpha: 0.9 * f * A });
      prev = pt;
    }
    const head = at(b.t, 2 * S);
    g.circle(head[0], head[1], (6 + 2 * Math.sin(now / 60 + k)) * S).fill({ color: b.col, alpha: 0.5 * A });
    g.circle(head[0], head[1], 3 * S).fill({ color: 0xffffff, alpha: 0.95 * A });
  });
  // The coronal waves (coronalFx.ts) are drawn by the Field on their own layer.
  // Sparks drifting in from the edge.
  for (let i = 0; i < 46; i++) {
    const u = (now / 2400 + rnd(i)) % 1;
    const p = at(rnd(i + 100) + now / 60000, 4 + u * 34);
    g.circle(p[0], p[1], 1.2 + 1.6 * (1 - u)).fill({ color: i % 3 ? 0xff8a3a : 0xb07cff, alpha: 0.85 * (1 - u) * (now ? 1 : 0) });
  }
}


/**
 * Feature "Inflow" (designer 2026-11-21): instead of beams racing round the edge, streams of energy
 * particles flow in from the edge towards the middle, like the plasma wave beside them: each stream is
 * born at a point of the edge, a short trail of bright motes curling a little as it goes, then fades.
 * Every mote worked out from the time alone (`now` in ms; 0 = still: only the edge glow).
 */
function drawOverloadInflow(g: Graphics, w: number, h: number, now: number): void {
  const inset = 6;
  const W = w - 2 * inset;
  const H = h - 2 * inset;
  if (W <= 0 || H <= 0) return;
  const per = 2 * (W + H);
  /** A point on the edge (0..1 clockwise from the top left) and the way in from there. */
  const edge = (t: number): { x: number; y: number; nx: number; ny: number } => {
    let s = (((t % 1) + 1) % 1) * per;
    if (s < W) return { x: inset + s, y: inset, nx: 0, ny: 1 };
    s -= W;
    if (s < H) return { x: inset + W, y: inset + s, nx: -1, ny: 0 };
    s -= H;
    if (s < W) return { x: inset + W - s, y: inset + H, nx: 0, ny: -1 };
    s -= W;
    return { x: inset, y: inset + H - s, nx: 1, ny: 0 };
  };
  const pulse = 0.5 + 0.5 * Math.sin(now / 420);
  g.rect(inset, inset, W, H).stroke({ width: 14, color: 0xff3b1a, alpha: 0.08 + 0.06 * pulse });
  g.rect(inset, inset, W, H).stroke({ width: 2, color: 0xff7a3a, alpha: 0.3 + 0.2 * pulse });
  if (!now) return;
  const reach = Math.min(110, Math.min(W, H) * 0.22);
  const streams = Math.round(Math.min(64, Math.max(24, per / 34)));
  for (let i = 0; i < streams; i++) {
    const life = 1700 + 1300 * rnd(i + 300);
    const cycle = now / life + rnd(i + 400);
    const n = Math.floor(cycle);
    const u = cycle - n;
    // Each new life starts somewhere else on the edge.
    const e = edge(rnd(i * 31 + n * 7 + 500));
    const tx = -e.ny;
    const ty = e.nx;
    const curl = (rnd(i + n * 3 + 600) - 0.5) * 0.9;
    const len = reach * (0.55 + 0.45 * rnd(i + n + 700));
    const violet = rnd(i + 800) < 0.3;
    const col = violet ? 0xb07cff : 0xff7a2a;
    const core = violet ? 0xf0e6ff : 0xffe2a8;
    const fade = Math.sin(Math.PI * Math.min(1, u * 1.15));
    // The head and a short trail of motes behind it.
    for (let k = 0; k < 7; k++) {
      const p = Math.max(0, u - k * 0.035);
      const d = len * (1 - (1 - p) ** 2);
      const bend = curl * d * d / len;
      const x = e.x + e.nx * d + tx * bend;
      const y = e.y + e.ny * d + ty * bend;
      const f = (1 - k / 7) * fade;
      if (f <= 0.02) continue;
      g.circle(x, y, (k === 0 ? 3.2 : 2.2) * (1 - p * 0.5)).fill({ color: col, alpha: 0.28 * f });
      g.circle(x, y, (k === 0 ? 1.5 : 0.9) * (1 - p * 0.4)).fill({ color: core, alpha: 0.85 * f });
    }
  }
  // A few faint sparks lifting off the edge itself.
  for (let i = 0; i < 30; i++) {
    const u = (now / 2600 + rnd(i + 900)) % 1;
    const e = edge(rnd(i + 950) + now / 90000);
    const d = 3 + u * 16;
    g.circle(e.x + e.nx * d, e.y + e.ny * d, 1 + 1.2 * (1 - u)).fill({ color: i % 3 ? 0xff8a3a : 0xb07cff, alpha: 0.6 * (1 - u) });
  }
}


/**
 * Round 29 (designer 2026-11-22: "add more effects; change all the particle effects to new ones and be
 * more ambitious"): Round 28's Storm, Pulse and Veil replaced by six new looks of the Field's edge in an
 * Overload (the plasma wave stays under them). Every mote worked out from the time alone (`now` 0 = still:
 * only the edge glow); about 300-550 dots a frame, and the Field rests after 20 s untouched as before.
 *
 * - loops: Solar loops: great arches of plasma stand on the edge, particles streaming along each from foot
 *   to foot; an arch swells, then snaps and throws its particles in towards the Field.
 * - tempest: Ion tempest: glowing ion clouds drift along the edge; lightning made of bright beads leaps
 *   between them and forks inwards, with flashes and sparks.
 * - torrent: Plasma torrent: a thick river of particles runs round the whole edge, churned by noise, with
 *   eddies curling off inwards.
 * - breath: Shock breath: every few seconds the whole edge breathes in: a wall of particles gathers, then is
 *   blown inwards across the Field and falls back.
 * - embers: Ember rise: embers well up from the bottom edge and drift up the sides on hot air, swirling,
 *   and are drawn into a smouldering top edge.
 * - rift: Void rift: violet tears open along the edges and close again; motes are pulled out of the Field
 *   into them, and sparks of white light spill from their lips.
 */
type MoreLook = "loops" | "tempest" | "torrent" | "breath" | "embers" | "rift";

function drawOverloadMore(g: Graphics, w: number, h: number, now: number, look: MoreLook): void {
  const inset = 6;
  const W = w - 2 * inset;
  const H = h - 2 * inset;
  if (W <= 0 || H <= 0) return;
  const per = 2 * (W + H);
  const edge = (t: number): { x: number; y: number; nx: number; ny: number } => {
    let s = (((t % 1) + 1) % 1) * per;
    if (s < W) return { x: inset + s, y: inset, nx: 0, ny: 1 };
    s -= W;
    if (s < H) return { x: inset + W, y: inset + s, nx: -1, ny: 0 };
    s -= H;
    if (s < W) return { x: inset + W - s, y: inset + H, nx: 0, ny: -1 };
    s -= W;
    return { x: inset, y: inset + H - s, nx: 1, ny: 0 };
  };
  const pulse = 0.5 + 0.5 * Math.sin(now / 420);
  const rim = look === "rift" ? 0x9a4dff : 0xff3b1a;
  g.rect(inset, inset, W, H).stroke({ width: 14, color: rim, alpha: 0.08 + 0.06 * pulse });
  g.rect(inset, inset, W, H).stroke({ width: 2, color: look === "rift" ? 0xc59bff : 0xff7a3a, alpha: 0.3 + 0.2 * pulse });
  if (!now) return;
  const T = now / 1000;
  const glowDot = (x: number, y: number, r: number, col: number, core: number, a: number) => {
    if (a <= 0.02) return;
    g.circle(x, y, r * 2.4).fill({ color: col, alpha: 0.16 * a });
    g.circle(x, y, r).fill({ color: core, alpha: Math.min(1, a) });
  };
  const reach = Math.min(120, Math.min(W, H) * 0.24);

  if (look === "loops") {
    const loops = Math.round(Math.min(10, Math.max(5, per / 300)));
    for (let k = 0; k < loops; k++) {
      const P = 5200 + 2600 * rnd(k + 2100);
      const cyc = now / P + rnd(k + 2200);
      const n = Math.floor(cyc);
      const t = cyc - n;
      const foot = rnd(k * 13 + n * 7 + 2300);
      const span = (70 + 110 * rnd(k + n + 2400)) / per;
      const a = edge(foot);
      const b = edge(foot + span);
      // Both feet on one side only (a loop never bends round a corner).
      if (a.nx !== b.nx || a.ny !== b.ny) continue;
      const grow = Math.sin(Math.PI * Math.min(1, t / 0.8));
      const H0 = (28 + 46 * rnd(k + n + 2500)) * (0.5 + 0.5 * grow);
      const snap = t > 0.8 ? (t - 0.8) / 0.2 : 0;
      const at = (q: number) => {
        const x = a.x + (b.x - a.x) * q;
        const y = a.y + (b.y - a.y) * q;
        const lift = Math.sin(Math.PI * q) * H0 + Math.sin(q * 9 + T * 3 + k) * 2.5;
        return { x: x + a.nx * lift, y: y + a.ny * lift };
      };
      if (snap === 0) {
        // Particles streaming along the arch, foot to foot, thick in its middle.
        const N = 30;
        for (let j = 0; j < N; j++) {
          const q = (j / N + T * (0.35 + 0.2 * rnd(k + 2600))) % 1;
          const p = at(q);
          const jitter = (rnd(j * 7 + k + Math.floor(now / 60)) - 0.5) * 3;
          const f = Math.sin(Math.PI * q);
          glowDot(p.x + jitter * a.ny, p.y + jitter * a.nx, 1 + 1.6 * f, 0xff5a1f, f > 0.75 ? 0xfff0d0 : 0xffa060, (0.35 + 0.6 * f) * grow);
        }
        // Foot points glowing where the arch stands on the edge.
        glowDot(a.x, a.y, 3, 0xff3b1a, 0xffd0a0, 0.7 * grow);
        glowDot(b.x, b.y, 3, 0xff3b1a, 0xffd0a0, 0.7 * grow);
      } else {
        // The arch snaps: its particles are flung in towards the Field and fade.
        for (let j = 0; j < 34; j++) {
          const q = j / 34;
          const p = at(q);
          const d = (12 + 60 * rnd(j + k * 3 + n)) * (1 - (1 - snap) ** 2);
          const side = (rnd(j + n + 2700) - 0.5) * 30 * snap;
          glowDot(p.x + a.nx * d + a.ny * side, p.y + a.ny * d + a.nx * side, 1.6 * (1 - snap) + 0.5, 0xff7a2a, 0xfff0d0, 0.95 * (1 - snap));
        }
      }
    }
    // Fine sparks lifting off the whole edge.
    for (let i = 0; i < 50; i++) {
      const u = (T / 2.3 + rnd(i + 2800)) % 1;
      const e = edge(rnd(i + 2900) + T / 80);
      const d = 3 + u * 22;
      g.circle(e.x + e.nx * d, e.y + e.ny * d, 1 + (1 - u)).fill({ color: i % 4 ? 0xff8a3a : 0xfff0d0, alpha: 0.65 * (1 - u) });
    }
  } else if (look === "tempest") {
    // Ion clouds: soft glows drifting along the edge.
    const clouds = Math.round(Math.min(9, Math.max(5, per / 320)));
    const cs: { x: number; y: number; nx: number; ny: number }[] = [];
    for (let c = 0; c < clouds; c++) {
      const u = rnd(c + 3000) + T / (40 + 25 * rnd(c + 3100)) * (c % 2 ? 1 : -1);
      const e = edge(u);
      const d = 10 + 8 * Math.sin(T * 0.8 + c);
      const x = e.x + e.nx * d;
      const y = e.y + e.ny * d;
      cs.push({ x, y, nx: e.nx, ny: e.ny });
      const br = 0.6 + 0.4 * Math.sin(T * 2.1 + c * 1.7);
      for (let j = 0; j < 10; j++) {
        const ang = rnd(c * 20 + j) * Math.PI * 2 + T * (0.4 + 0.3 * rnd(j));
        const rr = 6 + 16 * rnd(c * 20 + j + 5);
        g.circle(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr, 5 + 7 * rnd(j + c)).fill({ color: j % 3 ? 0x7a5cff : 0xff5a2a, alpha: 0.06 * br });
        g.circle(x + Math.cos(ang) * rr * 0.6, y + Math.sin(ang) * rr * 0.6, 1.2).fill({ color: 0xe8ddff, alpha: 0.5 * br });
      }
    }
    // Lightning made of beads between neighbouring clouds, flickering, now and then forking inwards.
    const flick = Math.floor(now / 55);
    for (let c = 0; c < cs.length; c++) {
      const P = 700 + 500 * rnd(c + 3200);
      const t = ((now / P + rnd(c + 3300)) % 1 + 1) % 1;
      if (t > 0.35) continue;
      const life = 1 - t / 0.35;
      const A = cs[c]!;
      const B = cs[(c + 1) % cs.length]!;
      // Only between clouds near each other on the edge (never a bolt across the Field).
      if (Math.hypot(B.x - A.x, B.y - A.y) > Math.min(260, per / 7)) continue;
      const steps = 22;
      let px = A.x;
      let py = A.y;
      for (let j = 1; j <= steps; j++) {
        const q = j / steps;
        const jit = (rnd(c * 41 + j * 7 + flick) - 0.5) * 22 * Math.sin(Math.PI * q);
        const x = A.x + (B.x - A.x) * q + A.nx * jit + A.ny * jit * 0.4;
        const y = A.y + (B.y - A.y) * q + A.ny * jit + A.nx * jit * 0.4;
        g.moveTo(px, py).lineTo(x, y).stroke({ width: 5, color: 0x9f7bff, alpha: 0.18 * life });
        g.circle(x, y, 1.6).fill({ color: 0xffffff, alpha: 0.9 * life });
        if (j === 9 && rnd(c + flick) > 0.45) {
          // A fork leaping in towards the Field.
          let fx = x;
          let fy = y;
          for (let f = 1; f <= 6; f++) {
            const nx2 = fx + A.nx * 7 + (rnd(f + c + flick * 3) - 0.5) * 12;
            const ny2 = fy + A.ny * 7 + (rnd(f + c + flick * 5) - 0.5) * 12;
            g.moveTo(fx, fy).lineTo(nx2, ny2).stroke({ width: 1.2, color: 0xe8ddff, alpha: 0.75 * life * (1 - f / 7) });
            fx = nx2;
            fy = ny2;
          }
          glowDot(fx, fy, 1.6, 0x9f7bff, 0xffffff, life);
        }
        px = x;
        py = y;
      }
      // The flash where it strikes.
      g.circle(B.x, B.y, 18 * life).fill({ color: 0xc8b0ff, alpha: 0.12 * life });
    }
  } else if (look === "torrent") {
    // A thick river of particles round the whole edge, churned by noise; eddies curl off inwards.
    const N = Math.round(Math.min(420, Math.max(200, per / 4)));
    for (let i = 0; i < N; i++) {
      const sp = 0.6 + 0.6 * rnd(i + 3400);
      const u = (rnd(i + 3500) + (T / 26) * sp) % 1;
      const e = edge(u);
      const lane = rnd(i + 3600);
      const churn = noise3(u * 18, lane * 3, T * 0.6) * 9;
      const d = 3 + lane * 24 + churn;
      const hot = 0.5 + 0.5 * noise3(u * 9 + 50, T * 0.5, 2);
      const col = hot > 0.68 ? 0xfff0d0 : hot > 0.45 ? 0xffa050 : i % 5 ? 0xff5a1f : 0xb07cff;
      const rr = 1.1 + 2 * hot * (1 - lane * 0.5);
      if (hot > 0.55) g.circle(e.x + e.nx * d, e.y + e.ny * d, rr * 2.6).fill({ color: 0xff6a2a, alpha: 0.1 * hot });
      g.circle(e.x + e.nx * d, e.y + e.ny * d, rr).fill({ color: col, alpha: 0.45 + 0.55 * hot * (1 - lane * 0.6) });
    }
    // Eddies: little whirls of motes spinning off the river and fading into the Field.
    const eddies = Math.round(Math.min(10, Math.max(5, per / 280)));
    for (let k = 0; k < eddies; k++) {
      const P = 2600 + 1600 * rnd(k + 3700);
      const cyc = now / P + rnd(k + 3800);
      const n = Math.floor(cyc);
      const t = cyc - n;
      const e = edge(rnd(k * 11 + n * 3 + 3900) + T / 26);
      const out = 20 + reach * 0.7 * t;
      const ox = e.x + e.nx * out;
      const oy = e.y + e.ny * out;
      for (let j = 0; j < 14; j++) {
        const ang = (j / 14) * Math.PI * 2 + t * 9 * (k % 2 ? 1 : -1);
        const rr = (5 + 10 * t) * (0.6 + 0.4 * rnd(j + k));
        g.circle(ox + Math.cos(ang) * rr, oy + Math.sin(ang) * rr, 1.4 * (1 - t) + 0.4).fill({ color: j % 4 ? 0xff8a3a : 0xfff0d0, alpha: 0.8 * (1 - t) * Math.min(1, t * 5) });
      }
    }
  } else if (look === "breath") {
    // The edge breathes in, then a wall of particles is blown inwards across the Field and falls back.
    const P = 3600;
    const t = (now % P) / P;
    const N = Math.round(Math.min(360, Math.max(160, per / 5)));
    for (let i = 0; i < N; i++) {
      const u = i / N + rnd(i + 4000) * 0.003;
      const e = edge(u);
      const jit = rnd(i + 4100);
      let d: number;
      let a: number;
      if (t < 0.35) {
        // Gathering: motes drawn in tight to the edge, brightening.
        const q = t / 0.35;
        d = 4 + 14 * jit * (1 - q);
        a = 0.3 + 0.6 * q;
      } else if (t < 0.7) {
        // The blow: thrown inwards, the fast ones furthest, a ripple along the wall.
        const q = (t - 0.35) / 0.35;
        const wave = Math.sin(u * Math.PI * 2 * 6 + T * 2) * 0.15;
        d = 4 + reach * (0.5 + 0.8 * jit + wave) * (1 - (1 - q) ** 3);
        a = 0.95 * (1 - q * 0.4);
      } else {
        // Falling back to the edge, fading.
        const q = (t - 0.7) / 0.3;
        d = 4 + reach * (0.5 + 0.8 * jit) * (1 - q) ** 2;
        a = 0.6 * (1 - q) + 0.2;
      }
      const col = jit > 0.85 ? 0xfff0d0 : jit > 0.5 ? 0xff8a3a : i % 6 ? 0xff5a1f : 0xb07cff;
      g.circle(e.x + e.nx * d, e.y + e.ny * d, 0.9 + 1.4 * (1 - jit)).fill({ color: col, alpha: a });
    }
    if (t > 0.33 && t < 0.5) {
      const q = (t - 0.33) / 0.17;
      g.rect(inset, inset, W, H).stroke({ width: 10 + 30 * q, color: 0xffb070, alpha: 0.18 * (1 - q) });
    }
  } else if (look === "embers") {
    // Embers well up from the bottom edge, drift up the sides on hot air and are drawn into the top edge.
    const N = Math.round(Math.min(300, Math.max(140, per / 6)));
    for (let i = 0; i < N; i++) {
      const P = 4200 + 3000 * rnd(i + 4200);
      const t = ((now / P + rnd(i + 4300)) % 1 + 1) % 1;
      const side = rnd(i + 4400);
      // Up the left or right side band, or across the bottom then up: x near a wall, y rising.
      const left = side < 0.5;
      const band = Math.min(70, W * 0.16) * rnd(i + 4500) ** 1.6;
      const baseX = left ? inset + band : inset + W - band;
      const y = inset + H - t * H;
      const sway = noise3(i * 0.3, t * 3, T * 0.3) * 18;
      const x = baseX + sway * (left ? 1 : -1) + (left ? 1 : -1) * Math.sin(t * 6 + i) * 4;
      const cool = t;
      const col = cool < 0.3 ? 0xfff0d0 : cool < 0.7 ? 0xff9a4a : 0xff4a1a;
      const a = Math.sin(Math.PI * Math.min(1, t * 1.1)) * (0.5 + 0.5 * Math.sin(now / (200 + 150 * rnd(i)) + i));
      g.circle(x, y, 0.8 + 1.8 * (1 - cool) * rnd(i + 4600) + 0.6).fill({ color: col, alpha: 0.85 * a });
    }
    // Along the bottom: a glowing bed; the top edge smoulders.
    for (let i = 0; i < 70; i++) {
      const u = rnd(i + 4700);
      const flick = 0.5 + 0.5 * Math.sin(now / (140 + 90 * rnd(i + 4800)) + i);
      g.circle(inset + u * W, inset + H - 2 - 6 * rnd(i + 4900), 1.5 + 2 * flick).fill({ color: flick > 0.7 ? 0xffd0a0 : 0xff5a1f, alpha: 0.45 * flick });
      g.circle(inset + rnd(i + 5000) * W, inset + 2 + 4 * rnd(i + 5100), 1.2 + flick).fill({ color: 0xff3b1a, alpha: 0.35 * flick });
    }
  } else {
    // Void rift: violet tears open along the edges and close again, pulling motes out of the Field.
    const tears = Math.round(Math.min(7, Math.max(3, per / 420)));
    for (let k = 0; k < tears; k++) {
      const P = 4800 + 2400 * rnd(k + 5200);
      const cyc = now / P + rnd(k + 5300);
      const n = Math.floor(cyc);
      const t = cyc - n;
      const open = Math.sin(Math.PI * t) ** 0.7;
      const centre = rnd(k * 17 + n * 5 + 5400);
      const len = (80 + 120 * rnd(k + n + 5500)) / per;
      const steps = 24;
      const lip: { x: number; y: number; nx: number; ny: number; w: number }[] = [];
      for (let j = 0; j <= steps; j++) {
        const q = j / steps;
        const e = edge(centre + (q - 0.5) * len);
        const w2 = Math.sin(Math.PI * q) * (6 + 6 * noise3(q * 6, k, T * 0.7)) * open;
        lip.push({ ...e, w: w2 });
      }
      // The tear: its two lips, a dark-violet glow between.
      for (let j = 0; j < steps; j++) {
        const p0 = lip[j]!;
        const p1 = lip[j + 1]!;
        g.moveTo(p0.x + p0.nx * (3 + p0.w), p0.y + p0.ny * (3 + p0.w)).lineTo(p1.x + p1.nx * (3 + p1.w), p1.y + p1.ny * (3 + p1.w)).stroke({ width: 2 + p0.w * 1.6, color: 0x6a2cff, alpha: 0.35 * open });
        g.moveTo(p0.x + p0.nx * (3 + p0.w * 1.8), p0.y + p0.ny * (3 + p0.w * 1.8)).lineTo(p1.x + p1.nx * (3 + p1.w * 1.8), p1.y + p1.ny * (3 + p1.w * 1.8)).stroke({ width: 1.2, color: 0xf0e6ff, alpha: 0.85 * open });
      }
      // Motes pulled out of the Field into the tear.
      for (let j = 0; j < 40; j++) {
        const q = rnd(j + k * 50 + 5600);
        const e = lip[Math.round(q * steps)]!;
        const life = ((T * (0.5 + 0.4 * rnd(j + 5700)) + rnd(j + 5800)) % 1);
        const d = 4 + reach * 0.9 * (1 - life) ** 1.5;
        const curl = (1 - life) * 14 * (rnd(j + 5900) - 0.5);
        g.circle(e.x + e.nx * d + e.ny * curl, e.y + e.ny * d + e.nx * curl, 0.8 + 1.4 * life).fill({ color: life > 0.8 ? 0xffffff : j % 3 ? 0xb07cff : 0xff7a3a, alpha: 0.8 * open * Math.sin(Math.PI * life) });
      }
      // Sparks of white light spilling from its lips.
      for (let j = 0; j < 10; j++) {
        const s0 = (T * 1.3 + rnd(j + k * 9 + 6000)) % 1;
        const e = lip[Math.round(rnd(j + k + 6100) * steps)]!;
        const d = 6 + 26 * s0;
        g.circle(e.x + e.nx * d + (rnd(j + 6200) - 0.5) * 14 * s0, e.y + e.ny * d, 1.2).fill({ color: 0xffffff, alpha: open * (1 - s0) });
      }
    }
    // Faint violet dust along the whole edge.
    for (let i = 0; i < 60; i++) {
      const u = (rnd(i + 6300) + T / 60) % 1;
      const e = edge(u);
      const d = 3 + 12 * rnd(i + 6400);
      g.circle(e.x + e.nx * d, e.y + e.ny * d, 1).fill({ color: 0xc59bff, alpha: 0.4 * (0.5 + 0.5 * Math.sin(T * 3 + i)) });
    }
  }
}
