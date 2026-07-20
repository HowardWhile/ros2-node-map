from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from ros2_node_map import __version__
from ros2_node_map.graph_model import GraphNode, GraphSnapshot, NodeKind
from ros2_node_map.graph_server import DomainController, GraphServer, create_app, snapshot_response


class FakeReader:
    def snapshot(self):
        return GraphSnapshot.empty(timestamp=datetime(2026, 7, 8, tzinfo=timezone.utc))


class PopulatedReader:
    def snapshot(self):
        return GraphSnapshot(
            timestamp=datetime(2026, 7, 8, tzinfo=timezone.utc),
            ros_domain_id="49",
            nodes=(
                GraphNode.ros_node("talker", "/"),
                GraphNode.resource(
                    NodeKind.ROS_TOPIC, "/chatter", ("std_msgs/msg/String",)
                ),
            ),
            edges=(),
        )


def test_server_validates_configuration() -> None:
    with pytest.raises(ValueError, match="port"):
        GraphServer(FakeReader(), port=0)
    with pytest.raises(ValueError, match="interval"):
        GraphServer(FakeReader(), interval=0)


def test_server_uses_the_package_version() -> None:
    assert create_app(FakeReader()).version == __version__


def test_http_endpoints_are_documented_and_return_a_snapshot() -> None:
    with TestClient(create_app(FakeReader())) as client:
        assert client.get("/api/health").json() == {"status": "ok"}
        snapshot = client.get("/api/snapshot")
        assert snapshot.status_code == 200
        assert snapshot.json()["schema_version"] == "0.1.0"
        schema = client.get("/openapi.json").json()
    assert "/api/snapshot" in schema["paths"]
    assert "/docs" not in schema["paths"]


def test_snapshot_response_preserves_the_strict_node_schema() -> None:
    nodes = snapshot_response(PopulatedReader()).model_dump(mode="json")["nodes"]

    assert nodes[0] == {
        "id": "node:/talker",
        "kind": "ros_node",
        "label": "/talker",
        "name": "talker",
        "namespace": "/",
    }
    assert nodes[1] == {
        "id": "topic:/chatter",
        "kind": "ros_topic",
        "label": "/chatter",
        "types": ["std_msgs/msg/String"],
    }


def test_websocket_sends_a_snapshot_on_the_canonical_and_legacy_paths() -> None:
    with TestClient(create_app(FakeReader())) as client:
        for path in ("/ws/graph", "/"):
            with client.websocket_connect(path) as websocket:
                assert websocket.receive_json()["schema_version"] == "0.1.0"


def test_domain_api_requests_a_ros_context_restart() -> None:
    controller = DomainController("7")
    with TestClient(create_app(FakeReader(), domain_controller=controller)) as client:
        assert client.get("/api/domain").json() == {
            "configurable": True,
            "mode": "system",
            "system_domain_id": "7",
            "custom_domain_id": "",
            "effective_domain_id": "7",
        }
        response = client.put(
            "/api/domain", json={"mode": "custom", "custom_domain_id": 42}
        )
        assert response.status_code == 200
        assert response.json()["effective_domain_id"] == "42"
        assert controller.consume_restart() == "42"


def test_domain_api_validates_custom_domain_id() -> None:
    controller = DomainController("0")
    with TestClient(create_app(FakeReader(), domain_controller=controller)) as client:
        assert client.put(
            "/api/domain", json={"mode": "custom", "custom_domain_id": 233}
        ).status_code == 422
        assert client.put(
            "/api/domain", json={"mode": "custom"}
        ).status_code == 422


def test_domain_api_allows_local_vite_origins() -> None:
    controller = DomainController("0")
    with TestClient(create_app(FakeReader(), domain_controller=controller)) as client:
        response = client.options(
            "/api/domain",
            headers={
                "Origin": "http://localhost:5174",
                "Access-Control-Request-Method": "PUT",
            },
        )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5174"
