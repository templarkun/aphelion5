/**
 * The one seeded random generator (spec "Randomness"). Its whole state is
 * four 32-bit numbers kept in the game state, so a saved game replays
 * exactly. Algorithm: sfc32, seeded through splitmix32.
 */

export interface RngState {
  seed: number;
  s: [number, number, number, number];
}

function splitmix32(a: number): () => number {
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let z = a;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export function newRng(seed: number): RngState {
  const sm = splitmix32(seed >>> 0);
  const st: RngState = { seed: seed >>> 0, s: [sm(), sm(), sm(), sm()] };
  for (let i = 0; i < 12; i++) nextUint32(st); // warm up
  return st;
}

/** Advances the generator in place; returns a whole number 0 .. 2^32 - 1. */
export function nextUint32(st: RngState): number {
  let [a, b, c, d] = st.s;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  st.s = [a, b, c, d];
  return t >>> 0;
}

/** A whole number from 0 to n - 1, without bias. */
export function nextInt(st: RngState, n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new Error(`nextInt: bad range ${n}`);
  const limit = Math.floor(0x100000000 / n) * n;
  for (;;) {
    const x = nextUint32(st);
    if (x < limit) return x % n;
  }
}

/** Shuffles the array in place (Fisher-Yates) and returns it. */
export function shuffle<T>(st: RngState, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(st, i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
