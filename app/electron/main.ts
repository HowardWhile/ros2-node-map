import { app, BrowserWindow } from "electron";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
let backendProcess: ChildProcess | undefined;

function startPackagedBackend(): void {
  if (!app.isPackaged) return;

  const rosDistro = process.env.ROS_DISTRO ?? "jazzy";
  const rosSetup = join("/opt/ros", rosDistro, "setup.bash");
  if (!existsSync(rosSetup)) {
    console.error(`ROS 2 ${rosDistro} was not found at ${rosSetup}`);
    return;
  }

  const backendDirectory = join(process.resourcesPath, "backend");
  const existingPythonPath = process.env.PYTHONPATH;
  backendProcess = spawn(
    "bash",
    [
      "-c",
      'source "$1" && shift && exec "$@"',
      "ros2-node-map-backend",
      rosSetup,
      "python3",
      "-m",
      "ros2_node_map.main",
      "serve",
    ],
    {
      env: {
        ...process.env,
        PYTHONPATH: [
          join(backendDirectory, "site-packages"),
          backendDirectory,
          existingPythonPath,
        ].filter(Boolean).join(":"),
      },
      stdio: "ignore",
    },
  );
  backendProcess.on("error", (error) => {
    console.error("Unable to start the bundled backend:", error);
  });
}

function stopPackagedBackend(): void {
  backendProcess?.kill();
  backendProcess = undefined;
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: "#15171b",
    webPreferences: {
      preload: join(currentDirectory, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) {
    void window.loadURL(developmentUrl);
  } else {
    void window.loadFile(join(currentDirectory, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  startPackagedBackend();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopPackagedBackend);
