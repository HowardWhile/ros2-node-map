from dataclasses import dataclass
from datetime import datetime, timezone

from ros2_node_map.graph_reader import GraphReader


@dataclass
class Endpoint:
    node_name: str
    node_namespace: str


class FakeRosNode:
    def get_node_names_and_namespaces(self):
        return [("talker", "/demo"), ("listener", "/demo")]

    def get_topic_names_and_types(self):
        return [
            ("/chatter", ["std_msgs/msg/String"]),
            ("/unused", ["example_interfaces/msg/Empty"]),
        ]

    def get_publishers_info_by_topic(self, topic_name):
        if topic_name == "/chatter":
            return [Endpoint("talker", "/demo")]
        return []

    def get_subscriptions_info_by_topic(self, topic_name):
        if topic_name == "/chatter":
            return [Endpoint("listener", "/demo")]
        return []


def test_reader_builds_topic_graph_snapshot() -> None:
    timestamp = datetime(2026, 7, 8, tzinfo=timezone.utc)
    snapshot = GraphReader(
        FakeRosNode(), ros_domain_id="42", now=lambda: timestamp
    ).snapshot()

    assert snapshot.timestamp == timestamp
    assert snapshot.ros_domain_id == "42"
    assert [node.id for node in snapshot.nodes] == [
        "node:/demo/listener",
        "node:/demo/talker",
        "topic:/chatter",
        "topic:/unused",
    ]
    assert [edge.id for edge in snapshot.edges] == [
        "publish:node:/demo/talker->topic:/chatter",
        "subscribe:topic:/chatter->node:/demo/listener",
    ]


def test_reader_deduplicates_repeated_endpoint_edges() -> None:
    class RepeatedEndpointNode(FakeRosNode):
        def get_publishers_info_by_topic(self, topic_name):
            endpoint = Endpoint("talker", "/demo")
            return [endpoint, endpoint] if topic_name == "/chatter" else []

    snapshot = GraphReader(RepeatedEndpointNode()).snapshot()
    publish_edges = [edge for edge in snapshot.edges if edge.kind.value == "publish"]
    assert len(publish_edges) == 1
