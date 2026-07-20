"""Stable transport model for ROS 2 graph snapshots."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Mapping

SCHEMA_VERSION = "0.1.0"


class NodeKind(str, Enum):
    ROS_NODE = "ros_node"
    ROS_TOPIC = "ros_topic"
    ROS_SERVICE = "ros_service"
    ROS_ACTION = "ros_action"


class EdgeKind(str, Enum):
    PUBLISH = "publish"
    SUBSCRIBE = "subscribe"
    SERVICE_CLIENT = "service_client"
    SERVICE_SERVER = "service_server"
    ACTION_CLIENT = "action_client"
    ACTION_SERVER = "action_server"


_NODE_ID_PREFIX = {
    NodeKind.ROS_NODE: "node",
    NodeKind.ROS_TOPIC: "topic",
    NodeKind.ROS_SERVICE: "service",
    NodeKind.ROS_ACTION: "action",
}


def normalize_ros_name(value: str) -> str:
    """Return a normalized absolute ROS name."""
    if not isinstance(value, str) or not value.strip():
        raise ValueError("ROS name must be a non-empty string")
    parts = [part for part in value.strip().split("/") if part]
    return "/" + "/".join(parts) if parts else "/"


def full_node_name(name: str, namespace: str = "/") -> str:
    """Combine a node base name and namespace."""
    if not isinstance(name, str) or not name.strip():
        raise ValueError("Node name must be a non-empty string")
    clean_name = name.strip().strip("/")
    if not clean_name or "/" in clean_name:
        raise ValueError("Node name must not contain '/' separators")
    return normalize_ros_name(f"{normalize_ros_name(namespace)}/{clean_name}")


def make_node_id(kind: NodeKind | str, ros_name: str) -> str:
    """Build a canonical graph-node identifier."""
    resolved_kind = NodeKind(kind)
    return f"{_NODE_ID_PREFIX[resolved_kind]}:{normalize_ros_name(ros_name)}"


def make_edge_id(kind: EdgeKind | str, source: str, target: str) -> str:
    """Build a canonical directed-edge identifier."""
    resolved_kind = EdgeKind(kind)
    if not source or not target:
        raise ValueError("Edge source and target must be non-empty")
    return f"{resolved_kind.value}:{source}->{target}"


@dataclass(frozen=True, slots=True)
class GraphNode:
    id: str
    kind: NodeKind
    label: str
    name: str | None = None
    namespace: str | None = None
    types: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        kind = NodeKind(self.kind)
        object.__setattr__(self, "kind", kind)
        object.__setattr__(self, "types", tuple(self.types))
        if not self.id or not self.label:
            raise ValueError("Graph node id and label must be non-empty")
        expected_id = make_node_id(kind, self.label)
        if self.id != expected_id:
            raise ValueError(f"Graph node id must be {expected_id!r}")
        if kind is NodeKind.ROS_NODE:
            if self.name is None or self.namespace is None:
                raise ValueError("ros_node requires name and namespace")
            if full_node_name(self.name, self.namespace) != normalize_ros_name(self.label):
                raise ValueError("Node name and namespace must match label")
        elif self.name is not None or self.namespace is not None:
            raise ValueError("Only ros_node may define name and namespace")

    @classmethod
    def ros_node(cls, name: str, namespace: str = "/") -> GraphNode:
        label = full_node_name(name, namespace)
        return cls(
            id=make_node_id(NodeKind.ROS_NODE, label),
            kind=NodeKind.ROS_NODE,
            label=label,
            name=name.strip().strip("/"),
            namespace=normalize_ros_name(namespace),
        )

    @classmethod
    def resource(
        cls, kind: NodeKind | str, ros_name: str, types: tuple[str, ...] = ()
    ) -> GraphNode:
        resolved_kind = NodeKind(kind)
        if resolved_kind is NodeKind.ROS_NODE:
            raise ValueError("Use GraphNode.ros_node() for ROS nodes")
        label = normalize_ros_name(ros_name)
        return cls(
            id=make_node_id(resolved_kind, label),
            kind=resolved_kind,
            label=label,
            types=types,
        )

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "id": self.id,
            "kind": self.kind.value,
            "label": self.label,
        }
        if self.name is not None:
            result["name"] = self.name
        if self.namespace is not None:
            result["namespace"] = self.namespace
        if self.types:
            result["types"] = list(self.types)
        return result

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> GraphNode:
        return cls(
            id=value["id"],
            kind=NodeKind(value["kind"]),
            label=value["label"],
            name=value.get("name"),
            namespace=value.get("namespace"),
            types=tuple(value.get("types", ())),
        )


@dataclass(frozen=True, slots=True)
class GraphEdge:
    id: str
    kind: EdgeKind
    source: str
    target: str

    def __post_init__(self) -> None:
        kind = EdgeKind(self.kind)
        object.__setattr__(self, "kind", kind)
        expected_id = make_edge_id(kind, self.source, self.target)
        if self.id != expected_id:
            raise ValueError(f"Graph edge id must be {expected_id!r}")

    @classmethod
    def create(cls, kind: EdgeKind | str, source: str, target: str) -> GraphEdge:
        resolved_kind = EdgeKind(kind)
        return cls(
            id=make_edge_id(resolved_kind, source, target),
            kind=resolved_kind,
            source=source,
            target=target,
        )

    def to_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "kind": self.kind.value,
            "source": self.source,
            "target": self.target,
        }

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> GraphEdge:
        return cls(
            id=value["id"],
            kind=EdgeKind(value["kind"]),
            source=value["source"],
            target=value["target"],
        )


def _format_timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Graph timestamp must include timezone information")
    return value.isoformat()


@dataclass(frozen=True, slots=True)
class GraphSnapshot:
    timestamp: datetime
    ros_domain_id: str
    nodes: tuple[GraphNode, ...] = field(default_factory=tuple)
    edges: tuple[GraphEdge, ...] = field(default_factory=tuple)
    schema_version: str = SCHEMA_VERSION

    def __post_init__(self) -> None:
        object.__setattr__(self, "ros_domain_id", str(self.ros_domain_id))
        object.__setattr__(self, "nodes", tuple(self.nodes))
        object.__setattr__(self, "edges", tuple(self.edges))
        if self.schema_version != SCHEMA_VERSION:
            raise ValueError(f"Unsupported schema version: {self.schema_version}")
        _format_timestamp(self.timestamp)
        node_ids = [node.id for node in self.nodes]
        edge_ids = [edge.id for edge in self.edges]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("Graph node ids must be unique")
        if len(edge_ids) != len(set(edge_ids)):
            raise ValueError("Graph edge ids must be unique")
        known_nodes = set(node_ids)
        for edge in self.edges:
            if edge.source not in known_nodes or edge.target not in known_nodes:
                raise ValueError(f"Edge {edge.id!r} references an unknown graph node")

    @classmethod
    def empty(
        cls, ros_domain_id: str | int = "0", timestamp: datetime | None = None
    ) -> GraphSnapshot:
        return cls(
            timestamp=timestamp or datetime.now(timezone.utc),
            ros_domain_id=str(ros_domain_id),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "timestamp": _format_timestamp(self.timestamp),
            "ros_domain_id": self.ros_domain_id,
            "nodes": [node.to_dict() for node in self.nodes],
            "edges": [edge.to_dict() for edge in self.edges],
        }

    def to_json(self, *, indent: int | None = None) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=indent)

    @classmethod
    def from_dict(cls, value: Mapping[str, Any]) -> GraphSnapshot:
        timestamp = datetime.fromisoformat(value["timestamp"].replace("Z", "+00:00"))
        return cls(
            schema_version=value["schema_version"],
            timestamp=timestamp,
            ros_domain_id=str(value["ros_domain_id"]),
            nodes=tuple(GraphNode.from_dict(node) for node in value["nodes"]),
            edges=tuple(GraphEdge.from_dict(edge) for edge in value["edges"]),
        )

    @classmethod
    def from_json(cls, value: str) -> GraphSnapshot:
        decoded = json.loads(value)
        if not isinstance(decoded, dict):
            raise ValueError("Graph snapshot JSON must contain an object")
        return cls.from_dict(decoded)
