"""ROS 2 graph discovery backend for ros2-node-map."""

from importlib.metadata import PackageNotFoundError, version
from os import environ


def _resolve_version() -> str:
    packaged_version = environ.get("ROS2_NODE_MAP_VERSION")
    if packaged_version:
        return packaged_version
    try:
        return version("ros2-node-map")
    except PackageNotFoundError:
        return "unknown"


__version__ = _resolve_version()
