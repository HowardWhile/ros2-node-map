import {
  GRAPH_SCHEMA_VERSION,
  type GraphEdge,
  type GraphEdgeKind,
  type GraphNode,
  type GraphNodeKind,
  type GraphSnapshot,
} from "../types.ts";

const NODE_KINDS = new Set<GraphNodeKind>([
  "ros_node", "ros_topic", "ros_service", "ros_action",
]);
const EDGE_KINDS = new Set<GraphEdgeKind>([
  "publish", "subscribe", "service_client", "service_server",
  "action_client", "action_server",
]);
const RESOURCE_PREFIXES: Record<Exclude<GraphNodeKind, "ros_node">, string> = {
  ros_topic: "topic:/",
  ros_service: "service:/",
  ros_action: "action:/",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value: Record<string, unknown>, allowed: string[], context: string): void {
  const unexpected = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpected) throw new Error(`${context} contains unsupported field "${unexpected}"`);
}

function requiredString(value: Record<string, unknown>, key: string, context: string): string {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) {
    throw new Error(`${context}.${key} must be a non-empty string`);
  }
  return field;
}

function parseTypes(value: Record<string, unknown>, context: string): string[] | undefined {
  if (value.types === undefined) return undefined;
  if (!Array.isArray(value.types) || value.types.some((item) => typeof item !== "string" || !item)) {
    throw new Error(`${context}.types must contain non-empty strings`);
  }
  if (new Set(value.types).size !== value.types.length) {
    throw new Error(`${context}.types must not contain duplicates`);
  }
  return [...value.types] as string[];
}

function parseNode(value: unknown, index: number): GraphNode {
  const context = `nodes[${index}]`;
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  const kind = requiredString(value, "kind", context) as GraphNodeKind;
  if (!NODE_KINDS.has(kind)) throw new Error(`${context}.kind is unsupported`);
  const id = requiredString(value, "id", context);
  const label = requiredString(value, "label", context);
  if (!label.startsWith("/")) throw new Error(`${context}.label must be an absolute ROS name`);

  if (kind === "ros_node") {
    assertExactKeys(value, ["id", "kind", "label", "name", "namespace"], context);
    if (!id.startsWith("node:/")) throw new Error(`${context}.id must start with "node:/"`);
    const name = requiredString(value, "name", context);
    const namespace = requiredString(value, "namespace", context);
    if (!namespace.startsWith("/")) throw new Error(`${context}.namespace must start with "/"`);
    return { id, kind, label, name, namespace };
  }

  assertExactKeys(value, ["id", "kind", "label", "types"], context);
  if (!id.startsWith(RESOURCE_PREFIXES[kind])) {
    throw new Error(`${context}.id does not match ${kind}`);
  }
  const types = parseTypes(value, context);
  return types ? { id, kind, label, types } : { id, kind, label };
}

function parseEdge(value: unknown, index: number, nodeIds: Set<string>): GraphEdge {
  const context = `edges[${index}]`;
  if (!isRecord(value)) throw new Error(`${context} must be an object`);
  assertExactKeys(value, ["id", "kind", "source", "target"], context);
  const id = requiredString(value, "id", context);
  const kind = requiredString(value, "kind", context) as GraphEdgeKind;
  if (!EDGE_KINDS.has(kind)) throw new Error(`${context}.kind is unsupported`);
  const source = requiredString(value, "source", context);
  const target = requiredString(value, "target", context);
  if (!nodeIds.has(source) || !nodeIds.has(target)) {
    throw new Error(`${context} references a node that is not present in this snapshot`);
  }
  if (id !== `${kind}:${source}->${target}`) {
    throw new Error(`${context}.id does not match its kind, source, and target`);
  }
  return { id, kind, source, target };
}

export function validateGraphSnapshot(value: unknown): GraphSnapshot {
  if (!isRecord(value)) throw new Error("Graph snapshot must be an object");
  assertExactKeys(value, ["schema_version", "timestamp", "ros_domain_id", "nodes", "edges"], "snapshot");
  if (value.schema_version !== GRAPH_SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${String(value.schema_version ?? "missing")}`);
  }
  const timestamp = requiredString(value, "timestamp", "snapshot");
  if (Number.isNaN(Date.parse(timestamp))) throw new Error("snapshot.timestamp must be a valid date-time");
  const rosDomainId = requiredString(value, "ros_domain_id", "snapshot");
  if (!/^\d+$/.test(rosDomainId)) throw new Error("snapshot.ros_domain_id must contain digits only");
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error("snapshot.nodes and snapshot.edges must be arrays");
  }

  const nodes = value.nodes.map(parseNode);
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) throw new Error("snapshot.nodes contains duplicate IDs");
  const edges = value.edges.map((edge, index) => parseEdge(edge, index, nodeIds));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  if (edgeIds.size !== edges.length) throw new Error("snapshot.edges contains duplicate IDs");

  return {
    schema_version: GRAPH_SCHEMA_VERSION,
    timestamp,
    ros_domain_id: rosDomainId,
    nodes,
    edges,
  };
}

export function parseGraphSnapshot(raw: string): GraphSnapshot {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown JSON error";
    throw new Error(`Invalid graph JSON: ${detail}`);
  }
  try {
    return validateGraphSnapshot(value);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown schema error";
    throw new Error(`Invalid graph snapshot: ${detail}`);
  }
}
