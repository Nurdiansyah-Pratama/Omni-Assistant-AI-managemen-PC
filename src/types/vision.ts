export type AiProvider = "openai" | "gemini" | "huggingface";
export type VisionProvider = AiProvider | "auto";
export type VisionMode = "general" | "coding" | "design";

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

export interface ProviderTestResult {
  provider: AiProvider;
  ok: boolean;
  status:
    | "connected"
    | "missing_api_key"
    | "invalid_api_key"
    | "timeout"
    | "model_not_available"
    | "quota_exceeded"
    | "request_failed";
  message: string;
  latencyMs: number | null;
  testedAt: string;
}

export interface VisionSettings {
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

export interface VisionSettingsInput {
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
}

export interface ScreenAnalysis {
  capturedAt: string;
  displayName: string;
  width: number;
  height: number;
  provider: AiProvider;
  analysis: string;
}
