# Development and packaging

This guide contains local development setup, backend commands, and release
build instructions. For an end-user launch path, start with [Getting started](getting-started.md).

## Prerequisites

The live backend targets ROS 2 Jazzy and Python 3.12. Use Node.js LTS for the
Electron application. `rclpy` comes from the sourced ROS 2 environment, not
from PyPI.

## Backend development

```bash
cd backend
uv venv --system-site-packages
uv sync
uv run pytest
```

Start a live backend after sourcing ROS 2:

```bash
source /opt/ros/jazzy/setup.bash
uv run ros2-node-map-backend serve
```

Create one snapshot without the UI:

```bash
source /opt/ros/jazzy/setup.bash
uv run ros2-node-map-backend snapshot --pretty
```

### Backend commands

```text
ros2-node-map-backend snapshot [--wait SECONDS] [--pretty]
ros2-node-map-backend serve [--host HOST] [--port PORT]
                            [--interval SECONDS] [--wait SECONDS]
                            [--frontend-dir DIRECTORY]
```

Defaults are `127.0.0.1:8766`, a one-second refresh interval, and a one-second
initial ROS discovery wait. `--frontend-dir` serves built frontend assets from
the same HTTP server, used by headless mode.

## Frontend development

```bash
cd app
npm install
npm run dev
```

Start the Electron shell during development:

```bash
npm run electron:dev
```

Run the frontend tests and production build:

```bash
npm test
npm run build
```

## Release builds

Build both Linux x86-64 and ARM64 AppImages locally with Docker Buildx:

```bash
./scripts/build-appimages.sh
```

To build only one architecture, pass `--arch x86_64` or `--arch arm64`.
See [Building Linux AppImages locally](appimage-build.md) for prerequisites,
output filenames, versioning, and troubleshooting.

Build the Windows portable File-only EXE:

```powershell
cd app
npm install
npm run dist:win
```

Windows packages do not include the Python/ROS backend. The portable target uses
ZIP compression, which produces a larger EXE than LZMA/7z while reducing
launch-time extraction work.

## More technical references

- [Architecture](architecture.md) — HTTP endpoints, WebSocket stream, and runtime boundary
- [Building Linux AppImages locally](appimage-build.md) — local x86-64 and ARM64 release packaging
- [Graph JSON schema](graph-json-schema.md) — transport contract
- [Testing](testing.md) — manual and automated verification

## Knowledge graph

The repository uses [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)
to generate `.ua/knowledge-graph.json`, which describes code structure,
component relationships, and guided exploration paths. Source code remains the
authoritative record; regenerate the graph before relying on it if it may be
older than the source.

To view it locally, install Node.js LTS, then run:

```bash
npm install --global https://github.com/Egonex-AI/Understand-Anything/releases/latest/download/understand-anything-viewer.tgz
understand-anything-viewer .
```
