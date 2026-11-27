/**
 * The kill pieces by id (pieces.ts KILL_PIECES): each a Field step built from the close-up (closeup.ts).
 * FieldView.tsx plays the one picked for the mission (I19).
 */

import type { Step } from "../anim.js";
import { gammaArrayStep } from "./arrayFx.js";
import { betaBreachStep } from "./breachFx.js";
import { betaBarrageStep } from "./barrageFx.js";
import { betaCryoStep } from "./cryoFx.js";
import type { KillEnv, KillTarget } from "./closeup.js";
import { gammaHorizonStep } from "./horizonFx.js";
import { alphaDownStep } from "./killFx.js";
import { alphaPurgeStep } from "./purgeFx.js";
import { alphaRailStep } from "./railFx.js";
import { alphaEraseStep } from "./eraseFx.js";
import { gammaShatterStep } from "./shatterFx.js";
import { cascadeStep, fusionStep } from "./nodesFx.js";
import { gridOnlineStep, sectorLockStep } from "./salvageFx.js";

export const KILL_STEPS: Record<string, (env: KillEnv, k: KillTarget) => Step> = {
  alphaDown: alphaDownStep,
  alphaPurge: alphaPurgeStep,
  alphaRail: alphaRailStep,
  alphaErase: alphaEraseStep,
  betaBreach: betaBreachStep,
  betaBarrage: betaBarrageStep,
  betaCryo: betaCryoStep,
  gammaHorizon: gammaHorizonStep,
  gammaArray: gammaArrayStep,
  gammaShatter: gammaShatterStep,
  salvageNodes: gridOnlineStep,
  salvageCleared: sectorLockStep,
  salvageFusion: fusionStep,
  salvageCascade: cascadeStep,
};

/** The step of a kill piece (Alpha Down if the id is unknown). */
export function killStepFor(id: string, env: KillEnv, k: KillTarget): Step {
  return (KILL_STEPS[id] ?? alphaDownStep)(env, k);
}
