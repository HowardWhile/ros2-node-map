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
  echo "用法：$0 [--offline]" >&2
  exit 2
fi

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "找不到必要指令：$command_name" >&2
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
    echo "不支援的系統或 CPU 架構：${system_name} ${machine_architecture}" >&2
    echo "目前 release 提供 Linux x86_64 與 arm64 AppImage。" >&2
    exit 1
    ;;
esac

if [[ -e "$command_path" && ! -L "$command_path" ]]; then
  echo "無法覆寫既有檔案：$command_path" >&2
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
    echo "離線模式找不到 release 目錄：${release_directory:-無法判定 repo 路徑}" >&2
    echo "請從 repo 根目錄執行，或先執行：cd app && npm run dist" >&2
    exit 1
  fi

  mapfile -t appimages < <(
    find "$release_directory" -maxdepth 1 -type f \
      -name "ros2-node-map-v*-${asset_suffix}" -print | sort -V
  )

  if (( ${#appimages[@]} == 0 )); then
    echo "離線模式找不到 ${asset_suffix}：$release_directory" >&2
    echo "請先執行：cd app && npm run dist" >&2
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

  echo "正在取得 GitHub 最新 release..."
  if ! wget --quiet \
    --header='Accept: application/vnd.github+json' \
    --header='X-GitHub-Api-Version: 2022-11-28' \
    --output-document="$release_metadata_path" \
    "$github_release_api_url"; then
    echo "無法取得 GitHub 最新 release：$github_repository" >&2
    exit 1
  fi

  appimage_url="$({
    tr ',' '\n' < "$release_metadata_path" |
      sed -n 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"\([^"]*AppImage\)".*/\1/p' |
      { grep -F "$asset_suffix" || true; }
  } | head -n 1)"

  if [[ -z "$appimage_url" ]]; then
    echo "GitHub 最新 release 沒有 ${asset_suffix}。" >&2
    exit 1
  fi

  appimage_filename="${appimage_url##*/}"
  case "$appimage_filename" in
    ros2-node-map-v*-"$asset_suffix") ;;
    *)
      echo "GitHub release asset 名稱不符合預期：$appimage_filename" >&2
      exit 1
      ;;
  esac

  mkdir -p "$download_directory"
  download_path="$temporary_directory/$appimage_filename"
  echo "正在下載：$appimage_filename"
  if ! wget --quiet --output-document="$download_path" "$appimage_url"; then
    echo "AppImage 下載失敗：$appimage_url" >&2
    exit 1
  fi

  if [[ ! -s "$download_path" ]]; then
    echo "下載的 AppImage 是空檔案：$download_path" >&2
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

echo "node-map 已安裝：$command_path"
echo "使用版本：$(basename "$appimage_path")"

case ":${PATH:-}:" in
  *":$user_bin_directory:"*) ;;
  *)
    echo "目前 PATH 未包含 $user_bin_directory。請加入 PATH 後重新開啟 shell：" >&2
    echo "export PATH=\"$user_bin_directory:\$PATH\"" >&2
    ;;
esac
