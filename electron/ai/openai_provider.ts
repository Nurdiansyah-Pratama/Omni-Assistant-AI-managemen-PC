import {
  classifyHttpError,
  getErrorDetail,
  ProviderError,
  type ChatProviderInput,
  type ChatProviderResult,
} from "./base_provider";
import { buildSystemPrompt } from "./prompt_builder";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function getOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;
  if ("output_text" in payload && typeof payload.output_text === "string") {
    return payload.output_text.trim();
  }
  if (!("output" in payload) || !Array.isArray(payload.output)) return undefined;

  for (const item of payload.output) {
    if (!item || typeof item !== "object") continue;
    if (!("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (
        content &&
        typeof content === "object" &&
        "type" in content &&
        content.type === "output_text" &&
        "text" in content &&
        typeof content.text === "string"
      ) {
        return content.text.trim();
      }
    }
  }

  return undefined;
}

export async function requestOpenAIProvider(
  input: ChatProviderInput,
): Promise<ChatProviderResult> {
  const startedAt = Date.now();
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      instructions: buildSystemPrompt({
        mode: input.mode,
        focus: input.focus,
        provider: "openai",
        model: input.model,
      }),
      input: input.messages,
      max_output_tokens: 900,
    }),
    signal: input.signal,
  });
  const payload = (await response.json().catch(() => undefined)) as unknown;

  if (!response.ok) {
    const detail = getErrorDetail(payload);
    throw classifyHttpError(
      response.status,
      detail ? `OpenAI menolak request: ${detail}` : "Request OpenAI gagal.",
    );
  }

  const message = getOutputText(payload);
  if (!message) {
    throw new ProviderError("request_failed", "OpenAI tidak mengembalikan jawaban teks.");
  }

  return {
    provider: "openai",
    model: input.model,
    message,
    latencyMs: Date.now() - startedAt,
  };
}

export async function testOpenAIProvider(input: {
  apiKey: string;
  model: string;
  signal: AbortSignal;
}) {
  return requestOpenAIProvider({
    apiKey: input.apiKey,
    model: input.model,
    mode: "general",
    messages: [{ role: "user", content: "Reply with OK." }],
    signal: input.signal,
  });
}
