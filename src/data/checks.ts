/**
 * Data checks (spec "Testing and acceptance"): every map is connected; Omega
 * sectors are on their maps; copy counts add up (42 Energy Gyros, 78
 * Modules); every id referenced exists. Plus a few consistency checks that
 * only compare a file with itself.
 *
 * Each check returns problems as plain sentences, so a failing build can be
 * read by the designer.
 */

import { FieldMap } from "../geometry/fieldMap.js";
import { key, show } from "../geometry/hex.js";
import { THREAT_COLUMNS } from "./campaign.js";
import type { GameData } from "./index.js";
import { ENERGY_COLOURS } from "./units.js";

export interface CheckResult {
  name: string;
  problems: string[];
}

/** Energy deck size stated in Core Rules 2 ("the 42 Energy Gyros") and the unit file. */
export const ENERGY_DECK_SIZE = 42;
/** Module count stated in Core Rules 2 ("78 cards") and Modules.txt. */
export const MODULE_COUNT = 78;

export function runDataChecks(d: GameData): CheckResult[] {
  const out: CheckResult[] = [];
  const check = (name: string, fn: (p: string[]) => void) => {
    const problems: string[] = [];
    fn(problems);
    out.push({ name, problems });
  };
  const missions = d.campaigns.flatMap((c) => c.missions);

  check("every map lists each sector once and matches map_sector_count", (p) => {
    for (const m of missions) {
      const seen = new Set<string>();
      for (const c of m.map) {
        if (seen.has(key(c))) p.push(`${m.id}: map lists ${show(c)} twice`);
        seen.add(key(c));
      }
      if (seen.size !== m.mapSectorCount) p.push(`${m.id}: map has ${seen.size} sectors, map_sector_count says ${m.mapSectorCount}`);
    }
  });

  check("every map contains its starting sector (0,0)", (p) => {
    for (const m of missions) if (!m.map.some((c) => c.q === 0 && c.r === 0)) p.push(`${m.id}: no (0,0)`);
  });

  check("every map is connected", (p) => {
    for (const m of missions) {
      try {
        if (!new FieldMap(m.map).isConnected()) p.push(`${m.id}: map is not connected`);
      } catch (e) {
        p.push(`${m.id}: ${(e as Error).message}`);
      }
    }
  });

  check("Omega sectors are on their maps", (p) => {
    for (const m of missions) {
      const set = new Set(m.map.map(key));
      for (const c of m.omegaSectors) if (!set.has(key(c))) p.push(`${m.id}: Omega sector ${show(c)} is not on the map`);
      if (m.omegaSectors.length > 0 && m.omegaPlaced.length === 0) p.push(`${m.id}: omega_sectors without omega_placed`);
      if (m.omegaPlaced.length > 0 && m.omegaSectors.length === 0) p.push(`${m.id}: omega_placed without omega_sectors`);
      if (new Set(m.omegaSectors.map(key)).size !== m.omegaSectors.length) p.push(`${m.id}: an Omega sector repeats`);
    }
  });

  check(`the Energy deck is ${ENERGY_DECK_SIZE} Energy Gyros`, (p) => {
    const gyros = d.units.units.filter((u) => u.energyGyro === true);
    const total = gyros.reduce((s, u) => s + u.copies, 0);
    if (total !== ENERGY_DECK_SIZE) p.push(`Energy Gyro copies add up to ${total}, not ${ENERGY_DECK_SIZE}`);
    for (const g of gyros) {
      if (g.type !== "Gyro") p.push(`${g.id} is marked energy_gyro but is a ${g.type}`);
      const stated = g.fields.energy_deck_total;
      if (stated !== undefined && !stated.startsWith(String(total))) p.push(`unit file says energy_deck_total ${stated}, copies add up to ${total}`);
    }
  });

  check(`there are ${MODULE_COUNT} Modules, as the DISTRIBUTION line lists`, (p) => {
    const mods = d.modules.modules;
    if (mods.length !== MODULE_COUNT) p.push(`${mods.length} Modules, not ${MODULE_COUNT}`);
    if (d.moduleDistribution.total !== mods.length) p.push(`DISTRIBUTION says ${d.moduleDistribution.total}, file has ${mods.length}`);
    for (const colour of ENERGY_COLOURS) {
      const want = d.moduleDistribution.perColour[colour];
      const have = mods.filter((m) => m.colour === colour).map((m) => m.id).sort((a, b) => a - b);
      if (!want) {
        p.push(`DISTRIBUTION has no ${colour} entry`);
        continue;
      }
      if (want.count !== have.length) p.push(`${colour}: DISTRIBUTION says ${want.count}, file has ${have.length}`);
      const wantIds = [...want.ids].sort((a, b) => a - b);
      if (wantIds.join(",") !== have.join(",")) p.push(`${colour}: DISTRIBUTION ids ${wantIds.join(",")} but file has ${have.join(",")}`);
    }
  });

  check("every id referenced exists", (p) => {
    const unit = (id: string) => d.units.byId.get(id);
    const tileOk = (id: string) => id === d.units.energyDeckPlaceholder || unit(id) !== undefined;
    for (const c of d.campaigns) {
      for (const o of c.omega) {
        const u = unit(o.id);
        if (!u) p.push(`Campaign Omega ${o.id} is not in the unit file`);
        else if (u.type !== "Omega") p.push(`Campaign Omega ${o.id} is a ${u.type} in the unit file`);
        else if (u.role !== undefined && u.role !== o.role) p.push(`${o.id}: role "${o.role}" in the campaign, "${u.role}" in the unit file`);
      }
      for (const m of c.missions) {
        for (const t of m.deploymentShuffled) if (!tileOk(t.id)) p.push(`${m.id} deployment: ${t.id} does not exist`);
        for (const col of THREAT_COLUMNS) for (const id of m.threat[col]) if (!tileOk(id)) p.push(`${m.id} threat_${col}: ${id} does not exist`);
        for (const id of m.omegaPlaced) {
          if (!c.omega.some((o) => o.id === id)) p.push(`${m.id} omega_placed: ${id} is not on the Campaign board`);
        }
        if (m.objective.type === "eliminate") {
          const t = m.objective.target;
          if (!unit(t)) p.push(`${m.id} objective_target: ${t} does not exist`);
        }
        if (m.alternativeTo !== undefined) {
          const alt = c.missionById.get(m.alternativeTo);
          if (!alt) p.push(`${m.id}: alternative ${m.alternativeTo} does not exist`);
          else if (alt.alternativeTo !== m.id) p.push(`${m.id}: ${m.alternativeTo} does not name ${m.id} back as its alternative`);
          else if (alt.number !== m.number) p.push(`${m.id}: alternative ${alt.id} has a different mission number`);
        }
      }
    }
  });

  check("a mission never deploys more copies of a tile than exist", (p) => {
    for (const m of missions) {
      const want = new Map<string, number>();
      for (const t of m.deploymentShuffled) want.set(t.id, (want.get(t.id) ?? 0) + t.count);
      for (const id of m.omegaPlaced) want.set(id, (want.get(id) ?? 0) + m.omegaSectors.length);
      for (const [id, n] of want) {
        if (id === d.units.energyDeckPlaceholder) {
          if (n > ENERGY_DECK_SIZE) p.push(`${m.id}: ${n} G_00 tiles but the Energy deck has ${ENERGY_DECK_SIZE}`);
          continue;
        }
        const u = d.units.byId.get(id);
        if (u && n > u.copies) p.push(`${m.id}: needs ${n} ${id}, only ${u.copies} copies exist`);
      }
    }
  });

  check("units are well formed", (p) => {
    for (const u of d.units.units) {
      if (u.type === "Flare" && u.level !== "none") p.push(`${u.id}: a Flare with a Level`);
      if (u.type === "Flare" && !u.energyOnReveal) p.push(`${u.id}: a Flare without energy_on_reveal`);
      if (u.type === "Omega" && u.level !== "per_campaign") p.push(`${u.id}: Omega Level should come from the Campaign board`);
      if (u.type !== "Flare" && u.type !== "Omega" && typeof u.level !== "number") p.push(`${u.id}: no printed Level`);
      if (u.type === "Mecha" && (!u.abilityKind || !u.text.ability)) p.push(`${u.id}: Mecha without ability`);
      if (u.type !== "Mecha" && u.abilityKind) p.push(`${u.id}: ability_kind on a ${u.type}`);
      if (u.type === "Gyro" && (!u.text.drain || !u.text.destroyed)) p.push(`${u.id}: Gyro without drain or destroyed effect`);
      if ((u.type === "Sentinel" || u.type === "Sleeper" || u.type === "Flare") && !u.text.activate) p.push(`${u.id}: no activate effect`);
      const mentions = /arrow|Targeted|line of fire|lines of fire/i.test(u.text.activate ?? u.text.ability ?? "");
      if (mentions && u.arrows.length === 0) p.push(`${u.id}: text uses arrows but the unit has none`);
    }
  });

  return out;
}
