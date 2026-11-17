/**
 * Terraformer 2.0: one terraformer pylon, an atmospheric processor (designer 2026-11-17). From the
 * bottom up: a heavy conical anchor spike, an anchor collar, the reactor core (a cylinder with a
 * glowing reactor ring), four solar / radiator wings hinged under the head (folded along the core,
 * opening a little in the air and wide once anchored), the head with four braking thrusters that
 * fire upwards, and the emitter mast that fires the beam. Status beacons blink on the hull.
 *
 * It is drawn as a real solid: every point is a point of the pylon's own frame, put into the
 * picture by `pose.at` (so it turns, shortens and leans with the camera by itself), and every
 * surface is shaded from its own direction: a key light, a cool fill, a sharp metal highlight and
 * a rim of light along the edge away from the key. Looks only.
 */

import { clamp, TAU, type V3 } from "../../briefing/styles/intro2/math3.js";
import { mixRgb, shade } from "../terraformer/pylon.js";
import type { CompanyTheme } from "../types.js";

/**
 * A point of the pylon in the picture. h: along its axis, in pylon lengths (0 the spike's tip, 1 the
 * top of the mast); x, y: across it, in pylon lengths, along its own two side axes.
 */
export type RigAt = (h: number, x: number, y: number) => [number, number];

export interface RigPose {
  at: RigAt;
  /** Towards the camera, in the pylon's axes (a along, b and c across); a unit vector. */
  view: V3;
  /** Towards the key light, in the pylon's axes; a unit vector. */
  key: V3;
  /** Pixels per pylon length, near the pylon (sizes of glows and thin lines). */
  px: number;
}

export interface RigState {
  /** Turned about its own axis, radians. */
  spin: number;
  /** Wings: 0 folded along the core, 1 wide open. */
  open: number;
  /** Braking thrusters, 0 off .. 1.6 full. */
  thrust: number;
  /** Beacons and the reactor ring, 0..1. */
  power: number;
  /** The key light's strength 0..1 and colour. */
  keyK: number;
  keyRgb: string;
  /** The pale glow round the spike's tip in the upper air (no fire), 0..1. */
  sheath: number;
  /** The emitter on top, 0..1 (the beam firing). */
  emit: number;
  t: number;
}

/** The pylon's widest radius (the anchor collar), in pylon lengths. */
export const RIG_RADIUS = 0.135;
/** Where the beam leaves the mast, along the axis. */
export const RIG_TOP = 1.0;

/** The solid parts, bottom up: [h0, h1, r0, r1, kind]. kind 0 hull metal, 1 dark metal, 2 the reactor band. */
const PARTS: [number, number, number, number, number][] = [
  [0.0, 0.1, 0.006, 0.05, 1],
  [0.1, 0.24, 0.05, 0.104, 1],
  [0.24, 0.29, 0.135, 0.135, 1],
  [0.29, 0.43, 0.092, 0.092, 0],
  [0.43, 0.55, 0.106, 0.106, 2],
  [0.55, 0.79, 0.088, 0.088, 0],
  [0.79, 0.84, 0.116, 0.116, 1],
  [0.84, 0.92, 0.1, 0.082, 0],
  [0.92, 0.985, 0.028, 0.024, 1],
];
/** The wings: hinged at this height just outside the core, this long, this wide; their largest opening, radians. */
const WING_H = 0.785;
const WING_R = 0.096;
const WING_LEN = 0.33;
const WING_W = 0.088;
/** Even folded, the wings stand off the core a little, so they show as panels. */
const WING_MIN = 0.07;
const WING_MAX = 1.3;
/** A little open in the air (designer: "unfold their side stabilizer fins slightly"). */
export const WING_AIR = 0.28;
/** The four thrusters: between the wings, on the head. */
const POD_R = 0.112;
const POD_H0 = 0.83;
const POD_H1 = 0.935;
const POD_RAD = 0.026;
const NOZZLE = 0.96;
/** The beacons: [h, angle from the first wing, colour 0 main 1 second 2 red]. */
const BEACONS: [number, number, number][] = [
  [0.36, 0.5, 1],
  [0.62, 2.6, 2],
  [0.7, 4.4, 0],
  [0.26, 3.6, 2],
  [0.5, 1.6, 0],
];

const ARC = 9;
const tmp: [number, number][] = Array.from({ length: ARC * 2 + 4 }, () => [0, 0]);

export interface RigSprites {
  /** A soft round light (white core), coloured by globalAlpha only: thruster light, beacons. */
  plume: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  beam: HTMLCanvasElement;
  red: HTMLCanvasElement;
  main: HTMLCanvasElement;
  second: HTMLCanvasElement;
  sheath: HTMLCanvasElement;
}

/** Draw a pylon. Returns nothing; draws nothing when it is off the picture or smaller than a dot. */
export function drawRig(g: CanvasRenderingContext2D, pose: RigPose, s: RigState, theme: CompanyTheme, sp: RigSprites): void {
  const { at, view, key, px } = pose;
  if (!(px > 0.3)) return;
  const [base] = [at(0, 0, 0)];
  const top = at(1, 0, 0);
  const span = Math.hypot(top[0] - base[0], top[1] - base[1]) + px * 0.3;
  if (Math.max(base[0], top[0]) < -span || Math.min(base[0], top[0]) > 2e4 || Math.max(base[1], top[1]) < -span) return;

  // The side of the pylon the camera sees, across its axis: s (the outline's direction) and v (towards the camera).
  let vb = view[1];
  let vc = view[2];
  const vl = Math.hypot(vb, vc);
  if (vl < 1e-4) {
    vb = 0;
    vc = 1;
  } else {
    vb /= vl;
    vc /= vl;
  }
  const sb = -vc;
  const sc = vb;
  const va = view[0];
  const metal = mixRgb(theme.hull, "214 222 232", 0.55);
  const darkMetal = mixRgb(theme.hull, "84 88 100", 0.45);
  const rimRgb = mixRgb("170 214 255", theme.primary, 0.25);
  const keyB = key[1] * sb + key[2] * sc;
  const keyV = key[1] * vb + key[2] * vc;
  // Half-way between the key light and the eye: where the sharp highlight sits.
  const hx = key[1] + view[1];
  const hy = key[2] + view[2];
  const hz = key[0] + view[0];
  const hl = Math.hypot(hx, hy, hz) || 1;
  const halfB = (hx * sb + hy * sc) / hl;
  const halfV = (hx * vb + hy * vc) / hl;

  /** The colour of the surface whose direction across the axis is s*S + sqrt(1-s^2)*V. */
  const lit = (rgb: string, k: number, gloss: number): string => {
    const nv = Math.sqrt(Math.max(0, 1 - k * k));
    const diff = Math.max(0, k * keyB + nv * keyV);
    const spec = Math.pow(Math.max(0, k * halfB + nv * halfV), 28) * gloss * s.keyK;
    // The rim: bright on the edge, strongest on the side away from the key.
    const rim = Math.pow(1 - nv, 3) * (0.35 + 0.65 * clamp(-k * Math.sign(keyB || 1))) * 0.85;
    const amb = 0.34 + 0.14 * nv;
    const [r, gg, b] = rgb.split(" ").map(Number) as [number, number, number];
    const [kr, kg, kb] = s.keyRgb.split(" ").map(Number) as [number, number, number];
    const [rr, rgv, rb] = rimRgb.split(" ").map(Number) as [number, number, number];
    const d = diff * s.keyK * 1.15;
    const ch = (c: number, kc: number, rc: number) => Math.min(255, Math.round(c * (amb + (d * kc) / 255) + 255 * spec + rc * rim));
    return `rgb(${ch(r, kr, rr)} ${ch(gg, kg, rgv)} ${ch(b, kb, rb)})`;
  };

  if (span < 13) {
    // Far away: a sliver with its light.
    g.strokeStyle = lit(metal, 0, 0.3);
    g.lineWidth = Math.max(1, px * 0.18);
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(base[0], base[1]);
    g.lineTo(top[0], top[1]);
    g.stroke();
    lights(g, pose, s, theme, sp, false);
    return;
  }

  /** One solid ring of the pylon, h0..h1, radius r0..r1: its outline filled with the light across it, and its cap when the camera sees it. */
  const part = (h0: number, h1: number, r0: number, r1: number, rgb: string, gloss: number, ox = 0, oy = 0): void => {
    let m = 0;
    // The bottom end: its near half when it faces away, its far half when it faces the camera.
    const bottomFar = -va > 0;
    for (let i = 0; i <= ARC; i++) {
      const th = Math.PI - (i / ARC) * Math.PI;
      const sn = (bottomFar ? -1 : 1) * Math.sin(th);
      const cs = Math.cos(th);
      const p = at(h0, ox + r0 * (cs * sb + sn * vb), oy + r0 * (cs * sc + sn * vc));
      tmp[m]![0] = p[0];
      tmp[m++]![1] = p[1];
    }
    const topFar = va > 0;
    for (let i = 0; i <= ARC; i++) {
      const th = (i / ARC) * Math.PI;
      const sn = (topFar ? -1 : 1) * Math.sin(th);
      const cs = Math.cos(th);
      const p = at(h1, ox + r1 * (cs * sb + sn * vb), oy + r1 * (cs * sc + sn * vc));
      tmp[m]![0] = p[0];
      tmp[m++]![1] = p[1];
    }
    g.beginPath();
    g.moveTo(tmp[0]![0], tmp[0]![1]);
    for (let i = 1; i < m; i++) g.lineTo(tmp[i]![0], tmp[i]![1]);
    g.closePath();
    const hm = (h0 + h1) / 2;
    const rm = (r0 + r1) / 2;
    const a = at(hm, ox - rm * sb, oy - rm * sc);
    const b = at(hm, ox + rm * sb, oy + rm * sc);
    const grd = g.createLinearGradient(a[0], a[1], b[0], b[1]);
    for (const k of [-1, -0.82, -0.55, -0.2, 0.2, 0.55, 0.82, 1]) grd.addColorStop((k + 1) / 2, lit(rgb, k, gloss));
    g.fillStyle = grd;
    g.fill();
    // The cap the camera sees (the top from above, the bottom from below).
    const capUp = va > 0;
    const hc = capUp ? h1 : h0;
    const rc = capUp ? r1 : r0;
    if (rc > 0.02 && Math.abs(va) > 0.06) {
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const th = (i / 16) * TAU;
        const p = at(hc, ox + rc * Math.cos(th), oy + rc * Math.sin(th));
        if (i) g.lineTo(p[0], p[1]);
        else g.moveTo(p[0], p[1]);
      }
      g.closePath();
      const up = capUp ? key[0] : -key[0];
      g.fillStyle = shadeLit(rgb, 0.24 + 0.6 * Math.max(0, up) * s.keyK);
      g.fill();
    }
  };

  // The wings and thruster pods behind the core first, then the core, then those in front.
  const open = WING_MIN + clamp(s.open) * (WING_MAX - WING_MIN);
  const wings = [0, 1, 2, 3].map((k) => {
    const ph = s.spin + (k * Math.PI) / 2;
    return { ph, front: Math.cos(ph) * vb + Math.sin(ph) * vc + Math.sin(open) * 0.05 };
  });
  const pods = [0, 1, 2, 3].map((k) => {
    const ph = s.spin + Math.PI / 4 + (k * Math.PI) / 2;
    return { ph, front: Math.cos(ph) * vb + Math.sin(ph) * vc };
  });
  const wing = (ph: number) => {
    const cr = Math.cos(ph);
    const sr = Math.sin(ph);
    const tb = -sr;
    const tc = cr;
    // Its direction from the hinge: down along the core, swinging out.
    const da = -Math.cos(open);
    const dr = Math.sin(open);
    const hw = WING_W / 2;
    const tw = hw * 0.82;
    const H: [number, number] = [WING_R * cr, WING_R * sr];
    const T: [number, number] = [(WING_R + WING_LEN * dr) * cr, (WING_R + WING_LEN * dr) * sr];
    const th = WING_H + WING_LEN * da;
    const p0 = at(WING_H, H[0] + tb * hw, H[1] + tc * hw);
    const p1 = at(WING_H, H[0] - tb * hw, H[1] - tc * hw);
    const p2 = at(th, T[0] - tb * tw, T[1] - tc * tw);
    const p3 = at(th, T[0] + tb * tw, T[1] + tc * tw);
    // Its outer face (solar cells) points outwards when folded, and up as it opens.
    const na = Math.sin(open);
    const nr = Math.cos(open);
    const outer = na * view[0] + nr * (cr * view[1] + sr * view[2]);
    const face = outer > 0 ? 1 : -1;
    const ka = face * (na * key[0] + nr * (cr * key[1] + sr * key[2]));
    const lightK = 0.22 + 0.78 * Math.max(0, ka) * s.keyK;
    const glint = Math.pow(Math.max(0, face * (na * (key[0] + view[0]) + nr * (cr * (key[1] + view[1]) + sr * (key[2] + view[2]))) / hl), 40) * s.keyK;
    g.beginPath();
    g.moveTo(p0[0], p0[1]);
    g.lineTo(p1[0], p1[1]);
    g.lineTo(p2[0], p2[1]);
    g.lineTo(p3[0], p3[1]);
    g.closePath();
    const solar = face > 0;
    const panel = solar ? mixRgb("70 112 178", theme.primary, 0.18) : mixRgb(metal, "170 176 186", 0.4);
    const grd = g.createLinearGradient(p0[0], p0[1], (p2[0] + p3[0]) / 2, (p2[1] + p3[1]) / 2);
    grd.addColorStop(0, shadeLit(panel, lightK * 1.1, glint * 0.6));
    grd.addColorStop(1, shadeLit(panel, lightK * 0.75, glint));
    g.fillStyle = grd;
    g.fill();
    if (span > 40) {
      // Cell lines on the solar side, ribs on the radiator side; the frame catches the light.
      g.strokeStyle = solar ? "rgb(8 16 36 / 0.75)" : "rgb(20 24 30 / 0.5)";
      g.lineWidth = Math.max(0.5, px * 0.004);
      g.beginPath();
      for (const f of [0.2, 0.4, 0.6, 0.8]) {
        g.moveTo(p0[0] + (p3[0] - p0[0]) * f, p0[1] + (p3[1] - p0[1]) * f);
        g.lineTo(p1[0] + (p2[0] - p1[0]) * f, p1[1] + (p2[1] - p1[1]) * f);
      }
      for (const f of [1 / 3, 2 / 3]) {
        g.moveTo(p0[0] + (p1[0] - p0[0]) * f, p0[1] + (p1[1] - p0[1]) * f);
        g.lineTo(p3[0] + (p2[0] - p3[0]) * f, p3[1] + (p2[1] - p3[1]) * f);
      }
      g.stroke();
      g.strokeStyle = `rgb(${mixRgb(rimRgb, "255 255 255", 0.3)} / ${(0.25 + 0.5 * lightK).toFixed(3)})`;
      g.lineWidth = Math.max(0.6, px * 0.006);
      g.beginPath();
      g.moveTo(p0[0], p0[1]);
      g.lineTo(p1[0], p1[1]);
      g.lineTo(p2[0], p2[1]);
      g.lineTo(p3[0], p3[1]);
      g.closePath();
      g.stroke();
    }
  };
  const pod = (ph: number) => part(POD_H0, POD_H1, POD_RAD, POD_RAD * 1.25, darkMetal, 0.5, POD_R * Math.cos(ph), POD_R * Math.sin(ph));

  for (const w of wings) if (w.front < 0) wing(w.ph);
  for (const p of pods) if (p.front < 0) pod(p.ph);
  for (const [h0, h1, r0, r1, kind] of PARTS) part(h0, h1, r0, r1, kind === 1 ? darkMetal : metal, kind === 1 ? 0.45 : 0.9);
  if (span > 22) {
    // Plate seams round the core, darker; the reactor ring in the Company's colour.
    g.lineWidth = Math.max(0.5, px * 0.004);
    g.strokeStyle = "rgb(0 0 0 / 0.45)";
    g.beginPath();
    for (const h of [0.36, 0.62, 0.7]) ring(g, at, h, 0.093, sb, sc, vb, vc, va);
    g.stroke();
  }
  // The reactor band glows through its windows.
  g.save();
  g.globalCompositeOperation = "lighter";
  const pulse = s.power * (0.7 + 0.3 * Math.sin(s.t * 3.1));
  if (pulse > 0.02) {
    g.strokeStyle = `rgb(${theme.primary} / ${(0.9 * pulse).toFixed(3)})`;
    g.lineWidth = Math.max(0.8, px * 0.022);
    g.beginPath();
    ring(g, at, 0.49, 0.108, sb, sc, vb, vc, va);
    g.stroke();
    g.strokeStyle = `rgb(${mixRgb(theme.primary, "255 255 255", 0.6)} / ${(0.9 * pulse).toFixed(3)})`;
    g.lineWidth = Math.max(0.5, px * 0.007);
    g.stroke();
  }
  g.restore();
  for (const p of pods) if (p.front >= 0) pod(p.ph);
  for (const w of wings) if (w.front >= 0) wing(w.ph);
  lights(g, pose, s, theme, sp, true);
}

/** The near half of the ring round the axis at height h (the half the camera sees). */
function ring(g: CanvasRenderingContext2D, at: RigAt, h: number, r: number, sb: number, sc: number, vb: number, vc: number, _va: number): void {
  for (let i = 0; i <= ARC; i++) {
    const th = Math.PI - (i / ARC) * Math.PI;
    const p = at(h, r * (Math.cos(th) * sb + Math.sin(th) * vb), r * (Math.cos(th) * sc + Math.sin(th) * vc));
    if (i) g.lineTo(p[0], p[1]);
    else g.moveTo(p[0], p[1]);
  }
}

function shadeLit(rgb: string, k: number, glint = 0): string {
  const [r, gg, b] = rgb.split(" ").map(Number) as [number, number, number];
  const ch = (c: number) => Math.min(255, Math.round(c * k + 255 * glint));
  return `rgb(${ch(r)} ${ch(gg)} ${ch(b)})`;
}

/** The pylon's own lights: thruster plumes (upwards, blue and white), beacons, the emitter, the pale sheath of the upper air. */
function lights(g: CanvasRenderingContext2D, pose: RigPose, s: RigState, theme: CompanyTheme, sp: RigSprites, near: boolean): void {
  const { at, px, view } = pose;
  g.save();
  g.globalCompositeOperation = "lighter";
  if (s.thrust > 0.02) {
    const fl = 0.9 + 0.07 * Math.sin(s.t * 47) + 0.05 * Math.sin(s.t * 83 + 1.3);
    const len = (0.12 + 0.3 * s.thrust) * fl;
    for (let k = 0; k < 4; k++) {
      const ph = s.spin + Math.PI / 4 + (k * Math.PI) / 2;
      const x = POD_R * Math.cos(ph);
      const y = POD_R * Math.sin(ph);
      const a = at(NOZZLE, x, y);
      const b = at(NOZZLE + len, x, y);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const wide = Math.max(1.2, px * (0.03 + 0.02 * s.thrust));
      if (L > 1) {
        g.save();
        g.translate(a[0], a[1]);
        g.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]));
        g.globalAlpha = Math.min(1, 0.55 + 0.4 * s.thrust);
        g.drawImage(sp.plume, 0, -wide, L * 1.15, wide * 2);
        g.restore();
      }
      // The nozzle's own light (all that shows when the plume points at the camera).
      const r = Math.max(1.5, px * 0.05 * (0.6 + 0.5 * s.thrust)) * (1 + 0.6 * Math.max(0, view[0]));
      g.globalAlpha = Math.min(1, 0.4 + 0.45 * s.thrust);
      g.drawImage(sp.glow, a[0] - r, a[1] - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }
  if (s.power > 0.02) {
    for (const [k, [h, ang, col]] of BEACONS.entries()) {
      const ph = s.spin + ang;
      const front = Math.cos(ph) * view[1] + Math.sin(ph) * view[2];
      if (near && front < -0.25) continue;
      const blink = Math.pow(0.5 + 0.5 * Math.sin(s.t * (3.2 + k * 0.7) + k * 2.1), 5);
      const a = s.power * (0.25 + 0.75 * blink);
      const p = at(h, 0.1 * Math.cos(ph), 0.1 * Math.sin(ph));
      const r = Math.max(1.4, px * 0.035) * (0.7 + 0.5 * blink);
      g.globalAlpha = Math.min(1, a);
      g.drawImage(col === 2 ? sp.red : col === 1 ? sp.second : sp.main, p[0] - r, p[1] - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  }
  if (s.emit > 0.01) {
    const p = at(RIG_TOP, 0, 0);
    const r = Math.max(2, px * 0.09 * (0.6 + s.emit));
    g.globalAlpha = Math.min(1, s.emit);
    g.drawImage(sp.beam, p[0] - r, p[1] - r, r * 2, r * 2);
    g.globalAlpha = 1;
  }
  if (s.sheath > 0.01) {
    const p = at(0.04, 0, 0);
    const q = at(-0.12, 0, 0);
    const r = Math.max(2, px * 0.09);
    g.globalAlpha = 0.55 * s.sheath;
    g.drawImage(sp.sheath, (p[0] + q[0]) / 2 - r, (p[1] + q[1]) / 2 - r, r * 2, r * 2);
    g.globalAlpha = 1;
  }
  g.restore();
}
