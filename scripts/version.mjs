import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const paths = {
  packageJson: join(root, "app", "package.json"),
  packageLock: join(root, "app", "package-lock.json"),
  pyproject: join(root, "backend", "pyproject.toml"),
  uvLock: join(root, "backend", "uv.lock"),
};
const versionPattern = /^\d+\.\d+\.\d+$/;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function projectVersion(toml) {
  const projectBlock = toml.match(/\[project\][\s\S]*?\r?\nversion = "([^"]+)"/);
  if (!projectBlock) throw new Error("找不到 Backend 專案版本。");
  return projectBlock[1];
}

function lockedPackageVersion(toml, packageName) {
  const packageBlock = toml.match(
    new RegExp(`\\[\\[package\\]\\]\\r?\\nname = "${packageName}"\\r?\\nversion = "([^"]+)"`),
  );
  if (!packageBlock) throw new Error(`找不到 ${packageName} 的鎖檔版本。`);
  return packageBlock[1];
}

function replaceProjectVersion(toml, version) {
  const projectExpression = /(\[project\][\s\S]*?\r?\nversion = ")[^"]+("\r?\n)/;
  if (!projectExpression.test(toml)) throw new Error("找不到 Backend 專案版本。");
  return toml.replace(projectExpression, `$1${version}$2`);
}

function replaceLockedPackageVersion(toml, packageName, version) {
  const packageExpression = new RegExp(
    `(\\[\\[package\\]\\]\\r?\\nname = "${packageName}"\\r?\\nversion = ")[^"]+("\\r?\\n)`,
  );
  if (!packageExpression.test(toml)) {
    throw new Error(`找不到 ${packageName} 的鎖檔版本。`);
  }
  return toml.replace(packageExpression, `$1${version}$2`);
}

function versions() {
  const packageJson = readJson(paths.packageJson);
  const packageLock = readJson(paths.packageLock);
  const pyproject = readFileSync(paths.pyproject, "utf8");
  const uvLock = readFileSync(paths.uvLock, "utf8");
  return {
    frontend: packageJson.version,
    frontendLock: packageLock.version,
    frontendLockRoot: packageLock.packages[""].version,
    backend: projectVersion(pyproject),
    backendLock: lockedPackageVersion(uvLock, "ros2-node-map"),
  };
}

function check() {
  const found = versions();
  const unique = new Set(Object.values(found));
  if (unique.size !== 1 || !versionPattern.test(found.frontend)) {
    throw new Error(`版本必須是相同的 x.y.z：${JSON.stringify(found)}`);
  }
  console.log(`產品版本 ${found.frontend}`);
}

function setVersion(version) {
  if (!versionPattern.test(version)) {
    throw new Error("版本格式必須是三段數字，例如 0.2.0。");
  }

  const packageJson = readJson(paths.packageJson);
  const packageLock = readJson(paths.packageLock);
  packageJson.version = version;
  packageLock.version = version;
  packageLock.packages[""].version = version;
  writeFileSync(paths.packageJson, `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileSync(paths.packageLock, `${JSON.stringify(packageLock, null, 2)}\n`);

  const pyproject = readFileSync(paths.pyproject, "utf8");
  writeFileSync(paths.pyproject, replaceProjectVersion(pyproject, version));
  const uvLock = readFileSync(paths.uvLock, "utf8");
  writeFileSync(
    paths.uvLock,
    replaceLockedPackageVersion(uvLock, "ros2-node-map", version),
  );
  check();
}

const [command, value] = process.argv.slice(2);
if (command === "check" && value === undefined) check();
else if (command === "set" && value !== undefined) setVersion(value);
else {
  throw new Error(
    "用法：node scripts/version.mjs check 或 node scripts/version.mjs set 0.2.0",
  );
}
