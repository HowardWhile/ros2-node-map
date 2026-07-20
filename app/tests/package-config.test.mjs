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
