/**
 * A Module chosen but not run yet (designer 2026-11-08, "Module behaviour"):
 * tap a Module to select it, set Overclock, X and its extra payment on
 * pop-ups, tap it again to run it. Nothing is paid until then: the plan only
 * says how the questions the run asks will be answered (X, H6 Overclock,
 * the extra payment, 8.6). The energy bar shows what would be paid, the
 * energy on the Module first, then the Reserve (as the engine pays it).
 *
 * Pure: no screen code, so it is tested in tests/unit.
 */

import type { Ctx } from "../engine/field.js";
import { moduleCost, moduleDef, moduleState, payable } from "../engine/modules.js";
import type { Answer, Question } from "../engine/questions.js";
import { hasModuleEffect, moduleEffect } from "../effects/registry.js";

export type Colour = "Yellow" | "Red" | "Blue";

export interface ModPlan {
  id: number;
  /** X for an X cost (its smallest value until changed). */
  x?: number | undefined;
  /** Overclock (H6): 0 no, 1 = 2 more energy for 1 Heat, 2 = also 1 Yellow for 1 more. */
  oc: 0 | 1 | 2;
  /** Extra payment (8.6 step 3): energy to pay (0 = none). */
  extra: number;
}

/** One slot of a Module's energy bar. */
export interface Slot {
  colour: Colour;
  /** Filled by energy on the Module, by the Reserve (only while selected), or empty. */
  fill: "module" | "reserve" | "empty";
  /** What it pays for. */
  part: "cost" | "overclock" | "extra" | "stored";
}

export interface PlanInfo {
  cost: number;
  /** An X cost: the values you can choose now. */
  xRange?: [number, number] | undefined;
  /** The next Overclock step you can take now, if any. */
  ocNext?: "two" | "yellow" | undefined;
  /** The extra payment, if this Module has one and you can pay some of it now. */
  extra?: { n: number; upTo: boolean; max: number; text: string } | undefined;
  heat: number;
  slots: Slot[];
}

const fx = (id: number) => (hasModuleEffect(id) ? moduleEffect(id) : undefined);

function xRange(c: Ctx, id: number): [number, number] | undefined {
  const f = fx(id);
  if (!f?.x) return undefined;
  let max = f.x.min;
  while (moduleCost(c, id, max + 1) <= payable(c, id) && max < 50) max++;
  return [f.x.min, max];
}

/** Keep a plan inside what you can pay (after X changes, say). */
export function normalise(c: Ctx, p: ModPlan): ModPlan {
  const out: ModPlan = { ...p };
  const xr = xRange(c, p.id);
  out.x = xr ? Math.max(xr[0], Math.min(xr[1], p.x ?? xr[0])) : undefined;
  const d = moduleDef(c, p.id);
  const own = payable(c, p.id);
  const cost = moduleCost(c, p.id, out.x);
  const heat = c.state.settings.heatModule;
  if (!heat || (out.oc >= 1 && cost + 2 > own)) out.oc = 0;
  if (out.oc === 2 && !(d.colour === "Yellow" ? cost + 3 <= own : c.state.player.reserve.Yellow >= 1)) out.oc = 1;
  const used = cost + (out.oc >= 1 ? 2 : 0) + (out.oc === 2 && d.colour === "Yellow" ? 1 : 0);
  const e = fx(p.id)?.extra;
  const room = own - used;
  if (!e) out.extra = 0;
  else if (e.upTo) out.extra = Math.max(0, Math.min(out.extra, e.n, room));
  else out.extra = out.extra > 0 && room >= e.n ? e.n : 0;
  return out;
}

/** What a selected Module would pay and offer; without a plan, the bar as it stands (energy on it). */
export function planInfo(c: Ctx, id: number, plan?: ModPlan): PlanInfo {
  const d = moduleDef(c, id);
  const m = moduleState(c, id);
  const col = d.colour as Colour;
  const xr = xRange(c, id);
  const p = plan ? normalise(c, plan) : undefined;
  const cost = moduleCost(c, id, p?.x ?? xr?.[0]);
  const parts: { colour: Colour; part: Slot["part"] }[] = [];
  for (let i = 0; i < cost; i++) parts.push({ colour: col, part: "cost" });
  if (p && p.oc >= 1) parts.push({ colour: col, part: "overclock" }, { colour: col, part: "overclock" });
  if (p && p.oc === 2) parts.push({ colour: "Yellow", part: "overclock" });
  for (let i = 0; i < (p?.extra ?? 0); i++) parts.push({ colour: col, part: "extra" });
  // Energy on the Module fills first, then (selected) the Reserve.
  const onIt: Record<Colour, number> = { Yellow: m.energy.Yellow, Red: m.energy.Red, Blue: m.energy.Blue };
  const res: Record<Colour, number> = { ...c.state.player.reserve };
  const slots: Slot[] = parts.map(({ colour, part }) => {
    if (onIt[colour] > 0) {
      onIt[colour]--;
      return { colour, part, fill: "module" };
    }
    if (p && res[colour] > 0) {
      res[colour]--;
      return { colour, part, fill: "reserve" };
    }
    return { colour, part, fill: "empty" };
  });
  // Energy on it beyond what it pays (it returns to the Supply when the Module is exhausted).
  for (const k of ["Yellow", "Red", "Blue"] as const) for (let i = 0; i < onIt[k]; i++) slots.push({ colour: k, part: "stored", fill: "module" });
  const info: PlanInfo = { cost, xRange: xr && xr[1] > xr[0] ? xr : undefined, heat: p?.oc ?? 0, slots };
  if (p && c.state.settings.heatModule) {
    if (p.oc === 0 && normalise(c, { ...p, oc: 1 }).oc === 1) info.ocNext = "two";
    if (p.oc === 1 && normalise(c, { ...p, oc: 2 }).oc === 2) info.ocNext = "yellow";
  }
  const e = fx(id)?.extra;
  if (p && e && d.extraPayment) {
    const max = normalise(c, { ...p, extra: e.n }).extra;
    if (max > 0 || p.extra > 0) info.extra = { n: e.n, upTo: !!e.upTo, max: Math.max(max, p.extra), text: d.extraPayment };
  }
  return info;
}

/**
 * The answer a plan gives to a question its run asks (X, Overclock, the extra
 * payment); undefined for every other question (targets are still asked).
 */
export function planAnswer(q: Question, p: ModPlan): Answer | undefined {
  const prompt = q.prompt;
  if (q.kind === "amount" && q.rule === "8.6" && /choose X/.test(prompt)) return { kind: "amount", value: Math.max(q.min, Math.min(q.max, p.x ?? q.min)) };
  if (q.kind === "amount" && q.rule === "8.6" && /^Pay how much more/.test(prompt)) return { kind: "amount", value: Math.max(q.min, Math.min(q.max, p.extra)) };
  if (q.kind === "yesno" && q.rule === "H6" && /^Overclock: also pay 1 Yellow/.test(prompt)) return { kind: "yesno", value: p.oc >= 2 };
  if (q.kind === "yesno" && q.rule === "H6" && /^Overclock /.test(prompt)) return { kind: "yesno", value: p.oc >= 1 };
  if (q.kind === "yesno" && q.rule === "8.6" && /: pay \d+ more \w+ energy to /.test(prompt)) return { kind: "yesno", value: p.extra > 0 };
  return undefined;
}
