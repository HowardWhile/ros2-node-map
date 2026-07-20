import { useState } from "react";

import type { GraphNode, GraphNodeKind, GraphSnapshot } from "./types";

interface SidebarProps {
  snapshot: GraphSnapshot | null;
  selectedNodeIds: string[];
  onSelectNode: (id: string, additive: boolean) => void;
  showDebugResources: boolean;
  onShowDebugResourcesChange: (show: boolean) => void;
  showInfrastructureResources: boolean;
  onShowInfrastructureResourcesChange: (show: boolean) => void;
  showCommonServices: boolean;
  onShowCommonServicesChange: (show: boolean) => void;
  showLifecycleServices: boolean;
  onShowLifecycleServicesChange: (show: boolean) => void;
  showActionInternals: boolean;
  onShowActionInternalsChange: (show: boolean) => void;
  showTopics: boolean;
  onShowTopicsChange: (show: boolean) => void;
  showServices: boolean;
  onShowServicesChange: (show: boolean) => void;
  showActions: boolean;
  onShowActionsChange: (show: boolean) => void;
}

interface TreeGroup { kind: GraphNodeKind; label: string; }

const TREE_GROUPS: TreeGroup[] = [
  { kind: "ros_node", label: "Nodes" },
  { kind: "ros_topic", label: "Topics" },
  { kind: "ros_service", label: "Services" },
  { kind: "ros_action", label: "Actions" },
];

function nodesOfKind(snapshot: GraphSnapshot | null, kind: GraphNodeKind, query: string): GraphNode[] {
  return (snapshot?.nodes ?? [])
    .filter((node) => node.kind === kind && node.label.toLowerCase().includes(query))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function Sidebar({
  snapshot, selectedNodeIds, onSelectNode,
  showDebugResources, onShowDebugResourcesChange,
  showInfrastructureResources, onShowInfrastructureResourcesChange,
  showCommonServices, onShowCommonServicesChange,
  showLifecycleServices, onShowLifecycleServicesChange,
  showActionInternals, onShowActionInternalsChange,
  showTopics, onShowTopicsChange,
  showServices, onShowServicesChange,
  showActions, onShowActionsChange,
}: SidebarProps) {
  const [filter, setFilter] = useState("");
  const selectedIds = new Set(selectedNodeIds);
  const hasSelection = selectedIds.size > 0;
  const normalizedFilter = filter.trim().toLowerCase();
  const filteredTotal = (snapshot?.nodes ?? []).filter((node) =>
    node.label.toLowerCase().includes(normalizedFilter),
  ).length;

  return (
    <aside className="graph-sidebar" aria-label="ROS graph explorer">
      <header className="sidebar-header">
        <span className="panel-heading">Explorer</span>
        <span className="sidebar-total">
          {normalizedFilter ? `${filteredTotal} / ${snapshot?.nodes.length ?? 0}` : snapshot?.nodes.length ?? 0}
        </span>
      </header>
      <>
        <div className="sidebar-filter">
          <span aria-hidden="true">/</span>
          <input type="search" aria-label="Filter ROS entities by name" placeholder="Filter by name..."
            value={filter} onChange={(event) => setFilter(event.target.value)} />
          {filter && <button type="button" aria-label="Clear filter" onClick={() => setFilter("")}>x</button>}
        </div>
        <div className="sidebar-options">
          <label className={`filter-toggle filter-toggle-topic${showTopics ? " is-active" : ""}`}>
            <input type="checkbox" checked={showTopics}
              onChange={(event) => onShowTopicsChange(event.target.checked)} />
            <span>Topics</span>
          </label>
          <label className={`filter-toggle filter-toggle-service${showServices ? " is-active" : ""}`}>
            <input type="checkbox" checked={showServices}
              onChange={(event) => onShowServicesChange(event.target.checked)} />
            <span>Services</span>
          </label>
          <label className={`filter-toggle filter-toggle-action${showActions ? " is-active" : ""}`}>
            <input type="checkbox" checked={showActions}
              onChange={(event) => onShowActionsChange(event.target.checked)} />
            <span>Actions</span>
          </label>
          <label className={`filter-toggle filter-toggle-topic${showDebugResources ? " is-active" : ""}`}>
            <input type="checkbox" checked={showDebugResources}
              onChange={(event) => onShowDebugResourcesChange(event.target.checked)} />
            <span>Debug</span>
          </label>
          <label className={`filter-toggle filter-toggle-topic${showInfrastructureResources ? " is-active" : ""}`}>
            <input type="checkbox" checked={showInfrastructureResources}
              onChange={(event) => onShowInfrastructureResourcesChange(event.target.checked)} />
            <span>Infrastructure</span>
          </label>
          <label className={`filter-toggle filter-toggle-common-services${showCommonServices ? " is-active" : ""}`}>
            <input type="checkbox" checked={showCommonServices}
              onChange={(event) => onShowCommonServicesChange(event.target.checked)} />
            <span>Common services</span>
          </label>
          <label className={`filter-toggle filter-toggle-lifecycle${showLifecycleServices ? " is-active" : ""}`}>
            <input type="checkbox" checked={showLifecycleServices}
              onChange={(event) => onShowLifecycleServicesChange(event.target.checked)} />
            <span>Lifecycle</span>
          </label>
          <label className={`filter-toggle filter-toggle-action-internals${showActionInternals ? " is-active" : ""}`}>
            <input type="checkbox" checked={showActionInternals}
              onChange={(event) => onShowActionInternalsChange(event.target.checked)} />
            <span>Action internals</span>
          </label>
        </div>
        <nav className="resource-tree" aria-label="ROS entities by kind">
          {TREE_GROUPS.map(({ kind, label }) => {
            const nodes = nodesOfKind(snapshot, kind, normalizedFilter);
            return (
              <details className="tree-group" key={kind} open>
                <summary>
                  <span className="tree-folder-icon" aria-hidden="true" />
                  <span className="tree-folder-label">{label}</span>
                  <span className="tree-count">{nodes.length}</span>
                </summary>
                <div className="tree-children">
                  {nodes.length === 0 ? (
                    <span className="tree-empty">
                      {normalizedFilter ? "No matching items" : `No discovered ${label.toLowerCase()}`}
                    </span>
                  ) : nodes.map((node) => (
                    <button className={`tree-item${selectedIds.has(node.id) ? " is-selected" : hasSelection ? " is-unselected" : ""}`}
                      key={node.id} title={node.label} type="button" aria-pressed={selectedIds.has(node.id)}
                      onClick={(event) => onSelectNode(node.id, event.ctrlKey || event.metaKey)}>
                      <span className={`tree-kind-dot tree-kind-${node.kind}`} aria-hidden="true" />
                      <span>{node.label}</span>
                    </button>
                  ))}
                </div>
              </details>
            );
          })}
        </nav>
      </>
    </aside>
  );
}
