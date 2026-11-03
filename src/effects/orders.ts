/** Campaign 1 Orders (Campaign board) and mission Orders (mission briefings), from Campaign1.txt. */

import { type RunCtx, ask, log } from "../engine/effect.js";
import { choosableUnits, fieldMap, level, sectorKeys, sectorOf, tile, unitAt, unitType } from "../engine/field.js";
import { isOpenSector, swap, teleport } from "../engine/moves.js";
import type { TileId } from "../engine/state.js";
import { dealHit, destroy, placeFuse } from "../engine/tokens.js";
import { fromKey, key } from "../geometry/hex.js";
import { chooseSector, chooseUnit } from "./helpers.js";
import { registerAbility } from "./registry.js";

/** Deal `n` damage to every unit matching `filter`: one hit each; Flares and Wrecks skipped (6.1, 4.6, 4.8). Units counted when it starts (E4). */
function* damageAll(c: RunCtx, n: number, rule: string, filter: (u: TileId) => boolean = () => true) {
  const targets = choosableUnits(c, filter);
  for (const u of targets) yield* dealHit(c, u, n, rule);
}

// C1_ORDER_1 - [Overload] Teleport a Mecha to a Dark sector.
registerAbility("C1_ORDER_1", function* (c) {
  const m = yield* chooseUnit(c, "Teleport which Mecha?", "C1_ORDER_1", (u) => unitType(c, u) === "Mecha");
  if (m === undefined) return;
  const to = yield* chooseSector(c, "Teleport it to which Dark sector?", "C1_ORDER_1", sectorKeys(c.state).filter((k) => isOpenSector(c, k)));
  if (to !== undefined) teleport(c, m, to, "C1_ORDER_1");
});

// C1_ORDER_2 - [Overload] Swap a Mecha with another unit.
registerAbility("C1_ORDER_2", function* (c) {
  const m = yield* chooseUnit(c, "Swap which Mecha?", "C1_ORDER_2", (u) => unitType(c, u) === "Mecha" && choosableUnits(c).length > 1);
  if (m === undefined) return;
  const o = yield* chooseUnit(c, "Swap it with which unit?", "C1_ORDER_2", (u) => u !== m);
  if (o !== undefined) swap(c, m, o, "C1_ORDER_2");
});

// C1_M1 and C1_M4Y - 4 Command tokens: Deal 1 damage to all units.
for (const id of ["C1_M1_ORDER", "C1_M4Y_ORDER"]) registerAbility(id, (c) => damageAll(c, 1, id));

// C1_M2Y - 2 Command tokens: Destroy one Level 2 Bot.
registerAbility("C1_M2Y_ORDER", function* (c) {
  const u = yield* chooseUnit(c, "Destroy which Level 2 Bot?", "C1_M2Y_ORDER", (x) => unitType(c, x) === "Bot" && level(c, x) === 2);
  if (u !== undefined) destroy(c, u, "C1_M2Y_ORDER");
});

// C1_M3 - 2 Command tokens: Deal 2 damage to all Gyros.
registerAbility("C1_M3_ORDER", (c) => damageAll(c, 2, "C1_M3_ORDER", (u) => unitType(c, u) === "Gyro"));

// C1_M4X - [Overload] 1 Command token: Swap two units.
registerAbility("C1_M4X_ORDER", function* (c) {
  const a = yield* chooseUnit(c, "Swap which unit?", "C1_M4X_ORDER", () => choosableUnits(c).length > 1);
  if (a === undefined) return;
  const b = yield* chooseUnit(c, "Swap it with which unit?", "C1_M4X_ORDER", (u) => u !== a);
  if (b !== undefined) swap(c, a, b, "C1_M4X_ORDER");
});

// C1_M5 - 2 Command tokens: Take an Anomaly card.
registerAbility("C1_M5_ORDER", function* (c) {
  const card = c.state.decks.anomalies.shift();
  if (card === undefined) {
    log(c, "the Anomaly deck is empty", "6.7");
    return;
  }
  c.state.player.anomalies.push(card);
  c.state.hiddenInfo += 1;
  log(c, `take Anomaly card ${card}`, "C1_M5_ORDER");
});

// C1_M6 - 2 Command tokens: Deal 1 damage to all damaged units in one horizontal row.
registerAbility("C1_M6_ORDER", function* (c) {
  const rows = fieldMap(c.state).allRows("horizontal");
  const a = yield* ask(c, {
    kind: "option",
    prompt: "Choose a horizontal row.",
    rule: "C1_M6_ORDER",
    options: rows.map((r) => ({ id: String(r.value), label: `row q = ${r.value}` })),
  });
  const row = rows.find((r) => String(r.value) === a.value)!;
  const inRow = new Set(row.sectors.map(key));
  yield* damageAll(c, 1, "C1_M6_ORDER", (u) => inRow.has(sectorOf(c.state, u)!) && tile(c.state, u).tokens.damage > 0);
});

// C1_M7 - 4 Command tokens: Place a Tick on every unit adjacent to one Gamma unit.
registerAbility("C1_M7_ORDER", function* (c) {
  const g = yield* chooseUnit(c, "Choose a Gamma unit.", "C1_M7_ORDER", (u) => tile(c.state, u).unitId === "O_03");
  if (g === undefined) return;
  const around = fieldMap(c.state)
    .adjacent(fromKey(sectorOf(c.state, g)!))
    .map((n) => unitAt(c.state, key(n)))
    .filter((u): u is TileId => u !== undefined && choosableUnits(c).includes(u));
  for (const u of around) placeFuse(c, u, "tick", "C1_M7_ORDER");
});
