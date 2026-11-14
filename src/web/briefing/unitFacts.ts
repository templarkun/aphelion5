/**
 * What a unit's card says, in plain lines, from the data files only (unit list, Campaign board,
 * Company sheet). Nothing here is a rule: it reads the texts as they are written.
 */

import type { CampaignDatabase } from "../../data/campaign.js";
import type { CompanyDef } from "../../data/company.js";
import type { GameData } from "../../data/index.js";
import type { UnitDef } from "../../data/units.js";
import { missionLabel } from "./missionText.js";

export interface UnitFacts {
  unit: UnitDef;
  /** "Sentinel", or an Omega's role ("Alpha unit"). */
  title: string;
  level?: number | undefined;
  /** Name in bold, then the text. */
  lines: [string, string][];
  /** Where in the Campaign it comes from ("Mission 1 deck ×8", "Mission 2X Threat B"). */
  where: string[];
}

const clean = (x: string) => x.replace(/\s*\[\d+\]\s*/g, " ").replace(/\s+/g, " ").trim();

/** The Level printed on the tile; an Omega's comes from the Campaign board. */
export function levelOf(unit: UnitDef, campaign?: CampaignDatabase): number | undefined {
  if (typeof unit.level === "number") return unit.level;
  if (unit.level === "per_campaign") return campaign?.omega.find((o) => o.id === unit.id)?.level;
  return undefined;
}

export function unitFacts(data: GameData, id: string, campaign?: CampaignDatabase, company?: CompanyDef): UnitFacts | undefined {
  const unit = data.units.byId.get(id);
  if (!unit) return undefined;
  const omega = campaign?.omega.find((o) => o.id === id);
  const lines: [string, string][] = [];
  const t = unit.text;
  if (unit.fields.energy_on_reveal) lines.push(["When revealed", `Energy: ${clean(unit.fields.energy_on_reveal)}`]);
  // Sentinels, Flares and Sleepers resolve their effect when their Alert is resolved (Core Rules 4.4-4.6).
  if (t.activate && t.activate !== "none") lines.push(["Alert", clean(t.activate)]);
  if (t.ability) {
    const m = /^(Command|Passive|Expend|Overload|\[Overload\][^:]*):\s*(.*)$/s.exec(t.ability);
    lines.push(m ? [m[1]!, clean(m[2]!)] : ["Ability", clean(t.ability)]);
  }
  if (t.drain) lines.push(["Drain", clean(t.drain)]);
  if (t.destroyed) lines.push(["Destroyed", clean(t.destroyed)]);
  if (omega?.atOverload) lines.push(["At Overload", clean(omega.atOverload)]);
  if (omega?.destroyed) lines.push(["Destroyed", clean(omega.destroyed)]);
  if (unit.fields.mission_end_reward) lines.push(["Mission End", clean(unit.fields.mission_end_reward)]);
  if (unit.fields.removal_exception) lines.push(["When removed", clean(unit.fields.removal_exception)]);
  if (unit.type === "Bot") lines.push(["Bot", "No effects. Your Mecha's natural target (Core Rules 4.1)."]);
  if (company) for (const u of company.upgrades) if (u.appliesTo.includes(id)) lines.push([`Upgrade, ${u.cost} slot${u.cost === 1 ? "" : "s"}${u.state === "locked" ? ", locked" : ""}`, clean(u.effect)]);

  const where: string[] = [];
  if (campaign) {
    if (unit.type === "Bot") where.push("Every mission deck");
    if (unit.energyGyro) where.push("Energy deck");
    for (const m of campaign.missions) {
      const bits: string[] = [];
      const n = m.deploymentShuffled.find((x) => x.id === id)?.count;
      if (n) bits.push(`deck ×${n}`);
      if (m.omegaPlaced.includes(id)) bits.push(`on the Field ×${m.omegaSectors.length}`);
      const cols = (["A", "B", "C", "D"] as const).filter((c) => m.threat[c].includes(id));
      if (cols.length) bits.push(`Threat ${cols.join(", ")}`);
      if (bits.length) where.push(`${missionLabel(m)}: ${bits.join(", ")}`);
    }
  }
  return { unit, title: omega ? `Omega · ${omega.role}` : unit.type, level: levelOf(unit, campaign), lines, where };
}

/** Every unit a Campaign can put on the Field, in the unit list's order. Mecha come with the Company, not the Campaign. */
export function campaignUnits(data: GameData, c: CampaignDatabase): UnitDef[] {
  const ids = new Set<string>();
  for (const m of c.missions) {
    for (const x of m.deploymentShuffled) ids.add(x.id);
    for (const x of m.omegaPlaced) ids.add(x);
    for (const col of Object.values(m.threat)) for (const x of col) ids.add(x);
  }
  for (const o of c.omega) ids.add(o.id);
  // Core Rules 7.1 step 5: all Bots are in every mission deck; the Energy deck holds the Energy Gyros.
  return data.units.units.filter((u) => ids.has(u.id) || u.type === "Bot" || u.energyGyro);
}
