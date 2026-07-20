import { CommandRegistry } from "@lumino/commands";
import { BoxPanel, DockPanel, Widget } from "@lumino/widgets";
import type { DockLayout } from "@lumino/widgets";
import type { PanelId, PanelRegistry } from "./PanelRegistry";
import { clearDockLayout, restoreDockLayout, saveDockLayout } from "./layoutPersistence";

function containsWidget(area: DockLayout.AreaConfig, widget: Widget): boolean {
  return area.type === "tab-area"
    ? area.widgets.includes(widget)
    : area.children.some((child) => containsWidget(child, widget));
}

function setPanelSplitSize(area: DockLayout.AreaConfig, panel: Widget, ratio: number): boolean {
  if (area.type === "tab-area") return false;
  const index = area.children.findIndex((child) => containsWidget(child, panel));
  if (index === -1) return false;
  if (area.orientation === "horizontal") {
    const otherTotal = area.sizes.reduce((total, size, childIndex) => childIndex === index ? total : total + size, 0);
    if (otherTotal <= 0) return false;
    area.sizes = area.sizes.map((size, childIndex) =>
      childIndex === index ? ratio : size * (1 - ratio) / otherTotal,
    );
    return true;
  }
  return setPanelSplitSize(area.children[index], panel, ratio);
}

const MAX_SIDE_PANEL_RATIO = 0.5;

export class WorkbenchShell extends BoxPanel {
  readonly dock = new DockPanel();
  private readonly menu: Widget;
  private saveTimer: number | null = null;
  private panelHandleDrag: { handle: HTMLDivElement; side: "left" | "right"; deltaX: number; deltaY: number } | null = null;

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
    this.dock.node.addEventListener("pointerdown", this.capturePanelHandle, true);
  }

  openPanel(id: PanelId): Widget {
    const widget = this.panels.getOrCreate(id);
    if (!widget.parent) this.dock.addWidget(widget);
    this.dock.activateWidget(widget);
    return widget;
  }

  restoreOrDefault(): boolean {
    const restored = restoreDockLayout(this.dock, this.panels);
    if (!restored) this.applyDefaultLayout();
    return restored;
  }

  setInitialExplorerWidth(width: number): void {
    const explorer = this.panels.findOpen("ros2-node-map.explorer");
    const dockWidth = this.dock.node.clientWidth;
    if (!explorer || width <= 0 || dockWidth <= 0) return;
    const layout = this.dock.saveLayout();
    if (!layout.main) return;
    const ratio = Math.min(0.95, Math.max(0.05, width / dockWidth));
    if (setPanelSplitSize(layout.main, explorer, ratio)) this.dock.restoreLayout(layout);
  }

  constrainExplorerWidth(maxWidth: number): void {
    const explorer = this.panels.findOpen("ros2-node-map.explorer");
    if (!explorer || maxWidth <= 0 || explorer.node.getBoundingClientRect().width <= maxWidth) return;
    this.setInitialExplorerWidth(maxWidth);
  }

  constrainDetailsWidth(maxWidth: number): void {
    const details = this.panels.findOpen("ros2-node-map.details");
    if (!details || maxWidth <= 0 || details.node.getBoundingClientRect().width <= maxWidth) return;
    const dockWidth = this.dock.node.clientWidth;
    if (dockWidth <= 0) return;
    const layout = this.dock.saveLayout();
    if (!layout.main) return;
    const ratio = Math.min(0.95, Math.max(0.05, maxWidth / dockWidth));
    if (setPanelSplitSize(layout.main, details, ratio)) this.dock.restoreLayout(layout);
  }

  setExplorerMaxWidth(maxWidth: number): void {
    const explorer = this.panels.findOpen("ros2-node-map.explorer");
    if (!explorer || maxWidth <= 0) return;
    explorer.node.style.maxWidth = `${maxWidth}px`;
  }

  setDetailsBelowExplorer(belowExplorer: boolean): void {
    const graph = this.panels.findOpen("ros2-node-map.graph");
    const explorer = this.panels.findOpen("ros2-node-map.explorer");
    const details = this.panels.findOpen("ros2-node-map.details");
    if (!graph || !explorer || !details) return;
    this.dock.addWidget(details, belowExplorer
      ? { mode: "split-bottom", ref: explorer }
      : { mode: "split-right", ref: graph });
    this.dock.activateWidget(graph);
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
    this.releasePanelHandle();
    this.dock.node.removeEventListener("pointerdown", this.capturePanelHandle, true);
    super.dispose();
  }

  private debouncedSave(): void {
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.saveLayout(), 500);
  }

  private capturePanelHandle = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const explorer = this.panels.findOpen("ros2-node-map.explorer");
    const details = this.panels.findOpen("ros2-node-map.details");
    const target = event.target as Node | null;
    const handle = Array.from(this.dock.handles()).find((candidate) => target && candidate.contains(target));
    if (!handle || handle.dataset.orientation !== "horizontal") return;
    const handleRect = handle.getBoundingClientRect();
    const explorerRight = explorer?.node.getBoundingClientRect().right;
    const detailsLeft = details?.node.getBoundingClientRect().left;
    const nearExplorer = explorerRight !== undefined && Math.abs(handleRect.left - explorerRight) <= 12;
    const nearDetails = detailsLeft !== undefined && Math.abs(handleRect.right - detailsLeft) <= 12;
    if (!nearExplorer && !nearDetails) return;
    this.panelHandleDrag = {
      handle,
      side: nearExplorer ? "left" : "right",
      deltaX: event.clientX - handleRect.left,
      deltaY: event.clientY - handleRect.top,
    };
    document.addEventListener("pointermove", this.limitPanelHandle, true);
    document.addEventListener("pointerup", this.releasePanelHandle, true);
    document.addEventListener("pointercancel", this.releasePanelHandle, true);
  };

  private limitPanelHandle = (event: PointerEvent): void => {
    const drag = this.panelHandleDrag;
    if (!drag) return;
    const dockRect = this.dock.node.getBoundingClientRect();
    const x = event.clientX - dockRect.left - drag.deltaX;
    const limitX = this.dock.node.clientWidth * MAX_SIDE_PANEL_RATIO;
    const exceedsLimit = drag.side === "left" ? x > limitX : x < limitX;
    if (!exceedsLimit) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    (this.dock.layout as DockLayout).moveHandle(
      drag.handle,
      limitX,
      event.clientY - dockRect.top - drag.deltaY,
    );
  };

  private releasePanelHandle = (): void => {
    this.panelHandleDrag = null;
    document.removeEventListener("pointermove", this.limitPanelHandle, true);
    document.removeEventListener("pointerup", this.releasePanelHandle, true);
    document.removeEventListener("pointercancel", this.releasePanelHandle, true);
  };

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
