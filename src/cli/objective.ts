/** The mission objective and progress, in words (Core Rules 8.2). */

import { type Ctx, sectorKeys, sectorState } from "../engine/field.js";

export function objectiveText(c: Ctx): string {
  const camp = c.data.campaigns.find((x) => x.prefix === c.state.campaign)!;
  const m = camp.missionById.get(c.state.mission)!;
  const trophy = c.state.piles.trophy.map((id) => c.state.tiles[id]!.unitId);
  if (m.objective.type === "salvage") {
    const nodes = trophy.filter((u) => u === "F_01").length;
    const cleared = sectorKeys(c.state).filter((k) => sectorState(c.state, k) === "cleared").length;
    return `Salvage: Power Nodes ${nodes}/5, Cleared sectors ${cleared}/3`;
  }
  const o = m.objective;
  const n = trophy.filter((u) => u === o.target).length;
  return `Eliminate ${o.count} ${o.target}: ${n}/${o.count} in the Trophy pile`;
}
