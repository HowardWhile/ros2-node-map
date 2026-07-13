import { DEFAULT_BACKEND_URL, connectGraphStream, type ConnectionStatus } from "../api";
import type { GraphSnapshot } from "../types";
import type { GraphSelectionRequest } from "../GraphView";

const DEBUG_RESOURCE_NAMES = new Set(["/rosout", "/parameter_events", "/statistics", "/diagnostics", "/diagnostics_agg"]);
const INFRASTRUCTURE_RESOURCE_NAMES = new Set(["/tf", "/tf_static", "/clock", "/bond"]);

const isInfrastructureResource = (label: string) =>
  INFRASTRUCTURE_RESOURCE_NAMES.has(label) || label.endsWith("/transition_event");

export interface GraphSessionState {
  urlInput: string;
  backendUrl: string;
  connectionStatus: ConnectionStatus;
  statusMessage: string;
  snapshot: GraphSnapshot | null;
  visibleSnapshot: GraphSnapshot | null;
  selectionRequest: GraphSelectionRequest | null;
  selectedNodeIds: string[];
  showDebugResources: boolean;
  showInfrastructureResources: boolean;
}

export class GraphSessionStore {
  private state: GraphSessionState;
  private readonly listeners = new Set<() => void>();
  private cleanup: (() => void) | null = null;
  private disposed = false;

  constructor() {
    this.state = this.withVisibleSnapshot({
      urlInput: DEFAULT_BACKEND_URL, backendUrl: DEFAULT_BACKEND_URL,
      connectionStatus: "connecting", statusMessage: "", snapshot: null,
      visibleSnapshot: null, selectionRequest: null, selectedNodeIds: [],
      showDebugResources: false, showInfrastructureResources: false,
    });
    this.connectStream();
  }

  getSnapshot = (): GraphSessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setUrlInput(value: string): void { this.update({ urlInput: value }); }
  setShowDebugResources(value: boolean): void { this.update({ showDebugResources: value }); }
  setShowInfrastructureResources(value: boolean): void { this.update({ showInfrastructureResources: value }); }

  connect(): void {
    const backendUrl = this.state.urlInput.trim();
    if (!backendUrl || backendUrl === this.state.backendUrl) return;
    this.cleanup?.();
    this.cleanup = null;
    this.update({ backendUrl, snapshot: null, selectedNodeIds: [], selectionRequest: null });
    this.connectStream();
  }

  requestNodeSelection(id: string, additive: boolean): void {
    this.update({ selectionRequest: { id, additive, token: (this.state.selectionRequest?.token ?? 0) + 1 } });
  }

  setSelectedNodeIds(ids: string[]): void { this.update({ selectedNodeIds: [...ids] }); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cleanup?.();
    this.cleanup = null;
    this.listeners.clear();
  }

  private connectStream(): void {
    this.cleanup = connectGraphStream(this.state.backendUrl, {
      onSnapshot: (snapshot) => this.update({ snapshot }),
      onStatus: (connectionStatus, statusMessage = "") => this.update({ connectionStatus, statusMessage }),
    });
  }

  private update(patch: Partial<GraphSessionState>): void {
    if (this.disposed) return;
    this.state = this.withVisibleSnapshot({ ...this.state, ...patch });
    this.listeners.forEach((listener) => listener());
  }

  private withVisibleSnapshot(state: GraphSessionState): GraphSessionState {
    const { snapshot } = state;
    if (!snapshot) return { ...state, visibleSnapshot: null };
    const nodes = snapshot.nodes.filter((node) =>
      (state.showDebugResources || !DEBUG_RESOURCE_NAMES.has(node.label)) &&
      (state.showInfrastructureResources || !isInfrastructureResource(node.label)),
    );
    const visibleIds = new Set(nodes.map((node) => node.id));
    return { ...state, visibleSnapshot: { ...snapshot, nodes, edges: snapshot.edges.filter((edge) =>
      visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    } };
  }
}
