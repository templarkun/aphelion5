/**
 * Sunforge (designer 2026-11-28: "Create a spectacular end-of-campaign victory outro animation. Put
 * more effort into it. Be ambitious."), a victory outro, the longest: the Company seals the system's
 * star inside a shell of hexagonal panels and lights it.
 *
 * Act 1: a blazing star (boiling surface, limb darkening, corona streamers, prominences of looping
 * particles); the Flagship glides past in silhouette, rim-lit by the star, and releases its
 * construction swarm, a stream of drones that falls into orbit round the star. Act 2: the swarm builds
 * the shell, a Goldberg sphere of 362 panels (forgeShell.ts): panels fly in and lock with weld sparks,
 * the poles first; the star's light is squeezed into a narrowing belt round the equator and shines out
 * as beams through the gaps; the seams glow with trapped starlight. Act 3: one keystone per mission won
 * flies in and closes the last gaps, each with its tag; the beams go out one by one; total eclipse,
 * only the keystones glowing; the shell thrums twice in the dark. Act 4: ignition: the seams light in
 * the Company's colour from pole to pole, energy runs to the poles, polar jets erupt, a white flash,
 * the picture shakes, a shock ring runs out through the camera. Act 5: the camera pulls far back over
 * the system; a beam from the shell reaches one world per mission won and its orbit lights; a lattice
 * of the Company's light spreads across the system while the Debrief slides in.
 *
 * A real perspective camera on a plain 2D canvas (no WebGL). The Company lends its colours; it suits
 * any Company and any Campaign. Everything is worked out from the film time alone (a skip, a still).
 */

import type { CampaignStats, CompanyTheme } from "../types.js";
import { frameOf, glow, grain, lerp, rgba, rgbOf, smooth, sprite, vignette, type FreeArea, type LossScene } from "../loss/kit.js";
import { buildShell, worldOf, type V3 } from "./forgeShell.js";
import {
  FORGE,
  FORGE_TILES,
  forgePull,
  forgeShake,
  hash01,
  igniteAt,
  jetLength,
  keysBy,
  keystoneTimes,
  latticeReach,
  panelLockAt,
  panelsBy,
  relayTimes,
  shockRadius,
  worldCount,
} from "./timeline.js";

const T = FORGE;
const TAU = Math.PI * 2;
type C3 = [number, number, number];

/** The star's radius is 1 world unit; the shell's RS. */
const RS = 1.2;
/** The camera's distance: close (acts 1-4) and far (act 5). */
const D_NEAR = 3.9;
const D_FAR = 58;
/** The lattice: hexagon size and how far out it reaches (world units). */
const HEX = 2.5;
const LATTICE_R = 30;

const mix = (a: C3, b: C3, k: number): C3 => [Math.round(lerp(a[0], b[0], k)), Math.round(lerp(a[1], b[1], k)), Math.round(lerp(a[2], b[2], k))];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const addV = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normV = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

interface Cam {
  pos: V3;
  right: V3;
  up: V3;
  fwd: V3;
}

/** The Flagship's outline, side view, nose to the right (ship units: length 1). */
const HULL: [number, number][] = [
  [0.5, 0.0], [0.36, -0.04], [0.16, -0.07], [0.02, -0.08], [-0.02, -0.15], [-0.16, -0.16], [-0.2, -0.09],
  [-0.4, -0.085], [-0.5, -0.05], [-0.5, 0.055], [-0.4, 0.1], [-0.06, 0.1], [0.04, 0.13], [0.18, 0.13], [0.22, 0.07], [0.38, 0.035],
];

/** World colours for the system's planets: rock, ice, ochre, gas, rust. */
const WORLD_COLS: C3[] = [
  [150, 132, 118],
  [170, 200, 225],
  [196, 160, 98],
  [120, 150, 200],
  [170, 96, 70],
  [140, 170, 150],
];

export function createSunforgeScene({ theme, stats }: { theme: CompanyTheme; stats: CampaignStats }): LossScene {
  const own = rgbOf(theme.primary);
  const own2 = rgbOf(theme.secondary);
  const glowC = rgbOf(theme.glow);
  const hullC = rgbOf(theme.hull);
  const white: C3 = [255, 255, 255];
  const starC: C3 = [255, 196, 120];
  const starHot: C3 = [255, 238, 205];
  const starDeep: C3 = [255, 110, 40];
  const missions = stats.missions.length ? stats.missions : [{ id: "", label: "", tag: "", threat: ["A"] }];
  const n = missions.length;
  const tiles = buildShell(n);
  const keyAt = keystoneTimes(n);
  const lockAt = tiles.map((tl) => (tl.key >= 0 ? keyAt[tl.key]! : panelLockAt(tl.rank, n)));
  const flyOf = tiles.map((tl) => (tl.key >= 0 ? 0.75 : T.PANEL_FLY));
  const ignAt = tiles.map((tl) => igniteAt(tl.c[1]));
  const keyTiles = tiles.filter((tl) => tl.key >= 0).sort((a, b) => a.key - b.key);
  const nWorlds = worldCount(n);
  const relays = relayTimes(n);

  // Far stars: directions on the sky, with brightness and a colour class.
  const sky = Array.from({ length: 1300 }, (_, k) => {
    const y = 1 - 2 * hash01(k * 3 + 1);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = hash01(k * 5 + 2) * TAU;
    return { d: [Math.cos(a) * r, y, Math.sin(a) * r] as V3, b: Math.pow(hash01(k * 7 + 3), 2.2), cls: hash01(k * 11 + 4) < 0.25 ? 1 : 0, rank: hash01(k * 13 + 5) };
  });
  // The construction drones.
  const DRONES = 760;
  const drones = Array.from({ length: DRONES }, (_, k) => ({
    rel: T.SWARM_AT + (T.SWARM_SPAN * k) / DRONES,
    ro: 1.55 + hash01(k * 17 + 1) * 0.75,
    inc: (hash01(k * 19 + 2) - 0.5) * 0.9,
    ph: hash01(k * 23 + 3) * TAU,
    off: (hash01(k * 29 + 4) - 0.5) * 0.12,
    gone: T.PANEL_AT + 0.5 + (T.PANEL_END - T.PANEL_AT - 0.4) * hash01(k * 31 + 5),
    rank: hash01(k * 37 + 6),
    col: k % 5,
  }));
  // Prominences on the star's limb (screen angles), and the corona's streamers.
  const proms = Array.from({ length: 6 }, (_, k) => ({ a: hash01(k * 41 + 1) * TAU, span: 0.18 + hash01(k * 43 + 2) * 0.2, h: 0.18 + hash01(k * 47 + 3) * 0.22, ph: hash01(k * 53 + 4) * TAU }));
  const streamers = Array.from({ length: 48 }, (_, k) => ({ a: (k / 48) * TAU + hash01(k * 59) * 0.1, len: 0.6 + hash01(k * 61) * 1.6, w: 0.02 + hash01(k * 67) * 0.05 }));
  // The lattice of the Company's light: hexagon middles in the system's plane, nearest first.
  const lattice: { x: number; z: number; d: number }[] = [];
  for (let q = -14; q <= 14; q++) {
    for (let r = -14; r <= 14; r++) {
      const x = HEX * 1.5 * q;
      const z = HEX * Math.sqrt(3) * (r + q / 2);
      const d = Math.hypot(x, z);
      if (d < LATTICE_R && d > HEX * 1.2) lattice.push({ x, z, d });
    }
  }
  lattice.sort((a, b) => a.d - b.d);

  // Pictures painted once: the nebula, the star's boiling surface.
  let nebula: HTMLCanvasElement | undefined;
  function nebulaOf(): HTMLCanvasElement {
    if (nebula) return nebula;
    nebula = document.createElement("canvas");
    nebula.width = 512;
    nebula.height = 256;
    const q = nebula.getContext("2d")!;
    q.globalCompositeOperation = "lighter";
    for (let k = 0; k < 44; k++) {
      const x = hash01(k * 31) * 512;
      const y = 60 + hash01(k * 37) * 140;
      const r = 30 + hash01(k * 41) * 110;
      const c: C3 = k % 4 === 0 ? glowC : k % 4 === 1 ? [120, 70, 160] : k % 4 === 2 ? [60, 90, 170] : [170, 90, 70];
      const gr = q.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, rgba(c, 0.05 + hash01(k * 43) * 0.07));
      gr.addColorStop(1, rgba(c, 0));
      q.fillStyle = gr;
      q.fillRect(0, 0, 512, 256);
    }
    return nebula;
  }
  let surface: HTMLCanvasElement | undefined;
  function surfaceOf(): HTMLCanvasElement {
    if (surface) return surface;
    surface = document.createElement("canvas");
    surface.width = 512;
    surface.height = 256;
    const q = surface.getContext("2d")!;
    q.fillStyle = "rgb(128,128,128)";
    q.fillRect(0, 0, 512, 256);
    // Granules: bright cells with dark lanes, in three sizes; a few spots; tiles sideways.
    for (let k = 0; k < 2600; k++) {
      const big = k < 260;
      const x = hash01(k * 7 + 1) * 512;
      const y = hash01(k * 11 + 2) * 256;
      const r = big ? 10 + hash01(k * 13) * 18 : 2 + hash01(k * 13) * 5;
      const v = hash01(k * 17 + 3);
      for (const dx of [-512, 0, 512]) {
        const gr = q.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        const c = v > 0.45 ? 255 : 20;
        gr.addColorStop(0, `rgba(${c},${c},${c},${big ? 0.12 : 0.3})`);
        gr.addColorStop(1, `rgba(${c},${c},${c},0)`);
        q.fillStyle = gr;
        q.fillRect(x + dx - r, y - r, r * 2, r * 2);
      }
    }
    return surface;
  }

  /** The camera at film time t. */
  function camAt(t: number): Cam {
    const pull = forgePull(t);
    const late = Math.max(0, t - T.PULL_END);
    const d0 = D_NEAR - 0.55 * smooth(1.5, 10.5, t) + 0.25 * smooth(T.IGNITE_AT, T.JETS_AT + 1, t);
    const dist = d0 * Math.pow(D_FAR / d0, pull) * (1 + late * 0.008);
    const yaw = 0.7 + t * 0.045 + 0.55 * smooth(4, 11.5, t) + 0.9 * smooth(0, 1, pull) + late * 0.02;
    const pitch = 0.14 + 0.16 * smooth(4.5, 11, t) - 0.08 * smooth(T.IGNITE_AT - 1, T.JETS_AT, t) + 0.78 * smooth(0.1, 1, pull);
    const cp = Math.cos(pitch);
    const pos: V3 = [dist * cp * Math.sin(yaw), dist * Math.sin(pitch), dist * cp * Math.cos(yaw)];
    const fwd = normV(scale(pos, -1));
    const right: V3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const up: V3 = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    return { pos, right, up, fwd };
  }

  /** Where drone k is in its orbit at film time t (world). */
  function orbitOf(k: number, t: number): V3 {
    const d = drones[k]!;
    const a = d.ph + t * (0.55 / Math.pow(d.ro, 1.5));
    const x = Math.cos(a) * d.ro;
    const z = Math.sin(a) * d.ro;
    return [x, z * Math.sin(d.inc) + d.off, z * Math.cos(d.inc)];
  }

  return {
    draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, free: FreeArea | undefined, quality: number): void {
      const fr = frameOf(w, h, free, smooth(T.DEBRIEF_AT - 0.2, T.DEBRIEF_AT + 1.0, t));
      const pull = forgePull(t);
      const cam = camAt(t);
      const F = fr.s * 0.95;
      // Act 1 keeps the star to the right of the middle (the Flagship passes on the left).
      const ox = fr.s * 0.17 * (1 - smooth(3.2, 8, t));
      const oy = -fr.s * 0.03 * (1 - smooth(3.2, 8, t));
      const shake = forgeShake(t);
      const sx = shake > 0.01 ? (hash01(Math.floor(t * 60)) - 0.5) * fr.s * 0.035 * shake : 0;
      const sy = shake > 0.01 ? (hash01(Math.floor(t * 60) + 999) - 0.5) * fr.s * 0.035 * shake : 0;
      const cx = fr.cx + ox + sx;
      const cy = fr.cy + oy + sy;
      /** World -> picture: [x, y, points per world unit there, depth], or undefined behind the camera. */
      const P = (q: V3): [number, number, number, number] | undefined => {
        const vx = q[0] - cam.pos[0];
        const vy = q[1] - cam.pos[1];
        const vz = q[2] - cam.pos[2];
        const z = vx * cam.fwd[0] + vy * cam.fwd[1] + vz * cam.fwd[2];
        if (z < 0.08) return undefined;
        const k = F / z;
        return [cx + (vx * cam.right[0] + vy * cam.right[1] + vz * cam.right[2]) * k, cy - (vx * cam.up[0] + vy * cam.up[1] + vz * cam.up[2]) * k, k, z];
      };
      const spOwn = sprite(own);
      const spOwn2 = sprite(own2);
      const spGlow = sprite(glowC);
      const spWhite = sprite(white);
      const spStar = sprite(starC);
      const spHot = sprite(starHot);
      const spDeep = sprite(starDeep);
      const fadeIn = smooth(0, 1.1, t);

      // How much of the shell is closed, and how much starlight still gets out.
      const locked = panelsBy(t, n) + keysBy(t, n);
      const cover = locked / FORGE_TILES;
      const dark = t >= T.DARK_AT;
      const open = dark ? 0 : Math.max(0, 1 - cover);
      const lit = t >= T.IGNITE_AT;
      const jetK = smooth(T.JETS_AT - 0.05, T.JETS_AT + 0.25, t);
      const after = t - T.JETS_AT;
      const thrum = T.THRUM.reduce((s, at) => s + (t >= at ? Math.exp(-(t - at) * 4) : 0), 0);
      const O = P([0, 0, 0]);
      const Rpx = O ? O[2] : 0;

      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
      g.fillStyle = "#010208";
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "lighter";

      // ---- The sky: the nebula and the far stars, turning with the camera. Eyes adapt in the dark. ----
      const yawNow = Math.atan2(cam.pos[0], cam.pos[2]);
      const adapt = lerp(0.45, 1, smooth(T.PANEL_AT + 3, T.DARK_AT, t)) * (1 - 0.35 * jetK * Math.exp(-Math.max(0, after) * 0.5)) * fadeIn;
      const nb = nebulaOf();
      const nbW = Math.max(w, h) * 2.4;
      const nbX = (((-yawNow / TAU) * nbW) % nbW + nbW) % nbW;
      g.globalAlpha = 0.9 * adapt;
      for (const x0 of [nbX - nbW, nbX]) g.drawImage(nb, x0, cy - nbW * 0.25 - cam.fwd[1] * h * 0.6, nbW, nbW * 0.5);
      for (const s of sky) {
        if (s.rank > 0.55 + quality * 0.45) continue;
        const z = dot(s.d, cam.fwd);
        if (z < 0.05) continue;
        const k = F / z;
        const x = cx + dot(s.d, cam.right) * k;
        const y = cy - dot(s.d, cam.up) * k;
        if (x < 0 || y < 0 || x > w || y > h) continue;
        const tw = 0.75 + 0.25 * Math.sin(t * 2.3 + s.rank * 40);
        g.globalAlpha = Math.min(1, (0.15 + s.b * 0.9) * tw * adapt);
        g.fillStyle = s.cls ? "rgb(255,214,180)" : "rgb(205,220,255)";
        const sz = s.b > 0.7 ? 2 : 1.2;
        g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
      g.globalAlpha = 1;

      // ---- Act 5: the system's orbits, the lattice, the worlds (in the plane y = 0, round the shell). ----
      const sysV = smooth(T.PULL_AT + 0.4, T.PULL_AT + 2.4, t);
      if (sysV > 0) drawSystem(g, P, t, sysV, quality, fr.s);

      // ---- The shell. Back tiles (seen from inside through the gaps) first, then the front. ----
      type Drawn = { i: number; front: boolean; behind: boolean; pts: [number, number][]; c: [number, number, number, number]; facing: number; u: number };
      const drawn: Drawn[] = [];
      for (let i = 0; i < tiles.length; i++) {
        const tl = tiles[i]!;
        const lk = lockAt[i]!;
        const fly = flyOf[i]!;
        if (t < lk - fly) continue;
        const u = Math.min(1, (t - (lk - fly)) / fly);
        // In flight: from the swarm (or from far out, for a keystone) to its place, growing as it comes.
        let ctr: V3;
        let sc = 1;
        if (u < 1) {
          const e = 1 - Math.pow(1 - u, 3);
          const from: V3 = tl.key >= 0 ? addV(scale(tl.c, 4.2), [0, 1.4, 0]) : scale(normV(addV(tl.c, [(hash01(i * 3) - 0.5) * 1.2, (hash01(i * 5) - 0.5) * 0.8, (hash01(i * 7) - 0.5) * 1.2])), 2.2);
          const side = Math.sin(e * Math.PI) * 0.35;
          ctr = addV(addV(scale(from, 1 - e), scale(tl.c, RS * e)), [side * Math.cos(i), side * 0.3, side * Math.sin(i)]);
          sc = 0.35 + 0.65 * e;
        } else ctr = scale(tl.c, RS);
        const pc = P(ctr);
        if (!pc) continue;
        const pts: [number, number][] = [];
        let ok = true;
        for (const cn of tl.corners) {
          const q = P(addV(ctr, addV(scale(cn, RS), scale(tl.c, -RS)), sc));
          if (!q) {
            ok = false;
            break;
          }
          pts.push([q[0], q[1]]);
        }
        if (!ok) continue;
        const toCam = normV(addV(cam.pos, ctr, -1));
        const facing = dot(tl.c, toCam);
        // Behind the star: a locked tile on the far side, or one still flying that is farther than the star's middle.
        const behind = u >= 1 ? facing <= 0 : !!O && pc[3] > O[3] && !dark;
        drawn.push({ i, front: facing > 0, behind, pts, c: pc, facing, u });
      }

      // Back tiles: their inner faces, lit warm by the star (before the eclipse) through the gaps.
      if (!lit) {
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 1;
        for (const d of drawn) {
          if (!d.behind) continue;
          if (d.u < 1) {
            // A panel flying behind the star: a dark plate with the Company's edge.
            g.fillStyle = rgba(mix([10, 12, 16], hullC, 0.2), 1);
            poly(g, d.pts);
            g.fill();
            g.strokeStyle = rgba(own, 0.7);
            g.lineWidth = 1;
            g.stroke();
            continue;
          }
          // The inside of the far side: brightest where we look straight at it, the panels' ribs dark.
          const inner = dark ? 0.02 : (0.18 + 0.5 * open) * (0.45 + 0.55 * Math.max(0, -d.facing));
          const vary = 0.85 + 0.3 * hash01(d.i * 19 + 7);
          g.fillStyle = rgba(mix([34, 12, 4], mix(starDeep, starC, inner), Math.min(1, inner * 1.6 * vary)), 1);
          poly(g, d.pts);
          g.fill();
          g.strokeStyle = "rgba(8,4,2,0.85)";
          g.lineWidth = Math.max(1, d.c[2] * 0.014);
          g.stroke();
        }
        g.globalCompositeOperation = "lighter";
      }

      // ---- The star (until the eclipse): corona, streamers, prominences, the boiling disc. ----
      if (O && !dark && Rpx > 0) {
        const [x0, y0] = O;
        const R = Rpx;
        const outA = 0.2 + 0.8 * open;
        glow(g, spStar, x0, y0, R * 4.2, 0.45 * outA * fadeIn);
        glow(g, spHot, x0, y0, R * 2.1, 0.6 * outA * fadeIn);
        // Corona streamers, slowly turning.
        g.save();
        g.translate(x0, y0);
        g.rotate(t * 0.02);
        for (const s of streamers) {
          const len = R * (1 + s.len * (0.85 + 0.15 * Math.sin(t * 0.7 + s.a * 5)));
          const lg = g.createLinearGradient(0, 0, Math.cos(s.a) * len, Math.sin(s.a) * len);
          lg.addColorStop(0.55, rgba(starC, 0.16 * outA * fadeIn));
          lg.addColorStop(1, rgba(starC, 0));
          g.fillStyle = lg;
          g.beginPath();
          g.moveTo(Math.cos(s.a - s.w) * R * 0.9, Math.sin(s.a - s.w) * R * 0.9);
          g.lineTo(Math.cos(s.a) * len, Math.sin(s.a) * len);
          g.lineTo(Math.cos(s.a + s.w) * R * 0.9, Math.sin(s.a + s.w) * R * 0.9);
          g.closePath();
          g.fill();
        }
        g.restore();
        // Prominences: loops of glowing particles rising off the limb, the matter running along them.
        const PM = Math.round(90 * quality) + 20;
        for (const p of proms) {
          const hh = p.h * (0.8 + 0.2 * Math.sin(t * 0.9 + p.ph));
          for (let j = 0; j < PM; j++) {
            const v = j / (PM - 1);
            const ang = p.a - p.span / 2 + p.span * v + t * 0.02;
            const lift = Math.sin(v * Math.PI) * hh;
            const r = R * (1 + lift);
            const flow = 0.5 + 0.5 * Math.sin(v * 14 - t * 5 + p.ph);
            glow(g, j % 4 ? spDeep : spStar, x0 + Math.cos(ang) * r, y0 + Math.sin(ang) * r, R * (0.022 + 0.022 * flow), (0.25 + 0.45 * flow) * outA * fadeIn);
          }
        }
        // The disc: limb-darkened, its surface boiling (two layers of granules drifting apart).
        g.globalCompositeOperation = "source-over";
        const disc = g.createRadialGradient(x0 - R * 0.12, y0 - R * 0.1, 0, x0, y0, R);
        disc.addColorStop(0, rgba(starHot, 1));
        disc.addColorStop(0.6, rgba(starC, 1));
        disc.addColorStop(0.92, rgba(starDeep, 1));
        disc.addColorStop(1, rgba(mix(starDeep, [120, 30, 10], 0.4), 1));
        g.globalAlpha = fadeIn;
        g.fillStyle = disc;
        g.beginPath();
        g.arc(x0, y0, R, 0, TAU);
        g.fill();
        g.save();
        g.clip();
        const sf = surfaceOf();
        g.globalCompositeOperation = "overlay";
        const sw = R * 4;
        for (const [sp, a] of [[0.05, 0.85], [-0.03, 0.55]] as const) {
          const off = (((t * sp * sw) % sw) + sw) % sw;
          g.globalAlpha = a * fadeIn;
          for (const xx of [x0 - R * 2 - off, x0 - R * 2 - off + sw]) g.drawImage(sf, xx, y0 - R, sw, R * 2);
        }
        g.restore();
        g.globalAlpha = 1;
        g.globalCompositeOperation = "lighter";
        glow(g, spHot, x0, y0, R * 1.15, 0.35 * fadeIn);
      }

      // Beams of starlight through the gaps once the shell is mostly closed (a belt, then the keystone holes).
      if (!dark && cover > 0.4) {
        const bA = smooth(0.4, 0.92, cover) * fadeIn;
        const gaps = tiles.map((tl, i) => ({ tl, i })).filter(({ i }) => t < lockAt[i]!);
        const stride = Math.max(1, Math.ceil(gaps.length / (40 * quality + 10)));
        for (let j = 0; j < gaps.length; j += stride) {
          const { tl, i } = gaps[j]!;
          const keyHole = tl.key >= 0 && t >= T.PANEL_END;
          // A hole closing dims as its panel comes in.
          const closing = 1 - smooth(lockAt[i]! - flyOf[i]! * 0.6, lockAt[i]!, t);
          const L = keyHole ? 9 : 3.6;
          const p0 = P(scale(tl.c, RS));
          const p1 = P(scale(tl.c, RS + L));
          if (!p0) continue;
          const wd = p0[2] * RS * 0.13;
          const a = bA * closing * (keyHole ? 1 : 0.55) * Math.min(1, stride * 0.7);
          if (p1) {
            const dx = p1[0] - p0[0];
            const dy = p1[1] - p0[1];
            const ln = Math.hypot(dx, dy) || 1;
            const nx = -dy / ln;
            const ny = dx / ln;
            const w1 = Math.max(wd * 2.6, p1[2] * RS * 0.4);
            const lg = g.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
            lg.addColorStop(0, rgba(starHot, 0.55 * a));
            lg.addColorStop(0.35, rgba(starC, 0.22 * a));
            lg.addColorStop(1, rgba(starC, 0));
            g.fillStyle = lg;
            g.beginPath();
            g.moveTo(p0[0] + nx * wd, p0[1] + ny * wd);
            g.lineTo(p1[0] + nx * w1, p1[1] + ny * w1);
            g.lineTo(p1[0] - nx * w1, p1[1] - ny * w1);
            g.lineTo(p0[0] - nx * wd, p0[1] - ny * wd);
            g.closePath();
            g.fill();
          }
          // Where a gap faces the camera, the light pours straight out at us.
          const toCam = dot(tl.c, normV(addV(cam.pos, scale(tl.c, RS), -1)));
          if (toCam > 0) glow(g, spHot, p0[0], p0[1], wd * (2 + 3 * toCam) * (keyHole ? 1.6 : 1), a * toCam * 0.8);
        }
      }

      // Front tiles: dark plates with seams of trapped starlight; lit in the Company's colour once ignited.
      const keyLight = normV([-0.5, 0.7, 0.4]);
      for (const d of drawn) {
        if (d.behind && !lit) continue;
        if (!d.front && d.u >= 1) continue;
        const tl = tiles[d.i]!;
        const lk = lockAt[d.i]!;
        const ia = ignAt[d.i]!;
        const ig = lit && t >= ia ? 1 - Math.exp(-(t - ia) * 2.6) : 0;
        const front = lit && t >= ia ? Math.exp(-(t - ia) * 5) : 0;
        g.globalAlpha = 1;
        const shade = 0.35 + 0.65 * Math.max(0, d.facing);
        const fill = Math.max(0, dot(tl.c, keyLight));
        const plate = mix(mix([10, 12, 16], hullC, 0.16 + fill * 0.14), white, fill * 0.04);
        g.globalCompositeOperation = "source-over";
        const pulse = jetK > 0 ? 0.75 + 0.25 * Math.sin(t * 6 - tl.c[1] * 4) : 1;
        const litC = mix(mix(own, own2, 0.25 + 0.25 * tl.c[1]), [0, 0, 0], 0.55);
        g.fillStyle = rgba(mix(mix(plate, [0, 0, 0], 1 - shade), mix(litC, [0, 0, 0], 1 - shade * 0.8), ig * 0.75 * pulse), 1);
        poly(g, d.pts);
        g.fill();
        g.globalCompositeOperation = "lighter";
        if (front > 0.01) {
          g.fillStyle = rgba(white, front * 0.7);
          poly(g, d.pts);
          g.fill();
        }
        // Seams: starlight leaking (before the eclipse), the thrum in the dark, then the Company's light.
        const leak = dark ? 0 : (0.25 + 0.6 * smooth(0.2, 0.95, cover)) * fadeIn;
        const weld = d.u >= 1 && t < lk + 0.5 ? 1 - (t - lk) / 0.5 : 0;
        if (ig > 0) {
          g.strokeStyle = rgba(mix(own, white, front * 0.6 + 0.12 * pulse * jetK), Math.min(1, 0.35 + 0.6 * ig * pulse) * (0.45 + 0.55 * Math.max(0, d.facing)));
          g.lineWidth = Math.max(1, d.c[2] * 0.01) * (1 + front * 2);
        } else if (d.u < 1) {
          g.strokeStyle = rgba(own, 0.85);
          g.lineWidth = 1.2;
        } else {
          g.strokeStyle = rgba(starC, Math.min(1, leak * 0.55 + thrum * 0.5 + weld * 0.6));
          g.lineWidth = Math.max(0.8, d.c[2] * 0.008);
        }
        poly(g, d.pts);
        g.stroke();
        // An ignited panel shows its inner circuit: a smaller hexagon in the second colour.
        if (ig > 0.05 && d.c[2] > 40) {
          g.strokeStyle = rgba(own2, 0.3 * ig * pulse * Math.max(0, d.facing));
          g.lineWidth = 1;
          g.beginPath();
          d.pts.forEach(([x, y], k) => {
            const ix = lerp(d.c[0], x, 0.55);
            const iy = lerp(d.c[1], y, 0.55);
            if (k) g.lineTo(ix, iy);
            else g.moveTo(ix, iy);
          });
          g.closePath();
          g.stroke();
        }
        // A keystone glows in the Company's colour from its lock on, an ember through the eclipse.
        g.globalAlpha = 1;
        if (tl.key >= 0 && d.u >= 1 && !lit) {
          const kk = 0.55 + 0.45 * Math.exp(-(t - lk) * 2) + thrum * 0.4;
          g.fillStyle = rgba(own, 0.32 * kk);
          poly(g, d.pts);
          g.fill();
          g.strokeStyle = rgba(own2, 0.9 * kk);
          g.lineWidth = Math.max(1.2, d.c[2] * 0.014);
          g.stroke();
        }
        // A panel in flight trails thruster light.
        if (d.u < 1) glow(g, tl.key >= 0 ? spOwn2 : spOwn, d.c[0], d.c[1], d.c[2] * RS * (tl.key >= 0 ? 0.16 : 0.05), tl.key >= 0 ? 0.9 : 0.6);
        // Weld sparks as it locks.
        if (d.u >= 1 && t < lk + 0.55 && d.facing > 0) {
          const age = t - lk;
          const M = tl.key >= 0 ? Math.round(36 * quality) + 8 : Math.round(7 * quality) + 2;
          for (let j = 0; j < M; j++) {
            const a = hash01(d.i * 13 + j) * TAU;
            const r = d.c[2] * RS * (0.08 + (tl.key >= 0 ? 0.9 : 0.28) * (1 - Math.exp(-age * 6)) * (0.5 + hash01(d.i * 17 + j)));
            glow(g, j % 3 ? spStar : spWhite, d.c[0] + Math.cos(a) * r, d.c[1] + Math.sin(a) * r + age * age * 40, Math.max(1.2, d.c[2] * 0.012), 1 - age / 0.55);
          }
          glow(g, spHot, d.c[0], d.c[1], d.c[2] * RS * (tl.key >= 0 ? 0.5 : 0.14), (1 - age / 0.55) * (tl.key >= 0 ? 1 : 0.7));
          if (tl.key >= 0) {
            g.strokeStyle = rgba(own2, 0.8 * (1 - age / 0.55));
            g.lineWidth = 2;
            g.beginPath();
            g.arc(d.c[0], d.c[1], d.c[2] * RS * (0.15 + age * 1.4), 0, TAU);
            g.stroke();
          }
        }
      }

      // The keystones' tags, from their lock until the shell ignites.
      g.globalCompositeOperation = "source-over";
      for (const tl of keyTiles) {
        const m = missions[tl.key];
        const lk = keyAt[tl.key]!;
        const ta = smooth(lk, lk + 0.3, t) * (1 - smooth(T.IGNITE_AT + 0.6, T.IGNITE_AT + 1.4, t));
        if (ta <= 0 || !m?.tag) continue;
        const toCam = dot(tl.c, normV(addV(cam.pos, scale(tl.c, RS), -1)));
        if (toCam < 0.05) continue;
        const q = P(scale(tl.c, RS * 1.12));
        if (!q) continue;
        g.globalAlpha = ta * Math.min(1, toCam * 3) * 0.95;
        g.fillStyle = rgba(own2, 1);
        g.font = `600 ${Math.max(10, fr.s * 0.022)}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.fillText(m.tag, q[0], q[1] + fr.s * 0.05);
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "lighter";

      // ---- The ignition front: a ring of sparks running from pole to pole over the shell. ----
      if (lit && t < T.IGNITE_AT + T.IGNITE_SPAN + 0.2) {
        const y = 1 - (2 * (t - T.IGNITE_AT)) / T.IGNITE_SPAN;
        const rr = Math.sqrt(Math.max(0, 1 - y * y));
        const M = Math.round(90 * quality) + 20;
        for (let j = 0; j < M; j++) {
          const a = (j / M) * TAU + t * 0.5;
          const pt: V3 = [Math.cos(a) * rr * RS * 1.02, y * RS * 1.02, Math.sin(a) * rr * RS * 1.02];
          if (dot(normV(pt), normV(addV(cam.pos, pt, -1))) < 0) continue;
          const q = P(pt);
          if (q) glow(g, j % 4 ? spOwn : spWhite, q[0], q[1], Math.max(2, q[2] * 0.05), 0.9);
        }
      }
      // Energy runs up and down the meridians to the poles just before the jets.
      const gatherK = smooth(T.IGNITE_AT + T.IGNITE_SPAN - 0.3, T.JETS_AT, t) * (1 - jetK);
      if (gatherK > 0) {
        const M = Math.round(160 * quality) + 30;
        for (let j = 0; j < M; j++) {
          const lon = hash01(j * 7) * TAU;
          const north = j % 2 === 0;
          const v = (hash01(j * 11) + t * 1.8) % 1;
          const lat = (north ? 1 : -1) * v * v * (Math.PI / 2);
          const pt: V3 = [Math.cos(lon) * Math.cos(lat) * RS * 1.03, Math.sin(lat) * RS * 1.03, Math.sin(lon) * Math.cos(lat) * RS * 1.03];
          if (dot(normV(pt), normV(addV(cam.pos, pt, -1))) < -0.15) continue;
          const q = P(pt);
          if (q) glow(g, j % 3 ? spOwn : spOwn2, q[0], q[1], Math.max(1.5, q[2] * 0.03), gatherK * 0.85);
        }
        for (const s of [1, -1]) {
          const q = P([0, s * RS, 0]);
          if (q) glow(g, spWhite, q[0], q[1], q[2] * (0.2 + 0.6 * gatherK), gatherK);
        }
      }

      // ---- After the ignition: the shell's own light, then the jets, the shock ring, the flash. ----
      if (lit && O) {
        const k = smooth(T.IGNITE_AT, T.IGNITE_AT + T.IGNITE_SPAN, t);
        glow(g, spOwn, O[0], O[1], Rpx * RS * (1.7 + 0.5 * jetK), 0.3 * k + 0.25 * jetK);
        glow(g, spGlow, O[0], O[1], Rpx * RS * 3.5, 0.18 * k + 0.2 * jetK);
      }
      if (jetK > 0) drawJets(g, P, t, jetK, quality, fr.s);
      const sr = shockRadius(t);
      if (sr > 0 && t < T.RING_END) drawShock(g, P, t, sr, quality, fr.s);

      // ---- Acts 1-2: the swarm, from the Flagship's bay into orbit round the star, then into the shell. ----
      const ship = shipAt(t, w, h, fr.s);
      if (t >= T.SWARM_AT && t < T.PANEL_END + 0.6) {
        g.fillStyle = rgba(own, 1);
        for (let k = 0; k < DRONES; k++) {
          const d = drones[k]!;
          if (d.rank > quality || t < d.rel || t > d.gone) continue;
          const u = (t - d.rel) / T.SWARM_FLY;
          const end = P(orbitOf(k, t));
          if (!end) continue;
          let x = end[0];
          let y = end[1];
          if (u < 1) {
            const e = u * u * (3 - 2 * u);
            // A bowed path from the bay: out and up first, then falling into orbit.
            const c1x = ship.bx + fr.s * (0.25 + d.off * 2);
            const c1y = ship.by - fr.s * (0.18 + d.off);
            x = (1 - e) * (1 - e) * ship.bx + 2 * (1 - e) * e * c1x + e * e * end[0];
            y = (1 - e) * (1 - e) * ship.by + 2 * (1 - e) * e * c1y + e * e * end[1];
          }
          // Drones behind the star are hidden by it (before the shell closes).
          if (u >= 1 && !dark && end[3] > (O?.[3] ?? 0) && O && Math.hypot(x - O[0], y - O[1]) < Rpx * 0.98) continue;
          const fade = 1 - smooth(d.gone - 0.25, d.gone, t);
          g.globalAlpha = 0.85 * fade;
          g.fillRect(x - 1, y - 1, 2, 2);
          if (k % 7 === 0) glow(g, d.col % 2 ? spOwn2 : spOwn, x, y, Math.max(2.5, fr.s * 0.006), 0.6 * fade);
        }
        g.globalAlpha = 1;
      }

      // ---- The Flagship, in silhouette against the star (acts 1-2). ----
      if (ship.on) drawShip(g, ship, t, Rpx, O);

      // The white flash of the jets.
      if (after >= 0 && after < 1.4) {
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = 0.92 * Math.exp(-after * 3.4);
        g.fillStyle = "#fff";
        g.fillRect(0, 0, w, h);
        g.globalAlpha = 1;
        g.globalCompositeOperation = "lighter";
        // A wide anamorphic streak across the picture.
        if (O) {
          const st = Math.exp(-after * 1.1);
          g.globalAlpha = st;
          g.drawImage(spWhite, O[0] - w * 0.8, O[1] - fr.s * 0.01, w * 1.6, fr.s * 0.02);
          g.drawImage(spOwn, O[0] - w * 0.6, O[1] - fr.s * 0.035, w * 1.2, fr.s * 0.07);
          g.globalAlpha = 1;
        }
      }

      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      vignette(g, w, h, 0.62);
      grain(g, w, h, t, 0.04);
      if (fadeIn < 1) {
        g.globalAlpha = 1 - fadeIn;
        g.fillStyle = "#000";
        g.fillRect(0, 0, w, h);
        g.globalAlpha = 1;
      }
      void pull;
    },
  };

  type Proj = (q: V3) => [number, number, number, number] | undefined;

  /** The polar jets: a white core, the Company's light round it, knots and a twisting stream of particles. */
  function drawJets(g: CanvasRenderingContext2D, P: Proj, t: number, k: number, quality: number, S: number): void {
    const L = jetLength(t);
    const after = t - T.JETS_AT;
    // Thinner and steadier as the system comes into view.
    const settle = 1 - 0.55 * smooth(T.PULL_AT, T.PULL_END, t);
    k *= 1 - 0.75 * smooth(T.PULL_AT, T.PULL_END, t);
    const spOwn = sprite(own);
    const spOwn2 = sprite(own2);
    const spWhite = sprite(white);
    for (const s of [1, -1]) {
      const base: V3 = [0, s * RS, 0];
      const tip: V3 = [0, s * (RS + L), 0];
      const p0 = P(base);
      const p1 = P(tip) ?? P([0, s * (RS + Math.min(L, 6)), 0]);
      if (!p0 || !p1) continue;
      const dx = p1[0] - p0[0];
      const dy = p1[1] - p0[1];
      const ln = Math.hypot(dx, dy) || 1;
      const nx = -dy / ln;
      const ny = dx / ln;
      for (const [wd0, wd1, col, a] of [
        [0.16, 0.9, own, 0.28],
        [0.07, 0.35, own2, 0.45],
        [0.025, 0.12, white, 0.9],
      ] as const) {
        const w0 = p0[2] * wd0 * settle;
        const w1 = Math.max(w0, p0[2] * wd1 * settle);
        const lg = g.createLinearGradient(p0[0], p0[1], p1[0], p1[1]);
        lg.addColorStop(0, rgba(col as C3, a * k));
        lg.addColorStop(0.6, rgba(col as C3, a * 0.5 * k));
        lg.addColorStop(1, rgba(col as C3, 0));
        g.fillStyle = lg;
        g.beginPath();
        g.moveTo(p0[0] + nx * w0, p0[1] + ny * w0);
        g.lineTo(p1[0] + nx * w1, p1[1] + ny * w1);
        g.lineTo(p1[0] - nx * w1, p1[1] - ny * w1);
        g.lineTo(p0[0] - nx * w0, p0[1] - ny * w0);
        g.closePath();
        g.fill();
      }
      // The twisting stream: particles flowing out along the jet, wider the further they go.
      const M = Math.round(220 * quality) + 40;
      for (let j = 0; j < M; j++) {
        const v = (hash01(j * 7 + (s > 0 ? 0 : 500)) + t * 0.55) % 1;
        const along = RS + v * v * Math.min(L, 30);
        const r = (0.05 + v * 1.4) * settle;
        const a = hash01(j * 13) * TAU + t * 3 + v * 9;
        const q = P([Math.cos(a) * r, s * along, Math.sin(a) * r]);
        if (!q) continue;
        glow(g, j % 5 === 0 ? spWhite : j % 2 ? spOwn : spOwn2, q[0], q[1], Math.max(1.5, q[2] * 0.06 * (1 + v)), k * (1 - v) * 0.9);
      }
      // Bright knots running out.
      for (let j = 0; j < 5; j++) {
        const v = (j / 5 + after * 0.35) % 1;
        const q = P([0, s * (RS + v * v * Math.min(L, 30)), 0]);
        if (q) glow(g, spWhite, q[0], q[1], Math.max(4, q[2] * 0.35) * (1 - v * 0.5), k * (1 - v) * 0.8);
      }
      // The jet's foot: a blazing point on the pole.
      glow(g, spWhite, p0[0], p0[1], p0[2] * 0.45 * settle * (1 + 1.5 * Math.exp(-after * 3)), k);
      glow(g, spOwn, p0[0], p0[1], p0[2] * 1.1 * settle, 0.6 * k);
    }
    void S;
  }

  /** The shock ring in the shell's equator: particles and a thin bright line, running out past the camera. */
  function drawShock(g: CanvasRenderingContext2D, P: Proj, t: number, R: number, quality: number, S: number): void {
    const u = (t - T.JETS_AT) / (T.RING_END - T.JETS_AT);
    const fade = 1 - smooth(0.6, 1, u);
    const spOwn = sprite(own);
    const spOwn2 = sprite(own2);
    const spWhite = sprite(white);
    for (const [lag, col, sp] of [
      [0, own, spWhite],
      [0.35, own2, spOwn2],
    ] as const) {
      const rr = Math.max(1.05, R - lag * (1 + R * 0.2));
      const M = Math.round(220 * quality) + 60;
      g.strokeStyle = rgba(col as C3, 0.6 * fade);
      g.lineWidth = Math.max(1.2, S * 0.004);
      g.beginPath();
      let started = false;
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * TAU;
        const q = P([Math.cos(a) * rr, 0, Math.sin(a) * rr]);
        if (!q) {
          started = false;
          continue;
        }
        if (started) g.lineTo(q[0], q[1]);
        else g.moveTo(q[0], q[1]);
        started = true;
        if (j % 2 === 0) {
          const jit = (hash01(j * 3 + Math.floor(t * 20)) - 0.5) * 0.08 * rr;
          const qq = P([Math.cos(a) * (rr + jit), (hash01(j * 5) - 0.5) * 0.06 * rr, Math.sin(a) * (rr + jit)]);
          if (qq) glow(g, j % 6 ? spOwn : sp, qq[0], qq[1], Math.max(2, qq[2] * 0.06), 0.85 * fade);
        }
      }
      g.stroke();
    }
  }

  /** Act 5: orbits, the lattice spreading, the worlds and the beams from the shell to them. */
  function drawSystem(g: CanvasRenderingContext2D, P: Proj, t: number, vis: number, quality: number, S: number): void {
    const spOwn = sprite(own);
    const spOwn2 = sprite(own2);
    const spWhite = sprite(white);
    // The lattice of the Company's light, spreading out from the shell.
    const reach = latticeReach(t) * LATTICE_R;
    if (reach > 0) {
      g.lineWidth = 1;
      for (const c of lattice) {
        if (c.d > reach + HEX) break;
        const crest = Math.max(0, 1 - Math.abs(reach - c.d) / (HEX * 1.6));
        const on = smooth(c.d - HEX, c.d, reach);
        const a = (0.2 + 0.6 * crest) * on * (1 - c.d / (LATTICE_R * 1.15)) * vis;
        if (a < 0.01) continue;
        g.strokeStyle = rgba(crest > 0.3 ? mix(own, white, crest * 0.5) : own, a);
        g.beginPath();
        let ok = true;
        for (let k = 0; k <= 6; k++) {
          const ang = (k / 6) * TAU;
          const q = P([c.x + Math.cos(ang) * HEX * 0.97, 0, c.z + Math.sin(ang) * HEX * 0.97]);
          if (!q) {
            ok = false;
            break;
          }
          if (k) g.lineTo(q[0], q[1]);
          else g.moveTo(q[0], q[1]);
        }
        if (!ok) continue;
        g.stroke();
        if (crest > 0.4 && quality > 0.5) {
          const q = P([c.x, 0, c.z]);
          if (q) glow(g, spOwn2, q[0], q[1], Math.max(2, S * 0.006), crest * 0.5 * vis);
        }
      }
    }
    // The orbits and the worlds.
    for (let i = 0; i < nWorlds; i++) {
      const wd = worldOf(i, n, t);
      const arrive = relays[i]! + T.RELAY_FLY;
      const claimed = smooth(arrive, arrive + 0.6, t);
      const M = 96;
      g.strokeStyle = claimed > 0 ? rgba(mix([150, 160, 190], own, claimed), (0.12 + 0.4 * claimed) * vis) : rgba([150, 160, 190], 0.12 * vis);
      g.lineWidth = claimed > 0 ? 1.4 : 1;
      g.beginPath();
      let started = false;
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * TAU;
        const q = P([Math.cos(a) * wd.orbit, 0, Math.sin(a) * wd.orbit]);
        if (!q) {
          started = false;
          continue;
        }
        if (started) g.lineTo(q[0], q[1]);
        else g.moveTo(q[0], q[1]);
        started = true;
      }
      g.stroke();
      // A glint running round the claimed orbit.
      if (claimed > 0) {
        const ga = (t - arrive) * 1.4 + i;
        const q = P([Math.cos(ga) * wd.orbit, 0, Math.sin(ga) * wd.orbit]);
        if (q) glow(g, spOwn2, q[0], q[1], Math.max(3, S * 0.008), 0.7 * claimed * vis);
      }
      const q = P(wd.p);
      if (!q) continue;
      const r = Math.max(2.5, q[2] * wd.size);
      // The world: lit on the side facing the shell.
      const O = P([0, 0, 0]);
      const lx = O ? (O[0] - q[0]) / (Math.hypot(O[0] - q[0], O[1] - q[1]) || 1) : 0;
      const ly = O ? (O[1] - q[1]) / (Math.hypot(O[0] - q[0], O[1] - q[1]) || 1) : 0;
      const col = WORLD_COLS[i % WORLD_COLS.length]!;
      g.globalCompositeOperation = "source-over";
      const wg = g.createRadialGradient(q[0] + lx * r * 0.5, q[1] + ly * r * 0.5, 0, q[0], q[1], r);
      wg.addColorStop(0, rgba(mix(col, white, 0.3), vis));
      wg.addColorStop(0.7, rgba(mix(col, [0, 0, 0], 0.55), vis));
      wg.addColorStop(1, rgba([4, 5, 8], vis));
      g.fillStyle = wg;
      g.beginPath();
      g.arc(q[0], q[1], r, 0, TAU);
      g.fill();
      g.globalCompositeOperation = "lighter";
      if (claimed > 0) {
        glow(g, spOwn, q[0], q[1], r * 3.2, 0.55 * claimed * vis);
        g.strokeStyle = rgba(own2, 0.85 * claimed * vis);
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(q[0], q[1], r * 1.9 + Math.max(0, 1 - (t - arrive)) * r * 3, 0, TAU);
        g.stroke();
        // Its mission's tag.
        const m = missions[i];
        if (m?.tag && i < n) {
          g.globalCompositeOperation = "source-over";
          g.globalAlpha = claimed * vis * 0.9;
          g.fillStyle = rgba(own2, 1);
          g.font = `600 ${Math.max(10, S * 0.018)}px system-ui, sans-serif`;
          g.textAlign = "left";
          g.fillText(m.tag, q[0] + r * 2.4, q[1] - r * 1.2);
          g.globalAlpha = 1;
          g.globalCompositeOperation = "lighter";
        }
      }
      // The beam from the shell to the world: a head racing out, a stream behind it, then a steady line with pulses.
      const leave = relays[i]!;
      if (t >= leave) {
        const u = smooth(leave, arrive, t);
        const from: V3 = scale(normV(wd.p), RS);
        const head: V3 = addV(scale(from, 1 - u), scale(wd.p, u));
        const ph = P(head);
        const pf = P(from);
        if (ph && pf) {
          g.strokeStyle = rgba(own, (u < 1 ? 0.7 : 0.3) * vis);
          g.lineWidth = u < 1 ? 2 : 1.2;
          g.beginPath();
          g.moveTo(pf[0], pf[1]);
          g.lineTo(ph[0], ph[1]);
          g.stroke();
          if (u < 1) {
            glow(g, spWhite, ph[0], ph[1], Math.max(4, S * 0.012), vis);
            glow(g, spOwn, ph[0], ph[1], Math.max(8, S * 0.03), 0.7 * vis);
          } else {
            for (let j = 0; j < 3; j++) {
              const v = ((t - arrive) * 0.8 + j / 3) % 1;
              const pp = P(addV(scale(from, 1 - v), scale(wd.p, v)));
              if (pp) glow(g, spOwn2, pp[0], pp[1], Math.max(2.5, S * 0.007), 0.75 * vis);
            }
          }
        }
      }
    }
    g.globalCompositeOperation = "lighter";
  }

  /** Where the Flagship is in the picture (acts 1-2), its size, and its bay (where the drones leave). */
  function shipAt(t: number, w: number, h: number, S: number): { on: boolean; x: number; y: number; L: number; bx: number; by: number; a: number } {
    const k = smooth(T.SHIP_AT, 4.6, t);
    const out = smooth(5.2, 9.5, t);
    const L = S * 0.72;
    const x = lerp(-L * 0.7, w * 0.22, k) - out * (w * 0.22 + L * 1.4);
    const y = h * 0.74 - S * 0.04 * k + out * S * 0.06;
    const a = -0.05 + 0.02 * k;
    // The bay: under the hull, a little behind the bridge.
    const bx = x + Math.cos(a) * L * 0.12;
    const by = y + L * 0.1;
    return { on: x > -L && t < 10, x, y, L, bx, by, a };
  }

  /** The Flagship: a long dark hull, rim-lit by the star, running lights and engines in the Company's colours. */
  function drawShip(g: CanvasRenderingContext2D, s: ReturnType<typeof shipAt>, t: number, Rpx: number, O: [number, number, number, number] | undefined): void {
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.a);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    const L = s.L;
    // The body: almost black, a faint cold sheen on the near side.
    const body = g.createLinearGradient(0, -L * 0.16, 0, L * 0.13);
    body.addColorStop(0, rgba(mix([4, 5, 8], hullC, 0.12), 1));
    body.addColorStop(1, rgba([2, 2, 4], 1));
    g.fillStyle = body;
    g.beginPath();
    HULL.forEach(([x, y], i) => (i ? g.lineTo(x * L, y * L) : g.moveTo(x * L, y * L)));
    g.closePath();
    g.fill();
    // Rim light: the edges facing the star (up and to the right) burn with its light.
    g.globalCompositeOperation = "lighter";
    const toStar = O ? Math.atan2(O[1] - s.y, O[0] - s.x) - s.a : -0.6;
    const sxn = Math.cos(toStar);
    const syn = Math.sin(toStar);
    g.lineWidth = Math.max(1.2, L * 0.006);
    for (let i = 0; i < HULL.length; i++) {
      const [x1, y1] = HULL[i]!;
      const [x2, y2] = HULL[(i + 1) % HULL.length]!;
      // The edge's outward normal (the outline runs clockwise on screen).
      const ex = x2 - x1;
      const ey = y2 - y1;
      const el = Math.hypot(ex, ey) || 1;
      const nx = ey / el;
      const ny = -ex / el;
      const f = Math.max(0, -(nx * sxn + ny * syn));
      if (f < 0.05) continue;
      g.strokeStyle = rgba(starHot, Math.min(1, f * 1.1) * (Rpx > 0 ? 1 : 0.3));
      g.beginPath();
      g.moveTo(x1 * L, y1 * L);
      g.lineTo(x2 * L, y2 * L);
      g.stroke();
    }
    // Panel lines.
    g.strokeStyle = rgba(starC, 0.12);
    g.lineWidth = 1;
    g.beginPath();
    for (const x of [-0.34, -0.22, -0.06, 0.08, 0.24]) {
      g.moveTo(x * L, -0.06 * L);
      g.lineTo(x * L, 0.08 * L);
    }
    g.stroke();
    // Engines.
    const spOwn = sprite(own);
    const spWhite = sprite(white);
    for (const yy of [-0.02, 0.035]) {
      glow(g, spOwn, -0.5 * L, yy * L, L * 0.07, 0.85);
      glow(g, spWhite, -0.5 * L, yy * L, L * 0.025, 1);
      g.drawImage(spOwn, -0.5 * L - L * 0.3, yy * L - L * 0.015, L * 0.32, L * 0.03);
    }
    // Running lights, blinking.
    const spOwn2 = sprite(own2);
    for (let i = 0; i < 7; i++) {
      const on = Math.sin(t * 4 - i * 0.7) > 0.2 ? 1 : 0.25;
      glow(g, spOwn2, (-0.38 + i * 0.12) * L, 0.098 * L, L * 0.012, on);
    }
    // The bay glows while the swarm leaves.
    const bay = smooth(T.SWARM_AT - 0.4, T.SWARM_AT, t) * (1 - smooth(T.SWARM_AT + T.SWARM_SPAN, T.SWARM_AT + T.SWARM_SPAN + 0.6, t));
    if (bay > 0) {
      g.fillStyle = rgba(own, 0.6 * bay);
      g.fillRect(0.06 * L, 0.095 * L, 0.14 * L, 0.012 * L);
      glow(g, spOwn, 0.13 * L, 0.1 * L, L * 0.08, 0.7 * bay);
    }
    g.restore();
  }
}

/** A closed polygon path. */
function poly(g: CanvasRenderingContext2D, pts: [number, number][]): void {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}
