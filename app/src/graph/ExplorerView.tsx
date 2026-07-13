import { Sidebar } from "../Sidebar";
import type { GraphSessionStore } from "./GraphSessionStore";
import { useGraphSession } from "./useGraphSession";

export function ExplorerView({ store }: { store: GraphSessionStore }) {
  const state = useGraphSession(store);
  return <Sidebar snapshot={state.visibleSnapshot} selectedNodeIds={state.selectedNodeIds}
    onSelectNode={(id, additive) => store.requestNodeSelection(id, additive)}
    showDebugResources={state.showDebugResources} onShowDebugResourcesChange={(value) => store.setShowDebugResources(value)}
    showInfrastructureResources={state.showInfrastructureResources}
    onShowInfrastructureResourcesChange={(value) => store.setShowInfrastructureResources(value)} />;
}
