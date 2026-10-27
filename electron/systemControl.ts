import { app, powerMonitor, shell } from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { readLibreHardwareMonitor } from "./libreHardwareMonitor";
import {
  getSamsungMagicianStatus,
  openSamsungMagician,
  runSamsungMagicianAutomation,
  setSamsungMagicianMode,
  type SamsungMagicianStatus,
  type SamsungMode,
} from "./samsungMagician";
import { readWindowsHardware } from "./windowsHardware";

const execFileAsync = promisify(execFile);
const POWERSHELL = path.join(
  process.env.WINDIR ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);
const ASUS_VALUES_FILE =
  "C:\\ProgramData\\ASUS\\MyASUS\\UWPValue.ini";

const ASUS_DEVICE = {
  thermalPolicyVivo: 0x00110019,
  batteryLimit: 0x00120057,
} as const;

export type FanMode = "standard" | "performance";
export type BatteryMode = "full" | "balanced" | "lifespan";

export interface AutomationSettings {
  enabled: boolean;
  hotTemperature: number;
  normalTemperature: number;
  memoryWarningPercent: number;
  memoryCleanupEnabled: boolean;
  checkIntervalSeconds: number;
  samsungAutomationEnabled: boolean;
  samsungPerformanceNotificationsEnabled: boolean;
  samsungHighLoadPercent: number;
  samsungIdleLoadPercent: number;
  samsungMaxPerformanceTemperature: number;
}

export interface SystemStatus {
  temperatureCelsius: number | null;
  temperatureSource: string;
  hardwareMonitorConnected: boolean;
  cpuLoadPercent: number | null;
  gpuName: string | null;
  gpuTemperatureCelsius: number | null;
  gpuLoadPercent: number | null;
  gpuSharedMemoryUsedMb: number | null;
  gpuSharedMemoryTotalMb: number | null;
  fanRpm: number | null;
  fanSource: string;
  memoryUsedPercent: number;
  memoryAvailableMb: number;
  onBattery: boolean;
  fanMode: FanMode;
  batteryMode: BatteryMode;
  samsungMagician: SamsungMagicianStatus;
  automationEnabled: boolean;
  lastAction: string;
  lastError: string;
  topMemoryProcesses: Array<{ name: string; memoryMb: number }>;
  updatedAt: string;
}

export interface MemoryCleanupResult {
  attemptedProcesses: number;
  trimmedProcesses: number;
  releasedMb: number;
  message: string;
}

const defaultSettings: AutomationSettings = {
  enabled: false,
  hotTemperature: 85,
  normalTemperature: 72,
  memoryWarningPercent: 90,
  memoryCleanupEnabled: true,
  checkIntervalSeconds: 15,
  samsungAutomationEnabled: false,
  samsungPerformanceNotificationsEnabled: true,
  samsungHighLoadPercent: 65,
  samsungIdleLoadPercent: 5,
  samsungMaxPerformanceTemperature: 65,
};

let automationSettings = defaultSettings;
let automationTimer: NodeJS.Timeout | null = null;
let lastAction = "Belum ada aksi otomatis.";
let lastError = "";
let lastFanChangeAt = 0;
let lastMemoryCleanupAt = 0;

const MEMORY_CLEANUP_COOLDOWN_MS = 10 * 60 * 1000;

function getSettingsFile() {
  return path.join(app.getPath("userData"), "system-automation.json");
}

function readAsusValue(section: string) {
  try {
    const content = fs.readFileSync(ASUS_VALUES_FILE, "utf8");
    const match = content.match(
      new RegExp(`\\[${section}\\][\\s\\S]*?value=(\\d+)`, "i"),
    );
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

function loadSettings() {
  try {
    const stored = JSON.parse(
      fs.readFileSync(getSettingsFile(), "utf8"),
    ) as Partial<AutomationSettings>;
    automationSettings = sanitizeSettings({
      ...defaultSettings,
      ...stored,
    });
  } catch {
    automationSettings = defaultSettings;
  }
}

function sanitizeSettings(
  input: AutomationSettings,
): AutomationSettings {
  const hotTemperature = Math.min(
    95,
    Math.max(75, Number(input.hotTemperature) || 85),
  );
  const normalTemperature = Math.min(
    hotTemperature - 5,
    Math.max(55, Number(input.normalTemperature) || 72),
  );

  return {
    enabled: Boolean(input.enabled),
    hotTemperature,
    normalTemperature,
    memoryWarningPercent: Math.min(
      98,
      Math.max(80, Number(input.memoryWarningPercent) || 90),
    ),
    memoryCleanupEnabled: input.memoryCleanupEnabled !== false,
    checkIntervalSeconds: Math.min(
      60,
      Math.max(10, Number(input.checkIntervalSeconds) || 15),
    ),
    samsungAutomationEnabled: Boolean(
      input.samsungAutomationEnabled,
    ),
    samsungPerformanceNotificationsEnabled:
      input.samsungPerformanceNotificationsEnabled !== false,
    samsungHighLoadPercent: Math.min(
      95,
      Math.max(40, Number(input.samsungHighLoadPercent) || 65),
    ),
    samsungIdleLoadPercent: Math.min(
      20,
      Math.max(1, Number(input.samsungIdleLoadPercent) || 5),
    ),
    samsungMaxPerformanceTemperature: Math.min(
      75,
      Math.max(
        55,
        Number(input.samsungMaxPerformanceTemperature) || 65,
      ),
    ),
  };
}

async function runPowerShell(script: string) {
  const { stdout } = await execFileAsync(
    POWERSHELL,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
    {
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    },
  );

  return stdout.trim();
}

async function readTemperature(): Promise<{
  celsius: number | null;
  source: string;
}> {
  try {
    const output = await runPowerShell(`
      $result = $null

      try {
        $samples = (Get-Counter '\\Thermal Zone Information(*)\\High Precision Temperature' -SampleInterval 1 -MaxSamples 1 -ErrorAction Stop).CounterSamples
        $values = $samples | ForEach-Object {
          [pscustomobject]@{
            celsius = [math]::Round(($_.CookedValue / 10) - 273.15, 1)
            sensor = $_.InstanceName
          }
        } | Where-Object { $_.celsius -ge 20 -and $_.celsius -le 120 } | Sort-Object celsius -Descending

        if ($values) {
          $hottest = $values | Select-Object -First 1
          $result = [pscustomobject]@{
            celsius = $hottest.celsius
            source = ('Windows ACPI ' + $hottest.sensor)
          }
        }
      } catch {}

      if (-not $result) {
        try {
          $values = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop | ForEach-Object {
            [pscustomobject]@{
              celsius = [math]::Round(($_.CurrentTemperature / 10) - 273.15, 1)
              sensor = $_.InstanceName
            }
          } | Where-Object { $_.celsius -ge 20 -and $_.celsius -le 120 } | Sort-Object celsius -Descending

          if ($values) {
            $hottest = $values | Select-Object -First 1
            $result = [pscustomobject]@{
              celsius = $hottest.celsius
              source = ('ACPI WMI ' + $hottest.sensor)
            }
          }
        } catch {}
      }

      if ($result) { $result | ConvertTo-Json -Compress }
    `);

    if (!output) return { celsius: null, source: "Sensor tidak tersedia" };

    const parsed = JSON.parse(output) as {
      celsius?: unknown;
      source?: unknown;
    };
    const celsius = Number(parsed.celsius);

    return Number.isFinite(celsius)
      ? {
          celsius,
          source:
            typeof parsed.source === "string"
              ? parsed.source
              : "Windows ACPI",
        }
      : { celsius: null, source: "Sensor tidak tersedia" };
  } catch {
    return { celsius: null, source: "Sensor tidak tersedia" };
  }
}

export async function freeUpMemory(): Promise<MemoryCleanupResult> {
  const freeMemoryBefore = os.freemem();
  const output = await runPowerShell(`
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OmniWorkingSet {
  [DllImport("psapi.dll", SetLastError = true)]
  public static extern bool EmptyWorkingSet(IntPtr process);
}
'@

    $excluded = @(
      'idle', 'system', 'registry', 'memory compression', 'secure system',
      'csrss', 'smss', 'wininit', 'services', 'lsass', 'winlogon',
      'fontdrvhost', 'dwm', 'explorer', 'powershell', 'electron',
      'msmpeng', 'securityhealthservice', 'vmmem', 'vmmemwsl',
      'com.docker.backend'
    )
    $targets = Get-Process -ErrorAction SilentlyContinue |
      Where-Object {
        $_.WorkingSet64 -ge 300MB -and
        $_.MainWindowHandle -eq 0 -and
        $excluded -notcontains $_.ProcessName.ToLowerInvariant()
      } |
      Sort-Object WorkingSet64 -Descending |
      Select-Object -First 5

    $trimmed = 0
    foreach ($process in $targets) {
      try {
        if ([OmniWorkingSet]::EmptyWorkingSet($process.Handle)) {
          $trimmed++
        }
      } catch {}
    }

    Start-Sleep -Milliseconds 400
    [pscustomobject]@{
      attemptedProcesses = @($targets).Count
      trimmedProcesses = $trimmed
    } | ConvertTo-Json -Compress
  `);
  const freeMemoryAfter = os.freemem();

  const parsed = JSON.parse(output) as {
    attemptedProcesses?: unknown;
    trimmedProcesses?: unknown;
    releasedMb?: unknown;
  };
  const result = {
    attemptedProcesses: Number(parsed.attemptedProcesses) || 0,
    trimmedProcesses: Number(parsed.trimmedProcesses) || 0,
    releasedMb: Math.max(
      0,
      Math.round((freeMemoryAfter - freeMemoryBefore) / 1024 / 1024),
    ),
  };
  const message =
    result.trimmedProcesses > 0
      ? `Working set ${result.trimmedProcesses} proses background diringankan; sekitar ${result.releasedMb} MB menjadi tersedia.`
      : "Tidak ada proses background yang aman untuk diringankan.";

  lastMemoryCleanupAt = Date.now();
  lastAction = message;
  lastError = "";

  return { ...result, message };
}

let cachedTopProcesses: Array<{ name: string; memoryMb: number }> = [];
let lastTopProcessesReadAt = 0;
const TOP_PROCESSES_CACHE_TTL_MS = 8_000;

async function readTopMemoryProcesses() {
  const now = Date.now();
  if (cachedTopProcesses.length > 0 && now - lastTopProcessesReadAt < TOP_PROCESSES_CACHE_TTL_MS) {
    return cachedTopProcesses;
  }

  try {
    const output = await runPowerShell(`
      Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 5 @{n='name';e={$_.ProcessName}},@{n='memoryMb';e={[math]::Round($_.WorkingSet64 / 1MB)}} | ConvertTo-Json -Compress
    `);
    const parsed = JSON.parse(output) as
      | { name: string; memoryMb: number }
      | Array<{ name: string; memoryMb: number }>;
    const result = Array.isArray(parsed) ? parsed : [parsed];
    cachedTopProcesses = result;
    lastTopProcessesReadAt = Date.now();
    return result;
  } catch {
    return cachedTopProcesses;
  }
}

function getFanMode(): FanMode {
  return readAsusValue("FanProfile") === 2
    ? "performance"
    : "standard";
}

function getBatteryMode(): BatteryMode {
  const value = readAsusValue("BatteryHealthCharging");
  if (value === 60) return "lifespan";
  if (value === 80) return "balanced";
  return "full";
}

async function setAsusDevice(deviceId: number, value: number) {
  let output: string;

  try {
    output = await runPowerShell(`
      $asus = Get-WmiObject -Namespace root\\wmi -Class AsusAtkWmi_WMNB -ErrorAction Stop
      if (-not $asus) { throw 'ASUS WMI interface tidak tersedia.' }
      $result = $asus.DEVS([uint32]${deviceId}, [uint32]${value})
      if ($result.result -ne 1 -and $result.result -ne 0) { throw ('ASUS menolak perubahan. Code: ' + $result.result) }
      'ok'
    `);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    if (/access (is )?denied|unauthorized|0x80041003/i.test(message)) {
      throw new Error(
        "Akses ASUS WMI ditolak. Tutup Omni lalu jalankan `npm run dev:admin`.",
      );
    }

    throw new Error(
      "ASUS System Control Interface gagal diakses. Pastikan drivernya aktif dan coba jalankan Omni sebagai Administrator.",
    );
  }

  if (output !== "ok") {
    throw new Error("ASUS WMI tidak mengonfirmasi perubahan.");
  }
}

export async function setFanMode(mode: FanMode) {
  const value = mode === "performance" ? 2 : 0;
  await setAsusDevice(ASUS_DEVICE.thermalPolicyVivo, value);
  lastFanChangeAt = Date.now();
  lastAction =
    mode === "performance"
      ? "Fan diubah ke Performance."
      : "Fan dikembalikan ke Standard.";
  lastError = "";
}

export async function setBatteryMode(mode: BatteryMode) {
  const value = mode === "lifespan" ? 60 : mode === "balanced" ? 80 : 100;
  await setAsusDevice(ASUS_DEVICE.batteryLimit, value);
  lastAction = `Battery Health Charging diubah ke ${value}%.`;
  lastError = "";
}

let cachedSystemStatus: SystemStatus | null = null;
let lastSystemStatusReadAt = 0;
let pendingSystemStatusRead: Promise<SystemStatus> | null = null;
const SYSTEM_STATUS_CACHE_TTL_MS = 6_000;

export async function getSystemStatus(
  recordSamsungSample = false,
): Promise<SystemStatus> {
  const now = Date.now();
  if (
    !recordSamsungSample &&
    cachedSystemStatus &&
    now - lastSystemStatusReadAt < SYSTEM_STATUS_CACHE_TTL_MS
  ) {
    return cachedSystemStatus;
  }
  if (!recordSamsungSample && pendingSystemStatusRead) {
    return pendingSystemStatusRead;
  }

  const task = (async () => {
    try {
      const [libreHardware, windowsHardware, topMemoryProcesses] =
        await Promise.all([
          readLibreHardwareMonitor(),
          readWindowsHardware(),
          readTopMemoryProcesses(),
        ]);

      // Only read fallback ACPI temperature if LibreHardwareMonitor is not providing it
      const fallbackTemperature =
        libreHardware.cpuTemperatureCelsius !== null
          ? { celsius: null, source: "Sensor tidak tersedia" }
          : await readTemperature();

      const temperature =
        libreHardware.cpuTemperatureCelsius !== null
          ? {
              celsius: libreHardware.cpuTemperatureCelsius,
              source: libreHardware.source,
            }
          : fallbackTemperature;

      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const osMemoryUsedPercent = Math.round(
        ((totalMemory - freeMemory) / totalMemory) * 100,
      );
      const onBattery = powerMonitor.isOnBatteryPower();
      const samsungMagician = await getSamsungMagicianStatus(
        libreHardware,
        automationSettings,
        onBattery,
        recordSamsungSample,
      );

      const status: SystemStatus = {
        temperatureCelsius: temperature.celsius,
        temperatureSource: temperature.source,
        hardwareMonitorConnected: libreHardware.connected,
        cpuLoadPercent: libreHardware.cpuLoadPercent,
        gpuName: windowsHardware.gpuName,
        gpuTemperatureCelsius: libreHardware.gpuTemperatureCelsius,
        gpuLoadPercent:
          windowsHardware.gpuLoadPercent ?? libreHardware.gpuLoadPercent,
        gpuSharedMemoryUsedMb: windowsHardware.gpuSharedMemoryUsedMb,
        gpuSharedMemoryTotalMb: windowsHardware.gpuSharedMemoryTotalMb,
        fanRpm: windowsHardware.fanRpm ?? libreHardware.fanRpm,
        fanSource:
          windowsHardware.fanRpm !== null
            ? windowsHardware.fanSource
            : libreHardware.fanRpm !== null
              ? libreHardware.source
              : windowsHardware.fanSource,
        memoryUsedPercent:
          libreHardware.memoryLoadPercent === null
            ? osMemoryUsedPercent
            : Math.round(libreHardware.memoryLoadPercent),
        memoryAvailableMb: Math.round(freeMemory / 1024 / 1024),
        onBattery,
        fanMode: getFanMode(),
        batteryMode: getBatteryMode(),
        samsungMagician,
        automationEnabled: automationSettings.enabled,
        lastAction,
        lastError,
        topMemoryProcesses,
        updatedAt: new Date().toISOString(),
      };

      cachedSystemStatus = status;
      lastSystemStatusReadAt = Date.now();
      return status;
    } finally {
      pendingSystemStatusRead = null;
    }
  })();

  if (!recordSamsungSample) {
    pendingSystemStatusRead = task;
  }
  return task;
}

async function runAutomationCycle() {
  if (
    !automationSettings.enabled &&
    !automationSettings.memoryCleanupEnabled &&
    !automationSettings.samsungAutomationEnabled &&
    !automationSettings.samsungPerformanceNotificationsEnabled
  ) {
    return;
  }

  const status = await getSystemStatus(true);
  const cooldownElapsed = Date.now() - lastFanChangeAt > 120_000;
  const memoryCleanupCooldownElapsed =
    Date.now() - lastMemoryCleanupAt > MEMORY_CLEANUP_COOLDOWN_MS;

  try {
    if (
      automationSettings.enabled &&
      status.temperatureCelsius !== null &&
      status.temperatureCelsius >= automationSettings.hotTemperature &&
      status.fanMode !== "performance" &&
      cooldownElapsed
    ) {
      await setFanMode("performance");
    } else if (
      automationSettings.enabled &&
      status.temperatureCelsius !== null &&
      status.temperatureCelsius <= automationSettings.normalTemperature &&
      status.fanMode !== "standard" &&
      cooldownElapsed
    ) {
      await setFanMode("standard");
    }

    if (
      automationSettings.memoryCleanupEnabled &&
      status.memoryUsedPercent >= automationSettings.memoryWarningPercent &&
      memoryCleanupCooldownElapsed
    ) {
      await freeUpMemory();
    } else if (
      status.memoryUsedPercent >= automationSettings.memoryWarningPercent
    ) {
      const largest = status.topMemoryProcesses[0];
      lastAction = largest
        ? `RAM tinggi. Proses terbesar: ${largest.name} (${largest.memoryMb} MB).`
        : "RAM tinggi. Periksa aplikasi yang tidak digunakan.";
    }

    const samsungAction = await runSamsungMagicianAutomation(
      status.samsungMagician,
    );
    if (samsungAction) {
      lastAction = samsungAction;
    }
  } catch (error) {
    lastError =
      error instanceof Error
        ? error.message
        : "Otomatisasi sistem gagal.";
  }
}

function restartAutomationTimer() {
  if (automationTimer) clearInterval(automationTimer);
  automationTimer = setInterval(
    () => void runAutomationCycle(),
    automationSettings.checkIntervalSeconds * 1000,
  );
}

export function initializeSystemControl() {
  loadSettings();
  restartAutomationTimer();
  void runAutomationCycle();
}

export function getAutomationSettings() {
  return automationSettings;
}

export function saveAutomationSettings(input: AutomationSettings) {
  automationSettings = sanitizeSettings(input);
  fs.writeFileSync(
    getSettingsFile(),
    JSON.stringify(automationSettings, null, 2),
  );
  restartAutomationTimer();
  void runAutomationCycle();
  return automationSettings;
}

export async function openMyAsus() {
  await shell.openExternal(
    "shell:AppsFolder\\B9ECED6F.ASUSPCAssistant_qmba6cd70vzyy!App",
  );
}

export async function openSamsungMagicianApp() {
  await openSamsungMagician();
  lastAction = "Samsung Magician dibuka.";
  lastError = "";
}

export async function setSamsungMode(mode: SamsungMode) {
  try {
    await setSamsungMagicianMode(mode);
    lastAction = `Permintaan mode Samsung Magician: ${mode}.`;
    lastError = "";
  } catch (error) {
    lastError =
      error instanceof Error
        ? error.message
        : "Mode Samsung Magician gagal diubah.";
    throw error;
  }
}
