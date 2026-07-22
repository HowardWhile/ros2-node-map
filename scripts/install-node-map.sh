#!/usr/bin/env bash

set -euo pipefail

github_repository="HowardWhile/ros2-node-map"
github_release_api_url="https://api.github.com/repos/${github_repository}/releases/latest"
user_bin_directory="${NODE_MAP_BIN_DIR:-${XDG_BIN_HOME:-${HOME}/.local/bin}}"
download_directory="${NODE_MAP_DOWNLOAD_DIR:-${XDG_DATA_HOME:-${HOME}/.local/share}/ros2-node-map}"
command_path="$user_bin_directory/node-map"

if (( $# == 0 )); then
  install_mode="online"
elif (( $# == 1 )) && [[ "$1" == "--offline" ]]; then
  install_mode="offline"
else
  echo "Usage: $0 [--offline]" >&2
  exit 2
fi

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command not found: $command_name" >&2
    exit 1
  fi
}

require_command uname

system_name="$(uname -s)"
machine_architecture="$(uname -m)"

case "${system_name}:${machine_architecture}" in
  Linux:x86_64|Linux:amd64)
    asset_suffix="linux-x86_64.AppImage"
    ;;
  Linux:aarch64|Linux:arm64)
    asset_suffix="linux-arm64.AppImage"
    ;;
  *)
    echo "Unsupported system or CPU architecture: ${system_name} ${machine_architecture}" >&2
    echo "Available releases: Linux x86_64 and arm64 AppImage." >&2
    exit 1
    ;;
esac

if [[ -e "$command_path" && ! -L "$command_path" ]]; then
  echo "Cannot overwrite existing file: $command_path" >&2
  exit 1
fi

script_path="${BASH_SOURCE[0]-}"
release_directory=""
if [[ -n "$script_path" && -f "$script_path" ]]; then
  script_directory="$(cd -- "$(dirname -- "$script_path")" && pwd)"
  repository_directory="$(cd -- "$script_directory/.." && pwd)"
  release_directory="$repository_directory/app/release"
fi

appimage_path=""
appimages=()

if [[ "$install_mode" == "offline" ]]; then
  if [[ -z "$release_directory" || ! -d "$release_directory" ]]; then
    echo "Offline mode could not find the release directory: ${release_directory:-repository path unavailable}" >&2
    echo "Run this script from the repository, or build the AppImage first: cd app && npm run dist" >&2
    exit 1
  fi

  mapfile -t appimages < <(
    find "$release_directory" -maxdepth 1 -type f \
      -name "ros2-node-map-v*-${asset_suffix}" -print | sort -V
  )

  if (( ${#appimages[@]} == 0 )); then
    echo "Offline mode could not find ${asset_suffix}: $release_directory" >&2
    echo "Build the AppImage first: cd app && npm run dist" >&2
    exit 1
  fi

  appimage_path="${appimages[${#appimages[@]} - 1]}"
else
  require_command wget
  require_command mktemp
  require_command sed
  require_command tr
  require_command grep
  require_command head

  temporary_directory="$(mktemp -d)"
  release_metadata_path="$temporary_directory/release.json"
  download_path=""

  cleanup() {
    rm -f -- "$release_metadata_path"
    if [[ -n "$download_path" ]]; then
      rm -f -- "$download_path"
    fi
    rmdir -- "$temporary_directory" 2>/dev/null || true
  }
  trap cleanup EXIT

  echo "Fetching the latest GitHub release..."
  if ! wget --quiet \
    --header='Accept: application/vnd.github+json' \
    --header='X-GitHub-Api-Version: 2022-11-28' \
    --output-document="$release_metadata_path" \
    "$github_release_api_url"; then
    echo "Failed to fetch the latest GitHub release: $github_repository" >&2
    exit 1
  fi

  appimage_url="$({
    tr ',' '\n' < "$release_metadata_path" |
      sed -n 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"\([^"]*AppImage\)".*/\1/p' |
      { grep -F "$asset_suffix" || true; }
  } | head -n 1)"

  if [[ -z "$appimage_url" ]]; then
    echo "The latest GitHub release does not contain ${asset_suffix}." >&2
    exit 1
  fi

  appimage_filename="${appimage_url##*/}"
  case "$appimage_filename" in
    ros2-node-map-v*-"$asset_suffix") ;;
    *)
      echo "Unexpected GitHub release asset name: $appimage_filename" >&2
      exit 1
      ;;
  esac

  mkdir -p "$download_directory"
  download_path="$temporary_directory/$appimage_filename"
  echo "Downloading: $appimage_filename"
  if ! wget --progress=bar:force:noscroll --output-document="$download_path" "$appimage_url"; then
    echo "AppImage download failed: $appimage_url" >&2
    exit 1
  fi

  if [[ ! -s "$download_path" ]]; then
    echo "The downloaded AppImage is empty: $download_path" >&2
    exit 1
  fi

  chmod +x "$download_path"
  appimage_path="$download_directory/$appimage_filename"
  mv -f -- "$download_path" "$appimage_path"
  download_path=""
fi

mkdir -p "$user_bin_directory"
chmod +x "$appimage_path"
ln -sfn -- "$appimage_path" "$command_path"

echo "node-map installed: $command_path"
echo "Version: $(basename "$appimage_path")"
echo
echo "Run node-map:"
echo "  node-map"
echo
if [[ "$install_mode" == "online" ]]; then
  echo "To uninstall:"
  echo "  rm -f \"$command_path\" \"$appimage_path\""
else
  echo "To remove the node-map command:"
  echo "  rm -f \"$command_path\""
fi

case ":${PATH:-}:" in
  *":$user_bin_directory:"*) ;;
  *)
    echo
    echo "PATH does not contain $user_bin_directory. Add this line to ~/.bashrc:" >&2
    echo "export PATH=\"$user_bin_directory:\$PATH\"" >&2
    ;;
esac

echo
echo "Reload your Bash configuration:"
echo "  source ~/.bashrc"
