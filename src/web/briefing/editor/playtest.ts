/**
 * The mission playtest (designer 2026-11-27): the Campaign editor's draft played as a Campaign,
 * one mission only (a Developer tool, never saved, nothing recorded). The draft is written as a
 * Campaign file and read back by the game's own reader, so the game plays exactly what the file
 * says; its Orders and Omega effects play as made: blocks by the general block program
 * (`src/effects/blocks.ts`), text the same as an effect already programmed (Campaign 1's) by that
 * program, and other text not at all (designer 2026-11-27: skipped, listed before the start).
 */

import { type CampaignDatabase, type CampaignPlay, type PlayFx, parseCampaign } from "../../../data/campaign.js";
import type { GameData } from "../../../data/index.js";
import { hasAbility } from "../../../effects/registry.js";
import { campaignFileText, effectText, isEmpty, missionId, missionTag, type Draft, type EffectDraft, type MissionDraft } from "./model.js";

export interface Playtest {
  /** The game's data with the draft as its only Campaign. */
  data: GameData;
  campaign: CampaignDatabase;
  /** The mission id to play ("C2_M3X"). */
  mission: string;
  /** Effects written as text that the game does not know: skipped. */
  skipped: string[];
  /** Effects that play as already programmed (same words as Campaign 1's). */
  programmed: string[];
}

const words = (t: string) => t.trim().replace(/\s+/g, " ").replace(/\.$/, "").toLowerCase();

/** An effect's program: blocks, a programmed one with the same words, or skipped. */
function fxOf(e: EffectDraft, known: { id: string; text: string }[]): PlayFx {
  if (e.mode === "blocks") return { kind: "blocks", effect: { steps: e.steps, ...(e.when ? { when: e.when } : {}) } };
  const hit = known.find((k) => words(k.text) === words(e.text));
  return hit ? { kind: "programmed", id: hit.id } : { kind: "skip", text: e.text.trim() };
}

/** Build the playtest of one mission of the draft; throws with the reason when the draft cannot be read as a Campaign. */
export function playtestOf(data: GameData, d: Draft, m: MissionDraft): Playtest {
  const campaign = parseCampaign(campaignFileText(d), `${d.prefix} (Campaign editor)`);
  const id = missionId(d, m);
  if (!campaign.missionById.has(id)) throw new Error(`mission ${missionTag(m)} is not in the Campaign file`);
  // Effects already programmed, by their words: every data Campaign's Orders and mission Orders.
  const orderKnown = data.campaigns.flatMap((c) => [...c.orders, ...c.missions.flatMap((x) => (x.order ? [x.order] : []))]).filter((o) => hasAbility(o.id)).map((o) => ({ id: o.id, text: o.effect }));
  const play: CampaignPlay = { orders: {}, omega: {} };
  const skipped: string[] = [];
  const programmed: string[] = [];
  const note = (fx: PlayFx, where: string, e: EffectDraft) => {
    if (fx.kind === "skip") skipped.push(`${where}: ${effectText(e)}`);
    if (fx.kind === "programmed") programmed.push(`${where}: ${effectText(e)}`);
  };
  d.orders.forEach((o, i) => {
    if (isEmpty(o.effect)) return;
    const fx = fxOf(o.effect, orderKnown);
    play.orders[`${d.prefix}_ORDER_${i + 1}`] = fx;
    note(fx, `Campaign Order ${i + 1}`, o.effect);
  });
  for (const x of d.missions) {
    if (!x.order || isEmpty(x.order.effect)) continue;
    const fx = fxOf(x.order.effect, orderKnown);
    play.orders[`${missionId(d, x)}_ORDER`] = fx;
    if (x === m) note(fx, `${missionTag(x)} Order`, x.order.effect);
  }
  for (const o of d.omega) {
    const known = (kind: "destroyed" | "atOverload") =>
      data.campaigns.flatMap((c) => c.omega.filter((x) => x.id === o.id && x[kind]).map((x) => ({ id: o.id, text: x[kind]! })));
    const out: CampaignPlay["omega"][string] = {};
    for (const kind of ["destroyed", "atOverload"] as const) {
      const e = o[kind];
      if (!e || isEmpty(e)) continue;
      const fx = fxOf(e, known(kind));
      out[kind] = fx;
      note(fx, `${o.id} ${kind === "destroyed" ? "Destroyed" : "At Overload"}`, e);
    }
    play.omega[o.id] = out;
  }
  campaign.play = play;
  return { data: { ...data, campaigns: [campaign] }, campaign, mission: id, skipped, programmed };
}
