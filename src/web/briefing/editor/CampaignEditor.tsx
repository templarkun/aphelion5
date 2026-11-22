/**
 * The Campaign editor (designer 2026-11-17/18, Developer tools; `docs/campaign-editor.md`): the
 * palette of chosen units, the Omega units, Campaign Orders and missions (deck, Threat columns,
 * map, objective, event, Order), the dev prices (per unit; summed per mission roster, per Threat
 * column and for the whole Campaign), live checks, and export as a Campaign file for the Project
 * and as an editor file to go on with. The draft is kept in this browser. Screen only, no rule.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Copy, Download, FileText, Minus, Plus, Trash2, Upload, Wrench, X } from "lucide-react";
import { parseCampaign, THREAT_COLUMNS, type ThreatColumn } from "../../../data/campaign.js";
import type { GameData } from "../../../data/index.js";
import { UNIT_TYPES, type UnitDef } from "../../../data/units.js";
import { download } from "../../idbStore.js";
import { PageShell } from "../PageShell.js";
import { playSelect } from "../soundHooks.js";
import { UnitTile } from "../UnitTile.js";
import { EffectEditor, INP } from "./EffectEditor.js";
import { MapTool } from "./MapTool.js";
import {
  campaignFileText,
  campaignPrice,
  checks,
  copiesOf,
  draftFromCampaign,
  EVENT_KINDS,
  eventLabel,
  freeCopies,
  G00,
  missionTag,
  newDraft,
  newMission,
  OMEGA_IDS,
  OMEGA_ROLES,
  placeableUnits,
  priceOf,
  priceSum,
  readDraft,
  rosterOf,
  threatRoster,
  usedInMission,
  type Draft,
  type EventDraft,
  type MissionDraft,
  type OrderDraft,
  type PriceSum,
  type Problem,
} from "./model.js";

const KEY = "aphelion5.editor";
const txt = { userSelect: "text" } as const;

function loadDraft(): Draft | undefined {
  try {
    const t = localStorage.getItem(KEY);
    return t ? readDraft(t) : undefined;
  } catch {
    return undefined;
  }
}
function keepDraft(d: Draft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage blocked: the draft lives until the page closes; export it to keep it */
  }
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""));

/** "Σ 12.5" and what had no price. */
function Price({ p, label, id }: { p: PriceSum; label?: string; id?: string }) {
  const un = Object.entries(p.unpriced);
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5 text-[13px] text-sky-100" data-price={id} data-sum={p.sum}>
      {label && <span>{label}</span>}
      <b className="text-[15px] text-amber-200">Σ {fmt(p.sum)}</b>
      {un.length > 0 && <span className="text-[12px] text-sky-200/80">(no price: {un.map(([k, n]) => `${n}× ${k}`).join(", ")})</span>}
    </span>
  );
}

function Stepper({ n, onChange, min = 0, max = 99, label }: { n: number; onChange: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={label}>
      <button type="button" className="grid h-8 w-8 place-items-center rounded-full border border-white/40 text-white hover:bg-white/10 disabled:opacity-30" disabled={n <= min} aria-label={`${label}: one less`} onClick={() => onChange(n - 1)}>
        <Minus size={14} />
      </button>
      <b className="w-7 text-center text-[15px] text-white">{n}</b>
      <button type="button" className="grid h-8 w-8 place-items-center rounded-full border border-white/40 text-white hover:bg-white/10 disabled:opacity-30" disabled={n >= max} aria-label={`${label}: one more`} onClick={() => onChange(n + 1)}>
        <Plus size={14} />
      </button>
    </span>
  );
}

/** A unit as a small tile with its id and dev price. */
function Tile({ data, d, id, size = 52, children, onClick, dim }: { data: GameData; d: Draft; id: string; size?: number; children?: ReactNode; onClick?: (() => void) | undefined; dim?: boolean | undefined }) {
  const u = data.units.byId.get(id);
  const price = priceOf(data, d, id);
  const level = id.startsWith("O_") ? d.omega.find((o) => o.id === id)?.level : undefined;
  const body = (
    <>
      {u ? (
        <UnitTile unit={u} level={level} size={size} dim={!!dim} />
      ) : (
        <span className="grid place-items-center rounded-lg border border-dashed border-white/50 text-[13px] font-bold text-white" style={{ width: size, height: size * 1.12 }}>
          G_00
        </span>
      )}
      <span className="text-[11px] font-semibold text-white">{id}</span>
      <span className="text-[11px] font-bold text-amber-200" data-dev-price={price ?? ""}>
        {price === undefined ? "–" : fmt(price)}
      </span>
      {children}
    </>
  );
  return onClick ? (
    <button type="button" className="flex flex-col items-center rounded-lg p-1 hover:bg-white/10" onClick={onClick} data-tile={id}>
      {body}
    </button>
  ) : (
    <span className="flex flex-col items-center p-1" data-tile={id}>
      {body}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-[60] grid place-items-center bg-indigo-950/70 p-3" onClick={onClose}>
      <div className="bf-panel bf-solid bf-scroll max-h-[92vh] w-[min(96vw,760px)] !p-4" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 text-lg font-extrabold uppercase tracking-[0.1em] text-white">{title}</h2>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-full text-white hover:bg-white/15" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function OrderEditor({ o, onChange, onRemove, label }: { o: OrderDraft; onChange: (o: OrderDraft) => void; onRemove?: () => void; label: string }) {
  return (
    <div className="grid gap-2 rounded-lg border border-white/20 bg-indigo-950/30 p-2.5" data-order-editor={label}>
      <div className="flex flex-wrap items-center gap-3">
        <b className="text-[14px] text-white">{label}</b>
        <span className="text-[13px] text-sky-100">Command tokens</span>
        <Stepper n={o.tokens} min={1} max={9} label="Command tokens" onChange={(tokens) => onChange({ ...o, tokens })} />
        <label className="flex items-center gap-1.5 text-[13px] text-sky-100">
          <input type="checkbox" checked={o.overloadOnly} onChange={(e) => onChange({ ...o, overloadOnly: e.target.checked })} /> Overload only
        </label>
        <span className="flex-1" />
        {onRemove && (
          <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-rose-200 hover:bg-white/10" aria-label={`Remove ${label}`} onClick={onRemove}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <EffectEditor label="Effect" place="order" value={o.effect} onChange={(effect) => onChange({ ...o, effect: effect ?? { mode: "blocks", steps: [] } })} />
    </div>
  );
}

const PANES = [
  { id: "palette", label: "Palette" },
  { id: "campaign", label: "Campaign" },
  { id: "mission", label: "Mission" },
] as const;
type Pane = (typeof PANES)[number]["id"];
const MTABS = [
  { id: "deck", label: "Deck" },
  { id: "threats", label: "Threats" },
  { id: "map", label: "Map" },
  { id: "goal", label: "Objective & event" },
  { id: "order", label: "Order" },
  { id: "check", label: "Check" },
] as const;
type MTab = (typeof MTABS)[number]["id"];

function Problems({ list }: { list: Problem[] }) {
  if (list.length === 0)
    return (
      <p className="flex items-center gap-2 text-[14px] text-emerald-200" data-problems="0">
        <CheckCircle2 size={18} /> No problems found.
      </p>
    );
  const style = { error: "border-rose-300/70 bg-rose-500/25", warn: "border-amber-200/70 bg-amber-300/15", todo: "border-sky-200/60 bg-sky-300/10" };
  return (
    <ul className="grid gap-1.5" data-problems={list.length}>
      {list.map((p, i) => (
        <li key={i} className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[14px] text-white ${style[p.level]}`} data-problem={p.level}>
          {p.level === "todo" ? <Wrench size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
          <span>
            {p.where && <b>{p.where}: </b>}
            {p.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CampaignEditor({ data, onBack }: { data: GameData; onBack: () => void }) {
  const [d, setD] = useState<Draft>(() => loadDraft() ?? newDraft());
  const [sel, setSel] = useState(0);
  const [pane, setPane] = useState<Pane>("mission");
  const [mtab, setMtab] = useState<MTab>("deck");
  const [picker, setPicker] = useState(false);
  const [filter, setFilter] = useState<string>("Sentinel");
  const [adding, setAdding] = useState<ThreatColumn | undefined>();
  const [modal, setModal] = useState<"file" | "export" | undefined>();
  const [paste, setPaste] = useState("");
  const [fileNote, setFileNote] = useState<string | undefined>();
  const [copied, setCopied] = useState<string | undefined>();

  useEffect(() => keepDraft(d), [d]);
  const m = d.missions[Math.min(sel, d.missions.length - 1)]!;
  const mi = d.missions.indexOf(m);
  const problems = useMemo(() => checks(data, d), [data, d]);
  const units = useMemo(() => placeableUnits(data), [data]);
  const total = campaignPrice(data, d);

  const setM = (n: MissionDraft) => setD({ ...d, missions: d.missions.map((x, i) => (i === mi ? n : x)) });
  const order = useMemo(() => [...d.missions.keys()].sort((a, b) => d.missions[a]!.number - d.missions[b]!.number || d.missions[a]!.route.localeCompare(d.missions[b]!.route)), [d.missions]);
  /** Units a mission can take: the palette, the Omega units, and G_00 for the deck. */
  const deckIds = [...OMEGA_IDS, ...d.palette, G00];
  const usedAnywhere = (id: string) => d.missions.some((x) => (usedInMission(x)[id] ?? 0) > 0);

  function start(x: Draft, note: string): void {
    setD(x);
    setSel(0);
    setFileNote(note);
    playSelect();
  }
  function importText(t: string): void {
    try {
      const s = t.trim();
      if (s.startsWith("{")) return start(readDraft(s), "Editor file loaded.");
      const c = parseCampaign(s, "the pasted file");
      start(draftFromCampaign(c), `Campaign file ${c.prefix} loaded: its effects come in as text.`);
    } catch (e) {
      setFileNote(`That could not be read: ${(e as Error).message}`);
    }
  }
  async function copy(what: string, t: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(t);
      setCopied(what);
    } catch {
      setCopied(`${what}: copying is blocked here, select the text and copy it`);
    }
  }

  const fileText = modal === "export" ? campaignFileText(d) : "";
  const editorText = modal === "export" ? JSON.stringify(d) : "";
  const errors = problems.filter((p) => p.level === "error").length;

  const right = (
    <div className="flex items-center gap-1.5">
      <button type="button" className="bf-btn !min-h-[40px] !px-3" data-action="editor-file" onClick={() => (setFileNote(undefined), setModal("file"))}>
        <FileText size={16} /> <span className="hidden sm:inline">New / Import</span>
      </button>
      <button type="button" className="bf-btn bf-primary !min-h-[40px] !px-3" data-action="editor-export" onClick={() => (setCopied(undefined), setModal("export"))}>
        <Download size={16} /> <span className="hidden sm:inline">Export</span>
      </button>
    </div>
  );

  // -- Palette ---------------------------------------------------------------
  const palettePane = (
    <section className="bf-panel grid content-start gap-3 !p-3" aria-label="Palette" data-pane="palette">
      <div className="flex items-center gap-2">
        <div className="bf-label flex-1">Palette · {d.palette.length} units</div>
        <button type="button" className="bf-btn !min-h-[36px] !px-3 !text-[13px]" aria-expanded={picker} data-action="palette-add" onClick={() => setPicker(!picker)}>
          <Plus size={15} /> Add units
        </button>
      </div>
      {picker && (
        <div className="grid gap-2 rounded-lg border border-white/25 bg-indigo-950/40 p-2" data-picker>
          <div className="flex flex-wrap gap-1">
            {UNIT_TYPES.filter((t) => t !== "Mecha" && t !== "Omega").map((t) => (
              <button key={t} type="button" className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${filter === t ? "bg-white text-indigo-950" : "text-white hover:bg-white/10"}`} onClick={() => setFilter(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap">
            {units
              .filter((u) => u.type === filter && !d.palette.includes(u.id))
              .map((u) => (
                <Tile key={u.id} data={data} d={d} id={u.id} size={44} onClick={() => setD({ ...d, palette: [...d.palette, u.id].sort() })} />
              ))}
          </div>
          <button type="button" className="bf-btn !min-h-[34px] justify-self-start !px-3 !text-[13px]" onClick={() => setD({ ...d, palette: [...new Set([...d.palette, ...units.filter((u) => u.type === filter).map((u) => u.id)])].sort() })}>
            Add every {filter}
          </button>
        </div>
      )}
      <div>
        <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-sky-200">Omega units (every Campaign)</div>
        <div className="flex flex-wrap">
          {OMEGA_IDS.map((id) => (
            <Tile key={id} data={data} d={d} id={id} size={44} />
          ))}
        </div>
      </div>
      {UNIT_TYPES.filter((t) => d.palette.some((id) => data.units.byId.get(id)?.type === t)).map((t) => (
        <div key={t}>
          <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-sky-200">{t}</div>
          <div className="flex flex-wrap">
            {d.palette
              .filter((id) => data.units.byId.get(id)?.type === t)
              .map((id) => (
                <Tile key={id} data={data} d={d} id={id} size={44}>
                  <button
                    type="button"
                    className="text-[11px] text-rose-200 underline disabled:no-underline disabled:opacity-40"
                    disabled={usedAnywhere(id)}
                    title={usedAnywhere(id) ? "Used in a mission: take it out there first" : "Take it out of the palette"}
                    onClick={() => setD({ ...d, palette: d.palette.filter((x) => x !== id) })}
                  >
                    remove
                  </button>
                </Tile>
              ))}
          </div>
        </div>
      ))}
      {d.palette.length === 0 && <p className="text-[14px] text-sky-100">Press Add units to choose this Campaign's units.</p>}
    </section>
  );

  // -- Campaign --------------------------------------------------------------
  const campaignPane = (
    <section className="grid content-start gap-3" aria-label="Campaign" data-pane="campaign">
      <div className="bf-panel grid gap-2 !p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[14px] text-sky-100">
            Campaign id
            <input className={`${INP} w-20 font-bold`} style={txt} value={d.prefix} aria-label="Campaign id" onChange={(e) => setD({ ...d, prefix: e.target.value.toUpperCase().replace(/[^C0-9]/g, "") })} />
          </label>
          <span className="flex-1" />
          <Price p={total} label="Whole Campaign (X path)" id="campaign" />
        </div>
        <p className="text-[12px] text-sky-200/80">The Campaign's sum adds up every mission roster (deck and Omega units placed), not the Threat columns.</p>
      </div>

      <div className="bf-panel grid gap-3 !p-3">
        <div className="bf-label">Omega units</div>
        {d.omega.map((o, i) => {
          const set = (p: Partial<typeof o>) => setD({ ...d, omega: d.omega.map((x, j) => (j === i ? { ...x, ...p } : x)) });
          return (
            <div key={o.id} className="grid gap-2 rounded-lg border border-white/20 bg-indigo-950/30 p-2.5" data-omega={o.id}>
              <div className="flex flex-wrap items-center gap-3">
                <Tile data={data} d={d} id={o.id} size={40} />
                <b className="text-[15px] text-white">{OMEGA_ROLES[o.id]}</b>
                <span className="text-[13px] text-sky-100">Level</span>
                <Stepper n={o.level} min={1} max={60} label={`${o.id} Level`} onChange={(level) => set({ level })} />
                <label className="flex items-center gap-1.5 text-[13px] text-sky-100">
                  Dev price
                  <input className={`${INP} w-20`} style={txt} type="number" step="0.1" aria-label={`${o.id} dev price`} value={o.devPrice ?? ""} onChange={(e) => set({ devPrice: e.target.value === "" ? undefined : Number(e.target.value) })} />
                </label>
              </div>
              <EffectEditor label="Destroyed" place="omega" value={o.destroyed} onChange={(destroyed) => set({ destroyed })} />
              <EffectEditor label="At Overload" place="omega" value={o.atOverload} onChange={(atOverload) => set({ atOverload })} />
            </div>
          );
        })}
      </div>

      <div className="bf-panel grid gap-2 !p-3">
        <div className="flex items-center gap-2">
          <div className="bf-label flex-1">Campaign Orders · every mission</div>
          <button type="button" className="bf-btn !min-h-[36px] !px-3 !text-[13px]" onClick={() => setD({ ...d, orders: [...d.orders, { tokens: 1, overloadOnly: false, effect: { mode: "blocks", steps: [] } }] })}>
            <Plus size={15} /> Order
          </button>
        </div>
        {d.orders.map((o, i) => (
          <OrderEditor key={i} label={`Order ${i + 1}`} o={o} onChange={(n) => setD({ ...d, orders: d.orders.map((x, j) => (j === i ? n : x)) })} onRemove={() => setD({ ...d, orders: d.orders.filter((_, j) => j !== i) })} />
        ))}
      </div>

      <div className="bf-panel grid gap-2 !p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="bf-label flex-1">Missions</div>
          <button
            type="button"
            className="bf-btn !min-h-[36px] !px-3 !text-[13px]"
            data-action="add-mission"
            onClick={() => {
              const n = Math.max(0, ...d.missions.map((x) => x.number)) + 1;
              setD({ ...d, missions: [...d.missions, newMission(n)] });
              setSel(d.missions.length);
            }}
          >
            <Plus size={15} /> Mission
          </button>
        </div>
        <ul className="grid gap-1.5">
          {order.map((i) => {
            const x = d.missions[i]!;
            return (
              <li key={i}>
                <button type="button" className={`bf-panel flex w-full items-center gap-2 !px-3 !py-2 text-left ${i === mi ? "bf-sel" : ""}`} data-mission={missionTag(x)} onClick={() => (playSelect(), setSel(i), setPane("mission"))}>
                  <b className="w-12 text-[15px] text-white">{missionTag(x)}</b>
                  <span className="flex-1 truncate text-[13px] text-sky-100">
                    {x.map.length} sectors · {Object.values(x.deck).reduce((a, b) => a + b, 0)} tiles · {x.objective.type === "salvage" ? "Salvage" : `Eliminate ${x.objective.count} ${x.objective.target}`}
                  </span>
                  <Price p={priceSum(data, d, rosterOf(x))} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );

  // -- Mission ---------------------------------------------------------------
  const deal = Object.values(m.deck).reduce((a, b) => a + b, 0);
  const missionProblems = problems.filter((p) => p.where === missionTag(m));
  const setEvent = (e: EventDraft) => setM({ ...m, event: e });
  const missionPane = (
    <section className="bf-panel grid content-start gap-3 !p-3" aria-label={`Mission ${missionTag(m)}`} data-pane="mission" data-open-mission={missionTag(m)}>
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-xl text-white">{missionTag(m)}</b>
        <span className="text-[13px] text-sky-100">Number</span>
        <Stepper n={m.number} min={1} max={20} label="Mission number" onChange={(number) => setM({ ...m, number })} />
        <select className={INP} aria-label="Route" value={m.route} onChange={(e) => setM({ ...m, route: e.target.value as MissionDraft["route"] })}>
          <option value="single">Single route</option>
          <option value="x">Route x (alternative)</option>
          <option value="y">Route y (alternative)</option>
        </select>
        <span className="flex-1" />
        <Price p={priceSum(data, d, rosterOf(m))} label="Mission roster" id="mission" />
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-full text-rose-200 hover:bg-white/10 disabled:opacity-30"
          disabled={d.missions.length === 1}
          aria-label={`Delete ${missionTag(m)}`}
          onClick={() => {
            if (!window.confirm(`Delete ${missionTag(m)}?`)) return;
            setD({ ...d, missions: d.missions.filter((_, i) => i !== mi) });
            setSel(0);
          }}
        >
          <Trash2 size={17} />
        </button>
      </div>
      <nav className="flex flex-wrap gap-1 border-b border-white/15" aria-label="Mission sections">
        {MTABS.map((t) => (
          <button key={t.id} type="button" data-mtab={t.id} aria-current={mtab === t.id ? "page" : undefined} className={`border-b-[3px] px-2.5 py-1.5 text-[13px] font-bold uppercase tracking-[0.08em] ${mtab === t.id ? "border-white text-white" : "border-transparent text-sky-200/80 hover:text-white"}`} onClick={() => setMtab(t.id)}>
            {t.label}
            {t.id === "check" && missionProblems.length > 0 && <span className="ml-1 rounded-full bg-amber-300 px-1.5 text-[11px] text-amber-950">{missionProblems.length}</span>}
          </button>
        ))}
      </nav>

      {mtab === "deck" && (
        <div className="grid gap-2">
          <p className="text-[13px] text-sky-100">
            The shuffled deployment: {deal} tiles. A unit can never go past the copies that exist (counted over the deck, the Omega units placed and all four Threat columns).
          </p>
          <ul className="grid gap-1.5 sm:grid-cols-2 2xl:grid-cols-3">
            {deckIds.map((id) => {
              const n = m.deck[id] ?? 0;
              const free = freeCopies(data, m, id);
              return (
                <li key={id} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${n ? "border-white/40 bg-white/10" : "border-white/15"}`} data-deck={id}>
                  <Tile data={data} d={d} id={id} size={36} />
                  <span className="flex-1 text-[12px] text-sky-200">
                    {free} of {copiesOf(data, id)} free
                  </span>
                  <Stepper n={n} max={n + Math.max(0, free)} label={`${id} in the deck`} onChange={(c) => setM({ ...m, deck: { ...m.deck, [id]: c } })} />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {mtab === "threats" && (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          {THREAT_COLUMNS.map((c) => (
            <div key={c} className="grid content-start gap-2 rounded-lg border border-white/20 bg-indigo-950/30 p-2" data-threat={c}>
              <div className="flex items-center gap-2">
                <b className="flex-1 text-[15px] text-white">Threat {c}</b>
                <Price p={priceSum(data, d, threatRoster(m, c))} id={`threat-${c}`} />
              </div>
              <div className="flex flex-wrap">
                {m.threat[c].map((id, i) => (
                  <Tile key={i} data={data} d={d} id={id} size={40} onClick={() => setM({ ...m, threat: { ...m.threat, [c]: m.threat[c].filter((_, j) => j !== i) } })} />
                ))}
              </div>
              {m.threat[c].length > 0 && <p className="text-[11px] text-sky-200/80">Tap a tile to take it out.</p>}
              <button type="button" className="bf-btn !min-h-[34px] justify-self-start !px-3 !text-[13px]" data-action={`threat-add-${c}`} aria-expanded={adding === c} onClick={() => setAdding(adding === c ? undefined : c)}>
                <Plus size={15} /> Add
              </button>
              {adding === c && (
                <div className="flex flex-wrap rounded-lg border border-white/25 bg-black/20 p-1" data-threat-picker={c}>
                  {[...OMEGA_IDS, ...d.palette].map((id) => {
                    const free = freeCopies(data, m, id);
                    return <Tile key={id} data={data} d={d} id={id} size={36} dim={free <= 0} onClick={free > 0 ? () => setM({ ...m, threat: { ...m.threat, [c]: [...m.threat[c], id] } }) : undefined} />;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {mtab === "map" && (
        <MapTool
          m={m}
          onChange={setM}
          others={order.filter((i) => i !== mi).map((i) => ({ tag: missionTag(d.missions[i]!), map: d.missions[i]!.map }))}
        />
      )}

      {mtab === "goal" && (
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="bf-label">Objective (8.2)</div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={INP}
                aria-label="Objective"
                value={m.objective.type}
                onChange={(e) => setM({ ...m, objective: e.target.value === "salvage" ? { type: "salvage" } : { type: "eliminate", target: "O_01", count: 6 } })}
              >
                <option value="salvage">Salvage (5 Power Nodes, 3 Cleared sectors)</option>
                <option value="eliminate">Eliminate Omega units</option>
              </select>
              {m.objective.type === "eliminate" && (
                <>
                  <Stepper n={m.objective.count} min={1} max={20} label="How many" onChange={(count) => setM({ ...m, objective: { ...(m.objective as { type: "eliminate"; target: string; count: number }), count } })} />
                  <select className={INP} aria-label="Which Omega unit" value={m.objective.target} onChange={(e) => setM({ ...m, objective: { ...(m.objective as { type: "eliminate"; target: string; count: number }), target: e.target.value } })}>
                    {OMEGA_IDS.map((id) => (
                      <option key={id} value={id}>
                        {OMEGA_ROLES[id]}s ({id})
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <div className="bf-label">Mission event (7.2 step 9)</div>
            <select
              className={`${INP} justify-self-start`}
              aria-label="Mission event"
              value={m.event.type}
              onChange={(e) => {
                const t = e.target.value as EventDraft["type"];
                setEvent(t === "none" ? { type: "none" } : t === "allied_drop" ? { type: "allied_drop", level: 1 } : t === "gain_energy" ? { type: "gain_energy", any: 3, energy: { Yellow: 0, Red: 0, Blue: 0 } } : { type: t, amount: 1 });
              }}
            >
              {EVENT_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
            {m.event.type === "allied_drop" && (
              <span className="flex items-center gap-2 text-[14px] text-sky-100">
                Level <Stepper n={m.event.level} min={1} max={5} label="Allied Drop Level" onChange={(level) => setEvent({ type: "allied_drop", level })} />
              </span>
            )}
            {m.event.type === "gain_energy" &&
              (() => {
                const ev = m.event;
                return (
                  <div className="flex flex-wrap items-center gap-3 text-[14px] text-sky-100">
                    {(["Yellow", "Red", "Blue"] as const).map((c) => (
                      <span key={c} className="flex items-center gap-1.5" data-energy={c}>
                        {c} <Stepper n={ev.energy[c]} max={15} label={`${c} energy`} onChange={(n) => setEvent({ ...ev, energy: { ...ev.energy, [c]: n } })} />
                      </span>
                    ))}
                    <span className="flex items-center gap-1.5" data-energy="any">
                      Your choice <Stepper n={ev.any} max={15} label="Energy of your choice" onChange={(any) => setEvent({ ...ev, any })} />
                    </span>
                  </div>
                );
              })()}
            {(m.event.type === "take_modules" || m.event.type === "take_anomaly" || m.event.type === "remove_damage") &&
              (() => {
                const ev = m.event;
                return (
                  <span className="flex items-center gap-2 text-[14px] text-sky-100">
                    How many <Stepper n={ev.amount} min={1} max={9} label="How many" onChange={(amount) => setEvent({ ...ev, amount })} />
                  </span>
                );
              })()}
            <p className="text-[14px] italic text-sky-50" data-event-text>
              {eventLabel(m.event)}
            </p>
          </div>
        </div>
      )}

      {mtab === "order" && (
        <div className="grid gap-2">
          <label className="flex items-center gap-2 text-[14px] text-sky-100">
            <input type="checkbox" checked={!!m.order} onChange={(e) => setM({ ...m, order: e.target.checked ? { tokens: 2, overloadOnly: false, effect: { mode: "blocks", steps: [] } } : undefined })} /> This mission has its own Order (5.6)
          </label>
          {m.order && <OrderEditor label="Mission Order" o={m.order} onChange={(order) => setM({ ...m, order })} />}
        </div>
      )}

      {mtab === "check" && (
        <div className="grid gap-3">
          <div className="bf-label">This mission</div>
          <Problems list={missionProblems} />
          <div className="bf-label">The Campaign</div>
          <Problems list={problems.filter((p) => p.where === "")} />
        </div>
      )}
    </section>
  );

  return (
    <PageShell id="editor" title="Campaign editor" sub={`Developer tools · ${d.prefix} · ${d.missions.length} missions${errors ? ` · ${errors} problem${errors === 1 ? "" : "s"}` : ""}`} onBack={onBack} right={right}>
      <nav className="mb-3 flex gap-1 xl:hidden" aria-label="Editor panes">
        {PANES.map((p) => (
          <button key={p.id} type="button" data-pane-tab={p.id} className={`flex-1 rounded-full px-3 py-2 text-[14px] font-bold uppercase tracking-[0.08em] ${pane === p.id ? "bg-white text-indigo-950" : "border border-white/30 text-white"}`} onClick={() => setPane(p.id)}>
            {p.id === "mission" ? missionTag(m) : p.label}
          </button>
        ))}
      </nav>
      <div className="mx-auto grid max-w-[1800px] grid-cols-1 gap-4 xl:grid-cols-[minmax(240px,300px)_minmax(320px,420px)_minmax(0,1fr)]">
        <div className={`min-w-0 ${pane === "palette" ? "" : "hidden xl:block"}`}>{palettePane}</div>
        <div className={`min-w-0 ${pane === "campaign" ? "" : "hidden xl:block"}`}>{campaignPane}</div>
        <div className={`min-w-0 ${pane === "mission" ? "" : "hidden xl:block"}`}>{missionPane}</div>
      </div>

      {modal === "file" && (
        <Modal title="New / Import" onClose={() => setModal(undefined)}>
          <div className="grid gap-3 text-[14px] text-sky-50">
            <p>The draft is kept in this browser. Starting again replaces it: export it first to keep it.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="bf-btn" data-action="editor-new" onClick={() => window.confirm("Start a new, empty Campaign? The draft is replaced.") && start(newDraft(), "A new, empty Campaign.")}>
                New campaign
              </button>
              {data.campaigns.map((c) => (
                <button key={c.prefix} type="button" className="bf-btn" data-action="editor-from" data-from={c.prefix} onClick={() => window.confirm(`Start from Campaign ${c.prefix}? The draft is replaced.`) && start(draftFromCampaign(c, `C${data.campaigns.length + 1}`), `A copy of ${c.prefix} as C${data.campaigns.length + 1}: its effects come in as text.`)}>
                  Start from {c.prefix}
                </button>
              ))}
            </div>
            <div className="bf-label mt-1">Import</div>
            <label className="bf-btn cursor-pointer justify-self-start">
              <Upload size={16} /> Choose a file…
              <input
                type="file"
                accept=".txt,.json,text/plain,application/json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) importText(await f.text());
                  e.target.value = "";
                }}
              />
            </label>
            <textarea className={`${INP} min-h-[120px] w-full font-mono text-[12px]`} style={txt} placeholder="…or paste a Campaign file (the Campaign1.txt format) or an editor file here" value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Paste a file" />
            <button type="button" className="bf-btn justify-self-start" disabled={!paste.trim()} data-action="editor-import" onClick={() => importText(paste)}>
              Load the pasted text
            </button>
            {fileNote && (
              <p className="rounded-md bg-black/25 px-2 py-1.5 font-semibold text-white" role="status" data-file-note>
                {fileNote}
              </p>
            )}
          </div>
        </Modal>
      )}

      {modal === "export" && (
        <Modal title="Export" onClose={() => setModal(undefined)}>
          <div className="grid gap-3 text-[14px] text-sky-50">
            {errors > 0 && (
              <p className="rounded-md border border-rose-300/70 bg-rose-500/25 px-2 py-1.5 text-white">
                {errors} problem{errors === 1 ? "" : "s"} to fix (Check tab). The file can be exported, but the game would not read it.
              </p>
            )}
            <div className="bf-label">Campaign file · for the claude.ai Project</div>
            <textarea readOnly className={`${INP} h-48 w-full font-mono text-[12px]`} style={txt} value={fileText} aria-label="Campaign file" data-export="campaign" />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="bf-btn" onClick={() => void copy("Campaign file copied", fileText)}>
                <Copy size={16} /> Copy
              </button>
              <button type="button" className="bf-btn" onClick={() => void download(`Campaign${d.prefix.replace(/^C/, "")}.txt`, fileText, "text/plain").then((n) => n && setCopied(n))}>
                <Download size={16} /> Download
              </button>
            </div>
            <div className="bf-label mt-1">Editor file · to go on editing later (keeps the blocks)</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="bf-btn" onClick={() => void copy("Editor file copied", editorText)}>
                <Copy size={16} /> Copy
              </button>
              <button type="button" className="bf-btn" onClick={() => void download(`aphelion5-${d.prefix}-editor.json`, editorText).then((n) => n && setCopied(n))}>
                <Download size={16} /> Download
              </button>
            </div>
            {copied && (
              <p className="font-semibold text-emerald-200" role="status">
                {copied}
              </p>
            )}
          </div>
        </Modal>
      )}
    </PageShell>
  );
}
