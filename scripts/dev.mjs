import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const viteEntry = path.resolve(
  path.dirname(require.resolve("vite")),
  "../../bin/vite.js",
);
const tscEntry = path.resolve(
  path.dirname(require.resolve("typescript")),
  "../bin/tsc",
);
const electronPath = require("electron");
const children = new Set();

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    ...options,
  });

  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}

function runOnce(command, args) {
  return new Promise((resolve, reject) => {
    const child = run(command, args);

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code ?? "unknown"}.`));
      }
    });
  });
}

function waitForPort(port, host = "127.0.0.1", timeoutMs = 30_000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const connect = () => {
      const socket = net.createConnection({ port, host });

      socket.once("connect", () => {
        socket.end();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();

        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Vite did not start on ${host}:${port}.`));
          return;
        }

        setTimeout(connect, 150);
      });
    };

    connect();
  });
}

function stopChildren() {
  for (const child of children) {
    child.kill();
  }
}

process.once("SIGINT", () => {
  stopChildren();
  process.exit(0);
});
process.once("SIGTERM", () => {
  stopChildren();
  process.exit(0);
});
process.once("exit", stopChildren);

try {
  await runOnce(process.execPath, [
    tscEntry,
    "-p",
    "electron/tsconfig.json",
  ]);

  const vite = run(process.execPath, [
    viteEntry,
    "--host",
    "127.0.0.1",
    "--port",
    "5173",
    "--strictPort",
  ]);

  await waitForPort(5173);

  const electronEnvironment = {
    ...process.env,
    VITE_DEV_SERVER_URL: "http://127.0.0.1:5173",
  };
  delete electronEnvironment.ELECTRON_RUN_AS_NODE;

  const electron = run(electronPath, ["."], {
    env: electronEnvironment,
  });

  electron.once("error", (error) => {
    console.error(`Unable to start Electron: ${error.message}`);
    vite.kill();
    process.exitCode = 1;
  });
  electron.once("exit", (code) => {
    vite.kill();

    if (code !== 0) {
      process.exitCode = code ?? 1;
    }
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stopChildren();
  process.exit(1);
}
