import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getSystemStatus } from "./systemControl";

const execFileAsync = promisify(execFile);
const POWERSHELL = path.join(
  process.env.WINDIR ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);

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

function normalizeProcessName(name: string) {
  return name.toLowerCase().replace(/\.exe$/i, "");
}

async function runPowerShell(script: string) {
  const { stdout } = await execFileAsync(
    POWERSHELL,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
    {
      windowsHide: true,
      timeout: 12_000,
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  return stdout.trim();
}

let cachedWindowsContext: {
  activeApp?: string;
  activeWindowTitle?: string;
  isFullscreen?: boolean;
  cpuUsage?: number;
  networkActivityKbps?: number | null;
  runningProcesses?: RunningProcessInfo[];
} | null = null;
let lastWindowsContextReadAt = 0;
let pendingWindowsContextRead: Promise<{
  activeApp?: string;
  activeWindowTitle?: string;
  isFullscreen?: boolean;
  cpuUsage?: number;
  networkActivityKbps?: number | null;
  runningProcesses?: RunningProcessInfo[];
}> | null = null;
const WINDOWS_CONTEXT_CACHE_TTL_MS = 6_000;

async function readWindowsContext() {
  const now = Date.now();
  if (cachedWindowsContext && now - lastWindowsContextReadAt < WINDOWS_CONTEXT_CACHE_TTL_MS) {
    return cachedWindowsContext;
  }
  if (pendingWindowsContextRead) {
    return pendingWindowsContextRead;
  }

  pendingWindowsContextRead = (async () => {
    try {
      const script = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class OmniWin32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@
    $hwnd = [OmniWin32]::GetForegroundWindow()
    $builder = New-Object System.Text.StringBuilder 1024
    [void][OmniWin32]::GetWindowText($hwnd, $builder, $builder.Capacity)
    [uint32]$pid = 0
    [void][OmniWin32]::GetWindowThreadProcessId($hwnd, [ref]$pid)
    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
    $rect = New-Object OmniWin32+RECT
    $fullscreen = $false
    if ([OmniWin32]::GetWindowRect($hwnd, [ref]$rect)) {
      $screen = [System.Windows.Forms.Screen]::FromHandle($hwnd)
      $bounds = $screen.Bounds
      $fullscreen = (($rect.Left -le $bounds.Left) -and ($rect.Top -le $bounds.Top) -and ($rect.Right -ge $bounds.Right) -and ($rect.Bottom -ge $bounds.Bottom))
    }

    $running = Get-Process | Select-Object -First 250 @{n='name';e={$_.ProcessName}},@{n='pid';e={$_.Id}},@{n='memoryMb';e={[math]::Round($_.WorkingSet64 / 1MB)}},@{n='mainWindowTitle';e={$_.MainWindowTitle}}
    $cpu = try { ((Get-Counter '\\Processor(_Total)\\% Processor Time' -SampleInterval 1 -MaxSamples 1).CounterSamples[0].CookedValue) } catch { $null }
    $net = try { ((Get-Counter '\\Network Interface(*)\\Bytes Total/sec' -SampleInterval 1 -MaxSamples 1).CounterSamples | Measure-Object CookedValue -Sum).Sum / 1024 } catch { $null }

    [pscustomobject]@{
      activeApp = if ($process) { $process.ProcessName } else { '' }
      activeWindowTitle = $builder.ToString()
      isFullscreen = $fullscreen
      cpuUsage = if ($cpu -ne $null) { [math]::Round([double]$cpu, 1) } else { 0 }
      networkActivityKbps = if ($net -ne $null) { [math]::Round([double]$net, 1) } else { $null }
      runningProcesses = @($running)
    } | ConvertTo-Json -Depth 5 -Compress
  `;
      const output = await runPowerShell(script);
      const parsed = JSON.parse(output) as {
        activeApp?: string;
        activeWindowTitle?: string;
        isFullscreen?: boolean;
        cpuUsage?: number;
        networkActivityKbps?: number | null;
        runningProcesses?: RunningProcessInfo[];
      };
      cachedWindowsContext = parsed;
      lastWindowsContextReadAt = Date.now();
      return parsed;
    } finally {
      pendingWindowsContextRead = null;
    }
  })();

  return pendingWindowsContextRead;
}

function detectActivity(context: Omit<SystemContext, "detectedActivity">) {
  const processNames = new Set(
    context.runningProcesses.map((process) =>
      normalizeProcessName(process.name),
    ),
  );
  const active = normalizeProcessName(context.activeApp);
  const title = context.activeWindowTitle.toLowerCase();

  if (context.batteryState === "discharging" && context.ramUsage < 70) {
    return "Battery Saver";
  }
  if (
    processNames.has("unity") ||
    processNames.has("unity editor") ||
    active.includes("unity")
  ) {
    return "Unity Development";
  }
  if (
    ["winword", "excel", "powerpnt", "msproject", "outlook"].some((name) =>
      processNames.has(name),
    ) ||
    ["winword", "excel", "powerpnt", "msproject", "outlook"].some((name) =>
      active.includes(name),
    )
  ) {
    if (context.ramUsage >= 85 || context.cpuUsage >= 80) {
      return "Heavy Office Workload";
    }
    return "Office Productivity";
  }
  if (
    processNames.has("code") &&
    (processNames.has("laragon") ||
      processNames.has("xampp-control") ||
      processNames.has("mysqld") ||
      processNames.has("php"))
  ) {
    return "Laravel Development";
  }
  if (
    context.isFullscreen &&
    ((context.gpuUsage ?? 0) >= 60 ||
      ["steam", "epicgameslauncher", "valorant", "genshinimpact"].some(
        (name) => processNames.has(name),
      ))
  ) {
    return "Gaming";
  }
  if ((context.cpuTemp ?? 0) >= 85 || context.cpuUsage >= 85 || context.ramUsage >= 90) {
    return "Heavy Workload";
  }
  if (processNames.has("code") || active === "code") return "Coding";
  if (
    ["chrome", "msedge", "firefox", "brave"].some((name) =>
      processNames.has(name),
    ) ||
    /chrome|edge|browser/.test(title)
  ) {
    return "Browsing";
  }
  return "Idle";
}

export async function getCurrentContext(): Promise<SystemContext> {
  const [windows, status] = await Promise.all([
    readWindowsContext().catch(() => ({
      activeApp: "",
      activeWindowTitle: "",
      isFullscreen: false,
      cpuUsage: 0,
      networkActivityKbps: null,
      runningProcesses: [],
    })),
    getSystemStatus().catch(() => null),
  ]);
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const runningProcesses = Array.isArray(windows.runningProcesses)
    ? windows.runningProcesses
    : [];

  const baseContext: Omit<SystemContext, "detectedActivity"> = {
    activeApp: windows.activeApp ?? "",
    activeWindowTitle: windows.activeWindowTitle ?? "",
    runningProcesses,
    cpuUsage: Number(windows.cpuUsage) || status?.cpuLoadPercent || 0,
    cpuTemp: status?.temperatureCelsius ?? null,
    gpuUsage: status?.gpuLoadPercent ?? null,
    ramUsage:
      status?.memoryUsedPercent ??
      Math.round(((totalMemory - freeMemory) / totalMemory) * 100),
    ssdUsage: status?.samsungMagician.activityPercent ?? null,
    batteryState: status
      ? status.onBattery
        ? "discharging"
        : "charging"
      : "unknown",
    isFullscreen: Boolean(windows.isFullscreen),
    networkActivityKbps:
      typeof windows.networkActivityKbps === "number"
        ? windows.networkActivityKbps
        : null,
    sampledAt: new Date().toISOString(),
  };

  return {
    ...baseContext,
    detectedActivity: detectActivity(baseContext),
  };
}
