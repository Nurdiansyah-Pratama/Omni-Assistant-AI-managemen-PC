import type { AiProvider } from "./base_provider";

type AiLogEvent =
  | "provider_selected"
  | "api_test"
  | "api_saved"
  | "api_removed"
  | "chat_request"
  | "vision_request"
  | "fallback_used"
  | "api_error";

export function logAiEvent(
  event: AiLogEvent,
  metadata: Record<string, unknown> = {},
) {
  const safeMetadata = { ...metadata };
  delete safeMetadata.apiKey;
  delete safeMetadata.openaiApiKey;
  delete safeMetadata.geminiApiKey;
  delete safeMetadata.huggingFaceApiKey;

  console.info("[omni-ai]", {
    event,
    ...safeMetadata,
    createdAt: new Date().toISOString(),
  });
}

export function providerLabel(provider: AiProvider | "auto") {
  if (provider === "openai") return "OpenAI";
  if (provider === "gemini") return "Gemini";
  if (provider === "huggingface") return "HuggingFace";
  return "Auto";
}
