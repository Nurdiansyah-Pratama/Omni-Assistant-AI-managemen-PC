import { getCurrentContext, type SystemContext } from "./context_monitor";
import {
  evaluateProfile,
  getProfileLogs,
  getProfiles,
  setManualProfile,
  type ProfileEvaluation,
} from "./profile_manager";
import {
  exportMemory,
  forgetMemory,
  getMemory,
  getMemoryInsights,
  importMemory,
  learnFromContext,
  updatePreference,
} from "./memory_manager";
import { getWorkflowLogs, getWorkflowRules, runWorkflows } from "./workflow_engine";
import {
  getActionLogs,
  getSafetySettings,
  checkAction,
  markActionResult,
  updateSafetySettings,
  type SafetySettings,
} from "./safety_guard";
import { runAutomationAction } from "./automation_actions";
import type { ProfileRule } from "./profile_manager";
import {
  evaluateDecisions,
  type DecisionSummary,
} from "./decision_engine";

export interface DashboardSnapshot {
  context: SystemContext | null;
  profile: ProfileEvaluation | null;
  profiles: ReturnType<typeof getProfiles>;
  workflows: ReturnType<typeof getWorkflowRules>;
  workflowLogs: ReturnType<typeof getWorkflowLogs>;
  actionLogs: ReturnType<typeof getActionLogs>;
  safety: SafetySettings;
  memoryInsights: ReturnType<typeof getMemoryInsights>;
  memory: ReturnType<typeof getMemory>;
  decisionSummary: DecisionSummary | null;
  error: string | null;
  updatedAt: string;
}

let timer: NodeJS.Timeout | null = null;
let latestContext: SystemContext | null = null;
let latestProfile: ProfileEvaluation | null = null;
let latestDecisionSummary: DecisionSummary | null = null;
let lastAppliedProfileName: string | null = null;
let lastDashboardError: string | null = null;

async function applyProfilePolicy(profile: ProfileRule) {
  if (lastAppliedProfileName === profile.name) return;

  const actions: Array<{
    name: Parameters<typeof runAutomationAction>[0];
    risk: "low" | "medium";
  }> = [];

  if (profile.fanMode === "performance") {
    actions.push({ name: "setFanPerformance", risk: "low" });
  } else if (profile.fanMode === "standard") {
    actions.push({ name: "setFanStandard", risk: "low" });
  }

  if (profile.ssdMode === "balanced" || profile.ssdMode === "standard") {
    actions.push({ name: "setSSDBalanced", risk: "low" });
  } else if (profile.ssdMode === "power-saving") {
    actions.push({ name: "setSSDPowerSaving", risk: "low" });
  } else if (profile.ssdMode === "performance") {
    actions.push({ name: "setSSDPerformance", risk: "medium" });
  }

  if (profile.memoryManagement === "safe-trim") {
    actions.push({ name: "freeMemorySafe", risk: "medium" });
  }

  for (const action of actions) {
    const safety = checkAction({
      action: `profile:${profile.name}:${action.name}`,
      risk: action.risk,
      cooldownSeconds: profile.cooldownSeconds,
    });
    if (safety.status !== "allowed") continue;

    try {
      const result = await runAutomationAction(action.name);
      markActionResult(
        `profile:${profile.name}:${action.name}`,
        "success",
        result,
      );
    } catch (error) {
      markActionResult(
        `profile:${profile.name}:${action.name}`,
        "failed",
        error instanceof Error ? error.message : "Profile action gagal.",
      );
    }
  }

  lastAppliedProfileName = profile.name;
}

async function sampleDashboard() {
  try {
    latestContext = await getCurrentContext();
    latestProfile = evaluateProfile(latestContext);
    latestDecisionSummary = evaluateDecisions(latestContext, latestProfile);
    learnFromContext(latestContext, latestProfile.activeProfile.name);
    await applyProfilePolicy(latestProfile.activeProfile);
    await runWorkflows(latestContext);
    lastDashboardError = null;
  } catch (error) {
    lastDashboardError =
      error instanceof Error
        ? error.message
        : "Dashboard automation gagal membaca context.";
  }
}

export function initializeDashboardAutomation() {
  if (timer) clearInterval(timer);
  void sampleDashboard();
  timer = setInterval(() => {
    void sampleDashboard();
  }, 15_000);
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  if (!latestContext || !latestProfile) {
    await sampleDashboard();
  }

  const profiles = getProfiles();
  const fallbackProfile = profiles.find((profile) => profile.name === "Idle");
  const fallbackEvaluation = fallbackProfile
    ? {
        activeProfile: fallbackProfile,
        candidateProfile: fallbackProfile,
        previousProfile: null,
        changed: false,
        reason: lastDashboardError ?? "Menunggu context pertama.",
        reasonDetails: [lastDashboardError ?? "Menunggu context pertama."],
        activeProfileConfidence: 0,
        candidateConfidence: 0,
        candidateSince: null,
        profileStabilityScore: 0,
        profileLockedUntil: null,
        logs: getProfileLogs(),
      }
    : null;

  return {
    context: latestContext,
    profile: latestProfile ?? fallbackEvaluation,
    profiles,
    workflows: getWorkflowRules(),
    workflowLogs: getWorkflowLogs(),
    actionLogs: [...getActionLogs(), ...getProfileLogs().map((log) => ({
      action: "profileChange",
      status: "success" as const,
      reason: `${log.from ?? "none"} -> ${log.to}: ${log.reason}`,
      createdAt: log.createdAt,
    }))].slice(-80),
    safety: getSafetySettings(),
    memoryInsights: getMemoryInsights(),
    memory: getMemory(),
    decisionSummary: latestDecisionSummary,
    error: lastDashboardError,
    updatedAt: new Date().toISOString(),
  };
}

export function updateDashboardSafety(input: Partial<SafetySettings>) {
  return updateSafetySettings(input);
}

export function setDashboardManualProfile(profileName: string | null) {
  setManualProfile(profileName);
  return getDashboardSnapshot();
}

export function updateDashboardPreference(input: {
  key: string;
  value: unknown;
}) {
  return updatePreference(input.key, input.value);
}

export function forgetDashboardMemory() {
  return forgetMemory();
}

export function exportDashboardMemory() {
  return exportMemory();
}

export function importDashboardMemory() {
  return importMemory();
}
