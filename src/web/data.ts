/** The component data in the browser: the same text files, bundled by Vite, parsed by the same readers. */

import { type GameData, parseGameData } from "../data/index.js";
import units from "../../data/unit_list_structured.txt?raw";
import modules from "../../data/Modules.txt?raw";
import companies from "../../data/company_vessels_structured.txt?raw";
import campaign1 from "../../data/Campaign1.txt?raw";
import anomalies from "../../data/Anomaly list.txt?raw";
import expansion1 from "../../data/Expansion1.txt?raw";

let cached: GameData | undefined;
export function gameData(): GameData {
  return (cached ??= parseGameData({ units, modules, companies, campaign1, anomalies, expansion1 }));
}
