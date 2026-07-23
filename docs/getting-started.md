# Getting started

Use `ros2-node-map` either to inspect a live ROS 2 graph on Linux or to explore
an exported graph JSON snapshot anywhere.

## Pick a mode

| Mode | Requirements | Result |
| --- | --- | --- |
| Live mode | Linux, ROS 2 Jazzy, and the packaged backend | Live ROS graph discovery in the Electron app |
| File-only Mode | A graph JSON snapshot | Offline graph viewing and export; used automatically on Windows and when ROS is unavailable |
| Headless mode | Linux, ROS 2 Jazzy, packaged backend, and production frontend assets | Browser-accessible graph viewer on a trusted network |
| Capture mode | Linux and ROS 2 Jazzy | One portable graph JSON snapshot |

## Install the Linux release

The installer downloads the latest Linux x86-64 or ARM64 AppImage, stores it in
`${XDG_DATA_HOME:-~/.local/share}/ros2-node-map/`, and links `node-map` in
`~/.local/bin`:

```bash
wget -qO- https://raw.githubusercontent.com/HowardWhile/ros2-node-map/develop/scripts/install-node-map.sh | bash
export PATH="$HOME/.local/bin:$PATH"
node-map
```

Use the app with ROS 2 Jazzy available for live discovery. Without ROS, the app
starts in File-only Mode and prompts you to open a snapshot.

For a local AppImage already in `app/release`, run:

```bash
./scripts/install-node-map.sh --offline
```

## Open and share snapshots

In the app, select **Open JSON** or drag one `.json` graph snapshot onto the
window. Snapshot files preserve the complete graph; active display filters are
applied only while rendering. The export menu can write:

- PNG of the current graph view
- Complete graph JSON
- Mermaid Markdown for the visible topology

The JSON format is documented in [Graph JSON schema](graph-json-schema.md).

## Run a backend during development

On a Linux ROS 2 Jazzy host, source ROS before running the backend:

```bash
cd backend
source /opt/ros/jazzy/setup.bash
uv run ros2-node-map-backend serve
```

The Electron app can connect to the default WebSocket endpoint at
`ws://127.0.0.1:8766`. See [Development and packaging](development.md) for
environment setup and backend command options.

## Windows

Windows releases are File-only applications: they do not bundle or start ROS
discovery. Build the portable EXE locally with:

```powershell
cd app
npm install
npm run dist:win
```

The portable EXE uses ZIP compression to favour startup extraction time over a
smaller download. Open or drag graph JSON snapshots to start exploring.
