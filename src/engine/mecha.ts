/**
 * Commanding a Mecha (Core Rules 4.2, 8.4): Attack, Scrap or an ability.
 * Abilities come from the unit database (base) and from filled upgrades on
 * the sheet that applies to that Mecha (your own sheet if your Company lists
 * it, otherwise your Ally's; 4.2, 7.3).
 */

import type { CompanyDef } from "../data/company.js";
import { ability } from "../effects/registry.js";
import { type Effect, type RunCtx, ask, log } from "./effect.js";
import { type Ctx, adjacentUnits, canBeChosen, describe, isUnit, sectorOf, strength, unitDef } from "./field.js";
import type { TileId } from "./state.js";
import { dealHit, destroy, gainEnergy } from "./tokens.js";

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
    // The Ally's own upgrade marks are saved with that Company's sheet (stage 7); none yet.
    if (ally) return { company: ally, filled: [] };
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

/** Units this Mecha may Attack: adjacent units that can be chosen (4.2). Passives that change this are stage 5. */
export function attackTargets(c: Ctx, id: TileId): TileId[] {
  return adjacentUnits(c.state, sectorOf(c.state, id)!).filter((u) => canBeChosen(c, u));
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
    if (attackTargets(c, id).length > 0) opts.push({ id: "attack", label: `Attack (one hit of ${strength(c, id)})` });
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
    const t = yield* ask(c, { kind: "units", prompt: `${describe(c, id)} Attacks: choose an adjacent unit.`, rule: "4.2", options: attackTargets(c, id), min: 1, max: 1 });
    const target = (t.value as TileId[])[0]!;
    log(c, `${describe(c, id)} Attacks ${describe(c, target)}`, "4.2");
    yield* dealHit(c, target, str, "4.2");
    destroy(c, id, "4.2");
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
