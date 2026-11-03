/** Plain-JSON form of the parsed data, as written to src/data/generated/. */

import type { GameData } from "./index.js";

export function serialiseGameData(d: GameData): Record<string, unknown> {
  return {
    units: d.units.units,
    modules: d.modules.modules,
    companies: d.companies.companies,
    anomalies: d.anomalies.anomalies,
    expansion1: { name: d.expansion1.name, intro: d.expansion1.intro, heatTokens: d.expansion1.heatTokens, rules: d.expansion1.rules },
    campaign1: (() => {
      const c = d.campaigns[0]!;
      return { prefix: c.prefix, omega: c.omega, orders: c.orders, missions: c.missions };
    })(),
  };
}
