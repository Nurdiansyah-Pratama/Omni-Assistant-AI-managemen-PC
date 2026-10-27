import { app } from "electron";
import fs from "node:fs";
import path from "node:path";
import { logAiEvent } from "./ai/ai_logger";
import { testProvider } from "./ai/ai_router";
import type { AiProvider, ProviderTestResult } from "./ai/base_provider";
import {
  decryptSecret,
  encryptSecret,
  maskSecret,
} from "./security/secure_store";

export type VisionProvider = "openai" | "gemini" | "huggingface" | "auto";

export interface VisionSettings {
  provider: VisionProvider;
  openaiModel: string;
  geminiModel: string;
  huggingFaceModel: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  huggingFaceApiKey?: string;
}

interface StoredVisionSettings {
  provider: VisionProvider;
  openaiModel: string;
  geminiModel: string;
  huggingFaceModel: string;
  encryptedOpenaiApiKey?: string;
  encryptedGeminiApiKey?: string;
  encryptedHuggingFaceApiKey?: string;
  providerStatus?: Record<AiProvider, ProviderConnectionStatus>;
}

export interface PublicVisionSettings {
  provider: VisionProvider;
  openaiModel: string;
  geminiModel: string;
  huggingFaceModel: string;
  hasOpenaiApiKey: boolean;
  hasGeminiApiKey: boolean;
  hasHuggingFaceApiKey: boolean;
  maskedOpenaiApiKey: string;
  maskedGeminiApiKey: string;
  maskedHuggingFaceApiKey: string;
  providerStatus: Record<AiProvider, ProviderConnectionStatus>;
}

const defaults: StoredVisionSettings = {
  provider: "openai",
  openaiModel: "gpt-5.5",
  geminiModel: "gemini-3.5-flash",
  huggingFaceModel: "Qwen/Qwen2.5-7B-Instruct",
  providerStatus: {
    openai: { status: "offline", message: "AI Offline - Provider belum dikonfigurasi", latencyMs: null },
    gemini: { status: "offline", message: "AI Offline - Provider belum dikonfigurasi", latencyMs: null },
    huggingface: { status: "offline", message: "AI Offline - Provider belum dikonfigurasi", latencyMs: null },
  },
};

export interface ProviderConnectionStatus {
  status:
    | "offline"
    | "connected"
    | "invalid_api_key"
    | "quota_exceeded"
    | "timeout"
    | "model_not_available"
    | "request_failed";
  message: string;
  latencyMs: number | null;
  testedAt?: string;
}

function getSettingsFile() {
  return path.join(app.getPath("userData"), "vision-settings.json");
}

function readStoredSettings(): StoredVisionSettings {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(getSettingsFile(), "utf8"),
    ) as Partial<StoredVisionSettings>;

    return {
      ...defaults,
      ...parsed,
      provider: isVisionProvider(parsed.provider) ? parsed.provider : "openai",
      huggingFaceModel:
        parsed.huggingFaceModel || defaults.huggingFaceModel,
      providerStatus: normalizeProviderStatus(parsed.providerStatus),
    };
  } catch {
    return defaults;
  }
}

function isVisionProvider(value: unknown): value is VisionProvider {
  return (
    value === "openai" ||
    value === "gemini" ||
    value === "huggingface" ||
    value === "auto"
  );
}

function normalizeProviderStatus(
  input?: Partial<Record<AiProvider, ProviderConnectionStatus>>,
): Record<AiProvider, ProviderConnectionStatus> {
  return {
    openai: input?.openai ?? defaults.providerStatus!.openai,
    gemini: input?.gemini ?? defaults.providerStatus!.gemini,
    huggingface: input?.huggingface ?? defaults.providerStatus!.huggingface,
  };
}

function writeStoredSettings(value: StoredVisionSettings) {
  fs.mkdirSync(path.dirname(getSettingsFile()), { recursive: true });
  fs.writeFileSync(getSettingsFile(), JSON.stringify(value, null, 2));
}

function statusFromTest(result: ProviderTestResult): ProviderConnectionStatus {
  const status =
    result.status === "missing_api_key" ? "offline" : result.status;
  return {
    status,
    message: result.message,
    latencyMs: result.latencyMs,
    testedAt: result.testedAt,
  };
}

export function getVisionSettings(): VisionSettings {
  const stored = readStoredSettings();

  return {
    provider: stored.provider,
    openaiModel: stored.openaiModel,
    geminiModel: stored.geminiModel,
    huggingFaceModel: stored.huggingFaceModel,
    openaiApiKey:
      process.env.OPENAI_API_KEY ??
      decryptSecret(stored.encryptedOpenaiApiKey),
    geminiApiKey:
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_API_KEY ??
      decryptSecret(stored.encryptedGeminiApiKey),
    huggingFaceApiKey:
      process.env.HF_API_KEY ??
      process.env.HUGGINGFACE_API_KEY ??
      decryptSecret(stored.encryptedHuggingFaceApiKey),
  };
}

export function getPublicVisionSettings(): PublicVisionSettings {
  const settings = getVisionSettings();

  return {
    provider: settings.provider,
    openaiModel: settings.openaiModel,
    geminiModel: settings.geminiModel,
    huggingFaceModel: settings.huggingFaceModel,
    hasOpenaiApiKey: Boolean(settings.openaiApiKey),
    hasGeminiApiKey: Boolean(settings.geminiApiKey),
    hasHuggingFaceApiKey: Boolean(settings.huggingFaceApiKey),
    maskedOpenaiApiKey: maskSecret("openai", settings.openaiApiKey),
    maskedGeminiApiKey: maskSecret("gemini", settings.geminiApiKey),
    maskedHuggingFaceApiKey: maskSecret(
      "huggingface",
      settings.huggingFaceApiKey,
    ),
    providerStatus: normalizeProviderStatus(readStoredSettings().providerStatus),
  };
}

export function saveVisionSettings(input: {
  provider: VisionProvider;
  openaiModel: string;
  geminiModel: string;
  huggingFaceModel?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  huggingFaceApiKey?: string;
  clearOpenaiApiKey?: boolean;
  clearGeminiApiKey?: boolean;
  clearHuggingFaceApiKey?: boolean;
}) {
  const current = readStoredSettings();
  const next: StoredVisionSettings = {
    provider: isVisionProvider(input.provider) ? input.provider : "openai",
    openaiModel: input.openaiModel.trim() || defaults.openaiModel,
    geminiModel: input.geminiModel.trim() || defaults.geminiModel,
    huggingFaceModel:
      input.huggingFaceModel?.trim() || defaults.huggingFaceModel,
    encryptedOpenaiApiKey: current.encryptedOpenaiApiKey,
    encryptedGeminiApiKey: current.encryptedGeminiApiKey,
    encryptedHuggingFaceApiKey: current.encryptedHuggingFaceApiKey,
    providerStatus: normalizeProviderStatus(current.providerStatus),
  };

  if (input.clearOpenaiApiKey) delete next.encryptedOpenaiApiKey;
  if (input.clearGeminiApiKey) delete next.encryptedGeminiApiKey;
  if (input.clearHuggingFaceApiKey) delete next.encryptedHuggingFaceApiKey;
  if (input.openaiApiKey?.trim()) {
    next.encryptedOpenaiApiKey = encryptSecret(input.openaiApiKey.trim());
  }
  if (input.geminiApiKey?.trim()) {
    next.encryptedGeminiApiKey = encryptSecret(input.geminiApiKey.trim());
  }
  if (input.huggingFaceApiKey?.trim()) {
    next.encryptedHuggingFaceApiKey = encryptSecret(
      input.huggingFaceApiKey.trim(),
    );
  }

  writeStoredSettings(next);
  logAiEvent("api_saved", { provider: next.provider });
  return getPublicVisionSettings();
}

export function removeProviderApiKey(provider: AiProvider) {
  const current = readStoredSettings();
  const next: StoredVisionSettings = {
    ...current,
    providerStatus: {
      ...normalizeProviderStatus(current.providerStatus),
      [provider]: {
        status: "offline",
        message: "AI Offline - Provider belum dikonfigurasi",
        latencyMs: null,
        testedAt: new Date().toISOString(),
      },
    },
  };

  if (provider === "openai") delete next.encryptedOpenaiApiKey;
  if (provider === "gemini") delete next.encryptedGeminiApiKey;
  if (provider === "huggingface") delete next.encryptedHuggingFaceApiKey;

  writeStoredSettings(next);
  logAiEvent("api_removed", { provider });
  return getPublicVisionSettings();
}

export async function testVisionProvider(provider: AiProvider) {
  const result = await testProvider(provider);
  const current = readStoredSettings();
  writeStoredSettings({
    ...current,
    providerStatus: {
      ...normalizeProviderStatus(current.providerStatus),
      [provider]: statusFromTest(result),
    },
  });
  return {
    settings: getPublicVisionSettings(),
    result,
  };
}
