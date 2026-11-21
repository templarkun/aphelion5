/**
 * Surface Terraform: the recon feed's telemetry (designer 2026-11-21). The film is seen as through
 * a drone's visor: thin corner ticks, a horizon elevation scale and a few environmental readouts,
 * all worked out from the film time alone (so the same moment always reads the same). Screen
 * flavour only: none of these numbers is a game number or a rule.
 */

import { clamp, ease, seg } from "../../briefing/styles/intro2/math3.js";
import { ACT_AT, RESOLVE_AT, SUN_AT, VORTEX_AT, WATER_AT, WATER_FULL } from "./timeline.js";

export interface Readout {
  /** "T+00:07.42": the feed's clock. */
  clock: string;
  /** Oxygen in the air, "02.4%" rising to "20.1%". */
  o2: string;
  /** "CRITICAL", "SEVERE", "CLEARING", "NOMINAL". */
  particulate: string;
  /** Surface water, "00.0%" rising to "31.6%". */
  water: string;
  /** "DORMANT", then "STABILIZING". */
  biome: string;
}

export const O2_FROM = 2.4;
export const O2_TO = 20.1;
export const WATER_TO = 31.6;

const pad = (x: number, int: number, dec: number) => {
  const s = x.toFixed(dec);
  const [a, b] = s.split(".");
  return `${a!.padStart(int, "0")}${dec ? `.${b}` : ""}`;
};

/** The oxygen share at film time t, % (rises while the storm is pushed back, steady from Act 4). */
export function o2At(t: number): number {
  return O2_FROM + (O2_TO - O2_FROM) * ease(seg(t, VORTEX_AT, RESOLVE_AT));
}

export function readoutAt(time: number): Readout {
  const t = Math.max(0, time);
  const min = Math.floor(t / 60);
  const particulate = t < VORTEX_AT + 0.6 ? "CRITICAL" : t < SUN_AT + 0.9 ? "SEVERE" : t < WATER_AT + 1.6 ? "CLEARING" : "NOMINAL";
  return {
    clock: `T+${pad(min, 2, 0)}:${pad(t - min * 60, 2, 2)}`,
    o2: `${pad(o2At(t), 2, 1)}%`,
    particulate,
    water: `${pad(WATER_TO * clamp(seg(t, WATER_AT, WATER_FULL)) ** 0.8, 2, 1)}%`,
    biome: t < ACT_AT[2] ? "DORMANT" : "STABILIZING",
  };
}
