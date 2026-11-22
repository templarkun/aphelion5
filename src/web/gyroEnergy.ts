/** Round 28 (designer 2026-11-22): the energy an Energy Gyro (G_01-G_09) gives when destroyed, for its Feature look. */

/** What destroying an Energy Gyro gives (its "destroyed" line: "Gain 4 Yellow energy."), or nothing. */
export function gyroReward(def: { energyGyro?: boolean | undefined; text: { destroyed?: string | undefined } } | undefined): { n: number; colour: "Yellow" | "Red" | "Blue" } | undefined {
  if (!def?.energyGyro) return undefined;
  const m = /Gain (\d+) (Yellow|Red|Blue) energy/.exec(def.text.destroyed ?? "");
  return m ? { n: Number(m[1]), colour: m[2] as "Yellow" | "Red" | "Blue" } : undefined;
}
