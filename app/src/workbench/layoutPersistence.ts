import { Widget, type DockPanel } from "@lumino/widgets";
import type { PanelId, PanelRegistry } from "./PanelRegistry";

const STORAGE_KEY = "ros2-node-map.workbench.layout.v1";
const VERSION = 1;
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function serialize(value: unknown): Json | undefined {
  if (value instanceof Widget) return value.id;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(serialize).filter((item): item is Json => item !== undefined);
  if (!isRecord(value)) return undefined;
  const result: { [key: string]: Json } = {};
  for (const [key, item] of Object.entries(value)) {
    const serialized = serialize(item);
    if (serialized !== undefined) result[key] = serialized;
  }
  return result;
}

function deserializeLayout(value: Json, panels: PanelRegistry): unknown | null {
  if (!isRecord(value)) return value;
  if (value.type === "tab-area") {
    const widgets = Array.isArray(value.widgets)
      ? value.widgets.filter((item): item is PanelId => typeof item === "string" && panels.has(item))
        .map((id) => panels.getOrCreate(id))
      : [];
    if (widgets.length === 0) return null;
    return { ...value, widgets, currentIndex: Math.min(Number(value.currentIndex) || 0, widgets.length - 1) };
  }
  if (value.type === "split-area") {
    const children = Array.isArray(value.children)
      ? value.children.map((item) => deserializeLayout(item, panels)).filter((item): item is Record<string, unknown> => item !== null && isRecord(item))
      : [];
    if (children.length === 0) return null;
    if (children.length === 1) return children[0];
    return { ...value, children, sizes: Array.isArray(value.sizes) ? value.sizes.slice(0, children.length) : undefined };
  }
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) result[key] = item;
  return result;
}

export function saveDockLayout(dock: DockPanel): void {
  try {
    const layout = serialize(dock.saveLayout());
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, layout }));
  } catch (error) { console.error("Unable to save workbench layout", error); }
}

export function restoreDockLayout(dock: DockPanel, panels: PanelRegistry): boolean {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!isRecord(stored) || stored.version !== VERSION || !isRecord(stored.layout)) return false;
    const layout = deserializeLayout(stored.layout as Json, panels);
    if (!isRecord(layout)) return false;
    dock.restoreLayout(layout as unknown as DockPanel.ILayoutConfig);
    return true;
  } catch (error) { console.warn("Ignoring invalid saved workbench layout", error); return false; }
}

export function clearDockLayout(): void { localStorage.removeItem(STORAGE_KEY); }
