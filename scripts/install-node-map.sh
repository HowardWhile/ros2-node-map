#!/usr/bin/env bash

set -euo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repository_directory="$(cd -- "$script_directory/.." && pwd)"
release_directory="$repository_directory/app/release"
user_bin_directory="${NODE_MAP_BIN_DIR:-${XDG_BIN_HOME:-${HOME}/.local/bin}}"
command_path="$user_bin_directory/node-map"

mapfile -t appimages < <(
  find "$release_directory" -maxdepth 1 -type f \
    -name 'ros2-node-map-v*-linux-x86_64.AppImage' -print | sort -V
)

if (( ${#appimages[@]} == 0 )); then
  echo "找不到 Linux x86_64 AppImage：$release_directory" >&2
  echo "請先執行：cd app && npm run dist" >&2
  exit 1
fi

appimage_path="${appimages[${#appimages[@]} - 1]}"
mkdir -p "$user_bin_directory"
chmod +x "$appimage_path"

if [[ -e "$command_path" && ! -L "$command_path" ]]; then
  echo "無法覆寫既有檔案：$command_path" >&2
  exit 1
fi

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
