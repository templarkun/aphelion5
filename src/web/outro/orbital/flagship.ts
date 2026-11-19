/**
 * Orbital Claim: the Company's Flagship as a lit solid (designer 2026-11-19: "multi-layered capital
 * ship hull geometry (matching the player's chosen vessel palette/silhouette)"). Each Company's ship
 * follows its outline on the Vessel screen (VesselSchematic.tsx; the same outlines as the belly in
 * terraformer/hull.ts): V1 one broad, deep hull with short swept wings, V2 two long hulls joined by
 * struts round a hexagonal pod. A Company with no outline of its own gets V1's. Built of blocks by
 * the intro ship's builder and drawn by its renderer (briefing/styles/intro2/mesh.ts): plating seams,
 * armour plates, the Company's paint, rows of lit windows, a lit bridge, running lights. Under the
 * belly the docking clamps that lock on the beacon. Coloured by the Company's theme. A stand-in until
 * the designer's ship art. Looks only.
 *
 * The ship's own frame: x forward (bow), y up, z to starboard. About 18 units long.
 */

import { Builder, ngon, type Face, type Model, type Pt } from "../../briefing/styles/intro2/mesh.js";
import type { V3 } from "../../briefing/styles/intro2/math3.js";
import type { CompanyTheme } from "../types.js";

export interface Flagship {
  model: Model;
  /** The tether hub under the belly, where the clamps close on the beam. */
  hub: V3;
  /** The four clamp jaws' tips round it. */
  jaws: V3[];
  /** Small station-keeping thrusters: where, and the way each one fires. */
  rcs: { p: V3; dir: V3 }[];
  /** Half its length and beam, for framing. */
  half: V3;
}

const rgb = (s: string): V3 => {
  const [r, g, b] = s.split(" ").map(Number);
  return [(r ?? 0) / 255, (g ?? 0) / 255, (b ?? 0) / 255];
};
const scale = (c: V3, k: number): V3 => [c[0] * k, c[1] * k, c[2] * k];
const mixV = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

interface Station {
  x: number;
  /** Deck height and half-width, shoulder height, half-beam, bottom of the belt (below the middle), keel depth and half-width. */
  T: number;
  TW: number;
  S: number;
  W: number;
  B: number;
  K: number;
  KW: number;
}
/** A station from its half-beam and depths: the deck and keel narrower than the beam. */
const st = (x: number, W: number, T: number, K: number): Station => ({ x, T, TW: W * 0.62, S: T * 0.6, W, B: K * 0.42, K, KW: W * 0.5 });
const outline = (s: Station, zc: number): Pt[] => [
  [s.T, zc + s.TW],
  [s.S, zc + s.W],
  [-s.B, zc + s.W],
  [-s.K, zc + s.KW],
  [-s.K, zc - s.KW],
  [-s.B, zc - s.W],
  [s.S, zc - s.W],
  [s.T, zc - s.TW],
];
const SB_SHOULDER = 0;
const SB_BELT = 1;
const SB_LOWER = 2;
const KEEL = 3;
const PORT_LOWER = 4;
const PORT_BELT = 5;
const PORT_SHOULDER = 6;
const DECK = 7;

interface Palette {
  HULL: V3;
  HULL2: V3;
  DARK: V3;
  ARMOUR: V3;
  LIVERY: V3;
  ENGINE: V3;
  /** Running lights and the Company's lit marks: "r g b". */
  lamp: string;
  lit: V3;
  WARM: string;
  COOL: string;
}

function palette(theme: CompanyTheme): Palette {
  const hull = rgb(theme.hull);
  return {
    HULL: scale(hull, 1.32),
    HULL2: scale(hull, 1.02),
    DARK: scale(hull, 0.42),
    ARMOUR: mixV(scale(hull, 1.4), [0.78, 0.78, 0.78], 0.35),
    LIVERY: rgb(theme.livery),
    ENGINE: scale(hull, 0.55),
    lamp: theme.primary,
    lit: mixV(rgb(theme.primary), [1, 1, 1], 0.45),
    WARM: "255 214 150",
    COOL: "196 236 255",
  };
}

/** A run of hull sections along x round the line z = zc; returns the sides of each section. */
function hullRun(b: Builder, P: Palette, stations: Station[], zc: number, stern: V3): Face[][] {
  const out: Face[][] = [];
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i]!;
    const c = stations[i + 1]!;
    const l = b.loft(0, a.x, outline(a, zc), c.x, outline(c, zc), i === 0 ? P.HULL2 : P.HULL, { capA: i === 0 ? stern : false, capB: i === stations.length - 2 ? P.ARMOUR : false, k: 0.04 });
    out.push(l.sides);
  }
  return out;
}

/** Plating, the Company's stripe, window decks and a dark strake on a run of hull sections. */
function dress(b: Builder, P: Palette, hull: Face[][], windows: (i: number) => number): void {
  const last = hull.length - 1;
  hull.forEach((sides, i) => {
    const len = b.size(sides[SB_BELT]!)[0];
    const prow = i >= last - 1;
    for (const side of [SB_BELT, PORT_BELT]) {
      const f = sides[side];
      if (!f) continue;
      const tt = (t: number) => (side === PORT_BELT ? 1 - t : t);
      b.plating(f, 0.32, 0.62, prow ? 0 : 0.18);
      b.plate(f, 0, tt(0.05), 1, tt(0.13), 1, P.LIVERY);
      b.seam(f, 0, tt(0.13), 1, tt(0.13));
      b.plate(f, 0, tt(0.8), 1, tt(0.97), 0.66);
      b.seam(f, 0, tt(0.8), 1, tt(0.8));
      const n = windows(i);
      if (n > 0) {
        b.row(f, 0.04, tt(0.32), 0.96, tt(0.32), Math.round(len * n), i % 3 === 0 ? P.COOL : P.WARM, 0.022);
        if (i % 2 === 1) b.row(f, 0.12, tt(0.55), 0.88, tt(0.55), Math.round(len * n * 0.5), P.WARM, 0.02);
      }
    }
    for (const side of [SB_SHOULDER, PORT_SHOULDER]) b.plating(sides[side], 0.34, 0.55);
    b.plating(sides[DECK], 0.32, 0.62);
    for (const side of [SB_LOWER, PORT_LOWER]) b.plating(sides[side], 0.5, 0.35);
    b.plating(sides[KEEL], 0.45, 0.45);
  });
}

/** A main drive bell on the stern at (y, z), pointing aft. */
function bell(b: Builder, P: Palette, x: number, y: number, z: number, r: number, len: number): void {
  const l = b.loft(0, x, ngon(12, r * 0.72, y, z), x - len, ngon(12, r, y, z), P.ENGINE, { capA: false, k: 0.1 });
  if (l.capB) l.capB.mouth = r * 0.94;
  for (const f of l.sides) {
    b.seam(f, 0.3, 0, 0.3, 1);
    b.plate(f, 0.72, 0, 1, 1, 0.66);
  }
  b.nozzles.push({ p: [x - len, y, z * b.sz], r });
}

/** A stepped deckhouse with a lit bridge on top: base at y0 over x0..x1, half-width hw. */
function tower(b: Builder, P: Palette, x0: number, x1: number, y0: number, hw: number, zc = 0): number {
  const house = (a: number, c: number, ya: number, yb: number, w: number, col: V3) => {
    const bx = b.box(a, c, ya, yb, zc - w, zc + w, col);
    for (const f of [bx.sb, bx.port, bx.stern, bx.bow, bx.top]) b.plating(f, 0.24, 0.6);
    return bx;
  };
  const base = house(x0, x1, y0, y0 + 0.42, hw, P.HULL);
  for (const f of [base.sb, base.port, base.bow, base.stern]) {
    const [ls] = b.size(f);
    b.row(f, 0.06, 0.55, 0.94, 0.55, Math.max(2, Math.round(ls * 9)), P.WARM, 0.024);
  }
  b.plate(base.sb, 0.04, 0.12, 0.96, 0.22, 1, P.LIVERY);
  b.plate(base.port, 0.04, 0.12, 0.96, 0.22, 1, P.LIVERY);
  const dx = (x1 - x0) * 0.16;
  const mid = house(x0 + dx, x1 - dx * 0.6, y0 + 0.42, y0 + 0.78, hw * 0.72, P.HULL2);
  for (const f of [mid.sb, mid.port, mid.bow]) {
    const [ls] = b.size(f);
    b.row(f, 0.08, 0.5, 0.92, 0.5, Math.max(2, Math.round(ls * 9)), P.COOL, 0.024);
  }
  // The bridge: a band of lit windows all round under a smaller roof.
  const yb = y0 + 0.78;
  const bridge = b.box(x0 + dx * 1.3, x1 - dx * 0.2, yb, yb + 0.26, zc - hw * 0.9, zc + hw * 0.9, P.ARMOUR);
  for (const f of [bridge.sb, bridge.port, bridge.bow, bridge.stern]) {
    b.plate(f, 0.04, 0.22, 0.96, 0.72, 1, undefined, P.lit);
    for (let q = 1; q < 9; q++) b.seam(f, q / 9, 0.22, q / 9, 0.72);
  }
  const roof = b.box(x0 + dx * 1.6, x1 - dx * 0.6, yb + 0.26, yb + 0.34, zc - hw * 0.7, zc + hw * 0.7, P.HULL2);
  b.plating(roof.top, 0.2, 0.7);
  b.lamp(roof.top, 0.2, 0.5, "255 70 60", 0.05, 2.0, 0.5);
  // The mast: a lattice with yards and a dish.
  const mx = (x0 + x1) / 2 - dx;
  const top = yb + 0.34;
  b.wires(
    [
      [[mx, top, zc], [mx, top + 0.95, zc]],
      [[mx - 0.18, top, zc + 0.18], [mx, top + 0.5, zc]],
      [[mx - 0.18, top, zc - 0.18], [mx, top + 0.5, zc]],
      [[mx, top + 0.42, zc - 0.4], [mx, top + 0.42, zc + 0.4]],
      [[mx, top + 0.72, zc - 0.24], [mx, top + 0.72, zc + 0.24]],
    ],
    0.018,
    P.ARMOUR,
  );
  const radar = b.box(mx - 0.36, mx + 0.36, top + 0.95, top + 1.02, zc - 0.05, zc + 0.05, P.ARMOUR);
  radar.part.spin = { x: mx, z: zc, speed: 0.2 };
  return top + 1.02;
}

/** The clamp housing under the belly at x, below depth y0: a hub with four jaws (+-x, +-z). Returns the hub point and jaw tips. */
function clamps(b: Builder, P: Palette, x: number, y0: number): { hub: V3; jaws: V3[] } {
  const ring = b.loft(1, y0, ngon(8, 0.78, 0, x, 0.5), y0 - 0.32, ngon(8, 0.62, 0, x, 0.5), P.DARK, { capA: false, capB: P.DARK });
  for (const f of ring.sides) {
    if (!f?.quad) continue;
    b.seam(f, 0.5, 0, 0.5, 1);
    b.lamp(f, 0.5, 0.5, P.lamp, 0.032, 1.2, f.c[0] * 0.7 + f.c[2]);
  }
  if (ring.capB) b.plating(ring.capB, 0.2, 0.3);
  const yj = y0 - 0.32;
  const jaws: V3[] = [];
  for (const [ax, az] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const cx = x + ax * 0.46;
    const cz = az * 0.46;
    const w = 0.11;
    const jaw = b.box(cx - (az ? w : 0.16), cx + (az ? w : 0.16), yj - 0.42, yj, cz - (ax ? w : 0.16), cz + (ax ? w : 0.16), P.ARMOUR);
    b.plate(jaw.bottom, 0.1, 0.1, 0.9, 0.9, 1, undefined, P.lit);
    b.stripes(ax ? jaw.sb : jaw.bow, 0, 0.1, 1, 0.3, 5, P.LIVERY);
    jaws.push([cx, yj - 0.42, cz]);
  }
  return { hub: [x, yj - 0.35, 0], jaws };
}

/** V1: one broad, deep hull, short swept wings, a long bay along the spine. */
function buildV1(P: Palette): Flagship {
  const b = new Builder();
  const stations = [st(-8.0, 0.95, 0.72, 0.9), st(-5.4, 2.1, 0.92, 1.18), st(-2.0, 2.27, 0.98, 1.26), st(0.6, 2.42, 1.0, 1.3), st(2.6, 2.5, 0.96, 1.26), st(4.6, 1.78, 0.82, 1.05), st(6.6, 1.0, 0.6, 0.72), st(8.1, 0.14, 0.16, 0.2)];
  const hull = hullRun(b, P, stations, 0, P.DARK);
  dress(b, P, hull, (i) => (i >= 1 && i <= 4 ? 9 : 0));
  // The bow: the Company's colour on its flanks; the bay doors under the belly.
  for (const side of [SB_BELT, PORT_BELT]) b.plate(hull[5]![side]!, 0.4, 0.14, 1, 0.5, 1, P.LIVERY);
  for (const i of [2, 3]) {
    const k = hull[i]![KEEL]!;
    b.plate(k, 0.06, 0.12, 0.94, 0.88, 0.62);
    b.seam(k, 0.06, 0.5, 0.94, 0.5);
    for (let q = 1; q < 6; q++) b.seam(k, 0.06 + (0.88 * q) / 6, 0.12, 0.06 + (0.88 * q) / 6, 0.88);
  }
  // The spine: a raised dorsal block along the middle, with radiator grilles and the Company's stripe.
  const spine = b.box(-6.2, 3.6, 0.98, 1.24, -0.62, 0.62, P.HULL2);
  b.plating(spine.top, 0.3, 0.5);
  b.plate(spine.top, 0.04, 0.44, 0.96, 0.56, 1, P.LIVERY);
  for (const f of [spine.sb, spine.port]) {
    b.plating(f, 0.3, 0.4);
    b.row(f, 0.5, 0.5, 0.97, 0.5, 26, P.COOL, 0.02);
  }
  const mastTop = tower(b, P, -5.8, -3.6, 1.24, 0.72);
  // Small gear on the spine and the fore deck.
  for (const [x0, x1, y0, h, z] of [
    [-2.6, -2.2, 1.24, 0.16, 0.3],
    [-1.6, -1.0, 1.24, 0.1, -0.25],
    [0.4, 1.1, 1.24, 0.22, 0],
    [4.2, 4.6, 0.82, 0.14, 0.4],
    [4.0, 4.5, 0.82, 0.1, -0.5],
  ] as const) {
    const bx = b.box(x0, x1, y0, y0 + h, z - 0.18, z + 0.18, P.ARMOUR);
    b.plating(bx.top, 0.12, 0.5);
  }
  // The wings: short and swept, low on the flanks, a lamp at each tip (green to starboard, red to port).
  b.both(() => {
    const wing = b.loft(
      2,
      2.52,
      [
        [-3.9, -0.24],
        [0.6, -0.24],
        [0.6, -0.04],
        [-3.9, -0.04],
      ],
      4.0,
      [
        [-4.9, -0.2],
        [-0.4, -0.2],
        [-0.4, -0.08],
        [-4.9, -0.08],
      ],
      P.HULL,
    );
    for (const f of wing.sides) {
      if (!f?.quad) continue;
      b.plating(f, 0.3, 0.5);
      b.plate(f, 0.86, 0, 1, 1, 1, P.LIVERY);
    }
    if (wing.sides[1]) b.lamp(wing.sides[1], 0.97, 0.5, b.sz > 0 ? "90 255 150" : "255 80 70", 0.06);
    // A small drive pod under each wing.
    const pod = b.loft(0, -3.2, ngon(8, 0.2, -0.48, 3.3), -1.2, ngon(8, 0.22, -0.48, 3.3), P.HULL2, { capA: P.DARK, capB: P.ARMOUR });
    for (const f of pod.sides) {
      if (!f?.quad) continue;
      b.seam(f, 0.5, 0, 0.5, 1);
    }
  });
  // The engine block on the stern and its drives.
  const block = b.box(-8.9, -8.0, -0.66, 0.66, -0.82, 0.82, P.HULL2);
  for (const f of [block.sb, block.port, block.top]) {
    b.plating(f, 0.22, 0.5);
    b.stripes(f, 0.05, 0.1, 0.95, 0.24, 9, P.LIVERY);
  }
  b.lamp(block.top, 0.5, 0.5, "255 190 90", 0.04, 2.4, 0.3);
  b.both(() => bell(b, P, -8.9, -0.1, 0.42, 0.36, 0.56));
  bell(b, P, -8.9, 0.42, 0, 0.22, 0.38);
  // The bow's sensor spars.
  b.wires(
    [
      [[8.0, 0.0, 0], [9.2, 0.0, 0]],
      [[7.2, 0.4, 0.2], [8.6, 0.45, 0.3]],
      [[7.2, 0.4, -0.2], [8.6, 0.45, -0.3]],
    ],
    0.016,
    P.ARMOUR,
  );
  const cl = clamps(b, P, 0.8, -1.3);
  const model = b.done();
  return {
    model,
    ...cl,
    rcs: [
      { p: [7.4, 0.3, 0.9], dir: [0, 0, 1] },
      { p: [7.4, 0.3, -0.9], dir: [0, 0, -1] },
      { p: [-7.6, 0.75, 0.6], dir: [0, 1, 0] },
      { p: [-7.6, -0.9, -0.6], dir: [0, -1, 0] },
      { p: [-4.6, -0.12, 4.0], dir: [0, 0, 1] },
      { p: [-4.6, -0.12, -4.0], dir: [0, 0, -1] },
      { p: [5.6, -0.9, 0], dir: [1, -0.4, 0] },
    ],
    half: [9.5, Math.max(2.6, mastTop), 4.0],
  };
}

/** V2: two long hulls joined by struts round a hexagonal pod; the bridge on the pod, the clamps under it. */
function buildV2(P: Palette): Flagship {
  const b = new Builder();
  const zc = 2.25;
  const stations = [st(-7.6, 0.55, 0.62, 0.66), st(-4.5, 1.15, 0.78, 0.84), st(0, 1.08, 0.8, 0.86), st(5.0, 0.96, 0.74, 0.8), st(7.0, 0.52, 0.5, 0.52), st(8.3, 0.08, 0.12, 0.14)];
  b.both(() => {
    const hull = hullRun(b, P, stations, zc, P.DARK);
    dress(b, P, hull, (i) => (i >= 1 && i <= 3 ? 10 : 0));
    for (const side of [SB_BELT, PORT_BELT]) b.plate(hull[3]![side]!, 0.5, 0.14, 1, 0.5, 1, P.LIVERY);
    // A dorsal ridge along each hull, lit along its flanks.
    const ridge = b.box(-6.4, 4.6, 0.8, 1.02, zc - 0.42, zc + 0.42, P.HULL2);
    b.plating(ridge.top, 0.28, 0.5);
    b.plate(ridge.top, 0.04, 0.42, 0.96, 0.58, 1, P.LIVERY);
    for (const f of [ridge.sb, ridge.port]) b.row(f, 0.04, 0.5, 0.96, 0.5, 30, P.COOL, 0.02);
    // The stern block and its drives.
    const block = b.box(-8.5, -7.6, -0.5, 0.5, zc - 0.5, zc + 0.5, P.HULL2);
    for (const f of [block.sb, block.port, block.top]) {
      b.plating(f, 0.2, 0.5);
      b.stripes(f, 0.05, 0.1, 0.95, 0.26, 7, P.LIVERY);
    }
    b.lamp(block.top, 0.5, 0.5, "255 190 90", 0.04, 2.4, b.sz > 0 ? 0.3 : 1.5);
    bell(b, P, -8.5, 0, zc, 0.38, 0.55);
    // Fins above the sterns, a lamp on each.
    const fin = b.loft(
      1,
      1.02,
      [
        [zc - 0.05, -7.4],
        [zc + 0.05, -7.4],
        [zc + 0.05, -5.6],
        [zc - 0.05, -5.6],
      ],
      1.9,
      [
        [zc - 0.04, -7.5],
        [zc + 0.04, -7.5],
        [zc + 0.04, -6.7],
        [zc - 0.04, -6.7],
      ],
      P.HULL,
    );
    for (const f of fin.sides) {
      if (!f?.quad) continue;
      b.plating(f, 0.22, 0.45);
      b.plate(f, 0.8, 0, 1, 1, 1, P.LIVERY);
    }
    if (fin.sides[0]) b.lamp(fin.sides[0], 0.96, 0.5, b.sz > 0 ? "90 255 150" : "255 80 70", 0.05);
  });
  // The struts between the hulls.
  for (const x of [-2.5, 2.5]) {
    const s = b.box(x - 0.26, x + 0.26, -0.28, 0.34, -1.12, 1.12, P.HULL2);
    for (const f of [s.top, s.bow, s.stern]) b.plating(f, 0.22, 0.5);
    b.row(s.bow, 0.5, 0.08, 0.5, 0.92, 9, P.WARM, 0.022);
    b.row(s.stern, 0.5, 0.08, 0.5, 0.92, 9, P.WARM, 0.022);
  }
  // The pod: a hexagonal block between the hulls; the bridge dome on top.
  const hexZX = (r: number): Pt[] => ngon(6, r, 0, 0, 0).map(([u, v]) => [v * 1.15, u * 1.2] as Pt);
  const pod = b.loft(1, -0.62, hexZX(1.0), 0.6, hexZX(1.0), P.HULL, { capA: P.DARK, capB: P.HULL2 });
  for (const f of pod.sides) {
    if (!f?.quad) continue;
    b.plating(f, 0.24, 0.55);
    b.row(f, 0.62, 0.08, 0.62, 0.92, 7, P.WARM, 0.024);
    b.plate(f, 0.18, 0, 0.26, 1, 1, P.LIVERY);
  }
  if (pod.capB) b.plating(pod.capB, 0.24, 0.5);
  const dome = b.loft(1, 0.6, hexZX(0.7), 0.92, hexZX(0.56), P.ARMOUR, { capA: false, capB: P.HULL2 });
  for (const f of dome.sides) {
    if (!f?.quad) continue;
    b.plate(f, 0.2, 0.06, 0.8, 0.94, 1, undefined, P.lit);
    for (let q = 1; q < 5; q++) b.seam(f, 0.2, q / 5, 0.8, q / 5);
  }
  const mastTop = 0.92;
  if (dome.sides[0]) b.lamp(dome.sides[0], 0.95, 0.5, "255 70 60", 0.05, 2.0, 0.5);
  b.wires(
    [
      [[0, 0.92, 0], [0, 1.9, 0]],
      [[0, 1.4, -0.36], [0, 1.4, 0.36]],
      [[0, 1.7, -0.22], [0, 1.7, 0.22]],
    ],
    0.018,
    P.ARMOUR,
  );
  const cl = clamps(b, P, 0, -0.62);
  const model = b.done();
  return {
    model,
    ...cl,
    rcs: [
      { p: [7.0, 0.3, 2.25 + 0.6], dir: [0, 0, 1] },
      { p: [7.0, 0.3, -2.25 - 0.6], dir: [0, 0, -1] },
      { p: [-7.2, 0.7, 2.25], dir: [0, 1, 0] },
      { p: [-7.2, -0.7, -2.25], dir: [0, -1, 0] },
      { p: [4.6, -0.8, 2.25], dir: [1, -0.3, 0] },
      { p: [4.6, -0.8, -2.25], dir: [1, -0.3, 0] },
    ],
    half: [9.2, Math.max(2.0, mastTop + 1), 3.6],
  };
}

const cache = new Map<string, Flagship>();
/** The Company's Flagship (built once per Company and theme). */
export function flagshipFor(vesselId: string, theme: CompanyTheme): Flagship {
  const key = `${vesselId}|${theme.hull}|${theme.livery}|${theme.primary}`;
  let f = cache.get(key);
  if (!f) {
    const P = palette(theme);
    f = vesselId === "V2" ? buildV2(P) : buildV1(P);
    cache.set(key, f);
  }
  return f;
}
