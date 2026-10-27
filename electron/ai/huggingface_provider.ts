import {
  classifyHttpError,
  getErrorDetail,
  ProviderError,
  type ChatProviderInput,
  type ChatProviderResult,
} from "./base_provider";
import { buildSystemPrompt } from "./prompt_builder";

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

export async function requestHuggingFaceProvider(
  input: ChatProviderInput,
): Promise<ChatProviderResult> {
  const startedAt = Date.now();
  const response = await fetch(HF_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt({
            mode: input.mode,
            focus: input.focus,
            provider: "huggingface",
            model: input.model,
          }),
        },
        ...input.messages,
      ],
      max_tokens: 900,
      temperature: 0.3,
    }),
    signal: input.signal,
  });
  const payload = (await response.json().catch(() => undefined)) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!response.ok) {
    const detail = getErrorDetail(payload);
    throw classifyHttpError(
      response.status,
      detail
        ? `HuggingFace menolak request: ${detail}`
        : "Request HuggingFace gagal.",
    );
  }

  const message = payload.choices?.[0]?.message?.content?.trim();
  if (!message) {
    throw new ProviderError(
      "request_failed",
      "HuggingFace tidak mengembalikan jawaban teks.",
    );
  }

  return {
    provider: "huggingface",
    model: input.model,
    message,
    latencyMs: Date.now() - startedAt,
  };
}

export async function testHuggingFaceProvider(input: {
  apiKey: string;
  model: string;
  signal: AbortSignal;
}) {
  return requestHuggingFaceProvider({
    apiKey: input.apiKey,
    model: input.model,
    mode: "general",
    messages: [{ role: "user", content: "Reply with OK." }],
    signal: input.signal,
  });
}
