import type { GraphNode, GraphSnapshot } from "../types";

export interface VaultFile {
  path: string;
  content: string;
}

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

function safeFileStem(node: GraphNode, used: Set<string>): string {
  const base = `${node.kind.slice(4)}-${node.label}`
    .replace(/[<>:"/\\|?*#^[\]]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || node.kind.slice(4);
  let stem = base;
  let suffix = 2;
  while (used.has(stem.toLowerCase())) stem = `${base}-${suffix++}`;
  used.add(stem.toLowerCase());
  return stem;
}

function yamlString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

export function graphToObsidianVault(snapshot: GraphSnapshot): VaultFile[] {
  const used = new Set<string>();
  const pathById = new Map<string, string>();
  for (const node of snapshot.nodes) {
    pathById.set(node.id, `Entities/${safeFileStem(node, used)}.md`);
  }
  const linkFor = (node: GraphNode) => {
    const path = pathById.get(node.id)!.slice(0, -3);
    return `[[${path}|${node.label}]]`;
  };
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const files: VaultFile[] = [];

  for (const node of snapshot.nodes) {
    const relationships = snapshot.edges.flatMap((edge) => {
      if (edge.source === node.id) {
        const peer = nodesById.get(edge.target);
        return peer ? [`* \`${edge.kind}\` → ${linkFor(peer)}`] : [];
      }
      if (edge.target === node.id) {
        const peer = nodesById.get(edge.source);
        return peer ? [`* ${linkFor(peer)} → \`${edge.kind}\``] : [];
      }
      return [];
    });
    const details = node.kind === "ros_node"
      ? [`* Name: \`${node.name}\``, `* Namespace: \`${node.namespace}\``]
      : [`* Types: ${node.types?.map((type) => `\`${type}\``).join(", ") || "Unknown"}`];
    files.push({
      path: pathById.get(node.id)!,
      content: [
        "---",
        `ros2_id: ${yamlString(node.id)}`,
        `ros2_kind: ${yamlString(node.kind)}`,
        `ros_domain_id: ${yamlString(snapshot.ros_domain_id)}`,
        "---",
        "",
        `# ${node.label}`,
        "",
        ...details,
        "",
        "## Relationships",
        "",
        ...(relationships.length ? relationships : ["No relationships in this snapshot."]),
        "",
      ].join("\n"),
    });
  }

  const grouped = new Map<GraphNode["kind"], GraphNode[]>();
  for (const node of snapshot.nodes) {
    const items = grouped.get(node.kind) ?? [];
    items.push(node);
    grouped.set(node.kind, items);
  }
  const indexLines = [
    "# ROS 2 Graph",
    "",
    `* Snapshot: ${snapshot.timestamp}`,
    `* ROS_DOMAIN_ID: ${snapshot.ros_domain_id}`,
    `* Nodes: ${snapshot.nodes.length}`,
    `* Edges: ${snapshot.edges.length}`,
    "",
    "```mermaid",
    graphToMermaid(snapshot).trimEnd(),
    "```",
  ];
  for (const [kind, nodes] of grouped) {
    indexLines.push("", `## ${kind}`, "", ...nodes.map((node) => `* ${linkFor(node)}`));
  }
  indexLines.push("");
  files.unshift({ path: "ROS 2 Graph.md", content: indexLines.join("\n") });
  return files;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(value: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of value) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { date: number; time: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

function joinBytes(chunks: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export function createVaultZip(files: VaultFile[], modifiedAt = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  const paths = new Set<string>();
  const { date, time } = dosDateTime(modifiedAt);
  let localOffset = 0;

  for (const file of files) {
    const path = file.path.replaceAll("\\", "/").replace(/^\/+/, "");
    if (!path || paths.has(path)) throw new Error(`Duplicate or empty vault path: ${path}`);
    paths.add(path);
    const name = encoder.encode(path);
    const content = encoder.encode(file.content);
    const checksum = crc32(content);
    const local = new Uint8Array(30 + name.length + content.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, content.length, true);
    localView.setUint32(22, content.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(content, 30 + name.length);
    localChunks.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, content.length, true);
    centralView.setUint32(24, content.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralChunks.push(central);
    localOffset += local.length;
  }

  const central = joinBytes(centralChunks);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);
  return joinBytes([...localChunks, central, end]);
}
