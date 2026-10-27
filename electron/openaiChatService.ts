export interface OpenAIChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type OpenAIChatErrorCode =
  | "missing_api_key"
  | "invalid_messages"
  | "request_failed";

export type OpenAIChatResult =
  | { ok: true; message: string }
  | {
      ok: false;
      error: {
        code: OpenAIChatErrorCode;
        message: string;
      };
    };

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.5";
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_HISTORY_MESSAGES = 12;

const assistantInstructions = [
  "Kamu adalah Omni, asisten desktop untuk membantu coding, debugging, desain, dan pekerjaan komputer.",
  "Jawab dalam Bahasa Indonesia secara ringkas, konkret, dan ramah.",
  "Gunakan konteks percakapan yang tersedia.",
  "Jangan mengklaim telah mengklik, mengetik, mengedit file, atau menjalankan tindakan pada komputer.",
].join("\n");

function getApiErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
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

function getOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return undefined;

  if (
    "output_text" in payload &&
    typeof payload.output_text === "string" &&
    payload.output_text.trim()
  ) {
    return payload.output_text.trim();
  }

  if (!("output" in payload) || !Array.isArray(payload.output)) {
    return undefined;
  }

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
        typeof content.text === "string" &&
        content.text.trim()
      ) {
        return content.text.trim();
      }
    }
  }

  return undefined;
}

function normalizeMessages(messages: unknown) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (message): message is OpenAIChatMessage =>
        Boolean(message) &&
        typeof message === "object" &&
        "role" in message &&
        (message.role === "user" || message.role === "assistant") &&
        "content" in message &&
        typeof message.content === "string" &&
        Boolean(message.content.trim()),
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}

export async function requestOpenAIChat(
  messages: unknown,
): Promise<OpenAIChatResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return {
      ok: false,
      error: {
        code: "missing_api_key",
        message:
          "OPENAI_API_KEY belum diatur. Set environment variable tersebut, lalu jalankan ulang aplikasi.",
      },
    };
  }

  const input = normalizeMessages(messages);

  if (!input.length || input[input.length - 1]?.role !== "user") {
    return {
      ok: false,
      error: {
        code: "invalid_messages",
        message: "Pesan chat tidak valid atau kosong.",
      },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
        instructions: assistantInstructions,
        input,
        max_output_tokens: 900,
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => undefined)) as unknown;

    if (!response.ok) {
      const detail = getApiErrorMessage(payload);

      return {
        ok: false,
        error: {
          code: "request_failed",
          message: detail
            ? `OpenAI menolak request: ${detail}`
            : `Request OpenAI gagal dengan status HTTP ${response.status}.`,
        },
      };
    }

    const message = getOutputText(payload);

    if (!message) {
      return {
        ok: false,
        error: {
          code: "request_failed",
          message: "OpenAI tidak mengembalikan jawaban teks.",
        },
      };
    }

    return { ok: true, message };
  } catch (error) {
    const isTimeout =
      error instanceof Error && error.name === "AbortError";

    return {
      ok: false,
      error: {
        code: "request_failed",
        message: isTimeout
          ? "Request OpenAI melewati batas waktu. Coba lagi."
          : "Tidak dapat menghubungi OpenAI. Periksa koneksi internet lalu coba lagi.",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}
