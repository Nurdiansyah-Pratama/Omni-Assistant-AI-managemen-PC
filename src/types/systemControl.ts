export type FanMode = "standard" | "performance";
export type BatteryMode = "full" | "balanced" | "lifespan";
export type SamsungMode =
  | "performance"
  | "balanced"
  | "power-saving"
  | "custom"
  | "unknown";

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
