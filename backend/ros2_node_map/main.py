"""Command-line entry point for the backend."""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from contextlib import contextmanager
from typing import Any, Iterator


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ros2-node-map-backend",
        description="Discover and stream the ROS 2 computation graph",
    )
    parser.add_argument(
        "--version", action="version", version="%(prog)s 0.1.0.dev0"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    snapshot = subparsers.add_parser("snapshot", help="print one graph JSON snapshot")
    snapshot.add_argument(
        "--wait", type=float, default=1.0, metavar="SECONDS",
        help="time to wait for ROS discovery (default: 1.0)",
    )
    snapshot.add_argument("--pretty", action="store_true", help="indent JSON output")

    server = subparsers.add_parser("serve", help="stream snapshots over WebSocket")
    server.add_argument("--host", default="127.0.0.1", help="listen host")
    server.add_argument("--port", type=int, default=8766, help="listen port")
    server.add_argument(
        "--interval", type=float, default=1.0, metavar="SECONDS",
        help="snapshot refresh interval (default: 1.0)",
    )
    server.add_argument(
        "--wait", type=float, default=1.0, metavar="SECONDS",
        help="initial ROS discovery wait (default: 1.0)",
    )
    return parser


@contextmanager
def _ros_node(wait: float) -> Iterator[Any]:
    if wait < 0:
        raise ValueError("--wait must be zero or greater")
    import rclpy

    rclpy.init(args=[])
    node = rclpy.create_node("ros2_node_map_backend")
    try:
        rclpy.spin_once(node, timeout_sec=wait)
        yield node
    finally:
        node.destroy_node()
        rclpy.shutdown()


def _snapshot(wait: float, pretty: bool) -> int:
    from .graph_reader import GraphReader

    with _ros_node(wait) as node:
        print(GraphReader(node).snapshot().to_json(indent=2 if pretty else None))
    return 0


def _serve(host: str, port: int, interval: float, wait: float) -> int:
    from .graph_server import run_server

    with _ros_node(wait) as node:
        print(f"Serving ROS graph at ws://{host}:{port}", file=sys.stderr)
        run_server(node, host=host, port=port, interval=interval)
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "snapshot":
            return _snapshot(args.wait, args.pretty)
        if args.command == "serve":
            return _serve(args.host, args.port, args.interval, args.wait)
    except (OSError, RuntimeError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
