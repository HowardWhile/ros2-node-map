import {
  lstatSync,
  mkdirSync,
  realpathSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { basename, join } from "node:path";

export type CliMode = "headless" | "capture" | "install" | "uninstall";

const MODE_BY_ARGUMENT: Record<string, CliMode> = {
  "--headless": "headless",
  "--capture": "capture",
  "--install": "install",
  "--uninstall": "uninstall",
};

export function cliModeFromArguments(arguments_: readonly string[]): CliMode | "invalid" | null {
  const modes = arguments_
    .filter((argument) => argument in MODE_BY_ARGUMENT)
    .map((argument) => MODE_BY_ARGUMENT[argument]!);
  if (modes.length === 0) return null;
  return modes.length === 1 ? modes[0]! : "invalid";
}

export function cliModeFromEnvironment(
  value: string | undefined,
): CliMode | "invalid" | null {
  if (value === undefined || value === "") return null;
  if (value === "invalid") return "invalid";
  return Object.values(MODE_BY_ARGUMENT).includes(value as CliMode)
    ? (value as CliMode)
    : "invalid";
}

export function cliUsage(): string {
  return "Usage: node-map [--headless | --capture | --install | --uninstall]";
}

export function userBinDirectory(environment: NodeJS.ProcessEnv): string {
  if (environment.XDG_BIN_HOME) return environment.XDG_BIN_HOME;
  if (!environment.HOME) throw new Error("HOME is required to determine the node-map installation directory.");
  return join(environment.HOME, ".local", "bin");
}

function commandPathFor(environment: NodeJS.ProcessEnv): string {
  return join(userBinDirectory(environment), "node-map");
}

function currentAppImagePath(appImagePath: string | undefined): string {
  if (!appImagePath) throw new Error("This command must be run from a release AppImage.");
  return realpathSync(appImagePath);
}

export interface SelfInstallResult {
  appImagePath: string;
  commandPath: string;
}

export function installCurrentAppImage(
  appImagePath: string | undefined,
  environment: NodeJS.ProcessEnv,
): SelfInstallResult {
  const resolvedAppImagePath = currentAppImagePath(appImagePath);
  const commandPath = commandPathFor(environment);
  mkdirSync(userBinDirectory(environment), { recursive: true });
  try {
    const current = lstatSync(commandPath);
    if (!current.isSymbolicLink()) {
      throw new Error(`Cannot overwrite existing file: ${commandPath}`);
    }
    unlinkSync(commandPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  symlinkSync(resolvedAppImagePath, commandPath);
  return { appImagePath: resolvedAppImagePath, commandPath };
}

export function uninstallCurrentAppImage(
  appImagePath: string | undefined,
  environment: NodeJS.ProcessEnv,
): SelfInstallResult {
  const resolvedAppImagePath = currentAppImagePath(appImagePath);
  const commandPath = commandPathFor(environment);
  let commandMetadata: ReturnType<typeof lstatSync>;
  try {
    commandMetadata = lstatSync(commandPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`node-map command was not found: ${commandPath}`);
    }
    throw error;
  }
  if (!commandMetadata.isSymbolicLink()) {
    throw new Error(`node-map command is not a symbolic link: ${commandPath}`);
  }
  const targetPath = realpathSync(commandPath);
  if (targetPath !== resolvedAppImagePath) {
    throw new Error(`node-map command points to a different AppImage: ${targetPath}`);
  }
  unlinkSync(commandPath);
  return { appImagePath: resolvedAppImagePath, commandPath };
}

export function installMessage(result: SelfInstallResult, environment: NodeJS.ProcessEnv): string {
  const binDirectory = userBinDirectory(environment);
  const lines = [
    `node-map installed: ${result.commandPath}`,
    `Version: ${basename(result.appImagePath)}`,
    "",
    "Run node-map:",
    "  node-map",
    "",
    "To uninstall:",
    `  "${result.appImagePath}" --uninstall`,
  ];
  if (!environment.PATH?.split(":").includes(binDirectory)) {
    lines.push(
      "",
      `PATH does not contain ${binDirectory}. Add this line to ~/.bashrc:`,
      `export PATH="${binDirectory}:$PATH"`,
    );
  }
  lines.push("", "Reload your Bash configuration:", "  source ~/.bashrc");
  return lines.join("\n");
}
