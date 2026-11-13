/** Step 3 (optional): expansion modules as hardware chips that plug into the vessel's six sockets. */

import { Cpu, Flame, Power } from "lucide-react";
import { EXPANSION_MODULES } from "../../engine/campaign.js";
import { EXPANSION_INFO, EXPANSION_SLOTS } from "./content.js";
import { StepHead } from "./hud.js";
import { cue } from "./sfx.js";

const ICONS: Record<string, typeof Cpu> = { heat: Flame };

export function ExpansionSelect({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const mods = EXPANSION_MODULES;
  const empty = Math.max(0, EXPANSION_SLOTS - mods.length);
  const toggle = (id: string) => {
    const on = value.includes(id);
    cue(on ? "unplug" : "plug");
    onChange(on ? value.filter((x) => x !== id) : [...value, id]);
  };
  return (
    <div>
      <StepHead
        code="STEP 03 // EXPANSION BUS"
        title="Expansion Modules"
        help="Optional. Tap a chip to plug it into your vessel, tap again to pull it out. You may launch with none."
        right={
          <div className="bf-panel px-3 py-1.5 font-hud text-sm text-slate-100" data-expansions={value.join(",")}>
            <span className="bf-label mr-2">Online</span>
            <b className="text-acc">{value.length}</b> / {EXPANSION_SLOTS}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {mods.map((m, i) => {
          const info = EXPANSION_INFO[m.id] ?? { code: `HX-${String(i + 1).padStart(2, "0")}`, name: m.label, text: "" };
          const on = value.includes(m.id);
          const Icon = ICONS[m.id] ?? Cpu;
          return (
            <div key={m.id} className="bf-rise" style={{ "--i": i } as React.CSSProperties}>
              <div className={`border border-dashed p-3 pt-5 transition-colors ${on ? "border-acc/70 bg-acc/5" : "border-slate-500/40 bg-black/20"}`}>
                <div className="bf-label mb-2 flex justify-between">
                  <span>Socket {String(i + 1).padStart(2, "0")}</span>
                  <span className={on ? "text-emerald-300" : "!text-slate-400"}>{on ? "Online" : "Standby"}</span>
                </div>
                <button type="button" role="switch" aria-checked={on} data-chip={m.id} onClick={() => toggle(m.id)} className={`bf-chip mx-auto block w-full max-w-[220px] !px-[9px] ${on ? "bf-in" : ""}`}>
                  <span className="bf-pins left-0" />
                  <span className="bf-pins right-0" />
                  {on && <span key="spark" className="bf-spark pointer-events-none absolute inset-0 border-2 border-acc" />}
                  <span className="relative block border border-slate-500/60 bg-gradient-to-b from-metal-600 to-metal-800 p-3 text-left">
                    <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-slate-500" />
                    <span className="flex items-center justify-between">
                      <span className="font-hud text-[10px] tracking-widest text-slate-400">{info.code}</span>
                      <span className={`h-2 w-2 rounded-full ${on ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-slate-600"}`} />
                    </span>
                    <span className="mt-2 flex items-center gap-2">
                      <Icon size={22} className={on ? "text-acc" : "text-slate-400"} />
                      <span className={`font-hud text-lg font-bold uppercase tracking-widest ${on ? "bf-glow text-acc" : "text-slate-300"}`}>{info.name}</span>
                    </span>
                    <span className="mt-2 flex items-center gap-1.5 font-hud text-[10px] uppercase tracking-widest text-slate-400">
                      <Power size={11} /> {on ? "Tap to unplug" : "Tap to plug in"}
                    </span>
                  </span>
                </button>
                <p className="mt-3 text-xs leading-snug text-slate-300/90">{info.text}</p>
                <p className="mt-1 font-hud text-[10px] text-slate-500">{m.label}</p>
              </div>
            </div>
          );
        })}
        {Array.from({ length: empty }, (_, i) => (
          <div key={i} className="bf-rise" style={{ "--i": mods.length + i } as React.CSSProperties} aria-label="Empty expansion socket">
            <div className="flex h-full min-h-[120px] flex-col border border-dashed border-slate-600/40 bg-black/20 p-3 pt-5 opacity-60">
              <div className="bf-label flex justify-between !text-slate-500">
                <span>Socket {String(mods.length + i + 1).padStart(2, "0")}</span>
                <span>Empty</span>
              </div>
              <div className="grid flex-1 place-items-center">
                <div className="text-center">
                  <Cpu size={26} className="mx-auto text-slate-600" strokeWidth={1.2} />
                  <div className="bf-label mt-1 !text-slate-600">No hardware</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
