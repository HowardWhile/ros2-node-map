import { CommandRegistry } from "@lumino/commands";
import { Widget } from "@lumino/widgets";
import { createElement, type ReactNode } from "react";
import { DetailsView } from "../graph/DetailsView";
import { ExplorerView } from "../graph/ExplorerView";
import { GraphPanelView } from "../graph/GraphPanelView";
import { GraphSessionStore } from "../graph/GraphSessionStore";
import { ToolbarView } from "../graph/ToolbarView";
import { PanelRegistry, type PanelId } from "./PanelRegistry";
import { ReactPanelWidget } from "./ReactPanelWidget";
import { registerCommands } from "./commands";
import { WorkbenchShell } from "./WorkbenchShell";

const EXPLORER_CONTENT_CHROME_WIDTH = 88;
const STACKED_DETAILS_ASPECT_RATIO = 1.2;

function initialExplorerWidth(root: HTMLElement, longestLabel: string): number {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return Math.floor(root.clientWidth / 3);
  context.font = "11px Inter, ui-sans-serif, system-ui, sans-serif";
  const labelWidth = Math.ceil(context.measureText(longestLabel).width);
  return Math.min(Math.floor(root.clientWidth / 3), labelWidth + EXPLORER_CONTENT_CHROME_WIDTH);
}

export function bootstrap(root: HTMLElement): () => void {
  const store = new GraphSessionStore();
  const commands = new CommandRegistry();
  const panels = new PanelRegistry();
  const registerPanel = (id: PanelId, title: string, closable: boolean, render: () => ReactNode) => {
    panels.register({
      id,
      title,
      closable,
      create: () => new ReactPanelWidget({ id, title, closable, render }),
    });
  };

  registerPanel("ros2-node-map.explorer", "Explorer", true,
    () => createElement(ExplorerView, { store }));
  registerPanel("ros2-node-map.graph", "ROS Graph", false,
    () => createElement(GraphPanelView, { store }));
  registerPanel("ros2-node-map.details", "Details", true,
    () => createElement(DetailsView, { store }));

  const shell = new WorkbenchShell(commands, panels);
  const toolbar = new ReactPanelWidget({
    id: "ros2-node-map.toolbar",
    title: "Toolbar",
    closable: false,
    render: () => createElement(ToolbarView, { store }),
  });
  toolbar.addClass("workbench-toolbar");
  shell.insertWidget(1, toolbar);
  registerCommands(commands, shell);
  Widget.attach(shell, root);
  shell.restoreOrDefault();

  let explorerSized = false;
  let explorerSizingFrame: number | null = null;
  const sizeExplorerFromLabels = () => {
    if (explorerSized) return;
    const labels = (store.getSnapshot().visibleSnapshot?.nodes ?? [])
      .map((node) => node.label);
    const longestLabel = labels.reduce((longest, label) => label.length > longest.length ? label : longest, "");
    if (!longestLabel || root.clientWidth === 0) return;
    explorerSized = true;
    explorerSizingFrame = window.requestAnimationFrame(() => {
      explorerSizingFrame = null;
      shell.setInitialExplorerWidth(initialExplorerWidth(root, longestLabel));
    });
  };
  const unsubscribeSizing = store.subscribe(sizeExplorerFromLabels);
  sizeExplorerFromLabels();

  let resizeFrame: number | null = null;
  let detailsBelowExplorer: boolean | null = null;
  let initialExplorerLimitApplied = false;
  const updateLayout = () => {
    if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      const stackDetails = root.clientWidth / Math.max(root.clientHeight, 1) < STACKED_DETAILS_ASPECT_RATIO;
      if (detailsBelowExplorer !== stackDetails) {
        detailsBelowExplorer = stackDetails;
        shell.setDetailsBelowExplorer(stackDetails);
      }
      shell.setExplorerMaxWidth(Math.floor(root.clientWidth / 2));
      if (!initialExplorerLimitApplied && root.clientWidth > 0) {
        initialExplorerLimitApplied = true;
        shell.constrainExplorerWidth(Math.floor(root.clientWidth / 3));
      }
      shell.fit();
      shell.update();
    });
  };
  const resizeObserver = new ResizeObserver(updateLayout);
  resizeObserver.observe(root);
  window.addEventListener("resize", updateLayout);
  updateLayout();

  const cleanup = () => {
    if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    if (explorerSizingFrame !== null) window.cancelAnimationFrame(explorerSizingFrame);
    unsubscribeSizing();
    resizeObserver.disconnect();
    window.removeEventListener("resize", updateLayout);
    shell.saveLayout();
    shell.dispose();
    store.dispose();
  };
  window.addEventListener("beforeunload", cleanup, { once: true });
  return () => { window.removeEventListener("beforeunload", cleanup); cleanup(); };
}
