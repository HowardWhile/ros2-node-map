# Testing

The project will use layered verification:

- Python unit tests for graph identifiers, filters, and action inference.
- ROS 2 integration tests for discovery and relationship edges.
- Frontend unit tests for graph conversion, filtering, search, and details.
- Manual Electron tests against local and remote WebSocket backends.

Run backend unit tests in the locked uv environment:

```bash
cd backend
uv sync
uv run pytest
```

For ROS-backed commands, source ROS 2 Jazzy before `uv run` so its `rclpy`
modules are available. Validate the frontend with `npm run build` from `app/`.

