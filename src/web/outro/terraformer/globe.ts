/**
 * The Terraformer outro: space and the planet itself. Stars in three layers (each turning a
 * little differently, so they slide past one another), far clouds of colour, the dark globe with
 * its rugged ground, the thin shining air along its edge, and the sun that rises over that edge
 * at the end. The planet is on its night side until then. Looks only.
 */

import { noise3 } from "../../noise.js";
import { clamp, cross, dot, lerp, rng, smooth, TAU, unit, type V3 } from "../../briefing/styles/intro2/math3.js";
import type { CompanyTheme } from "../types.js";
import { softSprite } from "./pylon.js";
import { DEG, faces, place, see, seeFar, type Cam } from "./view.js";

/** Where the sun stands: it comes over the edge ahead of the ship once the camera has risen. */
const SUN_LON = 27;
const SUN_LAT = -5;
export const SUN: V3 = unit([Math.cos(SUN_LON * DEG), Math.tan(SUN_LAT * DEG), -Math.sin(SUN_LON * DEG)]);

interface Star {
  v: V3;
  size: number;
  a: number;
  col: number;
  ph: number;
  sp: number;
  layer: number;
}
const STAR_COLS = ["255 255 255", "196 226 255", "255 232 190", "214 220 255"];

/** The rugged ground round the target sector: a picture made once from noise, laid on the globe piece by piece. */
const TERRAIN_SPAN = 34;
const TERRAIN_CELLS = 24;
/** The colour of the night ground where nothing shows (the picture fades into it at its edge). */
const NIGHT = [5, 9, 16] as const;
const TERRAIN_PX = TERRAIN_CELLS * 28;
let terrain: HTMLCanvasElement | undefined;

function fbm(x: number, y: number, z: number, oct: number): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    v += a * noise3(x * f, y * f, z * f);
    a *= 0.5;
    f *= 2.07;
  }
  return v;
}

function makeTerrain(): HTMLCanvasElement {
  const half = TERRAIN_PX / 2;
  const small = document.createElement("canvas");
  small.width = small.height = half;
  const sg = small.getContext("2d")!;
  const img = sg.createImageData(half, half);
  const R = rng(5150);
  for (let y = 0; y < half; y++) {
    const v = ((y + 0.5) / half) * 2 - 1;
    for (let x = 0; x < half; x++) {
      const u = ((x + 0.5) / half) * 2 - 1;
      const [px, py, pz] = place(u * TERRAIN_SPAN, v * TERRAIN_SPAN);
      // Broad highlands and basins, sharp ridges, and the rims of old craters.
      const land = fbm(px * 5.5 + 3.1, py * 5.5 + 7.7, pz * 5.5 + 1.3, 5);
      const ridge = Math.pow(1 - Math.abs(noise3(px * 21 + 5, py * 21 + 9, pz * 21 + 2)), 5);
      const crater = Math.pow(1 - Math.abs(noise3(px * 11 + 40, py * 11 + 4, pz * 11 + 17)), 9);
      const high = clamp(0.5 + 1.1 * land);
      const fine = fbm(px * 60 + 1, py * 60 + 2, pz * 60 + 3, 2);
      const light = clamp(0.1 * high + 0.42 * ridge * high + 0.28 * crater + 0.1 * fine + 0.03 * (R() - 0.5)) * smooth(1, 0.7, Math.hypot(u, v));
      const i = (y * half + x) * 4;
      // No see-through parts: the pieces overlap a hair, and must not show where they do.
      img.data[i] = lerp(NIGHT[0], 54, light);
      img.data[i + 1] = lerp(NIGHT[1], 72, light);
      img.data[i + 2] = lerp(NIGHT[2], 104, light);
      img.data[i + 3] = 255;
    }
  }
  sg.putImageData(img, 0, 0);
  const c = document.createElement("canvas");
  c.width = c.height = TERRAIN_PX;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(small, 0, 0, TERRAIN_PX, TERRAIN_PX);
  return c;
}

export interface Globe {
  /** Space: the far clouds and the stars. */
  sky(g: CanvasRenderingContext2D, c: Cam, t: number): void;
  /** The globe: work out its edge for this camera, fill it, lay the ground on it. Returns its shape (to draw the ground's lights inside). */
  body(g: CanvasRenderingContext2D, c: Cam): Path2D;
  /** The air along the edge, and the sun over it. `dawn` 0..1: how far the film has come to the sunrise. */
  air(g: CanvasRenderingContext2D, c: Cam, t: number, shape: Path2D): void;
  /** How much of the sun shows over the edge, 0..1. */
  sunUp(c: Cam): number;
}

export function createGlobe(theme: CompanyTheme): Globe {
  const R = rng(20261116);
  const stars: Star[] = [];
  for (let i = 0; i < 4200; i++) {
    // Evenly over the whole sky.
    const z = R() * 2 - 1;
    const a = R() * TAU;
    const s = Math.sqrt(1 - z * z);
    const big = R() * R();
    stars.push({ v: [s * Math.cos(a), z, s * Math.sin(a)], size: 0.5 + big * 1.9, a: 0.45 + 0.55 * R(), col: Math.floor(R() * STAR_COLS.length), ph: R() * TAU, sp: 0.6 + R() * 2.2, layer: i % 3 });
  }
  stars.sort((p, q) => p.col - q.col);
  const clouds = [
    { v: unit([0.9, -0.1, 0.35]) as V3, size: 0.55, rgb: "40 70 160", a: 0.2 },
    { v: unit([0.75, -0.45, -0.2]) as V3, size: 0.7, rgb: "90 50 150", a: 0.14 },
    { v: unit([0.6, -0.2, 0.75]) as V3, size: 0.45, rgb: theme.glow, a: 0.1 },
    { v: unit([0.95, -0.3, -0.05]) as V3, size: 0.35, rgb: "30 110 150", a: 0.16 },
    { v: unit([0.5, -0.7, 0.4]) as V3, size: 0.6, rgb: "50 60 140", a: 0.14 },
  ];
  const cloudTex = clouds.map((k) => softSprite(k.rgb, 0, 128));
  const sunWhite = softSprite("255 226 180", 1, 128);
  const sunGold = softSprite("255 176 96", 0.5, 128);
  const sunCool = softSprite("120 170 255", 0.3, 128);
  // The ground picture's corners on the globe.
  const N = TERRAIN_CELLS + 1;
  const nodes = new Float32Array(N * N * 3);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const p = place(((i / TERRAIN_CELLS) * 2 - 1) * TERRAIN_SPAN, ((j / TERRAIN_CELLS) * 2 - 1) * TERRAIN_SPAN);
      nodes.set(p, (j * N + i) * 3);
    }
  const nx = new Float32Array(N * N);
  const ny = new Float32Array(N * N);
  const nok = new Uint8Array(N * N);
  // The edge of the globe in the picture, and how much daylight each point of it has.
  const STEPS = 160;
  const ex = new Float32Array(STEPS + 1);
  const ey = new Float32Array(STEPS + 1);
  const eday = new Float32Array(STEPS + 1);
  const eok = new Uint8Array(STEPS + 1);

  function sky(g: CanvasRenderingContext2D, c: Cam, t: number): void {
    const bg = g.createLinearGradient(0, 0, c.w * 0.3, c.h);
    bg.addColorStop(0, "#02040a");
    bg.addColorStop(0.5, "#040914");
    bg.addColorStop(1, "#050c18");
    g.fillStyle = bg;
    g.fillRect(0, 0, c.w, c.h);
    g.globalCompositeOperation = "lighter";
    for (const [i, k] of clouds.entries()) {
      if (!seeFar(c, k.v[0], k.v[1], k.v[2])) continue;
      const r = c.focal * Math.tan(k.size);
      if (c.sx < -r || c.sx > c.w + r || c.sy < -r || c.sy > c.h + r) continue;
      g.globalAlpha = k.a * 2.2;
      g.drawImage(cloudTex[i]!, c.sx - r, c.sy - r, r * 2, r * 2);
    }
    // Three layers of stars: the far ones stand still, the nearer ones turn slowly about the pole.
    let col = -1;
    for (const s of stars) {
      const turn = s.layer * 0.0035 * t;
      const cs = Math.cos(turn);
      const sn = Math.sin(turn);
      const x = s.v[0] * cs + s.v[2] * sn;
      const z = -s.v[0] * sn + s.v[2] * cs;
      if (!seeFar(c, x, s.v[1], z)) continue;
      if (c.sx < -2 || c.sx > c.w + 2 || c.sy < -2 || c.sy > c.h + 2) continue;
      if (s.col !== col) {
        col = s.col;
        g.fillStyle = `rgb(${STAR_COLS[col]})`;
      }
      const size = s.size * (1 + 0.25 * s.layer);
      g.globalAlpha = Math.min(1, s.a * (0.62 + 0.38 * Math.sin(t * s.sp + s.ph)) * Math.min(1, size));
      const r = Math.max(0.7, size);
      g.fillRect(c.sx - r / 2, c.sy - r / 2, r, r);
      if (size > 1.7) {
        // The brightest have a faint cross of light.
        g.globalAlpha *= 0.35;
        g.fillRect(c.sx - r * 2.2, c.sy - 0.35, r * 4.4, 0.7);
        g.fillRect(c.sx - 0.35, c.sy - r * 2.2, 0.7, r * 4.4);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  function body(g: CanvasRenderingContext2D, c: Cam): Path2D {
    terrain ??= makeTerrain();
    const dist = Math.hypot(c.pos[0], c.pos[1], c.pos[2]);
    const up = unit(c.pos);
    // The edge is a circle on the globe: every point where the line of sight just touches it.
    const inv = 1 / dist;
    const rad = Math.sqrt(Math.max(0, 1 - inv * inv));
    const a = unit([c.r[0] - up[0] * dot(c.r, up), c.r[1] - up[1] * dot(c.r, up), c.r[2] - up[2] * dot(c.r, up)]);
    const b = cross(up, a);
    // Start at the point farthest behind the view, so the part in the picture is one unbroken run.
    const fa = dot(c.f, a);
    const fb = dot(c.f, b);
    const back = Math.atan2(-fb, -fa);
    const shape = new Path2D();
    let any = false;
    let fx = 0;
    let fy = 0;
    const lim = 4 * Math.max(c.w, c.h);
    for (let i = 0; i <= STEPS; i++) {
      const ph = back + (i / STEPS) * TAU;
      const cs = Math.cos(ph) * rad;
      const sn = Math.sin(ph) * rad;
      const x = up[0] * inv + a[0] * cs + b[0] * sn;
      const y = up[1] * inv + a[1] * cs + b[1] * sn;
      const z = up[2] * inv + a[2] * cs + b[2] * sn;
      const ok = see(c, x, y, z) && c.sz > 0.02 && Math.abs(c.sx - c.w / 2) < lim && Math.abs(c.sy - c.h / 2) < lim;
      eok[i] = ok ? 1 : 0;
      if (!ok) continue;
      ex[i] = c.sx;
      ey[i] = c.sy;
      eday[i] = x * SUN[0] + y * SUN[1] + z * SUN[2];
      if (!any) {
        any = true;
        fx = c.sx;
        fy = c.sy;
        shape.moveTo(c.sx, c.sy);
      } else shape.lineTo(c.sx, c.sy);
    }
    // Closed through the middle of the globe (far below the picture when only its edge shows).
    const q: V3 = [-c.pos[0], -c.pos[1], -c.pos[2]];
    const qz = Math.max(0.05 * dist, dot(q, c.f));
    const mx = c.cx + (c.focal * dot(q, c.r)) / qz;
    const my = c.cy + (c.focal * dot(q, c.d)) / qz;
    if (any) {
      shape.lineTo(mx, my);
      shape.lineTo(fx, fy);
      shape.closePath();
    }
    g.fillStyle = `rgb(${NIGHT.join(" ")})`;
    g.fill(shape);

    // The ground picture, piece by piece (each piece set on its own three corners).
    for (let k = 0; k < N * N; k++) {
      const x = nodes[k * 3]!;
      const y = nodes[k * 3 + 1]!;
      const z = nodes[k * 3 + 2]!;
      nok[k] = faces(c, x, y, z) && see(c, x, y, z) ? 1 : 0;
      nx[k] = c.sx;
      ny[k] = c.sy;
    }
    g.save();
    g.clip(shape);
    const cell = TERRAIN_PX / TERRAIN_CELLS;
    for (let j = 0; j < TERRAIN_CELLS; j++)
      for (let i = 0; i < TERRAIN_CELLS; i++) {
        const k00 = j * N + i;
        const k10 = k00 + 1;
        const k01 = k00 + N;
        if (!nok[k00] || !nok[k10] || !nok[k01] || !nok[k01 + 1]) continue;
        const x0 = nx[k00]!;
        const y0 = ny[k00]!;
        const ax = nx[k10]! - x0;
        const ay = ny[k10]! - y0;
        const bx = nx[k01]! - x0;
        const by = ny[k01]! - y0;
        if (Math.max(x0, x0 + ax, x0 + bx, x0 + ax + bx) < 0 || Math.min(x0, x0 + ax, x0 + bx, x0 + ax + bx) > c.w) continue;
        if (Math.max(y0, y0 + ay, y0 + by, y0 + ay + by) < 0 || Math.min(y0, y0 + ay, y0 + by, y0 + ay + by) > c.h) continue;
        g.save();
        g.transform(ax, ay, bx, by, x0, y0);
        // A hair over its own size, so no seam shows between pieces.
        g.drawImage(terrain, i * cell, j * cell, cell, cell, -0.01, -0.01, 1.02, 1.02);
        g.restore();
      }
    // Towards the edge the air is seen at a slant: a faint haze over the far ground.
    let top = Infinity;
    for (let i = 0; i <= STEPS; i++) if (eok[i] && ex[i]! > -c.w && ex[i]! < 2 * c.w) top = Math.min(top, ey[i]!);
    if (!Number.isFinite(top)) top = 0;
    const haze = g.createLinearGradient(0, top, 0, top + c.h * 0.5);
    haze.addColorStop(0, "rgb(40 80 150 / 0.3)");
    haze.addColorStop(0.2, "rgb(24 50 104 / 0.14)");
    haze.addColorStop(1, "rgb(10 20 50 / 0)");
    g.fillStyle = haze;
    g.fillRect(0, 0, c.w, c.h);
    g.restore();
    return shape;
  }

  /** How far the sun stands above the edge of the globe, in radians (below 0: hidden). */
  function sunOver(c: Cam): number {
    const dist = Math.hypot(c.pos[0], c.pos[1], c.pos[2]);
    const down = -(SUN[0] * c.pos[0] + SUN[1] * c.pos[1] + SUN[2] * c.pos[2]) / dist;
    return Math.acos(clamp(down, -1, 1)) - Math.asin(Math.min(1, 1 / dist));
  }
  const sunUp = (c: Cam) => smooth(-0.004, 0.03, sunOver(c));

  function air(g: CanvasRenderingContext2D, c: Cam, t: number, shape: Path2D): void {
    const over = sunOver(c);
    const up = smooth(-0.004, 0.03, over);
    // First light: the air glows where the sun is about to come.
    const first = smooth(-0.11, 0.0, over);
    const hasSun = seeFar(c, SUN[0], SUN[1], SUN[2]);
    const sx = c.sx;
    const sy = c.sy;
    const m = Math.min(c.w, c.h);
    const dist = Math.hypot(c.pos[0], c.pos[1], c.pos[2]);
    // How thick the air looks at the edge, px.
    const thick = clamp((c.focal * 0.011) / Math.sqrt(Math.max(0.01, dist * dist - 1)), 5, 40);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.lineJoin = "round";
    // Sunlit air and ground inside the edge, near the sun.
    if (hasSun && first > 0.01) {
      g.save();
      g.clip(shape);
      const r = m * (0.34 + 0.3 * up);
      g.globalAlpha = 0.75 * first;
      g.drawImage(sunGold, sx - r * 1.5, sy - r * 0.55, r * 3, r * 1.1);
      g.globalAlpha = 0.6 * up;
      g.drawImage(sunWhite, sx - r * 0.8, sy - r * 0.3, r * 1.6, r * 0.6);
      g.restore();
    }
    // The air: soft and wide, then narrower and brighter (half of each stroke lies over the ground: its lit rim).
    const run = () => {
      g.beginPath();
      let pen = false;
      for (let i = 0; i <= STEPS; i++) {
        if (!eok[i]) {
          pen = false;
          continue;
        }
        if (pen) g.lineTo(ex[i]!, ey[i]!);
        else g.moveTo(ex[i]!, ey[i]!);
        pen = true;
      }
    };
    run();
    for (const [wide, rgb, al] of [
      [8, "30 70 200", 0.03],
      [6, "36 84 216", 0.035],
      [4.5, "44 100 232", 0.04],
      [3.3, "56 122 246", 0.05],
      [2.4, "72 144 255", 0.06],
      [1.7, "96 168 255", 0.075],
      [1.15, "126 190 255", 0.1],
      [0.7, "160 212 255", 0.14],
      [0.36, "200 232 255", 0.22],
    ] as const) {
      g.strokeStyle = `rgb(${rgb} / ${al})`;
      g.lineWidth = thick * wide;
      g.stroke();
    }
    // A thin bright thread on the edge itself: gold and white towards the sun, pale blue elsewhere.
    g.lineCap = "round";
    for (let i = 1; i <= STEPS; i++) {
      if (!eok[i] || !eok[i - 1]) continue;
      if (Math.max(ex[i]!, ex[i - 1]!) < -8 || Math.min(ex[i]!, ex[i - 1]!) > c.w + 8) continue;
      const day = (eday[i]! + eday[i - 1]!) / 2;
      const warm = smooth(-0.22, 0.02, day) * first;
      const white = smooth(0.0, 0.22, day) * first;
      const r = lerp(lerp(150, 255, warm), 255, white);
      const gr = lerp(lerp(205, 170, warm), 244, white);
      const bl = lerp(lerp(255, 90, warm), 226, white);
      g.strokeStyle = `rgb(${r | 0} ${gr | 0} ${bl | 0} / ${(0.42 + 0.58 * warm).toFixed(3)})`;
      g.lineWidth = 1 + 1.6 * warm + 1.4 * white;
      g.beginPath();
      g.moveTo(ex[i - 1]!, ey[i - 1]!);
      g.lineTo(ex[i]!, ey[i]!);
      g.stroke();
      if (warm > 0.05) {
        g.strokeStyle = `rgb(255 ${(150 + 70 * white) | 0} ${(70 + 110 * white) | 0} / ${(0.2 * warm).toFixed(3)})`;
        g.lineWidth = thick * (0.8 + 1.6 * white);
        g.stroke();
      }
    }
    // The sun itself: its glare, a streak, and the lens answering it.
    if (hasSun && first > 0.01) {
      const flick = 0.97 + 0.03 * Math.sin(t * 2.3);
      g.globalAlpha = 0.5 * first * (1 - up) + 0.9 * up;
      g.drawImage(sunGold, sx - m * 0.5 * flick, sy - m * 0.5 * flick, m * flick, m * flick);
      if (up > 0.01) {
        g.globalAlpha = up;
        g.drawImage(sunGold, sx - m * 0.2, sy - m * 0.2, m * 0.4, m * 0.4);
        g.drawImage(sunWhite, sx - m * 0.1 * up, sy - m * 0.1 * up, m * 0.2 * up, m * 0.2 * up);
        g.globalAlpha = 0.7 * up;
        g.drawImage(sunWhite, sx - m * 0.8, sy - 2, m * 1.6, 4);
        g.globalAlpha = 0.4 * up;
        g.drawImage(sunGold, sx - m * 0.55, sy - 9, m * 1.1, 18);
        const gx = c.w / 2 - sx;
        const gy = c.h / 2 - sy;
        for (const [k, r, al] of [
          [0.5, 0.03, 0.16],
          [1.25, 0.05, 0.1],
          [1.7, 0.025, 0.16],
          [2.1, 0.09, 0.06],
        ] as const) {
          g.globalAlpha = al * up;
          g.drawImage(k > 1.5 ? sunCool : sunGold, sx + gx * k - m * r, sy + gy * k - m * r, m * r * 2, m * r * 2);
        }
      }
    }
    g.restore();
  }

  return { sky, body, air, sunUp };
}
