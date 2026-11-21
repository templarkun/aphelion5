/**
 * The next mission's route (designer 2026-11-21, round 25): when two missions share a number (2X / 2Y,
 * 4X / 4Y), Mission Preparation step 1 (7.2) asks which one to play; the other is skipped for this
 * campaign. Asked here, on its own screen in the briefing's look, before the Threat and the Module:
 * a card per route (its Field, objective, event, Order), the Campaign's road of missions (won,
 * skipped, to choose now, ahead), where any mission's file can be opened, and the chosen route's
 * whole file with its units. This screen
 * only answers the engine's own question with one of its options; no rule lives here.
 */

import { useState } from "react";
import { Check, GitFork } from "lucide-react";
import type { GameData } from "../../data/index.js";
import type { Question } from "../../engine/questions.js";
import type { GameState } from "../../engine/state.js";
import { Readout } from "./hud.js";
import { MissionMap } from "./MissionMap.js";
import { eventText, missionLabel, objectiveText, orderText } from "./missionText.js";
import { MissionFile, MissionTimeline, type MissionStatus } from "./MissionTimeline.js";
import { sparkEdges } from "./particles.js";
import { playSelect } from "./soundHooks.js";
import { briefStyle } from "./styles/index.js";

/** The engine's prompt (campaign.ts, 7.2 step 1). */
export const ROUTE_PROMPT = /^Mission (\d+): choose a route/;

type OptionQ = Question & { kind: "option" };

export function RoutePick(p: {
  data: GameData;
  state: GameState;
  q: OptionQ;
  steps: React.ReactNode;
  frame: (x: { children: React.ReactNode; status: React.ReactNode; button: React.ReactNode; data?: Record<string, string> }) => React.ReactNode;
  head: (title: string, help: string) => React.ReactNode;
  send: (id: string, title: string, sub: string) => void;
  sent: boolean;
}) {
  const { data, state, q } = p;
  const camp = data.campaigns.find((c) => c.prefix === state.campaign)!;
  const [pick, setPick] = useState<string | undefined>();
  const [focus, setFocus] = useState<string | undefined>();
  const number = Number(ROUTE_PROMPT.exec(q.prompt)?.[1] ?? 0);
  const options = q.options.map((o) => camp.missionById.get(o.id)).filter((m): m is NonNullable<typeof m> => !!m);
  const chosen = pick ? camp.missionById.get(pick) : undefined;
  const won = new Set(state.run.completed.map((r) => r.mission));
  const status = (id: string): MissionStatus => (won.has(id) ? "done" : state.run.skipped.includes(id) ? "skipped" : q.options.some((o) => o.id === id) ? "open" : "later");
  const select = (id: string, el: Element) => {
    if (p.sent) return;
    playSelect();
    sparkEdges(el, briefStyle().acc);
    setPick(id);
    setFocus(undefined);
  };
  return p.frame({
    data: { "data-route-pick": String(q.options.length) },
    status: chosen ? (
      <span>
        Deploy to <b className="text-white">{missionLabel(chosen)}</b>; the other route is skipped
      </span>
    ) : (
      <span className="font-semibold text-amber-200">Tap the route to take</span>
    ),
    button: (
      <button type="button" className="bf-btn bf-primary" disabled={!chosen || p.sent} onClick={() => chosen && p.send(chosen.id, "ROUTE LOCKED", missionLabel(chosen))} data-action="prep">
        <Check size={18} /> Take this route
      </button>
    ),
    children: (
      <>
        {p.steps}
        {p.head(`Mission ${number}: choose your route`, "Two missions share this number. Choose the one you play; the other is skipped for this campaign (rule 7.2).")}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2" role="radiogroup" aria-label="Routes">
          {options.map((m, i) => {
            const on = pick === m.id;
            return (
              <button key={m.id} type="button" role="radio" aria-checked={on} data-prep-pick={m.id} className={`bf-panel bf-rise flex min-w-0 items-start gap-3 !p-3 text-left ${on ? "bf-sel" : ""}`} style={{ "--i": i } as React.CSSProperties} onClick={(e) => select(m.id, e.currentTarget)}>
                <MissionMap m={m} className="h-[96px] w-[132px] shrink-0 sm:h-[120px] sm:w-[170px]" />
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xl font-extrabold uppercase tracking-wide text-white">
                    <GitFork size={16} className="text-amber-300" /> {missionLabel(m)}
                  </span>
                  <Readout label="Objective">
                    <span className="text-[14px] font-normal">{objectiveText(camp, m)}</span>
                  </Readout>
                  <Readout label="Mission event">
                    <span className="text-[14px] font-normal">{eventText(m)}</span>
                  </Readout>
                  <Readout label="Mission Order">
                    <span className="text-[14px] font-normal">{orderText(m)}</span>
                  </Readout>
                  <span className="text-[13px] text-sky-100">{m.mapSectorCount} sectors</span>
                </span>
              </button>
            );
          })}
        </div>
        <section className="bf-panel mt-4 p-3 sm:p-4" aria-label="Road of missions">
          <div className="bf-label mb-2">Road of missions · tap one to open its file, again to close it</div>
          <MissionTimeline data={data} campaign={camp} focus={focus} onFocus={setFocus} status={status} />
        </section>
        {chosen && (
          <section className="bf-panel mt-4 p-3 sm:p-4" aria-label={`${missionLabel(chosen)} file`} data-route-file={chosen.id}>
            <div className="bf-label">Mission file</div>
            <MissionFile key={chosen.id} data={data} campaign={camp} m={chosen} />
          </section>
        )}
      </>
    ),
  });
}
