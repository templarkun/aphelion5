/**
 * Game End (Core Rules 10.3): after the last mission is won, one of the victory outros at random
 * (index.ts, VICTORY_POOL; designer 2026-11-27); after a loss or a concede, one of the two loss outros at random (designer
 * 2026-11-24, LossOutro.tsx); with the numbers of the finished game, over the whole page. "RETURN TO
 * COMMAND DECK" plays the logo gate (briefing/Gate.tsx) and goes back to the menu behind it.
 * Also the preview of an outro with made-up numbers (System options > Play the outro).
 * Screen only: the game is already over and scored when this shows.
 */

import { useMemo } from "react";
import { createPortal } from "react-dom";
import type { GameData } from "../../data/index.js";
import type { GameState } from "../../engine/state.js";
import { gateBusy, runGate } from "../briefing/Gate.js";
import { lossOutroFor, LOSS_OUTROS, outroFor } from "./index.js";
import { campaignStatsOf, sampleStats } from "./stats.js";
import { companyTheme } from "./themes.js";
import type { CampaignStats } from "./types.js";

/** Does this finished game get an outro? Every scored game: a won Campaign its victory outro, a loss or a concede a loss outro (designer 2026-11-24). */
export function hasOutro(state: GameState): boolean {
  // A mission playtest (Campaign editor) ends with the plain result card, no outro (designer 2026-11-27).
  return state.ending !== undefined && state.outcome !== undefined && !state.settings.playtest;
}

function Show({ company, stats, preview, outro, onLeave }: { company: string; stats: CampaignStats; preview?: boolean; outro?: string | undefined; onLeave: () => void }) {
  const theme = useMemo(() => companyTheme(company), [company]);
  // A loss: one of the two loss outros, picked once at random when the page opens (or the one previewed).
  // Picked once, at random, when the page opens (a won game: one of VICTORY_POOL; a loss: one of the two loss outros).
  // The browser check may name one (`window.__outroPick`) so it knows which film to expect.
  const pick = useMemo(() => {
    const named = outro ?? (typeof window !== "undefined" ? (window as { __outroPick?: string }).__outroPick : undefined);
    return stats.result === "won" ? outroFor(company, named) : lossOutroFor(named);
  }, [stats.result, company, outro]);
  const { Component, name } = pick;
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
  // A loss outro is previewed as a lost game (sample numbers: two missions done).
  const loss = LOSS_OUTROS.some((o) => o.id === outro);
  const stats = useMemo(() => sampleStats(data, campaign, company, loss ? "lost" : "won"), [data, campaign, company, loss]);
  return <Show company={company} stats={stats} preview outro={outro} onLeave={onClose} />;
}
