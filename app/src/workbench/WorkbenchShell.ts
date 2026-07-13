import { CommandRegistry } from "@lumino/commands";
import { BoxPanel, DockPanel, Widget } from "@lumino/widgets";
import type { PanelId, PanelRegistry } from "./PanelRegistry";
import { clearDockLayout, restoreDockLayout, saveDockLayout } from "./layoutPersistence";

export class WorkbenchShell extends BoxPanel {
  readonly dock = new DockPanel();
  private readonly menu: Widget;
  private saveTimer: number | null = null;

  constructor(readonly commands: CommandRegistry, readonly panels: PanelRegistry) {
    super({ direction: "top-to-bottom" });
    this.node.setAttribute("role", "main");
    this.addClass("workbench-shell");
    this.menu = this.createMenu();
    this.dock.id = "ros2-node-map.dock";
    this.dock.addClass("workbench-dock");
    this.addWidget(this.menu);
    this.addWidget(this.dock);
    BoxPanel.setStretch(this.dock, 1);
    this.dock.layoutModified.connect(() => this.debouncedSave());
  }

  openPanel(id: PanelId): Widget {
    const widget = this.panels.getOrCreate(id);
    if (!widget.parent) this.dock.addWidget(widget);
    this.dock.activateWidget(widget);
    return widget;
  }

  restoreOrDefault(): void {
    if (!restoreDockLayout(this.dock, this.panels)) this.applyDefaultLayout();
  }

  applyDefaultLayout(): void {
    const graph = this.panels.getOrCreate("ros2-node-map.graph");
    const explorer = this.panels.getOrCreate("ros2-node-map.explorer");
    const details = this.panels.getOrCreate("ros2-node-map.details");
    if (!graph.parent) this.dock.addWidget(graph);
    if (!explorer.parent) this.dock.addWidget(explorer, { mode: "split-left", ref: graph });
    if (!details.parent) this.dock.addWidget(details, { mode: "split-right", ref: graph });
    this.dock.activateWidget(graph);
  }

  resetLayout(): void {
    clearDockLayout();
    this.panels.disposePanels();
    this.applyDefaultLayout();
  }

  saveLayout(): void { saveDockLayout(this.dock); }

  dispose(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    super.dispose();
  }

  private debouncedSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveLayout(), 500);
  }

  private createMenu(): Widget {
    const menu = new Widget({ node: document.createElement("nav") });
    menu.addClass("workbench-menu");
    menu.node.setAttribute("aria-label", "Workbench menu");
    const view = document.createElement("details");
    view.className = "view-menu";
    view.innerHTML = "<summary>View</summary>";
    const items: Array<[string, string]> = [
      ["Explorer", "view.openExplorer"], ["ROS Graph", "view.openGraph"], ["Details", "view.openDetails"],
      ["Reset Layout", "view.resetLayout"], ["Save Layout", "view.saveLayout"],
    ];
    for (const [label, command] of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => { void this.commands.execute(command); view.removeAttribute("open"); });
      view.append(button);
    }
    menu.node.append(view);
    return menu;
  }
}
