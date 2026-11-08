/**
 * The Mission bar (designer 2026-11-08): at the right end of the Anomaly row,
 * always in the same place, the same height as an Anomaly bubble. It fills as
 * the objective's Trophies come in (8.2): Salvage = 5 Power Nodes and 3
 * Cleared sectors, Eliminate = the named Omega units. A new one pops into its
 * cell (and a tile flies there from the Field, flyers.ts). Pressing it shows
 * the full objective and the whole Trophy pile.
 */

import { useEffect, useRef, useState } from "react";
import { type Ctx, sectorKeys, sectorState } from "../engine/field.js";
import { type Anchor, PopCard, anchorOf } from "./PopCard.js";
import { UnitGlyph } from "./Anomalies.js";

interface Group {
  key: string;
  label: string;
  glyph: "node" | "cleared" | "omega";
  have: number;
  need: number;
  /** Tiles of this unit still on the Field, face up or face down (designer 2026-11-08); the deck's make-up is known. */
  left?: number;
}

export function missionGroups(c: Ctx): { type: "salvage" | "eliminate"; groups: Group[]; target?: string } {
  const camp = c.data.campaigns.find((x) => x.prefix === c.state.campaign);
  const m = camp?.missionById.get(c.state.mission);
  const trophy = c.state.piles.trophy.map((id) => c.state.tiles[id]!.unitId);
  const onField = (u: string) => Object.values(c.state.field).reduce((n, st) => n + st.filter((t) => c.state.tiles[t]?.unitId === u).length, 0);
  if (!m || m.objective.type === "salvage") {
    const cleared = sectorKeys(c.state).filter((k) => sectorState(c.state, k) === "cleared").length;
    return {
      type: "salvage",
      groups: [
        { key: "nodes", label: "Power Nodes", glyph: "node", have: trophy.filter((u) => u === "F_01").length, need: 5, left: onField("F_01") },
        { key: "cleared", label: "Cleared sectors", glyph: "cleared", have: cleared, need: 3 },
      ],
    };
  }
  const o = m.objective;
  const role = c.data.units.byId.get(o.target)?.role ?? o.target;
  return { type: "eliminate", target: o.target, groups: [{ key: "omega", label: `${role}s`, glyph: "omega", have: trophy.filter((u) => u === o.target).length, need: o.count, left: onField(o.target) }] };
}

function Glyph({ g }: { g: Group["glyph"] }) {
  if (g === "cleared") return <UnitGlyph type="Cleared sector" />;
  return <span className={`ug t-${g}`}>{g === "node" ? "N" : "Ω"}</span>;
}

const roleOf = (c: Ctx, u: string) => (u === "F_01" ? "Power Node" : (c.data.units.byId.get(u)?.role ?? u));

export function MissionBar({ c, phase }: { c: Ctx; phase: string }) {
  const { type, groups, target } = missionGroups(c);
  const [open, setOpen] = useState<Anchor | undefined>();
  // A Trophy that just came in pops into its cell.
  const prev = useRef<Record<string, number>>({});
  const [fresh, setFresh] = useState<Record<string, [number, number]>>({});
  const sig = groups.map((g) => `${g.key}:${g.have}`).join(",");
  useEffect(() => {
    const next: Record<string, [number, number]> = {};
    for (const g of groups) {
      const was = prev.current[g.key];
      if (was !== undefined && g.have > was) next[g.key] = [was, g.have];
      prev.current[g.key] = g.have;
    }
    if (Object.keys(next).length === 0) return;
    setFresh(next);
    const t = window.setTimeout(() => setFresh({}), 1600);
    return () => window.clearTimeout(t);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = groups.every((g) => g.have >= g.need);
  const label = `${type === "salvage" ? "Salvage" : "Eliminate"}: ${groups.map((g) => `${g.label} ${g.have}/${g.need}`).join(", ")}`;
  // The whole Trophy pile, by unit.
  const pile = new Map<string, number>();
  for (const t of c.state.piles.trophy) {
    const u = c.state.tiles[t]!.unitId!;
    pile.set(u, (pile.get(u) ?? 0) + 1);
  }
  return (
    <>
      <button className={`mission-bar ${done ? "done" : ""} ${Object.keys(fresh).length ? "gain" : ""}`} data-mission-bar aria-label={`${label}. Press for the objective and the Trophy pile.`} title={label} aria-expanded={open !== undefined} onClick={(e) => setOpen(open ? undefined : anchorOf(e.currentTarget))}>
        <TrophyGlyph />
        {groups.map((g) => (
          <span key={g.key} className={`m-group g-${g.glyph}`} data-mission-group={g.key}>
            {Array.from({ length: Math.max(g.need, g.have) }, (_, i) => {
              const f = fresh[g.key];
              const isNew = f !== undefined && i >= f[0] && i < f[1];
              return <i key={i} className={`m-cell ${i < g.have ? "on" : ""} ${i >= g.need ? "over" : ""} ${isNew ? "new" : ""}`} style={isNew ? { animationDelay: `${(i - f![0]) * 120 + 350}ms` } : undefined} />;
            })}
          </span>
        ))}
      </button>
      {open && (
        <PopCard at={open} label="Mission objective" className="mission-card" keepFor="[data-mission-bar]" onClose={() => setOpen(undefined)}>
          <b>
            Mission {c.state.mission} · {phase}
          </b>
          <p>
            {type === "salvage" ? (
              <>
                <b>Salvage:</b> at least 5 Power Nodes in your Trophy pile and at least 3 Cleared sectors on the Field.
              </>
            ) : (
              <>
                <b>Eliminate:</b> at least {groups[0]!.need} {groups[0]!.label} ({target}) in your Trophy pile.
              </>
            )}
          </p>
          {groups.map((g) => (
            <p key={g.key} className="m-line">
              <Glyph g={g.glyph} /> {g.label}: <b>{g.have}</b> of {g.need}
              {g.have >= g.need ? " ✓" : ""}
              {g.left !== undefined && <span className="m-left"> · {g.left} still on the Field</span>}
            </p>
          ))}
          <p className="small">It is checked before each Command phase action; once it is met, the mission is won (8.2).</p>
          <h4>Trophy pile</h4>
          {pile.size === 0 ? (
            <p className="small">Empty.</p>
          ) : (
            <ul className="trophy-list">
              {[...pile].map(([u, n]) => (
                <li key={u}>
                  <Glyph g={u === "F_01" ? "node" : "omega"} /> <b>{n}×</b> {roleOf(c, u)} <span className="small">({u})</span>
                </li>
              ))}
            </ul>
          )}
          {type === "salvage" && <p className="small">Each Power Node gives 1 Upgrade point at Mission End (10.1).</p>}
        </PopCard>
      )}
    </>
  );
}

export function TrophyGlyph() {
  return (
    <svg className="trophy-glyph" viewBox="0 0 20 20" aria-hidden>
      <path d="M5 2h10v2h3v2a4 4 0 0 1-4 4h-.3A5 5 0 0 1 11 12.9V15h3v3H6v-3h3v-2.1A5 5 0 0 1 6.3 10H6a4 4 0 0 1-4-4V4h3zm-1 4a2 2 0 0 0 1 1.7V6zm12 0v1.7A2 2 0 0 0 17 6z" />
    </svg>
  );
}
