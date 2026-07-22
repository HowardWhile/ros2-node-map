import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  cliModeFromArguments,
  cliModeFromEnvironment,
  installCurrentAppImage,
  uninstallCurrentAppImage,
} from "../electron/cli.ts";

test("selects one AppImage CLI mode and rejects combinations", () => {
  assert.equal(cliModeFromArguments([]), null);
  assert.equal(cliModeFromArguments(["--headless"]), "headless");
  assert.equal(cliModeFromArguments(["--capture"]), "capture");
  assert.equal(cliModeFromArguments(["--install"]), "install");
  assert.equal(cliModeFromArguments(["--uninstall"]), "uninstall");
  assert.equal(cliModeFromArguments(["--headless", "--capture"]), "invalid");
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

  installCurrentAppImage(appImage, environment);
  installCurrentAppImage(otherAppImage, environment);
  assert.throws(
    () => uninstallCurrentAppImage(appImage, environment),
    /different AppImage/,
  );
  assert.equal(existsSync(installed.commandPath), true);
});
