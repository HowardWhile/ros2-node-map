import pytest

from ros2_node_map.main import build_parser


def test_snapshot_cli_defaults() -> None:
    args = build_parser().parse_args(["snapshot"])
    assert args.command == "snapshot"
    assert args.wait == 1.0
    assert args.pretty is False


def test_cli_requires_a_command() -> None:
    with pytest.raises(SystemExit):
        build_parser().parse_args([])


def test_serve_cli_defaults() -> None:
    args = build_parser().parse_args(["serve"])
    assert args.host == "127.0.0.1"
    assert args.port == 8766
    assert args.interval == 1.0
    assert args.wait == 1.0
