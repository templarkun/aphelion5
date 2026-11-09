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
import type { GameEvent } from "./events.js";

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
  /**
   * Trial rule "Flare energy waits" (designer 2026-11-07, open question I2):
   * the energy a revealed Flare gave, waiting on it until its Alert is resolved.
   */
  energy?: Record<EnergyColour, number>;
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

/** One mission you completed (Core Rules 10.3: each of its Threat columns scores 1). */
export interface MissionResult {
  mission: string;
  threat: string[];
}

/** A high score field on the Campaign board (10.3): the score and the date written in. */
export interface HighScore {
  score: number;
  date: string;
}

/**
 * What outlives a game (spec "Saving"): every Company sheet's upgrade marks
 * (Veteran campaigns, Allied Drops) and the high scores per Campaign.
 */
export interface Profile {
  /** Slots marked per upgrade, per Company. */
  sheets: Record<string, Record<string, number>>;
  /** Per Campaign: the plain field (Fresh) and the starred field (Veteran). */
  highScores: Record<string, { fresh?: HighScore; veteran?: HighScore }>;
}

export function emptyProfile(): Profile {
  return { sheets: {}, highScores: {} };
}

/** The Campaign under way (7.1, 7.2, 10.1, 10.3). */
export interface CampaignRun {
  freshness: "fresh" | "veteran";
  /** Missions completed, in order. */
  completed: MissionResult[];
  /** Alternative routes not taken (7.2 step 1). */
  skipped: string[];
  /** This mission's Threat columns (7.2 step 3). */
  threat: string[];
  /** Written into a high score field (the engine never reads the clock). */
  date: string;
}

/** Game End (10.3). */
export interface Ending {
  score: number;
  /** Plain-words lines adding up to the score. */
  parts: string[];
  /** Which high score field was written, if any. */
  highScore?: "fresh" | "veteran";
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
    /** Slots marked per upgrade, including partly filled ones (10.2). */
    marks: Record<string, number>;
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
  outcome?: { result: "lost" | "conceded" | "won"; reason: string };
  /** The Campaign under way. */
  run: CampaignRun;
  /** Company sheets and high scores (copied in at the start, updated at Game End). */
  profile: Profile;
  /** Set once Game End has been scored. */
  ending?: Ending;
  /** Face-down tiles the player has looked at (spec: "remember tiles the player has looked at"). */
  seen: TileId[];
  /** Goes up whenever new hidden information appears (Reveal, look, draw, shuffle): the undo limit. */
  hiddenInfo: number;
  settings: {
    /** Answer questions that have exactly one legal answer automatically (spec "Player choices"). */
    autoAnswer: boolean;
    heatModule: boolean;
    /**
     * Trial rule (designer 2026-11-07, I2; Core Rules unchanged): a revealed
     * Flare's energy waits on it and is placed when its Alert is resolved.
     * Optional so older saves and scenarios read as off.
     */
    trialFlareEnergy?: boolean;
    /**
     * Games saved before 2026-11-08 (format 5 or older): with the trial rule, a
     * Power Node still asks energy or 3 Heat when revealed (H4). Newer games ask
     * it when its Alert is resolved (designer 2026-11-08).
     */
    powerNodeAtReveal?: boolean;
    /** Games saved before format 7: the trial rule above was a choice at setup (since 2026-11-09 always on). */
    flareEnergyChoice?: boolean;
    /** Core Rules as printed: a Mecha may Attack a Mecha (games saved before 2026-11-08 only; the computer version forbids it). */
    mechaAttacksMecha?: boolean;
    /** Screen trial (designer 2026-11-09): a ready Alert shown as a beacon light and radar ping, not a token and pulsing rim. */
    alertBeacon?: boolean;
    /** Developer mode: a game played with it never records a high score (spec "Developer mode"). */
    developerMode: boolean;
  };
  log: LogEntry[];
  /** Recent changes on the board, for the screen's animations (engine events; optional for older states). */
  events?: GameEvent[];
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
