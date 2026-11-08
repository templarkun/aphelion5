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

export type GameEventBody =
  /** A unit went from one sector to another (Move, Teleport, Jump...). */
  | { kind: "moved"; tile: TileId; unitId: string; from: SectorKey; to: SectorKey; how: "move" | "teleport" }
  | { kind: "swapped"; a: TileId; b: TileId; from: SectorKey; to: SectorKey }
  /** The top tile of a Dark sector was flipped face up (8.5). */
  | { kind: "revealed"; tile: TileId; unitId: string; type: string; sector: SectorKey }
  /** A hit landed (6.1): `damage` Damage tokens placed, `shields` Shield or Bio-shield tokens removed; or a Barrier stopped it. */
  | { kind: "hit"; tile: TileId; unitId: string; type: string; sector: SectorKey; amount: number; damage: number; shields: number; stopped?: "barrier" }
  /** A unit was destroyed (3.3): it left the Field, or stayed as a Wreck (4.8). */
  | { kind: "destroyed"; tile: TileId; unitId: string; type: string; sector: SectorKey; wreck: boolean }
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
