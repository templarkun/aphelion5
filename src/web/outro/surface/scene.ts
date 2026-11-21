/**
 * Surface Terraform: the film (designer 2026-11-19; new look 2026-11-21: hard, gritty science
 * fiction after Dune, Mass Effect and Homeworld; geological, not botanical). It goes on from
 * Terraformer 2.0: the pylons have come down; the camera stands on the planet's surface at the near
 * end of a rugged basalt valley, looking across it to the horizon.
 *
 *   Act 1  an oppressive ochre and rust dust storm, low visibility, dust howling sideways. Three
 *          brutalist terraformer spires (dark gunmetal megastructures: stepped tiers, segmented
 *          radiator fins, amber hazard strobes, heat shimmer) power up one by one, open their fins
 *          and fire wide, diffused ion plumes into the storm; four more stand far off (one for every
 *          other mission won, I17).
 *   Act 2  the plumes carve a turbulent eye in the storm (sky.ts); cold, hard sunlight breaks
 *          through in crepuscular rays over the ridges; condensation rain; the dust thins.
 *   Act 3  water fills the canyon beds and pools, dark, catching sharp glints of the sky; the basalt
 *          turns wet and mineral-rich from the spires' feet (layers.ts); mist hugs the valley floor.
 *   Act 4  a slow, heavy pan over the cold, clear frontier, the spires venting steady vapour; the
 *          Debrief card slides in beside it (the picture turns so the valley stays in the open part).
 *
 * Drawn on one 2D canvas in layers, far to near, each moved by the camera's slow sideways drift as
 * much as its distance asks (parallax), each dissolved into the air as much as its distance and
 * the storm ask. Over it: an anamorphic flare where the sun breaks through, faint colour fringes
 * and a vignette at the edges, and film grain. Every texture is baked once from seeded noise; every
 * moving thing is worked out from the time alone, so any moment can be drawn by itself. No trees,
 * plants, flowers, sparkles or creatures are drawn. Looks only.
 */

import { clamp, ease, easeOut, lerp, rng, seg, smooth, TAU } from "../../briefing/styles/intro2/math3.js";
import { softSprite } from "../terraformer/pylon.js";
import { track } from "../terraformer/view.js";
import type { CompanyTheme } from "../types.js";
import { createValley, drawMix, fbm, layerState, volcanoTop, VOLCANO_U, type Layer, type Valley } from "./layers.js";
import { createSky } from "./sky.js";
import { CLIMB, FLARE, FLARE_AT, farCount, farTimes, fireTimes, RAIN, SPIRES, SUN_AT } from "./timeline.js";
import { BURY, CEIL, FAR_PLACES, HC, nf, poolAt, POOL_DEFS, project, SPIRE_PLACES, streamPaths, waterReach, type View } from "./world.js";

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
  /** Make the wet pictures a little at a time (once a frame, before draw); `budget` ms. */
  prepare(budget: number): void;
  /** Where the horizon was in the last picture drawn, CSS px from the top (for the recon overlay's scale). */
  horizon(): number;
}
export interface SceneSetup {
  theme: CompanyTheme;
  vesselId: string;
  /** How many pylons 2.0 dropped (one per mission won): those beyond the three spires stand far off. None if left out. */
  pylons?: number;
}

type C3 = readonly [number, number, number];
const mix = (a: C3, b: C3, k: number): C3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const rgba = (c: C3, a = 1) => `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0} / ${clamp(a).toFixed(3)})`;
const add = (a: C3, b: C3, k: number): C3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

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
/** The largest turn of the picture (focal lengths): the layers are made this much wider. */
const PAN_MAX = 0.34;

/** The camera's slow sideways drift, km: a little across the valley in the film, then a slow, heavy sweep to and fro. */
function camXAt(t: number): number {
  return -0.07 + 0.11 * ease(seg(t, 0, 10.5)) + 0.1 * Math.sin(Math.max(0, t - 10.5) * 0.11);
}

/** A fixed pseudo-random number 0..1 for a few numbers (looks only). */
function hash(a: number, b: number, c: number): number {
  const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

// ---- The air: the storm's ochre dust, then a cold clear haze.
const STORM_FOG: C3 = [140, 88, 58];
const COLD_FOG: C3 = [80, 96, 110];
interface Fog {
  rgb: C3;
  /** How far one sees, km. */
  vis: number;
  /** How thick the dust storm still is, 0..1. */
  storm: number;
}
function fogAt(t: number): Fog {
  return { rgb: mix(STORM_FOG, COLD_FOG, smooth(3.6, 7.4, t)), vis: 11 * Math.pow(90 / 11, smooth(3.4, 7.6, t)), storm: 1 - smooth(3.0, 6.6, t) };
}
/** How much of something Z km away is lost in the air. */
const fogA = (Z: number, f: Fog) => Math.min(0.93, 1 - Math.exp(-Z / f.vis));

// ---- The spires: brutalist megastructures, in shares of the height of their top above the ground.
/** Tiers, bottom to top: [from, to, half-width at the foot, half-width at the top]. */
const TIERS: [number, number, number, number][] = [
  [0, 0.03, 0.31, 0.29],
  [0.03, 0.062, 0.25, 0.236],
  [0.062, 0.3, 0.152, 0.126],
  [0.3, 0.33, 0.142, 0.142],
  [0.33, 0.64, 0.1, 0.092],
  [0.64, 0.69, 0.126, 0.126],
  [0.69, 0.85, 0.084, 0.074],
  [0.85, 0.915, 0.13, 0.13],
  [0.915, 0.965, 0.074, 0.06],
  [0.965, 1.0, 0.044, 0.034],
];
/** The radiator fin banks on the mid shaft: from, to, how many fins a side, how far a fin stands out when wide open. */
const FINS = { from: 0.355, to: 0.62, n: 9, out: 0.15 };
/** The hazard strobes: [x, height] (x across, in the same shares), each mirrored. */
const STROBES: [number, number][] = [
  [0.3, 0.03],
  [0.15, 0.3],
  [0.126, 0.69],
  [0.13, 0.915],
  [0, 1.0],
];
/** The far spires are as tall as this (km) and drawn plainer. */
const FAR_H = 3.6;
const GUN: { lit: C3; mid: C3; dark: C3 } = { lit: [60, 64, 68], mid: [33, 36, 39], dark: [13, 14, 16] };
const AMBER: C3 = [255, 168, 64];
const ION: C3 = [168, 190, 212];

export function createSurfaceScene(o: SceneSetup): SurfaceScene {
  const { theme } = o;
  const R = rng(1919);
  const hyWide = track(HY_WIDE);
  const hyTall = track(HY_TALL);
  const sky = createSky();
  const fire = fireTimes();
  const farN = Math.min(FAR_PLACES.length, farCount(o.pylons ?? SPIRES));
  const farFire = farTimes(farN);
  let valley: Valley | undefined;
  let built = { U: 0, vmax: 0, R: 0 };
  let prepared = false;
  let tmp: HTMLCanvasElement | undefined;
  let lastHy = 0;
  const P: [number, number] = [0, 0];

  // ---- Textures, baked once from seeded noise on the first picture (so every frame only draws them).
  let tex:
    | {
        grain: HTMLCanvasElement[];
        dust: HTMLCanvasElement;
        mist: HTMLCanvasElement;
        puffIon: HTMLCanvasElement[];
        puffHot: HTMLCanvasElement;
        puffVapour: HTMLCanvasElement[];
        puffSmoke: HTMLCanvasElement;
        strobe: HTMLCanvasElement;
        ion: HTMLCanvasElement;
        cold: HTMLCanvasElement;
        ghostA: HTMLCanvasElement;
        ghostB: HTMLCanvasElement;
      }
    | undefined;
  let shim: HTMLCanvasElement | undefined;
  let ca: HTMLCanvasElement | undefined;

  function bake(): NonNullable<typeof tex> {
    /** Film grain: grey noise about 128, a few frames of it. */
    const grainTile = (seed: number) => {
      const S = 256;
      const c = document.createElement("canvas");
      c.width = c.height = S;
      const g = c.getContext("2d")!;
      const im = g.createImageData(S, S);
      const Rg = rng(seed);
      for (let i = 0; i < S * S; i++) {
        // Two dice: a soft, film-like spread rather than flat speckle.
        const v = 128 + (Rg() + Rg() - 1) * 90;
        im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
        im.data[i * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      return c;
    };
    /** A band of wind-torn streaks (dust or mist), soft at top and foot, repeating across. */
    const band = (rgb: C3, seed: number, stretch: number, gain: number) => {
      const W = 512;
      const H = 128;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d")!;
      const im = g.createImageData(W, H);
      for (let y = 0; y < H; y++) {
        // Soft to nothing at its top and foot.
        const fall = Math.sin((Math.PI * (y + 0.5)) / H) ** 3;
        for (let x = 0; x < W; x++) {
          // Across: 0.5 texel per px (the field repeats every 256, so the band repeats every 512).
          const n = fbm(x * 0.5, y * stretch + seed, 5);
          const a = clamp((n - 0.36) * gain) * fall;
          const o = (y * W + x) * 4;
          im.data[o] = rgb[0];
          im.data[o + 1] = rgb[1];
          im.data[o + 2] = rgb[2];
          im.data[o + 3] = a * 255;
        }
      }
      g.putImageData(im, 0, 0);
      return c;
    };
    /** A puff of gas with a torn, noisy edge (the plumes are built of many). */
    const puff = (rgb: C3, seed: number) => {
      const S = 96;
      const c = document.createElement("canvas");
      c.width = c.height = S;
      const g = c.getContext("2d")!;
      const im = g.createImageData(S, S);
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const d = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
          if (d >= 1) continue;
          const body = (1 - d * d) ** 2;
          const n = fbm(x * 0.9 + seed * 37, y * 0.9 + seed * 11, 4);
          const a = clamp(body * (0.25 + 1.5 * (n - 0.32)));
          const o = (y * S + x) * 4;
          im.data[o] = rgb[0];
          im.data[o + 1] = rgb[1];
          im.data[o + 2] = rgb[2];
          im.data[o + 3] = a * 255;
        }
      }
      g.putImageData(im, 0, 0);
      return c;
    };
    return {
      grain: [grainTile(9001), grainTile(9002), grainTile(9003), grainTile(9004)],
      dust: band([152, 106, 70], 17, 1.6, 2.4),
      mist: band([176, 188, 196], 61, 1.1, 2.0),
      puffIon: [puff(ION, 1), puff(ION, 2), puff(ION, 3)],
      puffHot: puff([255, 150, 82], 4),
      puffVapour: [puff([196, 202, 208], 5), puff([170, 178, 186], 6)],
      puffSmoke: puff([46, 38, 34], 7),
      strobe: softSprite("255 168 64", 1, 48),
      ion: softSprite("190 208 228", 1, 64),
      cold: softSprite("214 228 242", 0.9, 96),
      ghostA: softSprite("150 190 235", 0, 48),
      ghostB: softSprite("230 196 156", 0, 48),
    };
  }

  // ---- Things that only depend on the valley, made once.
  const rain = Array.from({ length: 170 }, () => ({ x: R(), ph: R(), sp: 1.35 + R() * 0.7, len: 0.025 + R() * 0.035, z: 0.35 + R() * 0.65 }));
  const streaks = Array.from({ length: 120 }, () => ({ x: R(), y: 0.25 + R() * 0.72, sp: 0.45 + R() * 0.7, len: 18 + R() * 70, z: 0.3 + R() * 0.7 }));
  const mistBands = Array.from({ length: 6 }, (_, i) => ({ Z: 1.6 + i * 2.1 + R(), Y: 0.02 + R() * 0.06, u: R() * 3 - 1.5, sp: (0.003 + R() * 0.004) * (R() < 0.5 ? -1 : 1), wide: 0.5 + R() * 0.45 }));

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
    // The slow, heavy pan over the frontier.
    pan += 0.05 * Math.sin(Math.max(0, t - 10.5) * 0.085) * smooth(10, 13, t);
    return { w, h, f, cx: w / 2 + nudge * 2.5 * Math.sin(t * 41), hy: hy + nudge * 2 * Math.cos(t * 33), camX: camXAt(t), pan };
  }

  /** Make (or make again, for a much bigger or sharper picture) the painted layers. */
  function ensureValley(w: number, h: number, scale: number, t: number): void {
    const tall = h > w * 1.15;
    const f = 1.1 * Math.min(h, w * 1.2);
    const trk = tall ? HY_TALL : HY_WIDE;
    // Where the horizon may go when the Debrief comes (outro.css: the card stands at the side from 700 px wide and 5:4, else along the foot).
    const side = w >= 700 && w >= h * 1.25;
    const hyMin = Math.min(...trk.map((k) => k[1]), side ? 0.5 : 0.27) * h;
    const U = w / (2 * f) + PAN_MAX + 0.03;
    const vmax = (h - hyMin) / f + 0.03;
    const Rn = f * scale;
    if (valley && U <= built.U + 1e-6 && vmax <= built.vmax + 1e-6 && Rn < built.R * 1.4 && Rn > built.R * 0.6) return;
    built = { U: Math.max(U, valley ? built.U : 0), vmax: Math.max(vmax, valley ? built.vmax : 0), R: Rn };
    valley = createValley(built.U, built.vmax, Rn);
    prepared = false;
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

  // ---- A layer, moved by the drift as much as its distance asks, then dissolved into the air.
  function drawLayer(g: CanvasRenderingContext2D, l: Layer, v: View, t: number, crestK: number, fog: Fog, fogZ: number): void {
    const k = v.f / l.R;
    g.save();
    if (l.kind === "floor") g.transform(k, 0, (-v.f * v.camX) / (HC * l.R), k, v.cx + v.f * (l.u0 - v.pan) - (v.f * v.camX * l.v0) / HC, v.hy + v.f * l.v0);
    else g.transform(k, 0, 0, k, v.cx + v.f * (l.u0 - v.camX / l.Z - v.pan), v.hy + v.f * l.v0);
    if (l.id === "far") {
      g.drawImage(l.barren, 0, 0);
      const a = smooth(8.4, 10.4, t);
      if (l.wet && a > 0) {
        g.globalAlpha = a;
        g.drawImage(l.wet, 0, 0);
        g.globalAlpha = 1;
      }
    } else {
      const st = layerState(l, t);
      if (st === "wet") g.drawImage(l.wet!, 0, 0);
      else if (st === "mix" && tmp) drawMix(g, l, t, tmp);
      else g.drawImage(l.barren, 0, 0);
    }
    if (l.crest && crestK > 0.01) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = crestK;
      g.drawImage(l.crest, 0, 0);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
    }
    // The air in front of it: its own outline filled with the colour of the air.
    const a = fogZ > 0 ? fogA(fogZ, fog) : 0;
    if (a > 0.015 && tmp && l.kind === "board") {
      const tg = tmp.getContext("2d")!;
      tg.globalCompositeOperation = "copy";
      tg.drawImage(l.barren, 0, 0);
      tg.globalCompositeOperation = "source-in";
      tg.fillStyle = rgba(fog.rgb);
      tg.fillRect(0, 0, l.lw, l.lh);
      tg.globalCompositeOperation = "source-over";
      g.globalAlpha = a;
      g.drawImage(tmp, 0, 0, l.lw, l.lh, 0, 0, l.lw, l.lh);
    }
    g.restore();
  }

  /** The air over the valley floor: thick far off, thin near the camera. */
  function floorFog(g: CanvasRenderingContext2D, v: View, fog: Fog): void {
    const top = v.hy - 2;
    const bottom = v.h;
    if (bottom <= top) return;
    const grd = g.createLinearGradient(0, top, 0, bottom);
    for (const vv of [0.002, 0.006, 0.015, 0.035, 0.08, 0.18, 0.45]) {
      const y = v.hy + v.f * vv;
      const s = (y - top) / (bottom - top);
      if (s < 0 || s > 1) continue;
      grd.addColorStop(s, rgba(fog.rgb, fogA(HC / vv, fog)));
    }
    grd.addColorStop(0, rgba(fog.rgb, fogA(HC / 0.002, fog)));
    g.fillStyle = grd;
    g.fillRect(0, top, v.w, bottom - top);
  }

  // ---- The water: dark, filling the canyon beds from the spires' feet, then the pools; it holds the cold sky and glints.
  function drawWater(g: CanvasRenderingContext2D, v: View, t: number, sx: number, sunK: number): void {
    const paths = streamPaths();
    const L: [number, number][] = [];
    const Rt: [number, number][] = [];
    const glintK = 0.25 + 0.75 * sunK;
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
        L.push(project(v, x + p.nx[j]! * wd, 0, z + p.nz[j]! * wd, [0, 0]));
        Rt.push(project(v, x - p.nx[j]! * wd, 0, z - p.nz[j]! * wd, [0, 0]));
        tip = [(L[L.length - 1]![0] + Rt[Rt.length - 1]![0]) / 2, (L[L.length - 1]![1] + Rt[Rt.length - 1]![1]) / 2];
        tipW = (v.f * wd * 2) / z;
        if (last) break;
      }
      if (L.length < 2) continue;
      // Far off it holds the pale horizon (grazing light); near, it is dark as obsidian.
      const grd = g.createLinearGradient(0, v.hy, 0, v.h);
      grd.addColorStop(0, "rgb(96 112 124)");
      grd.addColorStop(0.06, "rgb(48 60 68)");
      grd.addColorStop(0.3, "rgb(20 27 31)");
      grd.addColorStop(1, "rgb(12 16 19)");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(L[0]![0], L[0]![1]);
      for (let i = 1; i < L.length; i++) g.lineTo(L[i]![0], L[i]![1]);
      for (let i = Rt.length - 1; i >= 0; i--) g.lineTo(Rt[i]![0], Rt[i]![1]);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgb(4 6 7 / 0.7)";
      g.lineWidth = 1;
      g.stroke();
      // Its far bank holds a thin line of the sky.
      g.strokeStyle = "rgb(140 156 168 / 0.22)";
      g.beginPath();
      for (let i = 0; i < L.length; i++) {
        const q = L[i]![1] < Rt[i]![1] ? L[i]! : Rt[i]!;
        if (i) g.lineTo(q[0], q[1] + 0.6);
        else g.moveTo(q[0], q[1] + 0.6);
      }
      g.stroke();
      g.save();
      g.globalCompositeOperation = "lighter";
      g.lineCap = "butt";
      // Sharp, shimmering glints of the breaking sky, brightest on the line under the sun.
      for (let i = 1; i < L.length - 1; i++) {
        const wide = Math.hypot(L[i]![0] - Rt[i]![0], L[i]![1] - Rt[i]![1]);
        const n = Math.min(6, 1 + Math.floor(wide / 8));
        const mx = (L[i]![0] + Rt[i]![0]) / 2;
        const under = Math.exp(-(((mx - sx) / (v.f * 0.12)) ** 2));
        for (let q = 0; q < n; q++) {
          const h1 = hash(i, q, k);
          const h2 = hash(i + 0.5, q + 3, k);
          const fl = 0.5 + 0.5 * Math.sin(t * (3 + 3 * h2) - i * 0.9 + h1 * 9);
          const al = (0.1 + 0.55 * under) * glintK * Math.pow(fl, 8);
          if (al < 0.02) continue;
          const o = 0.12 + 0.76 * h1;
          const at = 0.1 + 0.6 * h2;
          const ln = 0.1 + 0.16 * hash(i, q + 7, k);
          const ax = lerp(L[i]![0], Rt[i]![0], o);
          const ay = lerp(L[i]![1], Rt[i]![1], o);
          const bx = lerp(L[i + 1]![0], Rt[i + 1]![0], o);
          const by = lerp(L[i + 1]![1], Rt[i + 1]![1], o);
          g.strokeStyle = `rgb(236 242 248 / ${al.toFixed(3)})`;
          g.lineWidth = Math.max(0.6, Math.min(2, wide * 0.04));
          g.beginPath();
          g.moveTo(lerp(ax, bx, at), lerp(ay, by, at));
          g.lineTo(lerp(ax, bx, at + ln), lerp(ay, by, at + ln));
          g.stroke();
        }
      }
      // The running front: a thin bright meniscus.
      if (tip && reach < p.length - 0.01) {
        const r = Math.max(2, tipW * 1.6);
        g.globalAlpha = 0.55;
        g.drawImage(tex!.cold, tip[0] - r, tip[1] - r * 0.3, r * 2, r * 0.6);
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
      // Dark water with a soft shore; its far side holds a thin line of the cold sky.
      const grd = g.createRadialGradient(0, rx * 0.12, 0, 0, 0, rx);
      grd.addColorStop(0, "rgb(16 21 25)");
      grd.addColorStop(0.7, "rgb(13 18 21)");
      grd.addColorStop(0.9, "rgb(10 13 15 / 0.85)");
      grd.addColorStop(1, "rgb(10 13 15 / 0)");
      g.globalAlpha = Math.min(1, fill * 1.6);
      g.fillStyle = grd;
      g.beginPath();
      g.arc(0, 0, rx, 0, TAU);
      g.fill();
      g.strokeStyle = "rgb(150 166 178 / 0.28)";
      g.lineWidth = (rx / ry) * 1.2;
      g.beginPath();
      g.arc(0, 0, rx * 0.84, Math.PI * 1.12, Math.PI * 1.88);
      g.stroke();
      // The sun's glitter path across it, and a faint ripple.
      g.globalCompositeOperation = "lighter";
      const gx = clamp(sx - P[0], -rx * 0.8, rx * 0.8);
      for (let q = 0; q < 9; q++) {
        const fl = Math.pow(0.5 + 0.5 * Math.sin(t * (4 + q * 0.7) + q * 2.1 + i), 10);
        if (fl < 0.05) continue;
        const yy = -rx * 0.5 + rx * (q / 8);
        g.fillStyle = `rgb(236 244 250 / ${(fl * 0.6 * glintK * fill).toFixed(3)})`;
        g.fillRect(gx - rx * 0.12 * (1 - q / 12) + Math.sin(q * 3.3) * rx * 0.05, yy, rx * 0.24 * (1 - q / 12), (rx / ry) * 0.9);
      }
      const ph = (t * 0.3 + i * 0.3) % 1;
      g.strokeStyle = `rgb(200 214 224 / ${(0.07 * (1 - ph) * fill).toFixed(3)})`;
      g.lineWidth = rx / ry;
      g.beginPath();
      g.arc(rx * 0.1, 0, rx * 0.85 * ph, 0, TAU);
      g.stroke();
      g.restore();
    }
  }

  // ---- Heat shimmer: a piece of the picture redrawn in thin wavering strips.
  function shimmer(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, amp: number, t: number, seed: number): void {
    const cv = g.canvas as HTMLCanvasElement;
    const m = g.getTransform();
    const sxk = m.a;
    const syk = m.d;
    const dx0 = Math.max(0, Math.floor(x * sxk));
    const dy0 = Math.max(0, Math.floor(y * syk));
    const dx1 = Math.min(cv.width, Math.ceil((x + w) * sxk));
    const dy1 = Math.min(cv.height, Math.ceil((y + h) * syk));
    const dw = dx1 - dx0;
    const dh = dy1 - dy0;
    if (dw < 4 || dh < 4) return;
    if (!shim || shim.width < dw || shim.height < dh) {
      shim = document.createElement("canvas");
      shim.width = Math.max(dw, shim?.width ?? 0);
      shim.height = Math.max(dh, shim?.height ?? 0);
    }
    const sg = shim.getContext("2d")!;
    sg.globalCompositeOperation = "copy";
    sg.drawImage(cv, dx0, dy0, dw, dh, 0, 0, dw, dh);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const step = Math.max(2, Math.round(2 * syk));
    for (let yy = 0; yy < dh; yy += step) {
      const k = Math.sin((Math.PI * yy) / dh);
      const off = amp * sxk * k * Math.sin(yy / syk / 2.6 + t * 13 + seed) * (0.6 + 0.4 * Math.sin(yy / syk / 9 - t * 5 + seed));
      g.drawImage(shim, 0, yy, dw, step, dx0 + off, dy0 + yy, dw, step);
    }
    g.restore();
  }

  // ---- A spire: a brutalist megastructure standing in the rock.
  interface SpireLook {
    power: number;
    open: number;
    heat: number;
    emit: number;
  }
  function spireLook(i: number, t: number, vapour: number): SpireLook {
    const a = FLARE_AT[i]!;
    return {
      power: smooth(a - 0.5, a + 0.1, t),
      open: lerp(0.28, 1, easeOut(seg(t, a, a + FLARE))),
      heat: smooth(fire[i]! - 0.2, fire[i]! + 1.2, t) * (1 - 0.45 * vapour),
      emit: smooth(fire[i]! - 0.25, fire[i]! + 0.05, t),
    };
  }

  /** The strobes of a spire: stark short flashes, faster while it powers up. */
  function strobes(g: CanvasRenderingContext2D, bx: number, gy: number, H: number, t: number, power: number, seed: number, dim: number, only?: number): void {
    if (power <= 0.01) return;
    const base = Math.max(2.2, H * 0.03);
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let j = 0; j < STROBES.length; j++) {
      if (only !== undefined && j !== only) continue;
      const [sxr, hh] = STROBES[j]!;
      for (const side of sxr ? [-1, 1] : [0]) {
        const ph = hash(seed, j, side + 2);
        const period = power < 0.95 ? 0.45 : 1.25 + 0.3 * hash(seed, j, 7);
        const x = (((t + ph * period) / period) % 1 + 1) % 1;
        // A double flash: the second a little after the first.
        const fl = Math.exp(-((x / 0.018) ** 2)) + 0.6 * Math.exp(-(((x - 0.09) / 0.016) ** 2));
        const px = bx + side * sxr * H;
        const py = gy - hh * H;
        const a = power * (0.22 + 0.9 * fl) * dim;
        if (a < 0.02) continue;
        const r = base * (0.6 + 0.9 * fl);
        g.globalAlpha = clamp(a);
        g.drawImage(tex!.strobe, px - r * 2, py - r * 2, r * 4, r * 4);
        if (fl > 0.1) {
          g.fillStyle = `rgb(255 214 150 / ${clamp(fl * 0.5 * dim).toFixed(3)})`;
          g.fillRect(px - r * 5, py - 0.5, r * 10, 1);
        }
      }
    }
    g.restore();
  }

  function drawSpire(g: CanvasRenderingContext2D, v: View, i: number, t: number, sunK: number, fog: Fog, vapour: number, quality: number): void {
    const s = SPIRE_PLACES[i]!;
    const top = (1 - BURY) * s.L;
    project(v, s.X, 0, s.Z, P);
    const bx = P[0];
    const gy = P[1];
    const H = (v.f * top) / s.Z;
    if (bx < -H || bx > v.w + H) return;
    const look = spireLook(i, t, vapour);
    const a = fogA(s.Z, fog) * 0.92;
    const fogC = fog.rgb;
    const tint = (c: C3) => mix(c, fogC, a);
    // The light: the storm's dim ochre from all round, then the hard cold sun from the left.
    const lit = add(mix(GUN.lit, [74, 58, 46], 0.5 * fog.storm), [70, 76, 82], sunK);
    const mid = add(GUN.mid, [10, 12, 14], sunK);
    const X = (hw: number) => hw * H;
    // Its shadow and the broken rock round its foot.
    g.fillStyle = rgba(tint([8, 8, 9]), 0.6);
    g.beginPath();
    g.ellipse(bx + H * 0.08, gy + 1, H * 0.42, Math.max(1, H * 0.02), 0, 0, TAU);
    g.fill();
    // The tiers.
    for (const [k, [h0, h1, w0, w1]] of TIERS.entries()) {
      const y0 = gy - h0 * H;
      const y1 = gy - h1 * H;
      const xl0 = bx - X(w0);
      const xr0 = bx + X(w0);
      const xl1 = bx - X(w1);
      const xr1 = bx + X(w1);
      const grd = g.createLinearGradient(Math.min(xl0, xl1), 0, Math.max(xr0, xr1), 0);
      grd.addColorStop(0, rgba(tint(lit)));
      grd.addColorStop(0.18, rgba(tint(mix(lit, mid, 0.6))));
      grd.addColorStop(0.55, rgba(tint(mid)));
      grd.addColorStop(1, rgba(tint(GUN.dark)));
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(xl0, y0 + 0.5);
      g.lineTo(xl1, y1);
      g.lineTo(xr1, y1);
      g.lineTo(xr0, y0 + 0.5);
      g.closePath();
      g.fill();
      // The underside of an overhanging tier is in deep shade.
      const next = TIERS[k + 1];
      if (next && next[2] < w1) {
        g.fillStyle = rgba(tint([6, 7, 8]), 0.75);
        g.fillRect(xl1, y1, xr1 - xl1, Math.max(0.6, H * 0.004));
      }
      const tierH = y0 - y1;
      if (H > 40) {
        // Panel seams: courses across, pilasters up.
        g.strokeStyle = rgba(tint([4, 5, 6]), 0.4);
        g.lineWidth = 0.7;
        g.beginPath();
        const courses = Math.floor(tierH / Math.max(3, H * 0.028));
        for (let c = 1; c < courses; c++) {
          const yy = y0 - (tierH * c) / courses;
          const ww = X(lerp(w0, w1, c / courses));
          g.moveTo(bx - ww, yy);
          g.lineTo(bx + ww, yy);
        }
        for (const q of [-0.8, -0.42, 0.42, 0.8]) {
          g.moveTo(bx + q * X(w0), y0);
          g.lineTo(bx + q * X(w1), y1);
        }
        g.stroke();
      }
      // A cold rim of sunlight on the lit edge; a hard top edge.
      if (sunK > 0.02) {
        g.strokeStyle = rgba(tint([214, 226, 236]), 0.45 * sunK);
        g.lineWidth = Math.max(0.7, H * 0.003);
        g.beginPath();
        g.moveTo(xl0 + 0.4, y0);
        g.lineTo(xl1 + 0.4, y1);
        g.lineTo(bx, y1);
        g.stroke();
      }
    }
    // Buttresses at the foot of the base block.
    for (const side of [-1, 1]) {
      g.fillStyle = rgba(tint(side < 0 ? mix(lit, mid, 0.4) : GUN.dark));
      g.beginPath();
      g.moveTo(bx + side * X(0.152), gy - 0.062 * H);
      g.lineTo(bx + side * X(0.22), gy - 0.062 * H);
      g.lineTo(bx + side * X(0.136), gy - 0.25 * H);
      g.closePath();
      g.fill();
    }
    // Conduits up the shaft; masts on the crown.
    if (H > 24) {
      g.strokeStyle = rgba(tint(mix(GUN.dark, mid, 0.45)));
      g.lineWidth = Math.max(0.7, H * 0.009);
      g.beginPath();
      for (const q of [-0.068, 0.068]) {
        g.moveTo(bx + X(q * 1.7), gy - 0.062 * H);
        g.lineTo(bx + X(q * 1.05), gy - 0.64 * H);
      }
      g.stroke();
      g.lineWidth = Math.max(0.6, H * 0.004);
      g.beginPath();
      for (const [q, hh] of [
        [-0.1, 1.07],
        [0.105, 1.12],
        [0.02, 1.04],
      ] as const) {
        g.moveTo(bx + X(q), gy - 0.915 * H);
        g.lineTo(bx + X(q), gy - hh * H);
      }
      g.stroke();
    }
    // The Company's band round the collar.
    g.fillStyle = `rgb(${theme.primary} / ${(0.32 * (1 - a)).toFixed(3)})`;
    g.fillRect(bx - X(0.126), gy - 0.672 * H, X(0.252), Math.max(0.7, H * 0.01));
    // The radiator fins: two banks of slabs that slide out, glowing dull hot between them.
    const finOut = FINS.out * look.open;
    const fy0 = gy - FINS.to * H;
    const fy1 = gy - FINS.from * H;
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const side of [-1, 1]) {
      const e = bx + side * X(0.096);
      const grd = g.createLinearGradient(e, 0, e + side * X(finOut + 0.01), 0);
      const hk = look.heat * (1 - a * 0.75);
      grd.addColorStop(0, `rgb(255 110 44 / ${(0.4 * hk).toFixed(3)})`);
      grd.addColorStop(1, `rgb(200 60 24 / ${(0.06 * hk).toFixed(3)})`);
      g.fillStyle = grd;
      g.fillRect(Math.min(e, e + side * X(finOut)), fy0, Math.abs(X(finOut)), fy1 - fy0);
    }
    g.restore();
    const finT = Math.max(0.7, H * 0.011);
    for (let n = 0; n < FINS.n; n++) {
      const yy = lerp(fy1, fy0, n / (FINS.n - 1));
      for (const side of [-1, 1]) {
        const e = bx + side * X(0.094);
        const tipX = e + side * X(finOut);
        g.fillStyle = rgba(tint(side < 0 ? mix(lit, mid, 0.5) : mix(GUN.dark, mid, 0.3)));
        g.beginPath();
        g.moveTo(e, yy - finT * 0.5);
        g.lineTo(tipX, yy - finT * 0.2 + H * 0.008 * look.open);
        g.lineTo(tipX, yy + finT * 0.6 + H * 0.008 * look.open);
        g.lineTo(e, yy + finT * 0.5);
        g.closePath();
        g.fill();
        if (sunK > 0.05) {
          g.strokeStyle = rgba(tint([200, 212, 222]), 0.3 * sunK);
          g.lineWidth = 0.6;
          g.beginPath();
          g.moveTo(e, yy - finT * 0.5);
          g.lineTo(tipX, yy - finT * 0.2 + H * 0.008 * look.open);
          g.stroke();
        }
      }
    }
    // Vents and slit windows in the base, lit amber from inside.
    const slitW = X(0.012);
    if (slitW > 0.5) {
      g.fillStyle = `rgb(255 158 70 / ${(0.55 * look.power * (1 - a * 0.8)).toFixed(3)})`;
      for (const hh of [0.11, 0.17, 0.23]) {
        const ww = lerp(0.14, 0.13, hh / 0.3);
        for (let q = -ww + 0.02; q < ww - 0.02; q += 0.032) g.fillRect(bx + X(q), gy - hh * H, slitW, Math.max(0.5, H * 0.005));
      }
    }
    // Amber glow under the plinth, the rock round its foot lit by it.
    g.save();
    g.globalCompositeOperation = "lighter";
    const ug = g.createRadialGradient(bx, gy, 0, bx, gy, H * 0.45);
    ug.addColorStop(0, `rgb(255 150 70 / ${(0.22 * look.power * (1 - a * 0.6)).toFixed(3)})`);
    ug.addColorStop(1, "rgb(255 150 70 / 0)");
    g.fillStyle = ug;
    g.fillRect(bx - H * 0.45, gy - H * 0.45, H * 0.9, H * 0.5);
    // The emitter's mouth, white hot while it fires.
    if (look.emit > 0.01) {
      const r = Math.max(2, X(0.055)) * (1 + 0.2 * Math.sin(t * 9 + i));
      g.globalAlpha = look.emit * (1 - a * 0.5);
      g.drawImage(tex!.ion, bx - r * 2, gy - H - r * 2, r * 4, r * 4);
    }
    g.restore();
    strobes(g, bx, gy, H, t, look.power, i * 13 + 5, 1 - a * 0.55);
    // Heat shimmer over the emitter and the hot fins.
    if (quality >= 0.6 && H > 30 && look.power > 0.05) {
      shimmer(g, bx - X(0.16), gy - H * 1.34, X(0.32), H * 0.34, 1.3 * look.power, t, i * 3);
      if (look.heat > 0.05) for (const side of [-1, 1]) shimmer(g, bx + (side < 0 ? -X(0.1 + finOut + 0.03) : X(0.1)), fy0 - H * 0.03, X(finOut + 0.03), fy1 - fy0 + H * 0.06, 0.8 * look.heat, t, i * 7 + side);
    }
  }

  /** The far spires (I17): plain hazy silhouettes far off on the plain, strobes on their crowns. */
  function drawFarSpires(g: CanvasRenderingContext2D, v: View, t: number, fog: Fog, sunK: number): void {
    for (let k = 0; k < farN; k++) {
      const p = FAR_PLACES[k]!;
      project(v, p.u * p.Z, 0, p.Z, P);
      const bx = P[0];
      const gy = P[1];
      const H = (v.f * FAR_H) / p.Z;
      if (bx < -H || bx > v.w + H) continue;
      const a = Math.min(0.9, fogA(p.Z, fog));
      const c = mix(add(GUN.mid, [16, 18, 20], sunK), fog.rgb, a);
      g.fillStyle = rgba(c);
      g.beginPath();
      for (const [h0, h1, w0, w1] of TIERS) {
        g.rect(bx - w0 * H, gy - h1 * H, w0 * H * 2, (h1 - h0) * H + 0.5);
        if (w1 < w0) g.rect(bx - w1 * H, gy - h1 * H, w1 * H * 2, 0.5);
      }
      g.fill();
      const since = t - farFire[k]!;
      strobes(g, bx, gy, H, t, since > -0.6 ? smooth(-0.6, 0, since) : 0, 100 + k, 0.7, 4);
    }
  }

  // ---- An ion plume: a wide, diffused column of glowing gas from the emitter up into the storm.
  function plume(g: CanvasRenderingContext2D, x: number, yA: number, yDeck: number, yTop: number, w0: number, since: number, power: number, vapour: number, t: number, seed: number, dim: number): void {
    if (since <= 0) return;
    const T = tex!;
    const grow = easeOut(clamp(since / CLIMB));
    const yHead = grow < 1 ? lerp(yA, yDeck, grow) : Math.min(yDeck, yTop);
    const span = yA - yHead;
    if (span < 2) return;
    const ion = power * (1 - 0.6 * vapour) * dim;
    // Many soft, overlapping puffs, so the column reads as one body of gas.
    const N = Math.max(10, Math.min(64, Math.round(span / Math.max(2, w0 * 0.45))));
    // Steady vapour, drifting off on the wind (Acts 3 and 4).
    if (vapour > 0.01) {
      g.save();
      for (let k = 0; k < N; k++) {
        const s = k / (N - 1);
        const y = lerp(yA, yA - Math.min(span * 0.9, w0 * 34), s);
        const r = w0 * (1.1 + 3.2 * s);
        const dx = s * s * w0 * 26 + (nf(s * 6 - t * 0.5 + seed * 5, seed * 3 + t * 0.15) - 0.5) * w0 * 3;
        g.globalAlpha = clamp(0.42 * vapour * (1 - 0.7 * s) * dim);
        g.drawImage(T.puffVapour[k % 2]!, x + dx - r, y - r, r * 2, r * 2);
      }
      g.restore();
    }
    g.save();
    g.globalCompositeOperation = "screen";
    // The air round it lit by it: a long soft glow.
    g.globalAlpha = clamp(0.22 * ion);
    g.drawImage(T.cold, x - w0 * 6, yHead - w0 * 2, w0 * 12, span + w0 * 4);
    for (let k = 0; k < N; k++) {
      const s = k / (N - 1);
      const y = lerp(yA, yHead, s);
      const r = w0 * (1.3 + 3.6 * s) * (0.85 + 0.3 * nf(k * 3.1 + seed, t * 0.6 + seed));
      // Above the storm's deck it thins out into the clear sky.
      const thin = y < yDeck ? 1 - 0.75 * clamp((yDeck - y) / Math.max(1, yDeck - yHead)) : 1;
      const dx = (nf(s * 5 - t * 0.8 + seed * 7, seed * 3 + t * 0.25) - 0.5) * w0 * 4.5 * s + vapour * s * s * w0 * 8;
      const hot = k < 3 && vapour < 0.9;
      g.globalAlpha = clamp((hot ? 0.24 : 0.12) * ion * (1 - 0.45 * s) * thin);
      g.drawImage(hot ? T.puffHot : T.puffIon[k % 3]!, x + dx - r, y - r, r * 2, r * 2);
    }
    // The hard core: a thin bright column, wavering.
    const core = ion * (1 - 0.5 * vapour);
    if (core > 0.02) {
      g.lineCap = "round";
      for (const [wide, al] of [
        [1.3, 0.16],
        [0.34, 0.5],
      ] as const) {
        const grd = g.createLinearGradient(0, yA, 0, yHead);
        grd.addColorStop(0, `rgb(240 244 250 / ${clamp(al * core).toFixed(3)})`);
        grd.addColorStop(0.7, `rgb(206 220 236 / ${clamp(al * core * 0.6).toFixed(3)})`);
        grd.addColorStop(1, "rgb(206 220 236 / 0)");
        g.strokeStyle = grd;
        g.lineWidth = Math.max(0.8, w0 * wide);
        g.beginPath();
        g.moveTo(x, yA);
        const steps = 8;
        for (let q = 1; q <= steps; q++) {
          const s = q / steps;
          g.lineTo(x + (nf(s * 4 - t * 1.2 + seed, seed + 40) - 0.5) * w0 * 1.6 * s, lerp(yA, yHead, s));
        }
        g.stroke();
      }
    }
    // Where it punches into the storm: a broad glow under the deck, and a shock ring as it first hits.
    if (grow >= 1) {
      const hit = since - CLIMB;
      const rx = w0 * 16 * (0.55 + 0.45 * ease(seg(hit, 0, 1.6)));
      const ry = rx * 0.17;
      const gl = g.createRadialGradient(x, yDeck, 0, x, yDeck, rx);
      gl.addColorStop(0, `rgb(200 214 230 / ${clamp(0.32 * ion).toFixed(3)})`);
      gl.addColorStop(1, "rgb(200 214 230 / 0)");
      g.save();
      g.translate(x, yDeck);
      g.scale(1, ry / rx);
      g.translate(-x, -yDeck);
      g.fillStyle = gl;
      g.fillRect(x - rx, yDeck - rx, rx * 2, rx * 2);
      if (hit < 1.2) {
        const k = hit / 1.2;
        g.strokeStyle = `rgb(220 230 242 / ${(0.35 * (1 - k) * dim).toFixed(3)})`;
        g.lineWidth = Math.max(1, w0 * 0.5) * (ry / rx) ** -0.5;
        g.beginPath();
        g.arc(x, yDeck, rx * (0.3 + 1.2 * easeOut(k)), 0, TAU);
        g.stroke();
      }
      g.restore();
    }
    g.restore();
  }

  function drawPlumes(g: CanvasRenderingContext2D, v: View, t: number, fog: Fog, vapour: number): void {
    for (let i = 0; i < 3; i++) {
      const s = SPIRE_PLACES[i]!;
      const since = t - fire[i]!;
      if (since <= 0) continue;
      const y0w = (1 - BURY) * s.L;
      const above = since > CLIMB ? (1 - sky.coverOver(i, t)) * 10 : 0;
      const x = project(v, s.X, y0w, s.Z, P)[0];
      const yA = P[1];
      const yDeck = project(v, s.X, CEIL, s.Z, P)[1];
      const yTop = project(v, s.X, CEIL + above, s.Z, P)[1];
      const w0 = clamp((v.f * 0.13) / s.Z, 3, 36);
      const power = (1 + 0.8 * Math.exp(-since * 2)) * (0.92 + 0.08 * Math.sin(t * 6 + i * 2));
      plume(g, x, yA, yDeck, yTop, w0, since, power, vapour, t, i * 11 + 3, 1 - fogA(s.Z, fog) * 0.45);
    }
    for (let k = 0; k < farN; k++) {
      const since = t - farFire[k]!;
      if (since <= 0) continue;
      const p = FAR_PLACES[k]!;
      const X = p.u * p.Z;
      const x = project(v, X, FAR_H, p.Z, P)[0];
      if (x < -60 || x > v.w + 60) continue;
      const yA = P[1];
      const yDeck = project(v, X, CEIL, p.Z, P)[1];
      // Up through the storm, and on into the sky as it clears.
      const yTop = yDeck - v.f * 0.6 * smooth(5, 9, t);
      plume(g, x, yA, Math.min(yDeck, yA - 30), yTop, clamp((v.f * 0.14) / p.Z, 1.2, 6), since, 0.85, vapour, t, 50 + k * 7, 0.75);
    }
  }

  // ---- The far volcano's smoke: dark, it thins and dies away as the air clears.
  function drawSmoke(g: CanvasRenderingContext2D, v: View, t: number, Z: number): void {
    const k = 1 - smooth(5.2, 8.6, t);
    if (k <= 0.01) return;
    const x0 = v.cx + v.f * (VOLCANO_U - v.camX / Z - v.pan);
    const y0 = v.hy + v.f * volcanoTop();
    const s = v.f * 0.01;
    g.save();
    for (let j = 0; j < 16; j++) {
      const ph = (((t * 0.22 + j / 16) % 1) + 1) % 1;
      const x = x0 + s * (ph * 11 + 1.2 * Math.sin(j * 2.1 + t * 0.3) * ph);
      const y = y0 - s * (ph * 7 + 0.3);
      const r = s * (0.7 + ph * 3.4);
      g.globalAlpha = clamp(k * 0.5 * Math.sin(Math.PI * Math.min(1, ph * 1.15)) * (1 - ph * 0.4));
      g.drawImage(tex!.puffSmoke, x - r, y - r, r * 2, r * 2);
    }
    g.restore();
  }

  /** A band of streaks across the picture (repeating), moved sideways by `off` px. */
  function band(g: CanvasRenderingContext2D, img: HTMLCanvasElement, w: number, y: number, hgt: number, tw: number, off: number, alpha: number): void {
    if (alpha < 0.01 || hgt < 2) return;
    const x0 = ((off % tw) + tw) % tw - tw;
    g.globalAlpha = clamp(alpha);
    for (let x = x0; x < w; x += tw) g.drawImage(img, x, y, tw + 0.5, hgt);
    g.globalAlpha = 1;
  }

  // ---- The air: the howling dust storm, then condensation rain and the mist on the valley floor.
  function drawAir(g: CanvasRenderingContext2D, v: View, t: number, fog: Fog): void {
    const { w, h, f, hy } = v;
    const T = tex!;
    const st = fog.storm;
    if (st > 0.01) {
      g.save();
      // A veil of dust over everything; bands of it torn sideways at three depths.
      g.fillStyle = rgba(STORM_FOG, 0.16 * st);
      g.fillRect(0, 0, w, h);
      band(g, T.dust, w, hy - f * 0.2, f * 0.32, w * 0.9, t * w * 0.12, 0.6 * st);
      band(g, T.dust, w, hy - f * 0.1, f * 0.4, w * 1.4, t * w * 0.3 + w * 0.3, 0.5 * st);
      band(g, T.dust, w, hy - f * 0.02, f * 0.7, w * 2.2, t * w * 0.62 + w * 0.7, 0.38 * st);
      g.strokeStyle = "rgb(190 140 98)";
      g.lineCap = "round";
      for (const d of streaks) {
        const x = ((((d.x + t * d.sp) % 1.3) + 1.3) % 1.3) * w * 1.1 - w * 0.15;
        const y = d.y * h + Math.sin(t * 0.9 + d.x * 9) * 5;
        g.globalAlpha = 0.2 * d.z * st;
        g.lineWidth = 0.5 + d.z * 0.9;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - d.len * d.z, y + d.len * 0.05);
        g.stroke();
      }
      g.restore();
    }
    // Condensation mist hugging the valley floor and the canyon.
    const mist = smooth(5.4, 8.2, t) * (1 - 0.4 * smooth(10.5, 14, t));
    if (mist > 0.01) {
      g.save();
      band(g, T.mist, w, hy - f * 0.02, f * 0.07, w * 1.2, (t - 5) * w * 0.012, 0.75 * mist);
      band(g, T.mist, w, hy + f * 0.01, f * 0.13, w * 1.7, -(t - 5) * w * 0.018 + w * 0.4, 0.55 * mist);
      band(g, T.mist, w, hy + f * 0.07, f * 0.22, w * 2.4, (t - 5) * w * 0.025 + w * 0.9, 0.3 * mist);
      for (const b of mistBands) {
        const u = ((((b.u + t * b.sp) % 3) + 4.5) % 3) - 1.5;
        const x = v.cx + v.f * (u - v.camX / b.Z - v.pan);
        const y = v.hy + (v.f * (HC - b.Y)) / b.Z;
        const rx = v.f * b.wide;
        const ry = Math.max(3, (v.f * 0.06) / b.Z);
        g.globalAlpha = clamp(0.35 * mist);
        g.drawImage(T.puffVapour[0]!, x - rx, y - ry, rx * 2, ry * 2);
      }
      g.restore();
    }
    // Rain.
    const rainK = smooth(RAIN[0], RAIN[1], t) * (1 - smooth(RAIN[1] + 1.7, RAIN[2], t));
    if (rainK > 0.01) {
      g.save();
      g.lineCap = "butt";
      g.strokeStyle = `rgb(186 200 212 / ${(0.22 * rainK).toFixed(3)})`;
      g.lineWidth = 0.8;
      g.beginPath();
      for (const d of rain) {
        const y = ((((d.ph + t * d.sp) % 1) + 1) % 1) * h * 1.15 - h * 0.075;
        const x = d.x * (w + h * 0.3) - h * 0.15 + y * 0.18;
        const len = d.len * h * d.z;
        g.moveTo(x, y);
        g.lineTo(x - len * 0.18, y - len);
      }
      g.stroke();
      g.restore();
    }
  }

  // ---- Light: crepuscular rays through the eye; the sun's glare and an anamorphic flare.
  function drawLight(g: CanvasRenderingContext2D, v: View, t: number, sunK: number, fog: Fog): void {
    const [sx, sy] = sky.sunAt(v);
    const { w, h } = v;
    if (sunK <= 0.01) return;
    g.save();
    g.globalCompositeOperation = "screen";
    // Shafts of hard cold light fanning down over the ridges; strongest while there is dust to show them.
    const dusty = 0.35 + 0.65 * (1 - smooth(5.5, 10, t));
    const rays = 0.11 * sunK * dusty * (1 - 0.4 * smooth(11, 14, t));
    for (let k = 0; k < 15; k++) {
      const a = Math.PI / 2 + (k / 14 - 0.45) * 1.5 + 0.025 * Math.sin(t * 0.3 + k * 1.7);
      const wd = 0.008 + 0.03 * hash(k, 3, 1);
      const len = h * (1.0 + 0.7 * hash(k, 5, 2));
      const flick = 0.45 + 0.55 * nf(k * 13 + 5, t * 0.6 + k);
      const grd = g.createRadialGradient(sx, sy, 0, sx, sy, len);
      grd.addColorStop(0, `rgb(226 234 242 / ${(rays * flick).toFixed(3)})`);
      grd.addColorStop(0.45, `rgb(200 214 226 / ${(rays * flick * 0.5).toFixed(3)})`);
      grd.addColorStop(1, "rgb(200 214 226 / 0)");
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + Math.cos(a - wd) * len, sy + Math.sin(a - wd) * len);
      g.lineTo(sx + Math.cos(a + wd) * len, sy + Math.sin(a + wd) * len);
      g.closePath();
      g.fill();
    }
    // The sun's glare.
    const shows = clamp(sky.sunShows(t));
    const fl = sunK * shows * (1 - 0.3 * fog.storm);
    const r = v.f * 0.2;
    g.globalAlpha = 0.5 * fl;
    g.drawImage(tex!.cold, sx - r, sy - r, r * 2, r * 2);
    g.globalAlpha = 1;
    // The anamorphic streak: long, thin, faintly blue.
    for (const [hh, al, ww] of [
      [30, 0.035, 1.5],
      [7, 0.1, 1.2],
      [1.3, 0.55, 0.95],
    ] as const) {
      const sw = w * ww;
      const grd = g.createLinearGradient(sx - sw / 2, 0, sx + sw / 2, 0);
      grd.addColorStop(0, "rgb(150 190 240 / 0)");
      grd.addColorStop(0.5, `rgb(200 222 250 / ${(al * fl).toFixed(3)})`);
      grd.addColorStop(1, "rgb(150 190 240 / 0)");
      g.fillStyle = grd;
      g.fillRect(sx - sw / 2, sy - hh / 2, sw, hh);
    }
    // Ghosts along the line through the middle of the lens.
    const cx = w / 2;
    const cy = h / 2;
    for (const [k, rr, a] of [
      [0.55, 0.025, 0.08],
      [0.92, 0.055, 0.05],
      [1.35, 0.03, 0.07],
      [1.75, 0.09, 0.035],
    ] as const) {
      const gx = sx + (cx - sx) * k;
      const gy = sy + (cy - sy) * k;
      const rad = v.f * rr;
      g.globalAlpha = a * fl;
      g.drawImage(k > 1 ? tex!.ghostB : tex!.ghostA, gx - rad, gy - rad, rad * 2, rad * 2);
    }
    g.restore();
  }

  // ---- The lens: vignette, faint colour fringes at the edges, film grain.
  function drawLens(g: CanvasRenderingContext2D, w: number, h: number, t: number, quality: number): void {
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.hypot(w, h) * 0.6);
    vg.addColorStop(0, "rgb(3 4 6 / 0)");
    vg.addColorStop(0.7, "rgb(3 4 6 / 0.32)");
    vg.addColorStop(1, "rgb(3 4 6 / 0.7)");
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    const cv = g.canvas as HTMLCanvasElement;
    const W = cv.width;
    const H = cv.height;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    // Colour fringes: the red of the picture laid back a little larger than the rest, so the edges split.
    if (quality >= 0.75 && W > 200) {
      if (!ca || ca.width !== W || ca.height !== H) {
        ca = document.createElement("canvas");
        ca.width = W;
        ca.height = H;
      }
      const cg = ca.getContext("2d")!;
      cg.globalCompositeOperation = "copy";
      cg.drawImage(cv, 0, 0);
      cg.globalCompositeOperation = "multiply";
      cg.fillStyle = "#f00";
      cg.fillRect(0, 0, W, H);
      g.globalCompositeOperation = "multiply";
      g.fillStyle = "#0ff";
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = "lighter";
      const s = 0.0028;
      g.drawImage(ca, (-W * s) / 2, (-H * s) / 2, W * (1 + s), H * (1 + s));
    }
    // Grain: one of four baked frames, moved to a fixed place for each 1/24 s.
    const fr = Math.floor(t * 24);
    const tile = tex!.grain[fr & 3]!;
    const ox = Math.floor(hash(fr, 1, 2) * 256);
    const oy = Math.floor(hash(fr, 3, 4) * 256);
    g.globalCompositeOperation = "overlay";
    g.globalAlpha = 0.085;
    g.fillStyle = g.createPattern(tile, "repeat")!;
    g.translate(-ox, -oy);
    g.fillRect(ox, oy, W, H);
    g.restore();
  }

  return {
    horizon: () => lastHy,
    prepare(budget) {
      if (valley && !prepared) prepared = valley.prepare(budget);
    },
    draw(g, w, h, time, free, quality = 1) {
      if (!(w >= 2 && h >= 2)) return;
      const t = Math.max(0, time);
      const scale = Math.max(0.5, g.getTransform().a || 1);
      tex ??= bake();
      ensureValley(w, h, scale, t);
      if (!prepared && t > 6.2) prepared = valley!.prepare(Infinity);

      // Each plume fires with a heavy jolt: the picture barely moves.
      let nudge = 0;
      for (const at of fire) {
        const age = t - at;
        if (age > 0 && age < 0.8) nudge += 0.5 * Math.exp(-age * 6);
      }
      const v = viewAt(t, w, h, free, Math.min(1, nudge));
      lastHy = v.hy;
      const sunShows = sky.sunShows(t);
      const sunK = clamp(sunShows * smooth(SUN_AT - 0.9, SUN_AT + 0.4, t));
      const day = smooth(6.5, 10.5, t);
      const fog = fogAt(t);
      const vapour = smooth(7.5, 10.5, t);

      g.fillStyle = "#050607";
      g.fillRect(0, 0, w, h);
      sky.draw(g, v, t, clamp(w / 300, 3, 5) / Math.sqrt(clamp(quality, 0.3, 1)));
      const crestK = sunK * (0.75 - 0.45 * day);
      const L = valley!.layers;
      const layer = (id: Layer["id"]) => L.find((l) => l.id === id);
      const far = layer("far");
      if (far) {
        drawLayer(g, far, v, t, crestK * 0.4, fog, 30);
        drawSmoke(g, v, t, far.Z);
      }
      // Haze where the sky meets the land.
      const hz = g.createLinearGradient(0, v.hy - v.f * 0.1, 0, v.hy + v.f * 0.02);
      const hc = mix(fog.rgb, [140, 152, 160], 0.35 * day);
      hz.addColorStop(0, rgba(hc, 0));
      hz.addColorStop(0.75, rgba(hc, 0.5 + 0.3 * fog.storm));
      hz.addColorStop(1, rgba(hc, 0));
      g.fillStyle = hz;
      g.fillRect(0, v.hy - v.f * 0.1, w, v.f * 0.12);
      drawFarSpires(g, v, t, fog, sunK);
      const floor = layer("floor");
      if (floor) drawLayer(g, floor, v, t, 0, fog, 0);
      const [sx] = sky.sunAt(v);
      drawWater(g, v, t, sx, sunK);
      floorFog(g, v, fog);
      // By distance: the far spire, the great one, the right ridge, the near spire, the left ridge, the rocks in front.
      drawSpire(g, v, 2, t, sunK, fog, vapour, quality);
      drawSpire(g, v, 0, t, sunK, fog, vapour, quality);
      for (const [id, spire] of [
        ["ridgeR", 1],
        ["ridgeL", -1],
        ["near", -1],
      ] as const) {
        const l = layer(id);
        if (l) drawLayer(g, l, v, t, crestK, fog, l.Z);
        if (spire >= 0) drawSpire(g, v, spire, t, sunK, fog, vapour, quality);
      }
      drawLight(g, v, t, sunK, fog);
      drawPlumes(g, v, t, fog, vapour);
      drawAir(g, v, t, fog);
      // A cold, hard grade over the clear world: the shadows sink a little.
      if (day > 0.01) {
        g.save();
        g.globalCompositeOperation = "multiply";
        g.fillStyle = `rgb(${lerp(255, 236, day) | 0} ${lerp(255, 242, day) | 0} ${lerp(255, 248, day) | 0})`;
        g.fillRect(0, 0, w, h);
        g.restore();
      }
      drawLens(g, w, h, t, quality);
      if (nudge > 0.01) {
        g.fillStyle = `rgb(214 226 240 / ${Math.min(0.06, nudge * 0.08).toFixed(3)})`;
        g.fillRect(0, 0, w, h);
      }
      const open = 1 - seg(t, 0, 0.8);
      if (open > 0) {
        g.fillStyle = `rgb(2 3 4 / ${open.toFixed(3)})`;
        g.fillRect(0, 0, w, h);
      }
    },
  };
}
