/**
 * Questions that choose units, answered on the units themselves (designer 2026-11-09): no banner
 * ("P_15: deal 1 damage to which Gyro?"). A bubble sits on each unit that can be chosen and says
 * what happens to it ("1 damage", "Boost", "Swap" ...) and where it comes from; pressing it chooses
 * that unit. Bubbles spring in one after another, have the running outline and the slow amber
 * breathing of things ready to use, and shrink away before the answer is sent. When several units
 * are chosen, a press selects (green, ✓) and a Confirm bubble at the foot of the Field sends them;
 * a choice that may be left out has a Skip bubble there.
 */

import { useLayoutEffect, useState } from "react";

export type PickTone = "damage" | "boost" | "plain";

export interface PickItem {
  id: string;
  /** What happens to it, short ("1 damage"). */
  label: string;
  /** Where it comes from ("P_15"), small. */
  sub?: string | undefined;
  tone: PickTone;
  selected?: boolean;
  /** Damage split among units: how much is on it already. */
  count?: number;
  disabled?: boolean;
  /** Pressing it opens the unit's pop-up (several answers on it): no shrinking away. */
  menu?: boolean;
}

export interface PickFoot {
  id: string;
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/** What a question does to the unit chosen, in a few words, from its prompt. */
export function verbOf(prompt: string): { label: string; tone: PickTone } {
  const p = prompt.replace(/^[^:]*: /, "");
  const dmg = /(\d+|X) damage/i.exec(p);
  if (/remove (1 )?damage|repair/i.test(p)) return { label: "Repair", tone: "boost" };
  if (dmg) return { label: `${dmg[1]} damage`, tone: "damage" };
  if (/\bdestroy/i.test(p)) return { label: "Destroy", tone: "damage" };
  if (/\bdiscard/i.test(p)) return { label: "Discard", tone: "damage" };
  if (/Attack/.test(p)) return { label: "Attack", tone: "damage" };
  if (/Bio-shield/i.test(p)) return { label: "Bio-shield", tone: "boost" };
  if (/\bboost|Shield token/i.test(p)) return { label: "Boost", tone: "boost" };
  if (/remove the Barrier/i.test(p)) return { label: "Remove Barrier", tone: "plain" };
  if (/remove the Alert/i.test(p)) return { label: "Remove Alert", tone: "plain" };
  if (/\bswap/i.test(p)) return { label: "Swap", tone: "plain" };
  if (/teleport/i.test(p)) return { label: "Teleport", tone: "plain" };
  if (/\bmove\b/i.test(p)) return { label: "Move", tone: "plain" };
  if (/\bTick\b/.test(p)) return { label: "Tick", tone: "damage" };
  if (/bottom/i.test(p)) return { label: "To the bottom", tone: "plain" };
  if (/Alert do you resolve/i.test(p)) return { label: "Resolve", tone: "plain" };
  if (/Fuse token goes off/i.test(p)) return { label: "Goes off", tone: "damage" };
  // Sectors (designer 2026-11-10: sector questions are answered on bubbles too).
  if (/\bReveal\b/.test(p)) return { label: "Reveal", tone: "plain" };
  if (/\blook at\b/i.test(p)) return { label: "Look", tone: "plain" };
  if (/\bJump\b/i.test(p)) return { label: "Jump here", tone: "plain" };
  if (/\btake (the top tile|tiles)\b/i.test(p)) return { label: "Take", tone: "plain" };
  if (/\b(put|place) them\b/i.test(p) || /^place \S+ on which/i.test(p)) return { label: "Put here", tone: "plain" };
  if (/make which .*ready/i.test(p)) return { label: "Make ready", tone: "boost" };
  return { label: "Choose", tone: "plain" };
}

/** The source of a question, for the small line ("P_15", "Heat Wave"); none for core steps. */
export function sourceOf(prompt: string, rule: string): string | undefined {
  const head = /^([^:]{2,28}): /.exec(prompt)?.[1];
  if (head && !/ (is|are|do|does) /.test(head)) return head;
  return /^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/.test(rule) ? rule : undefined;
}

interface Spot {
  id: string;
  x: number;
  y: number;
  w: number;
  /** Small tiles (phones): one line, smaller. */
  compact: boolean;
}

export function UnitPicks(p: { items: PickItem[]; foot: PickFoot[]; onPress: (id: string) => void; multi: boolean }) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [leaving, setLeaving] = useState<string | undefined>();
  const ids = p.items.map((i) => i.id).join(",");
  useLayoutEffect(() => {
    const place = () => {
      const field = document.querySelector<HTMLElement>(".field");
      if (!field) return;
      const r = field.getBoundingClientRect();
      const tile = Number(field.dataset.tile ?? 80);
      const sectors: Record<string, [number, number]> = JSON.parse(field.dataset.sectors ?? "{}");
      const hits: { k: string; id: string; x: number; y: number }[] = JSON.parse(field.dataset.choosable ?? "[]");
      const next: Spot[] = [];
      for (const it of p.items) {
        const h = hits.find((x) => x.id === it.id);
        const at = h ? [h.x, h.y] : sectors[it.id];
        if (!at) continue;
        // On the lower half of the tile: the unit's name and Strength stay in sight.
        const compact = tile < 120;
        next.push({ id: it.id, x: r.left + at[0]!, y: r.top + at[1]! + tile * (compact ? 0.25 : 0.19), w: compact ? Math.max(54, tile * 0.78) : Math.max(78, tile * 0.74), compact });
      }
      setSpots((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    place();
    const timer = window.setInterval(place, 250);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [ids]);
  const press = (id: string) => {
    if (leaving) return;
    if (p.multi || p.items.find((x) => x.id === id)?.menu) return p.onPress(id);
    // One choice: the bubbles shrink away, then the answer goes (as the unit pop-ups do).
    setLeaving(id);
    window.setTimeout(() => {
      setLeaving(undefined);
      p.onPress(id);
    }, 170);
  };
  return (
    <>
      <div className={`unit-picks ${leaving ? "leaving" : ""}`}>
        {spots.map((s, i) => {
          const it = p.items.find((x) => x.id === s.id)!;
          return (
            <button
              key={s.id}
              className={`unit-pick ${it.tone} ${s.compact ? "compact" : ""} ${it.selected ? "selected" : ""} ${leaving === s.id ? "chosen" : ""}`}
              data-pick={s.id}
              disabled={it.disabled}
              style={{ left: s.x, top: s.y, width: s.w, animationDelay: `${i * 45}ms, ${i * 45 + 300}ms` }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                press(s.id);
              }}
              aria-label={`${it.label}${it.sub ? ` (${it.sub})` : ""}: ${s.id}`}
            >
              <svg aria-hidden="true" width="100%" height="100%">
                <rect x="1.5" y="1.5" pathLength={100} />
              </svg>
              <b>{it.selected ? `✓ ${it.label}` : it.label}</b>
              {it.sub && !s.compact && <small>{it.sub}</small>}
              {it.count ? <span className="taken">{it.count}</span> : null}
            </button>
          );
        })}
      </div>
      {p.foot.length > 0 && (
        <div className="pick-foot">
          {p.foot.map((f) => (
            <button key={f.id} className={`bubble ${f.primary ? "primary" : ""}`} disabled={f.disabled} onClick={f.onPress}>
              {f.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
