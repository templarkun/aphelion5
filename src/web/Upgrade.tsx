/**
 * Upgrade points (designer 2026-11-08): a glyph in a bubble, like the
 * Reserve's. Placeholder art (spec "Art"): a double chevron pointing up.
 */

export function UpgradeGlyph() {
  return (
    <svg className="upgrade-glyph" viewBox="0 0 20 20" aria-hidden>
      <path d="M10 2 18 9.5 15.5 12 10 7 4.5 12 2 9.5z" />
      <path d="M10 8.5 18 16 15.5 18.5 10 13.5 4.5 18.5 2 16z" opacity="0.65" />
    </svg>
  );
}

export function UpgradeBubble({ n }: { n: number }) {
  const label = `${n} Upgrade point${n === 1 ? "" : "s"}`;
  return (
    <span className="upgrade-bubble" role="img" aria-label={label} title={`${label} (spent at Mission End, 10.2)`}>
      <UpgradeGlyph />
      <b>{n}</b>
    </span>
  );
}
