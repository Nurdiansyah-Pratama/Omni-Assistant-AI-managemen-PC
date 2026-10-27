import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

export function getUserDataPath(fileName: string) {
  return path.join(app.getPath("userData"), fileName);
}

export function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

export function readBundledConfig<T>(fileName: string, fallback: T): T {
  const candidates = [
    path.join(app.getAppPath(), "config", fileName),
    path.join(process.cwd(), "config", fileName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return readJsonFile(candidate, fallback);
    }
  }

  return fallback;
}

export function appendBounded<T>(items: T[], item: T, limit: number) {
  return [...items, item].slice(-limit);
}
