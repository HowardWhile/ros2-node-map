const { chmod, mkdtemp, rename, rm, writeFile } = require("node:fs/promises");
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

function runOutput(command, arguments_) {
  return new Promise((resolve, reject) => {
    let output = "";
    const child = spawn(command, arguments_, { stdio: ["ignore", "pipe", "inherit"] });
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(`${command} exited with status ${code ?? "unknown"}.`));
    });
  });
}

function launcher() {
  return `#!/usr/bin/env bash
set -euo pipefail

app_directory="$(cd -- "$(dirname -- "$0")" && pwd)"
electron_binary="$app_directory/ros2-node-map"
electron_arguments=()
app_arguments=()

export PATH="$app_directory:$app_directory/usr/sbin\${PATH:+:$PATH}"
export XDG_DATA_DIRS="$app_directory/usr/share/\${XDG_DATA_DIRS:+:$XDG_DATA_DIRS}:/usr/share/gnome:/usr/local/share/:/usr/share/"
export LD_LIBRARY_PATH="$app_directory/usr/lib\${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export GSETTINGS_SCHEMA_DIR="$app_directory/usr/share/glib-2.0/schemas\${GSETTINGS_SCHEMA_DIR:+:$GSETTINGS_SCHEMA_DIR}"

for argument in "$@"; do
  case "$argument" in
    --headless|--capture|--install|--uninstall)
      app_arguments+=("$argument")
      ;;
    *)
      electron_arguments+=("$argument")
      ;;
  esac
done

if (( \${#app_arguments[@]} > 1 )); then
  export NODE_MAP_CLI_MODE=invalid
elif (( \${#app_arguments[@]} == 1 )); then
  export NODE_MAP_CLI_MODE="\${app_arguments[0]#--}"
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
    const runtimeOffset = await runOutput(artifactPath, ["--appimage-offset"]);
    if (!/^\d+$/.test(runtimeOffset)) {
      throw new Error(`Could not determine the AppImage runtime offset for ${artifactPath}.`);
    }
    await run(artifactPath, ["--appimage-extract"], { cwd: temporaryDirectory, stdio: "ignore" });
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
