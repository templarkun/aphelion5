/**
 * Field geometry - Core Rules 3.1, 3.5-3.8, stated exactly in coordinates.
 *
 * Axial coordinates (q, r): r + 1 is one step right, q + 1 is one step
 * up-right. Sectors are pointy-top hexes. Sides are numbered 1-6 starting at
 * the flat left side and going clockwise.
 *
 * A coordinate that is not on the mission map is a gap or off the Field;
 * the rules treat both the same (3.8), and so does this module.
 */

export interface Coord {
  readonly q: number;
  readonly r: number;
}

/** Side number 1-6 (1 left, 2 upper-left, 3 upper-right, 4 right, 5 lower-right, 6 lower-left). */
export type Side = 1 | 2 | 3 | 4 | 5 | 6;
/** Facing 0-5; 0 = as printed (3.8). */
export type Facing = 0 | 1 | 2 | 3 | 4 | 5;

export const SIDES: readonly Side[] = [1, 2, 3, 4, 5, 6];

/** Neighbour offsets per side - Core Rules 3.8 table "Sides and neighbours". */
export const SIDE_OFFSET: Readonly<Record<Side, Coord>> = {
  1: { q: 0, r: -1 }, // left
  2: { q: 1, r: -1 }, // upper-left
  3: { q: 1, r: 0 }, // upper-right
  4: { q: 0, r: 1 }, // right
  5: { q: -1, r: 1 }, // lower-right
  6: { q: -1, r: 0 }, // lower-left
};

export const SIDE_NAME: Readonly<Record<Side, string>> = {
  1: "left",
  2: "upper-left",
  3: "upper-right",
  4: "right",
  5: "lower-right",
  6: "lower-left",
};

export function coord(q: number, r: number): Coord {
  return { q, r };
}

export function add(a: Coord, b: Coord): Coord {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function scale(a: Coord, k: number): Coord {
  return { q: a.q * k, r: a.r * k };
}

export function equals(a: Coord, b: Coord): boolean {
  return a.q === b.q && a.r === b.r;
}

/** Stable string key, "q,r". */
export function key(c: Coord): string {
  return `${c.q},${c.r}`;
}

/** Inverse of key(). */
export function fromKey(k: string): Coord {
  const [q, r] = k.split(",").map(Number);
  if (q === undefined || r === undefined || Number.isNaN(q) || Number.isNaN(r)) {
    throw new Error(`bad coordinate key "${k}"`);
  }
  return { q, r };
}

/** Human form used by the rules and test files: "(q,r)". */
export function show(c: Coord): string {
  return `(${c.q},${c.r})`;
}

export function isSide(n: number): n is Side {
  return Number.isInteger(n) && n >= 1 && n <= 6;
}

export function isFacing(n: number): n is Facing {
  return Number.isInteger(n) && n >= 0 && n <= 5;
}

/** Opposite sides are 1-4, 2-5 and 3-6 (3.8). */
export function opposite(s: Side): Side {
  return (((s - 1 + 3) % 6) + 1) as Side;
}

/** The neighbouring coordinate on side s (may be a gap or off the Field). */
export function neighbourCoord(p: Coord, s: Side): Coord {
  return add(p, SIDE_OFFSET[s]);
}

/**
 * Facing (3.8): a printed arrow on side s of a tile with facing f points to
 * side ((s - 1 + f) mod 6) + 1.
 */
export function rotateSide(printed: Side, f: Facing): Side {
  return (((printed - 1 + f) % 6) + 1) as Side;
}

/** Turning clockwise by n sides adds n to f; six turns is a full turn (3.8, unit file E10). */
export function turnClockwise(f: Facing, n = 1): Facing {
  return ((((f + n) % 6) + 6) % 6) as Facing;
}

/** Actual sides a tile's printed arrows point to at facing f, in printed order. */
export function arrowSides(printed: readonly Side[], f: Facing): Side[] {
  return printed.map((s) => rotateSide(s, f));
}

/** The three row kinds (3.8 table "Rows"). */
export type RowKind = "horizontal" | "rising" | "falling";

export const ROW_KINDS: readonly RowKind[] = ["horizontal", "rising", "falling"];

/** Which sides each row runs along (3.8). */
export const ROW_SIDES: Readonly<Record<RowKind, readonly [Side, Side]>> = {
  horizontal: [1, 4],
  rising: [3, 6],
  falling: [2, 5],
};

/** The value that is constant along a row of the given kind. */
export function rowValue(kind: RowKind, c: Coord): number {
  switch (kind) {
    case "horizontal":
      return c.q; // same q
    case "rising":
      return c.r; // same r
    case "falling":
      return c.q + c.r; // same q + r
  }
}

/** The row kind running along side s. */
export function rowKindOfSide(s: Side): RowKind {
  if (s === 1 || s === 4) return "horizontal";
  if (s === 3 || s === 6) return "rising";
  return "falling";
}
