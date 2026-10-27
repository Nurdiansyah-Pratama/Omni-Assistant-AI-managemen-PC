import { useEffect, useRef, useState } from "react";
import { AssistantCharacter } from "./components/assistant/AssistantCharacter";
import { ChatPanel } from "./components/chat/ChatPanel";
import { useChat } from "./hooks/useChat";
import { useAssistantTheme } from "./hooks/useAssistantTheme";
import { useAssistantTips } from "./hooks/useAssistantTips";
import { useVisionSettings } from "./hooks/useVisionSettings";
import type { VisionMode } from "./types/vision";
import { useSystemControl } from "./hooks/useSystemControl";
import { useDashboard } from "./hooks/useDashboard";

export function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chat = useChat();
  const assistantTheme = useAssistantTheme();
  const assistantTips = useAssistantTips();
  const visionSettings = useVisionSettings();
  const systemControl = useSystemControl(isChatOpen);
  const dashboard = useDashboard(isChatOpen);
  const lastSystemNotificationId = useRef<string | null>(null);

  useEffect(() => {
    const advisory =
      systemControl.status?.samsungMagician.performanceAdvisory;
    if (
      !advisory ||
      advisory.id === lastSystemNotificationId.current
    ) {
      return;
    }

    lastSystemNotificationId.current = advisory.id;
    assistantTips.showNotification(advisory.message);
    chat.addAssistantMessage(advisory.message);
  }, [
    assistantTips,
    chat,
    systemControl.status?.samsungMagician.performanceAdvisory,
  ]);

  const analyzeScreenFromChat = async (
    mode: VisionMode,
    prompt?: string,
  ) => {
    try {
      const result = await assistantTips.analyzeScreen(mode, prompt);
      if (result) chat.addAssistantMessage(result.analysis);
    } catch {
      chat.addAssistantMessage(
        "Analisis layar gagal. Periksa API key, model, koneksi internet, dan izin screen capture pada pengaturan AI.",
      );
    }
  };

  const setChatOpen = (open: boolean) => {
    setIsChatOpen(open);
    window.assistant?.setExpanded(open);
  };

  return (
    <main className="flex h-screen w-screen items-end justify-end overflow-hidden p-2">
      {isChatOpen ? (
        <ChatPanel
          messages={chat.messages}
          isReplying={chat.isReplying}
          onSend={chat.sendMessage}
          onClose={() => setChatOpen(false)}
          onQuit={() => window.assistant?.close()}
          theme={assistantTheme.theme}
          selectedThemeId={assistantTheme.themeId}
          onSelectTheme={assistantTheme.selectTheme}
          visionSettings={visionSettings.settings}
          isVisionConfigured={visionSettings.isConfigured}
          isAnalyzingScreen={assistantTips.isAnalyzing}
          onAnalyzeScreen={analyzeScreenFromChat}
          onSaveVisionSettings={visionSettings.save}
          onRemoveProviderApiKey={visionSettings.removeKey}
          onTestProvider={visionSettings.testProvider}
          systemStatus={systemControl.status}
          automationSettings={systemControl.settings}
          isSystemBusy={systemControl.isBusy}
          systemError={systemControl.error}
          onSaveAutomationSettings={systemControl.saveSettings}
          onSetFanMode={systemControl.setFanMode}
          onSetBatteryMode={systemControl.setBatteryMode}
          onFreeUpMemory={systemControl.freeUpMemory}
          onOpenMyAsus={systemControl.openMyAsus}
          onSetSamsungMode={systemControl.setSamsungMode}
          onOpenSamsungMagician={
            systemControl.openSamsungMagician
          }
          dashboardSnapshot={dashboard.snapshot}
          dashboardError={dashboard.error}
          isDashboardBusy={dashboard.isBusy}
          onUpdateDashboardSafety={dashboard.updateSafety}
          onSetManualProfile={dashboard.setManualProfile}
          onExportMemory={dashboard.exportMemory}
          onImportMemory={dashboard.importMemory}
          onForgetMemory={dashboard.forgetMemory}
        />
      ) : (
        <AssistantCharacter
          onClick={() => setChatOpen(true)}
          theme={assistantTheme.theme}
          message={assistantTips.message}
          isAnalyzing={assistantTips.isAnalyzing}
          onAnalyzeScreen={assistantTips.analyzeScreen}
        />
      )}
    </main>
  );
}
