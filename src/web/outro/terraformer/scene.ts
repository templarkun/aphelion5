/**
 * The Terraformer outro: the film (designer 2026-11-16). The Company claims the planet for good.
 *
 *   Act 1  under the belly of the Company's capital vessel, high over the dark planet: the bay
 *          doors slide open on a lit hold, the pylons (one for every mission won) let go one
 *          by one and light their engines.
 *   Act 2  the camera follows them down through the upper air: shields of plasma round their
 *          noses, sparks torn off behind, long trails of vapour curving over the night side.
 *   Act 3  they slam into the ground in a steady beat across the target sector. Each hit sends
 *          a shock wave out over the curve of the planet, and behind the waves the ground is
 *          changed for good: grids, domes and lit networks in the Company's colours (sector.ts).
 *   Act 4  the camera pulls back into a slow drift; the sun comes over the edge of the planet
 *          beyond the glowing sector. The Debrief card slides in beside it.
 *
 * Everything is drawn on one 2D canvas, far to near: space (globe.ts), the globe and its ground
 * (sector.ts), the air and the sun, what stands on the ground, the trails, the ship (hull.ts),
 * the pylons. Every moving thing is worked out from the time alone, so any moment can be drawn
 * by itself (the still picture of reduced motion, the checks). Looks only; no game data but the
 * number of pylons, their tags and the Company's colours.
 */

import { add, clamp, dot, ease, easeOut, lerp, mul, rng, seg, smooth, sub, TAU, unit, type V3 } from "../../briefing/styles/intro2/math3.js";
import type { CompanyTheme } from "../types.js";
import { createGlobe } from "./globe.js";
import { createHull, type HullDraw, type ShipView } from "./hull.js";
import { drawPylon, flameSprite, mixRgb, softSprite, type PylonLook } from "./pylon.js";
import { createSector, type Sector } from "./sector.js";
import { DOORS_AT, DOORS_OPEN_AT, impactTimes, pylonCount, releaseTimes, sitePlaces } from "./timeline.js";
import { aim, DEG, newCam, place, see, track, type Cam } from "./view.js";

/** The part of the picture the Debrief card leaves open, CSS px: the glowing sector is kept inside it. */
export interface FreeArea {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface TerraformerScene {
  /** Draw film time t (seconds at Normal speed; past the film's end the slow drift goes on). */
  draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, free?: FreeArea): void;
}
export interface SceneSetup {
  theme: CompanyTheme;
  vesselId: string;
  /** One per pylon, in the order the missions were won: the small tag shown beside it ("M1"). */
  tags: string[];
}

/** The camera: [time, degrees along the track, height above the ground in planet radii]. */
const CAM_KEYS = [
  [0, -30.0, 0.3],
  [2.2, -29.6, 0.3],
  [2.9, -29.0, 0.287],
  [3.5, -27.6, 0.262],
  [4.5, -22.0, 0.225],
  [5.4, -16.0, 0.235],
  [6.4, -13.4, 0.24],
  [8.4, -13.0, 0.245],
  [11.5, -19.0, 0.5],
  [24, -17.6, 0.53],
] as const;
/**
 * The pylons' common path, by its own clock (each pylon runs it from its release to its hit):
 * a steep dive away from the ship, then a long shallowing fall through the air.
 */
const POD_KEYS = [
  [1.9, -29.5, 0.296],
  [2.6, -28.6, 0.262],
  [3.5, -25.0, 0.2],
  [4.5, -17.5, 0.126],
  [5.4, -9.5, 0.07],
  [6.2, -3.4, 0.031],
  [6.7, 0, 0],
] as const;
const REF0 = POD_KEYS[0][0];
const REF1 = POD_KEYS[POD_KEYS.length - 1]![0];
/** The camera looks a little under what it follows: [time, degrees]. */
const TILT_KEYS = [
  [2.2, 0],
  [3.5, 6],
  [4.5, 4],
  [5.4, 2],
  [6.7, 2.5],
  [8.4, 2.5],
  [11.5, -1.5],
  [24, -2.5],
] as const;
/** At the start the camera looks this far below level (the planet's edge then lies a little under the middle). */
const FIRST_PITCH = 34.7;

/** A pylon: in the ship's units while it hangs in the bay, in planet radii once it is away. */
const POD_LEN_S = 2.5;
const POD_R_S = 0.15;
const POD_LEN_W = 0.0105;
const POD_R_W = 0.00082;
/** The pylons leave the ship diving this steeply (degrees below level). */
const DIVE = 58;
/** The ship's nose points this far under the camera's first line of sight. */
const SHIP_TILT = 3 * DEG;
/** The push of a pylon's engine in the ship's units. */
const SHIP_ACC = 20;
/** Where the air begins to burn, and where it burns hardest (height in planet radii). */
const AIR_TOP = 0.262;
const AIR_FULL = 0.2;

interface Spark {
  life: number;
  ph: number;
  ang: number;
  out: number;
}
interface Chip {
  ang: number;
  vt: number;
  vn: number;
}

export function createTerraformerScene(o: SceneSetup): TerraformerScene {
  const { theme } = o;
  const n = pylonCount(o.tags.length);
  const tags = Array.from({ length: n }, (_, i) => o.tags[i] ?? "");
  const hit = impactTimes(n);
  const rel = releaseTimes(n);
  const R = rng(31337);
  const camTrack = track(CAM_KEYS);
  const podTrack = track(POD_KEYS);
  const tiltTrack = track(TILT_KEYS);
  const globe = createGlobe(theme);
  const hull = createHull(o.vesselId, theme);
  const slots = hull.slots(n).map((s): V3 => [s[0], 0.1 + POD_LEN_S / 2, s[2]]);
  const sparks: Spark[][] = Array.from({ length: n }, () => Array.from({ length: 34 }, () => ({ life: 0.35 + R() * 0.6, ph: R(), ang: R() * TAU, out: 0.4 + R() * 0.6 })));
  const chips: Chip[][] = Array.from({ length: n }, () => Array.from({ length: 26 }, () => ({ ang: R() * TAU, vt: 0.012 + R() * 0.04, vn: 0.03 + R() * 0.07 })));
  const dust = Array.from({ length: 46 }, () => ({ x: R(), y: R(), z: 0.25 + R() * 0.75, ph: R() * TAU }));

  let sector: Sector | undefined;
  let tallNow: boolean | undefined;
  const cam: Cam = newCam();
  // Sprites, made at the first frame.
  let hot: HTMLCanvasElement | undefined;
  let fire: HTMLCanvasElement | undefined;
  let ember: HTMLCanvasElement | undefined;
  let acc: HTMLCanvasElement | undefined;
  let second: HTMLCanvasElement | undefined;
  let lamp: HTMLCanvasElement | undefined;
  let engine: HTMLCanvasElement | undefined;

  // ---- The camera's path and what it looks at.
  const camPos = (t: number): V3 => {
    const [lon, alt] = camTrack(t) as [number, number];
    return place(lon, 0, 1 + alt);
  };
  const centroid = (t: number): V3 => {
    const [lon, alt] = podTrack(clamp(t, REF0, REF1)) as [number, number];
    return place(lon, 0, 1 + alt);
  };
  const SECTOR: V3 = [0, 0, 1];
  // What it looks at first: a point ahead, FIRST_PITCH below level.
  const pos0 = camPos(0);
  const up0 = unit(pos0);
  // Straight ahead along the track there.
  const ahead0: V3 = [Math.cos(CAM_KEYS[0][1] * DEG), 0, -Math.sin(CAM_KEYS[0][1] * DEG)];
  const aim0 = add(pos0, sub(mul(ahead0, Math.cos(FIRST_PITCH * DEG)), mul(up0, Math.sin(FIRST_PITCH * DEG))));

  function setCam(t: number, w: number, h: number, free: FreeArea | undefined, shake: number): void {
    const tall = h > w * 1.15;
    const pos = camPos(t);
    const up = unit(pos);
    // What it looks at: straight on at first, then the pylons, then the sector. Directions are mixed, not places.
    const w1 = smooth(2.15, 2.95, t);
    const w2 = smooth(5.0, 6.4, t);
    const to = (p: V3): V3 => unit(sub(p, pos));
    const d0 = to(aim0);
    const d1 = to(centroid(t));
    const d2 = to(SECTOR);
    let look = unit([lerp(lerp(d0[0], d1[0], w1), d2[0], w2), lerp(lerp(d0[1], d1[1], w1), d2[1], w2), lerp(lerp(d0[2], d1[2], w1), d2[2], w2)]);
    // A little under it (so it stands above the middle of the picture).
    const drop = Math.tan(tiltTrack(t)[0]! * (tall ? 1.5 : 1) * DEG);
    look = unit([look[0] - up[0] * drop, look[1] - up[1] * drop, look[2] - up[2] * drop]);
    const tx = pos[0] + look[0];
    const ty = pos[1] + look[1];
    const tz = pos[2] + look[2];
    const roll = 0.03 * Math.sin(t * 0.55 + 1) * smooth(2.3, 3.3, t) * (1 - smooth(5.2, 6.3, t)) + 0.006 * Math.sin(t * 0.21);
    aim(cam, pos, [tx, ty, tz], up, roll);
    cam.w = w;
    cam.h = h;
    cam.focal = (tall ? 0.9 : 1.1) * Math.sqrt(w * h);
    // In the last act the picture slides so the sector sits in the open part beside the Debrief card.
    const k4 = ease(seg(t, 8.7, 11.3));
    const fx = free ? free.x + free.w / 2 : w / 2;
    const fy = free ? free.y + free.h / 2 : h / 2;
    cam.cx = lerp(w / 2, fx, k4) + shake * 7 * Math.sin(t * 61);
    cam.cy = lerp(h / 2, fy, k4) + shake * 7 * Math.cos(t * 47);
  }

  // ---- The ship: its own frame set in the world by the camera's first look.
  const first: Cam = newCam();
  aim(first, pos0, aim0, up0, 0);
  const Xs: V3 = add(mul(first.f, Math.cos(SHIP_TILT)), mul(first.d, Math.sin(SHIP_TILT)));
  const Ys: V3 = sub(mul(first.f, Math.sin(SHIP_TILT)), mul(first.d, Math.cos(SHIP_TILT)));
  const Zs: V3 = first.r;
  /** Where the camera is, in the ship's frame: creeping forward under the belly, then falling away after the pylons. */
  function shipEye(t: number): V3 {
    const u = Math.max(0, t - 2.15);
    return [-13.2 + 1.4 * ease(seg(t, 0, 2.8)) + 2.5 * u * u, -2.3 - 1.5 * u * u - 7 * u * u * u, 0.6];
  }
  let eye: V3 = shipEye(0);
  const shipView: ShipView = {
    cam(x, y, z) {
      const vx = x - eye[0];
      const vy = y - eye[1];
      const vz = z - eye[2];
      const wx = Xs[0] * vx + Ys[0] * vy + Zs[0] * vz;
      const wy = Xs[1] * vx + Ys[1] * vy + Zs[1] * vz;
      const wz = Xs[2] * vx + Ys[2] * vy + Zs[2] * vz;
      return [wx * cam.r[0] + wy * cam.r[1] + wz * cam.r[2], wx * cam.d[0] + wy * cam.d[1] + wz * cam.d[2], wx * cam.f[0] + wy * cam.f[1] + wz * cam.f[2]];
    },
    focal: 1,
    cx: 0,
    cy: 0,
  };
  // The way the pylons fly off, in the ship's frame: the steep dive their path begins with.
  const away = sub(mul(ahead0, Math.cos(DIVE * DEG)), mul(up0, Math.sin(DIVE * DEG)));
  const vS: V3 = unit([dot(away, Xs), dot(away, Ys), dot(away, Zs)]);

  /** A pylon near the ship (the ship's frame): its nose and tail. */
  function shipPod(i: number, t: number, nose: V3, tail: V3): void {
    const s = slots[i]!;
    const dt = t - rel[i]!;
    let mx = s[0];
    let my = s[1];
    let mz = s[2];
    let ax = 0;
    let ay = -1;
    let az = 0;
    if (dt > 0.4) {
      const u = dt - 0.4;
      my -= 0.528 + 2.04 * u;
      const k = (SHIP_ACC / 2) * u * u;
      mx += vS[0] * k;
      my += vS[1] * k;
      mz += vS[2] * k;
      const v = unit([vS[0] * SHIP_ACC * u, -2.04 + vS[1] * SHIP_ACC * u, vS[2] * SHIP_ACC * u]);
      ax = v[0];
      ay = v[1];
      az = v[2];
    } else if (dt > 0) my -= 0.6 * dt + 1.8 * dt * dt;
    const hl = POD_LEN_S / 2;
    nose[0] = mx + ax * hl;
    nose[1] = my + ay * hl;
    nose[2] = mz + az * hl;
    tail[0] = mx - ax * hl;
    tail[1] = my - ay * hl;
    tail[2] = mz - az * hl;
  }

  /** A pylon on its way down (the world): where its nose is at `time`. Returns its height above the ground. */
  function podAt(i: number, time: number, out: V3): number {
    const u = clamp((time - rel[i]!) / (hit[i]! - rel[i]!));
    const [lon, alt] = podTrack(REF0 + u * (REF1 - REF0)) as [number, number];
    // The common path ends at the middle of the sector; each pylon bends away to its own place.
    const s = Math.pow(u, 1.25);
    const site = sector!.sites[i]!;
    const p = place(lon + s * site.lon, s * site.lat, 1 + alt);
    out[0] = p[0];
    out[1] = p[1];
    out[2] = p[2];
    return alt;
  }
  const heatAt = (alt: number) => smooth(AIR_TOP, AIR_FULL, alt);

  const tmpA: V3 = [0, 0, 0];
  const tmpB: V3 = [0, 0, 0];
  const tmpC: V3 = [0, 0, 0];
  const tmpD: V3 = [0, 0, 0];

  // ---- Drawing.

  /** The trails of vapour and fire behind the falling pylons: ribbons that widen and thin out with age. */
  const TRAIL = 44;
  const trX = new Float32Array(TRAIL + 1);
  const trY = new Float32Array(TRAIL + 1);
  const trW = new Float32Array(TRAIL + 1);
  const trA = new Float32Array(TRAIL + 1);
  function ribbon(g: CanvasRenderingContext2D, m: number, wide: number, rgb: (k: number) => string, alpha: (k: number) => number): void {
    if (m < 2) return;
    const grd = g.createLinearGradient(trX[0]!, trY[0]!, trX[m - 1]!, trY[m - 1]!);
    for (let s = 0; s <= 6; s++) {
      const k = Math.min(m - 1, Math.round((s / 6) * (m - 1)));
      grd.addColorStop(s / 6, `rgb(${rgb(k / (m - 1))} / ${clamp(alpha(k)).toFixed(3)})`);
    }
    g.fillStyle = grd;
    g.beginPath();
    for (let pass = 0; pass < 2; pass++)
      for (let q = 0; q < m; q++) {
        const k = pass ? m - 1 - q : q;
        const a = Math.max(0, k - 1);
        const b = Math.min(m - 1, k + 1);
        const dx = trX[b]! - trX[a]!;
        const dy = trY[b]! - trY[a]!;
        const l = Math.hypot(dx, dy) || 1;
        const side = (pass ? -1 : 1) * trW[k]! * wide;
        const x = trX[k]! - (dy / l) * side;
        const y = trY[k]! + (dx / l) * side;
        if (!pass && !q) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
    g.closePath();
    g.fill();
  }
  function trails(g: CanvasRenderingContext2D, t: number): void {
    const STEP = 0.05;
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      if (t < rel[i]! + 0.9) continue;
      const since = t - hit[i]!;
      const gone = since > 0 ? 1 - smooth(0, 2.4, since) : 1;
      if (gone <= 0.01) continue;
      const head = Math.min(t, hit[i]!);
      let m = 0;
      for (let k = 0; k <= TRAIL; k++) {
        const ts = head - k * STEP;
        if (ts < rel[i]! + 0.8) break;
        const alt = podAt(i, ts, tmpA);
        const age = k / TRAIL + (since > 0 ? since * 0.2 : 0);
        // The older vapour has drifted on the wind.
        const wob = 0.0016 * Math.sin(k * 0.42 + i * 1.7 + ts * 2.1) * age + 0.0045 * age * age * (i % 2 ? 1 : -1);
        if (!see(cam, tmpA[0], tmpA[1] + wob, tmpA[2])) break;
        trX[m] = cam.sx;
        trY[m] = cam.sy;
        // Never a searchlight: what passes close under the camera is kept thin and faint.
        trW[m] = Math.min(cam.w * (0.004 + 0.012 * age), (cam.focal / cam.sz) * POD_R_W * (1.4 + 7 * age));
        trA[m] = Math.pow(1 - k / TRAIL, 1.3) * smooth(AIR_TOP + 0.01, AIR_FULL, alt) * gone * smooth(0.02, 0.07, cam.sz);
        m++;
      }
      // It thins out to nothing at its far end, however short it still is.
      for (let k = 0; k < m; k++) trA[k]! *= Math.min(1, (m - 1 - k) / Math.max(1, m * 0.3));
      // Soft at the sides: ribbons inside one another.
      for (const [wide, al] of [[3.4, 0.03], [2.5, 0.04], [1.7, 0.05], [1.1, 0.07], [0.6, 0.1]] as const) ribbon(g, m, wide, () => "170 192 232", (k) => trA[k]! * al);
      // Fire in the first stretch behind the pylon, while it still falls.
      const burn = since > 0 ? 1 - since * 2 : 1;
      if (burn > 0) {
        const f = Math.min(m, 16);
        for (const [wide, al] of [[2.2, 0.1], [1.3, 0.18], [0.6, 0.34]] as const) ribbon(g, f, wide, (q) => `255 ${(214 - 130 * q) | 0} ${(150 - 120 * q) | 0}`, (k) => trA[k]! * al * (1 - k / f) * burn);
      }
    }
    g.restore();
  }

  /** The shield of plasma round a pylon's nose, and the sparks torn off it. */
  function plasma(g: CanvasRenderingContext2D, i: number, t: number, nx: number, ny: number, tx: number, ty: number, r: number, heat: number): void {
    const L = Math.hypot(tx - nx, ty - ny) || 1;
    const ax = (tx - nx) / L;
    const ay = (ty - ny) / L;
    const flick = 0.9 + 0.07 * Math.sin(t * 47 + i * 2.3) + 0.05 * Math.sin(t * 83 + i);
    g.save();
    g.globalCompositeOperation = "lighter";
    // The glow about it.
    const halo = r * (16 + 10 * heat) * flick;
    g.globalAlpha = 0.5 * heat;
    g.drawImage(ember!, nx + ax * L * 0.3 - halo, ny + ay * L * 0.3 - halo, halo * 2, halo * 2);
    // The cone: a bow of fire from in front of the nose, sweeping back past the tail.
    const len = (L * 1.5 + r * 10) * (0.7 + 0.5 * heat) * flick;
    const wide = r * (4.2 + 2.6 * heat);
    const fx = nx - ax * r * 1.6 * heat;
    const fy = ny - ay * r * 1.6 * heat;
    const grd = g.createLinearGradient(fx, fy, fx + ax * len, fy + ay * len);
    grd.addColorStop(0, `rgb(255 250 232 / ${(0.95 * heat).toFixed(3)})`);
    grd.addColorStop(0.12, `rgb(255 214 130 / ${(0.75 * heat).toFixed(3)})`);
    grd.addColorStop(0.4, `rgb(255 120 50 / ${(0.4 * heat).toFixed(3)})`);
    grd.addColorStop(1, "rgb(220 40 30 / 0)");
    g.fillStyle = grd;
    const bow = new Path2D();
    const STEPS = 14;
    for (let k = -STEPS; k <= STEPS; k++) {
      const s = k / STEPS;
      const along = len * s * s;
      const side = wide * s * (1 + 0.08 * Math.sin(t * 31 + k * 1.3 + i));
      const x = fx + ax * along - ay * side;
      const y = fy + ay * along + ax * side;
      if (k === -STEPS) bow.moveTo(x, y);
      else bow.lineTo(x, y);
    }
    g.fill(bow);
    // The shield's edge, in the Company's colour: these are steered, not falling.
    const edge = g.createLinearGradient(fx, fy, fx + ax * len * 0.7, fy + ay * len * 0.7);
    edge.addColorStop(0, `rgb(${mixRgb(theme.primary, "255 255 255", 0.5)} / ${(0.95 * heat).toFixed(3)})`);
    edge.addColorStop(0.3, `rgb(${theme.primary} / ${(0.5 * heat).toFixed(3)})`);
    edge.addColorStop(1, `rgb(${theme.primary} / 0)`);
    g.strokeStyle = edge;
    g.lineWidth = Math.max(1, r * 0.5);
    g.lineJoin = "round";
    g.stroke(bow);
    g.globalAlpha = 0.3;
    g.lineWidth = Math.max(2, r * 2.4);
    g.stroke(bow);
    g.globalAlpha = 1;
    // White-hot at the nose.
    const core = r * (5 + 3 * heat) * flick;
    g.globalAlpha = heat;
    g.drawImage(hot!, nx - core, ny - core, core * 2, core * 2);
    g.drawImage(fire!, nx - core * 1.8, ny - core * 1.8, core * 3.6, core * 3.6);
    g.globalAlpha = 1;
    g.restore();
  }

  function sparkle(g: CanvasRenderingContext2D, i: number, t: number): void {
    g.save();
    g.globalCompositeOperation = "lighter";
    const up = unit(cam.pos);
    for (const s of sparks[i]!) {
      const age = ((((t / s.life + s.ph) % 1) + 1) % 1) * s.life;
      const born = t - age;
      if (born < rel[i]! + 1 || born > hit[i]!) continue;
      const heat = heatAt(podAt(i, born, tmpA));
      if (heat < 0.05) continue;
      // Left behind where it was born, flung a little outwards, slowing.
      const k = age / s.life;
      const fling = 0.0075 * s.out * (k - 0.4 * k * k);
      const sx = Math.cos(s.ang);
      const sy = Math.sin(s.ang);
      if (!see(cam, tmpA[0] + (cam.r[0] * sx + up[0] * sy) * fling, tmpA[1] + (cam.r[1] * sx + up[1] * sy) * fling, tmpA[2] + (cam.r[2] * sx + up[2] * sy) * fling)) continue;
      const size = clamp((cam.focal / cam.sz) * POD_R_W * (1.2 - k), 0.8, 2.4);
      g.fillStyle = k < 0.25 ? `rgb(255 255 240 / ${heat.toFixed(3)})` : k < 0.6 ? `rgb(255 200 90 / ${(heat * (1 - k * 0.5)).toFixed(3)})` : `rgb(255 96 40 / ${(heat * (1 - k)).toFixed(3)})`;
      g.fillRect(cam.sx - size / 2, cam.sy - size / 2, size, size);
    }
    g.restore();
  }

  /** What stands on the ground after a hit: the pylon, its beam, the stuff thrown up, the flash, its tag. */
  function landed(g: CanvasRenderingContext2D, t: number, look: PylonLook): void {
    const fine = clamp(cam.focal / 1300, 0.7, 1.5);
    for (const [i, s] of sector!.sites.entries()) {
      const age = t - s.at;
      if (age < 0) continue;
      if (!see(cam, s.n[0], s.n[1], s.n[2])) continue;
      const bx = cam.sx;
      const by = cam.sy;
      const bz = cam.sz;
      const top = 1 + POD_LEN_W * 0.85;
      if (!see(cam, s.n[0] * top, s.n[1] * top, s.n[2] * top)) continue;
      const tx = cam.sx;
      const ty = cam.sy;
      g.save();
      g.globalCompositeOperation = "lighter";
      // The beam: a pillar of light thrown up into the sky, then a steady thread.
      const grow = easeOut(clamp(age / 0.5));
      const high = 1 + 0.13 * grow;
      if (see(cam, s.n[0] * high, s.n[1] * high, s.n[2] * high)) {
        const power = Math.exp(-age * 1.3) + 0.3 + 0.06 * Math.sin(t * 3.1 + i);
        const grd = g.createLinearGradient(bx, by, cam.sx, cam.sy);
        grd.addColorStop(0, `rgb(${theme.primary} / ${Math.min(1, power).toFixed(3)})`);
        grd.addColorStop(0.5, `rgb(${theme.primary} / ${(0.4 * Math.min(1, power)).toFixed(3)})`);
        grd.addColorStop(1, `rgb(${theme.primary} / 0)`);
        g.strokeStyle = grd;
        g.lineCap = "round";
        for (const [wide, al] of [[13, 0.14], [5, 0.3], [1.5, 1]] as const) {
          g.lineWidth = wide * fine * (0.6 + 0.4 * Math.min(1, power));
          g.globalAlpha = al;
          g.beginPath();
          g.moveTo(bx, by);
          g.lineTo(cam.sx, cam.sy);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      // Rock and fire thrown up, falling back.
      if (age < 1.6) {
        for (const c of chips[i]!) {
          const hgt = c.vn * age - 0.045 * age * age;
          if (hgt < 0) continue;
          const out = c.vt * age;
          const ca = Math.cos(c.ang) * out;
          const sa = Math.sin(c.ang) * out;
          if (!see(cam, s.n[0] * (1 + hgt) + s.e1[0] * ca + s.e2[0] * sa, s.n[1] * (1 + hgt) + s.e1[1] * ca + s.e2[1] * sa, s.n[2] * (1 + hgt) + s.e1[2] * ca + s.e2[2] * sa)) continue;
          const k = age / 1.6;
          const size = Math.max(1, 2.6 * fine * (1 - k));
          g.fillStyle = k < 0.3 ? `rgb(255 255 255 / ${(1 - k).toFixed(3)})` : `rgb(${theme.secondary} / ${(1 - k).toFixed(3)})`;
          g.fillRect(cam.sx - size / 2, cam.sy - size / 2, size, size);
        }
      }
      // The flash of the hit.
      if (age < 0.9) {
        const r = ((cam.focal * 0.03) / bz) * (1 + 5 * easeOut(age / 0.9));
        g.globalAlpha = Math.exp(-age * 5.5);
        g.drawImage(hot!, bx - r, by - r, r * 2, r * 2);
        g.drawImage(acc!, bx - r * 1.7, by - r * 1.7, r * 3.4, r * 3.4);
        g.drawImage(hot!, bx - r * 3.2, by - 1.5, r * 6.4, 3);
        g.globalAlpha = 1;
      }
      g.restore();
      // The pylon itself, driven into the ground, its lamp on top.
      const r = Math.max(0.6, (cam.focal / bz) * POD_R_W);
      const nx = bx - (tx - bx) * 0.18;
      const ny = by - (ty - by) * 0.18;
      drawPylon(g, nx, ny, tx, ty, r, { ...look, lit: 0.35 + 0.5 * Math.exp(-age * 2), bands: 0.8 + 0.2 * Math.sin(t * 2.4 + i), thrust: 0, hot: Math.max(0, 0.8 - age * 1.4) });
      g.save();
      g.globalCompositeOperation = "lighter";
      const pr = Math.max(3, r * 5) * (0.8 + 0.2 * Math.sin(t * 3.3 + i * 1.4));
      g.drawImage(second!, tx - pr, ty - pr, pr * 2, pr * 2);
      g.restore();
      // Its tag: which mission it stands for.
      const tag = tags[i]!;
      const shown = smooth(0.5, 0.9, age);
      if (tag && shown > 0.01) {
        g.save();
        g.globalAlpha = shown * 0.95;
        const fs = clamp(cam.w / 100, 11, 14);
        g.font = `800 ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
        g.textBaseline = "middle";
        const wide = g.measureText(tag).width + 10;
        const lx = tx + 10;
        const ly = ty - 12;
        g.strokeStyle = `rgb(${theme.primary} / 0.9)`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(tx + 2, ty - 2);
        g.lineTo(lx, ly + fs * 0.7);
        g.stroke();
        g.fillStyle = "rgb(2 10 22 / 0.72)";
        g.fillRect(lx, ly - fs * 0.75, wide, fs * 1.5);
        g.strokeRect(lx + 0.5, ly - fs * 0.75 + 0.5, wide - 1, fs * 1.5 - 1);
        g.fillStyle = "#f2fbff";
        g.fillText(tag, lx + 5, ly + 0.5);
        g.restore();
      }
    }
  }

  /** The pylons that are away from the bay and not yet down. */
  function flying(g: CanvasRenderingContext2D, t: number, look: PylonLook, lamps: number): void {
    for (let i = 0; i < n; i++) {
      const dt = t - rel[i]!;
      if (dt <= 0 || t >= hit[i]!) continue;
      // From the ship's picture to the planet's: by its own clock, and for all of them before the camera leaves the ship.
      const blend = Math.max(smooth(0.45, 0.95, dt), smooth(2.3, 2.85, t));
      let nx = 0;
      let ny = 0;
      let tx = 0;
      let ty = 0;
      let r = 0;
      let inShip = false;
      let cut: [number, number] | undefined;
      if (blend < 1) {
        shipPod(i, t, tmpA, tmpB);
        // Only what hangs below the belly is drawn here (the rest shows through the bay, hull.ts).
        if (tmpA[1] >= 0) continue;
        const a = shipView.cam(tmpA[0], tmpA[1], tmpA[2]);
        const b = shipView.cam(tmpB[0], tmpB[1], tmpB[2]);
        if (a[2] > 0.4 && b[2] > 0.4) {
          nx = cam.cx + (cam.focal * a[0]) / a[2];
          ny = cam.cy + (cam.focal * a[1]) / a[2];
          tx = cam.cx + (cam.focal * b[0]) / b[2];
          ty = cam.cy + (cam.focal * b[1]) / b[2];
          r = (cam.focal / ((a[2] + b[2]) / 2)) * POD_R_S;
          inShip = true;
          if (tmpB[1] > 0) {
            // Where it passes the belly.
            const k = -tmpA[1] / (tmpB[1] - tmpA[1]);
            cut = [nx + (tx - nx) * k, ny + (ty - ny) * k];
          }
        }
      }
      let heat = 0;
      if (blend > 0) {
        const alt = podAt(i, t, tmpC);
        podAt(i, t - 0.03, tmpD);
        const ax = unit(sub(tmpC, tmpD));
        if (see(cam, tmpC[0], tmpC[1], tmpC[2])) {
          const wnx = cam.sx;
          const wny = cam.sy;
          const wz = cam.sz;
          if (see(cam, tmpC[0] - ax[0] * POD_LEN_W, tmpC[1] - ax[1] * POD_LEN_W, tmpC[2] - ax[2] * POD_LEN_W)) {
            const wr = (cam.focal / wz) * POD_R_W;
            const k = inShip ? blend : 1;
            nx = lerp(nx, wnx, k);
            ny = lerp(ny, wny, k);
            tx = lerp(tx, cam.sx, k);
            ty = lerp(ty, cam.sy, k);
            r = inShip ? Math.exp(lerp(Math.log(r), Math.log(wr), k)) : wr;
            heat = heatAt(alt) * blend;
            inShip = true;
          }
        }
      }
      if (!inShip) continue;
      const thrust = smooth(0.3, 0.55, dt) * lerp(1.25, 0.3, heat) * (1 + 0.6 * Math.exp(-Math.pow((dt - 0.5) / 0.12, 2)));
      g.save();
      if (cut) {
        // Hide what is still inside the hold: keep only the side of the cut towards the nose.
        const L = Math.hypot(tx - nx, ty - ny) || 1;
        const ax = (tx - nx) / L;
        const ay = (ty - ny) / L;
        const B = 4000;
        g.beginPath();
        g.moveTo(cut[0] - ay * B, cut[1] + ax * B);
        g.lineTo(cut[0] + ay * B, cut[1] - ax * B);
        g.lineTo(cut[0] + ay * B - ax * B, cut[1] - ax * B - ay * B);
        g.lineTo(cut[0] - ay * B - ax * B, cut[1] + ax * B - ay * B);
        g.closePath();
        g.clip();
      }
      drawPylon(g, nx, ny, tx, ty, r, { ...look, lit: lerp(0.3 + 0.6 * lamps, 0.3, blend) + 0.5 * heat, bands: 0.9, thrust, hot: heat });
      g.restore();
      if (heat > 0.02) {
        plasma(g, i, t, nx, ny, tx, ty, r, heat);
        sparkle(g, i, t);
      }
    }
  }

  return {
    draw(g, w, h, time, free) {
      if (!(w >= 2 && h >= 2)) return;
      const t = Math.max(0, time);
      const tall = h > w * 1.15;
      if (!sector || tall !== tallNow) {
        sector = createSector(theme, sitePlaces(n, tall), hit, tags);
        tallNow = tall;
      }
      hot ??= softSprite("200 236 255", 1);
      fire ??= softSprite("255 190 110", 0.6);
      ember ??= softSprite("255 110 50", 0.15, 128);
      acc ??= softSprite(theme.primary, 0.7);
      second ??= softSprite(theme.secondary, 1, 64);
      lamp ??= softSprite(mixRgb("255 226 170", theme.secondary, 0.25), 0.8, 128);
      engine ??= flameSprite(mixRgb("150 220 255", theme.primary, 0.4), mixRgb("60 130 255", theme.primary, 0.5));

      // Every hit shakes the picture and flashes it.
      let shake = 0;
      let flash = 0;
      for (const at of hit) {
        const age = t - at;
        if (age < 0 || age > 1.2) continue;
        shake += Math.exp(-age * 5);
        flash += Math.exp(-age * 11);
      }
      setCam(t, w, h, free, Math.min(1.6, shake));
      const c = cam;

      globe.sky(g, c, t);
      const shape = globe.body(g, c);
      g.save();
      g.clip(shape);
      sector.ground(g, c, t);
      g.restore();
      globe.air(g, c, t, shape);

      const look: PylonLook = { theme, lit: 0.3, bands: 1, thrust: 0, hot: 0, flame: engine, t };
      landed(g, t, look);
      trails(g, t);

      // The ship, while any of it is still in the picture.
      const doors = ease(seg(t, DOORS_AT, DOORS_OPEN_AT));
      const lamps = clamp((t - 0.2) / 0.55) * (t < 0.8 && Math.sin(t * 58) < -0.35 ? 0.4 : 1);
      if (t < 3.7) {
        eye = shipEye(t);
        shipView.focal = c.focal;
        shipView.cx = c.cx;
        shipView.cy = c.cy;
        const draw: HullDraw = {
          t,
          doors,
          lamps,
          glow: lamp,
          cargo: () => {
            for (let i = 0; i < n; i++) {
              shipPod(i, t, tmpA, tmpB);
              if (tmpB[1] <= 0) continue;
              const a = shipView.cam(tmpA[0], tmpA[1], tmpA[2]);
              const b = shipView.cam(tmpB[0], tmpB[1], tmpB[2]);
              if (a[2] < 0.4 || b[2] < 0.4) continue;
              const armed = smooth(rel[i]! - 0.5, rel[i]! - 0.15, t);
              drawPylon(g, c.cx + (c.focal * a[0]) / a[2], c.cy + (c.focal * a[1]) / a[2], c.cx + (c.focal * b[0]) / b[2], c.cy + (c.focal * b[1]) / b[2], (c.focal / ((a[2] + b[2]) / 2)) * POD_R_S, { ...look, lit: 0.2 + 0.75 * lamps, bands: 0.25 + 0.75 * armed, thrust: 0, hot: 0 });
            }
          },
        };
        hull.draw(g, shipView, draw);
        hull.shafts(g, shipView, draw);
      }
      flying(g, t, look, lamps);

      // Motes drifting past the lens (they move the most: the nearest layer of all).
      g.save();
      g.globalCompositeOperation = "lighter";
      const [clon, calt] = camTrack(t) as [number, number];
      for (const d of dust) {
        const x = ((((d.x + clon * 0.021 * d.z) % 1) + 1) % 1) * w;
        const y = ((((d.y - calt * 2.6 * d.z + t * 0.006 * d.z) % 1) + 1) % 1) * h;
        g.fillStyle = `rgb(200 226 255 / ${(0.1 + 0.16 * d.z * (0.5 + 0.5 * Math.sin(t * 0.9 + d.ph))).toFixed(3)})`;
        const s = 0.8 + 1.3 * d.z;
        g.fillRect(x, y, s, s);
      }
      g.restore();

      // The edges of the picture a little darker; a hit flashes the whole of it; it opens from black.
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.62);
      vg.addColorStop(0, "rgb(0 0 0 / 0)");
      vg.addColorStop(1, "rgb(0 0 0 / 0.5)");
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      if (flash > 0.01) {
        g.fillStyle = `rgb(${mixRgb(theme.primary, "255 255 255", 0.7)} / ${Math.min(0.3, flash * 0.16).toFixed(3)})`;
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

