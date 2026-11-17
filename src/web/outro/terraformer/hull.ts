/**
 * The Terraformer outro: the underside of the Company's capital vessel, seen from below and
 * astern as a great dark ceiling running away towards the planet. Each Company's ship has its own
 * outline (the same outlines as the wireframes of the Vessel screen, VesselSchematic.tsx); a ship
 * with no outline here gets a plain hull. In the belly are the terraformer bays: doors that slide
 * apart over a lit hold. A stand-in until the designer's ship art. Looks only.
 *
 * The ship's own frame: x forward (bow), y up, z to starboard; the belly is the plane y = 0.
 * About 17 units long.
 */

import { rng, type V3 } from "../../briefing/styles/intro2/math3.js";
import type { CompanyTheme } from "../types.js";
import { mixRgb, shade, softSprite } from "./pylon.js";

type Pt = [number, number];
/** A place on the Vessel screen's wireframe (400 x 240) as a place on the belly: [x, z]. */
const at = (sx: number, sy: number): Pt => [(sx - 200) / 20, (sy - 120) / 20];
const poly = (...p: [number, number][]): Pt[] => p.map(([x, y]) => at(x, y));

/** A bay in the belly: its opening (x0..x1 along the ship, z0..z1 across). */
export interface Bay {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
interface HullDef {
  parts: Pt[][];
  bays: Bay[];
  /** Rows of small lights: from, to, how many. */
  rows: [Pt, Pt, number][];
  /** Painted bands: x0, z0, x1, z1. */
  stripes: [number, number, number, number][];
  /** Flashing lights at the ends of the wings. */
  beacons: Pt[];
}

const HULLS: Record<string, HullDef> = {
  // A broad support ship: one deep hull, short wings; one long bay along the spine.
  V1: {
    parts: [poly([40, 120], [92, 78], [252, 70], [332, 100], [362, 120], [332, 140], [252, 170], [92, 162]), poly([122, 78], [102, 40], [192, 46], [212, 72]), poly([122, 162], [102, 200], [192, 194], [212, 168]), poly([40, 104], [22, 104], [22, 136], [40, 136])],
    bays: [{ x0: -2.6, x1: 4.2, z0: -0.82, z1: 0.82 }],
    rows: [
      [[-6.6, -1.8], [5.4, -1.85], 52],
      [[-6.6, 1.8], [5.4, 1.85], 52],
      [[-4.4, -3.5], [-0.8, -3.3], 14],
      [[-4.4, 3.5], [-0.8, 3.3], 14],
    ],
    stripes: [
      [5.3, -2.4, 5.62, 2.4],
      [5.9, -2.4, 6.05, 2.4],
      [-8.0, -0.1, -3.0, 0.1],
      [-4.6, -3.9, -4.3, -2.2],
      [-4.6, 2.2, -4.3, 3.9],
    ],
    beacons: [[-4.8, -3.95], [-4.8, 3.95], [8.0, 0]],
  },
  // A twin-hull ship: two long hulls, struts and a pod between them; a bay in each hull.
  V2: {
    parts: [
      poly([48, 72], [110, 52], [300, 56], [366, 76], [300, 94], [110, 98]),
      poly([48, 168], [110, 188], [300, 184], [366, 164], [300, 146], [110, 142]),
      poly([144, 98], [156, 98], [156, 142], [144, 142]),
      poly([244, 94], [256, 94], [256, 146], [244, 146]),
      poly([176, 120], [188, 100], [212, 100], [224, 120], [212, 140], [188, 140]),
      poly([48, 64], [30, 64], [30, 84], [48, 84]),
      poly([48, 176], [30, 176], [30, 156], [48, 156]),
    ],
    bays: [
      { x0: -2.4, x1: 2.9, z0: -2.95, z1: -1.55 },
      { x0: -2.4, x1: 2.9, z0: 1.55, z1: 2.95 },
    ],
    rows: [
      [[-4.3, -3.2], [4.8, -3.05], 40],
      [[-4.3, -1.25], [4.8, -1.4], 40],
      [[-4.3, 3.2], [4.8, 3.05], 40],
      [[-4.3, 1.25], [4.8, 1.4], 40],
    ],
    stripes: [
      [5.4, -3.4, 5.7, -1.0],
      [5.4, 1.0, 5.7, 3.4],
      [-7.0, -2.35, -3.0, -2.15],
      [-7.0, 2.15, -3.0, 2.35],
      [-0.35, -0.9, 0.35, 0.9],
    ],
    beacons: [[8.2, -2.2], [8.2, 2.2], [-8.4, -2.3], [-8.4, 2.3]],
  },
};
const PLAIN: HullDef = {
  parts: [poly([40, 120], [100, 84], [300, 84], [360, 120], [300, 156], [100, 156])],
  bays: [{ x0: -2.6, x1: 3.6, z0: -0.82, z1: 0.82 }],
  rows: [
    [[-5, -1.55], [5, -1.55], 44],
    [[-5, 1.55], [5, 1.55], 44],
  ],
  stripes: [
    [5.2, -1.8, 5.5, 1.8],
    [-7.5, -0.1, -3, 0.1],
  ],
  beacons: [[7.9, 0], [-7.9, 0]],
};

/** How the ship is looked at: ship coordinates into the camera's (x right, y down, z into the picture). */
export interface ShipView {
  cam(x: number, y: number, z: number): V3;
  focal: number;
  cx: number;
  cy: number;
}

const NEAR = 0.35;
/** A flat shape of the ship as a shape of the picture: [x0, y0, x1, y1 ...], cut off where it passes behind the eye. */
function project(v: ShipView, pts: V3[]): number[] {
  const cam = pts.map((p) => v.cam(p[0], p[1], p[2]));
  const kept: V3[] = [];
  for (let i = 0; i < cam.length; i++) {
    const a = cam[i]!;
    const b = cam[(i + 1) % cam.length]!;
    if (a[2] >= NEAR) kept.push(a);
    if (a[2] >= NEAR !== b[2] >= NEAR) {
      const k = (NEAR - a[2]) / (b[2] - a[2]);
      kept.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, NEAR]);
    }
  }
  const out: number[] = [];
  for (const p of kept) out.push(v.cx + (v.focal * p[0]) / p[2], v.cy + (v.focal * p[1]) / p[2]);
  return out;
}
function trace(g: CanvasRenderingContext2D | Path2D, xy: number[]): void {
  if (xy.length < 6) return;
  g.moveTo(xy[0]!, xy[1]!);
  for (let i = 2; i < xy.length; i += 2) g.lineTo(xy[i]!, xy[i + 1]!);
  g.closePath();
}
const belly = (p: Pt[], y = 0): V3[] => p.map(([x, z]) => [x, y, z] as V3);
const rect = (x0: number, z0: number, x1: number, z1: number, y = 0): V3[] => [
  [x0, y, z0],
  [x1, y, z0],
  [x1, y, z1],
  [x0, y, z1],
];

/** The outline round a handful of points of the picture (the shape a light shaft makes). */
function outline(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]) => {
    const h: [number, number][] = [];
    for (const q of list) {
      while (h.length >= 2 && turn(h[h.length - 2]!, h[h.length - 1]!, q) <= 0) h.pop();
      h.push(q);
    }
    h.pop();
    return h;
  };
  return [...half(p), ...half(p.reverse())];
}

/** How deep the hold is, above the belly. */
const HOLD = 2.8;

export interface HullDraw {
  t: number;
  /** The doors: 0 shut, 1 open. */
  doors: number;
  /** The hold's lamps: 0 dark, 1 full. */
  lamps: number;
  /** A soft light sprite (warm), for the glow out of the hold. */
  glow: HTMLCanvasElement;
  /** Drawn inside the hold, before the doors: the pylons still hanging there. */
  cargo(): void;
}

export interface Hull {
  bays: Bay[];
  /** Where n pylons hang: the place of each one's middle, in the order they are let go. */
  slots(n: number): V3[];
  draw(g: CanvasRenderingContext2D, v: ShipView, o: HullDraw): void;
  /** The light that falls out of the open bays, drawn over what is below the ship. */
  shafts(g: CanvasRenderingContext2D, v: ShipView, o: HullDraw): void;
}

export function createHull(vesselId: string, theme: CompanyTheme): Hull {
  const def = HULLS[vesselId] ?? PLAIN;
  const R = rng(4242 + vesselId.length * 77);
  // Plating: long seams and cross seams over the whole belly (each part shows its share), and plates lighter or darker.
  const seams: [number, number, number, number][] = [];
  for (let z = -4.5; z <= 4.51; z += 0.5) seams.push([-9.5, z, 9, z]);
  for (let x = -9; x <= 8.6; x += 0.85) {
    const z0 = -4.5 + Math.floor(R() * 4) * 0.5;
    seams.push([x, z0, x, z0 + 2 + Math.floor(R() * 12) * 0.5]);
  }
  const plates: [number, number, number, number, number][] = [];
  for (let i = 0; i < 90; i++) {
    const x = -9 + R() * 17.5;
    const z = -4.4 + R() * 8.8;
    plates.push([x, z, x + 0.3 + R() * 1.6, z + 0.25 + R() * 0.9, R() < 0.5 ? -(0.2 + R() * 0.3) : 0.05 + R() * 0.1]);
  }
  const dark = shade(theme.hull, 0.11);
  const mid = shade(theme.hull, 0.24);
  const paint = shade(theme.livery, 0.5);

  function slots(n: number): V3[] {
    const out: V3[] = [];
    // Shared between the bays; in each, a zigzag along the bay.
    const per = def.bays.map((_, i) => Math.floor(n / def.bays.length) + (i < n % def.bays.length ? 1 : 0));
    const lists = def.bays.map((b, i) => {
      const k = per[i]!;
      return Array.from({ length: k }, (_, j): V3 => {
        const x = b.x1 - 0.55 - ((b.x1 - b.x0 - 1.1) * (k > 1 ? j / (k - 1) : 0.5));
        const z = (b.z0 + b.z1) / 2 + (j % 2 ? -1 : 1) * (b.z1 - b.z0) * 0.2;
        return [x, 0.55, z];
      });
    });
    // Let go bay by bay in turn, from the bow end back.
    for (let j = 0; out.length < n; j++) for (const l of lists) if (l[j]) out.push(l[j]!);
    return out;
  }

  function draw(g: CanvasRenderingContext2D, v: ShipView, o: HullDraw): void {
    const lamps = o.lamps * (0.9 + 0.1 * Math.sin(o.t * 31));
    // The plating of each part.
    for (const part of def.parts) {
      const xy = project(v, belly(part));
      if (xy.length < 6) continue;
      let top = Infinity;
      let bot = -Infinity;
      for (let i = 1; i < xy.length; i += 2) {
        top = Math.min(top, xy[i]!);
        bot = Math.max(bot, xy[i]!);
      }
      g.save();
      g.beginPath();
      trace(g, xy);
      const fill = g.createLinearGradient(0, top, 0, bot);
      fill.addColorStop(0, `rgb(${dark})`);
      fill.addColorStop(1, `rgb(${mid})`);
      g.fillStyle = fill;
      g.fill();
      g.clip();
      for (const [x0, z0, x1, z1, tint] of plates) {
        const q = project(v, rect(x0, z0, x1, z1));
        if (q.length < 6) continue;
        g.fillStyle = tint < 0 ? `rgb(0 0 0 / ${-tint})` : `rgb(170 200 240 / ${tint})`;
        g.beginPath();
        trace(g, q);
        g.fill();
      }
      for (const [x0, z0, x1, z1] of def.stripes) {
        const q = project(v, rect(x0, z0, x1, z1));
        if (q.length < 6) continue;
        g.fillStyle = `rgb(${paint} / 0.85)`;
        g.beginPath();
        trace(g, q);
        g.fill();
      }
      g.strokeStyle = "rgb(150 185 230 / 0.13)";
      g.lineWidth = 1;
      g.beginPath();
      for (const [x0, z0, x1, z1] of seams) {
        const q = project(v, [
          [x0, 0, z0],
          [x1, 0, z1],
        ]);
        if (q.length < 4) continue;
        g.moveTo(q[0]!, q[1]!);
        g.lineTo(q[2]!, q[3]!);
      }
      g.stroke();
      // The bays' lamps on the plating round them.
      if (lamps > 0.01 && o.doors > 0.01) {
        g.globalCompositeOperation = "lighter";
        for (const b of def.bays) {
          const c = v.cam((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2);
          if (c[2] < NEAR) continue;
          const s = (v.focal / c[2]) * (b.x1 - b.x0) * 0.9;
          g.globalAlpha = Math.min(1, 0.5 * lamps * o.doors);
          g.drawImage(o.glow, v.cx + (v.focal * c[0]) / c[2] - s, v.cy + (v.focal * c[1]) / c[2] - s * 0.5, s * 2, s);
        }
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }
      g.restore();
      // Its edge, catching the light of the planet.
      g.strokeStyle = "rgb(120 170 255 / 0.4)";
      g.lineWidth = 1.2;
      g.beginPath();
      trace(g, xy);
      g.stroke();
    }

    // The bays: the lit hold, what hangs in it, then the doors and the frame.
    for (const b of def.bays) {
      const open = project(v, rect(b.x0, b.z0, b.x1, b.z1));
      if (open.length < 6) continue;
      g.save();
      g.beginPath();
      trace(g, open);
      g.clip();
      g.fillStyle = "#04060a";
      g.fill();
      const warm = mixRgb("255 226 170", theme.secondary, 0.25);
      const wall = (pts: V3[], k: number) => {
        const q = project(v, pts);
        if (q.length < 6) return;
        g.fillStyle = `rgb(${shade(warm, k * (0.06 + 0.94 * lamps))})`;
        g.beginPath();
        trace(g, q);
        g.fill();
      };
      // Roof, side walls, the far wall.
      wall(rect(b.x0, b.z0, b.x1, b.z1, HOLD), 0.42);
      wall([[b.x0, 0, b.z0], [b.x1, 0, b.z0], [b.x1, HOLD, b.z0], [b.x0, HOLD, b.z0]], 0.3);
      wall([[b.x0, 0, b.z1], [b.x1, 0, b.z1], [b.x1, HOLD, b.z1], [b.x0, HOLD, b.z1]], 0.3);
      wall([[b.x1, 0, b.z0], [b.x1, 0, b.z1], [b.x1, HOLD, b.z1], [b.x1, HOLD, b.z0]], 0.6);
      // Ribs, and the lamp bars across the roof.
      g.strokeStyle = "rgb(20 12 4 / 0.55)";
      g.lineWidth = 1.5;
      g.beginPath();
      for (let x = b.x0 + 0.42; x < b.x1; x += 0.85)
        for (const z of [b.z0, b.z1]) {
          const q = project(v, [
            [x, 0, z],
            [x, HOLD, z],
          ]);
          if (q.length === 4) {
            g.moveTo(q[0]!, q[1]!);
            g.lineTo(q[2]!, q[3]!);
          }
        }
      g.stroke();
      if (lamps > 0.01) {
        g.globalCompositeOperation = "lighter";
        g.lineCap = "round";
        for (let x = b.x0 + 0.85, i = 0; x < b.x1; x += 0.85, i++) {
          const q = project(v, [
            [x, HOLD - 0.02, b.z0 + 0.12],
            [x, HOLD - 0.02, b.z1 - 0.12],
          ]);
          if (q.length !== 4) continue;
          const c = v.cam(x, HOLD, 0);
          const wide = Math.max(1.2, (v.focal / Math.max(NEAR, c[2])) * 0.07);
          // The lamps come on one after another, with a stutter.
          const on = Math.min(1, Math.max(0, o.lamps * 7 - i * 0.6)) * (0.92 + 0.08 * Math.sin(o.t * 47 + i * 1.7));
          g.strokeStyle = `rgb(255 244 220 / ${on.toFixed(3)})`;
          g.lineWidth = wide;
          g.beginPath();
          g.moveTo(q[0]!, q[1]!);
          g.lineTo(q[2]!, q[3]!);
          g.stroke();
          g.strokeStyle = `rgb(${warm} / ${(on * 0.35).toFixed(3)})`;
          g.lineWidth = wide * 4;
          g.stroke();
        }
        // The Company's colour along the far wall.
        const q = project(v, [
          [b.x1 - 0.01, HOLD * 0.5, b.z0 + 0.1],
          [b.x1 - 0.01, HOLD * 0.5, b.z1 - 0.1],
        ]);
        if (q.length === 4) {
          g.strokeStyle = `rgb(${theme.primary} / ${(0.9 * lamps).toFixed(3)})`;
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(q[0]!, q[1]!);
          g.lineTo(q[2]!, q[3]!);
          g.stroke();
        }
        g.globalCompositeOperation = "source-over";
      }
      o.cargo();
      // The two doors slide apart under the plating.
      const zc = (b.z0 + b.z1) / 2;
      const gap = (zc - b.z0) * o.doors;
      for (const s of [-1, 1]) {
        const za = s < 0 ? b.z0 - gap : zc + gap;
        const zb = s < 0 ? zc - gap : b.z1 + gap;
        const q = project(v, rect(b.x0, za, b.x1, zb));
        if (q.length < 6) continue;
        g.fillStyle = `rgb(${shade(theme.hull, 0.2)})`;
        g.beginPath();
        trace(g, q);
        g.fill();
        g.strokeStyle = "rgb(150 185 230 / 0.2)";
        g.lineWidth = 1;
        g.stroke();
        // Hazard marks along the meeting edge.
        const edge = s < 0 ? zb : za;
        const n = Math.max(6, Math.round((b.x1 - b.x0) / 0.36));
        for (let i = 0; i < n; i += 2) {
          const xa = b.x0 + ((b.x1 - b.x0) * i) / n;
          const xb = b.x0 + ((b.x1 - b.x0) * (i + 1)) / n;
          const h = project(v, rect(xa, edge - s * 0.02, xb, edge - s * 0.16));
          if (h.length < 6) continue;
          g.fillStyle = "rgb(214 160 40 / 0.8)";
          g.beginPath();
          trace(g, h);
          g.fill();
        }
      }
      g.restore();
      // The frame of the bay, in the Company's paint, and its corner lights.
      g.strokeStyle = `rgb(${paint})`;
      g.lineWidth = 2;
      g.beginPath();
      trace(g, project(v, rect(b.x0 - 0.1, b.z0 - 0.1, b.x1 + 0.1, b.z1 + 0.1)));
      g.stroke();
      const ready = o.doors > 0.98;
      for (const [x, z] of [[b.x0, b.z0], [b.x0, b.z1], [b.x1, b.z0], [b.x1, b.z1]] as const) dot(g, v, x, z, ready ? theme.primary : "255 90 60", 0.07, ready ? 1 : 0.5 + 0.5 * Math.sin(o.t * 12));
    }

    // Rows of small lights, and the flashing lights at the ends.
    for (const [a, b, n] of def.rows) {
      for (let i = 0; i < n; i++) {
        // A few are out, so no row is quite even.
        if ((i * 7919 + n) % 11 === 0) continue;
        const k = (i + 0.5) / n;
        dot(g, v, a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, i % 9 === 4 ? theme.primary : "255 214 150", 0.028, 0.85);
      }
    }
    for (const [i, p] of def.beacons.entries()) {
      const flash = Math.pow(Math.max(0, Math.sin(o.t * 4.4 + i * 1.9)), 12);
      dot(g, v, p[0], p[1], "255 255 255", 0.06 + 0.1 * flash, 0.35 + 0.65 * flash);
    }
  }

  /** One small light on the belly. */
  const lights = new Map<string, HTMLCanvasElement>();
  function dot(g: CanvasRenderingContext2D, v: ShipView, x: number, z: number, rgb: string, size: number, a: number): void {
    const c = v.cam(x, -0.02, z);
    if (c[2] < NEAR) return;
    const r = Math.max(1.6, (v.focal / c[2]) * size * 2.6);
    const px = v.cx + (v.focal * c[0]) / c[2];
    const py = v.cy + (v.focal * c[1]) / c[2];
    let tex = lights.get(rgb);
    if (!tex) lights.set(rgb, (tex = softSprite(rgb, 1, 48)));
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = Math.min(1, a);
    g.drawImage(tex, px - r, py - r, r * 2, r * 2);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  function shafts(g: CanvasRenderingContext2D, v: ShipView, o: HullDraw): void {
    const k = o.doors * o.lamps;
    if (k < 0.01) return;
    const warm = mixRgb("255 226 170", theme.secondary, 0.25);
    g.save();
    g.globalCompositeOperation = "lighter";
    for (const b of def.bays) {
      const zc = (b.z0 + b.z1) / 2;
      const half = ((b.z1 - b.z0) / 2) * o.doors;
      // The light falls out of the gap between the doors and spreads as it goes down.
      const top = project(v, rect(b.x0, zc - half, b.x1, zc + half));
      const low = project(v, rect(b.x0 - 1.2, zc - half - 1.6, b.x1 + 2.4, zc + half + 1.6, -7));
      if (top.length < 8 || low.length < 8) continue;
      const mx = (i: number, a: number[]) => (a[i]! + a[i + 2]! + a[i + 4]! + a[i + 6]!) / 4;
      const tx = mx(0, top);
      const ty = mx(1, top);
      const lx = mx(0, low);
      const ly = mx(1, low);
      const grd = g.createLinearGradient(tx, ty, lx, ly);
      grd.addColorStop(0, `rgb(${warm} / ${(0.085 * k).toFixed(3)})`);
      grd.addColorStop(0.35, `rgb(${warm} / ${(0.03 * k).toFixed(3)})`);
      grd.addColorStop(0.8, `rgb(${warm} / 0)`);
      g.fillStyle = grd;
      // Several shafts inside one another, so its sides are soft.
      for (const narrow of [1, 0.82, 0.64, 0.46, 0.28]) {
        const pts: [number, number][] = [];
        for (let i = 0; i < 8; i += 2) {
          pts.push([lx + (low[i]! - lx) * narrow, ly + (low[i + 1]! - ly) * narrow]);
          pts.push([tx + (top[i]! - tx) * narrow, ty + (top[i + 1]! - ty) * narrow]);
        }
        const out = outline(pts);
        g.beginPath();
        out.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.fill();
      }
      const c = v.cam((b.x0 + b.x1) / 2, 0, zc);
      if (c[2] > NEAR) {
        const s = (v.focal / c[2]) * (b.x1 - b.x0) * 0.75;
        g.globalAlpha = Math.min(1, 0.9 * k);
        g.drawImage(o.glow, v.cx + (v.focal * c[0]) / c[2] - s, v.cy + (v.focal * c[1]) / c[2] - s * 0.45, s * 2, s * 0.9);
        g.globalAlpha = 1;
      }
    }
    g.restore();
  }

  return { bays: def.bays, slots, draw, shafts };
}
