import type { AssistantTheme } from "../../types/assistantTheme";
import type { VisionProvider } from "../../types/vision";
import { OmniRobot } from "../assistant/OmniRobot";
import { ThemePicker } from "../assistant/ThemePicker";

interface ChatHeaderProps {
  onClose: () => void;
  onQuit: () => void;
  theme: AssistantTheme;
  selectedThemeId: string;
  onSelectTheme: (themeId: string) => void;
  onToggleSettings: () => void;
  visionProvider: VisionProvider;
  isVisionConfigured: boolean;
  visionStatusText: string;
  onToggleSystem: () => void;
  onToggleDashboard: () => void;
}

export function ChatHeader({
  onClose,
  onQuit,
  theme,
  selectedThemeId,
  onSelectTheme,
  onToggleSettings,
  visionProvider,
  isVisionConfigured,
  visionStatusText,
  onToggleSystem,
  onToggleDashboard,
}: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-slate-900">
          <OmniRobot
            theme={theme}
            animated
            className="mt-3 h-14 w-auto"
          />
        </span>
        <div>
          <h1 className="text-sm font-semibold text-slate-900">Omni Assistant</h1>
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className={`h-2 w-2 rounded-full ${
                isVisionConfigured ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
            {visionStatusText || (isVisionConfigured
              ? `${visionProvider} siap`
              : "AI Offline - Provider belum dikonfigurasi")}
          </p>
          <div className="mt-2">
            <ThemePicker
              selectedThemeId={selectedThemeId}
              onSelect={onSelectTheme}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={onToggleDashboard}
          className="grid h-8 place-items-center rounded-lg px-2 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label="Automation dashboard"
          title="Automation dashboard"
        >
          Dash
        </button>
        <button
          type="button"
          onClick={onToggleSystem}
          className="grid h-8 place-items-center rounded-lg px-2 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label="Kontrol sistem ASUS"
          title="Kontrol sistem ASUS"
        >
          PC
        </button>
        <button
          type="button"
          onClick={onToggleSettings}
          className="grid h-8 place-items-center rounded-lg px-2 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label="Pengaturan AI Vision"
          title="Pengaturan AI Vision"
        >
          AI
        </button>
        <button
          type="button"
          onClick={onClose}
          className="grid h-8 w-8 place-items-center rounded-lg text-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label="Tutup panel chat"
          title="Kecilkan"
        >
          &minus;
        </button>
        <button
          type="button"
          onClick={onQuit}
          className="grid h-8 w-8 place-items-center rounded-lg text-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
          aria-label="Keluar dari aplikasi"
          title="Keluar"
        >
          &times;
        </button>
      </div>
    </header>
  );
}
