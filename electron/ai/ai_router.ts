import type { VisionMode } from "../vision";
import { getVisionSettings, type VisionProvider } from "../visionSettings";
import {
  ProviderError,
  type AiProvider,
  type ChatProviderResult,
  type ProviderStatusCode,
  type ProviderTestResult,
} from "./base_provider";
import { logAiEvent, providerLabel } from "./ai_logger";
import { normalizeChatMessages } from "./prompt_builder";
import { requestOpenAIProvider, testOpenAIProvider } from "./openai_provider";
import { requestGeminiProvider, testGeminiProvider } from "./gemini_provider";
import {
  requestHuggingFaceProvider,
  testHuggingFaceProvider,
} from "./huggingface_provider";

const REQUEST_TIMEOUT_MS = 45_000;
const TEST_TIMEOUT_MS = 15_000;

export interface AiChatRequest {
  messages: unknown;
  mode?: VisionMode;
  focus?: string;
  requiresVision?: boolean;
}

export type AiChatResponse =
  | {
      ok: true;
      message: string;
      provider: AiProvider;
      model: string;
      latencyMs: number;
      fallbackUsed: boolean;
    }
  | {
      ok: false;
      error: {
        code:
          | "missing_api_key"
          | "invalid_messages"
          | "request_failed"
          | ProviderStatusCode;
        message: string;
      };
    };

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { controller, timeout };
}

function providerHasKey(provider: AiProvider, settings = getVisionSettings()) {
  if (provider === "openai") return Boolean(settings.openaiApiKey);
  if (provider === "gemini") return Boolean(settings.geminiApiKey);
  return Boolean(settings.huggingFaceApiKey);
}

function providerModel(provider: AiProvider, settings = getVisionSettings()) {
  if (provider === "openai") return settings.openaiModel;
  if (provider === "gemini") return settings.geminiModel;
  return settings.huggingFaceModel;
}

function providerKey(provider: AiProvider, settings = getVisionSettings()) {
  if (provider === "openai") return settings.openaiApiKey;
  if (provider === "gemini") return settings.geminiApiKey;
  return settings.huggingFaceApiKey;
}

function providerOrder(input: {
  selected: VisionProvider;
  mode: VisionMode;
  requiresVision?: boolean;
}) {
  if (input.selected !== "auto") return [input.selected];

  if (input.requiresVision) return ["openai", "gemini", "huggingface"] as AiProvider[];
  if (input.mode === "coding") return ["openai", "huggingface", "gemini"] as AiProvider[];
  if (input.mode === "design") return ["gemini", "openai", "huggingface"] as AiProvider[];
  return ["openai", "gemini", "huggingface"] as AiProvider[];
}

function mapError(error: unknown) {
  if (error instanceof ProviderError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new ProviderError("timeout", "Timeout");
  }
  if (error instanceof Error) {
    return new ProviderError("request_failed", error.message);
  }
  return new ProviderError("request_failed", "Request provider gagal.");
}

async function runProvider(
  provider: AiProvider,
  input: {
    apiKey: string;
    model: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    mode: VisionMode;
    focus?: string;
    signal: AbortSignal;
  },
) {
  if (provider === "openai") return requestOpenAIProvider(input);
  if (provider === "gemini") return requestGeminiProvider(input);
  return requestHuggingFaceProvider(input);
}

export async function requestAiChat(
  request: AiChatRequest,
): Promise<AiChatResponse> {
  const messages = normalizeChatMessages(request.messages);
  const mode = request.mode ?? "general";

  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    return {
      ok: false,
      error: {
        code: "invalid_messages",
        message: "Pesan chat tidak valid atau kosong.",
      },
    };
  }

  const settings = getVisionSettings();
  const candidates = providerOrder({
    selected: settings.provider,
    mode,
    requiresVision: request.requiresVision,
  }).filter((provider) => providerHasKey(provider, settings));

  logAiEvent("chat_request", {
    provider: settings.provider,
    mode,
    candidates,
    requiresVision: Boolean(request.requiresVision),
  });

  if (!candidates.length) {
    return {
      ok: false,
      error: {
        code: "missing_api_key",
        message: "AI Offline - Provider belum dikonfigurasi.",
      },
    };
  }

  let lastError: ProviderError | null = null;

  for (const [index, provider] of candidates.entries()) {
    const apiKey = providerKey(provider, settings);
    if (!apiKey) continue;

    const { controller, timeout } = withTimeout(REQUEST_TIMEOUT_MS);
    try {
      logAiEvent("provider_selected", {
        provider,
        model: providerModel(provider, settings),
      });
      const result = (await runProvider(provider, {
        apiKey,
        model: providerModel(provider, settings),
        messages,
        mode,
        focus: request.focus,
        signal: controller.signal,
      })) as ChatProviderResult;

      if (index > 0) {
        logAiEvent("fallback_used", {
          provider,
          model: result.model,
          previousError: lastError?.status,
        });
      }

      return {
        ok: true,
        message:
          index > 0
            ? `[Fallback: ${providerLabel(provider)}]\n${result.message}`
            : result.message,
        provider,
        model: result.model,
        latencyMs: result.latencyMs,
        fallbackUsed: index > 0,
      };
    } catch (error) {
      lastError = mapError(error);
      logAiEvent("api_error", {
        provider,
        model: providerModel(provider, settings),
        status: lastError.status,
        message: lastError.message,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    error: {
      code: lastError?.status ?? "request_failed",
      message: lastError?.message ?? "Semua provider gagal dipakai.",
    },
  };
}

export async function testProvider(
  provider: AiProvider,
): Promise<ProviderTestResult> {
  const settings = getVisionSettings();
  const apiKey = providerKey(provider, settings);
  const model = providerModel(provider, settings);
  const startedAt = Date.now();

  if (!apiKey) {
    return {
      provider,
      ok: false,
      status: "missing_api_key",
      message: "AI Offline - Provider belum dikonfigurasi.",
      latencyMs: null,
      testedAt: new Date().toISOString(),
    };
  }

  const { controller, timeout } = withTimeout(TEST_TIMEOUT_MS);

  try {
    if (provider === "openai") {
      await testOpenAIProvider({ apiKey, model, signal: controller.signal });
    } else if (provider === "gemini") {
      await testGeminiProvider({ apiKey, model, signal: controller.signal });
    } else {
      await testHuggingFaceProvider({
        apiKey,
        model,
        signal: controller.signal,
      });
    }

    const latencyMs = Date.now() - startedAt;
    logAiEvent("api_test", { provider, model, status: "connected", latencyMs });

    return {
      provider,
      ok: true,
      status: "connected",
      message: `${providerLabel(provider)} Connected`,
      latencyMs,
      testedAt: new Date().toISOString(),
    };
  } catch (error) {
    const mapped = mapError(error);
    const latencyMs = Date.now() - startedAt;
    logAiEvent("api_test", {
      provider,
      model,
      status: mapped.status,
      latencyMs,
    });

    return {
      provider,
      ok: false,
      status: mapped.status,
      message: mapped.message,
      latencyMs,
      testedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
