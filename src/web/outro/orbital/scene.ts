/**
 * Orbital Claim: the film (designer 2026-11-19). The Company claims the sector it has won:
 * corporate-military annexation, no terraforming.
 *
 *   Act 1  low orbit over the night side of the planet of the intro, its curved edge ahead with the
 *          first light on it; battle smoke and lightning linger round the liberated sector. From the
 *          sector a beacon beam in the Company's colour climbs straight up through the clouds and the
 *          air into space, ringed by rising rings of ionised dust.
 *   Act 2  the camera rises along the beam; the Company's Flagship (flagship.ts) glides in over it
 *          and comes to rest; the clamps under its belly lock on the beam with a flash: one tether
 *          of light from the ship to the ground.
 *   Act 3  from the tether point twelve relay satellites fly out and snap into a lattice; from it a
 *          wave of see-through hexagonal borders sweeps out over the curve of the ground until the
 *          whole region is under the Company's grid; "ASSET SECURED" locks in by the tether.
 *   Act 4  a slow orbital drift, the Flagship standing guard over the claimed grid; the Debrief card
 *          slides in beside it (the picture turns so ship and planet stay in the open part).
 *
 * One 2D canvas: stars, the sun, the globe (globe.ts), smoke and lightning, the grid, the beam and
 * its rings, the satellites and their lattice, the ship, its thrusters, the telemetry. Every moving
 * thing is worked out from the time alone, so any moment can be drawn by itself. Looks only.
 */

import { add, cameraAxes, clamp, ease, easeOut, lerp, mul, rng, seg, smooth, TAU, unit, type V3 } from "../../briefing/styles/intro2/math3.js";
import { createRenderer, type Lights, type Pose } from "../../briefing/styles/intro2/mesh.js";
import { mixRgb, softSprite } from "../terraformer/pylon.js";
import { track } from "../terraformer/view.js";
import type { CompanyTheme } from "../types.js";
import { flagshipFor } from "./flagship.js";
import { createGlobe, facing, groundPoint, prepareGround, RP, type GlobeCam } from "./globe.js";
import { ARRIVE_AT, ARRIVE_FROM, BEAM_AT, BEAM_CLIMB, DEBRIEF_AT, GRID_AT, gridReach, LATTICE_AT, LOCK_AT, RING_EVERY, RING_FROM, satLaunch, SATS, satSnap, SECURED_AT, snappedBy, TETHER_FULL } from "./timeline.js";

/** The part of the picture the Debrief card leaves open, CSS px: ship and planet are kept inside it. */
export interface FreeArea {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface OrbitalScene {
  /** Draw film time t (seconds at Normal speed; past the film's end the slow drift goes on). `quality` 0.45..1: softer on a slow machine. */
  draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, free?: FreeArea, quality?: number): void;
  /** Make the ground picture a little at a time (once a frame, before draw); `budget` ms. */
  prepare(budget: number): void;
}
export interface SceneSetup {
  theme: CompanyTheme;
  vesselId: string;
}

const DEG = Math.PI / 180;
/** The Flagship's height over the sector when it holds station, world units. */
const HOLD = 26;
/** The way to the sun: ahead and to starboard, a little under the sector's horizon (it is night there; first light on the edge ahead; it lights the side of the ship the camera sees). */
const SUN: V3 = unit([0.82, -0.2, 0.54]);
/** The grid: the size of one hexagon (centre to corner) and the region's radius, world units. */
const HEX = 4;
const REGION = 110;
/** The satellites' lattice: its height and its two rings' radii. */
const LAT_Y = 15;
const RING_IN = 6.5;
const RING_OUT = 13;

/**
 * The camera: [time, look-at x, y, z, round from astern (deg), above (deg), distance, aimed up by (deg)].
 * It starts low and far astern, looking along the ground to the edge; rises along the beam to the
 * ship, looking up at it; swings out and up to look down on ship and region; then drifts slowly round.
 */
const CAM_KEYS = [
  [0, 0, 12, 0, 10, 3, 120, 0],
  [2.6, 0, 15, 0, 18, 4, 104, 0],
  [4.3, 0, 20, 0, 36, -2, 60, 0],
  [5.7, 0, 25, 0, 56, -9, 40, 0],
  [6.8, 0, 20, 0, 68, 10, 42, 0],
  [9.4, 0, 15, 0, 86, 26, 52, 2],
  [12, 0, 16, 0, 100, 31, 48, 6],
] as const;
/** On a tall screen (a phone): nearer, so the ship fills the narrow picture's width; the tether runs down its height. */
const CAM_TALL = [
  [0, 0, 13, 0, 10, 4, 130, 0],
  [2.6, 0, 16, 0, 18, 5, 112, 0],
  [4.3, 0, 21, 0, 36, 0, 46, 0],
  [5.7, 0, 23, 0, 56, -6, 31, 0],
  [6.8, 0, 18, 0, 68, 12, 33, 0],
  [9.4, 0, 14, 0, 86, 28, 39, 0],
  [12, 0, 16, 0, 100, 31, 37, 4],
] as const;

/** A fixed pseudo-random number 0..1 for a few integers (looks only). */
function hash(a: number, b: number, c = 0): number {
  const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return x - Math.floor(x);
}

interface Hex {
  /** Centre in S's tangent plane, its ring (0 = the sector), its distance from S. */
  a: number;
  b: number;
  ring: number;
  d: number;
  /** Its six corners' indices in the corner list. */
  c: number[];
}

/** The Flagship's place over time: it glides in from astern and above, slowing, and holds station. */
function shipPath(t: number, rest: number): { x: number; y: number; z: number; u: number } {
  const u = seg(t, ARRIVE_FROM, ARRIVE_AT);
  const k = Math.pow(1 - u, 3);
  const hold = Math.max(0, t - ARRIVE_AT);
  return {
    x: rest - 120 * k + 0.12 * Math.sin(hold * 0.5) * smooth(0, 1.5, hold),
    y: HOLD + 9 * (1 - u) * (1 - u) + 0.1 * Math.sin(hold * 0.37 + 1),
    z: -4 * k + 0.08 * Math.sin(hold * 0.29),
    u,
  };
}

export function createOrbitalScene(o: SceneSetup): OrbitalScene {
  const { theme } = o;
  const ship = flagshipFor(o.vesselId, theme);
  const drawShip = createRenderer(ship.model);
  const globe = createGlobe();
  const camWide = track(CAM_KEYS);
  const camTall = track(CAM_TALL);
  const R = rng(7070);
  const rest = -ship.hub[0];
  const P = theme.primary;
  const P2 = theme.secondary;
  const pale = mixRgb(P, "255 255 255", 0.55);
  let sprites: { core: HTMLCanvasElement; prim: HTMLCanvasElement; sec: HTMLCanvasElement; white: HTMLCanvasElement; fire: HTMLCanvasElement; bolt: HTMLCanvasElement; smoke: HTMLCanvasElement; beamGlow: HTMLCanvasElement; beamCore: HTMLCanvasElement } | undefined;

  // ---- Things made once.
  const stars = Array.from({ length: 900 }, () => {
    const z = R() * 2 - 1;
    const a = R() * TAU;
    const s = Math.sqrt(1 - z * z);
    // A band of more and fainter stars across the sky.
    const band = R() < 0.35;
    const d: V3 = band ? unit([Math.cos(a), 0.25 * (R() - 0.5) + 0.3 * Math.sin(a), Math.sin(a) * 0.9]) : [s * Math.cos(a), z, s * Math.sin(a)];
    return { d, m: band ? 0.15 + 0.35 * R() : Math.pow(R(), 3), ph: R() * TAU, warm: R() < 0.2 };
  });
  // The grid's hexagons (pointy-topped, axial coordinates) and their corners, in S's tangent plane.
  const hexes: Hex[] = [];
  const corners: number[] = [];
  const cornerAt = new Map<string, number>();
  const N = Math.ceil(REGION / (HEX * 1.5)) + 1;
  for (let q = -N * 2; q <= N * 2; q++)
    for (let r = -N * 2; r <= N * 2; r++) {
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
      const a = HEX * Math.sqrt(3) * (q + r / 2);
      const b = HEX * 1.5 * r;
      const d = Math.hypot(a, b);
      if (d > REGION + HEX) continue;
      const c: number[] = [];
      for (let k = 0; k < 6; k++) {
        const ang = ((60 * k - 30) * Math.PI) / 180;
        const ca = a + HEX * Math.cos(ang);
        const cb = b + HEX * Math.sin(ang);
        const key = `${Math.round(ca * 10)},${Math.round(cb * 10)}`;
        let i = cornerAt.get(key);
        if (i === undefined) {
          i = corners.length / 2;
          corners.push(ca, cb);
          cornerAt.set(key, i);
        }
        c.push(i);
      }
      hexes.push({ a, b, ring, d, c });
    }
  hexes.sort((x, y) => x.d - y.d);
  const nc = corners.length / 2;
  const CX = new Float32Array(nc);
  const CY = new Float32Array(nc);
  const CV = new Uint8Array(nc);
  // The lattice: an inner and an outer ring of six round the tether, at LAT_Y.
  const slots: V3[] = [];
  for (let k = 0; k < 6; k++) slots.push([Math.cos((k * 60 * Math.PI) / 180) * RING_IN, LAT_Y + 1.5, Math.sin((k * 60 * Math.PI) / 180) * RING_IN]);
  for (let k = 0; k < 6; k++) slots.push([Math.cos(((k * 60 + 30) * Math.PI) / 180) * RING_OUT, LAT_Y - 2, Math.sin(((k * 60 + 30) * Math.PI) / 180) * RING_OUT]);
  // Launch order: alternating inner and outer, round the ring.
  const order = [0, 6, 1, 7, 2, 8, 3, 9, 4, 10, 5, 11];
  const links: [number, number][] = [];
  for (let k = 0; k < 6; k++) {
    links.push([k, (k + 1) % 6], [6 + k, 6 + ((k + 1) % 6)], [k, 6 + k], [(k + 1) % 6, 6 + k]);
  }
  // Battle smoke and fires round the sector, and lightning out on the night side.
  const smoke = Array.from({ length: 26 }, () => {
    const a = R() * TAU;
    const d = 6 + R() * 34;
    return { a: Math.cos(a) * d, b: Math.sin(a) * d, s: 2.5 + R() * 5, ph: R() * TAU, sp: 0.15 + R() * 0.25, fire: R() < 0.55 };
  });
  const bolts = Array.from({ length: 9 }, (_, i) => {
    const a = (-0.55 + R() * 1.4) * Math.PI * (i % 2 ? 1 : -1) * 0.5 + (i % 3 === 0 ? Math.PI * 0.5 : 0);
    const d = 40 + R() * 140;
    return { a: Math.cos(a) * d + 20, b: Math.sin(a) * d, period: 1.2 + R() * 1.6, ph: R() * 3, size: 4 + R() * 6 };
  });
  const dustMotes = Array.from({ length: 60 }, () => ({ ph: R(), sp: 0.12 + R() * 0.25, ang: R() * TAU, rad: 0.8 + R() * 3.2 }));

  const cam: GlobeCam = { pos: [0, 0, 0], r: [1, 0, 0], d: [0, -1, 0], f: [0, 0, 1], focal: 1000, cx: 0, cy: 0, w: 1, h: 1 };
  const tmp: V3 = [0, 0, 0];
  /** Where world point p is in the picture: [x, y, depth]; depth <= 0 when it is behind the camera. */
  function see(p: V3, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
    const qx = p[0] - cam.pos[0];
    const qy = p[1] - cam.pos[1];
    const qz = p[2] - cam.pos[2];
    const z = qx * cam.f[0] + qy * cam.f[1] + qz * cam.f[2];
    const zz = Math.max(0.05, z);
    out[0] = cam.cx + (cam.focal * (qx * cam.r[0] + qy * cam.r[1] + qz * cam.r[2])) / zz;
    out[1] = cam.cy + (cam.focal * (qx * cam.d[0] + qy * cam.d[1] + qz * cam.d[2])) / zz;
    out[2] = z;
    return out;
  }
  const S1: [number, number, number] = [0, 0, 0];
  const S2: [number, number, number] = [0, 0, 0];

  /** Place the camera for time t; the open part of the picture (Act 4) moves the picture's middle into it. */
  function placeCamera(t: number, w: number, h: number, free: FreeArea | undefined): void {
    const tall = h > w * 1.1;
    const k = (tall ? camTall : camWide)(Math.min(t, 12));
    const after = Math.max(0, t - 12);
    // After the film: a slow orbit round the tether, gently up and down.
    const az = k[3]! + after * 0.9;
    const el = k[4]! + 1.5 * Math.sin(after * 0.15);
    const dist = k[5]!;
    const ax = cameraAxes(az, el, 0);
    const target: V3 = [k[0]!, k[1]!, k[2]!];
    cam.pos = add(target, mul(ax.back, dist));
    // Aimed a little above what it circles: more sky and stars over the ship.
    const lift = k[6]! * DEG;
    const cl = Math.cos(lift);
    const sl = Math.sin(lift);
    cam.r = ax.r;
    cam.f = [ax.f[0] * cl - ax.d[0] * sl, ax.f[1] * cl - ax.d[1] * sl, ax.f[2] * cl - ax.d[2] * sl];
    cam.d = [ax.d[0] * cl + ax.f[0] * sl, ax.d[1] * cl + ax.f[1] * sl, ax.d[2] * cl + ax.f[2] * sl];
    cam.w = w;
    cam.h = h;
    let focal = 1.08 * Math.min(h, w * 0.95);
    let cx = w * 0.5;
    let cy = h * 0.5;
    // The Debrief: the picture's middle moves into the open part, and the picture is made smaller to fit it.
    const deb = free ? smooth(DEBRIEF_AT - 0.7, DEBRIEF_AT + 0.9, t) : 0;
    if (free && deb > 0) {
      const side = free.w < w * 0.9;
      const fit = side ? clamp(free.w / (w * 0.82), 0.6, 1) : clamp(free.h / (h * 0.8), 0.74, 1);
      focal *= lerp(1, fit, deb);
      cx = lerp(cx, free.x + free.w * 0.5, deb);
      cy = lerp(cy, free.y + free.h * (side ? 0.5 : 0.56), deb);
    }
    cam.focal = focal;
    cam.cx = cx;
    cam.cy = cy;
  }

  // ---- The sky.
  function drawSky(g: CanvasRenderingContext2D, t: number): void {
    const { w, h } = cam;
    g.fillStyle = "rgb(3 5 12)";
    g.fillRect(0, 0, w, h);
    // A faint glow of the galaxy's band behind the stars.
    for (const s of [false, true]) {
      g.fillStyle = s ? "rgb(255 236 210)" : "rgb(200 220 255)";
      for (const st of stars) {
        if (st.warm !== s) continue;
        const z = st.d[0] * cam.f[0] + st.d[1] * cam.f[1] + st.d[2] * cam.f[2];
        if (z <= 0.05) continue;
        const x = cam.cx + (cam.focal * (st.d[0] * cam.r[0] + st.d[1] * cam.r[1] + st.d[2] * cam.r[2])) / z;
        const y = cam.cy + (cam.focal * (st.d[0] * cam.d[0] + st.d[1] * cam.d[1] + st.d[2] * cam.d[2])) / z;
        if (x < -2 || y < -2 || x > w + 2 || y > h + 2) continue;
        const a = st.m * (0.75 + 0.25 * Math.sin(t * 1.3 + st.ph));
        if (a < 0.04) continue;
        g.globalAlpha = Math.min(1, a);
        const r = st.m > 0.6 ? 1.6 : st.m > 0.25 ? 1.1 : 0.8;
        g.fillRect(x - r / 2, y - r / 2, r, r);
      }
    }
    g.globalAlpha = 1;
    // The sun's glare (the globe is drawn over it where it stands behind the planet).
    const z = SUN[0] * cam.f[0] + SUN[1] * cam.f[1] + SUN[2] * cam.f[2];
    if (z > 0.05) {
      const x = cam.cx + (cam.focal * (SUN[0] * cam.r[0] + SUN[1] * cam.r[1] + SUN[2] * cam.r[2])) / z;
      const y = cam.cy + (cam.focal * (SUN[0] * cam.d[0] + SUN[1] * cam.d[1] + SUN[2] * cam.d[2])) / z;
      g.save();
      g.globalCompositeOperation = "lighter";
      const r = cam.focal * 0.55;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, "rgb(255 246 226 / 0.95)");
      grd.addColorStop(0.04, "rgb(255 226 170 / 0.55)");
      grd.addColorStop(0.2, "rgb(255 176 110 / 0.14)");
      grd.addColorStop(1, "rgb(255 160 100 / 0)");
      g.fillStyle = grd;
      g.fillRect(x - r, y - r, r * 2, r * 2);
      g.restore();
    }
  }

  // ---- The lingering battle: smoke and fires round the sector, lightning out on the night side.
  function drawBattle(g: CanvasRenderingContext2D, t: number, calm: number): void {
    const sp = sprites!;
    g.save();
    // Smoke: dark drifts lying over the ground, lit from beneath by fires and from the beam.
    for (const s of smoke) {
      const drift = t * s.sp;
      groundPoint(s.a + drift * 1.2, s.b + drift * 0.4, 0.8, tmp);
      if (!facing(cam, tmp)) continue;
      see(tmp, S1);
      if (S1[2] <= 1) continue;
      const r = (cam.focal * s.s * (1 + 0.04 * drift)) / S1[2];
      if (r < 1 || S1[0] < -r || S1[0] > cam.w + r || S1[1] < -r || S1[1] > cam.h + r) continue;
      const a = 0.42 * (1 - 0.6 * calm);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = a;
      g.drawImage(sp.smoke, S1[0] - r, S1[1] - r * 0.55, r * 2, r * 1.1);
      if (s.fire) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = (0.5 + 0.3 * Math.sin(t * 5 + s.ph)) * (1 - 0.8 * calm);
        const fr = r * 0.35;
        g.drawImage(sp.fire, S1[0] - fr, S1[1] - fr * 0.6, fr * 2, fr * 1.2);
      }
    }
    // Lightning: clouds flashing from inside, two or three quick flickers, again and again.
    g.globalCompositeOperation = "lighter";
    for (const b of bolts) {
      const ph = (((t + b.ph) % b.period) + b.period) % b.period;
      if (ph > 0.32) continue;
      const k = (ph < 0.05 ? 1 : ph < 0.1 ? 0.25 : ph < 0.15 ? 0.85 : ph < 0.2 ? 0.2 : ph < 0.26 ? 0.55 : 0) * (1 - calm);
      if (k <= 0.02) continue;
      groundPoint(b.a, b.b, 1.2, tmp);
      if (!facing(cam, tmp)) continue;
      // Only on the night side.
      const n = unit([tmp[0], tmp[1] + RP, tmp[2]]);
      if (n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2] > 0.02) continue;
      see(tmp, S1);
      if (S1[2] <= 1) continue;
      const r = (cam.focal * b.size * 2.2) / S1[2];
      g.globalAlpha = k * 0.9;
      g.drawImage(sp.bolt, S1[0] - r, S1[1] - r * 0.6, r * 2, r * 1.2);
    }
    g.restore();
  }

  // ---- The territory grid: hexagons light as the wave passes them, then stay as see-through borders.
  function drawGrid(g: CanvasRenderingContext2D, t: number): void {
    const reach = gridReach(t) * REGION;
    if (reach <= 0) return;
    // The corners in the picture (only those the wave has reached and the camera can see).
    for (let i = 0; i < nc; i++) {
      const ca = corners[i * 2]!;
      const cb = corners[i * 2 + 1]!;
      CV[i] = 0;
      if (Math.hypot(ca, cb) > reach + HEX * 2) continue;
      groundPoint(ca, cb, 0.25, tmp);
      if (!facing(cam, tmp)) continue;
      see(tmp, S1);
      if (S1[2] <= 1) continue;
      CX[i] = S1[0];
      CY[i] = S1[1];
      CV[i] = 1;
    }
    const BUCKETS = 6;
    const paths = Array.from({ length: BUCKETS }, () => new Path2D());
    const fill = new Path2D();
    const flash = new Path2D();
    const home = new Path2D();
    let any = false;
    for (const hx of hexes) {
      if (hx.d > reach) break;
      const c = hx.c;
      if (!CV[c[0]!] || !CV[c[1]!] || !CV[c[2]!] || !CV[c[3]!] || !CV[c[4]!] || !CV[c[5]!]) continue;
      // How long since the wave passed it (s); near the region's edge the borders fade out.
      const since = (reach - hx.d) / (REGION * 0.6);
      const edge = 1 - smooth(REGION * 0.72, REGION, hx.d);
      const lit = since < 0.25 ? 1 : 0;
      const b = Math.min(BUCKETS - 1, Math.floor(edge * 0.999 * (BUCKETS - 1)) + lit);
      const pa = paths[b]!;
      pa.moveTo(CX[c[0]!]!, CY[c[0]!]!);
      for (let k = 1; k < 6; k++) pa.lineTo(CX[c[k]!]!, CY[c[k]!]!);
      pa.closePath();
      const target = hx.ring <= 1 ? home : since < 0.3 ? flash : fill;
      target.moveTo(CX[c[0]!]!, CY[c[0]!]!);
      for (let k = 1; k < 6; k++) target.lineTo(CX[c[k]!]!, CY[c[k]!]!);
      target.closePath();
      any = true;
    }
    if (!any) return;
    const settle = smooth(GRID_AT, GRID_AT + 2.6, t);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.fillStyle = `rgb(${P} / ${(0.06 + 0.02 * Math.sin(t * 1.7)).toFixed(3)})`;
    g.fill(fill);
    g.fillStyle = `rgb(${pale} / 0.2)`;
    g.fill(flash);
    g.fillStyle = `rgb(${P2} / ${(0.1 + 0.03 * Math.sin(t * 3)).toFixed(3)})`;
    g.fill(home);
    g.lineJoin = "round";
    const lw = clamp(cam.focal / 900, 0.6, 1.4);
    for (let b = 0; b < BUCKETS; b++) {
      const k = b / (BUCKETS - 1);
      g.strokeStyle = b === BUCKETS - 1 ? `rgb(${pale} / 0.85)` : `rgb(${P} / ${(0.12 + 0.5 * k * (0.7 + 0.3 * settle)).toFixed(3)})`;
      g.lineWidth = lw * (b === BUCKETS - 1 ? 1.4 : 1);
      g.stroke(paths[b]!);
    }
    g.strokeStyle = `rgb(${P2} / 0.7)`;
    g.lineWidth = lw * 1.3;
    g.stroke(home);
    g.restore();
  }

  // ---- The beacon beam, its light on the ground and the rings rising round it.
  function beamTop(t: number, sh: { x: number; y: number }): { top: number; blocked: boolean } {
    const since = t - BEAM_AT;
    if (since <= 0) return { top: 0, blocked: false };
    const climb = 900 * Math.pow(clamp(since / BEAM_CLIMB), 1.6);
    // Once the ship is over it, its belly stops the beam.
    const over = Math.abs(sh.x - 0) < ship.half[0] * 0.92 && sh.y > 0;
    const belly = sh.y + ship.hub[1];
    return over && climb > belly ? { top: belly, blocked: true } : { top: climb, blocked: false };
  }

  /** The beam from height `from` to `to` over the sector: a soft glow and a white core, drawn in pieces so it is wider where it is nearer. */
  function drawBeam(g: CanvasRenderingContext2D, t: number, from: number, to: number, strength: number): void {
    if (to <= from) return;
    const sp = sprites!;
    const since = t - BEAM_AT;
    const power = strength * (1 + 1.4 * Math.exp(-since * 2.5)) * (0.93 + 0.07 * Math.sin(t * 9));
    const open = to > 300;
    const top = Math.min(to, 2400);
    const N = 16;
    g.save();
    g.globalCompositeOperation = "lighter";
    let y0 = from;
    see([0, y0, 0], S1);
    for (let k = 1; k <= N; k++) {
      const y1 = from + (top - from) * Math.pow(k / N, 1.8);
      see([0, y1, 0], S2);
      if (S1[2] > 1 && S2[2] > 1) {
        const z = (S1[2] + S2[2]) / 2;
        const len = Math.hypot(S2[0] - S1[0], S2[1] - S1[1]);
        const ym = (y0 + y1) / 2;
        // Open to space it fades as it climbs; stopped by the ship it holds its strength.
        const along = open ? 1 - smooth(60, top, ym) : 1;
        const al = clamp(power * along);
        if (al > 0.01 && len > 0.5) {
          const ang = Math.atan2(S2[1] - S1[1], S2[0] - S1[0]);
          const glow = clamp((cam.focal * 3.6) / z, 6, cam.focal * 0.22);
          const core = clamp((cam.focal * 0.9) / z, 3, cam.focal * 0.05);
          g.save();
          g.translate(S1[0], S1[1]);
          g.rotate(ang);
          g.globalAlpha = clamp(al * 0.9);
          g.drawImage(sp.beamGlow, 0, -glow / 2, len + 0.5, glow);
          g.globalAlpha = clamp(al);
          g.drawImage(sp.beamCore, 0, -core / 2, len + 0.5, core);
          g.restore();
        }
      }
      y0 = y1;
      S1[0] = S2[0];
      S1[1] = S2[1];
      S1[2] = S2[2];
    }
    // Light running up it.
    const len = Math.min(top, 400) - from;
    g.globalAlpha = 1;
    for (const m of dustMotes) {
      const k = (((t * m.sp + m.ph) % 1) + 1) % 1;
      const y = from + len * k * k;
      const p = see([Math.cos(m.ang) * m.rad * 0.08, y, Math.sin(m.ang) * m.rad * 0.08], S1);
      if (p[2] <= 1) continue;
      const r = clamp((cam.focal * 0.3) / p[2], 1, 7);
      g.globalAlpha = (1 - k) * 0.7 * clamp(strength);
      g.drawImage(sp.prim, p[0] - r, p[1] - r, r * 2, r * 2);
    }
    g.restore();
  }

  function drawGroundGlow(g: CanvasRenderingContext2D, t: number): void {
    const since = t - BEAM_AT;
    if (since <= 0) return;
    const sp = sprites!;
    g.save();
    g.globalCompositeOperation = "lighter";
    // The pool of light round the beam's foot, and a ring of shock through the cloud as it fires.
    const pool = (0.55 + 0.6 * Math.exp(-since * 2)) * (0.9 + 0.1 * Math.sin(t * 6));
    for (const [rad, al, spr] of [
      [12, 0.5, sp.prim],
      [3.5, 0.9, sp.core],
    ] as const) {
      const p = see([0, 0.4, 0], S1);
      if (p[2] <= 1) continue;
      const rx = (cam.focal * rad) / p[2];
      // Lying on the ground: flattened as the ground is seen slantwise.
      const q = see([0, 0.4, rad], S2);
      const ry = Math.max(rx * 0.12, Math.abs(q[1] - p[1]) * 1.1, 2);
      g.globalAlpha = clamp(al * pool);
      g.drawImage(spr, p[0] - rx, p[1] - ry, rx * 2, ry * 2);
    }
    const shock = seg(since, 0, 1.6);
    if (shock > 0 && shock < 1) {
      const rr = 2 + 26 * easeOut(shock);
      g.strokeStyle = `rgb(${pale} / ${(0.45 * (1 - shock) * (1 - shock)).toFixed(3)})`;
      g.lineWidth = 2;
      g.beginPath();
      for (let k = 0; k <= 48; k++) {
        const a = (k / 48) * TAU;
        groundPoint(Math.cos(a) * rr, Math.sin(a) * rr, 1, tmp);
        const p = see(tmp, S1);
        if (k === 0) g.moveTo(p[0], p[1]);
        else g.lineTo(p[0], p[1]);
      }
      g.stroke();
    }
    g.restore();
  }

  /** The rings of ionised dust rising round the beam (each born RING_EVERY after the last). */
  function drawRings(g: CanvasRenderingContext2D, t: number, ceiling: number): void {
    if (t < RING_FROM) return;
    g.save();
    g.globalCompositeOperation = "lighter";
    const last = Math.floor((t - RING_FROM) / RING_EVERY);
    for (let k = Math.max(0, last - 8); k <= last; k++) {
      const age = t - RING_FROM - k * RING_EVERY;
      if (age < 0) continue;
      const y = 1 + 8 * age + 4 * age * age;
      if (y > ceiling - 2) continue;
      const rad = 1.1 + 1.5 * age;
      const life = (1 - smooth(1.6, 2.6, age)) * smooth(0, 0.25, age) * (1 - smooth(ceiling * 0.6, ceiling - 2, y));
      if (life <= 0.02) continue;
      const wob = hash(k, 3) * TAU;
      const ring = new Path2D();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * TAU;
        const r = rad * (1 + 0.04 * Math.sin(a * 3 + wob + age * 2));
        const p = see([Math.cos(a) * r, y + 0.08 * Math.sin(a * 2 + wob), Math.sin(a) * r], S1);
        if (i === 0) ring.moveTo(p[0], p[1]);
        else ring.lineTo(p[0], p[1]);
      }
      // A soft band of glowing dust with a thin bright edge.
      const c = see([0, y, 0], S2);
      const wide = clamp((cam.focal * 0.5) / Math.max(1, c[2]), 2, 18);
      g.lineJoin = "round";
      g.strokeStyle = `rgb(${P} / ${(0.16 * life).toFixed(3)})`;
      g.lineWidth = wide;
      g.stroke(ring);
      g.strokeStyle = `rgb(${P} / ${(0.18 * life).toFixed(3)})`;
      g.lineWidth = wide * 0.45;
      g.stroke(ring);
      g.strokeStyle = `rgb(${pale} / ${(0.55 * life).toFixed(3)})`;
      g.lineWidth = 1;
      g.stroke(ring);
      // Dust caught in it.
      for (let i = 0; i < 8; i++) {
        const a = hash(k, i) * TAU + age * (0.6 + hash(i, k));
        const r = rad * (0.85 + 0.35 * hash(i, k, 2));
        const p = see([Math.cos(a) * r, y + (hash(k, i, 3) - 0.5) * 0.4, Math.sin(a) * r], S1);
        if (p[2] <= 1) continue;
        const s = clamp((cam.focal * 0.25) / p[2], 0.6, 3);
        g.fillStyle = `rgb(${pale} / ${(0.5 * life).toFixed(3)})`;
        g.fillRect(p[0] - s / 2, p[1] - s / 2, s, s);
      }
    }
    g.restore();
  }

  // ---- The relay satellites and their lattice.
  function satPos(k: number, t: number, hub: V3, out: V3): number {
    const slot = slots[order.indexOf(k) >= 0 ? k : 0]!;
    const i = order.indexOf(k);
    const u = seg(t, satLaunch(i), satSnap(i));
    if (u <= 0) return -1;
    const e = ease(u);
    // Out and down from the hub along a curve, then into its slot.
    const mid: V3 = [slot[0] * 0.55, lerp(hub[1], slot[1], 0.35) - 1.5, slot[2] * 0.55];
    const a = 1 - e;
    out[0] = a * a * hub[0] + 2 * a * e * mid[0] + e * e * slot[0];
    out[1] = a * a * hub[1] + 2 * a * e * mid[1] + e * e * slot[1] + 0.1 * Math.sin(t * 0.8 + k) * smooth(1, 2, t - satSnap(i));
    out[2] = a * a * hub[2] + 2 * a * e * mid[2] + e * e * slot[2];
    return u;
  }

  function drawSats(g: CanvasRenderingContext2D, t: number, hub: V3, near: boolean, shipDepth: number): void {
    if (t < satLaunch(0)) return;
    const sp = sprites!;
    const pos: V3[] = slots.map(() => [0, 0, 0]);
    const u = slots.map((_, k) => satPos(k, t, hub, pos[k]!));
    g.save();
    g.globalCompositeOperation = "lighter";
    // The lattice: links light up once both ends are in place.
    if (!near) {
      const on = smooth(LATTICE_AT, LATTICE_AT + 0.5, t);
      for (const [i, j] of links) {
        const si = satSnap(order.indexOf(i));
        const sj = satSnap(order.indexOf(j));
        const k = on * smooth(Math.max(si, sj), Math.max(si, sj) + 0.3, t);
        if (k <= 0.01) continue;
        const a = see(pos[i]!, S1);
        const b = see(pos[j]!, S2);
        if (a[2] <= 1 || b[2] <= 1) continue;
        g.strokeStyle = `rgb(${P} / ${(0.4 * k).toFixed(3)})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
        // A pulse running along it.
        const q = (((t * 0.7 + hash(i, j)) % 1) + 1) % 1;
        const x = lerp(a[0], b[0], q);
        const y = lerp(a[1], b[1], q);
        g.globalAlpha = 0.8 * k;
        g.drawImage(sp.prim, x - 4, y - 4, 8, 8);
        g.globalAlpha = 1;
      }
      // From the lattice the grid is projected down: faint lines to the edge of the wave.
      const reach = gridReach(t) * REGION;
      const proj = smooth(GRID_AT - 0.1, GRID_AT + 0.4, t) * (1 - smooth(GRID_AT + 1.9, GRID_AT + 3.2, t));
      if (proj > 0.01 && reach > 2) {
        for (let k = 6; k < 12; k++) {
          if (u[k]! < 1) continue;
          const a = see(pos[k]!, S1);
          for (const off of [-0.5, 0.5]) {
            const ang = Math.atan2(slots[k]![2], slots[k]![0]) + off * 0.5;
            groundPoint(Math.cos(ang) * reach, Math.sin(ang) * reach, 1, tmp);
            if (!facing(cam, tmp)) continue;
            const b = see(tmp, S2);
            if (a[2] <= 1 || b[2] <= 1) continue;
            const grd = g.createLinearGradient(a[0], a[1], b[0], b[1]);
            grd.addColorStop(0, `rgb(${pale} / ${(0.35 * proj).toFixed(3)})`);
            grd.addColorStop(1, `rgb(${P} / ${(0.05 * proj).toFixed(3)})`);
            g.strokeStyle = grd;
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(a[0], a[1]);
            g.lineTo(b[0], b[1]);
            g.stroke();
          }
        }
      }
    }
    // The satellites themselves: a lit body, two panels, a blinking light; a flash as each snaps in.
    for (let k = 0; k < slots.length; k++) {
      if (u[k]! < 0) continue;
      const p = see(pos[k]!, S1);
      if (p[2] <= 1 || p[2] < shipDepth !== near) continue;
      const s = clamp((cam.focal * 0.35) / p[2], 1.5, 9);
      const ang = Math.atan2(slots[k]![2], slots[k]![0]);
      const e = see([pos[k]![0] - Math.sin(ang) * 0.5, pos[k]![1], pos[k]![2] + Math.cos(ang) * 0.5], S2);
      g.globalCompositeOperation = "source-over";
      g.strokeStyle = "rgb(150 170 200 / 0.9)";
      g.lineWidth = Math.max(1, s * 0.35);
      g.beginPath();
      g.moveTo(p[0] * 2 - e[0], p[1] * 2 - e[1]);
      g.lineTo(e[0], e[1]);
      g.stroke();
      g.globalCompositeOperation = "lighter";
      g.drawImage(sp.prim, p[0] - s * 1.6, p[1] - s * 1.6, s * 3.2, s * 3.2);
      g.fillStyle = "rgb(255 255 255 / 0.95)";
      g.fillRect(p[0] - s * 0.22, p[1] - s * 0.22, s * 0.44, s * 0.44);
      const blink = ((t * 1.4 + k * 0.37) % 1) < 0.12 ? 1 : 0;
      if (blink) g.drawImage(sp.sec, p[0] - s * 1.2, p[1] - s * 1.2, s * 2.4, s * 2.4);
      const snap = t - satSnap(order.indexOf(k));
      if (snap > 0 && snap < 0.5) {
        const r = s * (2 + 10 * snap);
        g.globalAlpha = 1 - snap / 0.5;
        g.strokeStyle = `rgb(${pale})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(p[0], p[1], r, 0, TAU);
        g.stroke();
        g.drawImage(sp.white, p[0] - s * 4, p[1] - s * 4, s * 8, s * 8);
        g.globalAlpha = 1;
      }
    }
    g.restore();
  }

  // ---- The ship's own light: drives, station-keeping thrusters, the clamps on the beam.
  function drawThrusters(g: CanvasRenderingContext2D, t: number, view: { project(p: V3): [number, number, number, number] }, power: number, brake: number): void {
    const sp = sprites!;
    g.save();
    g.globalCompositeOperation = "lighter";
    // The main drives: a glow at each mouth and a short soft plume astern.
    for (const nz of ship.model.nozzles) {
      const a = view.project(nz.p);
      const b = view.project([nz.p[0] - nz.r * (2 + 7 * power), nz.p[1], nz.p[2]]);
      if (a[2] <= 0.5) continue;
      const r = nz.r * a[3] * (1.4 + power);
      g.globalAlpha = clamp(0.25 + 0.6 * power);
      g.drawImage(sp.prim, a[0] - r, a[1] - r, r * 2, r * 2);
      g.strokeStyle = `rgb(${pale} / ${(0.35 * power).toFixed(3)})`;
      g.lineWidth = nz.r * a[3] * 1.2;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
      g.globalAlpha = 1;
    }
    // Station keeping: soft puffs from small thrusters, now one, now another.
    ship.rcs.forEach((th, j) => {
      const period = 1.3 + hash(j, 7) * 1.4;
      const ph = (((t + hash(j, 1) * period) % period) + period) % period;
      let k = ph < 0.32 ? Math.sin((ph / 0.32) * Math.PI) : 0;
      // Braking: the forward thrusters fire hard as the ship slows.
      if (th.dir[0] > 0.5) k = Math.max(k * 0.5, brake);
      k *= smooth(ARRIVE_FROM + 0.8, ARRIVE_FROM + 1.4, t);
      if (k <= 0.02) return;
      const a = view.project(th.p);
      const len = 0.5 + 1.6 * k;
      const b = view.project([th.p[0] + th.dir[0] * len, th.p[1] + th.dir[1] * len, th.p[2] + th.dir[2] * len]);
      if (a[2] <= 0.5) return;
      const wd = 0.16 * a[3];
      const grd = g.createLinearGradient(a[0], a[1], b[0], b[1]);
      grd.addColorStop(0, `rgb(235 245 255 / ${(0.75 * k).toFixed(3)})`);
      grd.addColorStop(1, "rgb(170 200 255 / 0)");
      g.strokeStyle = grd;
      g.lineCap = "round";
      g.lineWidth = Math.max(1, wd);
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
      g.globalAlpha = 0.6 * k;
      const r = Math.max(2, wd * 2.5);
      g.drawImage(sp.white, a[0] - r, a[1] - r, r * 2, r * 2);
      g.globalAlpha = 1;
    });
    g.restore();
  }

  function drawClamps(g: CanvasRenderingContext2D, t: number, view: { project(p: V3): [number, number, number, number] }, blocked: boolean): void {
    const sp = sprites!;
    const hub = view.project(ship.hub);
    if (hub[2] <= 0.5) return;
    g.save();
    g.globalCompositeOperation = "lighter";
    const lock = t - LOCK_AT;
    // Before the lock: the beam splashes on the hull as the ship slides over it.
    if (blocked && lock < 0) {
      const r = 1.6 * hub[3] * (0.9 + 0.2 * Math.sin(t * 13));
      g.globalAlpha = 0.85;
      g.drawImage(sp.prim, hub[0] - r * 2, hub[1] - r * 2, r * 4, r * 4);
      g.globalAlpha = 1;
    }
    if (lock >= 0) {
      const k = smooth(0, 0.18, lock);
      // The jaws close on the beam: bright lines from their tips to it.
      for (const j of ship.jaws) {
        const a = view.project(j);
        const b = view.project([ship.hub[0], j[1] - 0.15, 0]);
        g.strokeStyle = `rgb(${pale} / ${(0.85 * k).toFixed(3)})`;
        g.lineWidth = Math.max(1, 0.09 * hub[3]);
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.stroke();
        const r = 0.5 * a[3];
        g.globalAlpha = k;
        g.drawImage(sp.prim, a[0] - r, a[1] - r, r * 2, r * 2);
        g.globalAlpha = 1;
      }
      const r = hub[3] * (1.5 + 0.3 * Math.sin(t * 7));
      g.globalAlpha = 0.9 * k;
      g.drawImage(sp.core, hub[0] - r, hub[1] - r, r * 2, r * 2);
      g.globalAlpha = 1;
      // The flash of the lock: a burst and a star of light.
      if (lock < 1.2) {
        const f = Math.exp(-lock * 5);
        const big = cam.focal * (0.05 + 0.25 * easeOut(clamp(lock / 0.4)));
        g.globalAlpha = f;
        g.drawImage(sp.white, hub[0] - big, hub[1] - big, big * 2, big * 2);
        for (const [len, wide, ang] of [
          [cam.focal * 0.9, 2.2, 0],
          [cam.focal * 0.35, 1.6, Math.PI / 2],
          [cam.focal * 0.18, 1.2, Math.PI / 4],
          [cam.focal * 0.18, 1.2, -Math.PI / 4],
        ] as const) {
          const dx = Math.cos(ang) * len * (0.4 + 0.6 * f);
          const dy = Math.sin(ang) * len * (0.4 + 0.6 * f);
          const grd = g.createLinearGradient(hub[0] - dx, hub[1] - dy, hub[0] + dx, hub[1] + dy);
          grd.addColorStop(0, `rgb(${pale} / 0)`);
          grd.addColorStop(0.5, `rgb(255 255 255 / ${(0.9 * f).toFixed(3)})`);
          grd.addColorStop(1, `rgb(${pale} / 0)`);
          g.strokeStyle = grd;
          g.lineWidth = wide;
          g.beginPath();
          g.moveTo(hub[0] - dx, hub[1] - dy);
          g.lineTo(hub[0] + dx, hub[1] + dy);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
    }
    g.restore();
  }

  // ---- Telemetry: thin brackets and a few readings by what they measure.
  function label(g: CanvasRenderingContext2D, x: number, y: number, text: string, size: number, rgb: string, alpha: number, reveal = 1, align: CanvasTextAlign = "left"): void {
    if (alpha <= 0.01) return;
    const n = Math.round(text.length * clamp(reveal));
    if (n <= 0) return;
    g.font = `600 ${Math.round(size)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${(size * 0.18).toFixed(1)}px`;
    g.textAlign = align;
    g.textBaseline = "middle";
    g.fillStyle = `rgb(${rgb} / ${alpha.toFixed(3)})`;
    g.fillText(text.slice(0, n), x, y);
    (g as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = "0px";
  }
  function brackets(g: CanvasRenderingContext2D, x: number, y: number, rw: number, rh: number, rgb: string, alpha: number): void {
    if (alpha <= 0.01) return;
    const c = Math.min(rw, rh) * 0.45;
    g.strokeStyle = `rgb(${rgb} / ${alpha.toFixed(3)})`;
    g.lineWidth = 1.2;
    g.beginPath();
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      const cx = x + sx * rw;
      const cy = y + sy * rh;
      g.moveTo(cx - sx * c, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy - sy * c);
    }
    g.stroke();
  }

  /** How wide a label is. */
  function textW(g: CanvasRenderingContext2D, text: string, size: number): number {
    g.font = `600 ${Math.round(size)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    return g.measureText(text).width + text.length * size * 0.18;
  }
  /** Where a label `wide` px across starts beside a thing at x (gap px off it): to its right, or to its left when it would run off the picture. */
  function beside(x: number, gap: number, wide: number): number {
    return x + gap + wide <= cam.w - 10 || x - gap - wide < 10 ? x + gap : x - gap - wide;
  }

  function drawHud(g: CanvasRenderingContext2D, t: number, view: { project(p: V3): [number, number, number, number] } | undefined, beam: number): void {
    const s = clamp(Math.min(cam.w, cam.h) / 60, 9, 13);
    g.save();
    // Act 1: the sector marked on the ground, the beacon's height read off as it climbs.
    const mark = smooth(0.2, 0.6, t) * (1 - smooth(3.6, 4.4, t));
    if (mark > 0.01) {
      const p = see([0, 0, 0], S1);
      if (p[2] > 1) {
        const r = clamp((cam.focal * 6) / p[2], 14, 60) * (1 + 0.6 * (1 - smooth(0.2, 0.9, t)));
        brackets(g, p[0], p[1], r, r * 0.6, pale, 0.75 * mark);
        const lx = beside(p[0], r + 8, textW(g, "SECTOR LIBERATED", s));
        label(g, lx, p[1] - s * 0.8, "SECTOR LIBERATED", s, "255 255 255", 0.85 * mark, (t - 0.25) / 0.6);
        label(g, lx, p[1] + s * 0.6, t < BEAM_AT ? "BEACON ARMED" : `BEACON ${Math.round(Math.min(beam, 900) * 2.6)} KM`, s * 0.85, P, 0.8 * mark, (t - 0.45) / 0.5);
      }
    }
    // Act 2: a reticle closing on the clamp hub until the lock.
    if (view) {
      const hub = view.project(ship.hub);
      const k = smooth(ARRIVE_FROM + 1.4, ARRIVE_FROM + 2.0, t) * (1 - smooth(LOCK_AT + 0.9, LOCK_AT + 1.5, t));
      if (k > 0.01 && hub[2] > 0.5) {
        const close = smooth(ARRIVE_FROM + 1.4, LOCK_AT, t);
        const r = lerp(cam.focal * 0.12, Math.max(10, hub[3] * 1.2), close);
        const spin = t * 1.5 * (1 - close);
        g.strokeStyle = `rgb(${t >= LOCK_AT ? "255 255 255" : pale} / ${(0.8 * k).toFixed(3)})`;
        g.lineWidth = 1.2;
        for (let q = 0; q < 4; q++) {
          g.beginPath();
          g.arc(hub[0], hub[1], r, spin + (q * Math.PI) / 2 + 0.2, spin + (q * Math.PI) / 2 + Math.PI / 2 - 0.2);
          g.stroke();
        }
        const locked = t >= LOCK_AT;
        const hx = beside(hub[0], r + 10, textW(g, "GEOSTATIONARY APPROACH", s));
        label(g, hx, hub[1] - s * 0.7, locked ? "TETHER LOCKED" : "GEOSTATIONARY APPROACH", s, "255 255 255", 0.85 * k, (t - ARRIVE_FROM - 1.4) / 0.6);
        label(g, hx, hub[1] + s * 0.7, locked ? "CLAMPS 4 / 4" : `RANGE ${Math.max(0, Math.round((1 - close) * 412))} M`, s * 0.85, P, 0.8 * k);
      }
    }
    // Act 3: the lattice count and the grid's reach; then ASSET SECURED by the tether.
    const lat = smooth(satLaunch(0), satLaunch(0) + 0.4, t) * (1 - smooth(SECURED_AT - 0.2, SECURED_AT + 0.3, t));
    const mid = see([0, LAT_Y * 0.55, 0], S1);
    if (lat > 0.01 && mid[2] > 1) {
      const mx = beside(mid[0], s * 2.2, textW(g, "RELAY LATTICE 12 / 12", s));
      label(g, mx, mid[1] - s * 0.7, `RELAY LATTICE ${snappedBy(t)} / ${SATS}`, s, "255 255 255", 0.85 * lat, (t - satLaunch(0)) / 0.5);
      const pct = Math.round(gridReach(t) * 100);
      if (t >= GRID_AT) label(g, mx, mid[1] + s * 0.7, `GRID SWEEP ${pct}%`, s * 0.85, P, 0.8 * lat);
    }
    const sec = t - SECURED_AT;
    if (sec > 0 && mid[2] > 1) {
      const k = smooth(0, 0.25, sec) * (1 - 0.35 * smooth(2.5, 3.5, sec));
      const SUB = "SECTOR ANNEXED · ORBITAL TETHER STABLE";
      // Smaller on a narrow picture, so it fits beside the tether on one side or the other.
      const gap = s * 2.4;
      const full = Math.max(textW(g, "ASSET SECURED", s * 1.55), textW(g, SUB, s * 0.8));
      const room = Math.max(cam.w - 10 - (mid[0] + gap), mid[0] - gap - 10);
      const fit = clamp(room / full, 0.55, 1);
      const big = s * 1.55 * fit;
      const small = s * 0.8 * fit;
      const wide = full * fit;
      const x = beside(mid[0], gap, wide);
      const left = x < mid[0];
      const y = mid[1];
      // The brackets close in, the words lock, a bright rule under them.
      const tight = 1 + 1.2 * (1 - easeOut(clamp(sec / 0.3)));
      brackets(g, x + wide / 2, y, (wide / 2 + big * 0.6) * tight, big * 0.95 * tight, pale, 0.9 * k);
      g.strokeStyle = `rgb(${pale} / ${(0.7 * k).toFixed(3)})`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(mid[0], mid[1]);
      g.lineTo(left ? x + wide + big * 0.6 : x - big * 0.6, y);
      g.stroke();
      label(g, x, y, "ASSET SECURED", big, "255 255 255", k, sec / 0.35);
      const rule = easeOut(clamp((sec - 0.2) / 0.4));
      g.fillStyle = `rgb(${P} / ${(0.9 * k).toFixed(3)})`;
      g.fillRect(x, y + big * 0.75, wide * rule, 1.5);
      if (sec < 0.4) {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = 1 - sec / 0.4;
        const sp = sprites!;
        g.drawImage(sp.white, x - big, y - big * 2, wide + big * 2, big * 4);
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }
      label(g, x, y + big * 1.5, SUB, small, P, 0.75 * k, (sec - 0.3) / 0.7);
    }
    g.restore();
  }

  return {
    prepare(budget) {
      prepareGround(budget);
    },
    draw(g, w, h, time, free, quality = 1) {
      if (!(w >= 2 && h >= 2)) return;
      const t = Math.max(0, time);
      prepareGround(0);
      sprites ??= {
        core: softSprite(pale, 1, 64),
        prim: softSprite(P, 0.6, 64),
        sec: softSprite(P2, 0.8, 48),
        white: softSprite("226 240 255", 1, 64),
        fire: softSprite("255 140 60", 0.7, 48),
        bolt: softSprite("200 220 255", 0.9, 64),
        smoke: smokeSprite(),
        beamGlow: beamSprite([
          [0, P, 0],
          [0.2, P, 0.05],
          [0.36, P, 0.18],
          [0.5, pale, 0.5],
          [0.64, P, 0.18],
          [0.8, P, 0.05],
          [1, P, 0],
        ]),
        beamCore: beamSprite([
          [0, pale, 0],
          [0.3, pale, 0.08],
          [0.42, pale, 0.55],
          [0.5, "255 255 255", 1],
          [0.58, pale, 0.55],
          [0.7, pale, 0.08],
          [1, pale, 0],
        ]),
      };
      placeCamera(t, w, h, free);
      const sh = shipPath(t, rest);
      const { top, blocked } = beamTop(t, sh);
      const lockK = smooth(LOCK_AT, LOCK_AT + 0.25, t);
      const calm = smooth(GRID_AT, GRID_AT + 2.2, t);

      drawSky(g, t);
      globe.draw(g, cam, SUN, 150000 * quality * quality);
      drawBattle(g, t, calm);
      drawGrid(g, t);
      drawGroundGlow(g, t);

      const hubW: V3 = [sh.x + ship.hub[0], sh.y + ship.hub[1], sh.z];
      const shipDepth = see([sh.x, sh.y, sh.z], S1)[2];
      // What lies beyond the ship is drawn before it: the beam above it (until the ship stops it), the far satellites.
      const tether = TETHER_FULL > LOCK_AT ? smooth(LOCK_AT - 0.05, TETHER_FULL, t) : 1;
      const beamOn = smooth(BEAM_AT, BEAM_AT + 0.15, t);
      if (!blocked) drawBeam(g, t, 0, top, beamOn);
      drawRings(g, t, blocked ? hubW[1] : 2000);
      drawSats(g, t, hubW, false, shipDepth);

      // The ship.
      const pose: Pose = {
        pos: [sh.x, sh.y, sh.z],
        roll: (2.5 * DEG * Math.sin(t * 0.7) * (1 - sh.u) + 0.4 * DEG * Math.sin(t * 0.33)),
        pitch: -1.5 * DEG * (1 - sh.u) + 0.3 * DEG * Math.sin(t * 0.27 + 1),
        yaw: 4 * DEG * Math.pow(1 - sh.u, 2) + 0.25 * DEG * Math.sin(t * 0.21),
      };
      const power = lerp(0.95, 0.12, smooth(ARRIVE_FROM + 0.6, ARRIVE_AT, t));
      const brake = smooth(ARRIVE_AT - 2.0, ARRIVE_AT - 1.4, t) * (1 - smooth(ARRIVE_AT - 0.3, ARRIVE_AT + 0.2, t));
      let view: { project(p: V3): [number, number, number, number] } | undefined;
      const onScreen = shipDepth > 2 && sh.u > 0;
      if (onScreen) {
        const kickSide = unit(add(mul(cam.f, -1), add(mul(cam.r, 0.25), mul(cam.d, -0.35))));
        const kick = unit(lerp3(kickSide, [0, -1, 0], lockK * 0.7));
        const lights: Lights = {
          key: unit(add(SUN, [0, 0.32, 0])),
          keyCol: [1.75, 1.38, 1.0],
          kick,
          kickCol: lerp3([0.36, 0.44, 0.6], rgbV(P, 0.7), lockK * 0.7) as V3,
          amb: [0.11, 0.125, 0.165],
          engCol: rgbV(P, 0.6),
          power: 0.4 + power,
          fog: [0.05, 0.07, 0.12],
          fogNear: 1e6,
          fogFar: 2e6,
          fogMax: 0,
        };
        view = drawShip(g, cam, pose, lights, t);
        drawThrusters(g, t, view, power, brake);
      }
      // In front of the ship: the beam from the ground to its belly once it is over it (the tether), the near satellites.
      if (blocked) drawBeam(g, t, 0, top, Math.max(beamOn, 1 + 0.6 * tether));
      drawSats(g, t, hubW, true, shipDepth);
      if (view) drawClamps(g, t, view, blocked);

      // A soft flash over everything at the lock.
      const lk = t - LOCK_AT;
      if (lk > 0 && lk < 0.6) {
        g.fillStyle = `rgb(${pale} / ${(0.16 * Math.exp(-lk * 7)).toFixed(3)})`;
        g.fillRect(0, 0, w, h);
      }
      drawHud(g, t, view, top);

      // The edges of the picture a little darker.
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.hypot(w, h) * 0.62);
      vg.addColorStop(0, "rgb(0 0 0 / 0)");
      vg.addColorStop(1, "rgb(0 0 0 / 0.5)");
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      // Opening from black.
      const open = 1 - smooth(0, 1.0, t);
      if (open > 0) {
        g.fillStyle = `rgb(2 4 10 / ${open.toFixed(3)})`;
        g.fillRect(0, 0, w, h);
      }
    },
  };
}

const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgbV = (s: string, k: number): V3 => {
  const [r, g, b] = s.split(" ").map(Number);
  return [((r ?? 0) / 255) * k, ((g ?? 0) / 255) * k, ((b ?? 0) / 255) * k];
};

/** Across a beam: its light from edge to edge (stops: place 0..1, colour, alpha). Drawn stretched along the beam. */
function beamSprite(stops: [number, string, number][]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 0, 64);
  for (const [at, rgb, a] of stops) grd.addColorStop(at, `rgb(${rgb} / ${a})`);
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 64);
  return c;
}

/** A soft dark drift of smoke. */
function smokeSprite(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const R = rng(31);
  for (let i = 0; i < 9; i++) {
    const x = 32 + (R() - 0.5) * 26;
    const y = 32 + (R() - 0.5) * 20;
    const r = 10 + R() * 14;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, "rgb(52 46 44 / 0.5)");
    grd.addColorStop(1, "rgb(52 46 44 / 0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }
  return c;
}
