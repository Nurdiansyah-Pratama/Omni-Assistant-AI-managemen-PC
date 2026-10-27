import type { VisionMode } from "../vision";
import type { VisionProvider } from "../visionSettings";

export type AiProvider = Exclude<VisionProvider, "auto">;
export type ProviderStatusCode =
  | "connected"
  | "missing_api_key"
  | "invalid_api_key"
  | "timeout"
  | "model_not_available"
  | "quota_exceeded"
  | "request_failed";

export interface ProviderTestResult {
  provider: AiProvider;
  ok: boolean;
  status: ProviderStatusCode;
  message: string;
  latencyMs: number | null;
  testedAt: string;
}

export interface ChatProviderInput {
  apiKey: string;
  model: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  mode: VisionMode;
  focus?: string;
  signal: AbortSignal;
}

export interface ChatProviderResult {
  message: string;
  provider: AiProvider;
  model: string;
  latencyMs: number;
}

export class ProviderError extends Error {
  status: ProviderStatusCode;

  constructor(status: ProviderStatusCode, message: string) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}

export function classifyHttpError(status: number, fallback: string) {
  if (status === 401 || status === 403) {
    return new ProviderError("invalid_api_key", "Invalid API Key");
  }
  if (status === 404) {
    return new ProviderError("model_not_available", "Model not available");
  }
  if (status === 429) {
    return new ProviderError("quota_exceeded", "Quota exceeded");
  }
  return new ProviderError("request_failed", fallback);
}

export function getErrorDetail(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  if (
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return undefined;
}
