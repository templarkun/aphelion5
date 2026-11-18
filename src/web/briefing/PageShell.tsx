/**
 * A full page in the briefing's look (the chosen style's colours and background): a header with
 * Back and a title, optional tabs, and a scrolling body. Used by the statistics page and the
 * Campaign editor. Screen only.
 */

import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { AmbientLayer, FxLayer } from "./fx.js";
import { hoverHook } from "./hud.js";
import { Logo } from "./IntroSequence.js";
import { playBack } from "./soundHooks.js";
import { useBriefStyle } from "./styles/index.js";

export function PageShell<T extends string>(p: {
  id: string;
  title: string;
  sub: string;
  onBack: () => void;
  tabs?: readonly { id: T; label: string }[];
  tab?: T;
  onTab?: (t: T) => void;
  right?: ReactNode;
  children: ReactNode;
}) {
  const style = useBriefStyle();
  return (
    <main className="brief flex flex-col" style={{ "--acc": style.acc } as CSSProperties} data-style={style.id} data-page={p.id} onPointerOver={hoverHook}>
      <AmbientLayer rgb={style.acc} />
      <FxLayer />
      <header className="relative z-10 flex items-center gap-3 border-b border-white/20 bg-indigo-950/30 px-3 py-2 sm:px-5">
        <button type="button" className="bf-btn !min-h-[42px] !px-3" onClick={() => (playBack(), p.onBack())} data-action="page-back" aria-label="Back to the Command Deck">
          <ChevronLeft size={18} /> <span className="hidden sm:inline">Command deck</span>
        </button>
        <Logo size={34} />
        <div className="min-w-0 flex-1">
          <h1 className="bf-glow truncate text-base font-extrabold uppercase tracking-[0.2em] text-white sm:text-lg">{p.title}</h1>
          <div className="hidden truncate text-[12px] font-semibold uppercase tracking-[0.14em] text-sky-200 sm:block">{p.sub}</div>
        </div>
        {p.right}
      </header>
      {p.tabs && (
        <nav className="relative z-10 flex items-stretch gap-1 overflow-x-auto border-b border-white/15 bg-indigo-950/20 px-2 sm:px-5" aria-label={`${p.title} sections`}>
          {p.tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={t.id === p.tab ? "page" : undefined}
              data-tab={t.id}
              onClick={() => p.onTab?.(t.id)}
              className={`flex-1 whitespace-nowrap border-b-[3px] px-3 py-2.5 text-[13px] font-bold uppercase tracking-[0.1em] transition-colors sm:text-[15px] ${t.id === p.tab ? "border-white text-white" : "border-transparent text-sky-200/80 hover:text-white"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <div className="bf-scroll relative z-10 flex-1 px-3 py-4 sm:px-6">{p.children}</div>
    </main>
  );
}
