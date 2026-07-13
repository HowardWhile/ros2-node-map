import cytoscape, {
  type Core,
  type ElementDefinition,
  type Layouts,
} from "cytoscape";
import cola from "cytoscape-cola";
import { useEffect, useRef } from "react";

import type { GraphSnapshot } from "./types";

export interface GraphSelectionRequest {
  id: string;
  additive: boolean;
  token: number;
}

interface GraphViewProps {
  snapshot: GraphSnapshot | null;
  selectionRequest: GraphSelectionRequest | null;
  onSelectionChange: (selectedIds: string[]) => void;
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

export function GraphView({
  snapshot,
  selectionRequest,
  onSelectionChange,
}: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Core | null>(null);
  const forceLayoutRef = useRef<Layouts | null>(null);
  const topologyRef = useRef("");

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const graph = cytoscape({
      container,
      elements: [],
      style: graphStyle,
      minZoom: 0.08,
      maxZoom: 4,
      wheelSensitivity: 0.2,
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
    graphRef.current = graph;
    updateLabelVisibility(graph);

    const resizeObserver = new ResizeObserver(() => graph.resize());
    resizeObserver.observe(container);
    return () => {
      forceLayoutRef.current?.stop();
      graph.off("zoom", handleZoom);
      graph.off("select unselect", "node", updateSelectionFocus);
      graph.off("tap", clearOnNonNodeTap);
      graph.destroy();
      resizeObserver.disconnect();
      graphRef.current = null;
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !snapshot) return;
    const topology = JSON.stringify({ nodes: snapshot.nodes, edges: snapshot.edges });
    if (topology === topologyRef.current) return;
    topologyRef.current = topology;

    forceLayoutRef.current?.stop();
    graph.batch(() => {
      graph.elements().remove();
      graph.add(toElements(snapshot));
    });

    forceLayoutRef.current = startAiryWebLayout(graph);
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
    if (!graph || graph.elements().empty()) return;
    graph.animate({
      fit: { eles: graph.elements(), padding: 45 },
      duration: 550,
      easing: "ease-in-out-cubic",
      queue: false,
      complete: () => updateLabelVisibility(graph, true),
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
  };

  return (
    <section className="graph-panel" aria-label="ROS 2 graph">
      {!snapshot && (
        <div className="empty-state">
          <strong>Waiting for graph data</strong>
          <span>Start the backend or check the WebSocket URL.</span>
        </div>
      )}
      <div className="graph-controls" aria-label="Graph view controls">
        <button type="button" onClick={fitGraph} disabled={!snapshot} title="Fit all nodes">
          <span aria-hidden="true">⛶</span>
          <span className="sr-only">Fit all nodes</span>
        </button>
        <button type="button" onClick={resetLayout} disabled={!snapshot} title="Reset layout">
          <span aria-hidden="true">↻</span>
          <span className="sr-only">Reset layout</span>
        </button>
        <button type="button" onClick={saveImage} disabled={!snapshot} title="Save graph as PNG">
          <span aria-hidden="true">⇩</span>
          <span className="sr-only">Save graph as PNG</span>
        </button>
      </div>
      <div className="graph-canvas" ref={containerRef} />
    </section>
  );
}
