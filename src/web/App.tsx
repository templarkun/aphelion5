/**
 * The full interface (spec "Screen and controls", stage 8). The engine
 * decides everything; this file only shows the state and the current
 * question, and turns clicks and taps into answers.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { sectorLine, tokenText } from "../cli/text.js";
import type { GameData } from "../data/index.js";
import { alertedUnits } from "../engine/alerts.js";
import { bayAbilities, noUnitToTarget, orders } from "../engine/command.js";
import { describe, sectorKeys, sectorOf, strength, tile, unitDef } from "../engine/field.js";
import { moduleCost, moduleDef, xWouldBeZero } from "../engine/modules.js";
import type { Answer, Option, Question } from "../engine/questions.js";
import { type Game, type SaveFile, canUndo, playAnswer, readSave, replayGame, startGame, toSave, undo } from "../engine/save.js";
import { type GameState, type Profile, emptyProfile } from "../engine/state.js";
import { gameData } from "./data.js";
import { FieldView } from "./FieldView.js";
import { type DragKind, type DragPlan, type Affects, abilityTargets, actionAffects, mechaDragPlan, m03TapTargets, m01Targets } from "./drag.js";
import { newEvents } from "../engine/events.js";
import { energyFlights, paidShown, reserveFlights, trophyFlights } from "./flyers.js";
import { type ModPlan, normalise, planAnswer, planInfo } from "./modulePlan.js";
import { Flame, HeatBar, type ModPop, ModuleCard, ModulePops } from "./Modules.js";
import { AnomalyStrip } from "./Anomalies.js";
import { FlareEnergyChips } from "./FlareEnergy.js";
import { MissionBar } from "./Mission.js";
import { UpgradeBubble } from "./Upgrade.js";
import { type BayView, type DragApi, type DropTarget, FlagshipDock, type Layout, type OrderView, orderWord, useAbilityPress } from "./Flagship.js";
import { download, loadSave, pickFile, writeSave } from "./idbStore.js";

const today = () => new Date().toISOString().slice(0, 10);
const PHASE: Record<GameState["phase"], string> = {
  setup: "Game setup",
  preparation: "Mission Preparation",
  command: "Command phase",
  overload: "OVERLOAD",
  overloadEnd: "Overload End",
  missionEnd: "Mission End",
  gameEnd: "Game End",
};

/** Flagship layout by screen width (designer 2026-11-08): A wide, B medium, C narrow (Bays on the Field). */
function useLayout(): Layout {
  const pick = (): Layout => (typeof window === "undefined" ? "A" : window.innerWidth >= 1280 ? "A" : window.innerWidth >= 900 ? "B" : "C");
  const [l, setL] = useState<Layout>(pick);
  useEffect(() => {
    const f = () => setL(pick());
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return l;
}

function useDark(): boolean {
  const q = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : undefined;
  const [dark, setDark] = useState(q?.matches ?? false);
  useEffect(() => {
    if (!q) return;
    const f = () => setDark(q.matches);
    q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, [q]);
  return dark;
}

export function App() {
  const data = useMemo(() => gameData(), []);
  const [profile, setProfile] = useState<Profile>(emptyProfile());
  const [game, setGame] = useState<Game | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [autoAnswer, setAutoAnswer] = useState(true);
  const [inMenu, setInMenu] = useState(true);
  const [box, setBox] = useState<TextBoxProps | undefined>();

  useEffect(() => {
    void loadSave().then((f) => {
      if (f?.note) setError(f.note);
      if (f) {
        setProfile(f.profile);
        setAutoAnswer(f.settings.autoAnswer);
        if (f.game) {
          try {
            setGame(replayGame(data, f.game.start, f.game.answers));
            setInMenu(false);
          } catch (e) {
            setError(`The saved game could not be loaded: ${(e as Error).message}`);
          }
        }
      }
      setLoaded(true);
    });
  }, [data]);

  function persist(g: Game | undefined, p: Profile): void {
    void writeSave(toSave(g, p, autoAnswer));
  }

  function update(g: Game): void {
    const ended = g.view.status === "stopped" && g.view.state.ending !== undefined;
    const p = ended ? g.view.state.profile : profile;
    if (ended) setProfile(p);
    setGame(g);
    persist(g, p);
  }

  function loadFile(f: SaveFile): void {
    setError(f.note);
    setProfile(f.profile);
    if (f.game) {
      update(replayGame(data, f.game.start, f.game.answers));
      setInMenu(false);
    } else persist(undefined, f.profile);
  }

  if (!loaded) return <div className="splash">Loading…</div>;
  return (
    <>
      {screen()}
      {box && <TextBox {...box} onClose={() => setBox(undefined)} />}
    </>
  );

  function screen() {
  const resumable = game !== undefined && game.view.state.ending === undefined;
  if (!game || inMenu)
    return (
      <StartScreen
        profile={profile}
        onContinue={resumable ? () => setInMenu(false) : undefined}
        autoAnswer={autoAnswer}
        setAutoAnswer={setAutoAnswer}
        error={error}
        onNew={(dev, seed) => {
          setError(undefined);
          update(startGame(data, { seed, date: today(), developerMode: dev, autoAnswer, profile }));
          setInMenu(false);
        }}
        onImport={async () => {
          try {
            const f = await pickFile();
            if (f) loadFile(f);
          } catch (e) {
            setError(`That file could not be loaded: ${(e as Error).message}`);
          }
        }}
        onPaste={() =>
          setBox({
            title: "Paste a save",
            hint: "Paste the text of a save (from Export save → Copy) and press Load.",
            onLoad: (text) => {
              try {
                loadFile(readSave(text));
                setBox(undefined);
              } catch (e) {
                return `That text could not be loaded: ${(e as Error).message}`;
              }
            },
          })
        }
      />
    );
  return (
    <GameScreen
      data={data}
      game={game}
      notice={notice}
      onAnswer={(answers) => {
        // Several answers in a row (a facing kept by the next click, then that click).
        let g = game;
        for (const a of answers) {
          const r = playAnswer(data, g, a);
          if (r.result.status === "illegal" || r.result.status === "blocked") {
            if (g !== game) update(g);
            return setNotice(`${r.result.status === "illegal" ? "Not allowed" : "Not available"}: ${r.result.reason}`);
          }
          g = r.game;
        }
        setNotice(undefined);
        update(g);
      }}
      onUndo={() => {
        const g = undo(data, game);
        if (!g) return setNotice("Cannot undo: new hidden information appeared since your last answer.");
        setNotice("Undone.");
        update(g);
      }}
      canUndo={() => canUndo(data, game)}
      onExport={() =>
        setBox({
          title: "Export save",
          hint: "The whole game and your Company sheets. Copy the text and keep it (or send it with a bug report); Paste a save on the start screen loads it again.",
          text: JSON.stringify(toSave(game, profile, autoAnswer)),
          fileName: `aphelion5-save-${today()}.json`,
        })
      }
      onExportLog={() =>
        setBox({
          title: "Export log",
          hint: "Everything that happened this game, with rule sections.",
          text: game.view.state.log.map((e) => `${e.text}${e.rule ? `  [${e.rule}]` : ""}`).join("\n"),
          fileName: `aphelion5-log-${today()}.txt`,
          type: "text/plain",
        })
      }
      onLeave={() => {
        // A finished game leaves nothing to continue; one in progress stays saved.
        if (game.view.state.ending) {
          setGame(undefined);
          persist(undefined, game.view.state.profile);
        }
        setInMenu(true);
      }}
    />
  );
  }
}

// ---------------------------------------------------------------------------

interface TextBoxProps {
  title: string;
  hint: string;
  /** Text to show and copy; absent = an empty box to paste into. */
  text?: string;
  fileName?: string;
  type?: string;
  /** Paste mode: returns an error message, or nothing when it worked. */
  onLoad?: (text: string) => string | void;
}

/** Copy or paste a save or log as text: the published page cannot start downloads. */
function TextBox(p: TextBoxProps & { onClose: () => void }) {
  const [value, setValue] = useState(p.text ?? "");
  const [msg, setMsg] = useState<string | undefined>();
  const area = useRef<HTMLTextAreaElement>(null);
  const copy = () => {
    const select = () => {
      area.current?.select();
      setMsg("Selected: press Ctrl+C (or Cmd+C) to copy.");
    };
    try {
      navigator.clipboard.writeText(value).then(() => setMsg("Copied."), select);
    } catch {
      select();
    }
  };
  return (
    <div className="textbox-back" onClick={(e) => e.target === e.currentTarget && p.onClose()}>
      <section className="textbox card" role="dialog" aria-label={p.title}>
        <h2>{p.title}</h2>
        <p className="small">{p.hint}</p>
        <textarea id="textbox-text" ref={area} value={value} readOnly={!p.onLoad} onChange={(e) => setValue(e.target.value)} spellCheck={false} />
        {msg && <p className="small">{msg}</p>}
        <div className="row">
          {p.onLoad ? (
            <button className="primary" disabled={!value.trim()} onClick={() => setMsg(p.onLoad!(value) ?? undefined)}>
              Load
            </button>
          ) : (
            <>
              <button className="primary" onClick={copy}>
                Copy
              </button>
              {p.fileName && <button onClick={() => void download(p.fileName!, value, p.type).then(setMsg)}>Download file</button>}
            </>
          )}
          <button onClick={p.onClose}>Close</button>
        </div>
      </section>
    </div>
  );
}

function StartScreen(p: { profile: Profile; onContinue?: (() => void) | undefined; autoAnswer: boolean; setAutoAnswer: (b: boolean) => void; error?: string | undefined; onNew: (dev: boolean, seed: number) => void; onImport: () => void; onPaste: () => void }) {
  const [dev, setDev] = useState(false);
  const [seed, setSeed] = useState("");
  const hs = p.profile.highScores.C1;
  return (
    <main className="start">
      <h1>Aphelion 5</h1>
      <p className="sub">Campaign 1 — a solo campaign against the Field.</p>
      {p.error && <p className="error">{p.error}</p>}
      {p.onContinue && (
        <section className="card">
          <h2>Game in progress</h2>
          <button className="primary" onClick={p.onContinue}>
            Continue
          </button>
          <p className="small">Starting a new campaign replaces it.</p>
        </section>
      )}
      <section className="card">
        <h2>New campaign</h2>
        <label>
          <input type="checkbox" checked={p.autoAnswer} onChange={(e) => p.setAutoAnswer(e.target.checked)} /> Answer automatically when only one answer is legal
        </label>
        <label>
          <input type="checkbox" checked={dev} onChange={(e) => setDev(e.target.checked)} /> Developer mode (unlimited undo, see hidden tiles, no high score)
        </label>
        <label className="seed">
          Seed (optional) <input value={seed} inputMode="numeric" onChange={(e) => setSeed(e.target.value.replace(/\D/g, ""))} placeholder="random" />
        </label>
        <div className="row">
          <button className="primary" onClick={() => p.onNew(dev, seed ? Number(seed) : Math.floor(Math.random() * 1e9))}>
            Start
          </button>
          <button onClick={p.onImport}>Import a save file…</button>
          <button onClick={p.onPaste}>Paste a save…</button>
        </div>
      </section>
      <section className="card">
        <h2>High scores — Campaign 1</h2>
        <p>Fresh: {hs?.fresh ? `${hs.fresh.score} (${hs.fresh.date})` : "—"}</p>
        <p>Veteran ★: {hs?.veteran ? `${hs.veteran.score} (${hs.veteran.date})` : "—"}</p>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------

interface GameProps {
  data: GameData;
  game: Game;
  notice?: string | undefined;
  onAnswer: (answers: Answer[]) => void;
  onUndo: () => void;
  canUndo: () => boolean;
  onExport: () => void;
  onExportLog: () => void;
  onLeave: () => void;
}

/** State that starts afresh with every new question (no flash of the old value, no lost clicks). */
function usePerQuestion<T>(q: Question | undefined, initial: T): [T, (x: T | ((old: T) => T)) => void] {
  const [box, setBox] = useState<{ q: Question | undefined; v: T }>({ q, v: initial });
  const value = box.q === q ? box.v : initial;
  const set = (x: T | ((old: T) => T)) =>
    setBox((b) => {
      const old = b.q === q ? b.v : initial;
      return { q, v: typeof x === "function" ? (x as (o: T) => T)(old) : x };
    });
  return [value, set];
}

/** The things on the screen a shortcut of the action menu can belong to. */
interface Actors {
  units: Map<string, Option[]>;
  sectors: Map<string, Option[]>;
  modules: Map<number, Option>;
  bays: Map<string, Option>;
  orders: Map<string, Option>;
  game: Map<string, Option>;
}

function actorsOf(q: Question | undefined): Actors | undefined {
  if (q?.kind !== "option" || !q.shortcuts) return undefined;
  const a: Actors = { units: new Map(), sectors: new Map(), modules: new Map(), bays: new Map(), orders: new Map(), game: new Map() };
  for (const o of q.shortcuts) {
    const t = o.on;
    if (!t) continue;
    if (t.kind === "unit") a.units.set(t.id, [...(a.units.get(t.id) ?? []), o]);
    else if (t.kind === "sector") a.sectors.set(t.key, [...(a.sectors.get(t.key) ?? []), o]);
    else if (t.kind === "module") a.modules.set(t.id, o);
    else if (t.kind === "bay") a.bays.set(t.ability, o);
    else if (t.kind === "order") a.orders.set(t.id, o);
    else a.game.set(o.id, o);
  }
  return a;
}

interface Popup {
  x: number;
  y: number;
  title: string;
  options: Option[];
  note?: string | undefined;
  /** A second button that changes the pop-up instead of answering (the next row through a sector). */
  next?: { label: string; go: () => void } | undefined;
  /** Its one option commits a selection (shown as the main button). */
  commit?: boolean;
  /** The unit or sector it belongs to. */
  at?: string | undefined;
}

interface Confirm {
  title: string;
  text: string;
  yes: string;
  danger?: boolean;
  onYes: () => void;
}

function GameScreen(p: GameProps) {
  const { data, game } = p;
  const real = game.view;
  const realQ = real.status === "question" ? real.question : undefined;
  // A facing question (3.7) has no list: rotate buttons sit on the unit. The screen already shows
  // what comes next with the facing shown; the next click keeps that facing and then counts.
  // If keeping it would show new hidden information, a Done button keeps it instead.
  const faceQ = realQ?.kind === "option" && realQ.facing ? realQ : undefined;
  const [turn, setTurn] = usePerQuestion<number>(realQ, faceQ?.facing?.start ?? 0);
  const faceAnswer: Answer | undefined = faceQ ? { kind: "option", value: String(turn) } : undefined;
  const ahead = useMemo(() => (faceAnswer ? playAnswer(data, game, faceAnswer) : undefined), [data, game, turn]); // eslint-disable-line react-hooks/exhaustive-deps
  const aheadOk =
    ahead !== undefined &&
    ahead.result.status !== "illegal" &&
    ahead.result.status !== "blocked" &&
    ahead.game.view.status === "question" &&
    !ahead.game.view.question.facing &&
    ahead.game.view.state.hiddenInfo === real.state.hiddenInfo;
  const v = aheadOk ? ahead.game.view : real;
  const send = (a: Answer) => p.onAnswer(aheadOk && faceAnswer ? [faceAnswer, a] : [a]);
  // A Module run from its selection (designer 2026-11-08): its X, Overclock and extra payment
  // were set on pop-ups before the run, so those questions are answered by the plan, never shown.
  const planRef = useRef<ModPlan | undefined>(undefined);
  if (realQ && actorsOf(realQ)) planRef.current = undefined;
  const planQ = planRef.current && realQ ? planAnswer(realQ, planRef.current) : undefined;
  useEffect(() => {
    if (planQ) p.onAnswer([planQ]);
  }, [realQ]); // eslint-disable-line react-hooks/exhaustive-deps
  const [menuOpen, setMenuOpen] = useState(false);
  // The Heat bar (designer 2026-11-08): long when the top bar has room, else a short bubble.
  const barRef = useRef<HTMLElement>(null);
  const [shortBar, setShortBar] = useState(false);
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const fit = () => {
      setShortBar(false);
      requestAnimationFrame(() => barRef.current && setShortBar(barRef.current.scrollWidth > barRef.current.clientWidth + 1));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [real.state.settings.heatModule]);
  const layout = useLayout();
  // A Bay or Order being dragged: its targets light up on the Field.
  const [abilityDrag, setAbilityDrag] = useState<{ list: DropTarget[]; attack: boolean } | undefined>();
  // Tiles the player just looked at (a Bay, a Module...): a card on the Field until the next answer (play-test 2026-11-08).
  const [look, setLook] = useState<LookTile[] | undefined>();
  const lastState = useRef(real.state);
  useEffect(() => {
    const before = lastState.current;
    lastState.current = real.state;
    if (before === real.state) return;
    energyFlights(before, real.state);
    trophyFlights(before, real.state);
    if (!planRef.current) paidShown(undefined);
    const seen = newEvents(before.events, real.state.events).filter((e) => e.kind === "looked");
    setLook(seen.length ? seen.flatMap((e) => (e.kind === "looked" ? e.tiles : [])) : undefined);
  }, [real.state]);
  const wayAnswers = useRef(new Map<string, Answer[]>());
  const rotate = faceQ
    ? {
        tile: faceQ.facing!.tile,
        facing: turn,
        onTurn: (dir: 1 | -1) => {
          const ids = faceQ.options.map((o) => Number(o.id));
          let f = turn;
          do f = (f + dir + 6) % 6;
          while (!ids.includes(f));
          setTurn(f);
        },
        done: aheadOk ? undefined : () => faceAnswer && p.onAnswer([faceAnswer]),
      }
    : undefined;
  const s = v.state;
  const c = { data, state: s };
  const dark = useDark();
  const q = v.status === "question" ? v.question : undefined;
  // Selections, a pop-up or a split in progress belong to the question they were made for.
  const [selected, setSelected] = usePerQuestion<string[]>(q, []);
  const [hover, setHover] = useState<string | undefined>();
  // A short message in the information strip (a drop that was not allowed), shown for a few seconds.
  const [note, setNote] = useState<{ text: string; warn: boolean; at: number } | undefined>();
  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(undefined), 5000);
    return () => window.clearTimeout(t);
  }, [note]);
  const [showLog, setShowLog] = useState(false);
  const [popup, setPopup] = usePerQuestion<Popup | undefined>(q, undefined);
  const [confirm, setConfirm] = usePerQuestion<Confirm | undefined>(q, undefined);
  // A split answered by clicking things (energy on Modules, damage to Bays or units).
  const [split, setSplit] = usePerQuestion<Record<string, number>>(q, {});
  const pointer = useRef({ x: 0, y: 0 });

  const actors = actorsOf(q);
  // Heat Wave (H5) sits in each Bot's pop-up (designer 2026-11-08): the action and its Bot in one tap.
  const heatWaveOpt = actors?.game.get("heatWave");
  const heatWaveBots = useMemo(() => {
    const out = new Map<string, Answer[]>();
    if (!heatWaveOpt || v !== game.view) return out;
    const first: Answer = { kind: "option", value: heatWaveOpt.id };
    const r = playAnswer(data, game, first);
    if (r.result.status === "illegal" || r.result.status === "blocked") return out;
    const nv = r.game.view;
    if (nv.status === "question" && nv.question.kind === "units") for (const u of nv.question.options) out.set(u, [first, { kind: "units", value: [u] }]);
    else for (const e of newEvents(s.events, nv.state.events)) if (e.kind === "hit") out.set(e.tile, [first]);
    return out;
  }, [data, game, v, heatWaveOpt]); // eslint-disable-line react-hooks/exhaustive-deps
  const answer = (id: string) => {
    setPopup(undefined);
    setConfirm(undefined);
    if (id.startsWith("way:")) return p.onAnswer(wayAnswers.current.get(id) ?? []);
    if (id.startsWith("heatwave:")) return p.onAnswer(heatWaveBots.get(id.slice("heatwave:".length)) ?? []);
    // M_01 (designer 2026-11-08): Attack and Move light every target it can walk to (Dark sectors on the way); a tap there plays the steps.
    const m01 = /^mecha:([^:]+):(attack|ability:M_01)$/.exec(id);
    if (m01 && s.tiles[m01[1]!]?.unitId === "M_01" && v === game.view && s.phase === "command") {
      const tile = m01[1]!;
      const targets = m01Targets(data, game, tile, m01[2] === "attack" ? "attack" : "move");
      if (targets.length) {
        setMechaSel({ tile, plan: { tile, unitId: "M_01", from: sectorOf(s, tile)!, hit: strength(c, tile), targets } });
        setNote({ text: m01[2] === "attack" ? "M_01: tap a red unit to Attack it; it walks there through Dark sectors first (rule 4.2)." : "M_01: tap a blue-green sector; it walks there one sector at a time (rule 4.2).", warn: false, at: Date.now() });
        return;
      }
    }
    send({ kind: "option", value: id });
  };
  const inOverload = s.phase === "overload";

  // What the Field offers: action menu targets, or the units / sectors a question asks for.
  const pickIds = q && (q.kind === "option" || q.kind === "order") && q.pick === "units" ? q.options.map((o) => o.id) : [];
  // Options that name a unit or a sector (e.g. M_03: Attack this unit, or Move to this sector first).
  const onField = new Map<string, Option[]>();
  if (!actors && q && (q.kind === "option" || q.kind === "order"))
    for (const o of q.options) {
      const k = o.on?.kind === "unit" ? o.on.id : o.on?.kind === "sector" ? o.on.key : undefined;
      if (k !== undefined) onField.set(k, [...(onField.get(k) ?? []), o]);
    }
  // M_03's Attack (designer 2026-11-08): every reachable target is red; one with several ways in asks where to move.
  const m03 = useMemo(() => (q?.kind === "option" && /Attacks/.test(q.prompt) && v === game.view ? m03TapTargets(data, game) : []), [data, game, v, q]); // eslint-disable-line react-hooks/exhaustive-deps
  if (m03.length) onField.clear();
  // A row question: click a sector of a row, then confirm the row in a pop-up.
  const rowQ = !actors && q?.kind === "option" && q.rows ? q : undefined;
  const [rowSel, setRowSel] = usePerQuestion<number | undefined>(q, undefined);
  const rowSectors = rowQ ? [...new Set(rowQ.rows!.flat())] : [];
  const onFieldUnits = [...onField.keys()].filter((k) => s.tiles[k] !== undefined);
  for (const t of m03) {
    const u = s.field[t.sector]?.[s.field[t.sector]!.length - 1];
    if (u) onFieldUnits.push(u);
  }
  const onFieldSectors = [...onField.keys()].filter((k) => s.field[k] !== undefined);
  const splitOn = q?.kind === "split" ? q.pick : undefined;
  const [modSel, setModSelRaw] = usePerQuestion<ModPlan | undefined>(q, undefined);
  const [mechaSel, setMechaSel] = usePerQuestion<{ tile: string; plan: DragPlan } | undefined>(q, undefined);
  const choosable = actors
    ? { sectors: [...actors.sectors.keys()], units: [...new Set([...actors.units.keys(), ...heatWaveBots.keys()])] }
    : {
        sectors: q?.kind === "sectors" ? q.options : [],
        units: q?.kind === "units" ? q.options : q?.kind === "split" && splitOn === "units" ? q.buckets.map((b) => b.id) : [...pickIds, ...onFieldUnits],
      };
  if (!actors && onFieldSectors.length) choosable.sectors = [...choosable.sectors, ...onFieldSectors];
  if (rowSectors.length) choosable.sectors = [...choosable.sectors, ...rowSectors];
  // Tap glows like the drag glows: blue-green where a unit moves, red where it Attacks.
  const tones: Record<string, DragKind> = {};
  if (q && !actors) {
    const p0 = "prompt" in q ? String(q.prompt) : "";
    const at = (id: string) => (s.tiles[id] ? sectorOf(s, id) : id);
    if (q.kind === "units" && /\bAttacks?\b/.test(p0)) for (const u of q.options) tones[at(u) ?? u] = "attack";
    if (q.kind === "sectors" && /\b(move|moves|Move|teleport|Teleport|jump|Jump)\b/.test(p0)) for (const k of q.options) tones[k] = "move";
    for (const t of m03) tones[t.sector] = "attack";
    if (!m03.length && (q.kind === "option" || q.kind === "order") && /\bAttacks?\b/.test(p0))
      for (const o of q.options) {
        const k = o.on?.kind === "unit" ? at(o.on.id) : o.on?.kind === "sector" ? o.on.key : undefined;
        if (k) tones[k] = o.id.startsWith("attack:") ? "attack" : "move";
      }
  }
  // M_01 tapped (designer 2026-11-08, I6): its targets are lit at once, red to Attack, blue-green to move.
  if (mechaSel) {
    choosable.sectors = mechaSel.plan.targets.filter((t) => t.answers.length).map((t) => t.sector);
    choosable.units = [mechaSel.tile];
    for (const k of Object.keys(tones)) delete tones[k];
    for (const t of mechaSel.plan.targets) tones[t.sector] = t.kind;
  }
  // A Module selected: only what it would affect is marked (and nothing on the Field is lit).
  if (modSel) {
    choosable.sectors = [];
    choosable.units = [];
  }
  if (abilityDrag) {
    choosable.sectors = abilityDrag.list.map((t) => t.sector);
    choosable.units = [];
    for (const k of Object.keys(tones)) delete tones[k];
    for (const t of abilityDrag.list) tones[t.sector] = abilityDrag.attack ? "attack" : "move";
  }
  const dragApi: DragApi = {
    targets: (o) => (v === game.view ? abilityTargets(data, game, { kind: "option", value: o.id }) : []),
    onTargets: setAbilityDrag,
    sectorAt: (x, y, list) => {
      const field = document.querySelector<HTMLElement>(".field");
      if (!field) return undefined;
      const r = field.getBoundingClientRect();
      const centres: Record<string, [number, number]> = JSON.parse(field.dataset.sectors ?? "{}");
      const rad = Number(field.dataset.tile ?? 0) / 2;
      let best: { t: DropTarget; d: number } | undefined;
      for (const t of list) {
        const c0 = centres[t.sector];
        if (!c0) continue;
        const d = Math.hypot(r.left + c0[0] - x, r.top + c0[1] - y);
        if (d <= rad && (!best || d < best.d)) best = { t, d };
      }
      return best?.t;
    },
    onDrop: (answers) => {
      setPopup(undefined);
      p.onAnswer(answers);
    },
    onNote: (text) => setNote({ text, warn: true, at: Date.now() }),
  };
  // A Module dragged onto its one target (designer 2026-11-08, build step 3), like a Bay: its X,
  // Overclock and extra payment come from its selection's pop-ups (or none when not selected).
  const modulePlanFor = (id: number): ModPlan => (modSel?.id === id ? modSel : normalise(c, { id, oc: 0, extra: 0 }));
  const moduleOf = (o: Option) => [...(actors?.modules ?? [])].find(([, x]) => x.id === o.id)?.[0];
  const moduleDragApi: DragApi = {
    ...dragApi,
    targets: (o) => {
      const id = moduleOf(o);
      if (id === undefined || v !== game.view) return [];
      const plan = modulePlanFor(id);
      return abilityTargets(data, game, { kind: "option", value: o.id }, (qq) => planAnswer(qq, plan));
    },
    onDrop: (answers) => {
      const id = answers[0]?.kind === "option" ? moduleOf({ id: String(answers[0].value), label: "" }) : undefined;
      if (id !== undefined && modSel?.id === id) paidShown(id);
      setModSelRaw(undefined);
      setPopup(undefined);
      p.onAnswer(answers);
    },
  };
  const modulePress = useAbilityPress(moduleDragApi, (key) => moduleState(Number(key.slice("module:".length))).onClick?.());
  const splitSum = Object.values(split).reduce((a, b) => a + b, 0);
  const addSplit = (id: string) => {
    if (q?.kind !== "split") return;
    const b = q.buckets.find((x) => x.id === id);
    if (!b) return;
    const n = split[id] ?? 0;
    if (n >= b.max || splitSum >= q.total) return;
    const next = { ...split, [id]: n + 1 };
    setSplit(next);
    // The last one placed answers at once (Undo takes it back).
    if (splitSum + 1 === q.total) send({ kind: "split", value: next });
  };
  const subSplit = (id: string) => setSplit((x) => ({ ...x, [id]: Math.max(0, (x[id] ?? 0) - 1) }));

  /**
   * Where a unit's or sector's pop-up goes: its sector's centre raised by a
   * quarter of the tile's height (designer 2026-11-08), else where the pointer was.
   */
  const centreOf = (id: string): { x: number; y: number } => {
    const field = document.querySelector<HTMLElement>(".field");
    const k = s.tiles[id] ? Object.keys(s.field).find((key) => s.field[key]!.includes(id)) : id;
    const hits: { k: string; x: number; y: number }[] = JSON.parse(field?.dataset.choosable ?? "[]");
    const h = hits.find((x) => x.k === k);
    if (!field || !h) return pointer.current;
    const r = field.getBoundingClientRect();
    const tileH = Number(field.dataset.tile ?? 0);
    // Designer 2026-11-08: centred on the pointy top end of the hexagon.
    return { x: r.left + h.x, y: r.top + h.y - tileH / 2 };
  };
  /** The clickable unit or sector under a screen point, if any (a tap that closes a pop-up opens the next). */
  const choosableAt = (x: number, y: number): string | undefined => {
    const field = document.querySelector<HTMLElement>(".field");
    if (!field) return undefined;
    const r = field.getBoundingClientRect();
    const radius = (Number(field.dataset.tile ?? 0) / 2) * 0.9;
    const hits: { k: string; id: string; x: number; y: number }[] = JSON.parse(field.dataset.choosable ?? "[]");
    let best: { id: string; d: number } | undefined;
    for (const h of hits) {
      const d = Math.hypot(r.left + h.x - x, r.top + h.y - y);
      if (d <= radius * 0.95 && (!best || d < best.d)) best = { id: h.id, d };
    }
    return best?.id;
  };
  const openPopup = (title: string, options: Option[], note?: string, at?: string) => setPopup({ ...(at ? centreOf(at) : pointer.current), title, options, note, at });
  /** Bubble width (designer 2026-11-08): at least 120 px, and at least 2/3 of a tile's width on big screens. */
  const tileH = Number(document.querySelector<HTMLElement>(".field")?.dataset.tile ?? 0);
  const bubbleW = Math.max(120, Math.round(tileH * 0.866 * (2 / 3)));
  const pick = (id: string) => {
    if (mechaSel) {
      const t = mechaSel.plan.targets.find((x) => x.sector === id && x.answers.length);
      setMechaSel(undefined);
      setPopup(undefined);
      if (t) return p.onAnswer(t.answers);
      return;
    }
    if (actors) {
      const hw = heatWaveBots.get(id) ? [{ id: `heatwave:${id}`, label: "Heat Wave: pay 1 Heat, 1 damage to this Bot (H5)" }] : [];
      let unitOpts = actors.units.get(id) || hw.length ? [...(actors.units.get(id) ?? []), ...hw] : undefined;
      // M_01 (designer 2026-11-08): Attack also reaches units it can walk to, so it is offered when one exists.
      if (unitOpts && s.tiles[id]?.unitId === "M_01" && v === game.view && !unitOpts.some((o) => o.id === `mecha:${id}:attack`) && m01Targets(data, game, id, "attack").length)
        unitOpts = [{ id: `mecha:${id}:attack`, label: `Attack (one hit of ${strength(c, id)})` }, ...unitOpts];
      if (unitOpts) {
        const alerts = alertedUnits(c);
        const last = inOverload && alerts.length === 1 && alerts[0] === id;
        return openPopup(describe(c, id), unitOpts, last ? "This is the last Alert on the Field. After it, you can end the Overload (9.2)." : undefined, id);
      }
      const secOpts = actors.sectors.get(id);
      if (secOpts) return openPopup(`Dark sector (${id})`, secOpts, undefined, id);
      return;
    }
    if (!q) return;
    const m3 = m03.find((t) => t.sector === (s.tiles[id] ? sectorOf(s, id) : id));
    if (m3) {
      if (!m3.next) return p.onAnswer(m3.answers);
      const ways = m3.next()?.targets ?? [];
      const pickWay = new Map(ways.map((w) => [`way:${w.sector}`, w.answers]));
      wayAnswers.current = pickWay;
      return openPopup(`${describe(c, id)}: move where first?`, ways.map((w) => ({ id: `way:${w.sector}`, label: `Move to (${w.sector}), then Attack` })), undefined, id);
    }
    if (rowQ && rowSectors.includes(id)) {
      // The rows through this sector: the first is selected; "Next row" steps through the others.
      const through = rowQ.rows!.flatMap((r, i) => (r.includes(id) ? [i] : []));
      const { x, y } = centreOf(id);
      const show = (n: number) => {
        const i = through[n % through.length]!;
        setRowSel(i);
        setPopup({
          x,
          y,
          at: id,
          title: rowQ.options[i]!.label,
          options: [{ id: rowQ.options[i]!.id, label: "Choose this row" }],
          commit: true,
          next: through.length > 1 ? { label: `Next row through this sector (${(n % through.length) + 1} of ${through.length})`, go: () => show(n + 1) } : undefined,
        });
      };
      return show(0);
    }
    const here = onField.get(id);
    if (here && (q.kind === "option" || q.kind === "order")) {
      if (here.length === 1) return send({ kind: q.kind, value: here[0]!.id } as Answer);
      return openPopup(s.tiles[id] ? describe(c, id) : `Sector (${id})`, here, undefined, id);
    }
    if (q.kind === "split") return addSplit(id);
    if ((q.kind === "option" || q.kind === "order") && pickIds.includes(id)) return send({ kind: q.kind, value: id } as Answer);
    if (q.kind !== "units" && q.kind !== "sectors") return;
    if (q.min === 1 && q.max === 1) return send({ kind: q.kind, value: [id] } as Answer);
    setSelected((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : xs.length < q.max ? [...xs, id] : xs));
  };

  // A Module selected but not run yet (designer 2026-11-08): see modulePlan.ts.
  const setModSel = (next: ModPlan | undefined) => {
    // Energy chips show the Reserve filling the bar, and going back when it is let go.
    const was = modSel ? planInfo(c, modSel.id, modSel).slots : [];
    const now = next ? planInfo(c, next.id, next).slots : [];
    if (modSel && next && modSel.id !== next.id) reserveFlights(modSel.id, was, []);
    reserveFlights(next?.id ?? modSel?.id ?? 0, modSel && next && modSel.id !== next.id ? [] : was, now);
    setModSelRaw(next);
  };
  const selectModule = (id: number) => {
    setPopup(undefined);
    setModSel(normalise(c, { id, oc: 0, extra: 0 }));
  };
  const commitModule = () => {
    const sel = modSel;
    const o = sel && actors?.modules.get(sel.id);
    if (!sel || !o) return;
    planRef.current = sel;
    keep(modAffects);
    setModSelRaw(undefined);
    paidShown(sel.id);
    p.onAnswer([{ kind: "option", value: o.id }]);
  };
  const selInfo = modSel ? planInfo(c, modSel.id, modSel) : undefined;
  useEffect(() => {
    if (!modSel) return;
    // A tap anywhere but the Module and its pop-ups lets it go.
    const off = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest(`[data-module="${modSel.id}"]`) || t?.closest(".mod-pops")) return;
      setModSel(undefined);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setModSel(undefined);
    document.addEventListener("pointerdown", off, true);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", off, true);
      document.removeEventListener("keydown", esc);
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps
  // What a selected Module, Bay or Order would affect (designer 2026-11-08): a violet outline on
  // those sectors and Modules, kept while it runs (until the action menu is back and a moment has passed).
  const [thingSel, setThingSel] = useState<Option[]>([]);
  const modAffects = useMemo((): Affects => {
    if (!modSel || v !== game.view) return { sectors: [], modules: [] };
    const o = actors?.modules.get(modSel.id);
    return o ? actionAffects(data, game, { kind: "option", value: o.id }, (qq) => planAnswer(qq, modSel), modSel.id) : { sectors: [], modules: [] };
  }, [data, game, v, modSel]); // eslint-disable-line react-hooks/exhaustive-deps
  const thingAffects = useMemo((): Affects => {
    const out: Affects = { sectors: [], modules: [] };
    if (!actors || v !== game.view) return out;
    for (const o of thingSel) {
      const a = actionAffects(data, game, { kind: "option", value: o.id }, () => undefined);
      out.sectors.push(...a.sectors);
      out.modules.push(...a.modules);
    }
    return out;
  }, [data, game, v, thingSel.map((o) => o.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const [kept, setKept] = useState<{ aff: Affects; at: number } | undefined>();
  const keep = (aff: Affects) => setKept(aff.sectors.length || aff.modules.length ? { aff, at: game.answers.length } : undefined);
  const backToMenu = !!actorsOf(realQ) && kept !== undefined && game.answers.length > kept.at;
  useEffect(() => {
    if (!backToMenu) return;
    const t = window.setTimeout(() => setKept(undefined), 1400);
    return () => window.clearTimeout(t);
  }, [backToMenu, game.answers.length]);
  const affectedNow: Affects = modSel ? modAffects : thingSel.length ? thingAffects : (kept?.aff ?? { sectors: [], modules: [] });
  const affected = affectedNow.sectors;
  const modPops: ModPop[] = [];
  if (modSel && selInfo) {
    const d = moduleDef(c, modSel.id);
    if (selInfo.xRange)
      modPops.push({ key: "x", kind: "step", colour: d.colour, label: "X =", value: modSel.x ?? selInfo.xRange[0], min: selInfo.xRange[0], max: selInfo.xRange[1], onStep: (k) => setModSel(normalise(c, { ...modSel, x: (modSel.x ?? selInfo.xRange![0]) + k })) });
    if (selInfo.ocNext === "two") modPops.push({ key: "oc1", kind: "take", colour: d.colour, label: "−2 energy +1 Heat", onClick: () => setModSel({ ...modSel, oc: 1 }) });
    if (selInfo.ocNext === "yellow") modPops.push({ key: "oc2", kind: "take", colour: "Yellow", label: "−1 Yellow +1 Heat", onClick: () => setModSel({ ...modSel, oc: 2 }) });
    const ex = selInfo.extra;
    if (ex?.upTo) modPops.push({ key: "extra", kind: "step", colour: d.colour, label: "Extra", value: modSel.extra, min: 0, max: ex.max, onStep: (k) => setModSel(normalise(c, { ...modSel, extra: modSel.extra + k })) });
    else if (ex && modSel.extra === 0) modPops.push({ key: "extra", kind: "take", colour: d.colour, label: `−${ex.n} energy: ${ex.text.replace(/^Pay \d+ more \w+ energy:?\s*/i, "")}`, onClick: () => setModSel(normalise(c, { ...modSel, extra: ex.n })) });
  }

  // Modules: run one (action menu), choose one (a question about Modules), or place energy on it (a split).
  const moduleState = (id: number): { can: boolean; onClick?: () => void; count?: number } => {
    if (actors) {
      // Designer 2026-11-08: the first tap selects it, a tap on the selected one runs it.
      const o = actors.modules.get(id);
      return o ? { can: true, onClick: () => (modSel?.id === id ? commitModule() : selectModule(id)) } : { can: false };
    }
    // Energy (designer 2026-11-07): answered on the pop-up beside the Module, not on the Module itself.
    if (q?.kind === "option" && (q.energy || q.takeEnergy)) return { can: false };
    if (q && (q.kind === "option" || q.kind === "order") && q.pick === "modules" && q.options.some((o) => o.id === String(id))) return { can: true, onClick: () => send({ kind: q.kind, value: String(id) } as Answer) };
    if (q?.kind === "split" && splitOn === "modules" && q.buckets.some((b) => b.id === String(id))) return { can: true, onClick: () => addSplit(String(id)), count: split[String(id)] ?? 0 };
    return { can: false };
  };
  const modulesWanted = (q && (q.kind === "option" || q.kind === "order") && q.pick === "modules") || splitOn === "modules";
  const energyQ = !actors && q?.kind === "option" && q.energy ? q : undefined;
  const energyFor = (id: number) => energyQ?.energy?.[String(id)];
  const anomalyQ = q?.kind === "option" && q.options.some((o) => o.on?.kind === "anomaly");
  const takeQ = !actors && q?.kind === "option" && q.takeEnergy ? q : undefined;
  const baysWanted = splitOn === "bays";

  const co = data.companies.byId.get(s.player.company)!;
  // The Field shows once a mission is chosen (also while it is empty, to choose sectors at Mission Preparation).
  const hasField = s.phase !== "setup" && sectorKeys(s).length > 0 && (s.phase !== "preparation" || s.log.some((e) => /^Mission \d/.test(e.text)));
  const crippled = s.flagship.every((x) => x === 0);

  const overhaul = actors?.game.get("overhaul");
  const askOverhaul = () => {
    if (!overhaul) return;
    if (crippled) return answer(overhaul.id);
    const left = s.flagship.reduce((a, b) => a + b, 0);
    const full = co.bays.reduce((a, b) => a + b.integrity, 0);
    setConfirm({
      title: "Overhaul now?",
      text: `Your Flagship is not Crippled: ${left} of ${full} Integrity left (${co.bays.map((b, i) => `Bay ${i + 1} ${s.flagship[i]}/${b.integrity}`).join(", ")}). Overhaul uses one of your ${co.overhaulSlots - s.sheet.overhaulUsed} empty Overhaul slot${co.overhaulSlots - s.sheet.overhaulUsed === 1 ? "" : "s"} (8.8).`,
      yes: "Overhaul",
      onYes: () => answer(overhaul.id),
    });
  };
  const concede = actors?.game.get("concede");
  const askConcede = () =>
    concede &&
    setConfirm({ title: "Concede?", text: "The game ends at once and counts as a loss (10.3).", yes: "Concede", danger: true, onYes: () => answer(concede.id) });
  const endOverload = actors?.game.get("endOverload");
  /** A Bay or Order used from its pop-up: what it affects stays outlined while it runs. */
  const useThing = (o: Option) => {
    if (thingSel.some((x) => x.id === o.id)) keep(thingAffects);
    setThingSel([]);
    answer(o.id);
  };

  // Bays and Orders as buttons (designer 2026-11-08): see Flagship.tsx.
  // Those that target units are greyed out while no unit is on the Field (designer 2026-11-08, round 7).
  const inPlay = s.phase === "command" || s.phase === "overload";
  const abilities = bayAbilities(c);
  const bayViews: BayView[] = co.bays.map((b, i) => {
    const bucket = `bay${i + 1}`;
    const inSplit = baysWanted && q?.kind === "split" && q.buckets.some((x) => x.id === bucket);
    return {
      n: i + 1,
      cur: s.flagship[i]!,
      max: b.integrity,
      abilities: abilities.filter((a) => a.bay === i + 1).map((a) => ({ id: a.id, text: a.text, opt: actors?.bays.get(a.id), noUnits: inPlay && a.overload === inOverload && noUnitToTarget(c, a.id) })),
      split: inSplit ? { count: split[bucket] ?? 0, onAdd: () => addSplit(bucket), onSub: () => subSplit(bucket) } : undefined,
      dim: baysWanted && !inSplit,
    };
  });
  const orderViews: OrderView[] = s.mission
    ? orders(c).map((o) => ({ id: o.id, tokens: o.tokens, text: `${o.overloadOnly ? "[Overload] " : ""}${o.effect}`, word: orderWord(o.effect), opt: actors?.orders.get(o.id), noUnits: inPlay && o.overloadOnly === inOverload && noUnitToTarget(c, o.id) }))
    : [];
  const flagshipExtras = (
    <>
      {crippled && <p className="warn">CRIPPLED — you must Overhaul before your next action.</p>}
      <div className="overhaul">
        <button className={overhaul ? "can" : ""} disabled={!overhaul} onClick={askOverhaul} title="Repair the Flagship, refill energy, swap a Module (8.8)">
          Overhaul
        </button>
        <span className="small">
          slots used {s.sheet.overhaulUsed}/{co.overhaulSlots}
        </span>
      </div>
      <p className="small sheet-line">
        <UpgradeBubble n={s.sheet.upgradePoints} />
        {s.sheet.ally ? <span>Ally {s.sheet.ally}</span> : null}
      </p>
    </>
  );

  return (
    <div
      className={`game layout-${layout} ${inOverload ? "is-overload" : ""}`}
      data-prompt={q ? q.prompt : ""}
      onPointerDownCapture={(e) => {
        pointer.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <header className="bar" ref={barRef}>
        <strong className="bar-title">{s.mission || "Aphelion 5"}</strong>
        {/* The Reserve in the top bar (designer 2026-11-08): each colour in its own bubble; energy flies in and out of it. */}
        <div className="reserve-bar" aria-label="Energy Reserve">
          {(["Yellow", "Red", "Blue"] as const).map((col) => {
            const inSplit = splitOn === "reserve" && q?.kind === "split" && q.buckets.some((b) => b.id === col);
            const Tag = inSplit ? "button" : "span";
            return (
              <Tag key={col} data-reserve={col} className={`res-bubble ${col.toLowerCase()} ${inSplit ? "can" : ""} ${splitOn === "reserve" && !inSplit ? "dim" : ""}`} onClick={inSplit ? () => addSplit(col) : undefined} title={`${col} energy in your Reserve`}>
                <EnergyGlyph colour={col} />
                <b>{s.player.reserve[col]}</b>
                {inSplit && <SplitCount n={split[col] ?? 0} onMinus={() => subSplit(col)} />}
              </Tag>
            );
          })}
        </div>
        {s.settings.heatModule && <HeatBar heat={s.player.heat} gain={selInfo?.heat ?? 0} short={shortBar} />}
        <span className="spacer" />
        {/* Narrow phones (designer 2026-11-08: everything in one bar on a Galaxy S24): icons instead of words. */}
        <button className="bar-btn" aria-label="Undo" onClick={p.onUndo} disabled={!p.canUndo()} title="Take back your last answer (not past new hidden information)">
          <span className="ico" aria-hidden>
            ↶
          </span>
          <span className="lbl">Undo</span>
        </button>
        <div className="menu-wrap">
          <button className="bar-btn" aria-label="Menu" onClick={() => setMenuOpen((x) => !x)} aria-expanded={menuOpen}>
            <span className="ico" aria-hidden>
              ☰
            </span>
            <span className="lbl">Menu</span>
          </button>
          {menuOpen && (
            <div className="menu panel" role="menu" onClick={() => setMenuOpen(false)}>
              <p className="small">
                {s.mission} · {PHASE[s.phase]}
                <br />
                Threat: {s.run.threat.join(", ") || "—"} · Command tokens {s.player.commandTokens}
                {s.settings.heatModule ? ` · Heat ${s.player.heat}` : ""}
              </p>
              <button onClick={() => setShowLog((x) => !x)}>{showLog ? "Hide the log" : "Log"}</button>
              <button onClick={p.onExport} title="Save the game and your Company sheets as text or a file">
                Export save
              </button>
              <button onClick={p.onExportLog}>Export log</button>
              <button className="danger" onClick={askConcede} disabled={!concede} title={concede ? "Concede the game (10.3)" : "You can concede when it is your turn to act"}>
                Concede
              </button>
              <button onClick={p.onLeave}>Leave to the start screen</button>
            </div>
          )}
        </div>
      </header>

      <aside className="left panel">
        <h3>Flagship{layout === "A" ? ` — ${co.name}` : ""}</h3>
        {layout !== "C" ? (
          <FlagshipDock layout={layout} company={co.id} bays={bayViews} orders={orderViews} commandTokens={s.player.commandTokens} q={q} inOverload={inOverload} onUse={useThing} onSelect={setThingSel} drag={dragApi}>
            {flagshipExtras}
          </FlagshipDock>
        ) : (
          flagshipExtras
        )}
      </aside>

      <section className="center">
        {/* Anomalies on the left (they scroll), the Mission bar always at the right end (designer 2026-11-08). */}
        {s.mission && hasField && (
          <div className="top-strip">
            <AnomalyStrip data={data} cards={s.player.anomalies} q={q} onAnswer={answer} />
            <MissionBar c={c} phase={PHASE[s.phase]} />
          </div>
        )}
        <div className="field-area">
        {hasField ? (
          <FieldView
            data={data}
            state={s}
            rotate={rotate}
            choosable={choosable}
            tones={tones}
            selected={[...selected, ...Object.keys(split).filter((k) => (split[k] ?? 0) > 0), ...(rowQ && rowSel !== undefined ? rowQ.rows![rowSel]! : [])]}
            onPick={pick}
            onHover={setHover}
            showHidden={s.settings.developerMode}
            dark={dark}
            dragFor={actors ? (u) => mechaDragPlan(data, game, v, u) : undefined}
            onDrop={(answers) => {
              setPopup(undefined);
              setNote(undefined);
              p.onAnswer(answers);
            }}
            onNote={(text, warn) => setNote({ text, warn, at: Date.now() })}
            affected={affected}
            onMiss={() => {
              setMechaSel(undefined);
              setModSel(undefined);
            }}
          />
        ) : (
          <div className="empty-field">{PHASE[s.phase]}</div>
        )}
        {hover && !popup && hasField && <InfoBubble data={data} state={s} sector={hover} />}
        {(note || p.notice) && <div className={`field-toast ${note?.warn || (!note && p.notice && /^Not/.test(p.notice)) ? "warn" : ""}`}>{note ? note.text : p.notice}</div>}
        {look && <LookCard data={data} tiles={look} onClose={() => setLook(undefined)} />}
        {endOverload && (
          <button className="end-overload" onClick={() => answer(endOverload.id)} title="No Alert tokens remain (9.2)">
            End the Overload
          </button>
        )}
        {planQ ? null : rotate ? (
          <div className="q-banner">
            <p className="prompt">
              {describe({ data, state: real.state }, rotate.tile)}: turn it with the ⟲ ⟳ buttons on the unit. <span className="rule">rule 3.7</span>
            </p>
            {rotate.done ? (
              <button className="primary" onClick={rotate.done}>
                Done
              </button>
            ) : (
              <span className="small">Your next tap keeps this facing.</span>
            )}
          </div>
        ) : !q ? (
          <QCard>
            <GameOver state={s} onLeave={p.onLeave} />
          </QCard>
        ) : actors || anomalyQ ? null : onBoard(q) ? (
          <div className="q-banner">
            <QuestionPanel data={data} state={s} q={q} selected={selected} setSelected={setSelected} onAnswer={send} split={split} onResetSplit={() => setSplit({})} />
          </div>
        ) : (
          <QCard>
            <QuestionPanel data={data} state={s} q={q} selected={selected} setSelected={setSelected} onAnswer={send} split={split} onResetSplit={() => setSplit({})} />
          </QCard>
        )}
        </div>
        {layout === "C" && hasField && <FlagshipDock layout="C" company={co.id} bays={bayViews} orders={orderViews} commandTokens={s.player.commandTokens} q={q} inOverload={inOverload} onUse={useThing} onSelect={setThingSel} drag={dragApi} />}
      </section>

      <aside className="right panel">
        <h3>Modules</h3>
        {sortedModules(c, s.player.modules).map((m) => {
          const d = moduleDef(c, m.id);
          const st = moduleState(m.id);
          const taking = takeQ?.options.some((o) => o.id === String(m.id));
          const dim = (modulesWanted && !st.can && !energyFor(m.id) && !taking) || (modSel !== undefined && modSel.id !== m.id);
          const sel = modSel?.id === m.id;
          return (
            <ModuleCard
              key={m.id}
              id={m.id}
              def={d}
              ready={m.ready}
              info={sel && selInfo ? selInfo : planInfo(c, m.id)}
              can={st.can}
              selected={sel}
              dim={dim}
              extraClass={`${m.ready && xWouldBeZero(c, m.id, false) ? "x-zero" : ""} ${affectedNow.modules.includes(m.id) ? "affected" : ""} ${energyFor(m.id) ? `energy-target ${energyFor(m.id)!.toLowerCase()}` : ""} ${taking ? "energy-source" : ""}`}
              onClick={st.onClick}
              press={actors?.modules.get(m.id) ? modulePress(`module:${m.id}`, [], [actors.modules.get(m.id)], actors.modules.get(m.id), d.effect) : undefined}
            >
              {st.count !== undefined && <SplitCount n={st.count} onMinus={() => subSplit(String(m.id))} />}
            </ModuleCard>
          );
        })}
      </aside>



      {modSel && <ModulePops id={modSel.id} pops={modPops} />}
      {energyQ && <EnergyPopups q={energyQ} onPick={(id) => send({ kind: "option", value: id })} />}
      {energyQ?.energyFrom && hasField && <FlareEnergyChips q={energyQ} sector={sectorOf(s, energyQ.energyFrom)} onPick={(id) => send({ kind: "option", value: id })} onNote={(text) => setNote({ text, warn: true, at: Date.now() })} />}
      {takeQ && <EnergyPopups q={takeQ} take={{ state: s, data }} onPick={(id) => send({ kind: "option", value: id })} />}
      {popup && (
        <PopupMenu
          key={`${popup.at ?? ""}:${popup.title}`}
          popup={popup}
          bubbleW={bubbleW}
          onPick={answer}
          onClose={() => {
            setPopup(undefined);
            setRowSel(undefined);
            setMechaSel(undefined);
          }}
          tapThrough={(x, y) => {
            // One tap on another clickable unit or sector: the old pop-up goes and the new one opens.
            const id = choosableAt(x, y);
            if (!id || id === popup.at || (s.tiles[popup.at ?? ""] && Object.keys(s.field).find((k) => s.field[k]!.includes(popup.at!)) === id)) return false;
            pointer.current = { x, y };
            setPopup(undefined);
            setRowSel(undefined);
            pick(id);
            return true;
          }}
        />
      )}
      {confirm && <ConfirmBox confirm={confirm} onClose={() => setConfirm(undefined)} />}

      {showLog && (
        <section className="log panel">
          <h3>Log</h3>
          <ol>
            {s.log
              .slice(-200)
              .reverse()
              .map((e, i) => (
                <li key={i}>
                  {e.text} {e.rule && <span className="rule">[{e.rule}]</span>}
                </li>
              ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/**
 * Modules panel order (designer 2026-11-07): Yellow, Red, Blue; then printed
 * cost, highest first, X last; ties in the order you gained them.
 */
export function sortedModules<M extends { id: number }>(c: Parameters<typeof moduleDef>[0], mods: M[]): M[] {
  const rank = { Yellow: 0, Red: 1, Blue: 2 } as const;
  const cost = (id: number) => {
    const x = moduleDef(c, id).cost;
    return x === "X" ? -1 : Number(x);
  };
  return mods
    .map((m, i) => ({ m, i }))
    .sort((a, b) => rank[moduleDef(c, a.m.id).colour] - rank[moduleDef(c, b.m.id).colour] || cost(b.m.id) - cost(a.m.id) || a.i - b.i)
    .map((x) => x.m);
}

/** The energy one answer places: a placeholder glyph until the designer's art (spec "Art"). */
export function EnergyGlyph({ colour }: { colour: "Yellow" | "Red" | "Blue" }) {
  return (
    <span className={`glyph ${colour.toLowerCase()}`} aria-label={`${colour} energy`}>
      {colour[0]}
    </span>
  );
}

/** A Power Node's Alert pop-up (designer 2026-11-08): "Gain" and the energy (or Heat) as glyphs. */
function ChipLabel({ chips, label }: { chips: NonNullable<Option["chips"]>; label: string }) {
  if (chips.length === 0) return <span>{label}</span>;
  const heat = chips.every((x) => x === "Heat");
  return (
    <span className="chip-label" aria-label={label}>
      <span>Gain</span>
      <span className="chips">
        {heat ? (
          <>
            <b>{chips.length}</b>
            <Flame />
            <span>Heat</span>
          </>
        ) : (
          chips.map((x, i) => <EnergyGlyph key={i} colour={x as "Yellow" | "Red" | "Blue"} />)
        )}
      </span>
    </span>
  );
}

/**
 * Energy on Modules (designer 2026-11-07): a pop-up to the left of every
 * Module that can take one of the waiting energies, with an arrow to it and
 * the energy's glyph. One tap places one energy; several colours (a Power
 * Node) show all their pop-ups at once, placed in any order.
 */
function EnergyPopups({ q, onPick, take }: { q: Question & { kind: "option" }; onPick: (id: string) => void; take?: { state: GameState; data: GameData } }) {
  const ids = take ? q.options.filter((o) => /^\d+$/.test(o.id)).map((o) => o.id) : q.options.filter((o) => !o.id.startsWith("supply:") && q.energy?.[o.id]).map((o) => o.id);
  const n = q.energyN ?? 1;
  const [pos, setPos] = useState<Record<string, { x: number; y: number; inside: boolean } | undefined>>({});
  const W = 132;
  useLayoutEffect(() => {
    // Bring every target Module into view when they fit (the last, then the first wins if not).
    document.querySelector(`[data-module="${ids[ids.length - 1]}"]`)?.scrollIntoView({ block: "nearest" });
    document.querySelector(`[data-module="${ids[0]}"]`)?.scrollIntoView({ block: "nearest" });
    const place = () => {
      const next: typeof pos = {};
      for (const id of ids) {
        const el = document.querySelector(`[data-module="${id}"]`);
        const panel = el?.closest(".panel");
        if (!el || !panel) continue;
        const r = el.getBoundingClientRect();
        const pr = panel.getBoundingClientRect();
        const y = r.top + r.height / 2;
        if (y < pr.top || y > pr.bottom) continue; // scrolled out of view
        // No room on the left (phone layout): sit inside the Module's right end, clear of its name.
        const inside = r.left < W + 24;
        next[id] = { x: inside ? r.right - W - 10 : r.left - W - 14, y, inside };
      }
      setPos(next);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [ids.join(",")]);
  return (
    <>
      {ids.map((id, i) => {
        const p = pos[id];
        if (!p) return null;
        // Taking energy away (designer 2026-11-08): the same pop-up, dashed, with an arrow pointing out of the Module.
        if (take) {
          const m = take.state.player.modules.find((x) => String(x.id) === id);
          const cols = (["Yellow", "Red", "Blue"] as const).filter((k) => (m?.energy[k] ?? 0) > 0);
          const n = cols.reduce((a, k) => a + (m?.energy[k] ?? 0), 0);
          return (
            <button key={`${q.prompt}:${id}`} className={`energy-pop take ${(cols[0] ?? "Yellow").toLowerCase()} ${p.inside ? "inside" : ""}`} style={{ left: p.x, top: p.y, width: W, animationDelay: `${i * 50}ms, ${i * 50 + 300}ms` }} onClick={() => onPick(id)} aria-label={q.takeEnergy === "all" ? `Remove all ${n} energy from this Module` : "Remove 1 energy from this Module"}>
              <span className="out-arrow" aria-hidden>
                ←
              </span>
              {cols.slice(0, 2).map((k) => (
                <EnergyGlyph key={k} colour={k} />
              ))}
              <span>{q.takeEnergy === "all" ? `−${n} all` : "−1"}</span>
            </button>
          );
        }
        const col = q.energy![id]!;
        return (
          <button key={`${q.prompt}:${id}`} className={`energy-pop ${col.toLowerCase()} ${p.inside ? "inside" : ""}`} style={{ left: p.x, top: p.y, width: W, animationDelay: `${i * 50}ms, ${i * 50 + 300}ms` }} onClick={() => onPick(id)} aria-label={`Place ${n} ${col} energy on this Module`}>
            <EnergyGlyph colour={col} />
            <span>
              +{n} {col}
            </span>
          </button>
        );
      })}
    </>
  );
}

function SplitCount({ n, onMinus }: { n: number; onMinus: () => void }) {
  return (
    <span className="split-count">
      <b>+{n}</b>
      {n > 0 && (
        <button
          className="mini"
          aria-label="Take one back"
          onClick={(e) => {
            e.stopPropagation();
            onMinus();
          }}
        >
          −
        </button>
      )}
    </span>
  );
}


/** A long label "Name: what it does" shows the name in bold and the rest smaller, cut to fit. */
function BubbleLabel({ text }: { text: string }) {
  const i = text.indexOf(": ");
  if (text.length <= 30 || i < 0 || i > 24) return <span>{text}</span>;
  return (
    <span className="two">
      <b>{text.slice(0, i)}</b>
      <small>{text.slice(i + 2)}</small>
    </span>
  );
}

/**
 * A unit's or sector's pop-up (designer 2026-11-07): each action in its own
 * bubble of one standard width, side by side, the row centred on the unit.
 * Long labels get a smaller font and are cut to three lines (the full text
 * shows on hover and is read out). Bubbles spring in (ease-out elastic) and
 * shrink away when one is chosen or the pop-up is closed.
 */
function PopupMenu({ popup, onPick, onClose, tapThrough, bubbleW }: { popup: Popup; onPick: (id: string) => void; onClose: () => void; tapThrough: (x: number, y: number) => boolean; bubbleW: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: popup.x, top: popup.y });
  const [leaving, setLeaving] = useState(false);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    // Centre the group on the unit, kept on screen.
    setPos({ left: Math.max(8, Math.min(popup.x - w / 2, window.innerWidth - w - 8)), top: Math.max(8, Math.min(popup.y - h / 2, window.innerHeight - h - 8)) });
    el.querySelector("button")?.focus({ preventScroll: true });
  }, [popup]);
  const leave = (then: () => void) => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(then, 170);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && leave(onClose);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose, leaving]);
  const items = [...popup.options.map((o) => ({ id: o.id, label: o.label, chips: o.chips, go: () => leave(() => onPick(o.id)), main: popup.commit || o.chips !== undefined })), ...(popup.next ? [{ id: "next", label: popup.next.label, go: popup.next.go, main: false }] : [])];
  return (
    <div className="popup-back" onPointerDown={(e) => e.target === e.currentTarget && !leaving && !tapThrough(e.clientX, e.clientY) && leave(onClose)}>
      <div ref={box} className={`popup bubbles ${leaving ? "leaving" : ""}`} role="menu" aria-label={popup.title} style={{ ...pos, ["--bw" as string]: `${bubbleW}px`, ["--bs" as string]: String(bubbleW / 120) }}>
        <div className="popup-title">{popup.title}</div>
        <div className="bubble-row">
          {items.map((o, i) => (
            <button key={`${popup.title}:${o.id}`} role="menuitem" title={o.label} className={`bubble ${o.main ? "primary" : ""} ${o.label.length > 60 ? "tiny" : o.label.length > 30 ? "small-text" : ""}`} style={{ animationDelay: `${i * 45}ms` }} onClick={o.go}>
              {"chips" in o && o.chips ? <ChipLabel chips={o.chips} label={o.label} /> : <BubbleLabel text={o.label} />}
            </button>
          ))}
        </div>
        {popup.note && <p className="popup-note">{popup.note}</p>}
      </div>
    </div>
  );
}

function ConfirmBox({ confirm, onClose }: { confirm: Confirm; onClose: () => void }) {
  return (
    <div className="textbox-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="textbox card" role="dialog" aria-label={confirm.title}>
        <h2>{confirm.title}</h2>
        <p>{confirm.text}</p>
        <div className="row">
          <button className={confirm.danger ? "danger" : "primary"} onClick={confirm.onYes}>
            {confirm.yes}
          </button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </section>
    </div>
  );
}

/** Questions answered by tapping the board show a slim banner on the Field; the rest a card. */
function onBoard(q: Question): boolean {
  if (q.kind === "units" || q.kind === "sectors") return true;
  if (q.kind === "split") return q.pick !== undefined;
  if (q.kind === "option" || q.kind === "order") return q.pick !== undefined || q.rows !== undefined || q.energy !== undefined || q.takeEnergy !== undefined || q.options.some((o) => o.on);
  return false;
}

/**
 * A question card over the Field (designer 2026-11-08). While you press anywhere
 * outside it, it turns almost transparent, so the board under it can be seen.
 */
function QCard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [peek, setPeek] = useState(false);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setPeek(true);
    };
    const up = () => setPeek(false);
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);
  return (
    <div ref={ref} className={`q-card ${peek ? "peek" : ""}`} aria-live="polite">
      {children}
    </div>
  );
}

type LookTile = { tile: string; unitId: string; sector?: string | undefined };

/** What the player just looked at, by sector, top first (placeholder glyphs until the designer's art). */
function LookCard({ data, tiles, onClose }: { data: GameData; tiles: LookTile[]; onClose: () => void }) {
  const by = new Map<string, LookTile[]>();
  for (const t of tiles) by.set(t.sector ?? "", [...(by.get(t.sector ?? "") ?? []), t]);
  return (
    <div className="look-card" role="status" onPointerDown={(e) => e.stopPropagation()}>
      <div className="look-head">
        <b>You looked at</b>
        <button className="mini" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      {[...by].map(([k, ts]) => (
        <div key={k} className="look-row">
          <span className="small">{k ? `(${k}), top first` : "Taken"}</span>
          <div className="look-tiles">
            {ts.map((t) => {
              const u = data.units.byId.get(t.unitId);
              return (
                <span key={t.tile} className={`look-tile t-${(u?.type ?? "x").toLowerCase()}`} title={u ? `${t.unitId} (${u.type}, Level ${u.level ?? "?"})` : t.unitId}>
                  <b>{u ? typeGlyph(u.type) : "?"}</b>
                  <small>{t.unitId}</small>
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder glyph for a unit type (designer 2026-11-08: real images later). */
export function typeGlyph(type: string): string {
  return type === "Sleeper" ? "P" : type[0]!.toUpperCase();
}

/** The card text of a sector, as a bubble over the Field that nothing else moves for (designer 2026-11-08). */
function InfoBubble({ data, state, sector }: { data: GameData; state: GameState; sector: string }) {
  const field = document.querySelector<HTMLElement>(".field");
  const centres: Record<string, [number, number]> = JSON.parse(field?.dataset.sectors ?? "{}");
  const at = centres[sector];
  const tileH = Number(field?.dataset.tile ?? 80);
  const w = field?.clientWidth ?? 400;
  if (!at) return null;
  const above = at[1] - tileH / 2 > 90;
  const style = { left: Math.max(8, Math.min(at[0] - 140, w - 288)), top: above ? at[1] - tileH / 2 - 6 : at[1] + tileH / 2 + 6 };
  return (
    <div className={`info-bubble ${above ? "above" : "below"}`} style={style}>
      <HoverInfo data={data} state={state} sector={sector} />
    </div>
  );
}

function HoverInfo({ data, state, sector }: { data: GameData; state: GameState; sector: string }) {
  const c = { data, state };
  const top = state.field[sector]!.at(-1);
  const line = sectorLine(data, state, sector);
  if (!top || !state.tiles[top]!.faceUp) return <span>{line}</span>;
  const d = unitDef(c, top);
  const camp = data.campaigns.find((x) => x.prefix === state.campaign);
  const omega = camp?.omega.find((o) => o.id === d.id);
  const texts = [d.text.activate && d.text.activate !== "none" ? `Effect: ${d.text.activate}` : "", d.text.ability ?? "", d.text.drain ? `Drain: ${d.text.drain}` : "", d.text.destroyed ? `Destroyed: ${d.text.destroyed}` : "", omega?.atOverload ? `At Overload: ${omega.atOverload}` : "", omega?.destroyed ? `Destroyed: ${omega.destroyed}` : ""].filter(Boolean);
  return (
    <span>
      <b>{line}</b> {tokenText(tile(state, top).tokens)} — {d.type}. {texts.join(" ")}
    </span>
  );
}

function GameOver({ state, onLeave }: { state: GameState; onLeave: () => void }) {
  const e = state.ending;
  return (
    <div>
      <h3>Game over</h3>
      <p>{state.outcome?.reason}</p>
      {e && (
        <>
          <p>
            <b>Score {e.score}</b>
          </p>
          <ul>
            {e.parts.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          {e.highScore && <p className="notice">New {e.highScore === "veteran" ? "Veteran ★ " : ""}high score!</p>}
        </>
      )}
      <button className="primary" onClick={onLeave}>
        Back to the menu
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function QuestionPanel(p: { data: GameData; state: GameState; q: Question; selected: string[]; setSelected: (x: string[]) => void; onAnswer: (a: Answer) => void; split: Record<string, number>; onResetSplit: () => void }) {
  const { q, state } = p;
  const [amount, setAmount] = usePerQuestion(q, q.kind === "amount" ? q.min : 0);
  const [split, setSplit] = usePerQuestion<Record<string, number>>(q, {});
  const head = (
    <p className="prompt">
      {q.prompt} <span className="rule">rule {q.rule}</span>
    </p>
  );
  switch (q.kind) {
    case "option":
    case "order": {
      // Options naming things on the screen are answered there; the rest stay buttons here.
      const onScreen = (id: string) =>
        q.rows !== undefined ||
        q.options.find((o) => o.id === id)?.on !== undefined ||
        (q.pick === "modules" ? state.player.modules.some((m) => String(m.id) === id) : q.pick === "units" ? state.tiles[id] !== undefined : false);
      const rest = q.options.filter((o) => !onScreen(o.id));
      const there = q.options.length - rest.length;
      return (
        <div>
          {head}
          {there > 0 && (
            <p className="small">
              {q.takeEnergy ? "Tap a pop-up beside a Module to take its energy away." : q.energy ? "Tap an energy pop-up beside a Module to place that energy there, one at a time, in any order." : q.rows ? "Click a sector of the row you want on the Field (the highlighted sectors), then confirm it in the pop-up." : `Click ${q.pick === "modules" ? "one of the highlighted Modules" : "a highlighted unit or sector on the Field"}.`}
            </p>
          )}
          <div className="choices">
            {rest.map((o) => (
              <button key={o.id} className={o.id === "concede" ? "danger" : ""} onClick={() => p.onAnswer({ kind: q.kind, value: o.id } as Answer)}>
                {q.energy?.[o.id] && <EnergyGlyph colour={q.energy[o.id]!} />} {o.label}
              </button>
            ))}
          </div>
        </div>
      );
    }
    case "yesno":
      return (
        <div>
          {head}
          <div className="choices">
            <button className="primary" onClick={() => p.onAnswer({ kind: "yesno", value: true })}>
              Yes
            </button>
            <button onClick={() => p.onAnswer({ kind: "yesno", value: false })}>No</button>
          </div>
        </div>
      );
    case "units":
    case "sectors": {
      const single = q.min === 1 && q.max === 1;
      const ok = p.selected.length >= q.min && p.selected.length <= q.max;
      const what = q.kind === "units" ? "unit" : "sector";
      return (
        <div>
          {head}
          <p className="small">
            {single ? `Click a highlighted ${what} on the Field.` : `Click ${q.min === q.max ? q.min : `${q.min} to ${q.max}`} highlighted ${what}s on the Field (click again to unselect), then Confirm.`}
          </p>
          {!single && (
            <button className="primary" disabled={!ok} onClick={() => p.onAnswer({ kind: q.kind, value: p.selected } as Answer)}>
              Confirm ({p.selected.length})
            </button>
          )}
        </div>
      );
    }
    case "several": {
      const ok = p.selected.length >= q.min && p.selected.length <= q.max;
      return (
        <div>
          {head}
          <div className="choices">
            {q.options.map((o) => (
              <button key={o.id} className={p.selected.includes(o.id) ? "on" : ""} onClick={() => p.setSelected(p.selected.includes(o.id) ? p.selected.filter((x) => x !== o.id) : [...p.selected, o.id])}>
                {o.label}
              </button>
            ))}
          </div>
          <button className="primary" disabled={!ok} onClick={() => p.onAnswer({ kind: "several", value: p.selected })}>
            Confirm ({p.selected.length})
          </button>
        </div>
      );
    }
    case "amount":
      return (
        <div>
          {head}
          <div className="stepper">
            <button onClick={() => setAmount(Math.max(q.min, amount - 1))}>−</button>
            <b>{amount}</b>
            <button onClick={() => setAmount(Math.min(q.max, amount + 1))}>+</button>
            <span className="small">
              ({q.min} to {q.max})
            </span>
          </div>
          <button className="primary" onClick={() => p.onAnswer({ kind: "amount", value: amount })}>
            Confirm
          </button>
        </div>
      );
    case "split": {
      if (q.pick) {
        const sum = Object.values(p.split).reduce((a, b) => a + b, 0);
        const things = q.pick === "modules" ? "highlighted Modules" : q.pick === "bays" ? "highlighted Bays" : q.pick === "reserve" ? "highlighted colours in your Reserve" : "highlighted units on the Field";
        return (
          <div>
            {head}
            <p className="small">
              Click the {things}: each click adds 1. {sum} of {q.total} placed; the last one confirms.
            </p>
            {sum > 0 && <button onClick={p.onResetSplit}>Start again</button>}
          </div>
        );
      }
      const sum = Object.values(split).reduce((a, b) => a + b, 0);
      return (
        <div>
          {head}
          {q.buckets.map((b) => {
            const n = split[b.id] ?? 0;
            return (
              <div key={b.id} className="stepper">
                <span className="bucket">{b.label}</span>
                <button onClick={() => setSplit({ ...split, [b.id]: Math.max(0, n - 1) })}>−</button>
                <b>{n}</b>
                <button onClick={() => setSplit({ ...split, [b.id]: Math.min(b.max, n + 1, n + (q.total - sum)) })}>+</button>
                <span className="small">up to {b.max}</span>
              </div>
            );
          })}
          <p className="small">
            {sum} of {q.total} assigned
          </p>
          <button className="primary" disabled={sum !== q.total} onClick={() => p.onAnswer({ kind: "split", value: split })}>
            Confirm
          </button>
        </div>
      );
    }
  }
}
