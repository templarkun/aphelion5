/**
 * A mission map: the set of sectors that make up the Field (Core Rules 3.1).
 * Everything here is pure shape - no tiles, no units. Which sectors hold a
 * unit, are Dark or Cleared is game state (stage 2); geometry never needs it,
 * because lines and rows continue across gaps, Dark and Cleared sectors (3.6).
 */

import {
  type Coord,
  type Facing,
  type RowKind,
  type Side,
  ROW_KINDS,
  SIDES,
  SIDE_OFFSET,
  add,
  arrowSides,
  key,
  neighbourCoord,
  rowValue,
  scale,
  show,
} from "./hex.js";

export interface Row {
  kind: RowKind;
  /** The constant: q (horizontal), r (rising) or q + r (falling). */
  value: number;
  /** Map sectors on the row, ordered along the row (left to right / bottom to top). */
  sectors: Coord[];
}

export class FieldMap {
  /** Sectors in the order the map lists them. */
  readonly sectors: readonly Coord[];
  private readonly set: ReadonlySet<string>;
  private readonly minQ: number;
  private readonly maxQ: number;
  private readonly minR: number;
  private readonly maxR: number;

  constructor(sectors: readonly Coord[]) {
    const seen = new Set<string>();
    for (const c of sectors) {
      const k = key(c);
      if (seen.has(k)) throw new Error(`map lists ${show(c)} twice`);
      seen.add(k);
    }
    if (sectors.length === 0) throw new Error("map has no sectors");
    this.sectors = sectors.map((c) => ({ q: c.q, r: c.r }));
    this.set = seen;
    this.minQ = Math.min(...sectors.map((c) => c.q));
    this.maxQ = Math.max(...sectors.map((c) => c.q));
    this.minR = Math.min(...sectors.map((c) => c.r));
    this.maxR = Math.max(...sectors.map((c) => c.r));
  }

  get size(): number {
    return this.sectors.length;
  }

  /** Is this coordinate a sector of the map (not a gap, not off the Field)? */
  has(c: Coord): boolean {
    return this.set.has(key(c));
  }

  /** The neighbour on side s, or undefined if it is a gap or off the Field (3.8). */
  neighbour(p: Coord, s: Side): Coord | undefined {
    const n = neighbourCoord(p, s);
    return this.has(n) ? n : undefined;
  }

  /** All sides of p with their neighbour (undefined where there is none). */
  neighboursBySide(p: Coord): Record<Side, Coord | undefined> {
    return {
      1: this.neighbour(p, 1),
      2: this.neighbour(p, 2),
      3: this.neighbour(p, 3),
      4: this.neighbour(p, 4),
      5: this.neighbour(p, 5),
      6: this.neighbour(p, 6),
    };
  }

  /** Adjacent sectors of p, in side order 1-6 (3.5: gaps break adjacency). */
  adjacent(p: Coord): Coord[] {
    this.assertOnMap(p);
    const out: Coord[] = [];
    for (const s of SIDES) {
      const n = this.neighbour(p, s);
      if (n) out.push(n);
    }
    return out;
  }

  /** Two sectors are adjacent when one is a neighbour of the other and both are on the map. */
  areAdjacent(a: Coord, b: Coord): boolean {
    if (!this.has(a) || !this.has(b)) return false;
    return SIDES.some((s) => {
      const n = neighbourCoord(a, s);
      return n.q === b.q && n.r === b.r;
    });
  }

  /**
   * The raw step sequence from p towards side s: P + D, P + 2D, ... while the
   * step is still inside the map's bounding box. Includes gaps (as
   * `onMap: false`). Used by anything that must notice gaps on a line, such as
   * the M_05 Jump.
   */
  ray(p: Coord, s: Side): { at: Coord; onMap: boolean }[] {
    const d = SIDE_OFFSET[s];
    const out: { at: Coord; onMap: boolean }[] = [];
    for (let k = 1; ; k++) {
      const at = add(p, scale(d, k));
      if (!this.inBounds(at)) break;
      out.push({ at, onMap: this.has(at) });
    }
    return out;
  }

  /**
   * Line of fire from p towards side s (3.6, 3.8): every map sector
   * P + D, P + 2D, ... - skipping gaps, never including P.
   */
  lineOfFire(p: Coord, s: Side): Coord[] {
    return this.ray(p, s)
      .filter((x) => x.onMap)
      .map((x) => x.at);
  }

  /** The Targeted sector for an arrow pointing to side s: P + D if on the map (3.8). */
  targeted(p: Coord, s: Side): Coord | undefined {
    return this.neighbour(p, s);
  }

  /** Actual sides, Targeted sectors and lines of fire for a tile's printed arrows at facing f. */
  arrows(p: Coord, printed: readonly Side[], f: Facing): { printed: Side; side: Side; targeted: Coord | undefined; lineOfFire: Coord[] }[] {
    this.assertOnMap(p);
    const actual = arrowSides(printed, f);
    return printed.map((ps, i) => {
      const side = actual[i]!;
      return { printed: ps, side, targeted: this.targeted(p, side), lineOfFire: this.lineOfFire(p, side) };
    });
  }

  /** The row of the given kind through p: every map sector meeting its condition (3.8). */
  row(p: Coord, kind: RowKind): Row {
    this.assertOnMap(p);
    const value = rowValue(kind, p);
    const sectors = this.sectors.filter((c) => rowValue(kind, c) === value);
    // Order along the row: horizontal by r, rising by q, falling by q (bottom to top).
    const ord = kind === "horizontal" ? (c: Coord) => c.r : (c: Coord) => c.q;
    sectors.sort((a, b) => ord(a) - ord(b));
    return { kind, value, sectors };
  }

  /** The three rows through p ("a row through this unit", 3.6). */
  rowsThrough(p: Coord): Row[] {
    return ROW_KINDS.map((k) => this.row(p, k));
  }

  /** Every row of the map of one kind, ordered by its constant. */
  allRows(kind: RowKind): Row[] {
    const values = [...new Set(this.sectors.map((c) => rowValue(kind, c)))].sort((a, b) => a - b);
    return values.map((v) => {
      const first = this.sectors.find((c) => rowValue(kind, c) === v)!;
      return this.row(first, kind);
    });
  }

  /**
   * "A sector in a straight line from a unit" (3.8): any map sector P + kD for
   * any of the six steps D and any k >= 1. Returned by side, nearest first.
   */
  straightLines(p: Coord): Record<Side, Coord[]> {
    this.assertOnMap(p);
    return {
      1: this.lineOfFire(p, 1),
      2: this.lineOfFire(p, 2),
      3: this.lineOfFire(p, 3),
      4: this.lineOfFire(p, 4),
      5: this.lineOfFire(p, 5),
      6: this.lineOfFire(p, 6),
    };
  }

  /** Is b in a straight line from a? */
  inStraightLine(a: Coord, b: Coord): boolean {
    return Object.values(this.straightLines(a)).some((line) => line.some((c) => c.q === b.q && c.r === b.r));
  }

  /** Is every sector reachable from every other through adjacency? */
  isConnected(): boolean {
    const start = this.sectors[0]!;
    const seen = new Set<string>([key(start)]);
    const todo: Coord[] = [start];
    while (todo.length > 0) {
      const c = todo.pop()!;
      for (const n of this.adjacent(c)) {
        const k = key(n);
        if (!seen.has(k)) {
          seen.add(k);
          todo.push(n);
        }
      }
    }
    return seen.size === this.sectors.length;
  }

  private inBounds(c: Coord): boolean {
    return c.q >= this.minQ && c.q <= this.maxQ && c.r >= this.minR && c.r <= this.maxR;
  }

  private assertOnMap(p: Coord): void {
    if (!this.has(p)) throw new Error(`${show(p)} is not a sector of this map`);
  }
}
