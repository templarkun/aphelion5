/**
 * Commanding a Mecha (Core Rules 4.2, 8.4): Attack, Scrap or an ability.
 * Abilities come from the unit database (base) and from filled upgrades on
 * the sheet that applies to that Mecha (your own sheet if your Company lists
 * it, otherwise your Ally's; 4.2, 7.3).
 */

import type { CompanyDef } from "../data/company.js";
import { ability } from "../effects/registry.js";
import { type Effect, type RunCtx, ask, log } from "./effect.js";
import { type Ctx, adjacentUnits, canBeChosen, describe, fieldMap, isUnit, sectorOf, strength, tile, unitAt, unitDef, units } from "./field.js";
import { isOpenSector, move, swap } from "./moves.js";
import { type SectorKey, type TileId, hasAnyToken } from "./state.js";
import { type HitResult, dealHit, destroy, gainEnergy } from "./tokens.js";
import { fromKey, key } from "../geometry/hex.js";

export interface MechaAbility {
  /** Unit id for a base ability, upgrade id for an upgrade. */
  id: string;
  text: string;
  tag: "command" | "expend";
  overload: boolean;
}

/** "[Overload] Expend: ..." -> its tag, or undefined for Passive / "Improves" text. */
export function abilityTag(text: string): { tag: "command" | "expend" | "passive"; overload: boolean } | undefined {
  const m = /^(\[Overload\] )?(Command|Expend|Passive):/.exec(text);
  if (!m) return undefined;
  return { tag: m[2]!.toLowerCase() as "command" | "expend" | "passive", overload: m[1] !== undefined };
}

/** The Company sheet a Mecha uses (4.2): yours if your Company lists it, else your Ally's. */
export function sheetFor(c: Ctx, unitId: string): { company: CompanyDef; filled: readonly string[] } | undefined {
  const own = c.data.companies.byId.get(c.state.player.company)!;
  if (own.startingMecha.some((m) => m.id === unitId)) return { company: own, filled: c.state.sheet.filled };
  if (c.state.sheet.ally) {
    const ally = c.data.companies.byId.get(c.state.sheet.ally);
    // The Ally's own sheet, with upgrades filled on it in earlier games (7.3), from the profile.
    if (ally) {
      const marks = c.state.profile.sheets[ally.id] ?? {};
      return { company: ally, filled: ally.upgrades.filter((u) => (marks[u.id] ?? 0) >= u.cost).map((u) => u.id) };
    }
  }
  return undefined;
}

/** Every ability a Mecha has: base first, then filled upgrades. Passives are not actions. */
export function mechaAbilities(c: Ctx, id: TileId): MechaAbility[] {
  const d = unitDef(c, id);
  const out: MechaAbility[] = [];
  if (d.text.ability) {
    const t = abilityTag(d.text.ability);
    if (t && t.tag !== "passive") out.push({ id: d.id, text: d.text.ability, tag: t.tag, overload: t.overload });
  }
  const sheet = sheetFor(c, d.id);
  if (sheet) {
    for (const u of sheet.company.upgrades) {
      if (u.part !== "MECHA_UPGRADES" || !sheet.filled.includes(u.id)) continue;
      if (!u.appliesTo.includes(d.id) && !u.appliesTo.includes("all_mecha")) continue;
      // "Every Mecha gains: \"Command: ...\"" or a tagged ability.
      const quoted = /^Every Mecha gains: "(.*)"$/.exec(u.effect);
      const text = quoted ? quoted[1]! : u.effect;
      const t = abilityTag(text);
      if (t && t.tag !== "passive") out.push({ id: u.id, text, tag: t.tag, overload: t.overload });
    }
  }
  return out;
}

/** Has this Mecha's sheet (4.2) got this upgrade filled? */
export function hasUpgrade(c: Ctx, id: TileId, upgrade: string): boolean {
  const sheet = sheetFor(c, unitDef(c, id).id);
  return sheet !== undefined && sheet.filled.includes(upgrade);
}

/**
 * Units this Mecha may Attack from where it stands: adjacent units that can
 * be chosen (4.2); M_04's Passive: any unit in a straight line, at any
 * distance (units, gaps, Dark and Cleared sectors in between are ignored).
 */
export function attackTargets(c: Ctx, id: TileId): TileId[] {
  const k = sectorOf(c.state, id)!;
  if (unitDef(c, id).id === "M_04") {
    const lines = Object.values(fieldMap(c.state).straightLines(fromKey(k))).flat();
    return lines.map((p) => unitAt(c.state, key(p))).filter((u): u is TileId => u !== undefined && u !== id && canBeChosen(c, u));
  }
  return adjacentUnits(c.state, k).filter((u) => canBeChosen(c, u));
}

/**
 * Passives that act "before an Attack" (unit file Mecha passive_attack_rule:
 * part of the Attack action; the Mecha then Attacks from its new sector):
 * M_03 may Move to one adjacent Dark sector (V1_M03_U1: through any number
 * of adjacent Dark sectors); M_06 may Swap with any unit that has no tokens.
 * Only steps after which a target exists are offered.
 */
export interface PreAttack {
  id: string;
  label: string;
  apply: (c: Ctx) => void;
}

function preAttackSteps(c: Ctx, id: TileId): PreAttack[] {
  const d = unitDef(c, id).id;
  const out: PreAttack[] = [];
  const from = sectorOf(c.state, id)!;
  if (d === "M_03") {
    for (const path of openPaths(c, from, hasUpgrade(c, id, "V1_M03_U1"))) {
      const to = path[path.length - 1]!;
      out.push({ id: `move:${to}`, label: `Move to (${to}) first`, apply: (cc) => path.forEach((k) => move(cc, id, k, "M_03")) });
    }
  }
  if (d === "M_06") {
    for (const u of units(c.state)) {
      if (u === id || !canBeChosen(c, u) || hasAnyToken(tile(c.state, u).tokens)) continue;
      out.push({ id: `swap:${u}`, label: `Swap with ${describe(c, u)} first`, apply: (cc) => swap(cc, id, u, "M_06") });
    }
  }
  // Keep only steps that leave something to Attack.
  return out.filter((p) => {
    const trial: Ctx = { data: c.data, state: structuredClone(c.state) };
    p.apply(trial);
    return attackTargets(trial, id).length > 0;
  });
}

/** Paths of Moves through adjacent Dark or Cleared sectors: one step, or (many) any number of steps. Shortest path to each sector. */
function openPaths(c: Ctx, from: SectorKey, many: boolean): SectorKey[][] {
  const fm = fieldMap(c.state);
  const open = (k: SectorKey) => isOpenSector(c, k);
  const seen = new Map<SectorKey, SectorKey[]>();
  let frontier: [SectorKey, SectorKey[]][] = [[from, []]];
  while (frontier.length > 0) {
    const next: [SectorKey, SectorKey[]][] = [];
    for (const [k, path] of frontier) {
      for (const n of fm.adjacent(fromKey(k)).map(key)) {
        if (n === from || seen.has(n) || !open(n)) continue;
        const p = [...path, n];
        seen.set(n, p);
        if (many) next.push([n, p]);
      }
    }
    frontier = next;
  }
  return [...seen.values()];
}

/** Can this Mecha Attack now (a target now, or after its pre-Attack Passive)? */
export function canAttack(c: Ctx, id: TileId): boolean {
  return attackTargets(c, id).length > 0 || preAttackSteps(c, id).length > 0;
}

export type CommandMode =
  /** Command phase action (8.4): no [Overload] abilities. */
  | "command"
  /** Overload action (9.2): [Overload] abilities only. */
  | "overload"
  /** Resolving an alerted Mecha (4.2): everything, timing tags ignored. */
  | "alert";

export function commandOptions(c: Ctx, id: TileId, mode: CommandMode): { id: string; label: string }[] {
  const opts: { id: string; label: string }[] = [];
  if (mode !== "overload") {
    if (canAttack(c, id)) opts.push({ id: "attack", label: `Attack (one hit of ${strength(c, id)})` });
    opts.push({ id: "scrap", label: `Scrap (gain ${strength(c, id)} energy)` });
  }
  for (const a of mechaAbilities(c, id)) {
    if (mode === "command" && a.overload) continue;
    if (mode === "overload" && !a.overload) continue;
    opts.push({ id: `ability:${a.id}`, label: a.text });
  }
  return opts;
}

/** Command one Mecha (4.2): choose Attack, Scrap or an ability, and resolve it. */
export function* commandMecha(c: RunCtx, id: TileId, mode: CommandMode): Effect {
  const opts = commandOptions(c, id, mode);
  if (opts.length === 0) {
    log(c, `${describe(c, id)} has nothing it can do`, "4.2");
    return;
  }
  const a = yield* ask(c, { kind: "option", prompt: `Command ${describe(c, id)}:`, rule: "4.2", options: opts });
  const choice = a.value as string;
  const str = strength(c, id)!;
  if (choice === "attack") {
    const pre = preAttackSteps(c, id);
    if (pre.length > 0) {
      const stay = attackTargets(c, id).length > 0 ? [{ id: "stay", label: "Attack from here" }] : [];
      const a2 = yield* ask(c, { kind: "option", prompt: `${describe(c, id)}: its Passive acts before the Attack.`, rule: unitDef(c, id).id, options: [...stay, ...pre.map(({ id: i, label }) => ({ id: i, label }))] });
      pre.find((p) => p.id === a2.value)?.apply(c);
    }
    const t = yield* ask(c, { kind: "units", prompt: `${describe(c, id)} Attacks: choose a unit.`, rule: "4.2", options: attackTargets(c, id), min: 1, max: 1 });
    const target = (t.value as TileId[])[0]!;
    log(c, `${describe(c, id)} Attacks ${describe(c, target)}`, "4.2");
    const hit = yield* dealHit(c, target, str, "4.2");
    destroy(c, id, "4.2");
    yield* afterMechaHit(c, id, hit);
    return;
  }
  if (choice === "scrap") {
    log(c, `${describe(c, id)} is Scrapped`, "4.2");
    yield* gainEnergy(c, str, undefined, "4.2");
    destroy(c, id, "4.2");
    return;
  }
  const abilityId = choice.slice("ability:".length);
  const ab = mechaAbilities(c, id).find((x) => x.id === abilityId)!;
  log(c, `${describe(c, id)}: ${ab.text}`, "4.2");
  yield* ability(abilityId)(c, id);
  // Expend: as Command, then destroy this Mecha (if it is still a unit).
  if (ab.tag === "expend" && isUnit(c.state, id)) destroy(c, id, "4.2");
}

/**
 * Hook after a Mecha's hit (V1_M04_U2 and its improvements): "When this
 * Mecha destroys a unit, you may Reveal the tile that was underneath it. If
 * it is a Bot, deal 1 damage to it." U2A: 2 damage instead of 1. U2B: any
 * type, not only a Bot. Registered by the effects (effects/mecha.ts).
 */
export type AfterHit = (c: RunCtx, mecha: TileId, hit: HitResult) => Effect;
let afterHitHook: AfterHit | undefined;
export function setAfterMechaHit(fn: AfterHit): void {
  afterHitHook = fn;
}
export function* afterMechaHit(c: RunCtx, mecha: TileId, hit: HitResult): Effect {
  if (afterHitHook) yield* afterHitHook(c, mecha, hit);
}
