/**
 * Style "intro2": armour doors. Two plates slide in from the sides and meet, a seam of light
 * runs along the join, the word stands on the closed doors, one flash. Under a second (designer 2026-11-16: twice as slow).
 */

export function Lock({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="bf-lock bf2-lock" role="status" aria-live="polite">
      <div className="bf2-doors">
        <div className="l" />
        <div className="r" />
        <div className="seam" />
        <div className="tx">
          <div className="t">{title}</div>
          <div className="s">{sub}</div>
        </div>
      </div>
      <div className="fl" />
    </div>
  );
}
