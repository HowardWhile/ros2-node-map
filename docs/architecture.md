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
WebSocket:   ws://127.0.0.1:8766/ws/graph
```

The original `ws://127.0.0.1:8766/` graph stream remains available for
existing clients.

This boundary allows the backend to run on a robot while the UI runs on a
developer workstation. The initial transport will be a periodically refreshed
WebSocket snapshot rather than incremental graph events.
