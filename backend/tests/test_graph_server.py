from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from ros2_node_map.graph_model import GraphSnapshot
from ros2_node_map.graph_server import GraphServer, create_app


class FakeReader:
    def snapshot(self):
        return GraphSnapshot.empty(timestamp=datetime(2026, 7, 8, tzinfo=timezone.utc))


def test_server_validates_configuration() -> None:
    with pytest.raises(ValueError, match="port"):
        GraphServer(FakeReader(), port=0)
    with pytest.raises(ValueError, match="interval"):
        GraphServer(FakeReader(), interval=0)


def test_http_endpoints_are_documented_and_return_a_snapshot() -> None:
    with TestClient(create_app(FakeReader())) as client:
        assert client.get("/api/health").json() == {"status": "ok"}
        snapshot = client.get("/api/snapshot")
        assert snapshot.status_code == 200
        assert snapshot.json()["schema_version"] == "0.1.0"
        schema = client.get("/openapi.json").json()
    assert "/api/snapshot" in schema["paths"]
    assert "/docs" not in schema["paths"]


def test_websocket_sends_a_snapshot_on_the_canonical_and_legacy_paths() -> None:
    with TestClient(create_app(FakeReader())) as client:
        for path in ("/ws/graph", "/"):
            with client.websocket_connect(path) as websocket:
                assert websocket.receive_json()["schema_version"] == "0.1.0"
