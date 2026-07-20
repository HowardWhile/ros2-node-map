export const GRAPH_SCHEMA_VERSION = "0.1.0" as const;
export type GraphSchemaVersion = typeof GRAPH_SCHEMA_VERSION;

export type GraphNodeKind =
  | "ros_node"
  | "ros_topic"
  | "ros_service"
  | "ros_action";

export type GraphEdgeKind =
  | "publish"
  | "subscribe"
  | "service_client"
  | "service_server"
  | "action_client"
  | "action_server";

interface GraphNodeBase {
  id: string;
  kind: GraphNodeKind;
  label: string;
}

export interface RosNode extends GraphNodeBase {
  kind: "ros_node";
  name: string;
  namespace: string;
}

export interface RosResourceNode extends GraphNodeBase {
  kind: "ros_topic" | "ros_service" | "ros_action";
  types?: string[];
}

export type GraphNode = RosNode | RosResourceNode;

export interface GraphEdge {
  id: string;
  kind: GraphEdgeKind;
  source: string;
  target: string;
}

export interface GraphSnapshot {
  schema_version: GraphSchemaVersion;
  timestamp: string;
  ros_domain_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}
