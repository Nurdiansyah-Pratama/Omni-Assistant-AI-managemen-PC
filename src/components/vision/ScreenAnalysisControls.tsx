import type { VisionMode, VisionProvider } from "../../types/vision";

interface ScreenAnalysisControlsProps {
  provider: VisionProvider;
  isConfigured: boolean;
  isAnalyzing: boolean;
  onAnalyze: (mode: VisionMode, prompt?: string) => void;
  onOpenSettings: () => void;
  mode: VisionMode;
  focus: string;
  onModeChange: (mode: VisionMode) => void;
  onFocusChange: (focus: string) => void;
}

const modes: Array<{ id: VisionMode; label: string }> = [
  { id: "general", label: "Umum" },
  { id: "coding", label: "Coding" },
  { id: "design", label: "Desain" },
];

export function ScreenAnalysisControls({
  provider,
  isConfigured,
  isAnalyzing,
  onAnalyze,
  onOpenSettings,
  mode,
  focus,
  onModeChange,
  onFocusChange,
}: ScreenAnalysisControlsProps) {
  return (
    <section className="border-t border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center gap-1.5">
        {modes.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onModeChange(item.id)}
            className={`rounded-lg px-2 py-1 text-[10px] font-medium ${
              mode === item.id
                ? "bg-indigo-100 text-indigo-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {item.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] capitalize text-slate-400">
          Aktif: {provider}
        </span>
      </div>
      <p className="mt-1 text-[9px] text-slate-400">
        Screenshot hanya dikirim saat analisis diminta.
      </p>
      {provider === "huggingface" && (
        <p className="mt-1 text-[9px] text-amber-600">
          Provider ini tidak mendukung vision. Gunakan OpenAI atau Gemini.
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <input
          value={focus}
          onChange={(event) => onFocusChange(event.target.value)}
          placeholder="Fokus analisis, opsional..."
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-indigo-400"
        />
        <button
          type="button"
          disabled={isAnalyzing}
          onClick={() =>
            isConfigured
              ? onAnalyze(mode, focus)
              : onOpenSettings()
          }
          className="rounded-lg bg-indigo-600 px-3 text-[11px] font-semibold text-white disabled:opacity-60"
        >
          {isAnalyzing
            ? "Membaca..."
            : isConfigured
              ? "Baca layar"
              : "Atur API"}
        </button>
      </div>
    </section>
  );
}
