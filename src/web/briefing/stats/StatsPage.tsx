/**
 * Statistics and achievements (designer 2026-11-17; screen only, no rule). Reads the profile's
 * finished games (`Profile.history`, written at Game End, 10.3): lifetime totals, achievements,
 * and every game with its own numbers. Developer-mode games are listed, marked, and left out of
 * the totals and the achievements.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { Award, ChevronDown, Lock } from "lucide-react";
import type { GameData } from "../../../data/index.js";
import type { GameRecord, Profile } from "../../../engine/state.js";
import { TYPE_COLOUR } from "../../glyphs.js";
import { loreOf } from "../CampaignSelect.js";
import { PageShell } from "../PageShell.js";
import { playSelect } from "../soundHooks.js";
import { achievements, byCampaign, counted, listed, sumOf, totals, UNIT_KINDS, type Totals } from "./records.js";

const TABS = [
  { id: "overview", label: "Statistics" },
  { id: "achievements", label: "Achievements" },
  { id: "games", label: "Games" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const PLURAL: Record<string, string> = { Omega: "Omega", Bot: "Bots", Sentinel: "Sentinels", Gyro: "Gyros", Sleeper: "Sleepers", Flare: "Flares" };
const rgbOf = (type: string) => {
  const c = TYPE_COLOUR[type] ?? 0xcccccc;
  return `${(c >> 16) & 255} ${(c >> 8) & 255} ${c & 255}`;
};
const RESULT: Record<GameRecord["result"], { label: string; cls: string }> = {
  won: { label: "Won", cls: "bg-emerald-400/85 text-emerald-950" },
  lost: { label: "Lost", cls: "bg-rose-500/85 text-white" },
  conceded: { label: "Conceded", cls: "bg-slate-300/80 text-slate-900" },
  playing: { label: "In progress", cls: "bg-sky-300/85 text-sky-950" },
  unfinished: { label: "Unfinished", cls: "bg-slate-300/60 text-slate-900" },
};

/**
 * Round 29 (designer 2026-11-22): every number opens into one row per Campaign. `per` gives the
 * Campaigns played with their totals; `pick` reads this number from a Campaign's totals.
 */
type Per = { campaign: string; t: Totals }[];
const campaignTitle = (prefix: string) => loreOf(prefix).title;

function Breakdown({ per, pick, id, unit }: { per: Per; pick: (t: Totals) => number | string; id: string; unit?: (t: Totals) => string }) {
  return (
    <ul className="bf-pop grid gap-1" data-breakdown={id}>
      {per.length === 0 && <li className="text-[13px] text-sky-200">No Campaign played yet.</li>}
      {per.map((x) => (
        <li key={x.campaign} className="flex items-center justify-between gap-3 rounded-md bg-white/10 px-2.5 py-1.5 text-[14px]" data-campaign={x.campaign}>
          <span className="truncate text-sky-50">{campaignTitle(x.campaign)}</span>
          <b className="shrink-0 text-white">{unit ? unit(x.t) : pick(x.t)}</b>
        </li>
      ))}
    </ul>
  );
}

function Big({ n, label, id, on, onPress }: { n: number | string; label: string; id: string; on: boolean; onPress: () => void }) {
  return (
    <button type="button" className={`bf-panel relative !p-3 text-center ${on ? "bf-sel" : ""}`} data-total={id} aria-expanded={on} onClick={onPress}>
      <div className="text-3xl font-extrabold leading-none text-white sm:text-4xl">{n}</div>
      <div className="mt-1 text-[12px] font-bold uppercase tracking-[0.12em] text-sky-100">{label}</div>
      <ChevronDown size={14} className={`absolute bottom-1 right-1.5 text-sky-200 transition-transform ${on ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
  );
}

function Counter({ type, n, label, per, pick }: { type: string; n: number; label: string; per?: Per | undefined; pick?: (t: Totals) => number }) {
  const [open, setOpen] = useState(false);
  const can = !!per && !!pick;
  const row = (
    <>
      <i className="block h-3 w-3 shrink-0 rotate-45 rounded-[2px]" style={{ background: `rgb(${rgbOf(type)})` }} />
      <span className="flex-1 text-[14px] text-sky-50">{label}</span>
      <b className="text-lg text-white">{n}</b>
      {can && <ChevronDown size={14} className={`text-sky-200 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />}
    </>
  );
  return (
    <li className={`rounded-lg border border-white/20 bg-indigo-950/40 ${n ? "" : "opacity-50"}`} style={{ "--c": rgbOf(type) } as CSSProperties} data-count={`${label}`}>
      {can ? (
        <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" aria-expanded={open} onClick={() => (playSelect(), setOpen(!open))}>
          {row}
        </button>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2">{row}</div>
      )}
      {can && open && (
        <div className="px-2 pb-2">
          <Breakdown per={per} pick={pick} id={label} />
        </div>
      )}
    </li>
  );
}

function Numbers({ data, t, per }: { data: GameData; t: { overloads: number; destroyed: Record<string, number>; triggered: Record<string, number>; drained: number; moduleRuns: Record<number, number> }; per?: Per | undefined }) {
  const runs = Object.entries(t.moduleRuns)
    .map(([id, n]) => ({ id: Number(id), n, d: data.modules.byId.get(Number(id)) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  const top = runs[0]?.n ?? 1;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="bf-panel !p-4">
        <div className="bf-label">Units destroyed · {sumOf(t.destroyed)}</div>
        <ul className="mt-2 grid gap-1.5">
          {UNIT_KINDS.filter((k) => k !== "Flare").map((k) => (
            <Counter key={k} type={k} n={t.destroyed[k] ?? 0} label={PLURAL[k]!} per={per} pick={(x) => x.destroyed[k] ?? 0} />
          ))}
        </ul>
      </section>
      <section className="bf-panel !p-4">
        <div className="bf-label">Triggered and drained</div>
        <ul className="mt-2 grid gap-1.5">
          {(["Omega", "Sentinel", "Flare", "Sleeper"] as const).map((k) => (
            <Counter key={k} type={k} n={t.triggered[k] ?? 0} label={`${PLURAL[k]} triggered`} per={per} pick={(x) => x.triggered[k] ?? 0} />
          ))}
          <Counter type="Gyro" n={t.drained} label="Gyros drained" per={per} pick={(x) => x.drained} />
        </ul>
      </section>
      <section className="bf-panel !p-4">
        <div className="bf-label">Modules run · {sumOf(t.moduleRuns)}</div>
        {runs.length === 0 && <p className="mt-2 text-[14px] text-sky-100">No Module run yet.</p>}
        <ul className="mt-2 grid gap-1.5">
          {runs.slice(0, 12).map((x) => (
            <li key={x.id} className="text-[14px]" data-module={x.id}>
              <div className="flex justify-between gap-2">
                <span className="truncate text-sky-50">{x.d?.name ?? `Module ${x.id}`}</span>
                <b className="text-white">×{x.n}</b>
              </div>
              <div className="mt-0.5 h-1.5 rounded bg-white/15">
                <div className="h-full rounded" style={{ width: `${(100 * x.n) / top}%`, background: x.d?.colour === "Red" ? "#f87171" : x.d?.colour === "Blue" ? "#60a5fa" : "#facc15" }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** How many boxes stand in one row of the totals grid (2 on a phone, 4 from 640 px, 7 from 1024 px). */
function useCols(): number {
  const get = () => (typeof window === "undefined" ? 7 : window.innerWidth >= 1024 ? 7 : window.innerWidth >= 640 ? 4 : 2);
  const [n, setN] = useState(get);
  useEffect(() => {
    const f = () => setN(get());
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return n;
}

export function StatsPage({ data, profile, onBack }: { data: GameData; profile: Profile; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [open, setOpen] = useState<number | undefined>();
  // Round 29: the box opened into one row per Campaign (none at first), and the Vessel opened.
  const [big, setBig] = useState<string | undefined>();
  const [vessel, setVessel] = useState<string | undefined>();
  const cols = useCols();
  const games = counted(profile);
  const t = totals(games);
  const per = byCampaign(games);
  const ach = achievements(games);
  const everyGame = listed(profile);
  const all = everyGame.map((g, i) => ({ g, i })).reverse();
  const company = (id: string) => data.companies.byId.get(id)?.name ?? id;
  const devCount = everyGame.length - games.length;
  const live = profile.live && !profile.live.record.developer ? profile.live.record : undefined;
  // Designer 2026-11-22: Best score first; Lost and Conceded one number; each box opens per Campaign.
  const BIGS: { id: string; label: string; n: (x: Totals) => number | string }[] = [
    { id: "best", label: "Best score", n: (x) => x.best ?? "–" },
    { id: "games", label: "Games", n: (x) => x.games },
    { id: "won", label: "Won", n: (x) => x.won },
    { id: "lost", label: "Lost / Conceded", n: (x) => x.lostConceded },
    { id: "missions", label: "Missions done", n: (x) => x.missions },
    { id: "threat", label: "Threat columns", n: (x) => x.threatColumns },
    { id: "overloads", label: "Overloads", n: (x) => x.overloads },
  ];
  const openAt = BIGS.findIndex((b) => b.id === big);
  // The opened box's numbers per Campaign come right under the row it stands in.
  const after = openAt < 0 ? -1 : Math.min(BIGS.length - 1, Math.ceil((openAt + 1) / cols) * cols - 1);
  const panel = openAt >= 0 && (
    <div key="breakdown" className="bf-panel col-span-full !p-3" data-breakdown-of={big}>
      <div className="bf-label mb-1.5">{BIGS[openAt]!.label} · per Campaign</div>
      <Breakdown per={per} pick={BIGS[openAt]!.n} id={big!} />
    </div>
  );
  const vesselsPer = (id: string) => byCampaign(games.filter((g) => g.company === id));

  return (
    <PageShell id="stats" title="Statistics" sub="Your games, totals and achievements, updated after every mission" onBack={onBack} tabs={TABS} tab={tab} onTab={(x) => (playSelect(), setTab(x))}>
      <div className="mx-auto max-w-[1200px]">
        {games.length === 0 && (
          <p className="bf-panel mb-4 !p-4 text-[15px] text-sky-50" data-empty="1">
            No game counted yet. The numbers of every game, won or lost, are kept here from its first finished mission on.
            {devCount > 0 && ` (${devCount} Developer-mode game${devCount === 1 ? "" : "s"} listed under Games; they do not count.)`}
          </p>
        )}

        {tab === "overview" && (
          <div className="grid gap-4">
            {live && (
              <p className="rounded-lg border border-sky-200/50 bg-sky-300/15 px-3 py-2 text-[14px] text-sky-50" data-live="1">
                Includes the game under way: {live.missions.length} mission{live.missions.length === 1 ? "" : "s"} done so far. Won or Lost / Conceded is counted when it ends.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7" role="group" aria-label="Totals">
              {BIGS.flatMap((b, i) => {
                const box = <Big key={b.id} id={b.id} n={b.n(t)} label={b.label} on={big === b.id} onPress={() => (playSelect(), setBig(big === b.id ? undefined : b.id))} />;
                return i === after ? [box, panel] : [box];
              })}
            </div>
            <Numbers data={data} t={t} per={per} />
            <section className="bf-panel !p-4">
              <div className="bf-label">Vessels · tap one for its wins per Campaign</div>
              <ul className="mt-2 grid items-start gap-2 sm:grid-cols-2">
                {data.companies.companies.map((c) => {
                  const on = vessel === c.id;
                  return (
                    <li key={c.id} className="rounded-lg border border-white/20 bg-indigo-950/40 text-[14px]" data-vessel={c.id}>
                      <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" aria-expanded={on} onClick={() => (playSelect(), setVessel(on ? undefined : c.id))}>
                        <span className="text-sky-50">{c.name}</span>
                        <span className="flex items-center gap-1.5 text-white">
                          <span>
                            <b>{t.byCompany[c.id]?.games ?? 0}</b> games · <b>{t.byCompany[c.id]?.won ?? 0}</b> won
                          </span>
                          <ChevronDown size={14} className={`text-sky-200 transition-transform ${on ? "rotate-180" : ""}`} aria-hidden="true" />
                        </span>
                      </button>
                      {on && (
                        <div className="px-2 pb-2">
                          <Breakdown per={vesselsPer(c.id)} pick={(x) => x.won} unit={(x) => `${x.won} won of ${x.games}`} id={`vessel-${c.id}`} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        )}

        {tab === "achievements" && (
          <>
            <p className="mb-3 rounded-lg border border-amber-200/60 bg-amber-300/15 px-3 py-2 text-[14px] text-amber-100">
              Placeholder achievements: the real list is the designer's to give. Developer-mode games do not count.
            </p>
            <div className="mb-3 text-[14px] text-sky-100">
              <b className="text-white">{ach.filter((x) => x.earned).length}</b> of {ach.length} earned
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ach.map((x) => (
                <li key={x.a.id} className={`bf-panel flex gap-3 !p-3 ${x.earned ? "bf-sel" : ""}`} data-achievement={x.a.id} data-earned={x.earned ? "1" : "0"}>
                  <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${x.earned ? "bg-amber-300 text-amber-950" : "bg-white/10 text-sky-200"}`}>{x.earned ? <Award size={26} /> : <Lock size={22} />}</div>
                  <div className="min-w-0 flex-1">
                    <b className="block text-[16px] text-white">{x.a.name}</b>
                    <span className="block text-[14px] leading-snug text-sky-100">{x.a.text}</span>
                    {x.earned ? (
                      <span className="mt-1 block text-[12px] font-bold uppercase tracking-[0.1em] text-emerald-300">Earned {x.on}</span>
                    ) : (
                      <div className="mt-1.5">
                        <div className="h-1.5 rounded bg-white/15">
                          <div className="h-full rounded bg-acc" style={{ width: `${(100 * x.have) / x.a.need}%` }} />
                        </div>
                        <span className="text-[12px] text-sky-200">
                          {x.have} / {x.a.need}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === "games" && (
          <ul className="grid gap-2">
            {all.length === 0 && <li className="text-[15px] text-sky-100">No finished game yet.</li>}
            {all.map(({ g, i }) => (
              <li key={i} className="bf-panel !p-0" data-game={i}>
                <button type="button" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left" aria-expanded={open === i} onClick={() => (playSelect(), setOpen(open === i ? undefined : i))}>
                  <span className="text-[13px] text-sky-200">{g.date}</span>
                  <b className="text-[15px] text-white">{loreOf(g.campaign).title}</b>
                  <span className="text-[14px] text-sky-100">
                    {company(g.company)} · {g.freshness === "veteran" ? "Veteran" : "Fresh"}
                    {g.heatModule ? " · Heat module" : ""}
                  </span>
                  <span className="flex-1" />
                  {g.developer && <span className="rounded bg-violet-400/80 px-2 py-0.5 text-[12px] font-bold uppercase text-white">Developer</span>}
                  <span className={`rounded px-2 py-0.5 text-[12px] font-bold uppercase ${RESULT[g.result].cls}`}>{RESULT[g.result].label}</span>
                  <b className="w-12 text-right text-xl text-white">{g.score}</b>
                </button>
                {open === i && (
                  <div className="border-t border-white/15 p-3">
                    <div className="mb-3 text-[14px] text-sky-100">
                      Missions: {g.missions.length ? g.missions.map((m) => `${m.mission.replace(/^C\d+_/, "")} (${m.threat.length ? m.threat.join("+") : "no Threat"})`).join(", ") : "none"}
                    </div>
                    <Numbers data={data} t={g.stats} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
