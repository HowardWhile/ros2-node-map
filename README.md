# ros2-node-map

`ros2-node-map` is an advanced `rqt_graph`-style viewer for quickly
understanding the overall topology of a ROS 2 system.

![image-20260715015056371](./pic/README/image-20260715015056371.png)

[Watch the demo video](./pic/README/ros2-node-map.mp4)

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

Build the Linux x86-64 AppImage from an Ubuntu 24.04 / Python 3.12 environment.
The build machine needs Node.js LTS, npm, Python 3, and [uv](https://docs.astral.sh/uv/):

```bash
cd app
npm install
npm run dist
```

`npm run dist` builds the Electron renderer, creates a minimal Python runtime
from `backend/uv.lock`, and packages both into one AppImage. Generated runtime
files and release artifacts are not committed to Git.

The packaged executable is written to:

```text
app/release/ros2-node-map-0.1.0-dev.0.AppImage
```

The AppImage includes the Electron UI, the Python backend, and the backend's
application dependencies. On startup it automatically loads
`/opt/ros/jazzy/setup.bash` and starts the graph server at
`ws://127.0.0.1:8766`; no separate backend command is required.

The target system must be Ubuntu with ROS 2 Jazzy and `rclpy` installed. ROS 2,
DDS implementations, and their native libraries are intentionally not bundled
in the AppImage.

The default packaging compression balances download size with application
startup time. Do not change it to maximum compression unless a smaller download
is more important than launch responsiveness.

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
