"""WebSocket server for complete graph snapshots."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from typing import Any

from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed

from .graph_reader import GraphReader


class GraphServer:
    """Send a fresh graph snapshot to each connected WebSocket client."""

    def __init__(
        self,
        reader: GraphReader,
        *,
        host: str = "127.0.0.1",
        port: int = 8766,
        interval: float = 1.0,
    ) -> None:
        if not host:
            raise ValueError("host must be non-empty")
        if not 1 <= port <= 65535:
            raise ValueError("port must be between 1 and 65535")
        if interval <= 0:
            raise ValueError("interval must be greater than zero")
        self.reader = reader
        self.host = host
        self.port = port
        self.interval = interval

    async def handler(self, websocket: Any) -> None:
        """Serve snapshots until one client disconnects."""
        try:
            while True:
                await websocket.send(self.reader.snapshot().to_json())
                await asyncio.sleep(self.interval)
        except ConnectionClosed:
            pass

    async def serve_forever(self) -> None:
        """Listen until the task is cancelled."""
        async with serve(self.handler, self.host, self.port):
            await asyncio.Future()


def run_server(
    ros_node: Any,
    *,
    host: str = "127.0.0.1",
    port: int = 8766,
    interval: float = 1.0,
) -> None:
    """Run a graph server for an existing rclpy node."""
    server = GraphServer(
        GraphReader(ros_node), host=host, port=port, interval=interval
    )
    with suppress(KeyboardInterrupt):
        asyncio.run(server.serve_forever())
