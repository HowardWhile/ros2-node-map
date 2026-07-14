"""Read ROS 2 service discovery data into graph elements."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from .graph_model import EdgeKind, GraphEdge, GraphNode, NodeKind, normalize_ros_name


class ServiceGraphReader:
    """Build service nodes and client/server edges from ROS graph discovery."""

    def __init__(self, node: Any) -> None:
        self._node = node

    def read(
        self, node_names_and_namespaces: Iterable[tuple[str, str]]
    ) -> tuple[tuple[GraphNode, ...], tuple[GraphEdge, ...]]:
        service_types: dict[str, set[str]] = {}
        nodes: dict[str, GraphNode] = {}
        edges: dict[str, GraphEdge] = {}

        def add_service(name: str, types: Iterable[str]) -> GraphNode:
            service_name = normalize_ros_name(name)
            service_types.setdefault(service_name, set()).update(types)
            service = GraphNode.resource(
                NodeKind.ROS_SERVICE,
                service_name,
                tuple(sorted(service_types[service_name])),
            )
            nodes[service.id] = service
            return service

        for service_name, types in self._service_names_and_types():
            add_service(service_name, types)

        for node_name, namespace in node_names_and_namespaces:
            graph_node = GraphNode.ros_node(node_name, namespace)
            nodes[graph_node.id] = graph_node
            for service_name, types in self._services_for_node(
                "get_client_names_and_types_by_node", node_name, namespace
            ):
                service = add_service(service_name, types)
                edge = GraphEdge.create(EdgeKind.SERVICE_CLIENT, graph_node.id, service.id)
                edges[edge.id] = edge
            for service_name, types in self._services_for_node(
                "get_service_names_and_types_by_node", node_name, namespace
            ):
                service = add_service(service_name, types)
                edge = GraphEdge.create(EdgeKind.SERVICE_SERVER, service.id, graph_node.id)
                edges[edge.id] = edge

        return tuple(nodes.values()), tuple(edges.values())

    def _service_names_and_types(self) -> Iterable[tuple[str, Iterable[str]]]:
        method = getattr(self._node, "get_service_names_and_types", None)
        return method() if callable(method) else ()

    def _services_for_node(
        self, method_name: str, node_name: str, namespace: str
    ) -> Iterable[tuple[str, Iterable[str]]]:
        method = getattr(self._node, method_name, None)
        return method(node_name, namespace) if callable(method) else ()
