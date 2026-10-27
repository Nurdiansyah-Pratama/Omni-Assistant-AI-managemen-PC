import { dialog } from "electron";
import fs from "node:fs";
import { appendBounded, getUserDataPath, readJsonFile, writeJsonFile } from "./config";
import type { SystemContext } from "./context_monitor";

export interface OmniMemory {
  appUsage: Record<string, { count: number; minutesByHour: Record<string, number> }>;
  activeProfiles: Record<string, number>;
  cpuTemperatureSamples: number[];
  gpuUsageSamples: number[];
  ramUsageSamples: number[];
  behaviorPatterns: {
    appCombosByHour: Record<string, { count: number; apps: string[] }>;
    profileByHour: Record<string, Record<string, number>>;
    profileResourceStats: Record<
      string,
      {
        samples: number;
        averageCpuTemp: number | null;
        averageRamUsage: number;
        peakCpuTemp: number | null;
        peakRamUsage: number;
      }
    >;
  };
  workflowStats: Record<
    string,
    { success: number; failed: number; blocked: number; lastResult: string | null }
  >;
  preferences: Record<string, unknown>;
  manualRules: string[];
  workflowHistory: Array<{ name: string; createdAt: string; result: string }>;
  decisions: Array<{ note: string; createdAt: string }>;
  updatedAt: string;
}

const emptyMemory: OmniMemory = {
  appUsage: {},
  activeProfiles: {},
  cpuTemperatureSamples: [],
  gpuUsageSamples: [],
  ramUsageSamples: [],
  behaviorPatterns: {
    appCombosByHour: {},
    profileByHour: {},
    profileResourceStats: {},
  },
  workflowStats: {},
  preferences: {
    neverCloseProcesses: ["explorer", "chrome", "Code", "devenv", "Unity"],
  },
  manualRules: [],
  workflowHistory: [],
  decisions: [],
  updatedAt: new Date().toISOString(),
};

function getMemoryFile() {
  return getUserDataPath("long-term-memory.json");
}

function normalizeMemory(input: Partial<OmniMemory> | OmniMemory): OmniMemory {
  return {
    ...emptyMemory,
    ...input,
    appUsage: input.appUsage ?? {},
    activeProfiles: input.activeProfiles ?? {},
    cpuTemperatureSamples: Array.isArray(input.cpuTemperatureSamples)
      ? input.cpuTemperatureSamples
      : [],
    gpuUsageSamples: Array.isArray(input.gpuUsageSamples)
      ? input.gpuUsageSamples
      : [],
    ramUsageSamples: Array.isArray(input.ramUsageSamples)
      ? input.ramUsageSamples
      : [],
    behaviorPatterns: {
      ...emptyMemory.behaviorPatterns,
      ...(input.behaviorPatterns ?? {}),
      appCombosByHour: input.behaviorPatterns?.appCombosByHour ?? {},
      profileByHour: input.behaviorPatterns?.profileByHour ?? {},
      profileResourceStats:
        input.behaviorPatterns?.profileResourceStats ?? {},
    },
    workflowStats: input.workflowStats ?? {},
    preferences: {
      ...emptyMemory.preferences,
      ...(input.preferences ?? {}),
    },
    manualRules: Array.isArray(input.manualRules) ? input.manualRules : [],
    workflowHistory: Array.isArray(input.workflowHistory)
      ? input.workflowHistory
      : [],
    decisions: Array.isArray(input.decisions) ? input.decisions : [],
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
}

function sanitizeMemory(memory: OmniMemory): OmniMemory {
  const clone = normalizeMemory(JSON.parse(JSON.stringify(memory)) as OmniMemory);
  clone.decisions = clone.decisions.filter(
    (item) => !/password|token|api[_ -]?key|secret/i.test(item.note),
  );
  clone.manualRules = clone.manualRules.filter(
    (item) => !/password|token|api[_ -]?key|secret/i.test(item),
  );
  clone.updatedAt = new Date().toISOString();
  return clone;
}

let cachedMemory: OmniMemory | null = null;
let saveMemoryTimer: NodeJS.Timeout | null = null;

export function getMemory(): OmniMemory {
  if (!cachedMemory) {
    cachedMemory = normalizeMemory(readJsonFile<OmniMemory>(getMemoryFile(), emptyMemory));
  }
  return cachedMemory;
}

function flushMemoryToDisk() {
  if (!cachedMemory) return;
  try {
    writeJsonFile(getMemoryFile(), cachedMemory);
  } catch {}
}

export function saveMemory(memory: OmniMemory, immediate = false): OmniMemory {
  const safe = sanitizeMemory(memory);
  cachedMemory = safe;

  if (saveMemoryTimer) {
    clearTimeout(saveMemoryTimer);
    saveMemoryTimer = null;
  }

  if (immediate) {
    flushMemoryToDisk();
  } else {
    saveMemoryTimer = setTimeout(() => {
      flushMemoryToDisk();
      saveMemoryTimer = null;
    }, 4_000);
  }

  return safe;
}

export function updatePreference(key: string, value: unknown) {
  const memory = getMemory();
  memory.preferences[key] = value;
  return saveMemory(memory, true);
}

export function learnFromContext(context: SystemContext, activeProfile: string) {
  const memory = getMemory();
  const hour = new Date(context.sampledAt).getHours().toString().padStart(2, "0");
  const visibleApps = Array.from(
    new Set(
      context.runningProcesses
        .filter((process) => process.mainWindowTitle || process.memoryMb > 100)
        .slice(0, 10)
        .map((process) => process.name),
    ),
  ).sort();

  for (const process of context.runningProcesses.slice(0, 50)) {
    const key = process.name;
    const current = memory.appUsage[key] ?? { count: 0, minutesByHour: {} };
    current.count += 1;
    current.minutesByHour[hour] = (current.minutesByHour[hour] ?? 0) + 1;
    memory.appUsage[key] = current;
  }

  memory.activeProfiles[activeProfile] =
    (memory.activeProfiles[activeProfile] ?? 0) + 1;
  memory.behaviorPatterns.profileByHour[hour] = {
    ...(memory.behaviorPatterns.profileByHour[hour] ?? {}),
    [activeProfile]:
      (memory.behaviorPatterns.profileByHour[hour]?.[activeProfile] ?? 0) + 1,
  };

  if (visibleApps.length > 1) {
    const comboKey = `${hour}:${visibleApps.slice(0, 5).join("+")}`;
    const currentCombo =
      memory.behaviorPatterns.appCombosByHour[comboKey] ?? {
        count: 0,
        apps: visibleApps.slice(0, 5),
      };
    currentCombo.count += 1;
    memory.behaviorPatterns.appCombosByHour[comboKey] = currentCombo;
  }

  const resource =
    memory.behaviorPatterns.profileResourceStats[activeProfile] ?? {
      samples: 0,
      averageCpuTemp: null,
      averageRamUsage: 0,
      peakCpuTemp: null,
      peakRamUsage: 0,
    };
  const nextSamples = resource.samples + 1;
  resource.averageRamUsage = Math.round(
    (resource.averageRamUsage * resource.samples + context.ramUsage) /
      nextSamples,
  );
  resource.peakRamUsage = Math.max(resource.peakRamUsage, context.ramUsage);
  if (context.cpuTemp !== null) {
    resource.averageCpuTemp = Math.round(
      ((resource.averageCpuTemp ?? context.cpuTemp) * resource.samples +
        context.cpuTemp) /
        nextSamples,
    );
    resource.peakCpuTemp = Math.max(resource.peakCpuTemp ?? 0, context.cpuTemp);
  }
  resource.samples = nextSamples;
  memory.behaviorPatterns.profileResourceStats[activeProfile] = resource;

  if (context.cpuTemp !== null) {
    memory.cpuTemperatureSamples = appendBounded(
      memory.cpuTemperatureSamples,
      context.cpuTemp,
      500,
    );
  }
  if (context.gpuUsage !== null) {
    memory.gpuUsageSamples = appendBounded(
      memory.gpuUsageSamples,
      context.gpuUsage,
      500,
    );
  }
  memory.ramUsageSamples = appendBounded(
    memory.ramUsageSamples,
    context.ramUsage,
    500,
  );

  return saveMemory(memory);
}

export function addWorkflowHistory(
  name: string,
  result: string,
  status: "success" | "failed" | "blocked" = "success",
) {
  const memory = getMemory();
  memory.workflowHistory = appendBounded(
    memory.workflowHistory,
    { name, result, createdAt: new Date().toISOString() },
    300,
  );
  const stats = memory.workflowStats[name] ?? {
    success: 0,
    failed: 0,
    blocked: 0,
    lastResult: null,
  };
  stats[status] += 1;
  stats.lastResult = result;
  memory.workflowStats[name] = stats;
  return saveMemory(memory);
}

export function addDecision(note: string) {
  const memory = getMemory();
  memory.decisions = appendBounded(
    memory.decisions,
    { note, createdAt: new Date().toISOString() },
    200,
  );
  return saveMemory(memory);
}

export function forgetMemory() {
  return saveMemory(emptyMemory);
}

export async function exportMemory() {
  const target = await dialog.showSaveDialog({
    title: "Export Omni Memory",
    defaultPath: "omni-memory.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (target.canceled || !target.filePath) return null;

  fs.writeFileSync(target.filePath, JSON.stringify(getMemory(), null, 2));
  return target.filePath;
}

export async function importMemory() {
  const target = await dialog.showOpenDialog({
    title: "Import Omni Memory",
    filters: [{ name: "JSON", extensions: ["json"] }],
    properties: ["openFile"],
  });
  const filePath = target.filePaths[0];
  if (target.canceled || !filePath) return null;

  const imported = readJsonFile<OmniMemory>(filePath, emptyMemory);
  saveMemory(imported);
  return filePath;
}

export function getMemoryInsights() {
  const memory = getMemory();
  const topApps = Object.entries(memory.appUsage)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([name, data]) => `${name} (${data.count})`);
  const topProfiles = Object.entries(memory.activeProfiles)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} (${count})`);

  return {
    topApps,
    topProfiles,
    averageCpuTemp:
      memory.cpuTemperatureSamples.length === 0
        ? null
        : Math.round(
            memory.cpuTemperatureSamples.reduce((sum, value) => sum + value, 0) /
              memory.cpuTemperatureSamples.length,
          ),
    averageRamUsage:
      memory.ramUsageSamples.length === 0
        ? null
        : Math.round(
            memory.ramUsageSamples.reduce((sum, value) => sum + value, 0) /
              memory.ramUsageSamples.length,
          ),
    behaviorInsights: buildBehaviorInsights(memory),
    predictiveInsights: buildPredictiveInsights(memory),
    optimizationRecommendations: buildOptimizationRecommendations(memory),
  };
}

function buildBehaviorInsights(memory: OmniMemory) {
  const combo = Object.entries(memory.behaviorPatterns.appCombosByHour)
    .sort((a, b) => b[1].count - a[1].count)[0];
  const profileHour = Object.entries(memory.behaviorPatterns.profileByHour)
    .flatMap(([hour, profiles]) =>
      Object.entries(profiles).map(([profile, count]) => ({
        hour,
        profile,
        count,
      })),
    )
    .sort((a, b) => b.count - a.count)[0];

  return [
    combo
      ? `${combo[1].apps.join(", ")} sering aktif bersamaan sekitar jam ${combo[0].slice(0, 2)}:00.`
      : null,
    profileHour
      ? `${profileHour.profile} sering aktif sekitar jam ${profileHour.hour}:00.`
      : null,
  ].filter(Boolean) as string[];
}

function buildPredictiveInsights(memory: OmniMemory) {
  return Object.entries(memory.behaviorPatterns.profileResourceStats)
    .filter(([, stats]) => stats.samples >= 3)
    .flatMap(([profile, stats]) => {
      const insights: string[] = [];
      if ((stats.peakRamUsage ?? 0) >= 90) {
        insights.push(
          `${profile} pernah membuat RAM mencapai ${stats.peakRamUsage}%; cleanup mungkin diperlukan bila tren berulang.`,
        );
      }
      if ((stats.peakCpuTemp ?? 0) >= 85) {
        insights.push(
          `${profile} biasanya bisa melewati ${stats.peakCpuTemp} C; Performance Cooling mungkin diperlukan.`,
        );
      }
      return insights;
    })
    .slice(0, 4);
}

function buildOptimizationRecommendations(memory: OmniMemory) {
  const recommendations: string[] = [];
  const highRamProfiles = Object.entries(
    memory.behaviorPatterns.profileResourceStats,
  ).filter(([, stats]) => stats.samples >= 5 && stats.averageRamUsage >= 85);
  const hotProfiles = Object.entries(
    memory.behaviorPatterns.profileResourceStats,
  ).filter(
    ([, stats]) =>
      stats.samples >= 5 && (stats.averageCpuTemp ?? 0) >= 80,
  );

  if (highRamProfiles.length > 0) {
    recommendations.push(
      "Pertimbangkan menurunkan threshold RAM cleanup ke 85% untuk profile berat. Rekomendasi belum diterapkan otomatis.",
    );
  }
  if (hotProfiles.length > 0) {
    recommendations.push(
      "Pertimbangkan mengaktifkan cooling lebih awal di 80 C untuk profile yang sering panas. Rekomendasi belum diterapkan otomatis.",
    );
  }

  return recommendations.slice(0, 3);
}
