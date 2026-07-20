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

  let fileDragDepth = 0;
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  const handleFileDragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    fileDragDepth += 1;
    store.setFileDragActive(true);
  };
  const handleFileDragOver = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  };
  const handleFileDragLeave = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    fileDragDepth = Math.max(0, fileDragDepth - 1);
    if (fileDragDepth === 0) store.setFileDragActive(false);
  };
  const handleFileDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    fileDragDepth = 0;
    store.setFileDragActive(false);
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length !== 1) {
      store.setFileError("Drop exactly one graph JSON file.");
      return;
    }
    void store.importSnapshotFile(files[0]);
  };
  window.addEventListener("dragenter", handleFileDragEnter);
  window.addEventListener("dragover", handleFileDragOver);
  window.addEventListener("dragleave", handleFileDragLeave);
  window.addEventListener("drop", handleFileDrop);

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
      const maxSidePanelWidth = Math.floor(root.clientWidth / 2);
      shell.constrainExplorerWidth(maxSidePanelWidth);
      shell.constrainDetailsWidth(maxSidePanelWidth);
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
  document.addEventListener("fullscreenchange", updateLayout);
  updateLayout();

  const cleanup = () => {
    if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
    if (explorerSizingFrame !== null) window.cancelAnimationFrame(explorerSizingFrame);
    unsubscribeSizing();
    resizeObserver.disconnect();
    window.removeEventListener("resize", updateLayout);
    document.removeEventListener("fullscreenchange", updateLayout);
    window.removeEventListener("dragenter", handleFileDragEnter);
    window.removeEventListener("dragover", handleFileDragOver);
    window.removeEventListener("dragleave", handleFileDragLeave);
    window.removeEventListener("drop", handleFileDrop);
    shell.saveLayout();
    shell.dispose();
    store.dispose();
  };
  window.addEventListener("beforeunload", cleanup, { once: true });
  return () => { window.removeEventListener("beforeunload", cleanup); cleanup(); };
}
