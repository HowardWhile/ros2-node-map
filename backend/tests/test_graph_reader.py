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

    def get_service_names_and_types(self):
        return []

    def get_client_names_and_types_by_node(self, node_name, namespace):
        return []

    def get_service_names_and_types_by_node(self, node_name, namespace):
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


def test_reader_builds_service_client_and_server_edges() -> None:
    class ServiceNode(FakeRosNode):
        def get_service_names_and_types(self):
            return [("/add_two_ints", ["example_interfaces/srv/AddTwoInts"])]

        def get_client_names_and_types_by_node(self, node_name, namespace):
            if (node_name, namespace) == ("listener", "/demo"):
                return [("/add_two_ints", ["example_interfaces/srv/AddTwoInts"])]
            return []

        def get_service_names_and_types_by_node(self, node_name, namespace):
            if (node_name, namespace) == ("talker", "/demo"):
                return [("/add_two_ints", ["example_interfaces/srv/AddTwoInts"])]
            return []

    snapshot = GraphReader(ServiceNode()).snapshot()

    service = next(node for node in snapshot.nodes if node.id == "service:/add_two_ints")
    assert service.types == ("example_interfaces/srv/AddTwoInts",)
    assert [edge.id for edge in snapshot.edges if edge.kind.value.startswith("service_")] == [
        "service_client:node:/demo/listener->service:/add_two_ints",
        "service_server:service:/add_two_ints->node:/demo/talker",
    ]
