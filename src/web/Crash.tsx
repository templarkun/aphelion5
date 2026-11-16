/**
 * A safety net (designer 2026-11-16: a screen error blanked the whole game). If drawing the screen
 * fails, this shows what went wrong and a button that draws it again; the game itself is kept (it
 * is saved after every answer), so "Carry on" goes on from the same question.
 */
import { Component, type ReactNode } from "react";

export class CrashGuard extends Component<{ children: ReactNode }, { error: Error | undefined; key: number }> {
  override state: { error: Error | undefined; key: number } = { error: undefined, key: 0 };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error) {
    console.error(error);
  }
  override render() {
    const { error, key } = this.state;
    if (!error) return <div key={key} style={{ display: "contents" }}>{this.props.children}</div>;
    return (
      <div className="crash-card" role="alert">
        <h2>Something went wrong on the screen</h2>
        <p>Your game is saved. Press Carry on to go on from the same question. If it happens again, please send the text below and an exported save.</p>
        <pre>{String(error.stack ?? error.message).slice(0, 1200)}</pre>
        <button onClick={() => this.setState({ error: undefined, key: key + 1 })}>Carry on</button>
        <button onClick={() => location.reload()}>Reload the page</button>
      </div>
    );
  }
}
