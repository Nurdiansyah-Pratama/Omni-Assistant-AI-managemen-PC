import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("assistant", {
  setExpanded: (expanded: boolean) => {
    ipcRenderer.send("assistant:set-expanded", expanded);
  },
  close: () => {
    ipcRenderer.send("assistant:close");
  },
  analyzeScreen: (input?: { mode?: string; userPrompt?: string }) =>
    ipcRenderer.invoke("assistant:analyze-screen", input),
  getVisionSettings: () =>
    ipcRenderer.invoke("assistant:get-vision-settings"),
  saveVisionSettings: (input: unknown) =>
    ipcRenderer.invoke("assistant:save-vision-settings", input),
  removeProviderApiKey: (provider: string) =>
    ipcRenderer.invoke("assistant:remove-provider-api-key", provider),
  testProvider: (provider: string) =>
    ipcRenderer.invoke("assistant:test-provider", provider),
  chat: (messages: unknown) =>
    ipcRenderer.invoke("assistant:chat", messages),
  getSystemStatus: () => ipcRenderer.invoke("system:get-status"),
  getAutomationSettings: () => ipcRenderer.invoke("system:get-settings"),
  freeUpMemory: () => ipcRenderer.invoke("system:free-memory"),
  saveAutomationSettings: (input: unknown) =>
    ipcRenderer.invoke("system:save-settings", input),
  setFanMode: (mode: string) =>
    ipcRenderer.invoke("system:set-fan-mode", mode),
  setBatteryMode: (mode: string) =>
    ipcRenderer.invoke("system:set-battery-mode", mode),
  openMyAsus: () => ipcRenderer.invoke("system:open-myasus"),
  openSamsungMagician: () =>
    ipcRenderer.invoke("system:open-samsung-magician"),
  setSamsungMode: (mode: string) =>
    ipcRenderer.invoke("system:set-samsung-mode", mode),
  getDashboardSnapshot: () =>
    ipcRenderer.invoke("dashboard:get-snapshot"),
  updateDashboardSafety: (input: unknown) =>
    ipcRenderer.invoke("dashboard:update-safety", input),
  setManualProfile: (profileName: string | null) =>
    ipcRenderer.invoke("dashboard:set-manual-profile", profileName),
  updateDashboardPreference: (input: unknown) =>
    ipcRenderer.invoke("dashboard:update-preference", input),
  forgetMemory: () => ipcRenderer.invoke("dashboard:forget-memory"),
  exportMemory: () => ipcRenderer.invoke("dashboard:export-memory"),
  importMemory: () => ipcRenderer.invoke("dashboard:import-memory"),
});
