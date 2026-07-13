# Architecture

`ros2-node-map` separates ROS 2 discovery from presentation:

```text
ROS 2 Runtime
    -> Python/rclpy backend
    -> WebSocket JSON snapshots
    -> Electron + React + Cytoscape.js application
```

The backend is the only component that communicates with ROS 2 DDS. It owns
discovery, normalization, filtering, and graph snapshot generation. The app is
a transport-agnostic JSON client and must not import ROS 2 libraries.

This boundary allows the backend to run on a robot while the UI runs on a
developer workstation. The initial transport will be a periodically refreshed
WebSocket snapshot rather than incremental graph events.

