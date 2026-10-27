import { memo } from "react";

interface AssistantSpeechBubbleProps {
  message: string;
  isAnalyzing: boolean;
  onAnalyzeScreen: () => void;
}

function AssistantSpeechBubbleComponent({
  message,
  isAnalyzing,
  onAnalyzeScreen,
}: AssistantSpeechBubbleProps) {
  return (
    <aside className="omni-speech-bubble relative w-36 rounded-2xl border border-white/80 bg-white/95 p-3 text-left shadow-panel backdrop-blur-xl transition-all duration-300">
      <span className="absolute -right-2 bottom-8 h-4 w-4 rotate-45 border-r border-t border-white/80 bg-white shadow-sm" />
      <p className="relative text-[11px] font-medium leading-relaxed text-slate-700 transition-opacity duration-200">
        {message}
      </p>
      <button
        type="button"
        onClick={onAnalyzeScreen}
        disabled={isAnalyzing}
        className="relative mt-2 w-full rounded-lg bg-slate-900 px-2 py-1.5 text-[10px] font-semibold text-white shadow-sm transition-all duration-200 hover:bg-slate-700 hover:shadow active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
      >
        {isAnalyzing ? "Menganalisis..." : "Analisis layar"}
      </button>
    </aside>
  );
}

export const AssistantSpeechBubble = memo(AssistantSpeechBubbleComponent);

