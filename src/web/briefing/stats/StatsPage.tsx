/**
 * Statistics and achievements (designer 2026-11-17; screen only, no rule). Reads the profile's
 * finished games (`Profile.history`, written at Game End, 10.3): lifetime totals, achievements,
 * and every game with its own numbers. Developer-mode games are listed, marked, and left out of
 * the totals and the achievements.
 */

import { useState, type CSSProperties } from "react";
import { Award, Lock } from "lucide-react";
import type { GameData } from "../../../data/index.js";
import type { GameRecord, Profile } from "../../../engine/state.js";
import { TYPE_COLOUR } from "../../glyphs.js";
import { loreOf } from "../CampaignSelect.js";
import { PageShell } from "../PageShell.js";
import { playSelect } from "../soundHooks.js";
import { achievements, counted, sumOf, totals, UNIT_KINDS } from "./records.js";

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
};

function Big({ n, label, id }: { n: number | string; label: string; id: string }) {
  return (
    <div className="bf-panel !p-3 text-center" data-total={id}>
      <div className="text-3xl font-extrabold leading-none text-white sm:text-4xl">{n}</div>
      <div className="mt-1 text-[12px] font-bold uppercase tracking-[0.12em] text-sky-100">{label}</div>
    </div>
  );
}

function Counter({ type, n, label }: { type: string; n: number; label: string }) {
  return (
    <li className={`flex items-center gap-2 rounded-lg border border-white/20 bg-indigo-950/40 px-3 py-2 ${n ? "" : "opacity-50"}`} style={{ "--c": rgbOf(type) } as CSSProperties} data-count={`${label}`}>
      <i className="block h-3 w-3 shrink-0 rotate-45 rounded-[2px]" style={{ background: `rgb(${rgbOf(type)})` }} />
      <span className="flex-1 text-[14px] text-sky-50">{label}</span>
      <b className="text-lg text-white">{n}</b>
    </li>
  );
}

function Numbers({ data, t }: { data: GameData; t: { overloads: number; destroyed: Record<string, number>; triggered: Record<string, number>; drained: number; moduleRuns: Record<number, number> } }) {
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
            <Counter key={k} type={k} n={t.destroyed[k] ?? 0} label={PLURAL[k]!} />
          ))}
        </ul>
      </section>
      <section className="bf-panel !p-4">
        <div className="bf-label">Triggered and drained</div>
        <ul className="mt-2 grid gap-1.5">
          {(["Omega", "Sentinel", "Flare", "Sleeper"] as const).map((k) => (
            <Counter key={k} type={k} n={t.triggered[k] ?? 0} label={`${PLURAL[k]} triggered`} />
          ))}
          <Counter type="Gyro" n={t.drained} label="Gyros drained" />
        </ul>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-white/20 bg-indigo-950/40 px-3 py-2">
          <span className="text-[14px] text-sky-50">Overloads</span>
          <b className="text-lg text-white">{t.overloads}</b>
        </div>
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

export function StatsPage({ data, profile, onBack }: { data: GameData; profile: Profile; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [open, setOpen] = useState<number | undefined>();
  const games = counted(profile);
  const t = totals(games);
  const ach = achievements(games);
  const all = [...(profile.history ?? [])].map((g, i) => ({ g, i })).reverse();
  const company = (id: string) => data.companies.byId.get(id)?.name ?? id;
  const devCount = (profile.history ?? []).length - games.length;

  return (
    <PageShell id="stats" title="Statistics" sub="Your finished games, totals and achievements" onBack={onBack} tabs={TABS} tab={tab} onTab={(x) => (playSelect(), setTab(x))}>
      <div className="mx-auto max-w-[1200px]">
        {games.length === 0 && (
          <p className="bf-panel mb-4 !p-4 text-[15px] text-sky-50" data-empty="1">
            No finished game yet. The numbers of every game you finish, won or lost, are kept here.
            {devCount > 0 && ` (${devCount} Developer-mode game${devCount === 1 ? "" : "s"} listed under Games; they do not count.)`}
          </p>
        )}

        {tab === "overview" && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <Big id="games" n={t.games} label="Games" />
              <Big id="won" n={t.won} label="Won" />
              <Big id="lost" n={t.lost} label="Lost" />
              <Big id="conceded" n={t.conceded} label="Conceded" />
              <Big id="best" n={t.best ?? "–"} label="Best score" />
              <Big id="missions" n={t.missions} label="Missions done" />
              <Big id="threat" n={t.threatColumns} label="Threat columns" />
              <Big id="overloads" n={t.overloads} label="Overloads" />
            </div>
            <Numbers data={data} t={t} />
            <section className="bf-panel !p-4">
              <div className="bf-label">Vessels</div>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {data.companies.companies.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg border border-white/20 bg-indigo-950/40 px-3 py-2 text-[14px]">
                    <span className="text-sky-50">{c.name}</span>
                    <span className="text-white">
                      <b>{t.byCompany[c.id]?.games ?? 0}</b> games · <b>{t.byCompany[c.id]?.won ?? 0}</b> won
                    </span>
                  </li>
                ))}
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
