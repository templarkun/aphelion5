/**
 * Terraformer 2.0: the film (designer 2026-11-17). Industrial terraforming, not a bombardment.
 *
 *   Act 1  under the belly of the Company's capital vessel: the bay doors open on a lit hold where
 *          the pylons (one for every mission won) lie across the bay. One by one they are lowered
 *          out on their cradles, let go, and drift free for 1.2 s while they turn upright; then
 *          their braking thrusters light, blue-white plumes firing down.
 *   Act 2  the camera follows them down, slow and heavy, braking all the way. In the upper air
 *          their wings open a little (no fire, only a pale glow at the spike's tip). They gather
 *          over the sector and hang above the deck of toxic storm clouds.
 *   Act 3  one by one they sink through the deck on their thrusters (each blows a hole in it) and
 *          anchor, spike first, gently. Each fires a blue-green beam straight up through the
 *          clouds; from it emerald and cyan fronts swirl outwards, the storm clears, and beneath
 *          it the ground turns to ocean and green land (world.ts). Their wings open wide.
 *   Act 4  the camera pulls back; the sun comes over the edge of the planet. The Debrief card
 *          slides in beside the cleared sector.
 *
 * Drawn on one 2D canvas, far to near: space and the globe (terraformer/globe.ts, shared with
 * 1.0), the ground, what stands under the cloud deck, the deck, the air and the sun, what is above
 * the deck, the ship (terraformer/hull.ts, shared with 1.0). Every moving thing is worked out from
 * the time alone, so any moment can be drawn by itself. Looks only.
 */

import { add, clamp, cross, dot, ease, easeOut, lerp, mul, rng, seg, smooth, sub, TAU, unit, type V3 } from "../../briefing/styles/intro2/math3.js";
import { createGlobe, SUN } from "./globe.js";
import { createHull, type HullDraw, type ShipView } from "../terraformer/hull.js";
import { flameSprite, mixRgb, softSprite } from "../terraformer/pylon.js";
import { aim, DEG, newCam, place, see, track, type Cam } from "../terraformer/view.js";
import type { CompanyTheme } from "../types.js";
import { drawRig, RIG_TOP, WING_AIR, type RigPose, type RigSprites, type RigState } from "./rig.js";
import { anchorTimes, BEAM_DELAY, DOORS_AT, DOORS_OPEN_AT, DRIFT, ENTRY_AT, ignitionTimes, LOWER, pylonCount, releaseTimes, SEED_DELAY, sitePlaces } from "./timeline.js";
import { CLOUD_ALT, createWorld, type World } from "./world.js";

/** The part of the picture the Debrief card leaves open, CSS px: the cleared sector is kept inside it. */
export interface FreeArea {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface TerraformerScene {
  /** Draw film time t (seconds at Normal speed; past the film's end the slow drift goes on). */
  draw(g: CanvasRenderingContext2D, w: number, h: number, t: number, free?: FreeArea): void;
  /** Make the planet's pictures a little at a time (once a frame, before draw); `budget` ms. */
  prepare(budget: number): void;
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
  [2.4, -29.8, 0.3],
  [3.7, -29.4, 0.296],
  [4.8, -27.4, 0.292],
  [6.0, -21.5, 0.262],
  [7.2, -12.6, 0.205],
  [8.4, -12.4, 0.195],
  [9.6, -12.4, 0.245],
  [11.8, -12.8, 0.255],
  [14.8, -19.0, 0.48],
  [28, -17.6, 0.52],
] as const;
/** The camera looks a little under what it follows: [time, degrees]. */
const TILT_KEYS = [
  [3.6, 0],
  [4.8, 5],
  [6.0, 4],
  [7.4, 3],
  [9.6, 4.5],
  [11.8, 4.5],
  [14.8, -1.5],
  [28, -2.5],
] as const;
/** At the start the camera looks this far below level. */
const FIRST_PITCH = 34.7;
/**
 * The pylons' common path down, by their own clock (0 their thrusters light, 1 anchored): the
 * spike's tip [degrees along the track, height]. They come together over the sector at HOVER
 * (all at the same moment), then each settles at its own time.
 */
const PATH_KEYS = [
  [0, -24.2, 0.228],
  [0.15, -22.4, 0.2],
  [0.35, -18.0, 0.15],
  [0.55, -11.6, 0.094],
  [0.72, -6.2, 0.054],
  [0.85, -3.0, 0.036],
  [0.93, -1.1, 0.018],
  [1, 0, 0],
] as const;
const HOVER = 0.85;
/** When all the pylons hang over the sector, just above the deck. */
const HOVER_AT = 8.4;

/** A pylon: in the ship's units in the bay, in planet radii once away. */
const LEN_S = 1.45;
const LEN_W = 0.018;
/** How deep the anchor spike goes into the ground (pylon lengths). */
const BURY = 0.22;
/** The beam reaches this high (planet radii). */
const BEAM_HIGH = 0.12;
/** The ship's nose points this far under the camera's first line of sight. */
const SHIP_TILT = 3 * DEG;

export function createTerraformer2Scene(o: SceneSetup): TerraformerScene {
  const { theme } = o;
  const n = pylonCount(o.tags.length);
  const tags = Array.from({ length: n }, (_, i) => o.tags[i] ?? "");
  const anc = anchorTimes(n);
  const rel = releaseTimes(n);
  const ign = ignitionTimes(n);
  const R = rng(90210);
  const camTrack = track(CAM_KEYS);
  const pathTrack = track(PATH_KEYS);
  const tiltTrack = track(TILT_KEYS);
  const globe = createGlobe(theme);
  const hull = createHull(o.vesselId, theme);
  const spin0 = Array.from({ length: n }, () => R() * TAU);
  const turnWay = Array.from({ length: n }, (_, i) => (i % 2 ? 1 : -1));
  const dust = Array.from({ length: 46 }, () => ({ x: R(), y: R(), z: 0.25 + R() * 0.75, ph: R() * TAU }));
  const motes = Array.from({ length: n }, () => Array.from({ length: 10 }, () => ({ ph: R(), sp: 0.25 + R() * 0.35, side: R() * TAU })));

  // Where each pylon lies in the bay: across it, one after another along it, the bow end first.
  const slots: { x: number; z: number; len: number }[] = [];
  {
    const per = hull.bays.map((_, i) => Math.floor(n / hull.bays.length) + (i < n % hull.bays.length ? 1 : 0));
    const lists = hull.bays.map((b, i) => {
      const k = per[i]!;
      const len = Math.min(LEN_S, b.z1 - b.z0 - 0.16);
      return Array.from({ length: k }, (_, j) => ({ x: b.x1 - 0.5 - (b.x1 - b.x0 - 1.0) * (k > 1 ? j / (k - 1) : 0.5), z: (b.z0 + b.z1) / 2, len }));
    });
    for (let j = 0; slots.length < n; j++) for (const l of lists) if (l[j]) slots.push(l[j]!);
  }

  let world: World | undefined;
  let tallNow: boolean | undefined;
  const cam: Cam = newCam();
  let sprites: RigSprites | undefined;
  let lamp: HTMLCanvasElement | undefined;
  let beamHalo: HTMLCanvasElement | undefined;

  // ---- The camera.
  const camPos = (t: number): V3 => {
    const [lon, alt] = camTrack(t) as [number, number];
    return place(lon, 0, 1 + alt);
  };
  const pos0 = camPos(0);
  const up0 = unit(pos0);
  const ahead0: V3 = [Math.cos(CAM_KEYS[0][1] * DEG), 0, -Math.sin(CAM_KEYS[0][1] * DEG)];
  const aim0 = add(pos0, sub(mul(ahead0, Math.cos(FIRST_PITCH * DEG)), mul(up0, Math.sin(FIRST_PITCH * DEG))));
  const SECTOR: V3 = [0, 0, 1];

  // ---- The pylons' way down (the world).
  /** Pylon i's own clock at time t: 0 at its ignition, HOVER for all at HOVER_AT, 1 when it anchors. */
  function clockOf(i: number, t: number): number {
    if (t <= ign[i]!) return 0;
    if (t <= HOVER_AT) {
      // Gently away, faster through the high air, braking hard into the hover over the sector.
      const u = (t - ign[i]!) / (HOVER_AT - ign[i]!);
      return HOVER * (0.5 - 0.5 * Math.cos(Math.PI * u));
    }
    // From the hover down to its place, settling: slow start, slow finish.
    return HOVER + (1 - HOVER) * ease(clamp((t - HOVER_AT) / (anc[i]! - HOVER_AT)));
  }
  /** Where pylon i's spike tip is at time t (world), and its height over the ground. */
  function tipAt(i: number, t: number, out: V3): number {
    const tau = clockOf(i, t);
    const [lon, alt0] = pathTrack(tau) as [number, number];
    const site = world!.sites[i]!;
    // Close together on the way down; they spread out to their own places over the sector.
    const s = 0.16 + 0.84 * ease(seg(tau, 0.62, 0.99));
    const alt = alt0 - (tau > 0.97 ? BURY * LEN_W * smooth(0.97, 1, tau) : 0);
    const p = place(lon + s * site.lon, s * site.lat, 1 + alt);
    out[0] = p[0];
    out[1] = p[1];
    out[2] = p[2];
    return alt;
  }
  /** When pylon i's spike tip reaches the cloud deck (it sinks through it from then). */
  function throughOf(i: number): number {
    for (let t = ign[i]!; t < anc[i]! + 1; t += 0.01) {
      const [, alt] = pathTrack(clockOf(i, t)) as [number, number];
      if (alt <= CLOUD_ALT) return t;
    }
    return anc[i]!;
  }

  function setCam(t: number, w: number, h: number, free: FreeArea | undefined, nudge: number): void {
    const tall = h > w * 1.15;
    const pos = camPos(t);
    const up = unit(pos);
    const w1 = smooth(3.6, 4.8, t);
    const w2 = smooth(8.0, 9.6, t);
    const to = (p: V3): V3 => unit(sub(p, pos));
    const d0 = to(aim0);
    const d1 = to(centroid(t));
    const d2 = to(SECTOR);
    let look = unit([lerp(lerp(d0[0], d1[0], w1), d2[0], w2), lerp(lerp(d0[1], d1[1], w1), d2[1], w2), lerp(lerp(d0[2], d1[2], w1), d2[2], w2)]);
    const drop = Math.tan(tiltTrack(t)[0]! * (tall ? 1.5 : 1) * DEG);
    look = unit([look[0] - up[0] * drop, look[1] - up[1] * drop, look[2] - up[2] * drop]);
    const roll = 0.02 * Math.sin(t * 0.4 + 1) * smooth(3.8, 5, t) * (1 - smooth(8, 9.5, t)) + 0.005 * Math.sin(t * 0.21);
    aim(cam, pos, [pos[0] + look[0], pos[1] + look[1], pos[2] + look[2]], up, roll);
    cam.w = w;
    cam.h = h;
    cam.focal = (tall ? 0.9 : 1.1) * Math.sqrt(w * h);
    const k4 = ease(seg(t, 12.4, 14.9));
    const fx = free ? free.x + free.w / 2 : w / 2;
    const fy = free ? free.y + free.h / 2 : h / 2;
    cam.cx = lerp(w / 2, fx, k4) + nudge * 3 * Math.sin(t * 37);
    cam.cy = lerp(h / 2, fy, k4) + nudge * 3 * Math.cos(t * 29);
  }
  const cTmp: V3 = [0, 0, 0];
  function centroid(t: number): V3 {
    if (!world) return SECTOR;
    let x = 0;
    let y = 0;
    let z = 0;
    for (let i = 0; i < n; i++) {
      tipAt(i, Math.max(t, ign[i]!), cTmp);
      x += cTmp[0];
      y += cTmp[1];
      z += cTmp[2];
    }
    return [x / n, y / n, z / n];
  }

  // ---- The ship: its own frame, set in the world by the camera's first look (as in 1.0).
  const first: Cam = newCam();
  aim(first, pos0, aim0, up0, 0);
  const Xs: V3 = add(mul(first.f, Math.cos(SHIP_TILT)), mul(first.d, Math.sin(SHIP_TILT)));
  const Ys: V3 = sub(mul(first.f, Math.sin(SHIP_TILT)), mul(first.d, Math.cos(SHIP_TILT)));
  const Zs: V3 = first.r;
  /** World up and the sun, in the ship's frame. */
  const upS: V3 = unit([dot(up0, Xs), dot(up0, Ys), dot(up0, Zs)]);
  /** The camera in the ship's frame: creeping forward under the belly, then falling away after the pylons. */
  function shipEye(t: number): V3 {
    const u = Math.max(0, t - 3.75);
    return [-13.2 + 1.6 * ease(seg(t, 0, 3.7)) + 2.5 * u * u, -2.3 - 1.5 * u * u - 7 * u * u * u, 0.6];
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

  /** Pylon i near the ship (the ship's frame): its middle and its axis (spike to mast). */
  function shipPose(i: number, t: number, mid: V3, axis: V3): void {
    const sl = slots[i]!;
    const dt = t - rel[i]!;
    let y = 0.62;
    let x = sl.x;
    const across: V3 = [0, 0, turnWay[i]!];
    axis[0] = across[0];
    axis[1] = across[1];
    axis[2] = across[2];
    if (dt > 0) y -= 1.25 * ease(clamp(dt / LOWER));
    // Once let go, each drifts out to its own place in a fan under the bay.
    const fan = (i - (n - 1) / 2) * (n > 1 ? Math.min(1.25, 6.5 / (n - 1)) : 0);
    let side = 0;
    if (dt > LOWER) {
      // Let go: drifting free, turning upright.
      const u = Math.min(dt - LOWER, DRIFT);
      const k0 = ease(u / DRIFT);
      x += 0.1 * u - (slots[i]!.x - 0.8) * 0.55 * k0;
      y -= 0.3 * u + 0.25 * Math.abs(fan) * k0;
      side = fan * k0;
      const k = ease(u / DRIFT);
      // From lying across the bay to standing upright over the planet (mast up, spike down).
      const a = unit([lerp(across[0], upS[0], k), lerp(across[1], upS[1], k), lerp(across[2], upS[2], k)]);
      axis[0] = a[0];
      axis[1] = a[1];
      axis[2] = a[2];
    }
    mid[2] = sl.z + side;
    if (dt > LOWER + DRIFT) {
      // Thrusters lit: away down towards the planet, gathering speed.
      const u = dt - LOWER - DRIFT;
      x += 0.1 * u;
      y -= 0.3 * u;
      const k = 3.2 * u * u;
      x -= upS[0] * k;
      y -= upS[1] * k;
      mid[2] -= upS[2] * k;
    }
    mid[0] = x;
    mid[1] = y;
  }

  /** The state of pylon i's own parts at time t. */
  function rigState(i: number, t: number, dawn: number): RigState {
    const dt = t - rel[i]!;
    const since = t - ign[i]!;
    const left = t - anc[i]!;
    let thrust = 0;
    if (since > 0) {
      thrust = 0.55 + 1.1 * Math.exp(-since / 0.35) + 0.5 * smooth(HOVER_AT - 0.6, HOVER_AT + 0.2, t);
      if (left > 0) thrust *= 1 - smooth(0, 0.7, left);
    }
    const spin = spin0[i]! + 0.55 * clamp(dt - LOWER, 0, DRIFT) + 0.2 * clamp(Math.min(t, anc[i]!) - ign[i]!, 0, 20);
    const airOpen = (WING_AIR / 1.3) * smooth(ENTRY_AT - 0.3 + i * 0.06, ENTRY_AT + 0.7 + i * 0.06, t);
    const open = lerp(airOpen, 1, smooth(anc[i]! + 0.45, anc[i]! + 1.7, t));
    const alt = world ? tipAt(i, t, cTmp) : 1;
    return {
      spin,
      open,
      thrust,
      power: 0.25 + 0.75 * smooth(rel[i]! - 0.6, rel[i]! - 0.1, t),
      keyK: 0.78 + 0.22 * dawn,
      keyRgb: "255 222 186",
      sheath: since > 0 ? smooth(0.1, 0.075, alt) * smooth(0.03, 0.05, alt) : 0,
      emit: smooth(anc[i]! + BEAM_DELAY - 0.15, anc[i]! + BEAM_DELAY + 0.1, t) * (0.85 + 0.15 * Math.sin(t * 5 + i)),
      t,
    };
  }

  // ---- Poses: a pylon's points in the picture.
  const P: V3 = [0, 0, 0];
  const poseOut: [number, number] = [0, 0];
  /** In the ship's frame (through shipView), mid and axis there. */
  function shipAt(mid: V3, axis: V3, b: V3, c: V3, len: number): (h: number, x: number, y: number) => [number, number] | undefined {
    return (h, x, y) => {
      const hh = (h - 0.5) * len;
      const p = shipView.cam(mid[0] + axis[0] * hh + (b[0] * x + 0) * len + c[0] * y * len, mid[1] + axis[1] * hh + b[1] * x * len + c[1] * y * len, mid[2] + axis[2] * hh + b[2] * x * len + c[2] * y * len);
      if (p[2] < 0.3) return undefined;
      return [cam.cx + (cam.focal * p[0]) / p[2], cam.cy + (cam.focal * p[1]) / p[2]];
    };
  }
  function worldAt(tip: V3, axis: V3, b: V3, c: V3, len: number): (h: number, x: number, y: number) => [number, number] | undefined {
    return (h, x, y) => {
      P[0] = tip[0] + (axis[0] * h + b[0] * x + c[0] * y) * len;
      P[1] = tip[1] + (axis[1] * h + b[1] * x + c[1] * y) * len;
      P[2] = tip[2] + (axis[2] * h + b[2] * x + c[2] * y) * len;
      if (!see(cam, P[0], P[1], P[2])) return undefined;
      return [cam.sx, cam.sy];
    };
  }
  /** Two side axes for an axis (any pair at right angles to it). */
  function sides(axis: V3): [V3, V3] {
    const ref: V3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const b = unit(cross(axis, ref));
    return [b, cross(axis, b)];
  }

  interface Placed {
    i: number;
    pose: RigPose;
    state: RigState;
    /** Spike tip height (planet radii); Infinity in the ship. */
    alt: number;
    /** The beam's foot and its top, world. */
    tip: V3 | undefined;
    axis: V3 | undefined;
  }
  /** Every pylon that is out of the bay, posed for this frame. */
  function placeRigs(t: number, dawn: number): Placed[] {
    const out: Placed[] = [];
    for (let i = 0; i < n; i++) {
      const dt = t - rel[i]!;
      if (dt <= 0) continue;
      const mid: V3 = [0, 0, 0];
      const ax: V3 = [0, 0, 0];
      const since = t - ign[i]!;
      const blend = since <= 0 ? 0 : Math.max(smooth(0.15, 0.85, since), smooth(4.6, 5.1, t));
      const state = rigState(i, t, dawn);
      let shipFn: ((h: number, x: number, y: number) => [number, number] | undefined) | undefined;
      let worldFn: typeof shipFn;
      let view: V3 = [1, 0, 0];
      let key: V3 = [1, 0, 0];
      let px = 1;
      let alt = Infinity;
      let tip: V3 | undefined;
      let axisW: V3 | undefined;
      if (blend < 1) {
        shipPose(i, t, mid, ax);
        if (mid[1] > 0) continue; // still in the hold: drawn with the hull
        const [b, c] = sides(ax);
        const len = slots[i]!.len;
        shipFn = shipAt(mid, ax, b, c, len);
        const v = unit(sub(eye, mid));
        view = [dot(v, ax), dot(v, b), dot(v, c)];
        // In the bay's light while near it, then the light of the coming dawn.
        const near = 1 - smooth(LOWER, LOWER + 0.8, dt);
        const sunS: V3 = [dot(SUN, Xs), dot(SUN, Ys), dot(SUN, Zs)];
        const k = unit([lerp(sunS[0], 0.2, near), lerp(sunS[1], 1, near), lerp(sunS[2], 0, near)]);
        key = [dot(k, ax), dot(k, b), dot(k, c)];
        const cm = shipView.cam(mid[0], mid[1], mid[2]);
        px = (cam.focal * len) / Math.max(0.3, cm[2]);
      }
      if (blend > 0 && world) {
        tip = [0, 0, 0];
        alt = tipAt(i, t, tip);
        axisW = unit(tip);
        const [b, c] = sides(axisW);
        worldFn = worldAt(tip, axisW, b, c, LEN_W);
        const midW: V3 = add(tip, mul(axisW, LEN_W * 0.5));
        const v = unit(sub(cam.pos, midW));
        const vw: V3 = [dot(v, axisW), dot(v, b), dot(v, c)];
        const kw: V3 = [dot(SUN, axisW), dot(SUN, b), dot(SUN, c)];
        if (!see(cam, midW[0], midW[1], midW[2])) {
          if (!shipFn) continue;
        } else {
          const pw = (cam.focal * LEN_W) / cam.sz;
          if (blend >= 0.5 || !shipFn) {
            view = vw;
            key = kw;
          }
          px = shipFn ? Math.exp(lerp(Math.log(px), Math.log(pw), blend)) : pw;
        }
      }
      const sF = shipFn;
      const wF = worldFn;
      const at = (h: number, x: number, y: number): [number, number] => {
        const a = sF?.(h, x, y);
        const b = wF?.(h, x, y);
        if (a && b) {
          poseOut[0] = lerp(a[0], b[0], blend);
          poseOut[1] = lerp(a[1], b[1], blend);
        } else if (b && (blend > 0.5 || !a)) {
          poseOut[0] = b[0];
          poseOut[1] = b[1];
        } else if (a) {
          poseOut[0] = a[0];
          poseOut[1] = a[1];
        } else {
          poseOut[0] = -1e5;
          poseOut[1] = -1e5;
        }
        return [poseOut[0], poseOut[1]];
      };
      out.push({ i, pose: { at, view, key, px }, state, alt: blend >= 1 ? alt : Infinity, tip, axis: axisW });
    }
    return out;
  }

  // ---- The beams.
  /** A beam of light straight up from a pylon's mast: from height a to height b over the ground (planet radii). */
  function beam(g: CanvasRenderingContext2D, p: Placed, t: number, a: number, b: number): void {
    const s = world!.sites[p.i]!;
    const fired = t - (anc[p.i]! + BEAM_DELAY);
    if (fired <= 0 || !p.tip) return;
    const grow = easeOut(clamp(fired / 0.4));
    const topH = LEN_W * (RIG_TOP - BURY);
    const lo = Math.max(a, topH);
    const hi = Math.min(b, topH + (BEAM_HIGH - topH) * grow);
    if (hi <= lo) return;
    const n0 = s.n;
    if (!see(cam, n0[0] * (1 + lo), n0[1] * (1 + lo), n0[2] * (1 + lo))) return;
    const x0 = cam.sx;
    const y0 = cam.sy;
    const z0 = cam.sz;
    if (!see(cam, n0[0] * (1 + hi), n0[1] * (1 + hi), n0[2] * (1 + hi))) return;
    const x1 = cam.sx;
    const y1 = cam.sy;
    // Brightest where it leaves the mast; fading as it rises.
    const power = (1 + 1.4 * Math.exp(-fired * 2.2)) * (0.9 + 0.1 * Math.sin(t * 7 + p.i * 2));
    const fadeAt = (h: number) => 1 - smooth(topH, BEAM_HIGH, h) * 0.9;
    const fine = clamp((cam.focal * 0.0004) / z0, 0.6, 1.8);
    g.save();
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    for (const [wide, rgb, al] of [
      [18, "30 190 150", 0.07],
      [8, "60 230 190", 0.16],
      [3.2, "130 250 225", 0.42],
      [1.2, "235 255 250", 0.95],
    ] as const) {
      const grd = g.createLinearGradient(x0, y0, x1, y1);
      grd.addColorStop(0, `rgb(${rgb} / ${clamp(al * power * fadeAt(lo)).toFixed(3)})`);
      grd.addColorStop(1, `rgb(${rgb} / ${clamp(al * power * fadeAt(hi) * (hi < b ? 0 : 1)).toFixed(3)})`);
      g.strokeStyle = grd;
      g.lineWidth = wide * fine;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    }
    // Sparks of light running up it.
    for (const m of motes[p.i]!) {
      const k = (((t * m.sp + m.ph) % 1) + 1) % 1;
      const h = topH + k * (BEAM_HIGH - topH) * grow;
      if (h < lo || h > hi) continue;
      const off = 0.00035 * Math.sin(m.side + t * 3);
      if (!see(cam, n0[0] * (1 + h) + s.e1[0] * off, n0[1] * (1 + h) + s.e1[1] * off, n0[2] * (1 + h) + s.e1[2] * off)) continue;
      const r = clamp((cam.focal * 0.0005) / cam.sz, 0.8, 3) * (1 - k);
      g.globalAlpha = (1 - k) * 0.9;
      g.drawImage(beamHalo!, cam.sx - r * 2, cam.sy - r * 2, r * 4, r * 4);
    }
    g.restore();
  }

  /** A pylon's tag (which mission it stands for), once it has anchored. */
  function tag(g: CanvasRenderingContext2D, p: Placed, t: number): void {
    const label = tags[p.i]!;
    const shown = smooth(anc[p.i]! + 0.6, anc[p.i]! + 1.0, t);
    if (!label || shown < 0.01) return;
    const [tx, ty] = p.pose.at(1.02, 0, 0);
    if (tx < -50 || ty < -50 || tx > cam.w + 50 || ty > cam.h + 50) return;
    g.save();
    g.globalAlpha = shown * 0.95;
    const fs = clamp(cam.w / 100, 11, 14);
    g.font = `800 ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    g.textBaseline = "middle";
    const wide = g.measureText(label).width + 10;
    const lx = tx + 12;
    const ly = ty - 14;
    g.strokeStyle = "rgb(110 240 205 / 0.9)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(tx + 3, ty - 3);
    g.lineTo(lx, ly + fs * 0.7);
    g.stroke();
    g.fillStyle = "rgb(2 14 18 / 0.72)";
    g.fillRect(lx, ly - fs * 0.75, wide, fs * 1.5);
    g.strokeRect(lx + 0.5, ly - fs * 0.75 + 0.5, wide - 1, fs * 1.5 - 1);
    g.fillStyle = "#effffb";
    g.fillText(label, lx + 5, ly + 0.5);
    g.restore();
  }

  /** Where a pylon passes through the deck: keep only the part above it (the clouds hide the rest). */
  function clipAbove(g: CanvasRenderingContext2D, p: Placed): boolean {
    return clipDeck(g, p, 1);
  }
  /** ... or only the part below it. */
  function clipBelow(g: CanvasRenderingContext2D, p: Placed): boolean {
    return clipDeck(g, p, -1);
  }
  function clipDeck(g: CanvasRenderingContext2D, p: Placed, side: 1 | -1): boolean {
    const hc = (CLOUD_ALT - p.alt) / LEN_W;
    if (hc <= 0) return side === 1;
    if (hc >= 1) return side === -1;
    const a = p.pose.at(hc, 0, 0);
    const b = p.pose.at(side === 1 ? 1 : 0, 0, 0);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / L;
    const uy = (b[1] - a[1]) / L;
    const B = 4000;
    g.beginPath();
    g.moveTo(a[0] - uy * B, a[1] + ux * B);
    g.lineTo(a[0] + uy * B, a[1] - ux * B);
    g.lineTo(a[0] + uy * B + ux * B, a[1] - ux * B + uy * B);
    g.lineTo(a[0] - uy * B + ux * B, a[1] + ux * B + uy * B);
    g.closePath();
    g.clip();
    return true;
  }

  let prepared = false;

  return {
    prepare(budget) {
      if (world && !prepared) prepared = world.prepare(budget);
    },
    draw(g, w, h, time, free) {
      if (!(w >= 2 && h >= 2)) return;
      const t = Math.max(0, time);
      const tall = h > w * 1.15;
      if (!world || tall !== tallNow) {
        world = createWorld(sitePlaces(n, tall), anc, Array.from({ length: n }, (_, i) => throughOf(i)), SEED_DELAY);
        tallNow = tall;
        prepared = false;
      }
      // A still picture, or a jump past the first act: the pictures are needed now.
      if (!prepared && t > 5.2) prepared = world.prepare(Infinity);
      sprites ??= {
        plume: flameSprite("214 240 255", "90 160 255"),
        glow: softSprite("190 226 255", 1, 64),
        beam: softSprite("120 255 214", 1, 96),
        red: softSprite("255 80 64", 1, 48),
        main: softSprite(theme.primary, 1, 48),
        second: softSprite(theme.secondary, 1, 48),
        sheath: softSprite("196 220 255", 0.4, 64),
      };
      lamp ??= softSprite(mixRgb("255 226 170", theme.secondary, 0.25), 0.8, 128);
      beamHalo ??= softSprite("160 255 230", 1, 32);

      // Each anchor locks with a soft pulse: the picture barely moves.
      let nudge = 0;
      for (const at of anc) {
        const age = t - at;
        if (age > 0 && age < 0.8) nudge += 0.35 * Math.exp(-age * 6);
      }
      setCam(t, w, h, free, Math.min(1, nudge));
      const c = cam;
      const dawn = globe.sunUp(c);

      globe.sky(g, c, t);
      const shape = globe.body(g, c);
      g.save();
      g.clip(shape);
      world.surface(g, c, t);
      g.restore();
      globe.haze(g, c, shape);

      const rigs = placeRigs(t, dawn);
      // Under the deck: the pylons that have sunk into it or anchored, and their beams' feet, seen as much as the clouds over them let through.
      for (const p of rigs) {
        if (p.alt >= CLOUD_ALT) continue;
        const s = world.sites[p.i]!;
        const clear = 1 - world.fog(s.lon, s.lat, t);
        if (clear < 0.02) continue;
        g.save();
        g.globalAlpha = clear;
        if (clipBelow(g, p)) drawRig(g, p.pose, p.state, theme, sprites);
        g.restore();
        g.save();
        g.globalAlpha = clear;
        beam(g, p, t, 0, CLOUD_ALT);
        g.restore();
      }
      globe.air(g, c, t, shape);

      // Over the deck: the pylons still above it (or the part of them that is), the beams, the tags.
      for (const p of rigs) {
        // (By the ship they are drawn with it, below.)
        if (p.alt === Infinity || p.alt + LEN_W <= CLOUD_ALT) continue;
        g.save();
        if (clipAbove(g, p)) drawRig(g, p.pose, p.state, theme, sprites);
        g.restore();
      }
      for (const p of rigs) if (p.alt !== Infinity) beam(g, p, t, CLOUD_ALT, BEAM_HIGH);
      for (const p of rigs) if (p.alt !== Infinity) tag(g, p, t);

      // The ship, while any of it is still in the picture.
      if (t < 5.2) {
        const doors = ease(seg(t, DOORS_AT, DOORS_OPEN_AT));
        const lamps = clamp((t - 0.2) / 0.55) * (t < 0.8 && Math.sin(t * 58) < -0.35 ? 0.4 : 1);
        eye = shipEye(t);
        shipView.focal = c.focal;
        shipView.cx = c.cx;
        shipView.cy = c.cy;
        const mid: V3 = [0, 0, 0];
        const ax: V3 = [0, 0, 0];
        const draw: HullDraw = {
          t,
          doors,
          lamps,
          glow: lamp,
          cargo: () => {
            for (let i = 0; i < n; i++) {
              shipPose(i, t, mid, ax);
              if (mid[1] <= 0) continue;
              const [b, cc] = sides(ax);
              const fn = shipAt(mid, ax, b, cc, slots[i]!.len);
              const v = unit(sub(eye, mid));
              const cm = shipView.cam(mid[0], mid[1], mid[2]);
              if (cm[2] < 0.4) continue;
              const st = rigState(i, t, 0);
              st.keyK = 0.25 + 0.6 * lamps;
              const k: V3 = unit([0.2, 1, 0.1]);
              drawRig(
                g,
                { at: (hh, x, y) => fn(hh, x, y) ?? [-1e5, -1e5], view: [dot(v, ax), dot(v, b), dot(v, cc)], key: [dot(k, ax), dot(k, b), dot(k, cc)], px: (c.focal * slots[i]!.len) / cm[2] },
                st,
                theme,
                sprites!,
              );
            }
          },
        };
        hull.draw(g, shipView, draw);
        hull.shafts(g, shipView, draw);
        // The pylons out of the bay but still by the ship: over the hull.
        for (const p of rigs) if (p.alt === Infinity) drawRig(g, p.pose, p.state, theme, sprites);
      }

      // Motes drifting past the lens.
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

      // The edges a little darker; a soft green light as each pylon locks; it opens from black.
      const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.62);
      vg.addColorStop(0, "rgb(0 0 0 / 0)");
      vg.addColorStop(1, "rgb(0 0 0 / 0.5)");
      g.fillStyle = vg;
      g.fillRect(0, 0, w, h);
      if (nudge > 0.01) {
        g.fillStyle = `rgb(120 255 220 / ${Math.min(0.08, nudge * 0.12).toFixed(3)})`;
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
