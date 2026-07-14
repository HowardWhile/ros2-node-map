import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const appDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const backendDirectory = join(appDirectory, "..", "backend");
const runtimeDirectory = join(backendDirectory, ".package-runtime");
const requirementsPath = join(runtimeDirectory, "requirements.txt");
const sitePackagesPath = join(runtimeDirectory, "site-packages");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: backendDirectory,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function removeNonRuntimeFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["__pycache__", "test", "tests", ".pytest_cache"].includes(entry.name)) {
        rmSync(entryPath, { recursive: true, force: true });
      } else {
        removeNonRuntimeFiles(entryPath);
      }
    } else if (entry.name.endsWith(".pyc")) {
      rmSync(entryPath, { force: true });
    }
  }
}

rmSync(runtimeDirectory, { recursive: true, force: true });
mkdirSync(runtimeDirectory, { recursive: true });

// Exporting from uv.lock keeps the bundled Python dependencies reproducible.
run("uv", [
  "export",
  "--no-dev",
  "--no-emit-project",
  "--no-hashes",
  "--output-file",
  requirementsPath,
]);
run("uv", [
  "pip",
  "install",
  "--python",
  "python3",
  "--target",
  sitePackagesPath,
  "--requirement",
  requirementsPath,
]);

if (!existsSync(sitePackagesPath)) {
  throw new Error("Backend Python dependencies were not created.");
}

// Some local Python environments inject agent guidance into installed packages.
// It is not runtime code and should not be distributed with the application.
rmSync(join(sitePackagesPath, "fastapi", ".agents"), {
  recursive: true,
  force: true,
});
removeNonRuntimeFiles(sitePackagesPath);
