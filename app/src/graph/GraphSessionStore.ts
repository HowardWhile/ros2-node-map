import { DEFAULT_BACKEND_URL, connectGraphStream, type ConnectionStatus } from "../api.ts";
import type { GraphSnapshot } from "../types";
import type { GraphSelectionRequest } from "../GraphView";
import { parseGraphSnapshot } from "./snapshot.ts";

const DEBUG_RESOURCE_NAMES = new Set(["/rosout", "/parameter_events", "/statistics", "/diagnostics", "/diagnostics_agg"]);
const INFRASTRUCTURE_RESOURCE_NAMES = new Set(["/tf", "/tf_static", "/clock", "/bond"]);
const COMMON_SERVICE_NAMES = new Set([
  "describe_parameters", "get_parameter_types", "get_parameters", "get_type_description",
  "list_parameters", "set_parameters", "set_parameters_atomically",
  "get_logger_levels", "set_logger_levels",
]);
const LIFECYCLE_SERVICE_NAMES = new Set([
  "change_state", "get_state", "get_available_states", "get_available_transitions",
  "get_transition_graph",
]);
const ACTION_INTERNAL_MARKER = "/_action/";

const isInfrastructureResource = (label: string) =>
  INFRASTRUCTURE_RESOURCE_NAMES.has(label) || label.endsWith("/transition_event");
const serviceName = (label: string) => label.slice(label.lastIndexOf("/") + 1);
const isCommonService = (label: string) => COMMON_SERVICE_NAMES.has(serviceName(label));
const isLifecycleService = (label: string) => LIFECYCLE_SERVICE_NAMES.has(serviceName(label));
const isActionInternalResource = (kind: string, label: string) =>
  (kind === "ros_topic" || kind === "ros_service") && label.includes(ACTION_INTERNAL_MARKER);

export interface GraphSessionState {
  urlInput: string;
  backendUrl: string;
  connectionStatus: ConnectionStatus;
  statusMessage: string;
  snapshot: GraphSnapshot | null;
  visibleSnapshot: GraphSnapshot | null;
  selectionRequest: GraphSelectionRequest | null;
  selectedNodeIds: string[];
  sourceMode: "live" | "file";
  fileName: string;
  fileError: string;
  fileDragActive: boolean;
  runtimeReady: boolean;
  liveAvailable: boolean;
  runtimeMessage: string;
  showDebugResources: boolean;
  showInfrastructureResources: boolean;
  showCommonServices: boolean;
  showLifecycleServices: boolean;
  showActionInternals: boolean;
  showTopics: boolean;
  showServices: boolean;
  showActions: boolean;
}

export class GraphSessionStore {
  private state: GraphSessionState;
  private readonly listeners = new Set<() => void>();
  private cleanup: (() => void) | null = null;
  private runtimeCleanup: (() => void) | null = null;
  private disposed = false;

  constructor() {
    const bridge = window.ros2NodeMap;
    const checksRuntime = Boolean(bridge?.getRuntimeStatus);
    this.state = this.withVisibleSnapshot({
      urlInput: DEFAULT_BACKEND_URL, backendUrl: DEFAULT_BACKEND_URL,
      connectionStatus: "connecting", statusMessage: "", snapshot: null,
      visibleSnapshot: null, selectionRequest: null, selectedNodeIds: [],
      sourceMode: "live", fileName: "", fileError: "", fileDragActive: false,
      runtimeReady: !checksRuntime, liveAvailable: !checksRuntime, runtimeMessage: "",
      showDebugResources: false, showInfrastructureResources: false,
      showCommonServices: false, showLifecycleServices: false, showActionInternals: false,
      showTopics: true, showServices: true, showActions: true,
    });
    if (checksRuntime) {
      this.runtimeCleanup = bridge?.onRuntimeStatus?.((status) => this.applyRuntimeStatus(status)) ?? null;
      void bridge!.getRuntimeStatus!()
        .then((status) => this.applyRuntimeStatus(status))
        .catch((error: unknown) => this.applyRuntimeStatus({
          rosAvailable: false,
          backendAvailable: false,
          liveAvailable: false,
          reason: error instanceof Error ? error.message : "Unable to inspect the ROS runtime.",
        }));
    } else {
      this.connectStream();
    }
  }

  getSnapshot = (): GraphSessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setUrlInput(value: string): void { this.update({ urlInput: value }); }
  setShowDebugResources(value: boolean): void { this.update({ showDebugResources: value }); }
  setShowInfrastructureResources(value: boolean): void { this.update({ showInfrastructureResources: value }); }
  setShowCommonServices(value: boolean): void { this.update({ showCommonServices: value }); }
  setShowLifecycleServices(value: boolean): void { this.update({ showLifecycleServices: value }); }
  setShowActionInternals(value: boolean): void { this.update({ showActionInternals: value }); }
  setShowTopics(value: boolean): void { this.update({ showTopics: value }); }
  setShowServices(value: boolean): void { this.update({ showServices: value }); }
  setShowActions(value: boolean): void { this.update({ showActions: value }); }
  setFileDragActive(value: boolean): void {
    if (this.state.fileDragActive !== value) this.update({ fileDragActive: value });
  }

  setFileError(message: string): void { this.update({ fileError: message }); }

  importSnapshotText(raw: string, fileName: string): boolean {
    let snapshot: GraphSnapshot;
    try {
      snapshot = parseGraphSnapshot(raw);
    } catch (error) {
      this.update({ fileError: error instanceof Error ? error.message : "Unable to load graph JSON." });
      return false;
    }
    this.cleanup?.();
    this.cleanup = null;
    this.update({
      sourceMode: "file",
      fileName,
      fileError: "",
      snapshot,
      selectedNodeIds: [],
      selectionRequest: null,
      connectionStatus: "file",
      statusMessage: `Viewing ${fileName}`,
    });
    return true;
  }

  async importSnapshotFile(file: File): Promise<boolean> {
    if (!file.name.toLowerCase().endsWith(".json")) {
      this.update({ fileError: "Choose a .json graph snapshot file." });
      return false;
    }
    try {
      return this.importSnapshotText(await file.text(), file.name);
    } catch (error) {
      this.update({ fileError: error instanceof Error ? error.message : "Unable to read the selected file." });
      return false;
    }
  }

  openSnapshotFilePicker(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void this.importSnapshotFile(file);
    }, { once: true });
    input.click();
  }

  resumeLive(): void {
    if (!this.state.liveAvailable) return;
    this.cleanup?.();
    this.cleanup = null;
    this.update({
      sourceMode: "live", fileName: "", fileError: "", snapshot: null,
      selectedNodeIds: [], selectionRequest: null, connectionStatus: "connecting", statusMessage: "",
    });
    this.connectStream();
  }

  connect(force = false): void {
    if (!this.state.liveAvailable) return;
    const backendUrl = this.state.urlInput.trim();
    if (!backendUrl) return;
    if (!force && backendUrl === this.state.backendUrl) return;
    this.cleanup?.();
    this.cleanup = null;
    this.update({
      backendUrl, sourceMode: "live", fileName: "", fileError: "", snapshot: null,
      selectedNodeIds: [], selectionRequest: null,
    });
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
    this.runtimeCleanup?.();
    this.runtimeCleanup = null;
    this.listeners.clear();
  }

  private connectStream(): void {
    this.cleanup = connectGraphStream(this.state.backendUrl, {
      onSnapshot: (snapshot) => this.update({ snapshot }),
      onStatus: (connectionStatus, statusMessage = "") => this.update({ connectionStatus, statusMessage }),
    });
  }

  private applyRuntimeStatus(status: Ros2NodeMapRuntimeStatus): void {
    if (this.disposed) return;
    const runtimeMessage = status.reason ?? "";
    this.update({ runtimeReady: true, liveAvailable: status.liveAvailable, runtimeMessage });
    if (!status.liveAvailable) {
      this.cleanup?.();
      this.cleanup = null;
      if (this.state.sourceMode !== "file") {
        this.update({
          sourceMode: "file",
          snapshot: null,
          selectedNodeIds: [],
          selectionRequest: null,
          connectionStatus: "disconnected",
          statusMessage: runtimeMessage || "ROS 2 is unavailable. Open a graph JSON file.",
        });
      }
      return;
    }
    if (this.state.sourceMode === "live" && !this.cleanup) this.connectStream();
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
      (state.showInfrastructureResources || !isInfrastructureResource(node.label)) &&
      (state.showCommonServices || node.kind !== "ros_service" || !isCommonService(node.label)) &&
      (state.showLifecycleServices || node.kind !== "ros_service" || !isLifecycleService(node.label)) &&
      (state.showActionInternals || !isActionInternalResource(node.kind, node.label)) &&
      (state.showTopics || node.kind !== "ros_topic") &&
      (state.showServices || node.kind !== "ros_service") &&
      (state.showActions || node.kind !== "ros_action"),
    );
    const visibleIds = new Set(nodes.map((node) => node.id));
    return { ...state, visibleSnapshot: { ...snapshot, nodes, edges: snapshot.edges.filter((edge) =>
      visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    } };
  }
}
