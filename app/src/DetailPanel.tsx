import { useEffect, useMemo, useState } from "react";

import type { GraphEdgeKind, GraphNode, GraphSnapshot } from "./types";

interface DetailPanelProps {
  snapshot: GraphSnapshot | null;
  selectedNodeIds: string[];
  onSelectNode: (id: string) => void;
}

const RELATION_LABELS: Record<GraphEdgeKind, string> = {
  publish: "Publishes to", subscribe: "Subscribes to",
  service_client: "Service clients", service_server: "Service servers",
  action_client: "Action clients", action_server: "Action servers",
};

function commandFor(node: GraphNode): string {
  switch (node.kind) {
    case "ros_node": return `ros2 node info ${node.label}`;
    case "ros_topic": return `ros2 topic info ${node.label}`;
    case "ros_service": return `ros2 service type ${node.label}`;
    case "ros_action": return `ros2 action info ${node.label}`;
  }
}

export function DetailPanel({
  snapshot,
  selectedNodeIds,
  onSelectNode,
}: DetailPanelProps) {
  const [copied, setCopied] = useState(false);
  const selectedNodes = useMemo(
    () => selectedNodeIds.map((id) => snapshot?.nodes.find((node) => node.id === id))
      .filter((node): node is GraphNode => Boolean(node)),
    [selectedNodeIds, snapshot],
  );
  const selected = selectedNodes.length === 1 ? selectedNodes[0] : null;

  useEffect(() => setCopied(false), [selected?.id]);

  const relationships = useMemo(() => {
    if (!snapshot || !selected) return [];
    const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
    const groups = new Map<GraphEdgeKind, GraphNode[]>();
    for (const edge of snapshot.edges) {
      if (edge.source !== selected.id && edge.target !== selected.id) continue;
      const peerId = edge.source === selected.id ? edge.target : edge.source;
      const peer = nodesById.get(peerId);
      if (!peer) continue;
      const peers = groups.get(edge.kind) ?? [];
      if (!peers.some((item) => item.id === peer.id)) peers.push(peer);
      groups.set(edge.kind, peers);
    }
    return [...groups.entries()];
  }, [selected, snapshot]);

  const actionInternals = useMemo(() => {
    if (!snapshot || selected?.kind !== "ros_action") return [];
    const prefix = `${selected.label}/_action/`;
    return snapshot.nodes
      .filter((node) => (node.kind === "ros_topic" || node.kind === "ros_service") && node.label.startsWith(prefix))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [selected, snapshot]);

  const copyCommand = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(commandFor(selected));
    setCopied(true);
  };

  return (
    <aside className="detail-panel" aria-label="Selected graph item">
      <header className="detail-header">
        <span className="panel-heading">Details</span>
      </header>
      {!selected ? (
        <div className="detail-empty">
          {selectedNodes.length > 1 ? `${selectedNodes.length} items selected` : "Select an item to inspect it"}
        </div>
      ) : (
        <div className="detail-content">
          <span className={`detail-kind detail-kind-${selected.kind}`}>{selected.kind.slice(4)}</span>
          <h2>{selected.label}</h2>
          <dl className="detail-fields">
            {selected.kind === "ros_node" ? (
              <><dt>Name</dt><dd>{selected.name}</dd><dt>Namespace</dt><dd>{selected.namespace}</dd></>
            ) : (
              <><dt>Type</dt><dd>{selected.types?.join(", ") || "Unknown"}</dd></>
            )}
          </dl>
          {relationships.map(([kind, peers]) => (
            <section className="detail-relations" key={kind}>
              <h3>{RELATION_LABELS[kind]} <span>{peers.length}</span></h3>
              {peers.map((peer) => (
                <button key={peer.id} type="button" title={`Select ${peer.label}`}
                  onClick={() => onSelectNode(peer.id)}>{peer.label}</button>
              ))}
            </section>
          ))}
          {actionInternals.length > 0 && (
            <section className="detail-relations">
              <h3>Internal channels <span>{actionInternals.length}</span></h3>
              {actionInternals.map((channel) => (
                <div className="detail-internal-channel" key={channel.id}>
                  <span>{channel.kind === "ros_service" ? "Service" : "Topic"}</span>
                  {channel.label}
                </div>
              ))}
            </section>
          )}
          <section className="detail-command">
            <h3>ROS 2 command</h3><code>{commandFor(selected)}</code>
            <button type="button" onClick={copyCommand}>{copied ? "Copied" : "Copy"}</button>
          </section>
        </div>
      )}
    </aside>
  );
}
