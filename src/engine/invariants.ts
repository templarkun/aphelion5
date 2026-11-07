/**
 * Invariants, checked after every answer (spec "Testing and acceptance"):
 * no tile in two places; token and energy supplies never negative; a unit
 * never holds both Shields and Damage, nor two Alerts or Barriers; Flares and
 * Wrecks hold no tokens except their Alert (and a Wreck's marker).
 * Returns problems as sentences; empty = all good.
 */

import { ENERGY_COLOURS } from "../data/units.js";
import { type Ctx, isFlare, sectorKeys, stack, unitAt } from "./field.js";
import { ENERGY_PER_COLOUR, LIMITED_TOKENS, TOKEN_LIMIT } from "./rules.js";
import { hasAnyToken } from "./state.js";
import { printedIntegrity } from "./tokens.js";

export function checkInvariants(c: Ctx): string[] {
  const s = c.state;
  const p: string[] = [];

  // Every tile exactly once.
  const where = new Map<string, string>();
  const sectorOfTile = new Map<string, string>();
  const see = (id: string, place: string, sector?: string) => {
    if (sector !== undefined) sectorOfTile.set(id, sector);
    if (!s.tiles[id]) p.push(`${place} holds ${id}, which is not a known tile`);
    const prev = where.get(id);
    if (prev) p.push(`${id} is in two places: ${prev} and ${place}`);
    where.set(id, place);
  };
  for (const k of sectorKeys(s)) for (const id of stack(s, k)) see(id, `sector (${k})`, k);
  for (const [name, pile] of Object.entries(s.piles)) for (const id of pile) see(id, name);
  for (const id of Object.keys(s.tiles)) if (!where.has(id)) p.push(`${id} is nowhere`);
  for (const k of Object.keys(s.field)) if (!s.map.some((m) => `${m.q},${m.r}` === k)) p.push(`field has (${k}), which is not on the map`);

  // Tokens on board vs. supply.
  const onBoard = Object.fromEntries(LIMITED_TOKENS.map((t) => [t, 0])) as Record<(typeof LIMITED_TOKENS)[number], number>;
  for (const [id, t] of Object.entries(s.tiles)) {
    const tk = t.tokens;
    const k = sectorOfTile.get(id);
    const isTopUnit = k !== undefined && unitAt(s, k) === id;
    if (!isTopUnit && hasAnyToken(tk)) p.push(`${id} holds tokens but is not a unit`);
    if ((tk.shield > 0 || tk.bioShield > 0) && tk.damage > 0) p.push(`${id} holds both Shields and Damage`);
    for (const n of ["damage", "shield", "bioShield", "tick", "mortar", "feedback"] as const) if (tk[n] < 0) p.push(`${id} has ${tk[n]} ${n}`);
    if (isTopUnit && t.unitId !== null) {
      if (tk.wreck) {
        if (tk.damage + tk.shield + tk.bioShield + tk.tick + tk.mortar + tk.feedback > 0 || tk.barrier) p.push(`Wreck ${id} holds tokens other than its Alert and marker`);
      } else if (isFlare(c, id)) {
        if (hasAnyToken({ ...tk, alert: false })) p.push(`Flare ${id} holds tokens other than its Alert`);
      }
    }
    onBoard.shield += tk.shield;
    onBoard.bioShield += tk.bioShield;
    onBoard.barrier += tk.barrier ? 1 : 0;
    onBoard.tick += tk.tick;
    onBoard.mortar += tk.mortar;
    onBoard.feedback += tk.feedback;
  }
  onBoard.command = s.player.commandTokens;
  for (const t of LIMITED_TOKENS) {
    if (s.supply[t] < 0) p.push(`${t} supply is ${s.supply[t]}`);
    if (s.supply[t] + onBoard[t] > TOKEN_LIMIT[t]) p.push(`${s.supply[t] + onBoard[t]} ${t} tokens exist; the game has ${TOKEN_LIMIT[t]}`);
  }

  // Energy.
  for (const col of ENERGY_COLOURS) {
    const onModules = s.player.modules.reduce((a, m) => a + m.energy[col], 0);
    const onFlares = Object.values(s.tiles).reduce((a, t) => a + (t.energy?.[col] ?? 0), 0);
    const parts = [s.supply.energy[col], s.player.reserve[col], onModules, onFlares];
    if (parts.some((x) => x < 0)) p.push(`${col} energy is negative somewhere`);
    if (parts.reduce((a, b) => a + b, 0) > ENERGY_PER_COLOUR) p.push(`more than ${ENERGY_PER_COLOUR} ${col} energy exist`);
  }

  // Flagship.
  const printed = printedIntegrity(c);
  if (s.flagship.length !== printed.length) p.push(`Flagship has ${s.flagship.length} Bays, Company sheet has ${printed.length}`);
  s.flagship.forEach((x, i) => {
    if (x < 0 || x > (printed[i] ?? 0)) p.push(`Bay ${i + 1} Integrity ${x} is outside 0..${printed[i]}`);
  });

  // Facing in range.
  for (const t of Object.values(s.tiles)) {
    if (!Number.isInteger(t.facing) || t.facing < 0 || t.facing > 5) p.push(`${t.id} has facing ${t.facing}`);
  }
  return p;
}
