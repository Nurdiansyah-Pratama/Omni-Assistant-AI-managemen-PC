/// <reference types="vite/client" />

import type {
  AiProvider,
  ProviderTestResult,
  ScreenAnalysis,
  VisionMode,
  VisionSettings,
  VisionSettingsInput,
} from "./types/vision";
import type { ChatRequest, ChatResponse } from "./types/chat";
import type {
  AutomationSettings,
  BatteryMode,
  FanMode,
  MemoryCleanupResult,
  SamsungMode,
  SystemStatus,
} from "./types/systemControl";
import type {
  DashboardSnapshot,
  SafetySettings,
} from "./types/dashboard";

declare global {
  interface Window {
    assistant?: {
      setExpanded: (expanded: boolean) => void;
      close: () => void;
      analyzeScreen: (input?: {
        mode?: VisionMode;
        userPrompt?: string;
      }) => Promise<ScreenAnalysis>;
      getVisionSettings: () => Promise<VisionSettings>;
      saveVisionSettings: (
        input: VisionSettingsInput,
      ) => Promise<VisionSettings>;
      removeProviderApiKey: (
        provider: AiProvider,
      ) => Promise<VisionSettings>;
      testProvider: (provider: AiProvider) => Promise<{
        settings: VisionSettings;
        result: ProviderTestResult;
      }>;
      chat: (input: ChatRequest) => Promise<ChatResponse>;
      getSystemStatus: () => Promise<SystemStatus>;
      getAutomationSettings: () => Promise<AutomationSettings>;
      freeUpMemory: () => Promise<MemoryCleanupResult>;
      saveAutomationSettings: (
        input: AutomationSettings,
      ) => Promise<AutomationSettings>;
      setFanMode: (mode: FanMode) => Promise<void>;
      setBatteryMode: (mode: BatteryMode) => Promise<void>;
      openMyAsus: () => Promise<void>;
      setSamsungMode: (mode: SamsungMode) => Promise<void>;
      openSamsungMagician: () => Promise<void>;
      getDashboardSnapshot: () => Promise<DashboardSnapshot>;
      updateDashboardSafety: (
        input: Partial<SafetySettings>,
      ) => Promise<SafetySettings>;
      setManualProfile: (
        profileName: string | null,
      ) => Promise<DashboardSnapshot>;
      updateDashboardPreference: (input: {
        key: string;
        value: unknown;
      }) => Promise<unknown>;
      forgetMemory: () => Promise<unknown>;
      exportMemory: () => Promise<string | null>;
      importMemory: () => Promise<string | null>;
    };
  }
}

export {};
