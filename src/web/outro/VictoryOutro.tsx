/**
 * Game End after the last mission is won (Core Rules 10.3): the outro of the player's Company
 * (index.ts says which) with the numbers of the finished game, over the whole page. "RETURN TO
 * COMMAND DECK" plays the logo gate (briefing/Gate.tsx) and goes back to the menu behind it.
 * Also the preview of an outro with made-up numbers (System options > Play the outro).
 * Screen only: the game is already over and scored when this shows.
 */

import { useMemo } from "react";
import { createPortal } from "react-dom";
import type { GameData } from "../../data/index.js";
import type { GameState } from "../../engine/state.js";
import { gateBusy, runGate } from "../briefing/Gate.js";
import { outroFor } from "./index.js";
import { campaignStatsOf, sampleStats } from "./stats.js";
import { companyTheme } from "./themes.js";
import type { CampaignStats } from "./types.js";

/** Does this finished game get an outro? Only a won Campaign; a loss or a concede keeps the plain Game over card. */
export function hasOutro(state: GameState): boolean {
  return state.ending !== undefined && state.outcome?.result === "won";
}

function Show({ company, stats, preview, outro, onLeave }: { company: string; stats: CampaignStats; preview?: boolean; outro?: string | undefined; onLeave: () => void }) {
  const theme = useMemo(() => companyTheme(company), [company]);
  const { Component, name } = outroFor(company, outro);
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <Component
        companyTheme={theme}
        vesselId={company}
        campaignStats={stats}
        onComplete={() => {
          if (gateBusy()) return;
          // The gate closes over the outro; behind its doors the menu is put in place.
          runGate({ title: "COMMAND DECK", sub: stats.campaignName, acc: theme.primary, onMid: onLeave });
        }}
      />
      {preview && <div className="ou-preview">Preview · {name} · sample numbers</div>}
    </>,
    document.body,
  );
}

export function VictoryOutro({ data, state, onLeave }: { data: GameData; state: GameState; onLeave: () => void }) {
  // The game is over: its state no longer changes, so the numbers are worked out once.
  const stats = useMemo(() => campaignStatsOf(data, state), [data, state]);
  return <Show company={state.player.company} stats={stats} onLeave={onLeave} />;
}

/** `outro`: which one to show (System options lists them all); none: the Company's own. */
export function OutroPreview({ data, campaign, company, outro, onClose }: { data: GameData; campaign: string; company: string; outro?: string | undefined; onClose: () => void }) {
  const stats = useMemo(() => sampleStats(data, campaign, company), [data, campaign, company]);
  return <Show company={company} stats={stats} preview outro={outro} onLeave={onClose} />;
}
