/**
 * Mecha abilities: base abilities from the unit file (M_01, M_02, M_05,
 * M_07; the Passives of M_03, M_04 and M_06 live in engine/mecha.ts, as part
 * of the Attack) and the Mecha upgrades of Companies V1 and V2.
 */

import { type Effect, type RunCtx, ask, log } from "../engine/effect.js";
import { canBeChosen, choosableUnits, describe, fieldMap, level, sectorKeys, sectorOf, sectorState, stack, tile, unitAt, unitDef, unitType } from "../engine/field.js";
import { hasUpgrade, setAfterMechaHit } from "../engine/mecha.js";
import { bury, isOpenSector, move, openNeighbours, reveal, teleport } from "../engine/moves.js";
import { type TileId, hasAnyToken } from "../engine/state.js";
import { afterTopTileLeaves, dealHit } from "../engine/tokens.js";
import { SIDES, type Side, fromKey, key } from "../geometry/hex.js";
import { chooseSector } from "./helpers.js";
import { adjacentTo, chooseOneOf, hitEach, lineOfFireUnits } from "./kit.js";
import { registerAbility } from "./registry.js";

const here = (c: RunCtx, self: TileId) => sectorOf(c.state, self)!;

/**
 * M_01 - Command: Move to an adjacent Dark sector (a Cleared sector may be used: glossary "Dark sector").
 * V1_M01_U1 improves it: it may also move on top of a Mecha that has no tokens.
 */
registerAbility("M_01", function* (c, self) {
  const m = self!;
  const onMecha = hasUpgrade(c, m, "V1_M01_U1")
    ? adjacentTo(c, here(c, m)).filter((u) => unitType(c, u) === "Mecha" && canBeChosen(c, u) && !hasAnyToken(tile(c.state, u).tokens)).map((u) => sectorOf(c.state, u)!)
    : [];
  const to = yield* chooseSector(c, "M_01: move to which adjacent sector?", "M_01", [...openNeighbours(c, m), ...onMecha]);
  if (to === undefined) return;
  if (!onMecha.includes(to)) {
    move(c, m, to, "M_01");
    return;
  }
  // On top of a token-free Mecha (V1_M01_U1): that Mecha is now beneath it, not a unit.
  const from = here(c, m);
  const st = stack(c.state, from);
  st.splice(st.indexOf(m), 1);
  stack(c.state, to).push(m);
  log(c, `M_01 moves from (${from}) on top of the Mecha in (${to})`, "V1_M01_U1");
  afterTopTileLeaves(c, from);
});

/** M_02 - Expend: Deal 1 damage to all units in its lines of fire. */
registerAbility("M_02", function* (c, self) {
  yield* hitEach(c, lineOfFireUnits(c, self!), 1, "M_02");
});

/**
 * M_05 - Command: Jump. [1] Choose one of the six directions in which the adjacent sector holds a unit.
 * [2] Follow that line past every consecutive sector that holds a unit (Flares and Wrecks count).
 * [3] If the next sector is Dark or Cleared, put this Mecha there (on top). A gap or off the Field: not possible that way.
 */
export function jumpLandings(c: RunCtx, self: TileId): { side: Side; to: string }[] {
  const out: { side: Side; to: string }[] = [];
  const p = fromKey(here(c, self));
  for (const side of SIDES) {
    const ray = fieldMap(c.state).ray(p, side);
    let i = 0;
    while (i < ray.length && ray[i]!.onMap && unitAt(c.state, key(ray[i]!.at)) !== undefined) i++;
    if (i === 0) continue; // the adjacent sector holds no unit
    const next = ray[i];
    if (next && next.onMap && isOpenSector(c, key(next.at))) out.push({ side, to: key(next.at) });
  }
  return out;
}
registerAbility("M_05", function* (c, self) {
  const options = jumpLandings(c, self!);
  if (options.length === 0) {
    log(c, "M_05: no direction to Jump", "M_05");
    return;
  }
  const to = yield* chooseSector(c, "M_05: Jump to which sector?", "M_05", [...new Set(options.map((o) => o.to))]);
  if (to !== undefined) teleport(c, self!, to, "M_05");
});

/**
 * M_07 - Expend: [1] Deal 1 damage to an adjacent Level 1 unit. [2] You may then deal 1 damage to a Level 2 unit adjacent
 * to that unit's sector. [3] If you did, you may then deal 1 damage to a Level 3 unit adjacent to the sector of the unit damaged in [2].
 * "Adjacent to that unit's sector" is measured from the sector even if the hit destroyed it.
 */
registerAbility("M_07", function* (c, self) {
  const lvl = (n: number) => (u: TileId) => canBeChosen(c, u) && level(c, u) === n;
  const first = yield* chooseOneOf(c, "M_07: deal 1 damage to which adjacent Level 1 unit?", "M_07", adjacentTo(c, here(c, self!)).filter(lvl(1)));
  if (first === undefined) return;
  let k = sectorOf(c.state, first)!;
  yield* dealHit(c, first, 1, "M_07");
  for (const n of [2, 3]) {
    const options = adjacentTo(c, k).filter(lvl(n));
    if (options.length === 0) return log(c, `M_07: no Level ${n} unit adjacent to (${k})`, "M_07");
    const a = yield* ask(c, { kind: "units", prompt: `M_07: you may deal 1 damage to a Level ${n} unit adjacent to (${k}).`, rule: "M_07", options, min: 0, max: 1 });
    const u = (a.value as TileId[])[0];
    if (u === undefined) return;
    k = sectorOf(c.state, u)!;
    yield* dealHit(c, u, 1, "M_07");
  }
});

/** V1_M02_U1 - Command: Turn this Mecha to face any direction. */
registerAbility("V1_M02_U1", function* (c, self) {
  const t = tile(c.state, self!);
  const a = yield* ask(c, { kind: "option", prompt: "V1_M02_U1: turn M_02 to which facing?", rule: "V1_M02_U1", options: [0, 1, 2, 3, 4, 5].map((f) => ({ id: String(f), label: f === t.facing ? `${f} (as now)` : String(f) })) });
  t.facing = Number(a.value) as 0;
  log(c, `M_02 now faces ${t.facing}`, "V1_M02_U1");
});

/** V1_M02_U2 - [Overload] Command: Teleport to any Dark sector. (A Cleared sector may be used.) */
registerAbility("V1_M02_U2", function* (c, self) {
  const to = yield* chooseSector(c, "V1_M02_U2: teleport to which Dark sector?", "V1_M02_U2", sectorKeys(c.state).filter((k) => isOpenSector(c, k)));
  if (to !== undefined) teleport(c, self!, to, "V1_M02_U2");
});

/** V1_M03_U2 - [Overload] Expend: Deal 1 damage to one adjacent unit. V1_M03_U3 improves it: also 1 damage to one other adjacent unit. */
registerAbility("V1_M03_U2", function* (c, self) {
  const k = here(c, self!);
  const n = hasUpgrade(c, self!, "V1_M03_U3") ? 2 : 1;
  const done: TileId[] = [];
  for (let i = 0; i < n; i++) {
    const u = yield* chooseOneOf(c, `V1_M03_U2: deal 1 damage to ${i === 0 ? "one" : "one other"} adjacent unit.`, "V1_M03_U2", adjacentTo(c, k).filter((x) => canBeChosen(c, x) && !done.includes(x)));
    if (u === undefined) return;
    done.push(u);
    yield* dealHit(c, u, 1, "V1_M03_U2");
  }
});

/** V1_M04_U1 - Expend: Deal 2 damage to any single unit. */
registerAbility("V1_M04_U1", function* (c, self) {
  const u = yield* chooseOneOf(c, "V1_M04_U1: deal 2 damage to which unit?", "V1_M04_U1", choosableUnits(c, (x) => x !== self));
  if (u === undefined) return;
  const hit = yield* dealHit(c, u, 2, "V1_M04_U1");
  yield* m04Reveal(c, self!, hit);
});

/**
 * V1_M04_U2 - Passive: When this Mecha destroys a unit, you may Reveal the tile that was underneath it. If it is a Bot,
 * deal 1 damage to it. V1_M04_U2A: 2 damage instead of 1. V1_M04_U2B: any type, not only a Bot.
 * "Underneath it": only when the destroyed unit left its sector (not a Wreck) and the tile now on top is face down.
 */
function* m04Reveal(c: RunCtx, mecha: TileId, hit: import("../engine/tokens.js").HitResult): Effect {
  if (hit.kind !== "damaged" || !hit.destroyed || hit.destroyed.wreck) return;
  if (unitDef(c, mecha).id !== "M_04" || !hasUpgrade(c, mecha, "V1_M04_U2")) return;
  const k = hit.destroyed.sector;
  if (sectorState(c.state, k) !== "dark") return log(c, `V1_M04_U2: nothing face down underneath in (${k})`, "V1_M04_U2");
  const a = yield* ask(c, { kind: "yesno", prompt: `V1_M04_U2: Reveal the tile underneath, in (${k})?`, rule: "V1_M04_U2" });
  if (a.value !== true) return;
  const u = yield* reveal(c, k, "V1_M04_U2");
  const anyType = hasUpgrade(c, mecha, "V1_M04_U2B");
  if ((anyType || unitType(c, u) === "Bot") && canBeChosen(c, u)) yield* dealHit(c, u, hasUpgrade(c, mecha, "V1_M04_U2A") ? 2 : 1, "V1_M04_U2");
}
setAfterMechaHit(m04Reveal);

/** V2_M1 - Every Mecha gains: "Command: If this Mecha has no tokens, Bury it." */
registerAbility("V2_M1", function* (c, self) {
  if (hasAnyToken(tile(c.state, self!).tokens)) return log(c, `${describe(c, self!)} has tokens: no Bury`, "V2_M1");
  bury(c, self!, "V2_M1");
});

/** V2_M1A - Every Mecha gains: "Command: Bury this Mecha." */
registerAbility("V2_M1A", function* (c, self) {
  bury(c, self!, "V2_M1A");
});

