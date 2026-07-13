# ros2-node-map

`ros2-node-map` is a modern ROS 2 topology explorer inspired by Obsidian's
Graph View. A Python backend discovers the ROS graph and streams JSON snapshots
to an Electron application, keeping ROS 2/DDS dependencies out of the UI.

This worktree is the Lumino Workbench PoC. It keeps the original WebSocket
protocol, React views, Cytoscape graph, and Electron packaging, while Lumino
owns the dockable Explorer, ROS Graph, and Details panels. The implementation
plan and acceptance checklist are in [plan.md](plan.md).

> Status: initial project skeleton. Discovery and visualization are implemented
> in the following milestones described in [SPEC.md](SPEC.md).

## Architecture

```text
ROS 2 Runtime -> rclpy backend -> WebSocket JSON -> Electron/React frontend
```

See [docs/architecture.md](docs/architecture.md) for the component boundaries.

## Backend development

ROS 2 Jazzy and Python 3.12 are the initial target.

```bash
cd backend
uv sync
uv run pytest
```

`uv sync` creates `backend/.venv` and installs the locked application and
development dependencies. No manual virtual-environment activation is needed.
The ROS discovery dependency (`rclpy`) is supplied by the sourced ROS 2
environment rather than PyPI. Start the live graph backend with:

```bash
source /opt/ros/jazzy/setup.bash
uv run ros2-node-map-backend serve
```

To inspect one snapshot without the UI:

```bash
source /opt/ros/jazzy/setup.bash
uv run ros2-node-map-backend snapshot --pretty
```

## App development

Use a current Node.js LTS release.

```bash
cd app
npm install
npm run dev
```

To open the Electron shell during development:

```bash
npm run electron:dev
```

## Build Linux AppImage

Install the frontend dependencies and build the Linux x86-64 AppImage:

```bash
cd app
npm install
npm run dist
```

The packaged executable is written to:

```text
app/release/ros2-node-map-0.1.0-dev.0.AppImage
```

The AppImage contains the Electron frontend only. Start the Python backend
separately before launching it:

```bash
cd backend
source /opt/ros/jazzy/setup.bash
uv run ros2-node-map-backend serve
```

If the system does not provide FUSE 2, run the AppImage in extraction mode:

```bash
./app/release/ros2-node-map-0.1.0-dev.0.AppImage --appimage-extract-and-run
```

## Documentation

- [Architecture](docs/architecture.md)
- [Graph JSON schema](docs/graph-json-schema.md)
- [Testing](docs/testing.md)
- [Roadmap](docs/roadmap.md)

## License

[MIT](LICENSE)
