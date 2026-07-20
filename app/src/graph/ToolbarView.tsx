import type { FormEvent } from "react";
import type { GraphSessionStore } from "./GraphSessionStore";
import { useGraphSession } from "./useGraphSession";

export function ToolbarView({ store }: { store: GraphSessionStore }) {
  const state = useGraphSession(store);
  const rosDomainId = state.visibleSnapshot?.ros_domain_id ?? state.snapshot?.ros_domain_id ?? "—";
  const connect = (event: FormEvent) => { event.preventDefault(); store.connect(true); };
  const status = state.sourceMode === "file" ? "file" : state.connectionStatus;
  return <header className="toolbar">
    <div className="brand"><span className="brand-mark" /><strong>ros2-node-map</strong></div>
    <form className="connection-form" onSubmit={connect}>
      <input aria-label="Backend WebSocket URL" value={state.urlInput}
        onChange={(event) => store.setUrlInput(event.target.value)} spellCheck={false}
        disabled={!state.liveAvailable} />
      <button type="submit" disabled={!state.liveAvailable}>Connect</button>
    </form>
    <button className="open-file-button" type="button" onClick={() => store.openSnapshotFilePicker()}>Open JSON</button>
    <div className={`connection-status status-${status}`} title={state.statusMessage || state.runtimeMessage}>
      <span />{status}
    </div>
    <div className="ros-domain-id" title="ROS_DOMAIN_ID">
      <span>ROS_DOMAIN_ID</span>
      <strong>{rosDomainId}</strong>
    </div>
    <div className="graph-stats"><span>{state.visibleSnapshot?.nodes.length ?? 0} nodes</span>
      <span>{state.visibleSnapshot?.edges.length ?? 0} edges</span></div>
  </header>;
}
