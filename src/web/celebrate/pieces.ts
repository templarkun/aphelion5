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
 * Built so far: six kills for Alpha (I21; Rail Strike and Alpha Erased 2026-11-27; Burnout and Tether Rip 2026-11-28), three for Beta (Barrage and Cryo Shatter 2026-11-27), three for Gamma (I26; Dimensional Shatter 2026-11-21).
 * Wins (designer 2026-11-21): Mission Complete, Perimeter Sweep and Sector Flip; Chain Surge and Beacon Spiral
 * (designer 2026-11-27); for every mission won
 * (Eliminate Alpha, Beta, Gamma, and Salvage), one picked at random each mission. A lost or conceded game
 * has none.
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
  // Designer 2026-11-27: two more for Alpha.
  { id: "alphaRail", name: "Rail Strike", for: ["Alpha"] },
  { id: "alphaErase", name: "Alpha Erased", for: ["Alpha"] },
  // Designer 2026-11-28: two more for Alpha.
  { id: "alphaBurnout", name: "Burnout", for: ["Alpha"] },
  { id: "alphaTether", name: "Tether Rip", for: ["Alpha"] },
  { id: "betaBreach", name: "Beta Breach", for: ["Beta"] },
  // Designer 2026-11-27: two more for Beta (more spectacular than Alpha's).
  { id: "betaBarrage", name: "Barrage", for: ["Beta"] },
  { id: "betaCryo", name: "Cryo Shatter", for: ["Beta"] },
  { id: "gammaHorizon", name: "Event Horizon", for: ["Gamma"] },
  { id: "gammaArray", name: "Field Array", for: ["Gamma"] },
  { id: "gammaShatter", name: "Dimensional Shatter", for: ["Gamma"] },
];

/**
 * Salvage milestones (designer 2026-11-22), played on the Field like the kills: "Power Nodes" when the
 * fifth Power Node reaches the Trophy pile, "Cleared" when the third Cleared sector appears with 5 Power
 * Nodes already taken (8.2).
 */
export const SALVAGE_PIECES: Piece[] = [
  { id: "salvageNodes", name: "Grid Online", for: ["Power Nodes"] },
  { id: "salvageCleared", name: "Sector Lock", for: ["Cleared"] },
  // Designer 2026-11-27: two more for the fifth Power Node.
  { id: "salvageFusion", name: "Fusion Ignition", for: ["Power Nodes"] },
  { id: "salvageCascade", name: "Charge Cascade", for: ["Power Nodes"] },
  // Designer 2026-11-27: two more for the third Cleared sector.
  { id: "salvageClaim", name: "Claim Markers", for: ["Cleared"] },
  { id: "salvageSurvey", name: "Terrain Survey", for: ["Cleared"] },
];

const EVERY_MISSION = ["Alpha", "Beta", "Gamma", "Salvage"] as const;
/** Wins: the mission won. Every win plays for every mission won (designer 2026-11-21: Eliminate Alpha, Beta, Gamma and Salvage), one picked at random (I19). */
export const WIN_PIECES: Piece[] = [
  { id: "missionComplete", name: "Mission Complete", for: EVERY_MISSION },
  { id: "perimeterSweep", name: "Perimeter Sweep", for: EVERY_MISSION },
  { id: "sectorFlip", name: "Sector Flip", for: EVERY_MISSION },
  // Designer 2026-11-27: two more, for every mission won.
  { id: "chainSurge", name: "Chain Surge", for: EVERY_MISSION },
  { id: "beaconSpiral", name: "Beacon Spiral", for: EVERY_MISSION },
  { id: "resonance", name: "Resonance", for: EVERY_MISSION },
  { id: "murmuration", name: "Murmuration", for: EVERY_MISSION },
  { id: "singularity", name: "Singularity", for: EVERY_MISSION },
  { id: "armillary", name: "Armillary", for: EVERY_MISSION },
  { id: "aurora", name: "Aurora", for: EVERY_MISSION },
  { id: "circuitTrace", name: "Circuit Trace", for: EVERY_MISSION },
];

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
