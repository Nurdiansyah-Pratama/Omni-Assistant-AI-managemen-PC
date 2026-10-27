import { useEffect, useState } from "react";
import type {
  AiProvider,
  ProviderTestResult,
  VisionProvider,
  VisionSettings,
  VisionSettingsInput,
} from "../../types/vision";

interface VisionSettingsPanelProps {
  settings: VisionSettings;
  onSave: (input: VisionSettingsInput) => Promise<VisionSettings>;
  onRemoveApiKey: (provider: AiProvider) => Promise<VisionSettings>;
  onTestProvider: (provider: AiProvider) => Promise<ProviderTestResult | null>;
  onClose: () => void;
}

const providerOptions: Array<{ id: VisionProvider; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "openai", label: "OpenAI" },
  { id: "gemini", label: "Gemini" },
  { id: "huggingface", label: "HuggingFace" },
];

const providerRows: Array<{
  id: AiProvider;
  label: string;
  keyPlaceholder: string;
  modelLabel: string;
}> = [
  {
    id: "openai",
    label: "OpenAI",
    keyPlaceholder: "sk-...",
    modelLabel: "Model OpenAI",
  },
  {
    id: "gemini",
    label: "Gemini",
    keyPlaceholder: "AIza...",
    modelLabel: "Model Gemini",
  },
  {
    id: "huggingface",
    label: "HuggingFace",
    keyPlaceholder: "hf_...",
    modelLabel: "Model HuggingFace",
  },
];

export function VisionSettingsPanel({
  settings,
  onSave,
  onRemoveApiKey,
  onTestProvider,
  onClose,
}: VisionSettingsPanelProps) {
  const [provider, setProvider] = useState<VisionProvider>(settings.provider);
  const [openaiModel, setOpenaiModel] = useState(settings.openaiModel);
  const [geminiModel, setGeminiModel] = useState(settings.geminiModel);
  const [huggingFaceModel, setHuggingFaceModel] = useState(
    settings.huggingFaceModel,
  );
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [huggingFaceApiKey, setHuggingFaceApiKey] = useState("");
  const [isBusy, setIsBusy] = useState<AiProvider | "save" | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setProvider(settings.provider);
    setOpenaiModel(settings.openaiModel);
    setGeminiModel(settings.geminiModel);
    setHuggingFaceModel(settings.huggingFaceModel);
  }, [settings]);

  const buildInput = (override?: Partial<VisionSettingsInput>) => ({
    provider,
    openaiModel,
    geminiModel,
    huggingFaceModel,
    openaiApiKey,
    geminiApiKey,
    huggingFaceApiKey,
    ...override,
  });

  const saveSettings = async (override?: Partial<VisionSettingsInput>) => {
    const next = await onSave(buildInput(override));
    setOpenaiApiKey("");
    setGeminiApiKey("");
    setHuggingFaceApiKey("");
    return next;
  };

  const handleSave = async () => {
    setIsBusy("save");
    setStatus("");
    try {
      await saveSettings();
      setStatus("Pengaturan AI tersimpan dengan storage terenkripsi.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Pengaturan gagal disimpan.");
    } finally {
      setIsBusy(null);
    }
  };

  const handleSaveProvider = async (target: AiProvider) => {
    setIsBusy(target);
    setStatus("");
    try {
      await saveSettings();
      setStatus(`${formatProvider(target)} API tersimpan.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "API gagal disimpan.");
    } finally {
      setIsBusy(null);
    }
  };

  const handleRemove = async (target: AiProvider) => {
    setIsBusy(target);
    setStatus("");
    try {
      await onRemoveApiKey(target);
      if (target === "openai") setOpenaiApiKey("");
      if (target === "gemini") setGeminiApiKey("");
      if (target === "huggingface") setHuggingFaceApiKey("");
      setStatus(`${formatProvider(target)} API key dihapus.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "API key gagal dihapus.");
    } finally {
      setIsBusy(null);
    }
  };

  const handleTest = async (target: AiProvider) => {
    setIsBusy(target);
    setStatus("");
    try {
      await saveSettings();
      const result = await onTestProvider(target);
      setStatus(
        result
          ? `${formatProvider(target)}: ${formatTestResult(result)}`
          : "Test API tidak tersedia.",
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Test API gagal.");
    } finally {
      setIsBusy(null);
    }
  };

  return (
    <section className="max-h-[430px] overflow-y-auto border-b border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">AI Vision</h2>
          <p className="text-[11px] text-slate-500">
            Screenshot hanya dikirim saat analisis diminta.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-200"
        >
          Tutup
        </button>
      </div>

      <div className="mb-3">
        <p className="mb-1 text-[11px] font-semibold text-slate-700">
          Provider mode
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          {providerOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setProvider(item.id)}
              className={`rounded-xl border px-2 py-2 text-[10px] font-semibold ${
                provider === item.id
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          Auto: vision memakai OpenAI/Gemini, Coding memprioritaskan
          OpenAI/HuggingFace, Desain memprioritaskan Gemini/OpenAI.
        </p>
      </div>

      <div className="space-y-2">
        {providerRows.map((row) => (
          <ProviderConfigCard
            key={row.id}
            provider={row.id}
            label={row.label}
            modelLabel={row.modelLabel}
            keyPlaceholder={row.keyPlaceholder}
            settings={settings}
            modelValue={getModelValue(row.id, {
              openaiModel,
              geminiModel,
              huggingFaceModel,
            })}
            apiKeyValue={getApiKeyValue(row.id, {
              openaiApiKey,
              geminiApiKey,
              huggingFaceApiKey,
            })}
            onModelChange={(value) => {
              if (row.id === "openai") setOpenaiModel(value);
              if (row.id === "gemini") setGeminiModel(value);
              if (row.id === "huggingface") setHuggingFaceModel(value);
            }}
            onApiKeyChange={(value) => {
              if (row.id === "openai") setOpenaiApiKey(value);
              if (row.id === "gemini") setGeminiApiKey(value);
              if (row.id === "huggingface") setHuggingFaceApiKey(value);
            }}
            onSave={() => handleSaveProvider(row.id)}
            onRemove={() => handleRemove(row.id)}
            onTest={() => handleTest(row.id)}
            disabled={Boolean(isBusy)}
            busy={isBusy === row.id}
          />
        ))}
      </div>

      <p className="mt-2 text-[10px] text-slate-500">
        Token HuggingFace hanya perlu permission: Make calls to Inference
        Providers.
      </p>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[10px] text-slate-500">{status}</span>
        <button
          type="button"
          disabled={Boolean(isBusy)}
          onClick={handleSave}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {isBusy === "save" ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </section>
  );
}

function ProviderConfigCard({
  provider,
  label,
  modelLabel,
  keyPlaceholder,
  settings,
  modelValue,
  apiKeyValue,
  onModelChange,
  onApiKeyChange,
  onSave,
  onRemove,
  onTest,
  disabled,
  busy,
}: {
  provider: AiProvider;
  label: string;
  modelLabel: string;
  keyPlaceholder: string;
  settings: VisionSettings;
  modelValue: string;
  apiKeyValue: string;
  onModelChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onSave: () => void;
  onRemove: () => void;
  onTest: () => void;
  disabled: boolean;
  busy: boolean;
}) {
  const connection = settings.providerStatus[provider];
  const hasKey =
    provider === "openai"
      ? settings.hasOpenaiApiKey
      : provider === "gemini"
        ? settings.hasGeminiApiKey
        : settings.hasHuggingFaceApiKey;
  const maskedKey =
    provider === "openai"
      ? settings.maskedOpenaiApiKey
      : provider === "gemini"
        ? settings.maskedGeminiApiKey
        : settings.maskedHuggingFaceApiKey;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold text-slate-800">{label}</p>
          <p className="text-[10px] text-slate-500">
            {formatProviderStatus(connection?.status, hasKey)}
            {connection?.latencyMs ? ` - ${connection.latencyMs} ms` : ""}
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${statusClass(connection?.status, hasKey)}`}>
          {connection?.status === "connected" ? "Connected" : hasKey ? "Saved" : "Offline"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-[10px] font-medium text-slate-600">
          {modelLabel}
          <input
            value={modelValue}
            onChange={(event) => onModelChange(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800 outline-none focus:border-indigo-400"
          />
        </label>
        <label className="text-[10px] font-medium text-slate-600">
          API key
          <input
            type="password"
            value={apiKeyValue}
            onChange={(event) => onApiKeyChange(event.target.value)}
            placeholder={hasKey ? maskedKey : keyPlaceholder}
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-800 outline-none focus:border-indigo-400"
          />
        </label>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <SmallActionButton disabled={disabled} onClick={onSave}>
          {busy ? "..." : "Simpan API"}
        </SmallActionButton>
        <SmallActionButton disabled={disabled || !hasKey} onClick={onTest}>
          Test API
        </SmallActionButton>
        <SmallActionButton disabled={disabled || !hasKey} onClick={onRemove}>
          Hapus API
        </SmallActionButton>
      </div>
    </div>
  );
}

function SmallActionButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold text-slate-700 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function getModelValue(
  provider: AiProvider,
  models: {
    openaiModel: string;
    geminiModel: string;
    huggingFaceModel: string;
  },
) {
  if (provider === "openai") return models.openaiModel;
  if (provider === "gemini") return models.geminiModel;
  return models.huggingFaceModel;
}

function getApiKeyValue(
  provider: AiProvider,
  keys: {
    openaiApiKey: string;
    geminiApiKey: string;
    huggingFaceApiKey: string;
  },
) {
  if (provider === "openai") return keys.openaiApiKey;
  if (provider === "gemini") return keys.geminiApiKey;
  return keys.huggingFaceApiKey;
}

function formatProvider(provider: AiProvider) {
  if (provider === "openai") return "OpenAI";
  if (provider === "gemini") return "Gemini";
  return "HuggingFace";
}

function formatProviderStatus(
  status: VisionSettings["providerStatus"][AiProvider]["status"] | undefined,
  hasKey: boolean,
) {
  if (!hasKey) return "AI Offline - Provider belum dikonfigurasi";
  if (status === "connected") return "Connected";
  if (status === "invalid_api_key") return "Invalid API Key";
  if (status === "quota_exceeded") return "Quota exceeded";
  if (status === "timeout") return "Timeout";
  if (status === "model_not_available") return "Model not available";
  if (status === "request_failed") return "API error";
  return "API tersimpan - belum dites";
}

function statusClass(
  status: VisionSettings["providerStatus"][AiProvider]["status"] | undefined,
  hasKey: boolean,
) {
  if (status === "connected") return "bg-emerald-50 text-emerald-600";
  if (!hasKey) return "bg-slate-100 text-slate-500";
  if (
    status === "invalid_api_key" ||
    status === "quota_exceeded" ||
    status === "timeout" ||
    status === "model_not_available" ||
    status === "request_failed"
  ) {
    return "bg-red-50 text-red-600";
  }
  return "bg-amber-50 text-amber-600";
}

function formatTestResult(result: ProviderTestResult) {
  const latency = result.latencyMs ? ` (${result.latencyMs} ms)` : "";
  if (result.ok) return `Connected${latency}`;
  if (result.status === "invalid_api_key") return `Invalid API Key${latency}`;
  if (result.status === "timeout") return `Timeout${latency}`;
  if (result.status === "model_not_available") {
    return `Model not available${latency}`;
  }
  if (result.status === "quota_exceeded") return `Quota exceeded${latency}`;
  return `${result.message}${latency}`;
}
