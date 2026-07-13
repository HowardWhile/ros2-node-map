import type { Widget } from "@lumino/widgets";

export type PanelId = "ros2-node-map.explorer" | "ros2-node-map.graph" | "ros2-node-map.details";

export interface PanelDefinition { id: PanelId; title: string; closable: boolean; create: () => Widget; }

export class PanelRegistry {
  private readonly definitions = new Map<PanelId, PanelDefinition>();
  private readonly instances = new Map<PanelId, Widget>();

  register(definition: PanelDefinition): void { this.definitions.set(definition.id, definition); }
  has(id: string): id is PanelId { return this.definitions.has(id as PanelId); }
  findOpen(id: PanelId): Widget | null { return this.instances.get(id) ?? null; }

  getOrCreate(id: PanelId): Widget {
    const current = this.instances.get(id);
    if (current && !current.isDisposed) return current;
    const definition = this.definitions.get(id);
    if (!definition) throw new Error(`Unknown panel: ${id}`);
    const widget = definition.create();
    widget.disposed.connect(() => { if (this.instances.get(id) === widget) this.instances.delete(id); });
    this.instances.set(id, widget);
    return widget;
  }

  disposePanels(): void {
    for (const widget of this.instances.values()) widget.dispose();
    this.instances.clear();
  }
}
