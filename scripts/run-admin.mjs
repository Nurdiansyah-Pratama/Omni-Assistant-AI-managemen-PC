import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptName = process.argv[2] === "start" ? "start" : "dev";
const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const powershellPath = path.join(
  process.env.SystemRoot ?? process.env.WINDIR ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
const npmCliPath = process.env.npm_execpath;

if (!npmCliPath) {
  console.error("Path npm-cli.js tidak ditemukan.");
  process.exit(1);
}

const result = spawnSync(
  powershellPath,
  [
    "-NoLogo",
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(scriptsDirectory, "run-admin.ps1"),
    "-ScriptName",
    scriptName,
    "-NodePath",
    process.execPath,
    "-NpmCliPath",
    npmCliPath,
  ],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(`Launcher Administrator gagal: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 0);
