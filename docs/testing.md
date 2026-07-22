# Testing

The project will use layered verification:

- Python unit tests for graph identifiers, filters, and action inference.
- ROS 2 integration tests for discovery and relationship edges.
- Frontend unit tests for graph conversion, filtering, search, and details.
- Manual Electron tests against local and remote WebSocket backends.

Run backend unit tests in the locked uv environment:

```bash
cd backend
uv venv --system-site-packages
uv sync
uv run pytest
```

For ROS-backed commands, source ROS 2 Jazzy before `uv run` so its `rclpy`
modules are available. Validate the frontend export and snapshot parser plus
the production build with:

```bash
cd app
npm test
npm run build
```

For the installer, verify both modes on a supported Linux host. Use temporary
directories for the command link and downloaded AppImage:

```bash
offline_bin="$(mktemp -d)"
NODE_MAP_BIN_DIR="$offline_bin" ./scripts/install-node-map.sh --offline
readlink "$offline_bin/node-map"

online_bin="$(mktemp -d)"
online_data="$(mktemp -d)"
NODE_MAP_BIN_DIR="$online_bin" NODE_MAP_DOWNLOAD_DIR="$online_data" \
  bash <(wget -qO- https://raw.githubusercontent.com/HowardWhile/ros2-node-map/develop/scripts/install-node-map.sh)
readlink "$online_bin/node-map"
```
