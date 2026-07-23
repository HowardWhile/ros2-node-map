import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const patchAppImageLauncher = require("../scripts/patch-appimage-launcher.cjs");
const buildScript = await readFile(
  new URL("../../scripts/build-appimages.sh", import.meta.url),
  "utf8",
);
const dockerfile = await readFile(
  new URL("../../scripts/appimage-builder.Dockerfile", import.meta.url),
  "utf8",
);

test("local AppImage builder supports x86_64 and arm64", () => {
  assert.match(buildScript, /build_architectures=\(x86_64 arm64\)/);
  assert.match(buildScript, /platform="linux\/amd64"/);
  assert.match(buildScript, /platform="linux\/arm64"/);
  assert.match(
    buildScript,
    /ros2-node-map-v\$\{product_version\}-linux-\$\{architecture\}\.AppImage/,
  );
});

test("container build maps Docker and Electron architecture names to release names", () => {
  assert.match(dockerfile, /FROM ubuntu:24\.04 AS builder/);
  assert.match(
    dockerfile,
    /amd64\) electron_arch="x64"; release_arch="x86_64"/,
  );
  assert.match(
    dockerfile,
    /arm64\) electron_arch="arm64"; release_arch="arm64"/,
  );
  assert.match(dockerfile, /npm --prefix app run package:backend/);
  assert.match(dockerfile, /electron-builder --linux AppImage/);
});

test("finds a validated SquashFS superblock instead of the first magic string", () => {
  const image = Buffer.alloc(256);
  image.write("hsqs", 16);

  const squashfsOffset = 128;
  image.writeUInt32LE(0x73717368, squashfsOffset);
  image.writeUInt32LE(131_072, squashfsOffset + 12);
  image.writeUInt16LE(1, squashfsOffset + 20);
  image.writeUInt16LE(17, squashfsOffset + 22);
  image.writeUInt16LE(4, squashfsOffset + 28);
  image.writeUInt16LE(0, squashfsOffset + 30);
  image.writeBigUInt64LE(128n, squashfsOffset + 40);

  assert.equal(
    patchAppImageLauncher.findSquashfsOffset(image),
    squashfsOffset,
  );
});
