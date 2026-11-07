/**
 * The full interface (spec "Screen and controls", stage 8). The engine
 * decides everything; this file only shows the state and the current
 * question, and turns clicks and taps into answers.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { objectiveText } from "../cli/objective.js";
import { sectorLine, tokenText } from "../cli/text.js";
import type { GameData } from "../data/index.js";
import { alertedUnits } from "../engine/alerts.js";
import { bayAbilities, orders } from "../engine/command.js";
import { describe, sectorKeys, tile, unitDef } from "../engine/field.js";
import { moduleCost, moduleDef } from "../engine/modules.js";
import type { Answer, Option, Question } from "../engine/questions.js";
import { type Game, type SaveFile, canUndo, playAnswer, readSave, replayGame, startGame, toSave, undo } from "../engine/save.js";
import { type GameState, type Profile, emptyProfile } from "../engine/state.js";
import { gameData } from "./data.js";
import { FieldView } from "./FieldView.js";
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
  const [showLog, setShowLog] = useState(false);
  const [popup, setPopup] = usePerQuestion<Popup | undefined>(q, undefined);
  const [confirm, setConfirm] = usePerQuestion<Confirm | undefined>(q, undefined);
  // A split answered by clicking things (energy on Modules, damage to Bays or units).
  const [split, setSplit] = usePerQuestion<Record<string, number>>(q, {});
  const pointer = useRef({ x: 0, y: 0 });

  const actors = actorsOf(q);
  const answer = (id: string) => {
    setPopup(undefined);
    setConfirm(undefined);
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
  // A row question: click a sector of a row, then confirm the row in a pop-up.
  const rowQ = !actors && q?.kind === "option" && q.rows ? q : undefined;
  const [rowSel, setRowSel] = usePerQuestion<number | undefined>(q, undefined);
  const rowSectors = rowQ ? [...new Set(rowQ.rows!.flat())] : [];
  const onFieldUnits = [...onField.keys()].filter((k) => s.tiles[k] !== undefined);
  const onFieldSectors = [...onField.keys()].filter((k) => s.field[k] !== undefined);
  const splitOn = q?.kind === "split" ? q.pick : undefined;
  const choosable = actors
    ? { sectors: [...actors.sectors.keys()], units: [...actors.units.keys()] }
    : {
        sectors: q?.kind === "sectors" ? q.options : [],
        units: q?.kind === "units" ? q.options : q?.kind === "split" && splitOn === "units" ? q.buckets.map((b) => b.id) : [...pickIds, ...onFieldUnits],
      };
  if (!actors && onFieldSectors.length) choosable.sectors = [...choosable.sectors, ...onFieldSectors];
  if (rowSectors.length) choosable.sectors = [...choosable.sectors, ...rowSectors];
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

  /** Where a unit or sector is on screen (its sector's centre), else where the pointer was. */
  const centreOf = (id: string): { x: number; y: number } => {
    const field = document.querySelector<HTMLElement>(".field");
    const k = s.tiles[id] ? Object.keys(s.field).find((key) => s.field[key]!.includes(id)) : id;
    const hits: { k: string; x: number; y: number }[] = JSON.parse(field?.dataset.choosable ?? "[]");
    const h = hits.find((x) => x.k === k);
    if (!field || !h) return pointer.current;
    const r = field.getBoundingClientRect();
    return { x: r.left + h.x, y: r.top + h.y };
  };
  const openPopup = (title: string, options: Option[], note?: string, at?: string) => setPopup({ ...(at ? centreOf(at) : pointer.current), title, options, note });
  const pick = (id: string) => {
    if (actors) {
      const unitOpts = actors.units.get(id);
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

  // Modules: run one (action menu), choose one (a question about Modules), or place energy on it (a split).
  const moduleState = (id: number): { can: boolean; onClick?: () => void; count?: number } => {
    if (actors) {
      const o = actors.modules.get(id);
      return o ? { can: true, onClick: () => answer(o.id) } : { can: false };
    }
    // Energy (designer 2026-11-07): answered on the pop-up beside the Module, not on the Module itself.
    if (q?.kind === "option" && q.energy) return { can: false };
    if (q && (q.kind === "option" || q.kind === "order") && q.pick === "modules" && q.options.some((o) => o.id === String(id))) return { can: true, onClick: () => send({ kind: q.kind, value: String(id) } as Answer) };
    if (q?.kind === "split" && splitOn === "modules" && q.buckets.some((b) => b.id === String(id))) return { can: true, onClick: () => addSplit(String(id)), count: split[String(id)] ?? 0 };
    return { can: false };
  };
  const modulesWanted = (q && (q.kind === "option" || q.kind === "order") && q.pick === "modules") || splitOn === "modules";
  const energyQ = !actors && q?.kind === "option" && q.energy ? q : undefined;
  const energyFor = (id: number) => energyQ?.energy?.[String(id)];
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
  const heatWave = actors?.game.get("heatWave");

  return (
    <div
      className={`game ${inOverload ? "is-overload" : ""}`}
      onPointerDownCapture={(e) => {
        pointer.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <header className="bar">
        <strong>{s.mission}</strong>
        <span className="phase">{PHASE[s.phase]}</span>
        <span>{objectiveText(c)}</span>
        <span>Threat: {s.run.threat.join(", ") || "—"}</span>
        <span>Command tokens {s.player.commandTokens}</span>
        {s.settings.heatModule && <span>Heat {s.player.heat}</span>}
        {heatWave && (
          <button className="can" onClick={() => answer(heatWave.id)} title="H5">
            Heat Wave
          </button>
        )}
        {endOverload && (
          <button className="primary can" onClick={() => answer(endOverload.id)} title="No Alert tokens remain (9.2)">
            End the Overload
          </button>
        )}
        <span className="spacer" />
        <button onClick={p.onUndo} disabled={!p.canUndo()} title="Take back your last answer (not past new hidden information)">
          Undo
        </button>
        <button onClick={() => setShowLog((x) => !x)}>Log</button>
        <button onClick={p.onExport} title="Save the game and your Company sheets as text or a file">
          Export save
        </button>
        <button onClick={p.onExportLog}>Export log</button>
        <button className="danger" onClick={askConcede} disabled={!concede} title={concede ? "Concede the game (10.3)" : "You can concede when it is your turn to act"}>
          Concede
        </button>
        <button onClick={p.onLeave}>Menu</button>
      </header>

      <aside className="left panel">
        <h3>Flagship — {co.name}</h3>
        {co.bays.map((b, i) => {
          const bucket = `bay${i + 1}`;
          const inSplit = baysWanted && q?.kind === "split" && q.buckets.some((x) => x.id === bucket);
          return (
            <div key={b.id} className={`bay ${s.flagship[i] === 0 ? "out" : ""} ${inSplit ? "can" : ""} ${baysWanted && !inSplit ? "dim" : ""}`} onClick={inSplit ? () => addSplit(bucket) : undefined}>
              <b>
                Bay {i + 1}: {s.flagship[i]}/{b.integrity}
              </b>
              {inSplit && <SplitCount n={split[bucket] ?? 0} onMinus={() => subSplit(bucket)} />}
              {bayAbilities(c)
                .filter((a) => a.bay === i + 1)
                .map((a) => {
                  const o = actors?.bays.get(a.id);
                  return o ? (
                    <button key={a.id} className="ability can" onClick={() => answer(o.id)} title="Use this Bay: 1 damage to the Bay, then its ability (8.7)">
                      {a.text}
                    </button>
                  ) : (
                    <div key={a.id} className="ability small">
                      {a.text}
                    </div>
                  );
                })}
            </div>
          );
        })}
        {crippled && <p className="warn">CRIPPLED — you must Overhaul before your next action.</p>}
        <div className="overhaul">
          <button className={overhaul ? "can" : ""} disabled={!overhaul} onClick={askOverhaul} title="Repair the Flagship, refill energy, swap a Module (8.8)">
            Overhaul
          </button>
          <span className="small">
            slots used {s.sheet.overhaulUsed}/{co.overhaulSlots}
          </span>
        </div>
        <p className="small">
          Upgrade points {s.sheet.upgradePoints}
          {s.sheet.ally ? ` · Ally ${s.sheet.ally}` : ""}
        </p>
        <h3>Reserve</h3>
        <p className="energy reserve">
          {(["Yellow", "Red", "Blue"] as const).map((col) => {
            const inSplit = splitOn === "reserve" && q?.kind === "split" && q.buckets.some((b) => b.id === col);
            return (
              <span key={col} className={`${col[0]!.toLowerCase()} ${inSplit ? "can" : ""} ${splitOn === "reserve" && !inSplit ? "dim" : ""}`} onClick={inSplit ? () => addSplit(col) : undefined} role={inSplit ? "button" : undefined}>
                {col} {s.player.reserve[col]}
                {inSplit && <SplitCount n={split[col] ?? 0} onMinus={() => subSplit(col)} />}
              </span>
            );
          })}
        </p>
        <h3>Anomaly cards</h3>
        {s.player.anomalies.length === 0 && <p className="small">none</p>}
        {s.player.anomalies.map((id) => (
          <p key={id} className="small">
            {id}: {data.anomalies.byId.get(id)!.text}
          </p>
        ))}
        <h3>Orders</h3>
        {s.mission &&
          orders(c).map((o) => {
            const sc = actors?.orders.get(o.id);
            const text = `${o.overloadOnly ? "[Overload] " : ""}${o.tokens} token${o.tokens === 1 ? "" : "s"}: ${o.effect}`;
            return (
              <button key={o.id} className={`order ${sc ? "can" : ""}`} disabled={!sc} onClick={sc ? () => answer(sc.id) : undefined} title={sc ? "Issue this Order (5.6)" : o.overloadOnly !== inOverload ? (o.overloadOnly ? "Only during an Overload" : "Not during an Overload") : "Not available now"}>
                {text}
              </button>
            );
          })}
      </aside>

      <section className="center">
        {hasField ? (
          <FieldView data={data} state={s} rotate={rotate} choosable={choosable} selected={[...selected, ...Object.keys(split).filter((k) => (split[k] ?? 0) > 0), ...(rowQ && rowSel !== undefined ? rowQ.rows![rowSel]! : [])]} onPick={pick} onHover={setHover} showHidden={s.settings.developerMode} dark={dark} />
        ) : (
          <div className="empty-field">{PHASE[s.phase]}</div>
        )}
        <div className="hover">{hover ? <HoverInfo data={data} state={s} sector={hover} /> : <span className="small">Point at a sector to see its stack and card text.</span>}</div>
      </section>

      <aside className="right panel">
        <h3>Modules</h3>
        {sortedModules(c, s.player.modules).map((m) => {
          const d = moduleDef(c, m.id);
          const e = (["Yellow", "Red", "Blue"] as const).filter((k) => m.energy[k] > 0).map((k) => `${m.energy[k]} ${k}`);
          const st = moduleState(m.id);
          const dim = modulesWanted && !st.can && !energyFor(m.id);
          const Tag = st.can ? "button" : "div";
          return (
            <Tag key={m.id} data-module={m.id} className={`module rim-${d.colour.toLowerCase()} ${m.ready ? "" : "exhausted"} ${st.can ? "can" : ""} ${dim ? "dim" : ""} ${energyFor(m.id) ? `energy-target ${energyFor(m.id)!.toLowerCase()}` : ""}`} title={d.effect + (d.extraPayment ? ` Extra: ${d.extraPayment}` : "")} onClick={st.onClick}>
              <b>{d.name}</b>{" "}
              <span className="small">
                {d.cost === "X" ? "X" : moduleCost(c, m.id)} {d.colour} · {d.background === "red" ? "Overload" : "Command phase"} · {m.ready ? "ready" : "exhausted"}
                {e.length ? ` · holds ${e.join(", ")}` : ""}
              </span>
              <div className="small">{d.effect}</div>
              {st.count !== undefined && <SplitCount n={st.count} onMinus={() => subSplit(String(m.id))} />}
            </Tag>
          );
        })}
        <h3>Trophy pile</h3>
        <p className="small">
          {Object.entries(
            s.piles.trophy.reduce<Record<string, number>>((acc, t) => ((acc[s.tiles[t]!.unitId!] = (acc[s.tiles[t]!.unitId!] ?? 0) + 1), acc), {}),
          )
            .map(([u, n]) => `${n} ${u}`)
            .join(", ") || "empty"}
        </p>
      </aside>

      <section className="question panel" aria-live="polite">
        {p.notice && <p className="notice">{p.notice}</p>}
        {rotate && (
          <div className="facing-note">
            <p className="prompt">
              {describe({ data, state: real.state }, rotate.tile)}: turn it with the ⟲ ⟳ buttons on the unit. <span className="rule">rule 3.7</span>
            </p>
            {rotate.done ? (
              <button className="primary" onClick={rotate.done}>
                Done
              </button>
            ) : (
              <p className="small">Your next click keeps this facing.</p>
            )}
          </div>
        )}
        {rotate?.done ? null : q ? (
          actors ? (
            <ActionPrompt state={s} q={q} actors={actors} />
          ) : (
            <QuestionPanel data={data} state={s} q={q} selected={selected} setSelected={setSelected} onAnswer={send} split={split} onResetSplit={() => setSplit({})} />
          )
        ) : (
          <GameOver state={s} onLeave={p.onLeave} />
        )}
      </section>

      {energyQ && <EnergyPopups q={energyQ} onPick={(id) => send({ kind: "option", value: id })} />}
      {popup && (
        <PopupMenu
          popup={popup}
          onPick={answer}
          onClose={() => {
            setPopup(undefined);
            setRowSel(undefined);
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

/**
 * Energy on Modules (designer 2026-11-07): a pop-up to the left of every
 * Module that can take one of the waiting energies, with an arrow to it and
 * the energy's glyph. One tap places one energy; several colours (a Power
 * Node) show all their pop-ups at once, placed in any order.
 */
function EnergyPopups({ q, onPick }: { q: Question & { kind: "option" }; onPick: (id: string) => void }) {
  const ids = q.options.filter((o) => !o.id.startsWith("supply:")).map((o) => o.id);
  const [pos, setPos] = useState<Record<string, { x: number; y: number; inside: boolean } | undefined>>({});
  const W = 132;
  useLayoutEffect(() => {
    const first = document.querySelector(`[data-module="${ids[0]}"]`);
    first?.scrollIntoView({ block: "nearest" });
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
        const col = q.energy![id]!;
        if (!p) return null;
        return (
          <button key={`${q.prompt}:${id}`} className={`energy-pop ${col.toLowerCase()} ${p.inside ? "inside" : ""}`} style={{ left: p.x, top: p.y, width: W, animationDelay: `${i * 50}ms, ${i * 50 + 300}ms` }} onClick={() => onPick(id)} aria-label={`Place 1 ${col} energy on this Module`}>
            <EnergyGlyph colour={col} />
            <span>+1 {col}</span>
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

/** What to do when the action menu is the question: the things themselves are the menu. */
function ActionPrompt({ state, q, actors }: { state: GameState; q: Question; actors: Actors }) {
  const alerts = actors.units.size > 0 && [...actors.units.values()].some((os) => os.some((o) => o.id.startsWith("alert:")));
  const where: string[] = [];
  if (actors.units.size) where.push("a unit");
  if (actors.sectors.size) where.push("a Dark sector");
  if (actors.modules.size) where.push("a Module");
  if (actors.bays.size) where.push("a Bay");
  if (actors.orders.size) where.push("an Order");
  const lead =
    state.phase === "overload"
      ? alerts
        ? "Overload: resolve the Alerts (click an alerted unit), or take another Overload action."
        : "Overload: no Alerts remain. End the Overload, or take more Overload actions first."
      : state.flagship.every((x) => x === 0)
        ? "Your Flagship is Crippled: you must Overhaul."
        : alerts
          ? "Alerts first: click an alerted unit to resolve its Alert (or Overhaul)."
          : "Your action.";
  return (
    <div>
      <p className="prompt">
        {lead} <span className="rule">rule {q.rule}</span>
      </p>
      {where.length > 0 && <p className="small">Click a highlighted thing: {where.join(", ")}.</p>}
    </div>
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
function PopupMenu({ popup, onPick, onClose }: { popup: Popup; onPick: (id: string) => void; onClose: () => void }) {
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
  const items = [...popup.options.map((o) => ({ id: o.id, label: o.label, go: () => leave(() => onPick(o.id)), main: popup.commit })), ...(popup.next ? [{ id: "next", label: popup.next.label, go: popup.next.go, main: false }] : [])];
  return (
    <div className="popup-back" onPointerDown={(e) => e.target === e.currentTarget && leave(onClose)}>
      <div ref={box} className={`popup bubbles ${leaving ? "leaving" : ""}`} role="menu" aria-label={popup.title} style={pos}>
        <div className="popup-title">{popup.title}</div>
        <div className="bubble-row">
          {items.map((o, i) => (
            <button key={`${popup.title}:${o.id}`} role="menuitem" title={o.label} className={`bubble ${o.main ? "primary" : ""} ${o.label.length > 60 ? "tiny" : o.label.length > 30 ? "small-text" : ""}`} style={{ animationDelay: `${i * 45}ms` }} onClick={o.go}>
              <BubbleLabel text={o.label} />
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
              {q.energy ? "Tap an energy pop-up beside a Module to place that energy there, one at a time, in any order." : q.rows ? "Click a sector of the row you want on the Field (the highlighted sectors), then confirm it in the pop-up." : `Click ${q.pick === "modules" ? "one of the highlighted Modules" : "a highlighted unit or sector on the Field"}.`}
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
