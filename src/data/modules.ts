/** Typed reader for data/Modules.txt (the Module database). */

import { type EnergyColour, ENERGY_COLOURS } from "./units.js";
import { type Fields, parseRecordFile, withDefaults } from "./records.js";

export type ModuleBackground = "light" | "red";

export interface ModuleDef {
  id: number;
  name: string;
  colour: EnergyColour;
  /** light = Command phase only; red = Overload only (Core Rules 5.3). */
  background: ModuleBackground;
  /** Printed cost, or "X" (variable; see costVariable). */
  cost: number | "X";
  costVariable?: string;
  costReduction?: string;
  effect: string;
  extraPayment?: string;
  fields: Fields;
}

export interface ModuleDatabase {
  modules: ModuleDef[];
  byId: ReadonlyMap<number, ModuleDef>;
}

export function parseModules(text: string, fileName = "Modules.txt"): ModuleDatabase {
  const file = parseRecordFile(text, fileName);
  if (!file.hasEndMarker) throw new Error(`${fileName}: missing END OF FILE marker`);
  const modules: ModuleDef[] = [];

  for (const section of file.sections) {
    for (const rec of section.records) {
      const f = withDefaults(file, rec);
      const where = `${fileName}:${rec.line} Module ${rec.id}`;
      const id = Number(rec.id);
      if (!Number.isInteger(id) || id <= 0) throw new Error(`${where}: id is not a positive whole number`);
      const colour = f.energy_color as EnergyColour | undefined;
      if (!colour || !ENERGY_COLOURS.includes(colour)) throw new Error(`${where}: bad energy_color "${f.energy_color}"`);
      if (section.name.toLowerCase() !== colour.toLowerCase()) throw new Error(`${where}: colour ${colour} in section ${section.name}`);
      const bg = f.background;
      if (bg !== "light" && bg !== "red") throw new Error(`${where}: bad background "${bg}"`);
      if (!f.name) throw new Error(`${where}: no name`);
      if (!f.effect) throw new Error(`${where}: no effect`);
      if (f.cost === undefined) throw new Error(`${where}: no cost`);
      let cost: number | "X";
      if (f.cost === "X") cost = "X";
      else {
        cost = Number(f.cost);
        if (!Number.isInteger(cost) || cost < 0) throw new Error(`${where}: bad cost "${f.cost}"`);
      }
      const m: ModuleDef = { id, name: f.name, colour, background: bg, cost, effect: f.effect, fields: f };
      if (f.cost_variable !== undefined) m.costVariable = f.cost_variable;
      if (f.cost_reduction !== undefined) m.costReduction = f.cost_reduction;
      if (f.extra_payment !== undefined) m.extraPayment = f.extra_payment;
      if (cost === "X" && m.costVariable === undefined) throw new Error(`${where}: X cost without cost_variable`);
      modules.push(m);
    }
  }

  const byId = new Map<number, ModuleDef>();
  for (const m of modules) {
    if (byId.has(m.id)) throw new Error(`${fileName}: Module ${m.id} listed twice`);
    byId.set(m.id, m);
  }
  return { modules, byId };
}

/** The DISTRIBUTION line of the file's preamble, e.g. 78 cards, 26 per colour, with id lists. */
export interface ModuleDistribution {
  total: number;
  perColour: Record<EnergyColour, { count: number; ids: number[] }>;
}

/** Reads "DISTRIBUTION: one copy of each Module, 78 cards: 26 Yellow (IDs 1-25, 77), ..." */
export function parseModuleDistribution(text: string): ModuleDistribution {
  const file = parseRecordFile(text);
  const flat = file.preamble.replace(/\s+/g, " ");
  const m = /DISTRIBUTION: .*?(\d+) cards: (.*?)\. /.exec(flat + " ");
  if (!m) throw new Error("Modules.txt: DISTRIBUTION line not found");
  const perColour = {} as ModuleDistribution["perColour"];
  const re = /(\d+) (Yellow|Red|Blue) \(IDs ([^)]*)\)/g;
  for (let x = re.exec(m[2]!); x; x = re.exec(m[2]!)) {
    const ids: number[] = [];
    for (const part of x[3]!.split(",").map((s) => s.trim())) {
      const range = /^(\d+)-(\d+)$/.exec(part);
      if (range) for (let i = Number(range[1]); i <= Number(range[2]); i++) ids.push(i);
      else ids.push(Number(part));
    }
    perColour[x[2] as EnergyColour] = { count: Number(x[1]), ids };
  }
  return { total: Number(m[1]), perColour };
}
