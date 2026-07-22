import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  CAPTURE_DISCOVERY_WAIT_SECONDS,
  cliModeFromArguments,
  cliModeFromEnvironment,
  cliUsage,
  headlessPortFromArguments,
  headlessPortFromEnvironment,
  installCurrentAppImage,
  uninstallCurrentAppImage,
} from "../electron/cli.ts";

test("selects one AppImage CLI mode and rejects combinations", () => {
  assert.equal(cliModeFromArguments([]), null);
  assert.equal(cliModeFromArguments(["--headless"]), "headless");
  assert.equal(cliModeFromArguments(["-c"]), "capture");
  assert.equal(cliModeFromArguments(["--capture"]), "capture");
  assert.equal(cliModeFromArguments(["--install"]), "install");
  assert.equal(cliModeFromArguments(["--uninstall"]), "uninstall");
  assert.equal(cliModeFromArguments(["-h"]), "help");
  assert.equal(cliModeFromArguments(["--help"]), "help");
  assert.equal(cliModeFromArguments(["-v"]), "version");
  assert.equal(cliModeFromArguments(["--version"]), "version");
  assert.equal(cliModeFromArguments(["--headless", "--capture"]), "invalid");
});

test("accepts one valid port only for headless mode", () => {
  assert.equal(headlessPortFromArguments([]), null);
  assert.equal(headlessPortFromArguments(["-p", "9000"]), 9000);
  assert.equal(headlessPortFromArguments(["--port", "9001"]), 9001);
  assert.equal(headlessPortFromArguments(["--port=9002"]), 9002);
  assert.equal(headlessPortFromArguments(["-p"]), "invalid");
  assert.equal(headlessPortFromArguments(["--port", "0"]), "invalid");
  assert.equal(headlessPortFromArguments(["--port", "70000"]), "invalid");
  assert.equal(headlessPortFromArguments(["-p", "9000", "--port", "9001"]), "invalid");
  assert.equal(headlessPortFromEnvironment("8766"), 8766);
});

test("capture waits for DDS discovery before writing a snapshot", () => {
  assert.equal(CAPTURE_DISCOVERY_WAIT_SECONDS, 3);
});

test("help text lists every supported CLI mode", () => {
  const usage = cliUsage();
  for (const option of ["--headless", "-p, --port PORT", "-c, --capture", "--install", "--uninstall", "-h, --help", "-v, --version"]) {
    assert.match(usage, new RegExp(option.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")));
  }
});

test("selects AppImage launcher modes only from supported environment values", () => {
  assert.equal(cliModeFromEnvironment("install"), "install");
  assert.equal(cliModeFromEnvironment("invalid"), "invalid");
  assert.equal(cliModeFromEnvironment("unknown"), "invalid");
  assert.equal(cliModeFromEnvironment(undefined), null);
});

test("self install links the current AppImage and uninstall preserves other versions", () => {
  const directory = mkdtempSync(join(tmpdir(), "ros2-node-map-cli-"));
  test.after(() => rmSync(directory, { recursive: true, force: true }));
  const binDirectory = join(directory, "bin");
  const appImage = join(directory, "node-map.AppImage");
  const otherAppImage = join(directory, "other.AppImage");
  writeFileSync(appImage, "appimage");
  writeFileSync(otherAppImage, "other appimage");
  const environment = { HOME: directory, XDG_BIN_HOME: binDirectory, PATH: "/usr/bin" };

  const installed = installCurrentAppImage(appImage, environment);
  assert.equal(uninstallCurrentAppImage(appImage, environment).commandPath, installed.commandPath);
  assert.equal(existsSync(installed.commandPath), false);
  assert.throws(
    () => uninstallCurrentAppImage(appImage, environment),
    /node-map command was not found/,
  );

  installCurrentAppImage(appImage, environment);
  installCurrentAppImage(otherAppImage, environment);
  assert.throws(
    () => uninstallCurrentAppImage(appImage, environment),
    /different AppImage/,
  );
  assert.equal(existsSync(installed.commandPath), true);
});
