import { memo } from "react";
import type { AssistantTheme } from "../../types/assistantTheme";
import { AssistantSpeechBubble } from "./AssistantSpeechBubble";
import { OmniRobot } from "./OmniRobot";

const glowClassByThemeId: Record<string, string> = {
  blue: "omni-character-glow-blue",
  yellow: "omni-character-glow-yellow",
  violet: "omni-character-glow-violet",
  red: "omni-character-glow-red",
  green: "omni-character-glow-green",
};

interface AssistantCharacterProps {
  onClick: () => void;
  theme: AssistantTheme;
  message: string;
  isAnalyzing: boolean;
  onAnalyzeScreen: () => void;
}

function AssistantCharacterComponent({
  onClick,
  theme,
  message,
  isAnalyzing,
  onAnalyzeScreen,
}: AssistantCharacterProps) {
  return (
    <div className="flex h-full w-full flex-col p-1 select-none">
      <div
        className="drag-region mx-auto mt-1 flex h-5 w-16 cursor-move items-center justify-center rounded-full bg-slate-950/75 shadow-lg backdrop-blur transition-all duration-200 hover:bg-slate-900"
        title="Seret untuk memindahkan Omni"
      >
        <span className="h-0.5 w-7 rounded-full bg-white/60" />
      </div>
      <div className="flex min-h-0 flex-1 items-end justify-end gap-1">
        <AssistantSpeechBubble
          message={message}
          isAnalyzing={isAnalyzing}
          onAnalyzeScreen={onAnalyzeScreen}
        />
        <button
          type="button"
          onClick={onClick}
          className="no-drag omni-character-button group flex h-full min-w-0 flex-1 flex-col items-center justify-end rounded-3xl focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300"
          aria-label="Buka Omni Assistant"
        >
          <span className="relative flex min-h-0 flex-1 items-end justify-center">
            <span
              className={`absolute bottom-3 h-16 w-16 rounded-full opacity-45 blur-2xl transition-colors duration-500 ${
                glowClassByThemeId[theme.id] ?? "omni-character-glow-blue"
              }`}
            />
            <OmniRobot
              theme={theme}
              animated
              activity={isAnalyzing ? "thinking" : "idle"}
              className="omni-float relative h-[135px] w-auto origin-bottom transition-transform duration-200"
            />
          </span>
          <span className="mb-1 rounded-full bg-slate-950/85 px-3 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur transition-all duration-200 group-hover:bg-slate-900 group-hover:shadow-cyan-500/20 group-hover:shadow-md">
            Tanya Omni
          </span>
        </button>
      </div>
    </div>
  );
}

export const AssistantCharacter = memo(AssistantCharacterComponent);

