"""FastAPI service for ROS graph snapshots."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import datetime
from threading import Lock
from typing import Any, Callable, Literal, Protocol

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, model_validator

from .graph_reader import GraphReader
from .graph_model import GraphSnapshot


class SnapshotReader(Protocol):
    def snapshot(self) -> GraphSnapshot: ...


class RosNodeResponse(BaseModel):
    """One ROS node in a graph snapshot."""

    model_config = ConfigDict(extra="forbid")

    id: str
    kind: Literal["ros_node"]
    label: str
    name: str
    namespace: str


class RosResourceResponse(BaseModel):
    """One ROS topic, service, or action in a graph snapshot."""

    model_config = ConfigDict(extra="forbid")

    id: str
    kind: Literal["ros_topic", "ros_service", "ros_action"]
    label: str
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
    nodes: list[RosNodeResponse | RosResourceResponse]
    edges: list[GraphEdgeResponse]


class HealthResponse(BaseModel):
    status: str


class DomainConfigRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["system", "custom"]
    custom_domain_id: int | None = Field(default=None, ge=0, le=232)

    @model_validator(mode="after")
    def require_custom_domain_id(self) -> "DomainConfigRequest":
        if self.mode == "custom" and self.custom_domain_id is None:
            raise ValueError("custom_domain_id is required in custom mode")
        return self


class DomainConfigResponse(BaseModel):
    configurable: bool = True
    mode: Literal["system", "custom"]
    system_domain_id: str
    custom_domain_id: str
    effective_domain_id: str


class DomainController:
    """Keep domain preferences while the ROS context is restarted."""

    def __init__(self, system_domain_id: str) -> None:
        self.system_domain_id = system_domain_id
        self.mode: Literal["system", "custom"] = "system"
        self.custom_domain_id = ""
        self._restart_requested = False
        self._stop_server: Callable[[], None] | None = None
        self._lock = Lock()

    def config(self) -> DomainConfigResponse:
        with self._lock:
            effective = (
                self.custom_domain_id
                if self.mode == "custom"
                else self.system_domain_id
            )
            return DomainConfigResponse(
                mode=self.mode,
                system_domain_id=self.system_domain_id,
                custom_domain_id=self.custom_domain_id,
                effective_domain_id=effective,
            )

    def request_switch(self, request: DomainConfigRequest) -> DomainConfigResponse:
        with self._lock:
            self.mode = request.mode
            if request.custom_domain_id is not None:
                self.custom_domain_id = str(request.custom_domain_id)
            self._restart_requested = True
            stop_server = self._stop_server
        if stop_server is not None:
            stop_server()
        return self.config()

    def attach_server(self, stop_server: Callable[[], None] | None) -> None:
        with self._lock:
            self._stop_server = stop_server

    def consume_restart(self) -> str | None:
        with self._lock:
            if not self._restart_requested:
                return None
            self._restart_requested = False
        return self.config().effective_domain_id


def snapshot_response(reader: SnapshotReader) -> GraphSnapshotResponse:
    """Convert the existing stable graph model into an OpenAPI response model."""
    return GraphSnapshotResponse.model_validate(reader.snapshot().to_dict())


def create_app(
    reader: SnapshotReader,
    *,
    interval: float = 1.0,
    domain_controller: DomainController | None = None,
) -> FastAPI:
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
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
        allow_methods=["GET", "PUT"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/health", response_model=HealthResponse, tags=["system"])
    def health() -> HealthResponse:
        """Report whether the graph API process is running."""
        return HealthResponse(status="ok")

    @app.get("/api/snapshot", response_model=GraphSnapshotResponse, tags=["graph"])
    def snapshot() -> GraphSnapshotResponse:
        """Return one current ROS graph snapshot."""
        return snapshot_response(reader)

    if domain_controller is not None:
        @app.get("/api/domain", response_model=DomainConfigResponse, tags=["system"])
        def get_domain() -> DomainConfigResponse:
            """Return the system, custom, and effective ROS domain settings."""
            return domain_controller.config()

        @app.put("/api/domain", response_model=DomainConfigResponse, tags=["system"])
        def set_domain(request: DomainConfigRequest) -> DomainConfigResponse:
            """Request a ROS context restart using a different domain."""
            return domain_controller.request_switch(request)

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
        domain_controller: DomainController | None = None,
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
        self.domain_controller = domain_controller
        self.app = create_app(
            reader, interval=interval, domain_controller=domain_controller
        )

    async def serve_forever(self) -> None:
        """Run the ASGI server until it is cancelled."""
        config = uvicorn.Config(self.app, host=self.host, port=self.port, log_level="info")
        server = uvicorn.Server(config)
        if self.domain_controller is not None:
            self.domain_controller.attach_server(
                lambda: setattr(server, "should_exit", True)
            )
        try:
            await server.serve()
        finally:
            if self.domain_controller is not None:
                self.domain_controller.attach_server(None)


def run_server(
    ros_node: Any,
    *,
    host: str = "127.0.0.1",
    port: int = 8766,
    interval: float = 1.0,
    domain_controller: DomainController | None = None,
) -> None:
    """Run a graph server for an existing rclpy node."""
    server = GraphServer(
        GraphReader(ros_node), host=host, port=port, interval=interval,
        domain_controller=domain_controller,
    )
    with suppress(KeyboardInterrupt):
        asyncio.run(server.serve_forever())
