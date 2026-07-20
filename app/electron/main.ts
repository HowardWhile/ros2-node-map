import { app, BrowserWindow, ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
let backendProcess: ChildProcess | undefined;
let quitting = false;
type DomainMode = "system" | "custom";
interface DomainSettings { mode: DomainMode; customDomainId?: string; }
interface RuntimeStatus {
  rosAvailable: boolean;
  backendAvailable: boolean;
  liveAvailable: boolean;
  reason?: string;
}
let domainSettings: DomainSettings = { mode: "system" };
let runtimeStatus: RuntimeStatus = {
  rosAvailable: false,
  backendAvailable: false,
  liveAvailable: false,
  reason: "ROS 2 runtime has not been inspected yet.",
};

function rosSetupPath(): string {
  return join("/opt/ros", process.env.ROS_DISTRO ?? "jazzy", "setup.bash");
}

function bundledBackendAvailable(): boolean {
  return !app.isPackaged || existsSync(join(process.resourcesPath, "backend", "ros2_node_map", "main.py"));
}

function inspectRuntime(): RuntimeStatus {
  const rosAvailable = existsSync(rosSetupPath());
  const backendAvailable = bundledBackendAvailable();
  const reason = !rosAvailable
    ? `ROS 2 was not found at ${rosSetupPath()}.`
    : !backendAvailable
      ? "The bundled ros2-node-map backend is missing."
      : undefined;
  return { rosAvailable, backendAvailable, liveAvailable: rosAvailable && backendAvailable, reason };
}

function publishRuntimeStatus(status: RuntimeStatus): void {
  runtimeStatus = status;
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("runtime:status", status);
  }
}

function validDomainId(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) <= 232;
}

function systemDomainId(): string {
  const value = process.env.ROS_DOMAIN_ID?.trim() ?? "";
  return validDomainId(value) ? value : "0";
}

function domainSettingsPath(): string {
  return join(app.getPath("userData"), "domain-settings.json");
}

function loadDomainSettings(): DomainSettings {
  try {
    const value = JSON.parse(readFileSync(domainSettingsPath(), "utf8")) as Partial<DomainSettings>;
    if (value.mode === "custom" && value.customDomainId && validDomainId(value.customDomainId)) {
      return { mode: "custom", customDomainId: value.customDomainId };
    }
  } catch {
    // Missing or malformed settings fall back to the inherited ROS environment.
  }
  return { mode: "system" };
}

function saveDomainSettings(settings: DomainSettings): void {
  mkdirSync(dirname(domainSettingsPath()), { recursive: true });
  writeFileSync(domainSettingsPath(), `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function effectiveDomainId(): string {
  return domainSettings.mode === "custom" && domainSettings.customDomainId
    ? domainSettings.customDomainId
    : systemDomainId();
}

function domainConfig() {
  return {
    configurable: app.isPackaged && runtimeStatus.liveAvailable,
    mode: domainSettings.mode,
    systemDomainId: systemDomainId(),
    customDomainId: domainSettings.customDomainId ?? "",
    effectiveDomainId: effectiveDomainId(),
  };
}

function startPackagedBackend(): void {
  if (!app.isPackaged) return;
  if (!runtimeStatus.liveAvailable) {
    console.error(runtimeStatus.reason ?? "ROS 2 live mode is unavailable.");
    return;
  }

  const rosSetup = rosSetupPath();
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
        ROS_DOMAIN_ID: effectiveDomainId(),
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
    publishRuntimeStatus({
      ...runtimeStatus,
      backendAvailable: false,
      liveAvailable: false,
      reason: `Unable to start the bundled backend: ${error.message}`,
    });
  });
  const startedProcess = backendProcess;
  backendProcess.on("exit", (code, signal) => {
    if (backendProcess !== startedProcess) return;
    backendProcess = undefined;
    if (!quitting) {
      publishRuntimeStatus({
        ...runtimeStatus,
        backendAvailable: false,
        liveAvailable: false,
        reason: `Bundled backend stopped unexpectedly (${signal ?? code ?? "unknown"}).`,
      });
    }
  });
}

async function stopPackagedBackend(): Promise<void> {
  const processToStop = backendProcess;
  backendProcess = undefined;
  if (!processToStop || processToStop.exitCode !== null) return;

  const exited = new Promise<void>((resolve) => {
    processToStop.once("exit", () => resolve());
    processToStop.once("error", () => resolve());
  });
  processToStop.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  ]);
  if (processToStop.exitCode === null && processToStop.signalCode === null) {
    processToStop.kill("SIGKILL");
    await Promise.race([
      exited,
      new Promise<void>((resolve) => setTimeout(resolve, 500)),
    ]);
  }
}

async function restartPackagedBackend(): Promise<void> {
  await stopPackagedBackend();
  startPackagedBackend();
}

function registerDomainHandlers(): void {
  ipcMain.handle("domain:get", () => domainConfig());
  ipcMain.handle("domain:set", async (_event, value: unknown) => {
    if (!app.isPackaged) throw new Error("Domain switching is available in the packaged app.");
    if (!runtimeStatus.liveAvailable) throw new Error("ROS 2 live mode is unavailable.");
    if (!value || typeof value !== "object") throw new Error("Invalid domain settings.");

    const request = value as { mode?: unknown; customDomainId?: unknown };
    if (request.mode !== "system" && request.mode !== "custom") {
      throw new Error("Invalid domain mode.");
    }
    const customDomainId = String(request.customDomainId ?? "").trim();
    if (request.mode === "custom" && !validDomainId(customDomainId)) {
      throw new Error("ROS_DOMAIN_ID must be an integer from 0 to 232.");
    }

    domainSettings = {
      mode: request.mode,
      customDomainId: customDomainId || domainSettings.customDomainId,
    };
    saveDomainSettings(domainSettings);
    await restartPackagedBackend();
    return domainConfig();
  });
}

function registerRuntimeHandlers(): void {
  ipcMain.handle("runtime:get", () => runtimeStatus);
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
  domainSettings = loadDomainSettings();
  runtimeStatus = inspectRuntime();
  registerDomainHandlers();
  registerRuntimeHandlers();
  startPackagedBackend();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  quitting = true;
  void stopPackagedBackend();
});
