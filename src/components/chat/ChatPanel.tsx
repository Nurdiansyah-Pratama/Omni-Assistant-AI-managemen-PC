import { useState } from "react";
import type { ChatMessage } from "../../types/chat";
import type { AssistantTheme } from "../../types/assistantTheme";
import type {
  AiProvider,
  ProviderTestResult,
  VisionMode,
  VisionSettings,
  VisionSettingsInput,
} from "../../types/vision";
import { ScreenAnalysisControls } from "../vision/ScreenAnalysisControls";
import { VisionSettingsPanel } from "../vision/VisionSettingsPanel";
import { SystemControlPanel } from "../system/SystemControlPanel";
import { DashboardPanel } from "../dashboard_ui/DashboardPanel";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
import type {
  AutomationSettings,
  BatteryMode,
  FanMode,
  SamsungMode,
  SystemStatus,
} from "../../types/systemControl";
import type { SafetySettings, DashboardSnapshot } from "../../types/dashboard";

interface ChatPanelProps {
  messages: ChatMessage[];
  isReplying: boolean;
  onSend: (content: string, mode: VisionMode, focus?: string) => void;
  onClose: () => void;
  onQuit: () => void;
  theme: AssistantTheme;
  selectedThemeId: string;
  onSelectTheme: (themeId: string) => void;
  visionSettings: VisionSettings;
  isVisionConfigured: boolean;
  isAnalyzingScreen: boolean;
  onAnalyzeScreen: (mode: VisionMode, prompt?: string) => void;
  onSaveVisionSettings: (
    input: VisionSettingsInput,
  ) => Promise<VisionSettings>;
  onRemoveProviderApiKey: (provider: AiProvider) => Promise<VisionSettings>;
  onTestProvider: (
    provider: AiProvider,
  ) => Promise<ProviderTestResult | null>;
  systemStatus: SystemStatus | null;
  automationSettings: AutomationSettings;
  isSystemBusy: boolean;
  systemError: string;
  onSaveAutomationSettings: (settings: AutomationSettings) => void;
  onSetFanMode: (mode: FanMode) => void;
  onSetBatteryMode: (mode: BatteryMode) => void;
  onFreeUpMemory: () => void;
  onOpenMyAsus: () => void;
  onSetSamsungMode: (mode: SamsungMode) => void;
  onOpenSamsungMagician: () => void;
  dashboardSnapshot: DashboardSnapshot | null;
  dashboardError: string;
  isDashboardBusy: boolean;
  onUpdateDashboardSafety: (input: Partial<SafetySettings>) => void;
  onSetManualProfile: (profileName: string | null) => void;
  onExportMemory: () => void;
  onImportMemory: () => void;
  onForgetMemory: () => void;
}

export function ChatPanel({
  messages,
  isReplying,
  onSend,
  onClose,
  onQuit,
  theme,
  selectedThemeId,
  onSelectTheme,
  visionSettings,
  isVisionConfigured,
  isAnalyzingScreen,
  onAnalyzeScreen,
  onSaveVisionSettings,
  onRemoveProviderApiKey,
  onTestProvider,
  systemStatus,
  automationSettings,
  isSystemBusy,
  systemError,
  onSaveAutomationSettings,
  onSetFanMode,
  onSetBatteryMode,
  onFreeUpMemory,
  onOpenMyAsus,
  onSetSamsungMode,
  onOpenSamsungMagician,
  dashboardSnapshot,
  dashboardError,
  isDashboardBusy,
  onUpdateDashboardSafety,
  onSetManualProfile,
  onExportMemory,
  onImportMemory,
  onForgetMemory,
}: ChatPanelProps) {
  const [showVisionSettings, setShowVisionSettings] = useState(false);
  const [showSystemControl, setShowSystemControl] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [chatMode, setChatMode] = useState<VisionMode>("general");
  const [analysisFocus, setAnalysisFocus] = useState("");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-white/70 bg-white/95 shadow-panel backdrop-blur-xl">
      <ChatHeader
        onClose={onClose}
        onQuit={onQuit}
        theme={theme}
        selectedThemeId={selectedThemeId}
        onSelectTheme={onSelectTheme}
        onToggleSettings={() => setShowVisionSettings((current) => !current)}
        onToggleSystem={() => {
          setShowSystemControl((current) => !current);
          setShowVisionSettings(false);
          setShowDashboard(false);
        }}
        onToggleDashboard={() => {
          setShowDashboard((current) => !current);
          setShowSystemControl(false);
          setShowVisionSettings(false);
        }}
        visionProvider={visionSettings.provider}
        isVisionConfigured={isVisionConfigured}
        visionStatusText={getVisionStatusText(visionSettings)}
      />
      {showVisionSettings && (
        <VisionSettingsPanel
          settings={visionSettings}
          onSave={onSaveVisionSettings}
          onRemoveApiKey={onRemoveProviderApiKey}
          onTestProvider={onTestProvider}
          onClose={() => setShowVisionSettings(false)}
        />
      )}
      {showSystemControl && (
        <SystemControlPanel
          status={systemStatus}
          settings={automationSettings}
          isBusy={isSystemBusy}
          error={systemError}
          onSaveSettings={onSaveAutomationSettings}
          onSetFanMode={onSetFanMode}
          onSetBatteryMode={onSetBatteryMode}
          onFreeUpMemory={onFreeUpMemory}
          onOpenMyAsus={onOpenMyAsus}
          onSetSamsungMode={onSetSamsungMode}
          onOpenSamsungMagician={onOpenSamsungMagician}
          onClose={() => setShowSystemControl(false)}
        />
      )}
      {showDashboard && (
        <DashboardPanel
          snapshot={dashboardSnapshot}
          error={dashboardError}
          isBusy={isDashboardBusy}
          onUpdateSafety={onUpdateDashboardSafety}
          onSetManualProfile={onSetManualProfile}
          onExportMemory={onExportMemory}
          onImportMemory={onImportMemory}
          onForgetMemory={onForgetMemory}
          onClose={() => setShowDashboard(false)}
        />
      )}
      <MessageList messages={messages} isReplying={isReplying} />
      <ScreenAnalysisControls
        provider={visionSettings.provider}
        isConfigured={isVisionConfigured}
        isAnalyzing={isAnalyzingScreen}
        onAnalyze={onAnalyzeScreen}
        onOpenSettings={() => setShowVisionSettings(true)}
        mode={chatMode}
        focus={analysisFocus}
        onModeChange={setChatMode}
        onFocusChange={setAnalysisFocus}
      />
      <ChatInput
        disabled={isReplying}
        onSend={(content) => onSend(content, chatMode, analysisFocus)}
      />
    </div>
  );
}

function getVisionStatusText(settings: VisionSettings) {
  const provider =
    settings.provider === "auto"
      ? (["openai", "gemini", "huggingface"] as const).find(
          (item) => settings.providerStatus[item]?.status === "connected",
        ) ?? "auto"
      : settings.provider;

  if (provider === "auto") {
    return settings.hasOpenaiApiKey ||
      settings.hasGeminiApiKey ||
      settings.hasHuggingFaceApiKey
      ? "Auto - Provider siap"
      : "AI Offline - Provider belum dikonfigurasi";
  }

  const status = settings.providerStatus[provider];
  if (status?.status === "connected") {
    return `${formatProvider(provider)} Connected`;
  }
  if (status?.status === "invalid_api_key") return "API key salah";
  if (status?.status === "quota_exceeded") return "Quota habis";
  if (status?.status === "timeout") return "Timeout";
  if (status?.status === "model_not_available") return "Model not available";

  const hasKey =
    provider === "openai"
      ? settings.hasOpenaiApiKey
      : provider === "gemini"
        ? settings.hasGeminiApiKey
        : settings.hasHuggingFaceApiKey;

  return hasKey
    ? `${formatProvider(provider)} siap - Test API disarankan`
    : "AI Offline - Provider belum dikonfigurasi";
}

function formatProvider(provider: "openai" | "gemini" | "huggingface") {
  if (provider === "openai") return "OpenAI";
  if (provider === "gemini") return "Gemini";
  return "HuggingFace";
}
