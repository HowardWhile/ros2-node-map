import cytoscape, {
  type Core,
  type ElementDefinition,
  type Layouts,
} from "cytoscape";
import cola from "cytoscape-cola";
import { useEffect, useRef } from "react";

import { DomainControl } from "./DomainControl";
import type { ConnectionStatus } from "./api";
import {
  downloadGraphJson,
  downloadMermaidMarkdown,
} from "./graph/downloads";
import type { GraphSnapshot } from "./types";

export interface GraphSelectionRequest {
  id: string;
  additive: boolean;
  token: number;
}

interface GraphViewProps {
  snapshot: GraphSnapshot | null;
  exportSnapshot: GraphSnapshot | null;
  backendUrl: string;
  sourceMode: "live" | "file";
  connectionStatus: ConnectionStatus;
  fileName: string;
  fileError: string;
  fileDragActive: boolean;
  runtimeReady: boolean;
  liveAvailable: boolean;
  runtimeMessage: string;
  selectionRequest: GraphSelectionRequest | null;
  onSelectionChange: (selectedIds: string[]) => void;
  onOpenFile: () => void;
  onResumeLive: () => void;
}

cytoscape.use(cola);

const LABEL_ZOOM_THRESHOLD = 1.0;

const graphStyle: cytoscape.StylesheetJson = [
  {
    selector: "node",
    style: {
      "background-color": "#718096",
      color: "#dce2ec",
      opacity: 1,
      label: "data(label)",
      "text-opacity": 0,
      "text-outline-opacity": 0,
      "transition-property": "opacity, text-opacity, text-outline-opacity",
      "transition-duration": 350,
      "transition-timing-function": "ease-in-out",
      "font-size": 10,
      "text-valign": "bottom",
      "text-margin-y": 8,
      "text-outline-color": "#11151b",
      "text-outline-width": 2,
      width: 34,
      height: 34,
    },
  },
  {
    selector: "node.labels-visible, node:selected",
    style: {
      "text-opacity": 1,
      "text-outline-opacity": 1,
    },
  },
  {
    selector: 'node[kind = "ros_node"]',
    style: {
      shape: "ellipse",
      "background-color": "#7aa2f7",
      width: 42,
      height: 42,
    },
  },
  {
    selector: 'node[kind = "ros_topic"]',
    style: {
      shape: "round-rectangle",
      "background-color": "#73daca",
      width: 44,
      height: 26,
    },
  },
  {
    selector: 'node[kind = "ros_service"]',
    style: {
      shape: "rectangle",
      "background-color": "#e0af68",
      width: 38,
      height: 30,
    },
  },
  {
    selector: 'node[kind = "ros_action"]',
    style: {
      shape: "diamond",
      "background-color": "#bb9af7",
    },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "#596579",
      "target-arrow-color": "#79869c",
      "target-arrow-shape": "triangle",
      "curve-style": "bezier",
      "arrow-scale": 0.7,
      opacity: 0.8,
      "transition-property": "opacity, width",
      "transition-duration": 250,
      "transition-timing-function": "ease-in-out",
    },
  },
  {
    selector: 'edge[kind = "publish"]',
    style: { "line-color": "#7aa2f7", "target-arrow-color": "#7aa2f7" },
  },
  {
    selector: 'edge[kind = "subscribe"]',
    style: { "line-color": "#73daca", "target-arrow-color": "#73daca" },
  },
  {
    selector: 'edge[kind = "service_client"], edge[kind = "service_server"]',
    style: {
      "line-style": "dashed",
      "line-color": "#e0af68",
      "target-arrow-color": "#e0af68",
    },
  },
  {
    selector: 'edge[kind = "action_client"], edge[kind = "action_server"]',
    style: {
      "line-style": "dotted",
      "line-color": "#bb9af7",
      "target-arrow-color": "#bb9af7",
    },
  },
  {
    selector: ".is-context-dimmed",
    style: {
      opacity: 0.1,
      "text-opacity": 0,
    },
  },
  {
    selector: "node.is-context-focused",
    style: {
      opacity: 1,
      "z-index": 10,
    },
  },
  {
    selector: "edge.is-context-focused",
    style: {
      opacity: 1,
      width: 2.5,
      "z-index": 9,
    },
  },
  {
    selector: ":selected",
    style: {
      "border-width": 3,
      "border-color": "#e0af68",
      "overlay-color": "#e0af68",
      "overlay-opacity": 0.12,
    },
  },
];

function updateLabelVisibility(graph: Core, force = false): void {
  const visible = graph.zoom() >= LABEL_ZOOM_THRESHOLD;
  if (!force && graph.scratch("labels-visible") === visible) return;
  graph.scratch("labels-visible", visible);
  graph.nodes().toggleClass("labels-visible", visible);
}

function toElements(snapshot: GraphSnapshot): ElementDefinition[] {
  return [
    ...snapshot.nodes.map((node) => ({ data: { ...node } })),
    ...snapshot.edges.map((edge) => ({ data: { ...edge } })),
  ];
}

function startAiryWebLayout(graph: Core): Layouts {
  graph.layout({
    name: "cose",
    animate: false,
    fit: true,
    padding: 45,
    randomize: true,
    nodeRepulsion: () => 12000,
    idealEdgeLength: () => 135,
  }).run();

  return startContinuousForceLayout(graph);
}

function startContinuousForceLayout(graph: Core): Layouts {
  const forceOptions = {
    name: "cola",
    animate: true,
    refresh: 1,
    infinite: true,
    fit: false,
    randomize: false,
    avoidOverlap: true,
    handleDisconnected: true,
    ungrabifyWhileSimulating: false,
    nodeSpacing: () => 34,
    edgeLength: () => 135,
    convergenceThreshold: 0.01,
  };
  const layout = graph.layout(forceOptions);
  layout.run();
  return layout;
}

function placeNewNodes(graph: Core, nodeIds: string[]): void {
  const newNodeIds = new Set(nodeIds);
  const newNodes = graph.nodes().filter((node) => newNodeIds.has(node.id()));
  const existingNodes = graph.nodes().not(newNodes);
  const extent = graph.extent();
  const fallback = existingNodes.empty()
    ? { x: graph.width() / 2, y: graph.height() / 2 }
    : { x: (extent.x1 + extent.x2) / 2, y: (extent.y1 + extent.y2) / 2 };
  const occupied: Array<{ x: number; y: number }> = [];
  existingNodes.forEach((node) => { occupied.push(node.position()); });

  newNodes.forEach((node, index) => {
    const neighbors = node.neighborhood().nodes().not(newNodes);
    const anchor = neighbors.empty() ? fallback : neighbors.position();
    const candidates = [{ ...anchor }];
    for (const radius of [100, 170, 240]) {
      for (let step = 0; step < 16; step += 1) {
        const angle = (step / 16) * Math.PI * 2 + index * 0.7;
        candidates.push({ x: anchor.x + Math.cos(angle) * radius, y: anchor.y + Math.sin(angle) * radius });
      }
    }
    const position = candidates.reduce((best, candidate) => {
      const closest = occupied.length === 0 ? Infinity : Math.min(...occupied.map((point) =>
        Math.hypot(candidate.x - point.x, candidate.y - point.y),
      ));
      const bestClosest = occupied.length === 0 ? Infinity : Math.min(...occupied.map((point) =>
        Math.hypot(best.x - point.x, best.y - point.y),
      ));
      const candidateScore = closest - Math.hypot(candidate.x - anchor.x, candidate.y - anchor.y) * 0.2;
      const bestScore = bestClosest - Math.hypot(best.x - anchor.x, best.y - anchor.y) * 0.2;
      return candidateScore > bestScore ? candidate : best;
    });
    node.position(position);
    occupied.push(position);
  });
}

function syncGraphSnapshot(graph: Core, snapshot: GraphSnapshot): {
  addedNodeIds: string[];
  needsForceUpdate: boolean;
} {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const edgesById = new Map(snapshot.edges.map((edge) => [edge.id, edge]));
  const addedNodeIds: string[] = [];
  let needsForceUpdate = false;

  graph.batch(() => {
    const removedEdges = graph.edges().filter((edge) => !edgesById.has(edge.id()));
    if (!removedEdges.empty()) needsForceUpdate = true;
    removedEdges.remove();

    const removedNodes = graph.nodes().filter((node) => !nodesById.has(node.id()));
    if (!removedNodes.empty()) needsForceUpdate = true;
    removedNodes.remove();

    for (const node of snapshot.nodes) {
      const existing = graph.getElementById(node.id);
      if (existing.empty()) {
        graph.add({ data: { ...node } });
        addedNodeIds.push(node.id);
        needsForceUpdate = true;
      } else {
        existing.data({ ...node });
      }
    }
    for (const edge of snapshot.edges) {
      const existing = graph.getElementById(edge.id);
      if (existing.empty()) {
        graph.add({ data: { ...edge } });
        needsForceUpdate = true;
        continue;
      }
      if (existing.data("source") !== edge.source || existing.data("target") !== edge.target) {
        existing.remove();
        graph.add({ data: { ...edge } });
        needsForceUpdate = true;
      } else {
        existing.data({ ...edge });
      }
    }
  });

  return { addedNodeIds, needsForceUpdate };
}

function fitVisibleNodes(graph: Core): void {
  if (graph.elements().empty()) return;
  const visibleNodes = graph.nodes().not(".is-context-dimmed");
  if (visibleNodes.empty()) return;
  graph.animate({
    fit: { eles: visibleNodes, padding: 45 },
    duration: 550,
    easing: "ease-in-out-cubic",
    queue: false,
    complete: () => updateLabelVisibility(graph, true),
  });
}

export function GraphView({
  snapshot,
  exportSnapshot,
  backendUrl,
  sourceMode,
  connectionStatus,
  fileName,
  fileError,
  fileDragActive,
  runtimeReady,
  liveAvailable,
  runtimeMessage,
  selectionRequest,
  onSelectionChange,
  onOpenFile,
  onResumeLive,
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Core | null>(null);
  const forceLayoutRef = useRef<Layouts | null>(null);
  const topologyRef = useRef("");
  const zoomTargetRef = useRef<number | null>(null);
  const exportMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const graph = cytoscape({
      container,
      elements: [],
      style: graphStyle,
      minZoom: 0.08,
      maxZoom: 4,
      wheelSensitivity: 1.0,
      selectionType: "single",
    });
    const handleZoom = () => updateLabelVisibility(graph);
    const clearSelectionFocus = () => {
      graph.elements()
        .removeClass("is-context-dimmed")
        .removeClass("is-context-focused");
    };
    const updateSelectionFocus = () => {
      const selectedNodes = graph.$("node:selected");
      onSelectionChange(selectedNodes.map((node) => node.id()));
      clearSelectionFocus();
      if (selectedNodes.empty()) return;
      graph.elements().addClass("is-context-dimmed");
      selectedNodes.closedNeighborhood()
        .removeClass("is-context-dimmed")
        .addClass("is-context-focused");
    };
    const clearOnNonNodeTap = (event: cytoscape.EventObject) => {
      if (event.target !== graph && event.target.isNode?.()) return;
      graph.$(":selected").unselect();
      clearSelectionFocus();
    };

    graph.on("zoom", handleZoom);
    graph.on("select unselect", "node", updateSelectionFocus);
    graph.on("tap", clearOnNonNodeTap);
    let lastMiddleClickAt = 0;
    const handleMiddleMouseDown = (event: MouseEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastMiddleClickAt < 350) fitVisibleNodes(graph);
      lastMiddleClickAt = now;
    };
    const preventMiddleClickDefault = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault();
    };
    container.addEventListener("mousedown", handleMiddleMouseDown);
    container.addEventListener("auxclick", preventMiddleClickDefault);
    graphRef.current = graph;
    updateLabelVisibility(graph);

    const resizeObserver = new ResizeObserver(() => graph.resize());
    resizeObserver.observe(container);
    return () => {
      forceLayoutRef.current?.stop();
      graph.off("zoom", handleZoom);
      graph.off("select unselect", "node", updateSelectionFocus);
      graph.off("tap", clearOnNonNodeTap);
      container.removeEventListener("mousedown", handleMiddleMouseDown);
      container.removeEventListener("auxclick", preventMiddleClickDefault);
      graph.destroy();
      resizeObserver.disconnect();
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    if (!snapshot) {
      forceLayoutRef.current?.stop();
      graph.elements().remove();
      topologyRef.current = "";
      onSelectionChange([]);
      return;
    }
    const topology = JSON.stringify({ nodes: snapshot.nodes, edges: snapshot.edges });
    if (topology === topologyRef.current) return;
    topologyRef.current = topology;

    if (graph.elements().empty()) {
      graph.add(toElements(snapshot));
      forceLayoutRef.current?.stop();
      forceLayoutRef.current = startAiryWebLayout(graph);
      updateLabelVisibility(graph, true);
      return;
    }

    const { addedNodeIds, needsForceUpdate } = syncGraphSnapshot(graph, snapshot);
    if (addedNodeIds.length > 0) {
      placeNewNodes(graph, addedNodeIds);
    }
    if (needsForceUpdate) {
      forceLayoutRef.current?.stop();
      forceLayoutRef.current = startContinuousForceLayout(graph);
    }
    updateLabelVisibility(graph, true);
  }, [snapshot]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !selectionRequest) return;
    const node = graph.getElementById(selectionRequest.id);
    if (node.empty()) return;

    if (selectionRequest.additive) {
      if (node.selected()) node.unselect();
      else node.select();
    } else {
      graph.$("node:selected").not(node).unselect();
      node.select();
    }

    if (node.selected()) {
      graph.animate({
        center: { eles: node },
        duration: 400,
        easing: "ease-in-out-cubic",
        queue: false,
      });
    }
  }, [selectionRequest]);

  const fitGraph = () => {
    const graph = graphRef.current;
    if (!graph) return;
    fitVisibleNodes(graph);
  };

  const zoomGraph = (multiplier: number) => {
    const graph = graphRef.current;
    if (!graph || graph.elements().empty()) return;
    const level = Math.min(
      graph.maxZoom(),
      Math.max(graph.minZoom(), (zoomTargetRef.current ?? graph.zoom()) * multiplier),
    );
    zoomTargetRef.current = level;
    // Retarget from the current animated value instead of competing with the previous animation.
    graph.stop();
    graph.animate({
      zoom: {
        level,
        renderedPosition: { x: graph.width() / 2, y: graph.height() / 2 },
      },
      duration: 180,
      easing: "ease-out-cubic",
      complete: () => {
        if (zoomTargetRef.current === level) zoomTargetRef.current = null;
      },
    });
  };

  const resetLayout = () => {
    const graph = graphRef.current;
    if (!graph || graph.elements().empty()) return;
    forceLayoutRef.current?.stop();
    forceLayoutRef.current = startAiryWebLayout(graph);
    updateLabelVisibility(graph, true);
  };

  const saveImage = () => {
    const graph = graphRef.current;
    if (!graph || graph.elements().empty()) return;
    const image = graph.png({
      full: true,
      scale: 2,
      bg: "#11151b",
    });
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = image;
    link.download = `ros2-node-map-${timestamp}.png`;
    link.click();
    exportMenuRef.current?.removeAttribute("open");
  };

  const runExport = (exporter: (value: GraphSnapshot) => void, value = snapshot) => {
    if (!value) return;
    exporter(value);
    exportMenuRef.current?.removeAttribute("open");
  };

  const fileOnly = runtimeReady && !liveAvailable;

  return (
    <section className="graph-panel" aria-label="ROS 2 graph">
      <DomainControl displayedDomainId={snapshot?.ros_domain_id ?? "—"} backendUrl={backendUrl}
        sourceMode={sourceMode} connectionStatus={connectionStatus} fileName={fileName} liveAvailable={liveAvailable}
        onOpenFile={onOpenFile} onResumeLive={onResumeLive} />
      {!snapshot && (
        <div className="empty-state">
          <strong>{!runtimeReady ? "Checking ROS 2 runtime" : fileOnly ? "File-only mode" : "Waiting for graph data"}</strong>
          <span>{fileOnly
            ? runtimeMessage || "ROS 2 is unavailable. Open or drop a graph JSON snapshot."
            : "Start the backend, open a graph JSON file, or check the WebSocket URL."}</span>
          <button type="button" onClick={onOpenFile}>Open graph JSON</button>
        </div>
      )}
      {fileError && <div className="file-error-banner" role="alert">{fileError}</div>}
      {fileDragActive && <div className="file-drop-overlay">
        <strong>Drop graph JSON to open</strong><span>The current graph changes only after validation succeeds.</span>
      </div>}
      <div className="graph-controls" aria-label="Graph view controls">
        <button type="button" onClick={() => zoomGraph(1.2)} disabled={!snapshot} title="Zoom in">
          <span aria-hidden="true">+</span>
          <span className="sr-only">Zoom in</span>
        </button>
        <button type="button" onClick={() => zoomGraph(1 / 1.2)} disabled={!snapshot} title="Zoom out">
          <span aria-hidden="true">−</span>
          <span className="sr-only">Zoom out</span>
        </button>
        <button type="button" onClick={fitGraph} disabled={!snapshot} title="Fit visible nodes">
          <span aria-hidden="true">⛶</span>
          <span className="sr-only">Fit visible nodes</span>
        </button>
        <button type="button" onClick={resetLayout} disabled={!snapshot} title="Reset layout">
          <span aria-hidden="true">↻</span>
          <span className="sr-only">Reset layout</span>
        </button>
        <details className="graph-export-menu" ref={exportMenuRef}>
          <summary title="Export graph" aria-disabled={!snapshot}
            onClick={(event) => { if (!snapshot) event.preventDefault(); }}>
            <span aria-hidden="true">⇩</span><span className="sr-only">Export graph</span>
          </summary>
          <div className="graph-export-options">
            <button type="button" onClick={saveImage} title="Download PNG" aria-label="Download PNG">
              <span className="export-file-icon export-file-icon-png" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => runExport(downloadGraphJson, exportSnapshot)} title="Download JSON" aria-label="Download JSON">
              <span className="export-file-icon export-file-icon-json" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => runExport(downloadMermaidMarkdown)} title="Download Mermaid Markdown" aria-label="Download Mermaid Markdown">
              <span className="export-file-icon export-file-icon-md" aria-hidden="true" />
            </button>
          </div>
        </details>
      </div>
      <div className="graph-canvas" ref={containerRef} />
    </section>
  );
}
