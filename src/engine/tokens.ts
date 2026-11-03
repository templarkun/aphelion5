/**
 * Token building blocks (spec "Effects"). Each one carries the rules about
 * it, so a card effect built from them cannot forget a rule.
 *
 * Core Rules: 3.3 Strength, 3.4 top tile leaves, 4.4 Sleepers, 4.6 Flares,
 * 4.8 Wrecks, 5.2 Flagship, 5.4 Energy, 6.1-6.7 tokens.
 */

import { ENERGY_COLOURS, type EnergyColour, type UnitType } from "../data/units.js";
import { fromKey, key } from "../geometry/hex.js";
import { type Effect, type RunCtx, ask, asEffect, defer, log } from "./effect.js";
import {
  type Ctx,
  canBeChosen,
  darkSectors,
  describe,
  destroyedEffect,
  fieldMap,
  isFlare,
  isUnit,
  isWreck,
  sectorOf,
  stack,
  strength,
  tile,
  topTileId,
  unitAt,
  unitDef,
  unitType,
  units,
} from "./field.js";
import { FEEDBACK_DAMAGE, FUSE_KINDS, FUSE_NAME, type FuseKind, MORTAR_DAMAGE, TICK_DAMAGE } from "./rules.js";
import { type SectorKey, type TileId, type Tokens, noTokens } from "./state.js";

// ---------------------------------------------------------------------------
// Supply and the Flagship
// ---------------------------------------------------------------------------

/** Return every limited token on a tile to the Supply and clear it (6: tokens leave with the unit). */
export function returnTokens(c: Ctx, id: TileId): void {
  const t = tile(c.state, id).tokens;
  const s = c.state.supply;
  s.shield += t.shield;
  s.bioShield += t.bioShield;
  s.barrier += t.barrier ? 1 : 0;
  s.tick += t.tick;
  s.mortar += t.mortar;
  s.feedback += t.feedback;
  // Damage, Alert and Wreck markers are unlimited (Core Rules 2): nothing to count.
  tile(c.state, id).tokens = noTokens();
}

export function printedIntegrity(c: Ctx): number[] {
  const co = c.data.companies.byId.get(c.state.player.company);
  if (!co) throw new Error(`unknown Company ${c.state.player.company}`);
  return co.bays.map((b) => b.integrity);
}

/** Crippled: every Bay at 0 Integrity (5.2). */
export function isCrippled(c: Ctx): boolean {
  return c.state.flagship.every((x) => x === 0);
}

/**
 * Damage to your Flagship (5.2): assign each point to any Bay with Integrity
 * left, split as you like. Damage to a Crippled Flagship is ignored.
 */
export function* damageFlagship(c: RunCtx, n: number, rule = "5.2"): Effect {
  if (n <= 0) return;
  if (isCrippled(c)) {
    log(c, `Flagship is Crippled: ${n} damage ignored`, "5.2");
    return;
  }
  const f = c.state.flagship;
  const total = Math.min(n, f.reduce((a, b) => a + b, 0));
  const a = yield* ask(c, {
    kind: "split",
    prompt: `Your Flagship takes ${total} damage. Assign it to Bays.`,
    rule,
    total,
    buckets: f.flatMap((x, i) => (x > 0 ? [{ id: `bay${i + 1}`, label: `Bay ${i + 1}`, max: x }] : [])),
  });
  const split = a.value as Record<string, number>;
  const parts: string[] = [];
  for (const [b, x] of Object.entries(split)) {
    if (x === 0) continue;
    const i = Number(b.slice(3)) - 1;
    f[i]! -= x;
    parts.push(`Bay ${i + 1} ${x}`);
  }
  log(c, `Flagship takes ${total} (${parts.join(", ")})${total < n ? `; ${n - total} ignored` : ""}`, rule);
  if (isCrippled(c)) log(c, "Flagship is Crippled", "5.2");
}

/** Repair your Flagship (5.2): restore Integrity, split as you like, never above printed values. */
export function* repairFlagship(c: RunCtx, n: number, rule = "5.2"): Effect {
  if (n <= 0) return;
  const printed = printedIntegrity(c);
  const f = c.state.flagship;
  const missing = printed.map((p, i) => p - f[i]!);
  const total = Math.min(n, missing.reduce((a, b) => a + b, 0));
  if (total === 0) {
    log(c, "Flagship has no damage to remove", rule);
    return;
  }
  const a = yield* ask(c, {
    kind: "split",
    prompt: `Remove ${total} damage from your Flagship. Choose Bays.`,
    rule,
    total,
    buckets: missing.flatMap((m, i) => (m > 0 ? [{ id: `bay${i + 1}`, label: `Bay ${i + 1}`, max: m }] : [])),
  });
  for (const [b, x] of Object.entries(a.value as Record<string, number>)) f[Number(b.slice(3)) - 1]! += x;
  log(c, `Flagship repaired by ${total}`, rule);
}

// ---------------------------------------------------------------------------
// Energy (5.4)
// ---------------------------------------------------------------------------

/** Gain energy into your Reserve. No colour named: you choose (5.4). Limited by the Supply (6.7). */
export function* gainEnergy(c: RunCtx, n: number, colour?: EnergyColour, rule = "5.4"): Effect {
  const s = c.state.supply.energy;
  const r = c.state.player.reserve;
  if (colour) {
    const x = Math.min(n, s[colour]);
    s[colour] -= x;
    r[colour] += x;
    log(c, `gain ${x} ${colour} energy${x < n ? ` (${n - x} not in the Supply)` : ""}`, rule);
    return;
  }
  const total = Math.min(n, ENERGY_COLOURS.reduce((a, k) => a + s[k], 0));
  if (total === 0) return;
  const a = yield* ask(c, {
    kind: "split",
    prompt: `Gain ${total} energy. Choose colours.`,
    rule,
    total,
    buckets: ENERGY_COLOURS.filter((k) => s[k] > 0).map((k) => ({ id: k, label: k, max: s[k] })),
  });
  for (const [k, x] of Object.entries(a.value as Record<EnergyColour, number>)) {
    s[k as EnergyColour] -= x;
    r[k as EnergyColour] += x;
  }
  log(c, `gain ${total} energy`, rule);
}

/** Lose energy from your Reserve: you choose colours; not enough = lose all (5.4). */
export function* loseEnergy(c: RunCtx, n: number, colour?: EnergyColour, rule = "5.4"): Effect {
  const s = c.state.supply.energy;
  const r = c.state.player.reserve;
  if (colour) {
    const x = Math.min(n, r[colour]);
    r[colour] -= x;
    s[colour] += x;
    log(c, `lose ${x} ${colour} energy`, rule);
    return;
  }
  const total = Math.min(n, ENERGY_COLOURS.reduce((a, k) => a + r[k], 0));
  if (total === 0) return;
  const a = yield* ask(c, {
    kind: "split",
    prompt: `Lose ${total} energy. Choose colours.`,
    rule,
    total,
    buckets: ENERGY_COLOURS.filter((k) => r[k] > 0).map((k) => ({ id: k, label: k, max: r[k] })),
  });
  for (const [k, x] of Object.entries(a.value as Record<EnergyColour, number>)) {
    r[k as EnergyColour] -= x;
    s[k as EnergyColour] += x;
  }
  log(c, `lose ${total} energy`, rule);
}

// ---------------------------------------------------------------------------
// The Field: tiles leaving, uncovering, Sleepers
// ---------------------------------------------------------------------------

/**
 * Sleeper trigger (4.4): while there are no Dark sectors, every Sleeper unit
 * without an Alert token gets one. Call after anything that changes a top tile.
 */
export function checkSleepers(c: Ctx): void {
  if (darkSectors(c.state).length > 0) return;
  for (const u of units(c.state)) {
    if (unitType(c, u) === "Sleeper" && !tile(c.state, u).tokens.alert) {
      tile(c.state, u).tokens.alert = true;
      log(c, `no Dark sectors: ${describe(c, u)} is alerted`, "4.4");
    }
  }
}

/** After the top unit of a sector leaves it (3.4). */
export function afterTopTileLeaves(c: Ctx, k: SectorKey): void {
  const top = topTileId(c.state, k);
  if (top === undefined) log(c, `(${k}) is Cleared`, "3.4");
  else if (tile(c.state, top).faceUp) log(c, `${describe(c, top)} is uncovered`, "3.4");
  else log(c, `(${k}) is Dark`, "3.4");
  checkSleepers(c);
}

/** Take a tile off the Field into a pile. Tokens go back to the Supply. */
function removeFromField(c: Ctx, id: TileId, pile: "discard" | "trophy"): SectorKey {
  const k = sectorOf(c.state, id);
  if (k === undefined) throw new Error(`${id} is not on the Field`);
  const st = stack(c.state, k);
  st.splice(st.indexOf(id), 1);
  returnTokens(c, id);
  c.state.piles[pile].push(id);
  return k;
}

function pileFor(c: Ctx, id: TileId): "discard" | "trophy" {
  return unitType(c, id) === "Omega" ? "trophy" : "discard";
}

// ---------------------------------------------------------------------------
// Destroy and Wrecks (3.3, 4.8)
// ---------------------------------------------------------------------------

/** A destroyed unit's values just before it was destroyed (3.3). */
export interface DestroyedInfo {
  tile: TileId;
  unitId: string;
  type: UnitType;
  sector: SectorKey;
  strength: number | undefined;
  tokens: Tokens;
  /** True if it became a Wreck (it has a Destroyed effect). */
  wreck: boolean;
}

/**
 * Destroy a unit (glossary: not damage; Barriers do not stop it).
 * With a Destroyed effect it becomes a Wreck (4.8); otherwise it leaves:
 * Omega units to the Trophy pile, everything else to the Discard.
 * Flares and Wrecks cannot be destroyed (4.6, 4.8): returns undefined.
 */
export function destroy(c: Ctx, id: TileId, rule = "glossary", strengthBefore?: number): DestroyedInfo | undefined {
  if (!isUnit(c.state, id)) return undefined;
  if (isFlare(c, id) || isWreck(c, id)) {
    log(c, `${describe(c, id)} cannot be destroyed`, isFlare(c, id) ? "4.6" : "4.8");
    return undefined;
  }
  const k = sectorOf(c.state, id)!;
  const info: DestroyedInfo = {
    tile: id,
    unitId: unitDef(c, id).id,
    type: unitType(c, id),
    sector: k,
    strength: strengthBefore ?? strength(c, id),
    tokens: { ...tile(c.state, id).tokens },
    wreck: destroyedEffect(c, id) !== undefined,
  };
  if (info.wreck) {
    returnTokens(c, id);
    const t = tile(c.state, id).tokens;
    t.alert = true;
    t.wreck = true;
    log(c, `${describe(c, id)} is destroyed and becomes a Wreck`, "4.8");
  } else {
    const pile = pileFor(c, id);
    log(c, `${describe(c, id)} is destroyed (to the ${pile === "trophy" ? "Trophy pile" : "Discard"})`, rule);
    removeFromField(c, id, pile);
    afterTopTileLeaves(c, k);
  }
  return info;
}

/** After a Wreck's Destroyed effect resolves: return its marker and remove it (4.8 step 3). */
export function removeWreck(c: Ctx, id: TileId): void {
  if (!isWreck(c, id)) throw new Error(`${id} is not a Wreck`);
  const pile = pileFor(c, id);
  log(c, `Wreck ${describe(c, id)} goes to the ${pile === "trophy" ? "Trophy pile" : "Discard"}`, "4.8");
  const k = removeFromField(c, id, pile);
  afterTopTileLeaves(c, k);
}

// ---------------------------------------------------------------------------
// Hits (6.1, 6.3, 6.4)
// ---------------------------------------------------------------------------

export type HitResult =
  | { kind: "ignored" } // Flare, Wreck or not a unit
  | { kind: "cancelled" } // a Barrier took it
  | { kind: "damaged"; shieldsRemoved: number; bioShieldsRemoved: number; damagePlaced: number; destroyed?: DestroyedInfo };

/**
 * Deal one hit of `amount` damage to a unit (6.1).
 * Order: Barrier cancels the whole hit (6.4); else each point removes a
 * Shield or Bio-shield (you choose which first, 6.3) and the rest become
 * Damage (3.3); at Strength 0 the unit is destroyed. Each Bio-shield removed
 * deals its own 1 damage once the current effect has finished (6.3).
 */
export function* dealHit(c: RunCtx, id: TileId, amount: number, rule = "6.1"): Effect<HitResult> {
  if (!Number.isInteger(amount) || amount < 1) {
    // OPEN QUESTION (designer): is a "hit" of 0 a hit (does it use up a Barrier)? See docs/open-questions.md Q1.
    throw new Error(`dealHit: amount must be 1 or more, got ${amount}`);
  }
  if (!isUnit(c.state, id) || isFlare(c, id) || isWreck(c, id)) {
    log(c, `${describe(c, id)} cannot be damaged`, isUnit(c.state, id) && isFlare(c, id) ? "4.6" : "4.8");
    return { kind: "ignored" };
  }
  const t = tile(c.state, id).tokens;
  if (t.barrier) {
    t.barrier = false;
    c.state.supply.barrier += 1;
    log(c, `the Barrier on ${describe(c, id)} cancels a hit of ${amount}`, "6.4");
    return { kind: "cancelled" };
  }
  const before = strength(c, id)!;
  const removed = Math.min(amount, t.shield + t.bioShield);
  const lo = Math.max(0, removed - t.shield);
  const hi = Math.min(t.bioShield, removed);
  let bio = lo;
  if (hi > lo) {
    const a = yield* ask(c, {
      kind: "amount",
      prompt: `${describe(c, id)} loses ${removed} Shield tokens. How many of them are Bio-shields?`,
      rule: "6.3",
      min: lo,
      max: hi,
    });
    bio = a.value as number;
  }
  const shields = removed - bio;
  t.shield -= shields;
  t.bioShield -= bio;
  c.state.supply.shield += shields;
  c.state.supply.bioShield += bio;
  const dmg = amount - removed;
  t.damage += dmg;
  const parts = [shields && `${shields} Shield`, bio && `${bio} Bio-shield`, dmg && `${dmg} Damage`].filter(Boolean);
  log(c, `${describe(c, id)} takes a hit of ${amount}: ${parts.join(", ")}; Strength ${strength(c, id)}`, rule);

  const k = sectorOf(c.state, id)!;
  const type = unitType(c, id);
  for (let i = 0; i < bio; i++) deferBioShield(c, k, type, id);

  const result: HitResult = { kind: "damaged", shieldsRemoved: shields, bioShieldsRemoved: bio, damagePlaced: dmg };
  if (strength(c, id)! <= 0) {
    const info = destroy(c, id, "3.3", before);
    if (info) result.destroyed = info;
  }
  return result;
}

/**
 * Bio-shield Destroyed effect (6.3): deal 1 damage to one unit adjacent to
 * the unit it was on, of the same type. Measured from that unit's sector and
 * type at the moment the Bio-shield was removed (3.3: values just before).
 */
function deferBioShield(c: RunCtx, k: SectorKey, type: UnitType, carrier: TileId): void {
  defer(c, {
    id: `bioshield:${carrier}`,
    label: `Bio-shield from ${tile(c.state, carrier).unitId} in (${k}): 1 damage to an adjacent ${type}`,
    run: function* (rc) {
      const options = fieldMap(rc.state)
        .adjacent(fromKey(k))
        .map((n) => unitAt(rc.state, key(n)))
        .filter((u): u is TileId => u !== undefined && canBeChosen(rc, u) && unitType(rc, u) === type);
      if (options.length === 0) {
        log(rc, `Bio-shield from (${k}): no adjacent ${type} to damage`, "6.3");
        return;
      }
      const a = yield* ask(rc, { kind: "units", prompt: `Bio-shield: deal 1 damage to an adjacent ${type}.`, rule: "6.3", options, min: 1, max: 1 });
      yield* dealHit(rc, (a.value as TileId[])[0]!, 1, "6.3");
    },
  });
}

// ---------------------------------------------------------------------------
// Boost and Shields (6.2, 6.3)
// ---------------------------------------------------------------------------

/**
 * Boost each of these units once (6.2). A damaged unit loses a Damage token
 * instead of gaining a Shield (3.3). Flares, Wrecks and non-units are
 * skipped with no Flagship damage. For each Shield missing from the Supply
 * your Flagship takes 1 damage; when Shields run short, you choose which
 * units get the ones left (11.1 rule 2).
 */
export function* boost(c: RunCtx, ids: readonly TileId[], rule = "6.2"): Effect {
  const targets = ids.filter((u) => {
    const ok = isUnit(c.state, u) && !isFlare(c, u) && !isWreck(c, u);
    if (!ok && isUnit(c.state, u)) log(c, `${describe(c, u)} cannot be Boosted`, "6.2");
    return ok;
  });
  const needShield: TileId[] = [];
  for (const u of targets) {
    const t = tile(c.state, u).tokens;
    if (t.damage > 0) {
      t.damage -= 1;
      log(c, `Boost ${describe(c, u)}: 1 Damage removed; Strength ${strength(c, u)}`, rule);
    } else needShield.push(u);
  }
  let get = needShield;
  const have = c.state.supply.shield;
  if (needShield.length > have) {
    get = [];
    if (have > 0) {
      const a = yield* ask(c, {
        kind: "units",
        prompt: `Only ${have} Shield token${have === 1 ? "" : "s"} left. Which units get ${have === 1 ? "it" : "them"}?`,
        rule: "6.2",
        options: needShield,
        min: have,
        max: have,
      });
      get = a.value as TileId[];
    }
  }
  for (const u of get) {
    tile(c.state, u).tokens.shield += 1;
    c.state.supply.shield -= 1;
    log(c, `Boost ${describe(c, u)}: 1 Shield; Strength ${strength(c, u)}`, rule);
  }
  const missing = needShield.length - get.length;
  if (missing > 0) {
    log(c, `no Shield token left for ${missing} Boost${missing === 1 ? "" : "s"}: Flagship damage instead`, "6.2");
    yield* damageFlagship(c, missing, "6.2");
  }
}

/** Place a Bio-shield (6.3). On a damaged unit it just cancels one Damage and returns to the Supply. */
export function placeBioShield(c: Ctx, id: TileId): boolean {
  if (!isUnit(c.state, id) || isFlare(c, id) || isWreck(c, id)) return false;
  const t = tile(c.state, id).tokens;
  if (c.state.supply.bioShield === 0) {
    log(c, `no Bio-shield left for ${describe(c, id)}`, "6.7");
    return false;
  }
  if (t.damage > 0) {
    t.damage -= 1;
    log(c, `Bio-shield on ${describe(c, id)} cancels 1 Damage and returns to the Supply`, "6.3");
    return true;
  }
  t.bioShield += 1;
  c.state.supply.bioShield -= 1;
  log(c, `${describe(c, id)} gets a Bio-shield; Strength ${strength(c, id)}`, "6.3");
  return true;
}

// ---------------------------------------------------------------------------
// Barriers, Alerts, Fuse tokens (6.4-6.6)
// ---------------------------------------------------------------------------

/** One Barrier per unit; none left in the Supply = none placed (6.4, 6.7). */
export function placeBarrier(c: Ctx, id: TileId, rule = "6.4"): boolean {
  if (!isUnit(c.state, id) || isFlare(c, id) || isWreck(c, id)) return false;
  const t = tile(c.state, id).tokens;
  if (t.barrier) return false;
  if (c.state.supply.barrier === 0) {
    log(c, `no Barrier left for ${describe(c, id)}`, "6.7");
    return false;
  }
  t.barrier = true;
  c.state.supply.barrier -= 1;
  log(c, `${describe(c, id)} gets a Barrier`, rule);
  return true;
}

export function removeBarrier(c: Ctx, id: TileId, rule = "6.4"): boolean {
  if (!isUnit(c.state, id) || isFlare(c, id) || isWreck(c, id)) return false;
  const t = tile(c.state, id).tokens;
  if (!t.barrier) return false;
  t.barrier = false;
  c.state.supply.barrier += 1;
  log(c, `${describe(c, id)} loses its Barrier`, rule);
  return true;
}

/** One Alert per unit (6.5). Flares and Wrecks may hold their own Alert. Returns false if it already had one. */
export function placeAlert(c: Ctx, id: TileId, rule = "6.5"): boolean {
  if (!isUnit(c.state, id)) return false;
  const t = tile(c.state, id).tokens;
  if (t.alert) return false;
  t.alert = true;
  log(c, `${describe(c, id)} gets an Alert token`, rule);
  return true;
}

/**
 * An effect removes an Alert token: the waiting effect is cancelled (6.5).
 * Never works on Flares or Wrecks.
 */
export function cancelAlert(c: Ctx, id: TileId, rule = "6.5"): boolean {
  if (!isUnit(c.state, id) || isFlare(c, id) || isWreck(c, id)) return false;
  const t = tile(c.state, id).tokens;
  if (!t.alert) return false;
  t.alert = false;
  log(c, `${describe(c, id)} loses its Alert token; its effect is cancelled`, rule);
  return true;
}

/** Place a Fuse token (6.6). Never on Flares or Wrecks; limited by the Supply (6.7). */
export function placeFuse(c: Ctx, id: TileId, kind: FuseKind, rule = "6.6"): boolean {
  if (!isUnit(c.state, id) || isFlare(c, id) || isWreck(c, id)) return false;
  if (c.state.supply[kind] === 0) {
    log(c, `no ${FUSE_NAME[kind]} left for ${describe(c, id)}`, "6.7");
    return false;
  }
  tile(c.state, id).tokens[kind] += 1;
  c.state.supply[kind] -= 1;
  log(c, `${describe(c, id)} gets a ${FUSE_NAME[kind]}`, rule);
  return true;
}

/**
 * Overload End step 1 (6.6, 9.3): Fuse tokens go off one at a time, in the
 * order you choose. Each is its own effect. A token whose unit has left the
 * Field or become a Wreck has already returned to the Supply.
 */
export function* setOffFuses(c: RunCtx): Effect {
  for (;;) {
    const items: { id: string; label: string; tile: TileId; kind: FuseKind }[] = [];
    for (const u of units(c.state)) {
      if (isWreck(c, u)) continue;
      for (const k of FUSE_KINDS) {
        if (tile(c.state, u).tokens[k] > 0) items.push({ id: `${u}:${k}`, label: `${FUSE_NAME[k]} on ${describe(c, u)}`, tile: u, kind: k });
      }
    }
    if (items.length === 0) return;
    let pick = items[0]!;
    if (items.length > 1) {
      const a = yield* ask(c, { kind: "order", prompt: "Which Fuse token goes off next?", rule: "6.6", options: items.map(({ id, label }) => ({ id, label })) });
      pick = items.find((x) => x.id === a.value)!;
    }
    // The token is removed (to the Supply) as it goes off.
    tile(c.state, pick.tile).tokens[pick.kind] -= 1;
    c.state.supply[pick.kind] += 1;
    log(c, `${pick.label} goes off`, "6.6");
    yield* asEffect(c, fuseEffect(c, pick.tile, pick.kind));
  }
}

function* fuseEffect(c: RunCtx, u: TileId, kind: FuseKind): Effect {
  switch (kind) {
    case "tick":
      yield* dealHit(c, u, TICK_DAMAGE, "6.6");
      return;
    case "feedback":
      yield* damageFlagship(c, FEEDBACK_DAMAGE, "6.6");
      return;
    case "mortar": {
      const k = sectorOf(c.state, u)!;
      const options = fieldMap(c.state)
        .adjacent(fromKey(k))
        .map((n) => unitAt(c.state, key(n)))
        .filter((x): x is TileId => x !== undefined && canBeChosen(c, x));
      if (options.length === 0) {
        log(c, "Mortar: no adjacent unit can be chosen", "6.6");
        return;
      }
      const a = yield* ask(c, { kind: "units", prompt: "Mortar: deal 1 damage to an adjacent unit.", rule: "6.6", options, min: 1, max: 1 });
      yield* dealHit(c, (a.value as TileId[])[0]!, MORTAR_DAMAGE, "6.6");
    }
  }
}
