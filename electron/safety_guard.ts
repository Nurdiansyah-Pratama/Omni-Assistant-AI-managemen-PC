import { appendBounded } from "./config";
import { getMemory } from "./memory_manager";

export type AutomationRisk = "low" | "medium" | "high";

export interface SafetySettings {
  paused: boolean;
  dryRun: boolean;
  manualOverride: boolean;
  whitelistProcesses: string[];
  blacklistedActions: string[];
}

export interface ActionLog {
  action: string;
  status: "allowed" | "blocked" | "dry-run" | "failed" | "success";
  reason: string;
  createdAt: string;
}

const defaultSettings: SafetySettings = {
  paused: false,
  dryRun: true,
  manualOverride: false,
  whitelistProcesses: [
    "System",
    "explorer",
    "Code",
    "chrome",
    "msedge",
    "Unity",
    "devenv",
    "powershell",
    "cmd",
    "WINWORD",
    "EXCEL",
    "POWERPNT",
    "MSProject",
    "OUTLOOK",
  ],
  blacklistedActions: [
    "killSystemProcess",
    "formatDisk",
    "restartWindows",
    "deleteFiles",
  ],
};

let settings = defaultSettings;
let actionLogs: ActionLog[] = [];
const actionCooldowns = new Map<string, number>();

function log(action: string, status: ActionLog["status"], reason: string) {
  const entry = {
    action,
    status,
    reason,
    createdAt: new Date().toISOString(),
  };
  actionLogs = appendBounded(actionLogs, entry, 300);
  return entry;
}

export function getSafetySettings() {
  const memory = getMemory();
  const neverClose = memory.preferences.neverCloseProcesses;
  return {
    ...settings,
    whitelistProcesses: Array.from(
      new Set([
        ...settings.whitelistProcesses,
        ...(Array.isArray(neverClose) ? neverClose.map(String) : []),
      ]),
    ),
  };
}

export function updateSafetySettings(input: Partial<SafetySettings>) {
  settings = {
    ...settings,
    ...input,
    whitelistProcesses:
      input.whitelistProcesses ?? settings.whitelistProcesses,
    blacklistedActions:
      input.blacklistedActions ?? settings.blacklistedActions,
  };
  return getSafetySettings();
}

export function getActionLogs() {
  return actionLogs;
}

export function checkAction(input: {
  action: string;
  risk: AutomationRisk;
  cooldownSeconds: number;
}) {
  const current = getSafetySettings();
  const now = Date.now();
  const lastRunAt = actionCooldowns.get(input.action) ?? 0;

  if (current.blacklistedActions.includes(input.action)) {
    return log(input.action, "blocked", "Action masuk blacklist.");
  }
  if (current.paused || current.manualOverride) {
    return log(input.action, "blocked", "Automation sedang pause/manual override.");
  }
  if (input.risk === "high") {
    return log(input.action, "blocked", "Action high-risk memerlukan konfirmasi user.");
  }
  if (now - lastRunAt < input.cooldownSeconds * 1000) {
    return log(input.action, "blocked", "Cooldown action masih aktif.");
  }
  if (current.dryRun) {
    return log(input.action, "dry-run", "Dry-run aktif; action tidak dieksekusi.");
  }

  actionCooldowns.set(input.action, now);
  return log(input.action, "allowed", "Action diizinkan.");
}

export function markActionResult(
  action: string,
  status: "success" | "failed",
  reason: string,
) {
  return log(action, status, reason);
}
