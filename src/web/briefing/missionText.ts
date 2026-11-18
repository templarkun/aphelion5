/** Plain-words lines about a mission, taken from the Campaign data (nothing here is a rule of its own). */

import type { CampaignDatabase, MissionDef } from "../../data/campaign.js";

export function missionLabel(m: MissionDef): string {
  return `Mission ${m.number}${m.route === "single" ? "" : m.route.split(" ")[0]!.toUpperCase()}`;
}

/** Missions grouped by number: a group of two is a pair of alternative routes (7.2 step 1). */
export function missionGroups(c: CampaignDatabase): MissionDef[][] {
  const by = new Map<number, MissionDef[]>();
  for (const m of c.missions) by.set(m.number, [...(by.get(m.number) ?? []), m]);
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}

export function objectiveShort(m: MissionDef): string {
  return m.objective.type === "salvage" ? "Salvage" : "Eliminate";
}

/** Core Rules 8.2. */
export function objectiveText(c: CampaignDatabase, m: MissionDef): string {
  const o = m.objective;
  if (o.type === "salvage") return "Salvage: at least 5 Power Nodes in your Trophy pile and at least 3 Cleared sectors.";
  const role = c.omega.find((x) => x.id === o.target)?.role ?? o.target;
  return `Eliminate: at least ${o.count} ${role}${o.count === 1 ? "" : "s"} (${o.target}) in your Trophy pile.`;
}

export function eventText(m: MissionDef): string {
  const e = m.event;
  if (e.type === "allied_drop") return `Allied Drop, Level ${e.level}`;
  if (e.type === "gain_energy") return `Gain ${energyEventText(e.amount, e.energy)}`;
  if (e.type === "take_module_top") return "Take the top Module of the Module deck";
  if (e.type === "take_modules") return `Take the top ${e.amount} Module${e.amount === 1 ? "" : "s"} of the Module deck`;
  if (e.type === "take_anomaly") return `Take ${e.amount} Anomaly card${e.amount === 1 ? "" : "s"}`;
  if (e.type === "remove_damage") return `Remove ${e.amount} damage from your Flagship`;
  return "None";
}

export function orderText(m: MissionDef): string {
  const o = m.order;
  if (!o) return "None";
  return `${o.overloadOnly ? "[Overload] " : ""}${o.tokens} Command token${o.tokens === 1 ? "" : "s"}: ${o.effect}`;
}

/** "1 Yellow, 2 Red and 3 energy of your choice". */
export function energyEventText(any: number, set: Partial<Record<"Yellow" | "Red" | "Blue", number>> = {}): string {
  const parts = (["Yellow", "Red", "Blue"] as const).filter((c) => (set[c] ?? 0) > 0).map((c) => `${set[c]} ${c}`);
  if (any > 0) parts.push(`${any} energy${parts.length ? " of your choice" : ""}`);
  if (parts.length === 0) return "no energy";
  const last = parts.pop()!;
  return `${parts.length ? `${parts.join(", ")} and ` : ""}${last}${any > 0 ? "" : " energy"}`;
}
