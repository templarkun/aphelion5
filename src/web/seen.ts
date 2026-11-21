import type { GameState } from "../engine/state.js";

/**
 * The face-down tiles of a sector the player has looked at (designer 2026-11-21, round 24), top
 * first, down to the deepest one looked at; the ones in between not looked at shown as "?". A Dark
 * sector counts from its top tile, a unit's sector from the tile under the unit.
 */
export function seenInSector(state: GameState, sector: string): { tile: string; unitId?: string | undefined; label: string }[] {
  const st = state.field[sector] ?? [];
  const top = st.at(-1);
  if (!top) return [];
  const dark = !state.tiles[top]!.faceUp;
  const down = (dark ? st : st.slice(0, -1)).slice().reverse();
  const known = (t: string) => state.seen.includes(t) && !state.tiles[t]!.faceUp;
  let last = -1;
  down.forEach((t, i) => {
    if (known(t)) last = i;
  });
  const nth = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;
  return down.slice(0, last + 1).map((t, i) => ({
    tile: t,
    unitId: known(t) || state.tiles[t]!.faceUp ? (state.tiles[t]!.unitId ?? undefined) : undefined,
    label: dark ? (i === 0 ? "Top" : nth(i + 1)) : `${nth(i + 1)} beneath`,
  }));
}
