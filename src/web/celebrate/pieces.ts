/**
 * The mission celebrations (designer 2026-11-20): two kinds of piece, built separately.
 *
 * - The kill: the moment the last required Omega unit is destroyed (it becomes a Wreck, 4.8), the
 *   6th of 8 Alphas in Mission 1. Centred on the unit, on the Field. Two taps skip it.
 * - The win: the moment the mission is won by 8.2 (the objective checked before a Command phase
 *   action). Over the Field and the Mission bar, before the Upgrade sheet. Two taps skip it.
 *
 * When both come in one answer, the kill plays first and the win goes on from it.
 *
 * Several pieces are planned per kind: for Eliminate (an Alpha, a Beta more spectacular, a Gamma
 * more still) and for Salvage. Which one plays (I19, designer 2026-11-20): one at random each
 * mission, the same one again if the save is reloaded (from the game's seed and the mission, never
 * the game's own random numbers). Screen only: nothing here is a rule.
 *
 * Built so far: two kills for Alpha (I21), one for Beta; Mission Complete for Alpha and, until a win of
 * their own is built, Beta missions (I22). Gamma and Salvage missions: nothing yet.
 */

export interface Piece {
  id: string;
  name: string;
  /** What it celebrates: Omega types of Eliminate missions ("Alpha", "Beta", "Gamma"), or "Salvage". */
  for: readonly string[];
}

/** Kills: the last required Omega unit destroyed. */
export const KILL_PIECES: Piece[] = [
  { id: "alphaDown", name: "Alpha Down", for: ["Alpha"] },
  { id: "alphaPurge", name: "Alpha Purge", for: ["Alpha"] },
  { id: "betaBreach", name: "Beta Breach", for: ["Beta"] },
];

/** Wins: the mission won. */
export const WIN_PIECES: Piece[] = [{ id: "missionComplete", name: "Mission Complete", for: ["Alpha", "Beta"] }];

/** A small fixed hash (FNV-1a) of a text. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * I19: one of the pieces for this mission, the same for the same game (its seed) and mission. `force`:
 * that piece, if it fits (the previews in System options).
 */
export function pickPiece(list: readonly Piece[], forWhat: string, seed: number, mission: string, kind: "kill" | "win", force?: string): Piece | undefined {
  const fits = list.filter((p) => p.for.includes(forWhat));
  const forced = force ? fits.find((p) => p.id === force) : undefined;
  if (forced) return forced;
  if (fits.length === 0) return undefined;
  return fits[hash(`${kind}|${seed}|${mission}`) % fits.length];
}
