/**
 * The fixed board for the first playable build (spec "Build stages", stage 4).
 *
 * Mission 1's map and objective (Eliminate 6 Alpha units, C1_M1), Company
 * V1, played with only the cards built so far, so nothing in the game can
 * stop on a card that is not built yet:
 *
 *   mission deck: 30 Bots (10 each of B_01, B_02, B_03), 10 M_01, 8 O_01,
 *     3 F_01 (Power Node), 2 F_04, 1 F_13, 2 S_01, 2 S_12, 1 P_05, and
 *     6 Energy Gyros from the top of the shuffled Energy deck (G_00);
 *   Modules: Demolition Blast (Yellow, Command phase) and Charged Beam
 *     (Red, Overload); the Module deck is empty, so an Overhaul takes none;
 *   4 Anomaly cards (3 at setup, 1 at Mission Preparation) from the full,
 *     shuffled Anomaly deck;
 *   V1 starting energy 6 Yellow, 6 Red, 6 Blue; 6 Command tokens.
 *
 * Mission Preparation itself is stage 7. Here the deck is shuffled with the
 * game's seed and dealt round-robin in map order (Core Rules 7.2 step 5: the
 * first sectors in map order take the extra tiles, instead of asking).
 * There is no Allied Drop yet.
 */

import type { GameData } from "../data/index.js";
import { ENERGY_COLOURS } from "../data/units.js";
import { shuffle } from "./rng.js";
import { addTile, newMissionState } from "./scenario.js";
import type { GameState } from "./state.js";

export const FIXED_DECK: readonly [string, number][] = [
  ["B_01", 10],
  ["B_02", 10],
  ["B_03", 10],
  ["M_01", 10],
  ["O_01", 8],
  ["F_01", 3],
  ["F_04", 2],
  ["F_13", 1],
  ["S_01", 2],
  ["S_12", 2],
  ["P_05", 1],
];
export const FIXED_ENERGY_GYROS = 6;
export const FIXED_MODULES = [1, 26] as const;
export const FIXED_ANOMALIES = 4;

export function fixedBoard(data: GameData, seed = 1): GameState {
  const s = newMissionState(data, { campaign: "C1", mission: "C1_M1", company: "V1", seed });
  const co = data.companies.byId.get("V1")!;

  // Energy deck: every Energy Gyro, shuffled face down (7.1 step 6).
  const energy: string[] = [];
  for (const u of data.units.units) if (u.energyGyro) for (let i = 0; i < u.copies; i++) energy.push(addTile(s, u.id, false));
  s.piles.energyDeck = shuffle(s.rng, energy);

  // Mission deck.
  const deck: string[] = [];
  for (const [id, n] of FIXED_DECK) for (let i = 0; i < n; i++) deck.push(addTile(s, id, false));
  for (let i = 0; i < FIXED_ENERGY_GYROS; i++) deck.push(s.piles.energyDeck.shift()!);
  const dealt = shuffle(s.rng, deck);
  const sectors = Object.keys(s.field);
  dealt.forEach((t, i) => s.field[sectors[i % sectors.length]!]!.push(t));

  // Anomaly cards.
  s.decks.anomalies = shuffle(
    s.rng,
    data.anomalies.anomalies.map((a) => a.id),
  );
  s.player.anomalies = s.decks.anomalies.splice(0, FIXED_ANOMALIES);

  // Modules, energy, Command tokens.
  s.player.modules = FIXED_MODULES.map((id) => ({ id, ready: true, energy: { Yellow: 0, Red: 0, Blue: 0 } }));
  for (const col of ENERGY_COLOURS) {
    s.player.reserve[col] = co.startingEnergy[col];
    s.supply.energy[col] -= co.startingEnergy[col];
  }
  s.player.commandTokens = 6;
  s.supply.command -= 6;
  s.hiddenInfo += 1;
  s.log.push({ text: `fixed board, seed ${seed}: Mission 1 map, ${dealt.length} tiles dealt`, rule: "7.2" });
  return s;
}
