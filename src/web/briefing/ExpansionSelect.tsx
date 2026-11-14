/** Step 3 (optional): expansion modules as hardware chips that plug into the vessel's six sockets. */

import { Cpu, Flame, Power } from "lucide-react";
import { EXPANSION_MODULES } from "../../engine/campaign.js";
import { EXPANSION_INFO, EXPANSION_SLOTS } from "./content.js";
import { StepHead } from "./hud.js";
import { burstFrom, ring } from "./particles.js";
import { playChipIn, playChipOut } from "./soundHooks.js";

const ICONS: Record<string, typeof Cpu> = { heat: Flame };

export function ExpansionSelect({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const mods = EXPANSION_MODULES;
  const empty = Math.max(0, EXPANSION_SLOTS - mods.length);
  const toggle = (id: string, el: Element) => {
    const on = value.includes(id);
    if (on) playChipOut();
    else {
      playChipIn();
      burstFrom(el, { rgb: "110 231 183", count: 28, speed: 240, life: 0.6 });
      const r = el.getBoundingClientRect();
      ring(r.left + r.width / 2, r.top + r.height / 2, "110 231 183", 320, 0.45, 20);
    }
    onChange(on ? value.filter((x) => x !== id) : [...value, id]);
  };
  return (
    <div>
      <StepHead
        code="Step 3 of 3"
        title="Expansion Modules"
        help="Optional. Tap a chip to plug it into your vessel, tap again to pull it out. You may launch with none."
        right={
          <div className="bf-panel px-4 py-2 text-[15px] font-semibold text-white" data-expansions={value.join(",")}>
            Plugged in <b className="text-acc">{value.length}</b> / {EXPANSION_SLOTS}
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
              <div className={`bf-panel p-3 pt-4 ${on ? "bf-sel" : ""}`}>
                <div className="mb-3 flex justify-between text-[12px] font-bold uppercase tracking-wider">
                  <span className="text-sky-100">Socket {i + 1}</span>
                  <span className={on ? "text-emerald-300" : "text-sky-200"}>{on ? "Online" : "Standby"}</span>
                </div>
                <button type="button" role="switch" aria-checked={on} data-chip={m.id} onClick={(e) => toggle(m.id, e.currentTarget)} className={`bf-chip mx-auto block w-full max-w-[240px] !px-[9px] ${on ? "bf-in" : ""}`}>
                  <span className="bf-pins left-0" />
                  <span className="bf-pins right-0" />
                  <span className="relative block rounded-md border border-white/40 bg-gradient-to-b from-slate-500 to-slate-700 p-3 text-left">
                    <span className="flex items-center justify-between">
                      <span className="text-[12px] font-bold tracking-widest text-slate-200">{info.code}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${on ? "bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" : "bg-slate-400"}`} />
                    </span>
                    <span className="mt-2 flex items-center gap-2">
                      <Icon size={26} className={on ? "text-acc" : "text-slate-200"} />
                      <span className={`text-xl font-extrabold uppercase tracking-widest ${on ? "bf-glow text-white" : "text-slate-100"}`}>{info.name}</span>
                    </span>
                    <span className="mt-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-200">
                      <Power size={13} /> {on ? "Tap to unplug" : "Tap to plug in"}
                    </span>
                  </span>
                </button>
                <p className="mt-3 text-[14px] leading-snug text-slate-50">{info.text}</p>
              </div>
            </div>
          );
        })}
        {Array.from({ length: empty }, (_, i) => (
          <div key={i} className="bf-rise" style={{ "--i": mods.length + i } as React.CSSProperties} aria-label="Empty expansion socket">
            <div className="bf-panel bf-soon flex h-full min-h-[130px] flex-col p-3 pt-4">
              <div className="flex justify-between text-[12px] font-bold uppercase tracking-wider">
                <span>Socket {mods.length + i + 1}</span>
                <span>Empty</span>
              </div>
              <div className="grid flex-1 place-items-center">
                <div className="text-center">
                  <Cpu size={30} className="mx-auto" strokeWidth={1.4} />
                  <div className="mt-1 text-[13px] font-bold uppercase tracking-wider">Coming later</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
