"""FastAPI service for ROS graph snapshots."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import datetime
from typing import Any, Protocol

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, ConfigDict, Field

from .graph_reader import GraphReader
from .graph_model import GraphSnapshot


class SnapshotReader(Protocol):
    def snapshot(self) -> GraphSnapshot: ...


class GraphNodeResponse(BaseModel):
    """One ROS node, topic, service, or action in a graph snapshot."""

    model_config = ConfigDict(extra="forbid")

    id: str
    kind: str
    label: str
    name: str | None = None
    namespace: str | None = None
    types: list[str] = Field(default_factory=list)


class GraphEdgeResponse(BaseModel):
    """One directed relationship in a graph snapshot."""

    model_config = ConfigDict(extra="forbid")

    id: str
    kind: str
    source: str
    target: str


class GraphSnapshotResponse(BaseModel):
    """Stable JSON transport shape shared by HTTP and WebSocket clients."""

    model_config = ConfigDict(extra="forbid")

    schema_version: str
    timestamp: datetime
    ros_domain_id: str
    nodes: list[GraphNodeResponse]
    edges: list[GraphEdgeResponse]


class HealthResponse(BaseModel):
    status: str


def snapshot_response(reader: SnapshotReader) -> GraphSnapshotResponse:
    """Convert the existing stable graph model into an OpenAPI response model."""
    return GraphSnapshotResponse.model_validate(reader.snapshot().to_dict())


def create_app(reader: SnapshotReader, *, interval: float = 1.0) -> FastAPI:
    """Create the HTTP, OpenAPI, Swagger UI, and graph WebSocket service."""
    if interval <= 0:
        raise ValueError("interval must be greater than zero")

    app = FastAPI(
        title="ROS 2 Node Map API",
        version="0.1.0",
        description=(
            "HTTP and WebSocket API for complete ROS 2 graph snapshots. "
            "Swagger UI is available at /docs."
        ),
    )

    @app.get("/api/health", response_model=HealthResponse, tags=["system"])
    def health() -> HealthResponse:
        """Report whether the graph API process is running."""
        return HealthResponse(status="ok")

    @app.get("/api/snapshot", response_model=GraphSnapshotResponse, tags=["graph"])
    def snapshot() -> GraphSnapshotResponse:
        """Return one current ROS graph snapshot."""
        return snapshot_response(reader)

    async def stream_graph(websocket: WebSocket) -> None:
        await websocket.accept()
        try:
            while True:
                await websocket.send_json(snapshot_response(reader).model_dump(mode="json"))
                await asyncio.sleep(interval)
        except WebSocketDisconnect:
            return

    app.websocket("/ws/graph")(stream_graph)
    # Keep the original ws://host:port endpoint working for existing clients.
    app.websocket("/")(stream_graph)
    return app


class GraphServer:
    """Configure and run the FastAPI graph service with Uvicorn."""

    def __init__(
        self,
        reader: SnapshotReader,
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
        self.app = create_app(reader, interval=interval)

    async def serve_forever(self) -> None:
        """Run the ASGI server until it is cancelled."""
        config = uvicorn.Config(self.app, host=self.host, port=self.port, log_level="info")
        await uvicorn.Server(config).serve()


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
