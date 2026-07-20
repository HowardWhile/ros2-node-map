import { GraphView } from "../GraphView";
import type { GraphSessionStore } from "./GraphSessionStore";
import { useGraphSession } from "./useGraphSession";

export function GraphPanelView({ store }: { store: GraphSessionStore }) {
  const state = useGraphSession(store);
  return <GraphView snapshot={state.visibleSnapshot} backendUrl={state.backendUrl}
    sourceMode={state.sourceMode} fileName={state.fileName} fileError={state.fileError}
    fileDragActive={state.fileDragActive} runtimeReady={state.runtimeReady}
    liveAvailable={state.liveAvailable} runtimeMessage={state.runtimeMessage}
    selectionRequest={state.selectionRequest}
    onSelectionChange={(ids) => store.setSelectedNodeIds(ids)}
    onOpenFile={() => store.openSnapshotFilePicker()} onResumeLive={() => store.resumeLive()} />;
}
