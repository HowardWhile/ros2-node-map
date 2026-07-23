import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("Linux release names include version, OS, and CPU architecture", () => {
  assert.equal(
    packageJson.build.linux.artifactName,
    "${productName}-v${version}-${os}-${arch}.${ext}",
  );
});

test("Windows releases are portable file-only applications without the ROS backend", () => {
  assert.deepEqual(packageJson.build.win.target, ["portable"]);
  assert.equal(
    packageJson.build.win.artifactName,
    "${productName}-v${version}-${os}-${arch}.${ext}",
  );
  assert.equal(packageJson.scripts["dist:win"], "npm run build && electron-builder --win portable");
  assert.equal(packageJson.build.portable.useZip, true);
  assert.equal(packageJson.build.extraResources, undefined);
  assert.equal(packageJson.build.linux.extraResources.length, 2);
});

test("production frontend assets are unpacked for the headless backend", () => {
  assert.deepEqual(packageJson.build.asarUnpack, ["dist/**"]);
});

test("Linux AppImages install a launcher for application CLI modes", () => {
  assert.equal(
    packageJson.build.afterAllArtifactBuild,
    "./scripts/patch-appimage-launcher.cjs",
  );
  assert.equal(packageJson.build.appImage.license, null);
});
