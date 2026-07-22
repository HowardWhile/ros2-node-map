import { parseGraphSnapshot } from "./graph/snapshot.ts";
import type { GraphSnapshot } from "./types";

export function backendUrlForPage(location: Pick<Location, "protocol" | "host">): string | null {
  if (location.protocol !== "http:" && location.protocol !== "https:") return null;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws/graph`;
}

const browserBackendUrl = typeof window === "undefined"
  ? null
  : backendUrlForPage(window.location);

export const DEFAULT_BACKEND_URL = browserBackendUrl ?? "ws://127.0.0.1:8766";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"
  | "file";

export interface GraphConnectionCallbacks {
  onSnapshot: (snapshot: GraphSnapshot) => void;
  onStatus: (status: ConnectionStatus, message?: string) => void;
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
        callbacks.onSnapshot(parseGraphSnapshot(String(event.data)));
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
