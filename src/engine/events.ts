/**
 * Engine events (Program Spec "Interaction and animation" > "How it is built").
 *
 * Besides the log text, the engine reports each change on the board as an
 * event, so the screen can animate it. Events are written by the building
 * blocks (move, swap, reveal, hit, destroy, energy placed); they change no
 * rule. They live in the state next to the log, each with a running number
 * (`seq`), and only the most recent ones are kept.
 */

import type { Ctx } from "./field.js";
import type { EnergyColour } from "../data/units.js";
import type { SectorKey, TileId } from "./state.js";
import type { FuseKind } from "./rules.js";

export type GameEventBody =
  /** A unit went from one sector to another (Move, Teleport, Jump...). */
  | { kind: "moved"; tile: TileId; unitId: string; from: SectorKey; to: SectorKey; how: "move" | "teleport"; rule?: string }
  | { kind: "swapped"; a: TileId; b: TileId; from: SectorKey; to: SectorKey; rule?: string }
  /** The top tile of a Dark sector was flipped face up (8.5). */
  | { kind: "revealed"; tile: TileId; unitId: string; type: string; sector: SectorKey }
  /** A hit landed (6.1): `damage` Damage tokens placed, `shields` Shield or Bio-shield tokens removed; or a Barrier stopped it. */
  | { kind: "hit"; tile: TileId; unitId: string; type: string; sector: SectorKey; amount: number; damage: number; shields: number; stopped?: "barrier"; rule?: string }
  /**
   * A Bay, an Order or a Module starts its effect (8.6, 8.7). `rule` is what its hits and moves name as
   * their rule, so the screen can draw them from it (Program Spec "Weapon and aura looks").
   */
  | { kind: "used"; what: "bay" | "order" | "module"; rule: string; bay?: number; module?: number; colour?: EnergyColour; text: string }
  /** A unit was destroyed (3.3): it left the Field, or stayed as a Wreck (4.8). */
  | { kind: "destroyed"; tile: TileId; unitId: string; type: string; sector: SectorKey; wreck: boolean }
  /** A Mecha Attacks (4.2): reported before the hit, so the screen can show the Mecha go first. */
  | { kind: "attack"; tile: TileId; unitId: string; from: SectorKey; target: TileId; to: SectorKey }
  /** Your Flagship is about to take damage (5.2), from `rule` (a unit's id, a Fuse token...). Shown before the Bays are chosen. */
  | { kind: "flagship"; amount: number; rule: string }
  /**
   * A unit acts (designer 2026-11-09, for its particle effect): a Sleeper wakes (4.4, no Dark sector
   * left: `wake`) or its Alert is resolved (`alert`); a Gyro is drained (4.3, `drain`), before its effect.
   */
  | { kind: "activated"; tile: TileId; unitId: string; type: string; sector: SectorKey; how: "wake" | "alert" | "drain" }
  /** A Fuse token goes off (6.6), before its effect. */
  | { kind: "fuse"; tile: TileId; unitId: string; sector: SectorKey; fuse: FuseKind }
  /** Heat tokens paid back to the Supply (H5, H7). */
  | { kind: "heat"; amount: number; rule: string }
  /** H7 Meltdown happens: no Heat token left to prevent it. `bots`: Bots it hits. */
  | { kind: "meltdown"; bots: number }
  /** The player looked at face-down tiles (a Bay, a Module...): shown to them, in this order (top first). */
  | { kind: "looked"; rule?: string; tiles: { tile: TileId; unitId: string; sector?: SectorKey | undefined }[] }
  /** One energy went onto a Module (4.6, 5.3). `auto`: it went there by itself (only one Module could take it). */
  | { kind: "energy"; colour: EnergyColour; module: number; from?: TileId | undefined; auto: boolean };

export type GameEvent = GameEventBody & { seq: number };

/** How many recent events the state keeps (enough for the longest single answer). */
const KEEP = 400;

export function emit(c: Ctx, e: GameEventBody): void {
  const list = (c.state.events ??= []);
  const seq = (list[list.length - 1]?.seq ?? 0) + 1;
  list.push({ ...e, seq } as GameEvent);
  if (list.length > KEEP) list.splice(0, list.length - KEEP);
}

/** The events in `after` that are newer than everything in `before` (none when going back, as after Undo). */
export function newEvents(before: readonly GameEvent[] | undefined, after: readonly GameEvent[] | undefined): GameEvent[] {
  const last = before?.[before.length - 1]?.seq ?? 0;
  return (after ?? []).filter((e) => e.seq > last);
}
