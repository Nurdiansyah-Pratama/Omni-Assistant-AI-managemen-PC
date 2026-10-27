import { useCallback, useEffect, useState } from "react";
import type {
  AutomationSettings,
  BatteryMode,
  FanMode,
  SamsungMode,
  SystemStatus,
} from "../types/systemControl";

const fallbackSettings: AutomationSettings = {
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

export function useSystemControl(enabled = true) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [settings, setSettings] =
    useState<AutomationSettings>(fallbackSettings);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!window.assistant) return;
    try {
      setStatus(await window.assistant.getSystemStatus());
    } catch {
      setError("Status sistem gagal dibaca.");
    }
  }, []);

  useEffect(() => {
    if (!window.assistant || !enabled) return;

    void Promise.all([
      window.assistant.getAutomationSettings().then(setSettings),
      refresh(),
    ]);
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(interval);
  }, [enabled, refresh]);

  const runAction = async (
    action: () => Promise<void>,
    errorMessage = "Kontrol ASUS ditolak. Tutup Omni lalu jalankan `npm run dev:admin`, atau gunakan MyASUS.",
  ) => {
    setIsBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch {
      setError(errorMessage);
    } finally {
      setIsBusy(false);
    }
  };

  const saveSettings = async (next: AutomationSettings) => {
    if (!window.assistant) return;
    setIsBusy(true);
    setError("");
    try {
      const saved = await window.assistant.saveAutomationSettings(next);
      setSettings(saved);
      await refresh();
    } catch {
      setError("Pengaturan otomatisasi gagal disimpan.");
    } finally {
      setIsBusy(false);
    }
  };

  return {
    status,
    settings,
    isBusy,
    error,
    refresh,
    saveSettings,
    setFanMode: (mode: FanMode) =>
      runAction(() => window.assistant!.setFanMode(mode)),
    setBatteryMode: (mode: BatteryMode) =>
      runAction(() => window.assistant!.setBatteryMode(mode)),
    freeUpMemory: () =>
      runAction(
        () => window.assistant!.freeUpMemory().then(() => undefined),
        "RAM tidak dapat diringankan. Coba jalankan `npm run dev:admin`.",
      ),
    openMyAsus: () =>
      runAction(() => window.assistant!.openMyAsus()),
    setSamsungMode: (mode: SamsungMode) =>
      runAction(
        () => window.assistant!.setSamsungMode(mode),
        "Mode Samsung Magician gagal diubah. Jalankan Omni sebagai Administrator dan pastikan jendela Magician dapat dibuka.",
      ),
    openSamsungMagician: () =>
      runAction(() => window.assistant!.openSamsungMagician()),
  };
}
