# Architecture

`ros2-node-map` separates ROS 2 discovery from presentation:

```text
ROS 2 Runtime
    -> Python/rclpy + FastAPI backend
    -> HTTP JSON snapshot API / WebSocket JSON stream
    -> Electron + React + Cytoscape.js application
```

The backend is the only component that communicates with ROS 2 DDS. It owns
discovery, normalization, filtering, and graph snapshot generation. FastAPI
publishes `GET /api/health`, `GET /api/snapshot`, OpenAPI at `/openapi.json`,
and Swagger UI at `/docs`. It also streams snapshots at `WS /ws/graph`; the
original root WebSocket path remains available for compatibility. The app is a
transport-agnostic JSON client and must not import ROS 2 libraries.

## Backend API

When the backend runs locally on port 8766, its endpoints are:

```text
Swagger UI:  http://127.0.0.1:8766/docs
OpenAPI:     http://127.0.0.1:8766/openapi.json
Health:      http://127.0.0.1:8766/api/health
Snapshot:    http://127.0.0.1:8766/api/snapshot
ROS domain:  http://127.0.0.1:8766/api/domain
WebSocket:   ws://127.0.0.1:8766/ws/graph
```

`GET /api/domain` reports the system and effective domain settings. Sending a
`PUT` request to `/api/domain` switches between the system value and a custom
domain, then restarts ROS discovery while clients reconnect to the same endpoint.

The original `ws://127.0.0.1:8766/` graph stream remains available for
existing clients.

## File mode and runtime capability

The renderer validates WebSocket messages and imported files with the same
graph snapshot parser. File mode stops the WebSocket client and presents a
validated static snapshot without importing ROS libraries into Electron.

At startup, the Electron main process checks the ROS setup file and packaged
backend, then exposes only a small runtime-capability status through the
context-isolated preload bridge. If live discovery is unavailable or the
packaged backend exits unexpectedly, the renderer enters File-only Mode while
JSON import and all graph exports remain available.

Windows releases are portable File-only applications. They do not package or
start the Python/ROS backend. Linux releases enable live mode only when both the
ROS 2 setup file and bundled backend are available; otherwise they use the same
File-only capability path.

This boundary allows the backend to run on a robot while the UI runs on a
developer workstation. The initial transport will be a periodically refreshed
WebSocket snapshot rather than incremental graph events.
