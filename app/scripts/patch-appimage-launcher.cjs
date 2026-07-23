const { chmod, mkdtemp, readFile, rename, rm, writeFile } = require("node:fs/promises");
const { createReadStream, createWriteStream } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { pipeline } = require("node:stream/promises");
const { spawn } = require("node:child_process");

function run(command, arguments_, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { stdio: "inherit", ...options });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with status ${code ?? "unknown"}.`));
    });
  });
}

function findSquashfsOffset(image) {
  const magic = Buffer.from("hsqs");
  let offset = -1;
  while ((offset = image.indexOf(magic, offset + 1)) !== -1) {
    if (offset + 96 > image.length) continue;

    const blockSize = image.readUInt32LE(offset + 12);
    const compression = image.readUInt16LE(offset + 20);
    const blockLog = image.readUInt16LE(offset + 22);
    const majorVersion = image.readUInt16LE(offset + 28);
    const minorVersion = image.readUInt16LE(offset + 30);
    const bytesUsed = image.readBigUInt64LE(offset + 40);
    const remainingBytes = BigInt(image.length - offset);

    const validBlockSize = blockSize >= 4096
      && blockSize <= 1_048_576
      && (blockSize & (blockSize - 1)) === 0
      && blockLog === Math.log2(blockSize);
    const validCompression = compression >= 1 && compression <= 6;
    const validVersion = majorVersion === 4 && minorVersion === 0;
    const validSize = bytesUsed >= 96n && bytesUsed <= remainingBytes;

    if (validBlockSize && validCompression && validVersion && validSize) {
      return offset;
    }
  }
  throw new Error("Could not find a valid SquashFS filesystem in the AppImage.");
}

function launcher() {
  return `#!/usr/bin/env bash
set -euo pipefail

app_directory="$(cd -- "$(dirname -- "$0")" && pwd)"
electron_binary="$app_directory/ros2-node-map"
electron_arguments=()
app_arguments=()
headless_port=""
expect_port_value=false

export PATH="$app_directory:$app_directory/usr/sbin\${PATH:+:$PATH}"
export XDG_DATA_DIRS="$app_directory/usr/share/\${XDG_DATA_DIRS:+:$XDG_DATA_DIRS}:/usr/share/gnome:/usr/local/share/:/usr/share/"
export LD_LIBRARY_PATH="$app_directory/usr/lib\${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export GSETTINGS_SCHEMA_DIR="$app_directory/usr/share/glib-2.0/schemas\${GSETTINGS_SCHEMA_DIR:+:$GSETTINGS_SCHEMA_DIR}"

for argument in "$@"; do
  if [[ "$expect_port_value" == true ]]; then
    headless_port="$argument"
    expect_port_value=false
    continue
  fi
  case "$argument" in
    --headless)
      app_arguments+=(headless)
      ;;
    -p|--port)
      expect_port_value=true
      ;;
    --port=*)
      headless_port="\${argument#--port=}"
      ;;
    -c|--capture)
      app_arguments+=(capture)
      ;;
    --install)
      app_arguments+=(install)
      ;;
    --uninstall)
      app_arguments+=(uninstall)
      ;;
    -h|--help)
      app_arguments+=(help)
      ;;
    -v|--version)
      app_arguments+=(version)
      ;;
    *)
      electron_arguments+=("$argument")
      ;;
  esac
done

if [[ "$expect_port_value" == true ]]; then
  headless_port=invalid
fi

if (( \${#app_arguments[@]} > 1 )); then
  export NODE_MAP_CLI_MODE=invalid
elif (( \${#app_arguments[@]} == 1 )); then
  export NODE_MAP_CLI_MODE="\${app_arguments[0]}"
  if [[ "\${app_arguments[0]}" == headless || "\${app_arguments[0]}" == capture ]]; then
    electron_arguments=(
      --headless
      --disable-gpu
      --disable-software-rasterizer
      "\${electron_arguments[@]}"
    )
  fi
fi

if [[ -n "$headless_port" ]]; then
  export NODE_MAP_HEADLESS_PORT="$headless_port"
fi

if [[ " \${electron_arguments[*]} " != *" --no-sandbox "* ]] && ! unshare -Ur true 2>/dev/null; then
  electron_arguments=(--no-sandbox "\${electron_arguments[@]}")
fi

exec "$electron_binary" "\${electron_arguments[@]}"
`;
}

async function patchAppImage(artifactPath) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "ros2-node-map-appimage-"));
  const rootDirectory = join(temporaryDirectory, "squashfs-root");
  const payloadPath = join(temporaryDirectory, "payload.squashfs");
  const replacementPath = join(temporaryDirectory, "replacement.AppImage");
  try {
    const runtimeOffset = findSquashfsOffset(await readFile(artifactPath));
    await run("unsquashfs", [
      "-quiet",
      "-no-progress",
      "-offset",
      String(runtimeOffset),
      "-dest",
      rootDirectory,
      artifactPath,
    ], { stdio: "ignore" });
    await writeFile(join(rootDirectory, "AppRun"), launcher(), { mode: 0o755 });
    await chmod(join(rootDirectory, "AppRun"), 0o755);
    await run("mksquashfs", [rootDirectory, payloadPath, "-noappend", "-comp", "gzip", "-quiet"]);
    await run("dd", [
      `if=${artifactPath}`,
      `of=${replacementPath}`,
      "bs=1",
      `count=${runtimeOffset}`,
      "status=none",
    ]);
    await pipeline(createReadStream(payloadPath), createWriteStream(replacementPath, { flags: "a" }));
    await chmod(replacementPath, 0o755);
    await rename(replacementPath, artifactPath);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

module.exports = async function patchAppImageLauncher(context) {
  for (const artifactPath of context.artifactPaths.filter((path) => path.endsWith(".AppImage"))) {
    await patchAppImage(artifactPath);
  }
};
module.exports.findSquashfsOffset = findSquashfsOffset;
module.exports.launcher = launcher;
