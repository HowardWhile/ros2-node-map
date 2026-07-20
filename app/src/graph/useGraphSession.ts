import { useSyncExternalStore } from "react";
import type { GraphSessionStore } from "./GraphSessionStore";

export function useGraphSession(store: GraphSessionStore) {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
