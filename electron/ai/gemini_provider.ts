import {
  classifyHttpError,
  getErrorDetail,
  ProviderError,
  type ChatProviderInput,
  type ChatProviderResult,
} from "./base_provider";
import { buildSystemPrompt } from "./prompt_builder";

function toGeminiContents(messages: ChatProviderInput["messages"]) {
  return messages.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

export async function requestGeminiProvider(
  input: ChatProviderInput,
): Promise<ChatProviderResult> {
  const startedAt = Date.now();
  const model = encodeURIComponent(input.model);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: buildSystemPrompt({
                mode: input.mode,
                focus: input.focus,
                provider: "gemini",
                model: input.model,
              }),
            },
          ],
        },
        contents: toGeminiContents(input.messages),
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 900,
        },
      }),
      signal: input.signal,
    },
  );
  const payload = (await response.json().catch(() => undefined)) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  if (!response.ok) {
    const detail = getErrorDetail(payload);
    throw classifyHttpError(
      response.status,
      detail ? `Gemini menolak request: ${detail}` : "Request Gemini gagal.",
    );
  }

  const message = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!message) {
    throw new ProviderError("request_failed", "Gemini tidak mengembalikan jawaban teks.");
  }

  return {
    provider: "gemini",
    model: input.model,
    message,
    latencyMs: Date.now() - startedAt,
  };
}

export async function testGeminiProvider(input: {
  apiKey: string;
  model: string;
  signal: AbortSignal;
}) {
  return requestGeminiProvider({
    apiKey: input.apiKey,
    model: input.model,
    mode: "general",
    messages: [{ role: "user", content: "Reply with OK." }],
    signal: input.signal,
  });
}
