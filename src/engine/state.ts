/**
 * The game state (spec "Game state"): one serialisable object holds the
 * whole game. Derived facts (Strength, Dark sectors, units in a row) are
 * always computed from it, never stored.
 *
 * Tiles have their own ids ("S_12#2" = the second copy of S_12), so a tile
 * can be followed from deck to Field to Discard.
 */

import type { EnergyColour } from "../data/units.js";
import type { Coord, Facing } from "../geometry/hex.js";
import type { RngState } from "./rng.js";
import type { FuseKind, LimitedToken } from "./rules.js";

export type TileId = string;
export type SectorKey = string; // "q,r"

/** Tokens on one tile. Only a face-up top tile (a unit) ever holds any (Core Rules 6). */
export interface Tokens {
  damage: number;
  shield: number;
  bioShield: number;
  /** A unit holds at most one Barrier (6.4) and one Alert (6.5). */
  barrier: boolean;
  alert: boolean;
  /** Wreck marker (4.8). */
  wreck: boolean;
  tick: number;
  mortar: number;
  feedback: number;
}

export interface TileState {
  id: TileId;
  /** Unit id from the unit file, or null for a scenario's face-down tile of no stated contents. */
  unitId: string | null;
  faceUp: boolean;
  /** 0-5; 0 = as printed (3.8). Kept by every move except Reveal and Place. */
  facing: Facing;
  tokens: Tokens;
}

export type Phase = "setup" | "preparation" | "command" | "overload" | "overloadEnd" | "missionEnd" | "gameEnd";

export interface ModuleState {
  id: number;
  ready: boolean;
  energy: Record<EnergyColour, number>;
}

export interface LogEntry {
  text: string;
  /** Rule reference, e.g. "6.4". */
  rule?: string;
}

export interface GameState {
  formatVersion: 1;
  rng: RngState;
  phase: Phase;
  /** Campaign prefix ("C1") and mission id ("C1_M1"). */
  campaign: string;
  mission: string;
  /** Map sectors, in the mission file's order. */
  map: Coord[];
  /** Per sector, its stack bottom to top (last = top tile). */
  field: Record<SectorKey, TileId[]>;
  tiles: Record<TileId, TileState>;
  piles: {
    missionDeck: TileId[];
    energyDeck: TileId[];
    discard: TileId[];
    trophy: TileId[];
    /** The box of unused tiles. */
    supply: TileId[];
  };
  supply: Record<LimitedToken, number> & { energy: Record<EnergyColour, number>; heat: number };
  player: {
    company: string;
    reserve: Record<EnergyColour, number>;
    modules: ModuleState[];
    anomalies: string[];
    commandTokens: number;
    heat: number;
  };
  /** Integrity per Bay, Bay 1 first. */
  flagship: number[];
  /** What is written on the Company sheet (Core Rules 5.1, 10.2). */
  sheet: {
    /** Upgrades fully filled. */
    filled: string[];
    overhaulUsed: number;
    /** Upgrade points written on the Upgrade track, spent at Mission End (10.2). */
    upgradePoints: number;
    /** Ally Company id, once chosen (7.3). */
    ally?: string;
  };
  decks: {
    /** Module deck, top first. */
    modules: number[];
    /** Anomaly deck, top first. */
    anomalies: string[];
  };
  /** A Flare was revealed (or an effect said so) in the Command phase: the Overload starts when the current effect finishes (9.1). */
  overloadPending: boolean;
  /** Set when the game is over. */
  outcome?: { result: "lost" | "conceded"; reason: string };
  /** Face-down tiles the player has looked at (spec: "remember tiles the player has looked at"). */
  seen: TileId[];
  /** Goes up whenever new hidden information appears (Reveal, look, draw, shuffle): the undo limit. */
  hiddenInfo: number;
  settings: {
    /** Answer questions that have exactly one legal answer automatically (spec "Player choices"). */
    autoAnswer: boolean;
    heatModule: boolean;
  };
  log: LogEntry[];
}

export function noTokens(): Tokens {
  return { damage: 0, shield: 0, bioShield: 0, barrier: false, alert: false, wreck: false, tick: 0, mortar: 0, feedback: 0 };
}

export function hasAnyToken(t: Tokens): boolean {
  return t.damage + t.shield + t.bioShield + t.tick + t.mortar + t.feedback > 0 || t.barrier || t.alert || t.wreck;
}

export function fuseCount(t: Tokens, k: FuseKind): number {
  return t[k];
}
