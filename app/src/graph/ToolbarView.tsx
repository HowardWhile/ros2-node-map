import type { FormEvent } from "react";
import type { GraphSessionStore } from "./GraphSessionStore";
import { useGraphSession } from "./useGraphSession";

export function ToolbarView({ store }: { store: GraphSessionStore }) {
  const state = useGraphSession(store);
  const connect = (event: FormEvent) => { event.preventDefault(); store.connect(); };
  return <header className="toolbar">
    <div className="brand"><span className="brand-mark" /><strong>ros2-node-map</strong></div>
    <form className="connection-form" onSubmit={connect}>
      <input aria-label="Backend WebSocket URL" value={state.urlInput}
        onChange={(event) => store.setUrlInput(event.target.value)} spellCheck={false} />
      <button type="submit">Connect</button>
    </form>
    <div className={`connection-status status-${state.connectionStatus}`} title={state.statusMessage}>
      <span />{state.connectionStatus}
    </div>
    <div className="graph-stats"><span>{state.visibleSnapshot?.nodes.length ?? 0} nodes</span>
      <span>{state.visibleSnapshot?.edges.length ?? 0} edges</span></div>
  </header>;
}
