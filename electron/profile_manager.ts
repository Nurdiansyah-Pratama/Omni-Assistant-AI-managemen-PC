import { appendBounded, readBundledConfig } from "./config";
import type { SystemContext } from "./context_monitor";
import type { FanMode } from "./systemControl";
import type { SamsungMode } from "./samsungMagician";

export interface ProfileRule {
  name: string;
  activation: {
    detectedActivity?: string;
    activeProcess?: string;
    activeProcessesAll?: string[];
    activeProcessesAny?: string[];
    activeWindowTitleIncludes?: string;
    fullscreen?: boolean;
    cpuTempGreaterThan?: number;
    cpuUsageGreaterThan?: number;
    gpuUsageGreaterThan?: number;
    ramUsageGreaterThan?: number;
    batteryState?: string;
  };
  priority: number;
  fanMode: FanMode | "silent" | "unchanged";
  memoryManagement: "monitor" | "safe-trim" | "pause-cleanup";
  ssdMode: SamsungMode | "standard" | "unchanged";
  relatedApps: string[];
  cooldownSeconds: number;
  minimumProfileDurationSeconds?: number;
  minimumConfidence?: number;
  profileLockSeconds?: number;
}

export interface ProfileChangeLog {
  from: string | null;
  to: string;
  reason: string;
  createdAt: string;
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
  logs: ProfileChangeLog[];
}

const fallbackProfiles: ProfileRule[] = [
  {
    name: "Idle",
    activation: { detectedActivity: "Idle" },
    priority: 1,
    fanMode: "standard",
    memoryManagement: "monitor",
    ssdMode: "balanced",
    relatedApps: [],
    cooldownSeconds: 120,
  },
];

let activeProfileName: string | null = null;
let lastChangedAt = 0;
let candidateProfileName: string | null = null;
let candidateSince = 0;
let candidateHits = 0;
let profileLockedUntil = 0;
let profileLogs: ProfileChangeLog[] = [];

function normalizeProcessName(name: string) {
  return name.toLowerCase().replace(/\.exe$/i, "");
}

function getProcessNames(context: SystemContext) {
  return new Set(
    context.runningProcesses.map((process) =>
      normalizeProcessName(process.name),
    ),
  );
}

function analyzeProfileMatch(profile: ProfileRule, context: SystemContext) {
  const activation = profile.activation;
  const processNames = getProcessNames(context);
  const activeProcess = normalizeProcessName(context.activeApp);
  const details: string[] = [];
  let checks = 0;
  let matchedChecks = 0;

  const pass = (condition: boolean, reason: string) => {
    checks += 1;
    if (condition) {
      matchedChecks += 1;
      details.push(reason);
      return true;
    }
    return false;
  };

  if (
    activation.detectedActivity &&
    !pass(
      activation.detectedActivity === context.detectedActivity,
      `Activity cocok: ${context.detectedActivity}`,
    )
  ) {
    return { matched: false, confidence: 0, details };
  }
  if (
    activation.activeProcess &&
    !pass(
      normalizeProcessName(activation.activeProcess) === activeProcess,
      `Active app cocok: ${context.activeApp}`,
    )
  ) {
    return { matched: false, confidence: 0, details };
  }
  if (
    activation.activeProcessesAll?.some(
      (name) => !processNames.has(normalizeProcessName(name)),
    )
  ) {
    return { matched: false, confidence: 0, details };
  }
  if (activation.activeProcessesAll?.length) {
    checks += activation.activeProcessesAll.length;
    matchedChecks += activation.activeProcessesAll.length;
    details.push(
      `Semua app wajib aktif: ${activation.activeProcessesAll.join(", ")}`,
    );
  }
  if (
    activation.activeProcessesAny?.length &&
    !activation.activeProcessesAny.some((name) =>
      processNames.has(normalizeProcessName(name)),
    )
  ) {
    return { matched: false, confidence: 0, details };
  }
  if (activation.activeProcessesAny?.length) {
    checks += 1;
    matchedChecks += 1;
    details.push(
      `Salah satu app terkait aktif: ${activation.activeProcessesAny.join(", ")}`,
    );
  }
  if (
    activation.activeWindowTitleIncludes &&
    !pass(
      context.activeWindowTitle
        .toLowerCase()
        .includes(activation.activeWindowTitleIncludes.toLowerCase()),
      `Window title mengandung ${activation.activeWindowTitleIncludes}`,
    )
  ) {
    return { matched: false, confidence: 0, details };
  }
  if (
    activation.fullscreen !== undefined &&
    !pass(
      activation.fullscreen === context.isFullscreen,
      context.isFullscreen ? "Fullscreen aktif" : "Tidak fullscreen",
    )
  ) {
    return { matched: false, confidence: 0, details };
  }
  if (
    activation.cpuTempGreaterThan !== undefined &&
    !pass(
      (context.cpuTemp ?? 0) > activation.cpuTempGreaterThan,
      `CPU temp > ${activation.cpuTempGreaterThan} C`,
    )
  ) {
    return { matched: false, confidence: 0, details };
  }
  if (
    activation.cpuUsageGreaterThan !== undefined &&
    !pass(
      context.cpuUsage > activation.cpuUsageGreaterThan,
      `CPU usage > ${activation.cpuUsageGreaterThan}%`,
    )
  ) {
    return { matched: false, confidence: 0, details };
  }
  if (
    activation.gpuUsageGreaterThan !== undefined &&
    !pass(
      (context.gpuUsage ?? 0) > activation.gpuUsageGreaterThan,
      `GPU usage > ${activation.gpuUsageGreaterThan}%`,
    )
  ) {
    return { matched: false, confidence: 0, details };
  }
  if (
    activation.ramUsageGreaterThan !== undefined &&
    !pass(
      context.ramUsage > activation.ramUsageGreaterThan,
      `RAM usage > ${activation.ramUsageGreaterThan}%`,
    )
  ) {
    return { matched: false, confidence: 0, details };
  }
  if (
    activation.batteryState &&
    !pass(
      activation.batteryState === context.batteryState,
      `Battery state: ${context.batteryState}`,
    )
  ) {
    return { matched: false, confidence: 0, details };
  }

  const relatedHits = profile.relatedApps.filter((app) =>
    processNames.has(normalizeProcessName(app)),
  ).length;
  const conditionScore = checks === 0 ? 0.45 : matchedChecks / checks;
  const relatedScore =
    profile.relatedApps.length === 0
      ? 0
      : Math.min(0.15, relatedHits / profile.relatedApps.length / 4);
  const priorityScore = Math.min(0.12, profile.priority / 1000);
  const activityBoost =
    context.detectedActivity === profile.name ||
    (profile.name === "Performance Cooling" && (context.cpuTemp ?? 0) > 85)
      ? 0.15
      : 0;

  return {
    matched: true,
    confidence: Math.max(
      0.35,
      Math.min(0.98, 0.38 + conditionScore * 0.35 + relatedScore + priorityScore + activityBoost),
    ),
    details: details.length ? details : [`Fallback kandidat: ${profile.name}`],
  };
}

export function getProfiles() {
  return readBundledConfig<ProfileRule[]>("profiles.json", fallbackProfiles);
}

export function getProfileLogs() {
  return profileLogs;
}

export function evaluateProfile(context: SystemContext): ProfileEvaluation {
  const profiles = getProfiles();
  const analyzed = profiles
    .map((profile) => ({
      profile,
      match: analyzeProfileMatch(profile, context),
    }))
    .filter((item) => item.match.matched)
    .sort((left, right) => right.profile.priority - left.profile.priority);
  const matched =
    analyzed[0]?.profile ??
    profiles
      .find((profile) => profile.name === "Idle") ??
    fallbackProfiles[0];
  const matchedAnalysis =
    analyzed[0]?.match ?? analyzeProfileMatch(matched, context);
  const previousProfile = activeProfileName;
  const now = Date.now();
  const cooldownSeconds = matched.cooldownSeconds ?? 120;
  const currentProfile =
    profiles.find((profile) => profile.name === activeProfileName) ?? null;
  const minimumProfileDurationSeconds =
    currentProfile?.minimumProfileDurationSeconds ?? 45;
  const minimumCandidateDurationSeconds =
    matched.name === "Performance Cooling" ? 0 : 30;
  const minimumConfidence = matched.minimumConfidence ?? 0.68;
  const emergencyOverride =
    matched.name === "Performance Cooling" && (context.cpuTemp ?? 0) >= 88;

  if (candidateProfileName !== matched.name) {
    candidateProfileName = matched.name;
    candidateSince = now;
    candidateHits = 1;
  } else {
    candidateHits += 1;
  }

  const candidateAgeMs = candidateSince ? now - candidateSince : 0;
  const candidateStable =
    candidateAgeMs >= minimumCandidateDurationSeconds * 1000 ||
    candidateHits >= 3 ||
    emergencyOverride;
  const currentDurationOk =
    !previousProfile ||
    previousProfile === matched.name ||
    now - lastChangedAt >= minimumProfileDurationSeconds * 1000 ||
    emergencyOverride;
  const confidenceOk = matchedAnalysis.confidence >= minimumConfidence || emergencyOverride;
  const lockOk = now >= profileLockedUntil || previousProfile === matched.name || emergencyOverride;
  const canChange =
    !previousProfile ||
    previousProfile === matched.name ||
    (now - lastChangedAt >= cooldownSeconds * 1000 &&
      candidateStable &&
      currentDurationOk &&
      confidenceOk &&
      lockOk);
  const changed =
    previousProfile !== matched.name && canChange;
  let reason = `Matched activity: ${context.detectedActivity}`;

  if (changed) {
    const log = {
      from: previousProfile,
      to: matched.name,
      reason: `${reason}; confidence ${Math.round(matchedAnalysis.confidence * 100)}%`,
      createdAt: new Date().toISOString(),
    };
    activeProfileName = matched.name;
    lastChangedAt = now;
    profileLockedUntil =
      now + (matched.profileLockSeconds ?? matched.cooldownSeconds ?? 120) * 1000;
    profileLogs = appendBounded(profileLogs, log, 200);
  } else if (previousProfile && previousProfile !== matched.name) {
    const blockers = [
      now - lastChangedAt < cooldownSeconds * 1000 ? "cooldown" : null,
      !candidateStable ? "candidate belum stabil" : null,
      !currentDurationOk ? "minimum duration" : null,
      !confidenceOk ? "confidence belum cukup" : null,
      !lockOk ? "profile lock" : null,
    ].filter(Boolean);
    reason = `Kandidat ${matched.name} ditahan (${blockers.join(", ")}), tetap ${previousProfile}.`;
  }

  const activeProfile =
    profiles.find((profile) => profile.name === activeProfileName) ??
    matched;
  const activeAnalysis =
    activeProfile.name === matched.name
      ? matchedAnalysis
      : analyzeProfileMatch(activeProfile, context);
  const activeProfileConfidence =
    activeAnalysis.matched && activeAnalysis.confidence > 0
      ? activeAnalysis.confidence
      : Math.max(0.45, matchedAnalysis.confidence - 0.15);
  const stabilityByAge =
    lastChangedAt === 0
      ? 0.5
      : Math.min(1, (now - lastChangedAt) / Math.max(1, cooldownSeconds * 1000));
  const stabilityByCandidate = Math.min(1, candidateHits / 3);
  const profileStabilityScore = Math.max(
    0,
    Math.min(
      1,
      activeProfile.name === matched.name
        ? (stabilityByAge + activeProfileConfidence) / 2
        : (stabilityByAge + stabilityByCandidate) / 2,
    ),
  );

  return {
    activeProfile,
    candidateProfile: matched,
    previousProfile,
    changed,
    reason,
    reasonDetails:
      activeProfile.name === matched.name
        ? matchedAnalysis.details
        : [...activeAnalysis.details, ...matchedAnalysis.details],
    activeProfileConfidence,
    candidateConfidence: matchedAnalysis.confidence,
    candidateSince: candidateSince
      ? new Date(candidateSince).toISOString()
      : null,
    profileStabilityScore,
    profileLockedUntil:
      profileLockedUntil > now
        ? new Date(profileLockedUntil).toISOString()
        : null,
    logs: profileLogs,
  };
}

export function setManualProfile(profileName: string | null) {
  if (!profileName) {
    activeProfileName = null;
    return;
  }

  const profile = getProfiles().find((item) => item.name === profileName);
  if (!profile) return;

  const log = {
    from: activeProfileName,
    to: profile.name,
    reason: "Manual profile override.",
    createdAt: new Date().toISOString(),
  };
  activeProfileName = profile.name;
  lastChangedAt = Date.now();
  profileLockedUntil = lastChangedAt + (profile.profileLockSeconds ?? 300) * 1000;
  candidateProfileName = profile.name;
  candidateSince = lastChangedAt;
  candidateHits = 1;
  profileLogs = appendBounded(profileLogs, log, 200);
}
