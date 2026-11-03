/** Plain-JSON form of the parsed data, as written to src/data/generated/. */

import type { GameData } from "./index.js";

export function serialiseGameData(d: GameData): Record<string, unknown> {
  return {
    units: d.units.units,
    modules: d.modules.modules,
    campaign1: (() => {
      const c = d.campaigns[0]!;
      return { prefix: c.prefix, omega: c.omega, orders: c.orders, missions: c.missions };
    })(),
  };
}
