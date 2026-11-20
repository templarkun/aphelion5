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
 */

export interface Piece {
  id: string;
  name: string;
  /** What it celebrates: the Omega type of an Eliminate mission ("Alpha", "Beta", "Gamma"), or "Salvage". */
  for: string;
}

/** Kills: the last required Omega unit destroyed. */
export const KILL_PIECES: Piece[] = [{ id: "alphaDown", name: "Alpha Down", for: "Alpha" }];

/** Wins: the mission won. */
export const WIN_PIECES: Piece[] = [{ id: "missionComplete", name: "Mission Complete", for: "Alpha" }];

/** A small fixed hash (FNV-1a) of a text. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** I19: one of the pieces for this mission, the same for the same game (its seed) and mission. */
export function pickPiece(list: readonly Piece[], forWhat: string, seed: number, mission: string, kind: "kill" | "win"): Piece | undefined {
  const fits = list.filter((p) => p.for === forWhat);
  if (fits.length === 0) return undefined;
  return fits[hash(`${kind}|${seed}|${mission}`) % fits.length];
}
