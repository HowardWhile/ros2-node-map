import { Sidebar } from "../Sidebar";
import type { GraphSessionStore } from "./GraphSessionStore";
import { useGraphSession } from "./useGraphSession";

export function ExplorerView({ store }: { store: GraphSessionStore }) {
  const state = useGraphSession(store);
  return <Sidebar snapshot={state.visibleSnapshot} selectedNodeIds={state.selectedNodeIds}
    onSelectNode={(id, additive) => store.requestNodeSelection(id, additive)}
    showDebugResources={state.showDebugResources} onShowDebugResourcesChange={(value) => store.setShowDebugResources(value)}
    showInfrastructureResources={state.showInfrastructureResources}
    onShowInfrastructureResourcesChange={(value) => store.setShowInfrastructureResources(value)}
    showCommonServices={state.showCommonServices}
    onShowCommonServicesChange={(value) => store.setShowCommonServices(value)}
    showLifecycleServices={state.showLifecycleServices}
    onShowLifecycleServicesChange={(value) => store.setShowLifecycleServices(value)}
    showActionInternals={state.showActionInternals}
    onShowActionInternalsChange={(value) => store.setShowActionInternals(value)}
    showTopics={state.showTopics} onShowTopicsChange={(value) => store.setShowTopics(value)}
    showServices={state.showServices} onShowServicesChange={(value) => store.setShowServices(value)}
    showActions={state.showActions} onShowActionsChange={(value) => store.setShowActions(value)} />;
}
