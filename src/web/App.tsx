/**
 * The full interface (spec "Screen and controls", stage 8). The engine
 * decides everything; this file only shows the state and the current
 * question, and turns clicks and taps into answers.
 */

import { useEffect, useMemo, useState } from "react";
import { objectiveText } from "../cli/objective.js";
import { sectorLine, tokenText } from "../cli/text.js";
import type { GameData } from "../data/index.js";
import { bayAbilities, orders } from "../engine/command.js";
import { describe, sectorKeys, tile, unitDef } from "../engine/field.js";
import { moduleCost, moduleDef } from "../engine/modules.js";
import type { Answer, Question } from "../engine/questions.js";
import { type Game, canUndo, playAnswer, replayGame, startGame, toSave, undo } from "../engine/save.js";
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

  useEffect(() => {
    void loadSave().then((f) => {
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

  if (!loaded) return <div className="splash">Loading…</div>;
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
            if (!f) return;
            setProfile(f.profile);
            if (f.game) {
              update(replayGame(data, f.game.start, f.game.answers));
              setInMenu(false);
            } else persist(undefined, f.profile);
          } catch (e) {
            setError(`That file could not be loaded: ${(e as Error).message}`);
          }
        }}
      />
    );
  return (
    <GameScreen
      data={data}
      game={game}
      notice={notice}
      onAnswer={(a) => {
        const { game: g, result } = playAnswer(data, game, a);
        if (result.status === "illegal") return setNotice(`Not allowed: ${result.reason}`);
        if (result.status === "blocked") return setNotice(`Not available: ${result.reason}`);
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
      onExport={() => download(`aphelion5-save-${today()}.json`, JSON.stringify(toSave(game, profile, autoAnswer), null, 1))}
      onExportLog={() => download(`aphelion5-log-${today()}.txt`, game.view.state.log.map((e) => `${e.text}${e.rule ? `  [${e.rule}]` : ""}`).join("\n"), "text/plain")}
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

// ---------------------------------------------------------------------------

function StartScreen(p: { profile: Profile; onContinue?: (() => void) | undefined; autoAnswer: boolean; setAutoAnswer: (b: boolean) => void; error?: string | undefined; onNew: (dev: boolean, seed: number) => void; onImport: () => void }) {
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
  onAnswer: (a: Answer) => void;
  onUndo: () => void;
  canUndo: () => boolean;
  onExport: () => void;
  onExportLog: () => void;
  onLeave: () => void;
}

function GameScreen(p: GameProps) {
  const { data, game } = p;
  const v = game.view;
  const s = v.state;
  const c = { data, state: s };
  const dark = useDark();
  const [selected, setSelected] = useState<string[]>([]);
  const [hover, setHover] = useState<string | undefined>();
  const [showLog, setShowLog] = useState(false);
  const q = v.status === "question" ? v.question : undefined;
  useEffect(() => setSelected([]), [q]);

  const choosable = {
    sectors: q?.kind === "sectors" ? q.options : [],
    units: q?.kind === "units" ? q.options : [],
  };
  const pick = (id: string) => {
    if (!q || (q.kind !== "units" && q.kind !== "sectors")) return;
    if (q.min === 1 && q.max === 1) return p.onAnswer({ kind: q.kind, value: [id] } as Answer);
    setSelected((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : xs.length < q.max ? [...xs, id] : xs));
  };
  const co = data.companies.byId.get(s.player.company)!;
  // The Field shows once a mission is chosen (also while it is empty, to choose sectors at Mission Preparation).
  const hasField = s.phase !== "setup" && sectorKeys(s).length > 0 && (s.phase !== "preparation" || s.log.some((e) => /^Mission \d/.test(e.text)));

  return (
    <div className={`game ${s.phase === "overload" ? "is-overload" : ""}`}>
      <header className="bar">
        <strong>{s.mission}</strong>
        <span className="phase">{PHASE[s.phase]}</span>
        <span>{objectiveText(c)}</span>
        <span>Threat: {s.run.threat.join(", ") || "—"}</span>
        <span>Command tokens {s.player.commandTokens}</span>
        {s.settings.heatModule && <span>Heat {s.player.heat}</span>}
        <span className="spacer" />
        <button onClick={p.onUndo} disabled={!p.canUndo()} title="Take back your last answer (not past new hidden information)">
          Undo
        </button>
        <button onClick={() => setShowLog((x) => !x)}>Log</button>
        <button onClick={p.onExport} title="Save the game and your Company sheets to a file">
          Export save
        </button>
        <button onClick={p.onExportLog}>Export log</button>
        <button onClick={p.onLeave}>Menu</button>
      </header>

      <aside className="left panel">
        <h3>Flagship — {co.name}</h3>
        {bayAbilities(c).length > 0 &&
          co.bays.map((b, i) => (
            <div key={b.id} className={`bay ${s.flagship[i] === 0 ? "out" : ""}`}>
              <b>
                Bay {i + 1}: {s.flagship[i]}/{b.integrity}
              </b>
              {bayAbilities(c)
                .filter((a) => a.bay === i + 1)
                .map((a) => (
                  <div key={a.id} className="small">
                    {a.text}
                  </div>
                ))}
            </div>
          ))}
        {s.flagship.every((x) => x === 0) && <p className="warn">CRIPPLED — you must Overhaul before your next action.</p>}
        <p className="small">
          Overhaul slots used {s.sheet.overhaulUsed}/{co.overhaulSlots} · Upgrade points {s.sheet.upgradePoints}
          {s.sheet.ally ? ` · Ally ${s.sheet.ally}` : ""}
        </p>
        <h3>Reserve</h3>
        <p className="energy">
          <span className="y">Yellow {s.player.reserve.Yellow}</span> <span className="r">Red {s.player.reserve.Red}</span> <span className="b">Blue {s.player.reserve.Blue}</span>
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
          orders(c).map((o) => (
            <p key={o.id} className="small">
              {o.overloadOnly ? "[Overload] " : ""}
              {o.tokens} token{o.tokens === 1 ? "" : "s"}: {o.effect}
            </p>
          ))}
      </aside>

      <section className="center">
        {hasField ? (
          <FieldView data={data} state={s} choosable={choosable} selected={selected} onPick={pick} onHover={setHover} showHidden={s.settings.developerMode} dark={dark} />
        ) : (
          <div className="empty-field">{PHASE[s.phase]}</div>
        )}
        <div className="hover">{hover ? <HoverInfo data={data} state={s} sector={hover} /> : <span className="small">Point at a sector to see its stack and card text.</span>}</div>
      </section>

      <aside className="right panel">
        <h3>Modules</h3>
        {s.player.modules.map((m) => {
          const d = moduleDef(c, m.id);
          const e = (["Yellow", "Red", "Blue"] as const).filter((k) => m.energy[k] > 0).map((k) => `${m.energy[k]} ${k}`);
          return (
            <div key={m.id} className={`module ${d.background} ${m.ready ? "" : "exhausted"}`} title={d.effect + (d.extraPayment ? ` Extra: ${d.extraPayment}` : "")}>
              <b>{d.name}</b>{" "}
              <span className="small">
                {d.cost === "X" ? "X" : moduleCost(c, m.id)} {d.colour} · {d.background === "red" ? "Overload" : "Command phase"} · {m.ready ? "ready" : "exhausted"}
                {e.length ? ` · holds ${e.join(", ")}` : ""}
              </span>
              <div className="small">{d.effect}</div>
            </div>
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
        {q ? <QuestionPanel data={data} state={s} q={q} selected={selected} setSelected={setSelected} onAnswer={p.onAnswer} /> : <GameOver state={s} onLeave={p.onLeave} />}
      </section>

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

function QuestionPanel(p: { data: GameData; state: GameState; q: Question; selected: string[]; setSelected: (x: string[]) => void; onAnswer: (a: Answer) => void }) {
  const { q, state, data } = p;
  const c = { data, state };
  const [amount, setAmount] = useState(q.kind === "amount" ? q.min : 0);
  const [split, setSplit] = useState<Record<string, number>>({});
  useEffect(() => {
    if (q.kind === "amount") setAmount(q.min);
    setSplit({});
  }, [q]);
  const head = (
    <p className="prompt">
      {q.prompt} <span className="rule">rule {q.rule}</span>
    </p>
  );
  switch (q.kind) {
    case "option":
    case "order":
      return (
        <div>
          {head}
          <div className="choices">
            {q.options.map((o) => (
              <button key={o.id} className={o.id === "concede" ? "danger" : ""} onClick={() => p.onAnswer({ kind: q.kind, value: o.id } as Answer)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      );
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
      const label = (id: string) => (q.kind === "units" ? describe(c, id) : sectorLine(data, state, id));
      const toggle = (id: string) => {
        if (single) return p.onAnswer({ kind: q.kind, value: [id] } as Answer);
        p.setSelected(p.selected.includes(id) ? p.selected.filter((x) => x !== id) : p.selected.length < q.max ? [...p.selected, id] : p.selected);
      };
      const ok = p.selected.length >= q.min && p.selected.length <= q.max;
      return (
        <div>
          {head}
          <p className="small">{single ? "Click one on the Field or below." : `Choose ${q.min === q.max ? q.min : `${q.min} to ${q.max}`} (on the Field or below), then Confirm.`}</p>
          <div className="choices">
            {q.options.map((id) => (
              <button key={id} className={p.selected.includes(id) ? "on" : ""} onClick={() => toggle(id)}>
                {label(id)}
                {q.kind === "units" && tokenText(tile(state, id).tokens) ? ` ${tokenText(tile(state, id).tokens)}` : ""}
              </button>
            ))}
          </div>
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
