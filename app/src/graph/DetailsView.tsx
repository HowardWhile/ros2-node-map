import { DetailPanel } from "../DetailPanel";
import type { GraphSessionStore } from "./GraphSessionStore";
import { useGraphSession } from "./useGraphSession";

export function DetailsView({ store }: { store: GraphSessionStore }) {
  const state = useGraphSession(store);
  return <DetailPanel snapshot={state.snapshot} selectedNodeIds={state.selectedNodeIds}
    onSelectNode={(id) => store.requestNodeSelection(id, false)} />;
}
