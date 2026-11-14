/**
 * The Threat screen: shown at every Mission Preparation when the game asks which Threat columns
 * to play (Core Rules 7.2 step 3; 1 Patrol, 2 Assault, 3 Siege, 4 Annihilation). The four columns
 * stand side by side with their units as tiles; a tap on a unit opens its card, the button under
 * a column adds or removes it. Every column added answers with a particle effect that grows more
 * menacing with the Threat Level. It only answers the engine's question; no rule lives here.
 */

import { useEffect, useRef, useState } from "react";
import { Check, Flame, Minus, Plus, Shield, Skull, Swords } from "lucide-react";
import type { ThreatColumn } from "../../data/campaign.js";
import type { GameData } from "../../data/index.js";
import type { Question } from "../../engine/questions.js";
import type { GameState } from "../../engine/state.js";
import { AmbientLayer, FxLayer, ambientKick } from "./fx.js";
import { hoverHook, ms, tapSpark } from "./hud.js";
import { missionLabel, objectiveText } from "./missionText.js";
import { burst, ring, setEmitter } from "./particles.js";
import { playConfirm, playOpenInfo, playThreatDown, playThreatUp } from "./soundHooks.js";
import { THREAT_NAMES, THREAT_RGB } from "./types.js";
import { UnitCard } from "./UnitCard.js";
import { levelOf } from "./unitFacts.js";
import { UnitTile } from "./UnitTile.js";

const ICON = [Shield, Shield, Swords, Flame, Skull];

/** The answer to a column added: sparks at Level 1, up to a firestorm at Level 4. */
function menace(el: Element, level: number): void {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const rgb = THREAT_RGB[level]!;
  burst(x, y, { count: 14 + level * 22, rgb, speed: 160 + level * 110, life: 0.5 + level * 0.12, size: 2 + level * 0.5, shape: level >= 3 ? "streak" : "spark", box: [r.width * 0.6, r.height * 0.4] });
  ring(x, y, rgb, 300 + level * 160, 0.5, 20);
  if (level >= 2) burst(x, r.bottom, { count: level * 9, rgb, speed: 90, angle: -Math.PI / 2, spread: 1.6, life: 1.2, size: 2.6, shape: "ember", grav: -90, drag: 0.5, box: [r.width, 4] });
  if (level >= 3) {
    setTimeout(() => ring(x, y, "255 255 255", 700, 0.45, 30), 90);
    burst(innerWidth / 2, innerHeight, { count: level === 4 ? 90 : 36, rgb, speed: 220, angle: -Math.PI / 2, spread: 1.2, life: 1.8, size: 3, shape: "ember", grav: -140, drag: 0.55, box: [innerWidth, 10] });
  }
  if (level >= 4) {
    setTimeout(() => ring(x, y, rgb, 1100, 0.7, 40), 180);
    setTimeout(() => burst(x, y, { count: 70, rgb: "255 240 240", speed: 760, life: 0.55, size: 3.4, shape: "streak" }), 120);
    burst(innerWidth / 2, 0, { count: 40, rgb, speed: 160, angle: Math.PI / 2, spread: 1, life: 1.4, size: 2.8, shape: "ember", grav: 120, drag: 0.6, box: [innerWidth, 10] });
  }
}

export function ThreatScreen({ data, state, q, onAnswer }: { data: GameData; state: GameState; q: Question & { kind: "several" }; onAnswer: (cols: string[]) => void }) {
  const camp = data.campaigns.find((c) => c.prefix === state.campaign);
  const m = camp?.missionById.get(state.mission ?? "");
  const [cols, setCols] = useState<string[]>([]);
  const [open, setOpen] = useState<{ id: string; list: string[] } | undefined>();
  const [pulse, setPulse] = useState(0);
  const [sent, setSent] = useState(false);
  const panels = useRef(new Map<string, HTMLElement>());
  const body = useRef<HTMLDivElement>(null);
  const level = cols.length;
  const acc = THREAT_RGB[level]!;
  const ok = level >= q.min && level <= q.max && !sent;
  const Icon = ICON[level]!;

  // Embers keep rising from every column in play, thicker as the Level rises.
  useEffect(() => {
    for (const o of q.options) setEmitter(`threat-${o.id}`, cols.includes(o.id) ? panels.current.get(o.id) : null, "menace", acc, level <= 1 ? 3 : level * level * 1.6);
    return () => q.options.forEach((o) => setEmitter(`threat-${o.id}`, null));
  }, [cols.join(), acc]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(id: string): void {
    if (sent) return;
    const on = cols.includes(id);
    if (!on && cols.length >= q.max) return;
    const next = on ? cols.filter((c) => c !== id) : [...cols, id].sort();
    setCols(next);
    const el = panels.current.get(id);
    if (on) {
      playThreatDown(next.length);
      if (el) burst(el.getBoundingClientRect().left + el.clientWidth / 2, el.getBoundingClientRect().bottom - 30, { count: 12, rgb: "203 213 225", speed: 70, angle: Math.PI / 2, spread: 1.4, life: 0.6, grav: 160 });
    } else {
      playThreatUp(next.length);
      if (el) menace(el, next.length);
      setPulse((n) => n + 1);
      // Levels 3 and 4 shake the screen: the class is put on again by hand so the shake restarts.
      const b = body.current;
      if (b) {
        b.classList.remove("bf-shake-3", "bf-shake-4");
        void b.offsetWidth;
        if (next.length >= 3) b.classList.add(`bf-shake-${next.length}`);
      }
    }
  }
  function confirm(): void {
    if (!ok) return;
    playConfirm();
    setSent(true);
    ambientKick(1);
    ring(innerWidth / 2, innerHeight / 2, acc, 1200, 0.4, 40);
    setTimeout(() => onAnswer(cols), ms(260));
  }

  if (!camp || !m) return null;
  const unitOf = (id: string) => data.units.byId.get(id);
  // What the mission deck holds whatever the Threat (Core Rules 7.1 step 5, 7.2): all Bots, the deployment list.
  const always = m.deploymentShuffled.filter((x) => unitOf(x.id));
  const energy = m.deploymentShuffled.find((x) => x.id === data.units.energyDeckPlaceholder)?.count ?? 0;

  return (
    <div className="brief bf-ingame flex flex-col" style={{ "--acc": acc } as React.CSSProperties} data-threat-screen={m.id} data-level={level} onPointerOver={hoverHook} onPointerDown={tapSpark}>
      <AmbientLayer rgb={acc} />
      <FxLayer />
      {pulse > 0 && level > 0 && <div key={pulse} className="bf-menace" style={{ "--lv": level } as React.CSSProperties} />}

      <div ref={body} className="bf-scroll relative z-10 flex-1 px-3 py-3 sm:px-6 sm:py-4">
        <div className="bf-step-in mx-auto max-w-[1320px]">
          <header className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <div className="bf-label">{missionLabel(m)} · preparation</div>
              <h2 className="bf-glow text-2xl font-extrabold uppercase tracking-[0.08em] text-white sm:text-3xl">Choose the Threat</h2>
              <p className="mt-0.5 max-w-2xl text-[15px] text-sky-100">Each Threat column adds its units to this mission's deck, and each one you complete scores 1 point. Play 1 to 4 of them.</p>
              <p className="mt-1 text-[14px] text-white">
                <b className="text-acc">Objective</b> {objectiveText(camp, m)} · {m.mapSectorCount} sectors
              </p>
            </div>
            <div className="bf-panel bf-sel min-w-[230px] px-4 py-2.5" aria-live="polite" data-threat-level={level}>
              <div className="flex items-center gap-3">
                <Icon size={34} className="text-acc" />
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-sky-100">Threat Level</div>
                  <div className="text-2xl font-extrabold leading-tight text-white">{level ? `${level} · ${THREAT_NAMES[level]}` : "Not chosen"}</div>
                </div>
              </div>
              <div className="bf-gauge mt-2 flex h-3 gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <i key={n} className={n <= level ? "on" : ""} style={{ "--c": THREAT_RGB[n] } as React.CSSProperties} />
                ))}
              </div>
              <div className="mt-1 text-[13px] text-sky-50">{level ? `Up to +${level} point${level === 1 ? "" : "s"}` : "Add at least one column"}</div>
            </div>
          </header>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {q.options.map((o) => {
              const on = cols.includes(o.id);
              const ids = m.threat[o.id as ThreatColumn] ?? [];
              const list = [...new Set(ids)];
              return (
                <section
                  key={o.id}
                  ref={(el) => void (el ? panels.current.set(o.id, el) : panels.current.delete(o.id))}
                  className={`bf-panel flex flex-col p-3 ${on ? "bf-sel bf-col-on" : ""}`}
                  data-col={o.id}
                  data-on={on ? "1" : "0"}
                  aria-label={`Threat column ${o.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`grid h-11 w-10 place-items-center text-xl font-extrabold ${on ? "bg-acc text-indigo-950" : "bg-white/25 text-white"}`} style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }}>
                        {o.id}
                      </span>
                      <span className="text-lg font-extrabold uppercase tracking-wider text-white">Threat {o.id}</span>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-extrabold uppercase tracking-wider ${on ? "bg-acc text-indigo-950" : "bg-white/15 text-sky-100"}`}>{on ? "In play" : `${ids.length} units`}</span>
                  </div>
                  <div className="my-2 flex flex-1 flex-wrap content-start items-start justify-around gap-x-1 gap-y-1">
                    {ids.map((id, k) => {
                      const u = unitOf(id);
                      if (!u) return null;
                      return (
                        <button key={k} type="button" className="bf-unit" data-unit={id} onClick={() => (playOpenInfo(), setOpen({ id, list }))} aria-label={`${u.type} ${id}: open its card`}>
                          <UnitTile unit={u} level={levelOf(u, camp)} size={84} />
                          <b>{id}</b>
                          <span className="text-[12px] font-semibold text-sky-100">{u.type}</span>
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" className={`bf-btn w-full ${on ? "" : "bf-primary"}`} aria-pressed={on} data-col-btn={o.id} disabled={sent || (!on && level >= q.max)} onClick={() => toggle(o.id)}>
                    {on ? <Minus size={18} /> : <Plus size={18} />} {on ? "Remove" : "Add this Threat"}
                  </button>
                </section>
              );
            })}
          </div>

          <section className="bf-panel mt-3 p-3" aria-label="Always in this mission's deck">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <div className="bf-label">Always in this mission's deck</div>
              <span className="text-[13px] text-sky-100">Whatever the Threat. Also all 30 Bots{energy ? ` and ${energy} tiles from the Energy deck` : ""}.</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {[...m.omegaPlaced.map((id) => ({ id, count: m.omegaSectors.length })), ...always].map((x) => {
                const u = unitOf(x.id)!;
                return (
                  <button key={x.id} type="button" className="bf-unit" data-unit={x.id} onClick={() => (playOpenInfo(), setOpen({ id: x.id, list: [...m.omegaPlaced, ...always.map((a) => a.id)] }))} aria-label={`${u.type} ${x.id}, ${x.count}: open its card`}>
                    <UnitTile unit={u} level={levelOf(u, camp)} size={58} count={x.count} />
                    <b>{x.id}</b>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <footer className="relative z-10 flex items-center gap-3 border-t border-white/20 bg-indigo-950/40 px-3 py-2.5 sm:px-5">
        <div className="min-w-0 flex-1 text-[14px] text-sky-100">
          {level ? (
            <span>
              Columns <b className="text-white">{cols.join(", ")}</b> <span className="hidden sm:inline">· {THREAT_NAMES[level]}</span>
            </span>
          ) : (
            <span className="font-semibold text-amber-200">Add 1 to 4 Threat columns</span>
          )}
        </div>
        <button type="button" className="bf-btn bf-primary" disabled={!ok} onClick={confirm} data-action="threat">
          <Check size={18} /> Confirm Threat<span className="hidden sm:inline"> · begin mission</span>
        </button>
      </footer>

      {open && <UnitCard data={data} id={open.id} campaign={camp} list={open.list} onPick={(id) => setOpen({ ...open, id })} onClose={() => setOpen(undefined)} />}
    </div>
  );
}
