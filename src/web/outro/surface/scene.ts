/**
 * Surface Terraform: the film (designer 2026-11-19). It goes on from Terraformer 2.0: the pylons
 * have come down; now the camera stands on the planet's surface at the near end of a rugged,
 * barren valley, looking across it to the horizon.
 *
 *   Act 1  the wasteland under a thick toxic amber-grey sky, ash blowing, red lightning. Three
 *          terraformer spires (the pylons of 2.0, drawn by the same rig.ts) stand anchored in the
 *          rock, on the horizon and in the middle distance; one by one their radiator wings flare
 *          open and they fire cyan-emerald beams straight up into the storm.
 *   Act 2  where the beams pierce the clouds a clear-sky vortex turns and opens (sky.ts), pushing
 *          the storm back to the horizon: a deep cerulean sky, the alien sun, two moons. Rain and
 *          bright mist fall through the valley; golden sunlight breaks onto the ridges.
 *   Act 3  from the spires' feet water fills the dry canyon beds and pools, and green, teal and
 *          glowing life spreads over the rock like a tide (layers.ts); flocks of sky creatures
 *          glide in.
 *   Act 4  a slow panoramic drift over the living valley, the spires humming on the horizon; the
 *          Debrief card slides in beside it (the picture turns so the valley stays in the open part).
 *
 * Drawn on one 2D canvas in layers, far to near, each moved by the camera's slow sideways drift
 * as much as its distance asks (parallax). Every moving thing is worked out from the time alone,
 * so any moment can be drawn by itself. Looks only.
 */

import { clamp, ease, easeOut, lerp, rng, seg, smooth, TAU, unit, type V3 } from "../../briefing/styles/intro2/math3.js";
import { flameSprite, mixRgb, softSprite } from "../terraformer/pylon.js";
import { track } from "../terraformer/view.js";
import type { CompanyTheme } from "../types.js";
import { drawRig, RIG_RADIUS, type RigSprites, type RigState } from "../terraformer2/rig.js";
import { createValley, drawMix, layerState, volcanoTop, VOLCANO_U, type Layer, type Valley } from "./layers.js";
import { createSky } from "./sky.js";
import { CLIMB, FLARE, FLARE_AT, FLOCKS_AT, fireTimes, RAIN, SUN_AT } from "./timeline.js";
import { bloomAt, BURY, CEIL, HC, poolAt, POOL_DEFS, project, SPIRE_PLACES, streamPaths, waterReach, type View } from "./world.js";

/** The part of the picture the Debrief card leaves open, CSS px: the valley is kept inside it. */
export interface FreeArea {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface SurfaceScene {
  /** Draw film time t (seconds at Normal speed; past the film's end the slow drift goes on). `quality` 0.45..1: softer on a slow machine. */
  draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, free?: FreeArea, quality?: number): void;
  /** Make the living pictures a little at a time (once a frame, before draw); `budget` ms. */
  prepare(budget: number): void;
}
export interface SceneSetup {
  theme: CompanyTheme;
  vesselId: string;
}

/** The horizon's height in the picture (a share of its height), wide and tall pictures: [time, share]. */
const HY_WIDE = [
  [0, 0.6],
  [2.6, 0.61],
  [4.6, 0.71],
  [6.1, 0.69],
  [7.8, 0.565],
  [10, 0.58],
] as const;
const HY_TALL = [
  [0, 0.5],
  [2.6, 0.51],
  [4.6, 0.62],
  [6.1, 0.6],
  [7.8, 0.47],
  [10, 0.48],
] as const;
/** The largest sideways drift of the camera (km) and turn of the picture (focal lengths): the layers are made this much wider. */
const DRIFT_MAX = 0.16;
const PAN_MAX = 0.3;

/** The camera's slow sideways drift, km: a little across the valley in the film, then gently to and fro. */
function camXAt(t: number): number {
  return -0.07 + 0.11 * ease(seg(t, 0, 10.5)) + 0.08 * Math.sin(Math.max(0, t - 10.5) * 0.12);
}

/** A fixed pseudo-random number 0..1 for a few integers (looks only). */
function hash(a: number, b: number, c: number): number {
  const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

const SPOT_RGB = ["120 255 230", "190 140 255", "210 255 120", "255 170 230"] as const;

interface Dot {
  /** World place (floor dots) or board place (u, v on the board `layer`). */
  X: number;
  Y: number;
  Z: number;
  u: number;
  v: number;
  layer: Layer["id"] | undefined;
  at: number;
  k: number;
  s: number;
  ph: number;
  sp: number;
}

export function createSurfaceScene(o: SceneSetup): SurfaceScene {
  const { theme } = o;
  const R = rng(1919);
  const hyWide = track(HY_WIDE);
  const hyTall = track(HY_TALL);
  const sky = createSky();
  const fire = fireTimes();
  let valley: Valley | undefined;
  let built = { U: 0, vmax: 0, R: 0 };
  let prepared = false;
  let tmp: HTMLCanvasElement | undefined;
  let sprites: RigSprites | undefined;
  let glows: HTMLCanvasElement[] = [];
  let foam: HTMLCanvasElement | undefined;
  let beamHalo: HTMLCanvasElement | undefined;
  let flare: HTMLCanvasElement | undefined;
  let boardDots: Dot[] = [];
  const P: [number, number] = [0, 0];

  // ---- Things that only depend on the valley, made once.
  const floorDots: Dot[] = Array.from({ length: 170 }, () => {
    const v = 0.008 + 0.4 * Math.pow(R(), 0.8);
    const Z = HC / v;
    const X = (R() * 2 - 1) * 1.1 * Z;
    return { X, Y: 0.003, Z, u: 0, v: 0, layer: undefined, at: bloomAt(X, Z) + 0.12, k: Math.floor(R() * 4), s: 0.004 + 0.008 * R(), ph: R() * TAU, sp: 0.8 + R() * 1.6 };
  });
  const rain = Array.from({ length: 180 }, () => ({ x: R(), ph: R(), sp: 1.25 + R() * 0.7, len: 0.025 + R() * 0.03, z: 0.35 + R() * 0.65, gold: R() < 0.22 }));
  const dust = Array.from({ length: 80 }, () => ({ x: R(), y: 0.3 + R() * 0.66, sp: 0.16 + R() * 0.3, len: 8 + R() * 34, z: 0.3 + R() * 0.7 }));
  const motes = SPIRE_PLACES.map(() => Array.from({ length: 12 }, () => ({ ph: R(), sp: 0.35 + R() * 0.4, side: R() * TAU })));
  const mistBands = Array.from({ length: 6 }, (_, i) => ({ Z: 1.6 + i * 2.1 + R(), Y: 0.04 + R() * 0.12, u: R() * 3 - 1.5, sp: (0.004 + R() * 0.006) * (R() < 0.5 ? -1 : 1), wide: 0.45 + R() * 0.4 }));
  const FLOCKS = [
    { C: [-1.2, 1.25, 6.5], A: [2.3, 0.22, 1.8], w: 0.12, ph: 0.4, n: 9, from: -1 },
    { C: [2.1, 0.9, 5.2], A: [1.5, 0.18, 1.2], w: -0.15, ph: 2.2, n: 7, from: 1 },
    { C: [-3.2, 2.0, 11.5], A: [3.0, 0.3, 2.4], w: 0.085, ph: 4.1, n: 11, from: -1 },
  ];
  const flock = FLOCKS.map((f) => Array.from({ length: f.n }, (_, m) => {
    const row = Math.ceil(m / 2);
    const side = m === 0 ? 0 : m % 2 ? 1 : -1;
    return { dx: side * row * 0.07 + (R() - 0.5) * 0.03, dy: (R() - 0.5) * 0.05, dz: row * 0.06 + (R() - 0.5) * 0.04, ph: R() * TAU, beat: 4.5 + R() * 2.5, span: 0.075 + R() * 0.04 };
  }));

  /** The board dots: glowing flowers on the ridges and the near rocks, placed once the boards are made. */
  function placeBoardDots(v: Valley): void {
    const Rb = rng(733);
    boardDots = [];
    for (const l of v.layers) {
      if (l.kind !== "board" || !l.top) continue;
      const n = l.id === "near" ? 60 : 90;
      for (let i = 0; i < n; i++) {
        const u = l.u0 + Rb() * (l.u1 - l.u0);
        const top = l.top(u);
        const base = HC / l.Z;
        if (top >= base - 0.002) continue;
        const vv = top + (base - top) * (0.15 + 0.85 * Math.pow(Rb(), 0.6));
        const Y = Math.max(0, HC - vv * l.Z);
        const at = bloomAt(u * l.Z, l.Z) + Y * (l.id === "near" ? 3.2 : 1.7) + 0.2;
        boardDots.push({ X: 0, Y: 0, Z: l.Z, u, v: vv, layer: l.id, at, k: Math.floor(Rb() * 4), s: (l.id === "near" ? 0.0022 : 0.0016) * (0.6 + Rb()), ph: Rb() * TAU, sp: 0.8 + Rb() * 1.5 });
      }
    }
  }

  function viewAt(t: number, w: number, h: number, free: FreeArea | undefined, nudge: number): View {
    const tall = h > w * 1.15;
    const f = 1.1 * Math.min(h, w * 1.2);
    let hy = (tall ? hyTall(t) : hyWide(t))[0]! * h;
    let pan = 0;
    const k4 = ease(seg(t, 10.0, 12.2));
    if (free && k4 > 0) {
      const foot = free.h < h * 0.75;
      const fx = free.x + free.w / 2;
      hy = lerp(hy, free.y + free.h * (foot ? 0.7 : 0.6), k4);
      pan = lerp(0, (w / 2 - fx) / f, k4);
    }
    // The sweeping drift of the living world.
    pan += 0.035 * Math.sin(Math.max(0, t - 10.5) * 0.07) * smooth(10, 13, t);
    return { w, h, f, cx: w / 2 + nudge * 2.5 * Math.sin(t * 41), hy: hy + nudge * 2 * Math.cos(t * 33), camX: camXAt(t), pan };
  }

  /** Make (or make again, for a much bigger or sharper picture) the painted layers. */
  function ensureValley(w: number, h: number, scale: number, t: number): void {
    const tall = h > w * 1.15;
    const f = 1.1 * Math.min(h, w * 1.2);
    const track = tall ? HY_TALL : HY_WIDE;
    // Where the horizon may go when the Debrief comes (outro.css: the card stands at the side from 700 px wide and 5:4, else along the foot).
    const side = w >= 700 && w >= h * 1.25;
    const hyMin = Math.min(...track.map((k) => k[1]), side ? 0.5 : 0.27) * h;
    const U = w / (2 * f) + PAN_MAX + 0.03;
    const vmax = (h - hyMin) / f + 0.03;
    const Rn = f * scale;
    if (valley && U <= built.U + 1e-6 && vmax <= built.vmax + 1e-6 && Rn < built.R * 1.4 && Rn > built.R * 0.6) return;
    built = { U: Math.max(U, valley ? built.U : 0), vmax: Math.max(vmax, valley ? built.vmax : 0), R: Rn };
    valley = createValley(built.U, built.vmax, Rn);
    prepared = false;
    placeBoardDots(valley);
    let tw = 1;
    let th = 1;
    for (const l of valley.layers) {
      tw = Math.max(tw, l.lw);
      th = Math.max(th, l.lh);
    }
    tmp = document.createElement("canvas");
    tmp.width = tw;
    tmp.height = th;
    if (t > 6.2) prepared = valley.prepare(Infinity);
  }

  // ---- A layer, moved by the drift as much as its distance asks.
  function drawLayer(g: CanvasRenderingContext2D, l: Layer, v: View, t: number, crestK: number): void {
    const k = v.f / l.R;
    g.save();
    if (l.kind === "floor") g.transform(k, 0, (-v.f * v.camX) / (HC * l.R), k, v.cx + v.f * (l.u0 - v.pan) - (v.f * v.camX * l.v0) / HC, v.hy + v.f * l.v0);
    else g.transform(k, 0, 0, k, v.cx + v.f * (l.u0 - v.camX / l.Z - v.pan), v.hy + v.f * l.v0);
    if (l.id === "far") {
      g.drawImage(l.barren, 0, 0);
      const a = smooth(8.4, 10.4, t);
      if (l.lush && a > 0) {
        g.globalAlpha = a;
        g.drawImage(l.lush, 0, 0);
        g.globalAlpha = 1;
      }
    } else {
      const st = layerState(l, t);
      if (st === "lush") g.drawImage(l.lush!, 0, 0);
      else if (st === "mix" && tmp) drawMix(g, l, t, tmp);
      else g.drawImage(l.barren, 0, 0);
    }
    if (l.crest && crestK > 0.01) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = crestK;
      g.drawImage(l.crest, 0, 0);
    }
    g.restore();
  }

  // ---- Glowing flowers: they light as the tide reaches them, then breathe.
  function drawDots(g: CanvasRenderingContext2D, v: View, t: number, dots: Dot[], layer: Layer["id"] | undefined): void {
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const d of dots) {
      if (d.layer !== layer || t <= d.at) continue;
      const k = easeOut(seg(t, d.at, d.at + 0.6));
      let x: number;
      let y: number;
      if (layer) {
        x = v.cx + v.f * (d.u - v.camX / d.Z - v.pan);
        y = v.hy + v.f * d.v;
      } else {
        project(v, d.X, d.Y, d.Z, P);
        x = P[0];
        y = P[1];
      }
      if (x < -20 || x > v.w + 20 || y < -20 || y > v.h + 20) continue;
      const pop = Math.exp(-(t - d.at) * 4);
      const r = clamp((v.f * d.s) / d.Z, 1, 9) * (1 + 1.6 * pop) * (0.7 + 0.3 * k);
      g.globalAlpha = k * (0.5 + 0.35 * Math.sin(t * d.sp + d.ph)) + pop * 0.5;
      g.drawImage(glows[d.k]!, x - r * 2, y - r * 2, r * 4, r * 4);
    }
    g.restore();
  }

  // ---- The water: canyon beds filling from the spires' feet, then pools and the lake.
  function drawWater(g: CanvasRenderingContext2D, v: View, t: number): void {
    const paths = streamPaths();
    const L: [number, number][] = [];
    const Rt: [number, number][] = [];
    for (let k = 0; k < paths.length; k++) {
      const p = paths[k]!;
      const reach = waterReach(k, t);
      if (reach <= 0.01) continue;
      L.length = 0;
      Rt.length = 0;
      let tip: [number, number] | undefined;
      let tipW = 0;
      for (let j = 0; j < p.x.length; j++) {
        let s = p.s[j]!;
        let x = p.x[j]!;
        let z = p.z[j]!;
        const last = s >= reach;
        if (last && j > 0) {
          // The front: between this sample and the one before.
          const a = (reach - p.s[j - 1]!) / Math.max(1e-6, s - p.s[j - 1]!);
          x = lerp(p.x[j - 1]!, x, a);
          z = lerp(p.z[j - 1]!, z, a);
          s = reach;
        }
        if (z < 0.12) break;
        const taper = Math.sqrt(clamp((reach - s) / 0.14 + 0.15));
        const wd = lerp(p.def.w0, p.def.w1, s / p.length) * taper * 0.5;
        const l = project(v, x + p.nx[j]! * wd, 0, z + p.nz[j]! * wd, [0, 0]);
        const r = project(v, x - p.nx[j]! * wd, 0, z - p.nz[j]! * wd, [0, 0]);
        L.push(l);
        Rt.push(r);
        tip = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2];
        tipW = (v.f * wd * 2) / z;
        if (last) break;
      }
      if (L.length < 2) continue;
      const grd = g.createLinearGradient(0, v.hy, 0, v.h);
      grd.addColorStop(0, "rgb(206 236 248)");
      grd.addColorStop(0.12, "rgb(120 196 236)");
      grd.addColorStop(0.5, "rgb(40 126 196)");
      grd.addColorStop(1, "rgb(22 86 150)");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(L[0]![0], L[0]![1]);
      for (let i = 1; i < L.length; i++) g.lineTo(L[i]![0], L[i]![1]);
      for (let i = Rt.length - 1; i >= 0; i--) g.lineTo(Rt[i]![0], Rt[i]![1]);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgb(12 60 72 / 0.55)";
      g.lineWidth = 1;
      g.stroke();
      // Ripples of light across it, flickering as the water runs: short streaks scattered over its width.
      g.save();
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = "rgb(226 246 255)";
      g.lineCap = "round";
      for (let i = 1; i < L.length - 1; i++) {
        const wide = Math.hypot(L[i]![0] - Rt[i]![0], L[i]![1] - Rt[i]![1]);
        const n = Math.min(7, 1 + Math.floor(wide / 7));
        for (let q = 0; q < n; q++) {
          const h1 = hash(i, q, k);
          const h2 = hash(i + 0.5, q + 3, k);
          const fl = 0.5 + 0.5 * Math.sin(t * (2.4 + 2 * h2) - i * 0.9 + h1 * 9);
          const al = 0.34 * fl * fl * fl * fl;
          if (al < 0.02) continue;
          const o = 0.12 + 0.76 * h1;
          const at = 0.1 + 0.6 * h2;
          const ln = 0.18 + 0.2 * hash(i, q + 7, k);
          const ax = lerp(L[i]![0], Rt[i]![0], o);
          const ay = lerp(L[i]![1], Rt[i]![1], o);
          const bx = lerp(L[i + 1]![0], Rt[i + 1]![0], o);
          const by = lerp(L[i + 1]![1], Rt[i + 1]![1], o);
          g.globalAlpha = al;
          g.lineWidth = Math.max(0.5, wide * 0.03);
          g.beginPath();
          g.moveTo(lerp(ax, bx, at), lerp(ay, by, at));
          g.lineTo(lerp(ax, bx, at + ln), lerp(ay, by, at + ln));
          g.stroke();
        }
      }
      g.globalAlpha = 1;
      // Glints.
      for (let i = 3; i < L.length; i += 6) {
        const gl = Math.pow(0.5 + 0.5 * Math.sin(t * 7 + i * 1.7 + k), 14);
        if (gl < 0.05) continue;
        g.globalAlpha = gl;
        const x = (L[i]![0] + Rt[i]![0]) / 2;
        const y = (L[i]![1] + Rt[i]![1]) / 2;
        g.drawImage(foam!, x - 3, y - 3, 6, 6);
      }
      // The bright front while it runs.
      if (tip && reach < p.length - 0.01) {
        const r = Math.max(3, tipW * 2.2);
        g.globalAlpha = 0.9;
        g.drawImage(foam!, tip[0] - r, tip[1] - r * 0.6, r * 2, r * 1.2);
      }
      g.restore();
    }
    for (let i = 0; i < POOL_DEFS.length; i++) {
      const pd = POOL_DEFS[i]!;
      const fill = easeOut(seg(t, poolAt(i), poolAt(i) + 1.0));
      if (fill <= 0) continue;
      project(v, pd.X, 0, pd.Z, P);
      const rx = (v.f * pd.r * (0.25 + 0.75 * fill)) / pd.Z;
      const ry = Math.max(1, (rx * HC) / pd.Z);
      g.save();
      g.translate(P[0], P[1]);
      g.scale(1, ry / rx);
      const grd = g.createRadialGradient(0, -rx * 0.25, 0, 0, 0, rx);
      grd.addColorStop(0, "rgb(206 236 250)");
      grd.addColorStop(0.5, "rgb(96 172 224)");
      grd.addColorStop(0.86, "rgb(34 108 170)");
      grd.addColorStop(1, "rgb(34 108 170 / 0)");
      g.globalAlpha = Math.min(1, fill * 1.6);
      g.fillStyle = grd;
      g.beginPath();
      g.arc(0, 0, rx, 0, TAU);
      g.fill();
      // The far shore catches the light of the sky.
      g.strokeStyle = "rgb(230 248 255 / 0.35)";
      g.lineWidth = 1.5 * (rx / ry);
      g.beginPath();
      g.arc(0, 0, rx * 0.9, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
      // Ripples.
      g.globalCompositeOperation = "lighter";
      for (let q = 0; q < 2; q++) {
        const ph = (t * 0.35 + q * 0.5 + i * 0.3) % 1;
        g.strokeStyle = `rgb(220 246 255 / ${(0.12 * (1 - ph) * fill).toFixed(3)})`;
        g.beginPath();
        g.arc(rx * 0.1, 0, rx * 0.85 * ph, 0, TAU);
        g.stroke();
      }
      g.restore();
    }
  }

  // ---- A spire: the 2.0 pylon standing anchored in the rock.
  function spireState(i: number, t: number, sunK: number): RigState {
    const a = FLARE_AT[i]!;
    return {
      spin: SPIRE_PLACES[i]!.spin,
      open: lerp(0.32, 1, easeOut(seg(t, a, a + FLARE))),
      thrust: 0,
      power: 0.35 + 0.65 * smooth(a - 0.3, a + 0.2, t),
      keyK: lerp(0.5, 0.95, sunK),
      keyRgb: mixRgb("206 178 160", "255 230 200", sunK),
      sheath: 0,
      emit: smooth(fire[i]! - 0.3, fire[i]! + 0.05, t) * (0.85 + 0.15 * Math.sin(t * 5 + i)),
      t,
    };
  }
  const STORM_KEY: V3 = unit([0.8, 0.35, -0.5]);
  const SUN_KEY: V3 = unit([0.27, -0.2, 1]);
  function drawSpire(g: CanvasRenderingContext2D, v: View, i: number, t: number, sunK: number): void {
    const s = SPIRE_PLACES[i]!;
    const L = s.L;
    const ground = v.hy + (v.f * HC) / s.Z;
    const px = (v.f * L) / s.Z;
    const at = (hh: number, x: number, y: number): [number, number] => project(v, s.X + x * L, (hh - BURY) * L, s.Z + y * L, [0, 0]);
    const vw = unit([HC - (0.5 - BURY) * L, v.camX - s.X, -s.Z]);
    const key = unit([lerp(STORM_KEY[0], SUN_KEY[0], sunK), lerp(STORM_KEY[1], SUN_KEY[1], sunK), lerp(STORM_KEY[2], SUN_KEY[2], sunK)]);
    const st = spireState(i, t, sunK);
    g.save();
    g.beginPath();
    g.rect(-1e4, -1e4, 3e4, ground + 1e4);
    g.clip();
    drawRig(g, { at, view: vw, key, px }, st, theme, sprites!);
    g.restore();
    // Anchored deep in the rock: a broken mound round its foot, glowing seams where it holds.
    project(v, s.X, 0, s.Z, P);
    const bx = P[0];
    const rr = RIG_RADIUS * px * 1.55;
    const green = smooth(bloomAt(s.X, s.Z), bloomAt(s.X, s.Z) + 0.6, t);
    const R2 = rng(i * 31 + 7);
    g.fillStyle = `rgb(${lerp(34, 22, green) | 0} ${lerp(24, 70, green) | 0} ${lerp(22, 50, green) | 0})`;
    g.beginPath();
    g.moveTo(bx - rr * 1.6, ground + 1);
    for (let k = 0; k <= 10; k++) {
      const a = k / 10;
      const hgt = Math.sin(a * Math.PI) * rr * (0.22 + 0.16 * R2());
      g.lineTo(bx - rr * 1.6 + a * rr * 3.2, ground - hgt);
    }
    g.lineTo(bx + rr * 1.6, ground + 1);
    g.closePath();
    g.fill();
    g.save();
    g.globalCompositeOperation = "lighter";
    const pw = st.power * (0.75 + 0.25 * Math.sin(t * 3.1 + i));
    g.strokeStyle = `rgb(${theme.primary} / ${(0.55 * pw).toFixed(3)})`;
    g.lineWidth = Math.max(0.8, px * 0.006);
    g.beginPath();
    g.ellipse(bx, ground - rr * 0.12, rr * 0.75, Math.max(0.8, rr * 0.14), 0, 0, TAU);
    g.stroke();
    // Seams of light out into the ground.
    g.strokeStyle = `rgb(100 255 214 / ${(0.4 * pw).toFixed(3)})`;
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + i;
      const len = rr * (1.4 + R2() * 1.6);
      g.moveTo(bx + Math.cos(a) * rr * 0.7, ground + Math.sin(a) * rr * 0.1);
      g.lineTo(bx + Math.cos(a) * len, ground + Math.sin(a) * len * 0.1 + rr * 0.03);
    }
    g.stroke();
    g.restore();
  }

  // ---- A beam: from the emitter straight up through the deck, and on into the clear sky.
  function drawBeam(g: CanvasRenderingContext2D, v: View, i: number, t: number): void {
    const s = SPIRE_PLACES[i]!;
    const since = t - fire[i]!;
    if (since <= 0) return;
    const y0w = (1 - BURY) * s.L;
    const grow = easeOut(clamp(since / CLIMB));
    const deck = y0w + (CEIL - y0w) * grow;
    const above = grow >= 1 ? (1 - sky.coverOver(i, t)) * 10 : 0;
    const x = project(v, s.X, y0w, s.Z, P)[0];
    const yA = P[1];
    const yB = project(v, s.X, deck, s.Z, P)[1];
    const yC = project(v, s.X, CEIL + above, s.Z, P)[1];
    const unitW = clamp((v.f * 0.03) / s.Z, 1.2, 9);
    const power = (1 + 1.3 * Math.exp(-since * 2.2)) * (0.9 + 0.1 * Math.sin(t * 7 + i * 2));
    g.save();
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    const layers = [
      [7, "30 190 150", 0.08],
      [3.2, "60 230 190", 0.18],
      [1.4, "130 250 225", 0.45],
      [0.5, "235 255 250", 0.95],
    ] as const;
    for (const [wide, rgb, al] of layers) {
      g.lineWidth = wide * unitW;
      const grd = g.createLinearGradient(0, yA, 0, yB);
      grd.addColorStop(0, `rgb(${rgb} / ${clamp(al * power).toFixed(3)})`);
      grd.addColorStop(1, `rgb(${rgb} / ${clamp(al * power * 0.75).toFixed(3)})`);
      g.strokeStyle = grd;
      g.beginPath();
      g.moveTo(x, yA);
      g.lineTo(x, yB);
      g.stroke();
      if (above > 0.05) {
        const g2 = g.createLinearGradient(0, yB, 0, yC);
        g2.addColorStop(0, `rgb(${rgb} / ${clamp(al * power * 0.75).toFixed(3)})`);
        g2.addColorStop(1, `rgb(${rgb} / 0)`);
        g.strokeStyle = g2;
        g.beginPath();
        g.moveTo(x, yB);
        g.lineTo(x, yC);
        g.stroke();
      }
    }
    // Sparks of light running up it.
    for (const m of motes[i]!) {
      const k = (((t * m.sp + m.ph) % 1) + 1) % 1;
      const y = lerp(yA, Math.min(yB, yA - 1), k);
      const off = unitW * 1.2 * Math.sin(m.side + t * 3);
      const r = unitW * 1.4 * (1 - k * 0.6);
      g.globalAlpha = (1 - k) * 0.85;
      g.drawImage(beamHalo!, x + off - r * 2, y - r * 2, r * 4, r * 4);
    }
    // The flash where it leaves the emitter, and where it meets the deck.
    const burst = Math.exp(-since * 3.5);
    if (burst > 0.02) {
      const r = unitW * 18 * (0.6 + burst);
      g.globalAlpha = burst;
      g.drawImage(flare!, x - r, yA - r, r * 2, r * 2);
    }
    const hit = t - fire[i]! - CLIMB;
    if (hit > 0 && hit < 1.6) {
      const k = Math.exp(-hit * 2.2) * (1 - smooth(0.6, 1.6, hit) * 0.3);
      const r = unitW * 12;
      g.globalAlpha = k * 0.8;
      g.drawImage(flare!, x - r * 1.2, yB - r * 0.35, r * 2.4, r * 0.7);
    }
    g.restore();
  }

  // ---- The flocks of sky creatures, gliding round the spires.
  function drawFlocks(g: CanvasRenderingContext2D, v: View, t: number, sunK: number): void {
    const show = smooth(FLOCKS_AT, FLOCKS_AT + 1.4, t);
    if (show <= 0.01) return;
    g.save();
    g.lineCap = "round";
    g.lineJoin = "round";
    for (const [q, fl] of FLOCKS.entries()) {
      const into = (1 - ease(seg(t, FLOCKS_AT + q * 0.3, FLOCKS_AT + 3.2 + q * 0.3))) * 3.2 * fl.from;
      const a = fl.w * t + fl.ph;
      const cX = fl.C[0]! + fl.A[0]! * Math.sin(a) + into;
      const cY = fl.C[1]! + fl.A[1]! * Math.sin(2 * a);
      const cZ = fl.C[2]! + fl.A[2]! * Math.cos(a);
      // Which way it flies on the picture.
      const dir = Math.sign(fl.w * fl.A[0]! * Math.cos(a) + (into ? -fl.from : 0)) || 1;
      for (const [m, c] of flock[q]!.entries()) {
        const X = cX - dir * c.dz * 2 + c.dx * 0.4;
        const Y = cY + c.dy + 0.012 * Math.sin(t * 1.1 + m);
        const Z = cZ + c.dx * 2;
        project(v, X, Y, Z, P);
        const span = (v.f * c.span) / Z;
        if (span < 1.5 || P[0] < -30 || P[0] > v.w + 30) continue;
        const flap = (0.3 + 0.7 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.6 + m * 1.3 + q), 4)) * Math.sin(t * c.beat + c.ph);
        const lift = span * 0.32 * flap;
        const x = P[0];
        const y = P[1];
        g.globalAlpha = show;
        g.strokeStyle = `rgb(${lerp(20, 40, sunK) | 0} ${lerp(26, 44, sunK) | 0} ${lerp(34, 56, sunK) | 0})`;
        g.lineWidth = Math.max(0.8, span * 0.09);
        g.beginPath();
        g.moveTo(x - span / 2, y - lift);
        g.quadraticCurveTo(x - span * 0.22, y - span * 0.14 - lift * 0.3, x, y);
        g.quadraticCurveTo(x + span * 0.22, y - span * 0.14 - lift * 0.3, x + span / 2, y - lift);
        g.stroke();
        // A long tail with a glowing tip.
        g.lineWidth = Math.max(0.6, span * 0.04);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x - dir * span * 0.3, y + span * 0.05, x - dir * span * 0.55, y + span * 0.02 * Math.sin(t * 3 + m));
        g.stroke();
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = show * (0.6 + 0.4 * Math.sin(t * 2 + m));
        const r = Math.max(1.2, span * 0.12);
        g.drawImage(glows[0]!, x - dir * span * 0.55 - r * 2, y - r * 2, r * 4, r * 4);
        g.globalCompositeOperation = "source-over";
      }
    }
    g.restore();
  }

  // ---- The far volcano's smoke: it thins and dies away as the world heals.
  function drawPlume(g: CanvasRenderingContext2D, v: View, t: number, Z: number): void {
    const k = 1 - smooth(5.2, 8.6, t);
    if (k <= 0.01) return;
    const x0 = v.cx + v.f * (VOLCANO_U - v.camX / Z - v.pan);
    const y0 = v.hy + v.f * volcanoTop();
    const s = v.f * 0.01;
    g.save();
    for (let j = 0; j < 16; j++) {
      const ph = (((t * 0.22 + j / 16) % 1) + 1) % 1;
      const x = x0 + s * (ph * 9 + 1.2 * Math.sin(j * 2.1 + t * 0.3) * ph);
      const y = y0 - s * (ph * 7.5 + 0.3);
      const r = s * (0.7 + ph * 3.2);
      const a = k * 0.5 * Math.sin(Math.PI * Math.min(1, ph * 1.15)) * (1 - ph * 0.4);
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgb(50 34 32 / ${a.toFixed(3)})`);
      grd.addColorStop(1, "rgb(50 34 32 / 0)");
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();
  }

  // ---- The air: ash blowing (the storm), rain and bright mist (the cleansing), sunlight.
  function drawAir(g: CanvasRenderingContext2D, v: View, t: number, sunK: number, day: number): void {
    const { w, h } = v;
    const ash = 1 - smooth(3.2, 4.8, t);
    if (ash > 0.01) {
      g.save();
      g.strokeStyle = "rgb(196 136 96)";
      g.lineCap = "round";
      for (const d of dust) {
        const x = ((((d.x + t * d.sp) % 1.2) + 1.2) % 1.2) * w * 1.1 - w * 0.1;
        const y = d.y * h + Math.sin(t * 0.8 + d.x * 9) * 6;
        g.globalAlpha = 0.22 * d.z * ash;
        g.lineWidth = 0.6 + d.z;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - d.len * d.z, y + d.len * 0.08);
        g.stroke();
      }
      g.restore();
    }
    // Mist over the valley floor: amber dust haze, then bright cool mist, then a morning veil.
    const mist = 0.12 + 0.2 * smooth(3.8, 5.2, t) * (1 - smooth(7.6, 10, t)) - 0.04 * day;
    const mc = mixRgb(mixRgb("160 120 96", "226 242 255", smooth(3.6, 5.4, t)), "255 226 180", 0.3 * sunK);
    g.save();
    for (const b of mistBands) {
      const u = ((((b.u + t * b.sp) % 3) + 4.5) % 3) - 1.5;
      const x = v.cx + v.f * (u - v.camX / b.Z - v.pan);
      const y = v.hy + (v.f * (HC - b.Y)) / b.Z;
      const rx = v.f * b.wide;
      const ry = Math.max(4, (v.f * 0.12) / b.Z);
      g.save();
      g.translate(x, y);
      g.scale(1, ry / rx);
      const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      grd.addColorStop(0, `rgb(${mc} / ${clamp(mist).toFixed(3)})`);
      grd.addColorStop(1, `rgb(${mc} / 0)`);
      g.fillStyle = grd;
      g.fillRect(-rx, -rx, rx * 2, rx * 2);
      g.restore();
    }
    g.restore();
    // Rain.
    const rainK = smooth(RAIN[0], RAIN[1], t) * (1 - smooth(RAIN[1] + 1.7, RAIN[2], t));
    if (rainK > 0.01) {
      g.save();
      g.lineCap = "round";
      for (const gold of [false, true]) {
        g.strokeStyle = gold ? `rgb(255 226 170 / ${(0.45 * rainK * sunK).toFixed(3)})` : `rgb(206 226 255 / ${(0.3 * rainK).toFixed(3)})`;
        g.lineWidth = gold ? 1.1 : 0.9;
        g.beginPath();
        for (const d of rain) {
          if (d.gold !== gold) continue;
          const y = ((((d.ph + t * d.sp) % 1) + 1) % 1) * h * 1.15 - h * 0.075;
          const x = d.x * (w + h * 0.3) - h * 0.15 + y * 0.14;
          const len = d.len * h * d.z;
          g.moveTo(x, y);
          g.lineTo(x - len * 0.14, y - len);
        }
        g.stroke();
      }
      g.restore();
    }
  }

  return {
    prepare(budget) {
      if (valley && !prepared) prepared = valley.prepare(budget);
    },
    draw(g, w, h, time, free, quality = 1) {
      if (!(w >= 2 && h >= 2)) return;
      const t = Math.max(0, time);
      const scale = Math.max(0.5, g.getTransform().a || 1);
      ensureValley(w, h, scale, t);
      if (!prepared && t > 6.2) prepared = valley!.prepare(Infinity);
      sprites ??= {
        plume: flameSprite("214 240 255", "90 160 255"),
        glow: softSprite("190 226 255", 1, 64),
        beam: softSprite("120 255 214", 1, 96),
        red: softSprite("255 80 64", 1, 48),
        main: softSprite(theme.primary, 1, 48),
        second: softSprite(theme.secondary, 1, 48),
        sheath: softSprite("196 220 255", 0.4, 64),
      };
      if (!glows.length) glows = SPOT_RGB.map((c) => softSprite(c, 0.8, 32));
      foam ??= softSprite("236 250 255", 1, 32);
      beamHalo ??= softSprite("160 255 230", 1, 32);
      flare ??= softSprite("170 255 230", 1, 128);

      // Each beam fires with a soft jolt: the picture barely moves.
      let nudge = 0;
      for (const at of fire) {
        const age = t - at;
        if (age > 0 && age < 0.8) nudge += 0.5 * Math.exp(-age * 6);
      }
      const v = viewAt(t, w, h, free, Math.min(1, nudge));
      const sunShows = sky.sunShows(t);
      const sunK = clamp(sunShows * smooth(SUN_AT - 0.9, SUN_AT + 0.4, t));
      const day = smooth(6.5, 10.5, t);

      sky.draw(g, v, t, clamp(w / 300, 3, 5) / Math.sqrt(clamp(quality, 0.3, 1)));
      const crestK = sunK * (0.85 - 0.55 * day);
      const L = valley!.layers;
      const layer = (id: Layer["id"]) => L.find((l) => l.id === id);
      const far = layer("far");
      if (far) {
        drawLayer(g, far, v, t, crestK * 0.5);
        drawPlume(g, v, t, far.Z);
      }
      // Haze where the sky meets the land: toxic amber, then clean pale blue.
      const hz = g.createLinearGradient(0, v.hy - v.f * 0.07, 0, v.hy + v.f * 0.02);
      const hc = mixRgb("170 120 84", "214 236 246", smooth(5.5, 9.5, t));
      hz.addColorStop(0, `rgb(${hc} / 0)`);
      hz.addColorStop(0.75, `rgb(${hc} / 0.42)`);
      hz.addColorStop(1, `rgb(${hc} / 0)`);
      g.fillStyle = hz;
      g.fillRect(0, v.hy - v.f * 0.07, w, v.f * 0.09);
      const floor = layer("floor");
      if (floor) drawLayer(g, floor, v, t, 0);
      drawWater(g, v, t);
      drawDots(g, v, t, floorDots, undefined);
      // By distance: the far spire, the great one, the right ridge, the near spire, the left ridge, the rocks in front.
      drawSpire(g, v, 2, t, sunK);
      drawSpire(g, v, 0, t, sunK);
      for (const [id, spire] of [
        ["ridgeR", 1],
        ["ridgeL", -1],
        ["near", -1],
      ] as const) {
        const l = layer(id);
        if (l) {
          drawLayer(g, l, v, t, crestK);
          drawDots(g, v, t, boardDots, id);
        }
        if (spire >= 0) drawSpire(g, v, spire, t, sunK);
      }

      // The storm's gloom over the land, lifting as the sky clears.
      // (Only over the land: the sky that opens is already clean and bright.)
      const gloom = 1 - smooth(4.4, 7.4, t);
      if (gloom > 0.01) {
        g.save();
        g.globalCompositeOperation = "multiply";
        const c = `rgb(${lerp(255, 150, gloom) | 0} ${lerp(255, 126, gloom) | 0} ${lerp(255, 118, gloom) | 0})`;
        const top = Math.max(0, v.hy - v.f * 0.3);
        const gm = g.createLinearGradient(0, top, 0, v.hy - v.f * 0.04);
        gm.addColorStop(0, "rgb(255 255 255)");
        gm.addColorStop(1, c);
        g.fillStyle = gm;
        g.fillRect(0, top, w, h - top);
        g.restore();
      }
      // Golden sunlight over the valley from where the sun breaks through.
      const [sx, sy] = sky.sunAt(v);
      if (sunK > 0.01) {
        g.save();
        g.globalCompositeOperation = "screen";
        const gl = g.createRadialGradient(sx, v.hy, 0, sx, v.hy, v.f * 1.1);
        gl.addColorStop(0, `rgb(255 200 126 / ${(0.16 * sunK * (1 - 0.45 * day)).toFixed(3)})`);
        gl.addColorStop(1, "rgb(255 200 126 / 0)");
        g.fillStyle = gl;
        g.fillRect(0, 0, w, h);
        g.restore();
      }
      for (let i = 0; i < 3; i++) drawBeam(g, v, i, t);
      drawFlocks(g, v, t, sunK);
      drawAir(g, v, t, sunK, day);

      // God rays and the sun's own glare.
      if (sunK > 0.01) {
        g.save();
        g.globalCompositeOperation = "lighter";
        const rays = 0.065 * sunK * (1 - 0.5 * smooth(10.5, 13.5, t));
        for (let k = 0; k < 11; k++) {
          const a = 0.12 * Math.PI + (k / 10) * 0.76 * Math.PI + 0.025 * Math.sin(t * 0.35 + k * 1.7);
          const wd = 0.01 + (0.022 * ((k * 7) % 5)) / 5;
          const len = h * (1.1 + 0.6 * (((k * 3) % 4) / 4));
          const grd = g.createRadialGradient(sx, sy, 0, sx, sy, len);
          grd.addColorStop(0, `rgb(255 216 150 / ${(rays * (0.6 + 0.4 * Math.sin(t * 0.5 + k))).toFixed(3)})`);
          grd.addColorStop(1, "rgb(255 216 150 / 0)");
          g.fillStyle = grd;
          g.beginPath();
          g.moveTo(sx, sy);
          g.lineTo(sx + Math.cos(a - wd) * len, sy + Math.sin(a - wd) * len);
          g.lineTo(sx + Math.cos(a + wd) * len, sy + Math.sin(a + wd) * len);
          g.closePath();
          g.fill();
        }
        const r = v.f * 0.26;
        g.globalAlpha = 0.55 * sunK;
        g.drawImage(sprites.glow, sx - r, sy - r, r * 2, r * 2);
        const streak = g.createLinearGradient(sx - v.f * 0.22, 0, sx + v.f * 0.22, 0);
        streak.addColorStop(0, "rgb(255 236 200 / 0)");
        streak.addColorStop(0.5, `rgb(255 236 200 / ${(0.22 * sunK).toFixed(3)})`);
        streak.addColorStop(1, "rgb(255 236 200 / 0)");
        g.globalAlpha = 1;
        g.fillStyle = streak;
        g.fillRect(sx - v.f * 0.22, sy - 0.75, v.f * 0.44, 1.5);
        g.restore();
      }

      // The edges a little darker; a soft green light as each beam fires; it opens from black.
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.62);
      vg.addColorStop(0, "rgb(0 0 0 / 0)");
      vg.addColorStop(1, `rgb(0 0 0 / ${(0.5 - 0.2 * day).toFixed(3)})`);
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      if (nudge > 0.01) {
        g.fillStyle = `rgb(120 255 220 / ${Math.min(0.07, nudge * 0.1).toFixed(3)})`;
        g.fillRect(0, 0, w, h);
      }
      const open = 1 - seg(t, 0, 0.8);
      if (open > 0) {
        g.fillStyle = `rgb(2 4 10 / ${open.toFixed(3)})`;
        g.fillRect(0, 0, w, h);
      }
    },
  };
}
