/**
 * An effect in the Campaign editor (designer 2026-11-18, C3): made from blocks (steps in the card
 * text's own words, shown as the text they make) or written as text, which needs programming
 * before the game can play it. Screen only.
 */

import { Plus, Trash2 } from "lucide-react";
import { COLOURS, effectText, KINDS, newStep, TOKENS, VERBS, type Count, type EffectDraft, type EffectPlace, type Kind, type Step, type Target, type Where } from "./model.js";

export const INP = "rounded-md border border-white/45 bg-indigo-950/60 px-2 py-1.5 text-[14px] text-white";
const SEL = `${INP} max-w-full`;
const txt = { userSelect: "text" } as const;

const COUNTS: { v: Count; label: string; omega?: boolean }[] = [
  { v: "this", label: "this unit", omega: true },
  { v: "one", label: "one" },
  { v: "all", label: "all" },
  { v: 2, label: "two different" },
  { v: 3, label: "three different" },
  { v: 4, label: "four different" },
  { v: 5, label: "five different" },
];
const WHERES: { v: Where; label: string; omega?: boolean }[] = [
  { v: "", label: "anywhere on the Field" },
  { v: "adjacent", label: "adjacent", omega: true },
  { v: "rowThrough", label: "in a row through this unit", omega: true },
  { v: "rowChoice", label: "in one horizontal row of your choice" },
];

function TargetEditor({ t, place, onChange }: { t: Target; place: EffectPlace; onChange: (t: Target) => void }) {
  const set = (p: Partial<Target>) => onChange({ ...t, ...p });
  const omega = place === "omega";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <select className={SEL} aria-label="How many" value={String(t.count)} onChange={(e) => set({ count: (/^\d$/.test(e.target.value) ? Number(e.target.value) : e.target.value) as Count })}>
        {COUNTS.filter((c) => omega || !c.omega).map((c) => (
          <option key={String(c.v)} value={String(c.v)}>
            {c.label}
          </option>
        ))}
      </select>
      {t.count !== "this" && (
        <>
          {omega && (
            <label className="flex items-center gap-1 text-[13px] text-sky-100">
              <input type="checkbox" checked={t.other} onChange={(e) => set({ other: e.target.checked })} /> other
            </label>
          )}
          <select className={SEL} aria-label="Damage state" value={t.state} onChange={(e) => set({ state: e.target.value as Target["state"] })}>
            <option value="">any state</option>
            <option value="damaged">damaged</option>
            <option value="undamaged">undamaged</option>
          </select>
          <select className={SEL} aria-label="Level" value={t.level} onChange={(e) => set({ level: Number(e.target.value) })}>
            <option value={0}>any Level</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                Level {n}
              </option>
            ))}
          </select>
          <select className={SEL} aria-label="Unit kind" value={t.kind} onChange={(e) => set({ kind: e.target.value as Kind })}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select className={SEL} aria-label="Where" value={t.where} onChange={(e) => set({ where: e.target.value as Where })}>
            {WHERES.filter((w) => omega || !w.omega).map((w) => (
              <option key={w.v} value={w.v}>
                {w.label}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

function StepEditor({ s, place, onChange, onRemove, index }: { s: Step; place: EffectPlace; onChange: (s: Step) => void; onRemove: () => void; index: number }) {
  const v = VERBS.find((x) => x.id === s.verb)!;
  const set = (p: Partial<Step>) => onChange({ ...s, ...p });
  return (
    <li className="rounded-lg border border-white/20 bg-indigo-950/35 p-2" data-step={index}>
      <div className="flex flex-wrap items-center gap-1.5">
        <b className="w-6 text-[13px] text-sky-200">{index + 1}.</b>
        <select className={SEL} aria-label="Action" value={s.verb} onChange={(e) => set({ verb: e.target.value as Step["verb"] })}>
          {VERBS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
        {v.n && <input className={`${INP} w-16`} style={txt} type="number" min={1} max={9} aria-label="Amount" value={s.n} onChange={(e) => set({ n: Math.max(1, Math.min(9, Number(e.target.value) || 1)) })} />}
        {s.verb === "place" && (
          <select className={SEL} aria-label="Token" value={s.token} onChange={(e) => set({ token: e.target.value as NonNullable<Step["token"]> })}>
            {TOKENS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {(s.verb === "gainEnergy" || s.verb === "loseEnergy") && (
          <select className={SEL} aria-label="Energy colour" value={s.colour ?? ""} onChange={(e) => set({ colour: e.target.value as NonNullable<Step["colour"]> })}>
            <option value="">any colour</option>
            {COLOURS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <span className="flex-1" />
        <button type="button" className="grid h-9 w-9 place-items-center rounded-full text-rose-200 hover:bg-white/10" aria-label={`Remove step ${index + 1}`} onClick={onRemove}>
          <Trash2 size={16} />
        </button>
      </div>
      {v.target && (
        <div className="mt-1.5 pl-7">
          <TargetEditor t={s.target} place={place} onChange={(target) => set({ target })} />
        </div>
      )}
    </li>
  );
}

export function EffectEditor({ value, place, onChange, label }: { value: EffectDraft | undefined; place: EffectPlace; onChange: (e: EffectDraft | undefined) => void; label: string }) {
  const e: EffectDraft = value ?? { mode: "blocks", steps: [] };
  const text = effectText(e);
  return (
    <div className="grid gap-2" data-effect={label}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold uppercase tracking-[0.1em] text-sky-100">{label}</span>
        <span className="flex-1" />
        <div className="flex overflow-hidden rounded-full border border-white/40 text-[13px]" role="radiogroup" aria-label={`${label}: how it is made`}>
          {(["blocks", "text"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={e.mode === m}
              data-mode={m}
              className={`px-3 py-1 font-semibold ${e.mode === m ? "bg-white text-indigo-950" : "text-white hover:bg-white/10"}`}
              onClick={() => {
                if (m === e.mode) return;
                // Blocks to text keeps the words; text to blocks starts again.
                onChange(m === "text" ? { mode: "text", text } : { mode: "blocks", steps: [] });
              }}
            >
              {m === "blocks" ? "Blocks" : "Text"}
            </button>
          ))}
        </div>
      </div>
      {e.mode === "blocks" ? (
        <>
          {place === "omega" && (
            <label className="flex flex-wrap items-center gap-1.5 text-[13px] text-sky-100">
              Only if adjacent to
              <select className={SEL} value={e.when?.adjacentTo ?? ""} onChange={(x) => onChange({ ...e, when: { adjacentTo: x.target.value as Kind | "" } })}>
                <option value="">(always)</option>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ul className="grid gap-1.5">
            {e.steps.map((s, i) => (
              <StepEditor
                key={i}
                index={i}
                s={s}
                place={place}
                onChange={(n) => onChange({ ...e, steps: e.steps.map((x, j) => (j === i ? n : x)) })}
                onRemove={() => onChange({ ...e, steps: e.steps.filter((_, j) => j !== i) })}
              />
            ))}
          </ul>
          <button type="button" className="bf-btn !min-h-[38px] justify-self-start !px-3 !text-[14px]" data-action="add-step" onClick={() => onChange({ ...e, steps: [...e.steps, newStep(place === "omega" ? "boost" : "damage")] })}>
            <Plus size={16} /> Step
          </button>
        </>
      ) : (
        <>
          <textarea className={`${INP} min-h-[72px] w-full`} style={txt} value={e.text} placeholder="The effect in Core Rules words" aria-label={`${label} text`} onChange={(x) => onChange({ mode: "text", text: x.target.value })} />
          <span className="justify-self-start rounded bg-amber-300/85 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider text-amber-950">Needs programming</span>
        </>
      )}
      <p className="rounded-md bg-black/25 px-2 py-1.5 text-[14px] italic text-sky-50" data-effect-text>
        {text || <span className="text-sky-200/70">No effect.</span>}
      </p>
    </div>
  );
}
