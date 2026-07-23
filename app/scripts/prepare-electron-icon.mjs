import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";

const electronDefaultIconUrl =
  "https://raw.githubusercontent.com/electron/electron/main/default_app/icon.png";
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const iconDirectory = join(scriptDirectory, "..", "build");
const pngPath = join(iconDirectory, "electron-default-icon.png");
const icoPath = join(iconDirectory, "electron-default-icon.ico");

const run = promisify(execFile);
const curlArguments = [
  "--fail",
  "--location",
  "--silent",
  "--show-error",
  ...(process.platform === "win32" ? ["--ssl-no-revoke"] : []),
  "--output",
  pngPath,
  electronDefaultIconUrl,
];

await mkdir(iconDirectory, { recursive: true });
await run("curl", curlArguments);

const png = await readFile(pngPath);
const pngSignature = "89504e470d0a1a0a";
if (png.subarray(0, 8).toString("hex") !== pngSignature) {
  throw new Error("Electron's default icon download was not a PNG file.");
}

const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
if (width !== height) {
  throw new Error(
    `Electron's default icon must be square; received ${width}x${height}.`,
  );
}

const ico = await pngToIco(png);

await writeFile(icoPath, ico);

console.log("Prepared Electron default icons for packaging.");
