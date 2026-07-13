import {
  GRAPH_SCHEMA_VERSION,
  type GraphSnapshot,
} from "./types";

export const DEFAULT_BACKEND_URL = "ws://127.0.0.1:8766";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export interface GraphConnectionCallbacks {
  onSnapshot: (snapshot: GraphSnapshot) => void;
  onStatus: (status: ConnectionStatus, message?: string) => void;
}

function parseSnapshot(raw: string): GraphSnapshot {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") {
    throw new Error("Backend message is not a JSON object");
  }
  const snapshot = value as Partial<GraphSnapshot>;
  if (snapshot.schema_version !== GRAPH_SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${snapshot.schema_version ?? "missing"}`);
  }
  if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) {
    throw new Error("Backend message is missing nodes or edges");
  }
  return snapshot as GraphSnapshot;
}

export function connectGraphStream(
  url: string,
  callbacks: GraphConnectionCallbacks,
  retryDelayMs = 1500,
): () => void {
  let stopped = false;
  let socket: WebSocket | undefined;
  let retryTimer: number | undefined;

  const connect = () => {
    if (stopped) return;
    callbacks.onStatus("connecting");
    socket = new WebSocket(url);

    socket.addEventListener("open", () => callbacks.onStatus("connected"));
    socket.addEventListener("message", (event) => {
      try {
        callbacks.onSnapshot(parseSnapshot(String(event.data)));
      } catch (error) {
        callbacks.onStatus(
          "error",
          error instanceof Error ? error.message : "Invalid backend message",
        );
      }
    });
    socket.addEventListener("error", () => {
      callbacks.onStatus("error", `Unable to connect to ${url}`);
    });
    socket.addEventListener("close", () => {
      if (stopped) return;
      callbacks.onStatus("disconnected", "Retrying…");
      retryTimer = window.setTimeout(connect, retryDelayMs);
    });
  };

  connect();
  return () => {
    stopped = true;
    if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    socket?.close();
  };
}
