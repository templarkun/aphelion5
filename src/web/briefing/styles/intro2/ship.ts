/**
 * Style "intro2": the Company's capital ship, as blocks (see mesh.ts). A long armoured hull with
 * a chisel prow; a broad engine block with four main drives and two outboard drive pods on
 * pylons; tall radiator fins; a stepped citadel with a funnel, the command tower and its bridge;
 * a communications dish, a flat sensor array, turrets; hangar sponsons on both flanks.
 * A stand-in until the designer's own ship art: nothing here is game data.
 *
 * x forward (stern at -8.5, bow at +8.5), y up, z to starboard.
 */

import { Builder, type Face, type Model, ngon, type Pt } from "./mesh.js";
import type { V3 } from "./math3.js";

const HULL: V3 = [0.52, 0.535, 0.56];
const HULL2: V3 = [0.4, 0.415, 0.445];
const DARK: V3 = [0.2, 0.21, 0.24];
const ARMOUR: V3 = [0.66, 0.665, 0.67];
const BONE: V3 = [0.74, 0.73, 0.7];
const ENGINE: V3 = [0.25, 0.25, 0.275];
/** The Company's colour on the hull. */
const LIVERY: V3 = [0.8, 0.41, 0.11];
const WARM = "255 214 150";
const COOL = "190 235 255";

/** The ship's ends, for the camera to fit it in the picture. */
export const SHIP_BOUNDS = { x0: -9.0, x1: 8.6, y0: -1.0, y1: 3.8, z: 3.5 };

interface Station {
  x: number;
  /** Top deck: height and half-width. */
  T: number;
  TW: number;
  /** Shoulder height, half-beam, bottom of the belt (below the middle), keel depth and half-width. */
  S: number;
  W: number;
  B: number;
  K: number;
  KW: number;
}
const st = (x: number, T: number, TW: number, S: number, W: number, B: number, K: number, KW: number): Station => ({ x, T, TW, S, W, B, K, KW });
const outline = (s: Station): Pt[] => [
  [s.T, s.TW],
  [s.S, s.W],
  [-s.B, s.W],
  [-s.K, s.KW],
  [-s.K, -s.KW],
  [-s.B, -s.W],
  [s.S, -s.W],
  [s.T, -s.TW],
];
/** The sides of a hull section, by name. */
const SB_SHOULDER = 0;
const SB_BELT = 1;
const SB_LOWER = 2;
const KEEL = 3;
const PORT_LOWER = 4;
const PORT_BELT = 5;
const PORT_SHOULDER = 6;
const DECK = 7;

/** A rectangle outline for a block built upwards: z from z0 to z1, x from x0 to x1. */
const rectZX = (z0: number, z1: number, x0: number, x1: number): Pt[] => [
  [z0, x0],
  [z1, x0],
  [z1, x1],
  [z0, x1],
];

let cached: Model | undefined;

export function buildShip(): Model {
  if (cached) return cached;
  const b = new Builder();
  const R = b.R;

  /* ---- Hull: sections from stern to bow. ---- */
  const BLOCK = st(-8.2, 0.92, 1.05, 0.58, 1.55, 0.62, 1.02, 0.95);
  const WAIST = st(-5.9, 0.62, 0.8, 0.36, 1.18, 0.5, 0.8, 0.62);
  const MID = st(-1.2, 0.66, 0.86, 0.38, 1.26, 0.52, 0.84, 0.66);
  const stations: Station[] = [
    st(-8.5, 0.78, 0.95, 0.5, 1.42, 0.55, 0.92, 0.85),
    BLOCK,
    { ...BLOCK, x: -6.5 },
    WAIST,
    { ...WAIST, x: -4.5 },
    { ...WAIST, x: -3.1 },
    { ...WAIST, x: -1.7 },
    MID,
    { ...MID, x: 0.2 },
    { ...MID, x: 1.6 },
    { ...MID, x: 3.0 },
    st(3.5, 0.58, 0.74, 0.32, 1.1, 0.46, 0.74, 0.56),
    st(5.0, 0.54, 0.66, 0.29, 1.0, 0.43, 0.68, 0.5),
    st(6.4, 0.46, 0.52, 0.24, 0.8, 0.37, 0.58, 0.38),
    st(7.7, 0.28, 0.26, 0.13, 0.42, 0.28, 0.42, 0.18),
    st(8.5, 0.12, 0.07, 0.04, 0.12, 0.14, 0.22, 0.05),
  ];
  const last = stations.length - 2;
  const hull: Face[][] = [];
  for (let i = 0; i <= last; i++) {
    const a = stations[i]!;
    const c = stations[i + 1]!;
    const l = b.loft(0, a.x, outline(a), c.x, outline(c), i < 3 ? HULL2 : HULL, { capA: i === 0 ? [0.12, 0.13, 0.16] : false, capB: i === last ? ARMOUR : false, k: 0.04 });
    hull.push(l.sides);
  }
  hull.forEach((sides, i) => {
    const engine = i < 3;
    const prow = i >= last - 1;
    const len = stations[i + 1]!.x - stations[i]!.x;
    for (const side of [SB_BELT, PORT_BELT]) {
      const f = sides[side]!;
      // The port belt is laid out bottom to top: turn its heights over.
      const tt = (t: number) => (side === PORT_BELT ? 1 - t : t);
      b.plating(f, engine ? 0.4 : 0.3, 0.62, engine || prow ? 0 : 0.2);
      if (!engine && !prow) {
        // The Company's stripe along the top of the belt, a dark strake low down, a deck of windows between.
        b.plate(f, 0, tt(0.05), 1, tt(0.12), 1, LIVERY);
        b.plate(f, 0, tt(0.8), 1, tt(0.97), 0.68);
        b.seam(f, 0, tt(0.8), 1, tt(0.8));
        b.seam(f, 0, tt(0.12), 1, tt(0.12));
        if (i >= 3 && i <= 11) {
          b.row(f, 0.04, tt(0.3), 0.96, tt(0.3), Math.round(len * 10), i % 3 === 0 ? COOL : WARM, 0.022);
          if (i % 2 === 0) b.row(f, 0.2, tt(0.52), 0.8, tt(0.52), Math.round(len * 5), WARM, 0.02);
        }
      }
    }
    for (const side of [SB_SHOULDER, PORT_SHOULDER]) b.plating(sides[side], engine ? 0.46 : 0.34, 0.55);
    b.plating(sides[DECK], engine ? 0.46 : 0.32, 0.62);
    for (const side of [SB_LOWER, PORT_LOWER, KEEL]) b.plating(sides[side], 0.6, 0.3);
  });
  // The engine block: radiator grilles on its deck, warning bands and louvres on its flanks.
  {
    const deck = hull[1]![DECK]!;
    for (const [t0, t1] of [
      [0.06, 0.44],
      [0.56, 0.94],
    ] as const) {
      b.plate(deck, 0.08, t0, 0.92, t1, 0.42);
      for (let q = 1; q < 22; q++) b.seam(deck, 0.08 + (0.84 * q) / 22, t0, 0.08 + (0.84 * q) / 22, t1);
      b.seam(deck, 0.08, t0, 0.92, t0);
      b.seam(deck, 0.08, t1, 0.92, t1);
    }
    for (const side of [SB_BELT, PORT_BELT]) {
      const f = hull[1]![side]!;
      const tt = (t: number) => (side === PORT_BELT ? 1 - t : t);
      b.plate(f, 0.03, tt(0.08), 0.22, tt(0.3), 1, [0.1, 0.1, 0.12]);
      b.stripes(f, 0.03, tt(0.08), 0.22, tt(0.3), 9, LIVERY);
      b.panel(f, 0.32, tt(0.2), 0.94, tt(0.72), 0.6);
      for (let q = 1; q < 9; q++) b.seam(f, 0.32, tt(0.2 + (0.52 * q) / 9), 0.94, tt(0.2 + (0.52 * q) / 9));
      b.lamp(f, 0.015, 0.5, "255 190 90", 0.035, 2.4, side === SB_BELT ? 0 : 1.2);
    }
    for (const side of [SB_SHOULDER, PORT_SHOULDER]) b.plate(hull[1]![side]!, 0.02, 0.22, 0.98, 0.34, 1, LIVERY);
  }
  // The prow: the Company's colour on its flanks.
  for (const side of [SB_BELT, PORT_BELT]) {
    b.plate(hull[last - 2]![side]!, 0.55, 0.14, 1, 0.5, 1, LIVERY);
    b.plate(hull[last - 1]![side]!, 0, 0.14, 0.9, 0.5, 1, LIVERY);
  }

  /* ---- Main drives: two great bells low on the stern, two smaller between them. ---- */
  const bell = (y: number, z: number, r: number, len: number) => {
    const l = b.loft(0, -8.5, ngon(12, r * 0.72, y, z), -8.5 - len, ngon(12, r, y, z), ENGINE, { capA: false, k: 0.1 });
    if (l.capB) l.capB.mouth = r * 0.94;
    for (const f of l.sides) {
      b.seam(f, 0.3, 0, 0.3, 1);
      b.seam(f, 0.72, 0, 0.72, 1);
      b.plate(f, 0.72, 0, 1, 1, 0.66);
    }
    b.nozzles.push({ p: [-8.5 - len, y, z * b.sz], r });
  };
  b.both(() => bell(-0.2, 0.74, 0.55, 0.62));
  bell(0.4, 0, 0.3, 0.44);
  bell(-0.66, 0, 0.19, 0.3);

  /* ---- Outboard drive pods on pylons, each with a fin above and a wing outboard. ---- */
  b.both(() => {
    const y = -0.12;
    const z = 2.25;
    const body = b.loft(0, -8.4, ngon(8, 0.38, y, z), -5.7, ngon(8, 0.42, y, z), HULL2, { capA: DARK, capB: false });
    body.sides.forEach((f, i) => {
      b.plating(f, 0.34, 0.55);
      if (i === 1 || i === 2) b.plate(f, 0.62, 0.1, 0.96, 0.9, 1, LIVERY);
      if (i === 0) b.row(f, 0.1, 0.5, 0.55, 0.5, 8, COOL, 0.02);
    });
    const nose = b.loft(0, -5.7, ngon(8, 0.42, y, z), -4.75, ngon(8, 0.12, y, z), ARMOUR, { capA: false });
    nose.sides.forEach((f) => {
      b.seam(f, 0.35, 0, 0.35, 1);
      b.seam(f, 0.7, 0, 0.7, 1);
    });
    const noz = b.loft(0, -8.4, ngon(10, 0.25, y, z), -8.84, ngon(10, 0.35, y, z), ENGINE, { capA: false, k: 0.1 });
    if (noz.capB) noz.capB.mouth = 0.33;
    for (const f of noz.sides) b.seam(f, 0.55, 0, 0.55, 1);
    b.nozzles.push({ p: [-8.84, y, z * b.sz], r: 0.35 });
    const pylon = b.box(-7.9, -6.3, -0.3, 0.06, 1.55, 1.87, HULL);
    b.plating(pylon.top, 0.3, 0.6);
    b.plating(pylon.stern, 0.2, 0.4);
    // The fin above the pod.
    const fin = b.loft(1, 0.28, rectZX(2.2, 2.3, -8.3, -6.1), 1.2, rectZX(2.22, 2.28, -8.2, -7.35), HULL);
    for (const f of fin.sides) {
      if (!f?.quad) continue;
      b.plating(f, 0.26, 0.5);
      b.plate(f, 0.8, 0, 1, 1, 1, LIVERY);
    }
    // The wing outboard, a lamp at its tip: green to starboard, red to port.
    const wing = b.loft(
      2,
      2.64,
      [
        [-8.25, -0.17],
        [-5.85, -0.17],
        [-5.85, -0.07],
        [-8.25, -0.07],
      ],
      3.5,
      [
        [-8.05, -0.15],
        [-7.15, -0.15],
        [-7.15, -0.09],
        [-8.05, -0.09],
      ],
      HULL,
    );
    for (const f of wing.sides) {
      if (!f?.quad) continue;
      b.plating(f, 0.28, 0.5);
      b.plate(f, 0.84, 0, 1, 1, 1, LIVERY);
    }
    if (wing.sides[2]) b.lamp(wing.sides[2], 0.97, 0.5, b.sz > 0 ? "90 255 150" : "255 80 70", 0.05);
  });

  /* ---- Radiator fins on the engine block. ---- */
  b.both(() => {
    const fin = b.loft(1, 0.92, rectZX(0.88, 0.99, -8.12, -6.55), 1.9, rectZX(0.9, 0.97, -8.04, -7.3), HULL2);
    for (const f of fin.sides) {
      if (!f?.quad) continue;
      b.plating(f, 0.24, 0.45);
      b.plate(f, 0.82, 0, 1, 1, 1, LIVERY);
    }
    if (fin.sides[1]) b.lamp(fin.sides[1], 0.98, 0.5, "255 255 255", 0.045, 1.6, b.sz > 0 ? 0.2 : 1.0);
  });

  /* ---- The citadel: stepped deckhouses, a funnel, the command tower. ---- */
  const windowsRound = (bx: { sb: Face; port: Face; stern: Face; bow: Face }, t: number, per: number, col = WARM) => {
    for (const f of [bx.sb, bx.port, bx.stern, bx.bow]) {
      const [ls] = b.size(f);
      b.row(f, 0.06, t, 0.94, t, Math.max(2, Math.round(ls * per)), col, 0.024);
    }
  };
  const house = (x0: number, x1: number, y0: number, y1: number, hw: number, col: V3, cell = 0.26) => {
    const bx = b.box(x0, x1, y0, y1, -hw, hw, col);
    for (const f of [bx.sb, bx.port, bx.stern, bx.top]) b.plating(f, cell, 0.6);
    return bx;
  };
  const aft = house(-5.6, -2.3, 0.62, 1.0, 0.64, HULL);
  windowsRound(aft, 0.55, 9);
  // A lit door in its after end.
  b.plate(aft.stern, 0.36, 0.1, 0.64, 0.6, 1, [0.08, 0.09, 0.1]);
  b.plate(aft.stern, 0.38, 0.42, 0.62, 0.56, 1, undefined, [1.0, 0.82, 0.5]);
  const second = house(-5.25, -2.85, 1.0, 1.3, 0.5, HULL2);
  windowsRound(second, 0.5, 9, COOL);
  b.plate(second.sb, 0.05, 0.1, 0.95, 0.2, 1, LIVERY);
  b.plate(second.port, 0.05, 0.1, 0.95, 0.2, 1, LIVERY);
  // The funnel abaft the tower: a dark stack with a glowing throat.
  const funnel = b.loft(1, 1.3, rectZX(-0.26, 0.26, -5.18, -4.86), 1.95, rectZX(-0.2, 0.2, -5.14, -4.9), DARK);
  for (const f of funnel.sides) {
    if (!f?.quad) continue;
    for (let q = 1; q < 5; q++) b.seam(f, q / 5, 0, q / 5, 1);
  }
  if (funnel.capB) funnel.capB.emis = [0.5, 0.2, 0.08];
  // The tower.
  const base = house(-4.72, -3.4, 1.3, 1.82, 0.42, HULL, 0.22);
  windowsRound(base, 0.32, 10);
  windowsRound(base, 0.68, 10, COOL);
  const neck = b.loft(1, 1.82, rectZX(-0.32, 0.32, -4.55, -3.6), 2.26, rectZX(-0.28, 0.28, -4.5, -3.7), HULL2);
  for (const f of neck.sides) {
    if (!f?.quad) continue;
    b.plating(f, 0.2, 0.5);
    b.row(f, 0.5, 0.15, 0.5, 0.85, 4, WARM, 0.026);
  }
  // The bridge: it flares out over the neck, a band of windows all round, a smaller roof.
  const flare = b.loft(1, 2.26, rectZX(-0.28, 0.28, -4.5, -3.7), 2.46, rectZX(-0.62, 0.62, -4.7, -3.38), HULL, { capA: false });
  for (const f of flare.sides) if (f?.quad) b.seam(f, 0.5, 0, 0.5, 1);
  const bridge = b.loft(1, 2.46, rectZX(-0.62, 0.62, -4.7, -3.38), 2.7, rectZX(-0.56, 0.56, -4.66, -3.52), ARMOUR, { capA: false });
  for (const f of bridge.sides) {
    if (!f?.quad) continue;
    b.plate(f, 0.22, 0.05, 0.74, 0.95, 1, undefined, [0.72, 0.94, 1.0]);
    for (let q = 1; q < 8; q++) b.seam(f, 0.22, q / 8, 0.74, q / 8);
    b.seam(f, 0.22, 0.05, 0.22, 0.95);
    b.seam(f, 0.74, 0.05, 0.74, 0.95);
  }
  const roof = b.box(-4.56, -3.68, 2.7, 2.8, -0.44, 0.44, HULL2);
  b.plating(roof.top, 0.2, 0.7);
  b.lamp(roof.top, 0.1, 0.1, "255 70 60", 0.045, 2.0, 0.5);
  // Flying bridges on both sides.
  b.both(() => {
    const w = b.box(-4.3, -3.84, 2.46, 2.56, 0.62, 0.98, HULL);
    b.plating(w.top, 0.2, 0.4);
    b.row(w.sb, 0.1, 0.5, 0.9, 0.5, 3, COOL, 0.026);
  });
  // The mast: a lattice with yards, whip aerials, and a radar bar that turns.
  const mx = -4.14;
  b.wires(
    [
      [[mx, 2.8, 0], [mx, 3.78, 0]],
      [[mx - 0.2, 2.8, 0.2], [mx, 3.36, 0]],
      [[mx - 0.2, 2.8, -0.2], [mx, 3.36, 0]],
      [[mx + 0.2, 2.8, 0], [mx, 3.36, 0]],
    ],
    0.022,
    BONE,
  );
  b.wires(
    [
      [[mx, 3.12, -0.42], [mx, 3.12, 0.42]],
      [[mx, 3.48, -0.26], [mx, 3.48, 0.26]],
      [[mx, 3.12, 0.42], [mx, 3.3, 0.42]],
      [[mx, 3.12, -0.42], [mx, 3.3, -0.42]],
      [[-3.82, 2.8, 0.34], [-3.74, 3.55, 0.38]],
      [[-3.82, 2.8, -0.34], [-3.74, 3.4, -0.38]],
      [[-4.46, 2.8, 0.3], [-4.52, 3.26, 0.32]],
    ],
    0.012,
    BONE,
  );
  const radar = b.box(mx - 0.38, mx + 0.38, 3.78, 3.86, -0.05, 0.05, ARMOUR);
  radar.part.spin = { x: mx, z: 0, speed: 0.22 };
  // Small gear on the citadel's roofs.
  for (const [x, z, s, h] of [
    [-2.62, 0.3, 0.12, 0.14],
    [-2.55, -0.28, 0.1, 0.2],
    [-3.1, 0.2, 0.09, 0.12],
    [-5.42, 0.3, 0.1, 0.16],
    [-5.44, -0.32, 0.12, 0.1],
  ] as const) {
    const y0 = x > -2.85 || x < -5.25 ? 1.0 : 1.3;
    b.box(x - s, x + s, y0, y0 + h, z - s, z + s, R() < 0.5 ? HULL2 : ARMOUR);
  }
  b.wires(
    [
      [[-2.45, 1.0, 0.5], [-2.4, 1.75, 0.52]],
      [[-2.45, 1.0, -0.5], [-2.4, 1.6, -0.52]],
      [[-5.5, 1.0, 0.5], [-5.56, 1.7, 0.5]],
    ],
    0.012,
    BONE,
  );
  // Forward of the citadel: two steps down to the deck.
  const fwd = house(-1.2, 0.9, 0.66, 0.94, 0.52, HULL);
  windowsRound(fwd, 0.55, 9);
  const fwd2 = house(-1.0, 0.2, 0.94, 1.16, 0.36, HULL2);
  windowsRound(fwd2, 0.5, 10, COOL);
  // Conduits along both edges of the deck, and tanks on it.
  b.both(() => {
    const pipe = b.box(-1.15, 2.95, 0.66, 0.73, 0.6, 0.7, HULL2);
    for (let q = 1; q < 20; q++) b.seam(pipe.top, q / 20, 0, q / 20, 1);
    const pipe2 = b.box(-5.85, -1.75, 0.62, 0.69, 0.68, 0.76, HULL2);
    for (let q = 1; q < 18; q++) b.seam(pipe2.top, q / 18, 0, q / 18, 1);
    const tank = b.loft(0, 1.95, ngon(6, 0.11, 0.78, 0.37), 2.5, ngon(6, 0.11, 0.78, 0.37), BONE);
    tank.sides.forEach((f) => f?.quad && b.seam(f, 0.5, 0, 0.5, 1));
  });

  /* ---- Communications: a dish on a pedestal, tilted back; a flat sensor array further forward. ---- */
  {
    const ped = b.box(1.3, 1.62, 0.66, 1.22, -0.16, 0.16, HULL2);
    b.plating(ped.sb, 0.16, 0.5);
    b.plating(ped.stern, 0.16, 0.5);
    const tilt = -0.72; // leaning back, towards the stern
    const side = 0.3;
    const o: V3 = [1.46, 1.42, 0];
    b.tf = (p) => {
      // Lean about z (back), then about x (a little to starboard).
      const x1 = p[0] * Math.cos(tilt) + p[1] * Math.sin(tilt);
      const y1 = -p[0] * Math.sin(tilt) + p[1] * Math.cos(tilt);
      const y2 = y1 * Math.cos(side) - p[2] * Math.sin(side);
      const z2 = y1 * Math.sin(side) + p[2] * Math.cos(side);
      return [x1 + o[0], y2 + o[1], z2 + o[2]];
    };
    const dish = b.loft(1, 0.02, ngon(16, 0.1), 0.26, ngon(16, 0.62), BONE, { capA: DARK, capB: [0.5, 0.52, 0.56], k: 0.08 });
    // The inside of the bowl: darker rings towards the middle; the feed stands over it on three legs.
    if (dish.capB)
      for (const [r, tint] of [
        [0.5, 0.88],
        [0.34, 0.76],
        [0.14, 0.5],
      ] as const)
        dish.capB.plates.push({ vi: ngon(16, r).map(([z, x]) => b.v(x, 0.26, z)), tint });
    b.wires(
      [
        [[0.5, 0.27, 0], [0, 0.74, 0]],
        [[-0.25, 0.27, 0.43], [0, 0.74, 0]],
        [[-0.25, 0.27, -0.43], [0, 0.74, 0]],
      ],
      0.014,
      BONE,
    );
    b.tf = undefined;
    const array = b.box(4.3, 4.37, 0.58, 1.5, -0.5, 0.5, HULL2);
    b.plating(array.stern, 0.13, 0.2);
    for (let q = 1; q < 8; q++) b.seam(array.stern, 0, q / 8, 1, q / 8);
    b.plate(array.stern, 0.1, 0.82, 0.9, 0.9, 1, LIVERY);
    b.lamp(array.stern, 0.5, 0.97, "255 255 255", 0.04, 1.6, 0.8);
    b.wires(
      [
        [[4.34, 0.56, 0.3], [3.95, 0.56, 0.3]],
        [[4.34, 1.1, 0.3], [3.95, 0.57, 0.3]],
        [[4.34, 0.56, -0.3], [3.95, 0.56, -0.3]],
        [[4.34, 1.1, -0.3], [3.95, 0.57, -0.3]],
      ],
      0.016,
      HULL,
    );
  }

  /* ---- Turrets on the fore deck. ---- */
  for (const [x, y] of [
    [2.85, 0.66],
    [5.6, 0.5],
  ] as const) {
    const base = b.box(x - 0.2, x + 0.2, y, y + 0.1, -0.24, 0.24, HULL2);
    b.plating(base.top, 0.2, 0.3);
    b.loft(1, y + 0.1, rectZX(-0.2, 0.2, x - 0.17, x + 0.17), y + 0.26, rectZX(-0.14, 0.14, x - 0.13, x + 0.08), ARMOUR, { capA: false });
    b.both(() => b.box(x + 0.12, x + 0.78, y + 0.14, y + 0.2, 0.05, 0.11, DARK));
  }

  /* ---- Hangar sponsons on both flanks. ---- */
  b.both(() => {
    const prof = (z1: number, y0: number, y1: number): Pt[] => [
      [y1, 1.26],
      [y1, z1],
      [y0, z1],
      [y0, 1.26],
    ];
    const aftEnd = b.loft(0, -1.15, prof(1.3, -0.4, 0.2), -0.75, prof(1.74, -0.5, 0.3), HULL2, { capB: false });
    b.plating(aftEnd.sides[1], 0.3, 0.3);
    const mid = b.loft(0, -0.75, prof(1.74, -0.5, 0.3), 2.55, prof(1.74, -0.5, 0.3), HULL, { capA: false, capB: false });
    const fore = b.loft(0, 2.55, prof(1.74, -0.5, 0.3), 2.95, prof(1.3, -0.4, 0.2), HULL2, { capA: false });
    b.plating(fore.sides[1], 0.3, 0.3);
    const top = mid.sides[0];
    const out = mid.sides[1];
    b.plating(top, 0.28, 0.6);
    if (out?.quad) {
      // Three hangar mouths: a dark opening, light spilling from inside, a warning frame.
      for (const [s0, s1] of [
        [0.05, 0.3],
        [0.375, 0.625],
        [0.7, 0.95],
      ] as const) {
        b.plate(out, s0 - 0.015, 0.14, s1 + 0.015, 0.86, 1, [0.09, 0.09, 0.1]);
        b.stripes(out, s0 - 0.015, 0.14, s1 + 0.015, 0.2, 11, LIVERY);
        b.stripes(out, s0 - 0.015, 0.8, s1 + 0.015, 0.86, 11, LIVERY);
        b.plate(out, s0, 0.2, s1, 0.8, 1, undefined, [0.05, 0.055, 0.07]);
        b.plate(out, s0 + 0.008, 0.2, s1 - 0.008, 0.29, 1, undefined, [1.0, 0.84, 0.56]);
        b.plate(out, s0 + 0.015, 0.66, s1 - 0.015, 0.8, 1, undefined, [0.3, 0.24, 0.16]);
        b.row(out, s0 + 0.02, 0.5, s1 - 0.02, 0.5, 6, COOL, 0.018);
        b.lamp(out, (s0 + s1) / 2, 0.09, "255 190 90", 0.032, 2.4, s0 * 3);
      }
    }
  });

  /* ---- The bow: sensor spars, and small stores on the fore deck. ---- */
  b.wires(
    [
      [[8.4, 0.02, 0], [9.5, 0.02, 0]],
      [[7.8, 0.26, 0.18], [8.95, 0.3, 0.28]],
      [[7.8, 0.26, -0.18], [8.95, 0.3, -0.28]],
      [[6.9, 0.42, 0], [6.9, 1.05, 0]],
      [[6.9, 0.88, -0.2], [6.9, 0.88, 0.2]],
    ],
    0.014,
    BONE,
  );
  for (let i = 0; i < 12; i++) {
    const x = 3.65 + R() * 2.6;
    const z = (R() - 0.5) * 0.8;
    if (Math.abs(x - 4.33) < 0.3 || Math.abs(x - 5.75) < 0.6) continue;
    const s = 0.06 + R() * 0.09;
    const y0 = x < 5 ? 0.55 : 0.5;
    b.box(x - s, x + s * (1 + R()), y0, y0 + 0.05 + R() * 0.12, z - s, z + s, R() < 0.5 ? HULL2 : ARMOUR);
  }
  // Raised armour on the waist's flanks.
  b.both(() => {
    for (let i = 0; i < 6; i++) {
      const x0 = -5.82 + i * 0.69;
      const a = b.box(x0, x0 + 0.62, -0.3, 0.3, 1.18, 1.23, ARMOUR);
      b.plating(a.sb, 0.3, 0.5, 0.15);
      b.plate(a.sb, 0, 0.82, 1, 0.92, 1, LIVERY);
    }
  });

  cached = b.done();
  return cached;
}
