/**
 * Reveal effects (designer 2026-11-09): every unit type but Bots has its own burst of particles
 * when it is revealed, played right after the tile flips. Omega units and Flares get the biggest:
 * a charge-up before the flip, a shake of the whole Field and a flash over it. Placeholder looks
 * drawn with PixiJS in the Field's effects layer; the designer's art can replace them later.
 */

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
export function drawOverloadRing(g: Graphics, w: number, h: number, now: number): void {
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
  // Four beams: two of red plasma one way, two of violet energy the other way.
  const beams = [
    { t: now / 5200, col: 0xff5a1f, core: 0xffe0a0 },
    { t: now / 5200 + 0.5, col: 0xff5a1f, core: 0xffe0a0 },
    { t: -now / 7400 + 0.25, col: 0xb07cff, core: 0xf0e6ff },
    { t: -now / 7400 + 0.75, col: 0xb07cff, core: 0xf0e6ff },
  ];
  beams.forEach((b, k) => {
    const dir = k < 2 ? 1 : -1;
    const n = 28;
    const len = 0.11;
    let prev = at(b.t);
    for (let i = 1; i <= n; i++) {
      const tt = b.t - dir * (len * i) / n;
      const wave = Math.sin(i * 0.8 + now / 90) * 3 * (i / n);
      const pt = at(tt, 2 + wave);
      const f = 1 - i / n;
      g.moveTo(prev[0], prev[1]).lineTo(pt[0], pt[1]).stroke({ width: 2 + 9 * f, color: b.col, alpha: 0.25 * f });
      g.moveTo(prev[0], prev[1]).lineTo(pt[0], pt[1]).stroke({ width: 1 + 2.5 * f, color: b.core, alpha: 0.9 * f });
      prev = pt;
    }
    const head = at(b.t, 2);
    g.circle(head[0], head[1], 6 + 2 * Math.sin(now / 60 + k)).fill({ color: b.col, alpha: 0.5 });
    g.circle(head[0], head[1], 3).fill({ color: 0xffffff, alpha: 0.95 });
  });
  // Energy waves rising from the edge like a sun's magnetic loops (designer 2026-11-09).
  if (now) drawEdgeFlames(g, at, per, now);
  // Sparks drifting in from the edge.
  for (let i = 0; i < 46; i++) {
    const u = (now / 2400 + rnd(i)) % 1;
    const p = at(rnd(i + 100) + now / 60000, 4 + u * 34);
    g.circle(p[0], p[1], 1.2 + 1.6 * (1 - u)).fill({ color: i % 3 ? 0xff8a3a : 0xb07cff, alpha: 0.85 * (1 - u) * (now ? 1 : 0) });
  }
}

/**
 * Energy waves from the Field's edge, like the magnetic loops on a sun (designer 2026-11-09:
 * subtle, not flames). Each loop is rooted at two fixed points on the edge and does not move
 * along it or wiggle: it slowly rises towards the Field and sinks back (5-9 s), as two or three
 * faint nested arcs with a soft glow.
 */
function drawEdgeFlames(g: Graphics, at: (t: number, d?: number) => [number, number], per: number, now: number): void {
  const n = Math.max(8, Math.min(30, Math.round(per / 90)));
  for (let i = 0; i < n; i++) {
    const t0 = (i + 0.2 + rnd(i + 300) * 0.6) / n;
    const cyc = 5000 + rnd(i + 400) * 4000;
    const ph = ((now / cyc + rnd(i + 500)) % 1) * Math.PI * 2;
    // Slow rise and fall, eased at both ends.
    const life = 0.5 - 0.5 * Math.cos(ph);
    const height = (16 + 40 * rnd(i + 600)) * (0.25 + 0.75 * life);
    const span = (34 + 50 * rnd(i + 700)) / per;
    const violet = i % 5 === 2;
    const col = violet ? 0xa98bff : 0xff9a4a;
    const core = violet ? 0xe6dcff : 0xffe2b0;
    const nest = 2 + (i % 2);
    for (let k = 0; k < nest; k++) {
      const f = 1 - k * 0.28;
      const w = span * f;
      const m = 14;
      const pts: number[] = [];
      for (let j = 0; j <= m; j++) {
        const s = j / m;
        const p = at(t0 + (s - 0.5) * w, height * f * Math.sin(Math.PI * s));
        pts.push(p[0], p[1]);
      }
      const fade = (0.35 + 0.65 * life) * (1 - k * 0.22);
      g.poly(pts, false).stroke({ width: 5, color: col, alpha: 0.06 * fade });
      g.poly(pts, false).stroke({ width: 1.2, color: core, alpha: 0.3 * fade });
    }
  }
}
