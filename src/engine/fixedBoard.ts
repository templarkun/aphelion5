/**
 * The fixed board for text play (spec "Build stages", stage 4; updated in
 * stage 5 once every unit is built).
 *
 * Mission 1 (C1_M1): its map, objective (Eliminate 6 Alpha units) and
 * Order; Company V1. The mission deck is built as Core Rules 7.1 and 7.2 say:
 * 30 Bots, V1's starting Mecha (10 M_01, 5 M_02, 6 M_03, 6 M_04), the
 * Mission 1 Deployment (8 O_01, 3 F_01, 2 F_24, 2 P_15, 2 G_20, 2 G_22 and
 * 6 G_00 from the top of the shuffled Energy deck) and Threat column A
 * (S_12, S_12, F_08, G_22): Threat Level Patrol.
 *
 * Modules (stage 6): the Module deck is shuffled and you keep the first two
 * of each colour (7.1 step 8); the rest stay in the deck for Overhauls.
 * Still fixed until stage 7 (Campaign): no Module draw at Mission
 * Preparation (7.2 step 6, a choice); 4 Anomaly cards from the shuffled
 * Anomaly deck; V1 starting energy 6/6/6; 6 Command tokens. The deck is dealt round-robin in map order (the first
 * sectors take the extra tiles, instead of asking, 7.2 step 5). No Allied Drop.
 */

import type { GameData } from "../data/index.js";
import { ENERGY_COLOURS } from "../data/units.js";
import { shuffle } from "./rng.js";
import { addTile, newMissionState } from "./scenario.js";
import type { GameState } from "./state.js";

export const FIXED_THREAT_COLUMN = "A" as const;
export const FIXED_ANOMALIES = 4;

/** The fixed board's mission deck before dealing: [unit id, copies]; "G_00" = from the Energy deck. */
export function fixedDeck(data: GameData): [string, number][] {
  const m = data.campaigns.find((c) => c.prefix === "C1")!.missionById.get("C1_M1")!;
  const co = data.companies.byId.get("V1")!;
  const out: [string, number][] = [
    ["B_01", 10],
    ["B_02", 10],
    ["B_03", 10],
  ];
  for (const x of co.startingMecha) out.push([x.id, x.count]);
  for (const t of m.deploymentShuffled) out.push([t.id, t.count]);
  for (const id of m.threat[FIXED_THREAT_COLUMN]) out.push([id, 1]);
  return out;
}

export function fixedBoard(data: GameData, seed = 1): GameState {
  const s = newMissionState(data, { campaign: "C1", mission: "C1_M1", company: "V1", seed });
  const co = data.companies.byId.get("V1")!;

  // Energy deck: every Energy Gyro, shuffled face down (7.1 step 6).
  const energy: string[] = [];
  for (const u of data.units.units) if (u.energyGyro) for (let i = 0; i < u.copies; i++) energy.push(addTile(s, u.id, false));
  s.piles.energyDeck = shuffle(s.rng, energy);

  // Mission deck (7.1 step 5, 7.2 steps 2-3).
  const deck: string[] = [];
  for (const [id, n] of fixedDeck(data)) {
    for (let i = 0; i < n; i++) {
      if (id === data.units.energyDeckPlaceholder) {
        const g = s.piles.energyDeck.shift();
        if (g !== undefined) deck.push(g);
      } else deck.push(addTile(s, id, false));
    }
  }
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
  // Starting Modules (7.1 step 8): reveal one at a time, keep the first two of each colour; the others go to the bottom.
  const deckM = shuffle(s.rng, data.modules.modules.map((m) => m.id));
  const keep: number[] = [];
  const rest: number[] = [];
  for (const id of deckM) {
    const col = data.modules.byId.get(id)!.colour;
    if (keep.filter((k) => data.modules.byId.get(k)!.colour === col).length < 2) keep.push(id);
    else rest.push(id);
  }
  s.decks.modules = rest;
  s.player.modules = keep.map((id) => ({ id, ready: true, energy: { Yellow: 0, Red: 0, Blue: 0 } }));
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
