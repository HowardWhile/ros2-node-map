"""Infer ROS 2 action graph elements from internal topics and services."""

from __future__ import annotations

from collections.abc import Iterable

from .graph_model import EdgeKind, GraphEdge, GraphNode, NodeKind, normalize_ros_name

_ACTION_MARKER = "/_action/"
_ACTION_CHANNELS = {
    "send_goal",
    "get_result",
    "cancel_goal",
    "feedback",
    "status",
}
_ACTION_TYPE_SUFFIXES = (
    "_SendGoal",
    "_GetResult",
    "_FeedbackMessage",
    "_Feedback",
    "_StatusMessage",
)


def action_name_from_resource(name: str) -> str | None:
    """Return the action name for a recognized action-internal resource."""
    normalized_name = normalize_ros_name(name)
    prefix, marker, channel = normalized_name.partition(_ACTION_MARKER)
    if not marker or channel not in _ACTION_CHANNELS or not prefix:
        return None
    return prefix


def action_type_from_resource(types: Iterable[str]) -> tuple[str, ...]:
    """Derive action type names from action protocol resource types."""
    action_types: set[str] = set()
    for resource_type in types:
        for suffix in _ACTION_TYPE_SUFFIXES:
            if resource_type.endswith(suffix):
                action_types.add(resource_type[: -len(suffix)])
                break
    return tuple(sorted(action_types))


class ActionGraphReader:
    """Build high-level action nodes and client/server relationships."""

    def read(
        self, graph_nodes: Iterable[GraphNode], graph_edges: Iterable[GraphEdge]
    ) -> tuple[tuple[GraphNode, ...], tuple[GraphEdge, ...]]:
        internal_resources: dict[str, str] = {}
        action_types: dict[str, set[str]] = {}
        for node in graph_nodes:
            if node.kind not in {NodeKind.ROS_TOPIC, NodeKind.ROS_SERVICE}:
                continue
            action_name = action_name_from_resource(node.label)
            if action_name is None:
                continue
            internal_resources[node.id] = action_name
            action_types.setdefault(action_name, set()).update(
                action_type_from_resource(node.types)
            )

        nodes: dict[str, GraphNode] = {}
        edges: dict[str, GraphEdge] = {}
        for action_name, types in action_types.items():
            action = GraphNode.resource(
                NodeKind.ROS_ACTION, action_name, tuple(sorted(types))
            )
            nodes[action.id] = action

        for edge in graph_edges:
            if edge.kind is EdgeKind.SERVICE_CLIENT and edge.target in internal_resources:
                action = GraphNode.resource(NodeKind.ROS_ACTION, internal_resources[edge.target])
                action_edge = GraphEdge.create(EdgeKind.ACTION_CLIENT, edge.source, action.id)
                edges[action_edge.id] = action_edge
            elif edge.kind is EdgeKind.SERVICE_SERVER and edge.source in internal_resources:
                action = GraphNode.resource(NodeKind.ROS_ACTION, internal_resources[edge.source])
                action_edge = GraphEdge.create(EdgeKind.ACTION_SERVER, action.id, edge.target)
                edges[action_edge.id] = action_edge
            elif edge.kind is EdgeKind.PUBLISH and edge.target in internal_resources:
                action = GraphNode.resource(NodeKind.ROS_ACTION, internal_resources[edge.target])
                action_edge = GraphEdge.create(EdgeKind.ACTION_SERVER, action.id, edge.source)
                edges[action_edge.id] = action_edge
            elif edge.kind is EdgeKind.SUBSCRIBE and edge.source in internal_resources:
                action = GraphNode.resource(NodeKind.ROS_ACTION, internal_resources[edge.source])
                action_edge = GraphEdge.create(EdgeKind.ACTION_CLIENT, edge.target, action.id)
                edges[action_edge.id] = action_edge

        return tuple(nodes.values()), tuple(edges.values())
