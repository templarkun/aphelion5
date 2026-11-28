/**
 * Sunforge's shell (designer 2026-11-28): a Goldberg sphere of hexagonal panels (and the twelve
 * pentagons every such sphere needs), the dual of a subdivided icosahedron, so the panels tile the
 * sphere with no gaps or overlaps. Also the order the panels lock in (the poles first, the equator
 * last), which tiles are the keystones (one per mission won, round the equator) and where the
 * system's worlds orbit. Pure numbers: no drawing, so the tests can check it.
 */

import { FORGE, keystoneCount, worldCount, hash01 } from "./timeline.js";

export type V3 = [number, number, number];

export interface Tile {
  /** The tile's middle on the unit sphere (also its outward normal). */
  c: V3;
  /** Its corners on the unit sphere, in order round it (5 or 6). */
  corners: V3[];
  /** Keystone number (0..), or -1 for an ordinary panel. */
  key: number;
  /** An ordinary panel's place in the locking order (0 = first); a keystone's: -1. */
  rank: number;
}

const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** The icosahedron, turned so that two of its vertices are the poles (y = +-1). */
function icosahedron(): { v: V3[]; f: [number, number, number][] } {
  const v: V3[] = [[0, 1, 0]];
  const yA = 1 / Math.sqrt(5);
  const rA = 2 / Math.sqrt(5);
  for (let i = 0; i < 5; i++) v.push([rA * Math.cos((i * 2 * Math.PI) / 5), yA, rA * Math.sin((i * 2 * Math.PI) / 5)]);
  for (let i = 0; i < 5; i++) v.push([rA * Math.cos(((i + 0.5) * 2 * Math.PI) / 5), -yA, rA * Math.sin(((i + 0.5) * 2 * Math.PI) / 5)]);
  v.push([0, -1, 0]);
  const f: [number, number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % 5);
    const c = 6 + i;
    const d = 6 + ((i + 1) % 5);
    f.push([0, b, a], [a, b, c], [b, d, c], [11, c, d]);
  }
  return { v, f };
}

/** The shell's tiles for geodesic frequency `freq` (10 freq^2 + 2 of them), with keystones and locking order for `missions` won. */
export function buildShell(missions: number, freq: number = FORGE.FREQ): Tile[] {
  const ico = icosahedron();
  const verts: V3[] = [];
  const index = new Map<string, number>();
  const vid = (p: V3): number => {
    const q = norm(p);
    const k = q.map((x) => Math.round(x * 1e5)).join(",");
    let i = index.get(k);
    if (i === undefined) {
      i = verts.length;
      verts.push(q);
      index.set(k, i);
    }
    return i;
  };
  const tris: [number, number, number][] = [];
  for (const [ia, ib, ic] of ico.f) {
    const A = ico.v[ia]!;
    const B = ico.v[ib]!;
    const C = ico.v[ic]!;
    const at = (i: number, j: number): number => {
      // i steps from A towards B, j steps from A towards C.
      const u = i / freq;
      const w = j / freq;
      return vid([A[0] + (B[0] - A[0]) * u + (C[0] - A[0]) * w, A[1] + (B[1] - A[1]) * u + (C[1] - A[1]) * w, A[2] + (B[2] - A[2]) * u + (C[2] - A[2]) * w]);
    };
    for (let i = 0; i < freq; i++) {
      for (let j = 0; j < freq - i; j++) {
        tris.push([at(i, j), at(i + 1, j), at(i, j + 1)]);
        if (j < freq - i - 1) tris.push([at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
      }
    }
  }
  // Each vertex of the triangles becomes a tile; the middles of its triangles are its corners.
  const around: number[][] = verts.map(() => []);
  tris.forEach((t, k) => t.forEach((v) => around[v]!.push(k)));
  const mids = tris.map(([a, b, c]) => norm([verts[a]![0] + verts[b]![0] + verts[c]![0], verts[a]![1] + verts[b]![1] + verts[c]![1], verts[a]![2] + verts[b]![2] + verts[c]![2]]));
  const tiles: Tile[] = verts.map((c, i) => {
    const up: V3 = Math.abs(c[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = norm(cross(up, c));
    const e2 = cross(c, e1);
    const corners = around[i]!
      .map((k) => mids[k]!)
      .map((m) => ({ m, a: Math.atan2(dot(sub(m, c), e2), dot(sub(m, c), e1)) }))
      .sort((x, y) => x.a - y.a)
      .map((x) => x.m);
    return { c, corners, key: -1, rank: -1 };
  });
  // The keystones: the tiles nearest the equator at evenly spaced headings, never the same tile twice.
  const nk = keystoneCount(missions);
  const used = new Set<number>();
  for (let k = 0; k < nk; k++) {
    const a = (k / nk) * Math.PI * 2 + 0.3;
    const want: V3 = [Math.cos(a), 0, Math.sin(a)];
    let best = -1;
    let bestD = Infinity;
    tiles.forEach((t, i) => {
      if (used.has(i)) return;
      const d = 1 - dot(t.c, want) + Math.abs(t.c[1]) * 0.5;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    used.add(best);
    tiles[best]!.key = k;
  }
  // The rest lock from the poles to the equator, a little scattered so the edge of the light is ragged.
  const order = tiles
    .map((t, i) => ({ i, s: Math.abs(t.c[1]) + (hash01(i * 7 + 3) - 0.5) * 0.16 }))
    .filter((x) => tiles[x.i]!.key < 0)
    .sort((a, b) => b.s - a.s);
  order.forEach((x, r) => (tiles[x.i]!.rank = r));
  return tiles;
}

/** Where world i of n orbits: its orbit's radius (shell radii), its size, its heading at film time t (the plane y = 0). */
export function worldOf(i: number, n: number, t: number): { orbit: number; size: number; p: V3 } {
  const k = worldCount(n);
  const orbit = 4.2 + (k > 1 ? (i * 18) / (k - 1) : 0) + hash01(i * 5 + 1) * 0.8;
  const size = 0.22 + hash01(i * 11 + 2) * 0.32;
  // Outer worlds turn slower (Kepler, slowed down a lot to read well).
  const a = hash01(i * 13 + 3) * Math.PI * 2 + (t * 0.9) / Math.pow(orbit, 1.5);
  return { orbit, size, p: [Math.cos(a) * orbit, 0, Math.sin(a) * orbit] };
}
