import type { FanMode, SamsungMode } from "./systemControl";

export interface RunningProcessInfo {
  name: string;
  pid: number;
  memoryMb: number;
  mainWindowTitle?: string;
}

export interface SystemContext {
  activeApp: string;
  activeWindowTitle: string;
  runningProcesses: RunningProcessInfo[];
  cpuUsage: number;
  cpuTemp: number | null;
  gpuUsage: number | null;
  ramUsage: number;
  ssdUsage: number | null;
  batteryState: "charging" | "discharging" | "unknown";
  isFullscreen: boolean;
  networkActivityKbps: number | null;
  detectedActivity: string;
  sampledAt: string;
}

export interface ProfileRule {
  name: string;
  activation: Record<string, unknown>;
  priority: number;
  fanMode: FanMode | "silent" | "unchanged";
  memoryManagement: "monitor" | "safe-trim" | "pause-cleanup";
  ssdMode: SamsungMode | "standard" | "unchanged";
  relatedApps: string[];
  cooldownSeconds: number;
}

export interface ProfileEvaluation {
  activeProfile: ProfileRule;
  candidateProfile: ProfileRule | null;
  previousProfile: string | null;
  changed: boolean;
  reason: string;
  reasonDetails: string[];
  activeProfileConfidence: number;
  candidateConfidence: number;
  candidateSince: string | null;
  profileStabilityScore: number;
  profileLockedUntil: string | null;
  logs: Array<{
    from: string | null;
    to: string;
    reason: string;
    createdAt: string;
  }>;
}

export interface WorkflowRule {
  name: string;
  trigger: Record<string, unknown>;
  conditions: Record<string, unknown>;
  actions: string[];
  cooldownSeconds: number;
  notification?: string;
}

export interface SafetySettings {
  paused: boolean;
  dryRun: boolean;
  manualOverride: boolean;
  whitelistProcesses: string[];
  blacklistedActions: string[];
}

export interface OmniDecision {
  decision_id: string;
  title: string;
  action: string;
  reason: string[];
  confidence: number;
  risk: "low" | "medium" | "high";
  recommended: boolean;
  timestamp: string;
  rollback_available: boolean;
  target?: string;
  status: "recommended" | "not_needed" | "blocked" | "dry-run" | "observed";
}

export interface DecisionSummary {
  decisions: OmniDecision[];
  explanations: Array<{
    label: string;
    value: string;
    reasons: string[];
    confidence: number;
    risk: "low" | "medium" | "high";
  }>;
  predictiveInsights: string[];
  optimizationRecommendations: string[];
  automationQualityScore: number;
  generatedAt: string;
}

export interface DashboardSnapshot {
  context: SystemContext | null;
  profile: ProfileEvaluation | null;
  profiles: ProfileRule[];
  workflows: WorkflowRule[];
  workflowLogs: Array<{
    workflow: string;
    action: string;
    result: string;
    confidence: number;
    risk: "low" | "medium" | "high";
    createdAt: string;
  }>;
  actionLogs: Array<{
    action: string;
    status: "allowed" | "blocked" | "dry-run" | "failed" | "success";
    reason: string;
    createdAt: string;
  }>;
  safety: SafetySettings;
  memoryInsights: {
    topApps: string[];
    topProfiles: string[];
    averageCpuTemp: number | null;
    averageRamUsage: number | null;
    behaviorInsights: string[];
    predictiveInsights: string[];
    optimizationRecommendations: string[];
  };
  memory: {
    preferences: Record<string, unknown>;
    manualRules: string[];
    workflowHistory: Array<{ name: string; createdAt: string; result: string }>;
    decisions: Array<{ note: string; createdAt: string }>;
  };
  decisionSummary: DecisionSummary | null;
  error: string | null;
  updatedAt: string;
}
