/**
 * Style "intro2": the intro film (designer 2026-11-14). The Company's capital ship seen from
 * behind and above its starboard quarter, past it the huge curved horizon of the planet at
 * sunrise. The film opens close on the drives as they light, pulls back to show the whole ship
 * riding slowly (a slow rise and fall, a gentle roll), the lock closes on the point of
 * insertion, the name comes up, and the ship burns away towards the horizon.
 *
 * Everything is drawn on one 2D canvas: space, sun and planet (planet.ts), the ship as lit
 * blocks (mesh.ts, ship.ts), then its exhaust in layers: a white-hot core with shock diamonds,
 * a cyan plasma stream, and soft blue-white dust that swells and drifts back past the camera.
 * Every moving thing is worked out from the time alone, so any moment can be drawn by itself
 * (the still picture of reduced motion). Looks only; no game data.
 *
 * "full": about 10 seconds.  "short": 1.5 seconds, the burn away, for a returning player.
 */

import type { IntroScene } from "../types.js";
import { add, cameraAxes, camToWorld, clamp, cross, dot, ease, easeOut, lerp, mul, rng, seg, sub, TAU, unit, type Camera, type V3 } from "./math3.js";
import { createRenderer, type Drawn, type Lights, type Pose } from "./mesh.js";
import { createPlanet } from "./planet.js";
import { buildShip, SHIP_BOUNDS } from "./ship.js";

export const FULL_SECONDS = 10.4;
export const SHORT_SECONDS = 1.5;
/** When the lock starts to close, for the sound hook, and when the name comes up. */
export const LOCK_AT = 6.5;
export const TITLE_AT = 7.5;
/** The burn away. */
const BURN_AT = 9.3;
/** The drives light. */
const IGNITE_AT = 1.25;

const DEG = Math.PI / 180;
const ANGLE = 62 * DEG;

interface Shot {
  w: number;
  h: number;
  tall: boolean;
  axes: { r: V3; d: V3; f: V3 };
  focal: number;
  cx: number;
  cy: number;
  /** Camera space: the planet's centre, the sun, and the higher sun that lights the ground. */
  centre: V3;
  sun: V3;
  daylight: V3;
  /** How far the camera stands from the ship when the whole of it is in the picture. */
  far: number;
  lights: Lights;
}

/** The ship's box, for fitting it into the picture. */
const BOUNDS: V3[] = [];
for (const x of [SHIP_BOUNDS.x0, SHIP_BOUNDS.x1]) for (const y of [SHIP_BOUNDS.y0, SHIP_BOUNDS.y1]) for (const z of [-SHIP_BOUNDS.z, SHIP_BOUNDS.z]) BOUNDS.push([x, y, z]);
/** What the camera looks at once it has pulled back, and at the start (the drives). */
const LOOK_FAR: V3 = [-0.4, 0.7, 0];
const LOOK_NEAR: V3 = [-8.0, 0.2, 0.7];

function shot(w: number, h: number): Shot {
  const tall = h > w * 1.15;
  const focal = (tall ? 0.98 : 1.12) * Math.sqrt(w * h);
  // Astern and to starboard, a little above the deck; on a tall screen more from astern, so the ship runs up the picture.
  const axes = cameraAxes(tall ? 13 : 43, tall ? 24 : 16, tall ? 2 : 3);
  const cx = tall ? w * 0.5 : w * 0.56;
  const cy = tall ? h * 0.42 : h * 0.52;
  // The globe: its edge passes above the middle of the picture, falling away to the left.
  const above = Math.atan((cy - h * (tall ? 0.19 : 0.2)) / focal);
  const beta = ANGLE - above;
  const rho = (tall ? 4 : 9) * DEG;
  const centre: V3 = [Math.sin(beta) * Math.sin(rho), Math.sin(beta) * Math.cos(rho), Math.cos(beta)];
  // The sun: above the edge, up and to the right, where the ship is heading.
  const up = unit(sub([0, -1, 0], mul(centre, dot([0, -1, 0], centre))));
  const right = cross(centre, up);
  const phi = (tall ? 10 : 11.5) * DEG;
  const round = add(mul(up, Math.cos(phi)), mul(right, Math.sin(phi)));
  const at = (deg: number): V3 => unit(add(mul(centre, Math.cos(ANGLE + deg * DEG)), mul(round, Math.sin(ANGLE + deg * DEG))));
  const sun = at(tall ? 3.2 : 3.2);
  const daylight = at(17);
  // Far enough that the whole ship fits its share of the picture.
  const fits = (dist: number): boolean => {
    let x0 = 1e9;
    let x1 = -1e9;
    let y0 = 1e9;
    let y1 = -1e9;
    const pos = sub(LOOK_FAR, mul(axes.f, dist));
    for (const p of BOUNDS) {
      const q = sub(p, pos);
      const z = dot(q, axes.f);
      if (z < 0.5) return false;
      const x = (focal * dot(q, axes.r)) / z;
      const y = (focal * dot(q, axes.d)) / z;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    return x1 - x0 <= w * (tall ? 1.3 : 1.14) && y1 - y0 <= h * (tall ? 0.54 : 0.84);
  };
  let lo = 4;
  let hi = 80;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  const far = hi;
  // The sun on the ship (lifted a little so the decks catch it), and a cool light from the camera's side.
  const key = unit(add(camToWorld(axes, sun), [0, 0.5, 0]));
  const kick = unit(add(add(mul(axes.f, -1), mul(axes.r, 0.3)), mul(axes.d, -0.5)));
  const lights: Lights = {
    key,
    keyCol: [1.8, 1.42, 1.0],
    kick,
    kickCol: [0.25, 0.36, 0.52],
    amb: [0.1, 0.125, 0.175],
    engCol: [0.15, 0.48, 0.74],
    power: 1,
    fog: [0.07, 0.1, 0.16],
    fogNear: far * 0.72,
    fogFar: far * 1.75,
    fogMax: 0.5,
  };
  return { w, h, tall, axes, focal, cx, cy, centre, sun, daylight, far, lights };
}

/** A soft round light: white in the middle, a colour round it, nothing at the edge. */
function sprite(rgb: string, core: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  grd.addColorStop(0, core > 0 ? `rgb(255 255 255 / ${core})` : `rgb(${rgb} / 0.3)`);
  grd.addColorStop(0.18, `rgb(${rgb} / ${0.25 + core * 0.45})`);
  grd.addColorStop(0.5, `rgb(${rgb} / 0.16)`);
  grd.addColorStop(1, `rgb(${rgb} / 0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 96, 96);
  return c;
}
/** A cloud of dust: a few soft lumps, so that no two look quite round. */
function cloud(rgb: string, seed: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const R = rng(seed);
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 7; i++) {
    const x = 64 + (R() - 0.5) * 52;
    const y = 64 + (R() - 0.5) * 52;
    const r = 22 + R() * 22;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgb(${rgb} / 0.2)`);
    grd.addColorStop(0.5, `rgb(${rgb} / 0.08)`);
    grd.addColorStop(1, `rgb(${rgb} / 0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  return c;
}

interface Mote {
  /** Which drive, and which of the three kinds: 0 core spark, 1 plasma, 2 dust. */
  z: number;
  kind: number;
  life: number;
  phase: number;
  speed: number;
  /** Where round the stream it sits, how far out it wanders, how it curls. */
  ang: number;
  out: number;
  curl: number;
  spin: number;
  look: number;
}

export function createScene(): IntroScene {
  const R = rng(777);
  const cols = ["255 255 255", "196 226 255", "255 232 190", "214 220 255"];
  const stars = Array.from({ length: 460 }, () => ({ x: R(), y: R(), r: 0.35 + R() * R() * 1.5, ph: R() * TAU, sp: 0.6 + R() * 2, col: cols[Math.floor(R() * cols.length)]! }));
  const planet = createPlanet();
  const model = buildShip();
  const drawShip = createRenderer(model);
  let S: Shot | undefined;
  let hot: HTMLCanvasElement | undefined;
  let blue: HTMLCanvasElement | undefined;
  let gold: HTMLCanvasElement | undefined;
  let dustGlow: HTMLCanvasElement | undefined;
  let white: HTMLCanvasElement | undefined;
  let dust: HTMLCanvasElement[] = [];

  // Exhaust: every mote of every drive, each living its short life over and over.
  const motes: Mote[] = [];
  model.nozzles.forEach((nz, z) => {
    const big = nz.r / 0.55;
    const n = (k: number) => Math.max(2, Math.round(k * (0.35 + 0.65 * big)));
    for (const [kind, count, l0, l1, v0, v1] of [
      [0, n(9), 0.3, 0.55, 9, 13],
      [1, n(13), 0.9, 1.7, 4.5, 7],
      [2, n(18), 3.4, 6.5, 1.8, 3.4],
    ] as const)
      for (let i = 0; i < count; i++) motes.push({ z, kind, life: lerp(l0, l1, R()), phase: R(), speed: lerp(v0, v1, R()), ang: R() * TAU, out: R(), curl: R() * TAU, spin: R() * TAU, look: Math.floor(R() * 3) });
  });

  /** How hard the drives burn: idle, the light-up with its flash, cruise, then the burn away. */
  function power(t: number): number {
    const lit = seg(t, IGNITE_AT, IGNITE_AT + 0.9);
    const flash = Math.exp(-Math.pow((t - IGNITE_AT - 0.42) / 0.2, 2)) * 0.9;
    const burn = seg(t, BURN_AT, BURN_AT + 0.6);
    return 0.16 + 0.84 * ease(lit) + flash + 2.2 * burn * burn;
  }
  /** How far forward the ship has gone: a slow creep, then away. */
  function advance(t: number): number {
    const b = Math.max(0, t - BURN_AT);
    return 0.05 * t + 46 * b * b * b + 5 * b * b;
  }

  function backdrop(g: CanvasRenderingContext2D, w: number, h: number, t: number): void {
    const bg = g.createLinearGradient(0, 0, w * 0.3, h);
    bg.addColorStop(0, "#02040a");
    bg.addColorStop(0.5, "#050b16");
    bg.addColorStop(1, "#07101d");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "lighter";
    for (const s of stars) {
      const a = 0.35 + 0.65 * (0.6 + 0.4 * Math.sin(t * s.sp + s.ph));
      g.fillStyle = `rgb(${s.col} / ${(a * Math.min(1, s.r)).toFixed(3)})`;
      const r = Math.max(0.6, s.r);
      g.fillRect(s.x * w - r / 2, s.y * h - r / 2, r, r);
    }
    g.globalCompositeOperation = "source-over";
  }

  /** The sun over the edge of the planet: its glare, a streak, and the lens answering it. */
  function sunGlare(g: CanvasRenderingContext2D, sh: Shot): void {
    const [x, y] = planet.sunXY();
    const m = Math.min(sh.w, sh.h);
    g.globalCompositeOperation = "lighter";
    g.drawImage(gold!, x - m * 0.5, y - m * 0.5, m, m);
    g.drawImage(gold!, x - m * 0.2, y - m * 0.2, m * 0.4, m * 0.4);
    g.drawImage(white!, x - m * 0.1, y - m * 0.1, m * 0.2, m * 0.2);
    g.globalAlpha = 0.7;
    g.drawImage(white!, x - m * 0.75, y - 2, m * 1.5, 4);
    g.globalAlpha = 0.45;
    g.drawImage(gold!, x - m * 0.5, y - 9, m, 18);
    // Ghosts on the line through the middle of the picture.
    const gx = sh.w / 2 - x;
    const gy = sh.h / 2 - y;
    for (const [k, r, a] of [
      [0.5, 0.03, 0.16],
      [1.25, 0.05, 0.1],
      [1.7, 0.025, 0.16],
      [2.1, 0.09, 0.06],
    ] as const) {
      g.globalAlpha = a;
      g.drawImage(k > 1.5 ? blue! : gold!, x + gx * k - m * r, y + gy * k - m * r, m * r * 2, m * r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  /** The exhaust of every drive, over the ship. */
  function exhaust(g: CanvasRenderingContext2D, sh: Shot, view: Drawn, t: number, slide: (age: number) => number): void {
    g.globalCompositeOperation = "lighter";
    const pw = power(t);
    const streaks: [number, number, number][] = [];
    model.nozzles.forEach((nz, zi) => {
      const [x0, y0, z0, s0] = view.project(nz.p);
      if (z0 < 0.3) return;
      const flick = 0.93 + 0.05 * Math.sin(t * 43 + zi * 2.1) + 0.04 * Math.sin(t * 71 + zi);
      const r = nz.r;
      // The glow round the mouth.
      const glow = r * s0 * (1.9 + 2.2 * Math.min(2, pw)) * flick;
      g.globalAlpha = clamp(0.3 + 0.4 * pw);
      g.drawImage(blue!, x0 - glow, y0 - glow, glow * 2, glow * 2);
      g.globalAlpha = clamp(pw * 0.8);
      g.drawImage(hot!, x0 - glow * 0.34, y0 - glow * 0.34, glow * 0.68, glow * 0.68);
      streaks.push([x0, y0, r * s0 * pw]);
      // The stream: soft flames inside each other, each one long stretched light (the widest a second, wider one further back).
      for (const [len, wd, from, tex, a] of [
        [11, 2.6, 0.3, dustGlow!, 0.5],
        [7.5, 1.5, 0, blue!, 0.42],
        [5.0, 1.0, 0, blue!, 0.8],
        [3.1, 0.62, 0, hot!, 1],
      ] as const) {
        const L = len * r * (0.25 + 0.75 * Math.min(1.9, pw)) * flick;
        const [xa, ya, za, sa] = view.project([nz.p[0] - L * from, nz.p[1], nz.p[2]]);
        const [x1, y1, z1, s1] = view.project([nz.p[0] - L, nz.p[1], nz.p[2]]);
        if (z1 < 0.3 || za < 0.3) continue;
        const dx = x1 - xa;
        const dy = y1 - ya;
        const dl = Math.hypot(dx, dy) || 1;
        g.globalAlpha = clamp((0.15 + 0.85 * pw) * a);
        g.save();
        g.translate(xa + dx * 0.42, ya + dy * 0.42);
        g.rotate(Math.atan2(dy, dx));
        const half = wd * r * (sa + s1) * 0.5;
        g.drawImage(tex, -dl * 0.62, -half, dl * 1.24, half * 2);
        g.restore();
      }
      // Shock diamonds along the core.
      for (let k = 0; k < 5; k++) {
        const dd = (0.55 + k * 0.62 + 0.06 * Math.sin(t * 9 + k)) * r * (0.4 + 0.6 * Math.min(1.8, pw));
        const [x, y, z, s] = view.project([nz.p[0] - dd, nz.p[1], nz.p[2]]);
        if (z < 0.3) continue;
        const rr = r * s * (0.5 - k * 0.07) * flick;
        g.globalAlpha = clamp(pw * (0.75 - k * 0.13));
        g.drawImage(hot!, x - rr, y - rr, rr * 2, rr * 2);
      }
    });
    // The motes.
    for (const m of motes) {
      const nz = model.nozzles[m.z]!;
      const age = ((((t / m.life + m.phase) % 1) + 1) % 1) * m.life;
      const born = t - age;
      const pb = power(born);
      const k = age / m.life;
      const r = nz.r;
      // Back along the stream (slowing), and outwards as it cools.
      const back = m.speed * (0.6 + 0.4 * Math.min(1.6, pb)) * m.life * (k - 0.32 * k * k) + slide(age);
      const wide = r * (m.kind === 0 ? 0.22 : m.kind === 1 ? 0.3 + 0.9 * k : 0.4 + 2.6 * Math.pow(k, 0.8)) * (0.35 + 0.65 * m.out);
      const a = m.ang + (m.kind === 2 ? Math.sin(t * 0.5 + m.curl) * 0.9 : 0);
      const [x, y, z, s] = view.project([nz.p[0] - back, nz.p[1] + Math.cos(a) * wide + (m.kind === 2 ? 0.25 * r * Math.sin(t * 0.7 + m.curl) * k : 0), nz.p[2] + Math.sin(a) * wide]);
      if (z < 0.7) continue;
      const near = clamp((z - 0.7) / 3.5);
      const fade = (k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, m.kind === 2 ? 1.3 : 1.8)) * near;
      if (m.kind === 0) {
        const rr = r * s * (0.16 + 0.3 * k);
        g.globalAlpha = clamp(fade * pb * 0.55);
        g.drawImage(hot!, x - rr, y - rr, rr * 2, rr * 2);
      } else if (m.kind === 1) {
        const rr = r * s * (0.55 + 1.5 * k);
        g.globalAlpha = clamp(fade * pb * 0.5);
        g.drawImage(blue!, x - rr, y - rr, rr * 2, rr * 2);
      } else {
        const rr = r * s * (1.1 + 4.6 * k);
        if (rr > sh.w) continue;
        g.globalAlpha = clamp(fade * (0.25 + 0.75 * Math.min(1.5, pb)) * 0.85);
        g.save();
        g.translate(x, y);
        g.rotate(m.spin + t * 0.15 * (m.look - 1));
        g.drawImage(dust[m.look]!, -rr, -rr, rr * 2, rr * 2);
        g.restore();
      }
    }
    // The lens: one long streak through the brightest drive.
    const m = Math.min(sh.w, sh.h);
    const top = streaks.reduce((a, b) => (b[2] > a[2] ? b : a), [0, 0, 0] as [number, number, number]);
    if (top[2] > 0) {
      const wd = Math.min(sh.w * 0.8, top[2] * 9 + m * 0.06 * Math.min(2.5, pw));
      g.globalAlpha = clamp(0.08 + 0.22 * pw);
      g.drawImage(blue!, top[0] - wd, top[1] - 2.5, wd * 2, 5);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  /** Small craft about the ship (they show how big it is): a point of light each, a short tail behind. */
  function craft(g: CanvasRenderingContext2D, view: Drawn, t: number): void {
    g.globalCompositeOperation = "lighter";
    for (const [x0, y0, z0, vx, vy, vz, ph] of [
      [1.2, 0.0, 1.9, 0.55, 0.05, 0.42, 0],
      [5.5, 1.6, 4.2, 0.5, 0.0, 0.02, 3.1],
      [6.4, 1.9, 4.6, 0.5, 0.0, 0.02, 3.1],
      [-2.0, 2.6, -5.5, 0.9, -0.03, 0.1, 5.2],
    ] as const) {
      // Each flies its short way over and over, fading in and out at the ends.
      const life = 9;
      const a = (((t + ph) % life) + life) % life;
      const fade = Math.min(1, a / 1.2, (life - a) / 1.2);
      const [x, y, z, s] = view.project([x0 + vx * a, y0 + vy * a, z0 + vz * a]);
      const [xt, yt, zt] = view.project([x0 + vx * (a - 0.9), y0 + vy * (a - 0.9), z0 + vz * (a - 0.9)]);
      if (z < 1 || zt < 1) continue;
      const tail = g.createLinearGradient(x, y, xt, yt);
      tail.addColorStop(0, `rgb(150 235 255 / ${(0.8 * fade).toFixed(3)})`);
      tail.addColorStop(1, "rgb(60 150 255 / 0)");
      g.strokeStyle = tail;
      g.lineWidth = Math.max(0.8, 0.035 * s);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(xt, yt);
      g.stroke();
      const r = Math.max(1.6, 0.11 * s);
      g.globalAlpha = fade;
      g.drawImage(hot!, x - r * 2, y - r * 2, r * 4, r * 4);
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = "source-over";
  }

  /** The lock: brackets close on the point of insertion at the horizon, with its readout. */
  function lock(g: CanvasRenderingContext2D, sh: Shot, t: number, fade: number): void {
    const k = seg(t, LOCK_AT, LOCK_AT + 0.9);
    if (k <= 0 || fade <= 0) return;
    const tx = sh.w * (sh.tall ? 0.3 : 0.53);
    const ty = (planet.limbY(tx) ?? sh.h * 0.25) + Math.min(sh.w, sh.h) * 0.035;
    const back = 1 + 2.2 * Math.pow(1 - k, 3);
    const half = Math.min(sh.w, sh.h) * 0.055 * back;
    const arm = half * 0.32;
    g.save();
    g.globalAlpha = clamp(k * 3) * fade;
    g.strokeStyle = "#d9fbff";
    g.fillStyle = "#e9fdff";
    g.shadowColor = "rgb(0 18 40 / 0.95)";
    g.shadowBlur = 7;
    g.lineWidth = 2;
    g.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      g.moveTo(tx + sx * half, ty + sy * (half - arm));
      g.lineTo(tx + sx * half, ty + sy * half);
      g.lineTo(tx + sx * (half - arm), ty + sy * half);
    }
    g.stroke();
    // A turning diamond inside, and the mark of the point itself.
    g.lineWidth = 1.2;
    g.translate(tx, ty);
    g.rotate(t * 0.9);
    g.beginPath();
    const dm = half * 0.62;
    g.moveTo(0, -dm);
    g.lineTo(dm, 0);
    g.lineTo(0, dm);
    g.lineTo(-dm, 0);
    g.closePath();
    g.stroke();
    g.rotate(-t * 0.9);
    g.fillStyle = "#fde68a";
    g.beginPath();
    g.arc(0, 0, 2.6, 0, TAU);
    g.fill();
    g.translate(-tx, -ty);
    // The readout, once the brackets are shut: to the left of them (the title sits below).
    const on = seg(k, 0.75, 1);
    if (on > 0) {
      g.globalAlpha = on * fade;
      g.shadowBlur = 4;
      const fs = Math.max(11, Math.min(15, Math.min(sh.w, sh.h) * 0.018));
      g.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      g.textBaseline = "top";
      const range = Math.round(lerp(18400, 420, easeOut(seg(t, LOCK_AT, BURN_AT + 0.6))));
      const rows = ["ORBIT LOCK", `RANGE  ${range.toLocaleString("en-US").replace(/,/g, " ")} km`, "VECTOR  STABLE", "INSERTION  GO"];
      const wide = Math.max(...rows.map((s) => g.measureText(s).width));
      let x = tx - half - 14 - wide;
      let y = ty - half;
      if (x < 10) {
        x = clamp(tx - wide / 2, 10, sh.w - wide - 10);
        y = ty + half + 10;
      }
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(tx - half - 4, ty - half + fs * 0.6);
      g.lineTo(x + wide + 4, ty - half + fs * 0.6);
      if (x + wide < tx - half) g.stroke();
      rows.forEach((s, i) => {
        g.fillStyle = i === 0 ? "#fde68a" : "#e9fdff";
        g.fillText(s, x, y + i * fs * 1.45);
      });
    }
    g.restore();
  }

  return {
    draw(g, w, h, time, mode) {
      // No picture to draw on (the intro is just being taken off the page): nothing to do.
      if (!(w >= 2 && h >= 2)) return;
      if (!S || S.w !== w || S.h !== h) {
        S = shot(w, h);
        const x: V3 = [1, 0, 0];
        planet.layout({ w, h, focal: S.focal, cx: S.cx, cy: S.cy, centre: S.centre, sun: S.sun, daylight: S.daylight, ahead: [dot(x, S.axes.r), dot(x, S.axes.d), dot(x, S.axes.f)], angle: ANGLE });
      }
      const sh = S;
      hot ??= sprite("150 240 255", 1);
      blue ??= sprite("60 150 255", 0.35);
      gold ??= sprite("255 190 110", 0.5);
      dustGlow ??= sprite("90 140 255", 0);
      white ??= sprite("255 214 150", 1);
      if (!dust.length) dust = [cloud("150 200 255", 11), cloud("190 215 255", 23), cloud("170 180 255", 37)];
      // The short film is the end of the long one: the ship already there, then the burn away.
      const t = mode === "short" ? BURN_AT - 0.35 + time * ((FULL_SECONDS - BURN_AT + 0.35) / SHORT_SECONDS) : time;
      planet.work(mode === "short" || t > 0.9 ? 1e9 : 8);

      // The camera: close on the drives at first, then back until the whole ship is in the picture; a slow drift after.
      const u = mode === "short" ? 1 : ease(seg(t, 1.5, 5.4));
      const look: V3 = [lerp(LOOK_NEAR[0], LOOK_FAR[0], u), lerp(LOOK_NEAR[1], LOOK_FAR[1], u), lerp(LOOK_NEAR[2], LOOK_FAR[2], u)];
      const dist = lerp(sh.far * 0.36, sh.far, u) * (1 - 0.03 * seg(t, 5, BURN_AT));
      const truck = 0.35 * (seg(t, 0, FULL_SECONDS) - 0.6);
      const pos = add(sub(look, mul(sh.axes.f, dist)), mul(sh.axes.r, truck));
      const cam: Camera = { pos, r: sh.axes.r, d: sh.axes.d, f: sh.axes.f, focal: sh.focal, cx: sh.cx, cy: sh.cy };
      // The ship: a slow rise and fall, a gentle roll; then away.
      const go = advance(t);
      const pose: Pose = { pos: [go, 0.13 * Math.sin(t * 0.52), 0.05 * Math.sin(t * 0.31 + 1)], roll: 1.7 * DEG * Math.sin(t * 0.4 + 0.6), pitch: 0.55 * DEG * Math.sin(t * 0.29) + 2.5 * DEG * seg(t, BURN_AT, FULL_SECONDS), yaw: 0.35 * DEG * Math.sin(t * 0.23 + 2) };
      const pw = power(t);

      backdrop(g, w, h, t);
      sunGlare(g, sh);
      planet.draw(g, t);
      const lights: Lights = { ...sh.lights, power: Math.min(1.35, pw) };
      const view = drawShip(g, cam, pose, lights, t);
      if (t < BURN_AT + 0.3) craft(g, view, t);
      // A mote born `age` ago was left behind by all the ship has moved since.
      exhaust(g, sh, view, t, (age) => go - advance(t - age));

      const burn = seg(t, BURN_AT, FULL_SECONDS);
      if (mode === "full") lock(g, sh, t, 1 - seg(t, BURN_AT, BURN_AT + 0.5));
      // Under the name, once it is up (and all through the short film): the foot of the picture a little darker.
      const foot = mode === "short" ? 1 : seg(t, TITLE_AT - 0.3, TITLE_AT + 0.5);
      if (foot > 0) {
        const fg = g.createLinearGradient(0, h * 0.58, 0, h);
        fg.addColorStop(0, "rgb(2 6 14 / 0)");
        fg.addColorStop(1, `rgb(2 6 14 / ${(0.62 * foot).toFixed(3)})`);
        g.fillStyle = fg;
        g.fillRect(0, h * 0.58, w, h * 0.42);
      }
      // The edges of the picture a little darker.
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.62);
      vg.addColorStop(0, "rgb(0 0 0 / 0)");
      vg.addColorStop(1, "rgb(0 0 0 / 0.55)");
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      // Opening from black; the burn washes the picture out into the command deck.
      const open = mode === "short" ? 1 - seg(time, 0, 0.18) : 1 - seg(t, 0, 1.1);
      if (open > 0) {
        g.fillStyle = `rgb(2 4 10 / ${open.toFixed(3)})`;
        g.fillRect(0, 0, w, h);
      }
      if (burn > 0) {
        g.fillStyle = `rgb(170 232 255 / ${(burn * burn * 0.6).toFixed(3)})`;
        g.fillRect(0, 0, w, h);
      }
    },
  };
}
