"""Read ROS 2 node/topic discovery data into graph snapshots."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Callable

from .graph_model import EdgeKind, GraphEdge, GraphNode, GraphSnapshot, NodeKind


class GraphReader:
    """Build complete topic graph snapshots from an rclpy node."""

    def __init__(
        self,
        node: Any,
        *,
        ros_domain_id: str | None = None,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self._node = node
        self._ros_domain_id = ros_domain_id or os.environ.get("ROS_DOMAIN_ID", "0")
        self._now = now or (lambda: datetime.now(timezone.utc))

    def snapshot(self) -> GraphSnapshot:
        nodes: dict[str, GraphNode] = {}
        edges: dict[str, GraphEdge] = {}

        for name, namespace in self._node.get_node_names_and_namespaces():
            graph_node = GraphNode.ros_node(name, namespace)
            nodes[graph_node.id] = graph_node

        for topic_name, topic_types in self._node.get_topic_names_and_types():
            topic = GraphNode.resource(
                NodeKind.ROS_TOPIC, topic_name, tuple(sorted(set(topic_types)))
            )
            nodes[topic.id] = topic

            for endpoint in self._node.get_publishers_info_by_topic(topic_name):
                publisher = self._endpoint_node(endpoint)
                nodes[publisher.id] = publisher
                edge = GraphEdge.create(EdgeKind.PUBLISH, publisher.id, topic.id)
                edges[edge.id] = edge

            for endpoint in self._node.get_subscriptions_info_by_topic(topic_name):
                subscriber = self._endpoint_node(endpoint)
                nodes[subscriber.id] = subscriber
                edge = GraphEdge.create(EdgeKind.SUBSCRIBE, topic.id, subscriber.id)
                edges[edge.id] = edge

        return GraphSnapshot(
            timestamp=self._now(),
            ros_domain_id=self._ros_domain_id,
            nodes=tuple(sorted(nodes.values(), key=lambda item: item.id)),
            edges=tuple(sorted(edges.values(), key=lambda item: item.id)),
        )

    @staticmethod
    def _endpoint_node(endpoint: Any) -> GraphNode:
        return GraphNode.ros_node(endpoint.node_name, endpoint.node_namespace)
