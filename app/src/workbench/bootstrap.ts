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

  const cleanup = () => { shell.saveLayout(); shell.dispose(); store.dispose(); };
  window.addEventListener("beforeunload", cleanup, { once: true });
  return () => { window.removeEventListener("beforeunload", cleanup); cleanup(); };
}
