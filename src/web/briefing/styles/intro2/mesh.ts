/**
 * Style "intro2": how the capital ship is built and drawn. The ship is a few hundred angular
 * blocks (each one bulging outwards everywhere, so it can be drawn without a depth buffer):
 * hull sections, armour plates, towers, engines, fins, dishes. Each flat side carries its own
 * detail: plating seams, lighter and darker plates, rows of lit windows.
 *
 * Drawing (2D canvas): the blocks are put in order from far to near by which side of each other
 * the camera stands on, each side that faces the camera is filled with its lit colour, then its
 * detail is drawn on it. Lit by a warm sun, a cool light from the camera's side, and the glow of
 * the ship's own engines. Looks only; no game data.
 *
 * The ship's own frame: x forward (bow), y up, z to starboard. About 10 units long.
 */

import { rng, type V3 } from "./math3.js";

/** A lighter, darker or coloured patch lying on a side. */
export interface Plate {
  vi: number[];
  tint: number;
  col?: V3 | undefined;
  /** Shines by itself (windows of the bridge, the light inside a hangar). */
  emis?: V3 | undefined;
}
/** A row of small lights (windows) from one point to another. */
export interface Row {
  a: number;
  b: number;
  n: number;
  col: string;
  w: number;
}
/** One point of light: a running light, a beacon. period 0 = steady. */
export interface Lamp {
  v: number;
  col: string;
  size: number;
  period: number;
  phase: number;
}
export interface Face {
  vi: number[];
  /** Its four corners in a fixed order, for placing detail (s along, t across). */
  quad: number[] | undefined;
  n: V3;
  c: V3;
  col: V3;
  emis?: V3 | undefined;
  /** Seams: pairs of points. */
  lines: number[];
  plates: Plate[];
  rows: Row[];
  lamps: Lamp[];
  /** How much of the engines' light falls on it, 0..1: at its middle, and at its two ends (points g0, g1) when it is long. */
  eng: number;
  eng0: number;
  eng1: number;
  g0: number;
  g1: number;
  /** An engine mouth: the radius of its glow. */
  mouth?: number | undefined;
}
/** A thin rod: an antenna, a barrel, a brace. */
export interface Wire {
  a: number;
  b: number;
  w: number;
  col: V3;
}
export interface Part {
  faces: Face[];
  wires: Wire[];
  /** Its points: v0 .. v1. */
  v0: number;
  v1: number;
  min: V3;
  max: V3;
  c: V3;
  /** Turns round an upright axis through (x, z): a radar. Turns a second. */
  spin?: { x: number; z: number; speed: number } | undefined;
}
export interface Nozzle {
  p: V3;
  r: number;
}
export interface Model {
  verts: Float32Array;
  parts: Part[];
  nozzles: Nozzle[];
}

export type Pt = [number, number];

const newell = (pts: V3[]): V3 => {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(x, y, z);
  return l < 1e-9 ? [0, 0, 0] : [x / l, y / l, z / l];
};

/** A regular many-sided outline round (cu, cv). */
export function ngon(n: number, r: number, cu = 0, cv = 0, turn = 0.5, squashV = 1): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((i + turn) / n) * Math.PI * 2;
    return [cu + Math.cos(a) * r, cv + Math.sin(a) * r * squashV] as Pt;
  });
}

export interface Lofted {
  part: Part;
  sides: Face[];
  capA: Face | undefined;
  capB: Face | undefined;
}
export interface Boxed {
  part: Part;
  top: Face;
  bottom: Face;
  sb: Face;
  port: Face;
  stern: Face;
  bow: Face;
}

export class Builder {
  verts: number[] = [];
  parts: Part[] = [];
  nozzles: Nozzle[] = [];
  cur!: Part;
  /** -1 while the port twin of something is being built. */
  sz = 1;
  /** A turn or shift put on every point made (a tilted dish). */
  tf: ((p: V3) => V3) | undefined;
  R = rng(4711);

  v(x: number, y: number, z: number): number {
    let p: V3 = [x, y, z];
    if (this.tf) p = this.tf(p);
    this.verts.push(p[0], p[1], p[2] * this.sz);
    return this.verts.length / 3 - 1;
  }
  raw(p: V3): number {
    this.verts.push(p[0], p[1], p[2]);
    return this.verts.length / 3 - 1;
  }
  at(i: number): V3 {
    return [this.verts[i * 3]!, this.verts[i * 3 + 1]!, this.verts[i * 3 + 2]!];
  }
  begin(): Part {
    const p: Part = { faces: [], wires: [], v0: this.verts.length / 3, v1: 0, min: [0, 0, 0], max: [0, 0, 0], c: [0, 0, 0] };
    this.parts.push(p);
    this.cur = p;
    return p;
  }
  /** Build something on the starboard side and its twin to port. */
  both(make: () => void): void {
    make();
    this.sz = -1;
    make();
    this.sz = 1;
  }
  /** A little difference between one side and the next, so no two are quite the same grey. */
  vary(col: V3, k = 0.05): V3 {
    const f = 1 + (this.R() - 0.5) * 2 * k;
    return [col[0] * f, col[1] * f, col[2] * f];
  }

  face(ids: number[], col: V3, quad?: number[], flip = false): Face | undefined {
    const order = this.sz < 0 !== flip ? ids.slice().reverse() : ids;
    const pts = order.map((i) => this.at(i));
    const n = newell(pts);
    if (n[0] === 0 && n[1] === 0 && n[2] === 0) return undefined;
    const c: V3 = [0, 0, 0];
    for (const p of pts) {
      c[0] += p[0] / pts.length;
      c[1] += p[1] / pts.length;
      c[2] += p[2] / pts.length;
    }
    const f: Face = { vi: order, quad, n, c, col, lines: [], plates: [], rows: [], lamps: [], eng: 0, eng0: 0, eng1: 0, g0: -1, g1: -1 };
    this.cur.faces.push(f);
    return f;
  }

  /** A box with its sides along the ship's axes. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, col: V3, k = 0.05): Boxed {
    const part = this.begin();
    const p = (x: number, y: number, z: number) => this.v(x, y, z);
    const a = [p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)];
    const b = [p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)];
    const q = (ids: number[]) => this.face(ids, this.vary(col, k), ids)!;
    return {
      part,
      top: q([b[3]!, b[2]!, b[1]!, b[0]!]),
      bottom: q([a[0]!, a[1]!, a[2]!, a[3]!]),
      sb: q([a[3]!, a[2]!, b[2]!, b[3]!]),
      port: q([a[1]!, a[0]!, b[0]!, b[1]!]),
      stern: q([a[0]!, a[3]!, b[3]!, b[0]!]),
      bow: q([a[2]!, a[1]!, b[1]!, b[2]!]),
    };
  }

  /**
   * A block between two outlines, one at `a` and one at `b` along an axis (0 = x, 1 = y, 2 = z).
   * The outlines are given in the other two directions in turn: for x (y, z), for y (z, x), for
   * z (x, y); both with the same number of points, going round the same way.
   */
  loft(axis: 0 | 1 | 2, a: number, A: Pt[], b: number, B: Pt[], col: V3, opt: { capA?: V3 | false; capB?: V3 | false; k?: number } = {}): Lofted {
    const part = this.begin();
    const mk = (w: number, [u, v]: Pt) => (axis === 0 ? this.v(w, u, v) : axis === 1 ? this.v(v, w, u) : this.v(u, v, w));
    const area = (P: Pt[]) => P.reduce((s, p, i) => s + p[0] * P[(i + 1) % P.length]![1] - P[(i + 1) % P.length]![0] * p[1], 0);
    const ar = Math.abs(area(A)) > Math.abs(area(B)) ? area(A) : area(B);
    // Going round the wrong way (or b before a): the sides are turned over.
    const flip = ar < 0 !== b < a;
    const ia = A.map((p) => mk(a, p));
    const ib = B.map((p) => mk(b, p));
    const n = A.length;
    const sides: Face[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const f = this.face([ia[i]!, ia[j]!, ib[j]!, ib[i]!], this.vary(col, opt.k ?? 0.05), [ia[i]!, ib[i]!, ib[j]!, ia[j]!], flip);
      if (f) sides.push(f);
      else sides.push(undefined as unknown as Face);
    }
    const capA = opt.capA === false ? undefined : this.face(ia.slice().reverse(), opt.capA ?? this.vary(col), undefined, flip);
    const capB = opt.capB === false ? undefined : this.face(ib, opt.capB ?? this.vary(col), undefined, flip);
    return { part, sides, capA, capB };
  }

  /** Thin rods from point to point, as one piece. */
  wires(segs: [V3, V3][], w: number, col: V3): Part {
    const part = this.begin();
    for (const [p, q] of segs) part.wires.push({ a: this.v(p[0], p[1], p[2]), b: this.v(q[0], q[1], q[2]), w, col });
    return part;
  }

  /** A point on a four-cornered side: s along, t across, both 0..1. */
  on(f: Face, s: number, t: number): number {
    const q = f.quad!;
    const a = this.at(q[0]!);
    const b = this.at(q[1]!);
    const c = this.at(q[2]!);
    const d = this.at(q[3]!);
    const w0 = (1 - s) * (1 - t);
    const w1 = s * (1 - t);
    const w2 = s * t;
    const w3 = (1 - s) * t;
    return this.raw([a[0] * w0 + b[0] * w1 + c[0] * w2 + d[0] * w3, a[1] * w0 + b[1] * w1 + c[1] * w2 + d[1] * w3, a[2] * w0 + b[2] * w1 + c[2] * w2 + d[2] * w3]);
  }
  /** How long a four-cornered side is along s and across t, in ship units. */
  size(f: Face): [number, number] {
    const q = f.quad!.map((i) => this.at(i));
    const d = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    return [(d(q[0]!, q[1]!) + d(q[3]!, q[2]!)) / 2, (d(q[0]!, q[3]!) + d(q[1]!, q[2]!)) / 2];
  }
  seam(f: Face, s0: number, t0: number, s1: number, t1: number): void {
    f.lines.push(this.on(f, s0, t0), this.on(f, s1, t1));
  }
  plate(f: Face, s0: number, t0: number, s1: number, t1: number, tint = 1.1, col?: V3, emis?: V3): Plate {
    const p: Plate = { vi: [this.on(f, s0, t0), this.on(f, s1, t0), this.on(f, s1, t1), this.on(f, s0, t1)], tint, col, emis };
    f.plates.push(p);
    return p;
  }
  /** A plate with a seam all round it. */
  panel(f: Face, s0: number, t0: number, s1: number, t1: number, tint = 1.1, col?: V3): void {
    this.plate(f, s0, t0, s1, t1, tint, col);
    this.seam(f, s0, t0, s1, t0);
    this.seam(f, s1, t0, s1, t1);
    this.seam(f, s1, t1, s0, t1);
    this.seam(f, s0, t1, s0, t0);
  }
  /** A row of n windows. */
  row(f: Face, s0: number, t0: number, s1: number, t1: number, n: number, col = "255 214 150", w = 0.03): void {
    f.rows.push({ a: this.on(f, s0, t0), b: this.on(f, s1, t1), n, col, w });
  }
  lamp(f: Face, s: number, t: number, col: string, size = 0.05, period = 0, phase = 0): void {
    f.lamps.push({ v: this.on(f, s, t), col, size, period, phase });
  }
  /** Stripes of warning paint: alternate bands of a colour across a patch. */
  stripes(f: Face, s0: number, t0: number, s1: number, t1: number, n: number, col: V3, alongS = true): void {
    for (let i = 0; i < n; i += 2) {
      const a = i / n;
      const b = (i + 1) / n;
      if (alongS) this.plate(f, s0 + (s1 - s0) * a, t0, s0 + (s1 - s0) * b, t1, 1, col);
      else this.plate(f, s0, t0 + (t1 - t0) * a, s1, t0 + (t1 - t0) * b, 1, col);
    }
  }

  /**
   * Plating on a four-cornered side: seams in an uneven grid, and in its cells here a lighter or
   * darker plate, there a vent, a hatch or a few windows. `cell` is the size of a cell in ship
   * units; `rich` 0..1 how much is put in the cells; `lit` how often a cell gets windows.
   */
  plating(f: Face | undefined, cell = 0.36, rich = 0.6, lit = 0): void {
    if (!f?.quad) return;
    const R = this.R;
    const [ls, lt] = this.size(f);
    const ns = Math.max(1, Math.round(ls / cell));
    const nt = Math.max(1, Math.round(lt / (cell * 0.8)));
    const cuts = (n: number) => {
      const c = [0];
      for (let i = 1; i < n; i++) c.push((i + (R() - 0.5) * 0.5) / n);
      c.push(1);
      return c;
    };
    const cs = cuts(ns);
    const ct = cuts(nt);
    // Long seams across (t), broken seams along (s): plates laid in courses.
    for (let j = 1; j < nt; j++) this.seam(f, 0, ct[j]!, 1, ct[j]!);
    for (let j = 0; j < nt; j++) {
      for (let i = 1; i < ns; i++) {
        if (R() < 0.78) {
          const s = cs[i]! + (R() - 0.5) * (0.3 / ns);
          this.seam(f, s, ct[j]!, s, ct[j + 1]!);
        }
      }
    }
    for (let j = 0; j < nt; j++) {
      for (let i = 0; i < ns; i++) {
        const s0 = cs[i]!;
        const s1 = cs[i + 1]!;
        const t0 = ct[j]!;
        const t1 = ct[j + 1]!;
        const ds = s1 - s0;
        const dt = t1 - t0;
        const r = R();
        if (r > rich) continue;
        const kind = R();
        if (kind < 0.5) {
          // A plate of another grey, a little inside its cell.
          const m = 0.1 + R() * 0.1;
          this.plate(f, s0 + ds * m, t0 + dt * m, s1 - ds * m, t1 - dt * m, R() < 0.5 ? 0.8 + R() * 0.1 : 1.1 + R() * 0.12);
        } else if (kind < 0.72) {
          // A vent: a dark slot with ribs.
          const a = s0 + ds * 0.2;
          const b = s1 - ds * 0.2;
          const c0 = t0 + dt * 0.25;
          const c1 = t1 - dt * 0.25;
          this.plate(f, a, c0, b, c1, 0.5);
          const ribs = 3 + Math.floor(R() * 3);
          for (let q = 1; q < ribs; q++) this.seam(f, a + ((b - a) * q) / ribs, c0, a + ((b - a) * q) / ribs, c1);
        } else if (kind < 0.9) {
          // A hatch.
          const cx = s0 + ds * (0.3 + R() * 0.4);
          const cy = t0 + dt * (0.3 + R() * 0.4);
          const hs = Math.min(ds, (dt * lt) / ls) * 0.22;
          const ht = (hs * ls) / lt;
          this.panel(f, cx - hs, cy - ht, cx + hs, cy + ht, 1.16);
        } else {
          // Two short pipes side by side.
          const c = t0 + dt * (0.35 + R() * 0.3);
          this.plate(f, s0 + ds * 0.08, c, s1 - ds * 0.08, c + dt * 0.1, 1.25);
          this.plate(f, s0 + ds * 0.08, c + dt * 0.16, s1 - ds * 0.3, c + dt * 0.24, 0.7);
        }
        if (lit > 0 && R() < lit) {
          const c = t0 + dt * (0.25 + R() * 0.5);
          const k = 2 + Math.floor(R() * 4);
          this.row(f, s0 + ds * 0.15, c, s0 + ds * 0.15 + ds * 0.14 * k, c, k, R() < 0.8 ? "255 214 150" : "190 235 255", 0.022);
        }
      }
    }
  }

  /** The light of the engines on every side: more the nearer and the more it faces them. */
  engineLight(): void {
    const at = (p: V3, n: V3): number => {
      let e = 0;
      for (const z of this.nozzles) {
        // The light comes from the plume, a little behind the mouth.
        const dx = z.p[0] - z.r * 1.4 - p[0];
        const dy = z.p[1] - p[1];
        const dz = z.p[2] - p[2];
        const d = Math.hypot(dx, dy, dz) || 1;
        const facing = (n[0] * dx + n[1] * dy + n[2] * dz) / d;
        if (facing <= 0) continue;
        e += (facing * z.r * z.r * 2.4) / (0.3 + d * d);
      }
      return Math.min(1, e);
    };
    const mid = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    for (const part of this.parts)
      for (const f of part.faces) {
        f.eng = at(f.c, f.n);
        if (!f.quad) continue;
        // A long side is lit more at the end nearer the engines: the light fades along it.
        const q = f.quad.map((i) => this.at(i));
        const a = mid(q[0]!, q[3]!);
        const b = mid(q[1]!, q[2]!);
        f.eng0 = at(a, f.n);
        f.eng1 = at(b, f.n);
        if (Math.abs(f.eng0 - f.eng1) > 0.03) {
          f.g0 = this.raw(a);
          f.g1 = this.raw(b);
        }
      }
  }

  done(): Model {
    for (const p of this.parts) {
      const min: V3 = [1e9, 1e9, 1e9];
      const max: V3 = [-1e9, -1e9, -1e9];
      const grow = (i: number) => {
        for (let k = 0; k < 3; k++) {
          const x = this.verts[i * 3 + k]!;
          if (x < min[k]!) min[k] = x;
          if (x > max[k]!) max[k] = x;
        }
      };
      for (const f of p.faces) f.vi.forEach(grow);
      for (const w of p.wires) {
        grow(w.a);
        grow(w.b);
      }
      if (p.spin) {
        // Everything it sweeps through as it turns.
        let r = 0;
        for (const f of p.faces) for (const i of f.vi) r = Math.max(r, Math.hypot(this.verts[i * 3]! - p.spin.x, this.verts[i * 3 + 2]! - p.spin.z));
        min[0] = p.spin.x - r;
        max[0] = p.spin.x + r;
        min[2] = p.spin.z - r;
        max[2] = p.spin.z + r;
      }
      p.min = min;
      p.max = max;
      p.c = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    }
    // Each part's points: everything made between its start and the next part's.
    for (let i = 0; i < this.parts.length; i++) this.parts[i]!.v1 = i + 1 < this.parts.length ? this.parts[i + 1]!.v0 : this.verts.length / 3;
    this.engineLight();
    return { verts: new Float32Array(this.verts), parts: this.parts.filter((p) => p.faces.length || p.wires.length), nozzles: this.nozzles };
  }
}

/* ------------------------------------------------------------------------------------------ */

export interface Lights {
  /** Directions the light comes from, in the ship's frame, and their colours (r g b, 0..1 and over). */
  key: V3;
  keyCol: V3;
  kick: V3;
  kickCol: V3;
  amb: V3;
  /** Engine glow: its colour and how hard the engines burn (0 idle .. 1 cruise .. 3 full). */
  engCol: V3;
  power: number;
  /** Haze: far parts fade a little towards this. */
  fog: V3;
  fogNear: number;
  fogFar: number;
  fogMax: number;
}

/** The ship's place in the world: where its middle is, and its small turns (radians). */
export interface Pose {
  pos: V3;
  roll: number;
  pitch: number;
  yaw: number;
}

export interface Drawn {
  /** Where a point of the ship is in the picture: [x, y, depth, px per unit there]. */
  project(p: V3): [number, number, number, number];
}

const EPS = 0.045;

export function createRenderer(model: Model) {
  const nv = model.verts.length / 3;
  const X = new Float32Array(nv);
  const Y = new Float32Array(nv);
  const Z = new Float32Array(nv);
  const parts = model.parts;
  const n = parts.length;
  const before = new Uint8Array(n * n);
  const indeg = new Int16Array(n);
  const done = new Uint8Array(n);
  const depth = new Float32Array(n);
  const order = new Int16Array(n);
  let orderAt: V3 | undefined;

  /** Far to near: which block must be drawn before which, seen from `cam` (ship's frame). */
  function sort(cam: V3): void {
    before.fill(0);
    indeg.fill(0);
    for (let i = 0; i < n; i++) {
      const p = parts[i]!;
      depth[i] = Math.hypot(p.c[0] - cam[0], p.c[1] - cam[1], p.c[2] - cam[2]);
    }
    for (let i = 0; i < n; i++) {
      const a = parts[i]!;
      for (let j = i + 1; j < n; j++) {
        const b = parts[j]!;
        // aFirst: a cannot hide b, so a may be drawn first. bFirst likewise.
        let aFirst = false;
        let bFirst = false;
        for (let k = 0; k < 3; k++) {
          if (a.max[k]! <= b.min[k]! + EPS) {
            // a below b on this axis.
            if (cam[k]! >= a.max[k]! - EPS) aFirst = true;
            if (cam[k]! <= b.min[k]! + EPS) bFirst = true;
          } else if (b.max[k]! <= a.min[k]! + EPS) {
            if (cam[k]! >= b.max[k]! - EPS) bFirst = true;
            if (cam[k]! <= a.min[k]! + EPS) aFirst = true;
          }
        }
        if (aFirst === bFirst) {
          if (aFirst) continue; // neither can hide the other
          // They overlap: the farther one first.
          if (depth[i]! >= depth[j]!) aFirst = true;
          else bFirst = true;
        }
        if (aFirst) {
          before[i * n + j] = 1;
          indeg[j]!++;
        } else {
          before[j * n + i] = 1;
          indeg[i]!++;
        }
      }
    }
    done.fill(0);
    for (let k = 0; k < n; k++) {
      let pick = -1;
      let any = -1;
      for (let i = 0; i < n; i++) {
        if (done[i]) continue;
        if (any < 0 || depth[i]! > depth[any]!) any = i;
        if (indeg[i] === 0 && (pick < 0 || depth[i]! > depth[pick]!)) pick = i;
      }
      if (pick < 0) pick = any; // a ring of blocks hiding each other: break it at the farthest
      done[pick] = 1;
      order[k] = pick;
      const row = pick * n;
      for (let j = 0; j < n; j++) if (before[row + j]) indeg[j]!--;
    }
  }

  return function draw(g: CanvasRenderingContext2D, cam: { pos: V3; r: V3; d: V3; f: V3; focal: number; cx: number; cy: number }, pose: Pose, L: Lights, t: number): Drawn {
    // The ship's turn: roll about x, pitch about z, yaw about y.
    const cr = Math.cos(pose.roll);
    const sr = Math.sin(pose.roll);
    const cp = Math.cos(pose.pitch);
    const sp = Math.sin(pose.pitch);
    const cy = Math.cos(pose.yaw);
    const sy = Math.sin(pose.yaw);
    // R = Ry * Rz * Rx, as rows.
    const rx: V3 = [cy * cp, -cy * sp * cr + sy * sr, cy * sp * sr + sy * cr];
    const ry: V3 = [sp, cp * cr, -cp * sr];
    const rz: V3 = [-sy * cp, sy * sp * cr + cy * sr, -sy * sp * sr + cy * cr];
    // Ship frame -> camera space: M p + T.
    const row = (a: V3): V3 => [a[0] * rx[0] + a[1] * ry[0] + a[2] * rz[0], a[0] * rx[1] + a[1] * ry[1] + a[2] * rz[1], a[0] * rx[2] + a[1] * ry[2] + a[2] * rz[2]];
    const m0 = row(cam.r);
    const m1 = row(cam.d);
    const m2 = row(cam.f);
    const off: V3 = [pose.pos[0] - cam.pos[0], pose.pos[1] - cam.pos[1], pose.pos[2] - cam.pos[2]];
    const T: V3 = [off[0] * cam.r[0] + off[1] * cam.r[1] + off[2] * cam.r[2], off[0] * cam.d[0] + off[1] * cam.d[1] + off[2] * cam.d[2], off[0] * cam.f[0] + off[1] * cam.f[1] + off[2] * cam.f[2]];
    // World direction -> ship frame (R transposed).
    const inv = (v: V3): V3 => [v[0] * rx[0] + v[1] * ry[0] + v[2] * rz[0], v[0] * rx[1] + v[1] * ry[1] + v[2] * rz[1], v[0] * rx[2] + v[1] * ry[2] + v[2] * rz[2]];
    const eye = inv([-off[0], -off[1], -off[2]]);
    const key = inv(L.key);
    const kick = inv(L.kick);
    const V = model.verts;
    const F = cam.focal;

    const put = (i: number, x: number, y: number, z: number) => {
      const cz = Math.max(0.05, m2[0] * x + m2[1] * y + m2[2] * z + T[2]);
      X[i] = cam.cx + (F * (m0[0] * x + m0[1] * y + m0[2] * z + T[0])) / cz;
      Y[i] = cam.cy + (F * (m1[0] * x + m1[1] * y + m1[2] * z + T[1])) / cz;
      Z[i] = cz;
    };
    for (const p of parts) {
      if (p.spin) {
        const a = t * p.spin.speed * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        for (let i = p.v0; i < p.v1; i++) {
          const x = V[i * 3]! - p.spin.x;
          const z = V[i * 3 + 2]! - p.spin.z;
          put(i, p.spin.x + x * c + z * s, V[i * 3 + 1]!, p.spin.z - x * s + z * c);
        }
      } else for (let i = p.v0; i < p.v1; i++) put(i, V[i * 3]!, V[i * 3 + 1]!, V[i * 3 + 2]!);
    }

    if (!orderAt || Math.hypot(eye[0] - orderAt[0], eye[1] - orderAt[1], eye[2] - orderAt[2]) > 0.08) {
      sort(eye);
      orderAt = eye;
    }

    const px = (v: number) => Math.round(Math.min(255, Math.max(0, v * 255)));
    const pw = L.power;
    g.lineJoin = "round";
    g.lineCap = "butt";
    for (let k = 0; k < n; k++) {
      const part = parts[order[k]!]!;
      // A turning part: its sides are judged by how they wind in the picture.
      const spun = !!part.spin;
      for (const f of part.faces) {
        const vi = f.vi;
        if (spun) {
          let ar = 0;
          for (let i = 0; i < vi.length; i++) {
            const a = vi[i]!;
            const b = vi[(i + 1) % vi.length]!;
            ar += X[a]! * Y[b]! - X[b]! * Y[a]!;
          }
          if (ar <= 0) continue;
        } else if (f.n[0] * (eye[0] - f.c[0]) + f.n[1] * (eye[1] - f.c[1]) + f.n[2] * (eye[2] - f.c[2]) <= 0) continue;
        const zc = Math.max(0.05, m2[0] * f.c[0] + m2[1] * f.c[1] + m2[2] * f.c[2] + T[2]);
        const scale = F / zc;
        // Light on this side.
        const nk = Math.max(0, f.n[0] * key[0] + f.n[1] * key[1] + f.n[2] * key[2]);
        const nc = Math.max(0, f.n[0] * kick[0] + f.n[1] * kick[1] + f.n[2] * kick[2]);
        const hem = 0.72 + 0.28 * f.n[1];
        let lr = L.amb[0] * hem + nk * L.keyCol[0] + nc * L.kickCol[0];
        let lg = L.amb[1] * hem + nk * L.keyCol[1] + nc * L.kickCol[1];
        let lb = L.amb[2] * hem + nk * L.keyCol[2] + nc * L.kickCol[2];
        // A glint where the sun mirrors off the plate towards the camera.
        const vx = eye[0] - f.c[0];
        const vy = eye[1] - f.c[1];
        const vz = eye[2] - f.c[2];
        const vl = 1 / Math.hypot(vx, vy, vz);
        const hx = key[0] + vx * vl;
        const hy = key[1] + vy * vl;
        const hz = key[2] + vz * vl;
        const nh = Math.max(0, (f.n[0] * hx + f.n[1] * hy + f.n[2] * hz) / Math.hypot(hx, hy, hz));
        const spec = Math.pow(nh, 28) * 0.55;
        const e = f.eng * pw;
        const ar = e * L.engCol[0] + spec * L.keyCol[0] * 0.5;
        const ag = e * L.engCol[1] + spec * L.keyCol[1] * 0.5;
        const ab = e * L.engCol[2] + spec * L.keyCol[2] * 0.5;
        const fogK = Math.min(L.fogMax, Math.max(0, (zc - L.fogNear) / (L.fogFar - L.fogNear)) * L.fogMax);
        const fr = L.fog[0] * fogK;
        const fgc = L.fog[1] * fogK;
        const fb = L.fog[2] * fogK;
        const keep = 1 - fogK;
        lr *= keep;
        lg *= keep;
        lb *= keep;
        const colour = (c: V3, tint: number) => `rgb(${px(c[0] * tint * lr + ar * keep + fr)} ${px(c[1] * tint * lg + ag * keep + fgc)} ${px(c[2] * tint * lb + ab * keep + fb)})`;

        g.beginPath();
        g.moveTo(X[vi[0]!]!, Y[vi[0]!]!);
        for (let i = 1; i < vi.length; i++) g.lineTo(X[vi[i]!]!, Y[vi[i]!]!);
        g.closePath();
        if (f.mouth !== undefined) {
          // An engine mouth: white-hot in the middle, the dark rim of the bell round it.
          let mx = 0;
          let my = 0;
          for (const i of vi) {
            mx += X[i]! / vi.length;
            my += Y[i]! / vi.length;
          }
          const r = f.mouth * scale;
          const hot = Math.min(1, 0.25 + pw * 0.75);
          const grd = g.createRadialGradient(mx, my, 0, mx, my, r);
          grd.addColorStop(0, `rgb(255 255 255 / ${hot})`);
          grd.addColorStop(0.3, `rgb(190 244 255 / ${hot})`);
          grd.addColorStop(0.62, `rgb(${px(0.2 * hot)} ${px(0.72 * hot)} ${px(0.98 * hot)})`);
          grd.addColorStop(0.86, `rgb(${px(0.04 + 0.05 * hot)} ${px(0.1 + 0.25 * hot)} ${px(0.16 + 0.42 * hot)})`);
          grd.addColorStop(1, "rgb(10 14 20)");
          g.fillStyle = "rgb(8 12 18)";
          g.fill();
          g.fillStyle = grd;
          g.fill();
        } else {
          const c = f.emis ? `rgb(${px(f.emis[0])} ${px(f.emis[1])} ${px(f.emis[2])})` : colour(f.col, 1);
          if (!f.emis && f.g0 >= 0 && Math.abs(f.eng0 - f.eng1) * pw > 0.04) {
            // The engines' light fading along a long side.
            const lit = (en: number) => `rgb(${px(f.col[0] * lr + (en * pw * L.engCol[0] + spec * L.keyCol[0] * 0.5) * keep + fr)} ${px(f.col[1] * lg + (en * pw * L.engCol[1] + spec * L.keyCol[1] * 0.5) * keep + fgc)} ${px(f.col[2] * lb + (en * pw * L.engCol[2] + spec * L.keyCol[2] * 0.5) * keep + fb)})`;
            const grd = g.createLinearGradient(X[f.g0]!, Y[f.g0]!, X[f.g1]!, Y[f.g1]!);
            grd.addColorStop(0, lit(f.eng0));
            grd.addColorStop(0.5, c);
            grd.addColorStop(1, lit(f.eng1));
            g.fillStyle = grd;
            g.fill();
          } else {
            g.fillStyle = c;
            g.fill();
          }
          // Close the hair-wide gap to the next side.
          g.strokeStyle = c;
          g.lineWidth = 0.7;
          g.stroke();
        }
        if (scale < 5) continue; // too far to show detail
        for (const p of f.plates) {
          const q = p.vi;
          g.beginPath();
          g.moveTo(X[q[0]!]!, Y[q[0]!]!);
          for (let i = 1; i < q.length; i++) g.lineTo(X[q[i]!]!, Y[q[i]!]!);
          g.closePath();
          g.fillStyle = p.emis ? `rgb(${px(p.emis[0])} ${px(p.emis[1])} ${px(p.emis[2])})` : colour(p.col ?? f.col, p.tint);
          g.fill();
        }
        if (f.lines.length) {
          g.beginPath();
          for (let i = 0; i < f.lines.length; i += 2) {
            const a = f.lines[i]!;
            const b = f.lines[i + 1]!;
            g.moveTo(X[a]!, Y[a]!);
            g.lineTo(X[b]!, Y[b]!);
          }
          g.strokeStyle = colour(f.col, 0.5);
          g.lineWidth = Math.min(1.5, Math.max(0.45, scale * 0.009));
          g.stroke();
        }
        for (const r of f.rows) {
          const x0 = X[r.a]!;
          const y0 = Y[r.a]!;
          const x1 = X[r.b]!;
          const y1 = Y[r.b]!;
          const len = Math.hypot(x1 - x0, y1 - y0);
          if (len < 1) continue;
          const pitch = len / r.n;
          g.setLineDash([pitch * 0.55, pitch * 0.45]);
          g.strokeStyle = `rgb(${r.col} / ${Math.min(1, 0.55 + scale * 0.004).toFixed(2)})`;
          g.lineWidth = Math.min(4, Math.max(0.7, r.w * scale));
          g.beginPath();
          g.moveTo(x0, y0);
          g.lineTo(x1, y1);
          g.stroke();
          g.setLineDash([]);
        }
        for (const l of f.lamps) {
          let a = 1;
          if (l.period > 0) {
            const ph = (((t + l.phase) % l.period) + l.period) % l.period;
            a = ph < 0.12 ? 1 : ph < 0.3 ? 1 - (ph - 0.12) / 0.18 : 0;
          }
          if (a <= 0.02) continue;
          const x = X[l.v]!;
          const y = Y[l.v]!;
          const r = Math.max(1, l.size * scale);
          g.globalCompositeOperation = "lighter";
          const grd = g.createRadialGradient(x, y, 0, x, y, r * 5);
          grd.addColorStop(0, `rgb(${l.col} / ${(0.9 * a).toFixed(3)})`);
          grd.addColorStop(0.2, `rgb(${l.col} / ${(0.35 * a).toFixed(3)})`);
          grd.addColorStop(1, `rgb(${l.col} / 0)`);
          g.fillStyle = grd;
          g.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
          g.fillStyle = `rgb(255 255 255 / ${a.toFixed(3)})`;
          g.fillRect(x - r * 0.5, y - r * 0.5, r, r);
          g.globalCompositeOperation = "source-over";
        }
      }
      for (const wr of part.wires) {
        const zc = (Z[wr.a]! + Z[wr.b]!) / 2;
        const fogK = Math.min(L.fogMax, Math.max(0, (zc - L.fogNear) / (L.fogFar - L.fogNear)) * L.fogMax);
        const li = (L.amb[1] + L.keyCol[1] * 0.35 + L.kickCol[1] * 0.3) * (1 - fogK);
        g.strokeStyle = `rgb(${px(wr.col[0] * li + L.fog[0] * fogK)} ${px(wr.col[1] * li + L.fog[1] * fogK)} ${px(wr.col[2] * li + L.fog[2] * fogK)})`;
        g.lineWidth = Math.max(0.6, (wr.w * F) / zc);
        g.beginPath();
        g.moveTo(X[wr.a]!, Y[wr.a]!);
        g.lineTo(X[wr.b]!, Y[wr.b]!);
        g.stroke();
      }
    }
    return {
      project(p) {
        const z = Math.max(0.05, m2[0] * p[0] + m2[1] * p[1] + m2[2] * p[2] + T[2]);
        return [cam.cx + (F * (m0[0] * p[0] + m0[1] * p[1] + m0[2] * p[2] + T[0])) / z, cam.cy + (F * (m1[0] * p[0] + m1[1] * p[1] + m1[2] * p[2] + T[1])) / z, m2[0] * p[0] + m2[1] * p[1] + m2[2] * p[2] + T[2], F / z];
      },
    };
  };
}
