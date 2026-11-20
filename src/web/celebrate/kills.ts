/**
 * The kill pieces by id (pieces.ts KILL_PIECES): each a Field step built from the close-up (closeup.ts).
 * FieldView.tsx plays the one picked for the mission (I19).
 */

import type { Step } from "../anim.js";
import { gammaArrayStep } from "./arrayFx.js";
import { betaBreachStep } from "./breachFx.js";
import type { KillEnv, KillTarget } from "./closeup.js";
import { gammaHorizonStep } from "./horizonFx.js";
import { alphaDownStep } from "./killFx.js";
import { alphaPurgeStep } from "./purgeFx.js";

export const KILL_STEPS: Record<string, (env: KillEnv, k: KillTarget) => Step> = {
  alphaDown: alphaDownStep,
  alphaPurge: alphaPurgeStep,
  betaBreach: betaBreachStep,
  gammaHorizon: gammaHorizonStep,
  gammaArray: gammaArrayStep,
};

/** The step of a kill piece (Alpha Down if the id is unknown). */
export function killStepFor(id: string, env: KillEnv, k: KillTarget): Step {
  return (KILL_STEPS[id] ?? alphaDownStep)(env, k);
}
