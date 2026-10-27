import type { SystemContext } from "./context_monitor";
import { addDecision, getMemory } from "./memory_manager";
import type { ProfileEvaluation, ProfileRule } from "./profile_manager";
import { getActionLogs, type AutomationRisk } from "./safety_guard";
import type { AutomationActionName } from "./automation_actions";

export interface OmniDecision {
  decision_id: string;
  title: string;
  action: AutomationActionName | "keepProfile" | "switchProfile" | "observe";
  reason: string[];
  confidence: number;
  risk: AutomationRisk;
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
    risk: AutomationRisk;
  }>;
  predictiveInsights: string[];
  optimizationRecommendations: string[];
  automationQualityScore: number;
  generatedAt: string;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function createDecision(input: Omit<OmniDecision, "decision_id" | "timestamp">) {
  const timestamp = new Date().toISOString();
  return {
    decision_id: `dec_${timestamp.replace(/[-:.TZ]/g, "")}_${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    timestamp,
    ...input,
  };
}

function fanDecision(context: SystemContext, profile: ProfileRule, confidence: number) {
  const reasons = [
    `Profile aktif: ${profile.name}`,
    `Activity terdeteksi: ${context.detectedActivity}`,
  ];

  if ((context.cpuTemp ?? 0) >= 85) {
    reasons.push(`CPU panas: ${context.cpuTemp?.toFixed(1)} C`);
  }
  if (context.cpuUsage >= 85) reasons.push(`CPU usage tinggi: ${context.cpuUsage}%`);
  if (context.batteryState === "charging") reasons.push("Device sedang charging");

  if (profile.fanMode === "performance") {
    return createDecision({
      title: "Fan Performance direkomendasikan",
      action: "setFanPerformance",
      target: "fan",
      reason: reasons,
      confidence,
      risk: "low",
      recommended: true,
      rollback_available: true,
      status: "recommended",
    });
  }

  return createDecision({
    title: "Fan Standard cukup",
    action: "setFanStandard",
    target: "fan",
    reason: [
      ...reasons,
      (context.cpuTemp ?? 0) > 0
        ? `CPU masih di ${context.cpuTemp?.toFixed(1)} C`
        : "Sensor suhu belum tersedia",
    ],
    confidence: clampScore(Math.max(0.55, confidence - 0.1)),
    risk: "low",
    recommended: profile.fanMode === "standard",
    rollback_available: true,
    status: profile.fanMode === "standard" ? "recommended" : "not_needed",
  });
}

function ssdDecision(context: SystemContext, profile: ProfileRule, confidence: number) {
  const reasons = [
    `Profile aktif: ${profile.name}`,
    context.ssdUsage === null
      ? "SSD usage belum tersedia"
      : `SSD usage ${context.ssdUsage.toFixed(0)}%`,
  ];

  if (profile.ssdMode === "performance") {
    return createDecision({
      title: "SSD Performance perlu konfirmasi",
      action: "setSSDPerformance",
      target: "ssd",
      reason: [...reasons, "Mode ini medium-risk sehingga tidak diterapkan diam-diam."],
      confidence: clampScore(confidence - 0.05),
      risk: "medium",
      recommended: true,
      rollback_available: true,
      status: "blocked",
    });
  }

  return createDecision({
    title: `SSD ${profile.ssdMode === "power-saving" ? "Power Saving" : "Balanced"} direkomendasikan`,
    action:
      profile.ssdMode === "power-saving" ? "setSSDPowerSaving" : "setSSDBalanced",
    target: "ssd",
    reason: reasons,
    confidence: clampScore(confidence - 0.08),
    risk: "low",
    recommended: profile.ssdMode !== "unchanged",
    rollback_available: true,
    status: profile.ssdMode === "unchanged" ? "not_needed" : "recommended",
  });
}

function memoryDecision(context: SystemContext, profile: ProfileRule, confidence: number) {
  if (profile.memoryManagement === "safe-trim" && context.ramUsage >= 85) {
    return createDecision({
      title: "RAM cleanup aman direkomendasikan",
      action: "freeMemorySafe",
      target: "memory",
      reason: [
        `RAM usage ${context.ramUsage}%`,
        `Profile ${profile.name} mengizinkan safe-trim`,
        "Protected process tetap dijaga oleh safety guard",
      ],
      confidence: clampScore(confidence),
      risk: "medium",
      recommended: true,
      rollback_available: false,
      status: "recommended",
    });
  }

  return createDecision({
    title: "RAM cleanup tidak dijalankan",
    action: "observe",
    target: "memory",
    reason: [
      `RAM usage ${context.ramUsage}%`,
      profile.memoryManagement === "pause-cleanup"
        ? "Profile sedang menunda cleanup background"
        : "Belum melewati threshold aman",
    ],
    confidence: clampScore(Math.max(0.6, confidence - 0.15)),
    risk: "low",
    recommended: false,
    rollback_available: false,
    status: "not_needed",
  });
}

function profileDecision(profileEvaluation: ProfileEvaluation) {
  const active = profileEvaluation.activeProfile;
  const candidate = profileEvaluation.candidateProfile;
  const switching = Boolean(profileEvaluation.changed);
  const reasons = [
    profileEvaluation.reason,
    `Confidence aktif: ${Math.round(profileEvaluation.activeProfileConfidence * 100)}%`,
    `Stability score: ${Math.round(profileEvaluation.profileStabilityScore * 100)}%`,
  ];

  if (candidate && candidate.name !== active.name) {
    reasons.push(
      `Kandidat ${candidate.name} ditahan sampai stabil (${Math.round(
        profileEvaluation.candidateConfidence * 100,
      )}%).`,
    );
  }

  return createDecision({
    title: switching ? `Switch profile ke ${active.name}` : `Pertahankan profile ${active.name}`,
    action: switching ? "switchProfile" : "keepProfile",
    target: "profile",
    reason: reasons,
    confidence: profileEvaluation.activeProfileConfidence,
    risk: "low",
    recommended: true,
    rollback_available: true,
    status: "observed",
  });
}

function buildPredictiveInsights(context: SystemContext, profile: ProfileRule) {
  const memory = getMemory();
  const stats = memory.behaviorPatterns.profileResourceStats[profile.name];
  const insights: string[] = [];

  if (stats?.samples >= 3) {
    if (stats.peakRamUsage >= 90 && context.ramUsage >= 75) {
      insights.push(
        `Berdasarkan pola ${profile.name}, RAM pernah mencapai ${stats.peakRamUsage}%; jika tren naik, 90% mungkin tercapai dalam beberapa refresh.`,
      );
    }
    if ((stats.peakCpuTemp ?? 0) >= 85) {
      insights.push(
        `${profile.name} biasanya bisa membuat CPU melewati ${stats.peakCpuTemp} C.`,
      );
    }
  }

  if (context.ramUsage >= 80) {
    insights.push("RAM sedang tinggi; Omni akan menunggu safety validation sebelum cleanup.");
  }

  return insights.slice(0, 4);
}

function buildOptimizationRecommendations() {
  const memory = getMemory();
  const recommendations: string[] = [];
  for (const [profile, stats] of Object.entries(
    memory.behaviorPatterns.profileResourceStats,
  )) {
    if (stats.samples < 5) continue;
    if (stats.averageRamUsage >= 85) {
      recommendations.push(
        `Threshold RAM cleanup untuk ${profile} layak diuji di 85% (confidence ${Math.min(
          95,
          60 + stats.samples * 4,
        )}%).`,
      );
    }
    if ((stats.averageCpuTemp ?? 0) >= 80) {
      recommendations.push(
        `Cooling untuk ${profile} layak aktif lebih awal di 80 C. Rekomendasi ini belum diterapkan otomatis.`,
      );
    }
  }
  return recommendations.slice(0, 4);
}

function calculateAutomationQualityScore(profileEvaluation: ProfileEvaluation) {
  const memory = getMemory();
  const workflowTotals = Object.values(memory.workflowStats).reduce(
    (total, stats) => ({
      success: total.success + stats.success,
      failed: total.failed + stats.failed,
      blocked: total.blocked + stats.blocked,
    }),
    { success: 0, failed: 0, blocked: 0 },
  );
  const workflowCount =
    workflowTotals.success + workflowTotals.failed + workflowTotals.blocked;
  const workflowScore =
    workflowCount === 0
      ? 80
      : Math.round((workflowTotals.success / workflowCount) * 100);
  const stabilityScore = Math.round(profileEvaluation.profileStabilityScore * 100);
  const recentFailures = getActionLogs().filter(
    (log) => log.status === "failed" || log.status === "blocked",
  ).length;
  const penalty = Math.min(20, recentFailures);

  return Math.max(0, Math.min(100, Math.round((workflowScore + stabilityScore) / 2 - penalty)));
}

export function evaluateDecisions(
  context: SystemContext,
  profileEvaluation: ProfileEvaluation,
): DecisionSummary {
  const profile = profileEvaluation.activeProfile;
  const confidence = profileEvaluation.activeProfileConfidence;
  const decisions = [
    profileDecision(profileEvaluation),
    fanDecision(context, profile, confidence),
    ssdDecision(context, profile, confidence),
    memoryDecision(context, profile, confidence),
  ];

  for (const decision of decisions.filter((item) => item.recommended)) {
    addDecision(
      `${decision.title}; confidence=${decision.confidence}; risk=${decision.risk}; reason=${decision.reason.join(" | ")}`,
    );
  }

  return {
    decisions,
    explanations: decisions.map((decision) => ({
      label: decision.target ?? decision.action,
      value: decision.title,
      reasons: decision.reason,
      confidence: decision.confidence,
      risk: decision.risk,
    })),
    predictiveInsights: buildPredictiveInsights(context, profile),
    optimizationRecommendations: buildOptimizationRecommendations(),
    automationQualityScore: calculateAutomationQualityScore(profileEvaluation),
    generatedAt: new Date().toISOString(),
  };
}
