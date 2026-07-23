import { app, BrowserWindow, ipcMain } from "electron";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { networkInterfaces } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  CAPTURE_DISCOVERY_WAIT_SECONDS,
  cliModeFromArguments,
  cliModeFromEnvironment,
  cliUsage,
  headlessPortFromArguments,
  headlessPortFromEnvironment,
  installCurrentAppImage,
  installMessage,
  uninstallCurrentAppImage,
} from "./cli.js";
import { runtimeStatusFor, type RuntimeStatus } from "./runtime.js";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
let backendProcess: ChildProcess | undefined;
let quitting = false;
let headlessModeActive = false;
type DomainMode = "system" | "custom";
interface DomainSettings { mode: DomainMode; customDomainId?: string; }
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

function bundledFrontendDirectory(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "app.asar.unpacked", "dist")
    : join(currentDirectory, "../dist");
}

function inspectRuntime(): RuntimeStatus {
  if (process.platform !== "linux") {
    return runtimeStatusFor({
      platform: process.platform,
      rosAvailable: false,
      backendAvailable: false,
      rosSetupPath: rosSetupPath(),
    });
  }
  const rosAvailable = existsSync(rosSetupPath());
  const backendAvailable = bundledBackendAvailable();
  return runtimeStatusFor({
    platform: process.platform,
    rosAvailable,
    backendAvailable,
    rosSetupPath: rosSetupPath(),
  });
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

interface BackendStartOptions {
  host?: string;
  port?: number;
  frontendDirectory?: string;
  stdio?: "ignore" | "inherit";
}

function bundledBackendEnvironment() {
  const backendDirectory = join(process.resourcesPath, "backend");
  const existingPythonPath = process.env.PYTHONPATH;
  return {
    ...process.env,
    ROS2_NODE_MAP_VERSION: app.getVersion(),
    ROS_DOMAIN_ID: effectiveDomainId(),
    PYTHONPATH: [
      join(backendDirectory, "site-packages"),
      backendDirectory,
      existingPythonPath,
    ].filter(Boolean).join(":"),
  };
}

function bundledBackendCommand(arguments_: string[]): string[] {
  return [
    "-c",
    'source "$1" && shift && exec "$@"',
    "ros2-node-map-backend",
    rosSetupPath(),
    "python3",
    "-m",
    "ros2_node_map.main",
    ...arguments_,
  ];
}

function startPackagedBackend(options: BackendStartOptions = {}): void {
  if (!app.isPackaged) return;
  if (!runtimeStatus.liveAvailable) {
    console.error(runtimeStatus.reason ?? "ROS 2 live mode is unavailable.");
    return;
  }

  const arguments_ = ["serve"];
  if (options.host) arguments_.push("--host", options.host);
  if (options.port) arguments_.push("--port", String(options.port));
  if (options.frontendDirectory) {
    arguments_.push("--frontend-dir", options.frontendDirectory);
  }
  backendProcess = spawn(
    "bash",
    bundledBackendCommand(arguments_),
    {
      env: bundledBackendEnvironment(),
      stdio: options.stdio ?? "ignore",
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
      if (headlessModeActive) {
        console.error("Headless node-map server stopped unexpectedly.");
        app.exit(1);
      }
    }
  });
}

function runBundledBackend(arguments_: string[]): Promise<string> {
  if (!app.isPackaged) {
    return Promise.reject(new Error("Capture mode is available in the packaged AppImage."));
  }
  return new Promise((resolvePromise, rejectPromise) => {
    const process = spawn("bash", bundledBackendCommand(arguments_), {
      env: bundledBackendEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    process.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    process.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });
    process.once("error", rejectPromise);
    process.once("exit", (code) => {
      if (code === 0) resolvePromise(stdout);
      else rejectPromise(new Error(stderr.trim() || `Bundled backend exited with status ${code ?? "unknown"}.`));
    });
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

function headlessUrls(port: number): string[] {
  const urls = [`http://localhost:${port}`];
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((address) => address?.family === "IPv4" && !address.internal)
    .map((address) => address!.address)
    .filter((address, index, all) => all.indexOf(address) === index);
  urls.push(...addresses.map((address) => `http://${address}:${port}`));
  return urls;
}

async function waitForHeadlessServer(port: number): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (!backendProcess || backendProcess.exitCode !== null) {
      throw new Error("Headless node-map server did not start.");
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {
      // The backend needs a short time to initialize ROS and Uvicorn.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error("Timed out waiting for the headless node-map server.");
}

function nextCapturePath(): string {
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
  const prefix = `ros2-node-map-${timestamp}`;
  for (let index = 0; index < 10_000; index += 1) {
    const suffix = index === 0 ? "" : `-${index}`;
    const candidate = resolve(process.cwd(), `${prefix}${suffix}.json`);
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error("Could not find an available capture filename.");
}

function writeCapture(content: string): string {
  JSON.parse(content);
  const outputPath = nextCapturePath();
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  try {
    writeFileSync(temporaryPath, content, { encoding: "utf8", flag: "wx" });
    renameSync(temporaryPath, outputPath);
    return outputPath;
  } catch (error) {
    try { unlinkSync(temporaryPath); } catch { /* No temporary output was created. */ }
    throw error;
  }
}

async function runHeadlessMode(port: number): Promise<void> {
  runtimeStatus = inspectRuntime();
  if (!runtimeStatus.liveAvailable) throw new Error(runtimeStatus.reason ?? "ROS 2 live mode is unavailable.");
  const frontendDirectory = bundledFrontendDirectory();
  if (!existsSync(join(frontendDirectory, "index.html"))) {
    throw new Error(`Production frontend assets were not found: ${frontendDirectory}`);
  }
  headlessModeActive = true;
  startPackagedBackend({
    host: "0.0.0.0",
    port,
    frontendDirectory,
    stdio: "inherit",
  });
  await waitForHeadlessServer(port);
  console.log("node-map headless server is ready. Open one of these URLs:");
  for (const url of headlessUrls(port)) console.log(`  ${url}`);
  process.once("SIGINT", () => app.quit());
  process.once("SIGTERM", () => app.quit());
}

async function runCaptureMode(): Promise<void> {
  runtimeStatus = inspectRuntime();
  if (!runtimeStatus.liveAvailable) throw new Error(runtimeStatus.reason ?? "ROS 2 live mode is unavailable.");
  const outputPath = writeCapture(await runBundledBackend([
    "snapshot",
    "--pretty",
    "--wait",
    String(CAPTURE_DISCOVERY_WAIT_SECONDS),
  ]));
  console.log(`Graph snapshot saved: ${outputPath}`);
  console.log("Copy this file to another computer and open it in node-map File mode.");
}

async function runCliMode(
  mode: ReturnType<typeof cliModeFromArguments>,
  headlessPort: number | "invalid" | null,
): Promise<void> {
  if (mode === "help") {
    console.log(cliUsage());
    app.exit(0);
    return;
  }
  if (mode === "version") {
    console.log(app.getVersion());
    app.exit(0);
    return;
  }
  if (mode === "invalid" || headlessPort === "invalid" || (headlessPort !== null && mode !== "headless")) {
    console.error(cliUsage());
    app.exit(2);
    return;
  }
  try {
    if (mode === "install") {
      console.log(installMessage(installCurrentAppImage(process.env.APPIMAGE, process.env), process.env));
      app.exit(0);
      return;
    }
    if (mode === "uninstall") {
      const result = uninstallCurrentAppImage(process.env.APPIMAGE, process.env);
      console.log(`node-map command removed: ${result.commandPath}`);
      app.exit(0);
      return;
    }
    if (mode === "headless") await runHeadlessMode(headlessPort ?? 8766);
    if (mode === "capture") await runCaptureMode();
    if (mode === "capture") app.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    await stopPackagedBackend();
    app.exit(1);
  }
}

const requestedCliMode =
  cliModeFromEnvironment(process.env.NODE_MAP_CLI_MODE) ??
  cliModeFromArguments(process.argv);
const requestedHeadlessPort =
  headlessPortFromEnvironment(process.env.NODE_MAP_HEADLESS_PORT) ??
  headlessPortFromArguments(process.argv);

if (
  requestedCliMode === "invalid" ||
  requestedCliMode === "help" ||
  requestedCliMode === "version" ||
  requestedCliMode === "install" ||
  requestedCliMode === "uninstall" ||
  requestedHeadlessPort === "invalid" ||
  (requestedHeadlessPort !== null && requestedCliMode !== "headless")
) {
  void runCliMode(requestedCliMode ?? "invalid", requestedHeadlessPort);
} else {
  app.whenReady().then(() => {
    const mode = requestedCliMode;
    if (mode) {
      void runCliMode(mode, requestedHeadlessPort);
      return;
    }
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
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  quitting = true;
  void stopPackagedBackend();
});
