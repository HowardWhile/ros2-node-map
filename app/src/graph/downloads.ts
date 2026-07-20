import type { GraphSnapshot } from "../types";
import {
  createVaultZip,
  graphToJson,
  graphToMermaidMarkdown,
  graphToObsidianVault,
} from "./exporters";

function timestampSuffix(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadText(content: string, filename: string, type: string): void {
  downloadBlob(new Blob([content], { type }), filename);
}

export function downloadGraphJson(snapshot: GraphSnapshot): void {
  downloadText(
    graphToJson(snapshot),
    `ros2-node-map-${timestampSuffix()}.json`,
    "application/json;charset=utf-8",
  );
}

export function downloadMermaidMarkdown(snapshot: GraphSnapshot): void {
  downloadText(
    graphToMermaidMarkdown(snapshot),
    `ros2-node-map-${timestampSuffix()}.md`,
    "text/markdown;charset=utf-8",
  );
}

export function downloadObsidianVault(snapshot: GraphSnapshot): void {
  const bytes = createVaultZip(graphToObsidianVault(snapshot));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  downloadBlob(
    new Blob([buffer], { type: "application/zip" }),
    `ros2-node-map-obsidian-${timestampSuffix()}.zip`,
  );
}
