import { useEffect, useState } from "react";
import type {
  AiProvider,
  ProviderTestResult,
  VisionSettings,
  VisionSettingsInput,
} from "../types/vision";

const fallbackSettings: VisionSettings = {
  provider: "openai",
  openaiModel: "gpt-5.5",
  geminiModel: "gemini-3.5-flash",
  huggingFaceModel: "Qwen/Qwen2.5-7B-Instruct",
  hasOpenaiApiKey: false,
  hasGeminiApiKey: false,
  hasHuggingFaceApiKey: false,
  maskedOpenaiApiKey: "",
  maskedGeminiApiKey: "",
  maskedHuggingFaceApiKey: "",
  providerStatus: {
    openai: {
      status: "offline",
      message: "AI Offline - Provider belum dikonfigurasi",
      latencyMs: null,
    },
    gemini: {
      status: "offline",
      message: "AI Offline - Provider belum dikonfigurasi",
      latencyMs: null,
    },
    huggingface: {
      status: "offline",
      message: "AI Offline - Provider belum dikonfigurasi",
      latencyMs: null,
    },
  },
};

export function useVisionSettings() {
  const [settings, setSettings] =
    useState<VisionSettings>(fallbackSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    window.assistant
      ?.getVisionSettings()
      .then(setSettings)
      .finally(() => setIsLoading(false));
  }, []);

  const save = async (input: VisionSettingsInput) => {
    if (!window.assistant) return settings;
    const next = await window.assistant.saveVisionSettings(input);
    setSettings(next);
    return next;
  };

  const removeKey = async (provider: AiProvider) => {
    if (!window.assistant) return settings;
    const next = await window.assistant.removeProviderApiKey(provider);
    setSettings(next);
    return next;
  };

  const testProvider = async (provider: AiProvider) => {
    if (!window.assistant) {
      return null as ProviderTestResult | null;
    }
    const response = await window.assistant.testProvider(provider);
    setSettings(response.settings);
    return response.result;
  };

  const isConfigured =
    settings.provider === "auto"
      ? settings.hasOpenaiApiKey ||
        settings.hasGeminiApiKey ||
        settings.hasHuggingFaceApiKey
      : settings.provider === "openai"
        ? settings.hasOpenaiApiKey
        : settings.provider === "gemini"
          ? settings.hasGeminiApiKey
          : settings.hasHuggingFaceApiKey;

  return { settings, isConfigured, isLoading, save, removeKey, testProvider };
}
