import { execFile } from "node:child_process";
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
const DEFAULT_WEB_URL = "http://127.0.0.1:8085/data.json";

interface RawSensor {
  name: string;
  sensorType: string;
  value: number;
  identifier: string;
  path: string;
}

export interface LibreHardwareSnapshot {
  connected: boolean;
  source: string;
  cpuTemperatureCelsius: number | null;
  cpuLoadPercent: number | null;
  gpuTemperatureCelsius: number | null;
  gpuLoadPercent: number | null;
  memoryLoadPercent: number | null;
  fanRpm: number | null;
  storageName: string | null;
  storageTemperatureCelsius: number | null;
  storageWarningTemperatureCelsius: number | null;
  storageActivityPercent: number | null;
  storageReadBytesPerSecond: number | null;
  storageWriteBytesPerSecond: number | null;
}

const emptySnapshot: LibreHardwareSnapshot = {
  connected: false,
  source: "LibreHardwareMonitor belum terhubung",
  cpuTemperatureCelsius: null,
  cpuLoadPercent: null,
  gpuTemperatureCelsius: null,
  gpuLoadPercent: null,
  memoryLoadPercent: null,
  fanRpm: null,
  storageName: null,
  storageTemperatureCelsius: null,
  storageWarningTemperatureCelsius: null,
  storageActivityPercent: null,
  storageReadBytesPerSecond: null,
  storageWriteBytesPerSecond: null,
};

function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") return null;

  const match = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSensor(input: {
  name?: unknown;
  sensorType?: unknown;
  value?: unknown;
  identifier?: unknown;
  path?: unknown;
}): RawSensor | null {
  const value = parseNumber(input.value);
  if (value === null) return null;
  const rawValue =
    typeof input.value === "string" ? input.value.toLowerCase() : "";
  const inferredSensorType =
    rawValue.includes("°c")
      ? "Temperature"
      : rawValue.includes("rpm")
        ? "Fan"
        : rawValue.includes("%")
          ? "Load"
          : "";

  return {
    name: typeof input.name === "string" ? input.name : "",
    sensorType:
      typeof input.sensorType === "string" && input.sensorType
        ? input.sensorType
        : inferredSensorType,
    value,
    identifier:
      typeof input.identifier === "string" ? input.identifier : "",
    path: typeof input.path === "string" ? input.path : "",
  };
}

function sensorText(sensor: RawSensor) {
  return `${sensor.path} ${sensor.name} ${sensor.identifier}`.toLowerCase();
}

function pickValue(
  sensors: RawSensor[],
  predicate: (sensor: RawSensor) => boolean,
  preference?: (sensor: RawSensor) => number,
) {
  const matches = sensors.filter(predicate);
  if (!matches.length) return null;

  if (preference) {
    matches.sort((a, b) => preference(b) - preference(a));
  }

  return matches[0]?.value ?? null;
}

function pickCpuTemperature(
  sensors: RawSensor[],
  isCpu: (sensor: RawSensor) => boolean,
  isTemperature: (sensor: RawSensor) => boolean,
) {
  const temperatures = sensors.filter((sensor) => {
    const text = sensorText(sensor);

    return (
      isCpu(sensor) &&
      isTemperature(sensor) &&
      /temperatures/.test(text) &&
      !/distance to tjmax/.test(text)
    );
  });

  for (const pattern of [/cpu package$/, /core max$/, /core average$/]) {
    const preferred = temperatures.find((sensor) =>
      pattern.test(sensorText(sensor)),
    );

    if (preferred) return preferred.value;
  }

  if (!temperatures.length) return null;

  return Math.max(...temperatures.map((sensor) => sensor.value));
}

function mapSnapshot(
  sensors: RawSensor[],
  source: string,
): LibreHardwareSnapshot {
  const isCpu = (sensor: RawSensor) =>
    /cpu|processor|intelcpu|amdcpu/.test(sensorText(sensor));
  const isGpu = (sensor: RawSensor) =>
    /gpu|graphics|nvidia|radeon/.test(sensorText(sensor));
  const isTemperature = (sensor: RawSensor) =>
    sensor.sensorType.toLowerCase() === "temperature" ||
    /temperature|°c|\bcpu package\b|\bcore max\b/.test(sensorText(sensor));
  const isLoad = (sensor: RawSensor) =>
    sensor.sensorType.toLowerCase() === "load" ||
    /load|utilization/.test(sensorText(sensor));

  const cpuTemperatureCelsius = pickCpuTemperature(
    sensors,
    isCpu,
    isTemperature,
  );

  const cpuLoadPercent = pickValue(
    sensors,
    (sensor) =>
      isCpu(sensor) &&
      isLoad(sensor) &&
      /cpu total|total cpu|processor total|\/load\/0/.test(sensorText(sensor)),
  );

  const gpuTemperatureCelsius = pickValue(
    sensors,
    (sensor) => isGpu(sensor) && isTemperature(sensor),
    (sensor) =>
      /gpu core|hot spot|junction/.test(sensorText(sensor))
        ? 100
        : sensor.value,
  );

  const gpuLoadPercent = pickValue(
    sensors,
    (sensor) =>
      isGpu(sensor) &&
      isLoad(sensor) &&
      /gpu core|d3d 3d|total/.test(sensorText(sensor)),
  );

  const memoryLoadPercent = pickValue(
    sensors,
    (sensor) =>
      isLoad(sensor) &&
      /memory|ram/.test(sensorText(sensor)) &&
      !isGpu(sensor),
    (sensor) => {
      const text = sensorText(sensor);
      if (/total memory/.test(text)) return 100;
      if (/physical memory|ram/.test(text)) return 80;
      if (/virtual memory/.test(text)) return 10;
      return 0;
    },
  );

  const fanRpm = pickValue(
    sensors,
    (sensor) =>
      sensor.sensorType.toLowerCase() === "fan" ||
      /\bfan\b|rpm/.test(sensorText(sensor)),
    (sensor) => sensor.value,
  );

  const storageSensors = sensors.filter((sensor) =>
    /\/nvme\/|\/storage\/|samsung ssd/.test(sensorText(sensor)),
  );
  const storageName =
    storageSensors
      .flatMap((sensor) => sensor.path.split(" / "))
      .find((part) => /samsung ssd|nvme|ssd/i.test(part)) ?? null;
  const storageTemperatureCelsius = pickValue(
    storageSensors,
    (sensor) =>
      isTemperature(sensor) &&
      /composite temperature|temperature #?1|drive temperature/.test(
        sensorText(sensor),
      ) &&
      !/warning|critical/.test(sensorText(sensor)),
    (sensor) =>
      /composite temperature/.test(sensorText(sensor)) ? 100 : 10,
  );
  const storageWarningTemperatureCelsius = pickValue(
    storageSensors,
    (sensor) =>
      isTemperature(sensor) &&
      /warning temperature/.test(sensorText(sensor)),
  );
  const storageActivityPercent = pickValue(
    storageSensors,
    (sensor) =>
      isLoad(sensor) && /total activity/.test(sensorText(sensor)),
  );
  const storageReadBytesPerSecond = pickValue(
    storageSensors,
    (sensor) =>
      /throughput/.test(sensor.sensorType.toLowerCase()) &&
      /read rate/.test(sensorText(sensor)),
  );
  const storageWriteBytesPerSecond = pickValue(
    storageSensors,
    (sensor) =>
      /throughput/.test(sensor.sensorType.toLowerCase()) &&
      /write rate/.test(sensorText(sensor)),
  );

  return {
    connected: sensors.length > 0,
    source,
    cpuTemperatureCelsius,
    cpuLoadPercent,
    gpuTemperatureCelsius,
    gpuLoadPercent,
    memoryLoadPercent,
    fanRpm,
    storageName,
    storageTemperatureCelsius,
    storageWarningTemperatureCelsius,
    storageActivityPercent,
    storageReadBytesPerSecond,
    storageWriteBytesPerSecond,
  };
}

async function readFromWmi() {
  try {
    const script = `
      $sensors = Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor -ErrorAction Stop |
        Select-Object @{n='name';e={$_.Name}},@{n='sensorType';e={[string]$_.SensorType}},@{n='value';e={$_.Value}},@{n='identifier';e={[string]$_.Identifier}},@{n='path';e={[string]$_.Parent}}
      @($sensors) | ConvertTo-Json -Compress
    `;
    const { stdout } = await execFileAsync(
      POWERSHELL,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        timeout: 3_000,
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    const output = stdout.trim();
    if (!output) return null;

    const parsed = JSON.parse(output) as
      | Record<string, unknown>
      | Array<Record<string, unknown>>;
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const sensors = items
      .map((item) =>
        normalizeSensor({
          name: item.name,
          sensorType: item.sensorType,
          value: item.value,
          identifier: item.identifier,
          path: item.path,
        }),
      )
      .filter((sensor): sensor is RawSensor => sensor !== null);

    return sensors.length
      ? mapSnapshot(sensors, "LibreHardwareMonitor WMI")
      : null;
  } catch {
    return null;
  }
}

function flattenWebTree(
  node: unknown,
  parentPath = "",
  sensors: RawSensor[] = [],
) {
  if (!node || typeof node !== "object") return sensors;

  const item = node as Record<string, unknown>;
  const name =
    typeof item.Text === "string"
      ? item.Text
      : typeof item.Name === "string"
        ? item.Name
        : "";
  const pathName = [parentPath, name].filter(Boolean).join(" / ");
  const value = item.Value ?? item.value;
  const normalized = normalizeSensor({
    name,
    sensorType: item.SensorType ?? item.sensorType ?? item.Type,
    value: item.RawValue ?? value,
    identifier: item.Identifier ?? item.identifier,
    path: pathName,
  });

  if (normalized) sensors.push(normalized);

  const children = item.Children ?? item.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      flattenWebTree(child, pathName, sensors);
    }
  }

  return sensors;
}

async function readFromWebServer() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);

  try {
    const response = await fetch(
      process.env.LIBRE_HARDWARE_MONITOR_URL?.trim() ||
        DEFAULT_WEB_URL,
      {
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as unknown;
    const sensors = flattenWebTree(payload);
    return sensors.length
      ? mapSnapshot(sensors, "LibreHardwareMonitor Web")
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function readLibreHardwareMonitor() {
  const [wmi, web] = await Promise.all([
    readFromWmi(),
    readFromWebServer(),
  ]);

  return wmi ?? web ?? emptySnapshot;
}
