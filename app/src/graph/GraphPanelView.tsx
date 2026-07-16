import { GraphView } from "../GraphView";
import type { GraphSessionStore } from "./GraphSessionStore";
import { useGraphSession } from "./useGraphSession";

export function GraphPanelView({ store }: { store: GraphSessionStore }) {
  const state = useGraphSession(store);
  return <GraphView snapshot={state.visibleSnapshot} backendUrl={state.backendUrl}
    selectionRequest={state.selectionRequest}
    onSelectionChange={(ids) => store.setSelectedNodeIds(ids)} />;
}
