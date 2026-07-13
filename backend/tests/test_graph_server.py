import asyncio
from datetime import datetime, timezone

import pytest

from ros2_node_map.graph_model import GraphSnapshot
from ros2_node_map.graph_server import GraphServer


class FakeReader:
    def snapshot(self):
        return GraphSnapshot.empty(timestamp=datetime(2026, 7, 8, tzinfo=timezone.utc))


class OneMessageWebSocket:
    def __init__(self):
        self.messages = []

    async def send(self, message):
        self.messages.append(message)
        raise asyncio.CancelledError


def test_server_validates_configuration() -> None:
    with pytest.raises(ValueError, match="port"):
        GraphServer(FakeReader(), port=0)
    with pytest.raises(ValueError, match="interval"):
        GraphServer(FakeReader(), interval=0)


def test_handler_sends_snapshot_immediately() -> None:
    websocket = OneMessageWebSocket()
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(GraphServer(FakeReader()).handler(websocket))
    assert '"schema_version": "0.1.0"' in websocket.messages[0]
