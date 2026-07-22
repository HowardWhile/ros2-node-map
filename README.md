# ros2-node-map

> [繁體中文](README_zh.md)

`ros2-node-map` is an advanced `rqt_graph`-style viewer for quickly
understanding the overall topology of a ROS 2 system.

![image-20260715015056371](./pic/README/image-20260715015056371.png)

[Watch the demo video](./pic/README/ros2-node-map.mp4)

## Backend development

ROS 2 Jazzy and Python 3.12 are the initial target.

```bash
cd backend
uv venv --system-site-packages
uv sync
uv run pytest
```

`uv venv --system-site-packages` creates `backend/.venv` with access to Ubuntu's
system Python packages, including the `yaml` module required by ROS 2. `uv sync`
then installs the locked application and development dependencies. No manual
virtual-environment activation is needed. The ROS discovery dependency (`rclpy`)
is supplied by the sourced ROS 2 environment rather than PyPI. Start the live
graph backend with:

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

## Snapshot files and exports

The graph export menu can save the current view as PNG or portable Mermaid
Markdown, and save the complete source snapshot as graph JSON. JSON exports
are unaffected by active display filters; filters are applied again by the app
when that file is reopened.

Open a graph JSON snapshot with the **Open JSON** button or drag one JSON file
anywhere onto the application window. If the system does not have a ROS 2
environment, offline viewing and export features remain available.

## Build standalone executable

Build the Linux x86-64 AppImage from an Ubuntu 24.04 / Python 3.12 environment.
The build machine needs Node.js LTS, npm, Python 3, and [uv](https://docs.astral.sh/uv/):

```bash
cd app
npm install
npm run dist
```

```text
app/release/ros2-node-map-v<version>-linux-<architecture>.AppImage
```

For example, an x86-64 build of version `0.2.1` is named
`ros2-node-map-v0.2.1-linux-x86_64.AppImage`. The architecture suffix is derived
from the target selected by electron-builder.

## Install the `node-map` command

The default mode detects the current system and downloads the matching latest Linux
x86-64 or ARM64 AppImage from the GitHub Releases page:

```bash
./scripts/install-node-map.sh
node-map
```

The same installer can be run directly from the online script with `wget`:

```bash
wget -qO- https://raw.githubusercontent.com/HowardWhile/ros2-node-map/develop/scripts/install-node-map.sh | bash
```

The downloaded AppImage is stored in
`${XDG_DATA_HOME:-~/.local/share}/ros2-node-map/`, and the `node-map` command is
installed in `~/.local/bin`. If that directory is not already in your `PATH`, add
it and reopen your shell.

For an offline install, use the AppImage already present in `app/release`:

```bash
./scripts/install-node-map.sh --offline
```

Offline mode selects the highest versioned AppImage for the current Linux
architecture without using the network.

## Documentation

- [Changelog](CHANGELOG.md)
- [Architecture](docs/architecture.md)
- [Graph JSON schema](docs/graph-json-schema.md)
- [Testing](docs/testing.md)
- [Roadmap](docs/roadmap.md)
- [Specification](.agents/SPEC.md)
- [Development plan](.agents/PLAN.md)

## Knowledge graph

This project uses [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)
to analyze the codebase and generate a knowledge graph that describes its
structure, component relationships, and guided exploration paths.

The graph can be used in two ways: users can explore it through the interactive
dashboard, while AI agents can inspect the JSON graph directly.

### For AI agents

Include the following instruction in your prompt:

> Read `.ua/knowledge-graph.json`. It is the knowledge graph for this project.

> [!WARNING]
> The source code remains the final source of truth. If the graph was generated
> from an older revision than the current codebase, regenerate it before relying
> on its contents.

### For users

#### Prerequisites

Install [Node.js LTS](https://nodejs.org/) to obtain the `npm` and `npx`
commands. Verify the installation with:

```bash
node --version
npx --version
```

Install the latest Understand-Anything viewer:

```bash
npm install --global https://github.com/Egonex-AI/Understand-Anything/releases/latest/download/understand-anything-viewer.tgz
```

#### Launch the dashboard

From the project root, run:

```bash
understand-anything-viewer .
```

## License

[MIT](LICENSE)
