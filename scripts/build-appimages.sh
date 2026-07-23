#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/build-appimages.sh [--arch all|x86_64|arm64]

Build release AppImages locally with Docker Buildx.

Options:
  --arch ARCH  Build both architectures (all, default), x86_64 only, or arm64 only.
  -h, --help   Show this help message.
EOF
}

fail() {
  echo "Error: $*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command not found: $1"
  fi
}

requested_architecture="all"

while (( $# > 0 )); do
  case "$1" in
    --arch)
      (( $# >= 2 )) || fail "--arch requires all, x86_64, or arm64."
      requested_architecture="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      fail "Unknown argument: $1"
      ;;
  esac
done

case "$requested_architecture" in
  all)
    build_architectures=(x86_64 arm64)
    ;;
  x86_64|arm64)
    build_architectures=("$requested_architecture")
    ;;
  *)
    fail "Unsupported architecture: $requested_architecture"
    ;;
esac

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repository_directory="$(cd -- "$script_directory/.." && pwd)"
dockerfile_path="$script_directory/appimage-builder.Dockerfile"
release_directory="$repository_directory/app/release"
product_version="$(
  awk -F '"' '$2 == "version" { print $4; exit }' \
    "$repository_directory/app/package.json"
)"

[[ "$product_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
  || fail "Could not read a valid x.y.z version from app/package.json."

require_command docker
require_command awk
require_command file
require_command install
require_command mktemp
require_command sed

docker buildx version >/dev/null 2>&1 \
  || fail "Docker Buildx is unavailable. Install or enable the Docker Buildx plugin."
docker buildx inspect --bootstrap >/dev/null \
  || fail "Docker Buildx could not start its configured builder."

builder_platforms="$(docker buildx inspect --bootstrap | sed -n 's/^Platforms:[[:space:]]*//p')"

for architecture in "${build_architectures[@]}"; do
  case "$architecture" in
    x86_64)
      platform="linux/amd64"
      expected_machine="x86-64"
      ;;
    arm64)
      platform="linux/arm64"
      expected_machine="ARM aarch64"
      ;;
  esac

  [[ ",${builder_platforms// /}," == *",$platform,"* ]] \
    || fail "The active Docker builder does not advertise $platform support."
done

temporary_directory="$(mktemp -d)"
cleanup() {
  rm -rf -- "$temporary_directory"
}
trap cleanup EXIT

mkdir -p "$release_directory"

for architecture in "${build_architectures[@]}"; do
  case "$architecture" in
    x86_64)
      platform="linux/amd64"
      expected_machine="x86-64"
      ;;
    arm64)
      platform="linux/arm64"
      expected_machine="ARM aarch64"
      ;;
  esac

  artifact_name="ros2-node-map-v${product_version}-linux-${architecture}.AppImage"
  exported_directory="$temporary_directory/$architecture"
  exported_artifact="$exported_directory/$artifact_name"
  release_artifact="$release_directory/$artifact_name"

  echo "Building $artifact_name for $platform..."
  docker buildx build \
    --platform "$platform" \
    --file "$dockerfile_path" \
    --target artifact \
    --output "type=local,dest=$exported_directory" \
    --progress plain \
    "$repository_directory"

  [[ -s "$exported_artifact" ]] \
    || fail "Docker build did not export the expected artifact: $artifact_name"

  artifact_description="$(file -b "$exported_artifact")"
  [[ "$artifact_description" == *"$expected_machine"* ]] \
    || fail "$artifact_name has an unexpected CPU architecture: $artifact_description"

  install -m 0755 "$exported_artifact" "$release_artifact"
  echo "Created $release_artifact"
done

echo
echo "AppImage build completed:"
for architecture in "${build_architectures[@]}"; do
  echo "  $release_directory/ros2-node-map-v${product_version}-linux-${architecture}.AppImage"
done
