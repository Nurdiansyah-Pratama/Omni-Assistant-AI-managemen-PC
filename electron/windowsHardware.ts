import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const POWERSHELL = path.join(
  process.env.WINDIR ?? "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);

export interface WindowsHardwareSnapshot {
  gpuName: string | null;
  gpuLoadPercent: number | null;
  gpuSharedMemoryUsedMb: number | null;
  gpuSharedMemoryTotalMb: number | null;
  fanRpm: number | null;
  fanSource: string;
}

const emptySnapshot: WindowsHardwareSnapshot = {
  gpuName: null,
  gpuLoadPercent: null,
  gpuSharedMemoryUsedMb: null,
  gpuSharedMemoryTotalMb: null,
  fanRpm: null,
  fanSource: "ASUS WMI tidak mengekspos RPM",
};
const MYASUS_LOG_MAX_AGE_MS = 3 * 60 * 1000;
const MYASUS_LOG_TAIL_BYTES = 128 * 1024;

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readMyAsusFanTelemetry() {
  try {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) return null;

    const logDirectory = path.join(
      localAppData,
      "Packages",
      "B9ECED6F.ASUSPCAssistant_qmba6cd70vzyy",
      "LocalState",
      "log",
    );
    const logFiles = fs
      .readdirSync(logDirectory)
      .filter((name) => /^SystemDiagnosis_.+\.log$/i.test(name))
      .map((name) => {
        const filePath = path.join(logDirectory, name);
        return { filePath, stats: fs.statSync(filePath) };
      })
      .sort(
        (left, right) =>
          right.stats.mtimeMs - left.stats.mtimeMs,
      );
    const latest = logFiles[0];

    if (
      !latest ||
      Date.now() - latest.stats.mtimeMs > MYASUS_LOG_MAX_AGE_MS
    ) {
      return null;
    }

    const bytesToRead = Math.min(
      latest.stats.size,
      MYASUS_LOG_TAIL_BYTES,
    );
    const buffer = Buffer.alloc(bytesToRead);
    const handle = fs.openSync(latest.filePath, "r");

    try {
      fs.readSync(
        handle,
        buffer,
        0,
        bytesToRead,
        latest.stats.size - bytesToRead,
      );
    } finally {
      fs.closeSync(handle);
    }

    const matches = [
      ...buffer
        .toString("utf8")
        .matchAll(/FanIndex\s*=\s*0,\s*RPM\s*=\s*(-?\d+)/gi),
    ];
    const rpm = Number(matches.at(-1)?.[1]);

    return Number.isFinite(rpm) && rpm >= 100 && rpm <= 20_000
      ? rpm
      : null;
  } catch {
    return null;
  }
}

let cachedHardwareSnapshot: WindowsHardwareSnapshot | null = null;
let lastHardwareReadAt = 0;
let pendingHardwareRead: Promise<WindowsHardwareSnapshot> | null = null;
const HARDWARE_CACHE_TTL_MS = 6_000;

export async function readWindowsHardware(): Promise<WindowsHardwareSnapshot> {
  const now = Date.now();
  if (cachedHardwareSnapshot && now - lastHardwareReadAt < HARDWARE_CACHE_TTL_MS) {
    return cachedHardwareSnapshot;
  }
  if (pendingHardwareRead) {
    return pendingHardwareRead;
  }

  pendingHardwareRead = (async () => {
    const myAsusFanRpm = readMyAsusFanTelemetry();

    try {
      const script = `
      $result = [ordered]@{
        gpuName = $null
        gpuLoadPercent = $null
        gpuSharedMemoryUsedMb = $null
        gpuSharedMemoryTotalMb = $null
        fanRpm = $null
        fanSource = 'ASUS WMI tidak mengekspos RPM'
      }

      try {
        $controller = Get-CimInstance Win32_VideoController -ErrorAction Stop |
          Where-Object { $_.Name -notmatch 'Basic Display|Remote Display' } |
          Select-Object -First 1

        if ($controller) {
          $result.gpuName = [string]$controller.Name
        }

        $adapter = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory -ErrorAction Stop |
          Sort-Object SharedUsage -Descending |
          Select-Object -First 1

        if ($adapter) {
          $result.gpuSharedMemoryUsedMb = [math]::Round([double]$adapter.SharedUsage / 1MB)
          $computer = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
          $result.gpuSharedMemoryTotalMb = [math]::Round([double]$computer.TotalPhysicalMemory / 2 / 1MB)

          $adapterMatch = [regex]::Match(
            [string]$adapter.Name,
            'luid_0x[0-9a-f]+_0x[0-9a-f]+_phys_\\d+',
            [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
          )
          $adapterKey = if ($adapterMatch.Success) { $adapterMatch.Value } else { '' }
          $engineTotals = @{}
          $engines = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction Stop

          foreach ($engine in $engines) {
            $engineName = [string]$engine.Name
            $engineMatch = [regex]::Match(
              $engineName,
              '(luid_0x[0-9a-f]+_0x[0-9a-f]+_phys_\\d+)_eng_(\\d+)_engtype_(.+)$',
              [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
            )

            if (-not $engineMatch.Success) { continue }
            if ($adapterKey -and $engineMatch.Groups[1].Value -ne $adapterKey) { continue }

            $engineKey = $engineMatch.Groups[1].Value + ':' +
              $engineMatch.Groups[2].Value + ':' +
              $engineMatch.Groups[3].Value
            $current = if ($engineTotals.ContainsKey($engineKey)) {
              [double]$engineTotals[$engineKey]
            } else {
              0
            }
            $engineTotals[$engineKey] = $current + [double]$engine.UtilizationPercentage
          }

          if ($engineTotals.Count -gt 0) {
            $busiest = $engineTotals.Values |
              Measure-Object -Maximum |
              Select-Object -ExpandProperty Maximum
            $result.gpuLoadPercent = [math]::Round([math]::Min(100, [double]$busiest), 1)
          }
        }
      } catch {}

      try {
        $asus = Get-WmiObject -Namespace root\\wmi -Class AsusAtkWmi_WMNB -ErrorAction Stop

        foreach ($deviceId in @([uint32]0x00110013, [uint32]0x00110012)) {
          try {
            $reading = $asus.DSTS($deviceId)
            $raw = [uint32]$reading.result
            $units = $raw -band 0xffff
            $rpm = $units * 100

            if ($rpm -ge 100 -and $rpm -le 20000) {
              $result.fanRpm = $rpm
              $result.fanSource = 'ASUS WMI / MyASUS'
              break
            }
          } catch {}
        }
      } catch {}

      [pscustomobject]$result | ConvertTo-Json -Compress
    `;
      const { stdout } = await execFileAsync(
        POWERSHELL,
        ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
        {
          windowsHide: true,
          timeout: 10_000,
          maxBuffer: 1024 * 1024,
        },
      );
      const output = stdout.trim();
      if (!output) {
        cachedHardwareSnapshot = emptySnapshot;
        lastHardwareReadAt = Date.now();
        return emptySnapshot;
      }

      const parsed = JSON.parse(output) as Record<string, unknown>;

      const snapshot: WindowsHardwareSnapshot = {
        gpuName:
          typeof parsed.gpuName === "string" && parsed.gpuName
            ? parsed.gpuName
            : null,
        gpuLoadPercent: optionalNumber(parsed.gpuLoadPercent),
        gpuSharedMemoryUsedMb: optionalNumber(
          parsed.gpuSharedMemoryUsedMb,
        ),
        gpuSharedMemoryTotalMb: optionalNumber(
          parsed.gpuSharedMemoryTotalMb,
        ),
        fanRpm: myAsusFanRpm ?? optionalNumber(parsed.fanRpm),
        fanSource:
          myAsusFanRpm !== null
            ? "MyASUS System Diagnosis"
            : typeof parsed.fanSource === "string"
              ? parsed.fanSource
              : emptySnapshot.fanSource,
      };

      cachedHardwareSnapshot = snapshot;
      lastHardwareReadAt = Date.now();
      return snapshot;
    } catch {
      const fallback: WindowsHardwareSnapshot =
        myAsusFanRpm === null
          ? emptySnapshot
          : {
              ...emptySnapshot,
              fanRpm: myAsusFanRpm,
              fanSource: "MyASUS System Diagnosis",
            };
      cachedHardwareSnapshot = fallback;
      lastHardwareReadAt = Date.now();
      return fallback;
    } finally {
      pendingHardwareRead = null;
    }
  })();

  return pendingHardwareRead;
}
