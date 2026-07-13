import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";
import { createElement } from "react";
import { DetailsView } from "../graph/DetailsView";
import { ExplorerView } from "../graph/ExplorerView";
import { GraphPanelView } from "../graph/GraphPanelView";
import { GraphSessionStore } from "../graph/GraphSessionStore";
import { ToolbarView } from "../graph/ToolbarView";
import { PanelRegistry } from "./PanelRegistry";
import { ReactPanelWidget } from "./ReactPanelWidget";
import { registerCommands } from "./commands";
import { WorkbenchShell } from "./WorkbenchShell";

export function bootstrap(root: HTMLElement): () => void {
  const store = new GraphSessionStore();
  const commands = new CommandRegistry();
  const panels = new PanelRegistry();
  panels.register({ id: "ros2-node-map.explorer", title: "Explorer", closable: true,
    create: () => new ReactPanelWidget({ id: "ros2-node-map.explorer", title: "Explorer", render: () => createElement(ExplorerView, { store }) }) });
  panels.register({ id: "ros2-node-map.graph", title: "ROS Graph", closable: false,
    create: () => new ReactPanelWidget({ id: "ros2-node-map.graph", title: "ROS Graph", closable: false, render: () => createElement(GraphPanelView, { store }) }) });
  panels.register({ id: "ros2-node-map.details", title: "Details", closable: true,
    create: () => new ReactPanelWidget({ id: "ros2-node-map.details", title: "Details", render: () => createElement(DetailsView, { store }) }) });

  const shell = new WorkbenchShell(commands, panels);
  const toolbar = new ReactPanelWidget({ id: "ros2-node-map.toolbar", title: "Toolbar", closable: false, render: () => createElement(ToolbarView, { store }) });
  toolbar.addClass("workbench-toolbar");
  shell.insertWidget(1, toolbar);
  registerCommands(commands, shell, panels);
  Widget.attach(shell, root);
  shell.restoreOrDefault();

  let resizeFrame: number | null = null;
  const updateLayout = () => {
    if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      const pinnedPanels = [
        panels.findOpen("ros2-node-map.explorer"),
        panels.findOpen("ros2-node-map.details"),
      ].flatMap((panel) => {
        const width = panel?.node.getBoundingClientRect().width ?? 0;
        if (!panel || width === 0) return [];
        const { minWidth, maxWidth } = panel.node.style;
        panel.node.style.minWidth = `${width}px`;
        panel.node.style.maxWidth = `${width}px`;
        return [{ panel, minWidth, maxWidth }];
      });
      shell.fit();
      shell.update();
      window.requestAnimationFrame(() => {
        for (const { panel, minWidth, maxWidth } of pinnedPanels) {
          panel.node.style.minWidth = minWidth;
          panel.node.style.maxWidth = maxWidth;
        }
      });
    });
  };
  const resizeObserver = new ResizeObserver(updateLayout);
  resizeObserver.observe(root);
  window.addEventListener("resize", updateLayout);
  updateLayout();

  const cleanup = () => {
    if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    resizeObserver.disconnect();
    window.removeEventListener("resize", updateLayout);
    shell.saveLayout();
    shell.dispose();
    store.dispose();
  };
  window.addEventListener("beforeunload", cleanup, { once: true });
  return () => { window.removeEventListener("beforeunload", cleanup); cleanup(); };
}
