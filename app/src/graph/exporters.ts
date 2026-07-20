import type { GraphNode, GraphSnapshot } from "../types";

const KIND_CLASS: Record<GraphNode["kind"], string> = {
  ros_node: "rosNode",
  ros_topic: "rosTopic",
  ros_service: "rosService",
  ros_action: "rosAction",
};

function mermaidLabel(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/[\r\n]+/g, " ");
}

function mermaidNode(id: string, node: GraphNode): string {
  const label = mermaidLabel(node.label);
  switch (node.kind) {
    case "ros_node": return `    ${id}(("${label}"))`;
    case "ros_topic": return `    ${id}(["${label}"])`;
    case "ros_service": return `    ${id}["${label}"]`;
    case "ros_action": return `    ${id}{"${label}"}`;
  }
}

export function graphToMermaid(snapshot: GraphSnapshot): string {
  const ids = new Map(snapshot.nodes.map((node, index) => [node.id, `n${index}`]));
  const lines = ["flowchart LR"];
  for (const node of snapshot.nodes) lines.push(mermaidNode(ids.get(node.id)!, node));
  for (const edge of snapshot.edges) {
    lines.push(`    ${ids.get(edge.source)} -->|${edge.kind}| ${ids.get(edge.target)}`);
  }
  lines.push(
    "    classDef rosNode fill:#7aa2f7,stroke:#9ebcff,color:#11151b",
    "    classDef rosTopic fill:#73daca,stroke:#a6eee7,color:#11151b",
    "    classDef rosService fill:#e0af68,stroke:#f0ca8e,color:#11151b",
    "    classDef rosAction fill:#bb9af7,stroke:#d4bdfb,color:#11151b",
  );
  const classes = new Map<string, string[]>();
  for (const node of snapshot.nodes) {
    const className = KIND_CLASS[node.kind];
    const members = classes.get(className) ?? [];
    members.push(ids.get(node.id)!);
    classes.set(className, members);
  }
  for (const [className, members] of classes) {
    lines.push(`    class ${members.join(",")} ${className}`);
  }
  return `${lines.join("\n")}\n`;
}

export function graphToMermaidMarkdown(snapshot: GraphSnapshot): string {
  return [
    "# ROS 2 Graph",
    "",
    `Snapshot: ${snapshot.timestamp}`,
    `ROS_DOMAIN_ID: ${snapshot.ros_domain_id}`,
    "",
    "```mermaid",
    graphToMermaid(snapshot).trimEnd(),
    "```",
    "",
  ].join("\n");
}

export function graphToJson(snapshot: GraphSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
