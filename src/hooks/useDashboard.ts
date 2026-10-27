import { useCallback, useEffect, useState } from "react";
import type { DashboardSnapshot, SafetySettings } from "../types/dashboard";

export function useDashboard(enabled = true) {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!window.assistant) return;

    try {
      const nextSnapshot = await window.assistant.getDashboardSnapshot();
      setSnapshot(nextSnapshot);
      setError(nextSnapshot.error ?? "");
    } catch {
      setError("Dashboard automation gagal dibaca.");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(interval);
  }, [enabled, refresh]);

  const run = async (action: () => Promise<unknown>) => {
    setIsBusy(true);
    setError("");
    try {
      await action();
      await refresh();
    } catch {
      setError("Aksi dashboard gagal.");
    } finally {
      setIsBusy(false);
    }
  };

  return {
    snapshot,
    error,
    isBusy,
    refresh,
    updateSafety: (input: Partial<SafetySettings>) =>
      run(() => window.assistant!.updateDashboardSafety(input)),
    setManualProfile: (profileName: string | null) =>
      run(() => window.assistant!.setManualProfile(profileName)),
    updatePreference: (key: string, value: unknown) =>
      run(() =>
        window.assistant!.updateDashboardPreference({ key, value }),
      ),
    forgetMemory: () => run(() => window.assistant!.forgetMemory()),
    exportMemory: () => run(() => window.assistant!.exportMemory()),
    importMemory: () => run(() => window.assistant!.importMemory()),
  };
}
