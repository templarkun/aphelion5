/** Small shared steps for card effects. */

import { type Effect, type RunCtx, ask, log } from "../engine/effect.js";
import { choosableUnits, darkSectors } from "../engine/field.js";
import type { SectorKey, TileId } from "../engine/state.js";

/**
 * Choose one unit an effect can choose (never Flares or Wrecks). Mandatory
 * when one exists (unit file E2); none: the step is skipped (11.1 rule 5).
 */
export function* chooseUnit(c: RunCtx, prompt: string, rule: string, filter: (u: TileId) => boolean = () => true): Effect<TileId | undefined> {
  const options = choosableUnits(c, filter);
  if (options.length === 0) {
    log(c, `${prompt} - no legal unit, skipped`, rule);
    return undefined;
  }
  const a = yield* ask(c, { kind: "units", prompt, rule, options, min: 1, max: 1 });
  return (a.value as TileId[])[0]!;
}

/** Choose one sector from a list (mandatory when one exists). */
export function* chooseSector(c: RunCtx, prompt: string, rule: string, options: SectorKey[]): Effect<SectorKey | undefined> {
  if (options.length === 0) {
    log(c, `${prompt} - no legal sector, skipped`, rule);
    return undefined;
  }
  const a = yield* ask(c, { kind: "sectors", prompt, rule, options, min: 1, max: 1 });
  return (a.value as SectorKey[])[0]!;
}

export function* chooseDarkSector(c: RunCtx, prompt: string, rule: string): Effect<SectorKey | undefined> {
  return yield* chooseSector(c, prompt, rule, darkSectors(c.state));
}
