import { shell } from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { LibreHardwareSnapshot } from "./libreHardwareMonitor";

const execFileAsync = promisify(execFile);
const WINDOWS = process.env.WINDIR ?? "C:\\Windows";
const POWERSHELL = path.join(
  WINDOWS,
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
const MAGICIAN_ROOT =
  "C:\\Program Files (x86)\\Samsung\\Samsung Magician";
const MAGICIAN_EXE = path.join(MAGICIAN_ROOT, "SamsungMagician.exe");
const MAGICIAN_LOG_DIR = path.join(MAGICIAN_ROOT, "Log");
const MODE_CHANGE_COOLDOWN_MS = 30 * 60 * 1000;
const MODE_ATTEMPT_COOLDOWN_MS = 10 * 60 * 1000;
const PERFORMANCE_ADVISORY_COOLDOWN_MS = 30 * 60 * 1000;
const PERFORMANCE_ADVISORY_LIFETIME_MS = 15 * 60 * 1000;

export type SamsungMode =
  | "performance"
  | "balanced"
  | "power-saving"
  | "custom"
  | "unknown";

export interface SamsungAutomationSettings {
  samsungAutomationEnabled: boolean;
  samsungPerformanceNotificationsEnabled: boolean;
  samsungHighLoadPercent: number;
  samsungIdleLoadPercent: number;
  samsungMaxPerformanceTemperature: number;
}

export interface SamsungMagicianStatus {
  installed: boolean;
  serviceRunning: boolean;
  driveName: string | null;
  temperatureCelsius: number | null;
  warningTemperatureCelsius: number | null;
  activityPercent: number | null;
  readBytesPerSecond: number | null;
  writeBytesPerSecond: number | null;
  currentMode: SamsungMode;
  recommendedMode: SamsungMode;
  recommendationReason: string;
  automaticEnabled: boolean;
  restartMayBeRequired: boolean;
  performanceAdvisory: SamsungPerformanceAdvisory | null;
}

export interface SamsungPerformanceAdvisory {
  id: string;
  message: string;
  createdAt: string;
}

let sustainedHighLoadSamples = 0;
let sustainedIdleSamples = 0;
let lastModeChangeAt = 0;
let lastModeAttemptAt = 0;
let restartMayBeRequired = false;
let lastPerformanceAdviceAt = 0;
let performanceAdvisory: SamsungPerformanceAdvisory | null = null;

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mapLogMode(value: string): SamsungMode {
  switch (value.trim().toLowerCase()) {
    case "full performance":
    case "performance":
      return "performance";
    case "standard":
    case "balanced":
      return "balanced";
    case "power saving":
      return "power-saving";
    case "custom":
      return "custom";
    default:
      return "unknown";
  }
}

function readCurrentMode(): SamsungMode {
  try {
    const logs = fs
      .readdirSync(MAGICIAN_LOG_DIR)
      .filter((name) => /^SMSVC_.*\.log$/i.test(name))
      .map((name) => {
        const filePath = path.join(MAGICIAN_LOG_DIR, name);
        return { filePath, modifiedAt: fs.statSync(filePath).mtimeMs };
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt);

    for (const log of logs) {
      const buffer = fs.readFileSync(log.filePath);
      const content =
        buffer[0] === 0xff && buffer[1] === 0xfe
          ? buffer.toString("utf16le")
          : buffer.toString("utf8");
      const matches = [
        ...content.matchAll(
          /Get Performance Optimization mode:\s*([^\r\n]+)/gi,
        ),
      ];
      const latest = matches.at(-1)?.[1];
      if (latest) return mapLogMode(latest);
    }
  } catch {
    // Magician may not be installed or its logs may require elevation.
  }

  return "unknown";
}

async function isServiceRunning() {
  if (process.platform !== "win32") return false;

  try {
    const { stdout } = await execFileAsync(
      POWERSHELL,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "(Get-Process SamsungMagicianSVC -ErrorAction SilentlyContinue) -ne $null",
      ],
      { windowsHide: true, timeout: 5_000 },
    );
    return stdout.trim().toLowerCase() === "true";
  } catch {
    return false;
  }
}

function chooseRecommendedMode(
  hardware: LibreHardwareSnapshot,
  settings: SamsungAutomationSettings,
  onBattery: boolean,
  recordSample: boolean,
) {
  const activity = hardware.storageActivityPercent;
  const temperature = hardware.storageTemperatureCelsius;
  const throughput =
    (hardware.storageReadBytesPerSecond ?? 0) +
    (hardware.storageWriteBytesPerSecond ?? 0);
  const systemWorkloadHigh =
    (hardware.cpuLoadPercent ?? 0) >= 75 ||
    (hardware.gpuLoadPercent ?? 0) >= 75;
  const highLoad =
    activity !== null &&
    (activity >= settings.samsungHighLoadPercent ||
      throughput >= 150 * 1024 * 1024 ||
      (systemWorkloadHigh &&
        activity >=
          Math.max(25, settings.samsungIdleLoadPercent + 15)));
  const idle =
    activity !== null &&
    activity <= settings.samsungIdleLoadPercent &&
    throughput <= 5 * 1024 * 1024;

  if (recordSample) {
    sustainedHighLoadSamples = highLoad
      ? Math.min(sustainedHighLoadSamples + 1, 30)
      : 0;
    sustainedIdleSamples = idle
      ? Math.min(sustainedIdleSamples + 1, 60)
      : 0;
  }

  if (!hardware.storageName) {
    return {
      mode: "unknown" as const,
      reason: "Samsung SSD belum terdeteksi oleh LibreHardwareMonitor.",
    };
  }

  if (
    temperature !== null &&
    temperature >= settings.samsungMaxPerformanceTemperature
  ) {
    return {
      mode: "balanced" as const,
      reason: `Suhu SSD ${temperature.toFixed(0)} C; Balanced mencegah konsumsi daya dan panas berlebih.`,
    };
  }

  if (activity === null) {
    return {
      mode: "unknown" as const,
      reason: "Sensor aktivitas SSD belum tersedia.",
    };
  }

  if (onBattery && sustainedIdleSamples >= 20) {
    return {
      mode: "power-saving" as const,
      reason: "Laptop memakai baterai dan SSD telah idle sekitar lima menit.",
    };
  }

  if (
    settings.samsungPerformanceNotificationsEnabled &&
    !onBattery &&
    sustainedHighLoadSamples >= 20 &&
    (temperature === null ||
      temperature <= settings.samsungMaxPerformanceTemperature - 5)
  ) {
    return {
      mode: "performance" as const,
      reason: "Beban SSD tinggi bertahan sekitar lima menit dan suhu masih aman.",
    };
  }

  return {
    mode: "balanced" as const,
    reason: highLoad
      ? "Beban CPU/GPU dan SSD sedang dipantau; Performance baru disarankan setelah beban I/O bertahan lima menit."
      : "Balanced cocok untuk penggunaan harian dan konsumsi daya moderat.",
  };
}

function getModeLabel(mode: SamsungMode) {
  if (mode === "power-saving") return "Power Saving";
  if (mode === "performance") return "Performance";
  if (mode === "balanced") return "Balanced";
  throw new Error("Mode Samsung Magician ini tidak dapat diterapkan.");
}

async function invokeMagicianUi(mode: SamsungMode) {
  const label = getModeLabel(mode);
  const script = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes

    function Invoke-OmniElement([System.Windows.Automation.AutomationElement]$element) {
      $candidate = $element
      for ($depth = 0; $depth -lt 5 -and $candidate; $depth++) {
        $pattern = $null
        if ($candidate.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
          ([System.Windows.Automation.InvokePattern]$pattern).Invoke()
          return $true
        }
        if ($candidate.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$pattern)) {
          ([System.Windows.Automation.SelectionItemPattern]$pattern).Select()
          return $true
        }
        if ($candidate.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$pattern)) {
          ([System.Windows.Automation.LegacyIAccessiblePattern]$pattern).DoDefaultAction()
          return $true
        }
        $candidate = [System.Windows.Automation.TreeWalker]::ControlViewWalker.GetParent($candidate)
      }
      return $false
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(15)
    $window = $null
    do {
      $ids = @(Get-Process SamsungMagician -ErrorAction SilentlyContinue | ForEach-Object Id)
      $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
        [System.Windows.Automation.TreeScope]::Children,
        [System.Windows.Automation.Condition]::TrueCondition
      )
      $window = $windows | Where-Object {
        $ids -contains $_.Current.ProcessId -and -not $_.Current.IsOffscreen
      } | Select-Object -First 1
      if (-not $window) { Start-Sleep -Milliseconds 500 }
    } while (-not $window -and [DateTime]::UtcNow -lt $deadline)

    if (-not $window) {
      throw 'Window Samsung Magician tidak dapat diakses. Jalankan Omni sebagai Administrator.'
    }

    $all = $window.FindAll(
      [System.Windows.Automation.TreeScope]::Descendants,
      [System.Windows.Automation.Condition]::TrueCondition
    )
    $modeElement = $all | Where-Object {
      $_.Current.Name -eq '${label}' -and -not $_.Current.IsOffscreen
    } | Sort-Object { $_.Current.BoundingRectangle.Width * $_.Current.BoundingRectangle.Height } -Descending |
      Select-Object -First 1

    if (-not $modeElement) {
      $navigation = $all | Where-Object {
        $_.Current.Name -eq 'Performance Optimization' -and -not $_.Current.IsOffscreen
      } | Select-Object -First 1
      if ($navigation -and (Invoke-OmniElement $navigation)) {
        Start-Sleep -Milliseconds 1200
        $all = $window.FindAll(
          [System.Windows.Automation.TreeScope]::Descendants,
          [System.Windows.Automation.Condition]::TrueCondition
        )
        $modeElement = $all | Where-Object {
          $_.Current.Name -eq '${label}' -and -not $_.Current.IsOffscreen
        } | Sort-Object { $_.Current.BoundingRectangle.Width * $_.Current.BoundingRectangle.Height } -Descending |
          Select-Object -First 1
      }
    }

    if (-not $modeElement -or -not (Invoke-OmniElement $modeElement)) {
      throw 'Pilihan mode ${label} tidak ditemukan pada UI Samsung Magician.'
    }

    Start-Sleep -Milliseconds 700
    $all = $window.FindAll(
      [System.Windows.Automation.TreeScope]::Descendants,
      [System.Windows.Automation.Condition]::TrueCondition
    )
    $applyElement = $all | Where-Object {
      ($_.Current.Name -eq 'Mode Apply' -or $_.Current.Name -eq 'Apply') -and
      -not $_.Current.IsOffscreen -and $_.Current.IsEnabled
    } | Select-Object -First 1

    if (-not $applyElement -or -not (Invoke-OmniElement $applyElement)) {
      throw 'Tombol Mode Apply tidak dapat dijalankan.'
    }

    Start-Sleep -Milliseconds 900
    $all = $window.FindAll(
      [System.Windows.Automation.TreeScope]::Descendants,
      [System.Windows.Automation.Condition]::TrueCondition
    )
    $confirmation = $all | Where-Object {
      $_.Current.Name -eq 'OK' -and -not $_.Current.IsOffscreen -and $_.Current.IsEnabled
    } | Select-Object -First 1
    if ($confirmation) {
      Invoke-OmniElement $confirmation | Out-Null
    }

    'ok'
  `;

  const { stdout } = await execFileAsync(
    POWERSHELL,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
    {
      windowsHide: true,
      timeout: 25_000,
      maxBuffer: 1024 * 1024,
    },
  );

  if (stdout.trim() !== "ok") {
    throw new Error("Samsung Magician tidak mengonfirmasi perubahan mode.");
  }
}

export async function openSamsungMagician() {
  if (!fs.existsSync(MAGICIAN_EXE)) {
    throw new Error("Samsung Magician tidak ditemukan.");
  }

  const errorMessage = await shell.openPath(MAGICIAN_EXE);
  if (errorMessage) throw new Error(errorMessage);
}

export async function setSamsungMagicianMode(mode: SamsungMode) {
  if (!["performance", "balanced", "power-saving"].includes(mode)) {
    throw new Error("Mode Samsung Magician tidak valid.");
  }

  if (readCurrentMode() === mode) {
    restartMayBeRequired = false;
    return;
  }

  await openSamsungMagician();
  await wait(2_500);
  await invokeMagicianUi(mode);

  lastModeAttemptAt = Date.now();
  lastModeChangeAt = Date.now();
  restartMayBeRequired = mode === "performance";
}

export async function getSamsungMagicianStatus(
  hardware: LibreHardwareSnapshot,
  settings: SamsungAutomationSettings,
  onBattery: boolean,
  recordSample = false,
): Promise<SamsungMagicianStatus> {
  const installed = fs.existsSync(MAGICIAN_EXE);
  const currentMode = installed ? readCurrentMode() : "unknown";
  const recommendation = chooseRecommendedMode(
    hardware,
    settings,
    onBattery,
    recordSample,
  );
  if (
    performanceAdvisory &&
    Date.now() - Date.parse(performanceAdvisory.createdAt) >
      PERFORMANCE_ADVISORY_LIFETIME_MS
  ) {
    performanceAdvisory = null;
  }

  if (currentMode === "performance") {
    performanceAdvisory = null;
  }

  return {
    installed,
    serviceRunning: installed ? await isServiceRunning() : false,
    driveName: hardware.storageName,
    temperatureCelsius: hardware.storageTemperatureCelsius,
    warningTemperatureCelsius:
      hardware.storageWarningTemperatureCelsius,
    activityPercent: hardware.storageActivityPercent,
    readBytesPerSecond: hardware.storageReadBytesPerSecond,
    writeBytesPerSecond: hardware.storageWriteBytesPerSecond,
    currentMode,
    recommendedMode: recommendation.mode,
    recommendationReason: recommendation.reason,
    automaticEnabled: settings.samsungAutomationEnabled,
    restartMayBeRequired,
    performanceAdvisory,
  };
}

export async function runSamsungMagicianAutomation(
  status: SamsungMagicianStatus,
) {
  if (
    !status.installed ||
    !status.serviceRunning ||
    status.recommendedMode === "unknown" ||
    status.currentMode === status.recommendedMode
  ) {
    return null;
  }

  const now = Date.now();
  if (status.recommendedMode === "performance") {
    if (
      now - lastPerformanceAdviceAt >=
      PERFORMANCE_ADVISORY_COOLDOWN_MS
    ) {
      const activity =
        status.activityPercent === null
          ? "tinggi"
          : `${status.activityPercent.toFixed(0)}%`;
      const temperature =
        status.temperatureCelsius === null
          ? "suhu aman"
          : `suhu ${status.temperatureCelsius.toFixed(0)} C`;
      const message =
        `Beban SSD bertahan di ${activity} dengan ${temperature}. ` +
        "Mode Performance layak dipertimbangkan, tetapi perubahan ini mungkin meminta restart Windows. " +
        "Buka chat > PC untuk menerapkannya saat pekerjaan bisa dijeda.";

      performanceAdvisory = {
        id: `samsung-performance-${now}`,
        message,
        createdAt: new Date(now).toISOString(),
      };
      lastPerformanceAdviceAt = now;
      return "Omni menyarankan mode Performance melalui notifikasi.";
    }

    return null;
  }

  if (!status.automaticEnabled) {
    return null;
  }

  if (
    now - lastModeChangeAt < MODE_CHANGE_COOLDOWN_MS ||
    now - lastModeAttemptAt < MODE_ATTEMPT_COOLDOWN_MS
  ) {
    return null;
  }

  lastModeAttemptAt = now;
  await setSamsungMagicianMode(status.recommendedMode);
  return `Samsung Magician diubah ke ${getModeLabel(status.recommendedMode)}.`;
}
