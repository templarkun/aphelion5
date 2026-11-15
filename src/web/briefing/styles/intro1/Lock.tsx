/** Style "intro1": the holographic lock. Rings close on the centre, brackets snap, the word lands, one flash. */

export function Lock({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="bf-lock" role="status" aria-live="polite">
      <svg viewBox="-100 -100 200 200" fill="none" stroke="rgb(var(--acc))">
        <g className="r1">
          <circle r="86" strokeWidth="1" strokeDasharray="34 9" />
          <circle r="92" strokeWidth="2.6" strokeDasharray="3 21" opacity="0.8" />
        </g>
        <g className="r2">
          <circle r="64" strokeWidth="1.6" strokeDasharray="70 14 6 14" />
          <path d="M-64 0h-10M64 0h10M0 -64v-10M0 64v10" strokeWidth="2" />
        </g>
        <g className="br" strokeWidth="3" strokeLinecap="round" stroke="#fff">
          <path d="M-52 -34v-18h18M52 -34v-18h-18M-52 34v18h18M52 34v18h-18" />
        </g>
        <g className="tx" stroke="none" textAnchor="middle" fontFamily="system-ui, sans-serif">
          <rect x="-86" y="-17" width="172" height="38" rx="10" fill="rgb(22 32 110 / 0.92)" stroke="#fff" strokeWidth="0.8" />
          <text y="-1" fontSize="12" fontWeight="800" letterSpacing="2" fill="#fff">
            {title}
          </text>
          <text y="12" fontSize="6.5" letterSpacing="1" fill="rgb(var(--acc))">
            {sub}
          </text>
        </g>
      </svg>
      <div className="fl" />
    </div>
  );
}
