from datetime import datetime, timezone
import json

import pytest

from ros2_node_map.graph_model import (
    SCHEMA_VERSION,
    EdgeKind,
    GraphEdge,
    GraphNode,
    GraphSnapshot,
    NodeKind,
    full_node_name,
    make_edge_id,
    make_node_id,
    normalize_ros_name,
)


def test_ros_names_are_normalized_and_combined() -> None:
    assert normalize_ros_name("camera//image") == "/camera/image"
    assert full_node_name("listener", "/demo/") == "/demo/listener"
    assert full_node_name("talker") == "/talker"


def test_invalid_base_node_name_is_rejected() -> None:
    with pytest.raises(ValueError, match="separators"):
        full_node_name("demo/listener", "/")


def test_node_ids_are_stable_for_each_kind() -> None:
    assert make_node_id(NodeKind.ROS_NODE, "/demo/talker") == "node:/demo/talker"
    assert make_node_id(NodeKind.ROS_TOPIC, "chatter") == "topic:/chatter"
    assert make_node_id(NodeKind.ROS_SERVICE, "/add") == "service:/add"
    assert make_node_id(NodeKind.ROS_ACTION, "/navigate") == "action:/navigate"


def test_edge_id_is_stable() -> None:
    assert make_edge_id(
        EdgeKind.PUBLISH, "node:/talker", "topic:/chatter"
    ) == "publish:node:/talker->topic:/chatter"


def test_graph_node_factories_match_transport_shape() -> None:
    node = GraphNode.ros_node("talker", "/demo")
    topic = GraphNode.resource(
        NodeKind.ROS_TOPIC, "/chatter", ("std_msgs/msg/String",)
    )
    assert node.to_dict() == {
        "id": "node:/demo/talker",
        "kind": "ros_node",
        "label": "/demo/talker",
        "name": "talker",
        "namespace": "/demo",
    }
    assert topic.to_dict() == {
        "id": "topic:/chatter",
        "kind": "ros_topic",
        "label": "/chatter",
        "types": ["std_msgs/msg/String"],
    }


def test_node_rejects_an_id_that_does_not_match_its_kind_and_label() -> None:
    with pytest.raises(ValueError, match="Graph node id"):
        GraphNode(id="topic:/wrong", kind=NodeKind.ROS_TOPIC, label="/right")


def test_snapshot_serializes_and_round_trips() -> None:
    talker = GraphNode.ros_node("talker")
    chatter = GraphNode.resource(NodeKind.ROS_TOPIC, "/chatter")
    edge = GraphEdge.create(EdgeKind.PUBLISH, talker.id, chatter.id)
    snapshot = GraphSnapshot(
        timestamp=datetime(2026, 7, 8, 12, 0, tzinfo=timezone.utc),
        ros_domain_id=7,
        nodes=(talker, chatter),
        edges=(edge,),
    )

    payload = json.loads(snapshot.to_json())
    assert payload["schema_version"] == SCHEMA_VERSION
    assert payload["ros_domain_id"] == "7"
    assert payload["timestamp"] == "2026-07-08T12:00:00+00:00"
    assert GraphSnapshot.from_json(snapshot.to_json()) == snapshot


def test_snapshot_rejects_naive_timestamp() -> None:
    with pytest.raises(ValueError, match="timezone"):
        GraphSnapshot(timestamp=datetime(2026, 7, 8), ros_domain_id="0")


def test_snapshot_rejects_duplicate_ids() -> None:
    node = GraphNode.ros_node("talker")
    with pytest.raises(ValueError, match="unique"):
        GraphSnapshot(
            timestamp=datetime.now(timezone.utc),
            ros_domain_id="0",
            nodes=(node, node),
        )


def test_snapshot_rejects_edges_with_unknown_endpoints() -> None:
    talker = GraphNode.ros_node("talker")
    edge = GraphEdge.create(EdgeKind.PUBLISH, talker.id, "topic:/missing")
    with pytest.raises(ValueError, match="unknown graph node"):
        GraphSnapshot(
            timestamp=datetime.now(timezone.utc),
            ros_domain_id="0",
            nodes=(talker,),
            edges=(edge,),
        )


def test_snapshot_rejects_unknown_schema_version() -> None:
    with pytest.raises(ValueError, match="Unsupported schema"):
        GraphSnapshot(
            schema_version="9.0.0",
            timestamp=datetime.now(timezone.utc),
            ros_domain_id="0",
        )
