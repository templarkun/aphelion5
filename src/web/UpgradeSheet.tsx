/**
 * The Upgrade sheet (designer 2026-11-09, build step 4; Program Spec "The Upgrade sheet"). At
 * Mission End (10.1 step 2) the Company sheet fills the screen below the top bar: the Field, the
 * Flagship panel and the Modules are hidden (they play no part here; the Flagship is shown on the
 * sheet itself, with its Bays).
 *
 * - Three groups, each in its own colour: Flagship (cyan, with a placeholder picture of the ship
 *   and its numbered Bays), Mecha (amber, by Mecha), Requisitions (violet).
 * - Each upgrade is a card: what kind of ability it is, its text, and one slot per point of cost.
 *   Upgrades that unlock others are joined by a line; "choose one" pairs show "or".
 * - Every upgrade you can mark now breathes and its next slot pulses. Tap the card (wide screens)
 *   or drag a point from the pool onto it: the point flies into the slot, which fills with sparks.
 *   A full upgrade gets a shockwave, light rays and "Upgrade online".
 * - Phones (720 px or less): tabs for the three groups, short cards (two lines); a tap opens a card
 *   with the whole text and a "Mark a slot" button.
 *
 * Each mark is one answer (the engine asks once per point), so Undo takes back one point.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GameData } from "../data/index.js";
import type { CompanyDef, UpgradeDef } from "../data/company.js";
import { moduleDef } from "../engine/modules.js";
import type { Answer, Question } from "../engine/questions.js";
import type { GameState } from "../engine/state.js";
import { UpgradeGlyph } from "./Upgrade.js";
import { UpgradeFx } from "./upgradeFx.js";
import { noFlying } from "./motion.js";

type Group = "flagship" | "mecha" | "req";
const COLOUR: Record<Group, string> = { flagship: "#38d9ff", mecha: "#ffb547", req: "#b98bff" };
const TITLE: Record<Group, string> = { flagship: "Flagship", mecha: "Mecha", req: "Requisitions" };

const groupOf = (u: UpgradeDef): Group => (u.kind === "requisition" ? "req" : u.appliesTo.some((a) => a.startsWith("flagship_bay_")) ? "flagship" : "mecha");
const still = () => noFlying();

/** What kind of ability an upgrade gives, and its text without the tags. */
export function readEffect(u: UpgradeDef): { tags: string[]; text: string } {
  const tags: string[] = [];
  let t = u.effect;
  if (u.kind === "requisition") return { tags: [u.repeatable ? "Repeatable" : "One time"], text: t };
  let m = /^Bay \d+ gains: "(.*)"$/.exec(t);
  if (m) {
    tags.push("New Bay ability");
    t = m[1]!;
  } else if ((m = /^Every Mecha gains: "(.*)"$/.exec(t))) {
    tags.push("Every Mecha");
    t = m[1]!;
  } else if ((m = /^Improves (\S+?)(?:'s (\w+))?: (.*)$/.exec(t))) {
    tags.push(m[2] ? `Improves ${m[2]}` : `Improves ${m[1]}`);
    t = m[3]!.replace(/^./, (x) => x.toUpperCase());
  }
  for (;;) {
    const o = /^\[Overload\]\s*/.exec(t);
    if (o) {
      tags.push("Overload");
      t = t.slice(o[0].length);
      continue;
    }
    const k = /^(Command|Expend|Passive):\s*/.exec(t);
    if (k && !tags.some((x) => x.startsWith("Improves"))) {
      tags.push(tags.length === 0 || tags[0] === "Overload" || tags[0] === "Every Mecha" ? `New ${k[1]}` : k[1]!);
      t = t.slice(k[0].length);
      continue;
    }
    break;
  }
  return { tags, text: t };
}

/** Energy a Requisition gives, for glyphs. */
function reqChips(u: UpgradeDef): { colour?: "Yellow" | "Red" | "Blue"; n: number; module?: boolean } | undefined {
  const m = /Gain (\d+) (Yellow|Red|Blue) energy/.exec(u.effect);
  if (m) return { colour: m[2] as "Yellow", n: Number(m[1]) };
  if (/Module/.test(u.effect)) return { n: 1, module: true };
  return undefined;
}

type Celebrate = { id: string; group: Group; title: string; text: string; at: number };

export function UpgradeSheet(p: { data: GameData; state: GameState; q: Question | undefined; onAnswer: (a: Answer) => void; onContinue: () => void }) {
  const { data, state: s, q } = p;
  const co = data.companies.byId.get(s.player.company)! as CompanyDef;
  const marks = s.sheet.marks;
  const points = s.sheet.upgradePoints;
  const upQ = q?.upgrade && q.kind === "option" ? q : undefined;
  const confirm = q?.upgrade && q.kind === "yesno" ? q : undefined;
  const markable = useMemo(() => new Set(upQ ? upQ.options.map((o) => o.id).filter((x) => x !== "done") : []), [upQ]);
  const ups = co.upgrades;
  const byId = useMemo(() => new Map(ups.map((u) => [u.id, u])), [ups]);

  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.innerWidth <= 720);
  useEffect(() => {
    const f = () => setCompact(window.innerWidth <= 720);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  const groups = (["flagship", "mecha", "req"] as Group[]).filter((g) => g === "flagship" || ups.some((u) => groupOf(u) === g));
  const [tab, setTab] = useState<Group>(() => groups.find((g) => ups.some((u) => groupOf(u) === g && markable.has(u.id))) ?? "mecha");
  const [open, setOpen] = useState<string | undefined>();
  const [hoverBay, setHoverBay] = useState<number | undefined>();

  // Animation bookkeeping: slots still in flight are shown empty until the point lands.
  const [pending, setPending] = useState<Record<string, number>>({});
  const [held, setHeld] = useState<Record<string, number>>({});
  const [celebrate, setCelebrate] = useState<Celebrate | undefined>();
  const [lit, setLit] = useState<{ id: string; at: number } | undefined>();
  const shown = (u: UpgradeDef) => held[u.id] ?? Math.max(0, (marks[u.id] ?? 0) - (pending[u.id] ?? 0));
  const isFull = (id: string) => {
    const u = byId.get(id);
    return u !== undefined && (marks[id] ?? 0) >= u.cost;
  };

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poolRef = useRef<HTMLDivElement>(null);
  const fx = useRef<UpgradeFx | undefined>(undefined);
  useEffect(() => {
    if (canvasRef.current) fx.current = new UpgradeFx(canvasRef.current);
    return () => fx.current?.stop();
  }, []);
  const dropAt = useRef<{ x: number; y: number } | undefined>(undefined);

  // A point was spent: fly it from the pool (or where it was dropped) into its slot.
  const before = useRef({ marks: { ...marks }, points, modules: s.player.modules.map((m) => m.id) });
  useLayoutEffect(() => {
    const b = before.current;
    before.current = { marks: { ...marks }, points, modules: s.player.modules.map((m) => m.id) };
    if (points !== b.points - 1) return;
    let id = ups.find((u) => (marks[u.id] ?? 0) === (b.marks[u.id] ?? 0) + 1)?.id;
    // A Repeatable Requisition that filled had its slots erased at once (10.2).
    const reset = id ? undefined : ups.find((u) => u.kind === "requisition" && u.repeatable && (marks[u.id] ?? 0) === 0 && (b.marks[u.id] ?? 0) === u.cost - 1);
    if (reset) id = reset.id;
    if (!id) return;
    const u = byId.get(id)!;
    const slotIndex = b.marks[id] ?? 0;
    const full = reset !== undefined || (marks[id] ?? 0) >= u.cost;
    const gainedModule = s.player.modules.map((m) => m.id).find((m) => !b.modules.includes(m));
    if (reset) setHeld((h) => ({ ...h, [id!]: u.cost - 1 }));
    else setPending((x) => ({ ...x, [id!]: (x[id!] ?? 0) + 1 }));
    const from = dropAt.current ?? centre(poolRef.current?.querySelector(".up-token:last-child") ?? poolRef.current);
    dropAt.current = undefined;
    const group = groupOf(u);
    const colour = COLOUR[group];
    // Wait one frame so the slot is on screen (a phone tab may have switched to it).
    requestAnimationFrame(() => {
      const slot = rootRef.current?.querySelector(`[data-slot="${id}:${slotIndex}"]`);
      slot?.scrollIntoView({ block: "nearest", inline: "nearest" });
      const to = centre(slot) ?? from;
      flyPoint(from, to, colour, () => {
        if (reset) setHeld((h) => ({ ...h, [id!]: u.cost }));
        else setPending((x) => ({ ...x, [id!]: Math.max(0, (x[id!] ?? 0) - 1) }));
        if (to) fx.current?.spark(to.x, to.y, colour);
        const card = rootRef.current?.querySelector(`[data-upgrade="${id}"]`);
        bump(card, "up-hit");
        if (!full) return;
        const c = centre(card) ?? to;
        window.setTimeout(() => {
          if (c) fx.current?.burst(c.x, c.y, colour, true);
          bump(card, "up-burst");
          bump(rootRef.current, "up-flash");
          const r = readEffect(u);
          const where = group === "flagship" ? `Bay ${u.appliesTo[0]!.replace("flagship_bay_", "")}` : group === "mecha" ? (u.appliesTo[0] === "all_mecha" ? "Every Mecha" : u.appliesTo.join(", ")) : "";
          const text = gainedModule !== undefined ? `${r.text} — ${safeModuleName(data, s, gainedModule)}` : r.text;
          setCelebrate({ id: u.id, group, title: group === "req" ? "Requisition received" : "Upgrade online", text: `${where ? `${where} · ` : ""}${text}`, at: Date.now() });
          setLit({ id: u.id, at: Date.now() });
        }, 90);
        if (reset)
          window.setTimeout(() => {
            setHeld((h) => {
              const n = { ...h };
              delete n[id!];
              return n;
            });
          }, 1300);
      });
    });
  }, [marks, points]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!celebrate) return;
    const t = window.setTimeout(() => setCelebrate(undefined), 2400);
    return () => window.clearTimeout(t);
  }, [celebrate]);
  useEffect(() => {
    if (!lit) return;
    const t = window.setTimeout(() => setLit(undefined), 2200);
    return () => window.clearTimeout(t);
  }, [lit]);

  const mark = (id: string) => {
    if (!markable.has(id)) return;
    p.onAnswer({ kind: "option", value: id });
  };

  // Dragging a point from the pool onto an upgrade (the tap twin is a tap on the card).
  const [drag, setDrag] = useState<{ x: number; y: number; over?: string | undefined } | undefined>();
  const startDrag = (e: React.PointerEvent) => {
    if (!upQ || points <= 0) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    const overAt = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y)?.closest("[data-upgrade]");
      const id = el?.getAttribute("data-upgrade") ?? undefined;
      return id && markable.has(id) ? id : undefined;
    };
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      moved = true;
      setDrag({ x: ev.clientX, y: ev.clientY, over: overAt(ev.clientX, ev.clientY) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDrag(undefined);
      if (!moved) return;
      const id = overAt(ev.clientX, ev.clientY);
      if (id) {
        dropAt.current = { x: ev.clientX, y: ev.clientY };
        mark(id);
      } else {
        const home = centre(poolRef.current?.querySelector(".up-token:last-child") ?? poolRef.current);
        if (home) flyPoint({ x: ev.clientX, y: ev.clientY }, home, COLOUR.req, () => undefined, true);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const ctxState = (u: UpgradeDef): "gained" | "open" | "locked" | "excluded" | "idle" => {
    if (u.kind !== "requisition" && shown(u) >= u.cost) return "gained";
    if (u.exclusiveWith.some((x) => (marks[x] ?? 0) > 0)) return "excluded";
    if (u.state === "locked" && !(u.unlockedBy && isFull(u.unlockedBy))) return "locked";
    return markable.has(u.id) ? "open" : "idle";
  };

  const card = (u: UpgradeDef) => {
    const g = groupOf(u);
    const st = ctxState(u);
    const n = shown(u);
    const r = readEffect(u);
    const chips = g === "req" ? reqChips(u) : undefined;
    const isOpen = compact && open === u.id;
    const why =
      st === "locked"
        ? `Locked: fill ${u.unlockedBy} first`
        : st === "excluded"
          ? `Not chosen: ${u.exclusiveWith.filter((x) => (marks[x] ?? 0) > 0).join(", ")} was chosen`
          : st === "gained"
            ? "Online: yours for good"
            : st === "open"
              ? `${n} of ${u.cost} · ${u.cost - n} to go`
              : `${n} of ${u.cost}`;
    const onClick = () => {
      if (compact) setOpen((x) => (x === u.id ? undefined : u.id));
      else mark(u.id);
    };
    return (
      <div
        key={u.id}
        role="button"
        tabIndex={0}
        data-upgrade={u.id}
        className={`up-card g-${g} st-${st} ${isOpen ? "is-open" : ""} ${drag?.over === u.id ? "drop-hot" : ""} ${lit?.id === u.id ? "is-lit" : ""} ${n > 0 && st !== "gained" ? "has-marks" : ""}`}
        style={{ "--up": COLOUR[g] } as React.CSSProperties}
        onClick={onClick}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), markable.has(u.id) ? mark(u.id) : onClick())}
        title={compact ? undefined : `${u.id}: ${u.effect}`}
        onMouseEnter={() => g === "flagship" && setHoverBay(Number(u.appliesTo[0]!.replace("flagship_bay_", "")))}
        onMouseLeave={() => setHoverBay(undefined)}
      >
        <div className="up-card-top">
          {r.tags.map((t) => (
            <span key={t} className={`up-tag ${/Overload/.test(t) ? "t-overload" : ""}`}>
              {t}
            </span>
          ))}
          <span className="up-id">{u.id}</span>
        </div>
        <p className="up-text">
          {chips && (
            <span className="up-chips" aria-hidden>
              {chips.module ? <span className="up-modchip">M</span> : Array.from({ length: chips.n }, (_, i) => <span key={i} className={`glyph ${chips.colour!.toLowerCase()}`}>{chips.colour![0]}</span>)}
            </span>
          )}
          {r.text}
        </p>
        <div className="up-slots" aria-label={`${n} of ${u.cost} slots marked`}>
          {Array.from({ length: u.cost }, (_, i) => (
            <span key={i} data-slot={`${u.id}:${i}`} className={`up-slot ${i < n ? "on" : ""} ${st === "open" && i === n ? "next" : ""}`} />
          ))}
          <span className="up-meter" style={{ "--k": n / u.cost } as React.CSSProperties} />
        </div>
        {!compact && unlockLine(u, ups) && <div className="up-unlocks">{unlockLine(u, ups)}</div>}
        <div className="up-why">
          {st === "locked" && <LockIcon />}
          {st === "gained" && <span className="up-check">✓</span>}
          {why}
        </div>
        {isOpen && (
          <div className="up-open">
            {unlockLine(u, ups) && <p className="small">{unlockLine(u, ups)}</p>}
            {st === "open" && (
              <button
                className="primary up-mark"
                onClick={(e) => {
                  e.stopPropagation();
                  mark(u.id);
                }}
              >
                Mark a slot (−1 point)
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  /** An upgrade and the ones it unlocks, joined by a line ("or" for choose-one pairs). */
  const chain = (u: UpgradeDef): React.ReactNode => {
    const kids = ups.filter((x) => x.unlockedBy === u.id);
    return (
      <div className="up-chain" key={u.id}>
        {card(u)}
        {kids.length > 0 && (
          <div className={`up-kids ${kids.length > 1 && u.unlockMode === "choose_one" ? "choose" : ""} ${isFull(u.id) ? "unlocked" : ""}`}>
            <span className="up-link" aria-hidden />
            {kids.length > 1 && u.unlockMode === "choose_one" && <span className="up-choose">Choose one</span>}
            <div className="up-kid-row">
              {kids.map((k, i) => (
                <div className="up-kid" key={k.id}>
                  {i > 0 && u.unlockMode === "choose_one" && <span className="up-or">or</span>}
                  {chain(k)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };
  const roots = (list: UpgradeDef[]) => list.filter((u) => !u.unlockedBy || !list.some((x) => x.id === u.unlockedBy));

  const bayCount = co.bays.length;
  const flagshipSection = (
    <section className="up-sec g-flagship" style={{ "--up": COLOUR.flagship } as React.CSSProperties} key="flagship">
      <SectionHead group="flagship" n={ups.filter((u) => groupOf(u) === "flagship" && markable.has(u.id)).length} hide={compact} />
      <FlagshipArt bays={co.bays.map((b, i) => ({ n: b.number, hp: s.flagship[i] ?? 0, max: b.integrity }))} count={bayCount} hover={hoverBay} lit={lit && groupOf(byId.get(lit.id)!) === "flagship" ? Number(byId.get(lit.id)!.appliesTo[0]!.replace("flagship_bay_", "")) : undefined} name={co.name} compact={compact} />
      {co.bays.map((b) => {
        const list = ups.filter((u) => u.appliesTo.includes(`flagship_bay_${b.number}`));
        return (
          <div className="up-group" key={b.id} onMouseEnter={() => setHoverBay(b.number)} onMouseLeave={() => setHoverBay(undefined)}>
            <div className="up-ghead">
              <span className="up-baynum">{b.number}</span>
              <div>
                <b>Bay {b.number}</b>
                <span className="up-base">Now: {b.ability}</span>
              </div>
            </div>
            {list.length ? roots(list).map(chain) : <p className="up-none">No upgrades for this Bay.</p>}
          </div>
        );
      })}
      {!ups.some((u) => groupOf(u) === "flagship") && <p className="up-none">{co.name}'s sheet has no Flagship upgrades.</p>}
    </section>
  );
  const mechaIds = [...new Set(ups.filter((u) => groupOf(u) === "mecha").flatMap((u) => u.appliesTo))];
  const mechaSection = (
    <section className="up-sec g-mecha" style={{ "--up": COLOUR.mecha } as React.CSSProperties} key="mecha">
      <SectionHead group="mecha" n={ups.filter((u) => groupOf(u) === "mecha" && markable.has(u.id)).length} hide={compact} />
      {mechaIds.map((m) => {
        const list = ups.filter((u) => groupOf(u) === "mecha" && u.appliesTo.includes(m));
        const d = data.units.byId.get(m);
        const count = co.startingMecha.find((x) => x.id === m)?.count;
        const isLit = lit !== undefined && list.some((u) => u.id === lit.id);
        return (
          <div className="up-group" key={m}>
            <div className="up-ghead">
              <MechaBadge id={m} level={d?.level} lit={isLit} />
              <div>
                <b>{m === "all_mecha" ? "Every Mecha" : m}</b>
                {d && <span className="up-sub">Level {d.level}{count ? ` · ${count} in your deck` : ""}</span>}
                {d?.text.ability && <span className="up-base">Now: {d.text.ability}</span>}
                {m === "all_mecha" && <span className="up-base">Every Mecha you Command gains this ability.</span>}
              </div>
            </div>
            {roots(list).map(chain)}
          </div>
        );
      })}
    </section>
  );
  const reqList = ups.filter((u) => groupOf(u) === "req");
  const reqSection = (
    <section className="up-sec g-req" style={{ "--up": COLOUR.req } as React.CSSProperties} key="req">
      <SectionHead group="req" n={reqList.filter((u) => markable.has(u.id)).length} hide={compact} />
      <p className="up-base">One-time rewards: when one fills, you gain it at once. Repeatable ones empty again so you can fill them again.</p>
      <div className="up-req-grid">{reqList.map(card)}</div>
    </section>
  );
  const sections: Record<Group, React.ReactNode> = { flagship: flagshipSection, mecha: mechaSection, req: reqSection };
  const markableIn = (g: Group) => ups.filter((u) => groupOf(u) === g && markable.has(u.id)).length;

  return (
    <div className={`upsheet ${compact ? "compact" : "wide"} ${drag ? "dragging" : ""}`} ref={rootRef} data-points={points}>
      <div className="up-bg" aria-hidden />
      <header className="up-head">
        <div className="up-title">
          <small>Mission End · Upgrades (10.2)</small>
          <h2>{co.name}</h2>
        </div>
        <div className="up-pool" ref={poolRef} aria-label={`${points} Upgrade points`}>
          <div className="up-tokens">
            {Array.from({ length: Math.min(points, compact ? 1 : 12) }, (_, i) => (
              <span key={i} className="up-token" onPointerDown={startDrag} style={{ animationDelay: `${i * 0.09}s` }}>
                <UpgradeGlyph />
              </span>
            ))}
            {!compact && points > 12 && <span className="up-more">+{points - 12}</span>}
          </div>
          <div className="up-count">
            <b>{points}</b> point{points === 1 ? "" : "s"}
          </div>
        </div>
      </header>
      {compact && (
        <nav className="up-tabs" role="tablist">
          {groups.map((g) => (
            <button key={g} role="tab" aria-selected={tab === g} className={`g-${g} ${tab === g ? "on" : ""}`} style={{ "--up": COLOUR[g] } as React.CSSProperties} onClick={() => setTab(g)}>
              {TITLE[g]}
              {markableIn(g) > 0 && <span className="up-badge">{markableIn(g)}</span>}
            </button>
          ))}
        </nav>
      )}
      <div className="up-body">{compact ? sections[tab] : groups.map((g) => sections[g])}</div>
      <footer className="up-foot">
        <span className="up-hint">
          {upQ
            ? compact
              ? "Tap an upgrade to read it, then mark a slot. Unspent points are lost."
              : "Tap an upgrade to mark its next slot, or drag a point onto it. Unspent points are lost."
            : points > 0
              ? "No upgrade can take another point."
              : "All points spent."}
        </span>
        {upQ ? (
          <button className="up-done" onClick={() => p.onAnswer({ kind: "option", value: "done" })}>
            Done
          </button>
        ) : !confirm ? (
          <button className="primary up-done" onClick={p.onContinue}>
            Continue
          </button>
        ) : null}
      </footer>
      <canvas className="up-fx" ref={canvasRef} aria-hidden />
      {drag && (
        <span className="up-token up-ghost" style={{ left: drag.x, top: drag.y }}>
          <UpgradeGlyph />
        </span>
      )}
      {celebrate && (
        <div className={`up-online g-${celebrate.group}`} key={celebrate.at} style={{ "--up": COLOUR[celebrate.group] } as React.CSSProperties} role="status">
          <span className="up-online-title">{celebrate.title}</span>
          <span className="up-online-id">{celebrate.id}</span>
          <span className="up-online-text">{celebrate.text}</span>
        </div>
      )}
      {confirm && (
        <div className="up-confirm-wrap">
          <div className="up-confirm" role="dialog">
            <p>{confirm.prompt}</p>
            <div className="row">
              <button onClick={() => p.onAnswer({ kind: "yesno", value: false })}>Keep spending</button>
              <button className="danger" onClick={() => p.onAnswer({ kind: "yesno", value: true })}>
                Finish and lose {points}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** What filling an upgrade opens up, in plain words (from unlocks / unlock_mode). */
function unlockLine(u: UpgradeDef, ups: UpgradeDef[]): string | undefined {
  const kids = ups.filter((x) => x.unlockedBy === u.id).map((x) => x.id);
  if (!kids.length) return undefined;
  if (u.unlockMode === "choose_one" && kids.length > 1) return `Filling it unlocks a choice: ${kids.join(" or ")}. Once you mark one of them, the other is gone for good.`;
  return `Filling it unlocks ${kids.join(" and ")}.`;
}

function SectionHead({ group, n, hide }: { group: Group; n: number; hide: boolean }) {
  if (hide) return null;
  return (
    <h3 className="up-sec-head">
      <span>{TITLE[group]}</span>
      {n > 0 && <span className="up-badge">{n} can take a point</span>}
    </h3>
  );
}

function safeModuleName(data: GameData, state: GameState, id: number): string {
  try {
    return `Module: ${moduleDef({ data, state }, id).name}`;
  } catch {
    return "a new Module";
  }
}

function centre(el: Element | null | undefined): { x: number; y: number } | undefined {
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return undefined;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function bump(el: Element | null | undefined, cls: string): void {
  if (!(el instanceof HTMLElement)) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), 1600);
}

/** An Upgrade point flies along an arc, with a glowing trail. */
function flyPoint(a: { x: number; y: number } | undefined, b: { x: number; y: number } | undefined, colour: string, onArrive: () => void, back = false): void {
  if (!a || !b || still()) return onArrive();
  const dot = document.createElement("div");
  dot.className = "up-fly";
  dot.style.setProperty("--up", colour);
  dot.innerHTML = '<svg viewBox="0 0 20 20"><path d="M10 2 18 9.5 15.5 12 10 7 4.5 12 2 9.5z"/><path d="M10 8.5 18 16 15.5 18.5 10 13.5 4.5 18.5 2 16z" opacity="0.65"/></svg>';
  document.body.appendChild(dot);
  const lift = Math.min(160, Math.hypot(b.x - a.x, b.y - a.y) * 0.35);
  const frames: Keyframe[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    const x = a.x + (b.x - a.x) * e;
    const y = a.y + (b.y - a.y) * e - Math.sin(Math.PI * e) * lift;
    frames.push({ transform: `translate(${x - 13}px, ${y - 13}px) rotate(${e * 360}deg) scale(${back ? 1 - 0.5 * t : 1 + 0.45 * Math.sin(Math.PI * t) - 0.35 * t})`, opacity: back ? 1 - t * 0.8 : 1 });
  }
  const anim = dot.animate(frames, { duration: back ? 380 : 560, easing: "linear", fill: "both" });
  // A short trail of fading copies.
  for (let k = 1; k <= 4; k++) {
    const ghost = dot.cloneNode(true) as HTMLElement;
    ghost.classList.add("trail");
    ghost.style.opacity = String(0.45 - k * 0.09);
    document.body.appendChild(ghost);
    const ga = ghost.animate(frames, { duration: back ? 380 : 560, delay: k * 28, easing: "linear", fill: "both" });
    ga.onfinish = () => ghost.remove();
  }
  anim.onfinish = () => {
    dot.remove();
    onArrive();
  };
}

function LockIcon() {
  return (
    <svg className="up-lock" viewBox="0 0 16 16" aria-hidden>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" />
    </svg>
  );
}

/** A Mecha's badge: a hexagon with "M" and its Level (placeholder until the unit glyphs, spec "Art"). */
function MechaBadge({ id, level, lit }: { id: string; level: number | string | undefined; lit: boolean }) {
  return (
    <svg className={`up-mbadge ${lit ? "is-lit" : ""}`} viewBox="0 0 44 44" aria-hidden>
      <polygon points="22,2 40,12 40,32 22,42 4,32 4,12" />
      <polygon className="inner" points="22,7 36,15 36,29 22,37 8,29 8,15" />
      <text x="22" y="27" textAnchor="middle">
        {id === "all_mecha" ? "ALL" : "M"}
      </text>
      {level !== undefined && (
        <text className="lvl" x="22" y="38" textAnchor="middle">
          L{level}
        </text>
      )}
    </svg>
  );
}

/**
 * The Flagship (placeholder art; the designer's picture goes here later, spec "Art"): a hologram
 * of the ship seen from above, its Bays numbered on the hull with their health. A Bay lights up
 * while one of its upgrades is under the pointer, and flares when one fills.
 */
function FlagshipArt({ bays, count, hover, lit, name, compact }: { bays: { n: number; hp: number; max: number }[]; count: number; hover: number | undefined; lit: number | undefined; name: string; compact: boolean }) {
  // Hardpoints along the hull (3 or 5 Bays).
  const spots = count <= 3 ? [[300, 80], [200, 46], [200, 114]] : [[318, 80], [236, 48], [236, 112], [150, 40], [150, 120]];
  return (
    <figure className={`up-ship ${compact ? "compact" : ""}`} aria-label={`${name}: placeholder picture of the Flagship and its Bays`}>
      <svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="upgrid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0V16" fill="none" stroke="rgba(56,217,255,0.10)" strokeWidth="1" />
          </pattern>
          <linearGradient id="uphull" x1="0" x2="1">
            <stop offset="0" stopColor="rgba(56,217,255,0.05)" />
            <stop offset="1" stopColor="rgba(56,217,255,0.22)" />
          </linearGradient>
        </defs>
        <rect width="400" height="160" fill="url(#upgrid)" />
        {/* Engine glow. */}
        <ellipse className="up-engine" cx="58" cy="62" rx="22" ry="7" />
        <ellipse className="up-engine" cx="58" cy="98" rx="22" ry="7" />
        {/* Hull. */}
        <path className="up-hull" d="M70 50 L150 26 L270 36 L372 80 L270 124 L150 134 L70 110 L84 92 L84 68 Z" fill="url(#uphull)" />
        <path className="up-hull-line" d="M100 80 H350 M150 26 L182 80 L150 134 M270 36 L240 80 L270 124" />
        <rect className="up-hull-line" x="64" y="54" width="28" height="16" rx="3" />
        <rect className="up-hull-line" x="64" y="90" width="28" height="16" rx="3" />
        {/* Bays. */}
        {bays.slice(0, spots.length).map((b, i) => {
          const [x, y] = spots[i]!;
          const on = hover === b.n || lit === b.n;
          return (
            <g key={b.n} className={`up-hard ${on ? "on" : ""} ${lit === b.n ? "flare" : ""} ${b.hp === 0 ? "out" : ""}`} transform={`translate(${x} ${y})`}>
              <circle className="ring" r="15" />
              <circle className="core" r="10" />
              <text y="4" textAnchor="middle">
                {b.n}
              </text>
              <g transform="translate(-14 19)">
                {Array.from({ length: b.max }, (_, k) => (
                  <rect key={k} x={k * (28 / b.max)} y="0" width={28 / b.max - 1.5} height="3" className={k < b.hp ? "hp on" : "hp"} />
                ))}
              </g>
            </g>
          );
        })}
        <rect className="up-scan" x="0" y="0" width="40" height="160" />
      </svg>
      {!compact && <figcaption>Placeholder art · the Flagship picture goes here</figcaption>}
    </figure>
  );
}
